import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { cliApi, taskApi, taskAttemptApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Task, CodingAgentExecution, TaskStatus, TaskAttempt, AttemptStatus } from "@/types";
import { Message } from "../types";
import { UnifiedMessage, UnifiedMessageType } from "@/stores/useExecutionStore";

interface UseMessageHandlersProps {
  task: Task;
  execution: CodingAgentExecution | null;
  currentAttempt: TaskAttempt | null;
  setCurrentAttempt: (attempt: TaskAttempt | null) => void;
  addMessage: (message: Message) => void;
  saveConversation: () => Promise<void>;
  setExecution: (execution: CodingAgentExecution | null) => void;
  setIsSending: (sending: boolean) => void;
  startExecution: (prompt?: string) => Promise<CodingAgentExecution | null>;
}

export function useMessageHandlers({
  task,
  execution,
  currentAttempt,
  setCurrentAttempt,
  addMessage,
  saveConversation,
  setExecution,
  setIsSending,
  startExecution
}: UseMessageHandlersProps) {
  const { t } = useTranslation();

  // Handle external messages (e.g., from comment submissions)
  useEffect(() => {
    const handleExternalMessage = (event: CustomEvent) => {
      const { taskId, message } = event.detail;
      if (taskId === task.id && message) {
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          type: "user",
          content: message,
          timestamp: new Date(),
        };
        addMessage(userMessage);
        
        if (execution) {
          setIsSending(true);
          cliApi.sendInput(execution.id, message)
            .then(() => {
              setIsSending(false);
            })
            .catch((error: any) => {
              console.error("Failed to send external message:", error);
              setIsSending(false);
            });
        } else {
          setIsSending(true);
          startExecution().then((newExecution) => {
            if (newExecution) {
              cliApi.sendInput(newExecution.id, message)
                .then(() => {
                  setIsSending(false);
                })
                .catch((error: any) => {
                  console.error("Failed to send external message after execution start:", error);
                  setIsSending(false);
                });
            } else {
              setIsSending(false);
              console.error("Failed to start execution for external message");
            }
          }).catch((error) => {
            console.error("Failed to start execution:", error);
            setIsSending(false);
          });
        }
      }
    };

    window.addEventListener('send-to-conversation', handleExternalMessage as EventListener);
    
    return () => {
      window.removeEventListener('send-to-conversation', handleExternalMessage as EventListener);
    };
  }, [task.id, execution, addMessage, setIsSending, startExecution]);

  // Listen for unified coding agent messages
  useEffect(() => {
    const unlistenMessage = listen<any>("coding-agent-message", (event) => {
      console.log("Received coding-agent-message event:", event.payload);
      if (event.payload.execution_id === execution?.id || 
          (execution && event.payload.task_id === task.id)) {
        const unifiedMsg = event.payload.message as UnifiedMessage;
        
        let messageType: Message["type"] = "assistant";
        let content = "";
        let metadata: Message["metadata"] = undefined;
        
        // Convert unified message to conversation message
        switch (unifiedMsg.type) {
          case UnifiedMessageType.Assistant:
            messageType = "assistant";
            content = unifiedMsg.content || "";
            metadata = {
              id: unifiedMsg.id,
              thinking: unifiedMsg.thinking
            };
            break;
            
          case UnifiedMessageType.ToolUse:
            messageType = "tool_use";
            content = `Using tool: ${unifiedMsg.tool_name}`;
            metadata = { 
              toolName: unifiedMsg.tool_name,
              structured: unifiedMsg.tool_input,
              toolUseId: unifiedMsg.id
            };
            break;
            
          case UnifiedMessageType.ToolResult:
            messageType = "tool_result";
            content = unifiedMsg.result || "";
            metadata = { 
              toolName: unifiedMsg.tool_name,
              error: unifiedMsg.is_error,
              toolUseId: unifiedMsg.tool_use_id
            };
            break;
            
          case UnifiedMessageType.System:
            messageType = "system";
            content = unifiedMsg.content || "";
            if (unifiedMsg.level === "error") {
              messageType = "error";
              metadata = { error: true, ...unifiedMsg.metadata };
            } else {
              metadata = unifiedMsg.metadata;
            }
            break;
            
          case UnifiedMessageType.ExecutionComplete:
            // Handle completion - don't add as a message
            setIsSending(false);
            
            // Save conversation and update task status
            saveConversation().then(async () => {
              if (currentAttempt && !currentAttempt.id.startsWith('mock-')) {
                try {
                  await taskAttemptApi.updateStatus(currentAttempt.id, AttemptStatus.Success);
                } catch (error: any) {
                  if (!error?.toString().includes("not found")) {
                    console.error("Failed to update attempt status:", error);
                  }
                }
              }
              
              console.log("Updating task status to Reviewing for task:", task.id);
              const updatedTask = await taskApi.updateStatus(task.id, TaskStatus.Reviewing);
              console.log("Task status updated successfully:", updatedTask);
              toast({
                title: t('task.taskCompleted'),
                description: t('task.reviewResults'),
              });
            }).catch((error) => {
              console.error("Failed to update task status:", error);
              toast({
                title: t('common.error'),
                description: `${t('task.updateTaskError')}: ${error}`,
                variant: "destructive",
              });
            });
            // Don't add as a message - the status update is handled by the store
            return;
            
          case UnifiedMessageType.Thinking:
            messageType = "thinking";
            content = unifiedMsg.content || "";
            break;
            
          case UnifiedMessageType.Raw:
            // Handle raw messages - could show them in a special format
            messageType = "system";
            content = `[${unifiedMsg.source}] Raw message`;
            metadata = unifiedMsg.data;
            break;
            
          case UnifiedMessageType.User:
            // Should not receive user messages from backend
            return;
        }
        
        addMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: messageType,
          content: content,
          timestamp: new Date(unifiedMsg.timestamp),
          metadata,
        });
      }
    });

    
    const unlistenClaudeSessionId = listen<any>("claude-session-id-received", async (event) => {
      if (event.payload.task_id === task.id && currentAttempt) {
        console.log("Received Claude session ID:", event.payload.claude_session_id);
        
        setCurrentAttempt({
          ...currentAttempt,
          claude_session_id: event.payload.claude_session_id
        });
        
        try {
          await taskAttemptApi.updateClaudeSessionId(currentAttempt.id, event.payload.claude_session_id);
          console.log("Saved Claude session ID to database");
        } catch (error) {
          console.error("Failed to save Claude session ID:", error);
        }
      }
    });
    
    // Process completion is now handled in the unified message listener above

    return () => {
      unlistenMessage.then((fn) => fn());
      unlistenClaudeSessionId.then((fn) => fn());
    };
  }, [execution?.id, task.id, currentAttempt, setCurrentAttempt, addMessage, saveConversation, setExecution, setIsSending, t]);
}