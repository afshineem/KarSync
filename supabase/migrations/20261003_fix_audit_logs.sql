-- Drop the table and recreate it to ensure perfect schema
DROP TABLE IF EXISTS public.audit_logs CASCADE;

CREATE TABLE public.audit_logs (
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

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to INSERT their own logs
CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.app_users WHERE id = auth.uid()
        UNION
        SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- Policy to allow users to VIEW logs
CREATE POLICY "Users can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    workspace_id IN (
        SELECT workspace_id FROM public.app_users WHERE id = auth.uid()
        UNION
        SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );
