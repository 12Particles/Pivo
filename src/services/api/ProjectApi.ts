/**
 * Project API service using the new ApiClient
 */

import { invoke } from '@tauri-apps/api/core';
import { 
  Project, 
  CreateProjectRequest, 
  UpdateProjectRequest 
} from '@/types';

export interface ProjectInfo {
  path: string;
  name: string;
  description?: string;
  git_repo?: string;
  main_branch?: string;
  setup_script?: string;
  dev_script?: string;
  has_git: boolean;
  has_package_json: boolean;
}

export class ProjectApi {
  
  /**
   * Create a new project
   */
  async create(request: CreateProjectRequest): Promise<Project> {
    return invoke<Project>('create_project', { request });
  }
  
  /**
   * Get a project by ID
   */
  async get(id: string): Promise<Project | null> {
    return invoke<Project | null>('get_project', { id });
  }
  
  /**
   * List all projects
   */
  async list(): Promise<Project[]> {
    return invoke<Project[]>('list_projects');
  }
  
  /**
   * Update a project
   */
  async update(id: string, request: UpdateProjectRequest): Promise<Project> {
    return invoke<Project>('update_project', { id, request });
  }
  
  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    return invoke<void>('delete_project', { id });
  }
  
  /**
   * Refresh git providers for all projects
   */
  async refreshAllGitProviders(): Promise<Project[]> {
    return invoke<Project[]>('refresh_all_git_providers');
  }
  
  /**
   * Update project's last opened timestamp
   */
  async updateLastOpened(id: string): Promise<void> {
    return invoke<void>('update_project_last_opened', { id });
  }
  
  /**
   * Get recent projects
   */
  async getRecentProjects(limit: number = 10): Promise<Project[]> {
    return invoke<Project[]>('get_recent_projects', { limit });
  }
  
  /**
   * Open a directory picker dialog and return the selected path
   */
  async selectProjectDirectory(): Promise<string | null> {
    return invoke<string | null>('select_project_directory');
  }
  
  /**
   * Read project information from a directory path
   */
  async readProjectInfo(path: string): Promise<ProjectInfo> {
    return invoke<ProjectInfo>('read_project_info', { path });
  }
}

// Export singleton instance
export const projectApi = new ProjectApi();