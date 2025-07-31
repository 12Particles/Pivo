import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, GitPullRequest, AlertCircle, CheckCircle, XCircle, Clock, Plus, Settings, KeyRound } from 'lucide-react';
import { CreatePullRequestDialog } from './CreatePullRequestDialog';
import { GitHubAuthDialog } from './GitHubAuthDialog';
import { useTranslation } from 'react-i18next';
import type { TaskAttempt, Project } from '@/types';
import { taskAttemptApi } from "@/services/api";
import { eventBus } from '@/lib/events/EventBus';
import { useVcsPullRequests, useGitHubAuth } from '@/hooks/domain/useVcs';
import { open } from '@tauri-apps/plugin-shell';

interface PullRequestListProps {
  taskId?: string;
  taskAttemptId?: string;
  project?: Project;
}

export function PullRequestList({ taskId, taskAttemptId, project }: PullRequestListProps) {
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  
  // Use VCS store hooks
  const { pullRequests, loading, refresh: refreshPullRequests } = useVcsPullRequests({
    taskId,
    taskAttemptId,
    provider: 'github'
  });
  
  const { loading: checkingAuth, hasAuth, refresh: refreshAuth } = useGitHubAuth();

  useEffect(() => {
    loadLatestAttempt();
  }, [taskId, taskAttemptId]);

  const loadLatestAttempt = async () => {
    if (!taskId) return;
    
    try {
      const attempts = await taskAttemptApi.listForTask(taskId);
      if (attempts.length > 0) {
        // Get the latest attempt
        const latestAttempt = attempts[attempts.length - 1];
        setCurrentAttempt(latestAttempt);
      }
    } catch (error) {
      console.error("Failed to load attempts:", error);
    }
  };
  
  const openGitHubSettings = () => {
    // Emit event to open settings with GitHub tab
    eventBus.emit('open-settings', { tab: 'github' });
  };
  
  const handleAuthSuccess = () => {
    // Refresh auth status after successful authorization
    refreshAuth();
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'opened':
      case 'open':
        return <GitPullRequest className="h-4 w-4 text-green-500" />;
      case 'merged':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <GitPullRequest className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStateBadgeVariant = (state: string) => {
    switch (state) {
      case 'opened':
      case 'open':
        return 'outline';
      case 'merged':
        return 'secondary';
      case 'closed':
        return 'destructive';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getPipelineStatusIcon = (status?: string) => {
    if (!status) return null;
    
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (checkingAuth || loading) {
    return <div className="p-4 text-center">{t('loading')}</div>;
  }
  
  // If no GitHub auth, show auth prompt
  if (!hasAuth) {
    return (
      <>
      <Card>
        <CardContent className="p-6 text-center">
          <KeyRound className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">{t('github.authRequired')}</h3>
          <p className="text-muted-foreground mb-4">{t('github.authDescription')}</p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="default"
              onClick={() => setShowAuthDialog(true)}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {t('github.authorizeWithGitHub')}
            </Button>
            <Button
              variant="outline"
              onClick={openGitHubSettings}
            >
              <Settings className="h-4 w-4 mr-2" />
              {t('github.manualConfig')}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* GitHub Auth Dialog */}
      {showAuthDialog && (
        <GitHubAuthDialog
          open={showAuthDialog}
          onOpenChange={setShowAuthDialog}
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
    );
  }

  if (pullRequests.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <GitPullRequest className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">{t('pullRequests.noPullRequests')}</p>
            {currentAttempt && project && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('pullRequests.createPR')}
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* Create PR Dialog */}
        {currentAttempt && project && (
          <CreatePullRequestDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            taskAttempt={currentAttempt}
            projectPath={project.path}
            onSuccess={refreshPullRequests}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      {currentAttempt && project && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{t('pullRequests.title')}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('pullRequests.createPR')}
          </Button>
        </div>
      )}

      {pullRequests.map((pr) => (
        <Card key={pr.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getStateIcon(pr.state)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <CardTitle className="text-lg truncate pr-2">
                      {pr.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardDescription>
                        #{pr.number} • {pr.sourceBranch} → {pr.targetBranch}
                      </CardDescription>
                      <Badge variant={getStateBadgeVariant(pr.state)} className="text-xs">
                        {pr.state}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="ml-2 shrink-0"
                onClick={async () => {
                  if (pr.webUrl) {
                    try {
                      await open(pr.webUrl);
                    } catch (error) {
                      console.error('Failed to open URL:', error);
                      // Fallback to window.open
                      window.open(pr.webUrl, '_blank');
                    }
                  }
                }}
                title="Open in GitHub"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {pr.mergeStatus && (
                  <div className="flex items-center gap-1">
                    {pr.mergeStatus === 'can_be_merged' ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span>
                      {pr.mergeStatus === 'can_be_merged' 
                        ? 'Can be merged' 
                        : pr.hasConflicts
                        ? 'Has conflicts'
                        : 'Cannot be merged'}
                    </span>
                  </div>
                )}
                
                {pr.pipelineStatus && (
                  <div className="flex items-center gap-1">
                    {getPipelineStatusIcon(pr.pipelineStatus)}
                    <span>Checks: {pr.pipelineStatus}</span>
                  </div>
                )}
              </div>
              
              {pr.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {pr.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Create PR Dialog */}
      {currentAttempt && project && (
        <CreatePullRequestDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          taskAttempt={currentAttempt}
          projectPath={project.path}
          onSuccess={refreshPullRequests}
        />
      )}
      
      {/* GitHub Auth Dialog */}
      <GitHubAuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}