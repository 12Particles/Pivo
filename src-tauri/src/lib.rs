mod db;
mod models;
mod services;
mod commands;
mod logging;
mod menu;

use std::sync::Arc;
use services::{TaskService, ProjectService, ProcessService, TerminalService, McpServerManager, CliExecutorService};
use tauri::Manager;
use commands::terminal::TerminalState;
use commands::mcp::McpState;
use commands::cli::CliState;

pub struct AppState {
    pub task_service: Arc<TaskService>,
    pub project_service: Arc<ProjectService>,
    pub process_service: Arc<ProcessService>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle();
            
            // Initialize logging
            logging::init_logging().expect("Failed to initialize logging");
            log::info!("Starting Pivo application");
            
            // Setup menu events
            menu::setup_menu_events(app)?;
            
            // Initialize database
            tauri::async_runtime::block_on(async {
                let pool = db::init_database(&handle).await
                    .expect("Failed to initialize database");
                
                // Create services
                let task_service = Arc::new(TaskService::new(pool.clone()));
                let project_service = Arc::new(ProjectService::new(pool.clone()));
                let process_service = Arc::new(ProcessService::new(pool.clone()));
                let terminal_service = Arc::new(TerminalService::new(handle.clone()));
                let mcp_manager = Arc::new(McpServerManager::new(handle.clone()));
                let cli_service = Arc::new(CliExecutorService::new(handle.clone()));
                
                // Store app state
                app.manage(AppState {
                    task_service,
                    project_service,
                    process_service,
                });
                
                // Store terminal state
                app.manage(TerminalState {
                    service: terminal_service,
                });
                
                // Store MCP state
                app.manage(McpState {
                    manager: mcp_manager,
                });
                
                // Store CLI state
                app.manage(CliState {
                    service: cli_service,
                });
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::create_task,
            commands::tasks::get_task,
            commands::tasks::list_tasks,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::tasks::update_task_status,
            commands::task_attempts::create_task_attempt,
            commands::task_attempts::get_task_attempt,
            commands::task_attempts::list_task_attempts,
            commands::task_attempts::update_attempt_status,
            commands::task_attempts::save_attempt_conversation,
            commands::task_attempts::get_attempt_conversation,
            commands::projects::create_project,
            commands::projects::get_project,
            commands::projects::list_projects,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::process::spawn_process,
            commands::process::kill_process,
            commands::process::get_process,
            commands::process::list_processes_for_attempt,
            commands::git::create_worktree,
            commands::git::remove_worktree,
            commands::git::get_current_branch,
            commands::git::list_branches,
            commands::git::get_git_status,
            commands::git::stage_files,
            commands::git::commit_changes,
            commands::git::push_branch,
            commands::git::get_diff,
            commands::git::list_all_files,
            commands::git::read_file_content,
            commands::git::get_file_from_ref,
            commands::ai::init_ai_session,
            commands::ai::send_ai_message,
            commands::ai::get_ai_session,
            commands::ai::list_ai_sessions,
            commands::ai::close_ai_session,
            commands::terminal::create_terminal_session,
            commands::terminal::write_to_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal_session,
            commands::terminal::list_terminal_sessions,
            commands::mcp::register_mcp_server,
            commands::mcp::start_mcp_server,
            commands::mcp::stop_mcp_server,
            commands::mcp::list_mcp_servers,
            commands::mcp::get_mcp_server,
            commands::mcp::send_mcp_request,
            commands::mcp::list_mcp_tools,
            commands::mcp::execute_mcp_tool,
            commands::mcp::list_mcp_resources,
            commands::mcp::read_mcp_resource,
            commands::mcp::list_mcp_prompts,
            commands::mcp::get_mcp_prompt,
            commands::cli::start_claude_session,
            commands::cli::start_gemini_session,
            commands::cli::send_cli_input,
            commands::cli::stop_cli_session,
            commands::cli::get_cli_session,
            commands::cli::list_cli_sessions,
            commands::cli::configure_claude_api_key,
            commands::cli::configure_gemini_api_key,
            commands::git_info::extract_git_info_from_path,
            commands::logging::get_log_content,
            commands::logging::get_log_path,
            commands::logging::open_log_file,
            commands::logging::clear_logs,
            commands::window::show_log_viewer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
