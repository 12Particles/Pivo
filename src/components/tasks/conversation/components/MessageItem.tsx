import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Message } from "../types";
import { getMessageIcon } from "../utils/messageIcons";
import { MessageToolOutput } from "./MessageToolOutput";

interface MessageItemProps {
  message: Message;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function MessageItem({ message, isCollapsed, onToggleCollapse }: MessageItemProps) {
  const { t } = useTranslation();
  
  const isUser = message.type === "user";
  const isAssistant = message.type === "assistant";
  const isSystem = message.type === "system";
  const isToolUse = message.type === "tool_use";
  const isToolResult = message.type === "tool_result";
  const isError = message.type === "error" || message.metadata?.error;
  const isThinking = message.type === "thinking";
  
  const shouldCollapseContent = (content: string): boolean => {
    return content.split('\n').length > 10;
  };
  
  const shouldCollapse = shouldCollapseContent(message.content) && !isToolResult;
  const lines = message.content.split('\n');
  const displayContent = shouldCollapse && isCollapsed ? lines.slice(0, 10).join('\n') : message.content;

  return (
    <div
      className={cn(
        "group relative border-b last:border-b-0",
        isUser && "bg-background",
        isAssistant && "bg-background",
        (isToolUse || isToolResult) && "bg-muted/20",
        isSystem && "bg-orange-50 dark:bg-orange-950/20",
        isError && "bg-red-50 dark:bg-red-950/20",
        isThinking && "bg-purple-50 dark:bg-purple-950/20"
      )}
    >
      <div className="py-3 overflow-hidden">
        <div className="px-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getMessageIcon(message)}
            </div>
            
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-medium text-sm text-foreground">
                {isUser ? t('ai.you') : 
                 isAssistant ? "Claude" : 
                 isToolUse ? `${t('ai.usingTool', { tool: message.metadata?.toolName || "Unknown" })}` :
                 isToolResult ? t('ai.toolResult') :
                 isThinking ? t('ai.thinking') :
                 isError ? t('common.error') :
                 t('ai.system')}
              </span>
              <span className="text-xs text-muted-foreground">
                {message.timestamp.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div className={cn(
            "px-4 text-sm",
            isToolUse && "font-mono text-gray-700 dark:text-gray-300",
            isError && "text-red-600 dark:text-red-400",
            isThinking && "italic text-purple-700 dark:text-purple-300"
          )}>
            {shouldCollapse && isCollapsed ? (
              <div className="whitespace-pre-wrap break-words">{displayContent}</div>
            ) : (
              <MessageToolOutput content={message.content} />
            )}
          </div>
        </div>
        
        {shouldCollapse && (
          <div className="px-4 pt-2">
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
        
        {message.images && message.images.length > 0 && (
          <div className="px-4 pt-3">
            <div className="flex flex-wrap gap-2">
              {message.images.map((img, index) => (
                <div key={index} className="relative group/image">
                  <img
                    src={img}
                    alt={`${t('ai.attachment')} ${index + 1}`}
                    className="rounded-md border shadow-sm max-w-xs max-h-48 object-cover cursor-pointer transition-transform hover:scale-105"
                    onClick={() => window.open(img, '_blank')}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}