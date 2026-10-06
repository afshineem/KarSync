-- Enhance tasks table for assignees, descriptions, priorities, etc.
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS due_date date,
ADD COLUMN IF NOT EXISTS assignees text[] DEFAULT '{}'; -- Array of worker IDs

-- Create an index on project_id for faster queries
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

-- Update RLS if needed (currently tasks has a permissive policy, but we can add project_id checks in the future)

-- Add timeline estimation and group association
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS estimated_hours numeric,
ADD COLUMN IF NOT EXISTS group_name text,
ADD COLUMN IF NOT EXISTS group_id text;

-- Add parent_id for subtasks hierarchy
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Drop strict FK and status check so that frontend project strings & not_started status are valid
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE public.tasks ALTER COLUMN project_id TYPE text USING project_id::text;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('not_started', 'pending', 'in_progress', 'completed'));
