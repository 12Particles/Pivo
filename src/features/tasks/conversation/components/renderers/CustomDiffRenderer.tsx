import { computeLineDiff, DiffLine } from "../../utils/diffUtils";

interface CustomDiffRendererProps {
  oldValue: string;
  newValue: string;
  title?: string;
}

export function CustomDiffRenderer({ oldValue, newValue, title }: CustomDiffRendererProps) {
  const hunks = computeLineDiff(oldValue, newValue, 2);
  
  if (hunks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3">
        No changes detected
      </div>
    );
  }
  
  const getLineClassName = (type: DiffLine['type']) => {
    const baseClass = 'font-mono text-xs whitespace-pre flex w-full';
    
    switch (type) {
      case 'added':
        return `${baseClass} bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100`;
      case 'removed':
        return `${baseClass} bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100`;
      case 'unchanged':
      default:
        return `${baseClass} text-muted-foreground`;
    }
  };
  
  const getLineNumberClassName = (type: DiffLine['type']) => {
    const baseClass = 'flex-shrink-0 w-10 px-1.5 text-xs border-r select-none min-h-[1.25rem] flex items-center justify-end';
    
    switch (type) {
      case 'added':
        return `${baseClass} text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-600`;
      case 'removed':
        return `${baseClass} text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-600`;
      case 'unchanged':
      default:
        return `${baseClass} text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700`;
    }
  };
  
  const getLinePrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      case 'unchanged':
      default:
        return ' ';
    }
  };
  
  return (
    <div className="w-full">
      {title && (
        <div className="text-sm font-medium text-muted-foreground mb-2">
          {title}
        </div>
      )}
      
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {hunks.map((hunk, hunkIndex) => (
              <div key={hunkIndex}>
                {hunkIndex > 0 && (
                  <div className="w-full h-5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-t border-b border-gray-200 dark:border-gray-700 flex items-center px-2">
                    <span className="select-none">...</span>
                  </div>
                )}
                {hunk.lines.map((line, lineIndex) => (
                  <div
                    key={`${hunkIndex}-${lineIndex}`}
                    className={getLineClassName(line.type)}
                    style={{ minWidth: 'max-content' }}
                  >
                    <div className={getLineNumberClassName(line.type)}>
                      <span className="inline-block text-right text-xs">
                        {line.type !== 'added' ? line.lineNumber || '' : ''}
                      </span>
                    </div>
                    <div className={getLineNumberClassName(line.type)}>
                      <span className="inline-block text-right text-xs">
                        {line.type !== 'removed' ? line.newLineNumber || '' : ''}
                      </span>
                    </div>
                    <div className="flex-1 px-2 min-h-[1.25rem] flex items-center">
                      <span className="inline-block w-3 text-xs">
                        {getLinePrefix(line.type)}
                      </span>
                      <span className="text-xs">{line.content || ' '}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}