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
pub struct CliExecution {
    pub id: String,
    pub task_id: String,
    pub executor_type: CliExecutorType,
    pub working_directory: String,
    pub status: CliExecutionStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CliExecutorType {
    ClaudeCode,
    GeminiCli,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CliExecutionStatus {
    Starting,
    Running,
    Stopped,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliOutput {
    pub execution_id: String,
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
    executions: Arc<Mutex<HashMap<String, CliProcess>>>,
    app_handle: AppHandle,
}

struct CliProcess {
    execution: CliExecution,
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    claude_session_id: Option<String>,
}

impl CliExecutorService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            executions: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    pub fn start_claude_execution(
        &self,
        task_id: &str,
        working_directory: &str,
        _project_path: Option<&str>,
        stored_claude_session_id: Option<&str>,
    ) -> Result<CliExecution, String> {
        info!("Starting Claude Code execution for task: {}", task_id);
        let execution_id = Uuid::new_v4().to_string();
        let execution = CliExecution {
            id: execution_id.clone(),
            task_id: task_id.to_string(),
            executor_type: CliExecutorType::ClaudeCode,
            working_directory: working_directory.to_string(),
            status: CliExecutionStatus::Running,
            created_at: chrono::Utc::now(),
        };

        // Store the session info
        let mut executions = self.executions.lock().unwrap();
        // Check if there's already a session for this task and remove it
        executions.retain(|_, process| process.execution.task_id != task_id);
        
        executions.insert(execution_id.clone(), CliProcess {
            execution: execution.clone(),
            child: None,
            stdin: None,
            claude_session_id: stored_claude_session_id.map(|s| s.to_string()),
        });
        drop(executions);
        
        // Emit session created event
        self.emit_execution_status(&execution);
        
        Ok(execution)
    }

    pub fn start_gemini_execution(
        &self,
        task_id: &str,
        working_directory: &str,
        context_files: Vec<String>,
    ) -> Result<CliExecution, String> {
        let execution_id = Uuid::new_v4().to_string();
        let mut execution = CliExecution {
            id: execution_id.clone(),
            task_id: task_id.to_string(),
            executor_type: CliExecutorType::GeminiCli,
            working_directory: working_directory.to_string(),
            status: CliExecutionStatus::Starting,
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

        self.spawn_cli_process(cmd, &mut execution)?;
        Ok(execution)
    }

    fn spawn_cli_process(
        &self,
        mut cmd: Command,
        execution: &mut CliExecution,
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

        let execution_id = execution.id.clone();
        let task_id = execution.task_id.clone();

        // Don't test immediate write for Claude Code

        // Handle stdout
        let execution_id_clone = execution_id.clone();
        let task_id_clone = task_id.clone();
        let app_handle_clone = self.app_handle.clone();
        thread::spawn(move || {
            debug!("Starting stdout reader thread for execution: {}", execution_id_clone);
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
                        execution_id: execution_id_clone.clone(),
                        task_id: task_id_clone.clone(),
                        output_type: CliOutputType::Stdout,
                        content,
                        timestamp: chrono::Utc::now(),
                    };
                    let _ = app_handle_clone.emit("cli-output", &output);
                }
            }
            debug!("Stdout reader thread ended for session: {}", execution_id_clone);
        });

        // Handle stderr
        let execution_id_clone = execution_id.clone();
        let task_id_clone = task_id.clone();
        let app_handle_clone = self.app_handle.clone();
        thread::spawn(move || {
            debug!("Starting stderr reader thread for execution: {}", execution_id_clone);
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    debug!("CLI stderr: {}", line);
                    let output = CliOutput {
                        execution_id: execution_id_clone.clone(),
                        task_id: task_id_clone.clone(),
                        output_type: CliOutputType::Stderr,
                        content: line,
                        timestamp: chrono::Utc::now(),
                    };
                    let _ = app_handle_clone.emit("cli-output", &output);
                }
            }
            debug!("Stderr reader thread ended for session: {}", execution_id_clone);
        });

        execution.status = CliExecutionStatus::Running;
        self.emit_execution_status(execution);

        // Store process
        let mut executions = self.executions.lock().unwrap();
        executions.insert(execution_id, CliProcess {
            execution: execution.clone(),
            child: Some(child),
            stdin,
            claude_session_id: None,  // Gemini doesn't use Claude session ID
        });

        Ok(())
    }

    pub fn send_input(&self, execution_id: &str, input: &str) -> Result<(), String> {
        info!("Sending input to session {}: {}", execution_id, input);
        
        // Get session info
        let executions = self.executions.lock().unwrap();
        let process = executions.get(execution_id)
            .ok_or_else(|| "Session not found".to_string())?;
        
        let working_directory = process.execution.working_directory.clone();
        let task_id = process.execution.task_id.clone();
        let claude_session_id = process.claude_session_id.clone();
        drop(executions);

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
            let execution_id_clone = execution_id.to_string();
            let task_id_clone = task_id.clone();
            let app_handle_clone = self.app_handle.clone();
            let sessions_clone = self.executions.clone();
            thread::spawn(move || {
                debug!("Reading Claude Code output for session: {}", execution_id_clone);
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        debug!("Claude stdout: {}", line);
                        
                        // Parse JSON output from Claude Code
                        let content = if let Ok(json_data) = serde_json::from_str::<serde_json::Value>(&line) {
                            // Check for execution_id in the JSON
                            if let Some(claude_session_id) = json_data.get("session_id").and_then(|s| s.as_str()) {
                                // Store the Claude session ID
                                let mut executions = sessions_clone.lock().unwrap();
                                if let Some(process) = executions.get_mut(&execution_id_clone) {
                                    process.claude_session_id = Some(claude_session_id.to_string());
                                    info!("Stored Claude session ID: {}", claude_session_id);
                                    
                                    // Emit event to frontend to save Claude session ID
                                    let _ = app_handle_clone.emit("claude-session-id-received", serde_json::json!({
                                        "task_id": task_id_clone.clone(),
                                        "execution_id": execution_id_clone.clone(),
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
                            execution_id: execution_id_clone.clone(),
                            task_id: task_id_clone.clone(),
                            output_type: CliOutputType::Stdout,
                            content,
                            timestamp: chrono::Utc::now(),
                        };
                        let _ = app_handle_clone.emit("cli-output", &output);
                    }
                }
                debug!("Claude Code output reading completed for session: {}", execution_id_clone);
                
                // When Claude Code completes, update task status to Reviewing
                let app_handle_for_status = app_handle_clone.clone();
                let task_id_for_status = task_id_clone.clone();
                thread::spawn(move || {
                    info!("Updating task status to Reviewing for task: {}", task_id_for_status);
                    let _ = app_handle_for_status.emit("cli-process-completed", serde_json::json!({
                        "task_id": task_id_for_status,
                        "execution_id": execution_id_clone
                    }));
                });
            });
        }
        
        // Handle stderr in a thread
        if let Some(stderr) = child.stderr.take() {
            let execution_id_clone = execution_id.to_string();
            let task_id_clone = task_id.clone();
            let app_handle_clone = self.app_handle.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        debug!("Claude stderr: {}", line);
                        let output = CliOutput {
                            execution_id: execution_id_clone.clone(),
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
            execution_id: execution_id.to_string(),
            task_id: task_id.clone(),
            output_type: CliOutputType::Stdout,
            content: format!("> {}", input),
            timestamp: chrono::Utc::now(),
        };
        let _ = self.app_handle.emit("cli-output", &output);

        Ok(())
    }

    pub fn stop_execution(&self, execution_id: &str) -> Result<(), String> {
        let mut executions = self.executions.lock().unwrap();
        if let Some(mut process) = executions.remove(execution_id) {
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

            process.execution.status = CliExecutionStatus::Stopped;
            self.emit_execution_status(&process.execution);
        }

        Ok(())
    }

    pub fn get_execution(&self, execution_id: &str) -> Option<CliExecution> {
        let executions = self.executions.lock().unwrap();
        executions.get(execution_id).map(|p| p.execution.clone())
    }

    pub fn list_executions(&self) -> Vec<CliExecution> {
        let executions = self.executions.lock().unwrap();
        executions.values().map(|p| p.execution.clone()).collect()
    }

    fn emit_execution_status(&self, execution: &CliExecution) {
        let _ = self.app_handle.emit("cli-execution-status", execution);
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