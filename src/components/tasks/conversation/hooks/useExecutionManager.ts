import { useState, useRef, useCallback } from "react";
import { cliApi, taskApi, taskAttemptApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { emit } from "@tauri-apps/api/event";
import { Task, Project, CliExecution, TaskAttempt, AttemptStatus, TaskStatus } from "@/types";
import { Message } from "../types";

interface UseExecutionManagerProps {
  task: Task;
  project: Project;
  currentAttempt: TaskAttempt | null;
  setCurrentAttempt: (attempt: TaskAttempt | null) => void;
  setAttempts: React.Dispatch<React.SetStateAction<TaskAttempt[]>>;
  addMessage: (message: Message) => void;
  setIsLoading: (loading: boolean) => void;
  setIsSending: (sending: boolean) => void;
  input: string;
  setInput: (input: string) => void;
}

export function useExecutionManager({
  task,
  project,
  currentAttempt,
  setCurrentAttempt,
  setAttempts,
  addMessage,
  setIsLoading,
  setIsSending,
  input,
  setInput
}: UseExecutionManagerProps) {
  const { t } = useTranslation();
  const [execution, setExecution] = useState<CliExecution | null>(null);
  const isStartingExecutionRef = useRef(false);

  const startExecution = useCallback(async (initialPrompt?: string): Promise<CliExecution | null> => {
    if (isStartingExecutionRef.current) {
      console.log("Already starting execution, skipping duplicate call");
      return null;
    }
    
    isStartingExecutionRef.current = true;
    
    try {
      setIsLoading(true);
      console.log("Starting CLI execution for task:", task.id, "with prompt:", initialPrompt ? "yes" : "no");
      
      // Create a new attempt if we don't have one
      let attempt = currentAttempt;
      if (!attempt) {
        try {
          attempt = await taskAttemptApi.create(task.id);
          setCurrentAttempt(attempt);
          setAttempts(prev => [...prev, attempt!]);
          
          // Emit event to notify other components
          await emit("task-attempt-created", { task_id: task.id, attempt });
        } catch (error: any) {
          // If backend doesn't support attempts, create a mock one
          if (error?.toString().includes("not found")) {
            console.log("Attempt API not implemented, using mock attempt");
            attempt = {
              id: `mock-${Date.now()}`,
              task_id: task.id,
              worktree_path: project.path,
              branch: "main",
              base_branch: "main",
              status: AttemptStatus.Running,
              created_at: new Date().toISOString(),
            } as TaskAttempt;
            setCurrentAttempt(attempt);
            setAttempts(prev => [...prev, attempt!]);
          } else {
            throw error;
          }
        }
      }
      
      const aiType = "claude"; // TODO: Get from settings
      let newExecution: CliExecution;
      
      const workingDirectory = attempt?.worktree_path || project.path;
      
      if (aiType === "claude") {
        console.log("Starting Claude Code execution with path:", workingDirectory);
        newExecution = await cliApi.startClaudeExecution(
          task.id,
          workingDirectory,
          project.path,
          attempt?.claude_session_id
        );
      } else {
        newExecution = await cliApi.startGeminiExecution(
          task.id,
          workingDirectory,
          []
        );
      }
      
      console.log("Execution started:", newExecution);
      setExecution(newExecution);
      addMessage({
        id: `system-${Date.now()}`,
        type: "system",
        content: t('ai.executionStarted', { type: aiType === "claude" ? "Claude Code" : "Gemini CLI" }),
        timestamp: new Date(),
      });
      
      if (initialPrompt) {
        console.log("Sending initial prompt:", initialPrompt);
        await cliApi.sendInput(newExecution.id, initialPrompt);
      }
      
      // Handle pending message
      if (setIsSending && input.trim()) {
        console.log("Sending pending follow-up message:", input);
        const pendingMessage = input;
        setInput("");
        
        setTimeout(async () => {
          await cliApi.sendInput(newExecution.id, pendingMessage);
          setIsSending(false);
        }, 100);
      }
      
      isStartingExecutionRef.current = false;
      return newExecution;
    } catch (error) {
      console.error("Failed to start session:", error);
      toast({
        title: t('common.error'),
        description: `${t('ai.startExecutionError')}: ${error}`,
        variant: "destructive",
      });
      setIsSending(false);
      return null;
    } finally {
      setIsLoading(false);
      isStartingExecutionRef.current = false;
    }
  }, [task, project, currentAttempt, setCurrentAttempt, setAttempts, addMessage, setIsLoading, setIsSending, input, setInput, t]);

  const stopExecution = useCallback(async () => {
    if (execution) {
      try {
        await cliApi.stopExecution(execution.id);
        toast({
          title: t('ai.executionStopped'),
          description: t('ai.executionStopped'),
        });
      } catch (error) {
        console.error("Failed to stop session:", error);
        toast({
          title: t('common.error'),
          description: `${t('ai.stopExecutionError')}: ${error}`,
          variant: "destructive",
        });
      }
    }
  }, [execution, t]);

  const sendToExecution = useCallback(async (executionId: string, message: string, images?: string[]) => {
    let fullMessage = message;
    
    if (images && images.length > 0) {
      const imagePaths = await cliApi.saveImagesToTemp(images);
      fullMessage += "\n\nAttached images:";
      for (const path of imagePaths) {
        fullMessage += `\n- ${path}`;
      }
    }
    
    await cliApi.sendInput(executionId, fullMessage);
  }, []);

  const updateTaskStatus = useCallback(async (status: TaskStatus) => {
    try {
      await taskApi.updateStatus(task.id, status);
    } catch (error) {
      console.error("Failed to update task status:", error);
      throw error;
    }
  }, [task.id]);

  const resetExecutionFlag = useCallback(() => {
    isStartingExecutionRef.current = false;
  }, []);

  return {
    execution,
    setExecution,
    startExecution,
    stopExecution,
    sendToExecution,
    updateTaskStatus,
    resetExecutionFlag
  };
}