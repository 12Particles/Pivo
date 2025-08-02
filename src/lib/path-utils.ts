/**
 * Safely join path segments, handling edge cases like trailing/leading slashes
 */
export function joinPath(...segments: string[]): string {
  return segments
    .filter(Boolean) // Remove empty strings
    .map((segment, index) => {
      // Remove trailing slash from all segments except the last
      if (index < segments.length - 1) {
        return segment.replace(/\/$/, '');
      }
      return segment;
    })
    .join('/')
    .replace(/\/+/g, '/'); // Replace multiple slashes with single slash
}

/**
 * Get the filename from a path
 */
export function getFileName(path: string): string {
  // Handle both Unix and Windows path separators
  const parts = path.split(/[/\\]/);
  return parts.pop() || path;
}