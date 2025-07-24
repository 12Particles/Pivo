use async_trait::async_trait;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::thread;
use std::sync::mpsc::Sender;
use tauri::{AppHandle, Emitter};
use log::{info, debug};
use chrono::Utc;
use uuid::Uuid;
use super::agent::{CodingAgent, ExecutionContext, ChannelMessage};
use super::types::*;
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
    
    fn spawn_process(&self, cmd: &str, input: &str, execution_id: &str, task_id: &str, attempt_id: &str, message_sender: Sender<ChannelMessage>) -> Result<(), String> {
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
            let attempt_id = attempt_id.to_string();
            let app_handle = self.app_handle.clone();
            
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                let converter = StatefulClaudeMessageConverter::new();
                
                for line in reader.lines() {
                    if let Ok(content) = line {
                        debug!("Claude stdout: {}", content);
                        
                        // Try to convert to unified message format
                        if let Some(agent_output) = converter.convert_to_unified(&content) {
                            // Convert AgentOutput to ConversationMessage
                            if let Some(conversation_msg) = crate::services::coding_agent_executor::service::convert_to_conversation_message(&agent_output) {
                                // Send message through channel to service
                                let _ = message_sender.send(ChannelMessage {
                                    attempt_id: attempt_id.clone(),
                                    task_id: task_id.clone(),
                                    message: conversation_msg,
                                });
                            }
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
                
                // Send execution complete message when process ends
                let complete_msg = ConversationMessage {
                    id: format!("{}-complete-{}", Utc::now().to_rfc3339(), {
                        use rand::Rng;
                        let mut rng = rand::thread_rng();
                        let random_suffix: String = (0..8)
                            .map(|_| {
                                let charset = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                                let idx = rng.gen_range(0..charset.len());
                                charset[idx] as char
                            })
                            .collect();
                        random_suffix
                    }),
                    role: MessageRole::System,
                    message_type: "execution_complete".to_string(),
                    content: "Execution completed".to_string(),
                    timestamp: Utc::now(),
                    metadata: Some(serde_json::json!({
                        "success": true,
                        "summary": "Execution completed",
                    })),
                };
                
                let _ = message_sender.send(ChannelMessage {
                    attempt_id: attempt_id.clone(),
                    task_id: task_id.clone(),
                    message: complete_msg,
                });
                
                debug!("Stdout reader thread ended for execution: {}", execution_id);
            });
        }
        
        // Handle stderr
        if let Some(stderr) = child.stderr.take() {
            let execution_id = execution_id.to_string();
            let task_id = task_id.to_string();
            let _attempt_id = attempt_id.to_string();
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
                debug!("Stderr reader thread ended for execution: {}", execution_id);
            });
        }
        
        Ok(())
    }
}

#[async_trait]
impl CodingAgent for ClaudeCodeAgent {
    
    async fn execute_prompt(
        &self,
        prompt: &str,
        execution_context: ExecutionContext,
        message_sender: Sender<ChannelMessage>,
    ) -> Result<CodingAgentExecution, String> {
        info!("Executing Claude Code prompt for attempt: {} (task: {})", 
            execution_context.attempt_id, execution_context.task_id);
        
        let execution_id = Uuid::new_v4().to_string();
        let execution = CodingAgentExecution {
            id: execution_id.clone(),
            task_id: execution_context.task_id.clone(),
            executor_type: CodingAgentType::ClaudeCode,
            working_directory: execution_context.working_directory.clone(),
            status: CodingAgentExecutionStatus::Running,
            created_at: Utc::now(),
        };
        
        // User message will be created by the service layer
        
        // Build command and spawn process
        let cmd_parts = self.build_command(&execution_context.working_directory, execution_context.resume_session_id.as_deref());
        let cmd = cmd_parts.join(" ");
        
        self.spawn_process(&cmd, prompt, &execution_id, &execution_context.task_id, &execution_context.attempt_id, message_sender)?;
        
        Ok(execution)
    }
    
    async fn stop_execution(
        &self,
        _execution_id: &str,
        execution_context: &ExecutionContext,
    ) -> Result<(), String> {
        // Kill all npx processes for this execution
        let _ = std::process::Command::new("pkill")
            .args(&["-f", &format!("npx.*claude-code.*{}", execution_context.resume_session_id.as_deref().unwrap_or(""))])
            .output();
        
        Ok(())
    }
}