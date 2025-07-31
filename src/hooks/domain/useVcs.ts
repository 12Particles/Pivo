import { useState, useEffect, useCallback } from 'react';
import { gitHubApi, gitLabApi } from '@/services/api';
import type { MergeRequestInfo } from '@/types';

export function useGitHubAuth() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasAuth, setHasAuth] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const authConfig = await gitHubApi.getConfig();
      setConfig(authConfig);
      setHasAuth(!!authConfig?.accessToken);
    } catch (error) {
      console.error('Failed to check GitHub auth:', error);
      setHasAuth(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    config,
    loading,
    update: gitHubApi.updateConfig,
    refresh,
    hasAuth,
  };
}

export function useGitLabAuth() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const authConfig = await gitLabApi.getConfig();
      setConfig(authConfig);
    } catch (error) {
      console.error('Failed to check GitLab auth:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    config,
    loading,
    update: gitLabApi.updateConfig,
  };
}

export function useVcsPullRequests(options: {
  taskId?: string;
  taskAttemptId?: string;
  provider: 'github' | 'gitlab';
}) {
  const [pullRequests, setPullRequests] = useState<MergeRequestInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!options.taskId && !options.taskAttemptId) return;

    try {
      setLoading(true);
      let prs: MergeRequestInfo[] = [];

      if (options.provider === 'github') {
        if (options.taskAttemptId) {
          prs = await gitHubApi.getPullRequestsByAttempt(options.taskAttemptId);
        } else if (options.taskId) {
          prs = await gitHubApi.getPullRequestsByTask(options.taskId);
        }
      } else if (options.provider === 'gitlab') {
        if (options.taskAttemptId) {
          prs = await gitLabApi.getMergeRequestsByAttempt(options.taskAttemptId);
        } else if (options.taskId) {
          prs = await gitLabApi.getMergeRequestsByTask(options.taskId);
        }
      }

      setPullRequests(prs);
    } catch (error) {
      console.error('Failed to load pull requests:', error);
      setPullRequests([]);
    } finally {
      setLoading(false);
    }
  }, [options.taskId, options.taskAttemptId, options.provider]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    pullRequests,
    loading,
    refresh,
  };
}