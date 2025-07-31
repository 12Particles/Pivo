// VCS hooks - functionality moved to integration components
// Temporary exports to fix compilation errors

export function useGitHubAuth() {
  return {
    config: null,
    loading: false,
    update: async () => {},
    refresh: async () => {},
    hasAuth: true,
  };
}

export function useGitLabAuth() {
  return {
    config: null,
    loading: false,
    update: async () => {},
  };
}

export function useVcsPullRequests(_options: any) {
  return {
    pullRequests: [] as any[],
    loading: false,
    refresh: async () => {},
  };
}