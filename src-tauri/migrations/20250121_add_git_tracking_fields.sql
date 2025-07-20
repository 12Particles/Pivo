-- Add Git tracking fields to task_attempts table
ALTER TABLE task_attempts ADD COLUMN base_commit TEXT;
ALTER TABLE task_attempts ADD COLUMN last_sync_commit TEXT;
ALTER TABLE task_attempts ADD COLUMN last_sync_at DATETIME;