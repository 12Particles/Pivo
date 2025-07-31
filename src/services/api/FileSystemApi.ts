import { invoke } from "@tauri-apps/api/core";

export interface FileSearchResult {
  path: string;
  name: string;
  relative_path: string;
  modified_time: number;
  is_directory: boolean;
}

export class FileSystemApi {
  static async searchProjectFiles(
    projectPath: string,
    query: string,
    maxResults?: number
  ): Promise<FileSearchResult[]> {
    return invoke<FileSearchResult[]>("search_project_files", {
      projectPath,
      query,
      maxResults,
    });
  }

  static async searchFilesFromCurrentDir(
    currentPath: string,
    query: string,
    maxResults?: number
  ): Promise<FileSearchResult[]> {
    return invoke<FileSearchResult[]>("search_files_from_current_dir", {
      currentPath,
      query,
      maxResults,
    });
  }
}