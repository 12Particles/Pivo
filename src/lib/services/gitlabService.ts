import { invoke } from '@tauri-apps/api/core';
import type { MergeRequest, MergeRequestInfo } from '../types/mergeRequest';

export interface GitLabConfig {
  pat?: string;
  gitlabUrl?: string;
  defaultBranch?: string;
}

export const gitlabService = {
  async getConfig(): Promise<GitLabConfig | null> {
    return invoke('get_gitlab_config');
  },

  async updateConfig(config: GitLabConfig): Promise<void> {
    return invoke('update_gitlab_config', { config });
  },

  async createMergeRequest(
    taskAttemptId: string,
    remoteUrl: string,
    title: string,
    description: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<MergeRequestInfo> {
    return invoke('create_gitlab_mr', {
      taskAttemptId,
      remoteUrl,
      title,
      description,
      sourceBranch,
      targetBranch,
    });
  },

  async getMergeRequestStatus(
    taskAttemptId: string,
    remoteUrl: string,
    mrNumber: number
  ): Promise<MergeRequestInfo> {
    return invoke('get_gitlab_mr_status', {
      taskAttemptId,
      remoteUrl,
      mrNumber,
    });
  },

  async pushToGitLab(
    repoPath: string,
    branch: string,
    force: boolean = false
  ): Promise<void> {
    return invoke('push_to_gitlab', {
      repoPath,
      branch,
      force,
    });
  },

  async detectGitProvider(remoteUrl: string): Promise<string> {
    return invoke('detect_git_provider', { remoteUrl });
  },

  async getMergeRequestsByAttempt(taskAttemptId: string): Promise<MergeRequest[]> {
    return invoke('get_merge_requests_by_attempt', { taskAttemptId });
  },

  async getMergeRequestsByTask(taskId: string): Promise<MergeRequest[]> {
    return invoke('get_merge_requests_by_task', { taskId });
  },

  async getActiveMergeRequests(provider?: string): Promise<MergeRequest[]> {
    return invoke('get_active_merge_requests', { provider });
  },
};