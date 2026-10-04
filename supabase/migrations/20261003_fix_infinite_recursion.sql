-- 1. Create a SECURITY DEFINER function to bypass RLS and fetch workspace_id safely
CREATE OR REPLACE FUNCTION public.get_user_workspace(user_uid UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT workspace_id FROM app_users WHERE id = user_uid LIMIT 1;
$$;

-- 2. Drop the recursive and buggy policies
DROP POLICY IF EXISTS "Users can view users in same workspace" ON public.app_users;
DROP POLICY IF EXISTS "Users can view project access" ON public.user_project_access;
DROP POLICY IF EXISTS "Users can view audit logs in their workspace" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;

-- 3. Create non-recursive, fast, and cast-safe policies
CREATE POLICY "Users can view users in same workspace" ON public.app_users 
  FOR ALL USING (
    id::text = auth.uid()::text
    OR 
    workspace_id = public.get_user_workspace(auth.uid())
    OR
    workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can view project access" ON public.user_project_access
  FOR ALL USING (
    user_id::text = auth.uid()::text
    OR
    user_id IN (
        SELECT id FROM public.app_users WHERE workspace_id = public.get_user_workspace(auth.uid())
        UNION
        SELECT id FROM public.app_users WHERE workspace_id IN (
            SELECT id FROM public.workspaces WHERE owner_id::text = auth.uid()::text
        )
    )
  );

CREATE POLICY "Users can access audit logs in their workspace" ON public.audit_logs
  FOR ALL USING (
    workspace_id = public.get_user_workspace(auth.uid())
    OR
    workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner_id::text = auth.uid()::text
    )
  );

-- 4. Reload PostgREST schema cache to immediately apply the fixes
NOTIFY pgrst, 'reload schema';
