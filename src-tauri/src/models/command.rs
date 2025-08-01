use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub content: Option<String>,
    #[serde(rename = "type")]
    pub command_type: String, // "claude" or "custom"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandSearchResult {
    pub commands: Vec<Command>,
    pub total: usize,
}