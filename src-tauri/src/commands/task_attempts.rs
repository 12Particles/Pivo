use crate::models::TaskAttempt;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

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