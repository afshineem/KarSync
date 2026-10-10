-- Migration: 20261010_audit_logs_insert_rpc.sql
-- Problem:
--   Non-admin users (workers / custom users) log in through the app_users table,
--   NOT through Supabase Auth, so auth.uid() is NULL for them. The RLS policy on
--   audit_logs therefore rejects their INSERTs, and their logs only ever exist in
--   their own browser (Dexie). The admin (Supabase Auth login) can read the table
--   but it only contains the admin's own logs.
-- Fix:
--   A SECURITY DEFINER function that inserts a log row after validating that the
--   workspace exists (and that the user really belongs to it). The client calls
--   this RPC instead of a direct INSERT.
--
-- NOTE: This keeps the same trust level as the rest of the app today (anon key +
-- client-side login). For a hardened setup, move non-admin login to real Supabase
-- Auth (or a signed JWT issued by an Edge Function) and drop this RPC.

CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_id            UUID,
  p_workspace_id  UUID,
  p_user_id       UUID,
  p_user_name     TEXT,
  p_project_id    UUID,
  p_action_type   TEXT,
  p_entity_type   TEXT,
  p_entity_id     TEXT,
  p_details       JSONB,
  p_created_at    TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := p_user_id;
BEGIN
  -- Workspace must exist
  IF p_workspace_id IS NULL OR NOT EXISTS (SELECT 1 FROM workspaces WHERE id = p_workspace_id) THEN
    RAISE EXCEPTION 'invalid workspace';
  END IF;

  -- If the user is not a member of that workspace, keep the log but drop the FK reference
  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app_users WHERE id = v_user_id AND workspace_id = p_workspace_id
  ) THEN
    v_user_id := NULL;
  END IF;

  INSERT INTO audit_logs (
    id, workspace_id, user_id, user_name, project_id,
    action_type, entity_type, entity_id, details, created_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_workspace_id, v_user_id, p_user_name, p_project_id,
    p_action_type, p_entity_type, p_entity_id, COALESCE(p_details, '{}'::jsonb),
    COALESCE(p_created_at, now())
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_audit_log(UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO anon, authenticated;

-- Make sure the admin can read every log of the workspace (policy from 20261003_fix_infinite_recursion.sql
-- already does this via get_user_workspace / owner_id; re-assert it as SELECT-only for clarity).
DROP POLICY IF EXISTS "Users can access audit logs in their workspace" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view audit logs" ON public.audit_logs;

CREATE POLICY "Users can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    workspace_id = public.get_user_workspace(auth.uid())
    OR workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id::text = auth.uid()::text
    )
  );

-- Index for the logs screen (newest first per workspace)
CREATE INDEX IF NOT EXISTS audit_logs_workspace_created_idx
  ON public.audit_logs (workspace_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
