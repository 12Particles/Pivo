/**
 * Task Attempt API service using the new ApiClient
 */

import { invoke } from '@tauri-apps/api/core';
import { TaskAttempt } from '@/types';

export class TaskAttemptApi {
  
  /**
   * Get a task attempt by ID
   */
  async get(id: string): Promise<TaskAttempt | null> {
    return invoke<TaskAttempt | null>('get_task_attempt', { id });
  }
  
  /**
   * List attempts for a task
   */
  async listForTask(taskId: string): Promise<TaskAttempt[]> {
    return invoke<TaskAttempt[]>('list_task_attempts', { taskId });
  }
  
  
  /**
   * Update Claude session ID
   */
  async updateClaudeSessionId(attemptId: string, claudeSessionId: string): Promise<void> {
    return invoke('update_attempt_claude_session', { attemptId, claudeSessionId });
  }
}

// Export singleton instance
export const taskAttemptApi = new TaskAttemptApi();