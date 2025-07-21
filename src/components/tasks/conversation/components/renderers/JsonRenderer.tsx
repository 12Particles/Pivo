interface JsonRendererProps {
  content: string;
}

export function JsonRenderer({ content }: JsonRendererProps) {
  try {
    const jsonData = JSON.parse(content);
    return (
      <div className="overflow-x-auto">
        <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded whitespace-pre inline-block min-w-0">
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      </div>
    );
  } catch {
    return null;
  }
}