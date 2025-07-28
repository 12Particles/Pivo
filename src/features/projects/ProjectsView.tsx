/**
 * ProjectsView - Main view for project selection and management
 */

import { useState, useEffect } from 'react';
import { ProjectList } from '@/features/projects/components/ProjectList';
import { ProjectSettingsDialog } from '@/features/projects/components/ProjectSettingsDialog';
import { useApp } from '@/contexts/AppContext';
import { projectApi, ProjectInfo } from '@/services/api';
import { Project } from '@/types';
import { transformGitUrl } from '@/lib/gitUrlUtils';

export function ProjectsView() {
  const { setCurrentProject, navigateTo } = useApp();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectInfo, setSelectedProjectInfo] = useState<ProjectInfo | null>(null);
  
  useEffect(() => {
    loadProjects();
    
    // Check if there's pending project info from menu action
    const pendingProjectInfo = sessionStorage.getItem('pendingProjectInfo');
    if (pendingProjectInfo) {
      const projectInfo = JSON.parse(pendingProjectInfo) as ProjectInfo;
      sessionStorage.removeItem('pendingProjectInfo');
      console.log('Pending project info from session:', projectInfo);
      
      // Transform git_repo URL if it exists from backend
      if (projectInfo.git_repo) {
        const transformedUrl = transformGitUrl(projectInfo.git_repo);
        console.log('Transforming pending project backend Git URL:', projectInfo.git_repo, '->', transformedUrl);
        projectInfo.git_repo = transformedUrl;
      }
      
      setSelectedProjectInfo(projectInfo);
      setShowCreateDialog(true);
    }
  }, []);
  
  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsList = await projectApi.list();
      setProjects(projectsList);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectProjectDirectory = async () => {
    try {
      const selectedPath = await projectApi.selectProjectDirectory();
      if (selectedPath) {
        // Read project info from the selected directory
        const projectInfo = await projectApi.readProjectInfo(selectedPath);
        console.log('Project info from backend:', projectInfo);
        
        // Transform git_repo URL if it exists from backend
        if (projectInfo.git_repo) {
          const transformedUrl = transformGitUrl(projectInfo.git_repo);
          console.log('Transforming backend Git URL:', projectInfo.git_repo, '->', transformedUrl);
          projectInfo.git_repo = transformedUrl;
        }
        
        setSelectedProjectInfo(projectInfo);
        setShowCreateDialog(true);
      }
    } catch (error) {
      console.error('Failed to select project directory:', error);
    }
  };
  
  
  return (
    <div className="h-screen bg-background p-8">
      <ProjectList
        projects={projects}
        loading={loading}
        onSelectProject={async (project) => {
          try {
            // Update last opened time
            await projectApi.updateLastOpened(project.id);
            setCurrentProject(project);
            navigateTo('tasks');
          } catch (error) {
            console.error('Failed to update last opened time:', error);
            // Still navigate even if update fails
            setCurrentProject(project);
            navigateTo('tasks');
          }
        }}
        onCreateProject={handleSelectProjectDirectory}
        onProjectsChange={loadProjects}
      />
      
      <ProjectSettingsDialog
        initialValues={selectedProjectInfo || undefined}
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setSelectedProjectInfo(null);
          }
        }}
        onSubmit={async (values) => {
          const project = await projectApi.create({
            name: values.name,
            path: values.path,
            description: values.description,
            git_repo: values.git_repo,
            setup_script: values.setup_script,
            dev_script: values.dev_script
          });
          await loadProjects();
          setSelectedProjectInfo(null);
          setCurrentProject(project);
          navigateTo('tasks');
        }}
        isCreating={true}
      />
    </div>
  );
}