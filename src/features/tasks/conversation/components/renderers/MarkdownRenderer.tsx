import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlockRenderer } from './CodeBlockRenderer';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Custom code block rendering
        code({ node, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const inline = !match;
          
          if (inline) {
            return (
              <code className="px-1 py-0.5 rounded bg-muted text-muted-foreground text-sm" {...props}>
                {children}
              </code>
            );
          }
          
          // For multi-line code blocks, use our existing CodeBlockRenderer
          const language = match?.[1] || '';
          const codeContent = String(children).replace(/\n$/, '');
          return <CodeBlockRenderer content={`\`\`\`${language}\n${codeContent}\n\`\`\``} />;
        },
        // Custom link rendering to open in new tab
        a({ node, children, ...props }) {
          return (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              {children}
            </a>
          );
        },
        // Custom heading styles
        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-current">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-current">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold mt-2 mb-1 text-current">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-bold mt-2 mb-1 text-current">{children}</h4>,
        // Custom list styles
        ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-current">{children}</li>,
        // Custom paragraph style
        p: ({ children }) => <p className="my-2 text-current">{children}</p>,
        // Custom blockquote style
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-2 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        // Custom table styles
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-sm text-current">{children}</td>
        ),
        // Custom horizontal rule
        hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
        // Custom emphasis
        em: ({ children }) => <em className="italic">{children}</em>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}