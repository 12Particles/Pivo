import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Simplified command types based on RFC
export type TaskCommand = 
  | {
      type: 'SEND_MESSAGE';
      taskId: string;
      message: string;
      images?: string[];
    }
  | {
      type: 'STOP_EXECUTION';
      taskId: string;
    };

/**
 * Hook for sending commands to the backend
 * Simplified API based on RFC - no START_EXECUTION, attempt must exist
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

  // Send message (requires existing attempt)
  const sendMessage = useCallback(async (taskId: string, message: string, images?: string[]) => {
    return sendCommand({
      type: 'SEND_MESSAGE',
      taskId,
      message,
      images
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
    sendMessage,
    stopExecution
  };
}