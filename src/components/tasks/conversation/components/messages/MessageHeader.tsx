import { MessageHeaderProps } from "./types";

export function MessageHeader({ icon, title, timestamp }: MessageHeaderProps) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <div className="flex-shrink-0 mt-0.5">
        {icon}
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="font-medium text-sm text-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground">
          {timestamp.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
}