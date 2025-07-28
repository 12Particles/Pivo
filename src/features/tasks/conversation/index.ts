// Export the main component
export { TaskConversation } from "./TaskConversation";
export type { TaskConversationProps } from "./TaskConversation";

// Export individual components if needed elsewhere
export { ConversationHeader } from "./components/ConversationHeader";
export { MessageList } from "./components/MessageList";
export { MessageInput } from "./components/MessageInput";

// Export new hooks
export { useTaskCommand } from "./hooks/useTaskCommand";
export { useTaskConversationState } from "./hooks/useTaskConversationState";

// Export types
export type { Message } from "./types";
export type { ConversationState } from "./hooks/useTaskConversationState";