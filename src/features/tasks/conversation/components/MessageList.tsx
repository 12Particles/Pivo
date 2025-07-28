import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Message, MessageRole } from "../types";
import { MessageRenderer } from "./MessageRenderer";
import { CodingAgentExecution } from "@/types";
import { isToolResultMetadata, isToolUseMetadata } from "../types/metadata";

interface MessageListProps {
  messages: Message[];
  collapsedMessages: Set<string>;
  onToggleCollapse: (messageId: string) => void;
  isSending: boolean;
  execution: CodingAgentExecution | null;
  taskStatus: string;
}

export function MessageList({ 
  messages, 
  collapsedMessages, 
  onToggleCollapse, 
  isSending,
  execution,
  taskStatus
}: MessageListProps) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Create a set of tool_use_ids that have received results
  const toolsWithResults = new Set<string>();
  messages.forEach(msg => {
    if (msg.messageType === "tool_result" && 
        msg.role === MessageRole.ASSISTANT && 
        msg.metadata && 
        isToolResultMetadata(msg.metadata) && 
        msg.metadata.toolUseId) {
      toolsWithResults.add(msg.metadata.toolUseId);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 bg-muted/5">
      <div className="min-h-full w-full">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4" />
            <p className="text-sm">{t('task.noConversation')}</p>
            <p className="text-xs mt-1">
              {taskStatus === "Working" ? 
                (execution ? t('task.aiReady') : t('task.startingAi')) : 
                t('task.startChat')}
            </p>
          </div>
        ) : (
          messages.map((message) => {
            // Check if this tool_use is still pending
            // Read tools don't need to show pending state since their results are hidden
            // If execution is not running, nothing should be pending
            const isExecutionRunning = execution?.status === 'Running' || execution?.status === 'Starting';
            const isPending = !!(message.messageType === "tool_use" && 
              message.role === MessageRole.ASSISTANT &&
              message.metadata &&
              isToolUseMetadata(message.metadata) &&
              message.metadata.toolUseId && 
              message.metadata.toolName !== "Read" &&
              !toolsWithResults.has(message.metadata.toolUseId) &&
              isExecutionRunning);
            
            return (
              <MessageRenderer
                key={message.id}
                message={message}
                isCollapsed={collapsedMessages.has(message.id)}
                onToggleCollapse={() => onToggleCollapse(message.id)}
                isPending={isPending}
              />
            );
          })
        )}
        {isSending && messages.length > 0 && (
          <div className="bg-muted/30">
            <div className="px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Claude</span>
                  <span className="text-sm text-muted-foreground">{t('ai.aiThinking')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}