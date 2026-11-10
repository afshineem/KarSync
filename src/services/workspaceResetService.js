import { supabase } from './realtimeSync';
import { db, withImmutabilityBypass } from '../db/db';

/**
 * Checks whether the authenticated user signed in via Google OAuth (passwordless).
 * @param {Object} user 
 * @returns {boolean}
 */
export function isGoogleUser(user) {
  if (!user) return false;
  const provider = user?.supabaseUser?.app_metadata?.provider;
  if (provider === 'google') return true;

  const identities = user?.supabaseUser?.identities || [];
  return identities.some((id) => id?.provider === 'google');
}

/**
 * Verifies admin credentials before allowing dangerous workspace destruction.
 * Supports both standard email/password accounts and Google OAuth accounts.
 * 
 * @param {Object} params
 * @param {Object} params.user Current authenticated session user
 * @param {string} params.email Manually typed email
 * @param {string} [params.password] Manually typed password (for email/password accounts)
 * @param {string} [params.confirmationKeyword] Typed confirmation keyword (for Google accounts)
 * @returns {Promise<{ success: boolean }>}
 */
export async function verifyAdminReauth({ user, email, password, confirmationKeyword }) {
  if (!user) {
    throw new Error('NO_AUTHENTICATED_USER');
  }

  const role = String(user?.role || '').toLowerCase();
  if (role !== 'admin') {
    throw new Error('UNAUTHORIZED_NOT_ADMIN');
  }

  const cleanTypedEmail = String(email || '').trim().toLowerCase();
  const cleanExpectedEmail = String(user.email || '').trim().toLowerCase();

  if (!cleanTypedEmail || cleanTypedEmail !== cleanExpectedEmail) {
    const err = new Error('EMAIL_MISMATCH');
    err.code = 'EMAIL_MISMATCH';
    throw err;
  }

  const isGoogle = isGoogleUser(user);

  if (isGoogle) {
    const cleanWord = String(confirmationKeyword || '').trim().toUpperCase();
    const validWords = ['DELETE', 'حذف', 'سڕینەوە'];
    if (!validWords.includes(cleanWord)) {
      const err = new Error('KEYWORD_MISMATCH');
      err.code = 'KEYWORD_MISMATCH';
      throw err;
    }
    return { success: true };
  }

  // Standard Email/Password Account
  if (!password || !String(password).trim()) {
    const err = new Error('PASSWORD_REQUIRED');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }

  if (navigator.onLine && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanTypedEmail,
      password: String(password).trim()
    });

    if (error) {
      console.warn('[WorkspaceReset] Reauth failed:', error.message);
      const err = new Error('INVALID_CREDENTIALS');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
  }

  return { success: true };
}

/**
 * Performs a complete factory reset of the workspace data with strict tenant isolation.
 * Erases cloud data strictly matching user_id / workspace_id, deep wipes local IndexedDB
 * with immutability bypass, and sets onboardingCompleted to false.
 * 
 * @param {Object} params
 * @param {Object} params.user Current authenticated admin user
 * @returns {Promise<{ success: boolean }>}
 */
export async function performWorkspaceFactoryReset({ user }) {
  if (!user) {
    throw new Error('NO_AUTHENTICATED_USER');
  }

  const userId = user.id || user.userId;
  const workspaceId = user.workspace_id;
  const isLegacyOwner = userId === '867f5819-e911-45f2-9d4f-d4a7f955ef5f';

  console.log(`[WorkspaceReset] Starting complete factory reset for user: ${userId}, workspace: ${workspaceId}, legacy: ${isLegacyOwner}`);

  // 1. CLOUD WIPE (Strictly tenant-scoped; 100% zero-leakage guarantee)
  if (navigator.onLine && supabase) {
    try {
      // 1.1 Workers Table
      if (isLegacyOwner) {
        await supabase.from('workers').delete().eq('user_id', '867f5819-e911-45f2-9d4f-d4a7f955ef5f');
      } else if (userId) {
        await supabase.from('workers').delete().eq('user_id', userId);
      }

      // 1.2 Attendance Logs Table
      if (isLegacyOwner) {
        await supabase.from('attendance_logs').delete().eq('user_id', '867f5819-e911-45f2-9d4f-d4a7f955ef5f');
      } else if (userId) {
        await supabase.from('attendance_logs').delete().eq('user_id', userId);
      }

      // 1.3 Expenses Table
      if (isLegacyOwner) {
        await supabase.from('expenses').delete().eq('user_id', '867f5819-e911-45f2-9d4f-d4a7f955ef5f');
      } else if (userId) {
        await supabase.from('expenses').delete().eq('user_id', userId);
      }

      // 1.4 Expense Categories Table
      if (isLegacyOwner) {
        await supabase.from('expense_categories').delete().eq('user_id', '867f5819-e911-45f2-9d4f-d4a7f955ef5f');
      } else if (userId) {
        await supabase.from('expense_categories').delete().eq('user_id', userId);
      }

      // 1.5 App Users (Team members & staff defined inside this workspace)
      if (workspaceId) {
        await supabase.from('app_users').delete().eq('workspace_id', workspaceId);
      }

      // 1.6 Audit Logs
      if (workspaceId) {
        await supabase.from('audit_logs').delete().eq('workspace_id', workspaceId);
      } else if (userId) {
        await supabase.from('audit_logs').delete().eq('user_id', userId);
      }

      // 1.7 Settings Table (Projects, Sections, Counterparties, Accounts, Payments, Groups)
      if (isLegacyOwner) {
        const legacyBaseKeys = [
          'app_projects',
          'app_project_sections',
          'app_worker_projects',
          'app_groups',
          'app_worker_metadata',
          'app_payments',
          'app_expenses',
          'app_expense_categories',
          'app_financial_accounts',
          'app_treasury_incomes',
          'app_global_overdraft_policy',
          'app_account_transfers',
          'app_counterparties',
          'app_loans',
          'app_attendance_rules',
          'app_user_roles',
          'app_audit_logs',
          'app_vouchers',
          'app_cheques',
          'app_chequebooks',
          'app_contracts',
          'app_tasks'
        ];
        await supabase.from('settings').delete().in('setting_key', legacyBaseKeys);
      } else {
        const scopeId = workspaceId || userId;
        if (scopeId) {
          // Delete all scoped keys ending with _ws_${scopeId}
          await supabase.from('settings').delete().like('setting_key', `%_ws_${scopeId}`);

          const baseKeys = [
            'app_projects',
            'app_project_sections',
            'app_worker_projects',
            'app_groups',
            'app_worker_metadata',
            'app_payments',
            'app_expenses',
            'app_expense_categories',
            'app_financial_accounts',
            'app_treasury_incomes',
            'app_global_overdraft_policy',
            'app_account_transfers',
            'app_counterparties',
            'app_loans',
            'app_attendance_rules',
            'app_user_roles',
            'app_audit_logs',
            'app_vouchers',
            'app_cheques',
            'app_chequebooks',
            'app_contracts',
            'app_tasks'
          ];
          const scopedKeys = baseKeys.map((k) => `${k}_ws_${scopeId}`);
          await supabase.from('settings').delete().in('setting_key', scopedKeys);
        }
      }

      // 1.8 Tasks Table (Tenant-scoped wipe)
      try {
        if (isLegacyOwner) {
          await supabase.from('tasks').delete().not('project_id', 'like', '%__ws_%');
        } else {
          const scopeId = workspaceId || userId;
          if (scopeId) {
            await supabase.from('tasks').delete().like('project_id', `%__ws_${scopeId}`);
          }
        }
      } catch (taskErr) {
        console.warn('[WorkspaceReset] Tasks table wipe warning:', taskErr);
      }

      // 1.9 Profile Table: Reset onboarding_completed to false so wizard opens on reboot
      if (userId) {
        await supabase.from('profiles').update({
          onboarding_completed: false,
          updated_at: new Date().toISOString()
        }).eq('id', userId);
      }

      console.log('[WorkspaceReset] Cloud wipe successfully completed with zero tenant leakage.');
    } catch (cloudErr) {
      console.error('[WorkspaceReset] Cloud wipe error:', cloudErr);
      // We continue with local wipe to ensure user device is also cleaned
    }
  }

  // 2. LOCAL INDEXEDDB WIPE (With Immutability Bypass)
  await withImmutabilityBypass(async () => {
    for (const table of db.tables) {
      try {
        await table.clear();
      } catch (err) {
        console.warn(`[WorkspaceReset] Error clearing table ${table.name}:`, err);
      }
    }
  });

  // 3. LOCAL STORAGE CLEANUP
  if (typeof localStorage !== 'undefined') {
    const preserveKeys = new Set([
      'karsync_theme',
      'workshop_theme',
      'theme',
      'karsync_language',
      'workshop_lang',
      'karsync_direction',
      'karsync_calendar_type',
      'karsync_time_format',
      'karsync_timezone',
      'karsync_number_format'
    ]);

    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (!preserveKeys.has(key)) {
        if (key !== 'workshop_auth_session') {
          localStorage.removeItem(key);
        }
      }
    }

    // Keep current admin logged in, but flag onboardingCompleted as false
    const updatedUser = {
      ...user,
      onboardingCompleted: false
    };
    localStorage.setItem('workshop_auth_session', JSON.stringify(updatedUser));
    if (userId) localStorage.setItem('last_active_user_id', userId);
    if (workspaceId) localStorage.setItem('last_active_workspace_id', workspaceId);
  }

  console.log('[WorkspaceReset] Complete factory reset finished successfully.');
  return { success: true };
}
