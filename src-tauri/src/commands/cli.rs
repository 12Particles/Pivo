use crate::services::coding_agent_executor::{
    CodingAgentExecutorService, CodingAgentExecution, CodingAgentType
};
use std::sync::Arc;
use tauri::State;
use std::fs;
use base64::{Engine as _, engine::general_purpose};

pub struct CliState {
    pub service: Arc<CodingAgentExecutorService>,
}

#[tauri::command]
pub async fn execute_prompt(
    state: State<'_, CliState>,
    prompt: String,
    task_id: String,
    attempt_id: String,
    working_directory: String,
    agent_type: CodingAgentType,
    resume_session_id: Option<String>,
) -> Result<CodingAgentExecution, String> {
    state.service.execute_prompt(
        &prompt,
        &task_id,
        &attempt_id,
        &working_directory,
        agent_type,
        resume_session_id,
    ).await
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

#[tauri::command]
pub async fn get_running_tasks(
    state: State<'_, CliState>,
) -> Result<Vec<String>, String> {
    Ok(state.service.get_running_tasks())
}