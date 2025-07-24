import { Edit } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { AssistantToolUseMessage } from "../../../types";
import { getDisplayPath } from "../../../utils/pathUtils";
import { useApp } from "@/contexts/AppContext";

export function EditToolMessage({ message, isPending }: MessageComponentProps) {
  const { currentProject } = useApp();
  // Type assertion - we know this is a tool use message
  const toolUseMessage = message as AssistantToolUseMessage;
  const toolInput = toolUseMessage.metadata.structured;
  const toolUseId = toolUseMessage.metadata.toolUseId;

  if (!toolInput) {
    return null;
  }

  return (
    <div className="bg-muted/20 border-b w-full">
      <div className="py-3 px-4 w-full">
        <ToolMessageHeader
          icon={<Edit className="h-4 w-4 text-green-600" />}
          toolName="Edit"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Editing file: </span>
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              {getDisplayPath(toolInput.file_path || "", currentProject?.path)}
            </code>
          </div>
          {toolInput.replace_all && (
            <div className="mt-1 text-xs text-muted-foreground">
              Replace all occurrences
            </div>
          )}
        </div>
      </div>
    </div>
  );
}