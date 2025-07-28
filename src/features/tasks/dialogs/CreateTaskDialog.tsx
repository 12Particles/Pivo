import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskPriority, CreateTaskRequest } from "@/types";
import { useTranslation } from "react-i18next";
import { ImageUpload } from "@/components/ui/image-upload";
import { Play } from "lucide-react";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSubmit: (data: CreateTaskRequest, shouldStart?: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange, projectId, onSubmit }: CreateTaskDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<CreateTaskRequest>>({
    project_id: projectId,
    title: "",
    description: "",
    priority: TaskPriority.Medium,
    tags: [],
  });

  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const handleSubmit = (shouldStart: boolean = false) => {
    if (!formData.title?.trim()) return;
    
    // If we have images, append them to the description
    let finalDescription = formData.description || "";
    if (images.length > 0) {
      finalDescription += "\n\n" + t('task.attachedImages', { count: images.length });
      // Note: In a full implementation, we would handle image storage and references here
    }
    
    onSubmit({
      project_id: projectId,
      title: formData.title,
      description: finalDescription,
      priority: formData.priority || TaskPriority.Medium,
      tags: formData.tags,
    }, shouldStart);

    // Reset form
    setFormData({
      project_id: projectId,
      title: "",
      description: "",
      priority: TaskPriority.Medium,
      tags: [],
    });
    setTagInput("");
    setImages([]);
    onOpenChange(false);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && formData.tags) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (index: number) => {
    if (formData.tags) {
      setFormData({
        ...formData,
        tags: formData.tags.filter((_, i) => i !== index),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }}>
          <DialogHeader>
            <DialogTitle>{t('task.createTask')}</DialogTitle>
            <DialogDescription>
              {t('task.addTaskToProject')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">{t('task.taskTitle')} *</Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('task.enterTaskTitle')}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">{t('task.taskDescription')}</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('task.enterTaskDescription')}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">{t('common.priority')}</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TaskPriority.Low}>{t('task.taskPriority.low')}</SelectItem>
                  <SelectItem value={TaskPriority.Medium}>{t('task.taskPriority.medium')}</SelectItem>
                  <SelectItem value={TaskPriority.High}>{t('task.taskPriority.high')}</SelectItem>
                  <SelectItem value={TaskPriority.Urgent}>{t('task.taskPriority.urgent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">{t('task.tags')}</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder={t('task.addTag')}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  {t('common.add')}
                </Button>
              </div>
              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag, index) => (
                    <div
                      key={index}
                      className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(index)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>{t('task.images')}</Label>
              <ImageUpload
                images={images}
                onImagesChange={setImages}
                maxImages={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="secondary">
              {t('task.createTask')}
            </Button>
            <Button 
              type="button" 
              onClick={() => handleSubmit(true)}
              disabled={!formData.title?.trim()}
            >
              <Play className="h-4 w-4 mr-2" />
              {t('task.createAndStart')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}