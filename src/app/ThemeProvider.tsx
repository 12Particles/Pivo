import { PropsWithChildren } from 'react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeProvider({ children }: PropsWithChildren) {
  // Apply theme on mount and when settings change
  useTheme();
  
  return <>{children}</>;
}