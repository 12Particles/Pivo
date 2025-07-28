/**
 * Utilities for handling worktree paths in task executions
 */

/**
 * Extract relative path from a worktree path
 * Worktree paths have format: /path/to/pivo-worktrees/task-xxx/relative/path/to/file
 * @param absolutePath The absolute worktree path
 * @returns The relative path within the project
 */
export function getRelativePathFromWorktree(absolutePath: string): string {
  if (!absolutePath) {
    return '';
  }

  // Match worktree pattern
  const worktreeMatch = absolutePath.match(/\/pivo-worktrees\/[^/]+\/(.+)/);
  if (worktreeMatch) {
    return worktreeMatch[1];
  }

  // If not a worktree path, return as is
  return absolutePath;
}

/**
 * Check if a path is a worktree path
 * @param path The path to check
 * @returns True if it's a worktree path
 */
export function isWorktreePath(path: string): boolean {
  return path.includes('/pivo-worktrees/');
}