// Export the main component
export { SimpleTaskConversation as TaskConversation } from "./SimpleTaskConversation";

// Export individual components if needed elsewhere
export { ConversationHeader } from "./components/ConversationHeader";
export { MessageList } from "./components/MessageList";
export { MessageInput } from "./components/MessageInput";

// Export new hooks
export { useTaskCommand } from "./hooks/useTaskCommand";
export { useTaskConversationState } from "./hooks/useTaskConversationState";

// Export types
export type { Message, ConversationState } from "./types";

// No longer export legacy interfaces
// export type { TaskConversationHandle } from "./TaskConversation";