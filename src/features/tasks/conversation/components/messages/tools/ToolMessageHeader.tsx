import { Loader2 } from "lucide-react";
import { MessageHeader } from "../MessageHeader";

interface ToolMessageHeaderProps {
  icon: React.ReactNode;
  toolName: string;
  timestamp: Date;
  toolUseId?: string;
  isPending?: boolean;
}

export function ToolMessageHeader({ 
  icon, 
  toolName, 
  timestamp, 
  toolUseId: _, // Unused but kept for compatibility
  isPending 
}: ToolMessageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <MessageHeader
          icon={icon}
          title={`Using tool: ${toolName}`}
          timestamp={timestamp}
        />
      </div>
      {isPending && (
        <div className="flex items-center gap-2 mr-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Running...</span>
        </div>
      )}
    </div>
  );
}