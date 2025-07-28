export function transformGitUrl(url: string): string {
  if (!url || url.trim() === '') {
    return url;
  }

  const trimmedUrl = url.trim();

  // If already a valid https URL, return as is
  if (trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // Handle SSH URLs
  if (trimmedUrl.startsWith('git@')) {
    // SSH format: git@github.com:user/repo.git
    // or git@gitlab.company.com:user/repo.git
    const match = trimmedUrl.match(/^git@([^:]+):(.+?)(\.git)?$/);
    if (match) {
      const host = match[1];
      const path = match[2];
      return `https://${host}/${path}`;
    }
  }

  // Handle SSH URLs with ssh:// prefix
  if (trimmedUrl.startsWith('ssh://')) {
    // SSH format: ssh://git@github.com/user/repo.git
    const match = trimmedUrl.match(/^ssh:\/\/git@([^\/]+)\/(.+?)(\.git)?$/);
    if (match) {
      const host = match[1];
      const path = match[2];
      return `https://${host}/${path}`;
    }
  }

  // Handle git:// URLs
  if (trimmedUrl.startsWith('git://')) {
    // git format: git://github.com/user/repo.git
    return trimmedUrl.replace(/^git:\/\//, 'https://');
  }

  // Handle relative paths that might be GitHub/GitLab paths
  // e.g., "user/repo" or "github.com/user/repo"
  if (!trimmedUrl.includes('://')) {
    // Check if it starts with a known domain
    const knownDomains = ['github.com', 'gitlab.com'];
    for (const domain of knownDomains) {
      if (trimmedUrl.startsWith(domain)) {
        return `https://${trimmedUrl}`;
      }
    }

    // If it looks like a user/repo format, assume GitHub by default
    if (trimmedUrl.match(/^[\w-]+\/[\w.-]+$/)) {
      return `https://github.com/${trimmedUrl}`;
    }
  }

  // Return original URL if no transformation needed
  return trimmedUrl;
}

export function isValidGitUrl(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }

  const transformedUrl = transformGitUrl(url);
  
  try {
    const urlObj = new URL(transformedUrl);
    // Check if it's a valid git hosting URL
    const validHosts = ['github.com', 'gitlab.com'];
    const isValidHost = validHosts.some(host => urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`));
    
    // For custom GitLab instances, check if the path looks like a git repo
    const hasValidPath = urlObj.pathname.match(/^\/[\w.-]+\/[\w.-]+/);
    
    return isValidHost || hasValidPath !== null;
  } catch {
    return false;
  }
}