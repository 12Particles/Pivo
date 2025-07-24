import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface TaskCommand {
  type: 'START_EXECUTION' | 'SEND_MESSAGE' | 'STOP_EXECUTION';
  taskId: string;
  payload?: any;
}

/**
 * Hook for sending commands to the backend
 * All operations are command-based, no state management here
 */
export function useTaskCommand() {
  const sendCommand = useCallback(async (command: TaskCommand) => {
    try {
      return await invoke('execute_task_command', { command });
    } catch (error) {
      console.error('Command failed:', command.type, error);
      throw error;
    }
  }, []);

  // Convenience methods
  const startExecution = useCallback(async (taskId: string, initialMessage?: string) => {
    return sendCommand({
      type: 'START_EXECUTION',
      taskId,
      payload: { initialMessage }
    });
  }, [sendCommand]);

  const sendMessage = useCallback(async (taskId: string, message: string, images?: string[]) => {
    return sendCommand({
      type: 'SEND_MESSAGE',
      taskId,
      payload: { message, images }
    });
  }, [sendCommand]);

  const stopExecution = useCallback(async (taskId: string) => {
    return sendCommand({
      type: 'STOP_EXECUTION',
      taskId
    });
  }, [sendCommand]);

  return {
    sendCommand,
    startExecution,
    sendMessage,
    stopExecution
  };
}