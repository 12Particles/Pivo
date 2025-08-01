import { CheckCircle2, AlertCircle } from "lucide-react";
import { getDisplayPath } from "../../utils/pathUtils";
import { useApp } from "@/contexts/AppContext";
import { CustomDiffRenderer } from "./CustomDiffRenderer";

interface EditResultRendererProps {
  content: string;
}

interface ParsedLine {
  lineNumber: number;
  content: string;
}

function parseLineNumberedContent(content: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const linePattern = /^\s*(\d+)→(.*)$/gm;
  
  let match;
  while ((match = linePattern.exec(content)) !== null) {
    lines.push({
      lineNumber: parseInt(match[1]),
      content: match[2]
    });
  }
  
  return lines;
}

export function EditResultRenderer({ content }: EditResultRendererProps) {
  const { currentProject } = useApp();
  
  // Parse the edit result message
  const filePathMatch = content.match(/The file\s+(.+?)\s+has been updated/);
  const filePath = filePathMatch ? filePathMatch[1] : null;
  
  // Check for error messages
  const isError = content.includes("Error:") || content.includes("Failed to edit");
  
  // Extract the code snippet section
  const snippetStart = content.indexOf("edited file:");
  const snippetEnd = content.lastIndexOf("\n\nThe lines containing");
  const rawSnippet = snippetStart > -1 
    ? content.substring(snippetStart + 12, snippetEnd > snippetStart ? snippetEnd : undefined).trim() 
    : "";
  
  // Parse the line-numbered content
  const parsedLines = parseLineNumberedContent(rawSnippet);
  
  // Check if this is a bulk replacement
  const replacementMatch = content.match(/Replaced\s+(\d+)\s+occurrences?/);
  const replacementCount = replacementMatch ? parseInt(replacementMatch[1]) : null;
  
  // Extract what was replaced (if available)
  const replacedMatch = content.match(/The lines containing\s+"([^"]+)"\s+were replaced with\s+"([^"]+)"/);
  const oldString = replacedMatch ? replacedMatch[1] : null;
  const newString = replacedMatch ? replacedMatch[2] : null;
  
  if (isError) {
    return (
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-sm whitespace-pre-wrap text-red-600">
          {content}
        </div>
      </div>
    );
  }
  
  if (!filePath) {
    // Fallback to default rendering if pattern doesn't match
    return <div className="whitespace-pre-wrap text-sm text-current">{content}</div>;
  }
  
  const displayPath = getDisplayPath(filePath, currentProject?.path);
  
  // If we have the old and new strings, show a diff
  const showDiff = oldString && newString && parsedLines.length > 0;
  
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm text-current">
            File updated successfully:
          </div>
          <code className="text-xs bg-muted text-muted-foreground px-1 py-0.5 rounded block mt-1">
            {displayPath}
          </code>
          {replacementCount !== null && (
            <div className="text-xs text-muted-foreground mt-1">
              {replacementCount} {replacementCount === 1 ? 'occurrence' : 'occurrences'} replaced
            </div>
          )}
        </div>
      </div>
      
      {showDiff && (
        <CustomDiffRenderer 
          title="Changes applied"
          oldValue={oldString}
          newValue={newString}
        />
      )}
      
      {parsedLines.length > 0 && !showDiff && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Preview of edited section:
          </div>
          <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {parsedLines.map((line, index) => (
                  <div
                    key={index}
                    className="font-mono text-xs whitespace-pre flex w-full"
                    style={{ minWidth: 'max-content' }}
                  >
                    <div className="flex-shrink-0 w-10 px-1.5 text-xs border-r select-none min-h-[1.25rem] flex items-center justify-end text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <span className="inline-block text-right text-xs">
                        {line.lineNumber}
                      </span>
                    </div>
                    <div className="flex-1 px-2 min-h-[1.25rem] flex items-center bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-xs text-gray-800 dark:text-gray-200">{line.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}