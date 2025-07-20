-- Attempt conversations table
CREATE TABLE IF NOT EXISTS attempt_conversations (
    id TEXT PRIMARY KEY,
    task_attempt_id TEXT NOT NULL UNIQUE,
    messages TEXT NOT NULL, -- JSON array of conversation messages
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_attempt_id) REFERENCES task_attempts(id) ON DELETE CASCADE
);

-- Index for quick lookup by task_attempt_id
CREATE INDEX idx_attempt_conversations_task_attempt_id ON attempt_conversations(task_attempt_id);

-- Trigger for updated_at
CREATE TRIGGER update_attempt_conversations_updated_at AFTER UPDATE ON attempt_conversations
BEGIN
    UPDATE attempt_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;