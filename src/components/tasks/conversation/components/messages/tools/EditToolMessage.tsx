import { Edit } from "lucide-react";
import { MessageComponentProps } from "../types";
import { ToolMessageHeader } from "./ToolMessageHeader";
import { DiffRenderer } from "../../renderers/DiffRenderer";

export function EditToolMessage({ message, isPending }: MessageComponentProps) {
  const toolInput = message.metadata?.structured;
  const toolUseId = message.metadata?.toolUseId;

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
        
        <div className="ml-7 mt-2 overflow-x-auto">
          <DiffRenderer 
            title={toolInput.file_path || ""}
            oldValue={toolInput.old_string || ""}
            newValue={toolInput.new_string || ""}
          />
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