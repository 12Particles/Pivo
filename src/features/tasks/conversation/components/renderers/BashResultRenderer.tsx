import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BashResultRendererProps {
  content: string;
}

export function BashResultRenderer({ content }: BashResultRendererProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const lines = content.split('\n');
  const hasMoreThanTwoLines = lines.length > 2;
  
  const displayContent = hasMoreThanTwoLines && !isExpanded 
    ? lines.slice(0, 2).join('\n') + '...'
    : content;
  
  return (
    <div>
      <div className={`whitespace-pre-wrap break-all overflow-x-auto ${!isExpanded && hasMoreThanTwoLines ? 'line-clamp-2' : ''}`}>
        {displayContent}
      </div>
      {hasMoreThanTwoLines && (
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