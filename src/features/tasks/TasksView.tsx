/**
 * TasksView - Main view for task management
 */

import { useEffect, useRef, useState } from 'react';
import { ProjectMainView } from '@/features/layout/components/ProjectMainView';
import { LayoutToggleButtons } from '@/features/layout/components/LayoutToggleButtons';
import { TaskKanbanBoard } from '@/features/tasks/kanban/TaskKanbanBoard';
import { TaskDetailsPanel } from '@/features/tasks/details/TaskDetailsPanel';
import { TaskConversation } from './conversation/TaskConversation';
import { CreateTaskDialog } from '@/features/tasks/dialogs/CreateTaskDialog';
import { EditTaskDialog } from '@/features/tasks/dialogs/EditTaskDialog';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { useLayout } from '@/contexts/LayoutContext';
import { taskApi } from '@/services/api';
import { useTranslation } from 'react-i18next';
import { ImperativePanelHandle } from 'react-resizable-panels';
import { Task, TaskStatus, CreateTaskRequest, UpdateTaskRequest } from '@/types';
import { useEvent } from '@/lib/events';
import { useToast } from '@/hooks/use-toast';
import { useTaskCommand } from './conversation/hooks/useTaskCommand';

export function TasksView() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentProject } = useApp();
  const {
    leftPanelVisible,
    rightPanelVisible,
    bottomPanelVisible,
    leftPanelSize,
    centerPanelSize,
    rightPanelSize,
    togglePanel,
    resetLayout,
  } = useLayout();
  
  
  
  
  // Local state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showEditTaskDialog, setShowEditTaskDialog] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  
  // Task command hook
  const { sendCommand: executeTaskCommand } = useTaskCommand();

  
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  // Remove conversation ref - no longer needed with simplified architecture
  
  // Load tasks when project changes
  useEffect(() => {
    if (currentProject) {
      loadTasks();
    }
  }, [currentProject]);
  
  // Listen for task status updates
  useEvent('task:status-changed', ({ task: updatedTask }) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
    );
    // Update selected task if it's the one being updated
    setSelectedTask(prevSelected => 
      prevSelected?.id === updatedTask.id ? updatedTask : prevSelected
    );
  }, []);
  
  
  const loadTasks = async () => {
    if (!currentProject) return;
    
    try {
      const tasksList = await taskApi.list(currentProject.id);
      setTasks(tasksList);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };
  
  // Task operations
  const handleCreateTask = async (data: CreateTaskRequest, shouldStart?: boolean, images?: string[]) => {
    if (!currentProject) return;
    
    try {
      const task = await taskApi.create(data);
      await loadTasks();
      setSelectedTask(task);
      setShowCreateTaskDialog(false);
      
      // Show success toast
      toast({
        title: t('task.createTaskSuccess'),
        description: t('task.taskCreated', { title: task.title }),
      });
      
      // If shouldStart is true, execute the task immediately
      if (shouldStart) {
        const initialMessage = `请执行以下任务：\n\n标题：${task.title}\n${task.description ? `\n描述：${task.description}` : ''}`;
        await executeTaskCommand({
          type: 'SEND_MESSAGE',
          taskId: task.id,
          message: initialMessage,
          images
        });
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      
      // Parse error message
      let errorMessage = t('task.createTaskError');
      if (error instanceof Error) {
        // Check if it's a worktree creation error
        if (error.message.includes('ambiguous argument') || error.message.includes('unknown revision')) {
          errorMessage = t('task.worktreeCreationError', { 
            defaultValue: 'Failed to create worktree. Please check your project\'s main branch configuration in project settings.' 
          });
        } else {
          errorMessage = error.message;
        }
      }
      
      // Show error toast
      toast({
        title: t('task.createTaskError'),
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };
  
  const handleUpdateTask = async (id: string, data: UpdateTaskRequest) => {
    try {
      await taskApi.update(id, data);
      await loadTasks();
      setShowEditTaskDialog(false);
      setTaskToEdit(null);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };
  
  const handleDeleteTask = async (id: string) => {
    try {
      await taskApi.delete(id);
      await loadTasks();
      if (selectedTask?.id === id) {
        setSelectedTask(null);
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };
  
  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await taskApi.updateStatus(taskId, newStatus);
      await loadTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };
  
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };
  
  const handleExecuteTask = async () => {
    if (!selectedTask) return;
    
    // Attempt management is now handled by backend
    // Just send the execute command
    try {
      await executeTaskCommand({
        type: 'SEND_MESSAGE',
        taskId: selectedTask.id,
        message: 'Start working on this task'
      });
    } catch (error) {
      console.error('Failed to execute task:', error);
    }
  };
  
  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setShowEditTaskDialog(true);
  };
  
  
  // Panel size handlers
  const handleLeftPanelResize = () => {
    // Panel resize is handled automatically by react-resizable-panels
  };
  
  const handleRightPanelResize = () => {
    // Panel resize is handled automatically by react-resizable-panels
  };
  
  
  // Event listeners
  // Using execution-started for now, could add a specific task-execute event later
  
  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">{t('project.noProjectSelected')}</h2>
          <p className="text-muted-foreground">{t('project.selectProjectFirst')}</p>
        </div>
      </div>
    );
  }

  
  return (
    <div className="h-screen bg-background">
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onSubmit={handleCreateTask}
        projectId={currentProject.id}
      />
      
      {showEditTaskDialog && taskToEdit && (
        <EditTaskDialog
          open={showEditTaskDialog}
          onOpenChange={(open) => {
            setShowEditTaskDialog(open);
            if (!open) {
              // Reset taskToEdit when dialog closes
              setTaskToEdit(null);
            }
          }}
          task={taskToEdit}
          onSubmit={(taskId, data) => handleUpdateTask(taskId, data)}
        />
      )}
      
      <ProjectMainView
        leftPanel={
          tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">{t('task.noTasks')}</p>
                <Button onClick={() => setShowCreateTaskDialog(true)}>
                  {t('task.createTask')}
                </Button>
              </div>
            </div>
          ) : (
            <TaskKanbanBoard
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onTaskStatusChange={handleTaskStatusChange}
              onAddTask={() => setShowCreateTaskDialog(true)}
              onEditTask={handleEditTask}
              onDeleteTask={(task) => handleDeleteTask(task.id)}
              onExecuteTask={async (task) => {
                setSelectedTask(task);
                try {
                  // 构建包含任务上下文的初始消息 - 与 create&start 使用相同的格式
                  const initialMessage = `请执行以下任务：\n\n标题：${task.title}\n${task.description ? `\n描述：${task.description}` : ''}`;
                  // 注意：从任务卡片执行时无法获取原始图片，因为图片不存储在任务中
                  await executeTaskCommand({
                    type: 'SEND_MESSAGE',
                    taskId: task.id,
                    message: initialMessage
                  });
                } catch (error) {
                  console.error('Failed to execute task:', error);
                }
              }}
            />
          )
        }
        centerPanel={
          selectedTask ? (
            <TaskDetailsPanel
              task={selectedTask}
              project={currentProject}
              onEdit={handleEditTask}
              onDelete={() => handleDeleteTask(selectedTask.id)}
              onExecute={handleExecuteTask}
              onRunTask={handleTaskClick}
              bottomPanelVisible={bottomPanelVisible}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">{t('task.selectTaskToView')}</p>
            </div>
          )
        }
        rightPanel={
          selectedTask && currentProject ? (
            <TaskConversation
              task={selectedTask}
              project={currentProject}
            />
          ) : null
        }
        bottomPanel={null}
        leftPanelVisible={leftPanelVisible}
        rightPanelVisible={rightPanelVisible}
        bottomPanelVisible={bottomPanelVisible}
        leftPanelSize={leftPanelSize}
        centerPanelSize={centerPanelSize}
        rightPanelSize={rightPanelSize}
        leftPanelRef={leftPanelRef}
        rightPanelRef={rightPanelRef}
        onLeftPanelResize={handleLeftPanelResize}
        onRightPanelResize={handleRightPanelResize}
        onResetLayout={resetLayout}
        toolbar={
          <LayoutToggleButtons
            leftPanelVisible={leftPanelVisible}
            rightPanelVisible={rightPanelVisible}
            bottomPanelVisible={bottomPanelVisible}
            onToggleLeft={() => togglePanel('left')}
            onToggleRight={() => togglePanel('right')}
            onToggleBottom={() => togglePanel('bottom')}
            onResetLayout={resetLayout}
          />
        }
      />
    </div>
  );
}