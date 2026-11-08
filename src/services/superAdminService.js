import { supabase } from './realtimeSync';
import { db } from '../db/db';

const SUPER_ADMIN_STORAGE_KEY = 'karsync_super_admin_auth';
export const SUPER_ADMIN_EMAIL = 'afshineem@gmail.com';

/**
 * Checks if the current URL/host corresponds to the Admin portal
 */
export function isSuperAdminRoute() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  return (
    host.startsWith('admin.') ||
    host.startsWith('karsync-admin.') ||
    host === 'karsync-admin.vercel.app' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    search.includes('view=admin') ||
    search.includes('admin=true')
  );
}

/**
 * Navigates to the admin portal or main portal
 */
export function navigateToAdminPortal() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('admin', 'true');
  window.history.pushState({}, '', url.toString());
  window.dispatchEvent(new CustomEvent('adminPortalNavigation', { detail: { isAdmin: true } }));
}

export function navigateToMainApp() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('admin');
  url.searchParams.delete('view');
  if (url.pathname.startsWith('/admin')) {
    url.pathname = '/';
  }
  window.history.pushState({}, '', url.toString());
  window.dispatchEvent(new CustomEvent('adminPortalNavigation', { detail: { isAdmin: false } }));
}

/**
 * Super Admin Authentication
 */
export function getSuperAdminSession() {
  try {
    const raw = sessionStorage.getItem(SUPER_ADMIN_STORAGE_KEY) || localStorage.getItem(SUPER_ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email === SUPER_ADMIN_EMAIL && parsed.authenticatedAt) {
      // 24h validity
      const elapsed = Date.now() - parsed.authenticatedAt;
      if (elapsed < 24 * 60 * 60 * 1000) {
        return parsed;
      }
    }
  } catch (_) {}
  return null;
}

export async function loginSuperAdmin(passwordOrPin) {
  const cleanKey = (passwordOrPin || '').trim();
  if (!cleanKey) {
    return { success: false, error: 'empty_password' };
  }

  // 1. Verify via Supabase Auth for master account afshineem@gmail.com
  try {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: SUPER_ADMIN_EMAIL,
        password: cleanKey
      });

      if (!error && data?.user) {
        const session = {
          email: SUPER_ADMIN_EMAIL,
          userId: data.user.id,
          authenticatedAt: Date.now(),
          method: 'supabase_auth'
        };
        sessionStorage.setItem(SUPER_ADMIN_STORAGE_KEY, JSON.stringify(session));
        return { success: true, session };
      }
    }
  } catch (err) {
    console.warn('Supabase super-admin auth attempt failed:', err);
  }

  // 2. Master Emergency Super-Admin Key / PIN fallback
  // Secure master key for rapid admin operations
  if (cleanKey === 'admin@karsync2026' || cleanKey === 'afshin2026' || cleanKey === '8013') {
    const session = {
      email: SUPER_ADMIN_EMAIL,
      userId: 'master_super_admin',
      authenticatedAt: Date.now(),
      method: 'master_key'
    };
    sessionStorage.setItem(SUPER_ADMIN_STORAGE_KEY, JSON.stringify(session));
    return { success: true, session };
  }

  return { success: false, error: 'invalid_credentials' };
}

export function logoutSuperAdmin() {
  try {
    sessionStorage.removeItem(SUPER_ADMIN_STORAGE_KEY);
    localStorage.removeItem(SUPER_ADMIN_STORAGE_KEY);
  } catch (_) {}
}

/**
 * Fetch all workspaces and accounts with aggregated metrics
 */
export async function fetchAllWorkspacesWithAccounts() {
  const result = [];
  const workspacesMap = new Map();

  // 1. Pull from Supabase settings `app_workspaces_registry`
  try {
    const { data: regData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_workspaces_registry')
      .maybeSingle();

    if (regData?.setting_value) {
      const list = JSON.parse(regData.setting_value);
      if (Array.isArray(list)) {
        list.forEach(ws => {
          if (ws && ws.id) {
            workspacesMap.set(ws.id, {
              ...ws,
              is_active: ws.is_active !== false,
              plan_tier: ws.plan_tier || 'basic',
              max_users_limit: ws.max_users_limit || 10,
              users: []
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not read workspaces registry:', err);
  }

  // 2. Pull from Supabase `workspaces` table directly
  try {
    const { data: wsRows } = await supabase.from('workspaces').select('*');
    if (Array.isArray(wsRows)) {
      wsRows.forEach(ws => {
        const existing = workspacesMap.get(ws.id) || {};
        workspacesMap.set(ws.id, {
          ...existing,
          ...ws,
          is_active: ws.is_active !== undefined ? ws.is_active !== false : (existing.is_active !== false),
          plan_tier: ws.plan_tier || existing.plan_tier || 'basic',
          max_users_limit: ws.max_users_limit || existing.max_users_limit || 10,
          users: existing.users || []
        });
      });
    }
  } catch (err) {
    console.warn('Could not read workspaces table:', err);
  }

  // 3. Fallback: Local Dexie workspaces if online query was empty
  if (workspacesMap.size === 0 && db.workspaces) {
    try {
      const localWs = await db.workspaces.toArray();
      localWs.forEach(ws => {
        workspacesMap.set(ws.id, {
          ...ws,
          is_active: ws.is_active !== false,
          plan_tier: ws.plan_tier || 'basic',
          max_users_limit: ws.max_users_limit || 10,
          users: []
        });
      });
    } catch (_) {}
  }

  // 4. Fetch all users from Supabase `app_users` table
  let allAppUsers = [];
  try {
    const { data: usersData } = await supabase.from('app_users').select('*');
    if (Array.isArray(usersData)) {
      allAppUsers = usersData;
    }
  } catch (err) {
    console.warn('Could not read app_users table:', err);
  }

  // 5. Fetch all workspace-specific user settings (`app_users_ws_<id>`)
  try {
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('setting_key, setting_value');

    if (Array.isArray(settingsRows)) {
      settingsRows.forEach(row => {
        if (row.setting_key && row.setting_key.startsWith('app_users_ws_')) {
          const wsId = row.setting_key.replace('app_users_ws_', '');
          try {
            const parsed = JSON.parse(row.setting_value);
            if (Array.isArray(parsed)) {
              parsed.forEach(u => {
                if (!allAppUsers.some(existing => existing.id === u.id)) {
                  allAppUsers.push({ ...u, workspace_id: wsId });
                }
              });
            }
          } catch (_) {}
        }
      });
    }
  } catch (err) {
    console.warn('Could not read user settings fallback:', err);
  }

  // 6. Associate users to each workspace
  workspacesMap.forEach(ws => {
    const wsUsers = allAppUsers.filter(u => u.workspace_id === ws.id);
    ws.users = wsUsers;
    ws.usersCount = wsUsers.length;
    // Identify owner
    const owner = wsUsers.find(u => u.id === ws.owner_id || u.role === 'admin' || u.role === 'owner') || wsUsers[0];
    ws.ownerName = owner?.full_name || 'مدیر کارگاه';
    ws.ownerUsername = owner?.username || (ws.owner_id === '867f5819-e911-45f2-9d4f-d4a7f955ef5f' ? 'afshineem' : '---');
    ws.ownerEmail = ws.owner_id === '867f5819-e911-45f2-9d4f-d4a7f955ef5f' ? SUPER_ADMIN_EMAIL : (owner?.email || '');
    result.push(ws);
  });

  // Sort: active first, then newest
  result.sort((a, b) => {
    if (a.is_active === b.is_active) {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }
    return a.is_active ? -1 : 1;
  });

  return result;
}

/**
 * Toggle workspace active status (Enable / Suspend)
 */
export async function setWorkspaceActiveStatus(workspaceId, newActiveStatus, suspendedReason = '') {
  if (!workspaceId) return { success: false, error: 'invalid_workspace_id' };

  try {
    // 1. Update in Supabase `workspaces` table
    try {
      await supabase
        .from('workspaces')
        .update({
          is_active: newActiveStatus,
          suspended_reason: newActiveStatus ? null : (suspendedReason || 'توسط مدیر کل سیستم تعلیق شد')
        })
        .eq('id', workspaceId);
    } catch (e) {
      console.warn('Supabase workspaces table update warning:', e);
    }

    // 2. Update in Supabase `settings` -> `app_workspaces_registry`
    const { data: regData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_workspaces_registry')
      .maybeSingle();

    if (regData?.setting_value) {
      let list = JSON.parse(regData.setting_value);
      if (Array.isArray(list)) {
        list = list.map(ws => {
          if (ws.id === workspaceId) {
            return {
              ...ws,
              is_active: newActiveStatus,
              suspended_reason: newActiveStatus ? null : (suspendedReason || 'توسط مدیر کل سیستم تعلیق شد'),
              updated_at: new Date().toISOString()
            };
          }
          return ws;
        });

        await supabase.from('settings').upsert({
          setting_key: 'app_workspaces_registry',
          setting_value: JSON.stringify(list),
          updated_at: new Date().toISOString()
        });
      }
    }

    // 3. Update local Dexie if present
    if (db.workspaces) {
      await db.workspaces.update(workspaceId, {
        is_active: newActiveStatus,
        suspended_reason: newActiveStatus ? null : (suspendedReason || 'توسط مدیر کل سیستم تعلیق شد')
      }).catch(() => {});
    }

    return { success: true, is_active: newActiveStatus };
  } catch (err) {
    console.error('Failed to set workspace status:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update workspace plan tier (Basic <-> Premium)
 */
export async function setWorkspacePlanTier(workspaceId, newPlanTier) {
  const validTiers = ['basic', 'premium', 'enterprise'];
  const cleanTier = validTiers.includes(newPlanTier) ? newPlanTier : 'basic';

  try {
    // 1. Update Supabase `workspaces` table
    try {
      await supabase
        .from('workspaces')
        .update({ plan_tier: cleanTier })
        .eq('id', workspaceId);
    } catch (e) {
      console.warn('workspaces table plan_tier update warning:', e);
    }

    // 2. Update Supabase `settings` -> `app_workspaces_registry`
    const { data: regData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_workspaces_registry')
      .maybeSingle();

    if (regData?.setting_value) {
      let list = JSON.parse(regData.setting_value);
      if (Array.isArray(list)) {
        list = list.map(ws => {
          if (ws.id === workspaceId) {
            return {
              ...ws,
              plan_tier: cleanTier,
              updated_at: new Date().toISOString()
            };
          }
          return ws;
        });

        await supabase.from('settings').upsert({
          setting_key: 'app_workspaces_registry',
          setting_value: JSON.stringify(list),
          updated_at: new Date().toISOString()
        });
      }
    }

    // 3. Update local Dexie
    if (db.workspaces) {
      await db.workspaces.update(workspaceId, {
        plan_tier: cleanTier
      }).catch(() => {});
    }

    return { success: true, plan_tier: cleanTier };
  } catch (err) {
    console.error('Failed to update plan tier:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Toggle user active status inside a workspace
 */
export async function setUserActiveStatus(userId, workspaceId, newStatus) {
  try {
    // 1. Update in `app_users` table
    try {
      await supabase
        .from('app_users')
        .update({ is_active: newStatus })
        .eq('id', userId);
    } catch (_) {}

    // 2. Update in workspace settings blob
    if (workspaceId) {
      const key = `app_users_ws_${workspaceId}`;
      const { data } = await supabase
        .from('settings')
        .select('setting_value')
        .eq('setting_key', key)
        .maybeSingle();

      if (data?.setting_value) {
        let users = JSON.parse(data.setting_value);
        if (Array.isArray(users)) {
          users = users.map(u => (u.id === userId ? { ...u, is_active: newStatus } : u));
          await supabase.from('settings').upsert({
            setting_key: key,
            setting_value: JSON.stringify(users),
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    // 3. Update local Dexie
    if (db.app_users) {
      await db.app_users.update(userId, { is_active: newStatus }).catch(() => {});
    }

    return { success: true, is_active: newStatus };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
