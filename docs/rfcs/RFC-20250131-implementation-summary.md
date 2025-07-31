# Task-Attempt-Execution 架构重构实施总结

## 实施日期
2025-01-31

## 主要改动

### 1. 后端重构

#### task_commands.rs
- **简化命令系统**：移除 `StartExecution`，只保留 `SendMessage` 和 `StopExecution`
- **强制 Attempt 存在**：`SendMessage` 必须有已存在的 Attempt，否则报错
- **使用 Session Resume**：正确使用保存的 `claude_session_id` 进行会话恢复

```rust
// 之前：每次都传 None
resume_session_id: None

// 之后：使用保存的 session ID
let resume_session_id = match attempt.executor.as_deref() {
    Some("claude") | Some("claude_code") => attempt.claude_session_id.clone(),
    _ => None,
};
```

#### 事件系统重构
- 移除重复事件：`task-execution-summary`、`attempt-execution-update`
- 统一事件命名规范：
  - `task-status-updated` → `task:status-changed`
  - `coding-agent-message` → `message:added`
  - `conversation-state-update` → `state:conversation-sync`
  - `execution-completed` → `execution:completed` (包含 status)

### 2. 前端重构

#### Session ID 监听
```typescript
// TaskConversation.tsx
useEffect(() => {
  const unsubscribe = listen('session:received', async (event: any) => {
    const { attemptId, sessionId } = event.payload;
    
    if (conversationState.currentAttemptId === attemptId) {
      await taskAttemptApi.updateClaudeSessionId(attemptId, sessionId);
    }
  });
  
  return () => {
    unsubscribe.then(fn => fn());
  };
}, [conversationState.currentAttemptId]);
```

#### 命令简化
```typescript
// 移除了 startExecution，只保留：
- sendMessage(taskId, message, images?)
- stopExecution(taskId)
```

### 3. 移除的功能
- `execute_task` API - 功能合并到 `SendMessage`
- 自动创建 Attempt - 必须预先创建

## 核心价值

1. **Session 连续性**：通过正确使用 resume session，保持 Claude 对话上下文
2. **架构清晰**：Task → Attempt → Execution 三层职责明确
3. **事件简化**：减少重复事件，提高系统效率
4. **错误防护**：强制 Attempt 存在，避免意外行为

## 注意事项

1. 前端需要确保 Task 有 Attempt 才能发送消息
2. Session ID 在首次执行后自动保存
3. 旧的事件名称保留为 legacy，后续可以移除