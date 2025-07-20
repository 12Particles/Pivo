use crate::logging::get_log_file_path;
use std::fs;

#[tauri::command]
pub async fn get_log_content(
    lines: Option<usize>,
) -> Result<String, String> {
    let log_path = get_log_file_path();
    
    if !log_path.exists() {
        return Ok("No log file found".to_string());
    }
    
    let content = fs::read_to_string(&log_path)
        .map_err(|e| format!("Failed to read log file: {}", e))?;
    
    // If lines is specified, return only the last N lines
    if let Some(n) = lines {
        let lines: Vec<&str> = content.lines().collect();
        let start = lines.len().saturating_sub(n);
        Ok(lines[start..].join("\n"))
    } else {
        Ok(content)
    }
}

#[tauri::command]
pub async fn get_log_path() -> Result<String, String> {
    Ok(get_log_file_path().to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_log_file(_app_handle: tauri::AppHandle) -> Result<(), String> {
    let log_path = get_log_file_path();
    
    // Open the log file in the default text editor
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-t") // Open with default text editor
            .arg(&log_path)
            .spawn()
            .map_err(|e| format!("Failed to open log file: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("notepad")
            .arg(&log_path)
            .spawn()
            .map_err(|e| format!("Failed to open log file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&log_path)
            .spawn()
            .map_err(|e| format!("Failed to open log file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn clear_logs() -> Result<(), String> {
    let log_path = get_log_file_path();
    
    if log_path.exists() {
        fs::write(&log_path, "")
            .map_err(|e| format!("Failed to clear log file: {}", e))?;
    }
    
    log::info!("Logs cleared");
    Ok(())
}