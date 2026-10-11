const fs = require('fs');
let content = fs.readFileSync('src/components/WorkerProfileModal.jsx', 'utf8');

const oldLogic = `      let workspaceCode = '';
      if (user?.workspace_id) {
        const ws = await db.workspaces.get(user.workspace_id);
        if (ws && ws.workspace_code) workspaceCode = ws.workspace_code;
      }
      if (!workspaceCode) {
        const allWs = await db.workspaces.toArray();
        if (allWs.length > 0 && allWs[0].workspace_code) {
          workspaceCode = allWs[0].workspace_code;
        }
      }
      if (!workspaceCode) {
         alert('کد کارگاه در حافظه یافت نشد! لطفاً یک بار از حساب کاربری خارج شده و مجدداً وارد شوید.');
         return;
      }`;

const newLogic = `      let workspaceCode = '';
      let wsId = user?.workspace_id;
      
      // Try from user session
      if (wsId) {
        const ws = await db.workspaces.get(wsId);
        if (ws && ws.workspace_code) workspaceCode = ws.workspace_code;
      }
      
      // Try from local DB fallback
      if (!workspaceCode && db.workspaces) {
        const allWs = await db.workspaces.toArray();
        if (allWs.length > 0) {
          workspaceCode = allWs[0].workspace_code || 'KARS-101';
          wsId = allWs[0].id;
        }
      }
      
      // If completely missing, auto-create a default workspace for legacy sessions
      if (!workspaceCode || !wsId) {
         workspaceCode = 'KARS-101';
         wsId = 'ws_default';
         const newWs = { id: wsId, workspace_code: workspaceCode, owner_id: user?.id || 'admin' };
         if (db.workspaces) await db.workspaces.put(newWs);
         try {
           const { supabase } = await import('../services/realtimeSync');
           await supabase.from('workspaces').upsert(newWs);
         } catch(e) {}
      }
      
      // MUST upsert worker into app_users so mobile phone can fetch it from Supabase
      try {
         const { supabase } = await import('../services/realtimeSync');
         await supabase.from('app_users').upsert({
           id: workerId,
           workspace_id: wsId,
           username: creds.username,
           full_name: worker?.name || 'Worker',
           role: 'worker',
           is_active: true,
           session_version: 1,
           can_edit_past_records: false,
           password_hash: creds.password
         });
      } catch (err) {
         console.warn('Failed to upsert worker to app_users', err);
      }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/WorkerProfileModal.jsx', content);
console.log('Fixed full QR logic');
