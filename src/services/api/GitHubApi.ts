/**
 * GitHub API service for managing GitHub integration
 */

import { githubService } from '@/lib/services/githubService';
import { logger } from '@/lib/logger';
import type { MergeRequestInfo } from '@/lib/services/gitlabService';

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

export interface DeviceFlowResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface DeviceAuthStatus {
  status: 'success' | 'pending' | 'error';
  error?: string;
  slow_down?: boolean;
}

export class GitHubApi {
  private api = githubService;
  
  /**
   * Get GitHub configuration
   */
  async getConfig(): Promise<GitHubConfig | null> {
    logger.debug('Getting GitHub config');
    return this.api.getConfig();
  }
  
  /**
   * Update GitHub configuration
   */
  async updateConfig(config: GitHubConfig): Promise<void> {
    logger.info('Updating GitHub config');
    return this.api.updateConfig(config);
  }
  
  /**
   * Create a pull request
   */
  async createPullRequest(params: CreatePullRequestParams): Promise<MergeRequestInfo> {
    logger.info('Creating GitHub pull request', {
      taskAttemptId: params.taskAttemptId,
      sourceBranch: params.sourceBranch,
      targetBranch: params.targetBranch
    });
    return this.api.createPullRequest(params);
  }
  
  /**
   * Get pull request status
   */
  async getPullRequestStatus(
    taskAttemptId: string,
    remoteUrl: string,
    prNumber: number
  ): Promise<MergeRequestInfo> {
    logger.debug('Getting pull request status', { taskAttemptId, prNumber });
    return this.api.getPullRequestStatus(taskAttemptId, remoteUrl, prNumber);
  }
  
  /**
   * Push to GitHub
   */
  async pushToGitHub(
    repoPath: string,
    branch: string,
    force: boolean = false
  ): Promise<void> {
    logger.info('Pushing to GitHub', { repoPath, branch, force });
    return this.api.pushToGitHub(repoPath, branch, force);
  }
  
  /**
   * Start GitHub device flow authentication
   */
  async startDeviceFlow(): Promise<DeviceFlowResponse> {
    logger.info('Starting GitHub device flow');
    return this.api.startDeviceFlow();
  }
  
  /**
   * Poll device authorization status
   */
  async pollDeviceAuthorization(deviceCode: string): Promise<DeviceAuthStatus> {
    logger.debug('Polling device authorization');
    return this.api.pollDeviceAuthorization(deviceCode);
  }
  
  /**
   * Check if authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const config = await this.getConfig();
    return !!config?.accessToken;
  }
  
  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    logger.info('Clearing GitHub authentication');
    return this.updateConfig({});
  }
  
  /**
   * Get pull requests by task attempt ID
   */
  async getPullRequestsByAttempt(taskAttemptId: string): Promise<MergeRequestInfo[]> {
    logger.debug('Getting pull requests by attempt', { taskAttemptId });
    return this.api.getPullRequestsByAttempt(taskAttemptId);
  }
  
  /**
   * Get pull requests by task ID
   */
  async getPullRequestsByTask(taskId: string): Promise<MergeRequestInfo[]> {
    logger.debug('Getting pull requests by task', { taskId });
    return this.api.getPullRequestsByTask(taskId);
  }
}

// Export singleton instance
export const gitHubApi = new GitHubApi();