import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, GitPullRequest, AlertCircle, CheckCircle, XCircle, Clock, Plus, Settings, KeyRound, RefreshCw } from 'lucide-react';
import { CreatePullRequestDialog } from './CreatePullRequestDialog';
import { GitHubAuthDialog } from './GitHubAuthDialog';
import { useTranslation } from 'react-i18next';
import type { TaskAttempt, Project } from '@/types';
import { taskAttemptApi } from "@/services/api";
import { eventBus } from '@/lib/events/EventBus';
import { useVcsPullRequests, useGitHubAuth } from '@/hooks/domain/useVcs';
import { open } from '@tauri-apps/plugin-shell';
import { gitHubApi } from '@/services/api/GitHubApi';

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Use VCS store hooks
  const { pullRequests, loading, refresh: refreshPullRequestsBase } = useVcsPullRequests({
    taskId,
    taskAttemptId,
    provider: 'github'
  });
  
  // Wrapper to track last updated time
  const refreshPullRequests = async () => {
    await refreshPullRequestsBase();
    setLastUpdated(new Date());
  };
  
  // Sync PR status from GitHub API
  const syncPullRequestStatus = async () => {
    if (!project?.git_repo || !currentAttempt || pullRequests.length === 0) return;
    
    console.log('Syncing pull request status from GitHub...');
    
    // Sync status for each PR
    const syncPromises = pullRequests.map(async (pr) => {
      try {
        await gitHubApi.getPullRequestStatus(
          currentAttempt.id,
          project.git_repo!,
          pr.number
        );
      } catch (error) {
        console.error(`Failed to sync PR #${pr.number}:`, error);
      }
    });
    
    await Promise.all(syncPromises);
    
    // Refresh the list after syncing
    await refreshPullRequests();
  };
  
  const { loading: checkingAuth, hasAuth, refresh: refreshAuth } = useGitHubAuth();

  useEffect(() => {
    loadLatestAttempt();
  }, [taskId, taskAttemptId]);
  
  // Set initial last updated time when pull requests are loaded
  useEffect(() => {
    if (pullRequests.length > 0 && !lastUpdated) {
      setLastUpdated(new Date());
    }
  }, [pullRequests, lastUpdated]);


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
    // Emit event to open settings with Git Services category
    eventBus.emit('open-settings', { tab: 'git-services' });
  };
  
  const handleAuthSuccess = () => {
    // Refresh auth status after successful authorization
    refreshAuth();
  };
  
  const getRelativeTime = (date: Date | null) => {
    if (!date) return '';
    
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return t('common.justNow');
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return t('common.minutesAgo', { count: minutes });
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return t('common.hoursAgo', { count: hours });
    }
    
    return date.toLocaleString();
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
      {/* Header with refresh and create buttons */}
      {(currentAttempt || pullRequests.length > 0) && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{t('pullRequests.title')}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // If we have all required data, sync from GitHub; otherwise just refresh from DB
                if (project?.git_repo && currentAttempt && pullRequests.length > 0) {
                  syncPullRequestStatus();
                } else {
                  refreshPullRequests();
                }
              }}
              disabled={loading}
              title={t('common.refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {lastUpdated && (
              <span className="text-sm text-muted-foreground">
                {t('common.lastUpdated')}: {getRelativeTime(lastUpdated)}
              </span>
            )}
          </div>
          {currentAttempt && project && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('pullRequests.createPR')}
            </Button>
          )}
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