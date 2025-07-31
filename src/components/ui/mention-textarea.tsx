import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { FileSystemApi, FileSearchResult } from '@/services/api';
import { FileIcon, FolderIcon } from 'lucide-react';
import { createPortal } from 'react-dom';

interface MentionTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onKeyDown'> {
  value: string;
  onChange: (value: string) => void;
  searchPath?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function MentionTextarea({
  value,
  onChange,
  searchPath,
  placeholder,
  rows = 3,
  className,
  onKeyDown,
  ...props
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<FileSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState<{ start: number; end: number } | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [shouldShowAbove, setShouldShowAbove] = useState(false);

  const searchFiles = useCallback(
    async (query: string) => {
      if (!searchPath || query.length < 1) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await FileSystemApi.searchProjectFiles(searchPath, query, 5);
        setSuggestions(results);
      } catch (error) {
        console.error('Failed to search files:', error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchPath]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPosition = e.target.selectionStart;

      // Check for @ symbol
      const lastAtSymbol = newValue.lastIndexOf('@', cursorPosition - 1);
      
      if (lastAtSymbol !== -1 && cursorPosition > lastAtSymbol) {
        const textAfterAt = newValue.slice(lastAtSymbol + 1, cursorPosition);
        
        // Check if we're still in a mention (no spaces or newlines)
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionPosition({ start: lastAtSymbol, end: cursorPosition });
          setShowSuggestions(true);
          setSelectedIndex(0);
          searchFiles(textAfterAt);
        } else {
          setShowSuggestions(false);
          setMentionPosition(null);
        }
      } else {
        setShowSuggestions(false);
        setMentionPosition(null);
      }

      onChange(newValue);
    },
    [onChange, searchFiles]
  );

  const insertMention = useCallback(
    (file: FileSearchResult) => {
      if (!mentionPosition || !textareaRef.current) return;

      const before = value.slice(0, mentionPosition.start);
      const after = value.slice(mentionPosition.end);
      const mention = `@${file.relative_path}`;
      
      const newValue = before + mention + after;
      onChange(newValue);
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = mentionPosition.start + mention.length;
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
          textareaRef.current.focus();
        }
      }, 0);

      setShowSuggestions(false);
      setMentionPosition(null);
    },
    [value, onChange, mentionPosition]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSuggestions) {
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
            e.preventDefault();
            if (suggestions[selectedIndex]) {
              insertMention(suggestions[selectedIndex]);
            }
            break;
          case 'Escape':
            e.preventDefault();
            setShowSuggestions(false);
            setMentionPosition(null);
            break;
        }
      } else if (onKeyDown) {
        // Pass through to parent handler when not showing suggestions
        onKeyDown(e);
      }
    },
    [showSuggestions, suggestions, selectedIndex, insertMention, onKeyDown]
  );


  // Calculate dropdown position when suggestions show
  useEffect(() => {
    if (showSuggestions && textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(240, suggestions.length * 40 + 20); // Approximate height
      
      // Determine if we should show above or below
      const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      setShouldShowAbove(showAbove);
      
      setDropdownPosition({
        top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    } else {
      setDropdownPosition(null);
    }
  }, [showSuggestions, suggestions.length]);

  // Handle clicks outside to close suggestions
  useEffect(() => {
    if (showSuggestions) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (textareaRef.current && !textareaRef.current.contains(target)) {
          setShowSuggestions(false);
          setMentionPosition(null);
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSuggestions]);

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
          className={cn(
            "fixed z-[100] max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-lg",
            shouldShowAbove ? "animate-in slide-in-from-bottom-2" : "animate-in slide-in-from-top-2"
          )}
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
        >
          {isSearching ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Searching...</div>
          ) : (
            suggestions.map((file, index) => (
              <button
                key={file.path}
                type="button"
                onClick={() => insertMention(file)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors",
                  index === selectedIndex && "bg-accent"
                )}
              >
                {file.is_directory ? (
                  <FolderIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{file.relative_path}</span>
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}