export interface CodeComment {
  id: string;
  filePath: string;
  relativeFilePath?: string;  // Relative path from project root
  lineNumber?: number;
  startLine?: number;  // Start line of selection
  endLine?: number;    // End line of selection
  selectedText: string;
  comment: string;
  timestamp: Date;
  side?: 'old' | 'new';  // For diff view
}

export interface CommentDraft {
  taskId: string;
  comments: CodeComment[];
}