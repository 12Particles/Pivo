use async_trait::async_trait;
use reqwest::{Client, StatusCode};
use serde::Deserialize;
use std::process::Command;
use crate::models::{
    GitLabConfig, MergeRequestInfo, GitRemoteInfo, MergeRequestState, 
    MergeStatus, PipelineStatus
};
use super::git_platform::GitPlatformService;

pub struct GitLabService {
    client: Client,
    config: GitLabConfig,
}

impl GitLabService {
    pub fn new(config: GitLabConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }
    
    fn get_api_url(&self, remote_info: &GitRemoteInfo, endpoint: &str) -> String {
        let base_url = remote_info.host.as_deref()
            .unwrap_or(self.config.gitlab_url());
        
        let project_path = format!("{}/{}", remote_info.owner, remote_info.repo);
        let encoded_path = urlencoding::encode(&project_path);
        
        format!("{}/api/v4/projects/{}/{}", base_url, encoded_path, endpoint)
    }
    
    async fn make_request<T: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
        method: reqwest::Method,
        body: Option<serde_json::Value>,
    ) -> Result<T, String> {
        let pat = self.config.pat.as_ref()
            .ok_or("GitLab Personal Access Token not configured")?;
        
        let mut request = self.client
            .request(method, url)
            .header("Authorization", format!("Bearer {}", pat))
            .header("Content-Type", "application/json");
        
        if let Some(body) = body {
            request = request.json(&body);
        }
        
        let response = request.send().await
            .map_err(|e| format!("Failed to send request: {}", e))?;
        
        match response.status() {
            StatusCode::OK | StatusCode::CREATED => {
                response.json::<T>().await
                    .map_err(|e| format!("Failed to parse response: {}", e))
            }
            StatusCode::UNAUTHORIZED => {
                Err("Unauthorized: Invalid GitLab Personal Access Token".to_string())
            }
            StatusCode::NOT_FOUND => {
                Err("Not found: Repository or merge request not found".to_string())
            }
            status => {
                let error_text = response.text().await.unwrap_or_default();
                Err(format!("GitLab API error ({}): {}", status, error_text))
            }
        }
    }
}

#[async_trait]
impl GitPlatformService for GitLabService {
    async fn create_merge_request(
        &self,
        remote_info: &GitRemoteInfo,
        title: &str,
        description: &str,
        source_branch: &str,
        target_branch: &str,
    ) -> Result<MergeRequestInfo, String> {
        let url = self.get_api_url(remote_info, "merge_requests");
        
        let body = serde_json::json!({
            "source_branch": source_branch,
            "target_branch": target_branch,
            "title": title,
            "description": description,
            "remove_source_branch": true,
        });
        
        let response: GitLabMergeRequest = self.make_request(
            &url,
            reqwest::Method::POST,
            Some(body),
        ).await?;
        
        Ok(response.into())
    }
    
    async fn get_merge_request(
        &self,
        remote_info: &GitRemoteInfo,
        mr_number: i64,
    ) -> Result<MergeRequestInfo, String> {
        let url = self.get_api_url(remote_info, &format!("merge_requests/{}", mr_number));
        
        let response: GitLabMergeRequest = self.make_request(
            &url,
            reqwest::Method::GET,
            None,
        ).await?;
        
        Ok(response.into())
    }
    
    async fn update_merge_request_status(
        &self,
        remote_info: &GitRemoteInfo,
        mr_number: i64,
    ) -> Result<MergeRequestInfo, String> {
        // First get the basic MR info
        let mr = self.get_merge_request(remote_info, mr_number).await?;
        
        // Then get detailed merge status
        let url = self.get_api_url(remote_info, &format!("merge_requests/{}", mr_number));
        let detailed: GitLabMergeRequestDetailed = self.make_request(
            &url,
            reqwest::Method::GET,
            None,
        ).await?;
        
        let mut mr_info = mr;
        mr_info.merge_status = detailed.merge_status.and_then(|s| s.parse().ok());
        mr_info.has_conflicts = detailed.has_conflicts.unwrap_or(false);
        
        // Get pipeline status if available
        if let Some(pipeline) = detailed.head_pipeline {
            mr_info.pipeline_status = pipeline.status.and_then(|s| s.parse().ok());
        }
        
        Ok(mr_info)
    }
    
    async fn list_merge_requests(
        &self,
        remote_info: &GitRemoteInfo,
        source_branch: Option<&str>,
    ) -> Result<Vec<MergeRequestInfo>, String> {
        let mut url = self.get_api_url(remote_info, "merge_requests?state=opened");
        
        if let Some(branch) = source_branch {
            url.push_str(&format!("&source_branch={}", urlencoding::encode(branch)));
        }
        
        let response: Vec<GitLabMergeRequest> = self.make_request(
            &url,
            reqwest::Method::GET,
            None,
        ).await?;
        
        Ok(response.into_iter().map(|mr| mr.into()).collect())
    }
    
    async fn push_branch(
        &self,
        repo_path: &str,
        branch: &str,
        force: bool,
    ) -> Result<(), String> {
        let pat = self.config.pat.as_ref()
            .ok_or("GitLab Personal Access Token not configured")?;
        
        // First, get the remote URL
        let remote_output = Command::new("git")
            .current_dir(repo_path)
            .args(&["remote", "get-url", "origin"])
            .output()
            .map_err(|e| format!("Failed to get remote URL: {}", e))?;
        
        if !remote_output.status.success() {
            return Err("Failed to get remote URL".to_string());
        }
        
        let remote_url = String::from_utf8_lossy(&remote_output.stdout).trim().to_string();
        
        // Convert SSH URL to HTTPS with authentication
        let push_url = if remote_url.starts_with("git@") {
            // Convert git@gitlab.com:owner/repo.git to https://oauth2:TOKEN@gitlab.com/owner/repo.git
            let parts: Vec<&str> = remote_url.splitn(2, ':').collect();
            if parts.len() == 2 {
                let host = parts[0].replace("git@", "");
                let path = parts[1];
                format!("https://oauth2:{}@{}/{}", pat, host, path)
            } else {
                return Err("Invalid SSH URL format".to_string());
            }
        } else if remote_url.starts_with("https://") {
            // Insert authentication into HTTPS URL
            let url = remote_url.replace("https://", &format!("https://oauth2:{}@", pat));
            url
        } else {
            return Err("Unsupported remote URL format".to_string());
        };
        
        // Push to remote
        let mut args = vec!["push", &push_url, branch];
        if force {
            args.push("--force");
        }
        
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to push: {}", e))?;
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr).to_string();
            // Remove token from error message
            let safe_error = error.replace(pat, "***");
            return Err(format!("Failed to push to GitLab: {}", safe_error));
        }
        
        Ok(())
    }
}

// GitLab API response structures
#[derive(Debug, Deserialize)]
struct GitLabMergeRequest {
    id: i64,
    iid: i64,
    title: String,
    description: Option<String>,
    state: String,
    source_branch: String,
    target_branch: String,
    web_url: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct GitLabMergeRequestDetailed {
    merge_status: Option<String>,
    has_conflicts: Option<bool>,
    head_pipeline: Option<GitLabPipeline>,
}

#[derive(Debug, Deserialize)]
struct GitLabPipeline {
    id: i64,
    status: Option<String>,
    web_url: String,
}

// Convert GitLab response to our unified model
impl From<GitLabMergeRequest> for MergeRequestInfo {
    fn from(mr: GitLabMergeRequest) -> Self {
        MergeRequestInfo {
            id: mr.id,
            iid: mr.iid,
            number: mr.iid, // GitLab uses iid as the MR number
            title: mr.title,
            description: mr.description,
            state: match mr.state.as_str() {
                "opened" => MergeRequestState::Opened,
                "closed" => MergeRequestState::Closed,
                "merged" => MergeRequestState::Merged,
                "locked" => MergeRequestState::Locked,
                _ => MergeRequestState::Opened,
            },
            source_branch: mr.source_branch,
            target_branch: mr.target_branch,
            web_url: mr.web_url,
            merge_status: None,
            has_conflicts: false,
            pipeline_status: None,
            created_at: mr.created_at,
            updated_at: mr.updated_at,
        }
    }
}

// String parsing implementations
impl std::str::FromStr for MergeStatus {
    type Err = ();
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "can_be_merged" => Ok(MergeStatus::CanBeMerged),
            "cannot_be_merged" => Ok(MergeStatus::CannotBeMerged),
            "cannot_be_merged_recheck" => Ok(MergeStatus::CannotBeMergedRecheck),
            "checking" => Ok(MergeStatus::Checking),
            "unchecked" => Ok(MergeStatus::Unchecked),
            _ => Err(()),
        }
    }
}

impl std::str::FromStr for PipelineStatus {
    type Err = ();
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "created" => Ok(PipelineStatus::Created),
            "waiting_for_resource" => Ok(PipelineStatus::WaitingForResource),
            "preparing" => Ok(PipelineStatus::Preparing),
            "pending" => Ok(PipelineStatus::Pending),
            "running" => Ok(PipelineStatus::Running),
            "success" => Ok(PipelineStatus::Success),
            "failed" => Ok(PipelineStatus::Failed),
            "canceled" => Ok(PipelineStatus::Canceled),
            "skipped" => Ok(PipelineStatus::Skipped),
            "manual" => Ok(PipelineStatus::Manual),
            "scheduled" => Ok(PipelineStatus::Scheduled),
            _ => Err(()),
        }
    }
}