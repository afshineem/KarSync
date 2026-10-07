import Dexie from 'dexie';
import { db } from '../db/db';
import { supabase } from './realtimeSync';

// Helper to generate UUID safely across all browsers/mobile webviews (including insecure HTTP origins)
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (_) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper to validate UUIDs for PostgreSQL
function isValidUUID(str) {
  if (!str) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(String(str));
}

export async function getSafeAuthContext() {
  return await Dexie.ignoreTransaction(async () => {
    let workspaceId = null;
    let userId = null;
    let userName = 'کاربر سیستم';

    // 1. Local Storage auth session
    try {
      const sessionStr = localStorage.getItem('workshop_auth_session');
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        workspaceId = sessionData.workspace_id || sessionData.workspaceId || null;
        userId = sessionData.id || sessionData.userId || null;
        userName = sessionData.full_name || sessionData.name || sessionData.username || userName;
      }
    } catch (e) {
      console.error('Error reading localStorage auth:', e);
    }

    // 2. Local Storage admin auth
    if (!isValidUUID(userId)) {
      try {
        const adminStr = localStorage.getItem('workshop_admin_auth');
        if (adminStr) {
          const adminData = JSON.parse(adminStr);
          userId = adminData.id || adminData.userId || userId;
          userName = adminData.full_name || adminData.name || adminData.username || userName;
          workspaceId = workspaceId || adminData.workspace_id || adminData.workspaceId || null;
        }
      } catch(e) {}
    }

    // 3. Current Session table
    if (!isValidUUID(workspaceId) || !isValidUUID(userId)) {
      try {
        if (db.current_session) {
          const sessions = await db.current_session.toArray();
          if (sessions.length > 0) {
            workspaceId = workspaceId || sessions[0].workspace_id;
            userId = userId || sessions[0].user_id;
          }
        }
      } catch(e) {}
    }

    // 4. Resolve via app_users (Crucial: Match exact workspace_id for the user)
    try {
      if (db.app_users && isValidUUID(userId)) {
        const uDoc = await db.app_users.get(userId);
        if (uDoc) {
          workspaceId = workspaceId || uDoc.workspace_id;
          userName = userName === 'کاربر سیستم' ? (uDoc.full_name || uDoc.name || uDoc.username || userName) : userName;
        }
      } else if (db.app_users && !isValidUUID(userId)) {
        const users = await db.app_users.toArray();
        const admin = users.find(u => u.role === 'admin' || u.role === 'owner') || users[0];
        if (admin) {
          userId = admin.id;
          workspaceId = workspaceId || admin.workspace_id;
          userName = admin.full_name || admin.name || admin.username || userName;
        }
      }
    } catch(e) {}

    // 5. Active Project fallback
    if (!isValidUUID(workspaceId)) {
      try {
        const activeProjectId = localStorage.getItem('karsync_active_project_id');
        if (isValidUUID(activeProjectId) && db.projects) {
          const project = await db.projects.get(activeProjectId);
          if (project && project.workspace_id) {
            workspaceId = project.workspace_id;
          }
        }
      } catch(e) {}
    }

    // 6. Any workspace fallback
    if (!isValidUUID(workspaceId)) {
      try {
        if (db.workspaces) {
          const workspaces = await db.workspaces.toArray();
          if (workspaces.length > 0) {
            workspaceId = workspaces[0].id;
          }
        }
      } catch(e) {}
    }

    return { 
      workspaceId: isValidUUID(workspaceId) ? workspaceId : null, 
      userId: isValidUUID(userId) ? userId : null, 
      userName 
    };
  });
}

export async function logAuditAction(payload) {
  console.log('🚀 AUDIT LOGGER TRIGGERED:', payload);
  try {
    const action_type = payload.action_type || payload.actionType || 'UNKNOWN_ACTION';
    const entity_type = payload.entity_type || payload.entityType || 'general';
    const entity_id = payload.entity_id || payload.entityId || null;
    const details = payload.details || {};
    let project_id = payload.project_id || payload.projectId || null;
    
    let user_id = payload.user_id || payload.userId || details.userId || null;
    let user_name = payload.user_name || payload.userName || details.userName || null;
    let workspace_id = payload.workspace_id || payload.workspaceId || details.workspaceId || null;

    if (!isValidUUID(workspace_id) || !isValidUUID(user_id)) {
      console.log('🔍 Invalid or missing UUID in payload, deferring to getSafeAuthContext()...');
      const safeContext = await getSafeAuthContext();
      
      if (!isValidUUID(workspace_id)) workspace_id = safeContext.workspaceId;
      if (!isValidUUID(user_id)) user_id = safeContext.userId;
      if (!user_name) user_name = safeContext.userName;
    }

    user_name = user_name || 'کاربر سیستم';
    
    if (!isValidUUID(user_id)) user_id = null;
    if (!isValidUUID(workspace_id)) workspace_id = null;
    if (!isValidUUID(project_id)) project_id = null;

    const logRecord = {
      id: generateUUID(),
      workspace_id,
      user_id,
      user_name,
      project_id,
      action_type,
      entity_type,
      entity_id: String(entity_id),
      details,
      created_at: new Date().toISOString()
    };

    console.log('📦 ATTEMPTING DEXIE WRITE...', logRecord);
    if (db.audit_logs) {
      await Dexie.ignoreTransaction(async () => {
        await db.audit_logs.put(logRecord).catch(e => {
          console.error('🚨 Dexie Audit Logger Error:', e);
        });
        console.log('✅ DEXIE WRITE SUCCESSFUL!');
      });
    } else {
      console.error('🚨 DEXIE ERROR: db.audit_logs is undefined!');
    }

    
    console.log('☁️ ATTEMPTING SUPABASE WRITE...');
    
    // --- DEBUGGING BLOCK ---
    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('🔍 SUPABASE SESSION DEBUG:', sessionData?.session ? 'User has active Supabase session' : 'NO ACTIVE SUPABASE SESSION (auth.uid() is null)');
        if (sessionData?.session?.user) {
          console.log('👤 SUPABASE AUTH UID:', sessionData.session.user.id);
          const { data: remoteUser } = await supabase.from('app_users').select('workspace_id').eq('id', sessionData.session.user.id).single();
          console.log('🏢 REMOTE WORKSPACE_ID IN SUPABASE:', remoteUser?.workspace_id);
          console.log('💻 LOCAL WORKSPACE_ID IN PAYLOAD:', workspace_id);
          if (remoteUser?.workspace_id !== workspace_id) {
             console.error('🚨 MISMATCH DETECTED! RLS WILL BLOCK THIS!');
          }
        }
      } catch(e) {
        console.error('Error debugging auth:', e);
      }
    }
    // -----------------------

    // IMPORTANT: Even if workspace_id or user_id is null, we still try to insert.
    // Supabase RLS will naturally reject it if it requires them, which is exactly the intended secure behavior.
    if (navigator.onLine && supabase) {
      supabase.from('audit_logs').insert([logRecord]).then(({ error }) => {
        if (error) {
           console.error('🚨 Supabase Audit Log Error:', error);
        } else {
           console.log('✅ SUPABASE WRITE SUCCESSFUL!');
        }
      });
    } else {
      console.warn('⚠️ SUPABASE BYPASS: Offline or supabase undefined');
    }
  } catch (error) {
    console.error('🚨 AUDIT LOGGER CATCH:', error);
  }
}
