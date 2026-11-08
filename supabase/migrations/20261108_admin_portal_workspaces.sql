-- Migration: Enhance workspaces table with active status, plan tiers, and subscription metadata
ALTER TABLE public.workspaces 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Update any existing rows to active and ensure plan_tier is valid
UPDATE public.workspaces 
SET 
  is_active = COALESCE(is_active, true),
  plan_tier = COALESCE(plan_tier, 'basic')
WHERE is_active IS NULL OR plan_tier IS NULL;
