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

interface GitStatusMap {
  [path: string]: "added" | "modified" | "deleted";
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
  const [changedFilesTree, setChangedFilesTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showChangedOnly, setShowChangedOnly] = useState(true);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [allFilesLoaded, setAllFilesLoaded] = useState(false);
  const [gitStatusMap, setGitStatusMap] = useState<GitStatusMap>({});

  useEffect(() => {
    // Reset state when task or worktree changes
    setSelectedFile(null);
    setFileTree([]);
    setChangedFilesOnly([]);
    setChangedFilesTree([]);
    setExpandedFolders(new Set());
    setOpenFiles([]);
    setActiveTab("");
    setAllFilesLoaded(false);
    setGitStatusMap({});
    loadGitStatus();
  }, [projectPath, taskId, worktreePath]);

  const loadGitStatus = async () => {
    // Only load if we have a worktree path
    if (!worktreePath) {
      setFileTree([]);
      setChangedFilesOnly([]);
      setChangedFilesTree([]);
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
      setChangedFilesTree([]);
    }
  };

  const loadAllFiles = async () => {
    if (!worktreePath || allFilesLoaded) return;
    
    try {
      const fileList = await gitApi.listAllFiles(worktreePath);
      
      // Build file tree from flat list of file paths
      const root: FileNode[] = [];
      const folders = new Map<string, FileNode>();
      
      fileList.forEach((filePath: string) => {
        const parts = filePath.split("/");
        let currentLevel = root;
        let currentPath = "";
        
        parts.forEach((part: string, index: number) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          
          if (index === parts.length - 1) {
            // It's a file
            currentLevel.push({
              name: part,
              path: `${worktreePath}/${currentPath}`,
              type: "file",
              status: gitStatusMap[currentPath],
            });
          } else {
            // It's a folder
            let folder = folders.get(currentPath);
            if (!folder) {
              folder = {
                name: part,
                path: `${worktreePath}/${currentPath}`,
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
      
      // Sort function: folders first, then files, both alphabetically
      const sortNodes = (nodes: FileNode[]): FileNode[] => {
        return nodes.sort((a, b) => {
          // If different types, folders come first
          if (a.type !== b.type) {
            return a.type === "folder" ? -1 : 1;
          }
          // If same type, sort alphabetically by name
          return a.name.localeCompare(b.name);
        });
      };
      
      // Recursively sort all levels
      const sortTree = (nodes: FileNode[]): FileNode[] => {
        const sorted = sortNodes(nodes);
        sorted.forEach(node => {
          if (node.type === "folder" && node.children) {
            node.children = sortTree(node.children);
          }
        });
        return sorted;
      };
      
      const sortedTree = sortTree(root);
      setFileTree(sortedTree);
      setAllFilesLoaded(true);
    } catch (error) {
      console.error("Failed to load all files:", error);
    }
  };

  const buildFileTree = (status: GitStatus) => {
    const allFiles = [
      ...status.added.map(f => ({ path: f, status: "added" as const })),
      ...status.modified.map(f => ({ path: f, status: "modified" as const })),
      ...status.deleted.map(f => ({ path: f, status: "deleted" as const })),
    ];

    // Build status map for quick lookup
    const statusMap: GitStatusMap = {};
    status.added.forEach(f => statusMap[f] = "added");
    status.modified.forEach(f => statusMap[f] = "modified");
    status.deleted.forEach(f => statusMap[f] = "deleted");
    setGitStatusMap(statusMap);

    // Build changed files only list
    const changedFiles: FileNode[] = allFiles.map(({ path, status }) => ({
      name: path.split("/").pop() || path,
      path: worktreePath ? `${worktreePath}/${path}` : path,  // Use full path
      type: "file" as const,
      status,
    }));
    setChangedFilesOnly(changedFiles);

    // Build changed files tree structure
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
            path: worktreePath ? `${worktreePath}/${currentPath}` : currentPath,  // Use full path
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

    // Sort function: folders first, then files, both alphabetically
    const sortNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.sort((a, b) => {
        // If different types, folders come first
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        // If same type, sort alphabetically by name
        return a.name.localeCompare(b.name);
      });
    };
    
    // Recursively sort all levels
    const sortTree = (nodes: FileNode[]): FileNode[] => {
      const sorted = sortNodes(nodes);
      sorted.forEach(node => {
        if (node.type === "folder" && node.children) {
          node.children = sortTree(node.children);
        }
      });
      return sorted;
    };
    
    const sortedTree = sortTree(root);
    setChangedFilesTree(sortedTree);
  };

  const loadDiff = async (filePath: string) => {
    // Only load if we have a worktree path
    if (!worktreePath) {
      return;
    }
    
    try {
      // Ensure we have the full path
      const fullPath = filePath.startsWith('/') ? filePath : `${worktreePath}/${filePath}`;
      
      // Get relative path from full path
      const relativePath = fullPath.startsWith(worktreePath + '/') 
        ? fullPath.substring(worktreePath.length + 1)
        : filePath;
      
      const fileName = fullPath.split("/").pop() || fullPath;
      const fileStatus = gitStatusMap[relativePath];
      
      // Check if file is already open
      const existingIndex = openFiles.findIndex(f => f.path === fullPath);
      
      if (fileStatus === 'added') {
        // New file, show only the new content
        const content = await gitApi.readFileContent(worktreePath, relativePath);
        
        if (existingIndex === -1) {
          const newFile: OpenFile = {
            path: fullPath,
            name: fileName,
            oldContent: '',
            newContent: content,
          };
          setOpenFiles([...openFiles, newFile]);
          setActiveTab(fullPath);
        } else {
          setActiveTab(fullPath);
        }
      } else if (fileStatus === 'deleted') {
        // Deleted file, we need to get the content from git
        const diffContent = await gitApi.getDiff(worktreePath, false);
        const { oldContent } = parseGitDiff(diffContent, relativePath);
        
        if (existingIndex === -1) {
          const newFile: OpenFile = {
            path: fullPath,
            name: fileName,
            oldContent: oldContent,
            newContent: '',
          };
          setOpenFiles([...openFiles, newFile]);
          setActiveTab(fullPath);
        } else {
          setActiveTab(fullPath);
        }
      } else if (fileStatus === 'modified') {
        // Modified file, get the current content and compare with git
        const currentContent = await gitApi.readFileContent(worktreePath, relativePath);
        
        // Get the original content from git
        const gitShowResult = await gitApi.getFileFromRef(worktreePath, `HEAD:${relativePath}`);
        
        if (existingIndex === -1) {
          const newFile: OpenFile = {
            path: fullPath,
            name: fileName,
            oldContent: gitShowResult,
            newContent: currentContent,
          };
          setOpenFiles([...openFiles, newFile]);
          setActiveTab(fullPath);
        } else {
          setActiveTab(fullPath);
        }
      } else {
        // File has no changes, just display current content
        const content = await gitApi.readFileContent(worktreePath, relativePath);
        
        if (existingIndex === -1) {
          const newFile: OpenFile = {
            path: fullPath,
            name: fileName,
            oldContent: content,
            newContent: content,
          };
          setOpenFiles([...openFiles, newFile]);
          setActiveTab(fullPath);
        } else {
          setActiveTab(fullPath);
        }
      }
      
      setSelectedFile(fullPath);
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

  // Effect to reload all files when switching to All Files view and status is available
  useEffect(() => {
    if (!showChangedOnly && !allFilesLoaded && worktreePath && Object.keys(gitStatusMap).length > 0) {
      loadAllFiles();
    }
  }, [showChangedOnly, allFilesLoaded, worktreePath, gitStatusMap]);

  return (
    <div className="flex h-full overflow-hidden">
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
              onClick={() => {
                setShowChangedOnly(false);
                loadAllFiles();
              }}
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
              showChangedOnly ? changedFilesTree.map(node => renderFileNode(node)) : fileTree.map(node => renderFileNode(node))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Diff Viewer with Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {openFiles.length > 0 ? (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <div className="border-b flex-shrink-0">
                <TabsList className="h-10 w-full justify-start rounded-none bg-transparent p-0 overflow-x-auto">
                  {openFiles.map(file => (
                    <TabsTrigger
                      key={file.path}
                      value={file.path}
                      className="relative h-10 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:shadow-none px-4 flex-shrink-0 flex items-center"
                    >
                      <span className="text-sm">{file.name}</span>
                      <span
                        className="h-4 w-4 ml-2 hover:bg-accent rounded-sm flex items-center justify-center cursor-pointer"
                        onClick={(e) => closeTab(file.path, e)}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              
              {openFiles.map(file => (
                <TabsContent
                  key={file.path}
                  value={file.path}
                  className="flex-1 overflow-hidden mt-0 border-0 p-0 outline-none"
                >
                  <div className="h-full overflow-auto p-2">
                    <ReactDiffViewer
                        oldValue={file.oldContent}
                        newValue={file.newContent}
                        splitView={false}
                        useDarkTheme={document.documentElement.classList.contains('dark')}
                        hideLineNumbers={false}
                        showDiffOnly={false}
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
                              codeFoldBackground: '#1a1a1a',
                              codeFoldGutterBackground: '#2a2a2a',
                              codeFoldContentColor: '#808080',
                            },
                            light: {
                              diffViewerBackground: '#ffffff',
                              addedBackground: '#e6ffec',
                              removedBackground: '#ffebe9',
                              wordAddedBackground: '#abf2bc',
                              wordRemovedBackground: '#ffb6ba',
                              addedColor: '#24292f',
                              removedColor: '#24292f',
                              codeFoldBackground: '#f6f8fa',
                              codeFoldGutterBackground: '#e1e4e8',
                              codeFoldContentColor: '#586069',
                            }
                          },
                          contentText: {
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                            fontSize: '13px',
                            lineHeight: '20px',
                          },
                          gutter: {
                            minWidth: '50px',
                          }
                        }}
                      />
                  </div>
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