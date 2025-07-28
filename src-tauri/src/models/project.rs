use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub git_repo: Option<String>,
    pub git_provider: Option<String>, // "github" or "gitlab"
    pub setup_script: Option<String>,
    pub dev_script: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_opened: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub git_repo: Option<String>,
    pub git_provider: Option<String>,
    pub setup_script: Option<String>,
    pub dev_script: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened: Option<String>,
}

impl From<ProjectRow> for Project {
    fn from(row: ProjectRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            description: row.description,
            path: row.path,
            git_repo: row.git_repo,
            git_provider: row.git_provider,
            setup_script: row.setup_script,
            dev_script: row.dev_script,
            created_at: DateTime::parse_from_rfc3339(&row.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            last_opened: row.last_opened.and_then(|lo| {
                DateTime::parse_from_rfc3339(&lo)
                    .map(|dt| dt.with_timezone(&Utc))
                    .ok()
            }),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub git_repo: Option<String>,
    pub setup_script: Option<String>,
    pub dev_script: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub path: Option<String>,
    pub git_repo: Option<String>,
    pub setup_script: Option<String>,
    pub dev_script: Option<String>,
}