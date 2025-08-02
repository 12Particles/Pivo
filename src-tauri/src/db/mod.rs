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
    match MIGRATOR.run(&pool).await {
        Ok(_) => {
            log::info!("Database migrations completed successfully");
            Ok(pool)
        }
        Err(e) => {
            log::error!("Database migration failed: {}", e);
            
            // Close the connection pool
            pool.close().await;
            
            // Delete the database file
            if db_path.exists() {
                log::warn!("Removing corrupted database file: {:?}", db_path);
                if let Err(remove_err) = std::fs::remove_file(&db_path) {
                    log::error!("Failed to remove database file: {}", remove_err);
                    return Err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Migration failed and couldn't remove database: {}", e)
                    )));
                }
                
                // Try to recreate the database
                log::info!("Attempting to recreate database...");
                let new_pool = SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect(&db_url)
                    .await?;
                
                // Try migrations again
                match MIGRATOR.run(&new_pool).await {
                    Ok(_) => {
                        log::info!("Database recreated and migrations completed successfully");
                        Ok(new_pool)
                    }
                    Err(retry_err) => {
                        log::error!("Failed to recreate database: {}", retry_err);
                        Err(Box::new(retry_err))
                    }
                }
            } else {
                Err(Box::new(e))
            }
        }
    }
}