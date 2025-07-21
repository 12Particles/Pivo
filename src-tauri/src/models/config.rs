use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub gitlab: Option<GitLabConfig>,
    pub github: Option<GitHubConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLabConfig {
    pub pat: Option<String>,              // Personal Access Token
    pub username: Option<String>,         // GitLab username
    pub primary_email: Option<String>,    // User email
    pub default_mr_base: Option<String>,  // Default target branch (defaults to "main")
    pub gitlab_url: Option<String>,       // GitLab instance URL (defaults to "https://gitlab.com")
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubConfig {
    pub access_token: Option<String>,     // OAuth Access Token
    pub username: Option<String>,         // GitHub username
    #[serde(rename = "defaultBranch")]
    pub default_pr_base: Option<String>,  // Default target branch (defaults to "main")
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            gitlab: None,
            github: None,
        }
    }
}

impl GitLabConfig {
    pub fn gitlab_url(&self) -> &str {
        self.gitlab_url.as_deref().unwrap_or("https://gitlab.com")
    }
    
    pub fn default_mr_base(&self) -> &str {
        self.default_mr_base.as_deref().unwrap_or("main")
    }
}

impl GitHubConfig {
    pub fn default_pr_base(&self) -> &str {
        self.default_pr_base.as_deref().unwrap_or("main")
    }
}