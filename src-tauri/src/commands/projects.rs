use crate::models::{CreateProjectRequest, Project, UpdateProjectRequest};
use crate::AppState;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    request: CreateProjectRequest,
) -> Result<Project, String> {
    state
        .project_service
        .create_project(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_project(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Project>, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .project_service
        .get_project(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_projects(
    state: State<'_, AppState>,
) -> Result<Vec<Project>, String> {
    state
        .project_service
        .list_projects()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    id: String,
    request: UpdateProjectRequest,
) -> Result<Project, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .project_service
        .update_project(uuid, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_project(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .project_service
        .delete_project(uuid)
        .await
        .map_err(|e| e.to_string())
}