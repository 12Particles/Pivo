import { Edit } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { Badge } from "@/components/ui/badge";
import { AssistantToolUseMessage } from "../../../types";
import { getDisplayPath } from "../../../utils/pathUtils";
import { useApp } from "@/contexts/AppContext";

export function MultiEditToolMessage({ message, isPending }: MessageComponentProps) {
  const { currentProject } = useApp();
  const toolUseMessage = message as AssistantToolUseMessage;
  const toolInput = toolUseMessage.metadata?.structured;
  const toolUseId = toolUseMessage.metadata?.toolUseId;

  if (!toolInput) {
    return null;
  }

  const edits = toolInput.edits || [];

  return (
    <div className="bg-muted/20 border-b">
      <div className="py-3 px-4">
        <ToolMessageHeader
          icon={<Edit className="h-4 w-4 text-green-600" />}
          toolName="MultiEdit"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2 space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Editing file:</span>
          </div>
          <code className="block bg-muted px-3 py-2 rounded text-xs">
            {getDisplayPath(toolInput.file_path, currentProject?.path)}
          </code>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {edits.length} {edits.length === 1 ? 'edit' : 'edits'}
            </Badge>
            {edits.some((e: any) => e.replace_all) && (
              <Badge variant="outline" className="text-xs">
                Contains replace-all operations
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}