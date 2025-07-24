use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Agent output format - represents messages produced by AI coding agents
/// This is used to parse and normalize outputs from different AI providers (Claude, Gemini, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AgentOutput {
    /// Assistant response message
    #[serde(rename = "assistant")]
    Assistant {
        id: Option<String>,
        content: String,
        thinking: Option<String>,
        timestamp: DateTime<Utc>,
    },
    
    /// Agent thinking message (separate from assistant)
    #[serde(rename = "thinking")]
    Thinking {
        content: String,
        timestamp: DateTime<Utc>,
    },
    
    /// Tool usage message
    #[serde(rename = "tool_use")]
    ToolUse {
        id: Option<String>,
        tool_name: String,
        tool_input: serde_json::Value,
        timestamp: DateTime<Utc>,
    },
    
    /// Tool result message
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: Option<String>,
        tool_name: String,
        result: String,
        is_error: bool,
        timestamp: DateTime<Utc>,
    },
    
    /// Execution completed message
    #[serde(rename = "execution_complete")]
    ExecutionComplete {
        success: bool,
        summary: String,
        duration_ms: u64,
        cost_usd: Option<f64>,
        timestamp: DateTime<Utc>,
    },
    
    /// Raw message (for preserving original data)
    #[serde(rename = "raw")]
    Raw {
        source: String, // "claude", "gemini", etc.
        data: serde_json::Value,
        timestamp: DateTime<Utc>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SystemMessageLevel {
    Info,
    Warning,
    Error,
}

impl AgentOutput {
    /// Create an assistant message
    pub fn assistant(content: String) -> Self {
        AgentOutput::Assistant {
            id: None,
            content,
            thinking: None,
            timestamp: Utc::now(),
        }
    }
    
    /// Create an assistant message with id and thinking
    pub fn assistant_with_details(id: Option<String>, content: String, thinking: Option<String>) -> Self {
        AgentOutput::Assistant {
            id,
            content,
            thinking,
            timestamp: Utc::now(),
        }
    }
    
    /// Create a thinking message
    pub fn thinking(content: String) -> Self {
        AgentOutput::Thinking {
            content,
            timestamp: Utc::now(),
        }
    }
    
    /// Create a tool use message with id
    pub fn tool_use_with_id(id: Option<String>, tool_name: String, tool_input: serde_json::Value) -> Self {
        AgentOutput::ToolUse {
            id,
            tool_name,
            tool_input,
            timestamp: Utc::now(),
        }
    }
    
    /// Create a tool result message with tool_use_id
    pub fn tool_result_with_id(tool_use_id: Option<String>, tool_name: String, result: String, is_error: bool) -> Self {
        AgentOutput::ToolResult {
            tool_use_id,
            tool_name,
            result,
            is_error,
            timestamp: Utc::now(),
        }
    }
    
    /// Create a system message
    
    /// Create a raw message to preserve original data
    pub fn raw(source: String, data: serde_json::Value) -> Self {
        AgentOutput::Raw {
            source,
            data,
            timestamp: Utc::now(),
        }
    }
    
    /// Create an execution complete message
    pub fn execution_complete(success: bool, summary: String, duration_ms: u64, cost_usd: Option<f64>) -> Self {
        AgentOutput::ExecutionComplete {
            success,
            summary,
            duration_ms,
            cost_usd,
            timestamp: Utc::now(),
        }
    }
    
}

/// Trait for converting agent-specific messages to unified format
pub trait MessageConverter {
    fn convert_to_unified(&self, raw_message: &str) -> Option<AgentOutput>;
}