/**
 * Global keyboard shortcuts hook
 */

import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLayout } from '@/contexts/LayoutContext';

export function useGlobalKeyboardShortcuts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { togglePanel } = useLayout();
  
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Command/Ctrl key combinations
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          // Layout shortcuts
          case 'b':
            e.preventDefault();
            togglePanel('left');
            break;
            
          case 'j':
            e.preventDefault();
            togglePanel('bottom');
            break;
            
          case 'k':
            e.preventDefault();
            togglePanel('right');
            break;
            
          // Log viewer
          case 'l':
            e.preventDefault();
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
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel, toast, t]);
}