import { FileEdit } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { AssistantToolUseMessage } from "../../../types";
import { getDisplayPath } from "../../../utils/pathUtils";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export function WriteToolMessage({ message, isPending }: MessageComponentProps) {
  const { t } = useTranslation();
  const { currentProject } = useApp();
  const [showContent, setShowContent] = useState(false);
  
  // Type assertion - we know this is a tool use message
  const toolUseMessage = message as AssistantToolUseMessage;
  const toolInput = toolUseMessage.metadata.structured;
  const toolUseId = toolUseMessage.metadata.toolUseId;

  if (!toolInput) {
    return null;
  }

  const filePath = toolInput.file_path || "";
  const content = toolInput.content || "";
  const displayPath = getDisplayPath(filePath, currentProject?.path);
  
  // Check if content is large
  const lines = content.split('\n');
  const shouldCollapse = lines.length > 10;
  const previewLines = lines.slice(0, 5);

  return (
    <div className="bg-muted/20 border-b w-full">
      <div className="py-3 px-4 w-full">
        <ToolMessageHeader
          icon={<FileEdit className="h-4 w-4 text-blue-600" />}
          toolName="Write"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2 space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Writing to file:</span>
          </div>
          <code className="block bg-muted px-3 py-2 rounded text-xs">
            {displayPath}
          </code>
          
          {/* File content preview */}
          <div className="text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-muted-foreground">Content preview:</span>
              {shouldCollapse && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0.5 px-2 text-xs"
                  onClick={() => setShowContent(!showContent)}
                >
                  {showContent ? (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      {t('ai.hideDetails')}
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3 mr-1" />
                      {t('ai.showDetails')}
                    </>
                  )}
                </Button>
              )}
            </div>
            
            <pre className="bg-gray-900 text-gray-100 px-3 py-2 rounded text-xs overflow-x-auto">
              <code>
                {showContent || !shouldCollapse 
                  ? content 
                  : previewLines.join('\n') + '\n...'}
              </code>
            </pre>
            
            {shouldCollapse && !showContent && (
              <div className="text-xs text-muted-foreground mt-1">
                {lines.length} lines total
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}