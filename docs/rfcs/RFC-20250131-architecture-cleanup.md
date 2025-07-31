# RFC-20250131 架构清理报告

## 概述

根据用户要求，深入检查了代码中所有潜在的与 RFC 架构不符的地方，并进行了彻底的清理。

## 发现的问题及修复

### 1. 不符合架构的 API 方法

#### 问题
- `ExecutionApi` 中存在 `executePrompt`、`executeClaudePrompt`、`executeGeminiPrompt` 方法
- 这些方法允许前端直接执行 prompt，绕过了 TaskCommand 系统
- `TaskAttemptApi` 中存在 `create` 方法，允许前端创建 Attempt

#### 修复
- ✅ 彻底删除了 `ExecutionApi` 中的所有 execute 相关方法
- ✅ 删除了 `TaskAttemptApi.create` 方法
- ✅ 删除了 `lib/api.ts` 中对应的底层方法

### 2. 事件命名不一致

#### 问题
- 存在破折号分隔的旧事件：`task-created`、`task-updated`、`task-deleted`、`project-deleted`
- `useTaskExecutionStatus` 中使用了 `execution-stopped` 而不是 `execution:stopped`

#### 修复
- ✅ 删除了所有破折号分隔的旧事件定义
- ✅ 修正了 `execution-stopped` 为 `execution:stopped`

### 3. 遗留的事件定义

#### 问题
- `start-task-execution` 事件仍在类型定义中

#### 修复
- ✅ 已在之前的修改中删除

## 架构一致性验证

### 现在的架构完全符合 RFC 设计：

1. **Task 创建流程**
   ```
   前端: taskApi.create() 
     ↓
   后端: 自动创建 Attempt
     ↓
   前端: 直接发送消息 (SendMessage)
   ```

2. **命令系统**
   - 只有两个命令：`SEND_MESSAGE` 和 `STOP_EXECUTION`
   - 没有 `START_EXECUTION`
   - 前端不能直接执行 prompt

3. **事件系统**
   - 所有事件使用冒号分隔格式：`domain:action`
   - 删除了所有破折号分隔的旧事件

4. **API 设计**
   - 前端只能通过 `useTaskCommand` 发送消息
   - 不能直接创建 Attempt
   - 不能直接执行 prompt

## 防止未来问题的建议

1. **代码审查**：确保新代码遵循 RFC 架构
2. **API 设计原则**：前端 API 应该是高层抽象，不暴露底层实现细节
3. **事件命名规范**：统一使用冒号分隔的格式
4. **文档更新**：保持架构文档与代码同步

## 总结

通过这次彻底的清理，代码库现在完全符合 RFC-20250131 的架构设计。所有不符合架构的 API 方法都已被删除，事件系统已统一，前端只能通过正确的方式与后端交互。