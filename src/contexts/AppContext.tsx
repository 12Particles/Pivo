import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Project } from '@/types';
import { eventBus } from '@/lib/events/EventBus';

interface AppContextValue {
  // Navigation state
  currentView: 'projects' | 'tasks' | 'settings' | 'projectSettings' | 'dev';
  settingsTab?: string;
  
  // Current project
  currentProject: Project | null;
  
  // Actions
  navigateTo: (view: 'projects' | 'tasks' | 'settings' | 'projectSettings' | 'dev', options?: { tab?: string }) => void;
  setCurrentProject: (project: Project | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<AppContextValue['currentView']>('projects');
  const [settingsTab, setSettingsTab] = useState<string>();
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);

  const navigateTo = (view: AppContextValue['currentView'], options?: { tab?: string }) => {
    setCurrentView(view);
    if (view === 'settings' && options?.tab) {
      setSettingsTab(options.tab);
    }
  };

  const setCurrentProject = (project: Project | null) => {
    setCurrentProjectState(project);
    if (project) {
      setCurrentView('tasks');
    } else {
      setCurrentView('projects');
    }
  };

  // Listen for navigation events
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('open-settings', ({ tab }) => {
      navigateTo('settings', { tab });
    });

    return unsubscribe;
  }, []);

  return (
    <AppContext.Provider value={{
      currentView,
      settingsTab,
      currentProject,
      navigateTo,
      setCurrentProject,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}