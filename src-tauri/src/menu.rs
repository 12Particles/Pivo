use tauri::Emitter;

pub fn setup_menu_events(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // For now, we'll use keyboard shortcuts and emit events from frontend
    // The menu API in Tauri v2 is quite different and complex
    
    log::info!("Menu events setup complete");
    Ok(())
}

// Helper function to emit log viewer event
pub fn emit_view_logs(app_handle: &tauri::AppHandle) {
    app_handle.emit("menu-view-logs", ()).unwrap();
}

// Helper function to clear logs
pub fn emit_clear_logs(app_handle: &tauri::AppHandle) {
    if let Err(e) = clear_logs() {
        log::error!("Failed to clear logs: {}", e);
    } else {
        app_handle.emit("menu-logs-cleared", ()).unwrap();
    }
}

fn clear_logs() -> Result<(), Box<dyn std::error::Error>> {
    let log_path = crate::logging::get_log_file_path();
    if log_path.exists() {
        std::fs::write(&log_path, "")?;
    }
    log::info!("Logs cleared");
    Ok(())
}