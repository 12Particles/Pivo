import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Task, Project, CliSession, CliOutputType, CliSessionStatus, TaskStatus, TaskAttempt, AttemptStatus } from "@/types";
import { cliApi, taskApi, taskAttemptApi } from "@/lib/api";
import { listen } from "@tauri-apps/api/event";
import { 
  Send, 
  Bot,
  ImagePlus,
  X,
  Sparkles,
  Terminal,
  Loader2,
  Square,
  User,
  Settings,
  FileText,
  Edit,
  Eye,
  Search,
  Globe,
  Plus,
  CheckSquare,
  Brain,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { TodoList } from "@/components/ui/todo-list";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useTranslation } from "react-i18next";

interface TaskConversationEnhancedProps {
  task: Task;
  project: Project;
}

interface Message {
  id: string;
  type: "user" | "assistant" | "system" | "tool_use" | "tool_result" | "thinking" | "error";
  content: string;
  timestamp: Date;
  images?: string[];
  metadata?: {
    toolName?: string;
    error?: boolean;
    structured?: any; // For structured tool outputs
  };
}

export function TaskConversationEnhanced({ task, project }: TaskConversationEnhancedProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [session, setSession] = useState<CliSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<TaskAttempt | null>(null);
  const [_attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load attempts when task changes
  useEffect(() => {
    loadAttempts();
  }, [task.id]);

  // Auto-start session and send initial prompt only for brand new tasks
  useEffect(() => {
    if (task.status === "Working" && !session && !isLoading && !currentAttempt && messages.length === 0) {
      // Only auto-start for brand new tasks that have never been worked on
      // This will create the session AND send the task prompt
      startSession(false);
    }
  }, [task.status, currentAttempt, messages.length]);
  
  // Handle the case where we have an existing attempt but no active session
  // This happens after app restart
  useEffect(() => {
    // If we have messages but no session, don't auto-create one
    // Wait for user to send a message
    if (currentAttempt && messages.length > 0 && !session) {
      console.log("Have existing conversation, waiting for user input to resume");
    }
  }, [currentAttempt, messages.length, session]);

  // Auto-save messages periodically
  useEffect(() => {
    if (currentAttempt && messages.length > 0) {
      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      
      // Set new timer to save after 2 seconds of inactivity
      saveTimerRef.current = setTimeout(() => {
        saveConversation();
      }, 2000);
    }

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [messages, currentAttempt]);

  useEffect(() => {
    // Listen for CLI output
    const unlistenOutput = listen<any>("cli-output", (event) => {
      console.log("Received cli-output event:", event.payload);
      if (event.payload.session_id === session?.id || 
          (session && event.payload.task_id === task.id)) {
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

    // Listen for session status updates
    const unlistenStatus = listen<CliSession>("cli-session-status", (event) => {
      if (event.payload.id === session?.id || event.payload.task_id === task.id) {
        setSession(event.payload);
      }
    });
    
    // Listen for Claude session ID
    const unlistenClaudeSessionId = listen<any>("claude-session-id-received", async (event) => {
      if (event.payload.task_id === task.id && currentAttempt) {
        console.log("Received Claude session ID:", event.payload.claude_session_id);
        
        // Save Claude session ID to database
        try {
          await taskAttemptApi.updateClaudeSessionId(currentAttempt.id, event.payload.claude_session_id);
          console.log("Saved Claude session ID to database");
        } catch (error) {
          console.error("Failed to save Claude session ID:", error);
        }
      }
    });
    
    // Listen for process completion
    const unlistenComplete = listen<any>("cli-process-completed", async (event) => {
      if (event.payload.task_id === task.id) {
        console.log("Claude Code process completed, updating task status to Reviewing");
        setIsSending(false);
        
        // Update session status to stopped
        if (session) {
          setSession({
            ...session,
            status: CliSessionStatus.Stopped
          });
        }
        
        try {
          // Save final conversation state
          await saveConversation();
          
          // Update attempt status
          if (currentAttempt && !currentAttempt.id.startsWith('mock-')) {
            try {
              await taskAttemptApi.updateStatus(currentAttempt.id, AttemptStatus.Success);
            } catch (error: any) {
              // Ignore if backend doesn't support it
              if (!error?.toString().includes("not found")) {
                console.error("Failed to update attempt status:", error);
              }
            }
          }
          
          // Update task status to Reviewing
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
  }, [session?.id, task.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const loadAttempts = async () => {
    try {
      const taskAttempts = await taskAttemptApi.listForTask(task.id);
      setAttempts(taskAttempts);
      
      // Load messages from the latest attempt if exists
      if (taskAttempts.length > 0) {
        const latestAttempt = taskAttempts[taskAttempts.length - 1];
        setCurrentAttempt(latestAttempt);
        
        // Load conversation history
        const conversationData = await taskAttemptApi.getConversation(latestAttempt.id);
        if (conversationData && conversationData.messages && conversationData.messages.length > 0) {
          // Convert backend messages to frontend format
          const loadedMessages = conversationData.messages.map((msg: any) => ({
            id: `loaded-${Date.now()}-${Math.random()}`,
            type: msg.role === "user" ? "user" : "assistant",
            content: msg.content,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(loadedMessages);
        } else {
          // Clear messages if no history
          setMessages([]);
        }
      } else {
        // No attempts found, clear everything
        setCurrentAttempt(null);
        setMessages([]);
      }
    } catch (error: any) {
      // If the backend doesn't support attempts yet, just log and continue
      if (error?.toString().includes("not found")) {
        console.log("Attempt API not implemented yet, continuing without persistence");
      } else {
        console.error("Failed to load attempts:", error);
      }
    }
  };

  const saveConversation = async () => {
    if (!currentAttempt) return;
    
    try {
      // Convert messages to backend format with role field
      const backendMessages = messages.map(msg => ({
        role: msg.type === "user" ? "user" : "assistant",
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      }));
      
      await taskAttemptApi.saveConversation(currentAttempt.id, backendMessages);
    } catch (error: any) {
      // Silently fail if backend doesn't support it yet
      if (!error?.toString().includes("not found")) {
        console.error("Failed to save conversation:", error);
      }
    }
  };

  const startSession = async (isResume: boolean = false): Promise<CliSession | null> => {
    try {
      setIsLoading(true);
      console.log("Starting CLI session for task:", task.id, "isResume:", isResume);
      
      // Create a new attempt if we don't have one
      let attempt = currentAttempt;
      if (!attempt) {
        try {
          attempt = await taskAttemptApi.create(task.id);
          setCurrentAttempt(attempt);
          setAttempts(prev => [...prev, attempt!]);
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
      
      // TODO: Get AI type from settings/config
      const aiType = "claude"; // Default to Claude for now
      
      let newSession: CliSession;
      
      // Use worktree path if available, otherwise use project path
      const workingDirectory = attempt?.worktree_path || project.path;
      
      if (aiType === "claude") {
        console.log("Starting Claude Code session with path:", workingDirectory);
        // If resuming, pass the stored Claude session ID
        const claudeSessionId = isResume && attempt?.claude_session_id ? attempt.claude_session_id : undefined;
        if (claudeSessionId) {
          console.log("Using stored Claude session ID:", claudeSessionId);
        }
        newSession = await cliApi.startClaudeSession(
          task.id,
          workingDirectory,
          project.path,  // Keep project path for context
          claudeSessionId
        );
      } else {
        newSession = await cliApi.startGeminiSession(
          task.id,
          workingDirectory,
          [] // Context files can be added later
        );
      }
      
      console.log("Session started:", newSession);
      setSession(newSession);
      addMessage({
        id: `system-${Date.now()}`,
        type: "system",
        content: t('ai.sessionStarted', { type: aiType === "claude" ? "Claude Code" : "Gemini CLI" }),
        timestamp: new Date(),
      });
      
      // Only send task information if this is NOT a resume
      if (!isResume) {
        const taskPrompt = task.description 
          ? `Task title: ${task.title}\nTask description: ${task.description}`
          : `Task title: ${task.title}`;
        
        console.log("Sending task prompt:", taskPrompt);
        await cliApi.sendInput(newSession.id, taskPrompt);
      }
      
      // If we have a pending message (from follow-up), send it now
      if (isSending && input.trim()) {
        console.log("Sending pending follow-up message:", input);
        const pendingMessage = input;
        setInput("");
        
        // Wait a bit to ensure the first message is processed
        setTimeout(async () => {
          await cliApi.sendInput(newSession.id, pendingMessage);
          setIsSending(false);
        }, 100);
      }
      
      return newSession;
    } catch (error) {
      console.error("Failed to start session:", error);
      toast({
        title: t('common.error'),
        description: `${t('ai.startSessionError')}: ${error}`,
        variant: "destructive",
      });
      setIsSending(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  };


  const sendMessage = async () => {
    const message = input.trim();
    if (!message && images.length === 0) return;

    // Check if Claude is still running
    if (session && session.status === CliSessionStatus.Running) {
      toast({
        title: t('common.info'),
        description: t('ai.waitForCompletion'),
      });
      return;
    }

    // If a message is being sent, queue this one
    if (isSending) {
      setPendingMessages(prev => [...prev, message]);
      setInput("");
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
    addMessage(userMessage);

    // Clear input
    setInput("");
    setImages([]);
    setIsSending(true);

    if (session) {
      // Send to AI session
      try {
        // If task is in Reviewing status, change it back to Working
        if (task.status === "Reviewing") {
          console.log("Task is in Reviewing status, changing to Working");
          await taskApi.updateStatus(task.id, TaskStatus.Working);
        }
        
        let fullMessage = message;
        
        // If we have images, we need to save them as temporary files for Claude Code
        if (images.length > 0) {
          // Save images to temp files and get paths
          const imagePaths = await cliApi.saveImagesToTemp(images);
          
          // Append image paths to the message in the format Claude Code expects
          fullMessage += "\n\nAttached images:";
          for (const path of imagePaths) {
            fullMessage += `\n- ${path}`;
          }
        }
        await cliApi.sendInput(session.id, fullMessage);
      } catch (error) {
        console.error("Failed to send message:", error);
        toast({
          title: t('common.error'),
          description: `${t('ai.sendMessageError')}: ${error}`,
          variant: "destructive",
        });
        setIsSending(false);
      }
    } else if (task.status === "Working" || task.status === "Reviewing") {
      // If there's no session but task is in Working/Reviewing status, we need to continue with the existing session
      // This happens when sending a follow-up after task completion
      console.log("No active session but task is in Working/Reviewing status, starting session for follow-up");
      
      // First, change task status to Working if it's Reviewing
      if (task.status === "Reviewing") {
        await taskApi.updateStatus(task.id, TaskStatus.Working);
      }
      
      // Start a new session that will use --resume with the stored Claude session ID
      // Pass isResume=true to avoid sending task prompt again
      const newSession = await startSession(true);
      
      // Now send the user's message
      if (newSession) {
        try {
          let fullMessage = message;
          
          // If we have images, save them as temporary files
          if (images.length > 0) {
            const imagePaths = await cliApi.saveImagesToTemp(images);
            fullMessage += "\n\nAttached images:";
            for (const path of imagePaths) {
              fullMessage += `\n- ${path}`;
            }
          }
          
          await cliApi.sendInput(newSession.id, fullMessage);
        } catch (error) {
          console.error("Failed to send message after creating session:", error);
          toast({
            title: t('common.error'),
            description: `${t('ai.sendMessageError')}: ${error}`,
            variant: "destructive",
          });
          setIsSending(false);
        }
      } else {
        setIsSending(false);
      }
    } else {
      toast({
        title: t('common.info'),
        description: t('task.startChat'),
      });
      setIsSending(false);
    }
  };

  const stopExecution = async () => {
    if (session) {
      try {
        await cliApi.stopSession(session.id);
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
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));
    
    if (imageItems.length === 0) return;
    
    e.preventDefault();
    const newImages: string[] = [];

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          newImages.push(base64);
        } catch (error) {
          console.error("Failed to read pasted image:", error);
        }
      }
    }

    if (newImages.length > 0) {
      setImages([...images, ...newImages].slice(0, 5)); // Limit to 5 images
      toast({
        title: t('ai.imagePasted'),
        description: t('ai.imagePastedDesc', { count: newImages.length }),
      });
    }
  };

  const handleImageSelect = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp"],
        }],
      });

      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        const imagePromises = files.map(async (file) => {
          const data = await readFile(file);
          // Convert to base64 for display
          const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
          return `data:image/png;base64,${base64}`;
        });
        
        const imageUrls = await Promise.all(imagePromises);
        setImages([...images, ...imageUrls]);
      }
    } catch (error) {
      console.error("Failed to select images:", error);
      toast({
        title: t('common.error'),
        description: t('ai.selectImageError'),
        variant: "destructive",
      });
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    URL.revokeObjectURL(newImages[index]);
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const getMessageIcon = (message: Message) => {
    const type = message.type;
    const toolName = message.metadata?.toolName;
    
    // Tool-specific icons
    if (type === "tool_use" && toolName) {
      if (toolName.includes("read") || toolName.includes("Read")) {
        return <Eye className="h-4 w-4 text-orange-600" />;
      }
      if (toolName.includes("write") || toolName.includes("Write") || toolName.includes("edit") || toolName.includes("Edit")) {
        return <Edit className="h-4 w-4 text-red-600" />;
      }
      if (toolName.includes("bash") || toolName.includes("Bash") || toolName.includes("terminal")) {
        return <Terminal className="h-4 w-4 text-yellow-600" />;
      }
      if (toolName.includes("search") || toolName.includes("Search") || toolName.includes("grep") || toolName.includes("Grep")) {
        return <Search className="h-4 w-4 text-indigo-600" />;
      }
      if (toolName.includes("web") || toolName.includes("Web")) {
        return <Globe className="h-4 w-4 text-cyan-600" />;
      }
      if (toolName.includes("create") || toolName.includes("Create")) {
        return <Plus className="h-4 w-4 text-teal-600" />;
      }
      if (toolName.includes("todo") || toolName.includes("Todo")) {
        return <CheckSquare className="h-4 w-4 text-purple-600" />;
      }
      return <FileText className="h-4 w-4 text-gray-600" />;
    }
    
    // Message type icons
    switch (type) {
      case "user":
        return <User className="h-4 w-4 text-blue-600" />;
      case "assistant":
        return <Bot className="h-4 w-4 text-green-600" />;
      case "system":
        return <Settings className="h-4 w-4 text-gray-600" />;
      case "thinking":
        return <Brain className="h-4 w-4 text-purple-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Sparkles className="h-4 w-4 text-gray-600" />;
    }
  };
  
  const shouldCollapseContent = (content: string): boolean => {
    return content.split('\n').length > 10;
  };
  
  const toggleMessageCollapse = (messageId: string) => {
    setCollapsedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const parseAndFormatContent = (content: string, messageType: Message["type"]) => {
    // For tool results and tool use, try to parse common patterns
    if (messageType === "tool_result" || messageType === "assistant" || messageType === "tool_use") {
      // Check if it's a TodoWrite tool output
      if (content.includes("[Using tool: TodoWrite]") || (content.includes("todos") && content.includes('"status"') && content.includes('"priority"'))) {
        try {
          // Extract the todos array from the content
          let todosArray = null;
          
          // Try to parse the input section for TodoWrite
          const inputMatch = content.match(/Input:\s*({[\s\S]*})/m);
          if (inputMatch) {
            const inputData = JSON.parse(inputMatch[1]);
            if (inputData.todos && Array.isArray(inputData.todos)) {
              todosArray = inputData.todos;
            }
          }
          
          // If not found in input, try to parse the whole content as JSON
          if (!todosArray) {
            const jsonData = JSON.parse(content);
            if (jsonData.todos && Array.isArray(jsonData.todos)) {
              todosArray = jsonData.todos;
            } else if (Array.isArray(jsonData)) {
              todosArray = jsonData;
            }
          }
          
          if (todosArray && todosArray.length > 0) {
            return (
              <div className="space-y-2">
                <div className="font-semibold text-purple-600 dark:text-purple-400">TODO List:</div>
                {todosArray.map((todo: any, index: number) => {
                  const isCompleted = todo.status === "completed";
                  const priorityColors = {
                    high: "text-red-600 dark:text-red-400",
                    medium: "text-yellow-600 dark:text-yellow-400",
                    low: "text-green-600 dark:text-green-400"
                  };
                  
                  return (
                    <div key={todo.id || index} className="flex items-start gap-2">
                      {isCompleted ? (
                        <CheckSquare className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <span className={cn(
                          "text-sm",
                          isCompleted && "line-through text-gray-500"
                        )}>
                          {todo.content}
                        </span>
                        {todo.priority && (
                          <span className={cn(
                            "ml-2 text-xs",
                            priorityColors[todo.priority as keyof typeof priorityColors] || "text-gray-500"
                          )}>
                            [{todo.priority}]
                          </span>
                        )}
                        {todo.status === "in_progress" && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                            [进行中]
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }
        } catch {}
      }
      
      // Check if it's a file listing
      if (content.includes("├──") || content.includes("└──") || content.includes("│")) {
        return (
          <div className="overflow-x-auto">
            <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded whitespace-pre inline-block min-w-0">
              {content}
            </pre>
          </div>
        );
      }
      
      // Check if it's JSON (but not TodoWrite)
      try {
        const jsonData = JSON.parse(content);
        // Don't display as raw JSON if it's a todos array
        if (!jsonData.todos && !Array.isArray(jsonData)) {
          return (
            <div className="overflow-x-auto">
              <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded whitespace-pre inline-block min-w-0">
                {JSON.stringify(jsonData, null, 2)}
              </pre>
            </div>
          );
        }
      } catch {}
      
      // Check if it's a unified diff for a single file edit
      if (content.includes("[Using tool: Edit]") && content.includes("old_string") && content.includes("new_string")) {
        try {
          // Parse the Edit tool input
          const inputMatch = content.match(/Input:\s*({[\s\S]*})/m);
          if (inputMatch) {
            const inputData = JSON.parse(inputMatch[1]);
            const oldString = inputData.old_string || "";
            const newString = inputData.new_string || "";
            const filePath = inputData.file_path || "";
            
            return (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {filePath}
                </div>
                <div className="rounded-md border border-gray-200 dark:border-gray-700" style={{ width: '100%' }}>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <ReactDiffViewer
                      oldValue={oldString}
                      newValue={newString}
                      splitView={false}
                      useDarkTheme={true}
                      hideLineNumbers={false}
                      styles={{
                        variables: {
                          dark: {
                            diffViewerBackground: '#1f2937',
                            addedBackground: '#065f46',
                            removedBackground: '#991b1b',
                            wordAddedBackground: '#10b981',
                            wordRemovedBackground: '#ef4444',
                            addedColor: '#d1fae5',
                            removedColor: '#fee2e2',
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          }
        } catch (e) {
          // Fall back to regular display if parsing fails
        }
      }
      
      // Check if it's a git diff
      if (content.includes("diff --git") || (content.includes("+++") && content.includes("---"))) {
        // Extract old and new content from unified diff
        const lines = content.split('\n');
        let oldContent: string[] = [];
        let newContent: string[] = [];
        let inDiff = false;
        
        for (const line of lines) {
          if (line.startsWith("@@")) {
            inDiff = true;
            continue;
          }
          if (!inDiff) continue;
          
          if (line.startsWith("-") && !line.startsWith("---")) {
            oldContent.push(line.substring(1));
          } else if (line.startsWith("+") && !line.startsWith("+++")) {
            newContent.push(line.substring(1));
          } else if (line.startsWith(" ")) {
            oldContent.push(line.substring(1));
            newContent.push(line.substring(1));
          }
        }
        
        return (
          <div className="rounded-md border border-gray-200 dark:border-gray-700" style={{ width: '100%' }}>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <ReactDiffViewer
                oldValue={oldContent.join('\n')}
                newValue={newContent.join('\n')}
                splitView={false}
                useDarkTheme={true}
                hideLineNumbers={false}
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: '#1f2937',
                      addedBackground: '#065f46',
                      removedBackground: '#991b1b',
                      wordAddedBackground: '#10b981',
                      wordRemovedBackground: '#ef4444',
                      addedColor: '#d1fae5',
                      removedColor: '#fee2e2',
                    }
                  }
                }}
              />
            </div>
          </div>
        );
      }
      
      // Check for TODO lists
      if (content.includes("TODO") && (content.includes("[x]") || content.includes("[ ]") || content.includes("✅") || content.includes("☐"))) {
        return <TodoList content={content} />;
      }
      
      // Check for code blocks
      if (content.includes("```")) {
        const parts = content.split(/(```[\s\S]*?```)/g);
        return (
          <div className="space-y-2">
            {parts.map((part, i) => {
              if (part.startsWith("```") && part.endsWith("```")) {
                const code = part.slice(3, -3);
                const [lang, ...codeLines] = code.split('\n');
                const codeContent = codeLines.join('\n');
                return (
                  <div key={i} className="overflow-x-auto">
                    <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded whitespace-pre inline-block min-w-0">
                      {codeContent || lang}
                    </pre>
                  </div>
                );
              }
              return <div key={i} className="whitespace-pre-wrap break-words">{part}</div>;
            })}
          </div>
        );
      }
    }
    
    // Default rendering with line breaks
    return (
      <div className="whitespace-pre-wrap break-words">
        {content}
      </div>
    );
  };

  const renderMessage = (message: Message) => {
    const isUser = message.type === "user";
    const isAssistant = message.type === "assistant";
    const isSystem = message.type === "system";
    const isToolUse = message.type === "tool_use";
    const isToolResult = message.type === "tool_result";
    const isError = message.type === "error" || message.metadata?.error;
    const isThinking = message.type === "thinking";
    
    const shouldCollapse = shouldCollapseContent(message.content) && !isToolResult;
    const isCollapsed = collapsedMessages.has(message.id);
    const lines = message.content.split('\n');
    const displayContent = shouldCollapse && isCollapsed ? lines.slice(0, 10).join('\n') : message.content;

    return (
      <div
        key={message.id}
        className={cn(
          "group relative border-b last:border-b-0",
          isUser && "bg-background",
          isAssistant && "bg-background",
          (isToolUse || isToolResult) && "bg-muted/20",
          isSystem && "bg-orange-50 dark:bg-orange-950/20",
          isError && "bg-red-50 dark:bg-red-950/20",
          isThinking && "bg-purple-50 dark:bg-purple-950/20"
        )}
      >
        <div className="py-3 overflow-hidden">
          <div className="px-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getMessageIcon(message)}
              </div>
              
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-medium text-sm text-foreground">
                  {isUser ? t('ai.you') : 
                   isAssistant ? "Claude" : 
                   isToolUse ? `${t('ai.usingTool', { tool: message.metadata?.toolName || "Unknown" })}` :
                   isToolResult ? t('ai.toolResult') :
                   isThinking ? t('ai.thinking') :
                   isError ? t('common.error') :
                   t('ai.system')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <div className={cn(
              "px-4 text-sm",
              isToolUse && "font-mono text-gray-700 dark:text-gray-300",
              isError && "text-red-600 dark:text-red-400",
              isThinking && "italic text-purple-700 dark:text-purple-300"
            )}>
              {shouldCollapse && isCollapsed ? (
                <div className="whitespace-pre-wrap break-words">{displayContent}</div>
              ) : (
                parseAndFormatContent(message.content, message.type)
              )}
            </div>
          </div>
              
          
          {shouldCollapse && (
            <div className="px-4 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={() => toggleMessageCollapse(message.id)}
              >
                {isCollapsed ? (
                  <>
                    <ChevronRight className="h-3 w-3 mr-1" />
                    {t('ai.showAllLines', { count: lines.length })}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    {t('ai.collapse')}
                  </>
                )}
              </Button>
            </div>
          )}
          
          {message.images && message.images.length > 0 && (
            <div className="px-4 pt-3">
              <div className="flex flex-wrap gap-2">
                {message.images.map((img, index) => (
                  <div key={index} className="relative group/image">
                    <img
                      src={img}
                      alt={`${t('ai.attachment')} ${index + 1}`}
                      className="rounded-md border shadow-sm max-w-xs max-h-48 object-cover cursor-pointer transition-transform hover:scale-105"
                      onClick={() => window.open(img, '_blank')}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {session && (
              <Badge variant={session.status === CliSessionStatus.Running ? "default" : "secondary"}>
                {session.status}
              </Badge>
            )}
            {task.status === "Working" && (
              <Badge variant="outline" className="text-xs">
                {t('ai.executing')}
              </Badge>
            )}
            {isSending && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
          </div>
          {session && session.status === CliSessionStatus.Running && (
            <Button
              variant="outline"
              size="sm"
              onClick={stopExecution}
            >
              <Square className="h-4 w-4 mr-1" />
              {t('common.stop')}
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/5">
        <div className="min-h-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Sparkles className="h-12 w-12 mb-4" />
              <p className="text-sm">{t('task.noConversation')}</p>
              <p className="text-xs mt-1">
                {task.status === "Working" ? 
                  (session ? t('task.aiReady') : t('task.startingAi')) : 
                  t('task.startChat')}
              </p>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          {isSending && messages.length > 0 && (
            <div className="bg-muted/30">
              <div className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Claude</span>
                    <span className="text-sm text-muted-foreground">{t('ai.aiThinking')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-background p-4 space-y-3">
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap p-3 bg-muted/50 rounded-lg">
            {images.map((img, index) => (
              <div key={index} className="relative group">
                <img
                  src={img}
                  alt={`Attachment ${index + 1}`}
                  className="h-20 w-20 object-cover rounded-md border shadow-sm"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  onClick={() => removeImage(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleImageSelect}
            title={t('ai.addImage')}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            placeholder={t('ai.sendMessage')}
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            disabled={isSending || (session?.status === CliSessionStatus.Running) || false}
          />
          
          <Button 
            onClick={sendMessage} 
            disabled={(!input.trim() && images.length === 0) || isSending || (session?.status === CliSessionStatus.Running) || false}
          >
            {pendingMessages.length > 0 ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {t('ai.pendingMessages', { count: pendingMessages.length })}
              </>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}