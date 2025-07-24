import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { getMessageIcon } from "../../../utils/messageIcons";
import { cn } from "@/lib/utils";
import { AssistantToolUseMessage } from "../../../types";

// Default tool message for tools without specific renderers
export function DefaultToolMessage({ message, isCollapsed, onToggleCollapse, isPending }: MessageComponentProps) {
  const { t } = useTranslation();
  const toolUseMessage = message as AssistantToolUseMessage;
  const toolName = toolUseMessage.metadata?.toolName || "Unknown";
  const toolInput = toolUseMessage.metadata?.structured;
  const toolUseId = toolUseMessage.metadata?.toolUseId;
  
  // Format content for display
  const displayContent = toolInput 
    ? JSON.stringify(toolInput, null, 2) 
    : message.content;
    
  const lines = displayContent.split('\n');
  const shouldCollapse = lines.length > 10;
  const collapsedContent = shouldCollapse && isCollapsed 
    ? lines.slice(0, 10).join('\n') 
    : displayContent;
  
  return (
    <div className="bg-muted/20 border-b">
      <div className="py-3 px-4">
        <ToolMessageHeader
          icon={getMessageIcon(message) || <Wrench className="h-4 w-4 text-gray-600" />}
          toolName={toolName}
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2">
          <div className={cn(
            "text-sm font-mono text-gray-700 dark:text-gray-300",
            "bg-gray-100 dark:bg-gray-800 p-3 rounded-md"
          )}>
            <div className="whitespace-pre-wrap break-words">
              {collapsedContent}
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