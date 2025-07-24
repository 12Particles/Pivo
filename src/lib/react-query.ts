import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: data is fresh for 30 seconds
      staleTime: 30 * 1000,
      // Cache time: keep data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Refetch on window focus
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Show error notifications on mutation failure
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

// Query keys factory for type safety and consistency
export const queryKeys = {
  // Projects
  projects: () => ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  
  // Tasks
  tasks: (projectId: string) => ['tasks', { projectId }] as const,
  task: (id: string) => ['tasks', id] as const,
  
  // VCS
  pullRequests: (projectId: string) => ['pullRequests', { projectId }] as const,
  gitStatus: (worktreePath: string) => ['gitStatus', { worktreePath }] as const,
  branches: (projectId: string) => ['branches', { projectId }] as const,
  
  // MCP
  mcpServers: () => ['mcpServers'] as const,
  mcpServer: (id: string) => ['mcpServers', id] as const,
} as const;