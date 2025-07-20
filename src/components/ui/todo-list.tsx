import { CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodoItem {
  text: string;
  completed: boolean;
  priority?: string;
}

interface TodoListProps {
  content: string;
  className?: string;
}

export function TodoList({ content, className }: TodoListProps) {
  // Parse TODO list from content
  const lines = content.split('\n');
  const todos: TodoItem[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      // Check for checkbox pattern [x] or [ ]
      const checkedMatch = trimmed.match(/^\[([x\s])\]\s*(.+)/i);
      if (checkedMatch) {
        todos.push({
          completed: checkedMatch[1].toLowerCase() === 'x',
          text: checkedMatch[2]
        });
      } else if (trimmed.includes('✅')) {
        // Alternative format with emoji
        todos.push({
          completed: true,
          text: trimmed.replace('✅', '').trim()
        });
      } else if (trimmed.includes('☐') || trimmed.includes('□')) {
        todos.push({
          completed: false,
          text: trimmed.replace(/[☐□]/, '').trim()
        });
      } else {
        // Plain text, assume uncompleted
        todos.push({
          completed: false,
          text: trimmed
        });
      }
    }
  });
  
  if (todos.length === 0) {
    return <div className={className}>{content}</div>;
  }
  
  return (
    <div className={cn("space-y-1", className)}>
      <div className="font-semibold text-purple-600 dark:text-purple-400 mb-2">TODO List:</div>
      {todos.map((todo, index) => (
        <div key={index} className="flex items-start gap-2">
          {todo.completed ? (
            <CheckSquare className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <Square className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          )}
          <span className={cn(
            "text-sm",
            todo.completed && "line-through text-gray-500"
          )}>
            {todo.text}
          </span>
        </div>
      ))}
    </div>
  );
}