use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttemptConversation {
    pub id: String,
    pub task_attempt_id: String,
    pub messages: Vec<ConversationMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationMessage {
    pub role: String,
    pub content: String,
    pub timestamp: String,
}