import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Task, Project, TaskAttempt } from "@/types";
import { MergeRequestList } from "@/components/MergeRequestList";
import { DiffViewer } from "@/components/git/DiffViewer";
import { gitlabService } from "@/lib/services/gitlabService";
import { gitApi } from "@/lib/gitApi";
import { taskAttemptApi } from "@/lib/api";
import { GitMerge, GitCommit, AlertCircle, GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";

interface IntegrationPanelProps {
  task: Task;
  project: Project;
}

export function IntegrationPanel({ task, project }: IntegrationPanelProps) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<string>("");
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    detectGitProvider();
    loadLatestAttempt();
  }, [project, task]);

  const detectGitProvider = async () => {
    try {
      setLoading(true);
      if (project.git_repo) {
        const detectedProvider = await gitlabService.detectGitProvider(project.git_repo);
        setProvider(detectedProvider.toLowerCase());
      } else {
        // Try to detect from local git config
        const status = await gitApi.getStatus(project.path);
        if (status.remotes && status.remotes.length > 0) {
          const detectedProvider = await gitlabService.detectGitProvider(status.remotes[0].url);
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        {t('common.loading')}
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

  // Currently only GitLab is implemented
  if (provider !== "gitlab") {
    return (
      <div className="h-full flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {provider.charAt(0).toUpperCase() + provider.slice(1)} integration is not yet implemented. 
            Currently only GitLab is supported.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="mrs" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mrs" className="flex items-center gap-1">
            <GitMerge className="h-4 w-4" />
            {t('mergeRequests.title')}
          </TabsTrigger>
          <TabsTrigger value="diff" className="flex items-center gap-1">
            <GitCommit className="h-4 w-4" />
            {t('git.fileChanges')}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="mrs" className="h-full p-4">
            <MergeRequestList 
              taskId={task.id} 
              taskAttemptId={currentAttempt?.id}
              project={project} 
            />
          </TabsContent>

          <TabsContent value="diff" className="h-full p-0">
            {currentAttempt ? (
              <DiffViewer attempt={currentAttempt} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('task.noAttempts')}</p>
                </div>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}