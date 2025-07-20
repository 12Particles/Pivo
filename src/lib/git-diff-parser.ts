export interface ParsedDiff {
  oldContent: string;
  newContent: string;
  oldFileName?: string;
  newFileName?: string;
}

export function parseGitDiff(diffContent: string, filePath: string): ParsedDiff {
  const lines = diffContent.split('\n');
  const fileHeader = `diff --git a/${filePath} b/${filePath}`;
  const startIndex = lines.findIndex(line => line.includes(fileHeader));
  
  if (startIndex === -1) {
    return { oldContent: '', newContent: '' };
  }
  
  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('diff --git')) {
      endIndex = i;
      break;
    }
  }
  
  const fileDiffLines = lines.slice(startIndex, endIndex);
  
  // Parse header to get file names
  let oldFileName = filePath;
  let newFileName = filePath;
  
  for (const line of fileDiffLines) {
    if (line.startsWith('--- ')) {
      oldFileName = line.substring(4) === '/dev/null' ? '' : line.substring(6);
    } else if (line.startsWith('+++ ')) {
      newFileName = line.substring(4) === '/dev/null' ? '' : line.substring(6);
    }
  }
  
  // For new files, get the entire content
  if (oldFileName === '') {
    const newLines: string[] = [];
    let inHunk = false;
    
    for (const line of fileDiffLines) {
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      if (!inHunk) continue;
      
      if (line.startsWith('+') && !line.startsWith('+++')) {
        newLines.push(line.substring(1));
      }
    }
    
    return {
      oldContent: '',
      newContent: newLines.join('\n'),
      oldFileName,
      newFileName
    };
  }
  
  // For deleted files, get the entire content
  if (newFileName === '') {
    const oldLines: string[] = [];
    let inHunk = false;
    
    for (const line of fileDiffLines) {
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      if (!inHunk) continue;
      
      if (line.startsWith('-') && !line.startsWith('---')) {
        oldLines.push(line.substring(1));
      }
    }
    
    return {
      oldContent: oldLines.join('\n'),
      newContent: '',
      oldFileName,
      newFileName
    };
  }
  
  // For modified files, reconstruct both versions
  const oldLines: string[] = [];
  const newLines: string[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;
  
  for (let i = 0; i < fileDiffLines.length; i++) {
    const line = fileDiffLines[i];
    
    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -1,7 +1,7 @@
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNumber = parseInt(match[1]) - 1;
        newLineNumber = parseInt(match[2]) - 1;
        
        // Add context lines if there's a gap
        while (oldLines.length < oldLineNumber || newLines.length < newLineNumber) {
          if (oldLines.length < oldLineNumber) oldLines.push('');
          if (newLines.length < newLineNumber) newLines.push('');
        }
      }
      continue;
    }
    
    if (line.startsWith('-') && !line.startsWith('---')) {
      oldLines.push(line.substring(1));
      oldLineNumber++;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      newLines.push(line.substring(1));
      newLineNumber++;
    } else if (line.startsWith(' ')) {
      const content = line.substring(1);
      oldLines.push(content);
      newLines.push(content);
      oldLineNumber++;
      newLineNumber++;
    }
  }
  
  return {
    oldContent: oldLines.join('\n'),
    newContent: newLines.join('\n'),
    oldFileName,
    newFileName
  };
}