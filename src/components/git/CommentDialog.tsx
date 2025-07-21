import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CommentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  selectedText: string;
  fileName?: string;
  lineNumber?: number;
  startLine?: number;
  endLine?: number;
}

export function CommentDialog({
  isOpen,
  onClose,
  onSubmit,
  selectedText,
  fileName,
  lineNumber,
  startLine,
  endLine
}: CommentDialogProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit(comment.trim());
      setComment("");
      onClose();
    }
  };

  const handleClose = () => {
    setComment("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('comments.addComment', '添加评论')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Selected code preview */}
          <div>
            <h4 className="font-medium text-sm mb-2">{t('comments.selectedCode', '选中的代码:')}</h4>
            <div className="bg-muted p-3 rounded-md">
              {fileName && (
                <div className="text-xs text-muted-foreground mb-2">
                  <div className="font-medium">{fileName}</div>
                  {(startLine || lineNumber) && (
                    <div>
                      {startLine && endLine && startLine !== endLine 
                        ? `Lines ${startLine}-${endLine}`
                        : `Line ${startLine || lineNumber}`
                      }
                    </div>
                  )}
                </div>
              )}
              <pre className="text-xs overflow-x-auto bg-background p-2 rounded border max-h-[200px] overflow-y-auto">
                <code>{selectedText}</code>
              </pre>
            </div>
          </div>

          {/* Comment input */}
          <div>
            <h4 className="font-medium text-sm mb-2">{t('comments.yourComment', '你的评论:')}</h4>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('comments.enterComment', '输入你的评论...')}
              className="min-h-[100px] resize-none"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 flex gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button onClick={handleSubmit} disabled={!comment.trim()}>
            <MessageSquare className="h-3 w-3 mr-1" />
            {t('comments.addComment', '添加评论')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}