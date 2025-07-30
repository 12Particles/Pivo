/**
 * App initialization hook - handles all startup logic
 */

import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useEvent } from './useEventBus';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/contexts/AppContext';
import { projectApi, mcpApi } from '@/services/api';
import { useErrorDialog } from '@/hooks/use-error-dialog';

export function useAppInitialization() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { navigateTo, setCurrentProject } = useApp();
  const { errorDialog, showError } = useErrorDialog();
  
  useEffect(() => {
    // Initialize logger
    logger.init().then(() => {
      logger.info('Pivo application started');
    });
    
    // Initialize MCP servers
    mcpApi.list().then(servers => {
      logger.info(`Found ${servers.length} MCP servers`);
    }).catch(error => {
      logger.error('Failed to list MCP servers', error);
    });
    
    // Refresh git providers for all projects on app start
    projectApi.refreshAllGitProviders().catch((error: any) => {
      logger.error('Failed to refresh git providers on startup', error);
    });
    
    return () => {
      logger.destroy();
    };
  }, []);
  
  // Handle menu events
  useEvent('menu-view-logs', async () => {
    try {
      await invoke('show_log_viewer');
    } catch (error) {
      console.error('Failed to open log viewer:', error);
      toast({
        title: t('common.error'),
        description: t('logs.openFailed'),
        variant: 'destructive',
      });
    }
  });
  
  useEvent('menu-logs-cleared', () => {
    toast({
      title: t('common.success'),
      description: t('logs.logsCleared'),
    });
  });
  
  useEvent('menu-settings', () => {
    navigateTo('settings');
  });
  
  useEvent('menu-open-project', async () => {
    try {
      // Open directory picker dialog
      const selectedPath = await projectApi.selectProjectDirectory();
      if (selectedPath) {
        // Read project info from the selected directory
        const projectInfo = await projectApi.readProjectInfo(selectedPath);
        // Store project info temporarily
        sessionStorage.setItem('pendingProjectInfo', JSON.stringify(projectInfo));
        // Navigate to projects view - it will handle the project creation form
        navigateTo('projects');
      }
    } catch (error: any) {
      logger.error('Failed to open project', error);
      console.error('Error object:', error);
      // Tauri errors come as strings, not Error objects
      const errorMessage = typeof error === 'string' ? error : (error.message || t('project.openFailed'));
      showError(
        errorMessage,
        t('common.error')
      );
    }
  });
  
  useEvent('menu-open-recent-project', async (projectId: string) => {
    try {
      const project = await projectApi.get(projectId);
      if (project) {
        // Update last opened time
        await projectApi.updateLastOpened(projectId);
        // Set current project and navigate to tasks
        setCurrentProject(project);
        navigateTo('tasks');
      }
    } catch (error) {
      logger.error('Failed to open recent project', error);
      toast({
        title: t('common.error'),
        description: t('project.openFailed'),
        variant: 'destructive',
      });
    }
  });
  
  return { errorDialog };
}