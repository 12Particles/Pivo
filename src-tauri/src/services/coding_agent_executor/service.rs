use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use log::info;
use chrono::Utc;
use super::types::*;
use super::agent::{CodingAgent, SessionInfo};
use super::claude_agent::ClaudeCodeAgent;
use super::gemini_agent::GeminiCliAgent;

pub struct CodingAgentExecutorService {
    // Key: execution_id -> AgentProcess
    executions: Arc<Mutex<HashMap<String, AgentProcess>>>,
    app_handle: AppHandle,
    // Agent implementations
    agents: HashMap<CodingAgentType, Box<dyn CodingAgent>>,
}

struct AgentProcess {
    execution: CodingAgentExecution,
    session_info: SessionInfo,
    messages: Vec<Message>,
}

impl CodingAgentExecutorService {
    pub fn new(app_handle: AppHandle) -> Self {
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
        }
    }
    
    async fn start_execution_internal(
        &self,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
        agent_type: CodingAgentType,
        project_path: Option<&str>,
        stored_session_id: Option<&str>,
    ) -> Result<CodingAgentExecution, String> {
        info!("Starting {:?} execution for attempt: {} (task: {})", agent_type, attempt_id, task_id);
        
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
        
        let session_info = SessionInfo {
            task_id: task_id.to_string(),
            attempt_id: attempt_id.to_string(),
            working_directory: working_directory.to_string(),
            session_id: stored_session_id.map(|s| s.to_string()),
        };
        
        info!("Creating execution with task_id: {}, attempt_id: {}", task_id, attempt_id);
        
        // Atomically check and insert placeholder
        {
            let mut executions = self.executions.lock().unwrap();
            
            // Check if this attempt already has an active execution
            for (_exec_id, process) in executions.iter() {
                if process.session_info.attempt_id == attempt_id 
                    && matches!(process.execution.status, CodingAgentExecutionStatus::Running | CodingAgentExecutionStatus::Starting) {
                    return Err("This attempt already has an active execution".to_string());
                }
            }
            
            // Insert placeholder to reserve the slot
            executions.insert(execution_id.clone(), AgentProcess {
                execution: placeholder_execution,
                session_info: session_info.clone(),
                messages: Vec::new(),
            });
        } // Lock is dropped here
        
        // Get the appropriate agent
        let agent = self.agents.get(&agent_type)
            .ok_or_else(|| format!("Agent type {:?} not supported", agent_type))?;
        
        // Start the actual session
        let actual_execution = match agent.start_session(
            task_id,
            attempt_id,
            working_directory,
            project_path,
            stored_session_id,
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
    
    // Async wrapper methods for backward compatibility
    pub async fn start_claude_execution(
        &self,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
        project_path: Option<&str>,
        stored_claude_session_id: Option<&str>,
    ) -> Result<CodingAgentExecution, String> {
        self.start_execution_internal(
            task_id,
            attempt_id,
            working_directory,
            CodingAgentType::ClaudeCode,
            project_path,
            stored_claude_session_id,
        ).await
    }
    
    pub async fn start_gemini_execution(
        &self,
        task_id: &str,
        working_directory: &str,
        _context_files: Vec<String>,
    ) -> Result<CodingAgentExecution, String> {
        // TODO: Get attempt_id for Gemini
        let attempt_id = "temp_gemini_attempt";
        
        self.start_execution_internal(
            task_id,
            attempt_id,
            working_directory,
            CodingAgentType::GeminiCli,
            None,
            None,
        ).await
    }
    
    pub async fn send_input(&self, execution_id: &str, input: &str) -> Result<(), String> {
        info!("Sending input to session {}: {}", execution_id, input);
        
        // Get session info
        let (session_info, agent_type) = {
            let executions = self.executions.lock().unwrap();
            let process = executions.get(execution_id)
                .ok_or_else(|| "Session not found".to_string())?;
            
            (process.session_info.clone(), process.execution.executor_type.clone())
        }; // Lock is dropped here
        
        // Get the appropriate agent
        let agent = self.agents.get(&agent_type)
            .ok_or_else(|| format!("Agent type {:?} not found", agent_type))?;
        
        // Send input through the agent
        agent.send_input(execution_id, &session_info, input).await
    }
    
    pub async fn stop_execution(&self, execution_id: &str) -> Result<(), String> {
        info!("Stopping execution: {}", execution_id);
        
        let (agent_type, session_info, attempt_id, task_id) = {
            let mut executions = self.executions.lock().unwrap();
            if let Some(mut process) = executions.remove(execution_id) {
                let agent_type = process.execution.executor_type.clone();
                let session_info = process.session_info.clone();
                let attempt_id = process.session_info.attempt_id.clone();
                let task_id = process.session_info.task_id.clone();
                process.execution.status = CodingAgentExecutionStatus::Stopped;
                Some((agent_type, session_info, attempt_id, task_id))
            } else {
                None
            }
        }.ok_or_else(|| "Execution not found".to_string())?;
        
        // Get the appropriate agent
        if let Some(agent) = self.agents.get(&agent_type) {
            agent.stop_session(execution_id, &session_info).await?;
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
            if process.session_info.attempt_id == attempt_id {
                return Some(AttemptExecutionState {
                    task_id: process.session_info.task_id.clone(),
                    attempt_id: process.session_info.attempt_id.clone(),
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
            if process.session_info.task_id == task_id {
                active_attempt_id = Some(process.session_info.attempt_id.clone());
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
    
    pub fn add_message(&self, attempt_id: &str, role: MessageRole, content: String, images: Vec<String>, metadata: Option<serde_json::Value>) -> Result<(), String> {
        let mut executions = self.executions.lock().unwrap();
        
        for (_exec_id, process) in executions.iter_mut() {
            if process.session_info.attempt_id == attempt_id {
                let message = Message {
                    id: Uuid::new_v4().to_string(),
                    role,
                    content,
                    images,
                    timestamp: Utc::now(),
                    metadata,
                };
                
                process.messages.push(message);
                
                let attempt_id = process.session_info.attempt_id.clone();
                drop(executions);
                self.emit_attempt_execution_state(&attempt_id);
                return Ok(());
            }
        }
        
        Err("Attempt execution not found".to_string())
    }
    
    pub fn is_attempt_active(&self, attempt_id: &str) -> bool {
        let executions = self.executions.lock().unwrap();
        
        for (_exec_id, process) in executions.iter() {
            if process.session_info.attempt_id == attempt_id {
                return matches!(process.execution.status, CodingAgentExecutionStatus::Running | CodingAgentExecutionStatus::Starting);
            }
        }
        
        false
    }
    
    pub fn get_running_tasks(&self) -> Vec<String> {
        let executions = self.executions.lock().unwrap();
        
        executions.values()
            .filter(|p| matches!(p.execution.status, CodingAgentExecutionStatus::Starting | CodingAgentExecutionStatus::Running))
            .map(|p| p.session_info.task_id.clone())
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