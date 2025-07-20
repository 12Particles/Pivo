import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, RefreshCw, Play, XCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { gitlabService } from '@/lib/services/gitlabService';
import { useTranslation } from 'react-i18next';
import type { MergeRequest } from '@/lib/types/mergeRequest';

interface PipelineViewerProps {
  mergeRequest: MergeRequest;
}

interface Pipeline {
  id: number;
  status: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
  duration?: number;
  stages?: PipelineStage[];
}

interface PipelineStage {
  name: string;
  status: string;
  jobs: PipelineJob[];
}

interface PipelineJob {
  id: number;
  name: string;
  status: string;
  stage: string;
  duration?: number;
  webUrl: string;
}

export function PipelineViewer({ mergeRequest }: PipelineViewerProps) {
  const { t } = useTranslation();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (mergeRequest.pipelineUrl) {
      loadPipeline();
    }
  }, [mergeRequest.pipelineUrl]);

  const loadPipeline = async () => {
    try {
      setLoading(true);
      // TODO: Implement pipeline loading from GitLab API
      // For now, we'll use mock data based on MR status
      const mockPipeline: Pipeline = {
        id: Date.now(),
        status: mergeRequest.pipelineStatus || 'unknown',
        webUrl: mergeRequest.pipelineUrl || '#',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 245,
        stages: [
          {
            name: 'build',
            status: mergeRequest.pipelineStatus || 'success',
            jobs: [
              {
                id: 1,
                name: 'compile',
                status: 'success',
                stage: 'build',
                duration: 120,
                webUrl: '#'
              },
              {
                id: 2,
                name: 'lint',
                status: 'success',
                stage: 'build',
                duration: 45,
                webUrl: '#'
              }
            ]
          },
          {
            name: 'test',
            status: mergeRequest.pipelineStatus || 'running',
            jobs: [
              {
                id: 3,
                name: 'unit-tests',
                status: 'running',
                stage: 'test',
                duration: 80,
                webUrl: '#'
              },
              {
                id: 4,
                name: 'integration-tests',
                status: 'pending',
                stage: 'test',
                webUrl: '#'
              }
            ]
          }
        ]
      };
      setPipeline(mockPipeline);
    } catch (error) {
      console.error('Failed to load pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPipeline = async () => {
    setRefreshing(true);
    await loadPipeline();
    setRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'canceled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string): any => {
    switch (status) {
      case 'success':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!mergeRequest.pipelineStatus && !mergeRequest.pipelineUrl) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No pipeline associated with this merge request
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(pipeline?.status || '')}
              Pipeline #{pipeline?.id}
            </CardTitle>
            <CardDescription>
              {pipeline?.stages?.length} stages • Duration: {formatDuration(pipeline?.duration)}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshPipeline}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(pipeline?.webUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pipeline?.stages?.map((stage) => (
            <div key={stage.name} className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(stage.status)}
                <h4 className="font-medium capitalize">{stage.name}</h4>
                <Badge variant={getStatusBadgeVariant(stage.status)}>
                  {stage.status}
                </Badge>
              </div>
              <div className="ml-6 space-y-1">
                {stage.jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => window.open(job.webUrl, '_blank')}
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="text-sm">{job.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.duration && (
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(job.duration)}
                        </span>
                      )}
                      <Badge variant={getStatusBadgeVariant(job.status)} className="text-xs">
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {pipeline?.status === 'failed' && (
          <div className="mt-4 p-3 bg-destructive/10 rounded-md">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Pipeline failed</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Check the failed jobs for more details.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}