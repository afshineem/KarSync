import { createClient } from '@supabase/supabase-js';
import { db, getAttendanceLogId, cleanupDuplicateAttendanceLogs, purgeDummySeedWorkers, DEFAULT_PROJECT_ID } from '../db/db';
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

const PENDING_DELETED_WORKERS_KEY = 'workshop_pending_deleted_workers';
const PENDING_DELETED_LOGS_KEY = 'workshop_pending_deleted_logs';
const PENDING_DELETED_PAYMENTS_KEY = 'workshop_pending_deleted_payments';
const PENDING_DELETED_PROJECTS_KEY = 'workshop_pending_deleted_projects';
const PENDING_DELETED_SECTIONS_KEY = 'workshop_pending_deleted_sections';

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

// Proactively clear any stale pending deletion locks for Afshin (id_mu5ywbpj_phobsou) on module load
try {
  if (typeof localStorage !== 'undefined') {
    clearPendingWorkerDeletion('id_mu5ywbpj_phobsou');
    const logsList = JSON.parse(localStorage.getItem(PENDING_DELETED_LOGS_KEY) || '[]')
      .filter(id => !id.includes('id_mu5ywbpj_phobsou'));
    localStorage.setItem(PENDING_DELETED_LOGS_KEY, JSON.stringify(logsList));
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
  await pullProjectsLive();
  await pullProjectSectionsLive();
  await pushAllProjectsAndSectionsLive();
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
      if (w.deleted_at) {
        await db.workers.delete(w.id);
        await db.attendanceLogs.where('workerId').equals(w.id).delete();
      } else {
        // Cloud worker is active: clear any stale local pending deletion
        if (pendingWorkers.has(w.id)) {
          clearPendingWorkerDeletion(w.id);
          pendingWorkers.delete(w.id);
        }

        await db.workers.put({
          id: w.id,
          name: w.name,
          phone: w.phone || '',
          role: w.role,
          dailyRate: Number(w.daily_rate) || 0,
          overtimeHourlyRate: Number(w.overtime_hourly_rate) || 0,
          isActive: Number(w.is_active) === 0 ? 0 : 1,
          projectId: w.project_id || w.projectId || DEFAULT_PROJECT_ID,
          userId: w.user_id || w.userId || 'default_user',
          createdAt: w.created_at,
          updatedAt: w.updated_at
        });
      }
    }

    // 2. Reconcile Attendance Logs
    const dedupedLogsMap = new Map();

    for (const l of cloudLogs) {
      if (l.deleted_at) {
        await db.attendanceLogs.delete(l.id);
        const canonicalId = getAttendanceLogId(l.worker_id, l.date);
        await db.attendanceLogs.delete(canonicalId);
        continue;
      }

      // Cloud log is active: clear any stale local pending deletion
      if (pendingLogs.has(l.id)) {
        clearPendingLogDeletion(l.id);
        pendingLogs.delete(l.id);
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

      let sectionId = l.section_id || null;
      let projectId = l.project_id || l.projectId || DEFAULT_PROJECT_ID;
      let cleanNotes = l.notes || '';
      if (cleanNotes.includes('__META__')) {
        const parts = cleanNotes.split('__META__');
        if (parts.length >= 3) {
          try {
            const meta = JSON.parse(parts[1]);
            if (meta.s) sectionId = meta.s;
            if (meta.p) projectId = meta.p;
            cleanNotes = parts.slice(2).join('').trim();
          } catch (_) {}
        }
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
        userId: l.user_id || l.userId || 'default_user',
        createdAt: l.created_at,
        updatedAt: l.updated_at
      });
    }

    // 3. Proactively push any local workers that don't exist in cloud yet (safety check, never delete!)
    if (cloudWorkers.length > 0) {
      const cloudWorkerIds = new Set(cloudWorkers.map(w => w.id));
      const localWorkers = await db.workers.toArray();
      for (const lw of localWorkers) {
        if (!cloudWorkerIds.has(lw.id)) {
          pushWorkerLive(lw).catch(console.warn);
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
            projectId: w.project_id || w.projectId || DEFAULT_PROJECT_ID,
            userId: w.user_id || w.userId || 'default_user',
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
          let sectionId = l.section_id || null;
          let projectId = l.project_id || l.projectId || DEFAULT_PROJECT_ID;
          let cleanNotes = l.notes || '';
          if (cleanNotes.includes('__META__')) {
            const parts = cleanNotes.split('__META__');
            if (parts.length >= 3) {
              try {
                const meta = JSON.parse(parts[1]);
                if (meta.s) sectionId = meta.s;
                if (meta.p) projectId = meta.p;
                cleanNotes = parts.slice(2).join('').trim();
              } catch (_) {}
            }
          }

          await db.attendanceLogs.put({
            id: l.id,
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
            userId: l.user_id || l.userId || 'default_user',
            createdAt: l.created_at,
            updatedAt: l.updated_at
          });
        }
      }
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
    })
    .on('broadcast', { event: 'workshop_sync' }, async ({ payload }) => {
      console.log('⚡ Realtime Broadcast received:', payload);
      const syncType = payload?.type;
      if (syncType === 'projects' || syncType === 'all') {
        await pullProjectsLive();
        await pullProjectSectionsLive();
      } else if (syncType === 'sections') {
        await pullProjectSectionsLive();
      } else if (syncType === 'payments') {
        await pullPaymentsLive();
      } else {
        await pullProjectsLive();
        await pullProjectSectionsLive();
        await pullPaymentsLive();
      }
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
      window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async (payload) => {
      console.log('⚡ Realtime Settings Change received:', payload.eventType, payload);
      await pullPaymentsLive();
      await pullProjectsLive();
      await pullProjectSectionsLive();
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
      window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async (payload) => {
      console.log('⚡ Realtime Project Change received:', payload.eventType, payload);
      if (payload.eventType === 'DELETE') {
        const idToDelete = payload.old?.id;
        if (idToDelete) await db.projects.delete(idToDelete);
      } else if (payload.new) {
        const p = payload.new;
        await db.projects.put({
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
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
      window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_sections' }, async (payload) => {
      console.log('⚡ Realtime Project Section Change received:', payload.eventType, payload);
      if (payload.eventType === 'DELETE') {
        const idToDelete = payload.old?.id;
        if (idToDelete) await db.projectSections.delete(idToDelete);
      } else if (payload.new) {
        const s = payload.new;
        await db.projectSections.put({
          id: s.id,
          projectId: s.project_id || s.projectId,
          userId: s.user_id || s.userId,
          name: s.name,
          status: s.status || 'active',
          createdAt: s.created_at,
          updatedAt: s.updated_at
        });
      }
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
      window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
    })
    .subscribe((status) => {
      console.log('📡 Supabase WebSocket channel status:', status);
    });
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
      payload: { type, timestamp: Date.now(), ...extra }
    });
  } catch (err) {
    console.warn('Could not send realtime broadcast:', err);
  }
}

/**
 * Pull projects from Supabase settings with safe merge
 */
export async function pullProjectsLive() {
  if (!navigator.onLine) return;
  try {
    let projectsData = [];
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_projects')
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        projectsData = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    if (Array.isArray(projectsData) && projectsData.length > 0) {
      const pendingDeleted = new Set(getPendingDeletedProjects());
      const validCloudProjects = projectsData.filter(p => !pendingDeleted.has(p.id));

      await db.transaction('rw', db.projects, async () => {
        for (const p of validCloudProjects) {
          await db.projects.put({
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
      });
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
      window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
    }
  } catch (err) {
    console.warn('pullProjectsLive warning:', err);
  }
}

/**
 * Push an individual project or all projects to Supabase settings with safe cloud merge
 */
export async function pushProjectLive(p) {
  if (!navigator.onLine) return;
  try {
    const localProjects = await db.projects.toArray();
    const pendingDeleted = new Set(getPendingDeletedProjects());
    const filteredLocal = localProjects.filter(prj => !pendingDeleted.has(prj.id));

    // Fetch latest cloud projects to merge safely
    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_projects')
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
      setting_key: 'app_projects',
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
      .eq('setting_key', 'app_projects')
      .maybeSingle();

    let projects = [];
    if (data?.setting_value) {
      try {
        projects = JSON.parse(data.setting_value) || [];
      } catch (_) {}
    }

    const filtered = projects.filter(p => p.id !== projectId);
    await supabase.from('settings').upsert({
      setting_key: 'app_projects',
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

/**
 * Pull project sections from Supabase settings
 */
export async function pullProjectSectionsLive() {
  if (!navigator.onLine) return;
  try {
    let sectionsData = [];
    const { data: sData, error: sErr } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_project_sections')
      .maybeSingle();

    if (!sErr && sData?.setting_value) {
      try {
        sectionsData = JSON.parse(sData.setting_value);
      } catch (_) {}
    }

    if (Array.isArray(sectionsData) && sectionsData.length > 0) {
      const pendingDeleted = new Set(getPendingDeletedSections());
      const validCloudSections = sectionsData.filter(s => !pendingDeleted.has(s.id));

      await db.transaction('rw', db.projectSections, async () => {
        for (const s of validCloudSections) {
          await db.projectSections.put({
            id: s.id,
            projectId: s.project_id || s.projectId,
            userId: s.user_id || s.userId || 'default_user',
            name: s.name,
            status: s.status || 'active',
            createdAt: s.created_at || s.createdAt,
            updatedAt: s.updated_at || s.updatedAt
          });
        }
      });
      window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
      window.dispatchEvent(new CustomEvent('workshop-projects-sync'));
    }
  } catch (err) {
    console.warn('pullProjectSectionsLive warning:', err);
  }
}

/**
 * Push an individual project section to Supabase with safe merge
 */
export async function pushProjectSectionLive(s) {
  if (!navigator.onLine) return;
  try {
    const localSections = await db.projectSections.toArray();
    const pendingDeleted = new Set(getPendingDeletedSections());
    const filteredLocal = localSections.filter(sec => !pendingDeleted.has(sec.id));

    const { data } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'app_project_sections')
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
      setting_key: 'app_project_sections',
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
      .eq('setting_key', 'app_project_sections')
      .maybeSingle();

    let sections = [];
    if (data?.setting_value) {
      try {
        sections = JSON.parse(data.setting_value) || [];
      } catch (_) {}
    }

    const filtered = sections.filter(sec => sec.id !== sectionId);
    await supabase.from('settings').upsert({
      setting_key: 'app_project_sections',
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
  await pullProjectsLive();
  await pullProjectSectionsLive();
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

  const payload = logs.map(l => {
    let cleanNotes = (l.notes || '').trim();
    if (l.sectionId || (l.projectId && l.projectId !== DEFAULT_PROJECT_ID)) {
      const meta = {};
      if (l.sectionId) meta.s = l.sectionId;
      if (l.projectId && l.projectId !== DEFAULT_PROJECT_ID) meta.p = l.projectId;
      const metaStr = `__META__${JSON.stringify(meta)}__META__`;
      if (!cleanNotes.includes('__META__')) {
        cleanNotes = metaStr + (cleanNotes ? '\n' + cleanNotes : '');
      }
    }

    return {
      id: getAttendanceLogId(l.workerId, l.date),
      worker_id: l.workerId,
      date: l.date,
      type: l.type || 'full',
      overtime_hours: Number(l.overtimeHours) || 0,
      calculated_daily_wage: roundCurrency(l.calculatedDailyWage, l.currency),
      calculated_overtime_wage: roundCurrency(l.calculatedOvertimeWage, l.currency),
      total_day_pay: roundCurrency(l.totalDayPay, l.currency),
      notes: cleanNotes || null,
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
  if (!navigator.onLine) return;

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
 * Push a batch of workers immediately to Supabase
 */
export async function pushWorkersLive(workers) {
  if (!workers || workers.length === 0) return;
  workers.forEach(w => clearPendingWorkerDeletion(w.id));
  if (!navigator.onLine) return;

  const payload = workers.map(w => ({
    id: w.id,
    name: w.name,
    phone: w.phone || null,
    role: w.role,
    daily_rate: Number(w.dailyRate) || 0,
    overtime_hourly_rate: Number(w.overtimeHourlyRate) || 0,
    is_active: Number(w.isActive) === 0 ? 0 : 1,
    deleted_at: null,
    updated_at: new Date().toISOString()
  }));

  try {
    const { error } = await supabase.from('workers').upsert(payload);
    if (error) console.error('Error live-pushing workers to Supabase:', error);
  } catch (err) {
    console.error('Live-push workers failed:', err);
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

    const mergedList = Array.from(mergedMap.values()).map(p => ({
      ...p,
      amount: roundCurrency(p.amount, p.currency)
    }));

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
            await db.payments.put({
              ...p,
              projectId: p.projectId || p.project_id || DEFAULT_PROJECT_ID,
              userId: p.userId || p.user_id || 'default_user',
              amount: roundCurrency(p.amount, p.currency)
            });
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
  await pullProjectsLive();
  await pullProjectSectionsLive();
  await pushAllLocalToCloud();
  await pushPaymentsLive();
}
