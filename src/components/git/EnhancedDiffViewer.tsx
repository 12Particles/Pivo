import { useState, useRef, useEffect } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CommentDialog } from "./CommentDialog";

interface SelectionInfo {
  text: string;
  startLine?: number;
  endLine?: number;
  side?: 'old' | 'new';
}

interface EnhancedDiffViewerProps {
  oldValue: string;
  newValue: string;
  splitView?: boolean;
  onTextSelected?: (text: string, lineNumber?: number, side?: 'old' | 'new') => void;
  onCommentSubmit?: (selection: SelectionInfo, comment: string) => void;
  useDarkTheme?: boolean;
  fileName?: string;
}

export function EnhancedDiffViewer({
  oldValue,
  newValue,
  splitView = false,
  onTextSelected: _onTextSelected,
  onCommentSubmit,
  useDarkTheme = false,
  fileName
}: EnhancedDiffViewerProps) {
  const { t } = useTranslation();
  const [selectedText, setSelectedText] = useState<string>("");
  const [showAddCommentButton, setShowAddCommentButton] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelection = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        
        if (text && text.length > 0 && diffContainerRef.current) {
          const range = selection?.getRangeAt(0);
          const rect = range?.getBoundingClientRect();
          const containerRect = diffContainerRef.current.getBoundingClientRect();
          
          // Check if the selection is within our diff container using DOM containment
          const startContainer = range?.startContainer;
          const isWithinContainer = startContainer && diffContainerRef.current.contains(
            startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentNode : startContainer
          );
          
          if (rect && containerRect && isWithinContainer) {
            setSelectedText(text);
            
            // Calculate button position relative to the viewport (using fixed positioning)
            const buttonX = rect.right + 10;
            const buttonY = rect.top - 5;
            
            setButtonPosition({ x: buttonX, y: buttonY });
            setShowAddCommentButton(true);
          }
        } else {
          setShowAddCommentButton(false);
        }
      }, 50); // Small delay to ensure selection is complete
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't clear selection if comment dialog is open or if clicking on dialog elements
      if (showCommentDialog || target.closest('[role="dialog"]') || target.closest('.comment-button') || target.closest('.diff-container')) {
        return;
      }
      setShowAddCommentButton(false);
      setSelectedText("");
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showCommentDialog]);

  const getLineNumbersFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    
    // Helper function to find line number from a node
    const findLineNumber = (node: Node) => {
      let currentNode: Node | null = node;
      while (currentNode) {
        if (currentNode.nodeType === Node.ELEMENT_NODE) {
          const element = currentNode as Element;
          // Check for line number in various possible attributes/classes
          const lineAttr = element.getAttribute('data-line-number') || 
                          element.getAttribute('data-line') ||
                          element.querySelector('[data-line-number]')?.getAttribute('data-line-number');
          
          if (lineAttr) {
            return parseInt(lineAttr);
          }
        }
        currentNode = currentNode.parentNode;
      }
      return undefined;
    };
    
    // Helper function to determine side (old/new)
    const findSide = (node: Node): 'old' | 'new' | undefined => {
      let currentNode: Node | null = node;
      while (currentNode) {
        if (currentNode.nodeType === Node.ELEMENT_NODE) {
          const element = currentNode as Element;
          if (element.classList.contains('diff-code-old') || 
              element.closest('.diff-code-old')) {
            return 'old';
          }
          if (element.classList.contains('diff-code-new') || 
              element.closest('.diff-code-new')) {
            return 'new';
          }
        }
        currentNode = currentNode.parentNode;
      }
      return undefined;
    };
    
    const startLine = findLineNumber(startContainer);
    const endLine = startContainer === endContainer ? startLine : findLineNumber(endContainer);
    const side = findSide(startContainer);
    
    return {
      startLine,
      endLine: endLine || startLine,
      side
    };
  };

  const handleAddComment = () => {
    if (selectedText) {
      const lineInfo = getLineNumbersFromSelection();
      const selection: SelectionInfo = {
        text: selectedText,
        startLine: lineInfo?.startLine,
        endLine: lineInfo?.endLine,
        side: lineInfo?.side
      };
      
      setSelectionInfo(selection);
      setShowCommentDialog(true);
    }
    setShowAddCommentButton(false);
  };

  const handleCommentSubmit = (comment: string) => {
    if (onCommentSubmit && selectionInfo) {
      onCommentSubmit(selectionInfo, comment);
    }
    setSelectedText("");
    setSelectionInfo(null);
    setShowCommentDialog(false);
  };

  const handleCommentDialogClose = () => {
    setSelectedText("");
    setSelectionInfo(null);
    setShowCommentDialog(false);
  };

  return (
    <div ref={diffContainerRef} className="diff-container relative h-full">
      <ReactDiffViewer
        oldValue={oldValue}
        newValue={newValue}
        splitView={splitView}
        useDarkTheme={useDarkTheme}
        hideLineNumbers={false}
        showDiffOnly={false}
        styles={{
          variables: {
            dark: {
              diffViewerBackground: '#0a0a0a',
              addedBackground: '#0d2e1a',
              removedBackground: '#3d0f0f',
              wordAddedBackground: '#1a5232',
              wordRemovedBackground: '#6b1818',
              addedColor: '#87d96c',
              removedColor: '#ff9999',
              codeFoldBackground: '#1a1a1a',
              codeFoldGutterBackground: '#2a2a2a',
              codeFoldContentColor: '#808080',
            },
            light: {
              diffViewerBackground: '#ffffff',
              addedBackground: '#e6ffec',
              removedBackground: '#ffebe9',
              wordAddedBackground: '#abf2bc',
              wordRemovedBackground: '#ffb8b5',
              addedColor: '#24292e',
              removedColor: '#24292e',
              codeFoldBackground: '#f6f8fa',
              codeFoldGutterBackground: '#f6f8fa',
              codeFoldContentColor: '#586069',
            }
          },
          diffContainer: {
            userSelect: 'text',
            position: 'relative'
          }
        }}
      />
      
      {showAddCommentButton && (
        <Button
          size="sm"
          variant="default"
          className="comment-button fixed z-50 shadow-xl border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          style={{
            left: `${buttonPosition.x}px`,
            top: `${buttonPosition.y}px`,
            minWidth: '100px'
          }}
          onClick={handleAddComment}
        >
          <MessageSquarePlus className="h-3 w-3 mr-1" />
          {t('comments.addComment', 'Comment')}
        </Button>
      )}

      <CommentDialog
        isOpen={showCommentDialog}
        onClose={handleCommentDialogClose}
        onSubmit={handleCommentSubmit}
        selectedText={selectedText}
        fileName={fileName}
        lineNumber={selectionInfo?.startLine}
        startLine={selectionInfo?.startLine}
        endLine={selectionInfo?.endLine}
      />
    </div>
  );
}