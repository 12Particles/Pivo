/**
 * Command API service for searching and managing slash commands
 */

import { invoke } from '@tauri-apps/api/core';
import { CommandSearchResult } from '@/types';

export class CommandApi {
  /**
   * Search for commands in the current project
   */
  async search(projectPath: string, query?: string, limit?: number): Promise<CommandSearchResult> {
    return invoke<CommandSearchResult>('search_commands', {
      projectPath,
      query,
      limit,
    });
  }

  /**
   * Get command content by path
   */
  async getContent(commandPath: string): Promise<string> {
    return invoke<string>('get_command_content', {
      commandPath,
    });
  }
}

// Export singleton instance
export const commandApi = new CommandApi();