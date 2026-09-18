import Dexie from 'dexie';

export const db = new Dexie('WorkshopAttendanceDB');

// Define tables and indexes
db.version(1).stores({
  workers: 'id, name, role, isActive, createdAt',
  attendanceLogs: 'id, workerId, date, type, [workerId+date]',
  settings: 'key'
});

// Helper to generate UUIDs
export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

// Canonical deterministic ID for attendance logs to prevent duplicate entries per worker per day
export function getAttendanceLogId(workerId, date) {
  return `att_${workerId}_${date}`;
}

// Seed initial realistic data if database is empty
export async function seedInitialDataIfEmpty() {
  const count = await db.workers.count();
  if (count > 0) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const initialWorkers = [
    {
      id: 'w_1',
      name: 'ئاراس ئەحمەد (Aras Ahmad)',
      phone: '07501234567',
      role: 'Master Craftsman / وەستای گشتی',
      dailyRate: 45000, // 45,000 IQD per day
      overtimeHourlyRate: 7000, // 7,000 IQD per hour
      isActive: 1,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'w_2',
      name: 'کاروان حوسێن (Karwan Husein)',
      phone: '07709876543',
      role: 'Welder / لەحیمچی',
      dailyRate: 35000,
      overtimeHourlyRate: 5500,
      isActive: 1,
      createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'w_3',
      name: 'هێمن مەحمود (Hemin Mahmud)',
      phone: '07504443322',
      role: 'Apprentice / یاریدەدەر',
      dailyRate: 25000,
      overtimeHourlyRate: 4000,
      isActive: 1,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'w_4',
      name: 'ڕێبین سالار (Rebin Salar)',
      phone: '07715556677',
      role: 'Technician / تەکنیککار',
      dailyRate: 38000,
      overtimeHourlyRate: 6000,
      isActive: 1,
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  await db.workers.bulkAdd(initialWorkers);

  // Generate some realistic sample attendance logs for the current month
  const initialLogs = [];
  const currentDay = Math.min(now.getDate(), 14);

  for (let d = 1; d <= currentDay; d++) {
    const dayStr = String(d).padStart(2, '0');
    const date = `${year}-${month}-${dayStr}`;

    // Skip Fridays (typical day off in workshop)
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 5) continue;

    initialWorkers.forEach((w, idx) => {
      // Vary attendance: some full days, some half days, some overtime
      let type = 'full';
      let ot = 0;
      let notes = 'کاری ئاسایی کارگە (Regular workshop tasks)';

      if ((d + idx) % 5 === 0) {
        type = 'half';
        notes = 'نیوەڕۆ دەوامی کرد (Half-day morning shift)';
      } else if ((d + idx) % 3 === 0) {
        ot = 2;
        notes = 'کاری زیادە بۆ تەواوکردنی پرۆژە (Overtime on custom project)';
      }

      const dailyRateFactor = type === 'half' ? 0.5 : 1.0;
      const basePay = Math.round(w.dailyRate * dailyRateFactor);
      const otPay = Math.round(ot * w.overtimeHourlyRate);

      initialLogs.push({
        id: generateId(),
        workerId: w.id,
        date: date,
        type: type,
        overtimeHours: ot,
        calculatedDailyWage: basePay,
        calculatedOvertimeWage: otPay,
        totalDayPay: basePay + otPay,
        notes: notes,
        createdAt: new Date(date).toISOString()
      });
    });
  }

  await db.attendanceLogs.bulkAdd(initialLogs);

  // Initial settings
  await db.settings.bulkAdd([
    { key: 'workshop_name', value: 'کارگەی ئاسنگەری و دارتاشی (Central Workshop)' },
    { key: 'default_currency', value: 'IQD' },
    { key: 'language', value: 'ku' }
  ]);
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
