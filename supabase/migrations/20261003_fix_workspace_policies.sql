-- Add INSERT and UPDATE policies for workspaces
CREATE POLICY "Users can insert their workspaces" ON public.workspaces 
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their workspaces" ON public.workspaces 
  FOR UPDATE USING (auth.uid() = owner_id);
