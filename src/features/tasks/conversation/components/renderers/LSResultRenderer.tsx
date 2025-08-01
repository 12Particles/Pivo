import { File, Folder } from "lucide-react";

interface LSResultRendererProps {
  content: string;
}

export function LSResultRenderer({ content }: LSResultRendererProps) {
  // Parse the directory listing
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  // Limit to first 2 lines and indicate if there are more
  const displayLines = lines.slice(0, 2);
  const hasMore = lines.length > 2;
  const moreCount = lines.length - 2;
  
  return (
    <div className="font-mono text-xs">
      {displayLines.map((line, index) => {
        const trimmedLine = line.trim();
        const isDirectory = trimmedLine.startsWith('- ') && trimmedLine.endsWith('/');
        const fileName = trimmedLine.startsWith('- ') ? trimmedLine.substring(2) : trimmedLine;
        
        return (
          <div key={index} className="flex items-center gap-2">
            {isDirectory ? (
              <Folder className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            ) : (
              <File className="h-3 w-3 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            )}
            <span className="truncate text-current">{fileName}</span>
          </div>
        );
      })}
      {hasMore && (
        <div className="text-gray-600 dark:text-gray-400 italic mt-1">
          ... and {moreCount} more {moreCount === 1 ? 'item' : 'items'}
        </div>
      )}
    </div>
  );
}