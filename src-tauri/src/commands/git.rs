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
    use std::fs;
    use std::path::PathBuf;
    
    let repo_path_buf = PathBuf::from(&repo_path);
    let mut all_files = Vec::new();
    
    // Function to recursively collect files
    fn collect_files(dir: &Path, base_path: &Path, files: &mut Vec<String>) -> Result<(), String> {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    let file_name = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("");
                    
                    // Skip hidden files, .git directory, and common build/dependency directories
                    if file_name.starts_with('.') 
                        || file_name == "node_modules" 
                        || file_name == "target"
                        || file_name == "build"
                        || file_name == "dist" {
                        continue;
                    }
                    
                    if path.is_dir() {
                        collect_files(&path, base_path, files)?;
                    } else if path.is_file() {
                        // Get relative path from repo root
                        if let Ok(relative_path) = path.strip_prefix(base_path) {
                            if let Some(path_str) = relative_path.to_str() {
                                files.push(path_str.to_string());
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }
    
    // Collect all files recursively
    collect_files(&repo_path_buf, &repo_path_buf, &mut all_files)
        .map_err(|e| format!("Failed to list files: {}", e))?;
    
    // Sort files for consistent ordering
    all_files.sort();
    
    log::info!("[list_all_files] Found {} files in {}", all_files.len(), repo_path);
    if all_files.len() <= 10 {
        log::info!("[list_all_files] Files: {:?}", all_files);
    } else {
        log::info!("[list_all_files] First 10 files: {:?}", &all_files[..10]);
    }
    
    Ok(all_files)
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