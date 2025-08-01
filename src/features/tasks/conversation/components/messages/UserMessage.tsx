import { User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";
import { ContentRenderer } from "../renderers/ContentRenderer";
import { UserMessage as UserMessageType } from "../../types";

export function UserMessage({ message }: MessageComponentProps) {
  const { t } = useTranslation();
  
  // Type assertion - we know this is a user message
  const userMessage = message as UserMessageType;
  const images = userMessage.metadata?.images;
  
  return (
    <div className="bg-background border-b">
      <div className="py-3 px-4">
        <MessageHeader
          icon={<User className="h-4 w-4 text-blue-600" />}
          title={t('ai.you')}
          timestamp={message.timestamp}
        />
        
        <div className="ml-7 text-sm">
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