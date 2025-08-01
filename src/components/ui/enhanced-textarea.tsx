import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { FileSystemApi, FileSearchResult, commandApi } from '@/services/api';
import { FileIcon, FolderIcon, Terminal } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Command } from '@/types';

type FileSuggestion = FileSearchResult & { suggestionType: 'file' };
type CommandSuggestion = Command & { suggestionType: 'command' };
type Suggestion = FileSuggestion | CommandSuggestion;

interface EnhancedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onKeyDown'> {
  value: string;
  onChange: (value: string) => void;
  searchPath?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  enableMentions?: boolean;
  enableCommands?: boolean;
}

export function EnhancedTextarea({
  value,
  onChange,
  searchPath,
  placeholder,
  rows = 3,
  className,
  onKeyDown,
  enableMentions = true,
  enableCommands = true,
  ...props
}: EnhancedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setSuggestionType] = useState<'file' | 'command' | null>(null);
  const [triggerPosition, setTriggerPosition] = useState<{ start: number; end: number } | null>(
    null
  );
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number; maxHeight?: number } | null>(null);
  const [shouldShowAbove, setShouldShowAbove] = useState(false);

  const searchFiles = useCallback(
    async (query: string) => {
      if (!searchPath || query.length < 1) {
        setSuggestions([]);
        return;
      }

      try {
        const results = await FileSystemApi.searchProjectFiles(searchPath, query, 5);
        setSuggestions(results.map(r => ({ ...r, suggestionType: 'file' as const } as FileSuggestion)));
      } catch (error) {
        console.error('Failed to search files:', error);
        setSuggestions([]);
      }
    },
    [searchPath]
  );

  const searchCommands = useCallback(
    async (query: string) => {
      if (!searchPath) {
        setSuggestions([]);
        return;
      }

      try {
        const result = await commandApi.search(searchPath, query, 5);
        setSuggestions(result.commands.map(c => ({ ...c, suggestionType: 'command' as const } as CommandSuggestion)));
      } catch (error) {
        console.error('Failed to search commands:', error);
        setSuggestions([]);
      }
    },
    [searchPath]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPosition = e.target.selectionStart;

      // Check for @ symbol (mentions)
      if (enableMentions) {
        const lastAtSymbol = newValue.lastIndexOf('@', cursorPosition);
        
        if (lastAtSymbol !== -1 && cursorPosition > lastAtSymbol) {
          const textAfterAt = newValue.slice(lastAtSymbol + 1, cursorPosition);
          
          // Check if we're still in a mention (no spaces or newlines)
          if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
            setTriggerPosition({ start: lastAtSymbol, end: cursorPosition });
            setShowSuggestions(true);
            setSuggestionType('file');
            setSelectedIndex(0);
            searchFiles(textAfterAt);
            onChange(newValue);
            return;
          }
        }
      }

      // Check for / symbol (commands)
      if (enableCommands) {
        const lastSlash = newValue.lastIndexOf('/', cursorPosition);
        
        if (lastSlash !== -1 && cursorPosition > lastSlash) {
          const textAfterSlash = newValue.slice(lastSlash + 1, cursorPosition);
          
          // Check if we're still in a command (no spaces or newlines)
          if (!textAfterSlash.includes(' ') && !textAfterSlash.includes('\n')) {
            setTriggerPosition({ start: lastSlash, end: cursorPosition });
            setShowSuggestions(true);
            setSuggestionType('command');
            setSelectedIndex(0);
            searchCommands(textAfterSlash);
            onChange(newValue);
            return;
          }
        }
      }

      // No trigger found
      setShowSuggestions(false);
      setTriggerPosition(null);
      setSuggestionType(null);
      onChange(newValue);
    },
    [onChange, searchFiles, searchCommands, enableMentions, enableCommands]
  );

  const insertSuggestion = useCallback(
    (suggestion: Suggestion) => {
      if (!textareaRef.current || !triggerPosition) return;

      const before = value.slice(0, triggerPosition.start);
      const after = value.slice(triggerPosition.end);
      
      let insertion: string;
      if (suggestion.suggestionType === 'file') {
        insertion = `@${suggestion.relative_path}`;
      } else {
        insertion = suggestion.name;
      }
      
      const newValue = before + insertion + after;
      onChange(newValue);
      
      // Close suggestions
      setShowSuggestions(false);
      setTriggerPosition(null);
      setSuggestionType(null);
      
      // Set cursor position after the insertion
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = triggerPosition.start + insertion.length;
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
          textareaRef.current.focus();
        }
      }, 0);

      setShowSuggestions(false);
      setTriggerPosition(null);
      setSuggestionType(null);
    },
    [value, onChange, triggerPosition]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSuggestions && suggestions.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % suggestions.length);
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
            break;
          case 'Enter':
          case 'Tab':
            e.preventDefault();
            if (suggestions[selectedIndex]) {
              insertSuggestion(suggestions[selectedIndex]);
            }
            break;
          case 'Escape':
            e.preventDefault();
            setShowSuggestions(false);
            setTriggerPosition(null);
            setSuggestionType(null);
            break;
        }
      } else if (onKeyDown) {
        // Pass through to parent handler when not showing suggestions
        onKeyDown(e);
      }
    },
    [showSuggestions, suggestions, selectedIndex, insertSuggestion, onKeyDown]
  );

  // Calculate dropdown position when suggestions show
  useEffect(() => {
    if (showSuggestions && textareaRef.current && triggerPosition) {
      const textarea = textareaRef.current;
      const rect = textarea.getBoundingClientRect();
      
      // Create a temporary element to measure text dimensions
      const temp = document.createElement('div');
      temp.style.position = 'absolute';
      temp.style.visibility = 'hidden';
      temp.style.whiteSpace = 'pre-wrap';
      temp.style.font = window.getComputedStyle(textarea).font;
      temp.style.padding = window.getComputedStyle(textarea).padding;
      temp.style.width = `${textarea.clientWidth}px`;
      
      // Get text up to the trigger position
      const textBeforeCursor = value.substring(0, triggerPosition.start);
      temp.textContent = textBeforeCursor;
      document.body.appendChild(temp);
      
      // Calculate cursor position
      const lines = textBeforeCursor.split('\n');
      const lastLine = lines[lines.length - 1];
      
      // Create another temp element for the last line
      const lineTemp = document.createElement('span');
      lineTemp.style.font = window.getComputedStyle(textarea).font;
      lineTemp.textContent = lastLine;
      temp.appendChild(lineTemp);
      
      const lineWidth = lineTemp.offsetWidth;
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
      const cursorLine = lines.length - 1;
      
      document.body.removeChild(temp);
      
      // Calculate position relative to textarea
      const cursorX = rect.left + lineWidth + parseInt(window.getComputedStyle(textarea).paddingLeft);
      const cursorY = rect.top + (cursorLine * lineHeight) + parseInt(window.getComputedStyle(textarea).paddingTop);
      
      // Calculate actual dropdown height based on content
      const itemHeight = 40; // Approximate height of each suggestion item
      const paddingAndBorder = 20; // Padding and border of dropdown
      const maxHeight = 240; // Maximum height from CSS
      const actualHeight = Math.min(maxHeight, suggestions.length * itemHeight + paddingAndBorder);
      
      const spaceBelow = window.innerHeight - (cursorY + lineHeight);
      const spaceAbove = cursorY;
      const minSpaceRequired = 80; // Minimum space to show dropdown
      
      // Determine if we should show above or below
      let showAbove = false;
      let dropdownHeight = actualHeight;
      
      if (spaceBelow >= minSpaceRequired) {
        // Prefer showing below if there's enough space
        showAbove = false;
        dropdownHeight = Math.min(actualHeight, spaceBelow - 10);
      } else if (spaceAbove >= minSpaceRequired) {
        // Show above if there's more space above
        showAbove = true;
        dropdownHeight = Math.min(actualHeight, spaceAbove - 10);
      } else {
        // Not enough space either way, show where there's more space
        showAbove = spaceAbove > spaceBelow;
        dropdownHeight = Math.min(actualHeight, Math.max(spaceAbove, spaceBelow) - 10);
      }
      
      setShouldShowAbove(showAbove);
      
      // Calculate the top position
      let top: number;
      if (showAbove) {
        top = cursorY - dropdownHeight - 2;
      } else {
        top = cursorY + lineHeight + 2;
      }
      
      // Final bounds check
      top = Math.max(5, Math.min(top, window.innerHeight - dropdownHeight - 5));
      
      setDropdownPosition({
        top,
        left: Math.min(Math.max(10, cursorX), window.innerWidth - 310), // Keep 10px margin from edges
        width: 300, // Fixed width for dropdown
        maxHeight: dropdownHeight // Pass the calculated height
      });
    } else {
      setDropdownPosition(null);
    }
  }, [showSuggestions, suggestions.length, value, triggerPosition]);

  // Handle clicks outside to close suggestions
  useEffect(() => {
    if (showSuggestions) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const dropdown = document.querySelector('[data-suggestions-dropdown]');
        
        if (
          textareaRef.current && 
          !textareaRef.current.contains(target) &&
          (!dropdown || !dropdown.contains(target))
        ) {
          setShowSuggestions(false);
          setTriggerPosition(null);
          setSuggestionType(null);
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSuggestions]);

  const renderSuggestion = (suggestion: Suggestion, index: number) => {
    const isSelected = index === selectedIndex;
    
    if (suggestion.suggestionType === 'file') {
      return (
        <button
          key={suggestion.path}
          type="button"
          onClick={() => insertSuggestion(suggestion)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors",
            isSelected && "bg-accent"
          )}
        >
          {suggestion.is_directory ? (
            <FolderIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="flex-1 truncate">{suggestion.relative_path}</span>
        </button>
      );
    } else {
      const commandSuggestion = suggestion as CommandSuggestion;
      return (
        <button
          key={commandSuggestion.path}
          type="button"
          onClick={() => insertSuggestion(suggestion)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={cn(
            "flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors",
            isSelected && "bg-accent"
          )}
        >
          <Terminal className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{commandSuggestion.name}</div>
            {commandSuggestion.description && (
              <div className="text-xs text-muted-foreground truncate">{commandSuggestion.description}</div>
            )}
          </div>
        </button>
      );
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className
        )}
        {...props}
      />
      
      {showSuggestions && suggestions.length > 0 && dropdownPosition && createPortal(
        <div
          data-suggestions-dropdown
          className={cn(
            "fixed z-[9999] overflow-auto rounded-md border bg-popover p-1 shadow-lg",
            shouldShowAbove ? "animate-in slide-in-from-bottom-2" : "animate-in slide-in-from-top-2"
          )}
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: dropdownPosition.maxHeight ? `${dropdownPosition.maxHeight}px` : '240px'
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          {suggestions.map((suggestion, index) => renderSuggestion(suggestion, index))}
        </div>,
        document.body
      )}
    </div>
  );
}

// Export with the old name for backward compatibility
export { EnhancedTextarea as MentionTextarea };