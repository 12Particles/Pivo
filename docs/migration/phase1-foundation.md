# Phase 1: Foundation Migration Guide

## Overview

Phase 1 establishes the foundation for the new architecture by implementing:
1. Centralized EventBus for all events
2. ApiClient with retry logic and error handling
3. Error handling infrastructure
4. State machines for execution management
5. Refactored ExecutionStore

## Completed Components

### 1. EventBus System

**Location**: `src/lib/events/`
- `EventTypes.ts` - Type-safe event definitions
- `EventBus.ts` - Centralized event management

**Usage Example**:
```typescript
import { useEvent, useEventEmitter } from '@/hooks/infrastructure/useEventBus';

// Subscribe to events
useEvent('task-status-updated', (task) => {
  console.log('Task updated:', task);
});

// Emit events
const emit = useEventEmitter();
await emit('task-created', { task: newTask });
```

### 2. ApiClient with Retry Logic

**Location**: `src/lib/api/`
- `ApiClient.ts` - Base client with automatic retry
- `errors.ts` - Error types and handling

**New API Services**: `src/services/api/`
- `TaskApi.ts` - Task-related API calls
- `ProjectApi.ts` - Project-related API calls

**Usage Example**:
```typescript
import { taskApi } from '@/services/api/TaskApi';

// Automatic retry on failure
const task = await taskApi.create({
  title: 'New Task',
  project_id: projectId,
});
```

### 3. Error Handling Infrastructure

**Components**:
- `ErrorBoundary.tsx` - React error boundary
- `ErrorNotification.tsx` - Global error notifications
- `useErrorStore.ts` - Error state management

**Usage**:
```typescript
// Wrap app with error boundary
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Errors automatically shown as toasts
// Manual error handling
const { addError } = useErrorStore();
addError(new Error('Something went wrong'), 'Context');
```

### 4. Execution State Machine

**Location**: `src/services/execution/`
- `ExecutionStateMachine.ts` - XState machine definition
- `ExecutionService.ts` - Service managing executions

**State Flow**:
```
idle → starting → running → completed
         ↓          ↓  ↓
       error    stopping
         ↓
      retry/failed
```

### 5. Refactored ExecutionStore

**New Store**: `useExecutionStoreV2.ts`
- Simplified state structure
- Uses ExecutionService internally
- Automatic event integration

## Migration Steps

### Step 1: Update Imports

Replace old API imports:
```typescript
// Old
import { taskApi } from '@/lib/api';

// New
import { taskApi } from '@/services/api/TaskApi';
```

### Step 2: Replace Event Listeners

Replace direct Tauri listeners:
```typescript
// Old
useEffect(() => {
  const unlisten = listen('task-updated', handler);
  return () => { unlisten.then(fn => fn()); };
}, []);

// New
useEvent('task-status-updated', handler);
```

### Step 3: Update ExecutionStore Usage

```typescript
// Old
import { useExecutionStore } from '@/stores/useExecutionStore';

// New
import { useExecutionStoreV2 } from '@/stores/domain/useExecutionStoreV2';

// Initialize in App.tsx
import { initExecutionStoreV2 } from '@/stores/domain/useExecutionStoreV2';

useEffect(() => {
  initExecutionStoreV2();
}, []);
```

### Step 4: Add Error Handling

Wrap your app:
```typescript
// App.tsx
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { ErrorNotification } from '@/components/error/ErrorNotification';

function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <ErrorNotification />
        {/* Your app content */}
      </AppProviders>
    </ErrorBoundary>
  );
}
```

## Breaking Changes

1. **API Client**: All API calls now use the new client with automatic retry
2. **Event Names**: Some event names have changed (see EventTypes.ts)
3. **ExecutionStore**: Completely new API, requires migration
4. **Error Handling**: Errors now emit events instead of direct handling

## Next Steps

Phase 2 will focus on:
1. Extracting business logic to hooks
2. Simplifying TaskConversation component
3. Creating feature modules
4. Implementing remaining domain stores

## Testing

Run tests to ensure migration is successful:
```bash
pnpm test
pnpm type-check
pnpm lint
```

## Rollback Plan

If issues arise:
1. Keep old implementations alongside new ones
2. Use feature flags to toggle between old/new
3. Gradual migration by component