mod db;
mod models;
mod services;
mod repository;
mod commands;
mod logging;
mod menu;
mod window_manager;
mod utils;

use std::sync::Arc;
use services::{TaskService, ProjectService, ProcessService, McpServerManager, CodingAgentExecutorService, MergeRequestService, ConfigService, FileWatcherService, VcsSyncService, VcsSyncConfig, GitLabService, GitHubService};
use models::{GitLabConfig, GitHubConfig};
use repository::DatabaseRepository;
use tauri::{Manager, Emitter};
use tokio::sync::Mutex;
use commands::mcp::McpState;
use commands::cli::CliState;
use window_manager::ProjectWindowManager;

pub struct AppState {
    pub task_service: Arc<TaskService>,
    pub project_service: Arc<ProjectService>,
    pub process_service: Arc<ProcessService>,
    pub merge_request_service: Arc<MergeRequestService>,
    pub window_manager: Arc<ProjectWindowManager>,
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
            if let Err(e) = logging::init_logging() {
                eprintln!("Failed to initialize logging: {}", e);
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to initialize logging: {}", e)
                )));
            }
            log::info!("Starting Pivo application");
            
            // Initialize database and services
            let setup_result = tauri::async_runtime::block_on(async {
                match db::init_database(&handle).await {
                    Ok(pool) => {
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
                        let window_manager = Arc::new(ProjectWindowManager::new(handle.clone()));
                        
                        // Initialize VCS sync service
                        let vcs_sync_config = VcsSyncConfig::default();
                        
                        // Get configs from config service
                        let config = config_service.lock().await;
                        let gitlab_config = config.get_gitlab_config().cloned()
                            .unwrap_or_else(|| GitLabConfig {
                                gitlab_url: Some("https://gitlab.com".to_string()),
                                pat: None,
                                username: None,
                                primary_email: None,
                                default_mr_base: None,
                            });
                        let github_config = config.get_github_config().cloned()
                            .unwrap_or_else(|| GitHubConfig {
                                access_token: None,
                                username: None,
                                default_pr_base: None,
                            });
                        drop(config);
                        
                        let gitlab_service = Arc::new(Mutex::new(GitLabService::new(gitlab_config)));
                        let github_service = Arc::new(Mutex::new(GitHubService::new(github_config)));
                        
                        if vcs_sync_config.enabled {
                            let vcs_sync_service = Arc::new(VcsSyncService::new(
                                pool.clone(),
                                gitlab_service.clone(),
                                github_service.clone(),
                                vcs_sync_config.sync_interval_seconds,
                                handle.clone(),
                            ));
                            
                            // Start background sync service
                            let sync_service = vcs_sync_service.clone();
                            tokio::spawn(async move {
                                sync_service.start_background_sync().await;
                            });
                            
                            log::info!("VCS sync service started with {} seconds interval", vcs_sync_config.sync_interval_seconds);
                        }
                        
                        // Store app state
                        app.manage(AppState {
                            task_service,
                            project_service,
                            process_service,
                            merge_request_service,
                            window_manager,
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
                        
                        Ok(())
                    }
                    Err(e) => {
                        log::error!("Database initialization failed: {}", e);
                        Err(e)
                    }
                }
            });
            
            if let Err(e) = setup_result {
                log::error!("Failed to initialize application: {}", e);
                eprintln!("Failed to initialize application: {}", e);
                eprintln!("This may be due to corrupted database. The application attempted to recreate the database.");
                eprintln!("If the problem persists, please check the logs for more details.");
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to initialize application: {}", e)
                )));
            }
            
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
            commands::window::open_project_window,
            commands::window::close_project_window,
            commands::window::get_project_window,
            commands::window::list_open_project_windows,
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
            commands::system::show_in_file_manager,
            commands::filesystem::search_project_files,
            commands::filesystem::search_files_from_current_dir,
            commands::command::search_commands,
            commands::command::get_command_content,
            services::watch_worktree,
            services::unwatch_worktree,
            services::unwatch_all,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Error while running tauri application: {}", e);
            std::process::exit(1);
        });
}
