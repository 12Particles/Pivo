import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, GitMerge, AlertCircle } from 'lucide-react';
import { gitApi } from '@/services/api';
import { gitLabApi } from '@/services/api';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import type { TaskAttempt } from '@/types';

interface CreateMergeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskAttempt: TaskAttempt;
  projectPath: string;
  onSuccess?: () => void;
}

export function CreateMergeRequestDialog({
  open,
  onOpenChange,
  taskAttempt,
  projectPath,
  onSuccess,
}: CreateMergeRequestDialogProps) {
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
      checkGitLabConfig();
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

  const checkGitLabConfig = async () => {
    try {
      const cfg = await gitLabApi.getConfig();
      setConfig(cfg);
      if (cfg?.defaultBranch) {
        setTargetBranch(cfg.defaultBranch);
      }
    } catch (error) {
      console.error('Failed to check GitLab config:', error);
    }
  };

  const handleCreate = async () => {
    if (!config || !config.pat) {
      toast({
        title: t('toast.warning'),
        description: t('gitlab.notConfigured'),
        variant: 'destructive',
      });
      return;
    }

    if (!title) {
      toast({
        title: t('toast.warning'),
        description: 'Please enter a title for the merge request',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // First push the branch
      await gitLabApi.pushToGitLab(
        taskAttempt.worktree_path,
        taskAttempt.branch,
        false
      );

      // Create the merge request
      await gitLabApi.createMergeRequest({
        taskAttemptId: taskAttempt.id,
        remoteUrl,
        title,
        description,
        sourceBranch: taskAttempt.branch,
        targetBranch
      });

      toast({
        title: t('toast.success'),
        description: t('mergeRequests.mrCreated'),
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to create merge request:', error);
      toast({
        title: t('toast.error'),
        description: error.message || t('mergeRequests.mrError'),
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
            <GitMerge className="h-5 w-5" />
            {t('mergeRequests.createMR')}
          </DialogTitle>
          <DialogDescription>
            Create a GitLab merge request for branch: {taskAttempt.branch}
          </DialogDescription>
        </DialogHeader>

        {!config || !config.pat ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('gitlab.notConfigured')}
              <Button
                variant="link"
                className="p-0 h-auto ml-1"
                onClick={() => {
                  onOpenChange(false);
                  // Navigate to settings
                  window.location.hash = '#/settings?tab=gitlab';
                }}
              >
                {t('gitlab.configureNow')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mr-title">Title</Label>
              <Input
                id="mr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add feature X"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mr-description">Description</Label>
              <Textarea
                id="mr-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your changes..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mr-target">Target Branch</Label>
              <Input
                id="mr-target"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="main"
              />
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Remote: {remoteUrl || 'Not detected'}</p>
              <p>Source: {taskAttempt.branch} → {targetBranch}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !config || !config.pat}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" />
                Create MR
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}