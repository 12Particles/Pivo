export interface Message {
  id: string;
  type: "user" | "assistant" | "system" | "tool_use" | "tool_result" | "thinking" | "error";
  content: string;
  timestamp: Date;
  images?: string[];
  metadata?: {
    toolName?: string;
    error?: boolean;
    structured?: any;
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
  execution: import("@/types").CliExecution | null;
  onAttemptsChange?: (attempts: import("@/types").TaskAttempt[]) => void;
}