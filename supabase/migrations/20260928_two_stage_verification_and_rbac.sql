-- =========================================================================
-- KarSync: Two-Stage Verification System (Draft & Approved) & RBAC Foundation
-- Migration: 20260928_two_stage_verification_and_rbac.sql
-- =========================================================================

-- 1. PROFILES / USERS: Role-Based Access Control (RBAC)
-- Add role column to profiles with default 'admin'
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'admin' 
      CHECK (role IN ('admin', 'operator', 'viewer'));
  END IF;
END $$;

-- Ensure all existing active profiles have 'admin' role
UPDATE public.profiles SET role = 'admin' WHERE role IS NULL;

-- 2. EXPENSES TABLE: Two-Stage Approval Fields
DO $$ 
BEGIN
  -- status: enum ('draft', 'approved') default 'draft'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.expenses 
      ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft' 
      CHECK (status IN ('draft', 'approved'));
  END IF;

  -- created_by: reference to user who created the draft
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.expenses 
      ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- approved_by: reference to admin who approved it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.expenses 
      ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- approved_at: timestamp when approved
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.expenses 
      ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(project_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_approved_by ON public.expenses(approved_by);

-- 3. PAYMENTS TABLE: Two-Stage Approval Fields
DO $$ 
BEGIN
  -- approval_status: enum ('draft', 'approved') default 'draft'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.payments 
      ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'draft' 
      CHECK (approval_status IN ('draft', 'approved'));
  END IF;

  -- created_by: reference to user
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.payments 
      ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- approved_by: reference to admin
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.payments 
      ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- approved_at: timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.payments 
      ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_approval_status ON public.payments(project_id, approval_status);

-- 4. TREASURY INCOMES TABLE (if exists): Two-Stage Approval Fields
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'treasury_incomes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'treasury_incomes' AND column_name = 'status') THEN
      ALTER TABLE public.treasury_incomes ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'treasury_incomes' AND column_name = 'created_by') THEN
      ALTER TABLE public.treasury_incomes ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'treasury_incomes' AND column_name = 'approved_by') THEN
      ALTER TABLE public.treasury_incomes ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'treasury_incomes' AND column_name = 'approved_at') THEN
      ALTER TABLE public.treasury_incomes ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;

-- 5. ATTENDANCE LOGS TABLE: Two-Stage Approval Fields
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.attendance_logs 
      ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft' 
      CHECK (status IN ('draft', 'approved'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.attendance_logs 
      ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.attendance_logs 
      ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.attendance_logs 
      ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
END $$;

-- 6. IMMUTABILITY TRIGGER FUNCTION
-- Rejects any update (except approval) or delete if the record is approved
CREATE OR REPLACE FUNCTION public.enforce_approved_record_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- On DELETE: reject if status was approved
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION '403 Forbidden: Approved documents are immutable and cannot be deleted.' 
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- On UPDATE: if already approved, disallow changing core fields
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'approved' THEN
      -- If trying to change status back to draft, reject
      IF NEW.status <> 'approved' THEN
        RAISE EXCEPTION '403 Forbidden: An approved document cannot be reverted to draft.' 
          USING ERRCODE = '42501';
      END IF;
      -- If core financial/data fields are altered, reject
      IF (NEW.amount IS DISTINCT FROM OLD.amount) OR 
         (NEW.title IS DISTINCT FROM OLD.title) OR 
         (NEW.expense_date IS DISTINCT FROM OLD.expense_date) THEN
        RAISE EXCEPTION '403 Forbidden: Approved documents are immutable and cannot be modified.' 
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to expenses
DROP TRIGGER IF EXISTS trg_expenses_immutability ON public.expenses;
CREATE TRIGGER trg_expenses_immutability
  BEFORE UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_approved_record_immutability();

-- 7. APPROVAL RPC FUNCTION (Role Checked for Admin)
CREATE OR REPLACE FUNCTION public.approve_record(
  table_name TEXT,
  record_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  caller_id UUID;
  caller_role TEXT;
  now_ts TIMESTAMPTZ := now();
BEGIN
  caller_id := auth.uid();
  
  -- Query role from profiles
  SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;
  
  -- If caller is not admin, deny
  IF caller_role IS NULL OR caller_role <> 'admin' THEN
    RAISE EXCEPTION '403 Forbidden: Only users with the admin role can approve documents.' 
      USING ERRCODE = '42501';
  END IF;

  IF table_name = 'expenses' THEN
    UPDATE public.expenses 
    SET status = 'approved',
        approved_by = caller_id,
        approved_at = now_ts,
        updated_at = now_ts
    WHERE id = record_id;
  ELSIF table_name = 'payments' THEN
    UPDATE public.payments 
    SET approval_status = 'approved',
        approved_by = caller_id,
        approved_at = now_ts,
        updated_at = now_ts
    WHERE id = record_id;
  ELSIF table_name = 'attendance_logs' THEN
    UPDATE public.attendance_logs 
    SET status = 'approved',
        approved_by = caller_id,
        approved_at = now_ts,
        updated_at = now_ts
    WHERE id = record_id;
  ELSE
    RAISE EXCEPTION 'Unknown table name: %', table_name;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'record_id', record_id,
    'status', 'approved',
    'approved_by', caller_id,
    'approved_at', now_ts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
