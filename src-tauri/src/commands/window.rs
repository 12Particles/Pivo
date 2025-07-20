use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn show_log_viewer(app: tauri::AppHandle) -> Result<(), String> {
    // Check if log viewer window already exists
    if let Some(window) = app.get_webview_window("log-viewer") {
        // If it exists, focus it
        window.show().map_err(|e| format!("Failed to show window: {}", e))?;
        window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
    } else {
        // Create new log viewer window
        WebviewWindowBuilder::new(
            &app,
            "log-viewer",
            WebviewUrl::App("log-viewer.html".into())
        )
        .title("Pivo - Log Viewer")
        .inner_size(900.0, 700.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("Failed to create log viewer window: {}", e))?;
    }
    
    Ok(())
}