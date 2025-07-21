import { CheckSquare, Square } from "lucide-react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { TodoList } from "@/components/ui/todo-list";
import { cn } from "@/lib/utils";

interface TodoItem {
  id?: string;
  content: string;
  status: string;
  priority?: string;
}

interface MessageToolOutputProps {
  content: string;
}

export function MessageToolOutput({ content }: MessageToolOutputProps) {
  // Check if it's a TodoWrite tool output
  if (content.includes("[Using tool: TodoWrite]") || (content.includes("todos") && content.includes('"status"') && content.includes('"priority"'))) {
    try {
      let todosArray: TodoItem[] | null = null;
      
      const inputMatch = content.match(/Input:\s*({[\s\S]*})/m);
      if (inputMatch) {
        const inputData = JSON.parse(inputMatch[1]);
        if (inputData.todos && Array.isArray(inputData.todos)) {
          todosArray = inputData.todos;
        }
      }
      
      if (!todosArray) {
        const jsonData = JSON.parse(content);
        if (jsonData.todos && Array.isArray(jsonData.todos)) {
          todosArray = jsonData.todos;
        } else if (Array.isArray(jsonData)) {
          todosArray = jsonData;
        }
      }
      
      if (todosArray && todosArray.length > 0) {
        return <TodoListDisplay todos={todosArray} />;
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
  
  // Check if it's an Edit tool diff
  if (content.includes("[Using tool: Edit]") && content.includes("old_string") && content.includes("new_string")) {
    try {
      const inputMatch = content.match(/Input:\s*({[\s\S]*})/m);
      if (inputMatch) {
        const inputData = JSON.parse(inputMatch[1]);
        return (
          <EditDiffViewer 
            filePath={inputData.file_path || ""}
            oldString={inputData.old_string || ""}
            newString={inputData.new_string || ""}
          />
        );
      }
    } catch {}
  }
  
  // Check if it's a git diff
  if (content.includes("diff --git") || (content.includes("+++") && content.includes("---"))) {
    return <GitDiffViewer content={content} />;
  }
  
  // Check for TODO lists
  if (content.includes("TODO") && (content.includes("[x]") || content.includes("[ ]") || content.includes("✅") || content.includes("☐"))) {
    return <TodoList content={content} />;
  }
  
  // Check for code blocks
  if (content.includes("```")) {
    return <CodeBlockRenderer content={content} />;
  }
  
  // Default rendering
  return (
    <div className="whitespace-pre-wrap break-words">
      {content}
    </div>
  );
}

function TodoListDisplay({ todos }: { todos: TodoItem[] }) {
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

function EditDiffViewer({ filePath, oldString, newString }: { filePath: string; oldString: string; newString: string }) {
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

function GitDiffViewer({ content }: { content: string }) {
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

function CodeBlockRenderer({ content }: { content: string }) {
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