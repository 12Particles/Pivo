import { Bot, Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";
import { ContentRenderer } from "../renderers/ContentRenderer";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

export function AssistantMessage({ message }: MessageComponentProps) {
  const { t } = useTranslation();
  const [showThinking, setShowThinking] = useState(false);
  const thinking = message.metadata?.thinking;
  const messageId = message.metadata?.id;
  
  return (
    <div className="bg-background border-b w-full">
      <div className="py-3 px-4 w-full">
        <MessageHeader
          icon={<Bot className="h-4 w-4 text-green-600" />}
          title="Claude"
          timestamp={message.timestamp}
        />
        {messageId && (
          <span className="ml-7 text-xs text-muted-foreground">ID: {messageId.slice(0, 8)}</span>
        )}
        
        <div className="ml-7 text-sm w-full">
          {thinking && (
            <div className="mb-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs text-purple-600 hover:text-purple-700"
                onClick={() => setShowThinking(!showThinking)}
              >
                <Brain className="h-3 w-3 mr-1" />
                {showThinking ? (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    {t('ai.hideThinking')}
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3 w-3 mr-1" />
                    {t('ai.showThinking')}
                  </>
                )}
              </Button>
              {showThinking && (
                <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                  <div className="text-sm italic text-purple-700 dark:text-purple-300 whitespace-pre-wrap">
                    {thinking}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <ContentRenderer content={message.content} />
          
          {message.images && message.images.length > 0 && (
            <div className="mt-3">
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
    </div>
  );
}