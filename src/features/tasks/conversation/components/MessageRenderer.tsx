import { Message, MessageRole } from "../types";
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
  isPending?: boolean;
}

export function MessageRenderer({ message, isCollapsed, onToggleCollapse, isPending }: MessageRendererProps) {
  const componentProps = { message, isCollapsed, onToggleCollapse, isPending };
  
  // First check role
  if (message.role === MessageRole.USER) {
    return <UserMessage {...componentProps} />;
  }
  
  // For system role, check message type
  if (message.role === MessageRole.SYSTEM) {
    switch (message.messageType) {
      case "error":
        return <ErrorMessage {...componentProps} />;
        
      case "execution_complete":
        return <SystemMessage {...componentProps} />;
        
      default:
        return <SystemMessage {...componentProps} />;
    }
  }
  
  // For assistant role, check message type
  if (message.role === MessageRole.ASSISTANT) {
    switch (message.messageType) {
      case "text":
        return <AssistantMessage {...componentProps} />;
        
      case "tool_use":
        return <ToolUseMessage {...componentProps} />;
        
      case "tool_result":
        // Only hide Read tool results - other tool results might contain useful info
        if (message.metadata && 'toolName' in message.metadata && message.metadata.toolName === "Read") {
          return null;
        }
        return <ToolResultMessage {...componentProps} />;
        
      case "thinking":
        return <ThinkingMessage {...componentProps} />;
        
      default:
        // Default assistant messages
        return <AssistantMessage {...componentProps} />;
    }
  }
  
  // Fallback
  return <SystemMessage {...componentProps} />;
}