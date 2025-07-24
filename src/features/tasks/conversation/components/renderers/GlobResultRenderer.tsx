import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDisplayPath } from "../../utils/pathUtils";
import { useApp } from "@/contexts/AppContext";

interface GlobResultRendererProps {
  content: string;
  toolName?: string;
}

export function GlobResultRenderer({ content, toolName }: GlobResultRendererProps) {
  const { t } = useTranslation();
  const { currentProject } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Parse the content to extract file paths
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  // Try to detect if this is a Glob result by checking if all lines look like file paths
  const isGlobResult = toolName === "Glob" || lines.every(line => 
    line.includes('/') || line.includes('\\') || line.match(/\.[a-zA-Z0-9]+$/)
  );
  
  if (!isGlobResult) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }
  
  // Convert to relative paths using unified display path function
  const relativePaths = lines.map(line => {
    const trimmedLine = line.trim();
    return getDisplayPath(trimmedLine, currentProject?.path);
  });
  
  // Determine if we should show collapsed view
  const shouldCollapse = relativePaths.length > 5;
  const displayPaths = shouldCollapse && !isExpanded 
    ? relativePaths.slice(0, 5)
    : relativePaths;
  
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground mb-2">
        Found {relativePaths.length} {relativePaths.length === 1 ? 'file' : 'files'}:
      </div>
      
      {displayPaths.map((path, index) => {
        const isDirectory = path.endsWith('/');
        const Icon = isDirectory ? Folder : File;
        
        return (
          <div key={index} className="flex items-center gap-2 text-sm py-0.5">
            <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
              {path}
            </code>
          </div>
        );
      })}
      
      {shouldCollapse && (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                {t('ai.collapse')}
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 mr-1" />
                {t('ai.showAll')} ({relativePaths.length - 5} more)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}