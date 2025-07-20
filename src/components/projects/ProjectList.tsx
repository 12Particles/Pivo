import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { projectApi } from "@/lib/api";
import { Project } from "@/types";
import { FolderOpen, GitBranch, Plus, Settings } from "lucide-react";

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
}

export function ProjectList({ onSelectProject, onCreateProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectApi.list();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载项目中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">项目</h2>
        <Button onClick={onCreateProject}>
          <Plus className="h-4 w-4 mr-2" />
          新建项目
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="p-8">
          <div className="text-center space-y-4">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-medium">暂无项目</h3>
              <p className="text-sm text-muted-foreground mt-1">
                创建您的第一个项目开始使用
              </p>
            </div>
            <Button onClick={onCreateProject}>创建项目</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectProject(project)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {project.description || "暂无描述"}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{project.path}</span>
                  </div>
                  {project.git_repo && (
                    <Badge variant="secondary" className="text-xs">
                      <GitBranch className="h-3 w-3 mr-1" />
                      Git
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}