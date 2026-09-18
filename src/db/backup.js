import { db, seedInitialDataIfEmpty } from './db';

/**
 * Exports all data from IndexedDB into a formatted JSON string and triggers download
 */
export async function exportDatabaseToJSON() {
  const workers = await db.workers.toArray();
  const attendanceLogs = await db.attendanceLogs.toArray();
  const settings = await db.settings.toArray();

  const backupData = {
    version: 1,
    appName: 'Workshop Attendance & Payroll PWA',
    exportedAt: new Date().toISOString(),
    currency: 'IQD',
    data: {
      workers,
      attendanceLogs,
      settings
    }
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(backupData, null, 2)
  )}`;

  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `workshop_backup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  return backupData;
}

/**
 * Validates and imports JSON backup into IndexedDB
 * @param {string} jsonText - The raw JSON string
 * @param {'replace'|'merge'} mode - 'replace' clears existing, 'merge' adds/updates
 */
export async function importDatabaseFromJSON(jsonText, mode = 'replace') {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error('Invalid JSON format / فۆرماتی فایلەکە نادروستە / فرمت فایل نامعتبر است');
  }

  if (!parsed.data || !Array.isArray(parsed.data.workers)) {
    throw new Error('Invalid backup schema / داتای یەدەگ نادروستە / ساختار فایل پشتیبان صحیح نیست');
  }

  const { workers, attendanceLogs = [], settings = [] } = parsed.data;

  if (mode === 'replace') {
    await db.transaction('rw', db.workers, db.attendanceLogs, db.settings, async () => {
      await db.workers.clear();
      await db.attendanceLogs.clear();
      await db.settings.clear();

      if (workers.length > 0) await db.workers.bulkPut(workers);
      if (attendanceLogs.length > 0) await db.attendanceLogs.bulkPut(attendanceLogs);
      if (settings.length > 0) await db.settings.bulkPut(settings);
    });
  } else {
    // Merge mode
    await db.transaction('rw', db.workers, db.attendanceLogs, db.settings, async () => {
      if (workers.length > 0) await db.workers.bulkPut(workers);
      if (attendanceLogs.length > 0) await db.attendanceLogs.bulkPut(attendanceLogs);
      if (settings.length > 0) await db.settings.bulkPut(settings);
    });
  }

  return {
    workersCount: workers.length,
    logsCount: attendanceLogs.length
  };
}

/**
 * Clear all data and re-seed
 */
export async function resetDatabaseWithSeed() {
  await db.workers.clear();
  await db.attendanceLogs.clear();
  await db.settings.clear();
  await seedInitialDataIfEmpty();
}
