use crate::services::git_info::{extract_git_info, GitInfo};
use tauri::command;

#[command]
pub async fn extract_git_info_from_path(path: String) -> Result<GitInfo, String> {
    Ok(extract_git_info(&path))
}