use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, migrate::Migrator};
use tauri::{AppHandle, Manager};

pub type DbPool = Pool<Sqlite>;

// Embed migrations at compile time
static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub async fn init_database(app_handle: &AppHandle) -> Result<DbPool, Box<dyn std::error::Error>> {
    let app_dir = app_handle
        .path()
        .app_data_dir()?;
    
    // Create app data directory if it doesn't exist
    std::fs::create_dir_all(&app_dir)?;
    
    let db_path = app_dir.join("pivo.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());
    
    // Create connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;
    
    // Run embedded migrations using SQLx's standard approach
    MIGRATOR.run(&pool).await?;
    
    Ok(pool)
}