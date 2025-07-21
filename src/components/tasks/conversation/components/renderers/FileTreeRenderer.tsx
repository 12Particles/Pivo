interface FileTreeRendererProps {
  content: string;
}

export function FileTreeRenderer({ content }: FileTreeRendererProps) {
  if (content.includes("├──") || content.includes("└──") || content.includes("│")) {
    return (
      <div className="overflow-x-auto">
        <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded whitespace-pre inline-block min-w-0">
          {content}
        </pre>
      </div>
    );
  }
  return null;
}