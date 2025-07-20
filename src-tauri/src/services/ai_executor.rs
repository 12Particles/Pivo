use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorConfig {
    pub name: String,
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub max_tokens: Option<i32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorSession {
    pub id: String,
    pub executor_type: String,
    pub task_id: String,
    pub messages: Vec<Message>,
    pub context: HashMap<String, String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: MessageRole,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorResponse {
    pub content: String,
    pub tool_calls: Vec<ToolCall>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
}

#[async_trait]
pub trait AIExecutor: Send + Sync {
    /// Get the executor type name
    fn executor_type(&self) -> &str;

    /// Initialize a new session
    async fn init_session(
        &self,
        task_id: &str,
        initial_prompt: &str,
    ) -> Result<ExecutorSession, String>;

    /// Send a message and get response
    async fn send_message(
        &self,
        session: &mut ExecutorSession,
        message: &str,
    ) -> Result<ExecutorResponse, String>;

    /// Resume an existing session
    async fn resume_session(
        &self,
        session: &ExecutorSession,
    ) -> Result<ExecutorSession, String>;

    /// Get available tools for this executor
    fn get_available_tools(&self) -> Vec<ToolDefinition>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// Base implementation for common executor functionality
pub struct BaseExecutor {
    pub config: ExecutorConfig,
    pub client: reqwest::Client,
}

impl BaseExecutor {
    pub fn new(config: ExecutorConfig) -> Self {
        Self {
            config,
            client: reqwest::Client::new(),
        }
    }

    pub fn create_session(&self, task_id: &str) -> ExecutorSession {
        ExecutorSession {
            id: Uuid::new_v4().to_string(),
            executor_type: self.config.name.clone(),
            task_id: task_id.to_string(),
            messages: Vec::new(),
            context: HashMap::new(),
            created_at: chrono::Utc::now(),
        }
    }

    pub fn add_message(
        &self,
        session: &mut ExecutorSession,
        role: MessageRole,
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) {
        session.messages.push(Message {
            role,
            content,
            timestamp: chrono::Utc::now(),
            metadata,
        });
    }
}

// Claude Executor Implementation
pub mod claude;

// Gemini Executor Implementation  
pub mod gemini;

// Executor Manager
pub struct ExecutorManager {
    executors: HashMap<String, Arc<dyn AIExecutor>>,
}

impl ExecutorManager {
    pub fn new() -> Self {
        Self {
            executors: HashMap::new(),
        }
    }

    pub fn register_executor(&mut self, name: String, executor: Arc<dyn AIExecutor>) {
        self.executors.insert(name, executor);
    }

    pub fn get_executor(&self, name: &str) -> Option<&Arc<dyn AIExecutor>> {
        self.executors.get(name)
    }

    pub fn list_executors(&self) -> Vec<String> {
        self.executors.keys().cloned().collect()
    }
}