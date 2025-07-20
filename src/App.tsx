import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskKanbanBoard } from "./components/tasks/TaskKanbanBoard";
import { TaskDetailsPanel } from "./components/tasks/TaskDetailsPanel";
import { TaskConversationEnhanced } from "./components/tasks/TaskConversationEnhanced";
import { CreateTaskDialog } from "./components/tasks/CreateTaskDialog";
import { ProjectList } from "./components/projects/ProjectList";
import { ProjectForm } from "./components/projects/ProjectForm";
import { SettingsPage } from "./components/settings/SettingsPage";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { 
  Task, 
  TaskStatus, 
  Project,
  CreateProjectRequest,
  CreateTaskRequest 
} from "./types";
import { projectApi, taskApi, gitInfoApi, gitApi } from "./lib/api";
import { ArrowLeft, Settings } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { listen } from "@tauri-apps/api/event";

const queryClient = new QueryClient();

function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentProject) {
      loadTasks();
    }
  }, [currentProject]);

  useEffect(() => {
    // Listen for task status updates
    const unlistenTaskUpdate = listen<Task>("task-status-updated", (event) => {
      const updatedTask = event.payload;
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === updatedTask.id ? updatedTask : task
        )
      );
      
      // Update selected task if it's the one being updated
      if (selectedTask?.id === updatedTask.id) {
        setSelectedTask(updatedTask);
      }
    });

    return () => {
      unlistenTaskUpdate.then((fn) => fn());
    };
  }, [selectedTask]);

  const loadTasks = async () => {
    if (!currentProject) return;
    
    try {
      setLoading(true);
      const data = await taskApi.list(currentProject.id);
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const updatedTask = await taskApi.updateStatus(taskId, newStatus);
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? updatedTask : task
        )
      );
    } catch (error) {
      console.error("Failed to update task status:", error);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    setShowCreateTaskDialog(true);
  };

  const handleCreateTask = async (data: CreateTaskRequest) => {
    try {
      const newTask = await taskApi.create(data);
      setTasks([...tasks, newTask]);
      setShowCreateTaskDialog(false);
      toast({
        title: "成功",
        description: "任务创建成功",
      });
      
      // 自动创建 worktree
      if (currentProject?.git_repo) {
        try {
          await gitApi.createWorktree(currentProject.path, newTask.id, "main");
          toast({
            title: "成功",
            description: "工作树已创建",
          });
        } catch (error) {
          console.error("Failed to create worktree:", error);
        }
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      toast({
        title: "错误",
        description: `创建任务失败: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleRunTask = async (task: Task) => {
    if (!currentProject) return;
    
    try {
      // 选中任务
      setSelectedTask(task);
      
      // 更新任务状态为 Working
      await taskApi.updateStatus(task.id, TaskStatus.Working);
      setTasks(prevTasks =>
        prevTasks.map(t => t.id === task.id ? { ...t, status: TaskStatus.Working } : t)
      );
      
      // 如果选中的任务发生改变，更新选中的任务状态
      if (selectedTask?.id === task.id) {
        setSelectedTask({ ...task, status: TaskStatus.Working });
      }
      
      toast({
        title: "任务已开始",
        description: "请在任务会话中与 AI 助手交互",
      });
    } catch (error) {
      console.error("Failed to run task:", error);
      toast({
        title: "错误",
        description: `运行任务失败: ${error}`,
        variant: "destructive",
      });
    }
  };


  const handleCreateProject = async (data: CreateProjectRequest) => {
    try {
      const project = await projectApi.create(data);
      setCurrentProject(project);
      setShowProjectForm(false);
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const handleSelectGitDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择 Git 项目目录",
      });

      if (selected) {
        const gitInfo = await gitInfoApi.extractGitInfo(selected as string);
        
        if (!gitInfo.is_git_repo) {
          toast({
            title: "错误",
            description: "所选目录不是 Git 仓库",
            variant: "destructive",
          });
          return;
        }

        // Extract project name from path
        const pathParts = (selected as string).split("/");
        const projectName = pathParts[pathParts.length - 1] || "未命名项目";

        // Create project with extracted info
        const projectData: CreateProjectRequest = {
          name: projectName,
          description: `${gitInfo.current_branch ? `当前分支: ${gitInfo.current_branch}` : ""}${gitInfo.has_uncommitted_changes ? " (有未提交的更改)" : ""}`,
          path: selected as string,
          git_repo: gitInfo.remote_url,
        };

        await handleCreateProject(projectData);
      }
    } catch (error) {
      console.error("Failed to select git directory:", error);
      toast({
        title: "错误",
        description: "选择 Git 目录失败",
        variant: "destructive",
      });
    }
  };


  if (showSettings) {
    return (
      <QueryClientProvider client={queryClient}>
        <SettingsPage onBack={() => setShowSettings(false)} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  if (!currentProject) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="h-screen bg-background p-8">
          <div className="absolute top-4 right-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          {showProjectForm ? (
            <Card className="max-w-2xl mx-auto p-6">
              <div className="mb-6">
                <Button
                  variant="ghost"
                  onClick={() => setShowProjectForm(false)}
                  className="mb-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回
                </Button>
                <h2 className="text-2xl font-bold">创建新项目</h2>
              </div>
              <ProjectForm
                onSubmit={handleCreateProject}
                onCancel={() => setShowProjectForm(false)}
              />
            </Card>
          ) : (
            <ProjectList
              onSelectProject={setCurrentProject}
              onCreateProject={handleSelectGitDirectory}
            />
          )}
        </div>
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex bg-background overflow-hidden">
        {/* 任务管理区 - 纵向布局 */}
        <div className="w-80 border-r flex flex-col h-full">
          <div className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{currentProject.name}</h3>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {currentProject.description || "暂无描述"}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">加载任务中...</div>
              </div>
            ) : (
              <TaskKanbanBoard
                tasks={tasks}
                onTaskStatusChange={handleTaskStatusChange}
                onTaskClick={handleTaskClick}
                onAddTask={handleAddTask}
                onExecuteTask={handleRunTask}
                onEditTask={() => {
                  // TODO: Implement edit task dialog
                  toast({
                    title: "编辑任务",
                    description: "编辑功能即将推出",
                  });
                }}
                onDeleteTask={async (task) => {
                  // Simple confirmation using window.confirm
                  const confirmed = window.confirm(`确定要删除任务 "${task.title}" 吗？`);
                  if (!confirmed) return;
                  
                  try {
                    await taskApi.delete(task.id);
                    setTasks(tasks.filter((t) => t.id !== task.id));
                    if (selectedTask?.id === task.id) {
                      setSelectedTask(null);
                    }
                    toast({
                      title: "成功",
                      description: "任务已删除",
                    });
                  } catch (error) {
                    console.error("Failed to delete task:", error);
                    toast({
                      title: "错误",
                      description: `删除任务失败: ${error}`,
                      variant: "destructive",
                    });
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* 任务功能区 - 主工作区 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTask ? (
            <TaskDetailsPanel
              key={selectedTask.id}
              task={selectedTask}
              project={currentProject}
              onRunTask={handleRunTask}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              选择一个任务查看详情
            </div>
          )}
        </div>

        {/* 右侧面板 - 任务会话 */}
        <div className="w-[480px] border-l flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <h3 className="font-medium">任务会话</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            {selectedTask && currentProject ? (
              <TaskConversationEnhanced
                key={selectedTask.id}
                task={selectedTask}
                project={currentProject}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                选择一个任务开始会话
              </div>
            )}
          </div>
        </div>

        {currentProject && (
          <CreateTaskDialog
            open={showCreateTaskDialog}
            onOpenChange={setShowCreateTaskDialog}
            projectId={currentProject.id}
            onSubmit={handleCreateTask}
          />
        )}
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
