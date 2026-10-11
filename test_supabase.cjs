const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://akeferuiyijsmgmjqnqc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data: wsData, error: wsError } = await supabase.from('workspaces').select('*').limit(5);
  console.log('Workspaces:', wsData, wsError);
  
  const { data: uData, error: uError } = await supabase.from('app_users').select('*').limit(5);
  console.log('Users:', uData, uError);
}
test();
