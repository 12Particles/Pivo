use crate::models::{CreateTaskRequest, Task, TaskStatus, UpdateTaskRequest};
use crate::AppState;
use tauri::{State, AppHandle, Emitter};
use uuid::Uuid;

#[tauri::command]
pub async fn create_task(
    state: State<'_, AppState>,
    request: CreateTaskRequest,
) -> Result<Task, String> {
    state
        .task_service
        .create_task(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_task(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Task>, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .task_service
        .get_task(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_tasks(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<Task>, String> {
    let uuid = Uuid::parse_str(&project_id).map_err(|e| e.to_string())?;
    state
        .task_service
        .list_tasks(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task(
    state: State<'_, AppState>,
    id: String,
    request: UpdateTaskRequest,
) -> Result<Task, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .task_service
        .update_task(uuid, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_task(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .task_service
        .delete_task(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task_status(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    id: String,
    status: TaskStatus,
) -> Result<Task, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let task = state
        .task_service
        .update_task_status(uuid, status)
        .await
        .map_err(|e| e.to_string())?;
    
    // Emit task status update event
    let _ = app_handle.emit("task-status-updated", &task);
    
    Ok(task)
}