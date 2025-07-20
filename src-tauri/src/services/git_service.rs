use std::path::{Path, PathBuf};
use std::process::Command;

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
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(worktree_path)
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

    /// Create a new branch
    pub fn create_branch(repo_path: &Path, branch_name: &str, base_branch: &str) -> Result<(), String> {
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["checkout", "-b", branch_name, base_branch])
            .output()
            .map_err(|e| format!("Failed to create branch: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(())
    }

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
                "??" => files.untracked.push(filename),
                " M" | "MM" => files.modified.push(filename),
                "A " | "AM" => files.added.push(filename),
                "D " | "DM" => files.deleted.push(filename),
                _ => {}
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
}

impl GitStatus {
    pub fn has_changes(&self) -> bool {
        !self.modified.is_empty()
            || !self.added.is_empty()
            || !self.deleted.is_empty()
            || !self.untracked.is_empty()
    }
}