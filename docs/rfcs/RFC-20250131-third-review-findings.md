# RFC-20250131 第三次审查发现

## 发现的问题

第三次审查再次发现了不符合架构的内容：

### 1. 前端 API 中的不当方法

**TaskAttemptApi** 中存在的问题方法：
- `updateStatus()` - 前端不应该直接更新 Attempt 状态
- `saveConversation()` - 前端不应该直接保存会话
- `getConversation()` - 前端不应该直接获取会话

这些方法允许前端绕过正常的消息流程，直接操作后端数据。

### 2. 后端未使用的命令函数

虽然没有在 `lib.rs` 中注册，但这些函数的存在仍是隐患：
- `create_task_attempt()` - 创建 Attempt 的函数
- `update_attempt_status()` - 更新状态的函数
- `save_attempt_conversation()` - 保存会话的函数
- `get_attempt_conversation()` - 获取会话的函数
- `execute_claude_prompt()` - 直接执行的函数
- `execute_gemini_prompt()` - 直接执行的函数
- `get_attempt_execution_state()` - 获取执行状态
- `get_task_execution_summary()` - 获取执行摘要
- `is_attempt_active()` - 查询活跃状态

### 3. lib/api.ts 中的遗留方法

发现并删除了：
- `updateStatus()`
- `saveConversation()`
- `getConversation()`
- `getAttemptExecutionState()`
- `getTaskExecutionSummary()`
- `addMessage()`
- `isAttemptActive()`

## 修复措施

1. **删除了所有不符合架构的前端 API 方法**
2. **删除了所有未使用的后端命令函数**
3. **从 lib.rs 中移除了这些命令的注册**
4. **创建了必要的模型类型** (`AttemptConversation`, `ConversationMessage`)

## 当前架构状态

### 前端只能：
- 通过 `TaskCommand` 发送消息 (`SEND_MESSAGE`)
- 通过 `TaskCommand` 停止执行 (`STOP_EXECUTION`)
- 获取任务列表和详情（只读）
- 更新 Claude Session ID（这是唯一允许的写操作，用于会话恢复）

### 后端负责：
- 自动创建 Attempt
- 管理执行状态
- 保存会话记录
- 发送状态更新事件

## 结论

这次审查揭示了一个重要教训：**即使函数没有被暴露给前端，它们的存在本身就是架构漏洞**。通过彻底删除这些函数，我们确保了：

1. 没有人能够意外地重新启用这些功能
2. 代码库保持清晰的架构边界
3. 新开发者不会被误导使用错误的模式

构建已成功通过，架构现在严格遵循 RFC-20250131 的设计。