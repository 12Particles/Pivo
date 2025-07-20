use crate::services::GitService;
use std::path::Path;
use serde::Serialize;
use std::fs;
use std::io::Read;

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

#[derive(Serialize)]
pub struct FileNode {
    name: String,
    path: String,
    #[serde(rename = "type")]
    node_type: String,
    children: Option<Vec<FileNode>>,
}

#[tauri::command]
pub async fn list_all_files(
    directory_path: String,
) -> Result<Vec<FileNode>, String> {
    let path = Path::new(&directory_path);
    
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let mut nodes = Vec::new();
    let skip_dirs = vec![".git", "node_modules", "target", ".worktrees", "dist", "build"];
    
    // Read directory entries
    let entries = fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        
        // Skip hidden files and ignored directories
        if file_name.starts_with('.') && file_name != ".gitignore" {
            continue;
        }
        
        let file_type = entry.file_type()
            .map_err(|e| format!("Failed to get file type: {}", e))?;
        
        let file_path = entry.path();
        let path_str = file_path.to_string_lossy().to_string();
        
        if file_type.is_dir() {
            if skip_dirs.contains(&file_name.as_str()) {
                continue;
            }
            
            // Recursively get children
            let children = Box::pin(list_all_files(path_str.clone())).await.ok();
            
            nodes.push(FileNode {
                name: file_name,
                path: path_str,
                node_type: "folder".to_string(),
                children,
            });
        } else {
            nodes.push(FileNode {
                name: file_name,
                path: path_str,
                node_type: "file".to_string(),
                children: None,
            });
        }
    }
    
    // Sort nodes: folders first, then files, alphabetically within each group
    nodes.sort_by(|a, b| {
        match (a.node_type.as_str(), b.node_type.as_str()) {
            ("folder", "file") => std::cmp::Ordering::Less,
            ("file", "folder") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(nodes)
}

#[tauri::command]
pub async fn read_file_content(
    file_path: String,
) -> Result<String, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }
    
    let mut file = fs::File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    Ok(content)
}

#[tauri::command]
pub async fn get_file_from_ref(
    repo_path: String,
    file_ref: String,
) -> Result<String, String> {
    GitService::get_file_from_ref(Path::new(&repo_path), &file_ref)
}