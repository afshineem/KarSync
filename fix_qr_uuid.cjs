const fs = require('fs');
let content = fs.readFileSync('src/components/WorkerProfileModal.jsx', 'utf8');

const oldLogic = `      // If completely missing, auto-create a default workspace for legacy sessions
      if (!workspaceCode || !wsId) {
         workspaceCode = 'KARS-101';
         wsId = 'ws_default';
         const newWs = { id: wsId, workspace_code: workspaceCode, owner_id: user?.id || 'admin' };
         if (db.workspaces) await db.workspaces.put(newWs);
         try {
           const { supabase } = await import('../services/realtimeSync');
           await supabase.from('workspaces').upsert(newWs);
         } catch(e) {}
      }`;

const newLogic = `      // Fetch from Supabase as fallback
      if (!workspaceCode && navigator.onLine) {
         try {
           const { supabase } = await import('../services/realtimeSync');
           const { data } = await supabase.from('workspaces').select('*').limit(1).maybeSingle();
           if (data) {
             workspaceCode = data.workspace_code;
             wsId = data.id;
             if (db.workspaces) await db.workspaces.put(data);
           }
         } catch (e) {
           console.warn('Fallback workspace fetch failed', e);
         }
      }

      // If completely missing, auto-create a default workspace with valid UUIDs
      if (!workspaceCode || !wsId) {
         wsId = '4a2980ba-f500-4689-9b13-e0c8df300f71'; // valid fallback UUID
         workspaceCode = 'KAR-101';
         let ownerId = user?.id;
         if (ownerId === 'admin' || ownerId === 'admin_local') ownerId = '867f5819-e911-45f2-9d4f-d4a7f955ef5f';
         const newWs = { id: wsId, workspace_code: workspaceCode, owner_id: ownerId };
         if (db.workspaces) await db.workspaces.put(newWs);
         try {
           const { supabase } = await import('../services/realtimeSync');
           await supabase.from('workspaces').upsert(newWs);
         } catch(e) {}
      }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/WorkerProfileModal.jsx', content);
console.log('Fixed UUID logic');
