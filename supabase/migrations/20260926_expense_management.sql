-- =========================================================================
-- KarSync Expense Management Database Schema & Realtime Setup
-- Migration: 20260926_expense_management.sql
-- =========================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. EXPENSE CATEGORIES TABLE (سرفصل‌های ۳ سطحی هزینه‌ها)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 3), -- 1: Main Group, 2: Sub Group, 3: Micro Expense
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast hierarchical traversal and multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_expense_categories_project ON public.expense_categories(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON public.expense_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON public.expense_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_level ON public.expense_categories(project_id, level);

-- Enable Row Level Security (RLS) on expense_categories
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage expense categories of their projects"
  ON public.expense_categories
  FOR ALL
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = expense_categories.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = expense_categories.project_id AND p.user_id = auth.uid()
    )
  );

-- Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_categories;


-- -------------------------------------------------------------------------
-- 2. EXPENSES TABLE (جدول ثبت هزینه‌ها)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES public.project_sections(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  person_id TEXT REFERENCES public.workers(id) ON DELETE SET NULL,
  person_name TEXT, -- Fallback or external contractor/vendor name
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IQD' CHECK (currency IN ('IQD', 'IRT', 'USD')),
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'petty_cash')),
  receipt_url TEXT,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance and reporting aggregations
CREATE INDEX IF NOT EXISTS idx_expenses_project ON public.expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(project_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_section ON public.expenses(section_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_person ON public.expenses(person_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(project_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses(user_id);

-- Enable Row Level Security (RLS) on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage expenses of their projects"
  ON public.expenses
  FOR ALL
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = expenses.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = expenses.project_id AND p.user_id = auth.uid()
    )
  );

-- Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;


-- -------------------------------------------------------------------------
-- 3. STORAGE BUCKET FOR INVOICES & RECEIPTS (سطل ذخیره تصاویر فاکتور و رسید)
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Security Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to upload receipts'
  ) THEN
    CREATE POLICY "Allow authenticated users to upload receipts"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'expense-receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Allow public read of expense receipts'
  ) THEN
    CREATE POLICY "Allow public read of expense receipts"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'expense-receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to update or delete receipts'
  ) THEN
    CREATE POLICY "Allow authenticated users to update or delete receipts"
      ON storage.objects FOR ALL
      TO authenticated
      USING (bucket_id = 'expense-receipts');
  END IF;
END $$;
