import { CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodoItem {
  id?: string;
  content: string;
  status: string;
  priority?: string;
}

interface TodoListRendererProps {
  todos: TodoItem[];
}

export function TodoListRenderer({ todos }: TodoListRendererProps) {
  const priorityColors = {
    high: "text-red-600 dark:text-red-400",
    medium: "text-yellow-600 dark:text-yellow-400",
    low: "text-green-600 dark:text-green-400"
  };
  
  return (
    <div className="space-y-2">
      <div className="font-semibold text-purple-600 dark:text-purple-400">TODO List:</div>
      {todos.map((todo, index) => {
        const isCompleted = todo.status === "completed";
        return (
          <div key={todo.id || index} className="flex items-start gap-2">
            {isCompleted ? (
              <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Square className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <span className={cn(
                "text-sm",
                isCompleted && "line-through text-gray-500 dark:text-gray-400"
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