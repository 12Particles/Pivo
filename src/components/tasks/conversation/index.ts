// Export the main component
export { TaskConversation } from "../TaskConversation";

// Export individual components if needed elsewhere
export { ConversationHeader } from "./components/ConversationHeader";
export { MessageList } from "./components/MessageList";
export { MessageInput } from "./components/MessageInput";

// Export hooks
export { useConversationState } from "./hooks/useConversationState";
export { useExecutionManager } from "./hooks/useExecutionManager";
export { useMessageHandlers } from "./hooks/useMessageHandlers";

// Export types
export type { Message, ConversationState, ConversationProps } from "./types";