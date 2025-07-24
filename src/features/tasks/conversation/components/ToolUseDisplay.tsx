import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { useState } from "react";

interface ToolUseDisplayProps {
  toolName: string;
  toolInput: any;
  toolUseId?: string;
}

export function ToolUseDisplay({ toolName, toolInput, toolUseId }: ToolUseDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format tool input based on tool name
  const formatToolInput = () => {
    if (!toolInput) return null;

    // Special formatting for common tools
    switch (toolName) {
      case "Read":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">File:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">{toolInput.file_path}</code>
            </div>
            {toolInput.limit && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Lines:</span>
                <span className="text-sm">{toolInput.offset || 1} - {(toolInput.offset || 1) + toolInput.limit}</span>
              </div>
            )}
          </div>
        );

      case "Edit":
      case "MultiEdit":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">File:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">{toolInput.file_path}</code>
            </div>
            {toolInput.edits && (
              <div className="text-sm text-muted-foreground">
                {toolInput.edits.length} edit{toolInput.edits.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        );

      case "Bash":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Command:</span>
            </div>
            <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
              <code>{toolInput.command}</code>
            </pre>
            {toolInput.description && (
              <div className="text-sm text-muted-foreground italic">{toolInput.description}</div>
            )}
          </div>
        );

      case "Grep":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Pattern:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">{toolInput.pattern}</code>
            </div>
            {toolInput.path && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Path:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">{toolInput.path}</code>
              </div>
            )}
            {toolInput.glob && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">File filter:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">{toolInput.glob}</code>
              </div>
            )}
          </div>
        );

      case "TodoWrite":
        return (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Tasks:</div>
            {toolInput.todos && toolInput.todos.map((todo: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <Badge variant={todo.status === 'completed' ? 'default' : 'secondary'}>
                  {todo.status}
                </Badge>
                <span>{todo.content}</span>
              </div>
            ))}
          </div>
        );

      default:
        // Default JSON display
        return (
          <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
            <code>{JSON.stringify(toolInput, null, 2)}</code>
          </pre>
        );
    }
  };

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Using: {toolName}</CardTitle>
            {toolUseId && (
              <span className="text-xs text-muted-foreground">#{toolUseId.slice(0, 8)}</span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          {formatToolInput()}
        </CardContent>
      )}
    </Card>
  );
}