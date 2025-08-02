-- Update existing tasks with lowercase status values to capitalized values
UPDATE tasks SET status = 'Backlog' WHERE status = 'backlog';
UPDATE tasks SET status = 'Working' WHERE status = 'working';
UPDATE tasks SET status = 'Reviewing' WHERE status = 'reviewing';
UPDATE tasks SET status = 'Done' WHERE status = 'done';
UPDATE tasks SET status = 'Cancelled' WHERE status = 'cancelled';

-- Update existing tasks with lowercase priority values to capitalized values
UPDATE tasks SET priority = 'Low' WHERE priority = 'low';
UPDATE tasks SET priority = 'Medium' WHERE priority = 'medium';
UPDATE tasks SET priority = 'High' WHERE priority = 'high';
UPDATE tasks SET priority = 'Urgent' WHERE priority = 'urgent';

-- Update default values in the schema
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Create temporary table with new defaults
CREATE TABLE tasks_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Backlog',
    priority TEXT NOT NULL DEFAULT 'Medium',
    parent_task_id TEXT,
    assignee TEXT,
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
);

-- Copy data from old table
INSERT INTO tasks_new SELECT * FROM tasks;

-- Drop old table
DROP TABLE tasks;

-- Rename new table
ALTER TABLE tasks_new RENAME TO tasks;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Recreate trigger
CREATE TRIGGER update_tasks_updated_at AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;