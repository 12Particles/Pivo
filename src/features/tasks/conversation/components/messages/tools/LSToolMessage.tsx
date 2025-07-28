import { FolderOpen } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { AssistantToolUseMessage } from "../../../types";

export function LSToolMessage({ message, isPending }: MessageComponentProps) {
  const toolUseMessage = message as AssistantToolUseMessage;
  const toolInput = toolUseMessage.metadata?.structured;
  const toolUseId = toolUseMessage.metadata?.toolUseId;
  
  // Extract path from input
  const path = toolInput?.path || "";
  
  // Format path - simplify by showing only relative parts
  let displayPath = path;
  // Remove common worktree pattern if present
  const worktreeMatch = path.match(/\/pivo-worktrees\/[^/]+\/(.*)$/);
  if (worktreeMatch) {
    displayPath = worktreeMatch[1] || "/";
  } else if (path.includes('/private/var/folders/')) {
    // For temp paths, show just the last component
    const parts = path.split('/');
    displayPath = parts[parts.length - 1] || path;
  }
  
  return (
    <div className="bg-muted/20 border-b">
      <div className="py-3 px-4">
        <ToolMessageHeader
          icon={<FolderOpen className="h-4 w-4 text-blue-600" />}
          toolName="LS"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2">
          <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {displayPath}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}