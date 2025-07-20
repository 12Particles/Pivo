export interface MergeRequest {
  id: number;
  taskAttemptId: string;
  provider: string;
  mrId: number;
  mrIid: number;
  mrNumber: number;
  title: string;
  description?: string;
  state: string;
  sourceBranch: string;
  targetBranch: string;
  webUrl: string;
  mergeStatus?: string;
  hasConflicts: boolean;
  pipelineStatus?: string;
  pipelineUrl?: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  syncedAt: string;
}

export interface MergeRequestInfo {
  id: number;
  iid: number;
  number: number;
  title: string;
  description?: string;
  state: MergeRequestState;
  sourceBranch: string;
  targetBranch: string;
  webUrl: string;
  mergeStatus?: MergeStatus;
  hasConflicts: boolean;
  pipelineStatus?: PipelineStatus;
  createdAt: string;
  updatedAt: string;
}

export enum MergeRequestState {
  Opened = 'opened',
  Closed = 'closed',
  Merged = 'merged',
  Locked = 'locked',
}

export enum MergeStatus {
  CanBeMerged = 'can_be_merged',
  CannotBeMerged = 'cannot_be_merged',
  CannotBeMergedRecheck = 'cannot_be_merged_recheck',
  Checking = 'checking',
  Unchecked = 'unchecked',
}

export enum PipelineStatus {
  Created = 'created',
  WaitingForResource = 'waiting_for_resource',
  Preparing = 'preparing',
  Pending = 'pending',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Canceled = 'canceled',
  Skipped = 'skipped',
  Manual = 'manual',
  Scheduled = 'scheduled',
}