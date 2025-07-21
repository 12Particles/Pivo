use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionProcess {
    pub id: String,
    pub task_attempt_id: String,
    pub process_type: ProcessType,
    pub executor_type: Option<String>,
    pub status: ProcessStatus,
    pub command: String,
    pub args: Option<String>,
    pub working_directory: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
pub struct ExecutionProcessRow {
    pub id: String,
    pub task_attempt_id: String,
    pub process_type: String,
    pub executor_type: Option<String>,
    pub status: String,
    pub command: String,
    pub args: Option<String>,
    pub working_directory: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

impl From<ExecutionProcessRow> for ExecutionProcess {
    fn from(row: ExecutionProcessRow) -> Self {
        Self {
            id: row.id,
            task_attempt_id: row.task_attempt_id,
            process_type: serde_json::from_str(&format!("\"{}\"", row.process_type))
                .unwrap_or(ProcessType::Terminal),
            executor_type: row.executor_type,
            status: serde_json::from_str(&format!("\"{}\"", row.status))
                .unwrap_or(ProcessStatus::Failed),
            command: row.command,
            args: row.args,
            working_directory: row.working_directory,
            stdout: row.stdout,
            stderr: row.stderr,
            exit_code: row.exit_code,
            started_at: DateTime::parse_from_rfc3339(&row.started_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            completed_at: row.completed_at.and_then(|s| 
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .ok()
            ),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ProcessType {
    SetupScript,
    CodingAgent,
    DevServer,
    Terminal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Running,
    Completed,
    Failed,
    Killed,
}

// ProcessOutput struct removed as it's not being used