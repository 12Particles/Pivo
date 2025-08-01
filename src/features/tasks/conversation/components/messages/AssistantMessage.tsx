import { Bot, Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";
import { ContentRenderer } from "../renderers/ContentRenderer";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AssistantTextMessage } from "../../types";

export function AssistantMessage({ message }: MessageComponentProps) {
  const { t } = useTranslation();
  const [showThinking, setShowThinking] = useState(false);
  
  // Type assertion - we know this is an assistant text message from the MessageRenderer
  const assistantMessage = message as AssistantTextMessage;
  const thinking = assistantMessage.metadata?.thinking;
  const images = assistantMessage.metadata?.images;
  
  return (
    <div className="bg-background border-b">
      <div className="py-3 px-4">
        <MessageHeader
          icon={<Bot className="h-4 w-4 text-green-600" />}
          title="Claude"
          timestamp={message.timestamp}
        />
        
        <div className="ml-7 text-sm">
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
          
          {images && images.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {images.map((img: string, index: number) => (
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