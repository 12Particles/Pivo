import { MessageComponentProps } from "./types";
import { EditToolMessage } from "./tools/EditToolMessage";
import { MultiEditToolMessage } from "./tools/MultiEditToolMessage";
import { ReadToolMessage } from "./tools/ReadToolMessage";
import { WriteToolMessage } from "./tools/WriteToolMessage";
import { BashToolMessage } from "./tools/BashToolMessage";
import { GrepToolMessage } from "./tools/GrepToolMessage";
import { GlobToolMessage } from "./tools/GlobToolMessage";
import { TodoWriteToolMessage } from "./tools/TodoWriteToolMessage";
import { LSToolMessage } from "./tools/LSToolMessage";
import { DefaultToolMessage } from "./tools/DefaultToolMessage";
import { AssistantToolUseMessage } from "../../types";

// Router component that delegates to specific tool message components
export function ToolUseMessage(props: MessageComponentProps) {
  // Type assertion - we know this is a tool use message from the MessageRenderer
  const toolUseMessage = props.message as AssistantToolUseMessage;
  const toolName = toolUseMessage.metadata.toolName || "Unknown";
  
  // Route to the appropriate tool-specific component
  switch (toolName) {
    case "Edit":
      return <EditToolMessage {...props} />;
      
    case "MultiEdit":
      return <MultiEditToolMessage {...props} />;
      
    case "Read":
      return <ReadToolMessage {...props} />;
      
    case "Write":
      return <WriteToolMessage {...props} />;
      
    case "Bash":
      return <BashToolMessage {...props} />;
      
    case "Grep":
    case "Search":
      return <GrepToolMessage {...props} />;
      
    case "Glob":
      return <GlobToolMessage {...props} />;
      
    case "TodoWrite":
      return <TodoWriteToolMessage {...props} />;
      
    case "LS":
      return <LSToolMessage {...props} />;
      
    default:
      // For all other tools, use the default renderer
      return <DefaultToolMessage {...props} />;
  }
}