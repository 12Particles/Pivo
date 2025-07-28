import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";
import { ContentRenderer } from "../renderers/ContentRenderer";
import { TodoListRenderer } from "../renderers/TodoListRenderer";
import { GlobResultRenderer } from "../renderers/GlobResultRenderer";
import { WriteResultRenderer } from "../renderers/WriteResultRenderer";
import { EditResultRenderer } from "../renderers/EditResultRenderer";
import { LSResultRenderer } from "../renderers/LSResultRenderer";
import { AssistantToolResultMessage } from "../../types";

interface TodoItem {
  id?: string;
  content: string;
  status: string;
  priority?: string;
}

export function ToolResultMessage({ message }: MessageComponentProps) {
  const { t } = useTranslation();
  
  // Type assertion - we know this is a tool result message
  const toolResultMessage = message as AssistantToolResultMessage;
  const toolName = toolResultMessage.metadata.toolName || "Unknown";
  const isError = toolResultMessage.metadata.error || false;
  
  // Check if this is a special tool result that needs custom rendering
  const isTodoWriteResult = toolName === "TodoWrite";
  const isGlobResult = toolName === "Glob";
  const isWriteResult = toolName === "Write";
  const isEditResult = toolName === "Edit" || toolName === "MultiEdit";
  const isLSResult = toolName === "LS";
  
  if (isTodoWriteResult) {
    try {
      let todosArray: TodoItem[] | null = null;
      
      // First try to parse the content as JSON directly
      try {
        const jsonData = JSON.parse(message.content);
        if (jsonData.todos && Array.isArray(jsonData.todos)) {
          todosArray = jsonData.todos;
        } else if (Array.isArray(jsonData)) {
          todosArray = jsonData;
        }
      } catch {
        // If direct parse fails, try to extract from formatted output
        const todoRegex = /•\s*\[([^\]]+)\]\s*([^(]+)\s*\(([^)]+)\)/g;
        const matches = Array.from(message.content.matchAll(todoRegex));
        if (matches.length > 0) {
          todosArray = matches.map(match => ({
            status: match[1],
            content: match[2].trim(),
            priority: match[3]
          }));
        }
      }
      
      if (todosArray && todosArray.length > 0) {
        return (
          <div className="bg-muted/20 border-b">
            <div className="py-3 px-4">
              <MessageHeader
                icon={<FileText className="h-4 w-4 text-purple-600" />}
                title={t('ai.toolResult')}
                timestamp={message.timestamp}
              />
              
              <div className="ml-7 text-sm">
                <TodoListRenderer todos={todosArray} />
              </div>
            </div>
          </div>
        );
      }
    } catch {
      // Fall through to default rendering
    }
  }
  
  return (
    <div className="bg-muted/20 border-b w-full">
      <div className="py-3 px-4 w-full">
        <MessageHeader
          icon={<FileText className={`h-4 w-4 ${isError ? 'text-red-600' : 'text-gray-600'}`} />}
          title={t('ai.toolResult')}
          timestamp={message.timestamp}
        />
        
        <div className="ml-7 text-sm w-full overflow-x-auto">
          <div className={`p-3 rounded-md border ${
            isError 
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
              : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
            {isGlobResult ? (
              <GlobResultRenderer content={message.content} toolName={toolName} />
            ) : isWriteResult ? (
              <WriteResultRenderer content={message.content} />
            ) : isEditResult ? (
              <EditResultRenderer content={message.content} />
            ) : isLSResult ? (
              <LSResultRenderer content={message.content} />
            ) : (
              <ContentRenderer content={message.content} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}