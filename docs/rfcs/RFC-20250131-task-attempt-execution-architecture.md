# RFC: Task-Attempt-Execution 架构重构

**RFC 编号**: RFC-20250131-001  
**标题**: 基于 Task-Attempt-Execution 三层模型的任务执行架构  
**作者**: Assistant  
**日期**: 2025-01-31  
**状态**: 草案  

## 概要

重新设计任务执行架构，明确 Task、Attempt 和 Execution 的关系和职责，实现连续的 Agent 会话管理。

## 动机

当前架构存在以下问题：
1. 虽然每次发送消息都创建新的 execution，但未能清晰体现 execution 与 session 的关系
2. 没有明确的 active attempt 管理机制
3. Session resume 功能未被正确使用 - 每次新消息都传递 `None` 作为 resume_session_id
4. Claude session ID 虽然被存储在数据库中，但未在后续执行中使用
5. 前端缺少监听和保存 claude-session-id-received 事件的逻辑
6. 状态管理分散，缺乏统一的生命周期管理

## 核心概念

```
┌─────────────────────────────────────────────────────┐
│                      Task                           │
│  - 一个任务实体                                      │
│  - 可以有多个 Attempt                               │
│  - 同时只有一个 Active Attempt                      │
└─────────────────────────────────────────────────────┘
                         │
                         │ 1:N (Active: 1)
                         ▼
┌─────────────────────────────────────────────────────┐
│                    Attempt                          │
│  - 一次任务尝试                                      │
│  - 绑定特定的 Agent 类型                            │
│  - 维护一个 Agent Session                          │
│  - 可以有多个 Execution                            │
│  - 同时只有一个 Active Execution                   │
└─────────────────────────────────────────────────────┘
                         │
                         │ 1:N (Active: 0-1)
                         ▼
┌─────────────────────────────────────────────────────┐
│                   Execution                         │
│  - 一次具体的执行（对应一条用户消息）                 │
│  - 通过 resume session 在同一个 Agent Session 中执行 │
│  - 记录执行状态和结果                              │
└─────────────────────────────────────────────────────┘
```

## 设计原则

1. **利用现有结构**：不新增服务层，使用已有的 TaskService 和 CodingAgentExecutorService
2. **最小化改动**：只修复 session resume 未使用的问题
3. **保持简单**：前端只需要发送消息，后端处理复杂性

## 简化的解决方案

### 1. 简化的命令系统

基于三层关系，前端只需要简单的接口：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TaskCommand {
    /// 发送消息（需要已存在 Attempt）
    #[serde(rename = "SEND_MESSAGE")]
    SendMessage { 
        #[serde(rename = "taskId")]
        task_id: String, 
        message: String,
        images: Option<Vec<String>>,
    },
    
    /// 停止当前执行
    #[serde(rename = "STOP_EXECUTION")]
    StopExecution { 
        #[serde(rename = "taskId")]
        task_id: String,
    },
}
```

#### 核心处理逻辑
```rust
async fn handle_send_message(
    task_id: &str,
    message: String,
    images: Option<Vec<String>>,
) -> Result<(), String> {
    // 1. 获取最新的 Attempt，如果没有则报错
    let attempts = task_service.list_task_attempts(task_id).await?;
    let attempt = attempts.last()
        .ok_or("No attempt found for this task. Please create an attempt first.")?
        .clone();
    
    // 2. 获取 resume session ID（如果有）
    let resume_session_id = match attempt.executor.as_deref() {
        Some("claude") | Some("claude_code") => attempt.claude_session_id.clone(),
        _ => None,
    };
    
    // 3. 执行
    let execution = cli::execute_prompt(
        cli_state.clone(),
        message,
        task_id.to_string(),
        attempt.id.clone(),
        working_directory,
        agent_type,
        resume_session_id,  // 使用保存的 session ID
    ).await?;
    
    Ok(())
}
```

### 2. 前端使用

```typescript
// 极简的 API
const { sendMessage, stopExecution } = useTaskConversation(taskId);

// 发送消息（需要已存在 Attempt）
await sendMessage("请帮我实现这个功能", images);
```

### 3. 关键修复点

基于现有代码分析，需要修复以下问题：

#### 3.1 后端修复 - 使用保存的 Session ID

```rust
// task_commands.rs - 修改 start_execution 和 send_message
async fn start_execution(...) -> Result<(), String> {
    // ... 现有代码 ...
    
    // 使用保存的 session ID（如果有）
    let resume_session_id = match attempt.executor.as_deref() {
        Some("claude") | Some("claude_code") => attempt.claude_session_id.clone(),
        _ => None,
    };
    
    let _execution = crate::commands::cli::execute_prompt(
        cli_state.clone(),
        prompt,
        task_id.to_string(),
        attempt.id.clone(),
        working_directory,
        agent_type,
        resume_session_id,  // 不再传 None
    ).await?;
}
```

#### 3.2 前端修复 - 监听并保存 Session ID

```typescript
// TaskConversation.tsx
useEffect(() => {
  const unsubscribe = listen('claude-session-id-received', async (event) => {
    const { task_id, attempt_id, claude_session_id } = event.payload;
    
    if (task_id === task.id) {
      // 保存到后端
      await taskAttemptApi.updateClaudeSessionId(attempt_id, claude_session_id);
    }
  });
  
  return () => unsubscribe();
}, [task.id]);
```

## 状态同步机制

### 事件驱动的状态管理

当前系统通过事件机制实现前后端状态同步：

#### 1. 核心事件流

```
后端执行流程                     发出事件                      前端响应
─────────────                   ────────                     ────────
start_execution()               
  ├─> task-status-updated       ────────────────────>       TasksView 更新任务状态
  ├─> execute_prompt()
  │     ├─> claude-session-id-received ──────────────>      保存 session ID
  │     ├─> coding-agent-message ────────────────────>       实时显示消息
  │     └─> task-execution-summary ──────────────────>       更新执行状态
  └─> conversation-state-update ──────────────────────>      刷新整体会话状态

执行过程中
  ├─> coding-agent-message (多次) ────────────────────>      增量更新消息
  └─> attempt-execution-update ────────────────────────>     更新 attempt 状态

执行结束
  ├─> execution-completed ──────────────────────────>       标记执行完成
  └─> task-status-updated ──────────────────────────>       更新任务状态
```

#### 2. 前端状态管理

```typescript
// useTaskConversationState - 统一管理会话状态
interface ConversationState {
  messages: ConversationMessage[];      // 消息列表
  isExecuting: boolean;                 // 执行状态
  currentExecution?: CodingAgentExecution; // 当前执行
  canSendMessage: boolean;              // 是否可发送消息
}

// 监听两个关键事件
- conversation-state-update: 完整状态刷新（批量更新）
- coding-agent-message: 增量消息更新（实时性）
```

#### 3. 状态一致性保证

1. **双重更新机制**：
   - 增量更新：通过 `coding-agent-message` 实时显示新消息
   - 全量刷新：通过 `conversation-state-update` 确保状态最终一致

2. **防止状态冲突**：
   ```typescript
   // 加载初始状态时暂停增量更新
   if (isLoadingInitialState) return;
   
   // 检查消息是否已存在，避免重复
   const messageExists = prev.messages.some(m => m.id === newMessage.id);
   ```

3. **状态联动**：
   - 任务状态变更 → 触发会话状态更新
   - 执行状态变更 → 更新 UI 交互能力

## 事件设计问题分析

当前执行过程中事件存在以下问题：

### 1. 事件重复和冗余
- `coding-agent-output` vs `coding-agent-message`：前者是原始输出，后者是结构化消息，存在转换关系
- `task-execution-summary` vs `attempt-execution-update`：两者都描述执行状态，职责重叠
- `execution-completed` vs `task-status-updated`：执行完成时都会触发，造成重复

### 2. 事件粒度不一致
- 有些事件太细粒度（如 `coding-agent-output` 每行输出都发送）
- 有些事件太粗粒度（如 `conversation-state-update` 包含所有状态）

### 3. 建议的事件重新设计

基于分析，Claude Code 输出的是独立完整的消息（按行的 JSON），而非流式更新单个消息。每个消息类型包括：
- `thinking`: 思考过程
- `assistant`: AI 回复（包含 text 或 tool_use）  
- `tool_result`: 工具执行结果
- `result`: 执行总结

因此不需要 `message:updated` 这样的流式更新事件。

```typescript
// 执行生命周期事件（粗粒度）
interface ExecutionLifecycleEvents {
  'execution:started': {
    taskId: string;
    attemptId: string;
    executionId: string;
  };
  
  'execution:completed': {
    taskId: string;
    attemptId: string;
    executionId: string;
    status: 'success' | 'failed' | 'cancelled';
  };
}

// 消息事件（每个消息都是完整的，不需要流式更新）
interface MessageEvents {
  'message:added': {
    taskId: string;
    attemptId: string;
    message: ConversationMessage;
  };
}

// 状态同步事件（按需触发）
interface StateSyncEvents {
  'state:conversation-sync': {
    taskId: string;
    state: ConversationState;
  };
}

// Task 状态事件（独立处理，因为 Task 状态影响范围更广）
interface TaskStateEvents {
  'task:status-changed': {
    taskId: string;
    previousStatus: TaskStatus;
    newStatus: TaskStatus;
    task: Task;
  };
  
  'task:attempt-created': {
    taskId: string;
    attempt: TaskAttempt;
  };
  
  'task:attempt-updated': {
    taskId: string;
    attemptId: string;
    updates: Partial<TaskAttempt>;
  };
}
```

## 实施计划

1. **立即修复**（1小时）
   - 修改 `start_execution` 和 `send_message` 使用保存的 session ID
   - 添加前端监听器保存 session ID

2. **后续优化**（可选）
   - 简化命令系统，让前端更简单
   - 统一事件设计，减少重复
   - 改进状态管理

## 总结

这是一个典型的"最后一英里"问题：
- 所有组件都已存在（数据库字段、事件机制、API）
- 只需要正确连接它们
- 不需要复杂的架构改动
- 事件驱动架构已经提供了良好的状态同步基础