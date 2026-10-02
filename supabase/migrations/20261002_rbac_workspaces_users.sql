-- Migration: 20261002_rbac_workspaces_users.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. جدول ورک‌اسپیس / کارگاه (workspaces)
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    workspace_code VARCHAR(6) UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    max_users_limit INTEGER DEFAULT 5,
    plan_tier TEXT DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their workspaces" ON public.workspaces FOR SELECT USING (auth.uid() = owner_id);

-- 2. جدول کاربران برنامه (app_users)
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'custom',
    is_active BOOLEAN DEFAULT true,
    session_version INTEGER DEFAULT 1,
    can_edit_past_records BOOLEAN DEFAULT false,
    permissions JSONB DEFAULT '[]'::jsonb,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(workspace_id, username)
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view users in same workspace" ON public.app_users 
  FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id FROM public.app_users WHERE id = auth.uid()
    ) OR 
    workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- 3. جدول تخصیص پروژه به کاربران (user_project_access)
-- Using UUID for project_id since projects.id is UUID in earlier migrations
CREATE TABLE IF NOT EXISTS public.user_project_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    has_all_projects_access BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_project_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view project access" ON public.user_project_access
  FOR ALL USING (
    user_id IN (
        SELECT id FROM public.app_users WHERE workspace_id IN (
            SELECT workspace_id FROM public.app_users WHERE id = auth.uid()
            UNION
            SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
        )
    )
  );

-- 4. جدول ردپای ممیزی و ثبت عملیات (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    user_name TEXT,
    project_id UUID,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view audit logs in their workspace" ON public.audit_logs
  FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id FROM public.app_users WHERE id = auth.uid()
        UNION
        SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- 5. الحاق امضای متصدی به جداول عملیاتی
DO $$ 
BEGIN
  -- attendance_logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_logs' AND column_name = 'created_by_user_id') THEN
      ALTER TABLE public.attendance_logs ADD COLUMN created_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_logs' AND column_name = 'updated_by_user_id') THEN
      ALTER TABLE public.attendance_logs ADD COLUMN updated_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'created_by_user_id') THEN
      ALTER TABLE public.payments ADD COLUMN created_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'updated_by_user_id') THEN
      ALTER TABLE public.payments ADD COLUMN updated_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- expenses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'created_by_user_id') THEN
      ALTER TABLE public.expenses ADD COLUMN created_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'updated_by_user_id') THEN
      ALTER TABLE public.expenses ADD COLUMN updated_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- workers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'created_by_user_id') THEN
      ALTER TABLE public.workers ADD COLUMN created_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'updated_by_user_id') THEN
      ALTER TABLE public.workers ADD COLUMN updated_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 6. تنظیمات Realtime و امنیت داده‌ها
DO $$
BEGIN
  -- Add to realtime publication if not already added
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
    EXCEPTION WHEN OTHERS THEN END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
    EXCEPTION WHEN OTHERS THEN END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_project_access;
    EXCEPTION WHEN OTHERS THEN END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
    EXCEPTION WHEN OTHERS THEN END;
  END IF;
END $$;
