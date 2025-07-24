/**
 * Logging API service for managing application logs
 */

import { loggingApi as originalLoggingApi } from '@/lib/api';
import { logger } from '@/lib/logger';

export class LoggingApi {
  private api = originalLoggingApi;
  
  /**
   * Get log content
   */
  async getLogContent(lines?: number): Promise<string> {
    return this.api.getLogContent(lines);
  }
  
  /**
   * Get the path to the log file
   */
  async getLogPath(): Promise<string> {
    return this.api.getLogPath();
  }
  
  /**
   * Open the log file in the system's default editor
   */
  async openLogFile(): Promise<void> {
    logger.info('Opening log file');
    return this.api.openLogFile();
  }
  
  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    logger.info('Clearing logs');
    return this.api.clearLogs();
  }
  
  /**
   * Export logs to a file
   */
  async exportLogs(targetPath: string): Promise<void> {
    const content = await this.getLogContent();
    // This would need to be implemented with file system access
    logger.info('Exporting logs', { targetPath, size: content.length });
    // For now, just return the content
    return Promise.resolve();
  }
  
  /**
   * Get logs for a specific time range
   */
  async getLogsByTimeRange(
    startTime: Date,
    endTime: Date,
    lines?: number
  ): Promise<string> {
    // Get all logs and filter by time range
    // This is a simple implementation - could be optimized on the backend
    const allLogs = await this.getLogContent(lines);
    const logLines = allLogs.split('\n');
    
    const filteredLines = logLines.filter(line => {
      // Simple timestamp parsing - adjust based on actual log format
      const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      if (!timestampMatch) return false;
      
      const timestamp = new Date(timestampMatch[0]);
      return timestamp >= startTime && timestamp <= endTime;
    });
    
    return filteredLines.join('\n');
  }
  
  /**
   * Search logs for a specific pattern
   */
  async searchLogs(pattern: string, lines?: number): Promise<string[]> {
    const content = await this.getLogContent(lines);
    const logLines = content.split('\n');
    
    const regex = new RegExp(pattern, 'i');
    return logLines.filter(line => regex.test(line));
  }
  
  /**
   * Get log statistics
   */
  async getLogStats(): Promise<{
    totalLines: number;
    fileSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    const content = await this.getLogContent();
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse timestamps from first and last lines
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;
    
    if (lines.length > 0) {
      const firstTimestamp = lines[0].match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      const lastTimestamp = lines[lines.length - 1].match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      if (firstTimestamp) oldestEntry = new Date(firstTimestamp[0]);
      if (lastTimestamp) newestEntry = new Date(lastTimestamp[0]);
    }
    
    return {
      totalLines: lines.length,
      fileSize: content.length,
      oldestEntry,
      newestEntry
    };
  }
}

// Export singleton instance
export const loggingApi = new LoggingApi();