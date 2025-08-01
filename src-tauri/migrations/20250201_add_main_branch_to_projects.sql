-- Add main_branch column to projects table
ALTER TABLE projects ADD COLUMN main_branch TEXT NOT NULL DEFAULT 'main';