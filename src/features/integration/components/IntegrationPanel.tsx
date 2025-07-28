import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Task, Project, TaskAttempt } from "@/types";
import { MergeRequestList } from "@/features/vcs/components/MergeRequestList";
import { PullRequestList } from "@/features/vcs/components/github/PullRequestList";
import { gitLabApi } from '@/services/api';
import { gitApi } from '@/services/api';
import { taskAttemptApi } from "@/services/api";
import { GitMerge, AlertCircle, GitBranch, GitCommit, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface IntegrationPanelProps {
  task: Task;
  project: Project;
}

interface GitRepoStatus {
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  branch: string;
  tracking?: string;
  remotes?: Array<{ name: string; url: string }>;
  changed?: number;
}

export function IntegrationPanel({ task, project }: IntegrationPanelProps) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<string>("");
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [gitStatus, setGitStatus] = useState<GitRepoStatus | null>(null);

  useEffect(() => {
    loadLatestAttempt();
  }, [project, task]);
  
  useEffect(() => {
    if (currentAttempt || project) {
      detectGitProvider();
    }
  }, [currentAttempt, project]);

  useEffect(() => {
    // Only load git status if we have a current attempt with worktree path
    if (currentAttempt?.worktree_path) {
      loadGitStatus(currentAttempt.worktree_path);
      
      // Set up interval to refresh git status every 5 seconds
      const interval = setInterval(() => {
        loadGitStatus(currentAttempt.worktree_path);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [currentAttempt]);

  const detectGitProvider = async () => {
    try {
      setLoading(true);
      // Use project's git_provider field if available
      if (project.git_provider) {
        setProvider(project.git_provider.toLowerCase());
      } else if (project.git_repo) {
        // Fallback to detection from URL
        const detectedProvider = await gitLabApi.detectGitProvider(project.git_repo);
        setProvider(detectedProvider.toLowerCase());
      } else if (currentAttempt?.worktree_path) {
        // Try to detect from worktree git config
        const status = await gitApi.getStatus(currentAttempt.worktree_path);
        if ((status as any).remotes && (status as any).remotes.length > 0) {
          const detectedProvider = await gitLabApi.detectGitProvider((status as any).remotes[0].url);
          setProvider(detectedProvider.toLowerCase());
        }
      } else {
        // Fallback to project path
        const status = await gitApi.getStatus(project.path);
        if ((status as any).remotes && (status as any).remotes.length > 0) {
          const detectedProvider = await gitLabApi.detectGitProvider((status as any).remotes[0].url);
          setProvider(detectedProvider.toLowerCase());
        }
      }
    } catch (error) {
      console.error("Failed to detect git provider:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestAttempt = async () => {
    try {
      const attempts = await taskAttemptApi.listForTask(task.id);
      if (attempts.length > 0) {
        const latestAttempt = attempts[attempts.length - 1];
        setCurrentAttempt(latestAttempt);
      }
    } catch (error) {
      console.error("Failed to load attempts:", error);
    }
  };

  const loadGitStatus = async (attemptPath: string) => {
    try {
      const status = await gitApi.getStatus(attemptPath);
      setGitStatus({
        ahead: (status as any).ahead || 0,
        behind: (status as any).behind || 0,
        staged: (status as any).staged?.length || 0,
        unstaged: (status as any).changed?.length || 0,
        branch: (status as any).branch || 'unknown',
        tracking: (status as any).tracking
      });
    } catch (error) {
      console.error("Failed to load git status:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }
  
  if (!currentAttempt) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t('task.noAttempts')}</p>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="h-full flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to detect Git provider. Please ensure your project is connected to a Git repository.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Currently only GitLab and GitHub are implemented
  if (provider !== "gitlab" && provider !== "github") {
    return (
      <div className="h-full flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {provider.charAt(0).toUpperCase() + provider.slice(1)} integration is not yet implemented. 
            Currently only GitLab and GitHub are supported.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 space-y-4">
      {/* Local Git Status Section */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {t('git.localStatus')}
        </h3>
        <Card className="p-3">
          <div className="space-y-2">
            {gitStatus ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('git.currentBranch')}</span>
                  <Badge variant="outline">{gitStatus.branch}</Badge>
                </div>
                {gitStatus.tracking && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('git.tracking')}</span>
                    <span className="text-sm">{gitStatus.tracking}</span>
                  </div>
                )}
                <div className="flex items-center gap-4 text-sm">
                  {gitStatus.ahead > 0 && (
                    <span className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      <span className="text-green-600">{gitStatus.ahead} {t('git.ahead')}</span>
                    </span>
                  )}
                  {gitStatus.behind > 0 && (
                    <span className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      <span className="text-orange-600">{gitStatus.behind} {t('git.behind')}</span>
                    </span>
                  )}
                </div>
                {(gitStatus.staged > 0 || gitStatus.unstaged > 0) && (
                  <div className="flex items-center gap-4 text-sm">
                    {gitStatus.staged > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span className="text-blue-600">{gitStatus.staged} {t('git.staged')}</span>
                      </span>
                    )}
                    {gitStatus.unstaged > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span className="text-yellow-600">{gitStatus.unstaged} {t('git.unstaged')}</span>
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">{t('git.loadingStatus')}</div>
            )}
          </div>
        </Card>
      </div>

      <Separator />

      {/* Remote Operations Section */}
      <div className="flex-1 flex flex-col space-y-2 min-h-0">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <GitMerge className="h-4 w-4" />
          {provider === 'github' ? t('pullRequests.title') : t('mergeRequests.title')}
        </h3>
        <div className="flex-1 overflow-auto">
          {provider === 'github' ? (
            <PullRequestList 
              taskId={task.id} 
              taskAttemptId={currentAttempt?.id}
              project={project} 
            />
          ) : (
            <MergeRequestList 
              taskId={task.id} 
              taskAttemptId={currentAttempt?.id}
              project={project} 
            />
          )}
        </div>
      </div>
    </div>
  );
}