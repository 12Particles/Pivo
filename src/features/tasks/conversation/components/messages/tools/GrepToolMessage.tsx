import { Search } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { Badge } from "@/components/ui/badge";
import { AssistantToolUseMessage } from "../../../types";
import { getDisplayPath } from "../../../utils/pathUtils";
import { useApp } from "@/contexts/AppContext";

export function GrepToolMessage({ message, isPending }: MessageComponentProps) {
  const { currentProject } = useApp();
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
          icon={<Search className="h-4 w-4 text-purple-600" />}
          toolName="Grep"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2 space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Searching for pattern:</span>
          </div>
          <code className="block bg-muted px-3 py-2 rounded text-xs">
            {toolInput.pattern}
          </code>
          
          {toolInput.path && (
            <div className="text-xs">
              <span className="text-muted-foreground">In path:</span>{" "}
              <code className="bg-muted px-1 rounded">
                {getDisplayPath(toolInput.path, currentProject?.path)}
              </code>
            </div>
          )}
          
          {toolInput.glob && (
            <div className="text-xs">
              <span className="text-muted-foreground">File filter:</span>{" "}
              <code className="bg-muted px-1 rounded">{toolInput.glob}</code>
            </div>
          )}
          
          {toolInput.type && (
            <div className="text-xs">
              <span className="text-muted-foreground">File type:</span>{" "}
              <code className="bg-muted px-1 rounded">{toolInput.type}</code>
            </div>
          )}
          
          <div className="flex gap-2 flex-wrap">
            {toolInput["-i"] && <Badge variant="secondary" className="text-xs">Case insensitive</Badge>}
            {toolInput["-n"] && <Badge variant="secondary" className="text-xs">Show line numbers</Badge>}
            {toolInput.multiline && <Badge variant="secondary" className="text-xs">Multiline</Badge>}
            {toolInput.output_mode && (
              <Badge variant="secondary" className="text-xs">Mode: {toolInput.output_mode}</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}