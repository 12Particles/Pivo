import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Project } from "@/types";
import { FolderOpen, GitBranch, Plus, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
import { projectApi } from "@/services/api";
import { useApp } from "@/contexts/AppContext";

interface ProjectListProps {
  projects: Project[];
  loading: boolean;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  onProjectsChange?: () => void;
}

export function ProjectList({ 
  projects,
  loading,
  onSelectProject, 
  onCreateProject,
  onProjectsChange
}: ProjectListProps) {
  const { t } = useTranslation();
  const { setCurrentProject } = useApp();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleSettingsClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setSelectedProject(project);
    setSettingsOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('project.projects')}</h2>
        <Button onClick={onCreateProject}>
          <Plus className="h-4 w-4 mr-2" />
          {t('project.createProject')}
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="p-8">
          <div className="text-center space-y-4">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-medium">{t('project.noProjects')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('project.createFirstProject')}
              </p>
            </div>
            <Button onClick={onCreateProject}>{t('project.createProject')}</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectProject(project)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => handleSettingsClick(e, project)}
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {project.description || t('project.noDescription')}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{project.path}</span>
                  </div>
                  {project.git_repo && (
                    <Badge variant="secondary" className="text-xs">
                      <GitBranch className="h-3 w-3 mr-1" />
                      Git
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {settingsOpen && selectedProject && (
        <ProjectSettingsDialog
          initialValues={{
            path: selectedProject.path,
            name: selectedProject.name,
            description: selectedProject.description || undefined,
            git_repo: selectedProject.git_repo || undefined,
            setup_script: selectedProject.setup_script || undefined,
            dev_script: selectedProject.dev_script || undefined,
            has_git: !!selectedProject.git_repo,
            has_package_json: false,
          }}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSubmit={async (values) => {
            await projectApi.update(selectedProject.id, {
              name: values.name,
              description: values.description,
              path: values.path,
              git_repo: values.git_repo,
              setup_script: values.setup_script,
              dev_script: values.dev_script,
            });
            onProjectsChange?.();
          }}
          onDelete={async () => {
            await projectApi.delete(selectedProject.id);
            setCurrentProject(null);
            onProjectsChange?.();
          }}
          isCreating={false}
        />
      )}
    </div>
  );
}