import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Task, Project, CodingAgentExecutionStatus } from '@/types';
import { eventBus } from '@/lib/events/EventBus';
import { listen } from '@tauri-apps/api/event';
import { taskAttemptApi } from '@/services/api/TaskAttemptApi';

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
  const [isSending, setIsSending] = useState(false);
  const [pendingCodeComment, setPendingCodeComment] = useState<string | null>(null);
  
  // Get state from backend
  const conversationState = useTaskConversationState(task.id);
  
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
    
    setIsSending(true);
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
    } finally {
      setIsSending(false);
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
  
  // Listen for session ID and update attempt
  useEffect(() => {
    const unsubscribe = listen('session:received', async (event: any) => {
      const { attemptId, sessionId } = event.payload;
      
      // Only handle if this attempt belongs to current task
      if (conversationState.currentAttemptId === attemptId) {
        try {
          await taskAttemptApi.updateClaudeSessionId(attemptId, sessionId);
          console.log('Updated attempt with Claude session ID:', sessionId);
        } catch (error) {
          console.error('Failed to update Claude session ID:', error);
        }
      }
    });
    
    return () => {
      unsubscribe.then(fn => fn());
    };
  }, [conversationState.currentAttemptId]);
  
  return (
    <div className="h-full flex flex-col">
      <ConversationHeader
        isRunning={conversationState.isExecuting}
        isSending={isSending}
        onStopExecution={handleStopExecution}
      />
      
      <MessageList
        messages={conversationState.messages}
        collapsedMessages={new Set()}
        onToggleCollapse={() => {}}
        isSending={isSending}
        execution={null}
        taskStatus={task.status}
      />
      
      <MessageInput
        input={input}
        images={images}
        isSending={isSending}
        pendingMessages={[]}
        executionStatus={conversationState.isExecuting ? CodingAgentExecutionStatus.Running : undefined}
        onInputChange={setInput}
        onImagesChange={setImages}
        onSend={() => handleSendMessage()}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
};