-- Create merge_requests table
CREATE TABLE IF NOT EXISTS merge_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_attempt_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'gitlab' or 'github'
    mr_id INTEGER NOT NULL, -- GitLab/GitHub MR/PR ID
    mr_iid INTEGER NOT NULL, -- GitLab IID (internal ID)
    mr_number INTEGER NOT NULL, -- MR/PR number
    title TEXT NOT NULL,
    description TEXT,
    state TEXT NOT NULL, -- opened, closed, merged, locked
    source_branch TEXT NOT NULL,
    target_branch TEXT NOT NULL,
    web_url TEXT NOT NULL,
    merge_status TEXT, -- can_be_merged, cannot_be_merged, etc.
    has_conflicts BOOLEAN DEFAULT 0,
    pipeline_status TEXT, -- success, failed, running, etc.
    pipeline_url TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    merged_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_attempt_id) REFERENCES task_attempts(id) ON DELETE CASCADE,
    UNIQUE(provider, mr_id)
);

-- Create index for faster lookups
CREATE INDEX idx_merge_requests_task_attempt ON merge_requests(task_attempt_id);
CREATE INDEX idx_merge_requests_state ON merge_requests(state);
CREATE INDEX idx_merge_requests_provider_number ON merge_requests(provider, mr_number);

-- Create app_config table for storing configuration
CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);