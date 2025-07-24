# Architecture Decision Records for RFC 0001

## ADR-001: State Management - Zustand over Redux

**Date**: 2025-01-22  
**Status**: Accepted

### Context
We need a state management solution that balances simplicity with power for our refactored architecture.

### Decision
We will use Zustand for state management instead of Redux Toolkit or MobX.

### Rationale
1. **Simplicity**: Zustand has minimal boilerplate compared to Redux
2. **TypeScript**: Excellent TypeScript support out of the box
3. **Performance**: Fine-grained subscriptions prevent unnecessary re-renders
4. **Size**: Much smaller bundle size (8KB vs Redux Toolkit's 40KB+)
5. **Learning Curve**: Team can be productive immediately

### Consequences
- ✅ Faster development with less boilerplate
- ✅ Better performance with selective subscriptions
- ✅ Easier testing with simple stores
- ❌ Less ecosystem support compared to Redux
- ❌ No time-travel debugging (acceptable trade-off)

---

## ADR-002: State Machines for Complex Flows

**Date**: 2025-01-22  
**Status**: Accepted

### Context
The execution flow for coding agents is complex with many possible states and transitions.

### Decision
Use XState for modeling execution lifecycle as state machines.

### Rationale
1. **Explicit States**: Makes all possible states visible and documented
2. **Invalid State Prevention**: Impossible to reach invalid states
3. **Visual Debugging**: Can visualize state machines
4. **Event-Driven**: Natural fit for our event-based architecture
5. **Testing**: Easier to test all state transitions

### Implementation
```typescript
// Only use for complex flows:
- Execution lifecycle (starting → running → completed/error)
- Multi-step wizards
- Complex UI interactions

// Don't use for:
- Simple boolean states
- Basic CRUD operations
- UI toggle states
```

---

## ADR-003: Repository Pattern for Data Access

**Date**: 2025-01-22  
**Status**: Accepted

### Context
Backend services directly execute SQL queries, creating tight coupling between business logic and data access.

### Decision
Implement Repository pattern to abstract data access from business logic.

### Rationale
1. **Testability**: Can mock repositories for unit testing
2. **Flexibility**: Can change database without affecting business logic
3. **Consistency**: Standardized data access patterns
4. **Caching**: Central place to implement caching strategies

### Example
```rust
// Domain layer defines interface
trait TaskRepository {
    async fn find_by_id(&self, id: &TaskId) -> Result<Option<Task>>;
    async fn save(&self, task: &Task) -> Result<()>;
}

// Infrastructure layer implements
struct SqliteTaskRepository { ... }
impl TaskRepository for SqliteTaskRepository { ... }
```

---

## ADR-004: Event-Driven Architecture

**Date**: 2025-01-22  
**Status**: Accepted

### Context
Current event handling is scattered across components with potential memory leaks and race conditions.

### Decision
Implement centralized EventBus for both frontend and backend with clear event contracts.

### Rationale
1. **Loose Coupling**: Components don't need to know about each other
2. **Scalability**: Easy to add new event handlers
3. **Debugging**: Central place to log all events
4. **Consistency**: Single pattern for all events

### Implementation Guidelines
```typescript
// Frontend
- All Tauri events go through EventBus
- Type-safe event definitions
- Automatic cleanup on unmount

// Backend
- Domain events for business logic
- Integration events for external systems
- Event sourcing for audit trail (future)
```

---

## ADR-005: API Client Abstraction

**Date**: 2025-01-22  
**Status**: Accepted

### Context
400+ lines of repetitive `invoke` calls in api.ts with no error handling or retry logic.

### Decision
Create ApiClient abstraction with automatic retry, error handling, and type generation.

### Benefits
1. **DRY**: No more repetitive invoke calls
2. **Reliability**: Automatic retry with exponential backoff
3. **Type Safety**: Generated types from Rust
4. **Monitoring**: Central place for API metrics
5. **Testing**: Easy to mock for tests

---

## ADR-006: Domain-Driven Design for Backend

**Date**: 2025-01-22  
**Status**: Accepted

### Context
Business logic is mixed with infrastructure concerns in service layer.

### Decision
Adopt DDD tactical patterns: Entities, Value Objects, Repositories, and Domain Services.

### Structure
```
domain/           # Pure business logic
├── entities/     # Core business objects
├── value_objects/# Immutable values
├── services/     # Domain logic
└── repositories/ # Interfaces only

application/      # Use cases
├── commands/     # Write operations
└── queries/      # Read operations

infrastructure/   # Technical details
├── persistence/  # Repository implementations
└── external/     # Third-party integrations
```

---

## ADR-007: Optimistic Updates Strategy

**Date**: 2025-01-22  
**Status**: Accepted

### Context
Current implementation waits for backend confirmation for all updates, creating sluggish UX.

### Decision
Implement optimistic updates for non-critical operations with rollback on failure.

### Guidelines
**Use optimistic updates for:**
- Task status changes
- UI preference changes
- Non-destructive operations

**Don't use for:**
- Financial transactions
- Destructive operations (delete)
- Operations with complex side effects

### Implementation
```typescript
const updateStatus = async (taskId, newStatus) => {
  const previous = getStatus(taskId);
  
  // Optimistic update
  setStatus(taskId, newStatus);
  
  try {
    await api.updateStatus(taskId, newStatus);
  } catch (error) {
    // Rollback
    setStatus(taskId, previous);
    throw error;
  }
};
```

---

## ADR-008: Error Handling Strategy

**Date**: 2025-01-22  
**Status**: Accepted

### Context
Inconsistent error handling leads to poor user experience and difficult debugging.

### Decision
Implement layered error handling with user-friendly messages and proper logging.

### Layers
1. **Domain Errors**: Business rule violations
2. **Application Errors**: Use case failures  
3. **Infrastructure Errors**: Technical failures
4. **API Errors**: Communication failures

### User Experience
```typescript
// Transform technical errors to user-friendly messages
function toUserError(error: Error): UserError {
  if (error instanceof NetworkError) {
    return {
      title: "Connection Problem",
      message: "Please check your internet connection",
      retryable: true
    };
  }
  // ... other mappings
}
```

---

## ADR-009: Virtual Scrolling for Performance

**Date**: 2025-01-22  
**Status**: Accepted

### Context
Large conversation histories cause performance issues with thousands of messages.

### Decision
Implement virtual scrolling for message lists using @tanstack/react-virtual.

### Thresholds
- Use virtual scrolling when messages > 100
- Render 5 items above/below viewport
- Estimated item height: 100px (adjusted dynamically)

---

## ADR-010: Type Generation Strategy

**Date**: 2025-01-22  
**Status**: Accepted

### Context
Manual TypeScript types drift from Rust types causing runtime errors.

### Decision
Generate TypeScript types from Rust using ts-rs or similar tool.

### Process
1. Mark Rust types with `#[derive(TS)]`
2. Generate types on build
3. Commit generated types to version control
4. CI validates types match

### Benefits
- Single source of truth
- Compile-time type checking
- Reduced manual work
- Prevents type drift