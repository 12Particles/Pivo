import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ChevronDown,
  TreePine,
  GitCompare,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import ReactDiffViewer from "react-diff-viewer-continued";
import { parseGitDiff } from "@/lib/git-diff-parser";

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

interface OpenFile {
  path: string;
  name: string;
  oldContent: string;
  newContent: string;
}

export function FileTreeDiff({ projectPath, taskId, worktreePath }: FileTreeDiffProps) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [changedFilesOnly, setChangedFilesOnly] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showChangedOnly, setShowChangedOnly] = useState(true);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    // Reset state when task or worktree changes
    setSelectedFile(null);
    setFileTree([]);
    setChangedFilesOnly([]);
    setExpandedFolders(new Set());
    setOpenFiles([]);
    setActiveTab("");
    loadGitStatus();
  }, [projectPath, taskId, worktreePath]);

  const loadGitStatus = async () => {
    // Only load if we have a worktree path
    if (!worktreePath) {
      setFileTree([]);
      setChangedFilesOnly([]);
      return;
    }
    
    try {
      const status = await gitApi.getStatus(worktreePath);
      buildFileTree(status);
    } catch (error) {
      console.error("Failed to load git status:", error);
      // Clear the tree on error
      setFileTree([]);
      setChangedFilesOnly([]);
    }
  };

  const buildFileTree = (status: GitStatus) => {
    const allFiles = [
      ...status.added.map(f => ({ path: f, status: "added" as const })),
      ...status.modified.map(f => ({ path: f, status: "modified" as const })),
      ...status.deleted.map(f => ({ path: f, status: "deleted" as const })),
    ];

    // Build changed files only list
    const changedFiles: FileNode[] = allFiles.map(({ path, status }) => ({
      name: path.split("/").pop() || path,
      path,
      type: "file" as const,
      status,
    }));
    setChangedFilesOnly(changedFiles);

    // Build full tree structure
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
      return;
    }
    
    try {
      const diffContent = await gitApi.getDiff(worktreePath, false);
      // Use the improved parser
      const { oldContent, newContent } = parseGitDiff(diffContent, filePath);
      
      // Check if file is already open
      const existingIndex = openFiles.findIndex(f => f.path === filePath);
      const fileName = filePath.split("/").pop() || filePath;
      
      if (existingIndex === -1) {
        // Add new file tab
        const newFile: OpenFile = {
          path: filePath,
          name: fileName,
          oldContent,
          newContent,
        };
        setOpenFiles([...openFiles, newFile]);
        setActiveTab(filePath);
      } else {
        // Just switch to existing tab
        setActiveTab(filePath);
      }
      
      setSelectedFile(filePath);
    } catch (error) {
      console.error("Failed to load diff:", error);
    }
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
      loadDiff(file.path);
    } else {
      toggleFolder(file.path);
    }
  };

  const closeTab = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newOpenFiles = openFiles.filter(f => f.path !== filePath);
    setOpenFiles(newOpenFiles);
    
    if (activeTab === filePath && newOpenFiles.length > 0) {
      setActiveTab(newOpenFiles[newOpenFiles.length - 1].path);
    } else if (newOpenFiles.length === 0) {
      setActiveTab("");
      setSelectedFile(null);
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

  const renderChangedFilesList = () => {
    return changedFilesOnly.map(file => {
      const isSelected = selectedFile === file.path;
      return (
        <Button
          key={file.path}
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start px-2 h-8",
            isSelected && "bg-accent",
            "hover:bg-accent/50"
          )}
          onClick={() => handleFileClick(file)}
        >
          <FileText className="h-3 w-3 mr-2" />
          {getStatusIcon(file.status)}
          <span className="text-sm truncate flex-1 text-left">{file.path}</span>
        </Button>
      );
    });
  };

  return (
    <div className="flex h-full">
      {/* File Tree */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t('git.fileChanges')}
          </h3>
          <div className="flex gap-1">
            <Button
              variant={showChangedOnly ? "default" : "ghost"}
              size="sm"
              className="flex-1 h-7"
              onClick={() => setShowChangedOnly(true)}
            >
              <GitCompare className="h-3 w-3 mr-1" />
              {t('git.changedFiles')}
            </Button>
            <Button
              variant={!showChangedOnly ? "default" : "ghost"}
              size="sm"
              className="flex-1 h-7"
              onClick={() => setShowChangedOnly(false)}
            >
              <TreePine className="h-3 w-3 mr-1" />
              {t('git.allFiles')}
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {!worktreePath ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>{t('git.taskNotStarted')}</p>
                <p className="text-xs mt-1">{t('git.executeToShowChanges')}</p>
              </div>
            ) : fileTree.length === 0 && changedFilesOnly.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                {t('git.noFileChanges')}
              </div>
            ) : (
              showChangedOnly ? renderChangedFilesList() : fileTree.map(node => renderFileNode(node))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Diff Viewer with Tabs */}
      <div className="flex-1 flex flex-col">
        {openFiles.length > 0 ? (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="border-b">
                <TabsList className="h-10 w-full justify-start rounded-none bg-transparent p-0">
                  {openFiles.map(file => (
                    <TabsTrigger
                      key={file.path}
                      value={file.path}
                      className="relative h-10 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:shadow-none px-4"
                    >
                      <span className="text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-2 hover:bg-accent"
                        onClick={(e) => closeTab(file.path, e)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              
              {openFiles.map(file => (
                <TabsContent
                  key={file.path}
                  value={file.path}
                  className="flex-1 mt-0 border-0 p-0 outline-none"
                >
                  <ScrollArea className="h-full">
                    <div className="p-2">
                      <ReactDiffViewer
                        oldValue={file.oldContent}
                        newValue={file.newContent}
                        splitView={true}
                        useDarkTheme={document.documentElement.classList.contains('dark')}
                        hideLineNumbers={false}
                        styles={{
                          variables: {
                            dark: {
                              diffViewerBackground: '#0a0a0a',
                              addedBackground: '#0d2e1a',
                              removedBackground: '#3d0f0f',
                              wordAddedBackground: '#1a5232',
                              wordRemovedBackground: '#6b1818',
                              addedColor: '#87d96c',
                              removedColor: '#ff9999',
                            },
                            light: {
                              diffViewerBackground: '#ffffff',
                              addedBackground: '#e6ffec',
                              removedBackground: '#ffebe9',
                              wordAddedBackground: '#abf2bc',
                              wordRemovedBackground: '#ffb6ba',
                              addedColor: '#24292f',
                              removedColor: '#24292f',
                            }
                          }
                        }}
                      />
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {t('git.selectFileToView')}
          </div>
        )}
      </div>
    </div>
  );
}