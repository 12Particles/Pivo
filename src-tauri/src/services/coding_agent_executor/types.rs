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
#[serde(rename_all = "snake_case")]
pub enum CodingAgentType {
    ClaudeCode,
    GeminiCli,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CodingAgentExecutionStatus {
    Starting,
    Running,
    Completed,
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
// 统一的对话消息格式（用于前后端通信和数据库存储）
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ConversationMessage {
    pub id: String,
    pub role: MessageRole,
    #[serde(rename = "messageType")]
    pub message_type: String,  // 子类型: text, tool_use, tool_result, thinking 等
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

impl ConversationMessage {
    /// Generate a standardized ID for the message
    pub fn generate_id(&self) -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let random_suffix: String = (0..8)
            .map(|_| {
                let charset = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                let idx = rng.gen_range(0..charset.len());
                charset[idx] as char
            })
            .collect();
        
        format!(
            "{}-{}-{}-{}",
            self.timestamp.timestamp_millis(),
            self.role,
            self.message_type,
            random_suffix
        )
    }
    
    /// Create a new message with auto-generated ID
    pub fn new(role: MessageRole, message_type: String, content: String, metadata: Option<serde_json::Value>) -> Self {
        let timestamp = Utc::now();
        let mut msg = Self {
            id: String::new(), // Will be set below
            role,
            message_type,
            content,
            timestamp,
            metadata,
        };
        msg.id = msg.generate_id();
        msg
    }
}

// 保留原有的 Message 结构用于内部使用
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
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

impl std::fmt::Display for MessageRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageRole::User => write!(f, "user"),
            MessageRole::Assistant => write!(f, "assistant"),
            MessageRole::System => write!(f, "system"),
        }
    }
}

impl std::fmt::Display for CodingAgentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CodingAgentType::ClaudeCode => write!(f, "Claude Code"),
            CodingAgentType::GeminiCli => write!(f, "Gemini CLI"),
        }
    }
}