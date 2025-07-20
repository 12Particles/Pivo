use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiffMode {
    /// 工作区变更（未提交的修改）
    WorkingDirectory,
    
    /// 当前分支所有提交（相对于基线）
    BranchChanges { base_commit: String },
    
    /// 相对于远程基础分支的最新状态
    AgainstRemote { remote_branch: String },
    
    /// 特定提交范围
    CommitRange { from: String, to: String },
    
    /// PR/MR 预览（模拟合并后的变更）
    MergePreview { target_branch: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub mode: DiffMode,
    pub files: Vec<FileDiff>,
    pub stats: DiffStats,
    pub has_conflicts: bool,
    pub large_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>, // For renames
    pub status: FileStatus,
    pub chunks: Vec<DiffChunk>,
    pub additions: usize,
    pub deletions: usize,
    pub binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffChunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub content: String,
    pub line_type: LineType,
    pub old_line_number: Option<usize>,
    pub new_line_number: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineType {
    Context,
    Addition,
    Deletion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffStats {
    pub files_changed: usize,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseStatus {
    pub needs_rebase: bool,
    pub commits_behind: usize,
    pub commits_ahead: usize,
    pub can_fast_forward: bool,
    pub has_conflicts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: String,
    pub base_branch: String,
    pub base_commit: String,
}