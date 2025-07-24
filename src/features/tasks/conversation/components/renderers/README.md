# Content Renderers

This directory contains specialized renderers for different content types in the conversation view.

## Architecture

### ContentRenderer
The main content renderer that detects content type and delegates to specific renderers:
- File trees
- JSON data
- Git diffs
- TODO lists
- Code blocks
- Plain text (fallback)

### Specific Renderers
- **TodoListRenderer**: Renders todo items with checkboxes and priority
- **DiffRenderer**: Shows side-by-side diffs using react-diff-viewer
- **CodeBlockRenderer**: Formats code blocks with syntax highlighting
- **JsonRenderer**: Pretty-prints JSON data
- **FileTreeRenderer**: Displays file/directory structures

## Usage

Most message components use `ContentRenderer` for general content:
```tsx
<ContentRenderer content={message.content} />
```

Some message types use specific renderers directly:
- `ToolUseMessage` uses `DiffRenderer` for Edit tool
- `ToolResultMessage` uses `TodoListRenderer` for TodoWrite tool