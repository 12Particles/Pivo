import { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskKanbanBoard } from "./components/tasks/TaskKanbanBoard";
import { TaskDetailsPanel } from "./components/tasks/TaskDetailsPanel";
import { TaskConversation } from "./components/tasks/TaskConversation";
import { CreateTaskDialog } from "./components/tasks/CreateTaskDialog";
import { EditTaskDialog } from "./components/tasks/EditTaskDialog";
import { ProjectList } from "./components/projects/ProjectList";
import { ProjectForm } from "./components/projects/ProjectForm";
import { ProjectSettingsPage } from "./components/projects/ProjectSettingsPage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { ResizableLayout } from "./components/layout/ResizableLayout";
import { LayoutToggleButtons } from "./components/layout/LayoutToggleButtons";
import { ImperativePanelHandle } from "react-resizable-panels";
import { 
  Task, 
  TaskStatus, 
  Project,
  CreateProjectRequest,
  CreateTaskRequest,
  UpdateTaskRequest 
} from "./types";
import { projectApi, taskApi, gitInfoApi, gitApi } from "./lib/api";
import { ArrowLeft, Settings } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";

const queryClient = new QueryClient();

function App() {
  const { t } = useTranslation();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>();
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showEditTaskDialog, setShowEditTaskDialog] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Panel visibility states
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  
  // Panel refs for imperative control
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const centerPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  // Initialize logger on app start
  useEffect(() => {
    logger.init().then(() => {
      logger.info('Pivo application started');
    });
    
    // Refresh git providers for all projects on app start
    refreshGitProviders();
    
    // Listen for menu events
    const unlistenMenuLogs = listen('menu-view-logs', async () => {
      try {
        await invoke('show_log_viewer');
      } catch (error) {
        console.error('Failed to open log viewer:', error);
        toast({
          title: t('common.error'),
          description: t('logs.openFailed'),
          variant: "destructive",
        });
      }
    });
    
    const unlistenLogsClear = listen('menu-logs-cleared', () => {
      toast({
        title: t('common.success'),
        description: t('logs.logsCleared'),
      });
    });
    
    // Listen for File > Settings menu event
    const unlistenSettings = listen('menu-settings', () => {
      setShowSettings(true);
    });
    
    // Listen for custom open-settings event (from components)
    const handleOpenSettings = (event: CustomEvent) => {
      const { tab } = event.detail || {};
      setSettingsInitialTab(tab);
      setShowSettings(true);
    };
    window.addEventListener('open-settings', handleOpenSettings as EventListener);
    
    // Add keyboard shortcut for logs (Cmd/Ctrl + L)
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        try {
          await invoke('show_log_viewer');
        } catch (error) {
          console.error('Failed to open log viewer:', error);
          toast({
            title: t('common.error'),
            description: t('logs.openFailed'),
            variant: "destructive",
          });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      logger.destroy();
      unlistenMenuLogs.then(fn => fn());
      unlistenLogsClear.then(fn => fn());
      unlistenSettings.then(fn => fn());
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-settings', handleOpenSettings as EventListener);
    };
  }, []);
  
  // Keyboard shortcuts for layout toggle
  useEffect(() => {
    const handleLayoutKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            toggleLeftPanel();
            break;
          case 'j':
            e.preventDefault();
            toggleBottomPanel();
            break;
          case 'k':
            e.preventDefault();
            toggleRightPanel();
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleLayoutKeyDown);
    return () => window.removeEventListener('keydown', handleLayoutKeyDown);
  }, [leftPanelVisible, bottomPanelVisible, rightPanelVisible]);

  useEffect(() => {
    if (currentProject) {
      logger.info('Project selected', { projectId: currentProject.id, projectName: currentProject.name });
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

  const refreshGitProviders = async () => {
    try {
      logger.info('Refreshing git providers for all projects');
      const updatedProjects = await projectApi.refreshAllGitProviders();
      if (updatedProjects.length > 0) {
        logger.info(`Updated git providers for ${updatedProjects.length} projects`);
        toast({
          title: t('common.success'),
          description: `Updated git providers for ${updatedProjects.length} projects`,
        });
      }
    } catch (error) {
      logger.error('Failed to refresh git providers', error);
      console.error("Failed to refresh git providers:", error);
    }
  };

  const loadTasks = async () => {
    if (!currentProject) return;
    
    try {
      setLoading(true);
      logger.info('Loading tasks for project', { projectId: currentProject.id });
      const data = await taskApi.list(currentProject.id);
      setTasks(data);
      logger.info('Tasks loaded successfully', { count: data.length });
    } catch (error) {
      logger.error('Failed to load tasks', error);
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

  const handleCreateTask = async (data: CreateTaskRequest, shouldStart?: boolean) => {
    try {
      const newTask = await taskApi.create(data);
      setShowCreateTaskDialog(false);
      
      if (shouldStart) {
        // Automatically start the task after creation
        const updatedTask = await taskApi.updateStatus(newTask.id, TaskStatus.Working);
        setTasks(prevTasks => [...prevTasks, updatedTask]);
        setSelectedTask(updatedTask);
        toast({
          title: t('task.createTaskSuccess'),
          description: t('task.taskStarted'),
        });
      } else {
        setTasks(prevTasks => [...prevTasks, newTask]);
        toast({
          title: t('common.success'),
          description: t('task.createTaskSuccess'),
        });
      }
      
      // 自动创建 worktree
      if (currentProject?.git_repo) {
        try {
          await gitApi.createWorktree(currentProject.path, newTask.id, "main");
          toast({
            title: t('common.success'),
            description: t('task.worktreeCreated'),
          });
        } catch (error) {
          console.error("Failed to create worktree:", error);
        }
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      toast({
        title: t('common.error'),
        description: `${t('task.createTaskError')}: ${error}`,
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
        title: t('task.taskStarted'),
        description: t('task.interactWithAi'),
      });
    } catch (error) {
      console.error("Failed to run task:", error);
      toast({
        title: t('common.error'),
        description: `${t('task.runTaskError')}: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleEditTask = async (taskId: string, data: UpdateTaskRequest) => {
    try {
      const updatedTask = await taskApi.update(taskId, data);
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? updatedTask : task
        )
      );
      
      // Update selected task if it's the one being edited
      if (selectedTask?.id === taskId) {
        setSelectedTask(updatedTask);
      }
      
      setShowEditTaskDialog(false);
      setTaskToEdit(null);
      
      toast({
        title: t('common.success'),
        description: t('task.updateTaskSuccess'),
      });
    } catch (error) {
      console.error("Failed to update task:", error);
      toast({
        title: t('common.error'),
        description: `${t('task.updateTaskError')}: ${error}`,
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

  // Layout toggle functions
  const toggleLeftPanel = () => {
    if (leftPanelVisible) {
      leftPanelRef.current?.collapse();
    } else {
      leftPanelRef.current?.expand();
    }
    setLeftPanelVisible(!leftPanelVisible);
  };
  
  const toggleBottomPanel = () => {
    setBottomPanelVisible(!bottomPanelVisible);
  };
  
  const toggleRightPanel = () => {
    if (rightPanelVisible) {
      rightPanelRef.current?.collapse();
    } else {
      rightPanelRef.current?.expand();
    }
    setRightPanelVisible(!rightPanelVisible);
  };
  
  const resetLayout = () => {
    leftPanelRef.current?.resize(20);
    centerPanelRef.current?.resize(50);
    rightPanelRef.current?.resize(30);
    setLeftPanelVisible(true);
    setBottomPanelVisible(true);
    setRightPanelVisible(true);
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
            title: t('common.error'),
            description: t('project.notGitRepo'),
            variant: "destructive",
          });
          return;
        }

        // Extract project name from path
        const pathParts = (selected as string).split("/");
        const projectName = pathParts[pathParts.length - 1] || "Untitled Project";

        // Create project with extracted info
        const projectData: CreateProjectRequest = {
          name: projectName,
          description: `${gitInfo.current_branch ? `${t('project.currentBranch')}: ${gitInfo.current_branch}` : ""}${gitInfo.has_uncommitted_changes ? ` (${t('project.hasUncommittedChanges')})` : ""}`,
          path: selected as string,
          git_repo: gitInfo.remote_url,
        };

        await handleCreateProject(projectData);
      }
    } catch (error) {
      console.error("Failed to select git directory:", error);
      toast({
        title: t('common.error'),
        description: t('project.selectGitDirError'),
        variant: "destructive",
      });
    }
  };


  if (showSettings) {
    return (
      <QueryClientProvider client={queryClient}>
        <SettingsPage onBack={() => {
          setShowSettings(false);
          setSettingsInitialTab(undefined);
        }} initialTab={settingsInitialTab} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  if (showProjectSettings && currentProject) {
    return (
      <QueryClientProvider client={queryClient}>
        <ProjectSettingsPage
          project={currentProject}
          onBack={() => setShowProjectSettings(false)}
          onUpdate={(updated) => {
            setCurrentProject(updated);
            setShowProjectSettings(false);
          }}
          onDelete={() => {
            setCurrentProject(null);
            setShowProjectSettings(false);
          }}
        />
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
                  {t('common.back')}
                </Button>
                <h2 className="text-2xl font-bold">{t('project.createProject')}</h2>
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
      <div className="h-screen bg-background overflow-hidden relative">
        {/* Layout toggle buttons - positioned at top right */}
        <div className="absolute top-2 right-2 z-50">
          <LayoutToggleButtons
            leftPanelVisible={leftPanelVisible}
            bottomPanelVisible={bottomPanelVisible}
            rightPanelVisible={rightPanelVisible}
            onToggleLeft={toggleLeftPanel}
            onToggleBottom={toggleBottomPanel}
            onToggleRight={toggleRightPanel}
            onResetLayout={resetLayout}
          />
        </div>
          <ResizableLayout
            direction="horizontal"
            defaultSizes={[20, 50, 30]}
            minSizes={[15, 30, 20]}
            maxSizes={[30, undefined, 40]}
            storageKey="main-layout"
            panelRefs={[leftPanelRef, centerPanelRef, rightPanelRef]}
          >
            {/* 任务管理区 - 纵向布局 */}
            <div className="border-r flex flex-col h-full bg-background/50">
              <div className="p-3 border-b flex-shrink-0 bg-background/95 backdrop-blur">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm">{currentProject.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-muted/50"
                    onClick={() => setShowProjectSettings(true)}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {currentProject.description || t('project.noDescription')}
                </p>
              </div>
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-muted-foreground">{t('common.loading')}</div>
                </div>
              ) : (
                <TaskKanbanBoard
                  tasks={tasks}
                  onTaskStatusChange={handleTaskStatusChange}
                  onTaskClick={handleTaskClick}
                  onAddTask={handleAddTask}
                  onExecuteTask={handleRunTask}
                  onEditTask={(task) => {
                    setTaskToEdit(task);
                    setShowEditTaskDialog(true);
                  }}
                  onDeleteTask={async (task) => {
                    // Simple confirmation using window.confirm
                    const confirmed = window.confirm(t('task.deleteConfirm', { title: task.title }));
                    if (!confirmed) return;
                    
                    try {
                      await taskApi.delete(task.id);
                      setTasks(tasks.filter((t) => t.id !== task.id));
                      if (selectedTask?.id === task.id) {
                        setSelectedTask(null);
                      }
                      toast({
                        title: t('common.success'),
                        description: t('task.taskDeleted'),
                      });
                    } catch (error) {
                      console.error("Failed to delete task:", error);
                      toast({
                        title: t('common.error'),
                        description: `${t('task.deleteTaskError')}: ${error}`,
                        variant: "destructive",
                      });
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* 任务功能区 - 主工作区 */}
          <div className="flex flex-col overflow-hidden relative">
              {/* Layout toggle buttons - positioned absolutely */}
              {/* <div className="absolute top-2 right-2 z-10">
                <LayoutToggleButtons
                  leftPanelVisible={leftPanelVisible}
                  bottomPanelVisible={bottomPanelVisible}
                  rightPanelVisible={rightPanelVisible}
                  onToggleLeft={toggleLeftPanel}
                  onToggleBottom={toggleBottomPanel}
                  onToggleRight={toggleRightPanel}
                  onResetLayout={resetLayout}
                />
              </div> */}
              {selectedTask ? (
              <TaskDetailsPanel
                key={selectedTask.id}
                task={selectedTask}
                project={currentProject}
                onRunTask={handleRunTask}
                bottomPanelVisible={bottomPanelVisible}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                {t('task.selectTaskToView')}
              </div>
            )}
          </div>

          {/* 右侧面板 - 任务会话 */}
          <div className="border-l flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <h3 className="font-medium">{t('task.taskConversation')}</h3>
              </div>
            <div className="flex-1 overflow-hidden">
              {selectedTask && currentProject ? (
                <TaskConversation
                  key={selectedTask.id}
                  task={selectedTask}
                  project={currentProject}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('task.selectTaskToChat')}
                </div>
              )}
            </div>
          </div>
        </ResizableLayout>

        {currentProject && (
          <>
            <CreateTaskDialog
              open={showCreateTaskDialog}
              onOpenChange={setShowCreateTaskDialog}
              projectId={currentProject.id}
              onSubmit={handleCreateTask}
            />
            <EditTaskDialog
              open={showEditTaskDialog}
              onOpenChange={setShowEditTaskDialog}
              task={taskToEdit}
              onSubmit={handleEditTask}
            />
          </>
        )}
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
