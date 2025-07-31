import { cn } from "@/lib/utils";

interface DiffViewerProps {
  content: string;
  className?: string;
}

export function DiffViewer({ content, className }: DiffViewerProps) {
  const lines = content.split('\n');
  let inHeader = true;
  
  return (
    <div className={cn("font-mono text-xs bg-zinc-900 dark:bg-zinc-950 rounded-md overflow-hidden", className)}>
      {lines.map((line, index) => {
        // Check if we're past the header (after the @@ line)
        if (line.startsWith("@@")) {
          inHeader = false;
        }
        
        let lineClass = "px-4 py-0.5";
        let lineContent = line;
        
        if (line.startsWith("diff --git")) {
          lineClass += " bg-zinc-800 dark:bg-zinc-900 text-yellow-500 dark:text-yellow-400 font-semibold py-1 border-b border-zinc-700 dark:border-zinc-800";
        } else if (line.startsWith("+++") || line.startsWith("---")) {
          lineClass += " bg-zinc-800 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400";
        } else if (line.startsWith("@@")) {
          lineClass += " bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 py-1 mt-1";
        } else if (!inHeader) {
          // Parse line numbers for actual diff content
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineClass += " bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400";
            lineContent = line.substring(1);
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineClass += " bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400";
            lineContent = line.substring(1);
          } else {
            lineClass += " text-zinc-700 dark:text-zinc-300";
            // Remove the leading space if present
            if (line.startsWith(" ")) {
              lineContent = line.substring(1);
            }
          }
        } else {
          lineClass += " text-zinc-500 dark:text-zinc-500";
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