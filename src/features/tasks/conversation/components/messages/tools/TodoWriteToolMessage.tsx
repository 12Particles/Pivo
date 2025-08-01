import { List } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { TodoListRenderer } from "../../renderers/TodoListRenderer";
import { AssistantToolUseMessage } from "../../../types";

export function TodoWriteToolMessage({ message, isPending }: MessageComponentProps) {
  const toolUseMessage = message as AssistantToolUseMessage;
  const toolInput = toolUseMessage.metadata?.structured;
  const toolUseId = toolUseMessage.metadata?.toolUseId;

  if (!toolInput || !toolInput.todos) {
    return null;
  }

  return (
    <div className="bg-muted/20 border-b w-full">
      <div className="py-3 px-4 w-full">
        <ToolMessageHeader
          icon={<List className="h-4 w-4 text-purple-600" />}
          toolName="TodoWrite"
          timestamp={message.timestamp}
          toolUseId={toolUseId}
          isPending={isPending}
        />
        
        <div className="ml-7 mt-2">
          <TodoListRenderer todos={toolInput.todos} />
        </div>
      </div>
    </div>
  );
}