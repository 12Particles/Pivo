import { Terminal } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { AssistantToolUseMessage } from "../../../types";

export function BashToolMessage({ message, isPending }: MessageComponentProps) {
  const toolUseMessage = message as AssistantToolUseMessage;
  const toolInput = toolUseMessage.metadata?.structured;
  const toolUseId = toolUseMessage.metadata?.toolUseId;

  if (!toolInput) {
    return null;
  }

  return (
    <div className="bg-muted/20 border-b">
      <div className="py-3 px-4">
        <ToolMessageHeader
          icon={<Terminal className="h-4 w-4 text-orange-600" />}
          toolName="Bash"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2 space-y-2">
          <div className="text-sm text-muted-foreground">
            Running command:
          </div>
          <pre className="bg-muted text-muted-foreground px-3 py-2 rounded text-xs overflow-x-auto font-mono">
            <code>{toolInput.command}</code>
          </pre>
          {toolInput.description && (
            <div className="text-xs text-muted-foreground italic">
              {toolInput.description}
            </div>
          )}
          {toolInput.timeout && (
            <div className="text-xs text-muted-foreground">
              Timeout: {toolInput.timeout}ms
            </div>
          )}
        </div>
      </div>
    </div>
  );
}