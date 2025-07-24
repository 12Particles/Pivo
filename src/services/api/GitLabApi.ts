/**
 * GitLab API service for managing GitLab integration
 */

import { gitlabService } from '@/lib/services/gitlabService';
import { logger } from '@/lib/logger';
import type { MergeRequest, MergeRequestInfo } from '@/lib/types/mergeRequest';

export interface GitLabConfig {
  pat?: string;
  gitlabUrl?: string;
  defaultBranch?: string;
}

export interface CreateMergeRequestParams {
  taskAttemptId: string;
  remoteUrl: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
}

export class GitLabApi {
  private api = gitlabService;
  
  /**
   * Get GitLab configuration
   */
  async getConfig(): Promise<GitLabConfig | null> {
    logger.debug('Getting GitLab config');
    return this.api.getConfig();
  }
  
  /**
   * Update GitLab configuration
   */
  async updateConfig(config: GitLabConfig): Promise<void> {
    logger.info('Updating GitLab config');
    return this.api.updateConfig(config);
  }
  
  /**
   * Create a merge request
   */
  async createMergeRequest(params: CreateMergeRequestParams): Promise<MergeRequestInfo> {
    logger.info('Creating GitLab merge request', {
      taskAttemptId: params.taskAttemptId,
      sourceBranch: params.sourceBranch,
      targetBranch: params.targetBranch
    });
    
    return this.api.createMergeRequest(
      params.taskAttemptId,
      params.remoteUrl,
      params.title,
      params.description,
      params.sourceBranch,
      params.targetBranch
    );
  }
  
  /**
   * Get merge request status
   */
  async getMergeRequestStatus(
    taskAttemptId: string,
    remoteUrl: string,
    mrNumber: number
  ): Promise<MergeRequestInfo> {
    logger.debug('Getting merge request status', { taskAttemptId, mrNumber });
    return this.api.getMergeRequestStatus(taskAttemptId, remoteUrl, mrNumber);
  }
  
  /**
   * Push to GitLab
   */
  async pushToGitLab(
    repoPath: string,
    branch: string,
    force: boolean = false
  ): Promise<void> {
    logger.info('Pushing to GitLab', { repoPath, branch, force });
    return this.api.pushToGitLab(repoPath, branch, force);
  }
  
  /**
   * Detect Git provider from remote URL
   */
  async detectGitProvider(remoteUrl: string): Promise<string> {
    logger.debug('Detecting Git provider', { remoteUrl });
    return this.api.detectGitProvider(remoteUrl);
  }
  
  /**
   * Get merge requests by task attempt
   */
  async getMergeRequestsByAttempt(taskAttemptId: string): Promise<MergeRequest[]> {
    logger.debug('Getting merge requests by attempt', { taskAttemptId });
    return this.api.getMergeRequestsByAttempt(taskAttemptId);
  }
  
  /**
   * Get merge requests by task
   */
  async getMergeRequestsByTask(taskId: string): Promise<MergeRequest[]> {
    logger.debug('Getting merge requests by task', { taskId });
    return this.api.getMergeRequestsByTask(taskId);
  }
  
  /**
   * Get active merge requests
   */
  async getActiveMergeRequests(provider?: string): Promise<MergeRequest[]> {
    logger.debug('Getting active merge requests', { provider });
    return this.api.getActiveMergeRequests(provider);
  }
  
  /**
   * Check if authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const config = await this.getConfig();
    return !!config?.pat;
  }
  
  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    logger.info('Clearing GitLab authentication');
    return this.updateConfig({});
  }
}

// Export singleton instance
export const gitLabApi = new GitLabApi();