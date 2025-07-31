# Task-Attempt-Execution 架构实施差距分析

## 检查日期
2025-01-31

## 已完成的改造 ✅

### 后端
1. **TaskCommand 简化**
   - ✅ 移除了 `StartExecution`
   - ✅ 只保留 `SendMessage` 和 `StopExecution`

2. **Session Resume 实现**
   - ✅ `handle_send_message` 正确使用 `attempt.claude_session_id`
   - ✅ `execute_prompt` 正确传递 `resume_session_id`

3. **事件重新设计**
   - ✅ 使用新的事件名称：`execution:started`, `execution:completed`, `message:added`, `task:status-changed`
   - ✅ 移除了冗余的事件发送方法

### 前端
1. **Session ID 监听**
   - ✅ TaskConversation 监听 `session:received` 事件
   - ✅ 正确调用 `updateClaudeSessionId` 保存 session ID

2. **事件监听更新**
   - ✅ `useTaskConversationState` 监听新事件：`state:conversation-sync`, `execution:completed`, `message:added`
   - ✅ `TasksView` 监听 `task:status-changed`

3. **命令简化**
   - ✅ `useTaskCommand` 只有 `sendMessage` 和 `stopExecution`

## 未完成的改造 ❌

### 1. TaskApi.execute 方法问题
**文件**: `/src/services/api/TaskApi.ts`
```typescript
// 仍在使用已被移除的 START_EXECUTION
async execute(id: string, initialMessage?: string, images?: string[]): Promise<void> {
  if (initialMessage) {
    return invoke<void>('execute_task_command', {
      command: {
        type: 'START_EXECUTION', // ❌ 这个已被移除
        taskId: id,
        payload: { initialMessage, images }
      }
    });
  } else {
    return invoke<void>('execute_task', { id }); // ❌ execute_task 已被移除
  }
}
```

**修复方案**：
- 移除 `execute` 方法，或改为使用 `SEND_MESSAGE`
- 确保调用方先创建 Attempt

### 2. Attempt 创建流程缺失
**问题**：
- 前端没有任何地方调用 `taskAttemptApi.create`
- 根据 RFC，Attempt 必须预先存在，不能自动创建
- 但目前没有明确的 UI 流程来创建 Attempt

**建议方案**：
- 在 Task 创建时自动创建第一个 Attempt
- 或在 Task 详情页提供"开始新对话"按钮

### 3. 旧事件监听器未移除
**文件**: `/src/features/tasks/hooks/useTaskExecutionStatus.ts`
```typescript
// 仍在监听旧事件
const unsubscribeStatus = eventBus.subscribe('task-execution-summary', (summary) => {
  // ...
});
```

**修复**：需要更新或移除这个 hook

### 4. 后端调用未实现的方法
**文件**: `/src-tauri/src/services/coding_agent_executor/service.rs`
```rust
// 这些方法被调用但未实现（已被注释掉）
self.emit_attempt_execution_state(attempt_id);
self.emit_task_execution_summary(task_id);
```

**修复**：移除这些调用

### 5. Legacy 事件定义未清理
**文件**: `/src/lib/events/EventTypes.ts`
- 仍保留 legacy events 定义
- 可能导致混淆

## 建议的修复优先级

1. **高优先级**（影响功能）
   - 修复 TaskApi.execute 方法
   - 实现 Attempt 创建流程

2. **中优先级**（代码清洁度）
   - 移除后端未实现方法的调用
   - 更新 useTaskExecutionStatus hook

3. **低优先级**（技术债务）
   - 清理 legacy 事件定义

## 总结

核心的 Session Resume 功能已经实现，但还有一些边缘问题需要处理：
- 主要问题是 TaskApi 还在使用旧的命令
- Attempt 创建流程需要明确
- 一些旧的事件监听器需要清理