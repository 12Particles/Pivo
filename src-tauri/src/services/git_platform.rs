use async_trait::async_trait;
use crate::models::{MergeRequestInfo, GitRemoteInfo};

/// Trait for Git platform services (GitHub, GitLab, etc.)
#[async_trait]
pub trait GitPlatformService: Send + Sync {
    /// Create a merge/pull request
    async fn create_merge_request(
        &self,
        remote_info: &GitRemoteInfo,
        title: &str,
        description: &str,
        source_branch: &str,
        target_branch: &str,
    ) -> Result<MergeRequestInfo, String>;
    
    /// Get merge request status
    async fn get_merge_request(
        &self,
        remote_info: &GitRemoteInfo,
        mr_number: i64,
    ) -> Result<MergeRequestInfo, String>;
    
    /// Update merge request status
    async fn update_merge_request_status(
        &self,
        remote_info: &GitRemoteInfo,
        mr_number: i64,
    ) -> Result<MergeRequestInfo, String>;
    
    /// List merge requests for a branch
    async fn list_merge_requests(
        &self,
        remote_info: &GitRemoteInfo,
        source_branch: Option<&str>,
    ) -> Result<Vec<MergeRequestInfo>, String>;
    
    /// Push branch to remote with authentication
    async fn push_branch(
        &self,
        repo_path: &str,
        branch: &str,
        force: bool,
    ) -> Result<(), String>;
}