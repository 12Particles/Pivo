import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, GitMerge, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { gitlabService } from '@/lib/services/gitlabService';
import type { MergeRequest } from '@/lib/types/mergeRequest';
import { useTranslation } from 'react-i18next';

interface MergeRequestListProps {
  taskId?: string;
  taskAttemptId?: string;
}

export function MergeRequestList({ taskId, taskAttemptId }: MergeRequestListProps) {
  const { t } = useTranslation();
  const [mergeRequests, setMergeRequests] = useState<MergeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMergeRequests();
  }, [taskId, taskAttemptId]);

  const loadMergeRequests = async () => {
    try {
      setLoading(true);
      let mrs: MergeRequest[] = [];
      
      if (taskAttemptId) {
        mrs = await gitlabService.getMergeRequestsByAttempt(taskAttemptId);
      } else if (taskId) {
        mrs = await gitlabService.getMergeRequestsByTask(taskId);
      } else {
        mrs = await gitlabService.getActiveMergeRequests();
      }
      
      setMergeRequests(mrs);
    } catch (error) {
      console.error('Failed to load merge requests:', error);
    } finally {
      setLoading(false);
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
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {t('mergeRequests.noMergeRequests')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
                  <span>{mr.provider} #{mr.mrNumber}</span>
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
                <div className="flex items-center gap-2">
                  {getPipelineStatusIcon(mr.pipelineStatus)}
                  <span className="text-sm">
                    {t('mergeRequests.pipeline')}: {mr.pipelineStatus}
                  </span>
                  {mr.pipelineUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(mr.pipelineUrl, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}