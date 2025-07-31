use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State, Emitter};
use uuid::Uuid;

use crate::{
    commands::cli::CliState,
    AppState,
    models::TaskStatus,
};

// Simplified command system based on RFC
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TaskCommand {
    /// Send message (requires existing Attempt)
    #[serde(rename = "SEND_MESSAGE")]
    SendMessage { 
        #[serde(rename = "taskId")]
        task_id: String, 
        message: String,
        images: Option<Vec<String>>,
    },
    
    /// Stop current execution
    #[serde(rename = "STOP_EXECUTION")]
    StopExecution { 
        #[serde(rename = "taskId")]
        task_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationState {
    messages: Vec<ServiceConversationMessage>,
    #[serde(rename = "isExecuting")]
    is_executing: bool,
    #[serde(rename = "currentAttemptId")]
    current_attempt_id: Option<String>,
    #[serde(rename = "canSendMessage")]
    can_send_message: bool,
    #[serde(rename = "currentExecution")]
    current_execution: Option<crate::services::coding_agent_executor::types::CodingAgentExecution>,
    #[serde(rename = "worktreePath")]
    worktree_path: Option<String>,
}

// Use ConversationMessage from the service module
use crate::services::coding_agent_executor::types::ConversationMessage as ServiceConversationMessage;

/// Execute a task command
#[tauri::command]
pub async fn execute_task_command(
    app: AppHandle,
    state: State<'_, AppState>,
    cli_state: State<'_, CliState>,
    command: TaskCommand,
) -> Result<(), String> {
    log::info!("Executing task command: {:?}", command);
    
    match command {
        TaskCommand::SendMessage { task_id, message, images } => {
            handle_send_message(&app, &state, &cli_state, &task_id, message, images).await
        }
        TaskCommand::StopExecution { task_id } => {
            handle_stop_execution(&app, &state, &cli_state, &task_id).await
        }
    }
}

/// Get current conversation state
#[tauri::command]
pub async fn get_conversation_state(
    state: State<'_, AppState>,
    cli_state: State<'_, CliState>,
    task_id: String,
) -> Result<ConversationState, String> {
    let task_service = &state.task_service;
    let task_uuid = Uuid::parse_str(&task_id).map_err(|e| e.to_string())?;
    
    // Get task
    let _task = task_service.get_task(task_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Task not found")?;
    
    // Get attempts
    let attempts = task_service.list_task_attempts(task_uuid)
        .await
        .map_err(|e| e.to_string())?;
    
    // Get latest attempt
    let current_attempt = attempts.last();
    
    // Check if task is executing and get current execution
    let executions = cli_state.service.list_executions();
    let current_execution = executions.iter().find(|e| e.task_id == task_id).cloned();
    
    let is_executing = current_execution.as_ref().map(|e| 
        matches!(e.status, 
            crate::services::coding_agent_executor::types::CodingAgentExecutionStatus::Running | 
            crate::services::coding_agent_executor::types::CodingAgentExecutionStatus::Starting
        )
    ).unwrap_or(false);
    
    // Get messages from current attempt
    let messages = if let Some(attempt) = current_attempt {
        get_attempt_messages(&state, &attempt.id).await.unwrap_or_default()
    } else {
        vec![]
    };
    
    Ok(ConversationState {
        messages,
        is_executing,
        current_attempt_id: current_attempt.map(|a| a.id.clone()),
        can_send_message: !is_executing && current_attempt.is_some(),
        current_execution,
        worktree_path: current_attempt.map(|a| a.worktree_path.clone()),
    })
}

// Core logic based on RFC
async fn handle_send_message(
    app: &AppHandle,
    state: &State<'_, AppState>,
    cli_state: &State<'_, CliState>,
    task_id: &str,
    message: String,
    images: Option<Vec<String>>,
) -> Result<(), String> {
    let task_service = &state.task_service;
    let task_uuid = Uuid::parse_str(task_id).map_err(|e| e.to_string())?;
    
    // 1. Get the latest Attempt, error if none exists
    let attempts = task_service.list_task_attempts(task_uuid)
        .await
        .map_err(|e| e.to_string())?;
    
    let attempt = attempts.last()
        .ok_or("No attempt found for this task. Please create an attempt first.")?
        .clone();
    
    // 2. Get resume session ID if available
    let resume_session_id = match attempt.executor.as_deref() {
        Some("claude") | Some("claude_code") | Some("ClaudeCode") => {
            log::info!("Attempt {} has Claude session ID: {:?}", attempt.id, attempt.claude_session_id);
            attempt.claude_session_id.clone()
        },
        _ => None,
    };
    
    // 3. Check if there's already an active execution and stop it first
    let executions = cli_state.service.list_executions();
    if let Some(exec) = executions.iter().find(|e| 
        e.task_id == task_id && 
        matches!(e.status, 
            crate::services::coding_agent_executor::types::CodingAgentExecutionStatus::Running | 
            crate::services::coding_agent_executor::types::CodingAgentExecutionStatus::Starting
        )
    ) {
        log::info!("Stopping existing execution {} before starting new one", exec.id);
        cli_state.service.stop_execution(&exec.id).await?;
    }
    
    // 4. Get task and project info
    let task = task_service.get_task(task_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Task not found")?;
    
    let project_uuid = Uuid::parse_str(&task.project_id).map_err(|e| e.to_string())?;
    let project = state.project_service
        .get_project(project_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Project not found")?;
    
    // 5. Update task status to Working if not already
    if task.status != TaskStatus::Working {
        let updated_task = task_service.update_task_status(task_uuid, TaskStatus::Working)
            .await
            .map_err(|e| e.to_string())?;
        
        // Emit task:status-changed event
        let _ = app.emit("task:status-changed", &serde_json::json!({
            "taskId": task_id,
            "previousStatus": task.status,
            "newStatus": TaskStatus::Working,
            "task": updated_task,
        }));
    }
    
    // 6. Determine agent type from executor field
    let agent_type = match attempt.executor.as_deref() {
        Some("claude") | Some("claude_code") | Some("ClaudeCode") => 
            crate::services::coding_agent_executor::CodingAgentType::ClaudeCode,
        Some("gemini") | Some("gemini_cli") | Some("GeminiCli") => 
            crate::services::coding_agent_executor::CodingAgentType::GeminiCli,
        _ => crate::services::coding_agent_executor::CodingAgentType::ClaudeCode, // Default to Claude
    };
    
    // 7. Combine message with images if provided
    let prompt = if let Some(imgs) = &images {
        if !imgs.is_empty() {
            format!("{}\n\n[Images: {} attached]", message, imgs.len())
        } else {
            message
        }
    } else {
        message
    };
    
    // 8. Execute with resume session
    let execution = crate::commands::cli::execute_prompt(
        cli_state.clone(),
        prompt,
        task_id.to_string(),
        attempt.id.clone(),
        if attempt.worktree_path.is_empty() { project.path.clone() } else { attempt.worktree_path.clone() },
        agent_type,
        resume_session_id, // Use saved session ID
    ).await?;
    
    // 9. Emit execution:started event
    let _ = app.emit("execution:started", &serde_json::json!({
        "taskId": task_id,
        "attemptId": attempt.id,
        "executionId": execution.id,
    }));
    
    // 10. Don't emit state update immediately - let the frontend handle the state change
    // The execution:started event is enough to update the UI state
    
    Ok(())
}

async fn handle_stop_execution(
    app: &AppHandle,
    state: &State<'_, AppState>,
    cli_state: &State<'_, CliState>,
    task_id: &str,
) -> Result<(), String> {
    let task_service = &state.task_service;
    let task_uuid = Uuid::parse_str(task_id).map_err(|e| e.to_string())?;
    
    // Get current execution and attempt ID from the latest attempt
    let attempts = task_service.list_task_attempts(task_uuid)
        .await
        .map_err(|e| e.to_string())?;
    
    let attempt_id = attempts.last()
        .map(|a| a.id.clone())
        .unwrap_or_default();
    
    let executions = cli_state.service.list_executions();
    if let Some(execution) = executions.iter().find(|e| e.task_id == task_id) {
        let exec_id = execution.id.clone();
        
        cli_state.service.stop_execution(&exec_id).await?;
        
        // Emit execution:completed event
        let _ = app.emit("execution:completed", &serde_json::json!({
            "taskId": task_id,
            "attemptId": attempt_id,
            "executionId": exec_id,
            "status": "cancelled",
        }));
    }
    
    // Update task status back to Backlog when stopping
    let task = task_service.get_task(task_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Task not found")?;
    
    if task.status != TaskStatus::Backlog {
        let updated_task = task_service.update_task_status(task_uuid, TaskStatus::Backlog)
            .await
            .map_err(|e| e.to_string())?;
        
        // Emit task:status-changed event
        let _ = app.emit("task:status-changed", &serde_json::json!({
            "taskId": task_id,
            "previousStatus": task.status,
            "newStatus": TaskStatus::Backlog,
            "task": updated_task,
        }));
    }
    
    // Don't emit state update immediately - let the frontend handle the state change
    
    Ok(())
}

// Removed emit_state_update function - no longer needed
// State updates are now handled through granular events:
// - execution:started
// - execution:completed
// - message:added
// - task:status-changed

async fn get_attempt_messages(
    state: &State<'_, AppState>,
    attempt_id: &str,
) -> Result<Vec<ServiceConversationMessage>, String> {
    let attempt_uuid = Uuid::parse_str(attempt_id).map_err(|e| e.to_string())?;
    
    // Get messages from attempt conversation
    if let Ok(Some(conversation)) = state.task_service.get_attempt_conversation(attempt_uuid).await {
        let messages = conversation.messages.into_iter().map(|msg| {
            
            // Parse the new message format where content contains type, content, and metadata
            let (message_type, content, metadata) = if let Ok(json_content) = serde_json::from_str::<serde_json::Value>(&msg.content) {
                // New format: content is JSON with type, content, and metadata fields
                let msg_type = json_content.get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&msg.role)
                    .to_string();
                let content = json_content.get("content")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&msg.content)
                    .to_string();
                let metadata = json_content.get("metadata")
                    .cloned();
                (msg_type, content, metadata)
            } else {
                // Old format: plain text content
                (msg.role.clone(), msg.content, None)
            };
            
            
            // Map role string to MessageRole enum
            let role = match msg.role.as_str() {
                "user" => crate::services::coding_agent_executor::types::MessageRole::User,
                "assistant" => crate::services::coding_agent_executor::types::MessageRole::Assistant,
                "system" => crate::services::coding_agent_executor::types::MessageRole::System,
                _ => crate::services::coding_agent_executor::types::MessageRole::Assistant,
            };
            
            ServiceConversationMessage::new(
                role,
                message_type,
                content,
                metadata,
            )
        }).collect();
        
        Ok(messages)
    } else {
        Ok(vec![])
    }
}