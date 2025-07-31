use std::process::Command;

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