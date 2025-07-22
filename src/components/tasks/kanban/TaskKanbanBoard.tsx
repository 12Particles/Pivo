import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task, TaskStatus } from "@/types";
import { Plus, Search, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExecutionStore } from "@/stores/useExecutionStore";

interface TaskKanbanBoardProps {
  tasks: Task[];
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: () => void;
  onExecuteTask?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
}

const statusColumns = [
  { status: TaskStatus.Backlog, title: "Backlog", color: "bg-gray-50" },
  { status: TaskStatus.Working, title: "Working", color: "bg-blue-50" },
  { status: TaskStatus.Reviewing, title: "Reviewing", color: "bg-yellow-50" },
  { status: TaskStatus.Done, title: "Done", color: "bg-green-50" },
];

export function TaskKanbanBoard({
  tasks,
  onTaskStatusChange,
  onTaskClick,
  onAddTask,
  onExecuteTask,
  onEditTask,
  onDeleteTask,
}: TaskKanbanBoardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(new Set());
  
  // Get task summaries from the execution store
  const taskSummaries = useExecutionStore(state => state.taskSummaries);

  const filteredTasks = tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.tags?.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const tasksByStatus = statusColumns.reduce((acc, column) => {
    acc[column.status] = filteredTasks.filter(
      (task) => task.status === column.status
    );
    return acc;
  }, {} as Record<TaskStatus, Task[]>);


  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    const sourceStatus = result.source.droppableId as TaskStatus;

    if (sourceStatus !== newStatus) {
      onTaskStatusChange(taskId, newStatus);
    }
  };

  const toggleColumn = (status: TaskStatus) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };


  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 p-3 border-b flex-shrink-0 bg-background/95 backdrop-blur">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background/50 border-muted/50 focus:bg-background transition-colors"
          />
        </div>
        <Button onClick={onAddTask} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto bg-muted/10">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-3 p-3">
            {statusColumns.map((column) => (
              <Droppable key={column.status} droppableId={column.status}>
                {(provided, snapshot) => (
                  <Card
                    className={cn(
                      "flex flex-col border-0 shadow-sm hover:shadow-md transition-shadow",
                      snapshot.isDraggingOver && "ring-2 ring-primary shadow-lg"
                    )}
                  >
                    <CardHeader className="pb-2 pt-3 px-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg" onClick={() => toggleColumn(column.status)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {collapsedColumns.has(column.status) ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <CardTitle className="text-sm font-semibold text-foreground/90">
                            {column.title}
                          </CardTitle>
                        </div>
                        <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-muted/50">
                          {tasksByStatus[column.status].length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "p-2 min-h-[80px] rounded-b-lg transition-colors",
                        collapsedColumns.has(column.status) && "hidden"
                      )}
                      style={{ display: collapsedColumns.has(column.status) ? 'none' : undefined }}
                    >
                        <div className="space-y-2">
                          {tasksByStatus[column.status].map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <div className="relative">
                                  <TaskCard
                                    task={task}
                                    isDragging={snapshot.isDragging}
                                    onClick={() => onTaskClick(task)}
                                    onExecute={onExecuteTask}
                                    onEdit={onEditTask}
                                    onDelete={onDeleteTask}
                                  />
                                  {column.status === TaskStatus.Working && taskSummaries.get(task.id)?.is_running && (
                                    <div className="absolute -top-1 -right-1 z-50 bg-blue-500 rounded-full p-1.5 shadow-lg border-2 border-white dark:border-gray-800">
                                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        </div>
                        {provided.placeholder}
                      </CardContent>
                  </Card>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}