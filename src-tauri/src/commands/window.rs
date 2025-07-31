use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};
use crate::AppState;

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

#[tauri::command]
pub async fn open_project_window(
    project_id: String,
    project_name: String,
    state: State<'_, AppState>
) -> Result<String, String> {
    state.window_manager.open_project_window(&project_id, &project_name).await
}

#[tauri::command]
pub async fn close_project_window(
    project_id: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    state.window_manager.close_project_window(&project_id).await
}

#[tauri::command]
pub async fn get_project_window(
    project_id: String,
    state: State<'_, AppState>
) -> Result<Option<String>, String> {
    Ok(state.window_manager.get_project_window(&project_id).await)
}

#[tauri::command]
pub async fn list_open_project_windows(
    state: State<'_, AppState>
) -> Result<Vec<(String, String)>, String> {
    Ok(state.window_manager.list_open_projects().await)
}