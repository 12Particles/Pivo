use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub type DbPool = Pool<Sqlite>;

pub async fn init_database(app_handle: &AppHandle) -> Result<DbPool, Box<dyn std::error::Error>> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    
    // Create app data directory if it doesn't exist
    std::fs::create_dir_all(&app_dir)?;
    
    let db_path = app_dir.join("pivo.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());
    
    // Create connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;
    
    // Run migrations
    run_migrations(&pool).await?;
    
    Ok(pool)
}

async fn run_migrations(pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    // Read and execute migration files
    let migrations_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations");
    
    // Create migrations table if it doesn't exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;
    
    // Get list of applied migrations
    let applied_migrations: Vec<String> = sqlx::query_scalar("SELECT filename FROM migrations")
        .fetch_all(pool)
        .await?;
    
    // Apply new migrations
    let mut entries: Vec<_> = std::fs::read_dir(migrations_dir)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext == "sql")
                .unwrap_or(false)
        })
        .collect();
    
    entries.sort_by_key(|entry| entry.path());
    
    for entry in entries {
        let filename = entry.file_name().to_string_lossy().to_string();
        
        if !applied_migrations.contains(&filename) {
            let sql = std::fs::read_to_string(entry.path())?;
            
            // Execute migration
            sqlx::raw_sql(&sql).execute(pool).await?;
            
            // Record migration
            sqlx::query("INSERT INTO migrations (filename) VALUES (?)")
                .bind(&filename)
                .execute(pool)
                .await?;
            
            println!("Applied migration: {}", filename);
        }
    }
    
    Ok(())
}