/**
 * Execution API service using the new ApiClient
 */

import { cliApi as originalCliApi } from '@/lib/api';
import { 
  CodingAgentExecution,
  CodingAgentType
} from '@/types';

export class ExecutionApi {
  private api = originalCliApi;
  
  /**
   * Stop a coding agent execution
   */
  async stopExecution(executionId: string): Promise<void> {
    return this.api.stopExecution(executionId);
  }
  
  
  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<CodingAgentExecution | null> {
    return this.api.getExecution(executionId);
  }
  
  /**
   * List all executions
   */
  async listExecutions(): Promise<CodingAgentExecution[]> {
    return this.api.listExecutions();
  }
  
  
  // New prompt-based execution methods
  async executePrompt(
    prompt: string,
    taskId: string,
    attemptId: string,
    workingDirectory: string,
    agentType: CodingAgentType,
    projectPath?: string,
    resumeSessionId?: string
  ): Promise<CodingAgentExecution> {
    return this.api.executePrompt(
      prompt,
      taskId,
      attemptId,
      workingDirectory,
      agentType,
      projectPath,
      resumeSessionId
    );
  }
  
  // Deprecated: Use executePrompt instead
  async executeClaudePrompt(
    prompt: string,
    taskId: string,
    attemptId: string,
    workingDirectory: string,
    projectPath?: string,
    resumeSessionId?: string
  ): Promise<CodingAgentExecution> {
    return this.api.executeClaudePrompt(
      prompt,
      taskId,
      attemptId,
      workingDirectory,
      projectPath,
      resumeSessionId
    );
  }
  
  async executeGeminiPrompt(
    prompt: string,
    taskId: string,
    attemptId: string,
    workingDirectory: string,
    projectPath?: string
  ): Promise<CodingAgentExecution> {
    return this.api.executeGeminiPrompt(
      prompt,
      taskId,
      attemptId,
      workingDirectory,
      projectPath
    );
  }
  
  async saveImagesToTemp(base64Images: string[]): Promise<string[]> {
    return this.api.saveImagesToTemp(base64Images);
  }
}

// Export singleton instance
export const executionApi = new ExecutionApi();

// Legacy export name for compatibility
export const cliApi = executionApi;