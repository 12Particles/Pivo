import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Task, Project, TaskAttempt } from "@/types";
import { Play, GitBranch } from "lucide-react";
import { FileTreeDiff } from "@/features/vcs/components/common/FileTreeDiff";
import { IntegrationPanel } from "@/features/integration/components/IntegrationPanel";
import { ResizableLayout } from "@/features/layout/components/ResizableLayout";
import { useState, useEffect } from "react";
import { taskAttemptApi } from "@/services/api";
import { useTranslation } from "react-i18next";
import { eventBus } from "@/lib/events/EventBus";
import { invoke } from "@tauri-apps/api/core";

interface TaskDetailsPanelProps {
  task: Task;
  project?: Project | null;
  onEdit?: (task: Task) => void;
  onDelete?: () => void;
  onExecute?: () => void;
  onRunTask?: (task: Task) => void;
  bottomPanelVisible?: boolean;
}

export function TaskDetailsPanel({
  task,
  project,
  onRunTask,
  bottomPanelVisible = true,
}: TaskDetailsPanelProps) {
  const { t } = useTranslation();
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [changedFilePath, setChangedFilePath] = useState<string | null>(null);
  
  useEffect(() => {
    if (task) {
      loadLatestAttempt();
    }
  }, [task?.id]);

  // Listen for attempt creation events
  useEffect(() => {
    const unsubscribe = eventBus.subscribe("task-attempt-created", (payload: any) => {
      if (payload.task_id === task?.id) {
        // Reload attempts when a new attempt is created for this task
        loadLatestAttempt();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [task?.id]);
  
  const loadLatestAttempt = async () => {
    if (!task) return;
    
    try {
      const attempts = await taskAttemptApi.listForTask(task.id);
      if (attempts.length > 0) {
        // Get the latest attempt
        const latestAttempt = attempts[attempts.length - 1];
        setCurrentAttempt(latestAttempt);
      }
    } catch (error) {
      console.error("Failed to load attempts:", error);
    }
  };

  // Effect to watch for file changes when worktree is available
  useEffect(() => {
    const worktreePath = currentAttempt?.worktree_path;
    if (!worktreePath) return;

    let unlisten: (() => void) | undefined;

    const setupFileWatcher = async () => {
      try {
        // Start watching the worktree
        await invoke("watch_worktree", { worktreePath });
        console.log("Started watching worktree:", worktreePath);

        // Listen for file change events
        unlisten = eventBus.subscribe("file-change", (payload: { worktree_path: string; file_path: string; kind: string }) => {
          // Only refresh if the event is for our worktree
          if (payload.worktree_path === worktreePath) {
            console.log("File changed in worktree:", payload.file_path, payload.kind);
            // Set the changed file path and trigger refresh
            setChangedFilePath(payload.file_path);
            setRefreshKey(prev => prev + 1);
          }
        });
      } catch (error) {
        console.error("Failed to setup file watcher:", error);
      }
    };

    setupFileWatcher();

    // Cleanup
    return () => {
      if (unlisten) {
        unlisten();
      }
      // Unwatch the worktree when component unmounts or worktree changes
      if (worktreePath) {
        invoke("unwatch_worktree", { worktreePath }).catch(console.error);
        console.log("Stopped watching worktree:", worktreePath);
      }
    };
  }, [currentAttempt?.worktree_path]);
  
  if (!task) return null;

  if (!bottomPanelVisible) {
    return (
      <Card className="h-full">
        <CardContent className="h-full p-0">
          {project && task ? (
            <FileTreeDiff 
              projectPath={project.path} 
              taskId={task.id} 
              worktreePath={currentAttempt?.worktree_path}
              refreshKey={refreshKey}
              changedFilePath={changedFilePath}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t('git.selectFileToView')}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <ResizableLayout
      direction="vertical"
      defaultSizes={[50, 50]}
      minSizes={[20, 20]}
      storageKey={`task-details-${task.id}`}
    >
      {/* Top section - File changes */}
      <Card className="h-full">
        <CardContent className="h-full p-0">
          {project && task ? (
            <FileTreeDiff 
              projectPath={project.path} 
              taskId={task.id} 
              worktreePath={currentAttempt?.worktree_path}
              refreshKey={refreshKey}
              changedFilePath={changedFilePath}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t('git.selectFileToView')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom section - Tabs */}
      <Card className="h-full">
        <CardContent className="h-full p-0">
          <Tabs defaultValue="details" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="details">{t('task.taskDetails')}</TabsTrigger>
              <TabsTrigger value="integration">{t('integration.title')}</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="details" className="h-full overflow-y-auto p-6 space-y-4">
                {/* Task Title and Status */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-3">{task.title}</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{task.status}</Badge>
                    <Badge variant="secondary">{task.priority}</Badge>
                    <span className="text-xs text-muted-foreground">
                      #{task.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">{t('task.taskDescription')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {task.description || t('project.noDescription')}
                  </p>
                </div>

                {/* Worktree Info */}
                {project && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      {t('task.worktreeInfo')}
                    </h3>
                    {currentAttempt ? (
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-muted-foreground">{t('task.worktreePath')}</dt>
                          <dd className="font-mono text-xs">{currentAttempt.worktree_path}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('task.branchName')}</dt>
                          <dd className="font-mono text-xs">{currentAttempt.branch}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('task.noWorktreeCreated')}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="font-medium mb-2">{t('task.metadata')}</h3>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{t('task.createdAt')}</dt>
                      <dd>{new Date(task.created_at).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('task.updatedAt')}</dt>
                      <dd>{new Date(task.updated_at).toLocaleString()}</dd>
                    </div>
                    {task.assignee && (
                      <div>
                        <dt className="text-muted-foreground">{t('task.assignee')}</dt>
                        <dd>{task.assignee}</dd>
                      </div>
                    )}
                    {task.tags && task.tags.length > 0 && (
                      <div className="col-span-2">
                        <dt className="text-muted-foreground mb-1">{t('task.tags')}</dt>
                        <dd className="flex flex-wrap gap-1">
                          {task.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Attempts Information */}
                <div>
                  <h3 className="font-medium mb-2">{t('task.executeAttempts')}</h3>
                  {currentAttempt ? (
                    <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('task.currentAttempt')}</span>
                        <Badge variant={currentAttempt.status === "running" ? "default" : "secondary"}>
                          {currentAttempt.status}
                        </Badge>
                      </div>
                      <div className="font-mono text-xs">
                        ID: {currentAttempt.id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('task.createdAt')}: {new Date(currentAttempt.created_at).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('task.noAttempts')}</p>
                  )}
                  
                  <div className="mt-3">
                    <Button 
                      onClick={async () => {
                        if (onRunTask) {
                          await onRunTask(task);
                        }
                      }}
                      size="sm"
                      className="w-full"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      {t('task.createNewAttempt')}
                    </Button>
                  </div>
                </div>
              </TabsContent>



              <TabsContent value="integration" className="h-full p-0">
                {project && task ? (
                  <IntegrationPanel task={task} project={project} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {t('terminal.notAssociatedProject')}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </ResizableLayout>
  );
}