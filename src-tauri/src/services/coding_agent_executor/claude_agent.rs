use async_trait::async_trait;
use chrono::Utc;
use log::{info, debug, error};
use serde_json;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::sync::mpsc::Sender;
use std::thread;
use tauri::AppHandle;

use super::agent::{CodingAgent, ExecutionContext, ChannelMessage};
use super::stateful_claude_converter::StatefulClaudeMessageConverter;
use super::types::*;

pub struct ClaudeCodeAgent {
    app_handle: AppHandle,
    // Store running processes by execution_id
    running_processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl ClaudeCodeAgent {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            running_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    fn find_claude_command() -> Option<String> {
        // Check common locations
        let common_paths = [
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude",
            "/home/linuxbrew/.linuxbrew/bin/claude",
            "/usr/bin/claude",
        ];
        
        for path in &common_paths {
            if std::path::Path::new(path).exists() {
                info!("Found claude at: {}", path);
                return Some(path.to_string());
            }
        }
        
        // Try to find in user's shell
        let shells = ["bash", "zsh", "sh"];
        for shell in &shells {
            let shell_path = format!("/bin/{}", shell);
            if !std::path::Path::new(&shell_path).exists() {
                continue;
            }
            
            // Try with login shell
            let shell_cmd = format!("{} -l -c 'which claude'", shell);
            if let Ok(output) = Command::new("sh")
                .arg("-c")
                .arg(&shell_cmd)
                .output()
            {
                if output.status.success() {
                    let claude_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !claude_path.is_empty() && std::path::Path::new(&claude_path).exists() {
                        info!("Found claude via {} at: {}", shell, claude_path);
                        
                        // Verify it works
                        if let Ok(test_output) = Command::new(&claude_path)
                            .arg("--version")
                            .output()
                        {
                            if test_output.status.success() {
                                return Some(claude_path);
                            }
                        }
                    }
                }
            }
        }
        
        // Try direct execution
        if let Ok(output) = Command::new("claude")
            .arg("--version")
            .output()
        {
            if output.status.success() {
                info!("claude is available in PATH");
                return Some("claude".to_string());
            }
        }
        
        None
    }

    fn find_npx_path() -> Option<String> {
        // Check common locations
        let common_paths = [
            "/usr/local/bin/npx",
            "/opt/homebrew/bin/npx",
            "/home/linuxbrew/.linuxbrew/bin/npx",
            "/usr/bin/npx",
        ];
        
        for path in &common_paths {
            if std::path::Path::new(path).exists() {
                info!("Found npx at: {}", path);
                return Some(path.to_string());
            }
        }
        
        // Try to find in user's shell
        let shells = ["bash", "zsh", "sh"];
        for shell in &shells {
            let shell_path = format!("/bin/{}", shell);
            if !std::path::Path::new(&shell_path).exists() {
                continue;
            }
            
            // Try with login shell
            let shell_cmd = format!("{} -l -c 'which npx'", shell);
            if let Ok(output) = Command::new("sh")
                .arg("-c")
                .arg(&shell_cmd)
                .output()
            {
                if output.status.success() {
                    let npx_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !npx_path.is_empty() && std::path::Path::new(&npx_path).exists() {
                        info!("Found npx via {} at: {}", shell, npx_path);
                        
                        // Verify it works
                        if let Ok(test_output) = Command::new(&npx_path)
                            .arg("--version")
                            .output()
                        {
                            if test_output.status.success() {
                                return Some(npx_path);
                            }
                        }
                    }
                }
            }
        }
        
        // Last resort: search in common Node.js installation paths
        let node_paths = [
            "/usr/local/lib/node_modules/npm/bin/npx-cli.js",
            "/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js",
        ];
        
        for node_path in &node_paths {
            if std::path::Path::new(node_path).exists() {
                // Try to run with node
                let _node_cmd = format!("node {}", node_path);
                info!("Found npx-cli.js at: {}", node_path);
                
                // Find node executable
                for path in &["/usr/local/bin/node", "/opt/homebrew/bin/node", "/usr/bin/node"] {
                    if std::path::Path::new(path).exists() {
                        // Test if the command works
                        let test = Command::new(path)
                            .arg(node_path)
                            .arg("--version")
                            .output();
                        
                        if let Ok(output) = test {
                            if output.status.success() {
                                // Return a composite command
                                return Some(format!("{} {}", path, node_path));
                            }
                        }
                    }
                }
            }
        }
        
        // Last resort: try npx in PATH
        if let Ok(output) = Command::new("npx")
            .arg("--version")
            .output()
        {
            if output.status.success() {
                info!("Found npx in PATH");
                return Some("npx".to_string());
            }
        }
        
        None
    }
}

#[async_trait]
impl CodingAgent for ClaudeCodeAgent {
    async fn execute_prompt(
        &self,
        prompt: &str,
        execution_context: ExecutionContext,
        message_sender: Sender<ChannelMessage>,
    ) -> Result<CodingAgentExecution, String> {
        let execution_id = format!("claude-{}-{}", 
            chrono::Utc::now().timestamp(),
            &execution_context.task_id[..8]
        );
        
        info!("Starting Claude Code execution: {}", execution_id);
        info!("Working directory: {}", execution_context.working_directory);
        info!("Resume session ID: {:?}", execution_context.resume_session_id);
        
        // Try to find installed claude command first
        let mut using_npx = false;
        let cmd_result = if let Some(claude_cmd) = Self::find_claude_command() {
            info!("Using installed claude command: {}", claude_cmd);
            Ok(claude_cmd)
        } else {
            info!("Claude command not found, falling back to npx");
            using_npx = true;
            Self::find_npx_path()
                .ok_or("Could not find claude or npx. Please ensure claude-code is installed or Node.js and npm are available.")
        };
        
        let cmd = cmd_result?;
        
        // Parse composite command if needed
        let (program, base_args) = if cmd.contains(' ') {
            let parts: Vec<&str> = cmd.split_whitespace().collect();
            (parts[0].to_string(), parts[1..].to_vec())
        } else {
            (cmd, vec![])
        };
        
        let mut command = Command::new(&program);
        
        // Add base args if any (for node npx-cli.js case)
        for arg in base_args {
            command.arg(arg);
        }
        
        // Add claude-code args only if using npx
        if using_npx {
            command.arg("@anthropic-ai/claude-code@latest");
        } else {
            // When using claude command directly, we need these args for non-interactive streaming
            command.arg("--print");
            command.arg("--verbose");
            command.arg("--output-format");
            command.arg("stream-json");
        }
        
        if let Some(session_id) = &execution_context.resume_session_id {
            command.arg("--resume");
            command.arg(session_id);
        }
        
        command.current_dir(&execution_context.working_directory);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());
        
        // Set environment
        command.env("FORCE_COLOR", "0");
        command.env("TERM", "dumb");
        
        if let Ok(anthropic_key) = std::env::var("ANTHROPIC_API_KEY") {
            command.env("ANTHROPIC_API_KEY", anthropic_key);
        }
        
        if let Ok(node_path) = std::env::var("NODE_PATH") {
            command.env("NODE_PATH", node_path);
        }
        
        info!("Starting Claude Code process...");
        let mut child = command.spawn()
            .map_err(|e| {
                let err_msg = format!("Failed to start Claude Code: {}", e);
                log::error!("{}", err_msg);
                err_msg
            })?;
        
        info!("Claude Code process started with PID: {:?}", child.id());
        
        // Store the child process
        let _child_pid = child.id();
        
        // Send input to stdin
        let input = prompt.to_string();
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;
            drop(stdin);
        }
        
        // Handle stdout
        if let Some(stdout) = child.stdout.take() {
            let execution_id_clone = execution_id.clone();
            let task_id = execution_context.task_id.clone();
            let attempt_id = execution_context.attempt_id.clone();
            let _app_handle = self.app_handle.clone();
            let message_sender_clone = message_sender.clone();
            
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                let converter = StatefulClaudeMessageConverter::new();
                
                for line in reader.lines() {
                    if let Ok(content) = line {
                        debug!("Claude stdout: {}", content);
                        
                        // Try to convert to unified message format
                        if let Some(agent_output) = converter.convert_to_unified(&content) {
                            // Convert AgentOutput to ConversationMessage
                            if let Some(conversation_msg) = crate::services::coding_agent_executor::service::convert_to_conversation_message(&agent_output) {
                                // Send message through channel to service
                                let _ = message_sender_clone.send(ChannelMessage {
                                    attempt_id: attempt_id.clone(),
                                    task_id: task_id.clone(),
                                    message: conversation_msg,
                                });
                            }
                        }
                        
                        // Also check for session ID in system messages
                        if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&content) {
                            if json_value["type"] == "system" && json_value["subtype"] == "init" {
                                if let Some(session_id) = json_value["session_id"].as_str() {
                                    info!("Received Claude session ID: {}", session_id);
                                    // Directly update the attempt with session ID in backend
                                    let session_id_clone = session_id.to_string();
                                    let attempt_id_clone = attempt_id.clone();
                                    let message_sender_session = message_sender_clone.clone();
                                    
                                    // Send a special message to the service to update session ID
                                    let session_msg = ConversationMessage {
                                        id: format!("{}-session-{}", Utc::now().to_rfc3339(), session_id_clone),
                                        role: MessageRole::System,
                                        message_type: "session_update".to_string(),
                                        content: session_id_clone.clone(),
                                        timestamp: Utc::now(),
                                        metadata: Some(serde_json::json!({
                                            "session_id": session_id_clone,
                                        })),
                                    };
                                    
                                    let _ = message_sender_session.send(ChannelMessage {
                                        attempt_id: attempt_id_clone,
                                        task_id: task_id.clone(),
                                        message: session_msg,
                                    });
                                }
                            }
                        }
                        
                        // Debug output removed - no longer needed with new event architecture
                    }
                }
                
                // Send execution complete message when process ends
                let complete_msg = ConversationMessage {
                    id: format!("{}-complete-{}", Utc::now().to_rfc3339(), {
                        use rand::Rng;
                        let mut rng = rand::thread_rng();
                        let random_suffix: String = (0..8)
                            .map(|_| {
                                let charset = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                                let idx = rng.gen_range(0..charset.len());
                                charset[idx] as char
                            })
                            .collect();
                        random_suffix
                    }),
                    role: MessageRole::System,
                    message_type: "execution_complete".to_string(),
                    content: "Execution completed".to_string(),
                    timestamp: Utc::now(),
                    metadata: Some(serde_json::json!({
                        "execution_id": execution_id_clone,
                        "status": "completed"
                    })),
                };
                
                let _ = message_sender_clone.send(ChannelMessage {
                    attempt_id: attempt_id.clone(),
                    task_id: task_id.clone(),
                    message: complete_msg,
                });
            });
        }
        
        // Handle stderr
        if let Some(stderr) = child.stderr.take() {
            let execution_id_clone = execution_id.clone();
            let task_id = execution_context.task_id.clone();
            let attempt_id = execution_context.attempt_id.clone();
            let message_sender_clone = message_sender.clone();
            
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(content) = line {
                        // Only log actual errors, not normal output
                        if !content.trim().is_empty() && 
                           !content.contains("Using Claude model") &&
                           !content.contains("Working directory:") {
                            error!("Claude stderr: {}", content);
                            
                            // Send error message
                            let error_msg = ConversationMessage {
                                id: format!("{}-error-{}", Utc::now().to_rfc3339(), {
                                    use rand::Rng;
                                    let mut rng = rand::thread_rng();
                                    rng.gen::<u32>()
                                }),
                                role: MessageRole::System,
                                message_type: "error".to_string(),
                                content: content.clone(),
                                timestamp: Utc::now(),
                                metadata: Some(serde_json::json!({
                                    "execution_id": execution_id_clone,
                                    "source": "stderr"
                                })),
                            };
                            
                            let _ = message_sender_clone.send(ChannelMessage {
                                attempt_id: attempt_id.clone(),
                                task_id: task_id.clone(),
                                message: error_msg,
                            });
                        }
                    }
                }
            });
        }
        
        // Store the child process handle
        {
            let mut processes = self.running_processes.lock().unwrap();
            processes.insert(execution_id.clone(), child);
        }
        
        let execution = CodingAgentExecution {
            id: execution_id.clone(),
            task_id: execution_context.task_id.clone(),
            executor_type: CodingAgentType::ClaudeCode,
            working_directory: execution_context.working_directory.clone(),
            status: CodingAgentExecutionStatus::Running,
            created_at: Utc::now(),
        };
        
        Ok(execution)
    }
    
    async fn stop_execution(
        &self,
        execution_id: &str,
        _execution_context: &ExecutionContext,
    ) -> Result<(), String> {
        log::info!("Stopping Claude execution: {}", execution_id);
        
        // Try to get and kill the child process
        let mut processes = self.running_processes.lock().unwrap();
        if let Some(mut child) = processes.remove(execution_id) {
            log::info!("Found child process for execution {}, attempting to kill", execution_id);
            
            // Try to kill the process
            match child.kill() {
                Ok(_) => {
                    log::info!("Successfully sent kill signal to process");
                    // Wait for the process to actually terminate
                    match child.wait() {
                        Ok(status) => {
                            log::info!("Process terminated with status: {:?}", status);
                        }
                        Err(e) => {
                            log::warn!("Error waiting for process to terminate: {}", e);
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to kill process: {}", e);
                    
                    // Try platform-specific kill as fallback
                    #[cfg(unix)]
                    {
                        let pid = child.id();
                        log::info!("Trying SIGKILL on PID {}", pid);
                        unsafe {
                            let result = libc::kill(pid as i32, libc::SIGKILL);
                            if result != 0 {
                                log::error!("SIGKILL failed with error code: {}", result);
                            }
                        }
                    }
                }
            }
        } else {
            log::warn!("No child process found for execution {}", execution_id);
        }
        
        Ok(())
    }
}