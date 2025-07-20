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
import { Task, TaskPriority, TaskStatus } from "@/types";
import { Clock, User, Play, MoreVertical, Trash2, Edit } from "lucide-react";

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onClick?: () => void;
  onExecute?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

const priorityColors: Record<TaskPriority, string> = {
  [TaskPriority.Low]: "bg-gray-100 text-gray-800",
  [TaskPriority.Medium]: "bg-blue-100 text-blue-800",
  [TaskPriority.High]: "bg-orange-100 text-orange-800",
  [TaskPriority.Urgent]: "bg-red-100 text-red-800",
};

const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.Backlog]: "border-gray-200",
  [TaskStatus.Working]: "border-blue-500",
  [TaskStatus.Reviewing]: "border-yellow-500",
  [TaskStatus.Done]: "border-green-500",
  [TaskStatus.Cancelled]: "border-red-500",
};

export function TaskCard({ task, isDragging, onClick, onExecute, onEdit, onDelete }: TaskCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        statusColors[task.status],
        isDragging && "opacity-50 rotate-3 scale-105",
        "border-l-4"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm line-clamp-2 flex-1">{task.title}</h3>
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className={cn("text-xs shrink-0", priorityColors[task.priority])}
              >
                {task.priority}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
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
                    执行
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onEdit?.(task);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    修改
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onDelete?.(task);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
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
            <div className="flex items-center gap-3">
              {task.assignee && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{task.assignee}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(task.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
            <span className="text-xs font-mono">#{task.id.slice(0, 8)}</span>
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
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