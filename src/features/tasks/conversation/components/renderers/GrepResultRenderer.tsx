import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GrepResultRendererProps {
  content: string;
}

export function GrepResultRenderer({ content }: GrepResultRendererProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Split content into lines
  const lines = content.split('\n').filter(line => line.trim());
  
  // For long file paths or content, we want to show only 2 lines initially
  const maxInitialLines = 2;
  const hasMoreLines = lines.length > maxInitialLines;
  
  // Get display content based on expansion state
  const displayLines = isExpanded ? lines : lines.slice(0, maxInitialLines);
  
  return (
    <div className="font-mono text-xs">
      <div className="space-y-1">
        {displayLines.map((line, index) => (
          <div 
            key={index} 
            className="break-all overflow-wrap-anywhere text-gray-800 dark:text-gray-200"
          >
            {line}
          </div>
        ))}
      </div>
      
      {hasMoreLines && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {t('ai.collapse')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t('ai.showAllLines', { count: lines.length })}
            </>
          )}
        </button>
      )}
    </div>
  );
}