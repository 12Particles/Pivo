import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { CodeComment } from "@/types/comment";
import { MessageSquare, Send, Trash2, FileCode } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CommentPanelProps {
  comments: CodeComment[];
  onAddComment: (comment: Omit<CodeComment, 'id' | 'timestamp'>) => void;
  onDeleteComment: (id: string) => void;
  onSubmitToAgent: () => void;
  selectedText?: string;
  selectedFile?: string;
}

export function CommentPanel({
  comments,
  onAddComment,
  onDeleteComment,
  onSubmitToAgent,
  selectedText,
  selectedFile
}: CommentPanelProps) {
  const { t } = useTranslation();
  const [newComment, setNewComment] = useState("");

  const handleAddComment = () => {
    if (newComment.trim() && selectedText && selectedFile) {
      onAddComment({
        filePath: selectedFile,
        selectedText,
        comment: newComment.trim(),
      });
      setNewComment("");
    }
  };

  return (
    <div className="h-full flex flex-col p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {t('comments.title', 'Code Comments')}
        </h3>
        <span className="text-sm text-muted-foreground">
          {comments.length} {t('comments.count', 'comments')}
        </span>
      </div>

      {/* Add new comment section */}
      {selectedText && (
        <Card className="p-3 space-y-3 bg-muted/30">
          <div className="text-sm">
            <div className="font-medium mb-1">{t('comments.selectedCode', 'Selected Code:')}</div>
            <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
              <code>{selectedText}</code>
            </pre>
          </div>
          <div className="space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('comments.addComment', 'Add a comment...')}
              className="min-h-[80px] text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="w-full"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              {t('comments.add', 'Add Comment')}
            </Button>
          </div>
        </Card>
      )}

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card key={comment.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-3 w-3" />
                    <span className="font-medium">{comment.relativeFilePath || comment.filePath.split('/').pop()}</span>
                  </div>
                  {(comment.startLine || comment.lineNumber) && (
                    <div className="ml-5">
                      {comment.startLine && comment.endLine && comment.startLine !== comment.endLine 
                        ? `Lines ${comment.startLine}-${comment.endLine}`
                        : `Line ${comment.startLine || comment.lineNumber}`
                      }
                      {comment.side && <span className="ml-2 text-xs bg-muted px-1 rounded">({comment.side})</span>}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeleteComment(comment.id)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="space-y-1">
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                  <code>{comment.selectedText}</code>
                </pre>
                <p className="text-sm">{comment.comment}</p>
              </div>
              
              <div className="text-xs text-muted-foreground">
                {new Date(comment.timestamp).toLocaleString()}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Submit button */}
      {comments.length > 0 && (
        <Button
          onClick={onSubmitToAgent}
          className="w-full"
          variant="default"
        >
          <Send className="h-4 w-4 mr-2" />
          {t('comments.submitToAgent', 'Submit to Agent')} ({comments.length})
        </Button>
      )}
    </div>
  );
}