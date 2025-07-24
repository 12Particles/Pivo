import { Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";
import { ContentRenderer } from "../renderers/ContentRenderer";

export function ThinkingMessage({ message }: MessageComponentProps) {
  const { t } = useTranslation();
  
  return (
    <div className="bg-purple-50 dark:bg-purple-950/20 border-b">
      <div className="py-3 px-4">
        <MessageHeader
          icon={<Brain className="h-4 w-4 text-purple-600" />}
          title={t('ai.thinking')}
          timestamp={message.timestamp}
        />
        
        <div className="ml-7">
          <div className="text-sm italic text-purple-700 dark:text-purple-300">
            <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-md border border-purple-200 dark:border-purple-800">
              <ContentRenderer content={message.content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}