-- Add last_opened field to projects table for tracking recently opened projects
ALTER TABLE projects ADD COLUMN last_opened DATETIME;

-- Create index for better performance when querying recent projects
CREATE INDEX idx_projects_last_opened ON projects(last_opened DESC);