import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Task, Project, TaskAttempt } from "@/types";
import { Play, GitBranch, FolderGit, FileText, GitCommit } from "lucide-react";
import { Terminal } from "@/components/terminal/Terminal";
import { FileTreeDiff } from "@/components/git/FileTreeDiff";
import { DiffViewer } from "@/components/git/DiffViewer";
import { IntegrationPanel } from "@/components/integration/IntegrationPanel";
import { useState, useEffect } from "react";
import { taskAttemptApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface TaskDetailsPanelProps {
  task: Task | null;
  project: Project | null;
  onRunTask?: (task: Task) => void;
}

export function TaskDetailsPanel({
  task,
  project,
  onRunTask,
}: TaskDetailsPanelProps) {
  const { t } = useTranslation();
  // Generate new taskAttemptId when task changes
  const taskAttemptId = task ? `attempt-${task.id}-${Date.now()}` : '';
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  
  useEffect(() => {
    if (task) {
      loadLatestAttempt();
    }
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
  
  if (!task) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main content area */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full p-0">
          <Tabs defaultValue="files" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
              <TabsTrigger value="details">{t('task.taskDetails')}</TabsTrigger>
              <TabsTrigger value="files">
                <FileText className="h-4 w-4 mr-1" />
                Files
              </TabsTrigger>
              <TabsTrigger value="changes">
                <GitCommit className="h-4 w-4 mr-1" />
                Changes
              </TabsTrigger>
              <TabsTrigger value="terminal">{t('terminal.title')}</TabsTrigger>
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

              <TabsContent value="files" className="h-full p-0">
                {project && task ? (
                  <FileTreeDiff 
                    projectPath={project.path} 
                    taskId={task.id} 
                    worktreePath={currentAttempt?.worktree_path}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <FolderGit className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{t('terminal.notAssociatedProject')}</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="changes" className="h-full p-0">
                {project && task && currentAttempt ? (
                  <DiffViewer attempt={currentAttempt} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <GitCommit className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>
                        {!currentAttempt 
                          ? t('task.noAttempts')
                          : t('terminal.notAssociatedProject')
                        }
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="terminal" className="h-full p-0">
                <Terminal 
                  taskAttemptId={taskAttemptId}
                  workingDirectory={currentAttempt?.worktree_path || project?.path || "."}
                  className="h-full"
                />
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
    </div>
  );
}