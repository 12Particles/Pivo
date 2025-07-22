import { useRef, useCallback } from "react";
import { cliApi, taskApi, taskAttemptApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { emit } from "@tauri-apps/api/event";
import { Task, Project, TaskAttempt, AttemptStatus, TaskStatus, CodingAgentType } from "@/types";
import { Message } from "../types";
import { useExecutionStore } from "@/stores/useExecutionStore";

interface UseExecutionManagerV2Props {
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

export function useExecutionManagerV2({
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
}: UseExecutionManagerV2Props) {
  const { t } = useTranslation();
  const isStartingExecutionRef = useRef(false);
  
  // Get state and actions from the execution store
  const { 
    getAttemptExecution, 
    getTaskSummary,
    startExecution: startExecutionStore,
    sendInput: sendInputStore,
    stopExecution: stopExecutionStore
  } = useExecutionStore();

  // Get execution for current attempt
  const attemptExecution = currentAttempt ? getAttemptExecution(currentAttempt.id) : undefined;
  const execution = attemptExecution?.current_execution || null;
  const taskSummary = getTaskSummary(task.id);

  const startExecution = useCallback(async (initialPrompt?: string) => {
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
      const workingDirectory = attempt?.worktree_path || project.path;
      
      // Use the store to start execution
      await startExecutionStore(
        task.id,
        attempt.id,
        workingDirectory,
        aiType === "claude" ? CodingAgentType.ClaudeCode : CodingAgentType.GeminiCli,
        project.path,
        attempt?.claude_session_id
      );
      
      addMessage({
        id: `system-${Date.now()}`,
        type: "system",
        content: t('ai.executionStarted', { type: aiType === "claude" ? "Claude Code" : "Gemini CLI" }),
        timestamp: new Date(),
      });
      
      // Get the newly created execution
      const newAttemptExecution = getAttemptExecution(attempt.id);
      const newExecution = newAttemptExecution?.current_execution;
      
      if (initialPrompt && newExecution) {
        console.log("Sending initial prompt:", initialPrompt);
        await sendInputStore(attempt.id, initialPrompt, []);
      }
      
      // Handle pending message only if no initial prompt was provided
      if (setIsSending && input.trim() && newExecution && !initialPrompt) {
        console.log("Sending pending follow-up message:", input);
        const pendingMessage = input;
        setInput("");
        
        setTimeout(async () => {
          await sendInputStore(attempt.id, pendingMessage, []);
          setIsSending(false);
        }, 100);
      } else if (setIsSending && initialPrompt) {
        // If initial prompt was provided, just clear the sending flag
        setIsSending(false);
      }
      
      isStartingExecutionRef.current = false;
      return newExecution || null;
    } catch (error) {
      console.error("Failed to start session:", error);
      toast({
        title: t('common.error'),
        description: `${t('ai.startExecutionError')}: ${error}`,
        variant: "destructive",
      });
      
      isStartingExecutionRef.current = false;
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [task, project, currentAttempt, setCurrentAttempt, setAttempts, addMessage, 
      setIsLoading, setIsSending, input, setInput, getAttemptExecution, 
      startExecutionStore, sendInputStore, t]);

  const stopExecution = useCallback(async () => {
    if (!currentAttempt) return;
    
    try {
      await stopExecutionStore(currentAttempt.id);
      toast({
        title: t('common.success'),
        description: t('ai.executionStopped'),
      });
    } catch (error) {
      console.error("Failed to stop execution:", error);
      toast({
        title: t('common.error'),
        description: `${t('ai.stopExecutionError')}: ${error}`,
        variant: "destructive",
      });
    }
  }, [currentAttempt, stopExecutionStore, t]);

  const sendToExecution = useCallback(async (_executionId: string, message: string, images: string[]) => {
    if (!currentAttempt) {
      throw new Error("No current attempt");
    }
    
    try {
      let imagePaths: string[] = [];
      if (images.length > 0) {
        imagePaths = await cliApi.saveImagesToTemp(images);
      }
      
      await sendInputStore(currentAttempt.id, message, imagePaths);
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  }, [currentAttempt, sendInputStore]);

  const updateTaskStatus = useCallback(async (status: TaskStatus) => {
    try {
      const updatedTask = await taskApi.updateStatus(task.id, status);
      console.log("Task status updated:", updatedTask);
      
      // Emit event to notify other components
      await emit("task-status-updated", { task: updatedTask });
      
      return updatedTask;
    } catch (error) {
      console.error("Failed to update task status:", error);
      toast({
        title: t('common.error'),
        description: `${t('tasks.updateStatusError')}: ${error}`,
        variant: "destructive",
      });
      throw error;
    }
  }, [task.id, t]);

  const resetExecutionFlag = useCallback(() => {
    isStartingExecutionRef.current = false;
  }, []);

  // Set execution to the one from the store
  const setExecution = useCallback(() => {
    // This is now handled by the store, so this is a no-op
    // We keep it for backward compatibility
  }, []);

  return {
    execution,
    setExecution,
    startExecution,
    stopExecution,
    sendToExecution,
    updateTaskStatus,
    resetExecutionFlag,
    isRunning: taskSummary?.is_running || false,
    agentType: taskSummary?.agent_type
  };
}