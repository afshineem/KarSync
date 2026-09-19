-- =========================================================================
-- KarSync SaaS Multi-Tenant Sub-Projects & Project Sections Schema
-- Migration: 20260919_project_sections.sql
-- =========================================================================

-- 1. Create project_sections table
CREATE TABLE IF NOT EXISTS public.project_sections (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add section_id to attendance_logs
ALTER TABLE public.attendance_logs 
  ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES public.project_sections(id) ON DELETE SET NULL;

-- 3. Indexes for fast aggregation and querying
CREATE INDEX IF NOT EXISTS idx_sections_project ON public.project_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_sections_user_project ON public.project_sections(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_attendance_section ON public.attendance_logs(section_id);

-- 4. Enable Row-Level Security (RLS) on project_sections
ALTER TABLE public.project_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage sections of their projects"
  ON public.project_sections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Real-time publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_sections;
