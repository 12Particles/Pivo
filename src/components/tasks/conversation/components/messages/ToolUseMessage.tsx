import { MessageComponentProps } from "./types";
import { EditToolMessage } from "./tools/EditToolMessage";
import { MultiEditToolMessage } from "./tools/MultiEditToolMessage";
import { ReadToolMessage } from "./tools/ReadToolMessage";
import { BashToolMessage } from "./tools/BashToolMessage";
import { GrepToolMessage } from "./tools/GrepToolMessage";
import { TodoWriteToolMessage } from "./tools/TodoWriteToolMessage";
import { DefaultToolMessage } from "./tools/DefaultToolMessage";

// Router component that delegates to specific tool message components
export function ToolUseMessage(props: MessageComponentProps) {
  const toolName = props.message.metadata?.toolName || "Unknown";
  
  // Route to the appropriate tool-specific component
  switch (toolName) {
    case "Edit":
      return <EditToolMessage {...props} />;
      
    case "MultiEdit":
      return <MultiEditToolMessage {...props} />;
      
    case "Read":
      return <ReadToolMessage {...props} />;
      
    case "Bash":
      return <BashToolMessage {...props} />;
      
    case "Grep":
    case "Search":
      return <GrepToolMessage {...props} />;
      
    case "TodoWrite":
      return <TodoWriteToolMessage {...props} />;
      
    default:
      // For all other tools, use the default renderer
      return <DefaultToolMessage {...props} />;
  }
}