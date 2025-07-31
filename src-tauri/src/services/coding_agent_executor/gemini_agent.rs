use async_trait::async_trait;
use std::process::{Command, Stdio, Child, ChildStdin};
use std::io::{BufRead, BufReader, Write};
use std::thread;
use std::sync::{Arc, Mutex};
use std::sync::mpsc::Sender;
use tauri::AppHandle;
use log::{info, debug};
use chrono::Utc;
use uuid::Uuid;
use super::agent::{CodingAgent, ExecutionContext, ChannelMessage};
use super::types::*;
use super::message::MessageConverter;
use super::gemini_converter::GeminiMessageConverter;

pub struct GeminiCliAgent {
    app_handle: AppHandle,
    // Store active processes for Gemini
    active_processes: Arc<Mutex<std::collections::HashMap<String, GeminiProcess>>>,
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
        }
    }
    
    fn spawn_process(
        &self,
        execution_id: &str,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
        context_files: Vec<String>,
        message_sender: Sender<ChannelMessage>,
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
            let _app_handle = self.app_handle.clone();
            let execution_id_clone = execution_id.to_string();
            let task_id_clone = task_id.to_string();
            let attempt_id_clone = attempt_id.to_string();
            
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                let converter = GeminiMessageConverter;
                
                for line in reader.lines() {
                    if let Ok(content) = line {
                        debug!("Gemini stdout: {}", content);
                        
                        // Try to convert to unified message format
                        if let Some(agent_output) = converter.convert_to_unified(&content) {
                            // Convert AgentOutput to ConversationMessage
                            if let Some(conversation_msg) = crate::services::coding_agent_executor::service::convert_to_conversation_message(&agent_output) {
                                // Send message through channel to service
                                let _ = message_sender.send(ChannelMessage {
                                    attempt_id: attempt_id_clone.clone(),
                                    task_id: task_id_clone.clone(),
                                    message: conversation_msg,
                                });
                            }
                        }
                        
                        // Debug output removed - no longer needed with new event architecture
                    }
                }
                
                // Send execution complete message
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
                    attempt_id: attempt_id_clone.clone(),
                    task_id: task_id_clone.clone(),
                    message: complete_msg,
                });
                
                // Process completion is now handled through message channel
                
                debug!("Stdout reader thread ended for execution: {}", execution_id_clone);
            });
        }
        
        // Handle stderr
        if let Some(stderr) = child.stderr.take() {
            let _app_handle = self.app_handle.clone();
            let execution_id_clone = execution_id.to_string();
            let _task_id_clone = task_id.to_string();
            
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(_content) = line {
                        // Debug stderr output removed - no longer needed with new event architecture
                    }
                }
                debug!("Stderr reader thread ended for execution: {}", execution_id_clone);
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
    
    async fn execute_prompt(
        &self,
        prompt: &str,
        execution_context: ExecutionContext,
        message_sender: Sender<ChannelMessage>,
    ) -> Result<CodingAgentExecution, String> {
        info!("Executing Gemini CLI prompt for task: {}", execution_context.task_id);
        
        let execution_id = Uuid::new_v4().to_string();
        let execution = CodingAgentExecution {
            id: execution_id.clone(),
            task_id: execution_context.task_id.clone(),
            executor_type: CodingAgentType::GeminiCli,
            working_directory: execution_context.working_directory.clone(),
            status: CodingAgentExecutionStatus::Running,
            created_at: Utc::now(),
        };
        
        // User message will be created by the service layer
        
        // Start the Gemini process with the prompt
        self.spawn_process(&execution_id, &execution_context.task_id, &execution_context.attempt_id, 
                          &execution_context.working_directory, vec![], message_sender)?;
        
        // Send the prompt to the process stdin
        let mut processes = self.active_processes.lock().unwrap();
        if let Some(process) = processes.get_mut(&execution_id) {
            if let Some(stdin) = &mut process.stdin {
                stdin.write_all(prompt.as_bytes())
                    .map_err(|e| format!("Failed to write prompt: {}", e))?;
                stdin.write_all(b"\n")
                    .map_err(|e| format!("Failed to write newline: {}", e))?;
                stdin.flush()
                    .map_err(|e| format!("Failed to flush stdin: {}", e))?;
            }
        }
        
        Ok(execution)
    }
    
    async fn stop_execution(
        &self,
        execution_id: &str,
        _execution_context: &ExecutionContext,
    ) -> Result<(), String> {
        let mut processes = self.active_processes.lock().unwrap();
        if let Some(mut process) = processes.remove(execution_id) {
            let _ = process.child.kill();
            let _ = process.child.wait();
        }
        Ok(())
    }
}