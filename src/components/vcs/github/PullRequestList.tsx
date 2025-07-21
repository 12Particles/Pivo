import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, GitPullRequest, AlertCircle, CheckCircle, XCircle, Clock, Plus, Settings, KeyRound } from 'lucide-react';
import type { MergeRequest } from '@/lib/types/mergeRequest';
import { CreatePullRequestDialog } from './CreatePullRequestDialog';
import { GitHubAuthDialog } from './GitHubAuthDialog';
import { useTranslation } from 'react-i18next';
import type { TaskAttempt, Project } from '@/types';
import { taskAttemptApi } from '@/lib/api';
import { gitlabService } from '@/lib/services/gitlabService';
import { githubService, type GitHubConfig } from '@/lib/services/githubService';

interface PullRequestListProps {
  taskId?: string;
  taskAttemptId?: string;
  project?: Project;
}

export function PullRequestList({ taskId, taskAttemptId, project }: PullRequestListProps) {
  const { t } = useTranslation();
  const [pullRequests, setPullRequests] = useState<MergeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    checkGitHubAuth();
    loadLatestAttempt();
  }, [taskId, taskAttemptId]);
  
  useEffect(() => {
    // Only run after we've checked auth (githubConfig is set)
    if (githubConfig === null) return;
    
    if (githubConfig.accessToken) {
      loadPullRequests();
    } else {
      // No access token, set loading to false
      setLoading(false);
    }
  }, [githubConfig]);

  const loadPullRequests = async () => {
    try {
      setLoading(true);
      let prs: MergeRequest[] = [];
      
      if (taskAttemptId) {
        prs = await gitlabService.getMergeRequestsByAttempt(taskAttemptId);
      } else if (taskId) {
        prs = await gitlabService.getMergeRequestsByTask(taskId);
      } else {
        prs = await gitlabService.getActiveMergeRequests('github');
      }
      
      // Filter only GitHub PRs
      prs = prs.filter(pr => pr.provider === 'github');
      
      setPullRequests(prs);
    } catch (error) {
      console.error('Failed to load pull requests:', error);
    } finally {
      setLoading(false);
    }
  };

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
  
  const checkGitHubAuth = async () => {
    try {
      setCheckingAuth(true);
      const config = await githubService.getConfig();
      console.log('GitHub config loaded:', config);
      setGithubConfig(config || {}); // Ensure we set an object even if null
    } catch (error) {
      console.error('Failed to check GitHub auth:', error);
      setGithubConfig({}); // Set empty config on error
    } finally {
      setCheckingAuth(false);
    }
  };
  
  const openGitHubSettings = () => {
    // Emit event to open settings with GitHub tab
    window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'github' } }));
  };
  
  const handleAuthSuccess = () => {
    // Refresh auth status after successful authorization
    checkGitHubAuth();
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'opened':
        return <GitPullRequest className="h-4 w-4 text-green-500" />;
      case 'merged':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStateBadgeVariant = (state: string) => {
    switch (state) {
      case 'opened':
        return 'default';
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
  if (!githubConfig?.accessToken) {
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
            onSuccess={loadPullRequests}
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
        <Card key={pr.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {getStateIcon(pr.state)}
                  <span className="text-lg">{pr.title}</span>
                  <Badge variant={getStateBadgeVariant(pr.state)}>
                    {pr.state}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  #{pr.mrNumber} • {pr.sourceBranch} → {pr.targetBranch}
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open(pr.webUrl, '_blank')}
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
          onSuccess={loadPullRequests}
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