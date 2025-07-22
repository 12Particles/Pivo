import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { CodingAgentExecution, CodingAgentType } from '@/types';

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
  current_execution?: CodingAgentExecution;
  messages: UnifiedMessage[];
  agent_type: CodingAgentType;
}

// Task-level execution summary (for kanban board)
export interface TaskExecutionSummary {
  task_id: string;
  active_attempt_id?: string;
  is_running: boolean;
  agent_type?: CodingAgentType;
}

interface ExecutionStore {
  // State organized by attempt_id
  attemptExecutions: Map<string, AttemptExecutionState>;
  
  // Task summaries for quick lookup
  taskSummaries: Map<string, TaskExecutionSummary>;
  
  // Getters
  getAttemptExecution: (attemptId: string) => AttemptExecutionState | undefined;
  getTaskSummary: (taskId: string) => TaskExecutionSummary | undefined;
  isTaskRunning: (taskId: string) => boolean;
  getRunningTasks: () => Set<string>;
  
  // Actions for attempt-level operations
  startExecution: (
    taskId: string, 
    attemptId: string,
    workingDirectory: string, 
    agentType: CodingAgentType,
    projectPath?: string,
    storedClaudeSessionId?: string
  ) => Promise<void>;
  
  sendInput: (attemptId: string, message: string, images: string[]) => Promise<void>;
  stopExecution: (attemptId: string) => Promise<void>;
  
  // Check if an attempt is active
  isAttemptActive: (attemptId: string) => Promise<boolean>;
  
  // Internal methods
  _updateAttemptExecution: (state: AttemptExecutionState) => void;
  _updateTaskSummary: (summary: TaskExecutionSummary) => void;
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  attemptExecutions: new Map(),
  taskSummaries: new Map(),
  
  getAttemptExecution: (attemptId) => {
    return get().attemptExecutions.get(attemptId);
  },
  
  getTaskSummary: (taskId) => {
    return get().taskSummaries.get(taskId);
  },
  
  isTaskRunning: (taskId) => {
    const summary = get().getTaskSummary(taskId);
    return summary?.is_running || false;
  },
  
  getRunningTasks: () => {
    const runningTasks = new Set<string>();
    get().taskSummaries.forEach((summary, taskId) => {
      if (summary.is_running) {
        runningTasks.add(taskId);
      }
    });
    return runningTasks;
  },
  
  startExecution: async (taskId, attemptId, workingDirectory, agentType, projectPath, storedClaudeSessionId) => {
    try {
      // Check if attempt already has an active execution
      const isActive = await get().isAttemptActive(attemptId);
      if (isActive) {
        throw new Error('This attempt already has an active execution');
      }
      
      let execution: CodingAgentExecution;
      
      if (agentType === CodingAgentType.ClaudeCode) {
        // Start Claude execution with attempt ID
        execution = await invoke<CodingAgentExecution>('start_claude_execution', {
          taskId,
          attemptId,
          workingDirectory,
          projectPath,
          storedClaudeSessionId
        });
      } else {
        // For Gemini, we need to update the backend to support attemptId
        execution = await invoke<CodingAgentExecution>('start_gemini_execution', {
          taskId,
          workingDirectory,
          contextFiles: []
        });
      }
      
      // Initialize attempt execution state
      set(state => {
        const newAttemptExecutions = new Map(state.attemptExecutions);
        newAttemptExecutions.set(attemptId, {
          task_id: taskId,
          attempt_id: attemptId,
          current_execution: execution,
          messages: [],
          agent_type: agentType,
        });
        
        // Also update task summary
        const newTaskSummaries = new Map(state.taskSummaries);
        newTaskSummaries.set(taskId, {
          task_id: taskId,
          active_attempt_id: attemptId,
          is_running: true,
          agent_type: agentType,
        });
        
        return { 
          attemptExecutions: newAttemptExecutions,
          taskSummaries: newTaskSummaries
        };
      });
    } catch (error) {
      console.error('Failed to start execution:', error);
      throw error;
    }
  },
  
  sendInput: async (attemptId, message, images) => {
    try {
      const attemptExecution = get().getAttemptExecution(attemptId);
      if (!attemptExecution?.current_execution) {
        throw new Error('No active execution for this attempt');
      }
      
      // Save images to temp if needed
      let imagePaths: string[] = [];
      if (images.length > 0) {
        imagePaths = await invoke<string[]>('save_images_to_temp', { base64Images: images });
      }
      
      // Send input to the execution
      await invoke('send_cli_input', { 
        executionId: attemptExecution.current_execution.id, 
        input: message 
      });
      
      // Add user message to the attempt's message history
      const userMessage: UnifiedMessage = {
        type: UnifiedMessageType.User,
        content: message,
        images: imagePaths,
        timestamp: new Date().toISOString()
      };
      
      set(state => {
        const newAttemptExecutions = new Map(state.attemptExecutions);
        const attemptState = newAttemptExecutions.get(attemptId);
        if (attemptState) {
          attemptState.messages.push(userMessage);
        }
        return { attemptExecutions: newAttemptExecutions };
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },
  
  stopExecution: async (attemptId) => {
    try {
      const attemptExecution = get().getAttemptExecution(attemptId);
      if (!attemptExecution?.current_execution) {
        throw new Error('No active execution for this attempt');
      }
      
      await invoke('stop_cli_execution', { executionId: attemptExecution.current_execution.id });
      
      // Update the state to reflect that execution has stopped
      set(state => {
        const newAttemptExecutions = new Map(state.attemptExecutions);
        const attemptState = newAttemptExecutions.get(attemptId);
        if (attemptState && attemptState.current_execution) {
          attemptState.current_execution.status = 'Stopped' as any;
        }
        
        // Update task summary
        const newTaskSummaries = new Map(state.taskSummaries);
        const taskSummary = newTaskSummaries.get(attemptState?.task_id || '');
        if (taskSummary) {
          taskSummary.is_running = false;
        }
        
        return { 
          attemptExecutions: newAttemptExecutions,
          taskSummaries: newTaskSummaries
        };
      });
    } catch (error) {
      console.error('Failed to stop execution:', error);
      throw error;
    }
  },
  
  isAttemptActive: async (attemptId) => {
    try {
      const isActive = await invoke<boolean>('is_attempt_active', { attemptId });
      return isActive;
    } catch (error) {
      console.error('Failed to check attempt status:', error);
      return false;
    }
  },
  
  _updateAttemptExecution: (state) => {
    set(prev => {
      const newAttemptExecutions = new Map(prev.attemptExecutions);
      newAttemptExecutions.set(state.attempt_id, state);
      return { attemptExecutions: newAttemptExecutions };
    });
  },
  
  _updateTaskSummary: (summary) => {
    set(prev => {
      const newTaskSummaries = new Map(prev.taskSummaries);
      newTaskSummaries.set(summary.task_id, summary);
      return { taskSummaries: newTaskSummaries };
    });
  },
  
}));

// Initialize event listeners
export function initExecutionStore() {
  // Listen for attempt execution updates
  listen<AttemptExecutionState>('attempt-execution-update', (event) => {
    useExecutionStore.getState()._updateAttemptExecution(event.payload);
  });
  
  // Listen for task execution summaries
  listen<TaskExecutionSummary>('task-execution-summary', (event) => {
    console.log('[ExecutionStore] Received task-execution-summary:', event.payload);
    useExecutionStore.getState()._updateTaskSummary(event.payload);
  });
  
  // Listen for process completion
  listen<any>('coding-agent-process-completed', (event) => {
    const { execution_id, task_id } = event.payload;
    const store = useExecutionStore.getState();
    
    // Find the attempt that has this execution
    for (const [_attemptId, state] of store.attemptExecutions) {
      if (state.current_execution?.id === execution_id) {
        // Update the execution status to Stopped
        const newState = { ...state };
        if (newState.current_execution) {
          newState.current_execution.status = 'Stopped' as any;
        }
        store._updateAttemptExecution(newState);
        
        // Also update task summary - create new object to trigger re-render
        const taskSummary = store.getTaskSummary(task_id);
        if (taskSummary) {
          store._updateTaskSummary({
            ...taskSummary,
            is_running: false
          });
        }
        
        break;
      }
    }
  });
  
  // Listen for unified coding agent messages
  listen<any>('coding-agent-message', (event) => {
    const { execution_id, task_id, message } = event.payload;
    const store = useExecutionStore.getState();
    
    // Find the attempt that has this execution
    for (const [_attemptId, state] of store.attemptExecutions) {
      if (state.current_execution?.id === execution_id) {
        // Add message to the attempt
        const newState = { ...state };
        newState.messages.push(message as UnifiedMessage);
        store._updateAttemptExecution(newState);
        
        // Check if this is a completion message
        if (message.type === UnifiedMessageType.ExecutionComplete) {
          // Update the execution status to Stopped
          if (newState.current_execution) {
            newState.current_execution.status = 'Stopped' as any;
          }
          store._updateAttemptExecution(newState);
          
          // Also update task summary - create new object to trigger re-render
          const taskSummary = store.getTaskSummary(task_id);
          if (taskSummary) {
            store._updateTaskSummary({
              ...taskSummary,
              is_running: false
            });
          }
        }
        
        break;
      }
    }
  });
}