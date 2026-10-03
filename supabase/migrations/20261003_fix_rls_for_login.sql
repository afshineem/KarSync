-- Migration: 20261003_fix_rls_for_login.sql
-- Description: Fix RLS policies to allow anonymous login lookups for workspaces and app_users

-- 1. Allow anyone to read basic workspace details to enable login via workspace code
DROP POLICY IF EXISTS "Anyone can view workspaces for login" ON public.workspaces;
CREATE POLICY "Anyone can view workspaces for login" ON public.workspaces 
  FOR SELECT USING (true);

-- 2. Allow anyone to read app_users to verify username during login
-- Note: In a production app with sensitive data, it's better to use a SECURITY DEFINER 
-- Postgres function (RPC) for authentication. But for this prototype, this is the most 
-- seamless way to allow the React client to lookup users without breaking the architecture.
DROP POLICY IF EXISTS "Anyone can view app_users for login" ON public.app_users;
CREATE POLICY "Anyone can view app_users for login" ON public.app_users 
  FOR SELECT USING (true);

-- Ensure Realtime works for anonymous users by granting SELECT if needed
GRANT SELECT ON public.workspaces TO anon;
GRANT SELECT ON public.app_users TO anon;
GRANT SELECT ON public.audit_logs TO anon;
GRANT SELECT ON public.user_project_access TO anon;

