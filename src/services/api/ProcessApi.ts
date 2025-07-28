/**
 * Process API service for managing execution processes
 */

import { processApi as originalProcessApi } from '@/lib/api';
import { ExecutionProcess, ProcessType } from '@/types';
import { logger } from '@/lib/logger';

export class ProcessApi {
  private api = originalProcessApi;
  
  /**
   * Spawn a new process
   */
  async spawn(
    taskAttemptId: string,
    processType: ProcessType,
    command: string,
    args: string[],
    workingDirectory: string
  ): Promise<string> {
    logger.debug('Spawning process', {
      taskAttemptId,
      processType,
      command,
      args,
      workingDirectory
    });
    
    return this.api.spawn(
      taskAttemptId,
      processType,
      command,
      args,
      workingDirectory
    );
  }
  
  /**
   * Kill a running process
   */
  async kill(processId: string): Promise<void> {
    logger.debug('Killing process', { processId });
    return this.api.kill(processId);
  }
  
  /**
   * Get process by ID
   */
  async get(id: string): Promise<ExecutionProcess | null> {
    return this.api.get(id);
  }
  
  /**
   * List processes for an attempt
   */
  async listForAttempt(taskAttemptId: string): Promise<ExecutionProcess[]> {
    return this.api.listForAttempt(taskAttemptId);
  }
  
  /**
   * Wait for process to complete
   */
  async waitForCompletion(
    processId: string,
    timeoutMs: number = 60000
  ): Promise<ExecutionProcess> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const process = await this.get(processId);
      
      if (!process) {
        throw new Error(`Process ${processId} not found`);
      }
      
      if (process.status === 'completed' || process.status === 'failed') {
        return process;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Process ${processId} timed out after ${timeoutMs}ms`);
  }
}

// Export singleton instance
export const processApi = new ProcessApi();