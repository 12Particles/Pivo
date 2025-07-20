use serde::{Deserialize, Serialize};
use std::path::Path;
use git2::{Repository, StatusOptions};

#[derive(Debug, Serialize, Deserialize)]
pub struct GitInfo {
    pub is_git_repo: bool,
    pub current_branch: Option<String>,
    pub remote_url: Option<String>,
    pub has_uncommitted_changes: bool,
    pub file_stats: FileStats,
    pub recent_commits: Vec<CommitInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileStats {
    pub modified: usize,
    pub added: usize,
    pub deleted: usize,
    pub untracked: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
}

pub fn extract_git_info(path: &str) -> GitInfo {
    let repo_path = Path::new(path);
    
    // Try to open as git repository
    match Repository::open(repo_path) {
        Ok(repo) => {
            let current_branch = get_current_branch(&repo);
            let remote_url = get_remote_url(&repo);
            let (has_uncommitted_changes, file_stats) = get_status(&repo);
            let recent_commits = get_recent_commits(&repo, 5);
            
            GitInfo {
                is_git_repo: true,
                current_branch,
                remote_url,
                has_uncommitted_changes,
                file_stats,
                recent_commits,
            }
        }
        Err(_) => {
            // Not a git repository
            GitInfo {
                is_git_repo: false,
                current_branch: None,
                remote_url: None,
                has_uncommitted_changes: false,
                file_stats: FileStats {
                    modified: 0,
                    added: 0,
                    deleted: 0,
                    untracked: 0,
                },
                recent_commits: vec![],
            }
        }
    }
}

fn get_current_branch(repo: &Repository) -> Option<String> {
    if let Ok(head) = repo.head() {
        if let Some(name) = head.shorthand() {
            return Some(name.to_string());
        }
    }
    None
}

fn get_remote_url(repo: &Repository) -> Option<String> {
    if let Ok(remote) = repo.find_remote("origin") {
        if let Some(url) = remote.url() {
            return Some(url.to_string());
        }
    }
    None
}

fn get_status(repo: &Repository) -> (bool, FileStats) {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .include_ignored(false)
        .include_unmodified(false);
    
    let mut file_stats = FileStats {
        modified: 0,
        added: 0,
        deleted: 0,
        untracked: 0,
    };
    
    let has_changes = if let Ok(statuses) = repo.statuses(Some(&mut opts)) {
        let mut has_changes = false;
        
        for entry in statuses.iter() {
            let status = entry.status();
            
            if status.contains(git2::Status::WT_MODIFIED) || status.contains(git2::Status::INDEX_MODIFIED) {
                file_stats.modified += 1;
                has_changes = true;
            }
            if status.contains(git2::Status::WT_NEW) || status.contains(git2::Status::INDEX_NEW) {
                file_stats.added += 1;
                has_changes = true;
            }
            if status.contains(git2::Status::WT_DELETED) || status.contains(git2::Status::INDEX_DELETED) {
                file_stats.deleted += 1;
                has_changes = true;
            }
            if status.contains(git2::Status::WT_NEW) && !status.contains(git2::Status::INDEX_NEW) {
                file_stats.untracked += 1;
                has_changes = true;
            }
        }
        
        has_changes
    } else {
        false
    };
    
    (has_changes, file_stats)
}

fn get_recent_commits(repo: &Repository, count: usize) -> Vec<CommitInfo> {
    let mut commits = Vec::new();
    
    if let Ok(mut revwalk) = repo.revwalk() {
        let _ = revwalk.push_head();
        
        for (idx, oid) in revwalk.enumerate() {
            if idx >= count {
                break;
            }
            
            if let Ok(oid) = oid {
                if let Ok(commit) = repo.find_commit(oid) {
                    let hash = commit.id().to_string();
                    let message = commit.summary().unwrap_or("").to_string();
                    let author = commit.author().name().unwrap_or("Unknown").to_string();
                    let timestamp = chrono::DateTime::<chrono::Utc>::from_timestamp(commit.time().seconds(), 0)
                        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                        .unwrap_or_else(|| "Unknown".to_string());
                    
                    commits.push(CommitInfo {
                        hash: hash[..8].to_string(), // Short hash
                        message,
                        author,
                        timestamp,
                    });
                }
            }
        }
    }
    
    commits
}