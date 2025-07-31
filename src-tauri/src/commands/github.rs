use crate::models::{GitHubConfig, MergeRequestInfo, GitRemoteInfo, CreateMergeRequestData, MergeRequestState};
use crate::services::{ConfigService, GitHubService, GitPlatformService};
use crate::AppState;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use chrono::Utc;
use std::str::FromStr;

#[tauri::command]
pub async fn get_github_config(
    state: State<'_, Arc<Mutex<ConfigService>>>,
) -> Result<Option<GitHubConfig>, String> {
    let config_service = state.lock().await;
    Ok(config_service.get_github_config().cloned())
}

#[tauri::command]
pub async fn update_github_config(
    state: State<'_, Arc<Mutex<ConfigService>>>,
    config: GitHubConfig,
) -> Result<(), String> {
    let mut config_service = state.lock().await;
    config_service.update_github_config(config).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_github_pr(
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
    let github_config = config_service.get_github_config()
        .ok_or("GitHub not configured")?
        .clone();
    
    drop(config_service); // Release lock
    
    let remote_info = GitRemoteInfo::from_remote_url(&remote_url)
        .ok_or("Invalid remote URL")?;
    
    let github_service = GitHubService::new(github_config);
    let pr_info = github_service.create_merge_request(
        &remote_info,
        &title,
        &description,
        &source_branch,
        &target_branch,
    ).await?;
    
    // Store PR in database
    let pr_data = CreateMergeRequestData {
        task_attempt_id,
        provider: "github".to_string(),
        mr_id: pr_info.id,
        mr_iid: pr_info.iid,
        mr_number: pr_info.number,
        title: pr_info.title.clone(),
        description: pr_info.description.clone(),
        state: format!("{:?}", pr_info.state).to_lowercase(),
        source_branch: pr_info.source_branch.clone(),
        target_branch: pr_info.target_branch.clone(),
        web_url: pr_info.web_url.clone(),
        merge_status: pr_info.merge_status.as_ref().map(|s| format!("{:?}", s).to_lowercase()),
        has_conflicts: pr_info.has_conflicts,
        pipeline_status: pr_info.pipeline_status.as_ref().map(|s| format!("{:?}", s).to_lowercase()),
        pipeline_url: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        merged_at: None,
    };
    
    app_state.merge_request_service.create_merge_request(pr_data)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(pr_info)
}

#[tauri::command]
pub async fn get_github_pr_status(
    config_state: State<'_, Arc<Mutex<ConfigService>>>,
    app_state: State<'_, AppState>,
    task_attempt_id: String,
    remote_url: String,
    pr_number: i64,
) -> Result<MergeRequestInfo, String> {
    let config_service = config_state.lock().await;
    let github_config = config_service.get_github_config()
        .ok_or("GitHub not configured")?
        .clone();
    
    drop(config_service); // Release lock
    
    let remote_info = GitRemoteInfo::from_remote_url(&remote_url)
        .ok_or("Invalid remote URL")?;
    
    let github_service = GitHubService::new(github_config);
    let pr_info = github_service.update_merge_request_status(&remote_info, pr_number).await?;
    
    // Sync PR to database
    let pr_data = CreateMergeRequestData {
        task_attempt_id,
        provider: "github".to_string(),
        mr_id: pr_info.id,
        mr_iid: pr_info.iid,
        mr_number: pr_info.number,
        title: pr_info.title.clone(),
        description: pr_info.description.clone(),
        state: format!("{:?}", pr_info.state).to_lowercase(),
        source_branch: pr_info.source_branch.clone(),
        target_branch: pr_info.target_branch.clone(),
        web_url: pr_info.web_url.clone(),
        merge_status: pr_info.merge_status.as_ref().map(|s| format!("{:?}", s).to_lowercase()),
        has_conflicts: pr_info.has_conflicts,
        pipeline_status: pr_info.pipeline_status.as_ref().map(|s| format!("{:?}", s).to_lowercase()),
        pipeline_url: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        merged_at: None,
    };
    
    app_state.merge_request_service.sync_merge_request_from_api("github", pr_info.id, pr_data)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(pr_info)
}

#[tauri::command]
pub async fn push_to_github(
    config_state: State<'_, Arc<Mutex<ConfigService>>>,
    repo_path: String,
    branch: String,
    force: bool,
) -> Result<(), String> {
    let config_service = config_state.lock().await;
    let github_config = config_service.get_github_config()
        .ok_or("GitHub not configured")?
        .clone();
    
    drop(config_service); // Release lock
    
    let github_service = GitHubService::new(github_config);
    
    // Verify token before attempting to push
    match github_service.verify_token().await {
        Ok(user_info) => {
            log::info!("GitHub token verified for user: {}", 
                user_info.get("login").and_then(|v| v.as_str()).unwrap_or("unknown"));
        },
        Err(e) => {
            log::error!("Failed to verify GitHub token: {}", e);
            return Err(format!("GitHub token verification failed: {}", e));
        }
    }
    
    // List organizations the user has access to
    match github_service.list_user_orgs().await {
        Ok(orgs) => {
            log::info!("User has access to organizations: {:?}", orgs);
            
            // Check specific access to 12Particles org
            if !orgs.contains(&"12Particles".to_string()) {
                log::warn!("User does not have access to 12Particles organization");
                log::warn!("Please grant OAuth App access to the organization:");
                log::warn!("1. Go to: https://github.com/settings/connections/applications/{}", "Ov23limL5nB8uf0tDrQX");
                log::warn!("2. Find '12Particles' in the organization access section");
                log::warn!("3. Click 'Grant' or 'Request' access");
            }
        },
        Err(e) => {
            log::error!("Failed to list user organizations: {}", e);
        }
    }
    
    // Check specific org access
    match github_service.check_org_access("12Particles").await {
        Ok(has_access) => {
            if !has_access {
                log::error!("No access to 12Particles organization");
                return Err("OAuth App does not have access to 12Particles organization. Please grant access at: https://github.com/settings/connections/applications/Ov23limL5nB8uf0tDrQX".to_string());
            }
        },
        Err(e) => {
            log::error!("Failed to check org access: {}", e);
        }
    }
    
    github_service.push_branch(&repo_path, &branch, force).await
}

#[tauri::command]
pub async fn get_pull_requests_by_attempt(
    app_state: State<'_, AppState>,
    task_attempt_id: String,
) -> Result<Vec<MergeRequestInfo>, String> {
    app_state.merge_request_service
        .get_merge_requests_by_attempt(&task_attempt_id)
        .await
        .map(|mrs| mrs.into_iter().map(|mr| {
            MergeRequestInfo {
                id: mr.mr_id,
                iid: mr.mr_iid,
                number: mr.mr_number,
                title: mr.title,
                description: mr.description,
                state: MergeRequestState::from_str(&mr.state).unwrap_or(MergeRequestState::Opened),
                source_branch: mr.source_branch,
                target_branch: mr.target_branch,
                web_url: mr.web_url,
                merge_status: mr.merge_status.and_then(|s| s.parse().ok()),
                has_conflicts: mr.has_conflicts,
                pipeline_status: mr.pipeline_status.and_then(|s| s.parse().ok()),
                created_at: mr.created_at.to_rfc3339(),
                updated_at: mr.updated_at.to_rfc3339(),
            }
        }).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pull_requests_by_task(
    app_state: State<'_, AppState>,
    task_id: String,
) -> Result<Vec<MergeRequestInfo>, String> {
    app_state.merge_request_service
        .get_merge_requests_by_task(&task_id)
        .await
        .map(|mrs| mrs.into_iter().map(|mr| {
            MergeRequestInfo {
                id: mr.mr_id,
                iid: mr.mr_iid,
                number: mr.mr_number,
                title: mr.title,
                description: mr.description,
                state: MergeRequestState::from_str(&mr.state).unwrap_or(MergeRequestState::Opened),
                source_branch: mr.source_branch,
                target_branch: mr.target_branch,
                web_url: mr.web_url,
                merge_status: mr.merge_status.and_then(|s| s.parse().ok()),
                has_conflicts: mr.has_conflicts,
                pipeline_status: mr.pipeline_status.and_then(|s| s.parse().ok()),
                created_at: mr.created_at.to_rfc3339(),
                updated_at: mr.updated_at.to_rfc3339(),
            }
        }).collect())
        .map_err(|e| e.to_string())
}

use serde::{Serialize, Deserialize};
use serde_json::json;

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: i32,
    interval: i32,
}


#[tauri::command]
pub async fn github_start_device_flow() -> Result<DeviceCodeResponse, String> {
    let client_id = "Ov23limL5nB8uf0tDrQX"; // Your GitHub OAuth App Client ID - Note: First character is letter O, not zero
    
    log::info!("Starting GitHub device flow with client_id: {}", client_id);
    
    let client = reqwest::Client::new();
    
    // Build the request
    let url = "https://github.com/login/device/code";
    log::info!("Sending POST request to: {}", url);
    
    // Build form body WITHOUT client_secret - Device Flow doesn't need it
    // Add 'read:org' scope to request organization access
    let body = format!("client_id={}&scope=repo%20user%20read:org%20write:org", client_id);
    log::info!("Request body: {}", body);
    
    let response = client
        .post(url)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("User-Agent", "pivo-app")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Failed to start device flow: {}", e))?;
    
    log::info!("Response status: {}", response.status());
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        
        if status == 404 {
            return Err(format!(
                "GitHub Device Flow API not found (404). Please ensure:\n\
                1. Device Flow is enabled in your GitHub OAuth App settings\n\
                2. Go to GitHub Settings -> Developer settings -> OAuth Apps\n\
                3. Edit your app and enable 'Device Flow'\n\
                Error details: {}", 
                error_text
            ));
        }
        
        return Err(format!("GitHub API error: {} - {}", status, error_text));
    }
    
    let device_code_response = response
        .json::<DeviceCodeResponse>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    Ok(device_code_response)
}

#[tauri::command]
pub async fn github_poll_device_auth(
    config_state: State<'_, Arc<Mutex<ConfigService>>>,
    device_code: String,
) -> Result<serde_json::Value, String> {
    let client_id = "Ov23limL5nB8uf0tDrQX"; // Your GitHub OAuth App Client ID - Note: First character is letter O, not zero
    
    log::debug!("Polling device auth for device_code: {}", device_code);
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id),
            ("device_code", &device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to poll auth: {}", e))?;
    
    let status = response.status();
    log::debug!("Poll response status: {}", status);
    
    let json_response = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    log::debug!("Poll response: {:?}", json_response);
    
    // Check if we got an access token
    if let Some(access_token) = json_response.get("access_token").and_then(|v| v.as_str()) {
        log::info!("Got access token, length: {}", access_token.len());
        
        // Also get the token type if available
        let token_type = json_response.get("token_type").and_then(|v| v.as_str()).unwrap_or("bearer");
        log::info!("Token type: {}", token_type);
        
        // Get scope if available
        if let Some(scope) = json_response.get("scope").and_then(|v| v.as_str()) {
            log::info!("Token scope: {}", scope);
        }
        
        // Save the access token to config
        let mut config_service = config_state.lock().await;
        let mut github_config = config_service.get_github_config()
            .cloned()
            .unwrap_or_default();
        github_config.access_token = Some(access_token.to_string());
        
        // Fetch user info to get the username
        let github_service = GitHubService::new(github_config.clone());
        match github_service.verify_token().await {
            Ok(user_info) => {
                if let Some(login) = user_info.get("login").and_then(|v| v.as_str()) {
                    github_config.username = Some(login.to_string());
                    log::info!("GitHub user authenticated: {}", login);
                }
            },
            Err(e) => {
                log::error!("Failed to fetch GitHub user info: {}", e);
            }
        }
        
        config_service.update_github_config(github_config).await
            .map_err(|e| format!("Failed to save GitHub config: {}", e))?;
        
        Ok(json!({ "status": "success" }))
    } else if let Some(error) = json_response.get("error").and_then(|v| v.as_str()) {
        log::debug!("Poll error: {}", error);
        if error == "authorization_pending" {
            Ok(json!({ "status": "pending" }))
        } else if error == "slow_down" {
            // GitHub is asking us to slow down
            Ok(json!({ "status": "pending", "slow_down": true }))
        } else {
            Ok(json!({ 
                "status": "error", 
                "error": error,
                "error_description": json_response.get("error_description").and_then(|v| v.as_str()).unwrap_or("")
            }))
        }
    } else {
        log::error!("Unexpected response format: {:?}", json_response);
        Err("Unexpected response format".to_string())
    }
}