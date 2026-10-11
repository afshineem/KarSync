const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://akeferuiyijsmgmjqnqc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase.from('app_users').select('*').limit(10);
  console.log(data);
}
test();
