import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CliExecution, CliExecutionStatus } from "@/types";

interface ConversationHeaderProps {
  execution: CliExecution | null;
  taskStatus: string;
  isSending: boolean;
  onStopExecution: () => void;
}

export function ConversationHeader({ 
  execution, 
  taskStatus, 
  isSending, 
  onStopExecution 
}: ConversationHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {execution && (
            <Badge variant={execution.status === CliExecutionStatus.Running ? "default" : "secondary"}>
              {execution.status}
            </Badge>
          )}
          {taskStatus === "Working" && (
            <Badge variant="outline" className="text-xs">
              {t('ai.executing')}
            </Badge>
          )}
          {isSending && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
        </div>
        {execution && execution.status === CliExecutionStatus.Running && (
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