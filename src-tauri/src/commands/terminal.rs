use crate::services::terminal_service::{TerminalService, TerminalSession};
use std::sync::Arc;
use tauri::State;

pub struct TerminalState {
    pub service: Arc<TerminalService>,
}

#[tauri::command]
pub async fn create_terminal_session(
    state: State<'_, TerminalState>,
    task_attempt_id: String,
    rows: u16,
    cols: u16,
    working_directory: String,
) -> Result<TerminalSession, String> {
    state.service.create_session(&task_attempt_id, rows, cols, &working_directory)
}

#[tauri::command]
pub async fn write_to_terminal(
    state: State<'_, TerminalState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state.service.write_to_session(&session_id, &data)
}

#[tauri::command]
pub async fn resize_terminal(
    state: State<'_, TerminalState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state.service.resize_session(&session_id, rows, cols)
}

#[tauri::command]
pub async fn close_terminal_session(
    state: State<'_, TerminalState>,
    session_id: String,
) -> Result<(), String> {
    state.service.close_session(&session_id)
}

#[tauri::command]
pub async fn list_terminal_sessions(
    state: State<'_, TerminalState>,
) -> Result<Vec<String>, String> {
    Ok(state.service.list_sessions())
}