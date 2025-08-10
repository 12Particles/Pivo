/**
 * Type-safe event definitions for the entire application
 * All events flowing through the system should be defined here
 */

import { Task, Project, TaskAttempt, McpServer } from '@/types';
import { UnifiedMessage } from '@/types/execution';

/**
 * Application-wide event definitions
 * Key is the event name, value is the payload type
 */
export interface AppEvents {
  // Task state events (RFC redesign)
  'task:status-changed': { 
    taskId: string;
    previousStatus: string;
    newStatus: string;
    task: Task;
  };
  'task:attempt-created': {
    taskId: string;
    attempt: TaskAttempt;
  };
  'task:attempt-updated': {
    taskId: string;
    attemptId: string;
    updates: Partial<TaskAttempt>;
  };
  
  // Project events
  'project-selected': { projectId: string };
  'project-created': { project: Project };
  'project-updated': { project: Project };
  // Execution lifecycle events (RFC redesign)
  'execution:started': {
    taskId: string;
    attemptId: string;
    executionId: string;
  };
  'execution:completed': {
    taskId: string;
    attemptId: string;
    executionId: string;
    status: 'success' | 'failed' | 'cancelled';
  };
  
  // Message events (RFC redesign)
  'message:added': {
    taskId: string;
    attemptId: string;
    message: UnifiedMessage;
  };
  
  // Session events
  'session:received': {
    attemptId: string;
    sessionId: string;
  };
  
  // UI events
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
  
  // Dev server events
  'dev-server-output': {
    process_id: string;
    type: string;
    data: string;
  };
  'dev-server-stopped': {
    process_id: string;
    exit_code?: number;
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