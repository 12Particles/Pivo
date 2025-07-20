use crate::services::cli_executor::{CliExecutorService, CliSession};
use std::sync::Arc;
use tauri::State;

pub struct CliState {
    pub service: Arc<CliExecutorService>,
}

#[tauri::command]
pub async fn start_claude_session(
    state: State<'_, CliState>,
    task_id: String,
    working_directory: String,
    project_path: Option<String>,
) -> Result<CliSession, String> {
    state.service.start_claude_session(
        &task_id,
        &working_directory,
        project_path.as_deref(),
    )
}

#[tauri::command]
pub async fn start_gemini_session(
    state: State<'_, CliState>,
    task_id: String,
    working_directory: String,
    context_files: Vec<String>,
) -> Result<CliSession, String> {
    state.service.start_gemini_session(
        &task_id,
        &working_directory,
        context_files,
    )
}

#[tauri::command]
pub async fn send_cli_input(
    state: State<'_, CliState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    state.service.send_input(&session_id, &input)
}

#[tauri::command]
pub async fn stop_cli_session(
    state: State<'_, CliState>,
    session_id: String,
) -> Result<(), String> {
    state.service.stop_session(&session_id)
}

#[tauri::command]
pub async fn get_cli_session(
    state: State<'_, CliState>,
    session_id: String,
) -> Result<Option<CliSession>, String> {
    Ok(state.service.get_session(&session_id))
}

#[tauri::command]
pub async fn list_cli_sessions(
    state: State<'_, CliState>,
) -> Result<Vec<CliSession>, String> {
    Ok(state.service.list_sessions())
}

#[tauri::command]
pub async fn configure_claude_api_key(
    state: State<'_, CliState>,
    api_key: String,
) -> Result<(), String> {
    state.service.configure_claude_api_key(&api_key)
}

#[tauri::command]
pub async fn configure_gemini_api_key(
    state: State<'_, CliState>,
    api_key: String,
) -> Result<(), String> {
    state.service.configure_gemini_api_key(&api_key)
}