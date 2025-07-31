use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::Mutex;

/// Manages project windows, ensuring each project has its own window
pub struct ProjectWindowManager {
    /// Maps project IDs to window labels
    project_windows: Arc<Mutex<HashMap<String, String>>>,
    app_handle: AppHandle,
}

impl ProjectWindowManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            project_windows: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    /// Opens a window for a project, creating a new one if it doesn't exist
    pub async fn open_project_window(&self, project_id: &str, project_name: &str) -> Result<String, String> {
        let mut windows = self.project_windows.lock().await;
        
        // Check if window already exists for this project
        if let Some(window_label) = windows.get(project_id) {
            // Window exists, bring it to front
            if let Some(window) = self.app_handle.get_webview_window(window_label) {
                window.show().map_err(|e| format!("Failed to show window: {}", e))?;
                window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
                return Ok(window_label.clone());
            } else {
                // Window was closed, remove from map
                windows.remove(project_id);
            }
        }
        
        // Create new window
        let window_label = format!("project-{}", project_id);
        let window_title = format!("Pivo - {}", project_name);
        
        let window = WebviewWindowBuilder::new(
            &self.app_handle,
            &window_label,
            WebviewUrl::App(format!("index.html?projectId={}", project_id).into())
        )
        .title(&window_title)
        .inner_size(1440.0, 900.0)
        .min_inner_size(1200.0, 700.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;
        
        // Store project ID in window state for later retrieval
        window.eval(&format!(
            "window.__TAURI_PROJECT_ID__ = '{}';", 
            project_id
        )).map_err(|e| format!("Failed to set project ID: {}", e))?;
        
        // Listen for window close events to clean up tracking
        let windows_clone = self.project_windows.clone();
        let project_id_clone = project_id.to_string();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event {
                let windows = windows_clone.clone();
                let project_id_to_remove = project_id_clone.clone();
                tauri::async_runtime::spawn(async move {
                    let mut windows = windows.lock().await;
                    windows.remove(&project_id_to_remove);
                });
            }
        });
        
        // Add to tracking map
        windows.insert(project_id.to_string(), window_label.clone());
        
        Ok(window_label)
    }
    
    /// Closes a project window
    pub async fn close_project_window(&self, project_id: &str) -> Result<(), String> {
        let mut windows = self.project_windows.lock().await;
        
        if let Some(window_label) = windows.remove(project_id) {
            if let Some(window) = self.app_handle.get_webview_window(&window_label) {
                window.close().map_err(|e| format!("Failed to close window: {}", e))?;
            }
        }
        
        Ok(())
    }
    
    /// Gets the window label for a project
    pub async fn get_project_window(&self, project_id: &str) -> Option<String> {
        let windows = self.project_windows.lock().await;
        windows.get(project_id).cloned()
    }
    
    /// Lists all open project windows
    pub async fn list_open_projects(&self) -> Vec<(String, String)> {
        let windows = self.project_windows.lock().await;
        windows.iter().map(|(id, label)| (id.clone(), label.clone())).collect()
    }
    
    /// Cleanup closed windows from tracking
    pub async fn cleanup_closed_windows(&self) {
        let mut windows = self.project_windows.lock().await;
        let mut to_remove = Vec::new();
        
        for (project_id, window_label) in windows.iter() {
            if self.app_handle.get_webview_window(window_label).is_none() {
                to_remove.push(project_id.clone());
            }
        }
        
        for project_id in to_remove {
            windows.remove(&project_id);
        }
    }
}