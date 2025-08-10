use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};
use sqlx::SqlitePool;
use uuid::Uuid;
use tauri::{AppHandle, Emitter};

use crate::models::{TaskStatus, MergeRequest};
use crate::services::{GitLabService, GitHubService, MergeRequestService, TaskService, git_platform::GitPlatformService};

/// VCS (Version Control System) Sync Service
/// Periodically syncs MR/PR status and updates task status accordingly
pub struct VcsSyncService {
    pool: SqlitePool,
    gitlab_service: Arc<Mutex<GitLabService>>,
    github_service: Arc<Mutex<GitHubService>>,
    merge_request_service: Arc<MergeRequestService>,
    task_service: Arc<TaskService>,
    sync_interval_seconds: u64,
    app_handle: AppHandle,
}

impl VcsSyncService {
    pub fn new(
        pool: SqlitePool,
        gitlab_service: Arc<Mutex<GitLabService>>,
        github_service: Arc<Mutex<GitHubService>>,
        sync_interval_seconds: u64,
        app_handle: AppHandle,
    ) -> Self {
        let merge_request_service = Arc::new(MergeRequestService::new(pool.clone()));
        let task_service = Arc::new(TaskService::new(pool.clone()));
        
        Self {
            pool,
            gitlab_service,
            github_service,
            merge_request_service,
            task_service,
            sync_interval_seconds,
            app_handle,
        }
    }

    /// Start the background sync service
    pub async fn start_background_sync(self: Arc<Self>) {
        log::info!("Starting VCS sync service with interval: {} seconds", self.sync_interval_seconds);
        
        let mut interval = interval(Duration::from_secs(self.sync_interval_seconds));
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.sync_all_merge_requests().await {
                log::error!("Error during VCS sync: {:?}", e);
            }
        }
    }

    /// Sync all merge requests and update task statuses
    async fn sync_all_merge_requests(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        log::debug!("Starting VCS sync cycle");
        
        // Get all open merge requests from database
        let merge_requests = self.get_open_merge_requests().await?;
        
        for mr in merge_requests {
            if let Err(e) = self.sync_single_merge_request(mr).await {
                log::error!("Failed to sync merge request: {:?}", e);
            }
        }
        
        log::debug!("VCS sync cycle completed");
        Ok(())
    }

    /// Sync a single merge request
    async fn sync_single_merge_request(&self, mr: MergeRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        log::debug!("Syncing MR/PR: {} ({})", mr.title, mr.provider);
        
        // Fetch latest status from provider
        let updated_mr = match mr.provider.as_str() {
            "gitlab" => self.sync_gitlab_mr(&mr).await?,
            "github" => self.sync_github_pr(&mr).await?,
            _ => {
                log::debug!("Unknown provider: {}", mr.provider);
                return Ok(());
            }
        };
        
        // Emit event when MR/PR status changes
        if mr.state != updated_mr.state {
            let _ = self.app_handle.emit("vcs:merge-request-updated", serde_json::json!({
                "mr_id": updated_mr.id,
                "previous_state": mr.state,
                "new_state": updated_mr.state,
                "task_attempt_id": updated_mr.task_attempt_id,
            }));
            
            log::info!("MR/PR {} state changed from {} to {}", mr.title, mr.state, updated_mr.state);
        }
        
        // Check if MR was just merged
        if mr.state != "merged" && updated_mr.state == "merged" {
            log::info!("MR/PR {} has been merged, updating task status", mr.title);
            self.update_task_status_to_done(&updated_mr).await?;
        }
        
        Ok(())
    }

    /// Sync GitLab merge request
    async fn sync_gitlab_mr(&self, mr: &MergeRequest) -> Result<MergeRequest, Box<dyn std::error::Error + Send + Sync>> {
        let gitlab = self.gitlab_service.lock().await;
        
        // Parse the web_url to get GitRemoteInfo
        let remote_info = self.parse_gitlab_remote_info(&mr.web_url)?;
        
        // Call GitLab API to get latest MR status
        let updated_mr_info = gitlab.update_merge_request_status(&remote_info, mr.mr_iid).await?;
        
        // Update the MergeRequest with the new status
        let mut updated_mr = mr.clone();
        updated_mr.state = match updated_mr_info.state {
            crate::models::MergeRequestState::Opened => "opened".to_string(),
            crate::models::MergeRequestState::Closed => "closed".to_string(),
            crate::models::MergeRequestState::Merged => "merged".to_string(),
            crate::models::MergeRequestState::Locked => "locked".to_string(),
        };
        
        if let Some(merge_status) = updated_mr_info.merge_status {
            updated_mr.merge_status = Some(format!("{:?}", merge_status));
        }
        updated_mr.has_conflicts = updated_mr_info.has_conflicts;
        
        if let Some(pipeline_status) = updated_mr_info.pipeline_status {
            updated_mr.pipeline_status = Some(format!("{:?}", pipeline_status));
        }
        
        // Update in database
        self.update_merge_request_in_db(&updated_mr).await?;
        
        Ok(updated_mr)
    }

    /// Sync GitHub pull request
    async fn sync_github_pr(&self, mr: &MergeRequest) -> Result<MergeRequest, Box<dyn std::error::Error + Send + Sync>> {
        let github = self.github_service.lock().await;
        
        // Parse the web_url to get GitRemoteInfo
        let remote_info = self.parse_github_remote_info(&mr.web_url)?;
        
        // Call GitHub API to get latest PR status
        let updated_pr_info = github.update_merge_request_status(&remote_info, mr.mr_number).await?;
        
        // Update the MergeRequest with the new status
        let mut updated_mr = mr.clone();
        updated_mr.state = match updated_pr_info.state {
            crate::models::MergeRequestState::Opened => "opened".to_string(),
            crate::models::MergeRequestState::Closed => "closed".to_string(),
            crate::models::MergeRequestState::Merged => "merged".to_string(),
            crate::models::MergeRequestState::Locked => "locked".to_string(),
        };
        
        if let Some(merge_status) = updated_pr_info.merge_status {
            updated_mr.merge_status = Some(format!("{:?}", merge_status));
        }
        updated_mr.has_conflicts = updated_pr_info.has_conflicts;
        
        if let Some(pipeline_status) = updated_pr_info.pipeline_status {
            updated_mr.pipeline_status = Some(format!("{:?}", pipeline_status));
        }
        
        // Update in database
        self.update_merge_request_in_db(&updated_mr).await?;
        
        Ok(updated_mr)
    }

    /// Update task status to DONE when MR is merged
    async fn update_task_status_to_done(&self, mr: &MergeRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Get task attempt from MR
        let mut conn = self.pool.acquire().await?;
        
        let task_id: Option<String> = sqlx::query_scalar(
            "SELECT t.id FROM tasks t 
             JOIN task_attempts ta ON ta.task_id = t.id 
             WHERE ta.id = ?"
        )
        .bind(&mr.task_attempt_id)
        .fetch_optional(&mut *conn)
        .await?;
        
        if let Some(task_id_str) = task_id {
            // Parse UUID and update task status to Done
            let task_uuid = Uuid::parse_str(&task_id_str)?;
            let previous_status = TaskStatus::Working; // Assume it was Working before merged
            let updated_task = self.task_service.update_task_status(task_uuid, TaskStatus::Done).await?;
            
            // Emit event to frontend
            let _ = self.app_handle.emit("task:status-changed", serde_json::json!({
                "taskId": task_id_str,
                "previousStatus": previous_status,
                "newStatus": TaskStatus::Done,
                "task": updated_task,
            }));
            
            log::info!("Updated task {} status to Done and notified frontend", task_id_str);
        }
        
        Ok(())
    }

    /// Get all open merge requests from database
    async fn get_open_merge_requests(&self) -> Result<Vec<MergeRequest>, Box<dyn std::error::Error + Send + Sync>> {
        self.merge_request_service.get_open_merge_requests().await
    }
    
    /// Update merge request in database
    async fn update_merge_request_in_db(&self, mr: &MergeRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.acquire().await?;
        
        let query = r#"
            UPDATE merge_requests SET
                state = ?, 
                merge_status = ?, 
                has_conflicts = ?, 
                pipeline_status = ?,
                synced_at = CURRENT_TIMESTAMP
            WHERE id = ?
        "#;

        sqlx::query(query)
            .bind(&mr.state)
            .bind(&mr.merge_status)
            .bind(mr.has_conflicts)
            .bind(&mr.pipeline_status)
            .bind(mr.id)
            .execute(&mut *conn)
            .await?;
            
        Ok(())
    }
    
    /// Parse GitLab URL to extract GitRemoteInfo
    fn parse_gitlab_remote_info(&self, web_url: &str) -> Result<crate::models::GitRemoteInfo, Box<dyn std::error::Error + Send + Sync>> {
        // Example URL: https://gitlab.com/owner/repo/-/merge_requests/123
        // or https://gitlab.company.com/owner/repo/-/merge_requests/123
        let url = reqwest::Url::parse(web_url)?;
        let host = url.host_str().ok_or("Invalid URL: no host")?;
        
        let path_segments: Vec<&str> = url.path_segments()
            .ok_or("Invalid URL: no path")?
            .collect();
        
        if path_segments.len() < 2 {
            return Err("Invalid GitLab URL format".into());
        }
        
        let owner = path_segments[0].to_string();
        let repo = path_segments[1].to_string();
        
        Ok(crate::models::GitRemoteInfo {
            provider: crate::models::GitProvider::GitLab,
            owner,
            repo,
            host: if host != "gitlab.com" {
                Some(format!("https://{}", host))
            } else {
                None
            },
        })
    }
    
    /// Parse GitHub URL to extract GitRemoteInfo
    fn parse_github_remote_info(&self, web_url: &str) -> Result<crate::models::GitRemoteInfo, Box<dyn std::error::Error + Send + Sync>> {
        // Example URL: https://github.com/owner/repo/pull/123
        let url = reqwest::Url::parse(web_url)?;
        
        let path_segments: Vec<&str> = url.path_segments()
            .ok_or("Invalid URL: no path")?
            .collect();
        
        if path_segments.len() < 2 {
            return Err("Invalid GitHub URL format".into());
        }
        
        let owner = path_segments[0].to_string();
        let repo = path_segments[1].to_string();
        
        Ok(crate::models::GitRemoteInfo {
            provider: crate::models::GitProvider::GitHub,
            owner,
            repo,
            host: None, // GitHub doesn't need custom host
        })
    }
}

/// Configuration for VCS sync service
#[derive(Debug, Clone)]
pub struct VcsSyncConfig {
    /// Sync interval in seconds (default: 60)
    pub sync_interval_seconds: u64,
    /// Enable auto-sync (default: true)
    pub enabled: bool,
}

impl Default for VcsSyncConfig {
    fn default() -> Self {
        Self {
            sync_interval_seconds: 60, // Check every minute
            enabled: true,
        }
    }
}