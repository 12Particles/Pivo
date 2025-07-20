use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAttempt {
    pub id: String,
    pub task_id: String,
    pub worktree_path: String,
    pub branch: String,
    pub base_branch: String,
    pub base_commit: Option<String>,
    pub executor: Option<String>,
    pub status: AttemptStatus,
    pub last_sync_commit: Option<String>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub claude_session_id: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct TaskAttemptRow {
    pub id: String,
    pub task_id: String,
    pub worktree_path: String,
    pub branch: String,
    pub base_branch: String,
    pub base_commit: Option<String>,
    pub executor: Option<String>,
    pub status: String,
    pub last_sync_commit: Option<String>,
    pub last_sync_at: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub claude_session_id: Option<String>,
}

impl From<TaskAttemptRow> for TaskAttempt {
    fn from(row: TaskAttemptRow) -> Self {
        Self {
            id: row.id,
            task_id: row.task_id,
            worktree_path: row.worktree_path,
            branch: row.branch,
            base_branch: row.base_branch,
            base_commit: row.base_commit,
            executor: row.executor,
            status: serde_json::from_str(&format!("\"{}\"", row.status))
                .unwrap_or(AttemptStatus::Failed),
            last_sync_commit: row.last_sync_commit,
            last_sync_at: row.last_sync_at.and_then(|s| 
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .ok()
            ),
            created_at: DateTime::parse_from_rfc3339(&row.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            completed_at: row.completed_at.and_then(|s| 
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .ok()
            ),
            claude_session_id: row.claude_session_id,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum AttemptStatus {
    Running,
    Success,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskAttemptRequest {
    pub task_id: Uuid,
    pub executor: Option<String>,
    pub base_branch: Option<String>,
}