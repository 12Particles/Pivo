use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use crate::models::{GitHubConfig, MergeRequestInfo, GitRemoteInfo, MergeRequestState, MergeStatus, PipelineStatus};
use crate::services::git_platform::GitPlatformService;
use crate::utils::command::execute_git;

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
    
    pub async fn verify_token(&self) -> Result<serde_json::Value, String> {
        let url = "https://api.github.com/user";
        
        let response = self.client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to verify token: {}", e))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub API error ({}): {}", status, error_text));
        }
        
        let user_info: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        log::info!("GitHub user verified: {}", user_info.get("login").and_then(|v| v.as_str()).unwrap_or("unknown"));
        
        Ok(user_info)
    }
    
    pub async fn check_org_access(&self, org_name: &str) -> Result<bool, String> {
        // Check if the token has access to the organization
        let url = format!("https://api.github.com/orgs/{}", org_name);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to check org access: {}", e))?;
        
        if response.status().is_success() {
            log::info!("Token has access to organization: {}", org_name);
            Ok(true)
        } else if response.status() == 404 {
            log::warn!("No access to organization: {} (404)", org_name);
            Ok(false)
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            log::error!("Failed to check org access: {} - {}", status, error_text);
            Err(format!("GitHub API error ({}): {}", status, error_text))
        }
    }
    
    pub async fn list_user_orgs(&self) -> Result<Vec<String>, String> {
        let url = "https://api.github.com/user/orgs";
        
        let response = self.client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to list user orgs: {}", e))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub API error ({}): {}", status, error_text));
        }
        
        let orgs: Vec<serde_json::Value> = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        let org_names: Vec<String> = orgs.iter()
            .filter_map(|org| org.get("login").and_then(|v| v.as_str()))
            .map(|s| s.to_string())
            .collect();
        
        log::info!("User has access to organizations: {:?}", org_names);
        
        Ok(org_names)
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
        log::info!("Starting push_branch - repo: {}, branch: {}, force: {}", repo_path, branch, force);
        
        // Get the remote URL
        let remote_output = execute_git(&["remote", "get-url", "origin"], repo_path.as_ref())
            .map_err(|e| format!("Failed to get remote URL: {}", e))?;
        
        if !remote_output.status.success() {
            let stderr = String::from_utf8_lossy(&remote_output.stderr);
            log::error!("Failed to get remote URL. stderr: {}", stderr);
            return Err(format!("Failed to get remote URL: {}", stderr));
        }
        
        let remote_url = String::from_utf8_lossy(&remote_output.stdout).trim().to_string();
        log::info!("Original remote URL: {}", remote_url);
        
        // Parse the remote URL and inject the auth token
        let auth_token = self.config.access_token.as_ref()
            .ok_or("GitHub authentication not configured")?;
        
        log::info!("Token present: {}, Token length: {}", 
            auth_token.is_empty() == false, 
            auth_token.len()
        );
        
        // Verify token format (should start with ghp_ or ghs_ for newer tokens)
        if !auth_token.starts_with("ghp_") && !auth_token.starts_with("ghs_") && !auth_token.starts_with("github_pat_") {
            log::warn!("Token doesn't match expected GitHub token format (ghp_*, ghs_*, or github_pat_*)");
        }
        
        // GitHub now recommends using the token as the username with 'x-oauth-basic' as password
        // or just the token as password with any username
        let auth_url = if remote_url.starts_with("https://") {
            // Try using token as username with empty password
            remote_url.replace("https://", &format!("https://{}:x-oauth-basic@", auth_token))
        } else if remote_url.starts_with("git@github.com:") {
            // Convert SSH URL to HTTPS with auth token
            remote_url
                .replace("git@github.com:", "https://github.com/")
                .replace("https://", &format!("https://{}:x-oauth-basic@", auth_token))
        } else {
            log::error!("Unsupported remote URL format: {}", remote_url);
            return Err(format!("Unsupported remote URL format: {}", remote_url));
        };
        
        log::info!("Push URL (without token): {}", auth_url.replace(auth_token, "***"));
        log::info!("Pushing from repo: {}", repo_path);
        
        // First, disable credential helper for this push to ensure our URL is used
        let _config_output = execute_git(&["-c", "credential.helper="], repo_path.as_ref()).ok();
        
        // Push to the authenticated URL
        let branch_spec = format!("{}:{}", branch, branch);
        let mut push_args = vec!["-c", "credential.helper=", "push", &auth_url, &branch_spec];
        if force {
            push_args.push("--force");
        }
        
        log::info!("Executing git push with args: {:?}", push_args.iter().map(|arg| {
            if arg.contains(auth_token) {
                arg.replace(auth_token, "***")
            } else {
                arg.to_string()
            }
        }).collect::<Vec<_>>());
        
        let push_output = execute_git(&push_args, repo_path.as_ref())
            .map_err(|e| format!("Failed to push branch: {}", e))?;
        
        if !push_output.status.success() {
            let stderr = String::from_utf8_lossy(&push_output.stderr);
            let stdout = String::from_utf8_lossy(&push_output.stdout);
            log::error!("Git push failed. Exit code: {:?}", push_output.status.code());
            log::error!("Git push stderr: {}", stderr);
            log::error!("Git push stdout: {}", stdout);
            
            // Check for specific error patterns
            if stderr.contains("Permission to") && stderr.contains("denied to") {
                let username = stderr.split("denied to ").nth(1)
                    .and_then(|s| s.split(".").next())
                    .unwrap_or("unknown");
                log::error!("Permission denied for user: {}", username);
                log::error!("Please ensure the GitHub token has 'repo' scope and the user has write access to the repository");
            }
            
            return Err(format!("Failed to push branch: {}", stderr));
        }
        
        log::info!("Git push successful");
        
        Ok(())
    }
}