import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";
import { ContentRenderer } from "../renderers/ContentRenderer";

export function SystemMessage({ message }: MessageComponentProps) {
  const { t } = useTranslation();
  
  return (
    <div className="bg-orange-50 dark:bg-orange-950/20 border-b">
      <div className="py-3 px-4">
        <MessageHeader
          icon={<Settings className="h-4 w-4 text-muted-foreground" />}
          title={t('ai.system')}
          timestamp={message.timestamp}
        />
        
        <div className="ml-7 text-sm">
          <ContentRenderer content={message.content} />
        </div>
      </div>
    </div>
  );
}