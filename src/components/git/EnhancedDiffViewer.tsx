import { useState, useRef, useEffect } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EnhancedDiffViewerProps {
  oldValue: string;
  newValue: string;
  splitView?: boolean;
  onTextSelected?: (text: string, lineNumber?: number, side?: 'old' | 'new') => void;
  useDarkTheme?: boolean;
}

export function EnhancedDiffViewer({
  oldValue,
  newValue,
  splitView = false,
  onTextSelected,
  useDarkTheme = false
}: EnhancedDiffViewerProps) {
  const { t } = useTranslation();
  const [selectedText, setSelectedText] = useState<string>("");
  const [showAddCommentButton, setShowAddCommentButton] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  const diffContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text && diffContainerRef.current) {
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        const containerRect = diffContainerRef.current.getBoundingClientRect();
        
        if (rect && containerRect) {
          setSelectedText(text);
          setButtonPosition({
            x: rect.right - containerRect.left + 10,
            y: rect.top - containerRect.top
          });
          setShowAddCommentButton(true);
        }
      } else {
        setShowAddCommentButton(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.comment-button')) {
        setShowAddCommentButton(false);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleAddComment = () => {
    if (onTextSelected && selectedText) {
      // Try to determine line number and side from selection
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;
      
      let lineNumber: number | undefined;
      let side: 'old' | 'new' | undefined;
      
      // Try to find the line number from the DOM structure
      if (anchorNode) {
        const lineElement = anchorNode.parentElement?.closest('[data-line-number]');
        if (lineElement) {
          lineNumber = parseInt(lineElement.getAttribute('data-line-number') || '0');
        }
        
        // Determine side based on parent classes
        const sideElement = anchorNode.parentElement?.closest('.diff-code-old, .diff-code-new');
        if (sideElement?.classList.contains('diff-code-old')) {
          side = 'old';
        } else if (sideElement?.classList.contains('diff-code-new')) {
          side = 'new';
        }
      }
      
      onTextSelected(selectedText, lineNumber, side);
    }
    setShowAddCommentButton(false);
  };

  return (
    <div ref={diffContainerRef} className="relative h-full">
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
          className="comment-button absolute z-10 shadow-lg"
          style={{
            left: `${buttonPosition.x}px`,
            top: `${buttonPosition.y}px`
          }}
          onClick={handleAddComment}
        >
          <MessageSquarePlus className="h-3 w-3 mr-1" />
          {t('comments.addComment', 'Comment')}
        </Button>
      )}
    </div>
  );
}