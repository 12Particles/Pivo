use crate::services::GitService;
use std::path::Path;

#[tauri::command]
pub async fn create_worktree(
    repo_path: String,
    task_id: String,
    base_branch: String,
) -> Result<String, String> {
    let git_service = GitService::new();
    let worktree_path = git_service.create_worktree(
        Path::new(&repo_path),
        &task_id,
        &base_branch,
    )?;
    
    Ok(worktree_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn remove_worktree(
    repo_path: String,
    worktree_path: String,
) -> Result<(), String> {
    let git_service = GitService::new();
    git_service.remove_worktree(
        Path::new(&repo_path),
        Path::new(&worktree_path),
    )
}

#[tauri::command]
pub async fn get_current_branch(
    repo_path: String,
) -> Result<String, String> {
    GitService::get_current_branch(Path::new(&repo_path))
}

#[tauri::command]
pub async fn list_branches(
    repo_path: String,
) -> Result<Vec<String>, String> {
    GitService::list_branches(Path::new(&repo_path))
}

#[tauri::command]
pub async fn get_git_status(
    repo_path: String,
) -> Result<crate::services::GitStatus, String> {
    let git_service = GitService::new();
    git_service.get_status(Path::new(&repo_path))
}

#[tauri::command]
pub async fn stage_files(
    repo_path: String,
    files: Vec<String>,
) -> Result<(), String> {
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    GitService::stage_files(Path::new(&repo_path), &file_refs)
}

#[tauri::command]
pub async fn commit_changes(
    repo_path: String,
    message: String,
) -> Result<String, String> {
    GitService::commit(Path::new(&repo_path), &message)
}

#[tauri::command]
pub async fn push_branch(
    repo_path: String,
    branch: String,
    force: bool,
) -> Result<(), String> {
    GitService::push(Path::new(&repo_path), &branch, force)
}

#[tauri::command]
pub async fn get_diff(
    repo_path: String,
    staged: bool,
) -> Result<String, String> {
    GitService::get_diff(Path::new(&repo_path), staged)
}