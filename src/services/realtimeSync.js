import { createClient } from '@supabase/supabase-js';
import { db, getAttendanceLogId, cleanupDuplicateAttendanceLogs, purgeDummySeedWorkers, DEFAULT_PROJECT_ID, deduplicateExpenseCategories, wipeAllLocalData, withImmutabilityBypass, generateNextCategoryCode } from '../db/db';
import { getSyncConfig, saveSyncConfig, setLastSyncTime, getLastSyncTime } from './syncService';
import { roundCurrency } from '../utils/formatters';

const SUPABASE_URL = 'https://akeferuiyijsmgmjqnqc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

let isInitialized = false;
let realtimeChannel = null;
export const CLIENT_ID = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

const PENDING_DELETED_WORKERS_KEY = 'workshop_pending_deleted_workers';
const PENDING_DELETED_LOGS_KEY = 'workshop_pending_deleted_logs';
const PENDING_DELETED_PAYMENTS_KEY = 'workshop_pending_deleted_payments';
const PENDING_DELETED_PROJECTS_KEY = 'workshop_pending_deleted_projects';
const PENDING_DELETED_SECTIONS_KEY = 'workshop_pending_deleted_sections';
const PENDING_DELETED_GROUPS_KEY = 'workshop_pending_deleted_groups';
const PENDING_DELETED_ACCOUNTS_KEY = 'workshop_pending_deleted_accounts';
const PENDING_DELETED_INCOMES_KEY = 'workshop_pending_deleted_incomes';
export const WORKER_PROJECTS_STORAGE_KEY = 'workshop_worker_projects';

export const LEAKED_CROSS_TENANT_WORKER_IDS = new Set([
  'id_muzvc13b_evoe0jd', // میلاد
  'id_muzvaj1c_50cuozg', // عابد
  'id_muzvha1a_j707h0t', // بهمن
  'id_muzvb60z_a976gvh'  // هاوکار
]);

export function getActiveWorkspaceContext() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("workshop_auth_session") : null;
    if (raw) {
      const user = JSON.parse(raw);
      const workspaceId = user.workspace_id || user.workspaceId || user.workspaceCode;
      const userId = user.id || user.userId;
      
      const isLegacyOwner = 
        userId === "867f5819-e911-45f2-9d4f-d4a7f955ef5f" ||
        (user.email && user.email.toLowerCase() === "afshineem@gmail.com") ||
        userId === "admin_local";
      
      return {
        workspaceId,
        userId,
        email: user.email,
        isLegacyOwner: Boolean(isLegacyOwner)
      };
    }
  } catch (_) {}

  return {
    workspaceId: null,
    userId: null,
    email: null,
    isLegacyOwner: false // unauthenticated sessions must never be treated as legacy owner
  };
}

export function getScopedSettingKey(baseKey) {
  const ctx = getActiveWorkspaceContext();
  if (ctx.isLegacyOwner) {
    return baseKey;
  }
  const scopeId = ctx.workspaceId || ctx.userId;
  if (!scopeId) {
    return `${baseKey}_unauthenticated_sandbox`;
  }
  return `${baseKey}_ws_${scopeId}`;
}

export function getScopedTaskProjectId(rawProjectId) {
  const ctx = getActiveWorkspaceContext();
  const pid = rawProjectId || DEFAULT_PROJECT_ID;
  if (ctx.isLegacyOwner) {
    return pid;
  }
  const scopeId = ctx.workspaceId || ctx.userId;
  if (!scopeId) {
    return `${pid}_unauthenticated_sandbox`;
  }
  if (pid.includes('__ws_')) {
    return pid;
  }
  return `${pid}__ws_${scopeId}`;
}

export function unscopeTaskProjectId(scopedProjectId) {
  if (!scopedProjectId) return DEFAULT_PROJECT_ID;
  return scopedProjectId.split('__ws_')[0];
}

export function getScopedWorkersQuery() {
  const ctx = getActiveWorkspaceContext();
  let query = supabase.from('workers').select('*');
  if (ctx.isLegacyOwner) {
    return query.or('user_id.eq.867f5819-e911-45f2-9d4f-d4a7f955ef5f,user_id.is.null');
  }
  if (ctx.userId) {
    return query.eq('user_id', ctx.userId);
  }
  return query.eq('user_id', 'unauthenticated_empty_state');
}

export function getScopedAttendanceLogsQuery() {
  const ctx = getActiveWorkspaceContext();
  let query = supabase.from('attendance_logs').select('*');
  if (ctx.isLegacyOwner) {
    return query.or('user_id.eq.867f5819-e911-45f2-9d4f-d4a7f955ef5f,user_id.is.null');
  }
  if (ctx.userId) {
    return query.eq('user_id', ctx.userId);
  }
  return query.eq('user_id', 'unauthenticated_empty_state');
}


export function getPendingDeletedAccounts() {
  try {
    const raw = localStorage.getItem(PENDING_DELETED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPendingAccountDeletion(accountId) {
  if (!accountId) return;
  const list = getPendingDeletedAccounts();
  if (!list.includes(accountId)) {
    list.push(accountId);
    localStorage.setItem(PENDING_DELETED_ACCOUNTS_KEY, JSON.stringify(list));
  }
}

export function clearPendingAccountDeletion(accountId) {
  const list = getPendingDeletedAccounts().filter((id) => id !== accountId);
  localStorage.setItem(PENDING_DELETED_ACCOUNTS_KEY, JSON.stringify(list));
}

export function getPendingDeletedIncomes() {
  try {
    const raw = localStorage.getItem(PENDING_DELETED_INCOMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPendingIncomeDeletion(incomeId) {
  if (!incomeId) return;
  const list = getPendingDeletedIncomes();
  if (!list.includes(incomeId)) {
    list.push(incomeId);
    localStorage.setItem(PENDING_DELETED_INCOMES_KEY, JSON.stringify(list));
  }
}

export function clearPendingIncomeDeletion(incomeId) {
  const list = getPendingDeletedIncomes().filter((id) => id !== incomeId);
  localStorage.setItem(PENDING_DELETED_INCOMES_KEY, JSON.stringify(list));
}

export function getPendingDeletedGroups() {
  try {
    const raw = localStorage.getItem(PENDING_DELETED_GROUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPendingGroupDeletion(groupId) {
  if (!groupId) return;
  const list = getPendingDeletedGroups();
  if (!list.includes(groupId)) {
    list.push(groupId);
    localStorage.setItem(PENDING_DELETED_GROUPS_KEY, JSON.stringify(list));
  }
}

export function clearPendingGroupDeletion(groupId) {
  const list = getPendingDeletedGroups().filter((id) => id !== groupId);
  localStorage.setItem(PENDING_DELETED_GROUPS_KEY, JSON.stringify(list));
}

export function getWorkerProjectMap() {
  try {
    const raw = localStorage.getItem(WORKER_PROJECTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveWorkerProjectMap(map) {
  try {
    localStorage.setItem(WORKER_PROJECTS_STORAGE_KEY, JSON.stringify(map || {}));
  } catch (_) {}
}

export function getPendingDeletedProjects() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_DELETED_PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordPendingProjectDeletion(projectId) {
  if (!projectId) return;
  const list = getPendingDeletedProjects();
  if (!list.includes(projectId)) {
    list.push(projectId);
    localStorage.setItem(PENDING_DELETED_PROJECTS_KEY, JSON.stringify(list));
  }
}

export function clearPendingProjectDeletion(projectId) {
  const list = getPendingDeletedProjects().filter(id => id !== projectId);
  localStorage.setItem(PENDING_DELETED_PROJECTS_KEY, JSON.stringify(list));
}

export function getPendingDeletedSections() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_DELETED_SECTIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordPendingSectionDeletion(sectionId) {
  if (!sectionId) return;
  const list = getPendingDeletedSections();
  if (!list.includes(sectionId)) {
    list.push(sectionId);
    localStorage.setItem(PENDING_DELETED_SECTIONS_KEY, JSON.stringify(list));
  }
}

export function clearPendingSectionDeletion(sectionId) {
  const list = getPendingDeletedSections().filter(id => id !== sectionId);
  localStorage.setItem(PENDING_DELETED_SECTIONS_KEY, JSON.stringify(list));
}

const PENDING_DELETED_COUNTERPARTIES_KEY = 'workshop_pending_deleted_counterparties';

export function getPendingDeletedCounterparties() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_DELETED_COUNTERPARTIES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordPendingCounterpartyDeletion(counterpartyId) {
  if (!counterpartyId) return;
  const list = getPendingDeletedCounterparties();
  if (!list.includes(counterpartyId)) {
    list.push(counterpartyId);
    localStorage.setItem(PENDING_DELETED_COUNTERPARTIES_KEY, JSON.stringify(list));
  }
}

export function clearPendingCounterpartyDeletion(counterpartyId) {
  const list = getPendingDeletedCounterparties().filter(id => id !== counterpartyId);
  localStorage.setItem(PENDING_DELETED_COUNTERPARTIES_KEY, JSON.stringify(list));
}

const PENDING_DELETED_EXPENSES_KEY = 'workshop_pending_deleted_expenses';

export function getPendingDeletedExpenses() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_DELETED_EXPENSES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordPendingExpenseDeletion(expenseId) {
  if (!expenseId) return;
  const list = getPendingDeletedExpenses();
  if (!list.includes(expenseId)) {
    list.push(expenseId);
    localStorage.setItem(PENDING_DELETED_EXPENSES_KEY, JSON.stringify(list));
  }
}

export function clearPendingExpenseDeletion(expenseId) {
  const list = getPendingDeletedExpenses().filter(id => id !== expenseId);
  localStorage.setItem(PENDING_DELETED_EXPENSES_KEY, JSON.stringify(list));
}

export function getPendingDeletedWorkers() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_DELETED_WORKERS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordPendingWorkerDeletion(workerId) {
  if (!workerId) return;
  const list = getPendingDeletedWorkers();
  if (!list.includes(workerId)) {
    list.push(workerId);
    localStorage.setItem(PENDING_DELETED_WORKERS_KEY, JSON.stringify(list));
  }
}

export function clearPendingWorkerDeletion(workerId) {
  const list = getPendingDeletedWorkers().filter(id => id !== workerId);
  localStorage.setItem(PENDING_DELETED_WORKERS_KEY, JSON.stringify(list));
}

// Proactively clear any stale pending deletion locks on module load
try {
  if (typeof localStorage !== 'undefined') {
    clearPendingWorkerDeletion('id_mu5ywbpj_phobsou');
    localStorage.removeItem(PENDING_DELETED_LOGS_KEY);
  }
} catch (_) {}

export function getPendingDeletedLogs() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_DELETED_LOGS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordPendingLogDeletion(logId) {
  if (!logId) return;
  const list = getPendingDeletedLogs();
  if (!list.includes(logId)) {
    list.push(logId);
    localStorage.setItem(PENDING_DELETED_LOGS_KEY, JSON.stringify(list));
  }
}

export function clearPendingLogDeletion(logId) {
  const list = getPendingDeletedLogs().filter(id => id !== logId);
  localStorage.setItem(PENDING_DELETED_LOGS_KEY, JSON.stringify(list));
}

export function getPendingDeletedPayments() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_DELETED_PAYMENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordPendingPaymentDeletion(paymentId) {
  if (!paymentId) return;
  const list = getPendingDeletedPayments();
  if (!list.includes(paymentId)) {
    list.push(paymentId);
    localStorage.setItem(PENDING_DELETED_PAYMENTS_KEY, JSON.stringify(list));
  }
}

export function clearPendingPaymentDeletion(paymentId) {
  const list = getPendingDeletedPayments().filter(id => id !== paymentId);
  localStorage.setItem(PENDING_DELETED_PAYMENTS_KEY, JSON.stringify(list));
}

export async function flushPendingDeletions() {
  if (!navigator.onLine) return;
  const now = new Date().toISOString();

  // Flush pending deleted workers
  const pendingWorkers = getPendingDeletedWorkers();
  for (const workerId of pendingWorkers) {
    try {
      await Promise.all([
        supabase.from('workers').update({ deleted_at: now, updated_at: now }).eq('id', workerId),
        supabase.from('attendance_logs').update({ deleted_at: now, updated_at: now }).eq('worker_id', workerId)
      ]);
      clearPendingWorkerDeletion(workerId);
      removeWorkerProjectMapLive(workerId).catch(console.warn);
    } catch (err) {
      console.warn('Flush worker deletion warning:', workerId, err);
    }
  }

  // Flush pending deleted logs
  const pendingLogs = getPendingDeletedLogs();
  for (const logId of pendingLogs) {
    try {
      const local = await db.attendanceLogs.get(logId);
      if (local) {
        // Log is active locally, cancel pending deletion
        clearPendingLogDeletion(logId);
        continue;
      }
      await supabase.from('attendance_logs').update({ deleted_at: now, updated_at: now }).eq('id', logId);
      clearPendingLogDeletion(logId);
    } catch (err) {
      console.warn('Flush log deletion warning:', logId, err);
    }
  }

  // Flush pending deleted payments
  const pendingPayments = getPendingDeletedPayments();
  if (pendingPayments.length > 0) {
    try {
      await pushPaymentsLive();
    } catch (err) {
      console.warn('Flush payment deletion warning:', err);
    }
  }

  // Flush pending deleted projects
  const pendingProjects = getPendingDeletedProjects();
  for (const projectId of pendingProjects) {
    try {
      await deleteProjectLive(projectId);
    } catch (err) {
      console.warn('Flush project deletion warning:', projectId, err);
    }
  }

  // Flush pending deleted sections
  const pendingSections = getPendingDeletedSections();
  for (const sectionId of pendingSections) {
    try {
      await deleteProjectSectionLive(sectionId);
    } catch (err) {
      console.warn('Flush section deletion warning:', sectionId, err);
    }
  }

  // Flush pending deleted groups
  const pendingGroups = getPendingDeletedGroups();
  for (const groupId of pendingGroups) {
    try {
      await deleteGroupLive(groupId);
    } catch (err) {
      console.warn('Flush group deletion warning:', groupId, err);
    }
  }

  // Flush pending deleted expenses
  const pendingExpenses = getPendingDeletedExpenses();
  for (const expId of pendingExpenses) {
    try {
      await deleteExpenseLive(expId);
    } catch (err) {
      console.warn('Flush expense deletion warning:', expId, err);
    }
  }

  // Flush pending deleted financial accounts
  const pendingAccounts = getPendingDeletedAccounts();
  for (const accId of pendingAccounts) {
    try {
      await deleteFinancialAccountLive(accId);
    } catch (err) {
      console.warn('Flush account deletion warning:', accId, err);
    }
  }

  // Flush pending deleted treasury incomes
  const pendingIncomes = getPendingDeletedIncomes();
  for (const incId of pendingIncomes) {
    try {
      await deleteTreasuryIncomeLive(incId);
    } catch (err) {
      console.warn('Flush income deletion warning:', incId, err);
    }
  }
}

/**
 * Initialize Realtime Sync:
 * 1. Seed or Reconcile local and cloud data on startup
 * 2. Subscribe to Postgres Realtime changes via WebSockets
 * 3. Start background safety-net polling
 * 4. Setup mobile visibility/focus listeners for instant sync on screen unlock
 */
export async function initRealtimeSync() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('🔄 Initializing Supabase Realtime Sync...');

  try {
    await purgeDummySeedWorkers();
    await cleanupDuplicateAttendanceLogs();
    await flushPendingDeletions();
    await autoInitialSync();
  } catch (err) {
    console.warn('Initial sync deferred (offline or connection issue):', err.message);
  }

  // Subscribe to Realtime WebSocket changes
  subscribeToRealtime();

  // Background polling every 4 seconds as a rock-solid fallback for all devices
  setInterval(() => {
    if (navigator.onLine) {
      flushPendingDeletions().catch(() => {});
      pullRemoteChangesSilently().catch(() => {});
    }
  }, 4000);

  // Sync automatically when browser comes back online
  window.addEventListener('online', () => {
    console.log('🌐 Internet connection restored. Syncing with Supabase...');
    subscribeToRealtime();
    flushPendingDeletions().catch(() => {});
    fullSyncBothDirections().catch(() => {});
  });

  // Mobile / Tab visibility & focus recovery:
  // When mobile browser tab becomes visible or screen turns on, sync immediately!
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      console.log('📱 App became visible. Pulling latest cloud changes...');
      flushPendingDeletions().catch(() => {});
      pullRemoteChangesSilently().catch(() => {});
    }
  });

  window.addEventListener('focus', () => {
    if (navigator.onLine) {
      pullRemoteChangesSilently().catch(() => {});
    }
  });
}

/**
 * Auto sync on startup:
 * If cloud has 0 rows and local has rows -> push local to cloud!
 * If cloud has rows -> pull cloud to local!
 */
export async function autoInitialSync() {
  if (!navigator.onLine) return;

  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) {
    console.warn('[Sync] Unauthenticated session - skipping autoInitialSync.');
    return;
  }

  const [wRes, lRes] = await Promise.all([
    getScopedWorkersQuery(),
    getScopedAttendanceLogsQuery()
  ]);

  if (wRes.error || lRes.error) {
    console.error('Error querying Supabase on init:', wRes.error || lRes.error);
    return;
  }

  const cloudWorkers = wRes.data || [];
  const cloudLogs = lRes.data || [];
  const localWorkers = await db.workers.toArray();
  const localLogs = await db.attendanceLogs.toArray();

  console.log(`Cloud state: ${cloudWorkers.length} workers, ${cloudLogs.length} logs | Local state: ${localWorkers.length} workers, ${localLogs.length} logs`);

  // Case A: Cloud is empty (fresh account or newly created workspace)
  if (cloudWorkers.length === 0 && localWorkers.length > 0) {
    if (ctx.isLegacyOwner) {
      console.log('📤 Cloud is newly initialized for legacy owner. Pushing local data to Supabase...');
      await Promise.all([
        pushWorkersLive(localWorkers),
        pushLogsLive(localLogs)
      ]);
    } else {
      console.log('🧹 Fresh workspace in cloud: purging any orphaned or unowned local workers.');
      await db.workers.clear();
      await db.attendanceLogs.clear();
    }
    return;
  }

  // Case B: Reconcile Cloud data into local IndexedDB
  await pullWorkerProjectsLive(true);
  await pullGroupsLive(true);
  await pullWorkerMetadataLive(true);
  await reconcileCloudIntoLocal(cloudWorkers, cloudLogs);
  await pullPaymentsLive(true);
  await pullProjectsLive(true);
  await pullProjectSectionsLive(true);
  await pullExpensesLive(true);
  await pullExpenseCategoriesLive(true);
  await pullFinancialAccountsLive(true);
  await pullTreasuryIncomesLive(true);
  await pullAccountTransfersLive(true);
  await pullCounterpartiesLive(true);
  await pullGlobalOverdraftPolicyLive();

  // Auto-detect and push any local workers missing in cloud ONLY for legacy owner
  if (ctx.isLegacyOwner) {
    const cloudWorkerIds = new Set(cloudWorkers.map(w => w.id));
    const missingWorkers = localWorkers.filter(w => !cloudWorkerIds.has(w.id) && !w.deletedAt);
    if (missingWorkers.length > 0) {
      console.log(`Pushing ${missingWorkers.length} missing local workers to cloud...`);
      for (const mw of missingWorkers) {
        await pushWorkerLive(mw);
      }
    }
    await pushAllGroupsToCloud();
    await syncAllWorkerMetadataToCloud();
    await pushAllExpensesToCloud();
    await pushAllExpenseCategoriesToCloud();
    await pushAllFinancialAccountsToCloud();
    await pushAllTreasuryIncomesToCloud();
    await pushAllAccountTransfersToCloud();
  }
}

/**
 * Reconcile Supabase cloud rows into Dexie local database with automatic deduplication
 */
export async function reconcileCloudIntoLocal(cloudWorkers, cloudLogs) {
  const ctx = getActiveWorkspaceContext();
  const duplicateIdsToDeleteFromCloud = [];
  const pendingWorkers = new Set(getPendingDeletedWorkers());
  const pendingLogs = new Set(getPendingDeletedLogs());

  // Filter rows strictly to active tenant
  const tenantWorkers = (cloudWorkers || []).filter(w => {
    if (ctx.isLegacyOwner) return true;
    return w.user_id === ctx.userId;
  });
  const tenantLogs = (cloudLogs || []).filter(l => {
    if (ctx.isLegacyOwner) return true;
    return l.user_id === ctx.userId;
  });


  await purgeDummySeedWorkers();

  let cloudMetadata = {};
  try {
    const { data: sData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_worker_metadata'))
      .maybeSingle();
    if (sData?.setting_value) {
      cloudMetadata = JSON.parse(sData.setting_value) || {};
    }
  } catch (_) {}

  await db.transaction('rw', [db.workers, db.attendanceLogs], async () => {
    if (!ctx.isLegacyOwner) {
      const cloudWorkerIds = new Set(tenantWorkers.map(w => w.id));
      const localWorkers = await db.workers.toArray();
      for (const lw of localWorkers) {
        if (LEAKED_CROSS_TENANT_WORKER_IDS.has(lw.id) || (!cloudWorkerIds.has(lw.id) && (!lw.userId || lw.userId !== ctx.userId))) {
          await db.workers.delete(lw.id).catch(() => {});
          await db.attendanceLogs.where('workerId').equals(lw.id).delete().catch(() => {});
        }
      }
      const cloudLogIds = new Set(tenantLogs.map(l => l.id));
      const localLogs = await db.attendanceLogs.toArray();
      for (const ll of localLogs) {
        if (LEAKED_CROSS_TENANT_WORKER_IDS.has(ll.workerId) || (!cloudLogIds.has(ll.id) && (!ll.userId || ll.userId !== ctx.userId))) {
          await db.attendanceLogs.delete(ll.id).catch(() => {});
        }
      }
    }

    // 1. Reconcile Workers
    for (const w of tenantWorkers) {
      if (!ctx.isLegacyOwner && LEAKED_CROSS_TENANT_WORKER_IDS.has(w.id)) {
        await db.workers.delete(w.id).catch(() => {});
        await db.attendanceLogs.where('workerId').equals(w.id).delete().catch(() => {});
        continue;
      }
      if (w.deleted_at) {
        await db.workers.delete(w.id);
        await db.attendanceLogs.where('workerId').equals(w.id).delete();
        clearPendingWorkerDeletion(w.id);
      } else {
        // If worker was marked deleted locally, keep it deleted!
        if (pendingWorkers.has(w.id)) {
          await db.workers.delete(w.id);
          await db.attendanceLogs.where('workerId').equals(w.id).delete();
          continue;
        }

        // Check if local worker is newer
        const localW = await db.workers.get(w.id);
        if (localW && localW.updatedAt && w.updated_at) {
          if (new Date(localW.updatedAt).getTime() > new Date(w.updated_at).getTime()) {
            continue;
          }
        }

        const projectMap = getWorkerProjectMap();
        const resolvedProjectId = w.project_id || localW?.projectId || projectMap[w.id] || DEFAULT_PROJECT_ID;
        const meta = cloudMetadata[w.id] || {};

        const localTime = localW?.updatedAt ? new Date(localW.updatedAt).getTime() : 0;
        const metaTime = meta.updatedAt ? new Date(meta.updatedAt).getTime() : 0;
        const localIsNewer = localTime > metaTime;

        await db.workers.put({
          ...(localW || {}),
          id: w.id,
          name: w.name,
          phone: w.phone || '',
          role: w.role || 'کارگر',
          dailyRate: Number(w.daily_rate) || 0,
          overtimeHourlyRate: Number(w.overtime_hourly_rate) || 0,
          isActive: Number(w.is_active) === 0 ? 0 : 1,
          monthlySalary: (localIsNewer && localW?.monthlySalary !== undefined)
            ? Number(localW.monthlySalary)
            : (meta.monthlySalary !== undefined ? Number(meta.monthlySalary) : (Number(localW?.monthlySalary) || 0)),
          monthlyLeaveDays: (localIsNewer && localW?.monthlyLeaveDays !== undefined)
            ? Number(localW.monthlyLeaveDays)
            : (meta.monthlyLeaveDays !== undefined ? Number(meta.monthlyLeaveDays) : (Number(localW?.monthlyLeaveDays) || 0)),
          leavePolicy: (localIsNewer && localW?.leavePolicy)
            ? localW.leavePolicy
            : (meta.leavePolicy || localW?.leavePolicy || 'accumulate'),
          bonusLeaveDays: (localIsNewer && localW?.bonusLeaveDays !== undefined)
            ? Number(localW.bonusLeaveDays)
            : (meta.bonusLeaveDays !== undefined ? Number(meta.bonusLeaveDays) : (Number(localW?.bonusLeaveDays) || 0)),
          fridayRateMultiplier: (localIsNewer && localW?.fridayRateMultiplier !== undefined)
            ? Number(localW.fridayRateMultiplier)
            : (meta.fridayRateMultiplier !== undefined ? Number(meta.fridayRateMultiplier) : (Number(localW?.fridayRateMultiplier) || 2.0)),
          defaultSectionId: (localIsNewer && localW?.defaultSectionId !== undefined)
            ? localW.defaultSectionId
            : (meta.defaultSectionId !== undefined ? meta.defaultSectionId : (localW?.defaultSectionId || null)),
          groupId: (localIsNewer && localW?.groupId !== undefined)
            ? localW.groupId
            : (meta.groupId !== undefined ? meta.groupId : (localW?.groupId || null)),
          teamRole: (localIsNewer && localW?.teamRole)
            ? localW.teamRole
            : (meta.teamRole || localW?.teamRole || 'Worker'),
          wageType: (localIsNewer && localW?.wageType)
            ? localW.wageType
            : (meta.wageType || localW?.wageType || 'standard'),
          isArchived: (localIsNewer && localW?.isArchived !== undefined)
            ? localW.isArchived
            : (meta.isArchived !== undefined ? meta.isArchived : (localW?.isArchived || false)),
          status: (localIsNewer && localW?.status)
            ? localW.status
            : (meta.status || localW?.status || (meta.isArchived ? 'archived' : 'active')),
          isGlobal: (localIsNewer && localW?.isGlobal !== undefined)
            ? Boolean(localW.isGlobal)
            : (meta.isGlobal !== undefined ? Boolean(meta.isGlobal) : Boolean(localW?.isGlobal)),
          projectRates: (localIsNewer && localW?.projectRates)
            ? localW.projectRates
            : (meta.projectRates || localW?.projectRates || {}),
          username: meta.username || localW?.username || '',
          password: meta.password || localW?.password || '',
          projectId: resolvedProjectId,
          userId: w.user_id || w.userId || localW?.userId || 'default_user',
          createdAt: w.created_at || localW?.createdAt,
          updatedAt: (localIsNewer && localW?.updatedAt) ? localW.updatedAt : (w.updated_at || localW?.updatedAt)
        });
      }
    }

    // 2. Reconcile Attendance Logs
    const dedupedLogsMap = new Map();

    for (const l of tenantLogs) {
      const canonicalId = getAttendanceLogId(l.worker_id, l.date);
      if (l.deleted_at) {
        await db.attendanceLogs.delete(l.id);
        await db.attendanceLogs.delete(canonicalId);
        clearPendingLogDeletion(l.id);
        clearPendingLogDeletion(canonicalId);
        continue;
      }

      // If user had marked this log deleted locally, but cloud has an active version (e.g. restored or newer),
      // clear the pending deletion lock and accept the active record.
      if (pendingLogs.has(l.id) || pendingLogs.has(canonicalId)) {
        clearPendingLogDeletion(l.id);
        clearPendingLogDeletion(canonicalId);
        pendingLogs.delete(l.id);
        pendingLogs.delete(canonicalId);
      }

      const key = `${l.worker_id}_${l.date}`;
      const existing = dedupedLogsMap.get(key);
      if (!existing) {
        dedupedLogsMap.set(key, l);
      } else {
        const timeL = l.updated_at || l.created_at || '';
        const timeEx = existing.updated_at || existing.created_at || '';
        if (timeL.localeCompare(timeEx) > 0) {
          duplicateIdsToDeleteFromCloud.push(existing.id);
          dedupedLogsMap.set(key, l);
        } else {
          duplicateIdsToDeleteFromCloud.push(l.id);
        }
      }
    }

    for (const l of dedupedLogsMap.values()) {
      const canonicalId = getAttendanceLogId(l.worker_id, l.date);
      if (l.id !== canonicalId) {
        await db.attendanceLogs.delete(l.id);
      }

      // If local log is newer, do not overwrite with stale cloud data!
      const localLog = await db.attendanceLogs.get(canonicalId);
      if (localLog && localLog.updatedAt && l.updated_at) {
        if (new Date(localLog.updatedAt).getTime() > new Date(l.updated_at).getTime()) {
          continue;
        }
      }

      let sectionId = l.section_id || null;
      let projectId = l.project_id || l.projectId || DEFAULT_PROJECT_ID;
      let isSettled = l.is_settled || false;
      let settlementReceiptId = l.settlement_receipt_id || null;
      let cleanNotes = l.notes || '';
      if (cleanNotes.includes('__META__')) {
        const parts = cleanNotes.split('__META__');
        if (parts.length >= 3) {
          try {
            const meta = JSON.parse(parts[1]);
            if (meta.s) sectionId = meta.s;
            if (meta.p) projectId = meta.p;
            isSettled = Boolean(meta.st);
            settlementReceiptId = meta.rid || null;
            cleanNotes = parts.slice(2).join('').trim();
          } catch (_) {}
        }
      } else {
        isSettled = l.is_settled !== undefined ? Boolean(l.is_settled) : (localLog?.isSettled || false);
        settlementReceiptId = l.settlement_receipt_id || localLog?.settlementReceiptId || null;
      }

      await db.attendanceLogs.put({
        id: canonicalId,
        workerId: l.worker_id,
        date: l.date,
        type: l.type,
        overtimeHours: Number(l.overtime_hours) || 0,
        calculatedDailyWage: roundCurrency(l.calculated_daily_wage, l.currency),
        calculatedOvertimeWage: roundCurrency(l.calculated_overtime_wage, l.currency),
        totalDayPay: roundCurrency(l.total_day_pay, l.currency),
        notes: cleanNotes,
        sectionId: sectionId,
        projectId: projectId,
        isSettled: Boolean(isSettled),
        settlementReceiptId: settlementReceiptId,
        userId: l.user_id || l.userId || 'default_user',
        createdAt: l.created_at,
        updatedAt: l.updated_at
      });
    }

    // 3. Proactively push any local workers that don't exist in cloud yet (strictly scoped to active tenant)
    const localWorkers = await db.workers.toArray();
    if (ctx.isLegacyOwner) {
      if (cloudWorkers.length > 0) {
        const cloudWorkerIds = new Set(cloudWorkers.map(w => w.id));
        for (const lw of localWorkers) {
          if (!cloudWorkerIds.has(lw.id) && !pendingWorkers.has(lw.id)) {
            pushWorkerLive(lw).catch(console.warn);
          }
        }
      }
    } else {
      // Non-legacy tenant: purge foreign/orphaned workers from local Dexie and only push legit un-synced workers owned by this tenant
      const cloudWorkerIds = new Set(tenantWorkers.map(w => w.id));
      for (const lw of localWorkers) {
        if (LEAKED_CROSS_TENANT_WORKER_IDS.has(lw.id)) {
          await db.workers.delete(lw.id).catch(() => {});
          await db.attendanceLogs.where('workerId').equals(lw.id).delete().catch(() => {});
          if (db.payments) {
            await db.payments.where('workerId').equals(lw.id).delete().catch(() => {});
          }
          continue;
        }
        if (!cloudWorkerIds.has(lw.id)) {
          if (!lw.userId || lw.userId !== ctx.userId) {
            // Orphaned worker from another tenant or previous session - delete immediately from local Dexie!
            await db.workers.delete(lw.id).catch(() => {});
            await db.attendanceLogs.where('workerId').equals(lw.id).delete().catch(() => {});
          } else if (lw.userId === ctx.userId && !pendingWorkers.has(lw.id)) {
            // Legit offline-created worker belonging to active tenant
            pushWorkerLive(lw).catch(console.warn);
          }
        }
      }
    }
  });

  if (duplicateIdsToDeleteFromCloud.length > 0) {
    try {
      await supabase.from('attendance_logs').delete().in('id', duplicateIdsToDeleteFromCloud);
    } catch (_) {}
  }

  const now = new Date().toISOString();
  setLastSyncTime(now);
  window.dispatchEvent(new CustomEvent('workshop-sync-complete', { detail: { time: now } }));
}

/**
 * Push all local data into Supabase
 */
export async function pushAllLocalToCloud() {
  const pendingWorkers = new Set(getPendingDeletedWorkers());
  const pendingLogs = new Set(getPendingDeletedLogs());

  const localWorkers = await db.workers.toArray();
  const activeWorkers = localWorkers.filter(w => !pendingWorkers.has(w.id));

  const localLogs = await db.attendanceLogs.toArray();
  const activeLogs = localLogs.filter(l => !pendingLogs.has(l.id));

  if (activeWorkers.length > 0) {
    const map = getWorkerProjectMap();
    let mapChanged = false;
    for (const w of activeWorkers) {
      if (w.projectId && map[w.id] !== w.projectId) {
        map[w.id] = w.projectId;
        mapChanged = true;
      }
    }
    if (mapChanged) {
      saveWorkerProjectMap(map);
      syncAllWorkerProjectsToCloud().catch(console.warn);
    }

    const workerPayload = activeWorkers.map(w => ({
      id: w.id,
      name: w.name,
      phone: w.phone || null,
      role: w.role || 'کارگر',
      daily_rate: Number(w.dailyRate) || 0,
      overtime_hourly_rate: Number(w.overtimeHourlyRate) || 0,
      is_active: Number(w.isActive) === 0 ? 0 : 1,
      deleted_at: w.deletedAt || null,
      updated_at: w.updatedAt || new Date().toISOString()
    }));

    const { error } = await supabase.from('workers').upsert(workerPayload);
    if (error) console.error('Error uploading local workers to Supabase:', error);

    await syncAllWorkerMetadataToCloud();
  }

  await pushAllGroupsToCloud();

  if (activeLogs.length > 0) {
    const logPayload = activeLogs.map(l => {
      let cleanNotes = (l.notes || '').trim();
      // Cleanly strip any old META block first
      let actualUserNotes = cleanNotes.replace(/__META__[\s\S]*?__META__\n?/, '').trim();
      const meta = {};
      if (l.sectionId) meta.s = l.sectionId;
      if (l.projectId && l.projectId !== DEFAULT_PROJECT_ID) meta.p = l.projectId;
      if (l.isSettled) meta.st = 1;
      if (l.settlementReceiptId) meta.rid = l.settlementReceiptId;
      
      let finalNotes = actualUserNotes;
      if (Object.keys(meta).length > 0) {
        const metaStr = `__META__${JSON.stringify(meta)}__META__`;
        finalNotes = metaStr + (actualUserNotes ? '\n' + actualUserNotes : '');
      }

      return {
        id: getAttendanceLogId(l.workerId, l.date),
        worker_id: l.workerId,
        date: l.date,
        type: l.type || 'full',
        overtime_hours: Number(l.overtimeHours) || 0,
        calculated_daily_wage: Number(l.calculatedDailyWage) || 0,
        calculated_overtime_wage: Number(l.calculatedOvertimeWage) || 0,
        total_day_pay: Number(l.totalDayPay) || 0,
        notes: finalNotes || null,
        deleted_at: null,
        updated_at: l.updatedAt || new Date().toISOString()
      };
    });

    const { error } = await supabase.from('attendance_logs').upsert(logPayload);
    if (error) console.error('Error uploading local logs to Supabase:', error);
  }

  await pushAllFinancialAccountsToCloud();
  await pushAllTreasuryIncomesToCloud();

  const now = new Date().toISOString();
  setLastSyncTime(now);
  console.log('✅ Local data uploaded to Supabase successfully!');
}

/**
 * Subscribe to WebSocket changes in real time
 */
function subscribeToRealtime() {
  if (!navigator.onLine) return;
  try {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

  realtimeChannel = supabase
    .channel('workshop-live-stream')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, async (payload) => {
      console.log('⚡ Realtime Worker Change received:', payload.eventType, payload);
      if (payload.eventType === 'DELETE' || payload.new?.deleted_at) {
        const idToDelete = payload.new?.id || payload.old?.id;
        if (idToDelete) {
          await db.workers.delete(idToDelete);
          await db.attendanceLogs.where('workerId').equals(idToDelete).delete().catch(() => {});
          clearPendingWorkerDeletion(idToDelete);
        }
      } else if (payload.new) {
        const w = payload.new;
        const ctx = getActiveWorkspaceContext();
        if (!ctx.isLegacyOwner && (LEAKED_CROSS_TENANT_WORKER_IDS.has(w.id) || (w.user_id && w.user_id !== ctx.userId))) {
          await db.workers.delete(w.id).catch(() => {});
          await db.attendanceLogs.where('workerId').equals(w.id).delete().catch(() => {});
          return; // Ignore worker change from other tenants or blacklisted IDs
        }
        if (w.deleted_at) {
          await db.workers.delete(w.id);
          await db.attendanceLogs.where('workerId').equals(w.id).delete().catch(() => {});
          clearPendingWorkerDeletion(w.id);
        } else {
          const pending = new Set(getPendingDeletedWorkers());
          if (pending.has(w.id)) {
            await db.workers.delete(w.id);
            return;
          }
          const localW = await db.workers.get(w.id);
          const projectMap = getWorkerProjectMap();
          const resolvedProjectId = w.project_id || localW?.projectId || projectMap[w.id] || DEFAULT_PROJECT_ID;

          if (localW && localW.updatedAt && w.updated_at) {
            if (new Date(localW.updatedAt).getTime() >= new Date(w.updated_at).getTime()) {
              return;
            }
          }

          await db.workers.put({
            ...(localW || {}),
            id: w.id,
            name: w.name,
            phone: w.phone || '',
            role: w.role,
            dailyRate: Number(w.daily_rate) || 0,
            overtimeHourlyRate: Number(w.overtime_hourly_rate) || 0,
            isActive: Number(w.is_active) === 0 ? 0 : 1,
            monthlySalary: localW?.monthlySalary !== undefined ? Number(localW.monthlySalary) : (Number(w.monthlySalary) || 0),
            monthlyLeaveDays: localW?.monthlyLeaveDays !== undefined ? Number(localW.monthlyLeaveDays) : (Number(w.monthlyLeaveDays) || 0),
            leavePolicy: localW?.leavePolicy || w.leavePolicy || 'accumulate',
            bonusLeaveDays: localW?.bonusLeaveDays !== undefined ? Number(localW.bonusLeaveDays) : (Number(w.bonusLeaveDays) || 0),
            fridayRateMultiplier: localW?.fridayRateMultiplier !== undefined ? Number(localW.fridayRateMultiplier) : (Number(w.fridayRateMultiplier) || 2.0),
            isGlobal: localW?.isGlobal !== undefined ? Boolean(localW.isGlobal) : Boolean(w.isGlobal),
            projectRates: localW?.projectRates || w.projectRates || {},
            isArchived: localW?.isArchived !== undefined ? Boolean(localW.isArchived) : Boolean(w.isArchived),
            status: localW?.status || w.status || (localW?.isArchived ? 'archived' : 'active'),
            defaultSectionId: w.default_section_id || w.defaultSectionId || localW?.defaultSectionId || null,
            groupId: w.group_id || w.groupId || localW?.groupId || null,
            teamRole: w.team_role || w.teamRole || localW?.teamRole || 'Worker',
            wageType: w.wageType || localW?.wageType || 'standard',
            projectId: resolvedProjectId,
            userId: w.user_id || w.userId || localW?.userId || 'default_user',
            createdAt: w.created_at || localW?.createdAt,
            updatedAt: w.updated_at || localW?.updatedAt
          });
        }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, async (payload) => {
      console.log('⚡ Realtime Attendance Log Change received:', payload.eventType, payload);
      const idToDelete = payload.new?.id || payload.old?.id;
      if (payload.eventType === 'DELETE' || payload.new?.deleted_at) {
        if (idToDelete) {
          await db.attendanceLogs.delete(idToDelete);
        }
        if (payload.old?.worker_id && payload.old?.date) {
          await db.attendanceLogs.delete(getAttendanceLogId(payload.old.worker_id, payload.old.date));
        }
      } else if (payload.new) {
        const l = payload.new;
        const ctx = getActiveWorkspaceContext();
        if (!ctx.isLegacyOwner && l.user_id && l.user_id !== ctx.userId) {
          return; // Ignore attendance log change from other tenants
        }
        const canonicalId = getAttendanceLogId(l.worker_id, l.date);
        if (l.deleted_at) {
          await db.attendanceLogs.delete(l.id);
          await db.attendanceLogs.delete(canonicalId);
        } else {
          clearPendingLogDeletion(l.id);
          clearPendingLogDeletion(canonicalId);

          // If local log is newer, don't overwrite
          const localLog = await db.attendanceLogs.get(canonicalId);
          if (localLog && localLog.updatedAt && l.updated_at) {
            if (new Date(localLog.updatedAt).getTime() > new Date(l.updated_at).getTime()) {
              return;
            }
          }

          let sectionId = l.section_id || null;
          let projectId = l.project_id || l.projectId || localLog?.projectId || DEFAULT_PROJECT_ID;
          let isSettled = l.is_settled || false;
          let settlementReceiptId = l.settlement_receipt_id || null;
          let cleanNotes = l.notes || '';
          if (cleanNotes.includes('__META__')) {
            const parts = cleanNotes.split('__META__');
            if (parts.length >= 3) {
              try {
                const meta = JSON.parse(parts[1]);
                if (meta.s) sectionId = meta.s;
                if (meta.p) projectId = meta.p;
                isSettled = Boolean(meta.st);
                settlementReceiptId = meta.rid || null;
                cleanNotes = parts.slice(2).join('').trim();
              } catch (_) {}
            }
          } else {
            isSettled = l.is_settled !== undefined ? Boolean(l.is_settled) : (localLog?.isSettled || false);
            settlementReceiptId = l.settlement_receipt_id || localLog?.settlementReceiptId || null;
          }

          await db.attendanceLogs.put({
            id: canonicalId,
            workerId: l.worker_id,
            date: l.date,
            type: l.type,
            overtimeHours: Number(l.overtime_hours) || 0,
            calculatedDailyWage: roundCurrency(l.calculated_daily_wage, l.currency),
            calculatedOvertimeWage: roundCurrency(l.calculated_overtime_wage, l.currency),
            totalDayPay: roundCurrency(l.total_day_pay, l.currency),
            notes: cleanNotes,
            sectionId: sectionId,
            projectId: projectId,
            isSettled: Boolean(isSettled),
            settlementReceiptId: settlementReceiptId,
            userId: l.user_id || l.userId || 'default_user',
            createdAt: l.created_at,
            updatedAt: l.updated_at
          });
        }
      }
    })
    .on('broadcast', { event: 'workshop_sync' }, async ({ payload }) => {
      if (payload?.senderId && payload.senderId === CLIENT_ID) {
        // Ignore echo of broadcast sent by ourselves
        return;
      }
      console.log('⚡ Realtime Broadcast received from peer:', payload);
      const syncType = payload?.type;
      if (syncType === 'projects' || syncType === 'all') {
        await pullProjectsLive(true);
        await pullProjectSectionsLive(true);
      } else if (syncType === 'sections') {
        await pullProjectSectionsLive(true);
      } else if (syncType === 'payments') {
        await pullPaymentsLive(true);
      } else if (syncType === 'groups') {
        await pullGroupsLive(true);
      } else if (syncType === 'workers') {
        await pullWorkerProjectsLive(true);
        await pullWorkerMetadataLive(true);
      } else if (syncType === 'expenses') {
        await pullExpensesLive(true);
      } else if (syncType === 'accounts') {
        await pullFinancialAccountsLive(true);
      } else if (syncType === 'incomes') {
        await pullTreasuryIncomesLive(true);
      } else if (syncType === 'transfers') {
        await pullAccountTransfersLive(true);
      } else if (syncType === 'counterparties') {
        await pullCounterpartiesLive(true);
      } else if (syncType === 'loans') {
        await pullLoansLive(true);
      } else if (syncType === 'settings') {
        await pullGlobalOverdraftPolicyLive();
      } else {
        await pullProjectsLive(true);
        await pullProjectSectionsLive(true);
        await pullPaymentsLive(true);
        await pullWorkerProjectsLive(true);
        await pullGroupsLive(true);
        await pullWorkerMetadataLive(true);
        await pullExpensesLive(true);
        await pullFinancialAccountsLive(true);
        await pullTreasuryIncomesLive(true);
        await pullAccountTransfersLive(true);
        await pullLoansLive(true);
        await pullCounterpartiesLive(true);
        await pullGlobalOverdraftPolicyLive();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async (payload) => {
      console.log('⚡ Realtime Project Change received:', payload.eventType, payload);
      if (payload.eventType === 'DELETE') {
        const idToDelete = payload.old?.id;
        if (idToDelete) await db.projects.delete(idToDelete);
      } else if (payload.new) {
        const p = payload.new;
        const localP = await db.projects.get(p.id);
        await db.projects.put({
          ...(localP || {}),
          ...p,
          id: p.id,
          userId: p.user_id,
          name: p.name,
          currency: p.currency || 'IQD',
          standardWorkHours: Number(p.standard_work_hours) || 8,
          overtimeMultiplier: Number(p.overtime_multiplier) || 1.0,
          status: p.status || 'active',
          notes: p.notes || '',
          createdAt: p.created_at,
          updatedAt: p.updated_at
        });
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_sections' }, async (payload) => {
      console.log('⚡ Realtime Project Section Change received:', payload.eventType, payload);
      if (payload.eventType === 'DELETE') {
        const idToDelete = payload.old?.id;
        if (idToDelete) await db.projectSections.delete(idToDelete);
      } else if (payload.new) {
        const s = payload.new;
        const localS = await db.projectSections.get(s.id);
        await db.projectSections.put({
          ...(localS || {}),
          ...s,
          id: s.id,
          projectId: s.project_id || s.projectId,
          userId: s.user_id || s.userId,
          name: s.name,
          status: s.status || 'active',
          createdAt: s.created_at || s.createdAt,
          updatedAt: s.updated_at || s.updatedAt
        });
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_categories' }, async (payload) => {
      console.log('⚡ Realtime Expense Category Change received:', payload.eventType, payload);
      if (payload.eventType === 'DELETE') {
        const idToDelete = payload.old?.id;
        if (idToDelete) await db.expenseCategories.delete(idToDelete);
      } else if (payload.new) {
        const c = payload.new;
        await db.expenseCategories.put({
          id: c.id,
          projectId: c.project_id,
          userId: c.user_id,
          name: c.name,
          code: c.code || null,
          parentId: c.parent_id,
          level: Number(c.level) || 1,
          isSystem: !!c.is_system,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        });
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, async (payload) => {
      console.log('⚡ Realtime Expense Change received:', payload.eventType, payload);
      if (payload.eventType === 'DELETE') {
        const idToDelete = payload.old?.id;
        if (idToDelete) await db.expenses.delete(idToDelete);
      } else if (payload.new) {
        const exp = payload.new;
        if (exp.deleted_at) {
          await db.expenses.delete(exp.id);
        } else {
          const localE = await db.expenses.get(exp.id);
          await db.expenses.put({
            ...(localE || {}),
            id: exp.id,
            projectId: exp.project_id || localE?.projectId,
            userId: exp.user_id || localE?.userId,
            sectionId: exp.section_id ?? localE?.sectionId ?? null,
            categoryId: exp.category_id ?? localE?.categoryId ?? null,
            personId: exp.person_id ?? localE?.personId ?? null,
            personName: exp.person_name ?? localE?.personName ?? '',
            title: exp.title,
            amount: Number(exp.amount) || 0,
            currency: exp.currency || localE?.currency || 'IQD',
            paymentStatus: exp.payment_status || localE?.paymentStatus || 'paid',
            paymentMethod: exp.payment_method || localE?.paymentMethod || 'cash',
            receiptUrl: exp.receipt_url ?? localE?.receiptUrl ?? null,
            description: exp.description ?? localE?.description ?? '',
            expenseDate: exp.expense_date || localE?.expenseDate,
            createdAt: exp.created_at || localE?.createdAt,
            updatedAt: exp.updated_at || localE?.updatedAt
          });
        }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async (payload) => {
      const key = payload.new?.setting_key || payload.old?.setting_key;
      console.log('⚡ Realtime Settings table change detected:', key);
      if (key === getScopedSettingKey('app_financial_accounts')) {
        await pullFinancialAccountsLive(true);
      } else if (key === getScopedSettingKey('app_treasury_incomes')) {
        await pullTreasuryIncomesLive(true);
      } else if (key === getScopedSettingKey('app_account_transfers')) {
        await pullAccountTransfersLive(true);
      } else if (key === getScopedSettingKey('app_counterparties')) {
        await pullCounterpartiesLive(true);
      } else if (key === getScopedSettingKey('app_global_overdraft_policy')) {
        await pullGlobalOverdraftPolicyLive();
      } else if (key === getScopedSettingKey('app_projects')) {
        await pullProjectsLive(true);
      } else if (key === getScopedSettingKey('app_project_sections')) {
        await pullProjectSectionsLive(true);
      } else if (key === getScopedSettingKey('app_groups')) {
        await pullGroupsLive(true);
      } else if (key === getScopedSettingKey('app_loans')) {
        await pullLoansLive(true);
      } else if (key === getScopedSettingKey('app_cheques')) {
        await pullChequesLive(true);
      } else if (key === getScopedSettingKey('app_chequebooks')) {
        await pullChequebooksLive(true);
      } else if (key === getScopedSettingKey('app_contracts')) {
        await pullContractsLive(true);
      } else if (key === 'app_workspaces_registry') {
        try {
          const rawVal = payload.new?.setting_value;
          if (rawVal) {
            const list = JSON.parse(rawVal);
            if (Array.isArray(list)) {
              const savedStr = localStorage.getItem('workshop_auth_session');
              if (savedStr) {
                const saved = JSON.parse(savedStr);
                const matchingWs = list.find(w => w.id === saved.workspace_id);
                if (matchingWs) {
                  if (db.workspaces) await db.workspaces.put(matchingWs).catch(() => {});
                  const nextPlan = matchingWs.plan_tier || 'basic';
                  if (saved.plan_tier !== nextPlan) {
                    saved.plan_tier = nextPlan;
                    localStorage.setItem('workshop_auth_session', JSON.stringify(saved));
                    window.dispatchEvent(new CustomEvent('karsync_workspace_plan_updated', {
                      detail: { plan_tier: nextPlan, workspace_id: matchingWs.id }
                    }));
                  }
                }
              }
            }
          }
        } catch (_) {}
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, async (payload) => {
      const updatedWs = payload.new;
      if (updatedWs && updatedWs.id) {
        if (db.workspaces) {
          await db.workspaces.put(updatedWs).catch(() => {});
        }
        try {
          const savedStr = localStorage.getItem('workshop_auth_session');
          if (savedStr) {
            const saved = JSON.parse(savedStr);
            if (saved.workspace_id === updatedWs.id && updatedWs.plan_tier && updatedWs.plan_tier !== saved.plan_tier) {
              saved.plan_tier = updatedWs.plan_tier;
              localStorage.setItem('workshop_auth_session', JSON.stringify(saved));
              window.dispatchEvent(new CustomEvent('karsync_workspace_plan_updated', {
                detail: { plan_tier: updatedWs.plan_tier, workspace_id: updatedWs.id }
              }));
            }
          }
        } catch (_) {}
      }
    })
    .subscribe((status) => {
      console.log('📡 Supabase WebSocket channel status:', status);
    });
  } catch (err) {
    console.warn('Realtime subscription error (offline or network):', err);
  }
}

/**
 * Broadcast an instant sync notification to all active clients (PC & Mobile)
 */
export async function broadcastSyncEvent(type, extra = {}) {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'workshop_sync',
      payload: { type, senderId: CLIENT_ID, timestamp: Date.now(), ...extra }
    });
  } catch (err) {
    console.warn('Could not send realtime broadcast:', err);
  }
}

let isPullingProjects = false;
let lastProjectsPullTime = 0;

/**
 * Pull projects from Supabase settings with safe merge
 */
export async function pullProjectsLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingProjects) return;
  if (!force && now - lastProjectsPullTime < 2500) return;
  isPullingProjects = true;
  lastProjectsPullTime = now;
  try {
    let projectsData = [];
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_projects'))
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        projectsData = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    if (Array.isArray(projectsData) && projectsData.length > 0) {
      const pendingDeleted = new Set(getPendingDeletedProjects());
      const validCloudProjects = projectsData.filter(p => !pendingDeleted.has(p.id));
      const validCloudProjectIds = new Set(validCloudProjects.map(p => p.id));

      await db.transaction('rw', db.projects, async () => {
        for (const p of validCloudProjects) {
          const localP = await db.projects.get(p.id);
          if (localP && localP.updatedAt && (p.updated_at || p.updatedAt)) {
            const localTime = new Date(localP.updatedAt).getTime();
            const cloudTime = new Date(p.updated_at || p.updatedAt).getTime();
            if (localTime > cloudTime) {
              continue;
            }
          }

          await db.projects.put({
            ...(localP || {}),
            ...p,
            id: p.id,
            userId: p.user_id || p.userId || 'default_user',
            name: p.name,
            currency: p.currency || 'IQD',
            standardWorkHours: Number(p.standard_work_hours || p.standardWorkHours) || 8,
            overtimeMultiplier: Number(p.overtime_multiplier || p.overtimeMultiplier) || 1.0,
            status: p.status || 'active',
            notes: p.notes || '',
            createdAt: p.created_at || p.createdAt,
            updatedAt: p.updated_at || p.updatedAt
          });
        }

        // Remove local projects that were deleted in cloud (or legacy default project if active user is not legacy owner)
        const localProjects = await db.projects.toArray();
        const ctx = getActiveWorkspaceContext();
        for (const lp of localProjects) {
          if (!validCloudProjectIds.has(lp.id)) {
            if (lp.id === DEFAULT_PROJECT_ID) {
              if (!ctx.isLegacyOwner) {
                await db.projects.delete(lp.id);
              }
            } else {
              await db.projects.delete(lp.id);
            }
          }
        }
      });
    } else {
      // Cloud has 0 projects for this tenant. Purge any alien projects from Dexie.
      const ctx = getActiveWorkspaceContext();
      if (!ctx.isLegacyOwner && ctx.userId) {
        const localProjects = await db.projects.toArray();
        for (const lp of localProjects) {
          if (!lp.userId || lp.userId !== ctx.userId || lp.id === DEFAULT_PROJECT_ID) {
            await db.projects.delete(lp.id);
          }
        }
      }
    }
  } catch (err) {
    console.warn('pullProjectsLive warning:', err);
  } finally {
    isPullingProjects = false;
  }
}

/**
 * Push an individual project or all projects to Supabase settings with safe cloud merge
 */
export async function pushProjectLive(p) {
  if (!navigator.onLine) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const localProjects = await db.projects.toArray();
    const pendingDeleted = new Set(getPendingDeletedProjects());
    const filteredLocal = localProjects.filter(prj => {
      if (pendingDeleted.has(prj.id)) return false;
      if (!ctx.isLegacyOwner && prj.userId && prj.userId !== ctx.userId) return false;
      return true;
    });

    // Fetch latest cloud projects to merge safely
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_projects'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudProjects = JSON.parse(data.setting_value);
        if (Array.isArray(cloudProjects)) {
          for (const cp of cloudProjects) {
            if (!pendingDeleted.has(cp.id)) {
              mergedMap.set(cp.id, cp);
            }
          }
        }
      } catch (_) {}
    }

    // Merge in local projects (local wins for updated fields)
    for (const lp of filteredLocal) {
      const existing = mergedMap.get(lp.id);
      if (!existing || !existing.updatedAt || !lp.updatedAt || new Date(lp.updatedAt) >= new Date(existing.updatedAt)) {
        mergedMap.set(lp.id, lp);
      }
    }

    // If a single project p was provided, ensure it is in the map
    if (p && !pendingDeleted.has(p.id)) {
      mergedMap.set(p.id, p);
    }

    const mergedList = Array.from(mergedMap.values());

    const { error } = await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_projects'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Live-push project error:', error);
    } else {
      // Reconcile local Dexie
      await db.transaction('rw', db.projects, async () => {
        for (const prj of mergedList) {
          await db.projects.put(prj);
        }
      });
      broadcastSyncEvent('projects');
      window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
    }
  } catch (err) {
    console.warn('Live-push project failed:', err);
  }
}

/**
 * Delete a project live from Supabase
 */
export async function deleteProjectLive(projectId) {
  if (!projectId) return;
  recordPendingProjectDeletion(projectId);
  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_projects'))
      .maybeSingle();

    let projects = [];
    if (data?.setting_value) {
      try {
        projects = JSON.parse(data.setting_value) || [];
      } catch (_) {}
    }

    const filtered = projects.filter(p => p.id !== projectId);
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_projects'),
      setting_value: JSON.stringify(filtered),
      updated_at: new Date().toISOString()
    });

    clearPendingProjectDeletion(projectId);
    broadcastSyncEvent('projects');
    window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
  } catch (err) {
    console.warn('Live-delete project failed:', err);
  }
}

let isPullingSections = false;
let lastSectionsPullTime = 0;

/**
 * Pull project sections from Supabase settings
 */
export async function pullProjectSectionsLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingSections) return;
  if (!force && now - lastSectionsPullTime < 2500) return;
  isPullingSections = true;
  lastSectionsPullTime = now;
  try {
    let sectionsData = [];
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_project_sections'))
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        sectionsData = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    if (Array.isArray(sectionsData)) {
      const pendingDeleted = new Set(getPendingDeletedSections());
      const validCloudSections = sectionsData.filter(s => !pendingDeleted.has(s.id));
      const validCloudSectionIds = new Set(validCloudSections.map(s => s.id));

      await db.transaction('rw', db.projectSections, async () => {
        for (const s of validCloudSections) {
          const localS = await db.projectSections.get(s.id);
          if (localS && localS.updatedAt && (s.updated_at || s.updatedAt)) {
            const localTime = new Date(localS.updatedAt).getTime();
            const cloudTime = new Date(s.updated_at || s.updatedAt).getTime();
            if (localTime > cloudTime) {
              continue;
            }
          }

          await db.projectSections.put({
            ...(localS || {}),
            ...s,
            id: s.id,
            projectId: s.project_id || s.projectId,
            userId: s.user_id || s.userId || 'default_user',
            name: s.name,
            status: s.status || 'active',
            createdAt: s.created_at || s.createdAt,
            updatedAt: s.updated_at || s.updatedAt
          });
        }

        // Reconcile deleted sections
        const localSections = await db.projectSections.toArray();
        for (const ls of localSections) {
          if (!validCloudSectionIds.has(ls.id)) {
            await db.projectSections.delete(ls.id);
          }
        }
      });
    }
  } catch (err) {
    console.warn('pullProjectSectionsLive warning:', err);
  } finally {
    isPullingSections = false;
  }
}

/**
 * Push an individual project section to Supabase with safe merge
 */
export async function pushProjectSectionLive(s) {
  if (!navigator.onLine) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const localSections = await db.projectSections.toArray();
    const pendingDeleted = new Set(getPendingDeletedSections());
    const filteredLocal = localSections.filter(sec => {
      if (pendingDeleted.has(sec.id)) return false;
      if (!ctx.isLegacyOwner && sec.userId && sec.userId !== ctx.userId) return false;
      return true;
    });

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_project_sections'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudSections = JSON.parse(data.setting_value) || [];
        for (const cs of cloudSections) {
          if (!pendingDeleted.has(cs.id)) {
            mergedMap.set(cs.id, cs);
          }
        }
      } catch (_) {}
    }

    for (const ls of filteredLocal) {
      const existing = mergedMap.get(ls.id);
      if (!existing || !existing.updatedAt || !ls.updatedAt || new Date(ls.updatedAt) >= new Date(existing.updatedAt)) {
        mergedMap.set(ls.id, ls);
      }
    }

    if (s && !pendingDeleted.has(s.id)) {
      mergedMap.set(s.id, s);
    }

    const mergedList = Array.from(mergedMap.values());
    const { error } = await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_project_sections'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });

    if (!error) {
      await db.transaction('rw', db.projectSections, async () => {
        for (const sec of mergedList) {
          await db.projectSections.put(sec);
        }
      });
      broadcastSyncEvent('sections');
      window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
    }
  } catch (err) {
    console.warn('Live-push section failed:', err);
  }
}

/**
 * Delete a project section from Supabase
 */
export async function deleteProjectSectionLive(sectionId) {
  if (!sectionId) return;
  recordPendingSectionDeletion(sectionId);
  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_project_sections'))
      .maybeSingle();

    let sections = [];
    if (data?.setting_value) {
      try {
        sections = JSON.parse(data.setting_value) || [];
      } catch (_) {}
    }

    const filtered = sections.filter(sec => sec.id !== sectionId);
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_project_sections'),
      setting_value: JSON.stringify(filtered),
      updated_at: new Date().toISOString()
    });

    clearPendingSectionDeletion(sectionId);
    broadcastSyncEvent('sections');
    window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
  } catch (err) {
    console.warn('Live-delete section failed:', err);
  }
}

let isPullingWorkerProjects = false;
let lastWorkerProjectsPullTime = 0;

/**
 * Pull worker-to-project mappings from Supabase settings with safe merge
 */
export async function pullWorkerProjectsLive(force = false) {
  if (!navigator.onLine) return getWorkerProjectMap();
  const now = Date.now();
  if (isPullingWorkerProjects) return getWorkerProjectMap();
  if (!force && now - lastWorkerProjectsPullTime < 2500) return getWorkerProjectMap();
  isPullingWorkerProjects = true;
  lastWorkerProjectsPullTime = now;

  try {
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_worker_projects'))
      .maybeSingle();

    let cloudMap = {};
    if (!sErr && sData?.setting_value) {
      try {
        cloudMap = JSON.parse(sData.setting_value) || {};
      } catch (_) {}
    }

    const localMap = getWorkerProjectMap();
    // Merge: cloudMap base + localMap
    const mergedMap = { ...cloudMap, ...localMap };
    saveWorkerProjectMap(mergedMap);

    // Reconcile Dexie workers
    const allWorkers = await db.workers.toArray();
    for (const w of allWorkers) {
      const mappedPrj = mergedMap[w.id];
      if (mappedPrj && w.projectId !== mappedPrj) {
        await db.workers.update(w.id, { projectId: mappedPrj });
      } else if (!mappedPrj && w.projectId) {
        mergedMap[w.id] = w.projectId;
      }
    }
    saveWorkerProjectMap(mergedMap);

    return mergedMap;
  } catch (err) {
    console.warn('pullWorkerProjectsLive warning:', err);
    return getWorkerProjectMap();
  } finally {
    isPullingWorkerProjects = false;
  }
}

/**
 * Update a worker's project mapping in Supabase settings
 */
export async function pushWorkerProjectMapLive(workerId, projectId) {
  if (!workerId || !projectId) return;
  try {
    const localMap = getWorkerProjectMap();
    localMap[workerId] = projectId;
    saveWorkerProjectMap(localMap);

    if (!navigator.onLine) return;

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_worker_projects'))
      .maybeSingle();

    let cloudMap = {};
    if (data?.setting_value) {
      try {
        cloudMap = JSON.parse(data.setting_value) || {};
      } catch (_) {}
    }

    cloudMap[workerId] = projectId;

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_worker_projects'),
      setting_value: JSON.stringify(cloudMap),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('pushWorkerProjectMapLive warning:', err);
  }
}

/**
 * Remove a worker's project mapping in Supabase settings
 */
export async function removeWorkerProjectMapLive(workerId) {
  if (!workerId) return;
  try {
    const localMap = getWorkerProjectMap();
    delete localMap[workerId];
    saveWorkerProjectMap(localMap);

    if (!navigator.onLine) return;

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_worker_projects'))
      .maybeSingle();

    let cloudMap = {};
    if (data?.setting_value) {
      try {
        cloudMap = JSON.parse(data.setting_value) || {};
      } catch (_) {}
    }

    delete cloudMap[workerId];

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_worker_projects'),
      setting_value: JSON.stringify(cloudMap),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('removeWorkerProjectMapLive warning:', err);
  }
}

/**
 * Sync all worker project mappings to cloud
 */
export async function syncAllWorkerProjectsToCloud() {
  if (!navigator.onLine) return;
  try {
    const allWorkers = await db.workers.toArray();
    const map = getWorkerProjectMap();
    for (const w of allWorkers) {
      if (w.projectId) {
        map[w.id] = w.projectId;
      }
    }
    saveWorkerProjectMap(map);

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_worker_projects'))
      .maybeSingle();

    let cloudMap = {};
    if (data?.setting_value) {
      try {
        cloudMap = JSON.parse(data.setting_value) || {};
      } catch (_) {}
    }

    const merged = { ...cloudMap, ...map };

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_worker_projects'),
      setting_value: JSON.stringify(merged),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('syncAllWorkerProjectsToCloud warning:', err);
  }
}

// ========================================================
// GROUPS SYNC (Stored in Supabase settings: app_groups)
// ========================================================
let isPullingGroups = false;
let lastGroupsPullTime = 0;

export async function pullGroupsLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingGroups) return;
  if (!force && now - lastGroupsPullTime < 2500) return;
  isPullingGroups = true;
  lastGroupsPullTime = now;

  try {
    const pendingDeleted = new Set(getPendingDeletedGroups());
    let cloudGroups = [];
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_groups'))
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        cloudGroups = JSON.parse(sData.setting_value) || [];
      } catch (_) {}
    }

    const localGroups = await db.groups.toArray();
    const cloudMap = new Map();

    if (Array.isArray(cloudGroups)) {
      for (const cg of cloudGroups) {
        if (!cg || !cg.id) continue;
        if (cg.deletedAt || cg.status === 'deleted' || pendingDeleted.has(cg.id)) {
          // Group is deleted remotely or pending deletion: ensure it is wiped locally
          await db.groups.delete(cg.id).catch(() => {});
        } else {
          cloudMap.set(cg.id, cg);
        }
      }
    }

    // 1. Process local deletions / ghost groups
    for (const lg of localGroups) {
      if (pendingDeleted.has(lg.id) || lg.deletedAt || lg.status === 'deleted') {
        await db.groups.delete(lg.id).catch(() => {});
      } else if (!cloudMap.has(lg.id)) {
        const isCloudDeleted = Array.isArray(cloudGroups) && cloudGroups.some(cg => cg && cg.id === lg.id && (cg.deletedAt || cg.status === 'deleted'));
        const isRecent = lg.createdAt && (Date.now() - new Date(lg.createdAt).getTime() < 60000);
        if (isCloudDeleted) {
          // Marked as deleted in cloud tombstones: wipe locally!
          await db.groups.delete(lg.id).catch(() => {});
        } else if (!isRecent && cloudGroups.length > 0) {
          // Deleted remotely on another device: remove from local Dexie!
          await db.groups.delete(lg.id).catch(() => {});
        } else if (!isRecent && !ctx.isLegacyOwner) {
          // Alien group from another tenant: wipe locally!
          await db.groups.delete(lg.id).catch(() => {});
        } else if (isRecent) {
          // Newly created locally: push to cloud
          cloudMap.set(lg.id, lg);
        }
      }
    }

    // 2. Put / update active cloud groups into Dexie
    for (const cg of cloudMap.values()) {
      if (cg.deletedAt || cg.status === 'deleted') {
        await db.groups.delete(cg.id).catch(() => {});
      } else {
        await db.groups.put(cg);
      }
    }

    window.dispatchEvent(new CustomEvent('workshop-groups-sync'));
  } catch (err) {
    console.warn('pullGroupsLive warning:', err);
  } finally {
    isPullingGroups = false;
  }
}

export async function pushGroupLive(group) {
  if (!group || !group.id) return;
  try {
    await db.groups.put(group);
    window.dispatchEvent(new CustomEvent('workshop-groups-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_groups'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudGroups = JSON.parse(data.setting_value);
        if (Array.isArray(cloudGroups)) {
          for (const cg of cloudGroups) {
            if (cg && cg.id) mergedMap.set(cg.id, cg);
          }
        }
      } catch (_) {}
    }

    const pendingDeleted = new Set(getPendingDeletedGroups());
    if (pendingDeleted.has(group.id) || group.deletedAt || group.status === 'deleted') {
      mergedMap.set(group.id, {
        ...group,
        deletedAt: group.deletedAt || new Date().toISOString(),
        status: 'deleted',
        updatedAt: new Date().toISOString()
      });
    } else {
      const existingCloud = mergedMap.get(group.id);
      if (existingCloud?.deletedAt || existingCloud?.status === 'deleted') {
        return; // Do not revive a deleted group
      }
      mergedMap.set(group.id, {
        ...group,
        updatedAt: new Date().toISOString()
      });
    }

    const mergedList = Array.from(mergedMap.values());

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_groups'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });
    broadcastSyncEvent('groups');
  } catch (err) {
    console.warn('pushGroupLive warning:', err);
  }
}

export async function deleteGroupLive(groupId) {
  if (!groupId) return;
  recordPendingGroupDeletion(groupId);
  try {
    await db.groups.delete(groupId);
    window.dispatchEvent(new CustomEvent('workshop-groups-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_groups'))
      .maybeSingle();

    let list = [];
    if (data?.setting_value) {
      try {
        list = JSON.parse(data.setting_value) || [];
      } catch (_) {}
    }

    const now = new Date().toISOString();
    let found = false;
    const updatedList = list.map(g => {
      if (g.id === groupId) {
        found = true;
        return {
          ...g,
          deletedAt: now,
          status: 'deleted',
          updatedAt: now
        };
      }
      return g;
    });
    if (!found) {
      updatedList.push({
        id: groupId,
        deletedAt: now,
        status: 'deleted',
        updatedAt: now
      });
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_groups'),
      setting_value: JSON.stringify(updatedList),
      updated_at: now
    });
    broadcastSyncEvent('groups');
  } catch (err) {
    console.warn('deleteGroupLive warning:', err);
  }
}

export async function archiveGroupLive(groupId, isArchived = true) {
  if (!groupId) return;
  try {
    const existing = await db.groups.get(groupId);
    if (existing) {
      const updated = {
        ...existing,
        isArchived: Boolean(isArchived),
        status: isArchived ? 'archived' : 'active',
        updatedAt: new Date().toISOString()
      };
      await db.groups.put(updated);
      await pushGroupLive(updated);
    }
  } catch (err) {
    console.warn('archiveGroupLive warning:', err);
  }
}

export async function pushAllGroupsToCloud() {
  if (!navigator.onLine) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const localGroups = await db.groups.toArray();
    if (localGroups.length === 0) return;
    const pendingDeleted = new Set(getPendingDeletedGroups());

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_groups'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudGroups = JSON.parse(data.setting_value);
        if (Array.isArray(cloudGroups)) {
          for (const cg of cloudGroups) {
            if (cg && cg.id) mergedMap.set(cg.id, cg);
          }
        }
      } catch (_) {}
    }

    for (const lg of localGroups) {
      if (pendingDeleted.has(lg.id) || lg.deletedAt || lg.status === 'deleted') {
        continue;
      }
      const existingCloud = mergedMap.get(lg.id);
      if (existingCloud?.deletedAt || existingCloud?.status === 'deleted') {
        // Cloud already marked this group as deleted; wipe from Dexie and don't revive
        await db.groups.delete(lg.id).catch(() => {});
        continue;
      }
      mergedMap.set(lg.id, lg);
    }
    const mergedList = Array.from(mergedMap.values());

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_groups'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('pushAllGroupsToCloud warning:', err);
  }
}

// ========================================================
// WORKER METADATA SYNC (Stored in Supabase settings: app_worker_metadata)
// ========================================================
let isPullingWorkerMetadata = false;
let lastWorkerMetadataPullTime = 0;

export async function pullWorkerMetadataLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingWorkerMetadata) return;
  if (!force && now - lastWorkerMetadataPullTime < 2500) return;
  isPullingWorkerMetadata = true;
  lastWorkerMetadataPullTime = now;

  try {
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_worker_metadata'))
      .maybeSingle();

    let cloudMetadata = {};
    if (!sErr && sData?.setting_value) {
      try {
        cloudMetadata = JSON.parse(sData.setting_value) || {};
      } catch (_) {}
    }

    const localWorkers = await db.workers.toArray();
    let hasLocalChanges = false;
    const credsMap = {};

    await db.transaction('rw', db.workers, async () => {
      for (const w of localWorkers) {
        const meta = cloudMetadata[w.id];
        if (meta) {
          const localTime = w.updatedAt ? new Date(w.updatedAt).getTime() : 0;
          const cloudTime = meta.updatedAt ? new Date(meta.updatedAt).getTime() : 0;

          // If local worker was updated more recently on this client, do NOT revert it!
          // Instead, preserve local Dexie and queue update to cloud
          if (localTime > cloudTime + 1000) {
            cloudMetadata[w.id] = {
              ...meta,
              groupId: w.groupId || null,
              teamRole: w.teamRole || 'Worker',
              wageType: w.wageType || 'standard',
              monthlySalary: Number(w.monthlySalary) || 0,
              monthlyLeaveDays: Number(w.monthlyLeaveDays) || 0,
              leavePolicy: w.leavePolicy || 'accumulate',
              bonusLeaveDays: Number(w.bonusLeaveDays) || 0,
              fridayRateMultiplier: Number(w.fridayRateMultiplier) || 2.0,
              defaultSectionId: w.defaultSectionId || null,
              isGlobal: Boolean(w.isGlobal),
              projectRates: w.projectRates || {},
              isArchived: !!(w.isArchived || w.status === 'archived'),
              status: w.status || (w.isArchived ? 'archived' : 'active'),
              username: w.username || meta.username || '',
              password: w.password || meta.password || '',
              updatedAt: w.updatedAt || new Date().toISOString()
            };
            hasLocalChanges = true;
            continue;
          }

          let needsUpdate = false;
          const updates = {};

          if (meta.groupId !== undefined && w.groupId !== meta.groupId) {
            updates.groupId = meta.groupId;
            needsUpdate = true;
          }
          if (meta.teamRole && w.teamRole !== meta.teamRole) {
            updates.teamRole = meta.teamRole;
            needsUpdate = true;
          }
          if (meta.wageType && w.wageType !== meta.wageType) {
            updates.wageType = meta.wageType;
            needsUpdate = true;
          }
          if (meta.monthlySalary !== undefined && w.monthlySalary !== meta.monthlySalary) {
            // Local-First: Never wipe local positive monthly salary with 0 or empty from cloud unless cloud explicitly has a newer timestamp
            if (!(Number(w.monthlySalary) > 0 && Number(meta.monthlySalary) === 0 && localTime >= cloudTime)) {
              updates.monthlySalary = meta.monthlySalary;
              needsUpdate = true;
            }
          }
          if (meta.monthlyLeaveDays !== undefined && w.monthlyLeaveDays !== meta.monthlyLeaveDays) {
            updates.monthlyLeaveDays = meta.monthlyLeaveDays;
            needsUpdate = true;
          }
          if (meta.leavePolicy !== undefined && w.leavePolicy !== meta.leavePolicy) {
            updates.leavePolicy = meta.leavePolicy;
            needsUpdate = true;
          }
          if (meta.bonusLeaveDays !== undefined && w.bonusLeaveDays !== meta.bonusLeaveDays) {
            updates.bonusLeaveDays = meta.bonusLeaveDays;
            needsUpdate = true;
          }
          if (meta.fridayRateMultiplier !== undefined && w.fridayRateMultiplier !== meta.fridayRateMultiplier) {
            updates.fridayRateMultiplier = meta.fridayRateMultiplier;
            needsUpdate = true;
          }
          if (meta.defaultSectionId !== undefined && w.defaultSectionId !== meta.defaultSectionId) {
            updates.defaultSectionId = meta.defaultSectionId;
            needsUpdate = true;
          }
          if (meta.isArchived !== undefined && w.isArchived !== meta.isArchived) {
            updates.isArchived = meta.isArchived;
            needsUpdate = true;
          }
          if (meta.isGlobal !== undefined && Boolean(w.isGlobal) !== Boolean(meta.isGlobal)) {
            updates.isGlobal = Boolean(meta.isGlobal);
            needsUpdate = true;
          }
          if (meta.projectRates && JSON.stringify(w.projectRates || {}) !== JSON.stringify(meta.projectRates)) {
            updates.projectRates = meta.projectRates;
            needsUpdate = true;
          }
          if (meta.status && w.status !== meta.status) {
            updates.status = meta.status;
            needsUpdate = true;
          }
          if (meta.username && w.username !== meta.username) {
            updates.username = meta.username;
            needsUpdate = true;
          }
          if (meta.password && w.password !== meta.password) {
            updates.password = meta.password;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await db.workers.update(w.id, updates);
          }

          if (meta.username || meta.password) {
            credsMap[w.id] = {
              username: meta.username || w.username || '',
              password: meta.password || w.password || ''
            };
          }
        } else if (w.groupId || w.teamRole !== 'Worker' || w.defaultSectionId || w.username || w.password || w.isArchived || w.monthlySalary) {
          cloudMetadata[w.id] = {
            groupId: w.groupId || null,
            teamRole: w.teamRole || 'Worker',
            wageType: w.wageType || 'standard',
            monthlySalary: Number(w.monthlySalary) || 0,
            monthlyLeaveDays: Number(w.monthlyLeaveDays) || 0,
            leavePolicy: w.leavePolicy || 'accumulate',
            bonusLeaveDays: Number(w.bonusLeaveDays) || 0,
            fridayRateMultiplier: Number(w.fridayRateMultiplier) || 2.0,
            defaultSectionId: w.defaultSectionId || null,
            isGlobal: Boolean(w.isGlobal),
            projectRates: w.projectRates || {},
            isArchived: !!(w.isArchived || w.status === 'archived'),
            status: w.status || (w.isArchived ? 'archived' : 'active'),
            username: w.username || '',
            password: w.password || '',
            updatedAt: w.updatedAt || new Date().toISOString()
          };
          hasLocalChanges = true;
        }

        if (w.username || w.password) {
          credsMap[w.id] = {
            username: w.username || '',
            password: w.password || ''
          };
        }
      }
    });

    if (Object.keys(credsMap).length > 0) {
      try {
        const existingCreds = JSON.parse(localStorage.getItem('workshop_worker_credentials') || '{}');
        localStorage.setItem('workshop_worker_credentials', JSON.stringify({ ...existingCreds, ...credsMap }));
      } catch (_) {}
    }

    const ctx = getActiveWorkspaceContext();
    if (hasLocalChanges && (ctx.isLegacyOwner || ctx.userId)) {
      await supabase.from('settings').upsert({
        setting_key: getScopedSettingKey('app_worker_metadata'),
        setting_value: JSON.stringify(cloudMetadata),
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('pullWorkerMetadataLive warning:', err);
  } finally {
    isPullingWorkerMetadata = false;
  }
}

export async function pushWorkerMetadataLive(workerId, metadata) {
  if (!workerId || !metadata) return;
  if (!navigator.onLine) return;

  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_worker_metadata'))
      .maybeSingle();

    let cloudMetadata = {};
    if (data?.setting_value) {
      try {
        cloudMetadata = JSON.parse(data.setting_value) || {};
      } catch (_) {}
    }

    const now = new Date().toISOString();
    cloudMetadata[workerId] = {
      ...(cloudMetadata[workerId] || {}),
      ...metadata,
      updatedAt: metadata.updatedAt || now
    };

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_worker_metadata'),
      setting_value: JSON.stringify(cloudMetadata),
      updated_at: now
    });
  } catch (err) {
    console.warn('pushWorkerMetadataLive warning:', err);
  }
}

export async function syncAllWorkerMetadataToCloud() {
  if (!navigator.onLine) return;
  try {
    const ctx = getActiveWorkspaceContext();
    const localWorkers = await db.workers.toArray();
    if (localWorkers.length === 0) return;

    const targetWorkers = ctx.isLegacyOwner 
      ? localWorkers 
      : localWorkers.filter(w => !w.userId || w.userId === ctx.userId);
    if (targetWorkers.length === 0) return;

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_worker_metadata'))
      .maybeSingle();

    let cloudMetadata = {};
    if (data?.setting_value) {
      try {
        cloudMetadata = JSON.parse(data.setting_value) || {};
      } catch (_) {}
    }

    for (const w of targetWorkers) {
      const existingMeta = cloudMetadata[w.id] || {};
      const localTime = w.updatedAt ? new Date(w.updatedAt).getTime() : 0;
      const cloudTime = existingMeta.updatedAt ? new Date(existingMeta.updatedAt).getTime() : 0;

      // Only update cloud if local worker is newer or equal, or if cloud has no timestamp
      if (localTime >= cloudTime || !existingMeta.updatedAt) {
        cloudMetadata[w.id] = {
          ...existingMeta,
          groupId: w.groupId || null,
          teamRole: w.teamRole || 'Worker',
          wageType: w.wageType || 'standard',
          monthlySalary: Number(w.monthlySalary) || 0,
          monthlyLeaveDays: Number(w.monthlyLeaveDays) || 0,
          leavePolicy: w.leavePolicy || 'accumulate',
          bonusLeaveDays: Number(w.bonusLeaveDays) || 0,
          fridayRateMultiplier: Number(w.fridayRateMultiplier) || 2.0,
          defaultSectionId: w.defaultSectionId || null,
          isGlobal: Boolean(w.isGlobal),
          projectRates: w.projectRates || {},
          isArchived: !!(w.isArchived || w.status === 'archived'),
          status: w.status || (w.isArchived ? 'archived' : 'active'),
          username: w.username || existingMeta.username || '',
          password: w.password || existingMeta.password || '',
          updatedAt: w.updatedAt || new Date().toISOString()
        };
      }
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_worker_metadata'),
      setting_value: JSON.stringify(cloudMetadata),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('syncAllWorkerMetadataToCloud warning:', err);
  }
}

let isPullingRemote = false;
let lastRemotePullTime = 0;

/**
 * Background silent pull
 */
export async function pullRemoteChangesSilently(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingRemote) return;
  if (!force && now - lastRemotePullTime < 3000) return;
  isPullingRemote = true;
  lastRemotePullTime = now;
  try {
    await pullWorkerProjectsLive();
    await pullGroupsLive();
    await pullWorkerMetadataLive();
    const ctx = getActiveWorkspaceContext();
    const [wRes, lRes] = await Promise.all([
      getScopedWorkersQuery(),
      getScopedAttendanceLogsQuery()
    ]);

    if (!wRes.error && !lRes.error && (wRes.data || lRes.data)) {
      await reconcileCloudIntoLocal(wRes.data || [], lRes.data || []);

      // Auto-detect and push any local workers that are missing in cloud ONLY for legacy owner
      if (ctx.isLegacyOwner) {
        const cloudWorkerIds = new Set((wRes.data || []).map(w => w.id));
        const localWorkers = await db.workers.toArray();
        const missingWorkers = localWorkers.filter(w => !cloudWorkerIds.has(w.id) && !w.deletedAt);
        if (missingWorkers.length > 0) {
          for (const mw of missingWorkers) {
            await pushWorkerLive(mw);
          }
        }
      }
    }
    await pullPaymentsLive();
    await pullProjectsLive();
    await pullProjectSectionsLive();
    await pullExpensesLive();
    await pullFinancialAccountsLive();
    await pullTreasuryIncomesLive();
    await pullAccountTransfersLive();
    await pullGlobalOverdraftPolicyLive();
  } catch (err) {
    console.warn('pullRemoteChangesSilently warning:', err);
  } finally {
    isPullingRemote = false;
  }
}

/**
 * Push all projects and project sections from local database to Supabase settings
 */
export async function pushAllProjectsAndSectionsLive() {
  if (!navigator.onLine) return;
  try {
    await pushProjectLive();
    await pushProjectSectionLive();
  } catch (err) {
    console.warn('pushAllProjectsAndSectionsLive warning:', err);
  }
}

/**
 * Push an individual or batch of logs immediately to Supabase
 */
export async function pushLogsLive(logs) {
  if (!logs || logs.length === 0) return;
  
  // Proactively clear any pending deletion locks for these logs
  logs.forEach(l => {
    const canonicalId = getAttendanceLogId(l.workerId, l.date);
    clearPendingLogDeletion(canonicalId);
    if (l.id) clearPendingLogDeletion(l.id);
  });

  if (!navigator.onLine) return;

  const ctx = getActiveWorkspaceContext();
  const effectiveUserId = ctx.userId || (ctx.isLegacyOwner ? '867f5819-e911-45f2-9d4f-d4a7f955ef5f' : null);

  const eligibleLogs = ctx.isLegacyOwner 
    ? logs 
    : logs.filter(l => !l.userId || l.userId === ctx.userId);
  if (eligibleLogs.length === 0) return;

  const payload = eligibleLogs.map(l => {
    let cleanNotes = (l.notes || '').trim();
    // Cleanly strip any old META block first
    let actualUserNotes = cleanNotes.replace(/__META__[\s\S]*?__META__\n?/, '').trim();
    const meta = {};
    if (l.sectionId) meta.s = l.sectionId;
    if (l.projectId && l.projectId !== DEFAULT_PROJECT_ID) meta.p = l.projectId;
    if (l.isSettled) meta.st = 1;
    if (l.settlementReceiptId) meta.rid = l.settlementReceiptId;

    let finalNotes = actualUserNotes;
    if (Object.keys(meta).length > 0) {
      const metaStr = `__META__${JSON.stringify(meta)}__META__`;
      finalNotes = metaStr + (actualUserNotes ? '\n' + actualUserNotes : '');
    }

    return {
      id: getAttendanceLogId(l.workerId, l.date),
      user_id: l.userId || effectiveUserId,
      worker_id: l.workerId,
      date: l.date,
      type: l.type || 'full',
      overtime_hours: Number(l.overtimeHours) || 0,
      calculated_daily_wage: roundCurrency(l.calculatedDailyWage, l.currency),
      calculated_overtime_wage: roundCurrency(l.calculatedOvertimeWage, l.currency),
      total_day_pay: roundCurrency(l.totalDayPay, l.currency),
      notes: finalNotes || null,
      deleted_at: null,
      updated_at: new Date().toISOString()
    };
  });

  try {
    const { error } = await supabase.from('attendance_logs').upsert(payload);
    if (error) console.error('Error live-pushing logs to Supabase:', error);
  } catch (err) {
    console.error('Live-push logs failed:', err);
  }
}

/**
 * Push an individual worker immediately to Supabase
 */
export async function pushWorkerLive(w) {
  if (!w) return;
  clearPendingWorkerDeletion(w.id);

  const ctx = getActiveWorkspaceContext();
  if (!ctx.isLegacyOwner && (LEAKED_CROSS_TENANT_WORKER_IDS.has(w.id) || (ctx.userId && w.userId && w.userId !== ctx.userId))) {
    console.warn(`[Sync] Blocked pushWorkerLive: worker ${w.id} is foreign or blacklisted for tenant ${ctx.userId}`);
    return;
  }

  if (w.projectId) {
    pushWorkerProjectMapLive(w.id, w.projectId).catch(console.warn);
  }

  // Sync worker metadata (await to ensure cloud metadata is updated before broadcasting)
  const now = w.updatedAt || new Date().toISOString();
  await pushWorkerMetadataLive(w.id, {
    groupId: w.groupId || null,
    teamRole: w.teamRole || 'Worker',
    wageType: w.wageType || 'standard',
    monthlySalary: Number(w.monthlySalary) || 0,
    monthlyLeaveDays: Number(w.monthlyLeaveDays) || 0,
    leavePolicy: w.leavePolicy || 'accumulate',
    bonusLeaveDays: Number(w.bonusLeaveDays) || 0,
    fridayRateMultiplier: Number(w.fridayRateMultiplier) || 2.0,
    defaultSectionId: w.defaultSectionId || null,
    isArchived: !!(w.isArchived || w.status === 'archived'),
    status: w.status || (w.isArchived ? 'archived' : 'active'),
    username: w.username || '',
    password: w.password || '',
    updatedAt: now
  });

  if (w.username || w.password) {
    try {
      const credsMap = JSON.parse(localStorage.getItem('workshop_worker_credentials') || '{}');
      credsMap[w.id] = { username: w.username || '', password: w.password || '' };
      localStorage.setItem('workshop_worker_credentials', JSON.stringify(credsMap));
    } catch (_) {}
  }

  if (!navigator.onLine) return;

  const effectiveUserId = ctx.userId || (ctx.isLegacyOwner ? '867f5819-e911-45f2-9d4f-d4a7f955ef5f' : null);

  const payload = {
    id: w.id,
    user_id: w.userId || effectiveUserId,
    name: w.name,
    phone: w.phone || null,
    role: w.role || 'کارگر',
    daily_rate: Number(w.dailyRate) || 0,
    overtime_hourly_rate: Number(w.overtimeHourlyRate) || 0,
    is_active: Number(w.isActive) === 0 ? 0 : 1,
    deleted_at: w.deletedAt || null,
    updated_at: now
  };

  try {
    const { error } = await supabase.from('workers').upsert(payload);
    if (error) {
      console.error('Error live-pushing worker to Supabase:', error);
    } else {
      broadcastSyncEvent('workers');
    }
  } catch (err) {
    console.error('Live-push worker failed:', err);
  }
}

/**
 * Push a batch of workers immediately to Supabase
 */
export async function pushWorkersLive(workers) {
  if (!workers || workers.length === 0) return;
  workers.forEach(w => clearPendingWorkerDeletion(w.id));

  const map = getWorkerProjectMap();
  let changed = false;
  for (const w of workers) {
    if (w.projectId && map[w.id] !== w.projectId) {
      map[w.id] = w.projectId;
      changed = true;
    }
  }
  if (changed) {
    saveWorkerProjectMap(map);
    syncAllWorkerProjectsToCloud().catch(console.warn);
  }

  syncAllWorkerMetadataToCloud().catch(console.warn);

  if (!navigator.onLine) return;

  const ctx = getActiveWorkspaceContext();
  const effectiveUserId = ctx.userId || (ctx.isLegacyOwner ? '867f5819-e911-45f2-9d4f-d4a7f955ef5f' : null);

  const eligibleWorkers = ctx.isLegacyOwner
    ? workers
    : workers.filter(w => !LEAKED_CROSS_TENANT_WORKER_IDS.has(w.id) && (!w.userId || w.userId === ctx.userId));
  if (eligibleWorkers.length === 0) return;

  const payload = eligibleWorkers.map(w => ({
    id: w.id,
    user_id: w.userId || effectiveUserId,
    name: w.name,
    phone: w.phone || null,
    role: w.role || 'کارگر',
    daily_rate: Number(w.dailyRate) || 0,
    overtime_hourly_rate: Number(w.overtimeHourlyRate) || 0,
    is_active: Number(w.isActive) === 0 ? 0 : 1,
    deleted_at: w.deletedAt || null,
    updated_at: new Date().toISOString()
  }));

  try {
    const { error } = await supabase.from('workers').upsert(payload);
    if (error) {
      console.error('Error live-pushing workers to Supabase:', error);
    } else {
      broadcastSyncEvent('workers');
    }
  } catch (err) {
    console.error('Live-push workers failed:', err);
  }
}

/**
 * Delete a log live from Supabase
 */
export async function deleteLogLive(logId) {
  if (!logId) return;
  // Safety guard: Never delete settled logs
  try {
    const local = await db.attendanceLogs.get(logId);
    if (local && (local.isSettled || local.settlementReceiptId)) {
      console.warn(`[SAFETY] Refusing live delete for settled attendance log: ${logId}`);
      return;
    }
    if (!local && navigator.onLine) {
      const { data: cloudRec } = await supabase.from('attendance_logs').select('is_settled, settlement_receipt_id, notes').eq('id', logId).maybeSingle();
      if (cloudRec && (cloudRec.is_settled || cloudRec.settlement_receipt_id || (cloudRec.notes && cloudRec.notes.includes('"st":1')))) {
        console.warn(`[SAFETY] Refusing cloud delete for settled log: ${logId}`);
        clearPendingLogDeletion(logId);
        return;
      }
    }
  } catch (_) {}

  recordPendingLogDeletion(logId);
  if (!navigator.onLine) return;
  try {
    const now = new Date().toISOString();
    await supabase.from('attendance_logs').update({ deleted_at: now, updated_at: now }).eq('id', logId);
    clearPendingLogDeletion(logId);
  } catch (err) {
    console.error('Live-delete log failed:', err);
  }
}

/**
 * Delete a worker live from Supabase
 */
export async function deleteWorkerLive(workerId) {
  if (!workerId) return;
  recordPendingWorkerDeletion(workerId);
  removeWorkerProjectMapLive(workerId).catch(console.warn);
  if (!navigator.onLine) return;
  try {
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from('workers').update({ deleted_at: now, updated_at: now }).eq('id', workerId),
      supabase.from('attendance_logs').update({ deleted_at: now, updated_at: now }).eq('worker_id', workerId)
    ]);
    clearPendingWorkerDeletion(workerId);
    broadcastSyncEvent('workers');
  } catch (err) {
    console.error('Live-delete worker failed:', err);
  }
}

/**
 * Push all local payments to Supabase settings with safe cloud merge and deletion reconciliation
 */
export async function pushPaymentsLive() {
  if (!navigator.onLine) return;
  try {
    const ctx = getActiveWorkspaceContext();
    const localPayments = await db.payments.toArray();
    const pendingDeleted = new Set(getPendingDeletedPayments());
    const filteredLocal = localPayments.filter(p => {
      if (pendingDeleted.has(p.id)) return false;
      if (!ctx.isLegacyOwner && ctx.userId && p.userId && p.userId !== ctx.userId) return false;
      return true;
    });

    // Fetch latest cloud payments to safely merge
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_payments'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data && data.setting_value) {
      try {
        const cloudPayments = JSON.parse(data.setting_value);
        if (Array.isArray(cloudPayments)) {
          for (const cp of cloudPayments) {
            if (!pendingDeleted.has(cp.id)) {
              mergedMap.set(cp.id, cp);
            }
          }
        }
      } catch (_) {}
    }

    // Merge in current local payments (local updates win for modified payments)
    for (const lp of filteredLocal) {
      mergedMap.set(lp.id, lp);
    }

    const mergedList = Array.from(mergedMap.values()).map(p => ({
      ...p,
      amount: roundCurrency(p.amount, p.currency)
    }));

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_payments'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });

    // Reconcile local Dexie database
    await db.transaction('rw', db.payments, async () => {
      for (const p of mergedList) {
        await db.payments.put(p);
      }
      for (const id of pendingDeleted) {
        await db.payments.delete(id);
      }
    });

    // Clear flushed pending payment deletions
    for (const id of pendingDeleted) {
      clearPendingPaymentDeletion(id);
    }

    window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
  } catch (err) {
    console.warn('Could not push payments to Supabase:', err);
  }
}

let isPullingPayments = false;
let lastPaymentsPullTime = 0;

/**
 * Pull cloud payments from Supabase settings and update local Dexie
 */
export async function pullPaymentsLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingPayments) return;
  if (!force && now - lastPaymentsPullTime < 2500) return;
  isPullingPayments = true;
  lastPaymentsPullTime = now;
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_payments'))
      .maybeSingle();

    if (!error && data && data.setting_value) {
      let cloudPayments = [];
      try {
        cloudPayments = JSON.parse(data.setting_value);
      } catch (parseErr) {
        console.warn('Error parsing cloud payments:', parseErr);
      }

      if (Array.isArray(cloudPayments)) {
        const pendingDeleted = new Set(getPendingDeletedPayments());
        const validCloudPayments = cloudPayments.filter(p => !pendingDeleted.has(p.id) && !p.deletedAt && p.status !== 'deleted');
        const validCloudIds = new Set(validCloudPayments.map(p => p.id));

        // Collect IDs to rollback BEFORE entering the transaction.
        // rollbackPaymentSettlement accesses attendanceLogs (not in this tx scope)
        // and performs async network calls — both are illegal inside a Dexie transaction.
        const idsToRollbackAndDelete = [];
        if (validCloudPayments.length > 0) {
          const localPaymentsSnapshot = await db.payments.toArray();
          for (const lp of localPaymentsSnapshot) {
            if (pendingDeleted.has(lp.id) || !validCloudIds.has(lp.id)) {
              idsToRollbackAndDelete.push(lp.id);
            }
          }
        }

        await withImmutabilityBypass(async () => {
          await db.transaction('rw', db.payments, async () => {
            for (const p of validCloudPayments) {
              const localP = await db.payments.get(p.id);
              if (localP && localP.updatedAt && (p.updatedAt || p.updated_at)) {
                const localTime = new Date(localP.updatedAt).getTime();
                const cloudTime = new Date(p.updatedAt || p.updated_at).getTime();
                if (localTime > cloudTime) {
                  continue;
                }
              }
              await db.payments.put({
                ...(localP || {}),
                ...p,
                projectId: p.projectId || p.project_id || DEFAULT_PROJECT_ID,
                userId: p.userId || p.user_id || 'default_user',
                amount: roundCurrency(p.amount, p.currency)
              });
            }
            // Delete stale local payments inside the transaction (safe — only payments store)
            for (const id of idsToRollbackAndDelete) {
              await db.payments.delete(id);
            }
          });
        });

        // Run settlement rollbacks AFTER the transaction commits — this accesses
        // attendanceLogs + performs network I/O, which are forbidden inside a tx.
        for (const id of idsToRollbackAndDelete) {
          await rollbackPaymentSettlement(id).catch(console.warn);
        }
      }
    } else {
      const ctx = getActiveWorkspaceContext();
      if (!ctx.isLegacyOwner && ctx.userId) {
        const localPaymentsSnapshot = await db.payments.toArray();
        const toDelete = localPaymentsSnapshot.filter(lp => !lp.userId || lp.userId !== ctx.userId);
        if (toDelete.length > 0) {
          await withImmutabilityBypass(async () => {
            for (const lp of toDelete) {
              await db.payments.delete(lp.id).catch(() => {});
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn('Could not pull payments from Supabase:', err);
  } finally {
    isPullingPayments = false;
  }
}

/**
 * Rollback all attendance logs and advances tied to a settlement receipt.
 * Restores them to unsettled status immediately in Dexie and Supabase.
 *
 * @param {string} paymentId - ID of payment being deleted, moved to trash, or edited
 */
export async function rollbackPaymentSettlement(paymentId) {
  if (!paymentId) return;
  try {
    const targetPid = String(paymentId);
    
    // 1. Rollback Attendance Logs linked to this settlement receipt
    const allLogs = await db.attendanceLogs.toArray();
    const affectedLogs = allLogs.filter((l) => {
      if (String(l.settlementReceiptId) === targetPid) return true;
      if (l.notes && l.notes.includes(targetPid)) return true;
      return false;
    });

    if (affectedLogs.length > 0) {
      const now = new Date().toISOString();
      const updatedLogs = affectedLogs.map((l) => {
        let cleanNotes = (l.notes || '').trim();
        // Remove "rid" and "st":1 from __META__ in notes
        if (cleanNotes.includes('__META__')) {
          const match = cleanNotes.match(/__META__([\s\S]*?)__META__/);
          if (match && match[1]) {
            try {
              const metaObj = JSON.parse(match[1]);
              delete metaObj.rid;
              delete metaObj.st;
              if (Object.keys(metaObj).length > 0) {
                cleanNotes = cleanNotes.replace(/__META__[\s\S]*?__META__/, `__META__${JSON.stringify(metaObj)}__META__`);
              } else {
                cleanNotes = cleanNotes.replace(/__META__[\s\S]*?__META__\n?/, '').trim();
              }
            } catch (_) {}
          }
        }

        return {
          ...l,
          isSettled: false,
          settlementReceiptId: null,
          notes: cleanNotes || null,
          updatedAt: now
        };
      });

      await db.attendanceLogs.bulkPut(updatedLogs);
      await pushLogsLive(updatedLogs).catch(console.warn);
    }

    // 2. Rollback any Advances that were settled within this settlement receipt
    const allPayments = await db.payments.toArray();
    const affectedAdvances = allPayments.filter((p) => 
      String(p.settlementReceiptId) === targetPid && String(p.id) !== targetPid
    );

    if (affectedAdvances.length > 0) {
      const now = new Date().toISOString();
      const updatedAdvances = affectedAdvances.map((p) => ({
        ...p,
        isSettled: false,
        settlementReceiptId: null,
        updatedAt: now
      }));

      await db.payments.bulkPut(updatedAdvances);
      await pushPaymentsLive().catch(console.warn);
    }

    // 3. Dispatch global live update events
    window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
    window.dispatchEvent(new CustomEvent('workshop-logs-updated'));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  } catch (err) {
    console.error(`Error rolling back settlement for payment ${paymentId}:`, err);
  }
}

/**
 * Full two-way sync:
 * Always flush pending local deletions FIRST, pull remote cloud changes SECOND, and push active local changes THIRD.
 */
export async function fullSyncBothDirections() {
  await flushPendingDeletions();
  await pullWorkerProjectsLive();
  await pullGroupsLive();
  await pullWorkerMetadataLive();
  await pullRemoteChangesSilently();
  await pullPaymentsLive();
  await pullProjectsLive();
  await pullProjectSectionsLive();
  await pullExpensesLive();
  await pullExpenseCategoriesLive(true);
  const ctx = getActiveWorkspaceContext();
  if (ctx.isLegacyOwner) {
    await pushAllLocalToCloud();
    await pushAllGroupsToCloud();
    await syncAllWorkerMetadataToCloud();
    await pushPaymentsLive();
    await pushAllExpensesToCloud();
  }
  await syncFinancialDataLive();
}

/**
 * Upload receipt image to Supabase Storage bucket 'expense-receipts'
 * Falls back safely to Base64 data URL if offline or storage issue
 */
export async function uploadExpenseReceipt(file) {
  if (!file) return null;
  const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${file.name?.split('.').pop() || 'jpg'}`;

  // If online, attempt upload to Supabase Storage bucket 'expense-receipts'
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.storage
        .from('expense-receipts')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (!error && data?.path) {
        const { data: publicUrlData } = supabase.storage
          .from('expense-receipts')
          .getPublicUrl(data.path);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (err) {
      console.warn('Supabase storage upload failed, falling back to base64:', err);
    }
  }

  // Fallback to base64 Data URL (ensures image is NEVER lost offline)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

let isPullingExpenses = false;
let lastExpensesPullTime = 0;

/**
 * Pull all expenses from Supabase with safe merge and deletion reconciliation
 */
export async function pullExpensesLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingExpenses) return;
  if (!force && now - lastExpensesPullTime < 2000) return;
  isPullingExpenses = true;
  lastExpensesPullTime = now;

  try {
    let cloudExpenses = [];

    // Layer A: Universal sync via Supabase 'settings' key 'app_expenses'
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_expenses'))
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        cloudExpenses = JSON.parse(sData.setting_value) || [];
      } catch (_) {}
    }

    // Layer B: Also check 'expenses' table if schema exists
    try {
      const ctx = getActiveWorkspaceContext();
      let query = supabase.from('expenses').select('*');
      if (ctx.isLegacyOwner) {
        query = query.or('user_id.eq.867f5819-e911-45f2-9d4f-d4a7f955ef5f,user_id.is.null');
      } else if (ctx.userId) {
        query = query.eq('user_id', ctx.userId);
      } else {
        query = query.eq('user_id', 'unauthenticated_empty_state');
      }
      const { data: tblData, error: tblErr } = await query;

      if (!tblErr && Array.isArray(tblData) && tblData.length > 0) {
        const cloudMap = new Map();
        for (const ce of cloudExpenses) cloudMap.set(ce.id, ce);
        for (const te of tblData) {
          const prev = cloudMap.get(te.id) || {};
          cloudMap.set(te.id, {
            ...prev,
            id: te.id,
            projectId: te.project_id || prev.projectId,
            userId: te.user_id || prev.userId,
            sectionId: te.section_id ?? prev.sectionId ?? null,
            categoryId: te.category_id ?? prev.categoryId ?? null,
            personId: te.person_id ?? prev.personId ?? null,
            personName: te.person_name ?? prev.personName ?? '',
            title: te.title || prev.title,
            amount: Number(te.amount ?? prev.amount) || 0,
            currency: te.currency || prev.currency || 'IQD',
            paymentStatus: te.payment_status || prev.paymentStatus || 'paid',
            paymentMethod: te.payment_method || prev.paymentMethod || 'cash',
            receiptUrl: te.receipt_url ?? prev.receiptUrl ?? null,
            description: te.description ?? prev.description ?? '',
            expenseDate: te.expense_date || prev.expenseDate,
            deletedAt: te.deleted_at || prev.deletedAt || null,
            isArchived: Boolean(te.is_archived ?? prev.isArchived),
            archivedAt: te.archived_at || prev.archivedAt || null,
            createdAt: te.created_at || prev.createdAt,
            updatedAt: prev.updatedAt && te.updated_at && new Date(prev.updatedAt) > new Date(te.updated_at)
              ? prev.updatedAt
              : (te.updated_at || prev.updatedAt)
          });
        }
        cloudExpenses = Array.from(cloudMap.values());
      }
    } catch (_) {}

    if (Array.isArray(cloudExpenses)) {
      const pendingDeleted = new Set(getPendingDeletedExpenses());
      const validCloudExpenses = cloudExpenses.filter(e => !pendingDeleted.has(e.id));
      const validCloudIds = new Set(validCloudExpenses.map(e => e.id));

      await db.transaction('rw', db.expenses, async () => {
        for (const e of validCloudExpenses) {
          const localE = await db.expenses.get(e.id);
          if (localE && localE.updatedAt && (e.updatedAt || e.updated_at)) {
            const localTime = new Date(localE.updatedAt).getTime();
            const cloudTime = new Date(e.updatedAt || e.updated_at).getTime();
            if (localTime > cloudTime) {
              continue;
            }
          }

          await db.expenses.put({
            ...(localE || {}),
            ...e,
            id: e.id,
            projectId: e.projectId || e.project_id,
            sectionId: e.sectionId || e.section_id || null,
            categoryId: e.categoryId || e.category_id || null,
            personId: e.personId || e.person_id || null,
            personName: e.personName || e.person_name || '',
            title: e.title,
            amount: Number(e.amount) || 0,
            currency: e.currency || 'IQD',
            paymentStatus: e.paymentStatus || e.payment_status || 'paid',
            paymentMethod: e.paymentMethod || e.payment_method || 'cash',
            receiptUrl: e.receiptUrl || e.receipt_url || null,
            description: e.description || '',
            expenseDate: e.expenseDate || e.expense_date || new Date().toISOString().slice(0, 10),
            deletedAt: e.deletedAt || e.deleted_at || null,
            isArchived: Boolean(e.isArchived || e.is_archived),
            archivedAt: e.archivedAt || e.archived_at || null,
            createdAt: e.createdAt || e.created_at || new Date().toISOString(),
            updatedAt: e.updatedAt || e.updated_at || new Date().toISOString()
          });
        }

        // Reconcile deleted expenses
        const ctx = getActiveWorkspaceContext();
        if (validCloudExpenses.length > 0 || (sData?.setting_value && cloudExpenses.length === 0) || !ctx.isLegacyOwner) {
          const localList = await db.expenses.toArray();
          for (const le of localList) {
            if (!validCloudIds.has(le.id) && !pendingDeleted.has(le.id)) {
              const isRecent = le.createdAt && (Date.now() - new Date(le.createdAt).getTime() < 10000);
              if (!isRecent || (!ctx.isLegacyOwner && le.userId !== ctx.userId)) {
                await db.expenses.delete(le.id);
              }
            }
          }
        }
      });

      window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
    }
  } catch (err) {
    console.warn('pullExpensesLive warning:', err);
  } finally {
    isPullingExpenses = false;
  }
}

/**
 * Push an expense record to Supabase (Universal + Table)
 */
export async function pushExpenseLive(expense) {
  if (!expense) return;
  await db.expenses.put(expense);

  if (!navigator.onLine) return;
  try {
    const localExpenses = await db.expenses.toArray();
    const pendingDeleted = new Set(getPendingDeletedExpenses());
    const filteredLocal = localExpenses.filter(e => !pendingDeleted.has(e.id));

    // Layer A: Update Supabase 'settings' key 'app_expenses'
    const { data: sData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_expenses'))
      .maybeSingle();

    let mergedMap = new Map();
    if (sData?.setting_value) {
      try {
        const cloudExpenses = JSON.parse(sData.setting_value) || [];
        for (const ce of cloudExpenses) {
          if (!pendingDeleted.has(ce.id)) {
            mergedMap.set(ce.id, ce);
          }
        }
      } catch (_) {}
    }

    for (const le of filteredLocal) {
      const existing = mergedMap.get(le.id);
      if (!existing || !existing.updatedAt || !le.updatedAt || new Date(le.updatedAt) >= new Date(existing.updatedAt)) {
        mergedMap.set(le.id, le);
      }
    }

    if (expense && !pendingDeleted.has(expense.id)) {
      mergedMap.set(expense.id, expense);
    }

    const mergedList = Array.from(mergedMap.values());
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_expenses'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });

    // Layer B: Also attempt upsert to 'expenses' table if available
    try {
      const payload = {
        id: expense.id,
        project_id: expense.projectId,
        user_id: expense.userId || (await supabase.auth.getUser()).data.user?.id || null,
        section_id: expense.sectionId || null,
        category_id: expense.categoryId || null,
        person_id: expense.personId || null,
        person_name: expense.personName || null,
        title: expense.title,
        amount: Number(expense.amount) || 0,
        currency: expense.currency || 'IQD',
        payment_status: expense.paymentStatus || 'paid',
        payment_method: expense.paymentMethod || 'cash',
        receipt_url: expense.receiptUrl || null,
        description: expense.description || null,
        deleted_at: expense.deletedAt || null,
        is_archived: Boolean(expense.isArchived),
        archived_at: expense.archivedAt || null,
        expense_date: expense.expenseDate || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString()
      };
      await supabase.from('expenses').upsert(payload);
    } catch (_) {}

    // Broadcast instant sync notification to all active clients (PC & Mobile)
    await broadcastSyncEvent('expenses', { id: expense.id });
    window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
  } catch (err) {
    console.warn('pushExpenseLive warning:', err);
  }
}

/**
 * Soft delete an expense record (Move to Trash)
 */
export async function softDeleteExpenseLive(expenseId) {
  if (!expenseId) return;
  try {
    const localExp = await db.expenses.get(expenseId);
    if (localExp && (localExp.status === 'approved' || localExp.approval_status === 'approved')) {
      console.warn('softDeleteExpenseLive rejected: expense is approved:', expenseId);
      return;
    }

    const now = new Date().toISOString();
    await db.expenses.update(expenseId, { deletedAt: now, updatedAt: now });

    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
      return;
    }

    // Layer A: Update in 'settings' app_expenses
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_expenses'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        const expenses = JSON.parse(data.setting_value) || [];
        const updated = expenses.map(e => e.id === expenseId ? { ...e, deletedAt: now, updatedAt: now } : e);
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_expenses'),
          setting_value: JSON.stringify(updated),
          updated_at: now
        });
      } catch (_) {}
    }

    // Layer B: Also update 'expenses' table if available
    try {
      await supabase
        .from('expenses')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', expenseId);
    } catch (_) {}

    await broadcastSyncEvent('expenses', { id: expenseId, softDeleted: true });
    window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
  } catch (err) {
    console.warn('softDeleteExpenseLive warning:', err);
  }
}

/**
 * Restore an expense record from Trash back to active list
 */
export async function restoreExpenseLive(expenseId) {
  if (!expenseId) return;
  const now = new Date().toISOString();
  try {
    await db.expenses.update(expenseId, { deletedAt: null, updatedAt: now });
    clearPendingExpenseDeletion(expenseId);

    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
      return;
    }

    // Layer A: Update in 'settings' app_expenses
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_expenses'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        const expenses = JSON.parse(data.setting_value) || [];
        const updated = expenses.map(e => e.id === expenseId ? { ...e, deletedAt: null, updatedAt: now } : e);
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_expenses'),
          setting_value: JSON.stringify(updated),
          updated_at: now
        });
      } catch (_) {}
    }

    // Layer B: Also update 'expenses' table if available
    try {
      await supabase
        .from('expenses')
        .update({ deleted_at: null, updated_at: now })
        .eq('id', expenseId);
    } catch (_) {}

    await broadcastSyncEvent('expenses', { id: expenseId, restored: true });
    window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
  } catch (err) {
    console.warn('restoreExpenseLive warning:', err);
  }
}

/**
 * Archive or Unarchive an expense record
 */
export async function archiveExpenseLive(expenseId, isArchived = true) {
  if (!expenseId) return;
  try {
    const localExp = await db.expenses.get(expenseId);
    if (localExp && (localExp.status === 'approved' || localExp.approval_status === 'approved')) {
      console.warn('archiveExpenseLive rejected: expense is approved:', expenseId);
      return;
    }

    const now = new Date().toISOString();
    await db.expenses.update(expenseId, {
      isArchived: Boolean(isArchived),
      archivedAt: isArchived ? now : null,
      updatedAt: now
    });

    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
      return;
    }

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_expenses'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        const expenses = JSON.parse(data.setting_value) || [];
        const updated = expenses.map(e => e.id === expenseId ? {
          ...e,
          isArchived: Boolean(isArchived),
          archivedAt: isArchived ? now : null,
          updatedAt: now
        } : e);
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_expenses'),
          setting_value: JSON.stringify(updated),
          updated_at: now
        });
      } catch (_) {}
    }

    try {
      await supabase
        .from('expenses')
        .update({
          is_archived: Boolean(isArchived),
          archived_at: isArchived ? now : null,
          updated_at: now
        })
        .eq('id', expenseId);
    } catch (_) {}

    await broadcastSyncEvent('expenses', { id: expenseId, isArchived });
    window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
  } catch (err) {
    console.warn('archiveExpenseLive warning:', err);
  }
}

/**
 * Permanently delete an expense record from Dexie and Cloud
 */
export async function permanentDeleteExpenseLive(expenseId) {
  if (!expenseId) return;
  try {
    const localExp = await db.expenses.get(expenseId);
    if (localExp && (localExp.status === 'approved' || localExp.approval_status === 'approved')) {
      console.warn('permanentDeleteExpenseLive rejected: expense is approved:', expenseId);
      return;
    }

    recordPendingExpenseDeletion(expenseId);
    await db.expenses.delete(expenseId);

    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
      return;
    }

    // Layer A: Remove from 'settings' app_expenses
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_expenses'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        const expenses = JSON.parse(data.setting_value) || [];
        const filtered = expenses.filter(e => e.id !== expenseId);
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_expenses'),
          setting_value: JSON.stringify(filtered),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    // Layer B: Also delete from 'expenses' table if available
    try {
      await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);
    } catch (_) {}

    clearPendingExpenseDeletion(expenseId);
    await broadcastSyncEvent('expenses', { id: expenseId, permanentDeleted: true });
    window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
  } catch (err) {
    console.warn('permanentDeleteExpenseLive warning:', err);
  }
}

/**
 * Empty all deleted expenses from Recycle Bin for a project
 */
export async function emptyExpensesTrashLive(projectId) {
  try {
    const list = await db.expenses.toArray();
    const trashList = list.filter(e => e.deletedAt && e.status !== 'approved' && e.approval_status !== 'approved' && (!projectId || e.projectId === projectId || projectId === 'prj_default_main'));
    for (const exp of trashList) {
      await permanentDeleteExpenseLive(exp.id);
    }
  } catch (err) {
    console.warn('emptyExpensesTrashLive warning:', err);
  }
}

/**
 * Batch restore multiple expenses from Recycle Bin
 */
export async function restoreAllExpensesLive(expenseIds = []) {
  try {
    for (const id of expenseIds) {
      await restoreExpenseLive(id);
    }
  } catch (err) {
    console.warn('restoreAllExpensesLive warning:', err);
  }
}

/**
 * Default deleteExpenseLive now uses soft delete (Trash Bin)
 */
export async function deleteExpenseLive(expenseId) {
  return await softDeleteExpenseLive(expenseId);
}

/**
 * Push all local expenses to Supabase
 */
export async function pushAllExpensesToCloud() {
  if (!navigator.onLine) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const localExpenses = await db.expenses.toArray();
    if (!localExpenses || localExpenses.length === 0) return;

    const pendingDeleted = new Set(getPendingDeletedExpenses());
    const filteredLocal = localExpenses.filter(e => {
      if (pendingDeleted.has(e.id)) return false;
      if (!ctx.isLegacyOwner && e.userId && e.userId !== ctx.userId) return false;
      return true;
    });
    if (filteredLocal.length === 0) return;

    const { data: sData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_expenses'))
      .maybeSingle();

    let mergedMap = new Map();
    if (sData?.setting_value) {
      try {
        const cloudExpenses = JSON.parse(sData.setting_value) || [];
        for (const ce of cloudExpenses) {
          if (!pendingDeleted.has(ce.id)) mergedMap.set(ce.id, ce);
        }
      } catch (_) {}
    }

    for (const le of filteredLocal) {
      mergedMap.set(le.id, le);
    }

    const mergedList = Array.from(mergedMap.values());
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_expenses'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('pushAllExpensesToCloud warning:', err);
  }
}

/**
 * Pull expense categories from Supabase with resilient fallback seeding
 */
export async function pullExpenseCategoriesLive() {
  if (!navigator.onLine) return;
  try {
    let cloudCategories = null;
    const { data: sData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_expense_categories'))
      .maybeSingle();

    if (sData?.setting_value) {
      try {
        cloudCategories = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    const ctx = getActiveWorkspaceContext();
    const localCats = await db.expenseCategories.toArray();

    // If cloud setting has never been seeded or is empty
    if (cloudCategories === null || !Array.isArray(cloudCategories) || cloudCategories.length === 0) {
      if (ctx.isLegacyOwner && localCats.length > 0) {
        await pushAllExpenseCategoriesToCloud();
      } else {
        // Non-legacy tenant or fresh setup: adopt or cleanup local categories
        if (!ctx.isLegacyOwner) {
          for (const lc of localCats) {
            if (!lc.userId || lc.userId === 'default_user') {
              await db.expenseCategories.update(lc.id, { userId: ctx.userId }).catch(() => {});
            } else if (lc.userId !== ctx.userId) {
              await db.expenseCategories.delete(lc.id).catch(() => {});
            }
          }
        }
        const { seedDefaultExpenseCategories } = await import('../db/db');
        await seedDefaultExpenseCategories(ctx.workspaceId || DEFAULT_PROJECT_ID, ctx.userId);
        await pushAllExpenseCategoriesToCloud();
      }
      return;
    }

    // Cloud has categories: apply them into local IndexedDB
    if (Array.isArray(cloudCategories) && cloudCategories.length > 0) {
      const cloudIds = new Set(cloudCategories.map(c => c.id));
      for (const c of cloudCategories) {
        await db.expenseCategories.put(c);
      }
      const currentLocals = await db.expenseCategories.toArray();
      for (const lc of currentLocals) {
        if (!cloudIds.has(lc.id)) {
          await db.expenseCategories.delete(lc.id);
        }
      }

      // Check if codes or userId adoption is needed
      const { seedDefaultExpenseCategories } = await import('../db/db');
      const updated = await seedDefaultExpenseCategories(ctx.workspaceId || DEFAULT_PROJECT_ID, ctx.userId);
      if (updated) {
        await pushAllExpenseCategoriesToCloud();
      }
    }

    try {
      let query = supabase.from('expense_categories').select('*');
      if (ctx.isLegacyOwner) {
        query = query.or('user_id.eq.867f5819-e911-45f2-9d4f-d4a7f955ef5f,user_id.is.null');
      } else if (ctx.userId) {
        query = query.eq('user_id', ctx.userId);
      } else {
        query = query.eq('user_id', 'unauthenticated_empty_state');
      }
      const { data: tblData } = await query;
      if (Array.isArray(tblData) && tblData.length > 0) {
        for (const c of tblData) {
          await db.expenseCategories.put({
            id: c.id,
            projectId: c.project_id,
            userId: c.user_id,
            name: c.name,
            code: c.code || null,
            parentId: c.parent_id,
            level: Number(c.level) || 1,
            isSystem: !!c.is_system,
            createdAt: c.created_at,
            updatedAt: c.updated_at
          });
        }
      }
    } catch (_) {}

    await deduplicateExpenseCategories();
  } catch (err) {
    console.warn('pullExpenseCategoriesLive warning:', err);
  }
}

/**
 * Push all expense categories to Supabase settings
 */
export async function pushAllExpenseCategoriesToCloud() {
  if (!navigator.onLine) return;
  try {
    const list = await db.expenseCategories.toArray();
    if (!list || list.length === 0) return;
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_expense_categories'),
      setting_value: JSON.stringify(list),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('pushAllExpenseCategoriesToCloud warning:', err);
  }
}

/**
 * Push an expense category to Dexie and Supabase
 */
export async function pushExpenseCategoryLive(cat) {
  if (!cat) return;
  if (!cat.code) {
    try {
      cat.code = await generateNextCategoryCode(cat.parentId, cat.level, cat.projectId);
    } catch (_) {}
  }
  await db.expenseCategories.put(cat);
  if (!navigator.onLine) return;
  try {
    const list = await db.expenseCategories.toArray();
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_expense_categories'),
      setting_value: JSON.stringify(list),
      updated_at: new Date().toISOString()
    });
    try {
      await supabase.from('expense_categories').upsert({
        id: cat.id,
        project_id: cat.projectId,
        user_id: cat.userId,
        name: cat.name,
        code: cat.code || null,
        parent_id: cat.parentId || null,
        level: cat.level || 1,
        updated_at: new Date().toISOString()
      });
    } catch (_) {}
  } catch (err) {
    console.warn('pushExpenseCategoryLive warning:', err);
  }
}

/**
 * Delete an expense category from Dexie and Supabase
 */
export async function deleteExpenseCategoryLive(catId) {
  if (!catId) return;
  await db.expenseCategories.delete(catId);
  if (!navigator.onLine) return;
  try {
    const list = await db.expenseCategories.toArray();
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_expense_categories'),
      setting_value: JSON.stringify(list),
      updated_at: new Date().toISOString()
    });
    try {
      await supabase.from('expense_categories').delete().eq('id', catId);
    } catch (_) {}
  } catch (err) {
    console.warn('deleteExpenseCategoryLive warning:', err);
  }
}

let isPullingAccounts = false;
let lastAccountsPullTime = 0;

/**
 * Pull financial accounts (bank cards and cash boxes) from Supabase settings
 */
export async function pullFinancialAccountsLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingAccounts) return;
  if (!force && now - lastAccountsPullTime < 2000) return;
  isPullingAccounts = true;
  lastAccountsPullTime = now;

  try {
    clearPendingAccountDeletion('acc_default_cash');
    clearPendingAccountDeletion('acc_default_bank');
    const pendingDeleted = new Set(getPendingDeletedAccounts());
    pendingDeleted.delete('acc_default_cash');
    pendingDeleted.delete('acc_default_bank');
    pendingDeleted.add('acc_mull5f7l_itlwl');
    await db.financialAccounts.delete('acc_mull5f7l_itlwl').catch(() => {});
    let cloudAccounts = null;
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_financial_accounts'))
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        cloudAccounts = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    const localAccounts = await db.financialAccounts.toArray();

    // If cloud setting has never been seeded or is null, push our local accounts ONLY for legacy owner
    if (cloudAccounts === null || !Array.isArray(cloudAccounts)) {
      const ctx = getActiveWorkspaceContext();
      if (ctx.isLegacyOwner && localAccounts.length > 0) {
        await pushAllFinancialAccountsToCloud();
      } else if (!ctx.isLegacyOwner) {
        await db.financialAccounts.clear();
        const { seedDefaultFinancialAccounts } = await import('../db/db');
        await seedDefaultFinancialAccounts(ctx.workspaceId || DEFAULT_PROJECT_ID, ctx.userId);
        await pushAllFinancialAccountsToCloud();
      }
      return;
    }

    const cloudMap = new Map();
    const cloudDeletedIds = new Set();
    for (const ca of cloudAccounts) {
      if (!ca || !ca.id) continue;
      // Core system accounts (acc_default_cash, acc_default_bank) are permanent and never deleted
      if (ca.id === 'acc_default_cash' || ca.id === 'acc_default_bank') {
        ca.deletedAt = null;
        ca.status = 'active';
        ca.isActive = true;
      }
      if (ca.deletedAt || ca.status === 'deleted' || pendingDeleted.has(ca.id)) {
        if (ca.id !== 'acc_default_cash' && ca.id !== 'acc_default_bank') {
          cloudDeletedIds.add(ca.id);
          await db.financialAccounts.delete(ca.id).catch(() => {});
          continue;
        }
      }
      cloudMap.set(ca.id, ca);
    }

    // Ensure acc_default_cash is always in cloudMap
    let needPushLocal = false;
    if (!cloudMap.has('acc_default_cash')) {
      const now = new Date().toISOString();
      cloudMap.set('acc_default_cash', {
        id: 'acc_default_cash',
        projectId: DEFAULT_PROJECT_ID,
        userId: 'default_user',
        name: 'صندوق نقدی کارگاه',
        type: 'cash',
        keeperName: 'سرپرست کارگاه',
        initialBalance: 0,
        isDefault: true,
        isActive: true,
        color: 'amber',
        notes: 'صندوق نقدی پیش‌فرض جهت پرداخت‌ها و مخارج روزمره کارگاه',
        deletedAt: null,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });
      needPushLocal = true;
    }

    // 1. Reconcile local accounts:
    for (const la of localAccounts) {
      if (pendingDeleted.has(la.id) || cloudDeletedIds.has(la.id) || la.deletedAt || la.status === 'deleted') {
        await db.financialAccounts.delete(la.id).catch(() => {});
      } else if (!cloudMap.has(la.id)) {
        const ctx = getActiveWorkspaceContext();
        if (ctx.isLegacyOwner) {
          // Local account is active and not marked deleted. Add to cloudMap and sync to cloud!
          cloudMap.set(la.id, la);
          needPushLocal = true;
        } else {
          // Alien local account from another tenant: remove!
          await db.financialAccounts.delete(la.id).catch(() => {});
        }
      }
    }

    // 2. Put cloud accounts into local Dexie
    for (const ca of cloudMap.values()) {
      if (ca.deletedAt || ca.status === 'deleted' || pendingDeleted.has(ca.id) || cloudDeletedIds.has(ca.id)) {
        await db.financialAccounts.delete(ca.id).catch(() => {});
      } else {
        const local = await db.financialAccounts.get(ca.id);
        if (!local || !local.updatedAt || !ca.updatedAt || new Date(ca.updatedAt) >= new Date(local.updatedAt)) {
          await db.financialAccounts.put(ca);
        }
      }
    }

    if (needPushLocal) {
      await pushAllFinancialAccountsToCloud();
    }

    window.dispatchEvent(new CustomEvent('workshop-accounts-sync'));
  } catch (err) {
    console.warn('pullFinancialAccountsLive warning:', err);
  } finally {
    isPullingAccounts = false;
  }
}

/**
 * Push an individual financial account to Dexie and Supabase
 */
export async function pushFinancialAccountLive(account) {
  if (!account || !account.id) return;
  try {
    await db.financialAccounts.put(account);
    window.dispatchEvent(new CustomEvent('workshop-accounts-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_financial_accounts'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudAccounts = JSON.parse(data.setting_value) || [];
        for (const ca of cloudAccounts) {
          if (ca && ca.id) mergedMap.set(ca.id, ca);
        }
      } catch (_) {}
    }

    const pendingDeleted = new Set(getPendingDeletedAccounts());
    if (pendingDeleted.has(account.id) || account.deletedAt || account.status === 'deleted') {
      mergedMap.set(account.id, {
        ...account,
        deletedAt: new Date().toISOString(),
        status: 'deleted'
      });
    } else {
      mergedMap.set(account.id, {
        ...account,
        updatedAt: new Date().toISOString()
      });
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_financial_accounts'),
      setting_value: JSON.stringify(Array.from(mergedMap.values())),
      updated_at: new Date().toISOString()
    });

    broadcastSyncEvent('accounts');
  } catch (err) {
    console.warn('pushFinancialAccountLive warning:', err);
  }
}

/**
 * Delete a financial account from Dexie and Supabase with tombstone
 */
export async function deleteFinancialAccountLive(accountId) {
  if (!accountId || accountId === 'acc_default_cash' || accountId === 'acc_default_bank') {
    console.warn('Cannot delete core system financial account:', accountId);
    return;
  }
  recordPendingAccountDeletion(accountId);
  try {
    await db.financialAccounts.delete(accountId);
    window.dispatchEvent(new CustomEvent('workshop-accounts-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_financial_accounts'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        let cloudAccounts = JSON.parse(data.setting_value) || [];
        let found = false;
        cloudAccounts = cloudAccounts.map((ca) => {
          if (ca && ca.id === accountId) {
            found = true;
            return { ...ca, deletedAt: new Date().toISOString(), status: 'deleted' };
          }
          return ca;
        });
        if (!found) {
          cloudAccounts.push({ id: accountId, deletedAt: new Date().toISOString(), status: 'deleted' });
        }
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_financial_accounts'),
          setting_value: JSON.stringify(cloudAccounts),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    broadcastSyncEvent('accounts');
  } catch (err) {
    console.warn('deleteFinancialAccountLive warning:', err);
  }
}

/**
 * Push all active local financial accounts to Supabase
 */
export async function pushAllFinancialAccountsToCloud() {
  if (!navigator.onLine) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    clearPendingAccountDeletion('acc_default_cash');
    clearPendingAccountDeletion('acc_default_bank');
    const list = await db.financialAccounts.toArray();
    const pendingDeleted = new Set(getPendingDeletedAccounts());
    pendingDeleted.delete('acc_default_cash');
    pendingDeleted.delete('acc_default_bank');
    pendingDeleted.add('acc_mull5f7l_itlwl');
    const active = list.filter(a => !pendingDeleted.has(a.id) && !a.deletedAt && a.status !== 'deleted' && a.id !== 'acc_mull5f7l_itlwl');

    const { data: sData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_financial_accounts'))
      .maybeSingle();

    let mergedMap = new Map();
    if (sData?.setting_value) {
      try {
        const cloudAccounts = JSON.parse(sData.setting_value) || [];
        for (const ca of cloudAccounts) {
          if (ca && ca.id) mergedMap.set(ca.id, ca);
        }
      } catch (_) {}
    }

    for (const a of active) {
      mergedMap.set(a.id, a);
    }

    for (const dId of pendingDeleted) {
      if (mergedMap.has(dId)) {
        mergedMap.set(dId, { ...mergedMap.get(dId), deletedAt: new Date().toISOString(), status: 'deleted' });
      } else {
        mergedMap.set(dId, { id: dId, deletedAt: new Date().toISOString(), status: 'deleted' });
      }
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_financial_accounts'),
      setting_value: JSON.stringify(Array.from(mergedMap.values())),
      updated_at: new Date().toISOString()
    });
    broadcastSyncEvent('accounts');
  } catch (err) {
    console.warn('pushAllFinancialAccountsToCloud warning:', err);
  }
}

let isPullingIncomes = false;
let lastIncomesPullTime = 0;

/**
 * Pull treasury incomes from Supabase settings
 */
export async function pullTreasuryIncomesLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingIncomes) return;
  if (!force && now - lastIncomesPullTime < 2000) return;
  isPullingIncomes = true;
  lastIncomesPullTime = now;

  try {
    const pendingDeleted = new Set(getPendingDeletedIncomes());
    let cloudIncomes = null;
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_treasury_incomes'))
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        cloudIncomes = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    const localIncomes = await db.treasuryIncomes.toArray();

    if (cloudIncomes === null || !Array.isArray(cloudIncomes)) {
      const ctx = getActiveWorkspaceContext();
      if (ctx.isLegacyOwner && localIncomes.length > 0) {
        await pushAllTreasuryIncomesToCloud();
      }
      return;
    }

    const cloudMap = new Map();
    const cloudDeletedIds = new Set();
    for (const ci of cloudIncomes) {
      if (!ci || !ci.id) continue;
      if (ci.deletedAt || ci.status === 'deleted' || pendingDeleted.has(ci.id)) {
        cloudDeletedIds.add(ci.id);
        await db.treasuryIncomes.delete(ci.id).catch(() => {});
      } else {
        cloudMap.set(ci.id, ci);
      }
    }

    let needPushIncomes = false;
    for (const li of localIncomes) {
      if (pendingDeleted.has(li.id) || cloudDeletedIds.has(li.id) || li.deletedAt || li.status === 'deleted') {
        await db.treasuryIncomes.delete(li.id).catch(() => {});
      } else if (!cloudMap.has(li.id)) {
        cloudMap.set(li.id, li);
        needPushIncomes = true;
      }
    }

    for (const ci of cloudMap.values()) {
      if (ci.deletedAt || ci.status === 'deleted' || pendingDeleted.has(ci.id) || cloudDeletedIds.has(ci.id)) {
        await db.treasuryIncomes.delete(ci.id).catch(() => {});
      } else {
        const local = await db.treasuryIncomes.get(ci.id);
        if (!local || !local.updatedAt || !ci.updatedAt || new Date(ci.updatedAt) >= new Date(local.updatedAt)) {
          await db.treasuryIncomes.put(ci);
        }
      }
    }

    if (needPushIncomes) {
      await pushAllTreasuryIncomesToCloud();
    }

    window.dispatchEvent(new CustomEvent('workshop-incomes-sync'));
  } catch (err) {
    console.warn('pullTreasuryIncomesLive warning:', err);
  } finally {
    isPullingIncomes = false;
  }
}

/**
 * Push an individual treasury income to Dexie and Supabase
 */
export async function pushTreasuryIncomeLive(income) {
  if (!income || !income.id) return;
  try {
    await db.treasuryIncomes.put(income);
    window.dispatchEvent(new CustomEvent('workshop-incomes-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_treasury_incomes'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudIncomes = JSON.parse(data.setting_value) || [];
        for (const ci of cloudIncomes) {
          if (ci && ci.id) mergedMap.set(ci.id, ci);
        }
      } catch (_) {}
    }

    const pendingDeleted = new Set(getPendingDeletedIncomes());
    if (pendingDeleted.has(income.id) || income.deletedAt || income.status === 'deleted') {
      mergedMap.set(income.id, {
        ...income,
        deletedAt: new Date().toISOString(),
        status: 'deleted'
      });
    } else {
      mergedMap.set(income.id, {
        ...income,
        updatedAt: new Date().toISOString()
      });
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_treasury_incomes'),
      setting_value: JSON.stringify(Array.from(mergedMap.values())),
      updated_at: new Date().toISOString()
    });

    broadcastSyncEvent('incomes');
  } catch (err) {
    console.warn('pushTreasuryIncomeLive warning:', err);
  }
}

/**
 * Delete a treasury income from Dexie and Supabase with tombstone
 */
export async function deleteTreasuryIncomeLive(incomeId) {
  if (!incomeId) return;
  recordPendingIncomeDeletion(incomeId);
  try {
    await db.treasuryIncomes.delete(incomeId);
    window.dispatchEvent(new CustomEvent('workshop-incomes-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_treasury_incomes'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        let cloudIncomes = JSON.parse(data.setting_value) || [];
        cloudIncomes = cloudIncomes.map((ci) => {
          if (ci && ci.id === incomeId) {
            return { ...ci, deletedAt: new Date().toISOString(), status: 'deleted' };
          }
          return ci;
        });
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_treasury_incomes'),
          setting_value: JSON.stringify(cloudIncomes),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    broadcastSyncEvent('incomes');
  } catch (err) {
    console.warn('deleteTreasuryIncomeLive warning:', err);
  }
}

/**
 * Push all active local treasury incomes to Supabase
 */
export async function pushAllTreasuryIncomesToCloud() {
  if (!navigator.onLine) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const list = await db.treasuryIncomes.toArray();
    const pendingDeleted = new Set(getPendingDeletedIncomes());
    const active = list.filter(i => !pendingDeleted.has(i.id) && !i.deletedAt);
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_treasury_incomes'),
      setting_value: JSON.stringify(active),
      updated_at: new Date().toISOString()
    });
    broadcastSyncEvent('incomes');
  } catch (err) {
    console.warn('pushAllTreasuryIncomesToCloud warning:', err);
  }
}

/**
 * Push global overdraft policy to Dexie and Supabase
 */
export async function pushGlobalOverdraftPolicyLive(policy) {
  if (!policy) return;
  try {
    await db.settings.put({ key: 'global_overdraft_policy', value: policy });
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_global_overdraft_policy'),
      setting_value: JSON.stringify({ policy, updatedAt: new Date().toISOString() }),
      updated_at: new Date().toISOString()
    });
    broadcastSyncEvent('settings');
  } catch (err) {
    console.warn('pushGlobalOverdraftPolicyLive warning:', err);
  }
}

/**
 * Pull global overdraft policy from Supabase settings
 */
export async function pullGlobalOverdraftPolicyLive() {
  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_global_overdraft_policy'))
      .maybeSingle();

    if (data?.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      if (parsed?.policy) {
        await db.settings.put({ key: 'global_overdraft_policy', value: parsed.policy });
      }
    }
  } catch (err) {
    console.warn('pullGlobalOverdraftPolicyLive warning:', err);
  }
}

let isPullingTransfers = false;
let lastTransfersPullTime = 0;

/**
 * Pull account transfers from Supabase settings
 */
export async function pullAccountTransfersLive(force = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (isPullingTransfers) return;
  if (!force && now - lastTransfersPullTime < 2000) return;
  isPullingTransfers = true;
  lastTransfersPullTime = now;

  try {
    let cloudTransfers = null;
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_account_transfers'))
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        cloudTransfers = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    if (!db.accountTransfers) return;
    const localTransfers = await db.accountTransfers.toArray();

    if (cloudTransfers === null || !Array.isArray(cloudTransfers)) {
      const ctx = getActiveWorkspaceContext();
      if (ctx.isLegacyOwner && localTransfers.length > 0) {
        await pushAllAccountTransfersToCloud();
      }
      return;
    }

    const cloudMap = new Map();
    const cloudDeletedIds = new Set();
    for (const ct of cloudTransfers) {
      if (!ct || !ct.id) continue;
      if (ct.deletedAt || ct.status === 'deleted') {
        cloudDeletedIds.add(ct.id);
        await db.accountTransfers.delete(ct.id).catch(() => {});
      } else {
        cloudMap.set(ct.id, ct);
      }
    }

    let needPushLocal = false;
    for (const lt of localTransfers) {
      if (cloudDeletedIds.has(lt.id) || lt.deletedAt || lt.status === 'deleted') {
        await db.accountTransfers.delete(lt.id).catch(() => {});
      } else if (!cloudMap.has(lt.id)) {
        cloudMap.set(lt.id, lt);
        needPushLocal = true;
      }
    }

    for (const ct of cloudMap.values()) {
      if (ct.deletedAt || ct.status === 'deleted' || cloudDeletedIds.has(ct.id)) {
        await db.accountTransfers.delete(ct.id).catch(() => {});
      } else {
        const local = await db.accountTransfers.get(ct.id);
        if (!local || !local.updatedAt || !ct.updatedAt || new Date(ct.updatedAt) >= new Date(local.updatedAt)) {
          await db.accountTransfers.put(ct);
        }
      }
    }

    if (needPushLocal) {
      await pushAllAccountTransfersToCloud();
    }

    window.dispatchEvent(new CustomEvent('workshop-transfers-sync'));
  } catch (err) {
    console.warn('pullAccountTransfersLive warning:', err);
  } finally {
    isPullingTransfers = false;
  }
}

/**
 * Push an individual account transfer to Dexie and Supabase
 */
export async function pushAccountTransferLive(transfer) {
  if (!transfer || !transfer.id) return;
  try {
    if (db.accountTransfers) {
      await db.accountTransfers.put(transfer);
    }
    window.dispatchEvent(new CustomEvent('workshop-transfers-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_account_transfers'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudTransfers = JSON.parse(data.setting_value) || [];
        for (const ct of cloudTransfers) {
          if (ct && ct.id) mergedMap.set(ct.id, ct);
        }
      } catch (_) {}
    }

    if (transfer.deletedAt || transfer.status === 'deleted') {
      mergedMap.set(transfer.id, {
        ...transfer,
        deletedAt: new Date().toISOString(),
        status: 'deleted'
      });
    } else {
      mergedMap.set(transfer.id, {
        ...transfer,
        updatedAt: new Date().toISOString()
      });
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_account_transfers'),
      setting_value: JSON.stringify(Array.from(mergedMap.values())),
      updated_at: new Date().toISOString()
    });

    broadcastSyncEvent('transfers');
  } catch (err) {
    console.warn('pushAccountTransferLive warning:', err);
  }
}

/**
 * Delete an account transfer from Dexie and Supabase
 */
export async function deleteAccountTransferLive(transferId) {
  if (!transferId) return;
  try {
    if (db.accountTransfers) {
      await db.accountTransfers.delete(transferId);
    }
    window.dispatchEvent(new CustomEvent('workshop-transfers-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_account_transfers'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        let cloudTransfers = JSON.parse(data.setting_value) || [];
        cloudTransfers = cloudTransfers.map((ct) => {
          if (ct && ct.id === transferId) {
            return { ...ct, deletedAt: new Date().toISOString(), status: 'deleted' };
          }
          return ct;
        });
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_account_transfers'),
          setting_value: JSON.stringify(cloudTransfers),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    broadcastSyncEvent('transfers');
  } catch (err) {
    console.warn('deleteAccountTransferLive warning:', err);
  }
}

/**
 * Push all active local account transfers to Supabase
 */
export async function pushAllAccountTransfersToCloud() {
  if (!navigator.onLine || !db.accountTransfers) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const list = await db.accountTransfers.toArray();
    const active = list.filter((t) => !t.deletedAt && t.status !== 'deleted');
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_account_transfers'),
      setting_value: JSON.stringify(active),
      updated_at: new Date().toISOString()
    });
    broadcastSyncEvent('transfers');
  } catch (err) {
    console.warn('pushAllAccountTransfersToCloud warning:', err);
  }
}

/**
 * Universal Financial Data Sync
 * Pulls and pushes financial accounts, incomes, transfers, and overdraft policies
 */
export async function syncFinancialDataLive() {
  try {
    await pullFinancialAccountsLive(true);
    await pullTreasuryIncomesLive(true);
    await pullAccountTransfersLive(true);
    await pullCounterpartiesLive(true);
    await pullLoansLive(true);
    await pullChequesLive(true);
    await pullChequebooksLive(true);
    await pullContractsLive(true);
    await pullGlobalOverdraftPolicyLive();
    const ctx = getActiveWorkspaceContext();
    if (ctx.isLegacyOwner) {
      await pushAllFinancialAccountsToCloud();
      await pushAllTreasuryIncomesToCloud();
      await pushAllAccountTransfersToCloud();
      await pushAllCounterpartiesToCloud();
    }
    window.dispatchEvent(new CustomEvent('workshop-accounts-sync'));
    window.dispatchEvent(new CustomEvent('workshop-incomes-sync'));
    window.dispatchEvent(new CustomEvent('workshop-transfers-sync'));
    window.dispatchEvent(new CustomEvent('workshop-counterparties-sync'));
    return { success: true };
  } catch (err) {
    console.warn('syncFinancialDataLive warning:', err);
    return { success: false, error: err.message };
  }
}

// ========================================================
// COUNTERPARTIES SYNC (Stored in Supabase settings: app_counterparties)
// ========================================================
let isPullingCounterparties = false;
let lastCounterpartiesPullTime = 0;

export async function pullCounterpartiesLive(force = false) {
  if (!navigator.onLine || !db.counterparties) return;
  const now = Date.now();
  if (isPullingCounterparties) return;
  if (!force && now - lastCounterpartiesPullTime < 2000) return;
  isPullingCounterparties = true;
  lastCounterpartiesPullTime = now;

  try {
    const pendingDeleted = new Set(getPendingDeletedCounterparties());
    let cloudCounterparties = null;
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_counterparties'))
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        cloudCounterparties = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    const localCounterparties = await db.counterparties.toArray();

    if (cloudCounterparties === null || !Array.isArray(cloudCounterparties)) {
      const ctx = getActiveWorkspaceContext();
      if (ctx.isLegacyOwner && localCounterparties.length > 0) {
        await pushAllCounterpartiesToCloud();
      }
      return;
    }

    const cloudMap = new Map();
    const cloudDeletedIds = new Set();
    for (const cp of cloudCounterparties) {
      if (!cp || !cp.id) continue;
      if (cp.deletedAt || cp.status === 'deleted' || pendingDeleted.has(cp.id)) {
        cloudDeletedIds.add(cp.id);
        await db.counterparties.delete(cp.id).catch(() => {});
      } else {
        cloudMap.set(cp.id, cp);
      }
    }

    let needPush = false;
    for (const lp of localCounterparties) {
      if (pendingDeleted.has(lp.id) || cloudDeletedIds.has(lp.id) || lp.deletedAt || lp.status === 'deleted') {
        await db.counterparties.delete(lp.id).catch(() => {});
      } else if (!cloudMap.has(lp.id)) {
        cloudMap.set(lp.id, lp);
        needPush = true;
      }
    }

    for (const cp of cloudMap.values()) {
      if (cp.deletedAt || cp.status === 'deleted' || pendingDeleted.has(cp.id) || cloudDeletedIds.has(cp.id)) {
        await db.counterparties.delete(cp.id).catch(() => {});
      } else {
        const local = await db.counterparties.get(cp.id);
        if (!local || !local.updatedAt || !cp.updatedAt || new Date(cp.updatedAt) >= new Date(local.updatedAt)) {
          await db.counterparties.put(cp);
        }
      }
    }

    if (needPush) {
      await pushAllCounterpartiesToCloud();
    }

    window.dispatchEvent(new CustomEvent('workshop-counterparties-sync'));
  } catch (err) {
    console.warn('pullCounterpartiesLive warning:', err);
  } finally {
    isPullingCounterparties = false;
  }
}

export async function pushCounterpartyLive(counterparty) {
  if (!counterparty || !counterparty.id || !db.counterparties) return;
  try {
    await db.counterparties.put(counterparty);
    window.dispatchEvent(new CustomEvent('workshop-counterparties-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_counterparties'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudList = JSON.parse(data.setting_value) || [];
        for (const item of cloudList) {
          if (item && item.id) mergedMap.set(item.id, item);
        }
      } catch (_) {}
    }

    mergedMap.set(counterparty.id, {
      ...counterparty,
      updatedAt: new Date().toISOString()
    });

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_counterparties'),
      setting_value: JSON.stringify(Array.from(mergedMap.values())),
      updated_at: new Date().toISOString()
    });

    broadcastSyncEvent('counterparties');
  } catch (err) {
    console.warn('pushCounterpartyLive warning:', err);
  }
}

export async function deleteCounterpartyLive(counterpartyId) {
  if (!counterpartyId || !db.counterparties) return;
  recordPendingCounterpartyDeletion(counterpartyId);
  try {
    await db.counterparties.delete(counterpartyId);
    window.dispatchEvent(new CustomEvent('workshop-counterparties-sync'));
  } catch (_) {}

  if (!navigator.onLine) return;
  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_counterparties'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        let cloudList = JSON.parse(data.setting_value) || [];
        cloudList = cloudList.map((cp) => {
          if (cp && cp.id === counterpartyId) {
            return { ...cp, deletedAt: new Date().toISOString(), status: 'deleted' };
          }
          return cp;
        });
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_counterparties'),
          setting_value: JSON.stringify(cloudList),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    broadcastSyncEvent('counterparties');
  } catch (err) {
    console.warn('deleteCounterpartyLive warning:', err);
  }
}

export async function pushAllCounterpartiesToCloud() {
  if (!navigator.onLine || !db.counterparties) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const list = await db.counterparties.toArray();
    const pendingDeleted = new Set(getPendingDeletedCounterparties());
    const active = list.filter((cp) => !pendingDeleted.has(cp.id) && !cp.deletedAt && cp.status !== 'deleted');
    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_counterparties'),
      setting_value: JSON.stringify(active),
      updated_at: new Date().toISOString()
    });
    broadcastSyncEvent('counterparties');
  } catch (err) {
    console.warn('pushAllCounterpartiesToCloud warning:', err);
  }
}

// ----------------------------------------------------
// Staff Loans Live Cloud Sync (وام‌های پرسنلی)
// ----------------------------------------------------
export async function pushLoansLive() {
  if (!navigator.onLine || !db.loans) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const localLoans = await db.loans.toArray();
    const activeLocal = localLoans.filter(l => !l.deletedAt && l.status !== 'deleted');

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_loans'))
      .maybeSingle();

    let mergedMap = new Map();
    if (data?.setting_value) {
      try {
        const cloudLoans = JSON.parse(data.setting_value);
        if (Array.isArray(cloudLoans)) {
          for (const cl of cloudLoans) {
            if (!cl.deletedAt && cl.status !== 'deleted') {
              mergedMap.set(cl.id, cl);
            }
          }
        }
      } catch (_) {}
    }

    for (const ll of activeLocal) {
      mergedMap.set(ll.id, ll);
    }

    const mergedList = Array.from(mergedMap.values()).map(l => ({
      ...l,
      principalAmount: roundCurrency(l.principalAmount, l.currency),
      totalRepayable: roundCurrency(l.totalRepayable, l.currency),
      totalPaid: roundCurrency(l.totalPaid, l.currency),
      remainingBalance: roundCurrency(l.remainingBalance, l.currency),
      monthlyInstallment: roundCurrency(l.monthlyInstallment, l.currency)
    }));

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_loans'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });

    broadcastSyncEvent('loans');
  } catch (err) {
    console.warn('pushLoansLive warning:', err);
  }
}

export async function pullLoansLive(triggerEvent = true) {
  if (!navigator.onLine || !db.loans) return [];
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return [];

  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_loans'))
      .maybeSingle();

    if (data?.setting_value) {
      const cloudLoans = JSON.parse(data.setting_value);
      if (Array.isArray(cloudLoans)) {
        await db.transaction('rw', db.loans, async () => {
          for (const cl of cloudLoans) {
            if (!cl.id) continue;
            const existing = await db.loans.get(cl.id);
            if (!existing || new Date(cl.updatedAt || cl.createdAt || 0) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
              await db.loans.put(cl);
            }
          }
        });

        if (triggerEvent) {
          window.dispatchEvent(new CustomEvent('workshop-loans-sync'));
        }
        return cloudLoans;
      }
    }
  } catch (err) {
    console.warn('pullLoansLive warning:', err);
  }
  return [];
}

export async function deleteLoanLive(loanId) {
  if (!loanId || !db.loans) return;
  try {
    const existing = await db.loans.get(loanId);
    if (existing) {
      const updated = { ...existing, status: 'deleted', deletedAt: new Date().toISOString() };
      await db.loans.put(updated);
    }

    if (!navigator.onLine) return;
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_loans'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        let cloudList = JSON.parse(data.setting_value) || [];
        cloudList = cloudList.filter(l => l.id !== loanId);
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_loans'),
          setting_value: JSON.stringify(cloudList),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    broadcastSyncEvent('loans');
  } catch (err) {
    console.warn('deleteLoanLive warning:', err);
  }
}

// ----------------------------------------------------
// CHEQUES & COMMERCIAL NOTES CLOUD SYNC
// ----------------------------------------------------

export async function pushChequeLive(chequeRecord) {
  if (!chequeRecord || !chequeRecord.id || !db.cheques) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const localCheques = await db.cheques.toArray();
    const activeLocal = localCheques.filter(c => !c.deletedAt && c.status !== 'deleted');

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_cheques'))
      .maybeSingle();

    let mergedList = [...activeLocal];
    if (data?.setting_value) {
      try {
        const cloudList = JSON.parse(data.setting_value) || [];
        const localMap = new Map(activeLocal.map(c => [c.id, c]));
        for (const cl of cloudList) {
          if (!localMap.has(cl.id)) {
            mergedList.push(cl);
          }
        }
      } catch (_) {}
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_cheques'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });

    broadcastSyncEvent('cheques');
  } catch (err) {
    console.warn('pushChequeLive warning:', err);
  }
}

export async function pullChequesLive(triggerEvent = true) {
  if (!navigator.onLine || !db.cheques) return [];
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return [];

  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_cheques'))
      .maybeSingle();

    if (data?.setting_value) {
      const cloudCheques = JSON.parse(data.setting_value);
      if (Array.isArray(cloudCheques)) {
        await db.transaction('rw', db.cheques, async () => {
          for (const chk of cloudCheques) {
            if (!chk.id) continue;
            const existing = await db.cheques.get(chk.id);
            if (!existing || new Date(chk.updatedAt || chk.createdAt || 0) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
              await db.cheques.put(chk);
            }
          }
        });

        if (triggerEvent && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('workshop-cheques-sync'));
        }
        return cloudCheques;
      }
    }
  } catch (err) {
    console.warn('pullChequesLive warning:', err);
  }
  return [];
}

export async function deleteChequeLive(chequeId) {
  if (!chequeId || !db.cheques) return;
  try {
    const existing = await db.cheques.get(chequeId);
    if (existing) {
      const updated = { ...existing, status: 'deleted', deletedAt: new Date().toISOString() };
      await db.cheques.put(updated);
    }

    if (!navigator.onLine) return;
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_cheques'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        let cloudList = JSON.parse(data.setting_value) || [];
        cloudList = cloudList.filter(c => c.id !== chequeId);
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_cheques'),
          setting_value: JSON.stringify(cloudList),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    broadcastSyncEvent('cheques');
  } catch (err) {
    console.warn('deleteChequeLive warning:', err);
  }
}

// ----------------------------------------------------
// CHEQUEBOOKS CLOUD SYNC
// ----------------------------------------------------

export async function pushChequebookLive(bookRecord) {
  if (!bookRecord || !bookRecord.id || !db.chequebooks) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const localBooks = await db.chequebooks.toArray();
    const activeLocal = localBooks.filter(b => !b.deletedAt && b.status !== 'deleted');

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_chequebooks'))
      .maybeSingle();

    let mergedList = [...activeLocal];
    if (data?.setting_value) {
      try {
        const cloudList = JSON.parse(data.setting_value) || [];
        const localMap = new Map(activeLocal.map(b => [b.id, b]));
        for (const cl of cloudList) {
          if (!localMap.has(cl.id)) {
            mergedList.push(cl);
          }
        }
      } catch (_) {}
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_chequebooks'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });

    broadcastSyncEvent('chequebooks');
  } catch (err) {
    console.warn('pushChequebookLive warning:', err);
  }
}

export async function pullChequebooksLive(triggerEvent = true) {
  if (!navigator.onLine || !db.chequebooks) return [];
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return [];

  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_chequebooks'))
      .maybeSingle();

    if (data?.setting_value) {
      const cloudBooks = JSON.parse(data.setting_value);
      if (Array.isArray(cloudBooks)) {
        await db.transaction('rw', db.chequebooks, async () => {
          for (const cb of cloudBooks) {
            if (!cb.id) continue;
            const existing = await db.chequebooks.get(cb.id);
            if (!existing || new Date(cb.updatedAt || cb.createdAt || 0) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
              await db.chequebooks.put(cb);
            }
          }
        });

        if (triggerEvent && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('workshop-chequebooks-sync'));
        }
        return cloudBooks;
      }
    }
  } catch (err) {
    console.warn('pullChequebooksLive warning:', err);
  }
  return [];
}

export async function deleteChequebookLive(bookId) {
  if (!bookId || !db.chequebooks) return;
  try {
    const existing = await db.chequebooks.get(bookId);
    if (existing) {
      const updated = { ...existing, status: 'deleted', deletedAt: new Date().toISOString() };
      await db.chequebooks.put(updated);
    }

    if (!navigator.onLine) return;
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_chequebooks'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        let cloudList = JSON.parse(data.setting_value) || [];
        cloudList = cloudList.filter(b => b.id !== bookId);
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_chequebooks'),
          setting_value: JSON.stringify(cloudList),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    broadcastSyncEvent('chequebooks');
  } catch (err) {
    console.warn('deleteChequebookLive warning:', err);
  }
}





// ----------------------------------------------------
// CONTRACTS & OPERATIONS CLOUD SYNC
// ----------------------------------------------------

export async function pushContractLive(contractRecord) {
  if (!contractRecord || !contractRecord.id || !db.contracts) return;
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return;

  try {
    const localContracts = await db.contracts.toArray();
    const activeLocal = localContracts.filter(c => !c.deletedAt && c.status !== 'deleted');

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_contracts'))
      .maybeSingle();

    let mergedList = [...activeLocal];
    if (data?.setting_value) {
      try {
        const cloudList = JSON.parse(data.setting_value) || [];
        const localMap = new Map(activeLocal.map(c => [c.id, c]));
        for (const cl of cloudList) {
          if (!localMap.has(cl.id)) {
            mergedList.push(cl);
          }
        }
      } catch (_) {}
    }

    await supabase.from('settings').upsert({
      setting_key: getScopedSettingKey('app_contracts'),
      setting_value: JSON.stringify(mergedList),
      updated_at: new Date().toISOString()
    });

    broadcastSyncEvent('contracts');
  } catch (err) {
    console.warn('pushContractLive warning:', err);
  }
}

export async function pullContractsLive(triggerEvent = true) {
  if (!navigator.onLine || !db.contracts) return [];
  const ctx = getActiveWorkspaceContext();
  if (!ctx.userId && !ctx.isLegacyOwner) return [];

  try {
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_contracts'))
      .maybeSingle();

    if (data?.setting_value) {
      const cloudContracts = JSON.parse(data.setting_value);
      if (Array.isArray(cloudContracts)) {
        await db.transaction('rw', db.contracts, async () => {
          for (const ctr of cloudContracts) {
            if (!ctr.id) continue;
            const existing = await db.contracts.get(ctr.id);
            if (!existing || new Date(ctr.updatedAt || ctr.createdAt || 0) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
              await db.contracts.put(ctr);
            }
          }
        });

        if (triggerEvent && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('workshop-contracts-sync'));
        }
        return cloudContracts;
      }
    }
  } catch (err) {
    console.warn('pullContractsLive warning:', err);
  }
  return [];
}

export async function deleteContractLive(contractId) {
  if (!contractId || !db.contracts) return;
  try {
    const existing = await db.contracts.get(contractId);
    if (existing) {
      const updated = { ...existing, status: 'deleted', deletedAt: new Date().toISOString() };
      await db.contracts.put(updated);
    }

    if (!navigator.onLine) return;
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', getScopedSettingKey('app_contracts'))
      .maybeSingle();

    if (data?.setting_value) {
      try {
        let cloudList = JSON.parse(data.setting_value) || [];
        cloudList = cloudList.filter(c => c.id !== contractId);
        await supabase.from('settings').upsert({
          setting_key: getScopedSettingKey('app_contracts'),
          setting_value: JSON.stringify(cloudList),
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    broadcastSyncEvent('contracts');
  } catch (err) {
    console.warn('deleteContractLive warning:', err);
  }
}
