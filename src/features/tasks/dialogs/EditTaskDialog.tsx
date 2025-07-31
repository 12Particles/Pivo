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
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task, TaskPriority, UpdateTaskRequest } from "@/types";
import { useTranslation } from "react-i18next";
import { ImageUpload } from "@/components/ui/image-upload";
import { useApp } from "@/contexts/AppContext";

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onSubmit: (taskId: string, data: UpdateTaskRequest) => void;
}

export function EditTaskDialog({ open, onOpenChange, task, onSubmit }: EditTaskDialogProps) {
  const { t } = useTranslation();
  const { currentProject } = useApp();
  const [formData, setFormData] = useState<UpdateTaskRequest>({
    title: "",
    description: "",
    priority: TaskPriority.Medium,
    tags: [],
  });

  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<string[]>([]);

  // Pre-populate form when task changes or dialog opens
  useEffect(() => {
    if (task && open) {
      setFormData({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        tags: task.tags || [],
      });
      // Reset images when opening with a new task
      setImages([]);
    }
  }, [task, open]);

  const handleSubmit = () => {
    if (!task || !formData.title?.trim()) return;
    
    // If we have images, append them to the description
    let finalDescription = formData.description || "";
    if (images.length > 0) {
      finalDescription += "\n\n" + t('task.attachedImages', { count: images.length });
      // Note: In a full implementation, we would handle image storage and references here
    }
    
    onSubmit(task.id, {
      title: formData.title,
      description: finalDescription,
      priority: formData.priority,
      tags: formData.tags,
    });

    // Reset form when closing
    setFormData({
      title: "",
      description: "",
      priority: TaskPriority.Medium,
      tags: [],
    });
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

  // Don't render the dialog content if there's no task
  if (!task && open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <DialogHeader>
            <DialogTitle>{t('task.editTask')}</DialogTitle>
            <DialogDescription>
              {t('task.updateTaskDetails')}
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
              <MentionTextarea
                id="description"
                value={formData.description || ""}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder={t('task.enterTaskDescription')}
                searchPath={currentProject?.path}
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
            <Button type="submit" disabled={!formData.title?.trim()}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}