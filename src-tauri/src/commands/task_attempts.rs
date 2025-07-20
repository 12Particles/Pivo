use crate::models::{CreateTaskAttemptRequest, TaskAttempt, AttemptStatus};
use crate::AppState;
use tauri::{State, AppHandle, Emitter};
use uuid::Uuid;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AttemptConversation {
    pub id: String,
    pub task_attempt_id: String,
    pub messages: Vec<ConversationMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveConversationRequest {
    pub messages: Vec<ConversationMessage>,
}

#[tauri::command]
pub async fn create_task_attempt(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    request: CreateTaskAttemptRequest,
) -> Result<TaskAttempt, String> {
    let attempt = state
        .task_service
        .create_task_attempt(request)
        .await
        .map_err(|e| e.to_string())?;
    
    // Emit task attempt created event
    let _ = app_handle.emit("task-attempt-created", &attempt);
    
    Ok(attempt)
}

#[tauri::command]
pub async fn get_task_attempt(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<TaskAttempt>, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .task_service
        .get_task_attempt(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_task_attempts(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<Vec<TaskAttempt>, String> {
    let uuid = Uuid::parse_str(&task_id).map_err(|e| e.to_string())?;
    state
        .task_service
        .list_task_attempts(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_attempt_status(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    id: String,
    status: AttemptStatus,
) -> Result<TaskAttempt, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let attempt = state
        .task_service
        .update_attempt_status(uuid, status)
        .await
        .map_err(|e| e.to_string())?;
    
    // Emit attempt status update event
    let _ = app_handle.emit("task-attempt-status-updated", &attempt);
    
    Ok(attempt)
}

#[tauri::command]
pub async fn save_attempt_conversation(
    state: State<'_, AppState>,
    attempt_id: String,
    request: SaveConversationRequest,
) -> Result<AttemptConversation, String> {
    let uuid = Uuid::parse_str(&attempt_id).map_err(|e| e.to_string())?;
    state
        .task_service
        .save_attempt_conversation(uuid, request.messages)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_attempt_conversation(
    state: State<'_, AppState>,
    attempt_id: String,
) -> Result<Option<AttemptConversation>, String> {
    let uuid = Uuid::parse_str(&attempt_id).map_err(|e| e.to_string())?;
    state
        .task_service
        .get_attempt_conversation(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_attempt_claude_session(
    state: State<'_, AppState>,
    attempt_id: String,
    claude_session_id: String,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&attempt_id).map_err(|e| e.to_string())?;
    state
        .task_service
        .update_attempt_claude_session(uuid, claude_session_id)
        .await
        .map_err(|e| e.to_string())
}