import { TodoList } from "@/components/ui/todo-list";
import { FileTreeRenderer } from "./FileTreeRenderer";
import { JsonRenderer } from "./JsonRenderer";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import { DiffRenderer } from "./DiffRenderer";

interface ContentRendererProps {
  content: string;
}

export function ContentRenderer({ content }: ContentRendererProps) {
  // Check if it's a file listing
  const fileTreeResult = FileTreeRenderer({ content });
  if (fileTreeResult) return fileTreeResult;
  
  // Check if it's JSON
  const jsonResult = JsonRenderer({ content });
  if (jsonResult) return jsonResult;
  
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
    <div className="whitespace-pre-wrap break-words overflow-x-auto">
      {content}
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
  
  return <DiffRenderer oldValue={oldContent.join('\n')} newValue={newContent.join('\n')} />;
}