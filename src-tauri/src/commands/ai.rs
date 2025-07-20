use crate::services::{ExecutorSession, ExecutorResponse, ExecutorConfig};
use crate::services::ai_executor::{claude::ClaudeExecutor, gemini::GeminiExecutor, AIExecutor};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;

// Store active sessions
lazy_static::lazy_static! {
    static ref SESSIONS: Arc<Mutex<HashMap<String, ExecutorSession>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[tauri::command]
pub async fn init_ai_session(
    executor_type: String,
    task_id: String,
    initial_prompt: String,
    config: ExecutorConfig,
) -> Result<String, String> {
    // Create executor based on type
    let executor: Box<dyn AIExecutor> = match executor_type.as_str() {
        "claude" => Box::new(ClaudeExecutor::new(config)),
        "gemini" => Box::new(GeminiExecutor::new(config)),
        _ => return Err(format!("Unknown executor type: {}", executor_type)),
    };

    // Initialize session
    let session = executor.init_session(&task_id, &initial_prompt)
        .await
        .map_err(|e| format!("Failed to initialize session: {}", e))?;

    let session_id = session.id.clone();

    // Store session
    let mut sessions = SESSIONS.lock().await;
    sessions.insert(session_id.clone(), session);

    Ok(session_id)
}

#[tauri::command]
pub async fn send_ai_message(
    session_id: String,
    message: String,
    executor_config: ExecutorConfig,
) -> Result<ExecutorResponse, String> {
    // Get session
    let mut sessions = SESSIONS.lock().await;
    let session = sessions.get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    // Create executor based on session type
    let executor: Box<dyn AIExecutor> = match session.executor_type.as_str() {
        "claude" => Box::new(ClaudeExecutor::new(executor_config)),
        "gemini" => Box::new(GeminiExecutor::new(executor_config)),
        _ => return Err(format!("Unknown executor type: {}", session.executor_type)),
    };

    // Send message
    let response = executor.send_message(session, &message)
        .await
        .map_err(|e| format!("Failed to send message: {}", e))?;

    Ok(response)
}

#[tauri::command]
pub async fn get_ai_session(
    session_id: String,
) -> Result<ExecutorSession, String> {
    let sessions = SESSIONS.lock().await;
    sessions.get(&session_id)
        .cloned()
        .ok_or_else(|| "Session not found".to_string())
}

#[tauri::command]
pub async fn list_ai_sessions() -> Result<Vec<String>, String> {
    let sessions = SESSIONS.lock().await;
    Ok(sessions.keys().cloned().collect())
}

#[tauri::command]
pub async fn close_ai_session(
    session_id: String,
) -> Result<(), String> {
    let mut sessions = SESSIONS.lock().await;
    sessions.remove(&session_id);
    Ok(())
}