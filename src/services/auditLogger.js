import { db } from '../db/db';
import { supabase } from './realtimeSync';

/**
 * Audit Logger Service
 * Silently records user actions to local Dexie and remote Supabase
 */
export async function logAuditAction({ actionType, entityType, entityId, details = {}, projectId = null }) {
  try {
    // Attempt to get current user from Dexie session or LocalStorage fallback
    let userDoc = null;
    let workspaceId = null;

    if (db.current_session && db.app_users) {
      const sessions = await db.current_session.toArray();
      if (sessions.length > 0) {
        userDoc = await db.app_users.get(sessions[0].user_id);
        workspaceId = sessions[0].workspace_id;
      }
    }

    if (!userDoc) {
      // Fallback to legacy or basic auth session
      const savedAuth = localStorage.getItem('workshop_auth_session');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        userDoc = parsed;
        workspaceId = parsed.workspace_id || parsed.workspaceId; // Adjust based on old schema
      }
    }

    if (!userDoc) return; // Cannot log if no user identified

    const auditRecord = {
      id: generateAuditId(),
      workspace_id: workspaceId || 'local-offline-workspace',
      user_id: userDoc.id || userDoc.userId || 'unknown',
      user_name: userDoc.full_name || userDoc.name || userDoc.username || 'مدیر سیستم',
      project_id: projectId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: String(entityId),
      details: details,
      created_at: new Date().toISOString()
    };

    // 1. Save to Local Dexie
    if (db.audit_logs) {
      await db.audit_logs.put(auditRecord).catch(() => {});
    }

    // 2. Push to Supabase
    if (navigator.onLine) {
      // Fire and forget
      supabase.from('audit_logs').insert([auditRecord]).then(({ error }) => {
        if (error) console.warn('Supabase audit log warning:', error);
      });
    }

  } catch (err) {
    // Silent fail - auditing should never break the main app flow
    console.warn('Audit logger caught an error:', err);
  }
}

function generateAuditId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
