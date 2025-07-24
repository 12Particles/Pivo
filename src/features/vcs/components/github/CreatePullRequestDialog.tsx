import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, GitPullRequest, AlertCircle } from 'lucide-react';
import { gitApi } from '@/services/api';
import { gitHubApi } from '@/services/api';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import type { TaskAttempt } from '@/types';

interface CreatePullRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskAttempt: TaskAttempt;
  projectPath: string;
  onSuccess?: () => void;
}

export function CreatePullRequestDialog({
  open,
  onOpenChange,
  taskAttempt,
  projectPath,
  onSuccess,
}: CreatePullRequestDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    if (open) {
      loadGitInfo();
      checkGitHubConfig();
    }
  }, [open]);

  const loadGitInfo = async () => {
    try {
      // Get remote URL
      const status = await gitApi.getStatus(projectPath);
      if ((status as any).remotes && (status as any).remotes.length > 0) {
        setRemoteUrl((status as any).remotes[0].url);
      }

      // Set default title based on branch name
      const branchName = taskAttempt.branch.replace(/^task\//, '');
      setTitle(`Draft: ${branchName}`);
    } catch (error) {
      console.error('Failed to load git info:', error);
    }
  };

  const checkGitHubConfig = async () => {
    try {
      const cfg = await gitHubApi.getConfig();
      setConfig(cfg);
      if (cfg?.defaultBranch) {
        setTargetBranch(cfg.defaultBranch);
      }
    } catch (error) {
      console.error('Failed to check GitHub config:', error);
    }
  };

  const handleCreate = async () => {
    if (!config || !config.accessToken) {
      toast({
        title: t('toast.warning'),
        description: t('github.notConfigured'),
        variant: 'destructive',
      });
      return;
    }

    if (!title) {
      toast({
        title: t('toast.warning'),
        description: 'Please enter a title for the pull request',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // First push the branch
      await gitHubApi.pushToGitHub(
        taskAttempt.worktree_path,
        taskAttempt.branch,
        false
      );

      // Create the pull request
      await gitHubApi.createPullRequest({
        taskAttemptId: taskAttempt.id,
        remoteUrl,
        title,
        description,
        sourceBranch: taskAttempt.branch,
        targetBranch,
      });

      toast({
        title: t('toast.success'),
        description: t('pullRequests.prCreated'),
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to create pull request:', error);
      toast({
        title: t('toast.error'),
        description: error.message || t('pullRequests.prError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5" />
            {t('pullRequests.createPR')}
          </DialogTitle>
          <DialogDescription>
            Create a GitHub pull request for branch: {taskAttempt.branch}
          </DialogDescription>
        </DialogHeader>

        {!config || !config.accessToken ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('github.notConfigured')}
              <Button
                variant="link"
                className="h-auto p-0 ml-1"
                onClick={() => {
                  onOpenChange(false);
                  // Navigate to settings
                  window.location.href = '#/settings?tab=github';
                }}
              >
                {t('github.configureNow')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pr-title">{t('pullRequests.title')}</Label>
              <Input
                id="pr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a descriptive title..."
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-description">{t('pullRequests.description')}</Label>
              <Textarea
                id="pr-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the changes in this pull request..."
                rows={4}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-target">{t('pullRequests.targetBranch')}</Label>
              <Input
                id="pr-target"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="main"
                disabled={loading}
              />
            </div>

            <Alert>
              <AlertDescription>
                The branch will be pushed to GitHub before creating the pull request.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !config || !config.accessToken}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <GitPullRequest className="mr-2 h-4 w-4" />
                {t('pullRequests.create')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}