import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cliApi } from "@/lib/api";
import { CliSession, CliOutput, CliOutputType, CliSessionStatus, Task, Project } from "@/types";
import { listen } from "@tauri-apps/api/event";
import { 
  Bot, 
  Send, 
  Square, 
  RefreshCw,
  Sparkles,
  Terminal,
  FileText
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AiAssistantPanelProps {
  task: Task;
  project: Project;
}

interface ChatMessage {
  id: string;
  type: CliOutputType | "input";
  content: string;
  timestamp: Date;
}

export function AiAssistantPanel({ task, project }: AiAssistantPanelProps) {
  const [session, setSession] = useState<CliSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const [newContextFile, setNewContextFile] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Listen for CLI output
    const unlistenOutput = listen<CliOutput>("cli-output", (event) => {
      if (event.payload.session_id === session?.id) {
        addMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: event.payload.output_type,
          content: event.payload.content,
          timestamp: new Date(event.payload.timestamp),
        });
      }
    });

    // Listen for session status updates
    const unlistenStatus = listen<CliSession>("cli-session-status", (event) => {
      if (event.payload.id === session?.id) {
        setSession(event.payload);
      }
    });

    return () => {
      unlistenOutput.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, [session?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const startClaudeSession = async () => {
    try {
      setIsLoading(true);
      const newSession = await cliApi.startClaudeSession(
        task.id,
        project.path,
        project.path
      );
      setSession(newSession);
      addMessage({
        id: `system-${Date.now()}`,
        type: "input",
        content: "Claude Code session started...",
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Failed to start Claude session:", error);
      toast({
        title: "错误",
        description: `启动 Claude Code 失败: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startGeminiSession = async () => {
    try {
      setIsLoading(true);
      const newSession = await cliApi.startGeminiSession(
        task.id,
        project.path,
        contextFiles
      );
      setSession(newSession);
      addMessage({
        id: `system-${Date.now()}`,
        type: "input",
        content: "Gemini CLI session started...",
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Failed to start Gemini session:", error);
      toast({
        title: "错误",
        description: `启动 Gemini CLI 失败: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopSession = async () => {
    if (!session) return;

    try {
      await cliApi.stopSession(session.id);
      setSession(null);
      addMessage({
        id: `system-${Date.now()}`,
        type: "input",
        content: "Session stopped.",
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Failed to stop session:", error);
      toast({
        title: "错误",
        description: `停止会话失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!session || !input.trim()) return;

    const userInput = input.trim();
    setInput("");

    // Add user message to chat
    addMessage({
      id: `input-${Date.now()}`,
      type: "input",
      content: userInput,
      timestamp: new Date(),
    });

    try {
      await cliApi.sendInput(session.id, userInput);
    } catch (error) {
      console.error("Failed to send input:", error);
      toast({
        title: "错误",
        description: `发送消息失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addContextFile = () => {
    if (newContextFile.trim()) {
      setContextFiles([...contextFiles, newContextFile.trim()]);
      setNewContextFile("");
    }
  };

  const removeContextFile = (index: number) => {
    setContextFiles(contextFiles.filter((_, i) => i !== index));
  };

  const getMessageStyle = (type: CliOutputType | "input") => {
    switch (type) {
      case "input":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      case CliOutputType.Stderr:
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      case CliOutputType.System:
        return "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800";
      default:
        return "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800";
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI 助手
          </div>
          {session && (
            <Badge variant={session.status === CliSessionStatus.Running ? "default" : "secondary"}>
              {session.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {!session ? (
          <div className="p-6 space-y-6">
            <Tabs defaultValue="claude" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="claude">Claude Code</TabsTrigger>
                <TabsTrigger value="gemini">Gemini CLI</TabsTrigger>
              </TabsList>

              <TabsContent value="claude" className="space-y-4">
                <div className="text-center space-y-4">
                  <div className="p-8 border-2 border-dashed rounded-lg">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-medium mb-2">Claude Code</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      使用 Claude 进行代码生成、重构和问题解决
                    </p>
                    <Button onClick={startClaudeSession} disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          启动中...
                        </>
                      ) : (
                        <>
                          <Terminal className="h-4 w-4 mr-2" />
                          启动 Claude Code
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="gemini" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">上下文文件</label>
                    <div className="flex gap-2">
                      <Input
                        value={newContextFile}
                        onChange={(e) => setNewContextFile(e.target.value)}
                        placeholder="添加文件路径..."
                        onKeyPress={(e) => e.key === "Enter" && addContextFile()}
                      />
                      <Button onClick={addContextFile} size="sm">
                        添加
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {contextFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <FileText className="h-3 w-3" />
                          <span className="flex-1">{file}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeContextFile(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="p-8 border-2 border-dashed rounded-lg">
                      <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-medium mb-2">Gemini CLI</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        使用 Gemini 进行智能代码分析和生成
                      </p>
                      <Button onClick={startGeminiSession} disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            启动中...
                          </>
                        ) : (
                          <>
                            <Terminal className="h-4 w-4 mr-2" />
                            启动 Gemini CLI
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Chat messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg border ${getMessageStyle(message.type)}`}
                  >
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {message.content}
                    </pre>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="border-t p-4 space-y-2">
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入消息..."
                  className="flex-1 min-h-[60px] max-h-[200px]"
                />
                <div className="flex flex-col gap-2">
                  <Button onClick={sendMessage} disabled={!input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button onClick={stopSession} variant="destructive" size="icon">
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}