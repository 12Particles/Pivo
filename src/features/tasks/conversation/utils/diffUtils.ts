/**
 * Diff utilities for comparing text changes
 */

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  startLine: number;
  endLine: number;
  newStartLine: number;
  newEndLine: number;
  lines: DiffLine[];
}

/**
 * Enhanced line-based diff algorithm using Myers' algorithm concepts
 * Compares two texts line by line and returns the differences with proper hunks
 */
export function computeLineDiff(oldText: string, newText: string, contextLines: number = 3): DiffHunk[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const hunks: DiffHunk[] = [];
  
  // Simple LCS (Longest Common Subsequence) based diff
  const changes = computeChanges(oldLines, newLines);
  
  // Group changes into hunks with context
  let currentHunk: DiffHunk | null = null;
  let lastChangeIndex = -1;
  
  changes.forEach((change, index) => {
    if (change.type !== 'unchanged') {
      // Check if we need to start a new hunk
      if (!currentHunk || index - lastChangeIndex > contextLines * 2) {
        // Save previous hunk if exists
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        
        // Start new hunk
        const startIndex = Math.max(0, index - contextLines);
        currentHunk = {
          startLine: change.oldLine !== undefined ? change.oldLine : startIndex + 1,
          endLine: 0, // Will be set later
          newStartLine: change.newLine !== undefined ? change.newLine : startIndex + 1,
          newEndLine: 0, // Will be set later
          lines: []
        };
        
        // Add context lines before the change
        for (let i = startIndex; i < index; i++) {
          const contextChange = changes[i];
          if (contextChange.type === 'unchanged') {
            currentHunk.lines.push({
              type: 'unchanged',
              content: contextChange.content,
              lineNumber: contextChange.oldLine,
              newLineNumber: contextChange.newLine
            });
          }
        }
      }
      
      lastChangeIndex = index;
    }
    
    // Add current line to hunk if we're within context of a change
    if (currentHunk && index <= lastChangeIndex + contextLines) {
      currentHunk.lines.push({
        type: change.type,
        content: change.content,
        lineNumber: change.oldLine,
        newLineNumber: change.newLine
      });
      
      // Update end lines
      if (change.oldLine !== undefined) {
        currentHunk.endLine = change.oldLine;
      }
      if (change.newLine !== undefined) {
        currentHunk.newEndLine = change.newLine;
      }
    }
  });
  
  // Don't forget the last hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  
  return hunks;
}

interface Change {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLine?: number;
  newLine?: number;
}

/**
 * Compute LCS (Longest Common Subsequence) between two arrays
 */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const lcs: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }
  
  return lcs;
}

/**
 * Compute changes between two arrays of lines using LCS
 */
function computeChanges(oldLines: string[], newLines: string[]): Change[] {
  const changes: Change[] = [];
  const lcs = computeLCS(oldLines, newLines);
  
  let i = oldLines.length;
  let j = newLines.length;
  const oldLineNumbers: (number | undefined)[] = [];
  const newLineNumbers: (number | undefined)[] = [];
  const types: ('unchanged' | 'added' | 'removed')[] = [];
  const contents: string[] = [];
  
  // Backtrack through LCS to find changes
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      oldLineNumbers.unshift(i);
      newLineNumbers.unshift(j);
      types.unshift('unchanged');
      contents.unshift(oldLines[i - 1]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      oldLineNumbers.unshift(undefined);
      newLineNumbers.unshift(j);
      types.unshift('added');
      contents.unshift(newLines[j - 1]);
      j--;
    } else if (i > 0) {
      oldLineNumbers.unshift(i);
      newLineNumbers.unshift(undefined);
      types.unshift('removed');
      contents.unshift(oldLines[i - 1]);
      i--;
    }
  }
  
  // Convert to changes array
  for (let k = 0; k < types.length; k++) {
    changes.push({
      type: types[k],
      content: contents[k],
      oldLine: oldLineNumbers[k],
      newLine: newLineNumbers[k]
    });
  }
  
  return changes;
}