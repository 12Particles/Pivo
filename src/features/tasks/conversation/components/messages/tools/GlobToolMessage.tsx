import { FileSearch } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { AssistantToolUseMessage } from "../../../types";
import { getRelativePath } from "../../../utils/pathUtils";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export function GlobToolMessage({ message, isPending }: MessageComponentProps) {
  const { t } = useTranslation();
  const { currentProject } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Type assertion - we know this is a tool use message
  const toolUseMessage = message as AssistantToolUseMessage;
  const toolInput = toolUseMessage.metadata.structured;
  const toolUseId = toolUseMessage.metadata.toolUseId;

  if (!toolInput) {
    return null;
  }

  const pattern = toolInput.pattern || "";
  const searchPath = toolInput.path || currentProject?.path || "";

  return (
    <div className="bg-muted/20 border-b w-full">
      <div className="py-3 px-4 w-full">
        <ToolMessageHeader
          icon={<FileSearch className="h-4 w-4 text-blue-600" />}
          toolName="Glob"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2 space-y-2">
          <div className="text-sm text-muted-foreground">
            Searching for: <code className="bg-muted px-1 py-0.5 rounded">{pattern}</code>
          </div>
          {searchPath && currentProject?.path && searchPath !== currentProject.path && (
            <div className="text-xs text-muted-foreground">
              in: <code className="bg-muted px-1 py-0.5 rounded">
                {getRelativePath(searchPath, currentProject.path)}
              </code>
            </div>
          )}
          
          {/* Collapse/Expand button for glob results */}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
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
          
          {/* Show input details when expanded */}
          {isExpanded && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(toolInput, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}