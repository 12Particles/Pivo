import { useState, useCallback, useRef, useEffect } from "react";
import { Message, ConversationState } from "../types";
import { taskAttemptApi } from "@/lib/api";
import { TaskAttempt } from "@/types";

export function useConversationState(_taskId: string, currentAttempt: TaskAttempt | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const toggleMessageCollapse = useCallback((messageId: string) => {
    setCollapsedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  const saveConversation = useCallback(async () => {
    if (!currentAttempt) return;
    
    try {
      const backendMessages = messages.map(msg => ({
        role: msg.type === "user" ? "user" : "assistant",
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      }));
      
      await taskAttemptApi.saveConversation(currentAttempt.id, backendMessages);
    } catch (error: any) {
      if (!error?.toString().includes("not found")) {
        console.error("Failed to save conversation:", error);
      }
    }
  }, [currentAttempt, messages]);

  // Auto-save messages periodically
  useEffect(() => {
    if (currentAttempt && messages.length > 0) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      
      saveTimerRef.current = setTimeout(() => {
        saveConversation();
      }, 2000);
    }

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [messages, currentAttempt, saveConversation]);

  const loadMessages = useCallback(async (attempt: TaskAttempt) => {
    try {
      const conversationData = await taskAttemptApi.getConversation(attempt.id);
      if (conversationData?.messages?.length > 0) {
        const loadedMessages = conversationData.messages.map((msg: any) => ({
          id: `loaded-${Date.now()}-${Math.random()}`,
          type: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(loadedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
      setMessages([]);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const state: ConversationState = {
    messages,
    input,
    images,
    isLoading,
    isSending,
    pendingMessages,
    collapsedMessages
  };

  const actions = {
    addMessage,
    setInput,
    setImages,
    setIsLoading,
    setIsSending,
    setPendingMessages,
    toggleMessageCollapse,
    saveConversation,
    loadMessages,
    clearMessages
  };

  return { state, actions };
}