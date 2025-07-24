use serde::{Serialize, Deserialize};

/// Metadata for different message types
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(untagged)]
pub enum MessageMetadata {
    Assistant(AssistantMetadata),
    ToolUse(ToolUseMetadata),
    ToolResult(ToolResultMetadata),
    ExecutionComplete(ExecutionCompleteMetadata),
    User(UserMetadata),
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AssistantMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ToolUseMetadata {
    #[serde(rename = "toolName")]
    pub tool_name: String,
    #[serde(rename = "toolUseId", skip_serializing_if = "Option::is_none")]
    pub tool_use_id: Option<String>,
    pub structured: serde_json::Value,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ToolResultMetadata {
    #[serde(rename = "toolName")]
    pub tool_name: String,
    #[serde(rename = "toolUseId", skip_serializing_if = "Option::is_none")]
    pub tool_use_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<bool>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ExecutionCompleteMetadata {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct UserMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
}

// Helper functions to create metadata
impl AssistantMetadata {
    pub fn new(thinking: Option<String>, id: Option<String>) -> Option<serde_json::Value> {
        if thinking.is_none() && id.is_none() {
            None
        } else {
            Some(serde_json::to_value(Self { thinking, id }).unwrap())
        }
    }
}

impl ToolUseMetadata {
    pub fn new(tool_name: String, tool_use_id: Option<String>, structured: serde_json::Value) -> serde_json::Value {
        serde_json::to_value(Self {
            tool_name,
            tool_use_id,
            structured,
        }).unwrap()
    }
}

impl ToolResultMetadata {
    pub fn new(tool_name: String, tool_use_id: Option<String>, error: bool) -> serde_json::Value {
        serde_json::to_value(Self {
            tool_name,
            tool_use_id,
            error: if error { Some(true) } else { None },
        }).unwrap()
    }
}

impl ExecutionCompleteMetadata {
    #[allow(dead_code)]
    pub fn new(success: bool, summary: String, duration_ms: u64, cost_usd: Option<f64>) -> serde_json::Value {
        serde_json::to_value(Self {
            success,
            summary: Some(summary),
            duration_ms: Some(duration_ms),
            cost_usd,
        }).unwrap()
    }
}

impl UserMetadata {
    #[allow(dead_code)]
    pub fn new(images: Option<Vec<String>>) -> Option<serde_json::Value> {
        images.map(|imgs| {
            serde_json::to_value(Self { images: Some(imgs) }).unwrap()
        })
    }
}