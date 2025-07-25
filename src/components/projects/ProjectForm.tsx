import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreateProjectRequest } from "@/types";
import { FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";

interface ProjectFormProps {
  onSubmit: (data: CreateProjectRequest) => void;
  onCancel: () => void;
}

export function ProjectForm({ onSubmit, onCancel }: ProjectFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: "",
    description: "",
    path: "",
    git_repo: "",
    setup_script: "",
    dev_script: "",
  });

  const handleSelectPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('project.selectProjectDirectory'),
    });

    if (selected) {
      setFormData({ ...formData, path: selected });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">{t('project.projectName')} *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t('project.myProject')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('project.projectDescription')}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={t('project.describeYourProject')}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="path">{t('project.projectPath')} *</Label>
        <div className="flex gap-2">
          <Input
            id="path"
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            placeholder="/path/to/project"
            required
          />
          <Button type="button" variant="outline" onClick={handleSelectPath}>
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="git_repo">{t('project.gitRepositoryUrl')}</Label>
        <Input
          id="git_repo"
          value={formData.git_repo}
          onChange={(e) => setFormData({ ...formData, git_repo: e.target.value })}
          placeholder="https://github.com/user/repo.git"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="setup_script">{t('project.setupScript')}</Label>
        <Textarea
          id="setup_script"
          value={formData.setup_script}
          onChange={(e) => setFormData({ ...formData, setup_script: e.target.value })}
          placeholder="npm install"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dev_script">{t('project.devScript')}</Label>
        <Textarea
          id="dev_script"
          value={formData.dev_script}
          onChange={(e) => setFormData({ ...formData, dev_script: e.target.value })}
          placeholder="npm run dev"
          rows={2}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{t('project.createProject')}</Button>
      </div>
    </form>
  );
}