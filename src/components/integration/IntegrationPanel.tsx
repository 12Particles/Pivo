import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Task, Project } from "@/types";
import { 
  GitPullRequest, 
  GitMerge, 
  GitBranch, 
  ExternalLink,
  MessageSquare,
  Check,
  X,
  Clock,
  RefreshCw,
  Plus
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface IntegrationPanelProps {
  task: Task;
  project: Project;
}

interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  state: "open" | "closed" | "merged";
  sourceBranch: string;
  targetBranch: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  reviewStatus?: "approved" | "changes_requested" | "pending";
  comments: number;
}

export function IntegrationPanel({ task, project }: IntegrationPanelProps) {
  const [platform, setPlatform] = useState<"github" | "gitlab">("github");
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [prFormData, setPrFormData] = useState({
    title: "",
    description: "",
    targetBranch: "main",
  });

  useEffect(() => {
    // 检测项目使用的平台
    if (project.git_repo) {
      if (project.git_repo.includes("github.com")) {
        setPlatform("github");
      } else if (project.git_repo.includes("gitlab.com") || project.git_repo.includes("gitlab")) {
        setPlatform("gitlab");
      }
    }
    loadPullRequests();
  }, [project]);

  const loadPullRequests = async () => {
    setLoading(true);
    try {
      // TODO: 实际调用 GitHub/GitLab API
      // 模拟数据
      setPullRequests([
        {
          id: "1",
          number: 123,
          title: `feat: ${task.title}`,
          description: task.description || "",
          state: "open",
          sourceBranch: `task/${task.id}`,
          targetBranch: "main",
          author: "current-user",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          url: `${project.git_repo}/pull/123`,
          reviewStatus: "pending",
          comments: 3,
        },
      ]);
    } catch (error) {
      console.error("Failed to load pull requests:", error);
      toast({
        title: "错误",
        description: "加载拉取请求失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createPullRequest = async () => {
    try {
      // TODO: 实际调用 API 创建 PR
      toast({
        title: "成功",
        description: "拉取请求已创建",
      });
      setShowCreatePR(false);
      loadPullRequests();
    } catch (error) {
      console.error("Failed to create pull request:", error);
      toast({
        title: "错误",
        description: "创建拉取请求失败",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (state: string, reviewStatus?: string) => {
    if (state === "merged") return <GitMerge className="h-4 w-4 text-purple-500" />;
    if (state === "closed") return <X className="h-4 w-4 text-red-500" />;
    if (reviewStatus === "approved") return <Check className="h-4 w-4 text-green-500" />;
    if (reviewStatus === "changes_requested") return <X className="h-4 w-4 text-orange-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusText = (state: string, reviewStatus?: string) => {
    if (state === "merged") return "已合并";
    if (state === "closed") return "已关闭";
    if (reviewStatus === "approved") return "已批准";
    if (reviewStatus === "changes_requested") return "需要修改";
    return "待审核";
  };

  const renderPullRequest = (pr: PullRequest) => (
    <Card key={pr.id} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4" />
              <span className="font-medium">#{pr.number}</span>
              <span className="text-sm">{pr.title}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                <span>{pr.sourceBranch} → {pr.targetBranch}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{pr.comments}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <div className="flex items-center gap-1">
                {getStatusIcon(pr.state, pr.reviewStatus)}
                <span>{getStatusText(pr.state, pr.reviewStatus)}</span>
              </div>
            </Badge>
            <a href={pr.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </CardHeader>
      {pr.description && (
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {pr.description}
          </p>
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">代码集成</h3>
          <Badge variant="secondary">
            {platform === "github" ? "GitHub" : "GitLab"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPullRequests}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button size="sm" onClick={() => setShowCreatePR(true)}>
            <Plus className="h-4 w-4 mr-1" />
            创建 PR
          </Button>
        </div>
      </div>

      {showCreatePR ? (
        <Card>
          <CardHeader>
            <CardTitle>创建拉取请求</CardTitle>
            <CardDescription>
              为任务 "{task.title}" 创建拉取请求
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pr-title">标题</Label>
              <Input
                id="pr-title"
                value={prFormData.title}
                onChange={(e) => setPrFormData({ ...prFormData, title: e.target.value })}
                placeholder={`feat: ${task.title}`}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pr-description">描述</Label>
              <Textarea
                id="pr-description"
                value={prFormData.description}
                onChange={(e) => setPrFormData({ ...prFormData, description: e.target.value })}
                placeholder="描述这个拉取请求的更改..."
                rows={5}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="target-branch">目标分支</Label>
              <Select
                value={prFormData.targetBranch}
                onValueChange={(value) => setPrFormData({ ...prFormData, targetBranch: value })}
              >
                <SelectTrigger id="target-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">main</SelectItem>
                  <SelectItem value="develop">develop</SelectItem>
                  <SelectItem value="master">master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={createPullRequest}>创建</Button>
              <Button variant="outline" onClick={() => setShowCreatePR(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="flex-1">
          {pullRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <GitPullRequest className="h-12 w-12 mb-4" />
              <p className="text-sm">暂无拉取请求</p>
              <p className="text-xs mt-1">创建一个新的拉取请求来合并您的更改</p>
            </div>
          ) : (
            <div>
              {pullRequests.map(renderPullRequest)}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}