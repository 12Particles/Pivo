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
import { FolderOpen } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { ProjectInfo } from "@/services/api";
import { transformGitUrl } from "@/lib/gitUrlUtils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ProjectSettingsDialogProps {
  initialValues?: ProjectInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>;
  isCreating?: boolean;
}

export function ProjectSettingsDialog({
  initialValues,
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  isCreating = true,
}: ProjectSettingsDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    path: "",
    git_repo: "",
    setup_script: "",
    dev_script: "",
  });

  // Update form data when initialValues change
  useEffect(() => {
    if (initialValues) {
      setFormData({
        name: initialValues.name || "",
        description: initialValues.description || "",
        path: initialValues.path || "",
        git_repo: initialValues.git_repo || "",
        setup_script: initialValues.setup_script || "",
        dev_script: initialValues.dev_script || "",
      });
    } else {
      // Reset form when dialog opens for creation
      setFormData({
        name: "",
        description: "",
        path: "",
        git_repo: "",
        setup_script: "",
        dev_script: "",
      });
    }
  }, [initialValues, open]);

  const handleSelectPath = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t('project.selectProjectDirectory'),
    });

    if (selected) {
      setFormData({ ...formData, path: selected });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.path) {
      return;
    }

    setLoading(true);
    try {
      // Transform Git URL before submitting
      const transformedFormData = {
        ...formData,
        git_repo: formData.git_repo ? transformGitUrl(formData.git_repo) : formData.git_repo
      };
      
      await onSubmit(transformedFormData);
      onOpenChange(false);
    } catch (error) {
      console.error(isCreating ? 'Failed to create project:' : 'Failed to update project:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isCreating ? t('project.createProject') : t('project.projectSettings')}</DialogTitle>
            <DialogDescription>
              {isCreating ? t('project.createFirstProject') : t('project.updateProjectSettings')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('project.projectName')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('project.myProject')}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">{t('project.projectDescription')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('project.describeYourProject')}
                rows={3}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="path">{t('project.projectPath')} *</Label>
              <div className="flex gap-2">
                <Input
                  id="path"
                  value={formData.path}
                  onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                  placeholder="/path/to/project"
                  required
                  readOnly={!isCreating}
                  className={!isCreating ? "bg-muted" : ""}
                />
                {isCreating && (
                  <Button type="button" variant="outline" onClick={handleSelectPath}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="git_repo">{t('project.gitRepositoryUrl')}</Label>
              <Input
                id="git_repo"
                value={formData.git_repo}
                onChange={(e) => setFormData({ ...formData, git_repo: e.target.value })}
                onBlur={(e) => {
                  const transformed = transformGitUrl(e.target.value);
                  if (transformed !== e.target.value) {
                    setFormData({ ...formData, git_repo: transformed });
                  }
                }}
                placeholder="e.g., git@github.com:user/repo.git or https://github.com/user/repo"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="setup_script">{t('project.setupScript')}</Label>
              <Textarea
                id="setup_script"
                value={formData.setup_script}
                onChange={(e) => setFormData({ ...formData, setup_script: e.target.value })}
                placeholder="npm install"
                rows={2}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="dev_script">{t('project.devScript')}</Label>
              <Textarea
                id="dev_script"
                value={formData.dev_script}
                onChange={(e) => setFormData({ ...formData, dev_script: e.target.value })}
                placeholder="npm run dev"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            {!isCreating && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="mr-auto"
              >
                {t('common.delete')}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !formData.name || !formData.path}>
              {isCreating ? t('project.createProject') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('project.deleteProject')}
        description={t('project.deleteConfirmMessage', { name: formData.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="destructive"
        onConfirm={async () => {
          setLoading(true);
          try {
            await onDelete!();
            onOpenChange(false);
          } catch (error) {
            console.error('Failed to delete project:', error);
          } finally {
            setLoading(false);
            setShowDeleteConfirm(false);
          }
        }}
      />
    </Dialog>
  );
}