use crate::models::{MergeRequest, MergeRequestRow, CreateMergeRequestData};
use sqlx::SqlitePool;

pub struct MergeRequestService {
    pool: SqlitePool,
}

impl MergeRequestService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create_merge_request(&self, data: CreateMergeRequestData) -> Result<MergeRequest, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.acquire().await?;

        let query = r#"
            INSERT INTO merge_requests (
                task_attempt_id, provider, mr_id, mr_iid, mr_number,
                title, description, state, source_branch, target_branch,
                web_url, merge_status, has_conflicts, pipeline_status, pipeline_url,
                created_at, updated_at, merged_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(&data.task_attempt_id)
            .bind(&data.provider)
            .bind(data.mr_id)
            .bind(data.mr_iid)
            .bind(data.mr_number)
            .bind(&data.title)
            .bind(&data.description)
            .bind(&data.state)
            .bind(&data.source_branch)
            .bind(&data.target_branch)
            .bind(&data.web_url)
            .bind(&data.merge_status)
            .bind(data.has_conflicts)
            .bind(&data.pipeline_status)
            .bind(&data.pipeline_url)
            .bind(data.created_at.to_rfc3339())
            .bind(data.updated_at.to_rfc3339())
            .bind(data.merged_at.map(|dt| dt.to_rfc3339()))
            .execute(&mut *conn)
            .await?;

        let mr_row = sqlx::query_as::<_, MergeRequestRow>(
            "SELECT * FROM merge_requests WHERE provider = ? AND mr_id = ?"
        )
        .bind(&data.provider)
        .bind(data.mr_id)
        .fetch_one(&mut *conn)
        .await?;

        Ok(mr_row.into())
    }

    pub async fn update_merge_request(&self, mr_id: i64, data: CreateMergeRequestData) -> Result<MergeRequest, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.acquire().await?;

        let query = r#"
            UPDATE merge_requests SET
                title = ?, description = ?, state = ?, 
                merge_status = ?, has_conflicts = ?, 
                pipeline_status = ?, pipeline_url = ?,
                updated_at = ?, merged_at = ?, synced_at = CURRENT_TIMESTAMP
            WHERE id = ?
        "#;

        sqlx::query(query)
            .bind(&data.title)
            .bind(&data.description)
            .bind(&data.state)
            .bind(&data.merge_status)
            .bind(data.has_conflicts)
            .bind(&data.pipeline_status)
            .bind(&data.pipeline_url)
            .bind(data.updated_at.to_rfc3339())
            .bind(data.merged_at.map(|dt| dt.to_rfc3339()))
            .bind(mr_id)
            .execute(&mut *conn)
            .await?;

        let mr_row = sqlx::query_as::<_, MergeRequestRow>(
            "SELECT * FROM merge_requests WHERE id = ?"
        )
        .bind(mr_id)
        .fetch_one(&mut *conn)
        .await?;

        Ok(mr_row.into())
    }

    pub async fn get_merge_request_by_provider_id(&self, provider: &str, mr_id: i64) -> Result<Option<MergeRequest>, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.acquire().await?;

        let mr_row = sqlx::query_as::<_, MergeRequestRow>(
            "SELECT * FROM merge_requests WHERE provider = ? AND mr_id = ?"
        )
        .bind(provider)
        .bind(mr_id)
        .fetch_optional(&mut *conn)
        .await?;

        Ok(mr_row.map(Into::into))
    }

    pub async fn get_merge_requests_by_attempt(&self, task_attempt_id: &str) -> Result<Vec<MergeRequest>, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.acquire().await?;

        let rows = sqlx::query_as::<_, MergeRequestRow>(
            "SELECT * FROM merge_requests WHERE task_attempt_id = ? ORDER BY created_at DESC"
        )
        .bind(task_attempt_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn get_merge_requests_by_task(&self, task_id: &str) -> Result<Vec<MergeRequest>, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.acquire().await?;

        let rows = sqlx::query_as::<_, MergeRequestRow>(
            r#"
            SELECT mr.* FROM merge_requests mr
            JOIN task_attempts ta ON mr.task_attempt_id = ta.id
            WHERE ta.task_id = ?
            ORDER BY mr.created_at DESC
            "#
        )
        .bind(task_id)
        .fetch_all(&mut *conn)
        .await?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn get_active_merge_requests(&self, provider: Option<&str>) -> Result<Vec<MergeRequest>, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.acquire().await?;

        let query = if let Some(provider) = provider {
            sqlx::query_as::<_, MergeRequestRow>(
                "SELECT * FROM merge_requests WHERE provider = ? AND state = 'opened' ORDER BY updated_at DESC"
            )
            .bind(provider)
        } else {
            sqlx::query_as::<_, MergeRequestRow>(
                "SELECT * FROM merge_requests WHERE state = 'opened' ORDER BY updated_at DESC"
            )
        };

        let rows = query.fetch_all(&mut *conn).await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn sync_merge_request_from_api(&self, provider: &str, mr_id: i64, api_data: CreateMergeRequestData) -> Result<MergeRequest, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(existing) = self.get_merge_request_by_provider_id(provider, mr_id).await? {
            self.update_merge_request(existing.id, api_data).await
        } else {
            self.create_merge_request(api_data).await
        }
    }

    pub async fn get_open_merge_requests(&self) -> Result<Vec<MergeRequest>, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.acquire().await?;
        
        let rows = sqlx::query_as::<_, MergeRequestRow>(
            "SELECT * FROM merge_requests WHERE state IN ('opened', 'open') ORDER BY created_at DESC"
        )
        .fetch_all(&mut *conn)
        .await?;
        
        Ok(rows.into_iter().map(Into::into).collect())
    }
}