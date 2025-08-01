use std::path::{Path, PathBuf};
use std::process::Command;
use crate::models::{DiffMode, DiffResult, FileDiff, FileStatus, DiffStats, RebaseStatus, WorktreeInfo};

#[derive(Debug, Clone)]
pub struct GitService {
    temp_dir: PathBuf,
}

impl GitService {
    pub fn new() -> Self {
        let temp_dir = std::env::temp_dir().join("pivo-worktrees");
        std::fs::create_dir_all(&temp_dir).ok();
        
        Self { temp_dir }
    }

    /// Create a new worktree for a task
    pub fn create_worktree(
        &self,
        repo_path: &Path,
        branch_name: &str,
        base_branch: &str,
    ) -> Result<PathBuf, String> {
        let worktree_name = branch_name;
        let worktree_path = self.temp_dir.join(&worktree_name);
        
        log::info!("Creating worktree for branch {} at {:?}", branch_name, worktree_path);
        
        // Create worktree
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&[
                "worktree",
                "add",
                "-b",
                branch_name,
                worktree_path.to_str().unwrap(),
                base_branch,
            ])
            .output()
            .map_err(|e| format!("Failed to create worktree: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr).to_string();
            log::error!("Failed to create worktree: {}", error);
            return Err(error);
        }

        log::info!("Successfully created worktree at {:?}", worktree_path);
        Ok(worktree_path)
    }
    
    /// Create a new worktree with baseline tracking
    pub fn create_worktree_with_baseline(
        &self,
        repo_path: &Path,
        branch_name: &str,
        base_branch: &str,
    ) -> Result<WorktreeInfo, String> {
        // Try to get the base branch, if it doesn't exist, try to detect the default branch
        let actual_base_branch = match self.get_branch_commit(repo_path, base_branch) {
            Ok(_) => base_branch.to_string(),
            Err(_) => {
                log::warn!("Base branch '{}' not found, trying to detect default branch", base_branch);
                // If the specified base branch doesn't exist, try to detect the default branch
                self.detect_default_branch(repo_path)?
            }
        };
        
        log::info!("Using base branch: {}", actual_base_branch);
        
        // Get the base commit using the actual base branch
        let base_commit = self.get_branch_commit(repo_path, &actual_base_branch)?;
        
        // Create the worktree
        let worktree_path = self.create_worktree(repo_path, branch_name, &actual_base_branch)?;
        
        Ok(WorktreeInfo {
            path: worktree_path.to_string_lossy().to_string(),
            branch: branch_name.to_string(),
            base_branch: actual_base_branch,
            base_commit,
        })
    }
    
    /// Detect the default branch of the repository
    pub fn detect_default_branch(&self, repo_path: &Path) -> Result<String, String> {
        // First, try to get the default branch from remote HEAD
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["symbolic-ref", "refs/remotes/origin/HEAD"])
            .output();
        
        if let Ok(output) = output {
            if output.status.success() {
                let remote_head = String::from_utf8_lossy(&output.stdout).trim().to_string();
                // Extract branch name from refs/remotes/origin/main
                if let Some(branch) = remote_head.split('/').last() {
                    log::info!("Detected default branch from remote HEAD: {}", branch);
                    return Ok(branch.to_string());
                }
            }
        }
        
        // If that doesn't work, try to list all branches and look for common default branch names
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["branch", "-r"])
            .output()
            .map_err(|e| format!("Failed to list remote branches: {}", e))?;
        
        if output.status.success() {
            let branches = String::from_utf8_lossy(&output.stdout);
            
            // Try common default branch names in order
            let common_defaults = ["main", "master", "develop", "development", "trunk"];
            for default in &common_defaults {
                if branches.contains(&format!("origin/{}", default)) {
                    log::info!("Found common default branch: {}", default);
                    return Ok(default.to_string());
                }
            }
            
            // If no common default found, try to get the first branch
            for line in branches.lines() {
                let branch = line.trim();
                if branch.starts_with("origin/") && !branch.contains("HEAD") {
                    let branch_name = branch.strip_prefix("origin/").unwrap_or(branch);
                    log::info!("Using first available branch: {}", branch_name);
                    return Ok(branch_name.to_string());
                }
            }
        }
        
        // Last resort: try current branch
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["rev-parse", "--abbrev-ref", "HEAD"])
            .output()
            .map_err(|e| format!("Failed to get current branch: {}", e))?;
        
        if output.status.success() {
            let current_branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !current_branch.is_empty() && current_branch != "HEAD" {
                log::info!("Using current branch as default: {}", current_branch);
                return Ok(current_branch);
            }
        }
        
        Err("Could not detect default branch".to_string())
    }
    
    /// Get the commit hash of a branch
    pub fn get_branch_commit(&self, repo_path: &Path, branch: &str) -> Result<String, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["rev-parse", branch])
            .output()
            .map_err(|e| format!("Failed to get branch commit: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    /// Remove a worktree
    pub fn remove_worktree(&self, repo_path: &Path, worktree_path: &Path) -> Result<(), String> {
        // First, remove the worktree
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["worktree", "remove", worktree_path.to_str().unwrap(), "--force"])
            .output()
            .map_err(|e| format!("Failed to remove worktree: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        // Clean up the directory if it still exists
        if worktree_path.exists() {
            std::fs::remove_dir_all(worktree_path).ok();
        }

        Ok(())
    }

    /// Get the current branch name
    pub fn get_current_branch(repo_path: &Path) -> Result<String, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["rev-parse", "--abbrev-ref", "HEAD"])
            .output()
            .map_err(|e| format!("Failed to get current branch: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    /// Get list of branches
    pub fn list_branches(repo_path: &Path) -> Result<Vec<String>, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["branch", "--format=%(refname:short)"])
            .output()
            .map_err(|e| format!("Failed to list branches: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let branches = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|s| s.to_string())
            .collect();

        Ok(branches)
    }

    // Removed unused method create_branch

    /// Get git diff
    pub fn get_diff(repo_path: &Path, staged: bool) -> Result<String, String> {
        let mut args = vec!["diff"];
        if staged {
            args.push("--staged");
        }

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to get diff: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
    
    /// Get comprehensive diff based on mode
    pub fn get_comprehensive_diff(&self, worktree_path: &Path, mode: DiffMode) -> Result<DiffResult, String> {
        match mode {
            DiffMode::WorkingDirectory => self.get_working_directory_diff(worktree_path),
            DiffMode::BranchChanges { base_commit } => self.get_branch_diff(worktree_path, &base_commit),
            DiffMode::AgainstRemote { remote_branch } => self.get_remote_diff(worktree_path, &remote_branch),
            DiffMode::CommitRange { from, to } => self.get_commit_range_diff(worktree_path, &from, &to),
            DiffMode::MergePreview { target_branch } => self.get_merge_preview_diff(worktree_path, &target_branch),
        }
    }
    
    /// Get working directory changes (staged and unstaged)
    fn get_working_directory_diff(&self, repo_path: &Path) -> Result<DiffResult, String> {
        let mut all_files = Vec::new();
        let mut stats = DiffStats {
            files_changed: 0,
            additions: 0,
            deletions: 0,
        };
        
        // Get unstaged changes
        let unstaged_output = Command::new("git")
            .current_dir(repo_path)
            .args(&["diff", "--numstat", "--name-status"])
            .output()
            .map_err(|e| format!("Failed to get unstaged diff: {}", e))?;
            
        // Get staged changes
        let staged_output = Command::new("git")
            .current_dir(repo_path)
            .args(&["diff", "--staged", "--numstat", "--name-status"])
            .output()
            .map_err(|e| format!("Failed to get staged diff: {}", e))?;
        
        // Parse both outputs
        self.parse_diff_output(&unstaged_output.stdout, &mut all_files, &mut stats)?;
        self.parse_diff_output(&staged_output.stdout, &mut all_files, &mut stats)?;
        
        Ok(DiffResult {
            mode: DiffMode::WorkingDirectory,
            files: all_files,
            stats,
            has_conflicts: false,
            large_files: vec![],
        })
    }
    
    /// Get all changes between base commit and current HEAD
    fn get_branch_diff(&self, repo_path: &Path, base_commit: &str) -> Result<DiffResult, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["diff", base_commit, "HEAD", "--numstat", "--name-status"])
            .output()
            .map_err(|e| format!("Failed to get branch diff: {}", e))?;
            
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        
        let mut files = Vec::new();
        let mut stats = DiffStats {
            files_changed: 0,
            additions: 0,
            deletions: 0,
        };
        
        self.parse_diff_output(&output.stdout, &mut files, &mut stats)?;
        
        Ok(DiffResult {
            mode: DiffMode::BranchChanges { base_commit: base_commit.to_string() },
            files,
            stats,
            has_conflicts: false,
            large_files: vec![],
        })
    }
    
    /// Get diff against remote branch
    fn get_remote_diff(&self, repo_path: &Path, remote_branch: &str) -> Result<DiffResult, String> {
        // First fetch the latest remote
        let fetch_output = Command::new("git")
            .current_dir(repo_path)
            .args(&["fetch", "origin", remote_branch])
            .output()
            .map_err(|e| format!("Failed to fetch remote: {}", e))?;
            
        if !fetch_output.status.success() {
            log::warn!("Failed to fetch remote: {}", String::from_utf8_lossy(&fetch_output.stderr));
        }
        
        // Get diff against remote
        let remote_ref = format!("origin/{}", remote_branch);
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["diff", &remote_ref, "HEAD", "--numstat", "--name-status"])
            .output()
            .map_err(|e| format!("Failed to get remote diff: {}", e))?;
            
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        
        let mut files = Vec::new();
        let mut stats = DiffStats {
            files_changed: 0,
            additions: 0,
            deletions: 0,
        };
        
        self.parse_diff_output(&output.stdout, &mut files, &mut stats)?;
        
        Ok(DiffResult {
            mode: DiffMode::AgainstRemote { remote_branch: remote_branch.to_string() },
            files,
            stats,
            has_conflicts: false,
            large_files: vec![],
        })
    }
    
    /// Get diff for a commit range
    fn get_commit_range_diff(&self, repo_path: &Path, from: &str, to: &str) -> Result<DiffResult, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["diff", from, to, "--numstat", "--name-status"])
            .output()
            .map_err(|e| format!("Failed to get commit range diff: {}", e))?;
            
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        
        let mut files = Vec::new();
        let mut stats = DiffStats {
            files_changed: 0,
            additions: 0,
            deletions: 0,
        };
        
        self.parse_diff_output(&output.stdout, &mut files, &mut stats)?;
        
        Ok(DiffResult {
            mode: DiffMode::CommitRange { from: from.to_string(), to: to.to_string() },
            files,
            stats,
            has_conflicts: false,
            large_files: vec![],
        })
    }
    
    /// Get merge preview diff
    fn get_merge_preview_diff(&self, repo_path: &Path, target_branch: &str) -> Result<DiffResult, String> {
        // This is a bit more complex - we need to simulate a merge
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["merge-tree", "--write-tree", target_branch, "HEAD"])
            .output()
            .map_err(|e| format!("Failed to get merge preview: {}", e))?;
            
        if !output.status.success() {
            // Fallback to simple diff
            return self.get_remote_diff(repo_path, target_branch);
        }
        
        // Parse merge-tree output (this is simplified, real implementation would be more complex)
        let mut files = Vec::new();
        let mut stats = DiffStats {
            files_changed: 0,
            additions: 0,
            deletions: 0,
        };
        
        // For now, just get the diff against target branch
        let diff_output = Command::new("git")
            .current_dir(repo_path)
            .args(&["diff", target_branch, "HEAD", "--numstat", "--name-status"])
            .output()
            .map_err(|e| format!("Failed to get diff: {}", e))?;
            
        self.parse_diff_output(&diff_output.stdout, &mut files, &mut stats)?;
        
        Ok(DiffResult {
            mode: DiffMode::MergePreview { target_branch: target_branch.to_string() },
            files,
            stats,
            has_conflicts: false,
            large_files: vec![],
        })
    }
    
    /// Parse git diff output
    fn parse_diff_output(&self, output: &[u8], files: &mut Vec<FileDiff>, stats: &mut DiffStats) -> Result<(), String> {
        let output_str = String::from_utf8_lossy(output);
        
        // Parse numstat format
        for line in output_str.lines() {
            if line.is_empty() {
                continue;
            }
            
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 3 {
                continue;
            }
            
            // Check if it's a name-status line (starts with a letter)
            if parts[0].len() == 1 && parts[0].chars().next().unwrap().is_alphabetic() {
                let status_char = parts[0].chars().next().unwrap();
                let path = parts[1].to_string();
                
                let status = match status_char {
                    'A' => FileStatus::Added,
                    'M' => FileStatus::Modified,
                    'D' => FileStatus::Deleted,
                    'R' => FileStatus::Renamed,
                    'C' => FileStatus::Copied,
                    '?' => FileStatus::Untracked,
                    _ => FileStatus::Modified,
                };
                
                // For now, create a simple file diff
                let file_diff = FileDiff {
                    path,
                    old_path: None,
                    status,
                    chunks: vec![],
                    additions: 0,
                    deletions: 0,
                    binary: false,
                };
                
                files.push(file_diff);
                stats.files_changed += 1;
            }
        }
        
        Ok(())
    }
    
    /// Check if rebase is needed
    pub fn check_rebase_status(&self, worktree_path: &Path, base_branch: &str) -> Result<RebaseStatus, String> {
        // Fetch latest changes
        let _fetch = Command::new("git")
            .current_dir(worktree_path)
            .args(&["fetch", "origin", base_branch])
            .output()
            .map_err(|e| format!("Failed to fetch: {}", e))?;
        
        // Get ahead/behind count
        let remote_ref = format!("origin/{}", base_branch);
        let output = Command::new("git")
            .current_dir(worktree_path)
            .args(&["rev-list", "--left-right", "--count", &format!("{}...HEAD", remote_ref)])
            .output()
            .map_err(|e| format!("Failed to get ahead/behind count: {}", e))?;
            
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        
        let counts = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = counts.trim().split_whitespace().collect();
        
        let behind = parts.get(0).and_then(|s| s.parse::<usize>().ok()).unwrap_or(0);
        let ahead = parts.get(1).and_then(|s| s.parse::<usize>().ok()).unwrap_or(0);
        
        Ok(RebaseStatus {
            needs_rebase: behind > 0,
            commits_behind: behind,
            commits_ahead: ahead,
            can_fast_forward: ahead == 0 && behind > 0,
            has_conflicts: false, // Would need to actually try merge to detect
        })
    }

    /// Stage files
    pub fn stage_files(repo_path: &Path, files: &[&str]) -> Result<(), String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .arg("add")
            .args(files)
            .output()
            .map_err(|e| format!("Failed to stage files: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(())
    }

    /// Commit changes
    pub fn commit(repo_path: &Path, message: &str) -> Result<String, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["commit", "-m", message])
            .output()
            .map_err(|e| format!("Failed to commit: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        // Get the commit hash
        let hash_output = Command::new("git")
            .current_dir(repo_path)
            .args(&["rev-parse", "HEAD"])
            .output()
            .map_err(|e| format!("Failed to get commit hash: {}", e))?;

        Ok(String::from_utf8_lossy(&hash_output.stdout).trim().to_string())
    }

    /// Push to remote
    pub fn push(repo_path: &Path, branch: &str, force: bool) -> Result<(), String> {
        let mut args = vec!["push", "origin", branch];
        if force {
            args.push("--force");
        }

        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to push: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(())
    }

    /// Get repository status
    pub fn get_status(&self, repo_path: &Path) -> Result<GitStatus, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["status", "--porcelain"])
            .output()
            .map_err(|e| format!("Failed to get status: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let status_text = String::from_utf8_lossy(&output.stdout);
        let mut files = GitStatus::default();

        for line in status_text.lines() {
            if line.len() < 3 {
                continue;
            }

            let status = &line[0..2];
            let filename = line[3..].to_string();

            match status {
                "??" => files.untracked.push(filename.clone()),
                " M" => {
                    files.modified.push(filename.clone());
                    files.changed.push(filename);
                }
                "MM" => {
                    files.modified.push(filename.clone());
                    files.staged.push(filename.clone());
                    files.changed.push(filename);
                }
                "M " => files.staged.push(filename),
                "A " => {
                    files.added.push(filename.clone());
                    files.staged.push(filename);
                }
                "AM" => {
                    files.added.push(filename.clone());
                    files.staged.push(filename.clone());
                    files.changed.push(filename);
                }
                "D " => {
                    files.deleted.push(filename.clone());
                    files.staged.push(filename);
                }
                "DM" => {
                    files.deleted.push(filename.clone());
                    files.staged.push(filename.clone());
                    files.changed.push(filename);
                }
                _ => {}
            }
        }

        // Get remotes
        let remote_output = Command::new("git")
            .current_dir(repo_path)
            .args(&["remote", "-v"])
            .output()
            .map_err(|e| format!("Failed to get remotes: {}", e))?;

        if remote_output.status.success() {
            let remote_text = String::from_utf8_lossy(&remote_output.stdout);
            let mut remotes_map = std::collections::HashMap::new();
            
            for line in remote_text.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    remotes_map.insert(parts[0], parts[1]);
                }
            }
            
            for (name, url) in remotes_map {
                files.remotes.push(RemoteInfo {
                    name: name.to_string(),
                    url: url.to_string(),
                });
            }
        }
        
        // Get current branch
        let branch_output = Command::new("git")
            .current_dir(repo_path)
            .args(&["rev-parse", "--abbrev-ref", "HEAD"])
            .output()
            .map_err(|e| format!("Failed to get current branch: {}", e))?;
        if branch_output.status.success() {
            files.branch = Some(String::from_utf8_lossy(&branch_output.stdout).trim().to_string());
        }
        
        // Get tracking branch and ahead/behind info
        if let Some(branch) = &files.branch {
            // Get tracking branch
            let tracking_output = Command::new("git")
                .current_dir(repo_path)
                .args(&["rev-parse", "--abbrev-ref", &format!("{}@{{upstream}}", branch)])
                .output();
            
            if let Ok(output) = tracking_output {
                if output.status.success() {
                    files.tracking = Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
                    
                    // Get ahead/behind counts
                    let rev_list_output = Command::new("git")
                        .current_dir(repo_path)
                        .args(&["rev-list", "--left-right", "--count", &format!("{}...{}@{{upstream}}", branch, branch)])
                        .output();
                    
                    if let Ok(output) = rev_list_output {
                        if output.status.success() {
                            let counts = String::from_utf8_lossy(&output.stdout);
                            let parts: Vec<&str> = counts.trim().split('\t').collect();
                            if parts.len() == 2 {
                                files.ahead = parts[0].parse().ok();
                                files.behind = parts[1].parse().ok();
                            }
                        }
                    }
                }
            }
        }

        Ok(files)
    }

    pub fn get_file_from_ref(repo_path: &Path, file_ref: &str) -> Result<String, String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["show", file_ref])
            .output()
            .map_err(|e| format!("Failed to get file from ref: {}", e))?;

        if !output.status.success() {
            // File might not exist in HEAD (new file)
            return Ok(String::new());
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

#[derive(Debug, Default, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitStatus {
    pub modified: Vec<String>,
    pub added: Vec<String>,
    pub deleted: Vec<String>,
    pub untracked: Vec<String>,
    pub remotes: Vec<RemoteInfo>,
    pub branch: Option<String>,
    pub tracking: Option<String>,
    pub ahead: Option<usize>,
    pub behind: Option<usize>,
    pub staged: Vec<String>,
    pub changed: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

// Removed unused GitStatus implementation