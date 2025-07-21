use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use crate::models::{GitHubConfig, MergeRequestInfo, GitRemoteInfo, MergeRequestState, MergeStatus, PipelineStatus};
use crate::services::git_platform::GitPlatformService;
use std::process::Command;

pub struct GitHubService {
    config: GitHubConfig,
    client: reqwest::Client,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubPullRequest {
    id: i64,
    number: i64,
    title: String,
    body: Option<String>,
    state: String,
    html_url: String,
    head: GitHubRef,
    base: GitHubRef,
    mergeable: Option<bool>,
    merged: bool,
    draft: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubRef {
    #[serde(rename = "ref")]
    ref_field: String,
    sha: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubCheckRuns {
    total_count: i32,
    check_runs: Vec<GitHubCheckRun>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubCheckRun {
    id: i64,
    name: String,
    status: String,
    conclusion: Option<String>,
}

impl GitHubService {
    pub fn new(config: GitHubConfig) -> Self {
        let mut headers = HeaderMap::new();
        
        // Use OAuth access_token
        if let Some(access_token) = &config.access_token {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", access_token)).unwrap(),
            );
        }
        
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("application/vnd.github+json"),
        );
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("pivo-app"),
        );
        
        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .unwrap();
        
        Self { config, client }
    }
    
    fn get_api_url(&self, remote_info: &GitRemoteInfo, endpoint: &str) -> String {
        format!(
            "https://api.github.com/repos/{}/{}/{}",
            remote_info.owner,
            remote_info.repo,
            endpoint
        )
    }
    
    async fn make_request<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
        method: reqwest::Method,
        body: Option<serde_json::Value>,
    ) -> Result<T, String> {
        let mut request = self.client.request(method, url);
        
        if let Some(body) = body {
            request = request.json(&body);
        }
        
        let response = request
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub API error ({}): {}", status, error_text));
        }
        
        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }
    
    async fn get_check_runs(&self, remote_info: &GitRemoteInfo, sha: &str) -> Result<PipelineStatus, String> {
        let url = self.get_api_url(remote_info, &format!("commits/{}/check-runs", sha));
        
        let check_runs: GitHubCheckRuns = self.make_request(
            &url,
            reqwest::Method::GET,
            None,
        ).await?;
        
        if check_runs.total_count == 0 {
            return Ok(PipelineStatus::Success);
        }
        
        let mut has_pending = false;
        let mut has_failure = false;
        
        for run in check_runs.check_runs {
            match run.status.as_str() {
                "completed" => {
                    match run.conclusion.as_deref() {
                        Some("success") => {},
                        Some("failure") | Some("cancelled") | Some("timed_out") => has_failure = true,
                        _ => has_pending = true,
                    }
                },
                _ => has_pending = true,
            }
        }
        
        Ok(if has_failure {
            PipelineStatus::Failed
        } else if has_pending {
            PipelineStatus::Running
        } else {
            PipelineStatus::Success
        })
    }
}

impl From<GitHubPullRequest> for MergeRequestInfo {
    fn from(pr: GitHubPullRequest) -> Self {
        let state = match pr.state.as_str() {
            "open" => MergeRequestState::Opened,
            "closed" if pr.merged => MergeRequestState::Merged,
            "closed" => MergeRequestState::Closed,
            _ => MergeRequestState::Opened,
        };
        
        let merge_status = if pr.merged {
            Some(MergeStatus::CanBeMerged)
        } else if let Some(mergeable) = pr.mergeable {
            Some(if mergeable {
                MergeStatus::CanBeMerged
            } else {
                MergeStatus::CannotBeMerged
            })
        } else {
            None
        };
        
        MergeRequestInfo {
            id: pr.id,
            iid: pr.number,
            number: pr.number,
            title: pr.title,
            description: pr.body,
            state,
            source_branch: pr.head.ref_field,
            target_branch: pr.base.ref_field,
            web_url: pr.html_url,
            merge_status,
            has_conflicts: pr.mergeable.map(|m| !m).unwrap_or(false),
            pipeline_status: None,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }
}

#[async_trait]
impl GitPlatformService for GitHubService {
    async fn create_merge_request(
        &self,
        remote_info: &GitRemoteInfo,
        title: &str,
        description: &str,
        source_branch: &str,
        target_branch: &str,
    ) -> Result<MergeRequestInfo, String> {
        let url = self.get_api_url(remote_info, "pulls");
        
        let body = serde_json::json!({
            "title": title,
            "body": description,
            "head": source_branch,
            "base": target_branch,
            "draft": false,
        });
        
        let pr: GitHubPullRequest = self.make_request(
            &url,
            reqwest::Method::POST,
            Some(body),
        ).await?;
        
        let mut mr_info = MergeRequestInfo::from(pr);
        
        // Get pipeline status from check runs
        if let Ok(pipeline_status) = self.get_check_runs(remote_info, &source_branch).await {
            mr_info.pipeline_status = Some(pipeline_status);
        }
        
        Ok(mr_info)
    }
    
    async fn get_merge_request(
        &self,
        remote_info: &GitRemoteInfo,
        pr_number: i64,
    ) -> Result<MergeRequestInfo, String> {
        let url = self.get_api_url(remote_info, &format!("pulls/{}", pr_number));
        
        let pr: GitHubPullRequest = self.make_request(
            &url,
            reqwest::Method::GET,
            None,
        ).await?;
        
        let mut mr_info = MergeRequestInfo::from(pr);
        
        // Get pipeline status from check runs
        if let Ok(pipeline_status) = self.get_check_runs(remote_info, &mr_info.source_branch).await {
            mr_info.pipeline_status = Some(pipeline_status);
        }
        
        Ok(mr_info)
    }
    
    async fn update_merge_request_status(
        &self,
        remote_info: &GitRemoteInfo,
        pr_number: i64,
    ) -> Result<MergeRequestInfo, String> {
        self.get_merge_request(remote_info, pr_number).await
    }
    
    
    async fn push_branch(
        &self,
        repo_path: &str,
        branch: &str,
        force: bool,
    ) -> Result<(), String> {
        // Get the remote URL
        let remote_output = Command::new("git")
            .args(&["remote", "get-url", "origin"])
            .current_dir(repo_path)
            .output()
            .map_err(|e| format!("Failed to get remote URL: {}", e))?;
        
        if !remote_output.status.success() {
            return Err("Failed to get remote URL".to_string());
        }
        
        let remote_url = String::from_utf8_lossy(&remote_output.stdout).trim().to_string();
        
        // Parse the remote URL and inject the auth token
        let auth_token = self.config.access_token.as_ref()
            .ok_or("GitHub authentication not configured")?;
        
        let auth_url = if remote_url.starts_with("https://") {
            remote_url.replace("https://", &format!("https://{}@", auth_token))
        } else if remote_url.starts_with("git@github.com:") {
            // Convert SSH URL to HTTPS with auth token
            remote_url
                .replace("git@github.com:", "https://github.com/")
                .replace("https://", &format!("https://{}@", auth_token))
        } else {
            return Err("Unsupported remote URL format".to_string());
        };
        
        // Push to the authenticated URL
        let branch_spec = format!("{}:{}", branch, branch);
        let mut push_args = vec!["push", &auth_url, &branch_spec];
        if force {
            push_args.push("--force");
        }
        
        let push_output = Command::new("git")
            .args(&push_args)
            .current_dir(repo_path)
            .output()
            .map_err(|e| format!("Failed to push branch: {}", e))?;
        
        if !push_output.status.success() {
            let stderr = String::from_utf8_lossy(&push_output.stderr);
            return Err(format!("Failed to push branch: {}", stderr));
        }
        
        Ok(())
    }
}