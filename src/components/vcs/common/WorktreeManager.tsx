import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { gitApi } from "@/lib/api";
import { Task } from "@/types";
import { GitBranch, FolderOpen, Plus, Trash2, RefreshCw } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { toast } from "@/hooks/use-toast";

interface WorktreeManagerProps {
  task: Task;
  projectPath: string;
}

export function WorktreeManager({ task, projectPath }: WorktreeManagerProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [selectedBaseBranch, setSelectedBaseBranch] = useState<string>("");
  const [worktreePath, setWorktreePath] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load git information
  useEffect(() => {
    loadGitInfo();
  }, [projectPath]);

  const loadGitInfo = async () => {
    try {
      setIsLoading(true);
      const [branchList, current] = await Promise.all([
        gitApi.listBranches(projectPath),
        gitApi.getCurrentBranch(projectPath),
      ]);
      
      setBranches(branchList);
      setCurrentBranch(current);
      setSelectedBaseBranch(current);
    } catch (error) {
      console.error("Failed to load git info:", error);
      toast({
        title: "错误",
        description: "无法加载 Git 信息",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createWorktree = async () => {
    if (!selectedBaseBranch) {
      toast({
        title: "错误",
        description: "请选择基础分支",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      const path = await gitApi.createWorktree(
        projectPath,
        task.id,
        selectedBaseBranch
      );
      
      setWorktreePath(path);
      toast({
        title: "成功",
        description: "工作树创建成功",
      });
    } catch (error) {
      console.error("Failed to create worktree:", error);
      toast({
        title: "错误",
        description: `创建工作树失败: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const removeWorktree = async () => {
    if (!worktreePath) return;

    try {
      await gitApi.removeWorktree(projectPath, worktreePath);
      setWorktreePath(null);
      toast({
        title: "成功",
        description: "工作树已删除",
      });
    } catch (error) {
      console.error("Failed to remove worktree:", error);
      toast({
        title: "错误",
        description: `删除工作树失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const openInFinder = async () => {
    if (!worktreePath) return;
    
    try {
      await open(worktreePath);
    } catch (error) {
      console.error("Failed to open in finder:", error);
      toast({
        title: "错误",
        description: "无法打开文件夹",
        variant: "destructive",
      });
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Git 工作树管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current branch info */}
        <div>
          <Label>当前分支</Label>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{currentBranch}</Badge>
          </div>
        </div>

        {/* Worktree status */}
        {worktreePath ? (
          <div className="space-y-3">
            <div>
              <Label>工作树路径</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={worktreePath} readOnly className="flex-1" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={openInFinder}
                  title="在 Finder 中打开"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={removeWorktree}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除工作树
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>基础分支</Label>
              <Select
                value={selectedBaseBranch}
                onValueChange={setSelectedBaseBranch}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择基础分支" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={createWorktree}
              disabled={isCreating || !selectedBaseBranch}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  创建工作树
                </>
              )}
            </Button>
          </div>
        )}

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          onClick={loadGitInfo}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </CardContent>
    </Card>
  );
}