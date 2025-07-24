import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";

export function ErrorMessage({ message }: MessageComponentProps) {
  const { t } = useTranslation();
  
  return (
    <div className="bg-red-50 dark:bg-red-950/20 border-b">
      <div className="py-3 px-4">
        <MessageHeader
          icon={<AlertCircle className="h-4 w-4 text-red-600" />}
          title={t('common.error')}
          timestamp={message.timestamp}
        />
        
        <div className="ml-7">
          <div className="text-sm text-red-600 dark:text-red-400">
            <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                {message.content}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}