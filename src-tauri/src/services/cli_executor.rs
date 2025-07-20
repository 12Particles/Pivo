use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio, Child, ChildStdin};
use std::sync::{Arc, Mutex};
use std::thread;
use serde::{Deserialize, Serialize};
use serde_json;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use log::{info, debug, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliSession {
    pub id: String,
    pub task_id: String,
    pub executor_type: CliExecutorType,
    pub working_directory: String,
    pub status: CliSessionStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CliExecutorType {
    ClaudeCode,
    GeminiCli,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CliSessionStatus {
    Starting,
    Running,
    Stopped,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliOutput {
    pub session_id: String,
    pub task_id: String,
    pub output_type: CliOutputType,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CliOutputType {
    Stdout,
    Stderr,
    System,
}

pub struct CliExecutorService {
    sessions: Arc<Mutex<HashMap<String, CliProcess>>>,
    app_handle: AppHandle,
}

struct CliProcess {
    session: CliSession,
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    claude_session_id: Option<String>,
}

impl CliExecutorService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    pub fn start_claude_session(
        &self,
        task_id: &str,
        working_directory: &str,
        _project_path: Option<&str>,
        stored_claude_session_id: Option<&str>,
    ) -> Result<CliSession, String> {
        info!("Starting Claude Code session for task: {}", task_id);
        let session_id = Uuid::new_v4().to_string();
        let session = CliSession {
            id: session_id.clone(),
            task_id: task_id.to_string(),
            executor_type: CliExecutorType::ClaudeCode,
            working_directory: working_directory.to_string(),
            status: CliSessionStatus::Running,
            created_at: chrono::Utc::now(),
        };

        // Store the session info
        let mut sessions = self.sessions.lock().unwrap();
        // Check if there's already a session for this task and remove it
        sessions.retain(|_, process| process.session.task_id != task_id);
        
        sessions.insert(session_id.clone(), CliProcess {
            session: session.clone(),
            child: None,
            stdin: None,
            claude_session_id: stored_claude_session_id.map(|s| s.to_string()),
        });
        drop(sessions);
        
        // Emit session created event
        self.emit_session_status(&session);
        
        Ok(session)
    }

    pub fn start_gemini_session(
        &self,
        task_id: &str,
        working_directory: &str,
        context_files: Vec<String>,
    ) -> Result<CliSession, String> {
        let session_id = Uuid::new_v4().to_string();
        let mut session = CliSession {
            id: session_id.clone(),
            task_id: task_id.to_string(),
            executor_type: CliExecutorType::GeminiCli,
            working_directory: working_directory.to_string(),
            status: CliSessionStatus::Starting,
            created_at: chrono::Utc::now(),
        };

        // Build Gemini CLI command
        let mut cmd = Command::new("gemini");
        cmd.current_dir(working_directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Add context files
        for file in context_files {
            cmd.arg("-f").arg(file);
        }

        // Add interactive mode
        cmd.arg("-i");

        self.spawn_cli_process(cmd, &mut session)?;
        Ok(session)
    }

    fn spawn_cli_process(
        &self,
        mut cmd: Command,
        session: &mut CliSession,
    ) -> Result<(), String> {
        info!("Spawning process with command: {:?}", cmd);
        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn CLI process: {}", e))?;
        info!("Process spawned successfully with PID: {:?}", child.id());

        let stdin = child.stdin.take();
        let stdout = child.stdout.take()
            .ok_or_else(|| "Failed to get stdout".to_string())?;
        let stderr = child.stderr.take()
            .ok_or_else(|| "Failed to get stderr".to_string())?;

        let session_id = session.id.clone();
        let task_id = session.task_id.clone();

        // Don't test immediate write for Claude Code

        // Handle stdout
        let session_id_clone = session_id.clone();
        let task_id_clone = task_id.clone();
        let app_handle_clone = self.app_handle.clone();
        thread::spawn(move || {
            debug!("Starting stdout reader thread for session: {}", session_id_clone);
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    debug!("CLI stdout: {}", line);
                    
                    // Parse JSON output from Claude Code
                    let content = if let Ok(json_data) = serde_json::from_str::<serde_json::Value>(&line) {
                        // Extract the actual content from JSON format
                        if let Some(msg_type) = json_data.get("type").and_then(|t| t.as_str()) {
                            match msg_type {
                                "assistant" => {
                                    if let Some(message) = json_data.get("message") {
                                        if let Some(content_array) = message.get("content").and_then(|c| c.as_array()) {
                                            let mut text_parts = Vec::new();
                                            for item in content_array {
                                                if let Some(item_type) = item.get("type").and_then(|t| t.as_str()) {
                                                    match item_type {
                                                        "text" => {
                                                            if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                                                text_parts.push(text.to_string());
                                                            }
                                                        }
                                                        "tool_use" => {
                                                            if let Some(tool_name) = item.get("name").and_then(|n| n.as_str()) {
                                                                text_parts.push(format!("[Using tool: {}]", tool_name));
                                                            }
                                                        }
                                                        _ => {}
                                                    }
                                                }
                                            }
                                            text_parts.join("\n")
                                        } else {
                                            line.clone()
                                        }
                                    } else {
                                        line.clone()
                                    }
                                }
                                "user" => {
                                    if let Some(message) = json_data.get("message") {
                                        if let Some(content_array) = message.get("content").and_then(|c| c.as_array()) {
                                            let mut text_parts = Vec::new();
                                            for item in content_array {
                                                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                                    text_parts.push(format!("> {}", text));
                                                }
                                            }
                                            text_parts.join("\n")
                                        } else {
                                            line.clone()
                                        }
                                    } else {
                                        line.clone()
                                    }
                                }
                                "result" => {
                                    if let Some(result) = json_data.get("result") {
                                        if let Some(result_str) = result.as_str() {
                                            result_str.to_string()
                                        } else {
                                            serde_json::to_string_pretty(result).unwrap_or_else(|_| line.clone())
                                        }
                                    } else {
                                        line.clone()
                                    }
                                }
                                "system" => {
                                    if let Some(subtype) = json_data.get("subtype").and_then(|s| s.as_str()) {
                                        match subtype {
                                            "init" => {
                                                format!("System initialized with model: {}", 
                                                    json_data.get("model").and_then(|m| m.as_str()).unwrap_or("unknown"))
                                            }
                                            _ => line.clone()
                                        }
                                    } else {
                                        line.clone()
                                    }
                                }
                                _ => line.clone()
                            }
                        } else {
                            line.clone()
                        }
                    } else {
                        // Not JSON, use raw line
                        line.clone()
                    };
                    
                    let output = CliOutput {
                        session_id: session_id_clone.clone(),
                        task_id: task_id_clone.clone(),
                        output_type: CliOutputType::Stdout,
                        content,
                        timestamp: chrono::Utc::now(),
                    };
                    let _ = app_handle_clone.emit("cli-output", &output);
                }
            }
            debug!("Stdout reader thread ended for session: {}", session_id_clone);
        });

        // Handle stderr
        let session_id_clone = session_id.clone();
        let task_id_clone = task_id.clone();
        let app_handle_clone = self.app_handle.clone();
        thread::spawn(move || {
            debug!("Starting stderr reader thread for session: {}", session_id_clone);
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    debug!("CLI stderr: {}", line);
                    let output = CliOutput {
                        session_id: session_id_clone.clone(),
                        task_id: task_id_clone.clone(),
                        output_type: CliOutputType::Stderr,
                        content: line,
                        timestamp: chrono::Utc::now(),
                    };
                    let _ = app_handle_clone.emit("cli-output", &output);
                }
            }
            debug!("Stderr reader thread ended for session: {}", session_id_clone);
        });

        session.status = CliSessionStatus::Running;
        self.emit_session_status(session);

        // Store process
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id, CliProcess {
            session: session.clone(),
            child: Some(child),
            stdin,
            claude_session_id: None,  // Gemini doesn't use Claude session ID
        });

        Ok(())
    }

    pub fn send_input(&self, session_id: &str, input: &str) -> Result<(), String> {
        info!("Sending input to session {}: {}", session_id, input);
        
        // Get session info
        let sessions = self.sessions.lock().unwrap();
        let process = sessions.get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        
        let working_directory = process.session.working_directory.clone();
        let task_id = process.session.task_id.clone();
        let claude_session_id = process.claude_session_id.clone();
        drop(sessions);

        // Build Claude Code command
        let mut cmd = Command::new("npx");
        cmd.current_dir(&working_directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .args(&[
                "-y",
                "@anthropic-ai/claude-code@latest",
                "-p",  // Print mode (non-interactive)
                "--dangerously-skip-permissions",
                "--verbose",
                "--output-format=stream-json"
            ])
            .env("NODE_NO_WARNINGS", "1");
        
        // Add --resume flag if we have a Claude session ID
        if let Some(claude_sid) = claude_session_id {
            info!("Using Claude session ID for resume: {}", claude_sid);
            cmd.arg("--resume");
            cmd.arg(claude_sid);
        }

        info!("Spawning Claude Code with command: {:?}", cmd);
        
        // Spawn the process
        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn Claude Code: {}", e))?;
        
        // Get stdin and write the prompt
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;
            // Close stdin to signal we're done sending input
            drop(stdin);
        }
        
        // Handle stdout in a thread
        if let Some(stdout) = child.stdout.take() {
            let session_id_clone = session_id.to_string();
            let task_id_clone = task_id.clone();
            let app_handle_clone = self.app_handle.clone();
            let sessions_clone = self.sessions.clone();
            thread::spawn(move || {
                debug!("Reading Claude Code output for session: {}", session_id_clone);
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        debug!("Claude stdout: {}", line);
                        
                        // Parse JSON output from Claude Code
                        let content = if let Ok(json_data) = serde_json::from_str::<serde_json::Value>(&line) {
                            // Check for session_id in the JSON
                            if let Some(claude_session_id) = json_data.get("session_id").and_then(|s| s.as_str()) {
                                // Store the Claude session ID
                                let mut sessions = sessions_clone.lock().unwrap();
                                if let Some(process) = sessions.get_mut(&session_id_clone) {
                                    process.claude_session_id = Some(claude_session_id.to_string());
                                    info!("Stored Claude session ID: {}", claude_session_id);
                                    
                                    // Emit event to frontend to save Claude session ID
                                    let _ = app_handle_clone.emit("claude-session-id-received", serde_json::json!({
                                        "task_id": task_id_clone.clone(),
                                        "session_id": session_id_clone.clone(),
                                        "claude_session_id": claude_session_id
                                    }));
                                }
                            }
                            
                            // Extract the actual content from JSON format
                            if let Some(msg_type) = json_data.get("type").and_then(|t| t.as_str()) {
                                match msg_type {
                                    "assistant" => {
                                        if let Some(message) = json_data.get("message") {
                                            if let Some(content_array) = message.get("content").and_then(|c| c.as_array()) {
                                                let mut text_parts = Vec::new();
                                                for item in content_array {
                                                    if let Some(item_type) = item.get("type").and_then(|t| t.as_str()) {
                                                        match item_type {
                                                            "text" => {
                                                                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                                                    text_parts.push(text.to_string());
                                                                }
                                                            }
                                                            "tool_use" => {
                                                                if let Some(tool_name) = item.get("name").and_then(|n| n.as_str()) {
                                                                    text_parts.push(format!("[Using tool: {}]", tool_name));
                                                                    
                                                                    // Also include the tool input if available
                                                                    if let Some(input) = item.get("input") {
                                                                        if let Ok(input_str) = serde_json::to_string_pretty(input) {
                                                                            text_parts.push(format!("Input:\n{}", input_str));
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            _ => {}
                                                        }
                                                    }
                                                }
                                                text_parts.join("\n")
                                            } else {
                                                line.clone()
                                            }
                                        } else {
                                            line.clone()
                                        }
                                    }
                                    "user" => {
                                        if let Some(message) = json_data.get("message") {
                                            if let Some(content_array) = message.get("content").and_then(|c| c.as_array()) {
                                                let mut text_parts = Vec::new();
                                                for item in content_array {
                                                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                                        text_parts.push(format!("> {}", text));
                                                    }
                                                }
                                                text_parts.join("\n")
                                            } else {
                                                line.clone()
                                            }
                                        } else {
                                            line.clone()
                                        }
                                    }
                                    "result" => {
                                        if let Some(result) = json_data.get("result") {
                                            if let Some(result_str) = result.as_str() {
                                                result_str.to_string()
                                            } else {
                                                serde_json::to_string_pretty(result).unwrap_or_else(|_| line.clone())
                                            }
                                        } else {
                                            line.clone()
                                        }
                                    }
                                    "system" => {
                                        if let Some(subtype) = json_data.get("subtype").and_then(|s| s.as_str()) {
                                            match subtype {
                                                "init" => {
                                                    format!("System initialized with model: {}", 
                                                        json_data.get("model").and_then(|m| m.as_str()).unwrap_or("unknown"))
                                                }
                                                "summary" => {
                                                    if let Some(summary) = json_data.get("summary") {
                                                        format!("Session Summary:\n{}", 
                                                            serde_json::to_string_pretty(summary).unwrap_or_else(|_| "N/A".to_string()))
                                                    } else {
                                                        line.clone()
                                                    }
                                                }
                                                _ => line.clone()
                                            }
                                        } else {
                                            line.clone()
                                        }
                                    }
                                    _ => line.clone()
                                }
                            } else {
                                line.clone()
                            }
                        } else {
                            // Not JSON, use raw line
                            line.clone()
                        };
                        
                        let output = CliOutput {
                            session_id: session_id_clone.clone(),
                            task_id: task_id_clone.clone(),
                            output_type: CliOutputType::Stdout,
                            content,
                            timestamp: chrono::Utc::now(),
                        };
                        let _ = app_handle_clone.emit("cli-output", &output);
                    }
                }
                debug!("Claude Code output reading completed for session: {}", session_id_clone);
                
                // When Claude Code completes, update task status to Reviewing
                let app_handle_for_status = app_handle_clone.clone();
                let task_id_for_status = task_id_clone.clone();
                thread::spawn(move || {
                    info!("Updating task status to Reviewing for task: {}", task_id_for_status);
                    let _ = app_handle_for_status.emit("cli-process-completed", serde_json::json!({
                        "task_id": task_id_for_status,
                        "session_id": session_id_clone
                    }));
                });
            });
        }
        
        // Handle stderr in a thread
        if let Some(stderr) = child.stderr.take() {
            let session_id_clone = session_id.to_string();
            let task_id_clone = task_id.clone();
            let app_handle_clone = self.app_handle.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        debug!("Claude stderr: {}", line);
                        let output = CliOutput {
                            session_id: session_id_clone.clone(),
                            task_id: task_id_clone.clone(),
                            output_type: CliOutputType::Stderr,
                            content: line,
                            timestamp: chrono::Utc::now(),
                        };
                        let _ = app_handle_clone.emit("cli-output", &output);
                    }
                }
            });
        }
        
        // Emit the input as well for UI display
        let output = CliOutput {
            session_id: session_id.to_string(),
            task_id: task_id.clone(),
            output_type: CliOutputType::Stdout,
            content: format!("> {}", input),
            timestamp: chrono::Utc::now(),
        };
        let _ = self.app_handle.emit("cli-output", &output);

        Ok(())
    }

    pub fn stop_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(mut process) = sessions.remove(session_id) {
            if let Some(mut child) = process.child {
                // Try graceful shutdown first
                if let Some(stdin) = &mut process.stdin {
                    let _ = stdin.write_all(b"/exit\n");
                    let _ = stdin.flush();
                }

                // Wait a bit for graceful shutdown
                std::thread::sleep(std::time::Duration::from_millis(500));

                // Force kill if still running
                let _ = child.kill();
                let _ = child.wait();
            }

            process.session.status = CliSessionStatus::Stopped;
            self.emit_session_status(&process.session);
        }

        Ok(())
    }

    pub fn get_session(&self, session_id: &str) -> Option<CliSession> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(session_id).map(|p| p.session.clone())
    }

    pub fn list_sessions(&self) -> Vec<CliSession> {
        let sessions = self.sessions.lock().unwrap();
        sessions.values().map(|p| p.session.clone()).collect()
    }

    fn emit_session_status(&self, session: &CliSession) {
        let _ = self.app_handle.emit("cli-session-status", session);
    }

    pub fn configure_claude_api_key(&self, api_key: &str) -> Result<(), String> {
        std::env::set_var("ANTHROPIC_API_KEY", api_key);
        Ok(())
    }

    pub fn configure_gemini_api_key(&self, api_key: &str) -> Result<(), String> {
        std::env::set_var("GEMINI_API_KEY", api_key);
        Ok(())
    }
}