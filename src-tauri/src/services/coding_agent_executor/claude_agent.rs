use async_trait::async_trait;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::thread;
use std::sync::mpsc::Sender;
use tauri::{AppHandle, Emitter};
use log::{info, debug};
use chrono::Utc;
use uuid::Uuid;
use super::agent::{CodingAgent, ExecutionContext, ChannelMessage};
use super::types::*;
use super::stateful_claude_converter::StatefulClaudeMessageConverter;

pub struct ClaudeCodeAgent {
    app_handle: AppHandle,
}

impl ClaudeCodeAgent {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { 
            app_handle,
        }
    }
    
    fn build_command(&self, working_directory: &str, session_id: Option<&str>, use_shell_env: bool) -> String {
        let mut cmd_parts = vec![
            format!("cd \"{}\"", working_directory),
            "NODE_NO_WARNINGS=\"1\"".to_string(),
            "npx -y @anthropic-ai/claude-code@latest -p --dangerously-skip-permissions --verbose --output-format=stream-json".to_string(),
        ];
        
        if let Some(id) = session_id {
            cmd_parts.push(format!("--resume {}", id));
        }
        
        let base_cmd = cmd_parts.join(" && ");
        
        if use_shell_env {
            // Use login shell to get full environment
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
            format!("{} -l -c '{}'", shell, base_cmd)
        } else {
            base_cmd
        }
    }
    
    fn find_npx(&self) -> Result<String, String> {
        // First, try to get npx from user's default shell environment
        info!("Attempting to find npx using shell environment...");
        
        // Get the user's default shell
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        info!("Using shell: {}", shell);
        
        // Try to get npx path from shell
        let shell_cmd = format!("{} -l -c 'which npx'", shell);
        if let Ok(output) = Command::new("sh")
            .arg("-c")
            .arg(&shell_cmd)
            .output() 
        {
            if output.status.success() {
                let npx_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !npx_path.is_empty() && std::path::Path::new(&npx_path).exists() {
                    info!("Found npx via shell at: {}", npx_path);
                    // Verify it works
                    if let Ok(test_output) = Command::new(&npx_path)
                        .arg("--version")
                        .output()
                    {
                        if test_output.status.success() {
                            return Ok(npx_path);
                        }
                    }
                }
            }
        }
        
        // If shell method fails, try common locations
        info!("Shell method failed, trying common paths...");
        let npx_paths = vec![
            "/usr/local/bin/npx",
            "/opt/homebrew/bin/npx",
            "/opt/homebrew/opt/node/bin/npx",
            "/usr/local/opt/node/bin/npx",
            "/usr/bin/npx",
            "~/.nvm/versions/node/v*/bin/npx", // NVM installations
            "~/.volta/bin/npx", // Volta
            "~/.fnm/node-versions/v*/installation/bin/npx", // fnm
        ];
        
        // Expand home directory and wildcards
        let home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string());
        let expanded_paths: Vec<String> = npx_paths.iter()
            .flat_map(|path| {
                let expanded = path.replace("~", &home);
                if expanded.contains('*') {
                    // Use glob to expand wildcards
                    if let Ok(paths) = glob::glob(&expanded) {
                        paths.filter_map(|p| p.ok())
                            .map(|p| p.to_string_lossy().to_string())
                            .collect::<Vec<_>>()
                    } else {
                        vec![expanded]
                    }
                } else {
                    vec![expanded]
                }
            })
            .collect();
        
        for path in &expanded_paths {
            if std::path::Path::new(path).exists() {
                // Test if the command works
                let test = Command::new(path)
                    .arg("--version")
                    .output();
                    
                if let Ok(output) = test {
                    if output.status.success() {
                        info!("Found working npx at: {}", path);
                        return Ok(path.to_string());
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
                return Ok("npx".to_string());
            }
        }
        
        let err_msg = format!(
            "npx command not found. Please ensure Node.js is installed and available. \
            Searched shell environment and paths: {}. \
            You may need to install Node.js or configure your shell environment properly.",
            expanded_paths.join(", ")
        );
        log::error!("{}", err_msg);
        Err(err_msg)
    }
    
    fn spawn_process(&self, cmd: &str, input: &str, execution_id: &str, task_id: &str, attempt_id: &str, message_sender: Sender<ChannelMessage>) -> Result<(), String> {
        info!("Spawning Claude Code with command: {}", cmd);
        
        let mut command = Command::new("sh");
        command.arg("-c").arg(cmd);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());
        
        // Add environment variables to ensure proper PATH
        // Include common Node.js installation paths for macOS
        let mut path = std::env::var("PATH").unwrap_or_default();
        let additional_paths = vec![
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/opt/homebrew/opt/node/bin",
            "/usr/local/opt/node/bin",
            "~/.nvm/versions/node/*/bin",
        ];
        for p in additional_paths {
            if !path.contains(p) {
                path.push(':');
                path.push_str(p);
            }
        }
        command.env("PATH", path);
        
        // Also set NODE_PATH for npm modules
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
        
        // Send input to stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;
            drop(stdin);
        }
        
        // Handle stdout
        if let Some(stdout) = child.stdout.take() {
            let execution_id = execution_id.to_string();
            let task_id = task_id.to_string();
            let attempt_id = attempt_id.to_string();
            let app_handle = self.app_handle.clone();
            
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
                                let _ = message_sender.send(ChannelMessage {
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
                                    // Session ID should be handled through attempt update
                                    // We'll need to update the attempt with this session ID
                                    let session_id_clone = session_id.to_string();
                                    let attempt_id_clone = attempt_id.clone();
                                    let app_handle_clone = app_handle.clone();
                                    
                                    tauri::async_runtime::spawn(async move {
                                        // Emit event to update attempt with session ID
                                        let _ = app_handle_clone.emit("session:received", serde_json::json!({
                                            "attemptId": attempt_id_clone,
                                            "sessionId": session_id_clone,
                                        }));
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
                        "success": true,
                        "summary": "Execution completed",
                    })),
                };
                
                let _ = message_sender.send(ChannelMessage {
                    attempt_id: attempt_id.clone(),
                    task_id: task_id.clone(),
                    message: complete_msg,
                });
                
                debug!("Stdout reader thread ended for execution: {}", execution_id);
            });
        }
        
        // Handle stderr
        if let Some(stderr) = child.stderr.take() {
            let execution_id = execution_id.to_string();
            let _task_id = task_id.to_string();
            let _attempt_id = attempt_id.to_string();
            let _app_handle = self.app_handle.clone();
            
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(content) = line {
                        // Log stderr for debugging
                        log::warn!("Claude stderr: {}", content);
                        
                        // Debug stderr output removed - no longer needed with new event architecture
                    }
                }
                debug!("Stderr reader thread ended for execution: {}", execution_id);
            });
        }
        
        // Monitor process in a separate thread
        let _process_task_id = task_id.to_string();
        thread::spawn(move || {
            thread::sleep(std::time::Duration::from_millis(100));
            match child.try_wait() {
                Ok(Some(status)) => {
                    log::error!("Claude Code process exited immediately with status: {:?}", status);
                }
                Ok(None) => {
                    info!("Claude Code process is running normally");
                }
                Err(e) => {
                    log::error!("Error checking Claude Code process status: {}", e);
                }
            }
        });
        
        Ok(())
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
        info!("Executing Claude Code prompt for attempt: {} (task: {})", 
            execution_context.attempt_id, execution_context.task_id);
        
        let execution_id = Uuid::new_v4().to_string();
        let execution = CodingAgentExecution {
            id: execution_id.clone(),
            task_id: execution_context.task_id.clone(),
            executor_type: CodingAgentType::ClaudeCode,
            working_directory: execution_context.working_directory.clone(),
            status: CodingAgentExecutionStatus::Running,
            created_at: Utc::now(),
        };
        
        // User message will be created by the service layer
        
        // Try with shell environment first
        let cmd = self.build_command(&execution_context.working_directory, execution_context.resume_session_id.as_deref(), true);
        
        info!("Attempting to spawn Claude Code with shell environment...");
        if let Err(e) = self.spawn_process(&cmd, prompt, &execution_id, &execution_context.task_id, &execution_context.attempt_id, message_sender.clone()) {
            log::warn!("Failed to spawn with shell environment: {}. Trying direct execution...", e);
            
            // If shell method fails, try direct execution with found npx
            if let Ok(npx_path) = self.find_npx() {
                let direct_cmd = if npx_path != "npx" {
                    // Use full path
                    self.build_command(&execution_context.working_directory, execution_context.resume_session_id.as_deref(), false)
                        .replace("npx", &npx_path)
                } else {
                    self.build_command(&execution_context.working_directory, execution_context.resume_session_id.as_deref(), false)
                };
                
                self.spawn_process(&direct_cmd, prompt, &execution_id, &execution_context.task_id, &execution_context.attempt_id, message_sender)?;
            } else {
                return Err("Failed to find npx in any known location".to_string());
            }
        }
        
        Ok(execution)
    }
    
    async fn stop_execution(
        &self,
        _execution_id: &str,
        execution_context: &ExecutionContext,
    ) -> Result<(), String> {
        // Kill all npx processes for this execution
        let _ = std::process::Command::new("pkill")
            .args(&["-f", &format!("npx.*claude-code.*{}", execution_context.resume_session_id.as_deref().unwrap_or(""))])
            .output();
        
        Ok(())
    }
}