/**
 * AppRouter - Centralized routing logic
 */

import { useApp } from '@/contexts/AppContext';
import { ProjectsView } from '@/features/projects/ProjectsView';
import { TasksView } from '@/features/tasks/TasksView';
import { SettingsPage } from '@/features/settings/components/SettingsPage';
import { ProjectSettingsPage } from '@/features/projects/components/ProjectSettingsPage';

export function AppRouter() {
  const { currentView, currentProject, settingsTab, navigateTo, setCurrentProject } = useApp();
  
  // Handle project deletion
  const handleProjectDelete = () => {
    setCurrentProject(null);
    navigateTo('projects');
  };
  
  const handleProjectUpdate = (updated: import('@/types').Project) => {
    setCurrentProject(updated);
    navigateTo('tasks');
  };
  
  // Settings view
  if (currentView === 'settings') {
    return (
      <SettingsPage 
        onBack={() => navigateTo(currentProject ? 'tasks' : 'projects')} 
        initialCategory={settingsTab} 
      />
    );
  }
  
  // Project settings view
  if (currentView === 'projectSettings' && currentProject) {
    return (
      <ProjectSettingsPage
        project={currentProject}
        onBack={() => navigateTo('tasks')}
        onUpdate={handleProjectUpdate}
        onDelete={handleProjectDelete}
      />
    );
  }
  
  // No project selected - show project list
  if (!currentProject || currentView === 'projects') {
    return <ProjectsView />;
  }
  
  // Main tasks view
  return <TasksView />;
}