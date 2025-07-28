/**
 * Path utilities for displaying file paths in conversation messages
 */

import { useApp } from '@/contexts/AppContext';
import { getRelativePathFromWorktree } from './workTreePathUtils';

/**
 * Convert absolute path to relative path from project root
 * @param absolutePath The absolute file path
 * @param projectPath The project root path
 * @returns Relative path from project root
 */
export function getRelativePath(absolutePath: string, projectPath: string): string {
  if (!absolutePath || !projectPath) {
    return absolutePath || '';
  }

  // Normalize paths by removing trailing slashes
  const normalizedAbsolute = absolutePath.replace(/\/$/, '');
  const normalizedProject = projectPath.replace(/\/$/, '');

  // If the absolute path starts with the project path, remove it
  if (normalizedAbsolute.startsWith(normalizedProject)) {
    const relativePath = normalizedAbsolute.slice(normalizedProject.length);
    // Remove leading slash if present
    return relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  }

  // If not under project path, return the absolute path
  return absolutePath;
}

/**
 * Get the project path from the current context
 * This is a hook that must be called within a React component
 */
export function useProjectPath(): string {
  const { currentProject } = useApp();
  return currentProject?.path || '';
}

/**
 * Format a file path for display
 * - Shortens long paths with ellipsis in the middle
 * - Preserves file name and important parent directories
 */
export function formatPathForDisplay(path: string, maxLength: number = 60): string {
  if (!path || path.length <= maxLength) {
    return path;
  }

  const parts = path.split('/');
  const fileName = parts[parts.length - 1];
  
  // If just the filename is too long, truncate it
  if (fileName.length > maxLength) {
    const ext = fileName.lastIndexOf('.');
    if (ext > 0) {
      const name = fileName.substring(0, ext);
      const extension = fileName.substring(ext);
      const keepLength = maxLength - extension.length - 3; // 3 for "..."
      return name.substring(0, keepLength) + '...' + extension;
    }
    return fileName.substring(0, maxLength - 3) + '...';
  }

  // Try to keep the last few directories and the filename
  let result = fileName;
  let i = parts.length - 2;
  
  while (i >= 0 && result.length + parts[i].length + 1 < maxLength - 3) {
    result = parts[i] + '/' + result;
    i--;
  }
  
  if (i >= 0) {
    result = '.../' + result;
  }
  
  return result;
}

/**
 * Check if a path is within the project directory
 */
export function isPathInProject(path: string, projectPath: string): boolean {
  if (!path || !projectPath) {
    return false;
  }
  
  const normalizedPath = path.replace(/\/$/, '');
  const normalizedProject = projectPath.replace(/\/$/, '');
  
  return normalizedPath.startsWith(normalizedProject);
}

/**
 * Get display path for a file, handling both worktree and regular project paths
 * @param absolutePath The absolute file path
 * @param projectPath The project root path (optional)
 * @returns The most appropriate relative path for display
 */
export function getDisplayPath(absolutePath: string, projectPath?: string): string {
  if (!absolutePath) {
    return '';
  }
  
  // First, try to extract from worktree path
  const worktreeRelative = getRelativePathFromWorktree(absolutePath);
  if (worktreeRelative !== absolutePath) {
    return worktreeRelative;
  }
  
  // Otherwise, try to make relative to project path if available
  if (projectPath) {
    return getRelativePath(absolutePath, projectPath);
  }
  
  // Fallback to absolute path
  return absolutePath;
}