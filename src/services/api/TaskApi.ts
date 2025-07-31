/**
 * Task API service using the new ApiClient
 */

import { invoke } from '@tauri-apps/api/core';
import { 
  Task, 
  TaskStatus, 
  CreateTaskRequest, 
  UpdateTaskRequest 
} from '@/types';

export class TaskApi {
  
  /**
   * Create a new task
   */
  async create(request: CreateTaskRequest): Promise<Task> {
    return invoke<Task>('create_task', { request });
  }
  
  /**
   * Get a task by ID
   */
  async get(id: string): Promise<Task | null> {
    return invoke<Task | null>('get_task', { id });
  }
  
  /**
   * List all tasks for a project
   */
  async list(projectId: string): Promise<Task[]> {
    return invoke<Task[]>('list_tasks', { projectId });
  }
  
  /**
   * Update a task
   */
  async update(id: string, request: UpdateTaskRequest): Promise<Task> {
    return invoke<Task>('update_task', { id, request });
  }
  
  /**
   * Update task status
   */
  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    return invoke<Task>('update_task_status', { id, status });
  }
  
  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    return invoke<void>('delete_task', { id });
  }
  
}

// Export singleton instance
export const taskApi = new TaskApi();