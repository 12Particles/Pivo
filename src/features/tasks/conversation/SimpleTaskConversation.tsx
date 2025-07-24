import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Task, Project, CodingAgentExecutionStatus } from '@/types';

// Hooks
import { useTaskCommand } from './hooks/useTaskCommand';
import { useTaskConversationState } from './hooks/useTaskConversationState';

// Components
import { ConversationHeader } from './components/ConversationHeader';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';

export interface SimpleTaskConversationProps {
  task: Task;
  project: Project;
}

export const SimpleTaskConversation: React.FC<SimpleTaskConversationProps> = ({ task }) => {
  const { t } = useTranslation();
  
  // Local UI state only
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  // Get state from backend
  const conversationState = useTaskConversationState(task.id);
  
  // Commands
  const { sendMessage, stopExecution } = useTaskCommand();
  
  // Handle sending message
  const handleSendMessage = useCallback(async () => {
    const message = input.trim();
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
  
  return (
    <div className="h-full flex flex-col">
      <ConversationHeader
        execution={conversationState.currentExecution || null}
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
        onSend={handleSendMessage}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
};