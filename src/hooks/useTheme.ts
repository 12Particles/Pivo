import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

export function useTheme() {
  const { theme } = useSettings();

  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    const setupTheme = async () => {
      if (theme === 'system') {
        // Try to use Tauri API if available
        try {
          // Check if we're in a Tauri environment
          if (window.__TAURI__) {
            const { appWindow } = await import('@tauri-apps/api/window');
            const systemTheme = await appWindow.theme();
            applyTheme(systemTheme === 'dark');

            // Listen for system theme changes
            const unlisten = await appWindow.onThemeChanged(({ payload }: { payload: import('@tauri-apps/api/window').Theme }) => {
              if (theme === 'system') {
                applyTheme(payload === 'dark');
              }
            });
            cleanupFn = unlisten;
            return;
          }
        } catch (error) {
          console.warn('Tauri API not available, falling back to browser API');
        }

        // Fallback to browser's prefers-color-scheme
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        applyTheme(mediaQuery.matches);

        const handleChange = (e: MediaQueryListEvent) => {
          if (theme === 'system') {
            applyTheme(e.matches);
          }
        };

        mediaQuery.addEventListener('change', handleChange);
        cleanupFn = () => {
          mediaQuery.removeEventListener('change', handleChange);
        };
      } else {
        // Apply user-selected theme
        applyTheme(theme === 'dark');
      }
    };

    setupTheme();

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [theme]);
}