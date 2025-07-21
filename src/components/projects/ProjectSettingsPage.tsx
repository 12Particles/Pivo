import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Settings, AlertCircle, FolderOpen, GitBranch, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { Project } from "@/types";
import { projectApi } from "@/lib/api";
import { confirm } from "@tauri-apps/plugin-dialog";
import { open as shellOpen } from "@tauri-apps/plugin-shell";

interface ProjectSettingsPageProps {
  project: Project;
  onBack: () => void;
  onUpdate: (project: Project) => void;
  onDelete: () => void;
}

export function ProjectSettingsPage({ project, onBack, onUpdate, onDelete }: ProjectSettingsPageProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [projectData, setProjectData] = useState({
    name: project.name,
    description: project.description || "",
    path: project.path,
    git_repo: project.git_repo || "",
  });

  const handleSave = async () => {
    if (!projectData.name.trim()) {
      toast({
        title: t('toast.warning'),
        description: t('project.nameRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const updatedProject = await projectApi.update(project.id, {
        name: projectData.name,
        description: projectData.description || undefined,
        git_repo: projectData.git_repo || undefined,
      });
      
      onUpdate(updatedProject);
      toast({
        title: t('toast.success'),
        description: t('project.updated'),
      });
    } catch (error) {
      console.error('Failed to update project:', error);
      toast({
        title: t('toast.error'),
        description: t('project.updateFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm(
      t('project.deleteConfirmMessage', { name: project.name }),
      {
        title: t('project.deleteConfirmTitle'),
        kind: 'warning',
        okLabel: t('common.delete'),
      }
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      await projectApi.delete(project.id);
      toast({
        title: t('toast.success'),
        description: t('project.deleted'),
      });
      onDelete();
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast({
        title: t('toast.error'),
        description: t('project.deleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const openProjectFolder = async () => {
    try {
      await shellOpen(project.path);
    } catch (error) {
      console.error('Failed to open project folder:', error);
    }
  };

  return (
    <div className="h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <h1 className="text-2xl font-bold">{t('project.settings')}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="general">{t('settings.general')}</TabsTrigger>
            <TabsTrigger value="danger">{t('settings.dangerZone')}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('project.basicInfo')}</CardTitle>
                <CardDescription>
                  {t('project.basicInfoDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">{t('project.name')}</Label>
                  <Input
                    id="project-name"
                    value={projectData.name}
                    onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                    placeholder={t('project.namePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">{t('project.description')}</Label>
                  <Textarea
                    id="project-description"
                    value={projectData.description}
                    onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                    placeholder={t('project.descriptionPlaceholder')}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-path">{t('project.path')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="project-path"
                      value={projectData.path}
                      disabled
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={openProjectFolder}
                      title={t('project.openFolder')}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('project.pathDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-git">{t('project.gitRepository')}</Label>
                  <div className="flex gap-2 items-center">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="project-git"
                      value={projectData.git_repo}
                      onChange={(e) => setProjectData({ ...projectData, git_repo: e.target.value })}
                      placeholder="https://github.com/username/repo.git"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('project.gitDescription')}
                  </p>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? t('common.saving') : t('common.save')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger" className="space-y-4">
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
                <CardDescription>
                  {t('project.dangerZoneDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('project.deleteWarning')}
                  </AlertDescription>
                </Alert>

                <div className="mt-4">
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? t('common.deleting') : t('project.deleteProject')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}