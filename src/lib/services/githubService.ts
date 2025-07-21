import { invoke } from '@tauri-apps/api/core';
import type { MergeRequestInfo } from './gitlabService';

export interface GitHubConfig {
  accessToken?: string;
  username?: string;
  defaultBranch?: string;
}

export interface CreatePullRequestParams {
  taskAttemptId: string;
  remoteUrl: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
}

class GitHubService {
  async getConfig(): Promise<GitHubConfig | null> {
    try {
      return await invoke<GitHubConfig | null>('get_github_config');
    } catch (error) {
      console.error('Failed to get GitHub config:', error);
      throw error;
    }
  }

  async updateConfig(config: GitHubConfig): Promise<void> {
    try {
      await invoke('update_github_config', { config });
    } catch (error) {
      console.error('Failed to update GitHub config:', error);
      throw error;
    }
  }

  async createPullRequest(params: CreatePullRequestParams): Promise<MergeRequestInfo> {
    try {
      const { taskAttemptId, remoteUrl, title, description, sourceBranch, targetBranch } = params;
      return await invoke<MergeRequestInfo>('create_github_pr', {
        taskAttemptId,
        remoteUrl,
        title,
        description,
        sourceBranch,
        targetBranch,
      });
    } catch (error) {
      console.error('Failed to create GitHub PR:', error);
      throw error;
    }
  }

  async getPullRequestStatus(
    taskAttemptId: string,
    remoteUrl: string,
    prNumber: number
  ): Promise<MergeRequestInfo> {
    try {
      return await invoke<MergeRequestInfo>('get_github_pr_status', {
        taskAttemptId,
        remoteUrl,
        prNumber,
      });
    } catch (error) {
      console.error('Failed to get GitHub PR status:', error);
      throw error;
    }
  }

  async pushToGitHub(repoPath: string, branch: string, force: boolean = false): Promise<void> {
    try {
      await invoke('push_to_github', { repoPath, branch, force });
    } catch (error) {
      console.error('Failed to push to GitHub:', error);
      throw error;
    }
  }

  async startDeviceFlow(): Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }> {
    try {
      return await invoke('github_start_device_flow');
    } catch (error) {
      console.error('Failed to start device flow:', error);
      throw error;
    }
  }

  async pollDeviceAuthorization(deviceCode: string): Promise<{
    status: 'success' | 'pending' | 'error';
    error?: string;
    slow_down?: boolean;
  }> {
    try {
      return await invoke('github_poll_device_auth', { deviceCode });
    } catch (error) {
      console.error('Failed to poll device authorization:', error);
      throw error;
    }
  }
}

export const githubService = new GitHubService();