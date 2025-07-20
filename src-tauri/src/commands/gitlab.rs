use crate::models::{GitLabConfig, MergeRequestInfo, GitRemoteInfo, CreateMergeRequestData};
use crate::services::{ConfigService, GitLabService, GitPlatformService};
use crate::AppState;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use chrono::Utc;

#[tauri::command]
pub async fn get_gitlab_config(
    state: State<'_, Arc<Mutex<ConfigService>>>,
) -> Result<Option<GitLabConfig>, String> {
    let config_service = state.lock().await;
    Ok(config_service.get_gitlab_config().cloned())
}

#[tauri::command]
pub async fn update_gitlab_config(
    state: State<'_, Arc<Mutex<ConfigService>>>,
    config: GitLabConfig,
) -> Result<(), String> {
    let mut config_service = state.lock().await;
    config_service.update_gitlab_config(config).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_gitlab_mr(
    config_state: State<'_, Arc<Mutex<ConfigService>>>,
    app_state: State<'_, AppState>,
    task_attempt_id: String,
    remote_url: String,
    title: String,
    description: String,
    source_branch: String,
    target_branch: String,
) -> Result<MergeRequestInfo, String> {
    let config_service = config_state.lock().await;
    let gitlab_config = config_service.get_gitlab_config()
        .ok_or("GitLab not configured")?
        .clone();
    
    drop(config_service); // Release lock
    
    let remote_info = GitRemoteInfo::from_remote_url(&remote_url)
        .ok_or("Invalid remote URL")?;
    
    let gitlab_service = GitLabService::new(gitlab_config);
    let mr_info = gitlab_service.create_merge_request(
        &remote_info,
        &title,
        &description,
        &source_branch,
        &target_branch,
    ).await?;
    
    // Store MR in database
    let mr_data = CreateMergeRequestData {
        task_attempt_id,
        provider: "gitlab".to_string(),
        mr_id: mr_info.id,
        mr_iid: mr_info.iid,
        mr_number: mr_info.number,
        title: mr_info.title.clone(),
        description: mr_info.description.clone(),
        state: format!("{:?}", mr_info.state).to_lowercase(),
        source_branch: mr_info.source_branch.clone(),
        target_branch: mr_info.target_branch.clone(),
        web_url: mr_info.web_url.clone(),
        merge_status: mr_info.merge_status.as_ref().map(|s| format!("{:?}", s).to_lowercase()),
        has_conflicts: mr_info.has_conflicts,
        pipeline_status: mr_info.pipeline_status.as_ref().map(|s| format!("{:?}", s).to_lowercase()),
        pipeline_url: None, // TODO: Get from API if available
        created_at: Utc::now(),
        updated_at: Utc::now(),
        merged_at: None,
    };
    
    app_state.merge_request_service.create_merge_request(mr_data)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(mr_info)
}

#[tauri::command]
pub async fn get_gitlab_mr_status(
    config_state: State<'_, Arc<Mutex<ConfigService>>>,
    app_state: State<'_, AppState>,
    task_attempt_id: String,
    remote_url: String,
    mr_number: i64,
) -> Result<MergeRequestInfo, String> {
    let config_service = config_state.lock().await;
    let gitlab_config = config_service.get_gitlab_config()
        .ok_or("GitLab not configured")?
        .clone();
    
    drop(config_service); // Release lock
    
    let remote_info = GitRemoteInfo::from_remote_url(&remote_url)
        .ok_or("Invalid remote URL")?;
    
    let gitlab_service = GitLabService::new(gitlab_config);
    let mr_info = gitlab_service.update_merge_request_status(&remote_info, mr_number).await?;
    
    // Sync MR to database
    let mr_data = CreateMergeRequestData {
        task_attempt_id,
        provider: "gitlab".to_string(),
        mr_id: mr_info.id,
        mr_iid: mr_info.iid,
        mr_number: mr_info.number,
        title: mr_info.title.clone(),
        description: mr_info.description.clone(),
        state: format!("{:?}", mr_info.state).to_lowercase(),
        source_branch: mr_info.source_branch.clone(),
        target_branch: mr_info.target_branch.clone(),
        web_url: mr_info.web_url.clone(),
        merge_status: mr_info.merge_status.as_ref().map(|s| format!("{:?}", s).to_lowercase()),
        has_conflicts: mr_info.has_conflicts,
        pipeline_status: mr_info.pipeline_status.as_ref().map(|s| format!("{:?}", s).to_lowercase()),
        pipeline_url: None, // TODO: Get from API if available
        created_at: Utc::now(),
        updated_at: Utc::now(),
        merged_at: None,
    };
    
    app_state.merge_request_service.sync_merge_request_from_api("gitlab", mr_info.id, mr_data)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(mr_info)
}

#[tauri::command]
pub async fn push_to_gitlab(
    config_state: State<'_, Arc<Mutex<ConfigService>>>,
    repo_path: String,
    branch: String,
    force: bool,
) -> Result<(), String> {
    let config_service = config_state.lock().await;
    let gitlab_config = config_service.get_gitlab_config()
        .ok_or("GitLab not configured")?
        .clone();
    
    drop(config_service); // Release lock
    
    let gitlab_service = GitLabService::new(gitlab_config);
    gitlab_service.push_branch(&repo_path, &branch, force).await
}

#[tauri::command]
pub async fn detect_git_provider(remote_url: String) -> Result<String, String> {
    let remote_info = GitRemoteInfo::from_remote_url(&remote_url)
        .ok_or("Invalid remote URL")?;
    
    Ok(remote_info.provider.display_name().to_string())
}

#[tauri::command]
pub async fn get_merge_requests_by_attempt(
    app_state: State<'_, AppState>,
    task_attempt_id: String,
) -> Result<Vec<crate::models::MergeRequest>, String> {
    app_state.merge_request_service
        .get_merge_requests_by_attempt(&task_attempt_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_merge_requests_by_task(
    app_state: State<'_, AppState>,
    task_id: String,
) -> Result<Vec<crate::models::MergeRequest>, String> {
    app_state.merge_request_service
        .get_merge_requests_by_task(&task_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_merge_requests(
    app_state: State<'_, AppState>,
    provider: Option<String>,
) -> Result<Vec<crate::models::MergeRequest>, String> {
    app_state.merge_request_service
        .get_active_merge_requests(provider.as_deref())
        .await
        .map_err(|e| e.to_string())
}