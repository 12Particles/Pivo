import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Project, UpdateProjectRequest } from "@/types";
import { useTranslation } from "react-i18next";
import { projectApi } from "@/services/api";
import { useApp } from "@/contexts/AppContext";

interface ProjectSettingsDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (project: Project) => void;
  onDelete?: (projectId: string) => void;
}

export function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: ProjectSettingsDialogProps) {
  const { t } = useTranslation();
  const { setCurrentProject } = useApp();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateProjectRequest>({
    name: project?.name || "",
    description: project?.description || "",
    path: project?.path || "",
    git_repo: project?.git_repo || "",
    setup_script: project?.setup_script || "",
    dev_script: project?.dev_script || "",
  });

  // Update form data when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || "",
        path: project.path,
        git_repo: project.git_repo || "",
        setup_script: project.setup_script || "",
        dev_script: project.dev_script || "",
      });
    }
  }, [project]);

  const handleUpdate = async () => {
    if (!project) return;
    
    setLoading(true);
    try {
      const updatedProject = await projectApi.update(project.id, formData);
      onUpdate?.(updatedProject);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update project:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    
    if (!confirm(t('project.confirmDelete'))) {
      return;
    }
    
    setLoading(true);
    try {
      await projectApi.delete(project.id);
      onDelete?.(project.id);
      setCurrentProject(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete project:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{t('project.projectSettings')}</DialogTitle>
          <DialogDescription>
            {t('project.updateProjectSettings')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('project.projectName')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description">{t('project.projectDescription')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="path">{t('project.projectPath')}</Label>
            <Input
              id="path"
              value={formData.path}
              readOnly
              className="bg-muted"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="git_repo">{t('project.gitRepositoryUrl')}</Label>
            <Input
              id="git_repo"
              value={formData.git_repo}
              onChange={(e) => setFormData({ ...formData, git_repo: e.target.value })}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="setup_script">{t('project.setupScript')}</Label>
            <Textarea
              id="setup_script"
              value={formData.setup_script}
              onChange={(e) => setFormData({ ...formData, setup_script: e.target.value })}
              rows={2}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="dev_script">{t('project.devScript')}</Label>
            <Textarea
              id="dev_script"
              value={formData.dev_script}
              onChange={(e) => setFormData({ ...formData, dev_script: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {t('common.delete')}
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleUpdate} disabled={loading}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}