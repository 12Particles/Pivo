use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct DevServerManager {
    processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl DevServerManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub async fn start_dev_server(
    app_handle: AppHandle,
    dev_manager: State<'_, DevServerManager>,
    project_path: String,
    command: String,
) -> Result<serde_json::Value, String> {
    // Generate a unique process ID
    let process_id = Uuid::new_v4().to_string();
    
    // For complex commands like 'pnpm tauri dev', we need to run them through a shell
    // This ensures that npm/pnpm/yarn scripts work correctly
    let mut cmd;
    
    #[cfg(target_os = "windows")]
    {
        cmd = Command::new("cmd");
        cmd.args(&["/C", &command]);
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        cmd = Command::new("sh");
        cmd.args(&["-c", &command]);
        
        // On macOS, ensure we have access to user's PATH
        #[cfg(target_os = "macos")]
        {
            // Get the user's shell PATH for better compatibility
            if let Ok(output) = std::process::Command::new("sh")
                .args(&["-l", "-c", "echo $PATH"])
                .output()
            {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    cmd.env("PATH", path.trim());
                }
            } else if let Ok(path) = std::env::var("PATH") {
                let homebrew_path = "/opt/homebrew/bin:/usr/local/bin";
                let full_path = format!("{}:{}", homebrew_path, path);
                cmd.env("PATH", full_path);
            }
        }
    }
    
    cmd.current_dir(&project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .kill_on_drop(true);
    
    // Spawn the process
    eprintln!("[DEV_SERVER] About to spawn command: {}", command);
    let mut child = cmd.spawn().map_err(|e| format!("Failed to start dev server: {}", e))?;
    
    let pid = child.id().unwrap_or(0);
    eprintln!("[DEV_SERVER] Process spawned successfully with PID: {}", pid);
    let proc_id = process_id.clone();
    let app = app_handle.clone();
    
    // Handle stdout
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let proc_id = proc_id.clone();
        let app = app.clone();
        
        tokio::spawn(async move {
            let mut lines = reader.lines();
            eprintln!("[DEV_SERVER] Started stdout reader for process {}", proc_id);
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[DEV_SERVER] STDOUT: {}", line);
                let emit_result = app.emit("dev-server-output", serde_json::json!({
                    "process_id": proc_id,
                    "type": "stdout",
                    "data": line
                }));
                if let Err(e) = emit_result {
                    eprintln!("[DEV_SERVER] Failed to emit stdout: {}", e);
                }
            }
            eprintln!("[DEV_SERVER] STDOUT reader ended for process {}", proc_id);
        });
    }
    
    // Handle stderr
    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let proc_id = proc_id.clone();
        let app = app.clone();
        
        tokio::spawn(async move {
            let mut lines = reader.lines();
            eprintln!("[DEV_SERVER] Started stderr reader for process {}", proc_id);
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[DEV_SERVER] STDERR: {}", line);
                let emit_result = app.emit("dev-server-output", serde_json::json!({
                    "process_id": proc_id,
                    "type": "stderr",
                    "data": line
                }));
                if let Err(e) = emit_result {
                    eprintln!("[DEV_SERVER] Failed to emit stderr: {}", e);
                }
            }
            eprintln!("[DEV_SERVER] STDERR reader ended for process {}", proc_id);
        });
    }
    
    // Store the child process first
    let mut processes = dev_manager.processes.lock().await;
    processes.insert(process_id.clone(), child);
    drop(processes); // Release the lock
    
    // Monitor process completion
    let proc_id_monitor = process_id.clone();
    let app_monitor = app_handle.clone();
    let manager = dev_manager.processes.clone();
    
    tokio::spawn(async move {
        // Wait a bit to ensure the process is properly started
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        loop {
            // Check if process still exists
            let should_wait = {
                let processes = manager.lock().await;
                processes.contains_key(&proc_id_monitor)
            };
            
            if !should_wait {
                break;
            }
            
            // Check process status
            let mut processes = manager.lock().await;
            if let Some(child) = processes.get_mut(&proc_id_monitor) {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        // Process has exited
                        let exit_code = status.code();
                        processes.remove(&proc_id_monitor);
                        let _ = app_monitor.emit("dev-server-stopped", serde_json::json!({
                            "process_id": proc_id_monitor,
                            "exit_code": exit_code
                        }));
                        break;
                    }
                    Ok(None) => {
                        // Process is still running
                        drop(processes);
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    }
                    Err(e) => {
                        eprintln!("Error checking process status: {}", e);
                        processes.remove(&proc_id_monitor);
                        let _ = app_monitor.emit("dev-server-stopped", serde_json::json!({
                            "process_id": proc_id_monitor
                        }));
                        break;
                    }
                }
            } else {
                break;
            }
        }
    });
    
    Ok(serde_json::json!({
        "process_id": process_id,
        "pid": pid
    }))
}

#[tauri::command]
pub async fn stop_dev_server(
    app_handle: AppHandle,
    dev_manager: State<'_, DevServerManager>,
    process_id: String,
) -> Result<(), String> {
    let mut processes = dev_manager.processes.lock().await;
    
    if let Some(mut child) = processes.remove(&process_id) {
        // Try to kill the process and all its children
        // For shell-spawned processes, we need to be more aggressive
        
        #[cfg(unix)]
        {
            if let Some(pid) = child.id() {
                unsafe {
                    // First, try to kill the process group
                    // The shell typically creates a new process group
                    let pgid = pid as i32;
                    
                    // Send SIGTERM to the process itself
                    libc::kill(pgid, libc::SIGTERM);
                    
                    // Also try to kill as a process group (negative PID)
                    libc::kill(-pgid, libc::SIGTERM);
                    
                    // Give processes time to clean up
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    
                    // Check if process is still running
                    match child.try_wait() {
                        Ok(None) => {
                            // Still running, force kill
                            libc::kill(pgid, libc::SIGKILL);
                            libc::kill(-pgid, libc::SIGKILL);
                            let _ = child.kill().await;
                        }
                        _ => {}
                    }
                }
            } else {
                // Fallback to normal kill
                let _ = child.kill().await;
            }
        }
        
        #[cfg(not(unix))]
        {
            // On Windows, kill the process tree
            if let Some(pid) = child.id() {
                // Use taskkill to kill the process tree
                let _ = std::process::Command::new("taskkill")
                    .args(&["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }
            // Also try normal kill as fallback
            let _ = child.kill().await;
        }
        
        // Emit stopped event
        let _ = app_handle.emit("dev-server-stopped", serde_json::json!({
            "process_id": process_id,
            "exit_code": -1
        }));
        
        Ok(())
    } else {
        // Process not found, might have already stopped
        // Still emit the stopped event to update UI
        let _ = app_handle.emit("dev-server-stopped", serde_json::json!({
            "process_id": process_id
        }));
        Ok(())
    }
}

#[tauri::command]
pub async fn get_dev_server_status(
    dev_manager: State<'_, DevServerManager>,
    process_id: String,
) -> Result<String, String> {
    let processes = dev_manager.processes.lock().await;
    
    if processes.contains_key(&process_id) {
        Ok("running".to_string())
    } else {
        Ok("stopped".to_string())
    }
}