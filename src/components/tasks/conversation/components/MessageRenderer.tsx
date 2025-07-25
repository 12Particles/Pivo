import { Message } from "../types";
import { UserMessage } from "./messages/UserMessage";
import { AssistantMessage } from "./messages/AssistantMessage";
import { SystemMessage } from "./messages/SystemMessage";
import { ToolUseMessage } from "./messages/ToolUseMessage";
import { ToolResultMessage } from "./messages/ToolResultMessage";
import { ErrorMessage } from "./messages/ErrorMessage";
import { ThinkingMessage } from "./messages/ThinkingMessage";

interface MessageRendererProps {
  message: Message;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function MessageRenderer({ message, isCollapsed, onToggleCollapse }: MessageRendererProps) {
  const componentProps = { message, isCollapsed, onToggleCollapse };
  
  switch (message.type) {
    case "user":
      return <UserMessage {...componentProps} />;
      
    case "assistant":
      return <AssistantMessage {...componentProps} />;
      
    case "system":
      return <SystemMessage {...componentProps} />;
      
    case "tool_use":
      return <ToolUseMessage {...componentProps} />;
      
    case "tool_result":
      return <ToolResultMessage {...componentProps} />;
      
    case "error":
      return <ErrorMessage {...componentProps} />;
      
    case "thinking":
      return <ThinkingMessage {...componentProps} />;
      
    default:
      // Fallback for unknown message types
      return <SystemMessage {...componentProps} />;
  }
}