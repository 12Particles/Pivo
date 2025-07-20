use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub capabilities: McpCapabilities,
    pub status: McpServerStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpCapabilities {
    pub tools: bool,
    pub resources: bool,
    pub prompts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum McpServerStatus {
    Stopped,
    Starting,
    Running,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResource {
    pub name: String,
    pub uri: String,
    pub description: Option<String>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPrompt {
    pub name: String,
    pub description: Option<String>,
    pub arguments: Vec<McpPromptArgument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPromptArgument {
    pub name: String,
    pub description: Option<String>,
    pub required: bool,
}

pub struct McpServerManager {
    servers: Arc<Mutex<HashMap<String, McpServerInstance>>>,
    app_handle: AppHandle,
}

struct McpServerInstance {
    server: McpServer,
    process: Option<std::process::Child>,
    stdin: Option<std::process::ChildStdin>,
}

impl McpServerManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            servers: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    pub fn register_server(&self, server: McpServer) -> Result<String, String> {
        let server_id = server.id.clone();
        let mut servers = self.servers.lock().unwrap();
        
        servers.insert(server_id.clone(), McpServerInstance {
            server,
            process: None,
            stdin: None,
        });

        Ok(server_id)
    }

    pub fn start_server(&self, server_id: &str) -> Result<(), String> {
        let mut servers = self.servers.lock().unwrap();
        let instance = servers.get_mut(server_id)
            .ok_or_else(|| "Server not found".to_string())?;

        if instance.process.is_some() {
            return Err("Server already running".to_string());
        }

        // Update status
        instance.server.status = McpServerStatus::Starting;
        self.emit_server_status(&instance.server);

        // Start process
        let mut cmd = Command::new(&instance.server.command);
        cmd.args(&instance.server.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Set environment variables
        for (key, value) in &instance.server.env {
            cmd.env(key, value);
        }

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to start server: {}", e))?;

        let stdin = child.stdin.take();
        let stdout = child.stdout.take()
            .ok_or_else(|| "Failed to get stdout".to_string())?;
        let stderr = child.stderr.take()
            .ok_or_else(|| "Failed to get stderr".to_string())?;

        // Handle stdout
        let server_id_clone = server_id.to_string();
        let app_handle_clone = self.app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Ok(msg) = serde_json::from_str::<Value>(&line) {
                        let _ = app_handle_clone.emit("mcp-message", json!({
                            "server_id": server_id_clone,
                            "message": msg,
                        }));
                    }
                }
            }
        });

        // Handle stderr
        let server_id_clone = server_id.to_string();
        let app_handle_clone = self.app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_handle_clone.emit("mcp-error", json!({
                        "server_id": server_id_clone,
                        "error": line,
                    }));
                }
            }
        });

        instance.process = Some(child);
        instance.stdin = stdin;
        instance.server.status = McpServerStatus::Running;
        self.emit_server_status(&instance.server);

        // Initialize the server
        self.initialize_server(server_id)?;

        Ok(())
    }

    pub fn stop_server(&self, server_id: &str) -> Result<(), String> {
        let mut servers = self.servers.lock().unwrap();
        let instance = servers.get_mut(server_id)
            .ok_or_else(|| "Server not found".to_string())?;

        if let Some(mut process) = instance.process.take() {
            let _ = process.kill();
            let _ = process.wait();
        }

        instance.stdin = None;
        instance.server.status = McpServerStatus::Stopped;
        self.emit_server_status(&instance.server);

        Ok(())
    }

    pub fn send_request(
        &self,
        server_id: &str,
        method: &str,
        params: Option<Value>,
    ) -> Result<String, String> {
        let mut servers = self.servers.lock().unwrap();
        let instance = servers.get_mut(server_id)
            .ok_or_else(|| "Server not found".to_string())?;

        if let Some(stdin) = &mut instance.stdin {
            let request_id = Uuid::new_v4().to_string();
            let request = json!({
                "jsonrpc": "2.0",
                "id": request_id,
                "method": method,
                "params": params.unwrap_or(json!({})),
            });

            let mut request_str = serde_json::to_string(&request)
                .map_err(|e| format!("Failed to serialize request: {}", e))?;
            request_str.push('\n');

            stdin.write_all(request_str.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;

            Ok(request_id)
        } else {
            Err("Server not running".to_string())
        }
    }

    pub fn list_servers(&self) -> Vec<McpServer> {
        let servers = self.servers.lock().unwrap();
        servers.values().map(|instance| instance.server.clone()).collect()
    }

    pub fn get_server(&self, server_id: &str) -> Option<McpServer> {
        let servers = self.servers.lock().unwrap();
        servers.get(server_id).map(|instance| instance.server.clone())
    }

    fn initialize_server(&self, server_id: &str) -> Result<(), String> {
        // Send initialize request
        self.send_request(server_id, "initialize", Some(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": true,
                "resources": true,
                "prompts": true,
            },
            "clientInfo": {
                "name": "Pivo IDE",
                "version": "0.1.0",
            },
        })))?;

        Ok(())
    }

    fn emit_server_status(&self, server: &McpServer) {
        let _ = self.app_handle.emit("mcp-server-status", server);
    }
}

// Tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionRequest {
    pub server_id: String,
    pub tool_name: String,
    pub arguments: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub content: Vec<ToolContent>,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { data: String, mime_type: String },
    #[serde(rename = "resource")]
    Resource { uri: String, text: Option<String> },
}