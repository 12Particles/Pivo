/**
 * AppShell - Main application shell that handles initialization
 */

import { useAppInitialization } from '@/hooks/infrastructure/useAppInitialization';
import { useGlobalKeyboardShortcuts } from '@/hooks/ui/useGlobalKeyboardShortcuts';
import { AppRouter } from './AppRouter';

export function AppShell() {
  // Initialize app
  useAppInitialization();
  useGlobalKeyboardShortcuts();
  
  return <AppRouter />;
}