import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { gitApi } from "@/lib/api";
import { GitStatus } from "@/types";
import { 
  FileText, 
  FolderOpen, 
  GitBranch, 
  Plus, 
  Minus, 
  Edit,
  ChevronRight,
  ChevronDown 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeDiffProps {
  projectPath: string;
  taskId: string;
  worktreePath?: string;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  status?: "added" | "modified" | "deleted";
  children?: FileNode[];
}

export function FileTreeDiff({ projectPath, taskId, worktreePath }: FileTreeDiffProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Reset state when task or worktree changes
    setSelectedFile(null);
    setDiff("");
    setFileTree([]);
    setExpandedFolders(new Set());
    loadGitStatus();
  }, [projectPath, taskId, worktreePath]);

  const loadGitStatus = async () => {
    // Only load if we have a worktree path
    if (!worktreePath) {
      setFileTree([]);
      return;
    }
    
    try {
      const status = await gitApi.getStatus(worktreePath);
      buildFileTree(status);
    } catch (error) {
      console.error("Failed to load git status:", error);
      // Clear the tree on error
      setFileTree([]);
    }
  };

  const buildFileTree = (status: GitStatus) => {
    const allFiles = [
      ...status.added.map(f => ({ path: f, status: "added" as const })),
      ...status.modified.map(f => ({ path: f, status: "modified" as const })),
      ...status.deleted.map(f => ({ path: f, status: "deleted" as const })),
    ];

    const root: FileNode[] = [];
    const folders = new Map<string, FileNode>();

    allFiles.forEach(({ path, status }) => {
      const parts = path.split("/");
      let currentLevel = root;
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (index === parts.length - 1) {
          // It's a file
          currentLevel.push({
            name: part,
            path: currentPath,
            type: "file",
            status,
          });
        } else {
          // It's a folder
          let folder = folders.get(currentPath);
          if (!folder) {
            folder = {
              name: part,
              path: currentPath,
              type: "folder",
              children: [],
            };
            folders.set(currentPath, folder);
            currentLevel.push(folder);
          }
          currentLevel = folder.children!;
        }
      });
    });

    setFileTree(root);
  };

  const loadDiff = async (filePath: string) => {
    // Only load if we have a worktree path
    if (!worktreePath) {
      setDiff("");
      return;
    }
    
    try {
      const diffContent = await gitApi.getDiff(worktreePath, false);
      // Filter diff for specific file
      const fileDiff = extractFileDiff(diffContent, filePath);
      setDiff(fileDiff);
    } catch (error) {
      console.error("Failed to load diff:", error);
      setDiff("");
    }
  };

  const extractFileDiff = (fullDiff: string, filePath: string): string => {
    const lines = fullDiff.split("\n");
    const fileHeader = `diff --git a/${filePath} b/${filePath}`;
    const startIndex = lines.findIndex(line => line.includes(fileHeader));
    
    if (startIndex === -1) return "No changes found";
    
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith("diff --git")) {
        endIndex = i;
        break;
      }
    }
    
    return lines.slice(startIndex, endIndex).join("\n");
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = (file: FileNode) => {
    if (file.type === "file") {
      setSelectedFile(file.path);
      loadDiff(file.path);
    } else {
      toggleFolder(file.path);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "added":
        return <Plus className="h-3 w-3 text-green-500" />;
      case "modified":
        return <Edit className="h-3 w-3 text-yellow-500" />;
      case "deleted":
        return <Minus className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const renderFileNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;

    return (
      <div key={node.path}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start px-2 h-8",
            isSelected && "bg-accent",
            "hover:bg-accent/50"
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFileClick(node)}
        >
          {node.type === "folder" ? (
            <>
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 mr-1" />
              ) : (
                <ChevronRight className="h-3 w-3 mr-1" />
              )}
              <FolderOpen className="h-3 w-3 mr-2" />
            </>
          ) : (
            <>
              <FileText className="h-3 w-3 mr-2 ml-4" />
              {getStatusIcon(node.status)}
            </>
          )}
          <span className="text-sm truncate">{node.name}</span>
        </Button>
        {node.type === "folder" && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* File Tree */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-3 border-b">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            文件变更
          </h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {!worktreePath ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>任务尚未开始执行</p>
                <p className="text-xs mt-1">执行任务后将显示文件变更</p>
              </div>
            ) : fileTree.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                暂无文件变更
              </div>
            ) : (
              fileTree.map(node => renderFileNode(node))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Diff Viewer */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="p-3 border-b">
              <h3 className="font-medium text-sm">{selectedFile}</h3>
            </div>
            <ScrollArea className="flex-1">
              <pre className="p-4 text-sm font-mono">
                {diff.split("\n").map((line, index) => (
                  <div
                    key={index}
                    className={cn(
                      "px-2",
                      line.startsWith("+") && !line.startsWith("+++") && "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
                      line.startsWith("-") && !line.startsWith("---") && "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
                      line.startsWith("@@") && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    )}
                  >
                    {line}
                  </div>
                ))}
              </pre>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            选择一个文件查看变更
          </div>
        )}
      </div>
    </div>
  );
}