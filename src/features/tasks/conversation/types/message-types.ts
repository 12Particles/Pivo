// Specific message type utilities matching backend AgentOutput variants

import { 
  Message, 
  MessageRole, 
  UserMessage,
  AssistantTextMessage,
  AssistantThinkingMessage,
  AssistantToolUseMessage,
  AssistantToolResultMessage,
  SystemErrorMessage,
  SystemExecutionCompleteMessage
} from '../types';

// Helper functions to create specific message types
export function createUserMessage(content: string, images?: string[]): Omit<UserMessage, 'id' | 'timestamp'> {
  return {
    role: MessageRole.USER,
    messageType: 'text',
    content,
    metadata: images ? { images } : undefined
  };
}

export function createAssistantMessage(content: string, thinking?: string): Omit<AssistantTextMessage, 'id' | 'timestamp'> {
  return {
    role: MessageRole.ASSISTANT,
    messageType: 'text',
    content,
    metadata: thinking ? { thinking } : undefined
  };
}

export function createToolUseMessage(
  toolName: string,
  toolInput: any,
  toolUseId?: string
): Omit<AssistantToolUseMessage, 'id' | 'timestamp'> {
  return {
    role: MessageRole.ASSISTANT,
    messageType: 'tool_use',
    content: `Using ${toolName}`,
    metadata: {
      toolName,
      structured: toolInput,
      toolUseId
    }
  };
}

export function createToolResultMessage(
  toolName: string,
  result: string,
  toolUseId?: string,
  isError?: boolean
): Omit<AssistantToolResultMessage, 'id' | 'timestamp'> {
  return {
    role: MessageRole.ASSISTANT,
    messageType: 'tool_result',
    content: result,
    metadata: {
      toolName,
      toolUseId,
      error: isError
    }
  };
}

export function createThinkingMessage(content: string): Omit<AssistantThinkingMessage, 'id' | 'timestamp'> {
  return {
    role: MessageRole.ASSISTANT,
    messageType: 'thinking',
    content,
    metadata: {}
  };
}

export function createErrorMessage(content: string): Omit<SystemErrorMessage, 'id' | 'timestamp'> {
  return {
    role: MessageRole.SYSTEM,
    messageType: 'error',
    content,
    metadata: { error: content }
  };
}

export function createExecutionCompleteMessage(
  success: boolean,
  summary: string
): Omit<SystemExecutionCompleteMessage, 'id' | 'timestamp'> {
  return {
    role: MessageRole.SYSTEM,
    messageType: 'execution_complete',
    content: summary,
    metadata: { success }
  };
}

// Type guards
export function isUserMessage(message: Message): boolean {
  return message.role === MessageRole.USER;
}

export function isAssistantMessage(message: Message): boolean {
  return message.role === MessageRole.ASSISTANT;
}

export function isToolUseMessage(message: Message): boolean {
  return message.messageType === 'tool_use';
}

export function isToolResultMessage(message: Message): boolean {
  return message.messageType === 'tool_result';
}

export function isThinkingMessage(message: Message): boolean {
  return message.messageType === 'thinking';
}

export function isErrorMessage(message: Message): boolean {
  return message.messageType === 'error';
}