/**
 * ProjectsView - Main view for project selection and management
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { ProjectList } from '@/features/projects/components/ProjectList';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { useApp } from '@/contexts/AppContext';
import { projectApi, ProjectInfo } from '@/services/api';
import { useTranslation } from 'react-i18next';
import { Project } from '@/types';

export function ProjectsView() {
  const { t } = useTranslation();
  const { setCurrentProject, navigateTo } = useApp();
  const [showProjectForm, setShowProjectForm] = useState(false);
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
      setSelectedProjectInfo(projectInfo);
      setShowProjectForm(true);
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
        setSelectedProjectInfo(projectInfo);
        setShowProjectForm(true);
      }
    } catch (error) {
      console.error('Failed to select project directory:', error);
    }
  };
  
  
  if (showProjectForm) {
    return (
      <div className="h-screen bg-background overflow-y-auto">
        <div className="p-8">
          <Card className="max-w-2xl mx-auto p-6">
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowProjectForm(false);
                  setSelectedProjectInfo(null);
                }}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back')}
              </Button>
              <h2 className="text-2xl font-bold">{t('project.createProject')}</h2>
            </div>
            <ProjectForm
            initialValues={selectedProjectInfo || undefined}
            onSubmit={async (values) => {
              try {
                const project = await projectApi.create({
                  name: values.name,
                  path: values.path,
                  description: values.description,
                  git_repo: values.git_repo,
                  setup_script: values.setup_script,
                  dev_script: values.dev_script
                });
                await loadProjects();
                setShowProjectForm(false);
                setSelectedProjectInfo(null);
                setCurrentProject(project);
                navigateTo('tasks');
              } catch (error) {
                console.error('Failed to create project:', error);
              }
            }}
            onCancel={() => {
              setShowProjectForm(false);
              setSelectedProjectInfo(null);
            }}
          />
          </Card>
        </div>
      </div>
    );
  }
  
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
    </div>
  );
}