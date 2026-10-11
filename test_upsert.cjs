const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://akeferuiyijsmgmjqnqc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const newWs = { id: 'ws_default', workspace_code: 'KARS-101', owner_id: 'admin' };
  const { data, error } = await supabase.from('workspaces').upsert(newWs);
  console.log('Upsert result:', data, error);
}
test();
