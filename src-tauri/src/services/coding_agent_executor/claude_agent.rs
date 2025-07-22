use async_trait::async_trait;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::thread;
use tauri::{AppHandle, Emitter};
use log::{info, debug};
use chrono::Utc;
use uuid::Uuid;
use super::agent::{CodingAgent, SessionInfo};
use super::types::*;
use super::message::{UnifiedMessage};
use super::stateful_claude_converter::StatefulClaudeMessageConverter;

pub struct ClaudeCodeAgent {
    app_handle: AppHandle,
}

impl ClaudeCodeAgent {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { 
            app_handle,
        }
    }
    
    fn build_command(&self, working_directory: &str, session_id: Option<&str>) -> Vec<String> {
        let mut cmd_parts = vec![
            "cd".to_string(),
            format!("\"{}\"", working_directory),
            "&&".to_string(),
            "NODE_NO_WARNINGS=\"1\"".to_string(),
            "npx".to_string(),
            "-y".to_string(),
            "@anthropic-ai/claude-code@latest".to_string(),
            "-p".to_string(),
            "--dangerously-skip-permissions".to_string(),
            "--verbose".to_string(),
            "--output-format=stream-json".to_string(),
        ];
        
        if let Some(id) = session_id {
            cmd_parts.push("--resume".to_string());
            cmd_parts.push(id.to_string());
        }
        
        cmd_parts
    }
    
    fn spawn_process(&self, cmd: &str, input: &str, execution_id: &str, task_id: &str) -> Result<(), String> {
        debug!("Spawning Claude Code with command: {}", cmd);
        
        let mut command = Command::new("sh");
        command.arg("-c").arg(cmd);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());
        
        let mut child = command.spawn()
            .map_err(|e| format!("Failed to start Claude Code: {}", e))?;
        
        // Send input to stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;
            drop(stdin);
        }
        
        // Handle stdout
        if let Some(stdout) = child.stdout.take() {
            let execution_id = execution_id.to_string();
            let task_id = task_id.to_string();
            let app_handle = self.app_handle.clone();
            
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                let converter = StatefulClaudeMessageConverter::new();
                
                for line in reader.lines() {
                    if let Ok(content) = line {
                        debug!("Claude stdout: {}", content);
                        
                        // Try to convert to unified message format
                        if let Some(unified_msg) = converter.convert_to_unified(&content) {
                            // Emit unified message
                            let _ = app_handle.emit("coding-agent-message", serde_json::json!({
                                "execution_id": execution_id.clone(),
                                "task_id": task_id.clone(),
                                "message": unified_msg,
                            }));
                        }
                        
                        // Also check for session ID in system messages
                        if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&content) {
                            if json_value["type"] == "system" && json_value["subtype"] == "init" {
                                if let Some(session_id) = json_value["session_id"].as_str() {
                                    info!("Stored Claude session ID: {}", session_id);
                                    let _ = app_handle.emit("claude-session-id-received", serde_json::json!({
                                        "task_id": task_id,
                                        "claude_session_id": session_id
                                    }));
                                }
                            }
                        }
                        
                        // Still emit raw output for debugging
                        let output = CodingAgentOutput {
                            execution_id: execution_id.clone(),
                            task_id: task_id.clone(),
                            output_type: CodingAgentOutputType::Stdout,
                            content,
                            timestamp: Utc::now(),
                        };
                        let _ = app_handle.emit("coding-agent-output", &output);
                    }
                }
                
                // Notify that the process has completed
                let _ = app_handle.emit("coding-agent-process-completed", serde_json::json!({
                    "execution_id": execution_id,
                    "task_id": task_id
                }));
                
                debug!("Stdout reader thread ended for session: {}", execution_id);
            });
        }
        
        // Handle stderr
        if let Some(stderr) = child.stderr.take() {
            let execution_id = execution_id.to_string();
            let task_id = task_id.to_string();
            let app_handle = self.app_handle.clone();
            
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(content) = line {
                        let output = CodingAgentOutput {
                            execution_id: execution_id.clone(),
                            task_id: task_id.clone(),
                            output_type: CodingAgentOutputType::Stderr,
                            content,
                            timestamp: Utc::now(),
                        };
                        let _ = app_handle.emit("coding-agent-output", &output);
                    }
                }
                debug!("Stderr reader thread ended for session: {}", execution_id);
            });
        }
        
        Ok(())
    }
}

#[async_trait]
impl CodingAgent for ClaudeCodeAgent {
    fn agent_type(&self) -> CodingAgentType {
        CodingAgentType::ClaudeCode
    }
    
    async fn start_session(
        &self,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
        _project_path: Option<&str>,
        _stored_session_id: Option<&str>,
    ) -> Result<CodingAgentExecution, String> {
        info!("Starting Claude Code execution for attempt: {} (task: {})", attempt_id, task_id);
        
        let execution_id = Uuid::new_v4().to_string();
        let execution = CodingAgentExecution {
            id: execution_id.clone(),
            task_id: task_id.to_string(),
            executor_type: CodingAgentType::ClaudeCode,
            working_directory: working_directory.to_string(),
            status: CodingAgentExecutionStatus::Running,
            created_at: Utc::now(),
        };
        
        Ok(execution)
    }
    
    async fn send_input(
        &self,
        execution_id: &str,
        session_info: &SessionInfo,
        input: &str,
    ) -> Result<(), String> {
        info!("Sending input to Claude session {}: {}", execution_id, input);
        
        let cmd_parts = self.build_command(&session_info.working_directory, session_info.session_id.as_deref());
        let cmd = cmd_parts.join(" ");
        
        self.spawn_process(&cmd, input, execution_id, &session_info.task_id)
    }
    
    async fn stop_session(
        &self,
        _execution_id: &str,
        session_info: &SessionInfo,
    ) -> Result<(), String> {
        // Kill all npx processes for this session
        let _ = std::process::Command::new("pkill")
            .args(&["-f", &format!("npx.*claude-code.*{}", session_info.session_id.as_deref().unwrap_or(""))])
            .output();
        
        Ok(())
    }
    
    fn supports_resume(&self) -> bool {
        true
    }
}