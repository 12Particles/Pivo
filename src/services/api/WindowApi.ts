import { invoke } from '@tauri-apps/api/core';

export class WindowApi {
  static async openProjectWindow(projectId: string, projectName: string): Promise<string> {
    return invoke('open_project_window', { projectId, projectName });
  }

  static async closeProjectWindow(projectId: string): Promise<void> {
    return invoke('close_project_window', { projectId });
  }

  static async getProjectWindow(projectId: string): Promise<string | null> {
    return invoke('get_project_window', { projectId });
  }

  static async listOpenProjectWindows(): Promise<[string, string][]> {
    return invoke('list_open_project_windows');
  }

  static async showLogViewer(): Promise<void> {
    return invoke('show_log_viewer');
  }
}

export const windowApi = WindowApi;