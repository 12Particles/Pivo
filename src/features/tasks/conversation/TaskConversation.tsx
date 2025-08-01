import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Task, Project, CodingAgentExecutionStatus } from '@/types';
import { eventBus } from '@/lib/events/EventBus';

// Hooks
import { useTaskCommand } from './hooks/useTaskCommand';
import { useTaskConversationState } from './hooks/useTaskConversationState';

// Components
import { ConversationHeader } from './components/ConversationHeader';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';

export interface TaskConversationProps {
  task: Task;
  project: Project;
}

export const TaskConversation: React.FC<TaskConversationProps> = ({ task }) => {
  const { t } = useTranslation();
  
  // Local UI state only
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pendingCodeComment, setPendingCodeComment] = useState<string | null>(null);
  
  // Get state from backend
  const conversationState = useTaskConversationState(task.id);
  
  // Debug logging
  useEffect(() => {
    console.log(`[TaskConversation] State for task ${task.id}:`, {
      isExecuting: conversationState.isExecuting,
      canSendMessage: conversationState.canSendMessage,
      executionStatus: conversationState.isExecuting ? CodingAgentExecutionStatus.Running : undefined
    });
  }, [task.id, conversationState.isExecuting, conversationState.canSendMessage]);
  
  // Commands
  const { sendMessage, stopExecution } = useTaskCommand();
  
  // Handle sending message with optional override
  const handleSendMessage = useCallback(async (messageOverride?: string) => {
    const message = (messageOverride || input).trim();
    if (!message && images.length === 0) return;
    
    if (!conversationState.canSendMessage) {
      toast({
        title: t('common.info'),
        description: t('ai.waitForCompletion'),
      });
      return;
    }
    
    setInput('');
    const imagesToSend = [...images];
    setImages([]);
    
    try {
      await sendMessage(task.id, message, imagesToSend);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('ai.sendMessageError'),
        variant: 'destructive',
      });
      // Restore input on error
      setInput(message);
      setImages(imagesToSend);
    }
  }, [input, images, conversationState.canSendMessage, task.id, sendMessage, t]);
  
  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);
  
  // Handle stop execution
  const handleStopExecution = useCallback(async () => {
    try {
      await stopExecution(task.id);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('ai.stopExecutionError'),
        variant: 'destructive',
      });
    }
  }, [task.id, stopExecution, t]);
  
  // Listen for send-to-conversation events
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('send-to-conversation', (payload: any) => {
      if (payload.taskId === task.id && payload.message) {
        // Just set the state, don't do async work here
        setPendingCodeComment(payload.message);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [task.id]);
  
  // Handle pending code comment in a separate effect
  useEffect(() => {
    if (!pendingCodeComment) return;
    
    // Reset the pending comment immediately to avoid re-runs
    const message = pendingCodeComment;
    setPendingCodeComment(null);
    
    // Send the message
    const sendCodeComment = async () => {
      console.log('Sending code comment:', message);
      console.log('Current conversation state:', conversationState);
      
      try {
        await sendMessage(task.id, message, []);
      } catch (error) {
        console.error('Failed to send message from code comments:', error);
        toast({
          title: t('common.error'),
          description: t('ai.sendMessageError'),
          variant: 'destructive',
        });
      }
    };
    
    sendCodeComment();
  }, [pendingCodeComment, task.id, conversationState, sendMessage, toast, t]);
  
  // Session ID is now handled directly in the backend, no need to listen for it here
  
  return (
    <div className="h-full flex flex-col">
      <ConversationHeader
        isRunning={conversationState.isExecuting}
        onStopExecution={handleStopExecution}
      />
      
      <MessageList
        messages={conversationState.messages}
        collapsedMessages={new Set()}
        onToggleCollapse={() => {}}
        isSending={false}
        execution={null}
        taskStatus={task.status}
      />
      
      <MessageInput
        input={input}
        images={images}
        isSending={false}
        pendingMessages={[]}
        executionStatus={conversationState.isExecuting ? CodingAgentExecutionStatus.Running : undefined}
        searchPath={conversationState.worktreePath}
        onInputChange={setInput}
        onImagesChange={setImages}
        onSend={() => handleSendMessage()}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
};