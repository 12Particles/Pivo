/**
 * Project API service using the new ApiClient
 */

import { invoke } from '@tauri-apps/api/core';
import { 
  Project, 
  CreateProjectRequest, 
  UpdateProjectRequest 
} from '@/types';

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
}

// Export singleton instance
export const projectApi = new ProjectApi();