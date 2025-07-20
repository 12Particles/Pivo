import { cn } from "@/lib/utils";

interface DiffViewerProps {
  content: string;
  className?: string;
}

export function DiffViewer({ content, className }: DiffViewerProps) {
  const lines = content.split('\n');
  let inHeader = true;
  
  return (
    <div className={cn("font-mono text-xs bg-gray-900 rounded-md overflow-hidden", className)}>
      {lines.map((line, index) => {
        // Check if we're past the header (after the @@ line)
        if (line.startsWith("@@")) {
          inHeader = false;
        }
        
        let lineClass = "px-4 py-0.5";
        let lineContent = line;
        
        if (line.startsWith("diff --git")) {
          lineClass += " bg-gray-800 text-yellow-400 font-semibold py-1 border-b border-gray-700";
        } else if (line.startsWith("+++") || line.startsWith("---")) {
          lineClass += " bg-gray-800 text-gray-400";
        } else if (line.startsWith("@@")) {
          lineClass += " bg-blue-900/30 text-blue-400 py-1 mt-1";
        } else if (!inHeader) {
          // Parse line numbers for actual diff content
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineClass += " bg-green-900/30 text-green-400";
            lineContent = line.substring(1);
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineClass += " bg-red-900/30 text-red-400";
            lineContent = line.substring(1);
          } else {
            lineClass += " text-gray-300";
            // Remove the leading space if present
            if (line.startsWith(" ")) {
              lineContent = line.substring(1);
            }
          }
        } else {
          lineClass += " text-gray-500";
        }
        
        return (
          <div key={index} className={lineClass}>
            <span>{lineContent || '\u00A0'}</span>
          </div>
        );
      })}
    </div>
  );
}