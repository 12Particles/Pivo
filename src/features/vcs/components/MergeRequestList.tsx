import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, GitMerge, AlertCircle, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import type { MergeRequestInfo } from '@/lib/types/mergeRequest';
import { CreateMergeRequestDialog } from './gitlab/CreateMergeRequestDialog';
import { PipelineViewer } from './gitlab/PipelineViewer';
import { useTranslation } from 'react-i18next';
import type { TaskAttempt, Project } from '@/types';
import { taskAttemptApi } from "@/services/api";
import { useVcsPullRequests } from '@/hooks/domain/useVcs';

interface MergeRequestListProps {
  taskId?: string;
  taskAttemptId?: string;
  project?: Project;
}

export function MergeRequestList({ taskId, taskAttemptId, project }: MergeRequestListProps) {
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  const [selectedMR, setSelectedMR] = useState<MergeRequestInfo | null>(null);
  
  // Use VCS store hook
  const { pullRequests: mergeRequests, loading, refresh: refreshMergeRequests } = useVcsPullRequests({
    taskId,
    taskAttemptId,
    provider: 'gitlab'
  });

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

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'opened':
        return <GitMerge className="h-4 w-4 text-green-500" />;
      case 'merged':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-red-500" />;
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

  if (loading) {
    return <div className="p-4 text-center">{t('loading')}</div>;
  }

  if (mergeRequests.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <GitMerge className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">{t('mergeRequests.noMergeRequests')}</p>
            {currentAttempt && project && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('mergeRequests.createMR')}
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* Create MR Dialog */}
        {currentAttempt && project && (
          <CreateMergeRequestDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            taskAttempt={currentAttempt}
            projectPath={project.path}
            onSuccess={refreshMergeRequests}
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
          <h3 className="text-lg font-semibold">{t('mergeRequests.title')}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('mergeRequests.createMR')}
          </Button>
        </div>
      )}

      {mergeRequests.map((mr) => (
        <Card key={mr.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {getStateIcon(mr.state)}
                  <span className="text-lg">{mr.title}</span>
                  <Badge variant={getStateBadgeVariant(mr.state)}>
                    {mr.state}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span>GitLab #{mr.number}</span>
                  <span>•</span>
                  <span>{mr.sourceBranch} → {mr.targetBranch}</span>
                  {mr.hasConflicts && (
                    <>
                      <span>•</span>
                      <span className="text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {t('mergeRequests.hasConflicts')}
                      </span>
                    </>
                  )}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(mr.webUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                {t('mergeRequests.viewOnGitLab')}
              </Button>
            </div>
          </CardHeader>
          {(mr.description || mr.pipelineStatus) && (
            <CardContent>
              {mr.description && (
                <div className="text-sm text-muted-foreground mb-2">
                  {mr.description}
                </div>
              )}
              {mr.pipelineStatus && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getPipelineStatusIcon(mr.pipelineStatus)}
                    <span className="text-sm">
                      {t('mergeRequests.pipeline')}: {mr.pipelineStatus}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMR(selectedMR?.id === mr.id ? null : mr)}
                    >
                      {selectedMR?.id === mr.id ? 'Hide Details' : 'Show Details'}
                    </Button>
                  </div>
                  {selectedMR?.id === mr.id && (
                    <div className="mt-4">
                      <PipelineViewer mergeRequest={mr} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}

      {/* Create MR Dialog */}
      {currentAttempt && project && (
        <CreateMergeRequestDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          taskAttempt={currentAttempt}
          projectPath={project.path}
          onSuccess={refreshMergeRequests}
        />
      )}
    </div>
  );
}