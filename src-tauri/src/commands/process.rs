use crate::models::{ExecutionProcess, ProcessType};
use crate::AppState;
use tauri::{State, AppHandle};
use uuid::Uuid;

#[tauri::command]
pub async fn spawn_process(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    task_attempt_id: String,
    process_type: ProcessType,
    command: String,
    args: Vec<String>,
    working_directory: String,
) -> Result<String, String> {
    let uuid = Uuid::parse_str(&task_attempt_id).map_err(|e| e.to_string())?;
    
    let process_id = state
        .process_service
        .spawn_process(uuid, process_type, command, args, working_directory, app_handle)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(process_id.to_string())
}

#[tauri::command]
pub async fn kill_process(
    state: State<'_, AppState>,
    process_id: String,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&process_id).map_err(|e| e.to_string())?;
    state
        .process_service
        .kill_process(uuid)
        .await
        .map_err(|e| e.to_string())
}

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