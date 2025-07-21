import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";
import { getMessageIcon } from "../../utils/messageIcons";
import { DiffRenderer } from "../renderers/DiffRenderer";
import { cn } from "@/lib/utils";

export function ToolUseMessage({ message, isCollapsed, onToggleCollapse }: MessageComponentProps) {
  const { t } = useTranslation();
  const toolName = message.metadata?.toolName || "Unknown";
  
  // Check if this is an Edit tool use
  if (toolName === "Edit" && message.content.includes("old_string") && message.content.includes("new_string")) {
    try {
      const inputMatch = message.content.match(/Input:\s*({[\s\S]*})/m);
      if (inputMatch) {
        const inputData = JSON.parse(inputMatch[1]);
        return (
          <div className="bg-muted/20 border-b">
            <div className="py-3 px-4">
              <MessageHeader
                icon={getMessageIcon(message)}
                title={t('ai.usingTool', { tool: toolName })}
                timestamp={message.timestamp}
              />
              
              <div className="ml-7">
                <DiffRenderer 
                  title={inputData.file_path || ""}
                  oldValue={inputData.old_string || ""}
                  newValue={inputData.new_string || ""}
                />
              </div>
            </div>
          </div>
        );
      }
    } catch {
      // Fall through to default rendering
    }
  }
  
  const lines = message.content.split('\n');
  const shouldCollapse = lines.length > 10;
  const displayContent = shouldCollapse && isCollapsed ? lines.slice(0, 10).join('\n') : message.content;
  
  return (
    <div className="bg-muted/20 border-b">
      <div className="py-3 px-4">
        <MessageHeader
          icon={getMessageIcon(message)}
          title={t('ai.usingTool', { tool: toolName })}
          timestamp={message.timestamp}
        />
        
        <div className="ml-7">
          <div className={cn(
            "text-sm font-mono text-gray-700 dark:text-gray-300",
            "bg-gray-100 dark:bg-gray-800 p-3 rounded-md"
          )}>
            <div className="whitespace-pre-wrap break-words">
              {displayContent}
            </div>
          </div>
          
          {shouldCollapse && onToggleCollapse && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={onToggleCollapse}
              >
                {isCollapsed ? (
                  <>
                    <ChevronRight className="h-3 w-3 mr-1" />
                    {t('ai.showAllLines', { count: lines.length })}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    {t('ai.collapse')}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}