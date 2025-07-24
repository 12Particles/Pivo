// Temporary compatibility layer for VCS hooks
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