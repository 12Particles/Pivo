/**
 * AppShell - Main application shell that handles initialization
 */

import { useAppInitialization } from '@/hooks/infrastructure/useAppInitialization';
import { useGlobalKeyboardShortcuts } from '@/hooks/ui/useGlobalKeyboardShortcuts';
import { useCopyHandler } from '@/hooks/ui/useCopyHandler';
import { AppRouter } from './AppRouter';
import { ErrorDialog } from '@/components/ui/error-dialog';

export function AppShell() {
  // Initialize app
  const { errorDialog } = useAppInitialization();
  useGlobalKeyboardShortcuts();
  useCopyHandler();
  
  return (
    <>
      <AppRouter />
      <ErrorDialog {...errorDialog} />
    </>
  );
}