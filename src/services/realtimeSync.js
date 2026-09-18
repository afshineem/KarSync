import { createClient } from '@supabase/supabase-js';
import { db, getAttendanceLogId, cleanupDuplicateAttendanceLogs, purgeDummySeedWorkers } from '../db/db';
import { getSyncConfig, saveSyncConfig, setLastSyncTime, getLastSyncTime } from './syncService';

const SUPABASE_URL = 'https://akeferuiyijsmgmjqnqc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

let isInitialized = false;
let realtimeChannel = null;

const PENDING_DELETED_WORKERS_KEY = 'workshop_pending_deleted_workers';
const PENDING_DELETED_LOGS_KEY = 'workshop_pending_deleted_logs';
const PENDING_DELETED_PAYMENTS_KEY = 'workshop_pending_deleted_payments';

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
    } catch (err) {
      console.warn('Flush worker deletion warning:', workerId, err);
    }
  }

  // Flush pending deleted logs
  const pendingLogs = getPendingDeletedLogs();
  for (const logId of pendingLogs) {
    try {
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

  const [wRes, lRes] = await Promise.all([
    supabase.from('workers').select('*'),
    supabase.from('attendance_logs').select('*')
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

  // Case A: Cloud is empty but local has data -> Push local data to cloud
  if (cloudWorkers.length === 0 && localWorkers.length > 0) {
    console.log('📤 Cloud is newly initialized. Pushing all existing local data to Supabase...');
    await Promise.all([
      pushWorkersLive(localWorkers),
      pushLogsLive(localLogs)
    ]);
    return;
  }

  // Case B: Reconcile Cloud data into local IndexedDB
  await reconcileCloudIntoLocal(cloudWorkers, cloudLogs);
  await pullPaymentsLive();
}

/**
 * Reconcile Supabase cloud rows into Dexie local database with automatic deduplication
 */
export async function reconcileCloudIntoLocal(cloudWorkers, cloudLogs) {
  const duplicateIdsToDeleteFromCloud = [];
  const pendingWorkers = new Set(getPendingDeletedWorkers());
  const pendingLogs = new Set(getPendingDeletedLogs());

  await purgeDummySeedWorkers();

  await db.transaction('rw', [db.workers, db.attendanceLogs], async () => {
    // 1. Reconcile Workers
    for (const w of cloudWorkers) {
      if (w.deleted_at || pendingWorkers.has(w.id)) {
        await db.workers.delete(w.id);
        await db.attendanceLogs.where('workerId').equals(w.id).delete();
      } else {
        await db.workers.put({
          id: w.id,
          name: w.name,
          phone: w.phone || '',
          role: w.role,
          dailyRate: Number(w.daily_rate) || 0,
          overtimeHourlyRate: Number(w.overtime_hourly_rate) || 0,
          isActive: Number(w.is_active) === 0 ? 0 : 1,
          createdAt: w.created_at,
          updatedAt: w.updated_at
        });
      }
    }

    // 2. Reconcile Attendance Logs
    const dedupedLogsMap = new Map();

    for (const l of cloudLogs) {
      if (l.deleted_at || pendingLogs.has(l.id)) {
        await db.attendanceLogs.delete(l.id);
        const canonicalId = getAttendanceLogId(l.worker_id, l.date);
        await db.attendanceLogs.delete(canonicalId);
        continue;
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
      await db.attendanceLogs.put({
        id: canonicalId,
        workerId: l.worker_id,
        date: l.date,
        type: l.type,
        overtimeHours: Number(l.overtime_hours) || 0,
        calculatedDailyWage: Number(l.calculated_daily_wage) || 0,
        calculatedOvertimeWage: Number(l.calculated_overtime_wage) || 0,
        totalDayPay: Number(l.total_day_pay) || 0,
        notes: l.notes || '',
        createdAt: l.created_at,
        updatedAt: l.updated_at
      });
    }

    // 3. Remove any local workers that were hard-deleted from cloud
    const lastSync = getLastSyncTime();
    if (lastSync && cloudWorkers.length > 0) {
      const cloudWorkerIds = new Set(cloudWorkers.map(w => w.id));
      const localWorkers = await db.workers.toArray();
      for (const lw of localWorkers) {
        if (!cloudWorkerIds.has(lw.id) && lw.createdAt && lw.createdAt < lastSync) {
          await db.workers.delete(lw.id);
          await db.attendanceLogs.where('workerId').equals(lw.id).delete();
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
    const workerPayload = activeWorkers.map(w => ({
      id: w.id,
      name: w.name,
      phone: w.phone || null,
      role: w.role,
      daily_rate: Number(w.dailyRate) || 0,
      overtime_hourly_rate: Number(w.overtimeHourlyRate) || 0,
      is_active: Number(w.isActive) === 0 ? 0 : 1,
      deleted_at: null,
      updated_at: w.updatedAt || new Date().toISOString()
    }));

    const { error } = await supabase.from('workers').upsert(workerPayload);
    if (error) console.error('Error uploading local workers to Supabase:', error);
  }

  if (activeLogs.length > 0) {
    const logPayload = activeLogs.map(l => ({
      id: getAttendanceLogId(l.workerId, l.date),
      worker_id: l.workerId,
      date: l.date,
      type: l.type || 'full',
      overtime_hours: Number(l.overtimeHours) || 0,
      calculated_daily_wage: Number(l.calculatedDailyWage) || 0,
      calculated_overtime_wage: Number(l.calculatedOvertimeWage) || 0,
      total_day_pay: Number(l.totalDayPay) || 0,
      notes: l.notes || null,
      deleted_at: null,
      updated_at: l.updatedAt || new Date().toISOString()
    }));

    const { error } = await supabase.from('attendance_logs').upsert(logPayload);
    if (error) console.error('Error uploading local logs to Supabase:', error);
  }

  const now = new Date().toISOString();
  setLastSyncTime(now);
  console.log('✅ Local data uploaded to Supabase successfully!');
}

/**
 * Subscribe to WebSocket changes in real time
 */
function subscribeToRealtime() {
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
          await db.attendanceLogs.where('workerId').equals(idToDelete).delete();
        }
      } else if (payload.new) {
        const w = payload.new;
        if (w.deleted_at) {
          await db.workers.delete(w.id);
          await db.attendanceLogs.where('workerId').equals(w.id).delete();
        } else {
          await db.workers.put({
            id: w.id,
            name: w.name,
            phone: w.phone || '',
            role: w.role,
            dailyRate: Number(w.daily_rate) || 0,
            overtimeHourlyRate: Number(w.overtime_hourly_rate) || 0,
            isActive: Number(w.is_active) === 0 ? 0 : 1,
            createdAt: w.created_at,
            updatedAt: w.updated_at
          });
        }
      }
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, async (payload) => {
      console.log('⚡ Realtime Attendance Log Change received:', payload.eventType, payload);
      if (payload.eventType === 'DELETE' || payload.new?.deleted_at) {
        const idToDelete = payload.new?.id || payload.old?.id;
        if (idToDelete) {
          await db.attendanceLogs.delete(idToDelete);
        }
      } else if (payload.new) {
        const l = payload.new;
        if (l.deleted_at) {
          await db.attendanceLogs.delete(l.id);
        } else {
          await db.attendanceLogs.put({
            id: l.id,
            workerId: l.worker_id,
            date: l.date,
            type: l.type,
            overtimeHours: Number(l.overtime_hours) || 0,
            calculatedDailyWage: Number(l.calculated_daily_wage) || 0,
            calculatedOvertimeWage: Number(l.calculated_overtime_wage) || 0,
            totalDayPay: Number(l.total_day_pay) || 0,
            notes: l.notes || '',
            createdAt: l.created_at,
            updatedAt: l.updated_at
          });
        }
      }
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async (payload) => {
      console.log('⚡ Realtime Settings/Payments Change received:', payload.eventType, payload);
      await pullPaymentsLive();
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
    })
    .subscribe((status) => {
      console.log('📡 Supabase WebSocket channel status:', status);
    });
}

/**
 * Background silent pull
 */
async function pullRemoteChangesSilently() {
  const [wRes, lRes] = await Promise.all([
    supabase.from('workers').select('*'),
    supabase.from('attendance_logs').select('*')
  ]);

  if (!wRes.error && !lRes.error && (wRes.data || lRes.data)) {
    await reconcileCloudIntoLocal(wRes.data || [], lRes.data || []);
  }
  await pullPaymentsLive();
}

/**
 * Push an individual or batch of logs immediately to Supabase
 */
export async function pushLogsLive(logs) {
  if (!logs || logs.length === 0) return;
  if (!navigator.onLine) return;

  const payload = logs.map(l => ({
    id: getAttendanceLogId(l.workerId, l.date),
    worker_id: l.workerId,
    date: l.date,
    type: l.type || 'full',
    overtime_hours: Number(l.overtimeHours) || 0,
    calculated_daily_wage: Number(l.calculatedDailyWage) || 0,
    calculated_overtime_wage: Number(l.calculatedOvertimeWage) || 0,
    total_day_pay: Number(l.totalDayPay) || 0,
    notes: l.notes || null,
    deleted_at: null,
    updated_at: new Date().toISOString()
  }));

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
  if (!w || !navigator.onLine) return;

  const payload = {
    id: w.id,
    name: w.name,
    phone: w.phone || null,
    role: w.role,
    daily_rate: Number(w.dailyRate) || 0,
    overtime_hourly_rate: Number(w.overtimeHourlyRate) || 0,
    is_active: Number(w.isActive) === 0 ? 0 : 1,
    deleted_at: null,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('workers').upsert(payload);
    if (error) console.error('Error live-pushing worker to Supabase:', error);
  } catch (err) {
    console.error('Live-push worker failed:', err);
  }
}

/**
 * Delete a log live from Supabase
 */
export async function deleteLogLive(logId) {
  if (!logId) return;
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
  if (!navigator.onLine) return;
  try {
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from('workers').update({ deleted_at: now, updated_at: now }).eq('id', workerId),
      supabase.from('attendance_logs').update({ deleted_at: now, updated_at: now }).eq('worker_id', workerId)
    ]);
    clearPendingWorkerDeletion(workerId);
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
    const localPayments = await db.payments.toArray();
    const pendingDeleted = new Set(getPendingDeletedPayments());
    const filteredLocal = localPayments.filter(p => !pendingDeleted.has(p.id));

    // Fetch latest cloud payments to safely merge
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_payments')
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

    const mergedList = Array.from(mergedMap.values());

    await supabase.from('settings').upsert({
      setting_key: 'app_payments',
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

/**
 * Pull cloud payments from Supabase settings and update local Dexie
 */
export async function pullPaymentsLive() {
  if (!navigator.onLine) return;
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_payments')
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
        const validCloudPayments = cloudPayments.filter(p => !pendingDeleted.has(p.id));
        const validCloudIds = new Set(validCloudPayments.map(p => p.id));

        await db.transaction('rw', db.payments, async () => {
          for (const p of validCloudPayments) {
            await db.payments.put(p);
          }
          // If cloud has a populated list, remove any local records that were deleted remotely
          if (validCloudPayments.length > 0) {
            const localPayments = await db.payments.toArray();
            for (const lp of localPayments) {
              if (pendingDeleted.has(lp.id) || !validCloudIds.has(lp.id)) {
                await db.payments.delete(lp.id);
              }
            }
          }
        });

        window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
      }
    }
  } catch (err) {
    console.warn('Could not pull payments from Supabase:', err);
  }
}

/**
 * Full two-way sync:
 * Always flush pending local deletions FIRST, pull remote cloud changes SECOND, and push active local changes THIRD.
 */
export async function fullSyncBothDirections() {
  await flushPendingDeletions();
  await pullRemoteChangesSilently();
  await pullPaymentsLive();
  await pushAllLocalToCloud();
  await pushPaymentsLive();
}
