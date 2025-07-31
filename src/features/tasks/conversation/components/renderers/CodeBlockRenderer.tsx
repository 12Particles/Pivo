interface CodeBlockRendererProps {
  content: string;
}

export function CodeBlockRenderer({ content }: CodeBlockRendererProps) {
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
              <pre className="font-mono text-xs bg-muted text-muted-foreground p-3 rounded whitespace-pre inline-block min-w-0">
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