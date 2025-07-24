// Message roles - WHO sent the message
export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system"
}

// Message types - WHAT kind of message it is
export type AssistantMessageType = 
  | "text"           // Regular text message
  | "tool_use"       // Tool invocation
  | "tool_result"    // Tool execution result
  | "thinking";      // AI thinking process

export type SystemMessageType = 
  | "text"           // System text message
  | "error"          // Error message
  | "execution_complete"; // Execution completed

export type UserMessageType = "text"; // Users only send text messages

export type MessageType = AssistantMessageType | SystemMessageType | UserMessageType;

export * from './types/metadata';
import type { 
  AssistantMetadata, 
  ToolUseMetadata, 
  ToolResultMetadata, 
  ExecutionCompleteMetadata, 
  UserMetadata 
} from './types/metadata';

// Base message interface
export interface BaseMessage {
  id: string;
  role: MessageRole;
  messageType: MessageType;
  content: string;
  timestamp: Date;
}

// Specific message types with their metadata
export interface UserMessage extends BaseMessage {
  role: MessageRole.USER;
  messageType: UserMessageType;
  metadata?: UserMetadata;
}

export interface AssistantTextMessage extends BaseMessage {
  role: MessageRole.ASSISTANT;
  messageType: "text";
  metadata?: AssistantMetadata & { images?: string[] };
}

export interface AssistantThinkingMessage extends BaseMessage {
  role: MessageRole.ASSISTANT;
  messageType: "thinking";
  metadata?: AssistantMetadata;
}

export interface AssistantToolUseMessage extends BaseMessage {
  role: MessageRole.ASSISTANT;
  messageType: "tool_use";
  metadata: ToolUseMetadata;
}

export interface AssistantToolResultMessage extends BaseMessage {
  role: MessageRole.ASSISTANT;
  messageType: "tool_result";
  metadata: ToolResultMetadata;
}

export interface SystemTextMessage extends BaseMessage {
  role: MessageRole.SYSTEM;
  messageType: "text";
  metadata?: BaseMetadata;
}

export interface SystemErrorMessage extends BaseMessage {
  role: MessageRole.SYSTEM;
  messageType: "error";
  metadata?: ErrorMetadata;
}

export interface SystemExecutionCompleteMessage extends BaseMessage {
  role: MessageRole.SYSTEM;
  messageType: "execution_complete";
  metadata?: ExecutionCompleteMetadata;
}

// Type for base metadata
export interface BaseMetadata {
  id?: string;
  timestamp?: string;
}

export interface ErrorMetadata extends BaseMetadata {
  error?: string;
  details?: any;
}

// Assistant message types union
export type AssistantMessage = 
  | AssistantTextMessage
  | AssistantThinkingMessage
  | AssistantToolUseMessage
  | AssistantToolResultMessage;

// System message types union  
export type SystemMessage = 
  | SystemTextMessage
  | SystemErrorMessage
  | SystemExecutionCompleteMessage;

// Discriminated union of all message types
export type Message = 
  | UserMessage
  | AssistantMessage
  | SystemMessage;

export interface ConversationState {
  messages: Message[];
  input: string;
  images: string[];
  isLoading: boolean;
  isSending: boolean;
  pendingMessages: string[];
  collapsedMessages: Set<string>;
}

export interface ConversationProps {
  task: import("@/types").Task;
  project: import("@/types").Project;
  currentAttempt: import("@/types").TaskAttempt | null;
  execution: import("@/types").CodingAgentExecution | null;
  onAttemptsChange?: (attempts: import("@/types").TaskAttempt[]) => void;
}