/**
 * Task Attempt API service using the new ApiClient
 */

import { invoke } from '@tauri-apps/api/core';
import { TaskAttempt, AttemptStatus } from '@/types';

export class TaskAttemptApi {
  
  /**
   * Create a new task attempt
   */
  async create(taskId: string, executor?: string, baseBranch?: string): Promise<TaskAttempt> {
    const request = {
      task_id: taskId,
      executor: executor || null,
      base_branch: baseBranch || null
    };
    return invoke<TaskAttempt>('create_task_attempt', { request });
  }
  
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
  
  // Alias for compatibility
  async list(taskId: string): Promise<TaskAttempt[]> {
    return this.listForTask(taskId);
  }
  
  /**
   * Update attempt status
   */
  async updateStatus(id: string, status: AttemptStatus): Promise<TaskAttempt> {
    return invoke<TaskAttempt>('update_attempt_status', { id, status });
  }
  
  /**
   * Save conversation for an attempt
   */
  async saveConversation(attemptId: string, messages: any[]): Promise<any> {
    const request = { messages };
    return invoke('save_attempt_conversation', { attemptId, request });
  }
  
  /**
   * Get conversation for an attempt
   */
  async getConversation(attemptId: string): Promise<any> {
    return invoke('get_attempt_conversation', { attemptId });
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