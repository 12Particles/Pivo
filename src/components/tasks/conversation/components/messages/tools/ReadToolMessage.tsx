import { File } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";

export function ReadToolMessage({ message, isPending }: MessageComponentProps) {
  const toolInput = message.metadata?.structured;
  const toolUseId = message.metadata?.toolUseId;

  if (!toolInput) {
    return null;
  }

  return (
    <div className="bg-muted/20 border-b">
      <div className="py-3 px-4">
        <ToolMessageHeader
          icon={<File className="h-4 w-4 text-blue-600" />}
          toolName="Read"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2 space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Reading file:</span>
          </div>
          <code className="block bg-muted px-3 py-2 rounded text-xs">
            {toolInput.file_path}
          </code>
          {toolInput.limit && (
            <div className="text-xs text-muted-foreground">
              Lines: {toolInput.offset || 1} - {(toolInput.offset || 1) + toolInput.limit}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}