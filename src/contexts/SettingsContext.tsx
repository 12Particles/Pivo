import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

interface SettingsContextValue {
  // General settings
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  notifications: boolean;
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: string) => void;
  setAutoSave: (autoSave: boolean) => void;
  setNotifications: (notifications: boolean) => void;
  updateSettings: (settings: Partial<SettingsContextValue>) => void;
}

const DEFAULT_SETTINGS = {
  theme: 'system' as const,
  language: 'en',
  autoSave: true,
  notifications: true,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Load from localStorage
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('app-settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('app-settings', JSON.stringify(settings));
  }, [settings]);

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    setSettings((prev: any) => ({ ...prev, theme }));
  };

  const setLanguage = (language: string) => {
    setSettings((prev: any) => ({ ...prev, language }));
  };

  const setAutoSave = (autoSave: boolean) => {
    setSettings((prev: any) => ({ ...prev, autoSave }));
  };

  const setNotifications = (notifications: boolean) => {
    setSettings((prev: any) => ({ ...prev, notifications }));
  };

  const updateSettings = (updates: Partial<SettingsContextValue>) => {
    setSettings((prev: any) => ({ ...prev, ...updates }));
  };

  return (
    <SettingsContext.Provider value={{
      ...settings,
      setTheme,
      setLanguage,
      setAutoSave,
      setNotifications,
      updateSettings,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

// For backward compatibility
export const useSettingsStore = useSettings;