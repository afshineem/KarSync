-- =========================================================================
-- KarSync SaaS Multi-Tenant Database Schema & Row-Level Security (RLS)
-- Migration: 20260919_saas_multi_tenant.sql
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Tenants / Workspace Managers)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  full_name TEXT,
  phone TEXT,
  default_currency TEXT DEFAULT 'IQD', -- 'IQD' | 'IRT' | 'USD'
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PROJECTS (Multi-Project Support per Tenant)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IQD', -- 'IQD' | 'IRT' | 'USD'
  standard_work_hours NUMERIC NOT NULL DEFAULT 8,
  overtime_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived' | 'completed'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. WORKERS (Scoped to Tenant and Project)
CREATE TABLE IF NOT EXISTS public.workers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  overtime_hourly_rate NUMERIC NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ATTENDANCE LOGS (Scoped to Tenant and Project)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'full', -- 'full' | 'half' | 'hourly'
  overtime_hours NUMERIC NOT NULL DEFAULT 0,
  calculated_daily_wage NUMERIC NOT NULL DEFAULT 0,
  calculated_overtime_wage NUMERIC NOT NULL DEFAULT 0,
  total_day_pay NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. PAYMENTS & SETTLEMENTS (Scoped to Tenant and Project)
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  month TEXT,
  time TEXT,
  type TEXT NOT NULL, -- 'advance' | 'settlement'
  amount NUMERIC NOT NULL DEFAULT 0,
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'settled', -- 'settled' | 'partial'
  remaining_balance_after NUMERIC DEFAULT 0,
  gross_earnings_calculated NUMERIC DEFAULT 0,
  prior_balance_deducted NUMERIC DEFAULT 0,
  advances_deducted NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================================
-- INDEXES FOR MAXIMUM QUERY SPEED & MULTI-TENANT ISOLATION
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_workers_user_project ON public.workers(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_project ON public.attendance_logs(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_logs(project_id, date);
CREATE INDEX IF NOT EXISTS idx_payments_user_project ON public.payments(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_payments_worker ON public.payments(project_id, worker_id);

-- =========================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to ensure clean idempotent migrations
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
  
  DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
  DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
  DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
  DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

  DROP POLICY IF EXISTS "Users can view own workers" ON public.workers;
  DROP POLICY IF EXISTS "Users can insert own workers" ON public.workers;
  DROP POLICY IF EXISTS "Users can update own workers" ON public.workers;
  DROP POLICY IF EXISTS "Users can delete own workers" ON public.workers;

  DROP POLICY IF EXISTS "Users can view own logs" ON public.attendance_logs;
  DROP POLICY IF EXISTS "Users can insert own logs" ON public.attendance_logs;
  DROP POLICY IF EXISTS "Users can update own logs" ON public.attendance_logs;
  DROP POLICY IF EXISTS "Users can delete own logs" ON public.attendance_logs;

  DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
  DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
  DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
  DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 1. Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Projects RLS
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- 3. Workers RLS
CREATE POLICY "Users can view own workers" ON public.workers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workers" ON public.workers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workers" ON public.workers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workers" ON public.workers FOR DELETE USING (auth.uid() = user_id);

-- 4. Attendance Logs RLS
CREATE POLICY "Users can view own logs" ON public.attendance_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON public.attendance_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own logs" ON public.attendance_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own logs" ON public.attendance_logs FOR DELETE USING (auth.uid() = user_id);

-- 5. Payments RLS
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payments" ON public.payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON public.payments FOR DELETE USING (auth.uid() = user_id);

-- =========================================================================
-- TRIGGER: Automatically create profile upon user registration
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_name, default_currency, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'default_currency', 'IQD'),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
