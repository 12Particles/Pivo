interface JsonRendererProps {
  content: string;
}

export function JsonRenderer({ content }: JsonRendererProps) {
  try {
    const jsonData = JSON.parse(content);
    return (
      <div className="overflow-x-auto">
        <pre className="font-mono text-xs bg-muted text-muted-foreground p-3 rounded whitespace-pre inline-block min-w-0">
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      </div>
    );
  } catch {
    return null;
  }
}