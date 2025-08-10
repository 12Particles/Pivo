import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gitApi } from "@/services/api";
import { GitStatus } from "@/types";
import { CodeComment } from "@/types/comment";
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
  X,
  PanelRightOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { EnhancedDiffViewer } from "./EnhancedDiffViewer";
import { CommentPanel } from "./CommentPanel";
import { parseGitDiff } from "@/lib/git-diff-parser";
import { eventBus } from '@/lib/events/EventBus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFileContextMenu } from "@/hooks/use-file-context-menu";
// Simple unique ID generator
const generateId = () => `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface FileTreeDiffProps {
  projectPath: string;
  taskId: string;
  worktreePath?: string;
  refreshKey?: number;
  changedFilePath?: string | null;
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

export function FileTreeDiff({ projectPath, taskId, worktreePath, refreshKey = 0, changedFilePath }: FileTreeDiffProps) {
  const { t } = useTranslation();
  const { renderContextMenuItems } = useFileContextMenu();
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
  
  // Comment-related state
  const [comments, setComments] = useState<CodeComment[]>([]);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectedLineInfo, setSelectedLineInfo] = useState<{ lineNumber?: number; side?: 'old' | 'new' } | null>(null);

  // Load comments from localStorage when component mounts
  useEffect(() => {
    if (taskId) {
      const storageKey = `task-comments-${taskId}`;
      const savedComments = localStorage.getItem(storageKey);
      if (savedComments) {
        try {
          const parsed = JSON.parse(savedComments);
          // Convert timestamp strings back to Date objects
          const commentsWithDates = parsed.map((c: any) => ({
            ...c,
            timestamp: new Date(c.timestamp)
          }));
          setComments(commentsWithDates);
        } catch (error) {
          console.error("Failed to load saved comments:", error);
        }
      }
    }
  }, [taskId]);

  // Save comments to localStorage whenever they change
  useEffect(() => {
    if (taskId && comments.length > 0) {
      const storageKey = `task-comments-${taskId}`;
      localStorage.setItem(storageKey, JSON.stringify(comments));
    }
  }, [taskId, comments]);

  useEffect(() => {
    // Reset state when task or worktree changes
    setSelectedFile(null);
    setFileTree([]);
    setChangedFilesOnly([]);
    setChangedFilesTree([]);
    // Don't reset expandedFolders here, it will be set by buildFileTree
    setOpenFiles([]);
    setActiveTab("");
    setAllFilesLoaded(false);
    setGitStatusMap({});
    setComments([]);
    setSelectedText("");
    setSelectedLineInfo(null);
    loadGitStatus();
  }, [projectPath, taskId, worktreePath]);

  // Reload git status when refreshKey changes (file watcher triggered)
  useEffect(() => {
    if (refreshKey > 0 && worktreePath) {
      loadGitStatus();
    }
  }, [refreshKey, worktreePath]);

  // Refresh open files when specific file changes and git status is updated
  useEffect(() => {
    if (refreshKey > 0 && worktreePath && changedFilePath && openFiles.length > 0 && Object.keys(gitStatusMap).length > 0) {
      refreshChangedFile(changedFilePath);
    }
  }, [refreshKey, worktreePath, changedFilePath, gitStatusMap]);

  const loadGitStatus = async () => {
    // Only load if we have a worktree path
    if (!worktreePath) {
      console.log("[FileTreeDiff] No worktree path, clearing trees");
      setFileTree([]);
      setChangedFilesOnly([]);
      setChangedFilesTree([]);
      return;
    }
    
    console.log("[FileTreeDiff] Loading git status for worktree:", {
      worktreePath,
      projectPath,
      taskId
    });
    
    try {
      const status = await gitApi.getStatus(worktreePath);
      console.log("[FileTreeDiff] Git status loaded:", {
        added: status.added.length,
        modified: status.modified.length,
        deleted: status.deleted.length,
        untracked: status.untracked.length,
        addedFiles: status.added,
        modifiedFiles: status.modified,
        deletedFiles: status.deleted,
        untrackedFiles: status.untracked
      });
      buildFileTree(status);
    } catch (error) {
      console.error("[FileTreeDiff] Failed to load git status:", error);
      // Clear the tree on error
      setFileTree([]);
      setChangedFilesOnly([]);
      setChangedFilesTree([]);
    }
  };

  const refreshChangedFile = async (filePath: string) => {
    if (!worktreePath) return;

    // Check if the changed file is in our open files
    const fileIndex = openFiles.findIndex(f => f.path === filePath);
    if (fileIndex === -1) return; // File is not open, no need to refresh

    try {
      const file = openFiles[fileIndex];
      // Get relative path from full path
      const relativePath = file.path.startsWith(worktreePath + '/') 
        ? file.path.substring(worktreePath.length + 1)
        : file.path.split('/').pop() || file.path;
      
      const fileStatus = gitStatusMap[relativePath];
      let updatedFile: OpenFile;
      
      if (fileStatus === 'added') {
        // New file, only new content
        const content = await gitApi.readFileContent(worktreePath, relativePath);
        updatedFile = { ...file, newContent: content };
      } else if (fileStatus === 'deleted') {
        // Deleted file, keep old content only
        updatedFile = file;
      } else if (fileStatus === 'modified') {
        // Modified file, update both old and new content
        const [gitShowResult, currentContent] = await Promise.all([
          gitApi.getFileFromRef(worktreePath, `HEAD:${relativePath}`),
          gitApi.readFileContent(worktreePath, relativePath)
        ]);
        updatedFile = { ...file, oldContent: gitShowResult, newContent: currentContent };
      } else {
        // Unchanged file, reload current content
        const content = await gitApi.readFileContent(worktreePath, relativePath);
        updatedFile = { ...file, oldContent: content, newContent: content };
      }
      
      // Update only the changed file in the openFiles array
      const newOpenFiles = [...openFiles];
      newOpenFiles[fileIndex] = updatedFile;
      setOpenFiles(newOpenFiles);
      
      console.log(`Refreshed open file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to refresh file ${filePath}:`, error);
    }
  };

  const loadAllFiles = async () => {
    if (!worktreePath || allFilesLoaded) return;
    
    console.log("[FileTreeDiff] Loading all files for worktree:", worktreePath);
    
    try {
      const fileList = await gitApi.listAllFiles(worktreePath);
      console.log("[FileTreeDiff] All files loaded:", {
        count: fileList.length,
        sampleFiles: fileList.slice(0, 10), // Show first 10 files as sample
        worktreePath
      });
      
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
      
      // Auto-expand folders containing changed files in the all files view
      const foldersToExpand = new Set<string>(expandedFolders);
      
      // Find and expand folders that contain changed files
      const hasChangedFilesRecursive = (node: FileNode): boolean => {
        if (node.type === 'file') {
          return node.status !== undefined;
        }
        
        if (node.type === 'folder' && node.children) {
          return node.children.some(child => hasChangedFilesRecursive(child));
        }
        
        return false;
      };
      
      const findChangedFolders = (nodes: FileNode[]) => {
        nodes.forEach(node => {
          if (node.type === 'folder' && node.children) {
            // Check if this folder or any of its descendants contain changed files
            if (hasChangedFilesRecursive(node)) {
              foldersToExpand.add(node.path);
            }
            
            // Recursively check children
            findChangedFolders(node.children);
          }
        });
      };
      
      findChangedFolders(sortedTree);
      setExpandedFolders(foldersToExpand);
    } catch (error) {
      console.error("Failed to load all files:", error);
    }
  };

  const buildFileTree = (status: GitStatus) => {
    const allFiles = [
      ...status.added.map(f => ({ path: f, status: "added" as const })),
      ...status.modified.map(f => ({ path: f, status: "modified" as const })),
      ...status.deleted.map(f => ({ path: f, status: "deleted" as const })),
      ...status.untracked.map(f => ({ path: f, status: "added" as const })), // Treat untracked as added for display
    ];

    console.log("[FileTreeDiff] Building file tree:", {
      totalFiles: allFiles.length,
      worktreePath,
      allFiles: allFiles,
      untrackedFiles: status.untracked
    });

    // Build status map for quick lookup
    const statusMap: GitStatusMap = {};
    status.added.forEach(f => statusMap[f] = "added");
    status.modified.forEach(f => statusMap[f] = "modified");
    status.deleted.forEach(f => statusMap[f] = "deleted");
    status.untracked.forEach(f => statusMap[f] = "added"); // Treat untracked as added
    setGitStatusMap(statusMap);

    // Build changed files only list
    const changedFiles: FileNode[] = allFiles.map(({ path, status }) => ({
      name: path.split("/").pop() || path,
      path: worktreePath ? `${worktreePath}/${path}` : path,  // Use full path
      type: "file" as const,
      status,
    }));
    console.log("[FileTreeDiff] Changed files list:", changedFiles);
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
    
    // Auto-expand folders containing changed files
    const foldersToExpand = new Set<string>();
    
    // Collect all folder paths that contain changed files
    const collectFolderPaths = (node: FileNode) => {
      if (node.type === 'folder' && node.children && node.children.length > 0) {
        // This folder contains changed files, so expand it
        foldersToExpand.add(node.path);
        
        // Recursively check children
        node.children.forEach(child => {
          collectFolderPaths(child);
        });
      }
    };
    
    // Collect all folders that should be expanded
    sortedTree.forEach(node => collectFolderPaths(node));
    
    // Set expanded folders
    setExpandedFolders(foldersToExpand);
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

  // Comment handling functions
  const handleTextSelected = (text: string, lineNumber?: number, side?: 'old' | 'new') => {
    setSelectedText(text);
    setSelectedLineInfo({ lineNumber, side });
    setShowCommentPanel(true);
  };

  const handleCommentSubmit = (selection: { text: string; startLine?: number; endLine?: number; side?: 'old' | 'new' }, comment: string) => {
    // Get relative file path
    const relativePath = (worktreePath && activeTab.startsWith(worktreePath + '/')) 
      ? activeTab.substring(worktreePath.length + 1)
      : activeTab.split('/').pop() || activeTab;

    const newComment: CodeComment = {
      id: generateId(),
      filePath: activeTab, // Full path
      relativeFilePath: relativePath, // Relative path from project root
      selectedText: selection.text,
      comment: comment,
      timestamp: new Date(),
      lineNumber: selection.startLine, // Keep for backward compatibility
      startLine: selection.startLine,
      endLine: selection.endLine,
      side: selection.side
    };
    setComments([...comments, newComment]);
    setSelectedText("");
    setSelectedLineInfo(null);
  };

  const handleAddComment = (comment: Omit<CodeComment, 'id' | 'timestamp'>) => {
    const newComment: CodeComment = {
      ...comment,
      id: generateId(),
      timestamp: new Date(),
      lineNumber: selectedLineInfo?.lineNumber,
      side: selectedLineInfo?.side
    };
    setComments([...comments, newComment]);
    setSelectedText("");
    setSelectedLineInfo(null);
  };

  const handleDeleteComment = (id: string) => {
    setComments(comments.filter(c => c.id !== id));
  };

  const handleSubmitToAgent = async () => {
    try {
      // Build prompt with comments and code context
      const prompt = buildPromptFromComments();
      
      // Send message to TaskConversation via EventBus
      eventBus.emit('send-to-conversation', {
        taskId: taskId,
        message: prompt
      });
      
      // Clear comments after successful submission
      setComments([]);
      setShowCommentPanel(false);
      
      // Clear from localStorage
      const storageKey = `task-comments-${taskId}`;
      localStorage.removeItem(storageKey);
      
      // Show success notification
      toast({
        title: t('comments.submitted', '评论已提交'),
        description: t('comments.submittedToAgent', '评论已发送到任务对话'),
      });
      
    } catch (error) {
      console.error("Failed to submit to agent:", error);
      toast({
        title: t('common.error'),
        description: t('comments.submitError', '提交评论失败'),
        variant: "destructive",
      });
    }
  };

  const buildPromptFromComments = () => {
    let prompt = `Please review and apply the following code changes based on the comments:\n\n`;
    
    comments.forEach((comment, index) => {
      prompt += `Comment ${index + 1}:\n`;
      prompt += `File: ${comment.relativeFilePath || comment.filePath}\n`;
      
      if (comment.startLine && comment.endLine && comment.startLine !== comment.endLine) {
        prompt += `Lines: ${comment.startLine}-${comment.endLine}\n`;
      } else if (comment.startLine || comment.lineNumber) {
        prompt += `Line: ${comment.startLine || comment.lineNumber}\n`;
      }
      
      if (comment.side) {
        prompt += `Side: ${comment.side}\n`;
      }
      
      prompt += `Selected Code:\n\`\`\`\n${comment.selectedText}\n\`\`\`\n`;
      prompt += `Comment: ${comment.comment}\n\n`;
    });
    
    return prompt;
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
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
      <div key={node.path}>
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              ref={buttonRef}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start px-2 h-8",
                isSelected && "bg-accent",
                "hover:bg-accent/50"
              )}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={(e) => {
                // Left click: handle file/folder click, don't open menu
                e.preventDefault();
                handleFileClick(node);
              }}
              onContextMenu={(e) => {
                // Right click: open dropdown menu
                e.preventDefault();
                e.stopPropagation();
                setDropdownOpen(true);
              }}
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
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {renderContextMenuItems({
              filePath: node.path,
              fileName: node.name,
              isFile: node.type === "file",
              onViewDiff: node.type === "file" ? () => handleFileClick(node) : undefined,
            })}
          </DropdownMenuContent>
        </DropdownMenu>
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
              <div className="border-b flex-shrink-0 flex items-center justify-between">
                <TabsList className="h-10 flex-1 justify-start rounded-none bg-transparent p-0 overflow-x-auto">
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
                <div className="px-2 flex items-center gap-1">
                  {!showCommentPanel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCommentPanel(true)}
                      className="h-7"
                    >
                      <PanelRightOpen className="h-3 w-3 mr-1" />
                      <span className="text-xs">{t('comments.title', 'Comments')}</span>
                      {comments.length > 0 && (
                        <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {comments.length}
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              {openFiles.map(file => (
                <TabsContent
                  key={file.path}
                  value={file.path}
                  className="flex-1 overflow-hidden mt-0 border-0 p-0 outline-none"
                >
                  <div className="h-full overflow-auto p-2">
                    <EnhancedDiffViewer
                      oldValue={file.oldContent}
                      newValue={file.newContent}
                      splitView={false}
                      useDarkTheme={document.documentElement.classList.contains('dark')}
                      onTextSelected={handleTextSelected}
                      onCommentSubmit={handleCommentSubmit}
                      fileName={file.name}
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

      {/* Comment Panel */}
      {showCommentPanel && (
        <div className="w-96 border-l flex flex-col overflow-hidden">
          <CommentPanel
            comments={comments}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onSubmitToAgent={handleSubmitToAgent}
            selectedText={selectedText}
            selectedFile={activeTab}
            onClose={() => setShowCommentPanel(false)}
          />
        </div>
      )}
    </div>
  );
}