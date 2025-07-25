import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Task, Project, TaskAttempt, TaskStatus, CliExecutionStatus } from "@/types";
import { taskAttemptApi } from "@/lib/api";

// Components
import { ConversationHeader } from "./conversation/components/ConversationHeader";
import { MessageList } from "./conversation/components/MessageList";
import { MessageInput } from "./conversation/components/MessageInput";

// Hooks
import { useConversationState } from "./conversation/hooks/useConversationState";
import { useExecutionManager } from "./conversation/hooks/useExecutionManager";
import { useMessageHandlers } from "./conversation/hooks/useMessageHandlers";

// Types
import { Message } from "./conversation/types";

interface TaskConversationProps {
  task: Task;
  project: Project;
}

export function TaskConversation({ task, project }: TaskConversationProps) {
  const { t } = useTranslation();
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  const [_attempts, setAttempts] = useState<TaskAttempt[]>([]);

  // Use conversation state hook
  const { state, actions } = useConversationState(task.id, currentAttempt);
  const {
    messages,
    input,
    images,
    isLoading,
    isSending,
    pendingMessages,
    collapsedMessages
  } = state;

  // Use execution manager hook
  const {
    execution,
    setExecution,
    startExecution,
    stopExecution,
    sendToExecution,
    updateTaskStatus,
    resetExecutionFlag
  } = useExecutionManager({
    task,
    project,
    currentAttempt,
    setCurrentAttempt,
    setAttempts,
    addMessage: actions.addMessage,
    setIsLoading: actions.setIsLoading,
    setIsSending: actions.setIsSending,
    input,
    setInput: actions.setInput
  });

  // Use message handlers hook
  useMessageHandlers({
    task,
    execution,
    currentAttempt,
    setCurrentAttempt,
    addMessage: actions.addMessage,
    saveConversation: actions.saveConversation,
    setExecution,
    setIsSending: actions.setIsSending,
    startExecution
  });

  // Load attempts when task changes
  useEffect(() => {
    resetExecutionFlag();
    loadAttempts();
  }, [task.id]);

  // Auto-start session for new tasks
  useEffect(() => {
    if (task.status === "Working" && !execution && !isLoading && !currentAttempt && messages.length === 0) {
      const taskPrompt = task.description 
        ? `Task title: ${task.title}\nTask description: ${task.description}`
        : `Task title: ${task.title}`;
      startExecution(taskPrompt);
    }
  }, [task.status, task.id, task.title, task.description, execution, isLoading, currentAttempt, messages.length]);

  const loadAttempts = async () => {
    try {
      const taskAttempts = await taskAttemptApi.listForTask(task.id);
      setAttempts(taskAttempts);
      
      if (taskAttempts.length > 0) {
        const latestAttempt = taskAttempts[taskAttempts.length - 1];
        setCurrentAttempt(latestAttempt);
        await actions.loadMessages(latestAttempt);
      } else {
        setCurrentAttempt(null);
        actions.clearMessages();
      }
    } catch (error: any) {
      if (!error?.toString().includes("not found")) {
        console.error("Failed to load attempts:", error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    const message = input.trim();
    if (!message && images.length === 0) return;

    // Check if Claude is still running
    if (execution && execution.status === CliExecutionStatus.Running) {
      toast({
        title: t('common.info'),
        description: t('ai.waitForCompletion'),
      });
      return;
    }

    // If a message is being sent, queue this one
    if (isSending) {
      actions.setPendingMessages(prev => [...prev, message]);
      actions.setInput("");
      toast({
        title: t('ai.messagePending'),
        description: t('ai.willSendAfterCurrent'),
      });
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: message,
      images: [...images],
      timestamp: new Date(),
    };
    actions.addMessage(userMessage);

    // Clear input
    actions.setInput("");
    actions.setImages([]);
    actions.setIsSending(true);

    if (execution) {
      try {
        // Update task status if needed
        if (task.status === "Reviewing") {
          console.log("Task is in Reviewing status, changing to Working");
          await updateTaskStatus(TaskStatus.Working);
        }
        
        await sendToExecution(execution.id, message, images);
      } catch (error) {
        console.error("Failed to send message:", error);
        toast({
          title: t('common.error'),
          description: `${t('ai.sendMessageError')}: ${error}`,
          variant: "destructive",
        });
        actions.setIsSending(false);
      }
    } else if (task.status === "Working" || task.status === "Reviewing") {
      console.log("No active execution but task is in Working/Reviewing status, starting execution for follow-up");
      
      if (task.status === "Reviewing") {
        await updateTaskStatus(TaskStatus.Working);
      }
      
      const newExecution = await startExecution();
      
      if (newExecution) {
        try {
          await sendToExecution(newExecution.id, message, images);
        } catch (error) {
          console.error("Failed to send message after creating session:", error);
          toast({
            title: t('common.error'),
            description: `${t('ai.sendMessageError')}: ${error}`,
            variant: "destructive",
          });
          actions.setIsSending(false);
        }
      } else {
        actions.setIsSending(false);
      }
    } else {
      toast({
        title: t('common.info'),
        description: t('task.startChat'),
      });
      actions.setIsSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <ConversationHeader
        execution={execution}
        taskStatus={task.status}
        isSending={isSending}
        onStopExecution={stopExecution}
      />

      <MessageList
        messages={messages}
        collapsedMessages={collapsedMessages}
        onToggleCollapse={actions.toggleMessageCollapse}
        isSending={isSending}
        execution={execution}
        taskStatus={task.status}
      />

      <MessageInput
        input={input}
        images={images}
        isSending={isSending}
        pendingMessages={pendingMessages}
        executionStatus={execution?.status}
        onInputChange={actions.setInput}
        onImagesChange={actions.setImages}
        onSend={sendMessage}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
}