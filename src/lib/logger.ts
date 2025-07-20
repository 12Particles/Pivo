import { BaseDirectory, writeTextFile, readTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

class Logger {
  private static instance: Logger;
  private logBuffer: string[] = [];
  private isInitialized = false;
  private logFilePath = 'logs/frontend.log';
  private maxBufferSize = 100;
  private flushInterval: number | null = null;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // Ensure logs directory exists
      if (!await exists('logs', { baseDir: BaseDirectory.AppData })) {
        await mkdir('logs', { baseDir: BaseDirectory.AppData, recursive: true });
      }

      this.isInitialized = true;

      // Set up periodic flush
      this.flushInterval = window.setInterval(() => {
        this.flush();
      }, 5000); // Flush every 5 seconds

      // Also flush on page unload
      window.addEventListener('beforeunload', () => {
        this.flush();
      });

      this.log(LogLevel.INFO, 'Frontend logger initialized');
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `${timestamp} | ${level.padEnd(5)} | ${message}${contextStr}`;
  }

  private async writeToFile(content: string) {
    try {
      // Read existing content
      let existingContent = '';
      try {
        existingContent = await readTextFile(this.logFilePath, { 
          baseDir: BaseDirectory.AppData 
        });
      } catch {
        // File doesn't exist yet
      }

      // Append new content
      await writeTextFile(this.logFilePath, existingContent + content, {
        baseDir: BaseDirectory.AppData
      });
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, context?: any) {
    const formattedMessage = this.formatMessage(level, message, context);
    
    // Console log
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message, context);
        break;
      case LogLevel.INFO:
        console.info(message, context);
        break;
      case LogLevel.WARN:
        console.warn(message, context);
        break;
      case LogLevel.ERROR:
        console.error(message, context);
        break;
    }

    // Buffer for file writing
    this.logBuffer.push(formattedMessage);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.logBuffer.length === 0 || !this.isInitialized) return;

    const content = this.logBuffer.join('\n') + '\n';
    this.logBuffer = [];

    await this.writeToFile(content);
  }

  debug(message: string, context?: any) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: any) {
    this.log(LogLevel.ERROR, message, context);
  }

  async clear() {
    try {
      await writeTextFile(this.logFilePath, '', {
        baseDir: BaseDirectory.AppData
      });
      this.logBuffer = [];
      this.info('Logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  destroy() {
    if (this.flushInterval) {
      window.clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

export const logger = Logger.getInstance();