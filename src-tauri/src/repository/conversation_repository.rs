use uuid::Uuid;
use crate::models::{AttemptConversation, ConversationMessage};
use super::DatabaseRepository;

pub struct ConversationRepository<'a> {
    db: &'a DatabaseRepository,
}

impl<'a> ConversationRepository<'a> {
    pub fn new(db: &'a DatabaseRepository) -> Self {
        Self { db }
    }
    
    pub async fn save_attempt_conversation(
        &self, 
        attempt_id: Uuid, 
        messages: Vec<ConversationMessage>
    ) -> Result<AttemptConversation, sqlx::Error> {
        let conversation_id = Uuid::new_v4();
        let messages_json = serde_json::to_string(&messages)
            .map_err(|e| sqlx::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        
        // Check if conversation already exists
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM attempt_conversations WHERE task_attempt_id = ?"
        )
        .bind(attempt_id.to_string())
        .fetch_optional(self.db.pool())
        .await?;
        
        if let Some((existing_id,)) = existing {
            // Update existing conversation
            sqlx::query(
                "UPDATE attempt_conversations SET messages = ?, updated_at = datetime('now') WHERE id = ?"
            )
            .bind(&messages_json)
            .bind(&existing_id)
            .execute(self.db.pool())
            .await?;
            
            self.get_attempt_conversation(attempt_id).await.map(|opt| opt.unwrap())
        } else {
            // Create new conversation
            sqlx::query(
                r#"
                INSERT INTO attempt_conversations (id, task_attempt_id, messages, created_at, updated_at)
                VALUES (?, ?, ?, datetime('now'), datetime('now'))
                "#
            )
            .bind(conversation_id.to_string())
            .bind(attempt_id.to_string())
            .bind(&messages_json)
            .execute(self.db.pool())
            .await?;
            
            self.get_attempt_conversation(attempt_id).await.map(|opt| opt.unwrap())
        }
    }
    
    pub async fn get_attempt_conversation(&self, attempt_id: Uuid) -> Result<Option<AttemptConversation>, sqlx::Error> {
        let row: Option<(String, String, String, String, String)> = sqlx::query_as(
            "SELECT id, task_attempt_id, messages, created_at, updated_at FROM attempt_conversations WHERE task_attempt_id = ?"
        )
        .bind(attempt_id.to_string())
        .fetch_optional(self.db.pool())
        .await?;
        
        if let Some((id, task_attempt_id, messages_json, created_at, updated_at)) = row {
            let messages: Vec<ConversationMessage> = serde_json::from_str(&messages_json)
                .map_err(|e| sqlx::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
            
            Ok(Some(AttemptConversation {
                id,
                task_attempt_id,
                messages,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }
    
    pub async fn add_message(
        &self,
        attempt_id: Uuid,
        message: ConversationMessage
    ) -> Result<(), sqlx::Error> {
        // Get existing conversation or create new one
        let mut messages = if let Some(conversation) = self.get_attempt_conversation(attempt_id).await? {
            conversation.messages
        } else {
            vec![]
        };
        
        messages.push(message);
        self.save_attempt_conversation(attempt_id, messages).await?;
        Ok(())
    }
}