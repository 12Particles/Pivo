use crate::services::coding_agent_executor::{
    CodingAgentExecutorService, CodingAgentExecution, AttemptExecutionState, 
    TaskExecutionSummary, MessageRole
};
use std::sync::Arc;
use tauri::State;
use std::fs;
use base64::{Engine as _, engine::general_purpose};

pub struct CliState {
    pub service: Arc<CodingAgentExecutorService>,
}

#[tauri::command]
pub async fn start_claude_execution(
    state: State<'_, CliState>,
    task_id: String,
    attempt_id: String,
    working_directory: String,
    project_path: Option<String>,
    stored_claude_session_id: Option<String>,
) -> Result<CodingAgentExecution, String> {
    state.service.start_claude_execution(
        &task_id,
        &attempt_id,
        &working_directory,
        project_path.as_deref(),
        stored_claude_session_id.as_deref(),
    ).await
}

#[tauri::command]
pub async fn start_gemini_execution(
    state: State<'_, CliState>,
    task_id: String,
    working_directory: String,
    context_files: Vec<String>,
) -> Result<CodingAgentExecution, String> {
    state.service.start_gemini_execution(
        &task_id,
        &working_directory,
        context_files,
    ).await
}

#[tauri::command]
pub async fn send_cli_input(
    state: State<'_, CliState>,
    execution_id: String,
    input: String,
) -> Result<(), String> {
    state.service.send_input(&execution_id, &input).await
}

#[tauri::command]
pub async fn stop_cli_execution(
    state: State<'_, CliState>,
    execution_id: String,
) -> Result<(), String> {
    state.service.stop_execution(&execution_id).await
}

#[tauri::command]
pub async fn get_cli_execution(
    state: State<'_, CliState>,
    execution_id: String,
) -> Result<Option<CodingAgentExecution>, String> {
    Ok(state.service.get_execution(&execution_id))
}

#[tauri::command]
pub async fn list_cli_executions(
    state: State<'_, CliState>,
) -> Result<Vec<CodingAgentExecution>, String> {
    Ok(state.service.list_executions())
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

#[tauri::command]
pub async fn save_images_to_temp(
    base64_images: Vec<String>,
) -> Result<Vec<String>, String> {
    let mut paths = Vec::new();
    let temp_dir = std::env::temp_dir();
    
    for (index, base64_image) in base64_images.iter().enumerate() {
        // Extract the data part after "data:image/png;base64," or similar
        let data_part = if let Some(comma_pos) = base64_image.find(',') {
            &base64_image[comma_pos + 1..]
        } else {
            base64_image
        };
        
        // Decode base64
        let image_data = general_purpose::STANDARD
            .decode(data_part)
            .map_err(|e| format!("Failed to decode base64: {}", e))?;
        
        // Generate filename
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Time error: {}", e))?
            .as_millis();
        let filename = format!("pivo_image_{}_{}.png", timestamp, index);
        let file_path = temp_dir.join(&filename);
        
        // Write to file
        fs::write(&file_path, image_data)
            .map_err(|e| format!("Failed to write image file: {}", e))?;
        
        // Add path to results
        paths.push(file_path.to_string_lossy().to_string());
    }
    
    Ok(paths)
}

// New commands for enhanced state management

#[tauri::command]
pub async fn get_attempt_execution_state(
    state: State<'_, CliState>,
    attempt_id: String,
) -> Result<Option<AttemptExecutionState>, String> {
    Ok(state.service.get_attempt_execution_state(&attempt_id))
}

#[tauri::command]
pub async fn get_task_execution_summary(
    state: State<'_, CliState>,
    task_id: String,
) -> Result<TaskExecutionSummary, String> {
    Ok(state.service.get_task_execution_summary(&task_id))
}

#[tauri::command]
pub async fn add_message(
    state: State<'_, CliState>,
    attempt_id: String,
    role: MessageRole,
    content: String,
    images: Vec<String>,
    metadata: Option<serde_json::Value>,
) -> Result<(), String> {
    state.service.add_message(&attempt_id, role, content, images, metadata)
}

#[tauri::command]
pub async fn is_attempt_active(
    state: State<'_, CliState>,
    attempt_id: String,
) -> Result<bool, String> {
    Ok(state.service.is_attempt_active(&attempt_id))
}

#[tauri::command]
pub async fn get_running_tasks(
    state: State<'_, CliState>,
) -> Result<Vec<String>, String> {
    Ok(state.service.get_running_tasks())
}