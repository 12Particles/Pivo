/**
 * AppProviders - Centralized provider composition
 * All context providers and app-level setup should be here
 */

import { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/features/error/components/ErrorBoundary';
import { ErrorNotification } from '@/features/error/components/ErrorNotification';
import { AppProvider } from '@/contexts/AppContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ErrorProvider } from '@/contexts/ErrorContext';
import { ThemeProvider } from './ThemeProvider';

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

interface AppProvidersProps extends PropsWithChildren {
  // Add any provider-specific props here if needed
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ErrorProvider>
          <SettingsProvider>
            <ThemeProvider>
              <LayoutProvider>
                <AppProvider>
                  {children}
                  <Toaster />
                  <ErrorNotification />
                </AppProvider>
              </LayoutProvider>
            </ThemeProvider>
          </SettingsProvider>
        </ErrorProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}