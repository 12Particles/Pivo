export interface Message {
  id: string;
  type: "user" | "assistant" | "system" | "tool_use" | "tool_result" | "thinking" | "error";
  content: string;
  timestamp: Date;
  images?: string[];
  metadata?: {
    id?: string;
    toolName?: string;
    toolUseId?: string;
    error?: boolean;
    structured?: any;
    thinking?: string;
    [key: string]: any; // Allow additional metadata fields
  };
}

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