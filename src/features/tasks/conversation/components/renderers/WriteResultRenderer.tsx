import { CheckCircle2 } from "lucide-react";
import { getDisplayPath } from "../../utils/pathUtils";
import { useApp } from "@/contexts/AppContext";

interface WriteResultRendererProps {
  content: string;
}

export function WriteResultRenderer({ content }: WriteResultRendererProps) {
  const { currentProject } = useApp();
  
  // Parse the write result message
  // Expected format: "The file /path/to/file has been updated. Here's the result of running `cat -n` on a snippet of the edited file:"
  const filePathMatch = content.match(/The file\s+(.+?)\s+has been (updated|created)/);
  const filePath = filePathMatch ? filePathMatch[1] : null;
  
  // Extract the code snippet
  const snippetStart = content.indexOf("edited file:");
  const snippet = snippetStart > -1 ? content.substring(snippetStart + 12).trim() : "";
  
  if (!filePath) {
    // Fallback to default rendering if pattern doesn't match
    return <div className="whitespace-pre-wrap">{content}</div>;
  }
  
  const displayPath = getDisplayPath(filePath, currentProject?.path);
  const isCreated = content.includes("has been created");
  
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm">
            File {isCreated ? 'created' : 'updated'} successfully:
          </div>
          <code className="text-xs bg-muted px-1 py-0.5 rounded block mt-1">
            {displayPath}
          </code>
        </div>
      </div>
      
      {snippet && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Preview of changes:
          </div>
          <pre className="bg-gray-900 text-gray-100 px-3 py-2 rounded text-xs overflow-x-auto">
            <code>{snippet}</code>
          </pre>
        </div>
      )}
    </div>
  );
}