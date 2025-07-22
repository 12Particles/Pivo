# Pivo Architecture

## Core Concepts and Relationships

### 1. Data Model Hierarchy

```
Application
    └── Multiple Windows (one per Project)
         └── Project (1)
              └── Tasks (n)
                   └── TaskAttempts (n) - but only 1 active at a time
                        └── CliExecutions (n) - but only 1 running at a time
                             └── Messages (n) - conversation history
```

### 2. Key Relationships

#### Project → Task (1:n)
- Each project contains multiple tasks
- Tasks belong to exactly one project
- Each project opens in a separate window

#### Task → TaskAttempt (1:n)
- Each task can have multiple attempts (history of work)
- Only ONE attempt can be active per task at any time
- Switching attempts means switching work context (git worktree, conversation history)

#### TaskAttempt → CliExecution (1:n)
- Each attempt can have multiple executions over time
- Only ONE execution can be running per attempt at any time
- Each execution represents one Claude/Gemini session
- Messages accumulate across executions within the same attempt

### 3. State Management Architecture

#### Backend (Rust)
- **CliExecutorService**: Manages all active executions
  - Keyed by `attempt_id` (since executions belong to attempts)
  - Enforces single execution per attempt
  - Maintains message history per attempt
  - Broadcasts state changes via events

#### Frontend (React)
- **ExecutionStore**: Central state management
  - Subscribes to backend events
  - Provides convenient APIs for components
  - Manages state at both task and attempt levels

### 4. Event Flow

1. User Action → Frontend Component → ExecutionStore
2. ExecutionStore → Tauri Command → Backend Service
3. Backend Service → State Update → Event Broadcast
4. Event → ExecutionStore → Component Re-render

### 5. Key Invariants

1. **Single Active Attempt**: A task can only have one active attempt
2. **Single Running Execution**: An attempt can only have one running execution
3. **Message Continuity**: Messages persist across executions within an attempt
4. **Worktree Isolation**: Each attempt has its own git worktree

### 6. Multi-Window Support

- Each project opens in a separate Tauri window
- Windows are independent but share the same backend services
- State updates are window-specific through targeted events