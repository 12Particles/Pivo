/**
 * ProjectsView - Main view for project selection and management
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Settings, ArrowLeft } from 'lucide-react';
import { ProjectList } from '@/features/projects/components/ProjectList';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { useApp } from '@/contexts/AppContext';
import { projectApi } from '@/services/api';
import { useTranslation } from 'react-i18next';
import { Project } from '@/types';
import { open } from '@tauri-apps/plugin-dialog';

export function ProjectsView() {
  const { t } = useTranslation();
  const { setCurrentProject, navigateTo } = useApp();
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadProjects();
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
  
  const createProjectFromGitDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('project.selectGitRepository')
      });
      
      if (!selected) return null;
      
      const path = Array.isArray(selected) ? selected[0] : selected;
      const project = await projectApi.create({
        name: path.split('/').pop() || 'New Project',
        path,
        description: ''
      });
      
      await loadProjects();
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      return null;
    }
  };
  
  const openSettings = () => {
    navigateTo('settings');
  };
  
  if (showProjectForm) {
    return (
      <div className="h-screen bg-background p-8">
        <Card className="max-w-2xl mx-auto p-6">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setShowProjectForm(false)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
            <h2 className="text-2xl font-bold">{t('project.createProject')}</h2>
          </div>
          <ProjectForm
            onSubmit={async () => {
              const project = await createProjectFromGitDirectory();
              if (project) {
                setShowProjectForm(false);
              }
            }}
            onCancel={() => setShowProjectForm(false)}
          />
        </Card>
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-background p-8">
      <div className="absolute top-4 right-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => openSettings()}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      
      <ProjectList
        projects={projects}
        loading={loading}
        onSelectProject={(project) => {
          setCurrentProject(project);
          navigateTo('tasks');
        }}
        onCreateProject={() => setShowProjectForm(true)}
      />
    </div>
  );
}