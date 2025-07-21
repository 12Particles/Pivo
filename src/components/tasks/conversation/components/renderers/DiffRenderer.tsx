import ReactDiffViewer from "react-diff-viewer-continued";

interface DiffRendererProps {
  oldValue: string;
  newValue: string;
  title?: string;
}

export function DiffRenderer({ oldValue, newValue, title }: DiffRendererProps) {
  return (
    <div className="space-y-2">
      {title && (
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </div>
      )}
      <div className="rounded-md border border-gray-200 dark:border-gray-700" style={{ width: '100%' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <ReactDiffViewer
            oldValue={oldValue}
            newValue={newValue}
            splitView={false}
            useDarkTheme={true}
            hideLineNumbers={false}
            styles={{
              variables: {
                dark: {
                  diffViewerBackground: '#1f2937',
                  addedBackground: '#065f46',
                  removedBackground: '#991b1b',
                  wordAddedBackground: '#10b981',
                  wordRemovedBackground: '#ef4444',
                  addedColor: '#d1fae5',
                  removedColor: '#fee2e2',
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}