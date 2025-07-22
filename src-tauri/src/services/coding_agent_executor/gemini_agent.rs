use async_trait::async_trait;
use std::process::{Command, Stdio, Child, ChildStdin};
use std::io::{BufRead, BufReader, Write};
use std::thread;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use log::{info, debug};
use chrono::Utc;
use uuid::Uuid;
use super::agent::{CodingAgent, SessionInfo};
use super::types::*;
use super::message::{UnifiedMessage, MessageConverter};
use super::gemini_converter::GeminiMessageConverter;

pub struct GeminiCliAgent {
    app_handle: AppHandle,
    // Store active processes for Gemini
    active_processes: Arc<Mutex<std::collections::HashMap<String, GeminiProcess>>>,
    message_converter: GeminiMessageConverter,
}

struct GeminiProcess {
    child: Child,
    stdin: Option<ChildStdin>,
}

impl GeminiCliAgent {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { 
            app_handle,
            active_processes: Arc::new(Mutex::new(std::collections::HashMap::new())),
            message_converter: GeminiMessageConverter,
        }
    }
    
    fn spawn_process(
        &self,
        execution_id: &str,
        task_id: &str,
        working_directory: &str,
        context_files: Vec<String>,
    ) -> Result<(), String> {
        let mut command = Command::new("google-gemini");
        command.current_dir(working_directory);
        command.args(&["chat", "--message", "Task started. Provide guidance."]);
        command.args(&["--working-dir", working_directory]);
        
        for file in &context_files {
            command.args(&["--context-file", file]);
        }
        
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());
        
        let mut child = command.spawn()
            .map_err(|e| format!("Failed to start Gemini CLI: {}", e))?;
        
        let stdin = child.stdin.take();
        
        // Handle stdout
        if let Some(stdout) = child.stdout.take() {
            let app_handle = self.app_handle.clone();
            let execution_id_clone = execution_id.to_string();
            let task_id_clone = task_id.to_string();
            
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                let converter = GeminiMessageConverter;
                
                for line in reader.lines() {
                    if let Ok(content) = line {
                        debug!("Gemini stdout: {}", content);
                        
                        // Try to convert to unified message format
                        if let Some(unified_msg) = converter.convert_to_unified(&content) {
                            // Emit unified message
                            let _ = app_handle.emit("coding-agent-message", serde_json::json!({
                                "execution_id": execution_id_clone.clone(),
                                "task_id": task_id_clone.clone(),
                                "message": unified_msg,
                            }));
                        }
                        
                        // Still emit raw output for debugging
                        let output = CodingAgentOutput {
                            execution_id: execution_id_clone.clone(),
                            task_id: task_id_clone.clone(),
                            output_type: CodingAgentOutputType::Stdout,
                            content,
                            timestamp: Utc::now(),
                        };
                        let _ = app_handle.emit("coding-agent-output", &output);
                    }
                }
                
                // Notify that the process has completed
                let _ = app_handle.emit("coding-agent-process-completed", serde_json::json!({
                    "execution_id": execution_id_clone,
                    "task_id": task_id_clone
                }));
                
                debug!("Stdout reader thread ended for session: {}", execution_id_clone);
            });
        }
        
        // Handle stderr
        if let Some(stderr) = child.stderr.take() {
            let app_handle = self.app_handle.clone();
            let execution_id_clone = execution_id.to_string();
            let task_id_clone = task_id.to_string();
            
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(content) = line {
                        let output = CodingAgentOutput {
                            execution_id: execution_id_clone.clone(),
                            task_id: task_id_clone.clone(),
                            output_type: CodingAgentOutputType::Stderr,
                            content,
                            timestamp: Utc::now(),
                        };
                        let _ = app_handle.emit("coding-agent-output", &output);
                    }
                }
                debug!("Stderr reader thread ended for session: {}", execution_id_clone);
            });
        }
        
        // Store the process
        let mut processes = self.active_processes.lock().unwrap();
        processes.insert(execution_id.to_string(), GeminiProcess { child, stdin });
        
        Ok(())
    }
}

#[async_trait]
impl CodingAgent for GeminiCliAgent {
    fn agent_type(&self) -> CodingAgentType {
        CodingAgentType::GeminiCli
    }
    
    async fn start_session(
        &self,
        task_id: &str,
        _attempt_id: &str,
        working_directory: &str,
        _project_path: Option<&str>,
        _stored_session_id: Option<&str>,
    ) -> Result<CodingAgentExecution, String> {
        info!("Starting Gemini CLI execution for task: {}", task_id);
        
        let execution_id = Uuid::new_v4().to_string();
        let execution = CodingAgentExecution {
            id: execution_id.clone(),
            task_id: task_id.to_string(),
            executor_type: CodingAgentType::GeminiCli,
            working_directory: working_directory.to_string(),
            status: CodingAgentExecutionStatus::Starting,
            created_at: Utc::now(),
        };
        
        // Start the Gemini process
        self.spawn_process(&execution_id, task_id, working_directory, vec![])?;
        
        Ok(execution)
    }
    
    async fn send_input(
        &self,
        execution_id: &str,
        session_info: &SessionInfo,
        input: &str,
    ) -> Result<(), String> {
        // First emit the user message as unified format
        let user_msg = UnifiedMessage::user(input.to_string(), vec![]);
        let _ = self.app_handle.emit("coding-agent-message", serde_json::json!({
            "execution_id": execution_id,
            "task_id": session_info.task_id,
            "message": user_msg,
        }));
        
        let mut processes = self.active_processes.lock().unwrap();
        if let Some(process) = processes.get_mut(execution_id) {
            if let Some(stdin) = &mut process.stdin {
                stdin.write_all(input.as_bytes())
                    .map_err(|e| format!("Failed to write to stdin: {}", e))?;
                stdin.write_all(b"\n")
                    .map_err(|e| format!("Failed to write newline: {}", e))?;
                stdin.flush()
                    .map_err(|e| format!("Failed to flush stdin: {}", e))?;
                Ok(())
            } else {
                Err("No stdin available for Gemini process".to_string())
            }
        } else {
            Err("Gemini process not found".to_string())
        }
    }
    
    async fn stop_session(
        &self,
        execution_id: &str,
        _session_info: &SessionInfo,
    ) -> Result<(), String> {
        let mut processes = self.active_processes.lock().unwrap();
        if let Some(mut process) = processes.remove(execution_id) {
            let _ = process.child.kill();
            let _ = process.child.wait();
        }
        Ok(())
    }
}