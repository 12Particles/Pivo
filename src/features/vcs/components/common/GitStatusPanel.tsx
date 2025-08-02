import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gitApi } from "@/services/api";
import { GitStatus } from "@/types";
import { 
  GitBranch, 
  GitCommit, 
  GitPullRequest, 
  RefreshCw, 
  FileText,
  FilePlus,
  FileX,
  FileEdit
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FileListItem } from "./FileListItem";

interface GitStatusPanelProps {
  projectPath: string;
  onRefresh?: () => void;
}

export function GitStatusPanel({ projectPath, onRefresh }: GitStatusPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState("");
  const [diff, setDiff] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [currentBranch, setCurrentBranch] = useState("");

  useEffect(() => {
    loadStatus();
  }, [projectPath]);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      const [gitStatus, branch] = await Promise.all([
        gitApi.getStatus(projectPath),
        gitApi.getCurrentBranch(projectPath),
      ]);
      
      setStatus(gitStatus);
      setCurrentBranch(branch);
      
      // Load diff for added files
      if (gitStatus.added.length > 0) {
        const stagedDiff = await gitApi.getDiff(projectPath, true);
        setDiff(stagedDiff);
      }
    } catch (error) {
      console.error("Failed to load git status:", error);
      toast({
        title: "错误",
        description: "无法加载 Git 状态",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFileSelection = (file: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(file)) {
      newSelection.delete(file);
    } else {
      newSelection.add(file);
    }
    setSelectedFiles(newSelection);
  };

  const stageSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;

    try {
      await gitApi.stageFiles(projectPath, Array.from(selectedFiles));
      setSelectedFiles(new Set());
      await loadStatus();
      toast({
        title: "成功",
        description: `已暂存 ${selectedFiles.size} 个文件`,
      });
    } catch (error) {
      console.error("Failed to stage files:", error);
      toast({
        title: "错误",
        description: "暂存文件失败",
        variant: "destructive",
      });
    }
  };

  const commit = async () => {
    if (!commitMessage.trim()) {
      toast({
        title: "错误",
        description: "请输入提交信息",
        variant: "destructive",
      });
      return;
    }

    if (!status?.added.length) {
      toast({
        title: "错误",
        description: "没有暂存的文件",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCommitting(true);
      const commitHash = await gitApi.commit(projectPath, commitMessage);
      setCommitMessage("");
      await loadStatus();
      toast({
        title: "成功",
        description: `提交成功: ${commitHash.slice(0, 7)}`,
      });
      onRefresh?.();
    } catch (error) {
      console.error("Failed to commit:", error);
      toast({
        title: "错误",
        description: `提交失败: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const push = async () => {
    try {
      setIsPushing(true);
      await gitApi.push(projectPath, currentBranch, false);
      toast({
        title: "成功",
        description: "推送成功",
      });
    } catch (error) {
      console.error("Failed to push:", error);
      toast({
        title: "错误",
        description: `推送失败: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  };

  const getFileIcon = (type: "modified" | "untracked" | "added" | "deleted") => {
    switch (type) {
      case "modified":
        return <FileEdit className="h-4 w-4 text-yellow-500" />;
      case "untracked":
        return <FilePlus className="h-4 w-4 text-green-500" />;
      case "added":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "deleted":
        return <FileX className="h-4 w-4 text-red-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            加载中...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Git 状态
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{currentBranch}</Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadStatus}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="changes" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="changes">更改</TabsTrigger>
            <TabsTrigger value="staged">暂存</TabsTrigger>
            <TabsTrigger value="diff">差异</TabsTrigger>
          </TabsList>

          <TabsContent value="changes" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {/* Modified files */}
                {status?.modified.map((file) => (
                  <FileListItem
                    key={file}
                    file={file}
                    projectPath={projectPath}
                    icon={getFileIcon("modified")}
                    selected={selectedFiles.has(file)}
                    onToggleSelection={() => toggleFileSelection(file)}
                  />
                ))}
                
                {/* Untracked files */}
                {status?.untracked.map((file) => (
                  <FileListItem
                    key={file}
                    file={file}
                    projectPath={projectPath}
                    icon={getFileIcon("untracked")}
                    selected={selectedFiles.has(file)}
                    onToggleSelection={() => toggleFileSelection(file)}
                  />
                ))}

                {selectedFiles.size > 0 && (
                  <Button onClick={stageSelectedFiles} className="w-full">
                    暂存选中的文件 ({selectedFiles.size})
                  </Button>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="staged" className="flex-1 overflow-hidden space-y-4">
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {status?.added.map((file) => (
                  <FileListItem
                    key={file}
                    file={file}
                    projectPath={projectPath}
                    icon={getFileIcon("added")}
                    showCheckbox={false}
                  />
                ))}
              </div>
            </ScrollArea>

            {status?.added && status.added.length > 0 && (
              <div className="space-y-2">
                <Textarea
                  placeholder="输入提交信息..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={commit}
                    disabled={isCommitting || !commitMessage.trim()}
                    className="flex-1"
                  >
                    <GitCommit className="h-4 w-4 mr-2" />
                    {isCommitting ? "提交中..." : "提交"}
                  </Button>
                  <Button
                    onClick={push}
                    disabled={isPushing}
                    variant="outline"
                  >
                    <GitPullRequest className="h-4 w-4 mr-2" />
                    {isPushing ? "推送中..." : "推送"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="diff" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {diff || "暂无差异"}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}