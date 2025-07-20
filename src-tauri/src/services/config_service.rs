use tauri::{AppHandle, Manager};
use crate::models::{AppConfig, GitLabConfig, GitHubConfig};
use sqlx::SqlitePool;

pub struct ConfigService {
    pool: SqlitePool,
    config: AppConfig,
}

impl ConfigService {
    pub fn new(pool: SqlitePool) -> Self {
        // For now, use in-memory config
        // TODO: Store config in database
        Self {
            pool,
            config: AppConfig::default(),
        }
    }
    
    pub fn from_app_handle(app_handle: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let app_dir = app_handle
            .path()
            .app_config_dir()
            .expect("Failed to get app config directory");
        
        // Create config directory if it doesn't exist
        std::fs::create_dir_all(&app_dir)?;
        
        let config_path = app_dir.join("config.json");
        
        // Load existing config or create default
        let _config = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            AppConfig::default()
        };
        
        // TODO: Get pool from somewhere
        unimplemented!("Need to get pool from app state")
    }
    
    pub fn get_config(&self) -> &AppConfig {
        &self.config
    }
    
    pub fn get_gitlab_config(&self) -> Option<&GitLabConfig> {
        self.config.gitlab.as_ref()
    }
    
    pub fn get_github_config(&self) -> Option<&GitHubConfig> {
        self.config.github.as_ref()
    }
    
    pub async fn update_gitlab_config(&mut self, gitlab_config: GitLabConfig) -> Result<(), Box<dyn std::error::Error>> {
        self.config.gitlab = Some(gitlab_config);
        self.save_to_db("gitlab_config", &serde_json::to_string(&self.config.gitlab)?).await?;
        Ok(())
    }
    
    pub async fn update_github_config(&mut self, github_config: GitHubConfig) -> Result<(), Box<dyn std::error::Error>> {
        self.config.github = Some(github_config);
        self.save_to_db("github_config", &serde_json::to_string(&self.config.github)?).await?;
        Ok(())
    }
    
    async fn save_to_db(&self, key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.pool.acquire().await?;
        
        sqlx::query(
            "INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(key)
        .bind(value)
        .execute(&mut *conn)
        .await?;
        
        Ok(())
    }
    
    pub async fn load_from_db(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.pool.acquire().await?;
        
        // Load GitLab config
        if let Ok(row) = sqlx::query_as::<_, (String,)>(
            "SELECT value FROM app_config WHERE key = 'gitlab_config'"
        )
        .fetch_one(&mut *conn)
        .await
        {
            if let Ok(gitlab_config) = serde_json::from_str::<GitLabConfig>(&row.0) {
                self.config.gitlab = Some(gitlab_config);
            }
        }
        
        // Load GitHub config
        if let Ok(row) = sqlx::query_as::<_, (String,)>(
            "SELECT value FROM app_config WHERE key = 'github_config'"
        )
        .fetch_one(&mut *conn)
        .await
        {
            if let Ok(github_config) = serde_json::from_str::<GitHubConfig>(&row.0) {
                self.config.github = Some(github_config);
            }
        }
        
        Ok(())
    }
}