import { useState, useEffect, useCallback, useRef } from 'react';
import { gitHubApi, gitLabApi } from '@/services/api';
import type { MergeRequestInfo } from '@/types';
import { listen } from '@tauri-apps/api/event';

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
  
  // Use ref to store the latest refresh function
  const refreshRef = useRef<() => Promise<void>>();

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
  
  // Update ref whenever refresh changes
  refreshRef.current = refresh;

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for MR/PR updates from backend
  useEffect(() => {
    let unsubscribeFn: (() => void) | null = null;
    
    listen('vcs:merge-request-updated', (event) => {
      // When backend syncs MR/PR status, refresh the list
      console.log('Received MR/PR update event:', event.payload);
      // Use ref to always call the latest refresh function
      if (refreshRef.current) {
        refreshRef.current();
      }
    }).then(fn => {
      unsubscribeFn = fn;
    });

    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, []); // Empty dependency array - set up once

  return {
    pullRequests,
    loading,
    refresh,
  };
}