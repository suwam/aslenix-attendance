-- Add progress column to task_assignees
ALTER TABLE task_assignees 
ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;

-- Ensure progress is between 0 and 100
ALTER TABLE task_assignees 
ADD CONSTRAINT check_task_assignees_progress_range 
CHECK (progress >= 0 AND progress <= 100);
