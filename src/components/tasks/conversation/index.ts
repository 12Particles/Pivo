// Export the main component
export { TaskConversation } from "../TaskConversation";

// Export individual components if needed elsewhere
export { ConversationHeader } from "./components/ConversationHeader";
export { MessageList } from "./components/MessageList";
export { MessageItem } from "./components/MessageItem";
export { MessageInput } from "./components/MessageInput";
export { MessageToolOutput } from "./components/MessageToolOutput";

// Export hooks
export { useConversationState } from "./hooks/useConversationState";
export { useExecutionManager } from "./hooks/useExecutionManager";
export { useMessageHandlers } from "./hooks/useMessageHandlers";

// Export types
export type { Message, ConversationState, ConversationProps } from "./types";