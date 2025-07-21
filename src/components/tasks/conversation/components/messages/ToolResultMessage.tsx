import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MessageComponentProps } from "./types";
import { MessageHeader } from "./MessageHeader";
import { ContentRenderer } from "../renderers/ContentRenderer";
import { TodoListRenderer } from "../renderers/TodoListRenderer";

interface TodoItem {
  id?: string;
  content: string;
  status: string;
  priority?: string;
}

export function ToolResultMessage({ message }: MessageComponentProps) {
  const { t } = useTranslation();
  
  // Check if this is a TodoWrite tool result
  const isTodoWriteResult = message.metadata?.toolName === "TodoWrite" || 
    (message.content.includes("[Using tool: TodoWrite]") || 
     (message.content.includes("todos") && message.content.includes('"status"') && message.content.includes('"priority"')));
  
  if (isTodoWriteResult) {
    try {
      let todosArray: TodoItem[] | null = null;
      
      // Try to extract todos from tool input format
      const inputMatch = message.content.match(/Input:\s*({[\s\S]*})/m);
      if (inputMatch) {
        const inputData = JSON.parse(inputMatch[1]);
        if (inputData.todos && Array.isArray(inputData.todos)) {
          todosArray = inputData.todos;
        }
      }
      
      // Try direct JSON parse if no input match
      if (!todosArray) {
        const jsonData = JSON.parse(message.content);
        if (jsonData.todos && Array.isArray(jsonData.todos)) {
          todosArray = jsonData.todos;
        } else if (Array.isArray(jsonData)) {
          todosArray = jsonData;
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
    <div className="bg-muted/20 border-b">
      <div className="py-3 px-4">
        <MessageHeader
          icon={<FileText className="h-4 w-4 text-gray-600" />}
          title={t('ai.toolResult')}
          timestamp={message.timestamp}
        />
        
        <div className="ml-7 text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md border border-gray-200 dark:border-gray-700">
            <ContentRenderer content={message.content} />
          </div>
        </div>
      </div>
    </div>
  );
}