use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub path: String,
    pub name: String,
    pub relative_path: String,
    pub modified_time: u64,
    pub is_directory: bool,
}

#[tauri::command]
pub async fn search_project_files(
    project_path: String,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<FileSearchResult>, String> {
    let max_results = max_results.unwrap_or(5);
    let project_path = PathBuf::from(&project_path);
    
    if !project_path.exists() || !project_path.is_dir() {
        return Err("Invalid project path".to_string());
    }
    
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    
    // Common directories to ignore
    let ignore_dirs = vec![
        ".git", "node_modules", "target", "dist", "build", 
        ".next", ".vscode", ".idea", "__pycache__", ".cache",
        "coverage", ".nyc_output", "vendor"
    ];
    
    // Walk through the directory tree
    for entry in WalkDir::new(&project_path)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            // Filter out ignored directories
            let file_name = e.file_name().to_string_lossy();
            !ignore_dirs.iter().any(|ignored| file_name == *ignored)
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        
        // Check if the file name contains the query (case-insensitive)
        if file_name.to_lowercase().contains(&query_lower) {
            // Get relative path
            let relative_path = path.strip_prefix(&project_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            
            // Get modified time
            let modified_time = entry.metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            
            results.push(FileSearchResult {
                path: path.to_string_lossy().to_string(),
                name: file_name,
                relative_path,
                modified_time,
                is_directory: path.is_dir(),
            });
        }
    }
    
    // Sort by modified time (most recent first)
    results.sort_by(|a, b| b.modified_time.cmp(&a.modified_time));
    
    // Limit results
    results.truncate(max_results);
    
    Ok(results)
}

#[tauri::command]
pub async fn search_files_from_current_dir(
    current_path: String,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<FileSearchResult>, String> {
    let max_results = max_results.unwrap_or(5);
    let current_path = PathBuf::from(&current_path);
    
    if !current_path.exists() || !current_path.is_dir() {
        return Err("Invalid current path".to_string());
    }
    
    // Find the project root by looking for .git directory
    let mut project_root = current_path.clone();
    let mut found_git = false;
    
    while let Some(parent) = project_root.parent() {
        if project_root.join(".git").exists() {
            found_git = true;
            break;
        }
        project_root = parent.to_path_buf();
    }
    
    // If no .git found, use the current directory
    if !found_git {
        project_root = current_path;
    }
    
    // Use the search_project_files function with the determined project root
    search_project_files(
        project_root.to_string_lossy().to_string(),
        query,
        Some(max_results),
    ).await
}