use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub task_attempt_id: String,
    pub rows: u16,
    pub cols: u16,
    pub working_directory: String,
    pub shell: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub session_id: String,
    pub data: String,
}

pub struct TerminalService {
    sessions: Arc<Mutex<HashMap<String, TerminalProcess>>>,
    app_handle: AppHandle,
}

struct TerminalProcess {
    child: std::process::Child,
    stdin: Option<std::process::ChildStdin>,
}

impl TerminalService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    pub fn create_session(
        &self,
        task_attempt_id: &str,
        rows: u16,
        cols: u16,
        working_directory: &str,
    ) -> Result<TerminalSession, String> {
        let session_id = Uuid::new_v4().to_string();
        
        // Determine shell
        let shell = if cfg!(windows) {
            "cmd.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
        };

        // Create child process
        let mut cmd = Command::new(&shell);
        cmd.current_dir(working_directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Set terminal size
        #[cfg(unix)]
        {
            cmd.env("LINES", rows.to_string())
                .env("COLUMNS", cols.to_string());
        }

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let stdin = child.stdin.take();
        let stdout = child.stdout.take()
            .ok_or_else(|| "Failed to get stdout".to_string())?;
        let stderr = child.stderr.take()
            .ok_or_else(|| "Failed to get stderr".to_string())?;

        // Spawn threads to read output
        let session_id_clone = session_id.clone();
        let app_handle_clone = self.app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let output = TerminalOutput {
                        session_id: session_id_clone.clone(),
                        data: format!("{}\r\n", line),
                    };
                    let _ = app_handle_clone.emit("terminal-output", &output);
                }
            }
        });

        let session_id_clone = session_id.clone();
        let app_handle_clone = self.app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let output = TerminalOutput {
                        session_id: session_id_clone.clone(),
                        data: format!("{}\r\n", line),
                    };
                    let _ = app_handle_clone.emit("terminal-output", &output);
                }
            }
        });

        // Store process
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), TerminalProcess { child, stdin });

        Ok(TerminalSession {
            id: session_id,
            task_attempt_id: task_attempt_id.to_string(),
            rows,
            cols,
            working_directory: working_directory.to_string(),
            shell,
        })
    }

    pub fn write_to_session(&self, session_id: &str, data: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let process = sessions.get_mut(session_id)
            .ok_or_else(|| "Session not found".to_string())?;

        if let Some(stdin) = &mut process.stdin {
            stdin.write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;
        }

        Ok(())
    }

    pub fn resize_session(&self, session_id: &str, _rows: u16, _cols: u16) -> Result<(), String> {
        #[cfg(unix)]
        {
            let sessions = self.sessions.lock().unwrap();
            let process = sessions.get(session_id)
                .ok_or_else(|| "Session not found".to_string())?;

            // Send SIGWINCH signal to notify process of terminal resize
            use nix::sys::signal::{kill, Signal};
            use nix::unistd::Pid;
            
            if let Ok(pid) = process.child.id().try_into() {
                let _ = kill(Pid::from_raw(pid), Signal::SIGWINCH);
            }
        }

        Ok(())
    }

    pub fn close_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(mut process) = sessions.remove(session_id) {
            let _ = process.child.kill();
            let _ = process.child.wait();
        }
        Ok(())
    }

    pub fn list_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.lock().unwrap();
        sessions.keys().cloned().collect()
    }
}