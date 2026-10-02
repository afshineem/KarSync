import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = 'https://akeferuiyijsmgmjqnqc.supabase.co';
const key = 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk';
// wait, the anon key is usually much longer.
// Let's read the key from dexie.
