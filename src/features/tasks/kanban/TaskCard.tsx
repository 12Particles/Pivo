import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Task, TaskStatus } from "@/types";
import { Clock, User, Play, MoreVertical, Trash2, Edit } from "lucide-react";
import { useTranslation } from "react-i18next";

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onClick?: () => void;
  onExecute?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

// Priority colors - kept for potential future use
// const priorityColors: Record<TaskPriority, string> = {
//   [TaskPriority.Low]: "bg-gray-100/70 text-gray-700 border-gray-200",
//   [TaskPriority.Medium]: "bg-blue-100/70 text-blue-700 border-blue-200",
//   [TaskPriority.High]: "bg-orange-100/70 text-orange-700 border-orange-200",
//   [TaskPriority.Urgent]: "bg-red-100/70 text-red-700 border-red-200",
// };

const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.Backlog]: "border-l-gray-400",
  [TaskStatus.Working]: "border-l-blue-500",
  [TaskStatus.Reviewing]: "border-l-yellow-500",
  [TaskStatus.Done]: "border-l-green-500",
  [TaskStatus.Cancelled]: "border-l-red-500",
};

export function TaskCard({ task, isDragging, onClick, onExecute, onEdit, onDelete }: TaskCardProps) {
  const { t } = useTranslation();
  
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md bg-background/60 backdrop-blur-sm",
        "border border-border/50 hover:border-border",
        statusColors[task.status],
        isDragging && "opacity-50 rotate-2 scale-105 shadow-xl",
        "border-l-4"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm line-clamp-2 flex-1 text-foreground/90">{task.title}</h3>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 hover:bg-muted/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onExecute?.(task);
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {t('common.execute')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onEdit?.(task);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {t('common.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onDelete?.(task);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {task.assignee && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground/70" />
                  <span className="text-muted-foreground">{task.assignee}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground/70" />
                <span className="text-muted-foreground">{new Date(task.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
            <span className="text-xs font-mono text-muted-foreground/60">#{task.id.slice(0, 8)}</span>
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0 bg-muted/50">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}