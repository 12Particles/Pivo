use crate::services::CommandService;
use crate::models::CommandSearchResult;

#[tauri::command]
pub async fn search_commands(
    project_path: String,
    query: Option<String>,
    limit: Option<usize>,
) -> Result<CommandSearchResult, String> {
    let service = CommandService::new();
    let limit = limit.unwrap_or(5);
    
    service.search_commands(
        &project_path,
        query.as_deref(),
        limit
    )
}

#[tauri::command]
pub async fn get_command_content(
    command_path: String,
) -> Result<String, String> {
    let service = CommandService::new();
    service.get_command_content(&command_path)
}