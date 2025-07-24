/**
 * Terminal API service for managing terminal sessions
 */

import { terminalApi as originalTerminalApi } from '@/lib/api';
import { TerminalSession } from '@/types';
import { logger } from '@/lib/logger';

export class TerminalApi {
  private api = originalTerminalApi;
  
  /**
   * Create a new terminal session
   */
  async createSession(
    taskAttemptId: string,
    rows: number,
    cols: number,
    workingDirectory: string
  ): Promise<TerminalSession> {
    logger.debug('Creating terminal session', {
      taskAttemptId,
      rows,
      cols,
      workingDirectory
    });
    
    return this.api.createSession(
      taskAttemptId,
      rows,
      cols,
      workingDirectory
    );
  }
  
  /**
   * Write data to terminal
   */
  async write(sessionId: string, data: string): Promise<void> {
    return this.api.write(sessionId, data);
  }
  
  /**
   * Resize terminal
   */
  async resize(sessionId: string, rows: number, cols: number): Promise<void> {
    logger.debug('Resizing terminal', { sessionId, rows, cols });
    return this.api.resize(sessionId, rows, cols);
  }
  
  /**
   * Close terminal session
   */
  async close(sessionId: string): Promise<void> {
    logger.debug('Closing terminal session', { sessionId });
    return this.api.close(sessionId);
  }
  
  /**
   * List all active terminal sessions
   */
  async listSessions(): Promise<string[]> {
    return this.api.listSessions();
  }
  
  /**
   * Clear terminal
   */
  async clear(sessionId: string): Promise<void> {
    // Send clear screen escape sequence
    return this.write(sessionId, '\x1b[2J\x1b[H');
  }
  
  /**
   * Send interrupt signal (Ctrl+C)
   */
  async interrupt(sessionId: string): Promise<void> {
    return this.write(sessionId, '\x03');
  }
}

// Export singleton instance
export const terminalApi = new TerminalApi();