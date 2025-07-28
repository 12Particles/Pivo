/**
 * Git API service
 */

import { invoke } from '@tauri-apps/api/core';
import { gitApi as originalGitApi } from '@/lib/api';
import { GitStatus, GitInfo } from '@/types';

export class GitApi {
  private api = originalGitApi;
  
  /**
   * Get git status for a path
   */
  async getStatus(path: string): Promise<GitStatus> {
    return invoke<GitStatus>('get_git_status', { repoPath: path });
  }
  
  /**
   * Create a worktree
   */
  async createWorktree(projectPath: string, taskId: string, baseBranch: string): Promise<string> {
    return this.api.createWorktree(projectPath, taskId, baseBranch);
  }
  
  /**
   * Remove a worktree
   */
  async removeWorktree(projectPath: string, worktreePath: string): Promise<void> {
    return this.api.removeWorktree(projectPath, worktreePath);
  }
  
  /**
   * List worktrees
   */
  async listWorktrees(projectPath: string): Promise<any[]> {
    return invoke('list_worktrees', { projectPath });
  }
  
  /**
   * Commit changes
   */
  async commit(path: string, message: string): Promise<string> {
    return this.api.commit(path, message);
  }
  
  /**
   * Push changes
   */
  async push(path: string, branch: string, force: boolean = false): Promise<void> {
    return this.api.push(path, branch, force);
  }
  
  /**
   * Pull changes
   */
  async pull(path: string): Promise<void> {
    return invoke('git_pull', { path });
  }
  
  /**
   * Extract git info from a directory
   */
  async extractGitInfo(path: string): Promise<GitInfo> {
    return invoke<GitInfo>('extract_git_info', { path });
  }
  
  // Additional methods for backward compatibility
  async getCurrentBranch(repoPath: string): Promise<string> {
    return this.api.getCurrentBranch(repoPath);
  }
  
  async listBranches(repoPath: string): Promise<string[]> {
    return this.api.listBranches(repoPath);
  }
  
  async getDiff(repoPath: string, staged: boolean = false): Promise<string> {
    return this.api.getDiff(repoPath, staged);
  }
  
  async stageFiles(repoPath: string, files: string[]): Promise<void> {
    return this.api.stageFiles(repoPath, files);
  }
  
  async readFileContent(repoPath: string, filePath: string): Promise<string> {
    return this.api.readFileContent(repoPath, filePath);
  }
  
  async getFileFromRef(repoPath: string, fileRef: string): Promise<string> {
    return this.api.getFileFromRef(repoPath, fileRef);
  }
  
  async listAllFiles(directoryPath: string): Promise<any[]> {
    return this.api.listAllFiles(directoryPath);
  }
}

// Export singleton instance
export const gitApi = new GitApi();

// Also export as gitInfoApi for compatibility
export const gitInfoApi = {
  extractGitInfo: gitApi.extractGitInfo.bind(gitApi)
};