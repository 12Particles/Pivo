import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { cliApi, taskApi, taskAttemptApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Task, CliExecution, CliOutputType, CliExecutionStatus, TaskStatus, TaskAttempt, AttemptStatus } from "@/types";
import { Message } from "../types";

interface UseMessageHandlersProps {
  task: Task;
  execution: CliExecution | null;
  currentAttempt: TaskAttempt | null;
  setCurrentAttempt: (attempt: TaskAttempt | null) => void;
  addMessage: (message: Message) => void;
  saveConversation: () => Promise<void>;
  setExecution: (execution: CliExecution | null) => void;
  setIsSending: (sending: boolean) => void;
  startExecution: (prompt?: string) => Promise<CliExecution | null>;
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

  // Listen for CLI events
  useEffect(() => {
    const unlistenOutput = listen<any>("cli-output", (event) => {
      console.log("Received cli-output event:", event.payload);
      if (event.payload.execution_id === execution?.id || 
          (execution && event.payload.task_id === task.id)) {
        console.log("Adding message to conversation:", event.payload.content);
        
        let messageType: Message["type"] = "assistant";
        let metadata: Message["metadata"] = undefined;
        
        const content = event.payload.content;
        
        // Detect tool usage patterns
        if (content.includes("[Using tool:") && content.includes("]")) {
          messageType = "tool_use";
          const toolMatch = content.match(/\[Using tool: ([^\]]+)\]/);
          if (toolMatch) {
            metadata = { toolName: toolMatch[1] };
          }
        } else if (content.includes("[Tool Result]") || content.includes("Tool output:")) {
          messageType = "tool_result";
        } else if (event.payload.output_type === CliOutputType.Stderr) {
          messageType = "error";
          metadata = { error: true };
        } else if (event.payload.output_type === CliOutputType.System) {
          messageType = "system";
        }
        
        addMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: messageType,
          content: event.payload.content,
          timestamp: new Date(event.payload.timestamp),
          metadata,
        });
      }
    });

    const unlistenStatus = listen<CliExecution>("cli-execution-status", (event) => {
      if (event.payload.id === execution?.id || event.payload.task_id === task.id) {
        setExecution(event.payload);
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
    
    const unlistenComplete = listen<any>("cli-process-completed", async (event) => {
      if (event.payload.task_id === task.id) {
        console.log("Claude Code process completed, updating task status to Reviewing");
        setIsSending(false);
        
        if (execution) {
          setExecution({
            ...execution,
            status: CliExecutionStatus.Stopped
          });
        }
        
        try {
          await saveConversation();
          
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
        } catch (error) {
          console.error("Failed to update task status:", error);
          toast({
            title: t('common.error'),
            description: `${t('task.updateTaskError')}: ${error}`,
            variant: "destructive",
          });
        }
      }
    });

    return () => {
      unlistenOutput.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
      unlistenClaudeSessionId.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, [execution?.id, task.id, currentAttempt, setCurrentAttempt, addMessage, saveConversation, setExecution, setIsSending, t]);
}