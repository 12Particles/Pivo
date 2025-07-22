use async_trait::async_trait;
use super::types::*;

/// Trait defining the interface for all coding agents
#[async_trait]
pub trait CodingAgent: Send + Sync {
    /// Get the agent type
    fn agent_type(&self) -> CodingAgentType;
    
    /// Start a new execution session
    async fn start_session(
        &self,
        task_id: &str,
        attempt_id: &str,
        working_directory: &str,
        project_path: Option<&str>,
        stored_session_id: Option<&str>,
    ) -> Result<CodingAgentExecution, String>;
    
    /// Send input to an active session
    async fn send_input(
        &self,
        execution_id: &str,
        session_info: &SessionInfo,
        input: &str,
    ) -> Result<(), String>;
    
    /// Stop an active session
    async fn stop_session(
        &self,
        execution_id: &str,
        session_info: &SessionInfo,
    ) -> Result<(), String>;
    
    /// Check if the agent supports resuming sessions
    fn supports_resume(&self) -> bool {
        false
    }
}

/// Information about an active session
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub task_id: String,
    pub attempt_id: String,
    pub working_directory: String,
    pub session_id: Option<String>,
}