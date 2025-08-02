use std::process::Command;
use crate::utils::command::execute_command;
use std::path::Path;

#[tauri::command]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Try to open with iTerm2 first (if available), then fall back to Terminal.app
        // This respects the user's preference if they have iTerm2 installed
        let iterm_result = Command::new("open")
            .args(&["-a", "iTerm", &path])
            .spawn();
        
        match iterm_result {
            Ok(_) => return Ok(()),
            Err(_) => {
                // iTerm not found, use Terminal.app
                Command::new("open")
                    .args(&["-a", "Terminal", &path])
                    .spawn()
                    .map_err(|e| format!("Failed to open terminal: {}", e))?;
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Try Windows Terminal first
        if let Ok(_) = Command::new("wt")
            .args(&["-d", &path])
            .spawn()
        {
            return Ok(());
        }
        
        // Fall back to cmd
        Command::new("cmd")
            .args(&["/c", "start", "cmd", "/k", "cd", "/d", &path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Use x-terminal-emulator which is the Debian alternatives system
        // Most distros have this symlink pointing to the default terminal
        if let Ok(_) = Command::new("x-terminal-emulator")
            .current_dir(&path)
            .spawn()
        {
            return Ok(());
        }
        
        // Try gnome-terminal as fallback
        Command::new("gnome-terminal")
            .arg("--working-directory")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn show_in_file_manager(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    
    // Validate that the path exists
    if !path.exists() {
        return Err(format!("File or directory does not exist: {}", file_path));
    }
    
    // Ensure the path is absolute and normalized
    let absolute_path = match path.canonicalize() {
        Ok(p) => p,
        Err(e) => return Err(format!("Failed to resolve path: {}", e)),
    };
    
    let file_path_str = absolute_path.to_str()
        .ok_or_else(|| "Invalid UTF-8 in path".to_string())?;
    
    #[cfg(target_os = "macos")]
    {
        // macOS: Use 'open' command with -R flag to reveal in Finder
        match execute_command("open", &["-R", file_path_str], None) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to show in Finder: {}", e)),
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows: Use explorer with /select flag
        match execute_command("explorer", &["/select,", file_path_str], None) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to show in Explorer: {}", e)),
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux: Try common file managers
        // Try nautilus first (GNOME)
        if let Ok(_) = execute_command("nautilus", &["--select", file_path_str], None) {
            return Ok(());
        }
        
        // Try dolphin (KDE)
        if let Ok(_) = execute_command("dolphin", &["--select", file_path_str], None) {
            return Ok(());
        }
        
        // Try thunar (XFCE)
        if let Ok(_) = execute_command("thunar", &[file_path_str], None) {
            return Ok(());
        }
        
        // Fallback to xdg-open on parent directory
        if let Some(parent) = path.parent() {
            match execute_command("xdg-open", &[parent.to_str().unwrap_or(".")], None) {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Failed to open file manager: {}", e)),
            }
        } else {
            Err("Failed to open file manager".to_string())
        }
    }
}