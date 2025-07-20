use crate::db::DbPool;
use crate::models::{
    CreateTaskRequest, Task, TaskStatus, UpdateTaskRequest,
    CreateTaskAttemptRequest, TaskAttempt, TaskAttemptRow, AttemptStatus,
};
use crate::commands::task_attempts::{AttemptConversation, ConversationMessage};
use crate::services::git_service::GitService;
use uuid::Uuid;
use std::path::Path;

pub struct TaskService {
    pool: DbPool,
}

impl TaskService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn create_task(&self, req: CreateTaskRequest) -> Result<Task, sqlx::Error> {
        let id = Uuid::new_v4();
        let tags_json = req.tags.map(|t| serde_json::to_string(&t).unwrap_or_default());

        sqlx::query(
            r#"
            INSERT INTO tasks (id, project_id, title, description, status, priority, parent_task_id, assignee, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            "#,
        )
        .bind(id.to_string())
        .bind(req.project_id.to_string())
        .bind(&req.title)
        .bind(&req.description)
        .bind("Backlog")
        .bind(format!("{:?}", req.priority))
        .bind(req.parent_task_id.map(|id| id.to_string()))
        .bind(&req.assignee)
        .bind(&tags_json)
        .execute(&self.pool)
        .await?;

        self.get_task(id).await.map(|opt| opt.unwrap())
    }

    pub async fn get_task(&self, id: Uuid) -> Result<Option<Task>, sqlx::Error> {
        use crate::models::TaskRow;
        
        let row = sqlx::query_as::<_, TaskRow>(
            "SELECT * FROM tasks WHERE id = ?",
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Task::from))
    }

    pub async fn list_tasks(&self, project_id: Uuid) -> Result<Vec<Task>, sqlx::Error> {
        use crate::models::TaskRow;
        
        let rows = sqlx::query_as::<_, TaskRow>(
            "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(Task::from).collect())
    }

    pub async fn update_task(&self, id: Uuid, req: UpdateTaskRequest) -> Result<Task, sqlx::Error> {
        let mut update_parts = vec!["updated_at = datetime('now')"];
        let mut params: Vec<String> = vec![];

        if let Some(title) = &req.title {
            update_parts.push("title = ?");
            params.push(title.clone());
        }

        if let Some(description) = &req.description {
            update_parts.push("description = ?");
            params.push(description.clone());
        }

        if let Some(status) = &req.status {
            update_parts.push("status = ?");
            params.push(format!("{:?}", status).to_lowercase());
        }

        if let Some(priority) = &req.priority {
            update_parts.push("priority = ?");
            params.push(format!("{:?}", priority).to_lowercase());
        }

        if let Some(assignee) = &req.assignee {
            update_parts.push("assignee = ?");
            params.push(assignee.clone());
        }

        if let Some(tags) = &req.tags {
            update_parts.push("tags = ?");
            params.push(serde_json::to_string(tags).unwrap());
        }

        let query = format!(
            "UPDATE tasks SET {} WHERE id = ?",
            update_parts.join(", ")
        );
        params.push(id.to_string());

        let mut q = sqlx::query(&query);
        for param in params {
            q = q.bind(param);
        }
        
        q.execute(&self.pool).await?;
        
        self.get_task(id).await.map(|opt| opt.unwrap())
    }

    pub async fn delete_task(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn update_task_status(&self, id: Uuid, status: TaskStatus) -> Result<Task, sqlx::Error> {
        sqlx::query(
            "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(format!("{:?}", status))
        .bind(id.to_string())
        .execute(&self.pool)
        .await?;

        self.get_task(id).await.map(|opt| opt.unwrap())
    }

    // Task Attempt methods
    pub async fn create_task_attempt(&self, req: CreateTaskAttemptRequest) -> Result<TaskAttempt, sqlx::Error> {
        let id = Uuid::new_v4();
        let task_id = req.task_id.to_string();
        
        // Get the task to find its project
        let task = self.get_task(req.task_id).await?
            .ok_or_else(|| sqlx::Error::RowNotFound)?;
        
        // Get project path
        let project_row: (String,) = sqlx::query_as(
            "SELECT path FROM projects WHERE id = ?"
        )
        .bind(task.project_id.to_string())
        .fetch_one(&self.pool)
        .await?;
        
        let project_path = project_row.0;
        
        // Create a unique branch name for this attempt
        let branch = format!("task-{}-{}", task_id, id.to_string().split('-').next().unwrap());
        let base_branch = req.base_branch.unwrap_or_else(|| "main".to_string());
        
        // Create worktree with baseline tracking
        let git_service = GitService::new();
        let worktree_info = git_service.create_worktree_with_baseline(
            Path::new(&project_path),
            &branch,
            &base_branch,
        ).map_err(|e| sqlx::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        
        // Insert into database with base commit
        sqlx::query(
            r#"
            INSERT INTO task_attempts (id, task_id, worktree_path, branch, base_branch, base_commit, executor, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            "#,
        )
        .bind(id.to_string())
        .bind(task_id)
        .bind(&worktree_info.path)
        .bind(&worktree_info.branch)
        .bind(&worktree_info.base_branch)
        .bind(&worktree_info.base_commit)
        .bind(&req.executor)
        .bind("running")
        .execute(&self.pool)
        .await?;

        self.get_task_attempt(id).await.map(|opt| opt.unwrap())
    }
    
    pub async fn get_task_attempt(&self, id: Uuid) -> Result<Option<TaskAttempt>, sqlx::Error> {
        let row = sqlx::query_as::<_, TaskAttemptRow>(
            "SELECT * FROM task_attempts WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(row.map(TaskAttempt::from))
    }
    
    pub async fn list_task_attempts(&self, task_id: Uuid) -> Result<Vec<TaskAttempt>, sqlx::Error> {
        let rows = sqlx::query_as::<_, TaskAttemptRow>(
            "SELECT * FROM task_attempts WHERE task_id = ? ORDER BY created_at DESC"
        )
        .bind(task_id.to_string())
        .fetch_all(&self.pool)
        .await?;
        
        Ok(rows.into_iter().map(TaskAttempt::from).collect())
    }
    
    pub async fn update_attempt_status(&self, id: Uuid, status: AttemptStatus) -> Result<TaskAttempt, sqlx::Error> {
        let completed_at = match status {
            AttemptStatus::Success | AttemptStatus::Failed | AttemptStatus::Cancelled => {
                Some("datetime('now')")
            },
            _ => None
        };
        
        if let Some(completed_at_val) = completed_at {
            sqlx::query(&format!(
                "UPDATE task_attempts SET status = ?, completed_at = {} WHERE id = ?",
                completed_at_val
            ))
            .bind(format!("{:?}", status).to_lowercase())
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;
        } else {
            sqlx::query(
                "UPDATE task_attempts SET status = ? WHERE id = ?"
            )
            .bind(format!("{:?}", status).to_lowercase())
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;
        }
        
        self.get_task_attempt(id).await.map(|opt| opt.unwrap())
    }
    
    pub async fn save_attempt_conversation(&self, attempt_id: Uuid, messages: Vec<ConversationMessage>) -> Result<AttemptConversation, sqlx::Error> {
        let conversation_id = Uuid::new_v4();
        let messages_json = serde_json::to_string(&messages)
            .map_err(|e| sqlx::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        
        // Check if conversation already exists
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM attempt_conversations WHERE task_attempt_id = ?"
        )
        .bind(attempt_id.to_string())
        .fetch_optional(&self.pool)
        .await?;
        
        if let Some((existing_id,)) = existing {
            // Update existing conversation
            sqlx::query(
                "UPDATE attempt_conversations SET messages = ?, updated_at = datetime('now') WHERE id = ?"
            )
            .bind(&messages_json)
            .bind(&existing_id)
            .execute(&self.pool)
            .await?;
            
            self.get_attempt_conversation(attempt_id).await.map(|opt| opt.unwrap())
        } else {
            // Create new conversation
            sqlx::query(
                r#"
                INSERT INTO attempt_conversations (id, task_attempt_id, messages, created_at, updated_at)
                VALUES (?, ?, ?, datetime('now'), datetime('now'))
                "#
            )
            .bind(conversation_id.to_string())
            .bind(attempt_id.to_string())
            .bind(&messages_json)
            .execute(&self.pool)
            .await?;
            
            self.get_attempt_conversation(attempt_id).await.map(|opt| opt.unwrap())
        }
    }
    
    pub async fn get_attempt_conversation(&self, attempt_id: Uuid) -> Result<Option<AttemptConversation>, sqlx::Error> {
        let row: Option<(String, String, String, String, String)> = sqlx::query_as(
            "SELECT id, task_attempt_id, messages, created_at, updated_at FROM attempt_conversations WHERE task_attempt_id = ?"
        )
        .bind(attempt_id.to_string())
        .fetch_optional(&self.pool)
        .await?;
        
        if let Some((id, task_attempt_id, messages_json, created_at, updated_at)) = row {
            let messages: Vec<ConversationMessage> = serde_json::from_str(&messages_json)
                .map_err(|e| sqlx::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
            
            Ok(Some(AttemptConversation {
                id,
                task_attempt_id,
                messages,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }
}