/**
 * Execution-related type definitions
 */

// Unified message types matching backend
export enum UnifiedMessageType {
  User = 'user',
  Assistant = 'assistant',
  Thinking = 'thinking',
  ToolUse = 'tool_use',
  ToolResult = 'tool_result',
  System = 'system',
  ExecutionComplete = 'execution_complete',
  Raw = 'raw'
}

export enum SystemMessageLevel {
  Info = 'info',
  Warning = 'warning',
  Error = 'error'
}

export interface UnifiedMessage {
  type: UnifiedMessageType;
  timestamp: string;
  // Type-specific fields
  id?: string; // Message ID (for assistant, tool_use)
  content?: string;
  images?: string[];
  thinking?: string;
  tool_name?: string;
  tool_input?: any; // Full tool input preserved as JSON
  tool_use_id?: string; // For linking tool results to tool uses
  result?: string;
  is_error?: boolean;
  level?: SystemMessageLevel;
  metadata?: any; // For system messages
  success?: boolean;
  summary?: string;
  duration_ms?: number;
  cost_usd?: number;
  source?: string; // For raw messages
  data?: any; // For raw messages
}

// Attempt-level execution state
export interface AttemptExecutionState {
  task_id: string;
  attempt_id: string;
  current_execution: any | null;
  messages: UnifiedMessage[];
  agent_type: string;
}

// Task-level execution summary for UI
export interface TaskExecutionSummary {
  task_id: string;
  active_attempt_id: string | null;
  is_running: boolean;
  agent_type: string | null;
}