-- Add claude_session_id to task_attempts table
ALTER TABLE task_attempts
ADD COLUMN claude_session_id TEXT;