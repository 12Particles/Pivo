use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodingAgentExecution {
    pub id: String,
    pub task_id: String,
    pub executor_type: CodingAgentType,
    pub working_directory: String,
    pub status: CodingAgentExecutionStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum CodingAgentType {
    ClaudeCode,
    GeminiCli,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CodingAgentExecutionStatus {
    Starting,
    Running,
    Stopped,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodingAgentOutput {
    pub execution_id: String,
    pub task_id: String,
    pub output_type: CodingAgentOutputType,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CodingAgentOutputType {
    Stdout,
    Stderr,
    System,
}

// Attempt 级别的执行状态
#[derive(Clone, Serialize, Deserialize)]
pub struct AttemptExecutionState {
    pub task_id: String,
    pub attempt_id: String,
    pub current_execution: Option<CodingAgentExecution>,  // 当前的执行
    pub messages: Vec<Message>,  // 该 attempt 的所有消息历史
    pub agent_type: CodingAgentType,
}

// Task 级别的执行汇总状态（用于看板等需要显示任务状态的地方）
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct TaskExecutionSummary {
    pub task_id: String,
    pub active_attempt_id: Option<String>,  // 当前活跃的 attempt
    pub is_running: bool,  // 是否有执行在运行
    pub agent_type: Option<CodingAgentType>,  // 当前运行的 agent 类型
}

// Message-related structures
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Message {
    pub id: String,
    pub role: MessageRole,
    pub content: String,
    pub images: Vec<String>,
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum MessageRole {
    User,
    Assistant,
    Tool,
    System,
}

impl std::fmt::Display for CodingAgentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CodingAgentType::ClaudeCode => write!(f, "Claude Code"),
            CodingAgentType::GeminiCli => write!(f, "Gemini CLI"),
        }
    }
}