import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Message, 
  MessageRole, 
  UserMessage, 
  AssistantTextMessage, 
  AssistantThinkingMessage,
  AssistantToolUseMessage,
  AssistantToolResultMessage,
  SystemTextMessage,
  SystemErrorMessage,
  SystemExecutionCompleteMessage
} from '../types';

export interface ConversationState {
  messages: Message[];
  isExecuting: boolean;
  currentAttemptId?: string;
  canSendMessage: boolean;
  currentExecution?: any; // CodingAgentExecution
}

/**
 * Single hook for subscribing to conversation state
 * All state is managed by the backend
 */
export function useTaskConversationState(taskId: string) {
  const [state, setState] = useState<ConversationState>({
    messages: [],
    isExecuting: false,
    canSendMessage: true,
    currentExecution: undefined
  });

  useEffect(() => {
    if (!taskId) return;

    let mounted = true;
    let isLoadingInitialState = true;

    // Load initial state
    const loadState = async () => {
      try {
        isLoadingInitialState = true;
        const initialState = await invoke<ConversationState>('get_conversation_state', { taskId });
        if (mounted) {
          setState(initialState);
        }
      } catch (error) {
        console.error('Failed to load conversation state:', error);
      } finally {
        isLoadingInitialState = false;
      }
    };

    loadState();

    // Subscribe to state updates - single channel
    const unsubscribeStateUpdate = listen<{ taskId: string; state: ConversationState }>(
      'state:conversation-sync',
      (event) => {
        if (event.payload.taskId === taskId && mounted) {
          setState(event.payload.state);
        }
      }
    );
    
    // Listen for execution started events
    const unsubscribeExecutionStarted = listen<{ taskId: string; attemptId: string; executionId: string }>(
      'execution:started',
      (event) => {
        if (event.payload.taskId === taskId && mounted) {
          // Update execution state
          setState(prev => ({ ...prev, isExecuting: true }));
        }
      }
    );
    
    // Listen for execution completed events to refresh state
    const unsubscribeExecutionCompleted = listen<{ taskId: string; attemptId: string; executionId: string; status: string }>(
      'execution:completed',
      (event) => {
        if (event.payload.taskId === taskId && mounted) {
          // Update execution state and reload
          setState(prev => ({ ...prev, isExecuting: false }));
          loadState();
        }
      }
    );
    
    // Also listen to real-time messages for smoother UX
    const unsubscribeMessages = listen<any>('message:added', (event) => {
      if (mounted && event.payload.taskId === taskId && !isLoadingInitialState) {
        // Add message to state optimistically
        setState(prev => {
          if (!event.payload.message) return prev;
          
          // Backend now sends role and messageType separately
          const role = event.payload.message.role as MessageRole;
          const messageType = event.payload.message.messageType || event.payload.message.message_type;
          
          // Validate message has required fields
          if (!role || !messageType) {
            console.warn('Message missing role or messageType:', event.payload.message);
            return prev;
          }
          // Generate a unique id if not provided
          const messageId = event.payload.message.id || 
            `${event.payload.attemptId}-${event.payload.message.timestamp}-${role}-${messageType}-${Date.now()}`;
          
          // Create properly typed message based on role and messageType
          let newMessage: Message;
          const baseProps = {
            id: messageId,
            content: event.payload.message.content || '',
            timestamp: new Date(event.payload.message.timestamp || Date.now()),
            metadata: event.payload.message.metadata || {}
          };
          
          if (role === MessageRole.USER) {
            newMessage = {
              ...baseProps,
              role: MessageRole.USER,
              messageType: "text"
            } as UserMessage;
          } else if (role === MessageRole.ASSISTANT) {
            switch (messageType) {
              case "tool_use":
                newMessage = {
                  ...baseProps,
                  role: MessageRole.ASSISTANT,
                  messageType: "tool_use"
                } as AssistantToolUseMessage;
                break;
              case "tool_result":
                newMessage = {
                  ...baseProps,
                  role: MessageRole.ASSISTANT,
                  messageType: "tool_result"
                } as AssistantToolResultMessage;
                break;
              case "thinking":
                newMessage = {
                  ...baseProps,
                  role: MessageRole.ASSISTANT,
                  messageType: "thinking"
                } as AssistantThinkingMessage;
                break;
              default:
                newMessage = {
                  ...baseProps,
                  role: MessageRole.ASSISTANT,
                  messageType: "text"
                } as AssistantTextMessage;
            }
          } else if (role === MessageRole.SYSTEM) {
            switch (messageType) {
              case "error":
                newMessage = {
                  ...baseProps,
                  role: MessageRole.SYSTEM,
                  messageType: "error"
                } as SystemErrorMessage;
                break;
              case "execution_complete":
                newMessage = {
                  ...baseProps,
                  role: MessageRole.SYSTEM,
                  messageType: "execution_complete"
                } as SystemExecutionCompleteMessage;
                break;
              default:
                newMessage = {
                  ...baseProps,
                  role: MessageRole.SYSTEM,
                  messageType: "text"
                } as SystemTextMessage;
            }
          } else {
            // Fallback to system text message
            newMessage = {
              ...baseProps,
              role: MessageRole.SYSTEM,
              messageType: "text"
            } as SystemTextMessage;
          }
            
            // Check for duplicates by id or by content/type/time
            const isDuplicate = prev.messages.some(msg => {
              // First check by id
              if (msg.id === newMessage.id) return true;
              
              // Fallback to content/type/time check
              const msgTime = msg.timestamp instanceof Date ? msg.timestamp.getTime() : new Date(msg.timestamp).getTime();
              const newMsgTime = newMessage.timestamp.getTime();
              return msg.content === newMessage.content && 
                msg.role === newMessage.role &&
                msg.messageType === newMessage.messageType &&
                Math.abs(msgTime - newMsgTime) < 1000;
            });
            
          if (!isDuplicate) {
            return {
              ...prev,
              messages: [...prev.messages, newMessage]
            };
          }
          return prev;
        });
      }
    });

    return () => {
      mounted = false;
      unsubscribeStateUpdate.then(unsub => unsub());
      unsubscribeMessages.then(unsub => unsub());
      unsubscribeExecutionStarted.then(unsub => unsub());
      unsubscribeExecutionCompleted.then(unsub => unsub());
    };
  }, [taskId]);

  return state;
}