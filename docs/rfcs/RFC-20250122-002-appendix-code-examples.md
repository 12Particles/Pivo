# RFC 0001 Appendix: Code Examples

This appendix provides detailed code examples for the frontend architecture refactoring.

## 1. Complete Store Examples

### ProjectStore with Error Handling

```typescript
// stores/domain/useProjectStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Project, CreateProjectRequest } from '@/types';
import { projectApi, gitInfoApi } from '@/lib/api';
import { logger } from '@/lib/logger';

interface ProjectStore {
  // State
  currentProject: Project | null;
  projects: Project[];
  loading: boolean;
  error: string | null;
  
  // Actions
  setCurrentProject: (project: Project | null) => void;
  loadProjects: () => Promise<void>;
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  createProjectFromGitDir: () => Promise<Project | null>;
  updateProject: (id: string, data: UpdateProjectRequest) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refreshGitProviders: () => Promise<void>;
  
  // Selectors
  getProjectById: (id: string) => Project | undefined;
  hasProjects: () => boolean;
}

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentProject: null,
      projects: [],
      loading: false,
      error: null,
      
      // Actions
      setCurrentProject: (project) => {
        set({ currentProject: project });
        if (project) {
          logger.info('Project selected', { 
            projectId: project.id, 
            projectName: project.name 
          });
        }
      },
      
      createProjectFromGitDir: async () => {
        const { open } = await import('@tauri-apps/plugin-dialog');
        
        try {
          const selected = await open({
            directory: true,
            multiple: false,
            title: "Select Git Project Directory",
          });

          if (!selected) return null;

          const gitInfo = await gitInfoApi.extractGitInfo(selected as string);
          
          if (!gitInfo.is_git_repo) {
            throw new Error('Selected directory is not a Git repository');
          }

          const pathParts = (selected as string).split("/");
          const projectName = pathParts[pathParts.length - 1] || "Untitled Project";

          const projectData: CreateProjectRequest = {
            name: projectName,
            description: gitInfo.current_branch ? 
              `Current branch: ${gitInfo.current_branch}${gitInfo.has_uncommitted_changes ? ' (uncommitted changes)' : ''}` 
              : '',
            path: selected as string,
            git_repo: gitInfo.remote_url,
          };

          return await get().createProject(projectData);
        } catch (error) {
          logger.error('Failed to create project from git directory', error);
          throw error;
        }
      },
      
      // ... other actions
      
      // Selectors
      getProjectById: (id) => {
        return get().projects.find(p => p.id === id);
      },
      
      hasProjects: () => {
        return get().projects.length > 0;
      }
    }),
    {
      name: 'project-store',
    }
  )
);
```

### TaskStore with Optimistic Updates

```typescript
// stores/domain/useTaskStore.ts
interface TaskStore {
  // ... previous definitions ...
  
  // Optimistic update support
  optimisticUpdateStatus: (id: string, status: TaskStatus) => void;
  revertOptimisticUpdate: (id: string, previousTask: Task) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  // ... previous implementation ...
  
  optimisticUpdateStatus: (id, status) => {
    set((state) => ({
      tasks: state.tasks.map(t => 
        t.id === id ? { ...t, status } : t
      ),
      selectedTask: state.selectedTask?.id === id 
        ? { ...state.selectedTask, status } 
        : state.selectedTask
    }));
  },
  
  revertOptimisticUpdate: (id, previousTask) => {
    set((state) => ({
      tasks: state.tasks.map(t => 
        t.id === id ? previousTask : t
      ),
      selectedTask: state.selectedTask?.id === id 
        ? previousTask 
        : state.selectedTask
    }));
  },
  
  updateTaskStatus: async (id, status) => {
    const previousTask = get().tasks.find(t => t.id === id);
    if (!previousTask) throw new Error('Task not found');
    
    // Optimistic update
    get().optimisticUpdateStatus(id, status);
    
    try {
      const updatedTask = await taskApi.updateStatus(id, status);
      get().updateTaskInList(updatedTask);
      logger.info('Task status updated', { taskId: id, status });
      return updatedTask;
    } catch (error) {
      // Revert on error
      get().revertOptimisticUpdate(id, previousTask);
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update task status', { error: errorMsg });
      throw error;
    }
  }
}));
```

## 2. Business Logic Hooks

### Complete Task Operations Hook

```typescript
// hooks/domain/useTaskOperations.ts
import { useCallback } from 'react';
import { useTaskStore } from '@/stores/domain/useTaskStore';
import { useProjectStore } from '@/stores/domain/useProjectStore';
import { useExecutionStore } from '@/stores/useExecutionStore';
import { useToast } from '@/hooks/use-toast';
import { gitApi } from '@/lib/api';
import { TaskStatus, CreateTaskRequest } from '@/types';
import { useTranslation } from 'react-i18next';

export function useTaskOperations() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentProject } = useProjectStore();
  const { 
    createTask, 
    updateTaskStatus, 
    deleteTask,
    selectedTask,
    selectTask 
  } = useTaskStore();
  
  const handleCreateTask = useCallback(async (
    data: CreateTaskRequest, 
    shouldStart?: boolean
  ) => {
    if (!currentProject) {
      throw new Error('No project selected');
    }
    
    try {
      const newTask = await createTask(data);
      
      if (shouldStart) {
        await updateTaskStatus(newTask.id, TaskStatus.Working);
        selectTask(newTask);
        
        // Trigger execution start via event
        window.dispatchEvent(new CustomEvent('start-task-execution', {
          detail: { taskId: newTask.id }
        }));
        
        toast({
          title: t('task.createTaskSuccess'),
          description: t('task.taskStarted'),
        });
      } else {
        toast({
          title: t('common.success'),
          description: t('task.createTaskSuccess'),
        });
      }
      
      // Auto-create worktree if git repo
      if (currentProject.git_repo) {
        try {
          await gitApi.createWorktree(
            currentProject.path, 
            newTask.id, 
            "main"
          );
          toast({
            title: t('common.success'),
            description: t('task.worktreeCreated'),
          });
        } catch (error) {
          console.error("Failed to create worktree:", error);
        }
      }
      
      return newTask;
    } catch (error) {
      toast({
        title: t('common.error'),
        description: `${t('task.createTaskError')}: ${error}`,
        variant: "destructive",
      });
      throw error;
    }
  }, [currentProject, createTask, updateTaskStatus, selectTask, toast, t]);
  
  const handleRunTask = useCallback(async (taskId: string) => {
    if (!currentProject) return;
    
    try {
      const task = await updateTaskStatus(taskId, TaskStatus.Working);
      selectTask(task);
      
      // Trigger execution
      window.dispatchEvent(new CustomEvent('start-task-execution', {
        detail: { taskId }
      }));
      
      toast({
        title: t('task.taskStarted'),
        description: t('task.interactWithAi'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: `${t('task.runTaskError')}: ${error}`,
        variant: "destructive",
      });
    }
  }, [currentProject, updateTaskStatus, selectTask, toast, t]);
  
  const handleDeleteTask = useCallback(async (taskId: string) => {
    const task = selectedTask?.id === taskId ? selectedTask : null;
    const confirmed = window.confirm(
      t('task.deleteConfirm', { title: task?.title || 'this task' })
    );
    
    if (!confirmed) return;
    
    try {
      await deleteTask(taskId);
      toast({
        title: t('common.success'),
        description: t('task.taskDeleted'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: `${t('task.deleteTaskError')}: ${error}`,
        variant: "destructive",
      });
    }
  }, [selectedTask, deleteTask, toast, t]);
  
  return {
    handleCreateTask,
    handleRunTask,
    handleDeleteTask,
  };
}
```

### Keyboard Shortcuts Hook

```typescript
// hooks/ui/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { useLayoutStore } from '@/stores/ui/useLayoutStore';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';

interface ShortcutConfig {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const { togglePanel } = useLayoutStore();
  const { toast } = useToast();
  
  const shortcuts: ShortcutConfig[] = [
    {
      key: 'b',
      ctrlOrCmd: true,
      action: () => togglePanel('left'),
      description: 'Toggle left panel'
    },
    {
      key: 'j',
      ctrlOrCmd: true,
      action: () => togglePanel('bottom'),
      description: 'Toggle bottom panel'
    },
    {
      key: 'k',
      ctrlOrCmd: true,
      action: () => togglePanel('right'),
      description: 'Toggle right panel'
    },
    {
      key: 'l',
      ctrlOrCmd: true,
      action: async () => {
        try {
          await invoke('show_log_viewer');
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to open log viewer',
            variant: 'destructive',
          });
        }
      },
      description: 'Open log viewer'
    }
  ];
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcuts.find(s => {
        const keyMatch = e.key.toLowerCase() === s.key;
        const ctrlMatch = s.ctrlOrCmd ? (e.metaKey || e.ctrlKey) : true;
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = s.alt ? e.altKey : !e.altKey;
        
        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });
      
      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
  
  return { shortcuts };
}
```

## 3. Event System Implementation

### Complete EventBus with Type Safety

```typescript
// stores/infrastructure/useEventBus.ts
import { create } from 'zustand';
import { listen, Event as TauriEvent, emit } from '@tauri-apps/api/event';

type EventHandler<T = any> = (payload: T) => void;
type UnlistenFn = () => void;

interface EventBusStore {
  listeners: Map<string, Set<EventHandler>>;
  tauriUnlisteners: Map<string, UnlistenFn>;
  
  // Subscribe to events
  subscribe: <T>(event: string, handler: EventHandler<T>) => UnlistenFn;
  
  // Subscribe to Tauri events
  subscribeTauri: <T>(event: string, handler: EventHandler<T>) => Promise<UnlistenFn>;
  
  // Emit events
  emit: <T>(event: string, payload: T) => Promise<void>;
  
  // Cleanup
  cleanup: () => void;
}

export const useEventBus = create<EventBusStore>((set, get) => ({
  listeners: new Map(),
  tauriUnlisteners: new Map(),
  
  subscribe: (event, handler) => {
    const { listeners } = get();
    
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    
    listeners.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = listeners.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          listeners.delete(event);
        }
      }
    };
  },
  
  subscribeTauri: async (event, handler) => {
    const { tauriUnlisteners } = get();
    
    // Unsubscribe previous listener if exists
    const existingUnlisten = tauriUnlisteners.get(event);
    if (existingUnlisten) {
      existingUnlisten();
    }
    
    // Create new listener
    const unlisten = await listen<any>(event, (e: TauriEvent<any>) => {
      handler(e.payload);
    });
    
    tauriUnlisteners.set(event, unlisten);
    
    // Also subscribe locally
    const unsubscribe = get().subscribe(event, handler);
    
    // Return combined unsubscribe
    return () => {
      unlisten();
      unsubscribe();
      tauriUnlisteners.delete(event);
    };
  },
  
  emit: async (event, payload) => {
    // Emit to local listeners
    const { listeners } = get();
    const handlers = listeners.get(event);
    
    if (handlers) {
      handlers.forEach(handler => handler(payload));
    }
    
    // Also emit as Tauri event
    await emit(event, payload);
  },
  
  cleanup: () => {
    const { tauriUnlisteners, listeners } = get();
    
    // Cleanup Tauri listeners
    tauriUnlisteners.forEach(unlisten => unlisten());
    tauriUnlisteners.clear();
    
    // Clear local listeners
    listeners.clear();
    
    set({ listeners: new Map(), tauriUnlisteners: new Map() });
  }
}));

// Typed event definitions
export interface AppEvents {
  'task-status-updated': Task;
  'coding-agent-message': { execution_id: string; message: UnifiedMessage };
  'menu-settings': void;
  'menu-view-logs': void;
  'project-selected': { projectId: string };
  'start-task-execution': { taskId: string };
}

// Type-safe event bus hooks
export function useAppEvent<K extends keyof AppEvents>(
  event: K,
  handler: (payload: AppEvents[K]) => void
) {
  const { subscribeTauri, cleanup } = useEventBus();
  
  useEffect(() => {
    let unsubscribe: UnlistenFn | null = null;
    
    subscribeTauri(event, handler).then(unsub => {
      unsubscribe = unsub;
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [event, handler]);
}
```

## 4. Feature Module Examples

### TasksView Feature Module

```typescript
// features/tasks/TasksView.tsx
import { useEffect } from 'react';
import { ResizableLayout } from '@/components/layout/ResizableLayout';
import { TaskKanbanBoard } from '@/components/tasks/kanban/TaskKanbanBoard';
import { TaskDetailsPanel } from '@/components/tasks/details/TaskDetailsPanel';
import { TaskConversation } from '@/components/tasks/TaskConversation';
import { useProjectStore } from '@/stores/domain/useProjectStore';
import { useTaskStore } from '@/stores/domain/useTaskStore';
import { useLayoutStore } from '@/stores/ui/useLayoutStore';
import { useTaskOperations } from '@/hooks/domain/useTaskOperations';
import { useKeyboardShortcuts } from '@/hooks/ui/useKeyboardShortcuts';

export function TasksView() {
  const { currentProject } = useProjectStore();
  const { tasks, selectedTask, loading, loadTasks } = useTaskStore();
  const { 
    leftPanelVisible, 
    rightPanelVisible, 
    bottomPanelVisible,
    leftPanelSize,
    centerPanelSize,
    rightPanelSize
  } = useLayoutStore();
  
  const { handleCreateTask, handleRunTask, handleDeleteTask } = useTaskOperations();
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();
  
  // Load tasks when project changes
  useEffect(() => {
    if (currentProject) {
      loadTasks(currentProject.id);
    }
  }, [currentProject, loadTasks]);
  
  if (!currentProject) {
    return null;
  }
  
  return (
    <ResizableLayout
      direction="horizontal"
      defaultSizes={[leftPanelSize, centerPanelSize, rightPanelSize]}
      minSizes={[15, 30, 20]}
      maxSizes={[30, 100, 40]}
      storageKey="main-layout"
    >
      {/* Left Panel - Task Kanban */}
      {leftPanelVisible && (
        <TaskKanbanBoard
          tasks={tasks}
          loading={loading}
          onCreateTask={() => handleCreateTask({})}
          onRunTask={handleRunTask}
          onDeleteTask={handleDeleteTask}
        />
      )}
      
      {/* Center Panel - Task Details */}
      <TaskDetailsPanel
        task={selectedTask}
        project={currentProject}
        bottomPanelVisible={bottomPanelVisible}
      />
      
      {/* Right Panel - Task Conversation */}
      {rightPanelVisible && (
        <TaskConversation
          task={selectedTask}
          project={currentProject}
        />
      )}
    </ResizableLayout>
  );
}
```

### Minimal App.tsx

```typescript
// app/App.tsx
import { AppProviders } from './AppProviders';
import { AppShell } from './AppShell';

function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}

export default App;
```

### AppShell with Navigation

```typescript
// app/AppShell.tsx
import { useEffect } from 'react';
import { ProjectsView } from '@/features/projects/ProjectsView';
import { TasksView } from '@/features/tasks/TasksView';
import { SettingsView } from '@/features/settings/SettingsView';
import { useProjectStore } from '@/stores/domain/useProjectStore';
import { useSettingsStore } from '@/stores/ui/useSettingsStore';
import { useTauriEvents } from '@/hooks/infrastructure/useTauriEvents';
import { useLogger } from '@/hooks/infrastructure/useLogger';

export function AppShell() {
  const { currentProject } = useProjectStore();
  const { showSettings } = useSettingsStore();
  const { initLogger } = useLogger();
  
  // Initialize infrastructure
  useTauriEvents();
  
  useEffect(() => {
    initLogger();
  }, [initLogger]);
  
  // Settings view takes precedence
  if (showSettings) {
    return <SettingsView />;
  }
  
  // Project selection view
  if (!currentProject) {
    return <ProjectsView />;
  }
  
  // Main tasks view
  return <TasksView />;
}
```

## 5. Testing Examples

### Store Testing

```typescript
// __tests__/stores/domain/useTaskStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTaskStore } from '@/stores/domain/useTaskStore';
import { taskApi } from '@/lib/api';

jest.mock('@/lib/api');

describe('useTaskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: [],
      selectedTask: null,
      loading: false,
      error: null
    });
  });
  
  it('should load tasks', async () => {
    const mockTasks = [
      { id: '1', title: 'Task 1', status: 'backlog' },
      { id: '2', title: 'Task 2', status: 'working' }
    ];
    
    (taskApi.list as jest.Mock).mockResolvedValue(mockTasks);
    
    const { result } = renderHook(() => useTaskStore());
    
    await act(async () => {
      await result.current.loadTasks('project-1');
    });
    
    expect(result.current.tasks).toEqual(mockTasks);
    expect(result.current.loading).toBe(false);
  });
  
  it('should handle optimistic updates', async () => {
    const initialTask = { id: '1', title: 'Task 1', status: 'backlog' as const };
    useTaskStore.setState({ tasks: [initialTask] });
    
    const { result } = renderHook(() => useTaskStore());
    
    act(() => {
      result.current.optimisticUpdateStatus('1', 'working');
    });
    
    expect(result.current.tasks[0].status).toBe('working');
  });
});
```

### Hook Testing

```typescript
// __tests__/hooks/domain/useTaskOperations.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTaskOperations } from '@/hooks/domain/useTaskOperations';
import { useTaskStore } from '@/stores/domain/useTaskStore';
import { useProjectStore } from '@/stores/domain/useProjectStore';

jest.mock('@/stores/domain/useTaskStore');
jest.mock('@/stores/domain/useProjectStore');

describe('useTaskOperations', () => {
  it('should create task with auto-start', async () => {
    const mockCreateTask = jest.fn().mockResolvedValue({ id: '1', title: 'New Task' });
    const mockUpdateStatus = jest.fn();
    
    (useTaskStore as jest.Mock).mockReturnValue({
      createTask: mockCreateTask,
      updateTaskStatus: mockUpdateStatus,
      selectTask: jest.fn()
    });
    
    (useProjectStore as jest.Mock).mockReturnValue({
      currentProject: { id: 'project-1', name: 'Test Project' }
    });
    
    const { result } = renderHook(() => useTaskOperations());
    
    await act(async () => {
      await result.current.handleCreateTask(
        { title: 'New Task', project_id: 'project-1' },
        true // shouldStart
      );
    });
    
    expect(mockCreateTask).toHaveBeenCalled();
    expect(mockUpdateStatus).toHaveBeenCalledWith('1', 'working');
  });
});
```

## Summary

This refactoring provides:

1. **Clear separation of concerns** with distinct layers
2. **Type-safe event system** with defined event types
3. **Testable architecture** with mockable dependencies
4. **Scalable structure** that can grow with the application
5. **Better developer experience** with intuitive organization

The migration can be done incrementally, starting with the store layer and gradually moving business logic out of components into hooks.