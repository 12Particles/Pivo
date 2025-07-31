mod db;
mod models;
mod services;
mod repository;
mod commands;
mod logging;
mod menu;

use std::sync::Arc;
use services::{TaskService, ProjectService, ProcessService, McpServerManager, CodingAgentExecutorService, MergeRequestService, ConfigService, FileWatcherService};
use repository::DatabaseRepository;
use tauri::Manager;
use tokio::sync::Mutex;
use commands::mcp::McpState;
use commands::cli::CliState;

pub struct AppState {
    pub task_service: Arc<TaskService>,
    pub project_service: Arc<ProjectService>,
    pub process_service: Arc<ProcessService>,
    pub merge_request_service: Arc<MergeRequestService>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle();
            
            // Initialize logging
            logging::init_logging().expect("Failed to initialize logging");
            log::info!("Starting Pivo application");
            
            // Initialize database
            tauri::async_runtime::block_on(async {
                let pool = db::init_database(&handle).await
                    .expect("Failed to initialize database");
                
                // Create database repository
                let db_repository = Arc::new(DatabaseRepository::new(pool.clone()));
                
                // Create services
                let task_service = Arc::new(TaskService::new(pool.clone()));
                let project_service = Arc::new(ProjectService::new(pool.clone()));
                let process_service = Arc::new(ProcessService::new(pool.clone()));
                let merge_request_service = Arc::new(MergeRequestService::new(pool.clone()));
                let mcp_manager = Arc::new(McpServerManager::new(handle.clone()));
                let cli_service = Arc::new(CodingAgentExecutorService::new(handle.clone(), db_repository.clone()));
                let mut config_service_inner = ConfigService::new(pool.clone());
                config_service_inner.load_from_db().await
                    .unwrap_or_else(|e| log::warn!("Failed to load config from db: {}", e));
                let config_service = Arc::new(Mutex::new(config_service_inner));
                let file_watcher_service = Arc::new(FileWatcherService::new(handle.clone()));
                
                // Store app state
                app.manage(AppState {
                    task_service,
                    project_service,
                    process_service,
                    merge_request_service,
                });
                
                // Store config service
                app.manage(config_service);
                
                
                // Store MCP state
                app.manage(McpState {
                    manager: mcp_manager,
                });
                
                // Store CLI state
                app.manage(CliState {
                    service: cli_service,
                });
                
                // Store file watcher service
                app.manage(file_watcher_service);
            });
            
            // Setup menu events after app state is initialized
            menu::setup_menu_events(app)?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::create_task,
            commands::tasks::get_task,
            commands::tasks::list_tasks,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::tasks::update_task_status,
            commands::task_commands::execute_task_command,
            commands::task_commands::get_conversation_state,
            commands::task_attempts::get_task_attempt,
            commands::task_attempts::list_task_attempts,
            commands::task_attempts::update_attempt_claude_session,
            commands::projects::create_project,
            commands::projects::get_project,
            commands::projects::list_projects,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::refresh_all_git_providers,
            commands::projects::update_project_last_opened,
            commands::projects::get_recent_projects,
            commands::projects::select_project_directory,
            commands::projects::read_project_info,
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
            commands::git::get_git_diff,
            commands::git::check_rebase_status,
            commands::git::get_branch_commit,
            commands::mcp::register_mcp_server,
            commands::mcp::start_mcp_server,
            commands::mcp::stop_mcp_server,
            commands::mcp::list_mcp_servers,
            commands::mcp::get_mcp_server,
            commands::mcp::send_mcp_request,
            commands::mcp::list_mcp_tools,
            commands::mcp::list_mcp_resources,
            commands::mcp::read_mcp_resource,
            commands::mcp::list_mcp_prompts,
            commands::mcp::get_mcp_prompt,
            commands::cli::configure_claude_api_key,
            commands::cli::configure_gemini_api_key,
            commands::cli::save_images_to_temp,
            commands::cli::get_running_tasks,
            commands::git_info::extract_git_info_from_path,
            commands::logging::get_log_content,
            commands::logging::get_log_path,
            commands::logging::open_log_file,
            commands::logging::clear_logs,
            commands::window::show_log_viewer,
            commands::gitlab::get_gitlab_config,
            commands::gitlab::update_gitlab_config,
            commands::gitlab::create_gitlab_mr,
            commands::gitlab::get_gitlab_mr_status,
            commands::gitlab::push_to_gitlab,
            commands::gitlab::detect_git_provider,
            commands::gitlab::get_merge_requests_by_attempt,
            commands::gitlab::get_merge_requests_by_task,
            commands::gitlab::get_active_merge_requests,
            commands::github::get_github_config,
            commands::github::update_github_config,
            commands::github::create_github_pr,
            commands::github::get_github_pr_status,
            commands::github::push_to_github,
            commands::github::get_pull_requests_by_attempt,
            commands::github::get_pull_requests_by_task,
            commands::github::github_start_device_flow,
            commands::github::github_poll_device_auth,
            commands::system::open_in_terminal,
            services::watch_worktree,
            services::unwatch_worktree,
            services::unwatch_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
