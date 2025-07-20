-- Add git_provider column to projects table
ALTER TABLE projects ADD COLUMN git_provider TEXT DEFAULT NULL;

-- Update existing projects based on git_repo URL
UPDATE projects 
SET git_provider = CASE 
    WHEN git_repo LIKE '%github.com%' THEN 'github'
    WHEN git_repo IS NOT NULL THEN 'gitlab'
    ELSE NULL
END
WHERE git_repo IS NOT NULL;