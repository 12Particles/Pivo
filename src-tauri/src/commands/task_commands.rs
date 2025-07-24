use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State, Emitter};
use uuid::Uuid;

use crate::{
    commands::cli::CliState,
    AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TaskCommand {
    #[serde(rename = "START_EXECUTION")]
    StartExecution { 
        #[serde(rename = "taskId")]
        task_id: String, 
        payload: Option<StartExecutionPayload> 
    },
    #[serde(rename = "SEND_MESSAGE")]
    SendMessage { 
        #[serde(rename = "taskId")]
        task_id: String, 
        payload: SendMessagePayload 
    },
    #[serde(rename = "STOP_EXECUTION")]
    StopExecution { 
        #[serde(rename = "taskId")]
        task_id: String 
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartExecutionPayload {
    #[serde(rename = "initialMessage")]
    initial_message: Option<String>,
    images: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessagePayload {
    message: String,
    images: Option<Vec<String>>,
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
        TaskCommand::StartExecution { task_id, payload } => {
            start_execution(&app, &state, &cli_state, &task_id, payload).await
        }
        TaskCommand::SendMessage { task_id, payload } => {
            send_message(&app, &state, &cli_state, &task_id, payload).await
        }
        TaskCommand::StopExecution { task_id } => {
            stop_execution(&app, &state, &cli_state, &task_id).await
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
        can_send_message: !is_executing || current_attempt.is_some(),
        current_execution,
    })
}

// Helper functions

async fn start_execution(
    app: &AppHandle,
    state: &State<'_, AppState>,
    cli_state: &State<'_, CliState>,
    task_id: &str,
    payload: Option<StartExecutionPayload>,
) -> Result<(), String> {
    let task_service = &state.task_service;
    let task_uuid = Uuid::parse_str(task_id).map_err(|e| e.to_string())?;
    
    // Update task status to Working
    let updated_task = task_service.update_task_status(task_uuid, crate::models::TaskStatus::Working)
        .await
        .map_err(|e| e.to_string())?;
    
    // Emit task status update event
    let _ = app.emit("task-status-updated", &updated_task);
    
    // Get or create attempt
    let attempts = task_service.list_task_attempts(task_uuid)
        .await
        .map_err(|e| e.to_string())?;
    
    let attempt = if let Some(existing) = attempts.last() {
        existing.clone()
    } else {
        let req = crate::models::CreateTaskAttemptRequest {
            task_id: task_uuid,
            executor: None,
            base_branch: None,
        };
        task_service.create_task_attempt(req)
            .await
            .map_err(|e| e.to_string())?
    };
    
    // Get project for task
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
    
    // Get the prompt from payload or use a default
    let prompt = if let Some(payload) = payload {
        payload.initial_message.unwrap_or_else(|| "Start working on this task".to_string())
    } else {
        "Start working on this task".to_string()
    };
    
    // Determine agent type from executor field
    let agent_type = match attempt.executor.as_deref() {
        Some("claude") | Some("claude_code") | Some("ClaudeCode") => 
            crate::services::coding_agent_executor::CodingAgentType::ClaudeCode,
        Some("gemini") | Some("gemini_cli") | Some("GeminiCli") => 
            crate::services::coding_agent_executor::CodingAgentType::GeminiCli,
        _ => crate::services::coding_agent_executor::CodingAgentType::ClaudeCode, // Default to Claude
    };
    
    // Execute prompt with the appropriate agent
    let _execution = crate::commands::cli::execute_prompt(
        cli_state.clone(),
        prompt,
        task_id.to_string(),
        attempt.id.clone(),
        if attempt.worktree_path.is_empty() { project.path.clone() } else { attempt.worktree_path.clone() },
        agent_type,
        None, // No resume session for new execution
    ).await?;
    
    // Emit state update
    emit_state_update(app, state, cli_state, task_id).await;
    
    Ok(())
}

async fn send_message(
    app: &AppHandle,
    state: &State<'_, AppState>,
    cli_state: &State<'_, CliState>,
    task_id: &str,
    payload: SendMessagePayload,
) -> Result<(), String> {
    // In the new model, each message creates a new execution
    // Check if there's already an active execution and stop it first
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
    
    // Start a new execution with the message
    log::info!("Starting new execution for task {} with message and {} images", 
        task_id, payload.images.as_ref().map(|imgs| imgs.len()).unwrap_or(0));
    start_execution(app, state, cli_state, task_id, Some(StartExecutionPayload {
        initial_message: Some(payload.message),
        images: payload.images,
    })).await?;
    
    // Emit state update
    emit_state_update(app, state, cli_state, task_id).await;
    
    Ok(())
}

async fn stop_execution(
    app: &AppHandle,
    state: &State<'_, AppState>,
    cli_state: &State<'_, CliState>,
    task_id: &str,
) -> Result<(), String> {
    let task_service = &state.task_service;
    let task_uuid = Uuid::parse_str(task_id).map_err(|e| e.to_string())?;
    
    // Get current execution
    let executions = cli_state.service.list_executions();
    if let Some(execution) = executions.iter().find(|e| e.task_id == task_id) {
        crate::commands::cli::stop_cli_execution(
            cli_state.clone(),
            execution.id.clone(),
        ).await?;
    }
    
    // Update task status back to Backlog when stopping
    let updated_task = task_service.update_task_status(task_uuid, crate::models::TaskStatus::Backlog)
        .await
        .map_err(|e| e.to_string())?;
    
    // Emit task status update event
    let _ = app.emit("task-status-updated", &updated_task);
    
    // Emit state update
    emit_state_update(app, state, cli_state, task_id).await;
    
    Ok(())
}

async fn emit_state_update(
    app: &AppHandle, 
    state: &State<'_, AppState>,
    cli_state: &State<'_, CliState>,
    task_id: &str
) {
    if let Ok(conversation_state) = get_conversation_state(state.clone(), cli_state.clone(), task_id.to_string()).await {
        let _ = app.emit("conversation-state-update", &serde_json::json!({
            "taskId": task_id,
            "state": conversation_state,
        }));
    }
}

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