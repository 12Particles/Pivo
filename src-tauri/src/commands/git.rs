use crate::models::{DiffMode, DiffResult, RebaseStatus};
use crate::services::GitService;
use crate::utils::command::execute_git;
use std::path::Path;

// Original git commands
#[tauri::command]
pub async fn create_worktree(
    repo_path: String,
    branch_name: String,
    base_branch: String,
) -> Result<String, String> {
    let git_service = GitService::new();
    let worktree_path = git_service.create_worktree(
        Path::new(&repo_path),
        &branch_name,
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
    git_service.remove_worktree(Path::new(&repo_path), Path::new(&worktree_path))
}

#[tauri::command]
pub async fn get_current_branch(repo_path: String) -> Result<String, String> {
    GitService::get_current_branch(Path::new(&repo_path))
}

#[tauri::command]
pub async fn list_branches(repo_path: String) -> Result<Vec<String>, String> {
    GitService::list_branches(Path::new(&repo_path))
}

#[tauri::command]
pub async fn get_git_status(repo_path: String) -> Result<crate::services::GitStatus, String> {
    let git_service = GitService::new();
    git_service.get_status(Path::new(&repo_path))
}

#[tauri::command]
pub async fn stage_files(repo_path: String, files: Vec<String>) -> Result<(), String> {
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    GitService::stage_files(Path::new(&repo_path), &file_refs)
}

#[tauri::command]
pub async fn commit_changes(repo_path: String, message: String) -> Result<String, String> {
    GitService::commit(Path::new(&repo_path), &message)
}

#[tauri::command]
pub async fn push_branch(repo_path: String, branch: String, force: bool) -> Result<(), String> {
    GitService::push(Path::new(&repo_path), &branch, force)
}

#[tauri::command]
pub async fn get_diff(repo_path: String, staged: bool) -> Result<String, String> {
    GitService::get_diff(Path::new(&repo_path), staged)
}

#[tauri::command]
pub async fn list_all_files(repo_path: String) -> Result<Vec<String>, String> {
    let output = execute_git(&["ls-tree", "-r", "HEAD", "--name-only"], repo_path.as_ref())
        .map_err(|e| format!("Failed to list files: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let files = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|s| s.to_string())
        .collect();

    Ok(files)
}

#[tauri::command]
pub async fn read_file_content(repo_path: String, file_path: String) -> Result<String, String> {
    let full_path = Path::new(&repo_path).join(&file_path);
    std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn get_file_from_ref(repo_path: String, file_ref: String) -> Result<String, String> {
    GitService::get_file_from_ref(Path::new(&repo_path), &file_ref)
}

// New enhanced diff commands
#[tauri::command]
pub async fn get_git_diff(
    worktree_path: String,
    mode: DiffMode,
) -> Result<DiffResult, String> {
    let git_service = GitService::new();
    git_service.get_comprehensive_diff(Path::new(&worktree_path), mode)
}

#[tauri::command]
pub async fn check_rebase_status(
    worktree_path: String,
    base_branch: String,
) -> Result<RebaseStatus, String> {
    let git_service = GitService::new();
    git_service.check_rebase_status(Path::new(&worktree_path), &base_branch)
}

#[tauri::command]
pub async fn get_branch_commit(
    repo_path: String,
    branch: String,
) -> Result<String, String> {
    let git_service = GitService::new();
    git_service.get_branch_commit(Path::new(&repo_path), &branch)
}