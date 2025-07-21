import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Message } from "../types";
import { MessageItem } from "./MessageItem";
import { CliExecution } from "@/types";

interface MessageListProps {
  messages: Message[];
  collapsedMessages: Set<string>;
  onToggleCollapse: (messageId: string) => void;
  isSending: boolean;
  execution: CliExecution | null;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 bg-muted/5">
      <div className="min-h-full">
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
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isCollapsed={collapsedMessages.has(message.id)}
              onToggleCollapse={() => onToggleCollapse(message.id)}
            />
          ))
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