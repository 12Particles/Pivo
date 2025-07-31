import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConversationHeaderProps {
  isRunning: boolean;
  onStopExecution: () => void;
}

export function ConversationHeader({ 
  isRunning, 
  onStopExecution 
}: ConversationHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning && (
            <>
              <Badge variant="default">
                {t('common.running')}
              </Badge>
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            </>
          )}
        </div>
        {isRunning && (
          <Button
            variant="outline"
            size="sm"
            onClick={onStopExecution}
          >
            <Square className="h-4 w-4 mr-1" />
            {t('common.stop')}
          </Button>
        )}
      </div>
    </div>
  );
}