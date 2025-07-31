use crate::models::ExecutionProcess;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn get_process(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<ExecutionProcess>, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .process_service
        .get_process(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_processes_for_attempt(
    state: State<'_, AppState>,
    task_attempt_id: String,
) -> Result<Vec<ExecutionProcess>, String> {
    let uuid = Uuid::parse_str(&task_attempt_id).map_err(|e| e.to_string())?;
    state
        .process_service
        .list_processes_for_attempt(uuid)
        .await
        .map_err(|e| e.to_string())
}