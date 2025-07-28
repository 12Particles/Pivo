# RFC 0001: Comprehensive Architecture Refactoring

**Status**: Draft  
**Date**: 2025-01-22  
**Author**: Architecture Team  

## Summary

This RFC proposes a comprehensive refactoring of the entire Pivo application architecture, addressing issues across frontend, backend, and integration layers. While the initial focus was on the monolithic `App.tsx` (680+ lines), deeper analysis reveals systemic architectural issues that require a holistic approach to create a truly scalable and maintainable application.

## Motivation

### Current Problems

#### Frontend Issues

1. **Monolithic Components**
   - `App.tsx`: 680+ lines mixing routing, state, UI logic, and business logic
   - `TaskConversation.tsx`: Complex component with imperative handles and mixed responsibilities
   - Components directly managing execution state, API calls, and UI rendering

2. **State Management Fragmentation**
   - ExecutionStore using complex Map-based structures difficult to debug
   - Local state scattered across components without clear ownership
   - Manual synchronization between attempt executions and task summaries
   - No proper state machines for execution lifecycle

3. **Event System Issues**
   - Tauri events handled in multiple places without centralization
   - Memory leaks from unmanaged event listeners
   - Race conditions in execution state management
   - Inconsistent event handling patterns

#### Backend Issues

1. **Service Layer Problems**
   - Fat services (e.g., TaskService handles tasks, attempts, and conversations)
   - Mixed concerns (database ops, business logic, git operations in services)
   - No repository pattern - direct SQL in service layer
   - No clear domain boundaries

2. **Event Emission**
   - Services directly emit events, coupling backend to UI
   - No event bus or mediator pattern
   - Complex state synchronization between backend and frontend

3. **Data Persistence**
   - JSON columns for complex data instead of proper relations
   - Ad-hoc migrations without versioning
   - Database schema tightly coupled to domain models

#### Integration Issues

1. **API Layer**
   - 400+ lines of repetitive invoke calls in `api.ts`
   - No request/response abstraction
   - Manual type definitions that can drift from backend

2. **Type System**
   - Duplicate type definitions across layers
   - String-based enums instead of proper TypeScript enums
   - Loose typing with `any` in critical places

3. **Error Handling**
   - Inconsistent error handling patterns
   - Silent failures in some operations
   - No retry logic for failed operations

## Proposed Architecture

### High-Level Overview

```
Application Architecture
├── Frontend Layer
│   ├── App Shell          (Bootstrap, providers, routing)
│   ├── State Management   (Domain stores, UI stores, infrastructure)
│   ├── Business Logic     (Hooks, services, orchestration)
│   ├── Feature Modules    (Self-contained feature areas)
│   └── Infrastructure     (API client, event bus, utilities)
│
├── Integration Layer
│   ├── Type Contracts     (Shared types, generated from backend)
│   ├── API Gateway        (Abstracted Tauri commands)
│   ├── Event Bus          (Bidirectional event system)
│   └── Error Handling     (Retry, circuit breaker patterns)
│
└── Backend Layer
    ├── Command Layer      (Thin command handlers)
    ├── Service Layer      (Business logic, orchestration)
    ├── Domain Layer       (Core business entities)
    ├── Repository Layer   (Data access abstraction)
    └── Infrastructure     (Events, logging, cross-cutting)
```

### Directory Structure

#### Frontend Structure
```
src/
├── app/                          # Application core
│   ├── App.tsx                   # Root component (minimal)
│   ├── AppProviders.tsx          # Provider composition
│   ├── AppShell.tsx              # Layout shell
│   └── AppRouter.tsx             # Route management
│
├── stores/                       # State management (Zustand)
│   ├── domain/                   # Business domain stores
│   │   ├── useProjectStore.ts
│   │   ├── useTaskStore.ts
│   │   ├── useExecutionStore.ts  # Refactored with state machines
│   │   └── useAttemptStore.ts
│   │
│   ├── ui/                       # UI state stores
│   │   ├── useLayoutStore.ts
│   │   ├── useDialogStore.ts
│   │   └── usePreferenceStore.ts
│   │
│   └── infrastructure/           # Infrastructure stores
│       ├── useEventBus.ts        # Centralized event management
│       ├── useApiClient.ts       # API abstraction layer
│       └── useErrorHandler.ts    # Global error handling
│
├── services/                     # Frontend services
│   ├── execution/                # Execution management
│   │   ├── ExecutionService.ts   # Orchestrates execution lifecycle
│   │   ├── ExecutionStateMachine.ts
│   │   └── MessageProcessor.ts   # Processes unified messages
│   │
│   └── api/                      # API services
│       ├── ApiClient.ts          # Base API client with retry
│       ├── TaskApi.ts            # Task-specific API calls
│       └── ProjectApi.ts         # Project-specific API calls
│
├── hooks/                        # Business logic hooks
│   ├── domain/
│   │   ├── useProjectManagement.ts
│   │   ├── useTaskOperations.ts
│   │   ├── useExecutionControl.ts # Uses ExecutionService
│   │   └── useConversation.ts    # Replaces complex conversation hooks
│   │
│   └── infrastructure/
│       ├── useTauriEvents.ts     # Centralized event subscriptions
│       ├── useKeyboardShortcuts.ts
│       └── useLogger.ts
│
├── features/                     # Feature modules
│   ├── projects/
│   │   ├── ProjectsView.tsx
│   │   ├── hooks/
│   │   └── components/
│   │
│   ├── tasks/
│   │   ├── TasksView.tsx
│   │   ├── TaskConversation.tsx  # Simplified, uses hooks
│   │   ├── hooks/
│   │   └── components/
│   │
│   └── settings/
│       ├── SettingsView.tsx
│       └── components/
│
├── lib/                          # Core utilities
│   ├── api/                      # API layer (refactored)
│   │   ├── client.ts             # Base Tauri client
│   │   ├── types.ts              # Generated from backend
│   │   └── endpoints/            # Organized endpoints
│   ├── events/                   # Event system
│   │   ├── EventBus.ts
│   │   ├── EventTypes.ts
│   │   └── handlers/
│   └── utils/
│       ├── logger.ts
│       └── errors.ts
```

#### Backend Structure
```
src-tauri/src/
├── commands/                     # Thin command layer
│   ├── mod.rs
│   ├── project_commands.rs       # Delegates to services
│   ├── task_commands.rs
│   └── execution_commands.rs
│
├── domain/                       # Core business logic
│   ├── mod.rs
│   ├── entities/                 # Domain entities
│   │   ├── project.rs
│   │   ├── task.rs
│   │   ├── attempt.rs
│   │   └── execution.rs
│   ├── value_objects/            # Value objects
│   │   ├── task_status.rs
│   │   └── agent_type.rs
│   └── services/                 # Domain services
│       ├── task_service.rs       # Business logic only
│       └── execution_service.rs
│
├── application/                  # Application services
│   ├── mod.rs
│   ├── project_app_service.rs    # Orchestration
│   ├── task_app_service.rs
│   └── execution_app_service.rs
│
├── infrastructure/               # Infrastructure layer
│   ├── mod.rs
│   ├── persistence/              # Data access
│   │   ├── repositories/         # Repository pattern
│   │   │   ├── project_repository.rs
│   │   │   ├── task_repository.rs
│   │   │   └── attempt_repository.rs
│   │   ├── migrations/           # Versioned migrations
│   │   └── db.rs                 # Database setup
│   ├── events/                   # Event system
│   │   ├── event_bus.rs          # Central event dispatcher
│   │   ├── event_types.rs
│   │   └── handlers/
│   └── external/                 # External integrations
│       ├── git_service.rs
│       └── ai_agents/
│           ├── claude_agent.rs
│           └── gemini_agent.rs
│
└── shared/                       # Shared types
    ├── mod.rs
    └── types.rs                  # Types shared with frontend
```

## Detailed Design

### 1. Frontend Architecture

#### State Management with State Machines

Replace the complex Map-based ExecutionStore with state machines:

```typescript
// services/execution/ExecutionStateMachine.ts
import { createMachine, interpret } from 'xstate';

export const executionMachine = createMachine({
  id: 'execution',
  initial: 'idle',
  context: {
    attemptId: null,
    executionId: null,
    messages: [],
    error: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'starting',
          actions: 'setAttemptContext'
        }
      }
    },
    starting: {
      invoke: {
        src: 'startExecution',
        onDone: {
          target: 'running',
          actions: 'setExecutionId'
        },
        onError: {
          target: 'error',
          actions: 'setError'
        }
      }
    },
    running: {
      on: {
        MESSAGE: {
          actions: 'addMessage'
        },
        STOP: {
          target: 'stopping'
        },
        COMPLETE: {
          target: 'completed'
        },
        ERROR: {
          target: 'error',
          actions: 'setError'
        }
      }
    },
    stopping: {
      invoke: {
        src: 'stopExecution',
        onDone: 'idle',
        onError: 'error'
      }
    },
    completed: {
      type: 'final'
    },
    error: {
      on: {
        RETRY: 'starting',
        RESET: 'idle'
      }
    }
  }
});
```

#### Simplified Store Layer

```typescript
// stores/domain/useExecutionStore.ts (refactored)
import { create } from 'zustand';
import { ExecutionService } from '@/services/execution/ExecutionService';

interface ExecutionStore {
  // Simplified state
  activeExecutions: Map<string, ExecutionState>; // attemptId -> state
  
  // Actions delegated to service
  startExecution: (attemptId: string, config: ExecutionConfig) => Promise<void>;
  stopExecution: (attemptId: string) => Promise<void>;
  sendMessage: (attemptId: string, message: string, images?: string[]) => Promise<void>;
  
  // Selectors
  getExecutionState: (attemptId: string) => ExecutionState | undefined;
  isExecutionRunning: (attemptId: string) => boolean;
}

export const useExecutionStore = create<ExecutionStore>((set, get) => {
  const executionService = new ExecutionService();
  
  return {
    activeExecutions: new Map(),
    
    startExecution: async (attemptId, config) => {
      const machine = executionService.createExecution(attemptId, config);
      
      machine.subscribe((state) => {
        set((store) => {
          const newMap = new Map(store.activeExecutions);
          newMap.set(attemptId, state.context);
          return { activeExecutions: newMap };
        });
      });
      
      machine.send('START');
    },
    
    // ... other actions
  };
});
```

#### UI Stores
Manage UI-specific state:

```typescript
// stores/ui/useLayoutStore.ts
interface LayoutStore {
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  bottomPanelVisible: boolean;
  
  togglePanel: (panel: 'left' | 'right' | 'bottom') => void;
  resetLayout: () => void;
}
```

#### Simplified Component Architecture

```typescript
// features/tasks/TaskConversation.tsx (refactored)
export function TaskConversation({ task, project }: TaskConversationProps) {
  const { currentAttempt, messages, sendMessage } = useConversation(task.id);
  const { isRunning, startExecution, stopExecution } = useExecutionControl(currentAttempt?.id);
  
  // No imperative handles, no complex state management
  // Just declarative UI based on hooks
  
  return (
    <ConversationContainer>
      <ConversationHeader 
        isRunning={isRunning}
        onStop={stopExecution}
      />
      <MessageList messages={messages} />
      <MessageInput 
        onSend={sendMessage}
        disabled={!currentAttempt || isRunning}
      />
    </ConversationContainer>
  );
}
```

### 2. Backend Architecture

#### Domain-Driven Design with Clean Architecture

```rust
// domain/entities/task.rs
#[derive(Debug, Clone)]
pub struct Task {
    id: TaskId,
    project_id: ProjectId,
    title: String,
    description: Option<String>,
    status: TaskStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl Task {
    pub fn new(project_id: ProjectId, title: String) -> Self {
        Self {
            id: TaskId::new(),
            project_id,
            title,
            description: None,
            status: TaskStatus::Backlog,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
    
    pub fn update_status(&mut self, status: TaskStatus) -> Result<(), DomainError> {
        // Business logic for status transitions
        match (&self.status, &status) {
            (TaskStatus::Done, _) => Err(DomainError::InvalidTransition),
            _ => {
                self.status = status;
                self.updated_at = Utc::now();
                Ok(())
            }
        }
    }
}
```

#### Repository Pattern

```rust
// domain/repositories/task_repository.rs
#[async_trait]
pub trait TaskRepository: Send + Sync {
    async fn find_by_id(&self, id: &TaskId) -> Result<Option<Task>, RepositoryError>;
    async fn find_by_project(&self, project_id: &ProjectId) -> Result<Vec<Task>, RepositoryError>;
    async fn save(&self, task: &Task) -> Result<(), RepositoryError>;
    async fn delete(&self, id: &TaskId) -> Result<(), RepositoryError>;
}

// infrastructure/persistence/repositories/task_repository_impl.rs
pub struct SqliteTaskRepository {
    pool: Arc<SqlitePool>,
}

#[async_trait]
impl TaskRepository for SqliteTaskRepository {
    async fn find_by_id(&self, id: &TaskId) -> Result<Option<Task>, RepositoryError> {
        // Implementation with proper mapping
    }
}
```

#### Application Services

```rust
// application/task_app_service.rs
pub struct TaskApplicationService {
    task_repo: Arc<dyn TaskRepository>,
    event_bus: Arc<EventBus>,
    tx_manager: Arc<TransactionManager>,
}

impl TaskApplicationService {
    pub async fn create_task(
        &self,
        command: CreateTaskCommand,
    ) -> Result<TaskDto, ApplicationError> {
        self.tx_manager.transaction(async |tx| {
            // Create domain entity
            let task = Task::new(command.project_id, command.title);
            
            // Save through repository
            self.task_repo.save(&task).await?;
            
            // Emit domain event
            self.event_bus.publish(TaskCreated {
                task_id: task.id.clone(),
                project_id: task.project_id.clone(),
            }).await?;
            
            Ok(TaskDto::from(task))
        }).await
    }
}
```

### 3. Integration Layer

#### Type Generation

```typescript
// lib/api/types.ts (generated from Rust types)
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export enum TaskStatus {
  Backlog = 'backlog',
  Working = 'working',
  Reviewing = 'reviewing',
  Done = 'done',
}
```

#### API Client with Retry Logic

```typescript
// services/api/ApiClient.ts
export class ApiClient {
  private retryCount = 3;
  private retryDelay = 1000;
  
  async invoke<T>(command: string, args?: any): Promise<T> {
    return this.withRetry(async () => {
      try {
        return await invoke<T>(command, args);
      } catch (error) {
        throw new ApiError(command, error);
      }
    });
  }
  
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < this.retryCount; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < this.retryCount - 1) {
          await this.delay(this.retryDelay * Math.pow(2, i));
        }
      }
    }
    
    throw lastError!;
  }
}
```

#### Centralized Event Bus

```typescript
// lib/events/EventBus.ts
export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private tauriUnlisteners = new Map<string, UnlistenFn>();
  
  async subscribe<T extends keyof AppEvents>(
    event: T,
    handler: (payload: AppEvents[T]) => void
  ): Promise<UnsubscribeFn> {
    // Subscribe to Tauri events
    const unlisten = await listen<AppEvents[T]>(event, (e) => {
      handler(e.payload);
    });
    
    this.tauriUnlisteners.set(event, unlisten);
    
    return () => {
      unlisten();
      this.tauriUnlisteners.delete(event);
    };
  }
  
  async emit<T extends keyof AppEvents>(
    event: T,
    payload: AppEvents[T]
  ): Promise<void> {
    await emit(event, payload);
  }
}
```

### 4. Hook Layer Architecture

Simplified hooks that delegate to services:

```typescript
// hooks/domain/useProjectManagement.ts
export function useProjectManagement() {
  const { currentProject, setCurrentProject } = useProjectStore();
  const { resetTasks } = useTaskStore();
  const { showToast } = useToastNotifications();
  
  const selectProject = useCallback(async (project: Project) => {
    setCurrentProject(project);
    await resetTasks();
    await loadTasksForProject(project.id);
    showToast({ title: 'Project selected', description: project.name });
  }, []);
  
  return { currentProject, selectProject };
}
```

### 5. Error Handling Strategy

```typescript
// lib/errors/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to backend
    logger.error('React error boundary', { error, errorInfo });
    
    // Show user-friendly error
    this.setState({
      hasError: true,
      error: normalizeError(error)
    });
  }
}

// lib/errors/handlers.ts
export function handleApiError(error: unknown): UserFacingError {
  if (error instanceof ApiError) {
    return {
      title: 'Operation failed',
      message: getErrorMessage(error),
      retryable: isRetryable(error)
    };
  }
  
  return {
    title: 'Unexpected error',
    message: 'Please try again later',
    retryable: true
  };
}
```

```typescript
// stores/infrastructure/useEventBus.ts
class EventBus {
  private listeners = new Map<string, Set<Function>>();
  private tauriUnlisteners = new Map<string, Function>();
  
  async subscribe(event: string, handler: Function) {
    // Subscribe to Tauri event
    const unlisten = await listen(event, (e) => handler(e.payload));
    this.tauriUnlisteners.set(event, unlisten);
  }
  
  cleanup() {
    this.tauriUnlisteners.forEach(unlisten => unlisten());
  }
}
```

### 6. Performance Optimizations

#### Virtual Scrolling for Messages

```typescript
// components/conversation/VirtualMessageList.tsx
import { VirtualList } from '@tanstack/react-virtual';

export function VirtualMessageList({ messages }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <Message message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Optimistic Updates

```typescript
// hooks/domain/useTaskOperations.ts
export function useTaskOperations() {
  const { updateTaskStatus, revertTaskStatus } = useTaskStore();
  
  const updateStatus = async (taskId: string, newStatus: TaskStatus) => {
    const previousStatus = getTaskStatus(taskId);
    
    // Optimistic update
    updateTaskStatus(taskId, newStatus);
    
    try {
      await taskApi.updateStatus(taskId, newStatus);
    } catch (error) {
      // Revert on failure
      revertTaskStatus(taskId, previousStatus);
      throw error;
    }
  };
}
```

```typescript
// app/App.tsx
function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}

// app/AppProviders.tsx
function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <TauriEventProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </TauriEventProvider>
    </QueryClientProvider>
  );
}

// app/AppShell.tsx
function AppShell() {
  const { currentProject } = useProjectStore();
  
  if (!currentProject) {
    return <ProjectsView />;
  }
  
  return <TasksView />;
}
```

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
1. **Event System & API Layer**
   - Implement centralized EventBus
   - Create ApiClient with retry logic
   - Generate TypeScript types from Rust
   - Set up error handling infrastructure

2. **State Management Refactoring**
   - Implement state machines for execution flow
   - Create domain stores (Project, Task)
   - Refactor ExecutionStore with simplified structure
   - Add UI stores (Layout, Dialog)

### Phase 2: Frontend Refactoring (Week 3-4)
1. **Component Decomposition**
   - Extract business logic to hooks
   - Simplify TaskConversation component
   - Create feature modules structure
   - Refactor App.tsx to minimal shell

2. **Service Layer**
   - Implement ExecutionService
   - Create MessageProcessor for unified messages
   - Add conversation management service

### Phase 3: Backend Refactoring (Week 5-6)
1. **Domain Layer**
   - Extract domain entities from models
   - Implement domain services
   - Add business rule validation

2. **Repository Pattern**
   - Create repository interfaces
   - Implement SQLite repositories
   - Add transaction management

3. **Application Services**
   - Refactor fat services into focused services
   - Implement command/query separation
   - Add proper error handling

### Phase 4: Integration & Testing (Week 7-8)
1. **Integration Layer**
   - Connect new backend services to commands
   - Update event emission to use EventBus
   - Implement end-to-end type safety

2. **Testing & Performance**
   - Add unit tests for all layers
   - Integration tests for critical paths
   - Performance testing and optimization
   - Memory leak detection and fixes

### Phase 5: Rollout (Week 9)
1. **Gradual Migration**
   - Feature flag new architecture
   - Migrate one feature at a time
   - Monitor performance and errors
   - Complete migration and cleanup

## Benefits

### Technical Benefits

1. **Maintainability**
   - Clear separation of concerns across all layers
   - Single responsibility principle enforced
   - Easier debugging with state machines
   - Centralized error handling

2. **Scalability**
   - Domain-driven design allows business growth
   - Modular architecture supports team scaling
   - Clear boundaries for microservice extraction
   - Event-driven architecture enables loose coupling

3. **Performance**
   - Virtual scrolling for large message lists
   - Optimistic updates for better UX
   - Efficient state updates with Zustand
   - Reduced re-renders with proper memoization
   - Background processing with Web Workers (future)

4. **Reliability**
   - Retry logic for network failures
   - State machines prevent invalid states
   - Proper error boundaries
   - Transaction support for data integrity

### Developer Experience

1. **Code Organization**
   - Intuitive directory structure
   - Clear naming conventions
   - Consistent patterns across codebase

2. **Type Safety**
   - End-to-end type safety
   - Generated types from backend
   - Compile-time error detection

3. **Testing**
   - Testable architecture at all layers
   - Mockable dependencies
   - Integration test support

4. **Documentation**
   - Self-documenting code structure
   - Clear architectural boundaries
   - Reduced onboarding time

## Risks and Mitigations

### Risk 1: Large-Scale Refactoring Disruption
- **Impact**: Development velocity slowdown, potential bugs
- **Mitigation**:
  - Feature flags for gradual rollout
  - Parallel development tracks
  - Comprehensive test suite before migration
  - Incremental migration by feature

### Risk 2: State Management Complexity
- **Impact**: State machines might be overkill for simple flows
- **Mitigation**:
  - Use state machines only for complex flows (execution)
  - Simple Zustand stores for basic state
  - Clear guidelines on when to use each approach

### Risk 3: Backend Breaking Changes
- **Impact**: Frontend-backend contract violations
- **Mitigation**:
  - Implement versioned APIs
  - Generate types from Rust
  - Integration tests for all endpoints
  - Gradual deprecation of old endpoints

### Risk 4: Performance Degradation
- **Impact**: Slower app performance during migration
- **Mitigation**:
  - Performance benchmarks before/after
  - Profiling at each phase
  - Optimization budget per feature
  - Rollback plan if metrics degrade

### Risk 5: Team Resistance
- **Impact**: Slow adoption, inconsistent implementation
- **Mitigation**:
  - Team workshops on new patterns
  - Pair programming during migration
  - Clear documentation and examples
  - Champions for each architectural layer

## Alternatives Considered

### 1. Redux Toolkit
- **Pros**: Mature, time-travel debugging
- **Cons**: More boilerplate, steeper learning curve
- **Decision**: Zustand is simpler and sufficient for our needs

### 2. MobX
- **Pros**: Reactive, less boilerplate
- **Cons**: Magic behavior, harder to debug
- **Decision**: Zustand is more explicit and predictable

### 3. Minimal Refactoring
- **Pros**: Less risk, faster
- **Cons**: Doesn't solve core issues
- **Decision**: Full refactoring needed for long-term maintainability

## Implementation Checklist

### Phase 1: Foundation
- [ ] **Event System**
  - [ ] Implement EventBus class
  - [ ] Define AppEvents type interface
  - [ ] Create event handlers structure
  - [ ] Add cleanup mechanisms

- [ ] **API Layer**
  - [ ] Create ApiClient with retry logic
  - [ ] Set up type generation from Rust
  - [ ] Implement error handling
  - [ ] Add request/response logging

- [ ] **State Management**
  - [ ] Install XState for state machines
  - [ ] Create execution state machine
  - [ ] Refactor ExecutionStore
  - [ ] Implement domain stores

### Phase 2: Frontend
- [ ] **Services**
  - [ ] ExecutionService implementation
  - [ ] MessageProcessor service
  - [ ] ConversationService

- [ ] **Components**
  - [ ] Simplify TaskConversation
  - [ ] Extract business logic to hooks
  - [ ] Create AppShell
  - [ ] Refactor App.tsx

### Phase 3: Backend
- [ ] **Domain Layer**
  - [ ] Extract domain entities
  - [ ] Define value objects
  - [ ] Implement domain services
  - [ ] Add domain events

- [ ] **Infrastructure**
  - [ ] Implement repositories
  - [ ] Add transaction management
  - [ ] Create EventBus for backend
  - [ ] Set up proper migrations

- [ ] **Application Layer**
  - [ ] Refactor services
  - [ ] Implement CQRS pattern
  - [ ] Add proper validation

### Phase 4: Integration
- [ ] **Connect Layers**
  - [ ] Update Tauri commands
  - [ ] Connect to new services
  - [ ] Update event flow
  - [ ] Test end-to-end

- [ ] **Testing**
  - [ ] Unit tests (80% coverage)
  - [ ] Integration tests
  - [ ] E2E tests for critical paths
  - [ ] Performance benchmarks

### Phase 5: Rollout
- [ ] **Migration**
  - [ ] Set up feature flags
  - [ ] Create rollback plan
  - [ ] Monitor metrics
  - [ ] Complete migration

- [ ] **Documentation**
  - [ ] Architecture documentation
  - [ ] Migration guide
  - [ ] Best practices guide
  - [ ] Team training

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Tauri Architecture Guide](https://tauri.app/v1/guides/architecture/)
- [React Architecture Best Practices](https://react.dev/learn/thinking-in-react)
- [Feature-Sliced Design](https://feature-sliced.design/)