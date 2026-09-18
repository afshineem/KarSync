import { createClient } from '@supabase/supabase-js';
import { db, getAttendanceLogId, cleanupDuplicateAttendanceLogs, purgeDummySeedWorkers } from '../db/db';
import { getSyncConfig, saveSyncConfig, setLastSyncTime } from './syncService';

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

/**
 * Initialize Realtime Sync:
 * 1. Seed or Reconcile local and cloud data on startup
 * 2. Subscribe to Postgres Realtime changes via WebSockets
 * 3. Start background safety-net polling
 */
export async function initRealtimeSync() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('🔄 Initializing Supabase Realtime Sync...');

  try {
    await purgeDummySeedWorkers();
    await cleanupDuplicateAttendanceLogs();
    await autoInitialSync();
  } catch (err) {
    console.warn('Initial sync deferred (offline or connection issue):', err.message);
  }

  // Subscribe to Realtime WebSocket changes
  subscribeToRealtime();

  // Background polling every 12 seconds as a rock-solid fallback
  setInterval(() => {
    if (navigator.onLine) {
      pullRemoteChangesSilently().catch(() => {});
    }
  }, 12000);

  // Sync automatically when browser comes back online
  window.addEventListener('online', () => {
    console.log('🌐 Internet connection restored. Syncing with Supabase...');
    fullSyncBothDirections().catch(() => {});
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
}

/**
 * Reconcile Supabase cloud rows into Dexie local database with automatic deduplication
 */
export async function reconcileCloudIntoLocal(cloudWorkers, cloudLogs) {
  const duplicateIdsToDeleteFromCloud = [];

  await purgeDummySeedWorkers();

  await db.transaction('rw', [db.workers, db.attendanceLogs], async () => {
    for (const w of cloudWorkers) {
      if (w.deleted_at) {
        await db.workers.delete(w.id);
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

    // Deduplicate cloud logs by worker_id + date
    const dedupedLogsMap = new Map();

    for (const l of cloudLogs) {
      if (l.deleted_at) {
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
  });

  if (duplicateIdsToDeleteFromCloud.length > 0) {
    supabase.from('attendance_logs').delete().in('id', duplicateIdsToDeleteFromCloud).catch(() => {});
  }

  const now = new Date().toISOString();
  setLastSyncTime(now);
  window.dispatchEvent(new CustomEvent('workshop-sync-complete', { detail: { time: now } }));
}

/**
 * Push all local data into Supabase
 */
export async function pushAllLocalToCloud() {
  const localWorkers = await db.workers.toArray();
  const localLogs = await db.attendanceLogs.toArray();

  if (localWorkers.length > 0) {
    const workerPayload = localWorkers.map(w => ({
      id: w.id,
      name: w.name,
      phone: w.phone || null,
      role: w.role,
      daily_rate: Number(w.dailyRate) || 0,
      overtime_hourly_rate: Number(w.overtimeHourlyRate) || 0,
      is_active: Number(w.isActive) === 0 ? 0 : 1,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('workers').upsert(workerPayload);
    if (error) console.error('Error uploading local workers to Supabase:', error);
  }

  if (localLogs.length > 0) {
    const logPayload = localLogs.map(l => ({
      id: l.id,
      worker_id: l.workerId,
      date: l.date,
      type: l.type || 'full',
      overtime_hours: Number(l.overtimeHours) || 0,
      calculated_daily_wage: Number(l.calculatedDailyWage) || 0,
      calculated_overtime_wage: Number(l.calculatedOvertimeWage) || 0,
      total_day_pay: Number(l.totalDayPay) || 0,
      notes: l.notes || null,
      updated_at: new Date().toISOString()
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
      console.log('⚡ Realtime Worker Change received:', payload.eventType);
      if (payload.eventType === 'DELETE' || payload.new?.deleted_at) {
        const idToDelete = payload.old?.id || payload.new?.id;
        if (idToDelete) await db.workers.delete(idToDelete);
      } else if (payload.new) {
        const w = payload.new;
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
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, async (payload) => {
      console.log('⚡ Realtime Attendance Log Change received:', payload.eventType);
      if (payload.eventType === 'DELETE' || payload.new?.deleted_at) {
        const idToDelete = payload.old?.id || payload.new?.id;
        if (idToDelete) await db.attendanceLogs.delete(idToDelete);
      } else if (payload.new) {
        const l = payload.new;
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
  if (!logId || !navigator.onLine) return;
  try {
    await supabase.from('attendance_logs').delete().eq('id', logId);
  } catch (err) {
    console.error('Live-delete log failed:', err);
  }
}

/**
 * Delete a worker live from Supabase
 */
export async function deleteWorkerLive(workerId) {
  if (!workerId || !navigator.onLine) return;
  try {
    await supabase.from('workers').delete().eq('id', workerId);
  } catch (err) {
    console.error('Live-delete worker failed:', err);
  }
}

/**
 * Full two-way sync
 */
export async function fullSyncBothDirections() {
  await pushAllLocalToCloud();
  await pullRemoteChangesSilently();
}
