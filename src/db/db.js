import Dexie from 'dexie';

export const db = new Dexie('WorkshopAttendanceDB');

// Define tables and indexes
db.version(1).stores({
  workers: 'id, name, role, isActive, createdAt',
  attendanceLogs: 'id, workerId, date, type, [workerId+date]',
  settings: 'key'
});

db.version(2).stores({
  payments: 'id, workerId, date, month, type, status, createdAt'
});

// Helper to generate UUIDs
export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

// Helper to generate Payment / Settlement IDs
export function generatePaymentId() {
  return 'pay_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Canonical deterministic ID for attendance logs to prevent duplicate entries per worker per day
export function getAttendanceLogId(workerId, date) {
  return `att_${workerId}_${date}`;
}

// Purge any legacy dummy seed workers (Aras, Karwan, Hemin, Rebin)
export async function purgeDummySeedWorkers() {
  const dummyIds = ['w_1', 'w_2', 'w_3', 'w_4'];
  try {
    for (const id of dummyIds) {
      await db.workers.delete(id);
      await db.attendanceLogs.where('workerId').equals(id).delete();
    }
    const allWorkers = await db.workers.toArray();
    for (const w of allWorkers) {
      const name = w.name || '';
      if (
        name.includes('Aras') || 
        name.includes('Karwan') || 
        name.includes('Hemin') || 
        name.includes('Rebin') ||
        name.includes('ئاراس') ||
        name.includes('کاروان') ||
        name.includes('هێمن') ||
        name.includes('ڕێبین')
      ) {
        await db.workers.delete(w.id);
        await db.attendanceLogs.where('workerId').equals(w.id).delete();
      }
    }
  } catch (err) {
    console.warn('purgeDummySeedWorkers warning:', err);
  }
}

// Seed initial settings only (NO fake or dummy workers or logs)
export async function seedInitialDataIfEmpty() {
  await purgeDummySeedWorkers();

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkAdd([
      { key: 'workshop_name', value: 'کارگەی ئاسنگەری و دارتاشی (Central Workshop)' },
      { key: 'default_currency', value: 'IQD' },
      { key: 'language', value: 'ku' }
    ]);
  }
}

/**
 * Automatically cleans up any duplicate attendance logs for the same (workerId, date)
 * Ensures each worker has strictly at most ONE attendance record per date.
 */
export async function cleanupDuplicateAttendanceLogs() {
  try {
    const allLogs = await db.attendanceLogs.toArray();
    const grouped = {};
    allLogs.forEach((l) => {
      const key = `${l.workerId}_${l.date}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(l);
    });

    const toDeleteIds = [];
    const toPut = [];

    for (const key of Object.keys(grouped)) {
      const list = grouped[key];
      const parts = key.split('_');
      // In case workerId contains underscores, extract date as the last 10 characters (YYYY-MM-DD)
      const date = list[0].date;
      const workerId = list[0].workerId;
      const canonicalId = getAttendanceLogId(workerId, date);

      // Sort by updatedAt/createdAt descending
      list.sort((a, b) => {
        const timeA = a.updatedAt || a.createdAt || '';
        const timeB = b.updatedAt || b.createdAt || '';
        return timeB.localeCompare(timeA);
      });

      const winner = list[0];
      toPut.push({
        ...winner,
        id: canonicalId
      });

      // Mark obsolete IDs for deletion
      if (winner.id !== canonicalId) {
        toDeleteIds.push(winner.id);
      }
      for (let i = 1; i < list.length; i++) {
        if (list[i].id !== canonicalId) {
          toDeleteIds.push(list[i].id);
        }
      }
    }

    if (toDeleteIds.length > 0) {
      await db.attendanceLogs.bulkDelete(toDeleteIds);
      console.log(`🧹 Cleaned up ${toDeleteIds.length} duplicate/obsolete attendance logs from IndexedDB.`);
    }

    if (toPut.length > 0) {
      await db.attendanceLogs.bulkPut(toPut);
    }

    return { cleaned: toDeleteIds.length };
  } catch (err) {
    console.error('Error in cleanupDuplicateAttendanceLogs:', err);
    return { error: err.message };
  }
}
