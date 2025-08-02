use async_trait::async_trait;
use std::sync::mpsc::Sender;
use super::types::*;

/// Channel message that routes ConversationMessage to the correct task/attempt
pub struct ChannelMessage {
    pub attempt_id: String,
    pub task_id: String,
    pub message: ConversationMessage,
}

/// Trait defining the interface for all coding agents
#[async_trait]
pub trait CodingAgent: Send + Sync {
    /// Execute a prompt with the coding agent
    /// This starts a new process that runs until completion
    async fn execute_prompt(
        &self,
        prompt: &str,
        execution_context: ExecutionContext,
        message_sender: Sender<ChannelMessage>,
    ) -> Result<CodingAgentExecution, String>;
    
    /// Stop a running execution
    async fn stop_execution(
        &self,
        execution_id: &str,
        execution_context: &ExecutionContext,
    ) -> Result<(), String>;
}

/// Context for executing a coding agent
#[derive(Debug, Clone)]
pub struct ExecutionContext {
    pub execution_id: String,
    pub task_id: String,
    pub attempt_id: String,
    pub working_directory: String,
    pub resume_session_id: Option<String>, // For agents that support resuming
}