use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GitProvider {
    GitHub,
    GitLab,
    Other,
}

impl GitProvider {
    /// Detect provider from remote URL
    pub fn from_remote_url(url: &str) -> Self {
        if url.contains("github.com") {
            GitProvider::GitHub
        } else if url.contains("gitlab.com") || url.contains("gitlab.") {
            GitProvider::GitLab
        } else {
            GitProvider::Other
        }
    }
    
    /// Get the provider name for display
    pub fn display_name(&self) -> &str {
        match self {
            GitProvider::GitHub => "GitHub",
            GitProvider::GitLab => "GitLab",
            GitProvider::Other => "Git",
        }
    }
    
    // Removed unused methods merge_request_term and merge_request_short
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRemoteInfo {
    pub provider: GitProvider,
    pub owner: String,
    pub repo: String,
    pub host: Option<String>, // For self-hosted instances
}

impl GitRemoteInfo {
    /// Parse remote URL to extract provider and repository information
    pub fn from_remote_url(url: &str) -> Option<Self> {
        // Handle SSH URLs like git@gitlab.com:owner/repo.git
        if let Some(ssh_match) = regex::Regex::new(r"git@([^:]+):([^/]+)/(.+?)(?:\.git)?$")
            .ok()
            .and_then(|re| re.captures(url))
        {
            let host = ssh_match.get(1)?.as_str();
            let owner = ssh_match.get(2)?.as_str();
            let repo = ssh_match.get(3)?.as_str();
            
            return Some(GitRemoteInfo {
                provider: GitProvider::from_remote_url(host),
                owner: owner.to_string(),
                repo: repo.to_string(),
                host: if host != "github.com" && host != "gitlab.com" {
                    Some(format!("https://{}", host))
                } else {
                    None
                },
            });
        }
        
        // Handle HTTPS URLs like https://gitlab.com/owner/repo.git
        if let Some(https_match) = regex::Regex::new(r"https?://([^/]+)/([^/]+)/(.+?)(?:\.git)?$")
            .ok()
            .and_then(|re| re.captures(url))
        {
            let host = https_match.get(1)?.as_str();
            let owner = https_match.get(2)?.as_str();
            let repo = https_match.get(3)?.as_str();
            
            return Some(GitRemoteInfo {
                provider: GitProvider::from_remote_url(host),
                owner: owner.to_string(),
                repo: repo.to_string(),
                host: if host != "github.com" && host != "gitlab.com" {
                    Some(format!("https://{}", host))
                } else {
                    None
                },
            });
        }
        
        // Handle SSH URLs with custom ports like ssh://git@gitlab.example.com:2222/owner/repo.git
        if let Some(ssh_port_match) = regex::Regex::new(r"ssh://git@([^:]+):(\d+)/([^/]+)/(.+?)(?:\.git)?$")
            .ok()
            .and_then(|re| re.captures(url))
        {
            let host = ssh_port_match.get(1)?.as_str();
            let owner = ssh_port_match.get(3)?.as_str();
            let repo = ssh_port_match.get(4)?.as_str();
            
            return Some(GitRemoteInfo {
                provider: GitProvider::from_remote_url(host),
                owner: owner.to_string(),
                repo: repo.to_string(),
                host: Some(format!("https://{}", host)),
            });
        }
        
        None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequestInfo {
    pub id: i64,
    pub iid: i64, // Internal ID (GitLab specific)
    pub number: i64, // PR/MR number
    pub title: String,
    pub description: Option<String>,
    pub state: MergeRequestState,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub merge_status: Option<MergeStatus>,
    pub has_conflicts: bool,
    pub pipeline_status: Option<PipelineStatus>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MergeRequestState {
    Opened,
    Closed,
    Merged,
    Locked,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MergeStatus {
    CanBeMerged,
    CannotBeMerged,
    CannotBeMergedRecheck,
    Checking,
    Unchecked,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PipelineStatus {
    Created,
    WaitingForResource,
    Preparing,
    Pending,
    Running,
    Success,
    Failed,
    Canceled,
    Skipped,
    Manual,
    Scheduled,
}

// Removed unused PipelineStatus methods