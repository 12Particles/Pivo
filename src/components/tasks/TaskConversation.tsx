import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConversationEntry } from "@/types";
import { Send, FileCode, GitBranch, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskConversationProps {
  conversation: ConversationEntry[];
  onSendMessage: (message: string) => void;
}

export function TaskConversation({
  conversation,
  onSendMessage,
}: TaskConversationProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const renderEntry = (entry: ConversationEntry) => {
    const isUser = entry.type === "user";
    const isAssistant = entry.type === "assistant";
    const isSystem = entry.type === "system";
    const isTool = entry.type === "tool_use" || entry.type === "tool_result";

    return (
      <div
        key={entry.id}
        className={cn(
          "flex gap-3 p-4",
          isUser && "bg-blue-50",
          isSystem && "bg-gray-50",
          isTool && "bg-yellow-50"
        )}
      >
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant={isUser ? "default" : isAssistant ? "secondary" : "outline"}
            >
              {entry.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="text-sm">
            {entry.type === "tool_use" && entry.metadata?.tool ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  <span className="font-medium">
                    使用工具: {entry.metadata.tool}
                  </span>
                </div>
                <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                  {entry.content}
                </pre>
              </div>
            ) : entry.type === "tool_result" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">工具结果</span>
                </div>
                <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                  {entry.content}
                </pre>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{entry.content}</p>
            )}
          </div>

          {entry.metadata?.files && entry.metadata.files.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                文件变更:
              </div>
              {entry.metadata.files.map((file: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-xs bg-white p-2 rounded"
                >
                  <GitBranch className="h-3 w-3 text-green-600" />
                  <span className="font-mono">{file.path}</span>
                  <Badge variant="secondary" className="text-xs">
                    {file.changeType}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="text-lg">任务会话</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {conversation.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              暂无会话记录
            </div>
          ) : (
            <div className="divide-y">
              {conversation.map((entry) => renderEntry(entry))}
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="输入消息..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
            />
            <Button onClick={handleSend} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}