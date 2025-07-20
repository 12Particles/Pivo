use crate::db::DbPool;
use crate::models::{CreateProjectRequest, Project, UpdateProjectRequest};
use uuid::Uuid;

pub struct ProjectService {
    pool: DbPool,
}

impl ProjectService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn create_project(&self, req: CreateProjectRequest) -> Result<Project, sqlx::Error> {
        let id = Uuid::new_v4();
        
        // Auto-detect git provider from git_repo URL
        let git_provider = req.git_repo.as_ref().map(|url| {
            if url.contains("github.com") {
                "github".to_string()
            } else {
                "gitlab".to_string()
            }
        });

        sqlx::query(
            r#"
            INSERT INTO projects (id, name, description, path, git_repo, git_provider, setup_script, dev_script, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            "#,
        )
        .bind(id.to_string())
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.path)
        .bind(&req.git_repo)
        .bind(&git_provider)
        .bind(&req.setup_script)
        .bind(&req.dev_script)
        .execute(&self.pool)
        .await?;

        self.get_project(id).await.map(|opt| opt.unwrap())
    }

    pub async fn get_project(&self, id: Uuid) -> Result<Option<Project>, sqlx::Error> {
        use crate::models::ProjectRow;
        
        let row = sqlx::query_as::<_, ProjectRow>(
            "SELECT * FROM projects WHERE id = ?",
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Project::from))
    }

    pub async fn list_projects(&self) -> Result<Vec<Project>, sqlx::Error> {
        use crate::models::ProjectRow;
        
        let rows = sqlx::query_as::<_, ProjectRow>(
            "SELECT * FROM projects ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(Project::from).collect())
    }

    pub async fn update_project(&self, id: Uuid, req: UpdateProjectRequest) -> Result<Project, sqlx::Error> {
        let mut update_parts = vec!["updated_at = datetime('now')"];
        let mut params: Vec<String> = vec![];

        if let Some(name) = &req.name {
            update_parts.push("name = ?");
            params.push(name.clone());
        }

        if let Some(description) = &req.description {
            update_parts.push("description = ?");
            params.push(description.clone());
        }

        if let Some(path) = &req.path {
            update_parts.push("path = ?");
            params.push(path.clone());
        }

        if let Some(git_repo) = &req.git_repo {
            update_parts.push("git_repo = ?");
            params.push(git_repo.clone());
            
            // Auto-detect and update git provider when git_repo changes
            let git_provider = if git_repo.contains("github.com") {
                "github".to_string()
            } else {
                "gitlab".to_string()
            };
            update_parts.push("git_provider = ?");
            params.push(git_provider);
        }

        if let Some(setup_script) = &req.setup_script {
            update_parts.push("setup_script = ?");
            params.push(setup_script.clone());
        }

        if let Some(dev_script) = &req.dev_script {
            update_parts.push("dev_script = ?");
            params.push(dev_script.clone());
        }

        let query = format!(
            "UPDATE projects SET {} WHERE id = ?",
            update_parts.join(", ")
        );
        params.push(id.to_string());

        let mut q = sqlx::query(&query);
        for param in params {
            q = q.bind(param);
        }

        q.execute(&self.pool).await?;
        
        self.get_project(id).await.map(|opt| opt.unwrap())
    }

    pub async fn delete_project(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}