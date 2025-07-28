/**
 * Type-safe event definitions for the entire application
 * All events flowing through the system should be defined here
 */

import { Task, Project, TaskAttempt, McpServer } from '@/types';
import { UnifiedMessage, AttemptExecutionState, TaskExecutionSummary  } from '@/types/execution';

/**
 * Application-wide event definitions
 * Key is the event name, value is the payload type
 */
export interface AppEvents {
  // Task events
  'task-created': { task: Task };
  'task-updated': { task: Task };
  'task-deleted': { taskId: string };
  'task-status-updated': Task;
  
  // Project events
  'project-selected': { projectId: string };
  'project-created': { project: Project };
  'project-updated': { project: Project };
  'project-deleted': { projectId: string };
  
  // Execution events
  'execution-started': { 
    taskId: string;
    attemptId: string;
    executionId?: string;
    agentType?: any;
  };
  'execution-stopped': {
    taskId: string;
    attemptId: string;
    executionId?: string;
  };
  'execution-completed': {
    taskId: string;
    attemptId: string;
    executionId: string;
    success: boolean;
  };
  'execution-error': {
    taskId: string;
    attemptId: string;
    executionId: string;
    error: string;
  };
  
  // Coding agent events
  'coding-agent-message': {
    execution_id: string;
    task_id: string;
    attempt_id: string;
    message: UnifiedMessage;
  };
  'claude-session-id-received': {
    task_id: string;
    attempt_id: string;
    claude_session_id: string;
  };
  
  // Attempt events
  'attempt-created': {
    taskId: string;
    attemptId: string;
  };
  'task-attempt-created': {
    task_id: string;
    attempt: TaskAttempt;
  };
  'attempt-execution-update': AttemptExecutionState;
  'task-execution-summary': TaskExecutionSummary;
  
  // UI events
  'start-task-execution': { taskId: string; prompt?: string };
  'send-to-conversation': { taskId: string; message: string };
  'open-settings': { tab?: string };
  
  // Keyboard events
  'global-shortcut': { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };
  
  // Menu events
  'menu-view-logs': void;
  'menu-logs-cleared': void;
  'menu-settings': void;
  'menu-open-project': void;
  'menu-open-recent-project': string;
  
  // System events
  'error-occurred': {
    error: Error;
    context?: string;
    retryable?: boolean;
  };
  'notification': {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
  };
  
  // Process events
  'coding-agent-process-completed': {
    execution_id: string;
    task_id: string;
  };
  
  // MCP events
  'mcp-server-status': McpServer;
  
  // Terminal events
  'terminal-output': {
    session_id: string;
    data: string;
  };
  
  // File events
  'file-change': {
    worktree_path: string;
    file_path: string;
    kind: string;
  };
}

// Type helper for event names
export type AppEventName = keyof AppEvents;

// Type helper for event payloads
export type AppEventPayload<T extends AppEventName> = AppEvents[T];

// Event handler type
export type EventHandler<T extends AppEventName> = (
  payload: AppEventPayload<T>
) => void | Promise<void>;

// Unsubscribe function type
export type UnsubscribeFn = () => void;