use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::mpsc::{channel, Receiver};
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use log::info;
use chrono::Utc;
use super::types::*;
use super::agent::{CodingAgent, ExecutionContext, ChannelMessage};
use super::claude_agent::ClaudeCodeAgent;
use super::gemini_agent::GeminiCliAgent;
use super::message::AgentOutput;
use super::metadata::{AssistantMetadata, ToolUseMetadata, ToolResultMetadata};
use crate::models::task::TaskStatus;

pub struct CodingAgentExecutorService {
    // Key: execution_id -> AgentProcess
    executions: Arc<Mutex<HashMap<String, AgentProcess>>>,
    app_handle: AppHandle,
    // Agent implementations
    agents: HashMap<CodingAgentType, Box<dyn CodingAgent>>,
    // Database repository for persisting messages
    db_repository: Arc<crate::repository::DatabaseRepository>,
}

struct AgentProcess {
    execution: CodingAgentExecution,
    execution_context: ExecutionContext,
    messages: Vec<Message>,
}

impl CodingAgentExecutorService {
    pub fn new(app_handle: AppHandle, db_repository: Arc<crate::repository::DatabaseRepository>) -> Self {
        let mut agents: HashMap<CodingAgentType, Box<dyn CodingAgent>> = HashMap::new();
        
        // Register agents
        agents.insert(
            CodingAgentType::ClaudeCode,
            Box::new(ClaudeCodeAgent::new(app_handle.clone()))
        );
        agents.insert(
            CodingAgentType::GeminiCli,
            Box::new(GeminiCliAgent::new(app_handle.clone()))
        );
        
        Self {
            executions: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
            agents,
            db_repository,
        }
    }
    
    /// Start message processor for handling agent messages
    fn start_message_processor(&self, receiver: Receiver<ChannelMessage>) {
        let executions = self.executions.clone();
        let db_repository = self.db_repository.clone();
        let app_handle = self.app_handle.clone();
        
        thread::spawn(move || {
            while let Ok(agent_msg) = receiver.recv() {
                let attempt_id = agent_msg.attempt_id;
                let task_id = agent_msg.task_id;
                let conversation_msg = agent_msg.message;
                
                // Check for execution complete messages
                if conversation_msg.message_type == "execution_complete" {
                    let mut executions = executions.lock().unwrap();
                    // Find and update the execution status
                    for (_exec_id, process) in executions.iter_mut() {
                        if process.execution_context.attempt_id == attempt_id {
                            process.execution.status = CodingAgentExecutionStatus::Completed;
                            info!("Execution completed for attempt: {}", attempt_id);
                            break;
                        }
                    }
                    drop(executions); // Release lock before emitting
                    
                    // Emit updated state
                    let _ = app_handle.emit("task-execution-summary", &TaskExecutionSummary {
                        task_id: task_id.clone(),
                        active_attempt_id: None,
                        is_running: false,
                        agent_type: None,
                    });
                    
                    // Emit a special event to trigger conversation state update
                    let _ = app_handle.emit("execution-completed", serde_json::json!({
                        "taskId": task_id,
                        "attemptId": attempt_id,
                    }));
                    
                    // Update task status to Reviewing
                    let task_uuid = Uuid::parse_str(&task_id).unwrap();
                    let db_repo_clone = db_repository.clone();
                    let app_handle_clone = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        use crate::services::task_service::TaskService;
                        let task_service = TaskService::new(db_repo_clone.pool().clone());
                        if let Ok(task) = task_service.update_task_status(task_uuid, TaskStatus::Reviewing).await {
                            // Emit task status update event
                            let _ = app_handle_clone.emit("task-status-updated", &task);
                        }
                    });
                    
                    continue; // Don't save execution_complete messages
                }
                
                // Add to in-memory messages
                if let Ok(mut execs) = executions.lock() {
                    for (_exec_id, process) in execs.iter_mut() {
                        if process.execution_context.attempt_id == attempt_id {
                            // Convert ConversationMessage to internal Message for storage
                            process.messages.push(Message {
                                id: conversation_msg.id.clone(),
                                role: conversation_msg.role.clone(),
                                content: conversation_msg.content.clone(),
                                images: vec![], // TODO: Extract from metadata if needed
                                timestamp: conversation_msg.timestamp,
                                metadata: conversation_msg.metadata.clone(),
                            });
                            break;
                        }
                    }
                }
                
                // Save to database - encode the full message data
                let db_message = crate::commands::task_attempts::ConversationMessage {
                    role: match conversation_msg.role {
                        MessageRole::User => "user",
                        MessageRole::Assistant => "assistant",
                        MessageRole::System => "system",
                    }.to_string(),
                    content: serde_json::json!({
                        "type": conversation_msg.message_type,
                        "content": conversation_msg.content,
                        "metadata": conversation_msg.metadata,
                    }).to_string(),
                    timestamp: conversation_msg.timestamp.to_rfc3339(),
                };
                
                let attempt_uuid = Uuid::parse_str(&attempt_id).unwrap();
                let db_repo = db_repository.clone();
                tauri::async_runtime::spawn(async move {
                    use crate::repository::ConversationRepository;
                    let conversation_repo = ConversationRepository::new(&db_repo);
                    let _ = conversation_repo.add_message(attempt_uuid, db_message).await;
                });
                
                // Emit event to frontend with ConversationMessage
                let _ = app_handle.emit("coding-agent-message", serde_json::json!({
                    "task_id": task_id,
                    "attempt_id": attempt_id,
                    "message": conversation_msg,
                }));
            }
        });
    }
    
    async fn execute_prompt_internal(
        &self,
        prompt: &str,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
        agent_type: CodingAgentType,
        resume_session_id: Option<String>,
    ) -> Result<CodingAgentExecution, String> {
        info!("Starting {:?} execution for attempt: {} (task: {})", agent_type, attempt_id, task_id);
        
        // Create a channel for agent messages
        let (sender, receiver) = channel::<ChannelMessage>();
        
        // Start the message processor
        self.start_message_processor(receiver);
        
        // Create a placeholder execution to reserve the slot
        let execution_id = Uuid::new_v4().to_string();
        let placeholder_execution = CodingAgentExecution {
            id: execution_id.clone(),
            task_id: task_id.to_string(),
            executor_type: agent_type.clone(),
            working_directory: working_directory.to_string(),
            status: CodingAgentExecutionStatus::Starting,
            created_at: Utc::now(),
        };
        
        let execution_context = ExecutionContext {
            task_id: task_id.to_string(),
            attempt_id: attempt_id.to_string(),
            working_directory: working_directory.to_string(),
            resume_session_id,
        };
        
        info!("Executing prompt for task_id: {}, attempt_id: {}", task_id, attempt_id);
        
        // Atomically check and insert placeholder
        {
            let mut executions = self.executions.lock().unwrap();
            
            // Check if this attempt already has an active execution
            for (_exec_id, process) in executions.iter() {
                if process.execution_context.attempt_id == attempt_id 
                    && matches!(process.execution.status, CodingAgentExecutionStatus::Running | CodingAgentExecutionStatus::Starting) {
                    return Err("This attempt already has an active execution".to_string());
                }
            }
            
            // Insert placeholder to reserve the slot
            executions.insert(execution_id.clone(), AgentProcess {
                execution: placeholder_execution,
                execution_context: execution_context.clone(),
                messages: Vec::new(),
            });
        } // Lock is dropped here
        
        // Create and send user message
        let user_message = ConversationMessage::new(
            MessageRole::User,
            "text".to_string(),
            prompt.to_string(),
            None,
        );
        
        // Send user message through the processor
        let _ = sender.send(ChannelMessage {
            attempt_id: attempt_id.to_string(),
            task_id: task_id.to_string(),
            message: user_message,
        });
        
        // Get the appropriate agent
        let agent = self.agents.get(&agent_type)
            .ok_or_else(|| format!("Agent type {:?} not supported", agent_type))?;
        
        // Execute the prompt
        let actual_execution = match agent.execute_prompt(
            prompt,
            execution_context.clone(),
            sender,
        ).await {
            Ok(exec) => exec,
            Err(e) => {
                // Remove placeholder on failure
                let mut executions = self.executions.lock().unwrap();
                executions.remove(&execution_id);
                return Err(e);
            }
        };
        
        // Update with actual execution
        let final_execution = {
            let mut executions = self.executions.lock().unwrap();
            if let Some(process) = executions.get_mut(&execution_id) {
                // Keep the original execution ID to maintain consistency
                let mut updated_execution = actual_execution;
                updated_execution.id = execution_id.clone();
                process.execution = updated_execution.clone();
                updated_execution
            } else {
                return Err("Failed to update execution after creation".to_string());
            }
        };
        
        // Emit events
        self.emit_attempt_execution_state(attempt_id);
        self.emit_task_execution_summary(task_id);
        
        Ok(final_execution)
    }
    
    // Execute a prompt with specified agent type
    pub async fn execute_prompt(
        &self,
        prompt: &str,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
        agent_type: CodingAgentType,
        resume_session_id: Option<String>,
    ) -> Result<CodingAgentExecution, String> {
        // Gemini doesn't support resume yet
        let resume_id = if matches!(agent_type, CodingAgentType::GeminiCli) {
            None
        } else {
            resume_session_id
        };
        
        self.execute_prompt_internal(
            prompt,
            task_id,
            attempt_id,
            working_directory,
            agent_type,
            resume_id,
        ).await
    }
    
    // Execute a prompt with Claude (deprecated - use execute_prompt instead)
    pub async fn execute_claude_prompt(
        &self,
        prompt: &str,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
        resume_session_id: Option<String>,
    ) -> Result<CodingAgentExecution, String> {
        self.execute_prompt(
            prompt,
            task_id,
            attempt_id,
            working_directory,
            CodingAgentType::ClaudeCode,
            resume_session_id,
        ).await
    }
    
    // Execute a prompt with Gemini (deprecated - use execute_prompt instead)
    pub async fn execute_gemini_prompt(
        &self,
        prompt: &str,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
    ) -> Result<CodingAgentExecution, String> {
        self.execute_prompt(
            prompt,
            task_id,
            attempt_id,
            working_directory,
            CodingAgentType::GeminiCli,
            None,
        ).await
    }
    
    pub async fn stop_execution(&self, execution_id: &str) -> Result<(), String> {
        info!("Stopping execution: {}", execution_id);
        
        let (agent_type, execution_context, attempt_id, task_id) = {
            let mut executions = self.executions.lock().unwrap();
            if let Some(mut process) = executions.remove(execution_id) {
                let agent_type = process.execution.executor_type.clone();
                let execution_context = process.execution_context.clone();
                let attempt_id = process.execution_context.attempt_id.clone();
                let task_id = process.execution_context.task_id.clone();
                process.execution.status = CodingAgentExecutionStatus::Completed;
                Some((agent_type, execution_context, attempt_id, task_id))
            } else {
                None
            }
        }.ok_or_else(|| "Execution not found".to_string())?;
        
        // Get the appropriate agent
        if let Some(agent) = self.agents.get(&agent_type) {
            agent.stop_execution(execution_id, &execution_context).await?;
        }
        
        // Emit the updated state
        self.emit_attempt_execution_state(&attempt_id);
        self.emit_task_execution_summary(&task_id);
        
        Ok(())
    }
    
    // Query methods
    pub fn get_execution(&self, execution_id: &str) -> Option<CodingAgentExecution> {
        let executions = self.executions.lock().unwrap();
        executions.get(execution_id).map(|p| p.execution.clone())
    }
    
    pub fn list_executions(&self) -> Vec<CodingAgentExecution> {
        let executions = self.executions.lock().unwrap();
        executions.values().map(|p| p.execution.clone()).collect()
    }
    
    pub fn get_attempt_execution_state(&self, attempt_id: &str) -> Option<AttemptExecutionState> {
        let executions = self.executions.lock().unwrap();
        
        for (_exec_id, process) in executions.iter() {
            if process.execution_context.attempt_id == attempt_id {
                return Some(AttemptExecutionState {
                    task_id: process.execution_context.task_id.clone(),
                    attempt_id: process.execution_context.attempt_id.clone(),
                    current_execution: Some(process.execution.clone()),
                    messages: process.messages.clone(),
                    agent_type: process.execution.executor_type.clone(),
                });
            }
        }
        
        None
    }
    
    pub fn get_task_execution_summary(&self, task_id: &str) -> TaskExecutionSummary {
        let executions = self.executions.lock().unwrap();
        
        let mut active_attempt_id = None;
        let mut is_running = false;
        let mut agent_type = None;
        
        for (_exec_id, process) in executions.iter() {
            if process.execution_context.task_id == task_id {
                active_attempt_id = Some(process.execution_context.attempt_id.clone());
                is_running = matches!(
                    process.execution.status, 
                    CodingAgentExecutionStatus::Running | CodingAgentExecutionStatus::Starting
                );
                if is_running {
                    agent_type = Some(process.execution.executor_type.clone());
                }
                break;
            }
        }
        
        TaskExecutionSummary {
            task_id: task_id.to_string(),
            active_attempt_id,
            is_running,
            agent_type,
        }
    }
    
    
    pub fn is_attempt_active(&self, attempt_id: &str) -> bool {
        let executions = self.executions.lock().unwrap();
        
        for (_exec_id, process) in executions.iter() {
            if process.execution_context.attempt_id == attempt_id {
                return matches!(process.execution.status, CodingAgentExecutionStatus::Running | CodingAgentExecutionStatus::Starting);
            }
        }
        
        false
    }
    
    pub fn get_running_tasks(&self) -> Vec<String> {
        let executions = self.executions.lock().unwrap();
        
        executions.values()
            .filter(|p| matches!(p.execution.status, CodingAgentExecutionStatus::Starting | CodingAgentExecutionStatus::Running))
            .map(|p| p.execution_context.task_id.clone())
            .collect()
    }
    
    // Event emitters
    fn emit_attempt_execution_state(&self, attempt_id: &str) {
        if let Some(state) = self.get_attempt_execution_state(attempt_id) {
            let _ = self.app_handle.emit("attempt-execution-update", &state);
        }
    }
    
    fn emit_task_execution_summary(&self, task_id: &str) {
        let summary = self.get_task_execution_summary(task_id);
        info!("Emitting task-execution-summary for task {}: {:?}", task_id, summary);
        let _ = self.app_handle.emit("task-execution-summary", &summary);
    }
    
    // Configuration
    pub fn configure_claude_api_key(&self, api_key: &str) -> Result<(), String> {
        std::env::set_var("ANTHROPIC_API_KEY", api_key);
        Ok(())
    }
    
    pub fn configure_gemini_api_key(&self, api_key: &str) -> Result<(), String> {
        std::env::set_var("GEMINI_API_KEY", api_key);
        Ok(())
    }
}

// Convert AgentOutput to ConversationMessage
pub fn convert_to_conversation_message(agent_output: &AgentOutput) -> Option<ConversationMessage> {
    
    let timestamp = match agent_output {
        AgentOutput::Assistant { timestamp, .. } |
        AgentOutput::Thinking { timestamp, .. } |
        AgentOutput::ToolUse { timestamp, .. } |
        AgentOutput::ToolResult { timestamp, .. } |
        AgentOutput::ExecutionComplete { timestamp, .. } |
        AgentOutput::Raw { timestamp, .. } => timestamp,
    };
    
    let (role, message_type, content, metadata) = match agent_output {
        AgentOutput::Assistant { content, thinking, id, .. } => {
            let metadata = AssistantMetadata::new(thinking.clone(), id.clone());
            (MessageRole::Assistant, "text", content.clone(), metadata)
        },
        AgentOutput::Thinking { content, .. } => {
            (MessageRole::Assistant, "thinking", content.clone(), None)
        },
        AgentOutput::ToolUse { tool_name, tool_input, id, .. } => {
            let metadata = Some(ToolUseMetadata::new(
                tool_name.clone(),
                id.clone(),
                tool_input.clone()
            ));
            (MessageRole::Assistant, "tool_use", format!("Using tool: {}", tool_name), metadata)
        },
        AgentOutput::ToolResult { tool_name, result, is_error, tool_use_id, .. } => {
            let metadata = Some(ToolResultMetadata::new(
                tool_name.clone(),
                tool_use_id.clone(),
                *is_error
            ));
            (MessageRole::Assistant, "tool_result", result.clone(), metadata)
        },
        AgentOutput::ExecutionComplete { .. } => {
            // Don't convert ExecutionComplete to a conversation message
            return None;
        },
        AgentOutput::Raw { .. } => {
            // Don't convert Raw messages
            return None;
        },
    };
    
    let mut msg = ConversationMessage {
        id: String::new(), // Will be set by generate_id
        role,
        message_type: message_type.to_string(),
        content,
        timestamp: *timestamp,
        metadata,
    };
    msg.id = msg.generate_id();
    Some(msg)
}