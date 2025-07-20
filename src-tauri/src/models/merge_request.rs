use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequest {
    pub id: i64,
    pub task_attempt_id: String,
    pub provider: String,
    pub mr_id: i64,
    pub mr_iid: i64,
    pub mr_number: i64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub merge_status: Option<String>,
    pub has_conflicts: bool,
    pub pipeline_status: Option<String>,
    pub pipeline_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub merged_at: Option<DateTime<Utc>>,
    pub synced_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
pub struct MergeRequestRow {
    pub id: i64,
    pub task_attempt_id: String,
    pub provider: String,
    pub mr_id: i64,
    pub mr_iid: i64,
    pub mr_number: i64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub merge_status: Option<String>,
    pub has_conflicts: bool,
    pub pipeline_status: Option<String>,
    pub pipeline_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub merged_at: Option<String>,
    pub synced_at: String,
}

impl From<MergeRequestRow> for MergeRequest {
    fn from(row: MergeRequestRow) -> Self {
        Self {
            id: row.id,
            task_attempt_id: row.task_attempt_id,
            provider: row.provider,
            mr_id: row.mr_id,
            mr_iid: row.mr_iid,
            mr_number: row.mr_number,
            title: row.title,
            description: row.description,
            state: row.state,
            source_branch: row.source_branch,
            target_branch: row.target_branch,
            web_url: row.web_url,
            merge_status: row.merge_status,
            has_conflicts: row.has_conflicts,
            pipeline_status: row.pipeline_status,
            pipeline_url: row.pipeline_url,
            created_at: DateTime::parse_from_rfc3339(&row.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            merged_at: row.merged_at.and_then(|s| 
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .ok()
            ),
            synced_at: DateTime::parse_from_rfc3339(&row.synced_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMergeRequestData {
    pub task_attempt_id: String,
    pub provider: String,
    pub mr_id: i64,
    pub mr_iid: i64,
    pub mr_number: i64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub merge_status: Option<String>,
    pub has_conflicts: bool,
    pub pipeline_status: Option<String>,
    pub pipeline_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub merged_at: Option<DateTime<Utc>>,
}