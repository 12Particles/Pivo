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

#[tauri::command]
pub async fn refresh_all_git_providers(
    state: State<'_, AppState>,
) -> Result<Vec<Project>, String> {
    // Get all projects
    let projects = state
        .project_service
        .list_projects()
        .await
        .map_err(|e| e.to_string())?;
    
    let mut updated_projects = Vec::new();
    
    // Update each project that has a git_repo but no git_provider
    for project in projects {
        if project.git_repo.is_some() && project.git_provider.is_none() {
            // Create an update request with just the git_repo to trigger provider detection
            let update_req = UpdateProjectRequest {
                name: None,
                description: None,
                path: None,
                git_repo: project.git_repo.clone(),
                setup_script: None,
                dev_script: None,
            };
            
            match state
                .project_service
                .update_project(Uuid::parse_str(&project.id).unwrap(), update_req)
                .await
            {
                Ok(updated_project) => {
                    updated_projects.push(updated_project);
                }
                Err(e) => {
                    log::error!("Failed to update project {}: {}", project.id, e);
                }
            }
        }
    }
    
    Ok(updated_projects)
}