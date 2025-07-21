export interface CodeComment {
  id: string;
  filePath: string;
  lineNumber?: number;
  selectedText: string;
  comment: string;
  timestamp: Date;
  side?: 'old' | 'new';  // For diff view
}

export interface CommentDraft {
  taskId: string;
  comments: CodeComment[];
}