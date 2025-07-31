import { useState, useEffect } from 'react';
import { eventBus } from '@/lib/events/EventBus';
import { CodingAgentType } from '@/types';

interface AttemptExecutionStatus {
  isRunning: boolean;
  agentType: CodingAgentType | null;
  taskId: string;
}

/**
 * Hook to track execution status from backend events
 * Maps attempt execution status to tasks for UI display
 */
export function useTaskExecutionStatus() {
  // Track attempt statuses
  const [attemptStatuses, setAttemptStatuses] = useState<Map<string, AttemptExecutionStatus>>(new Map());
  
  // Map task to its active attempt for quick lookup
  const [taskToActiveAttempt, setTaskToActiveAttempt] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Listen for execution started events
    const unsubscribeStarted = eventBus.subscribe('execution:started', ({ taskId, attemptId }) => {
      setAttemptStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(attemptId, {
          isRunning: true,
          agentType: null, // agentType not provided in new event
          taskId,
        });
        return newMap;
      });
      
      // Update task to attempt mapping
      setTaskToActiveAttempt(prev => {
        const newMap = new Map(prev);
        newMap.set(taskId, attemptId);
        return newMap;
      });
    });

    // Listen for execution stopped/completed events
    const unsubscribeStopped = eventBus.subscribe('execution:stopped', ({ taskId, attemptId }) => {
      setAttemptStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(attemptId, {
          isRunning: false,
          agentType: null,
          taskId,
        });
        return newMap;
      });
      
      // Clear task to attempt mapping
      setTaskToActiveAttempt(prev => {
        const newMap = new Map(prev);
        if (newMap.get(taskId) === attemptId) {
          newMap.delete(taskId);
        }
        return newMap;
      });
    });

    // Listen for execution completed events
    const unsubscribeCompleted = eventBus.subscribe('execution:completed', ({ taskId, attemptId }) => {
      setAttemptStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(attemptId, {
          isRunning: false,
          agentType: null,
          taskId,
        });
        return newMap;
      });
      
      // Clear task to attempt mapping
      setTaskToActiveAttempt(prev => {
        const newMap = new Map(prev);
        if (newMap.get(taskId) === attemptId) {
          newMap.delete(taskId);
        }
        return newMap;
      });
    });

    return () => {
      unsubscribeStarted();
      unsubscribeStopped();
      unsubscribeCompleted();
    };
  }, []);

  // Helper function to check if a task has a running execution
  const isTaskRunning = (taskId: string): boolean => {
    const activeAttemptId = taskToActiveAttempt.get(taskId);
    if (!activeAttemptId) return false;
    
    const attemptStatus = attemptStatuses.get(activeAttemptId);
    return attemptStatus?.isRunning || false;
  };

  return {
    attemptStatuses,
    taskToActiveAttempt,
    isTaskRunning,
  };
}