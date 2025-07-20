import { invoke } from "@tauri-apps/api/core";

// Git diff types
export interface DiffMode {
  type: 'workingDirectory' | 'branchChanges' | 'againstRemote' | 'commitRange' | 'mergePreview';
  baseCommit?: string;
  remoteBranch?: string;
  from?: string;
  to?: string;
  targetBranch?: string;
}

export interface DiffResult {
  mode: DiffMode;
  files: FileDiff[];
  stats: DiffStats;
  hasConflicts: boolean;
  largeFiles: string[];
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked';
  chunks: DiffChunk[];
  additions: number;
  deletions: number;
  binary: boolean;
}

export interface DiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  content: string;
  lineType: 'context' | 'addition' | 'deletion';
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface RebaseStatus {
  needsRebase: boolean;
  commitsBehind: number;
  commitsAhead: number;
  canFastForward: boolean;
  hasConflicts: boolean;
}

// Git API functions
export const gitApi = {
  // Enhanced diff functions
  getDiff: async (worktreePath: string, mode: DiffMode): Promise<DiffResult> => {
    // Convert the mode to the format expected by the backend
    let backendMode: any;
    switch (mode.type) {
      case 'workingDirectory':
        backendMode = 'WorkingDirectory';
        break;
      case 'branchChanges':
        backendMode = { BranchChanges: { base_commit: mode.baseCommit } };
        break;
      case 'againstRemote':
        backendMode = { AgainstRemote: { remote_branch: mode.remoteBranch } };
        break;
      case 'commitRange':
        backendMode = { CommitRange: { from: mode.from, to: mode.to } };
        break;
      case 'mergePreview':
        backendMode = { MergePreview: { target_branch: mode.targetBranch } };
        break;
    }
    
    return invoke<DiffResult>("get_git_diff", { 
      worktreePath,
      mode: backendMode
    });
  },

  checkRebaseStatus: async (worktreePath: string, baseBranch: string): Promise<RebaseStatus> => {
    return invoke<RebaseStatus>("check_rebase_status", { 
      worktreePath,
      baseBranch
    });
  },

  getBranchCommit: async (repoPath: string, branch: string): Promise<string> => {
    return invoke<string>("get_branch_commit", { 
      repoPath,
      branch
    });
  },
  
  // Original git functions
  createWorktree: async (repoPath: string, branchName: string, baseBranch: string): Promise<string> => {
    return invoke<string>("create_worktree", { 
      repoPath,
      branchName,
      baseBranch
    });
  },

  removeWorktree: async (repoPath: string, worktreePath: string): Promise<void> => {
    return invoke("remove_worktree", { 
      repoPath,
      worktreePath
    });
  },

  getCurrentBranch: async (repoPath: string): Promise<string> => {
    return invoke<string>("get_current_branch", { repoPath });
  },

  listBranches: async (repoPath: string): Promise<string[]> => {
    return invoke<string[]>("list_branches", { repoPath });
  },

  getStatus: async (repoPath: string): Promise<{
    modified: string[];
    added: string[];
    deleted: string[];
    untracked: string[];
    remotes: Array<{ name: string; url: string }>;
  }> => {
    return invoke("get_git_status", { repoPath });
  },

  stageFiles: async (repoPath: string, files: string[]): Promise<void> => {
    return invoke("stage_files", { repoPath, files });
  },

  commit: async (repoPath: string, message: string): Promise<string> => {
    return invoke<string>("commit_changes", { repoPath, message });
  },

  push: async (repoPath: string, branch: string, force: boolean = false): Promise<void> => {
    return invoke("push_branch", { repoPath, branch, force });
  },

  getSimpleDiff: async (repoPath: string, staged: boolean = false): Promise<string> => {
    return invoke<string>("get_diff", { repoPath, staged });
  },

  listAllFiles: async (repoPath: string): Promise<string[]> => {
    return invoke<string[]>("list_all_files", { repoPath });
  },

  readFileContent: async (repoPath: string, filePath: string): Promise<string> => {
    return invoke<string>("read_file_content", { repoPath, filePath });
  },

  getFileFromRef: async (repoPath: string, fileRef: string): Promise<string> => {
    return invoke<string>("get_file_from_ref", { repoPath, fileRef });
  }
};