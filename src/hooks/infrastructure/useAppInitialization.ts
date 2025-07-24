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

export function useAppInitialization() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { navigateTo } = useApp();
  
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
}