import { db, seedInitialDataIfEmpty } from './db';
import { emitToast } from '../context/NotificationContext';

function getActiveLanguage() {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("workshop_lang") || "fa";
  }
  return "fa";
}

/**
 * Creates a comprehensive payload of all workspace tables from IndexedDB
 */
export async function createFullBackupPayload(meta = {}) {
  const [
    workers,
    attendanceLogs,
    settings,
    payments,
    projects,
    projectSections,
    groups,
    projectExpenses,
    expenseCategories,
    expenses,
    treasuryIncomes,
    financialAccounts,
    accountTransfers,
    counterparties
  ] = await Promise.all([
    db.workers ? db.workers.toArray() : [],
    db.attendanceLogs ? db.attendanceLogs.toArray() : [],
    db.settings ? db.settings.toArray() : [],
    db.payments ? db.payments.toArray() : [],
    db.projects ? db.projects.toArray() : [],
    db.projectSections ? db.projectSections.toArray() : [],
    db.groups ? db.groups.toArray() : [],
    db.projectExpenses ? db.projectExpenses.toArray() : [],
    db.expenseCategories ? db.expenseCategories.toArray() : [],
    db.expenses ? db.expenses.toArray() : [],
    db.treasuryIncomes ? db.treasuryIncomes.toArray() : [],
    db.financialAccounts ? db.financialAccounts.toArray() : [],
    db.accountTransfers ? db.accountTransfers.toArray() : [],
    db.counterparties ? db.counterparties.toArray() : []
  ]);

  const exportedAt = new Date().toISOString();
  const summary = {
    workersCount: workers.length,
    logsCount: attendanceLogs.length,
    paymentsCount: payments.length,
    expensesCount: expenses.length,
    projectsCount: projects.length,
    sectionsCount: projectSections.length,
    groupsCount: groups.length,
    categoriesCount: expenseCategories.length,
    accountsCount: financialAccounts.length,
    transfersCount: accountTransfers.length,
    counterpartiesCount: counterparties.length
  };

  return {
    version: 6,
    appName: 'KarSync',
    exportedAt,
    currency: 'IQD',
    summary,
    meta,
    data: {
      workers,
      attendanceLogs,
      settings,
      payments,
      projects,
      projectSections,
      groups,
      projectExpenses,
      expenseCategories,
      expenses,
      treasuryIncomes,
      financialAccounts,
      accountTransfers,
      counterparties
    }
  };
}

/**
 * Creates an internal Time-Machine snapshot in IndexedDB
 * @param {'auto'|'manual'|'settlement'|'export_file'} triggerType
 * @param {string} label
 */
export async function createAutoSnapshot(triggerType = 'auto', label = '') {
  const payload = await createFullBackupPayload({ triggerType, label });
  const jsonStr = JSON.stringify(payload);
  const dataSize = new Blob([jsonStr]).size;
  const id = 'snap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  const snapshot = {
    id,
    createdAt: payload.exportedAt,
    triggerType,
    label: label || (() => {
      const l = getActiveLanguage();
      if (triggerType === "auto") {
        return l === "en" ? "Periodic Auto-Snapshot" : l === "ku" ? "پاشەکەوتی خولیی خۆکار" : "پشتیبان دوره‌ای خودکار";
      }
      return l === "en" ? "Manual Snapshot" : l === "ku" ? "پاشەکەوتی دەستی" : "پشتیبان دستی";
    })(),
    version: payload.version,
    dataSize,
    summary: payload.summary,
    data: payload.data
  };

  if (db.backupSnapshots) {
    await db.backupSnapshots.put(snapshot);

    // Retention policy: Keep max N snapshots
    let maxSnapshots = 10;
    try {
      const savedMax = localStorage.getItem('karsync_auto_backup_max_snapshots');
      if (savedMax) maxSnapshots = Math.max(3, parseInt(savedMax, 10));
    } catch (_) {}

    const allSnaps = await db.backupSnapshots.orderBy('createdAt').toArray();
    if (allSnaps.length > maxSnapshots) {
      const toDelete = allSnaps.slice(0, allSnaps.length - maxSnapshots);
      await db.backupSnapshots.bulkDelete(toDelete.map((s) => s.id));
    }
  }

  try {
    localStorage.setItem('karsync_last_backup_at', payload.exportedAt);
    localStorage.setItem('karsync_last_snapshot_id', id);
  } catch (_) {}

  // Also silently save to physical local directory if connected
  try {
    const { writeBackupToConnectedDirectory } = await import('../services/localDirectoryBackup');
    writeBackupToConnectedDirectory(payload).catch(() => {});
  } catch (_) {}

  // Also silently upload to Google Drive if connected
  try {
    const { uploadBackupToGoogleDrive } = await import('../services/googleDriveService');
    uploadBackupToGoogleDrive(payload).catch(() => {});
  } catch (_) {}

  return snapshot;
}

/**
 * Retrieves all stored time-machine snapshots
 */
export async function getBackupSnapshots() {
  if (!db.backupSnapshots) return [];
  return await db.backupSnapshots.orderBy('createdAt').reverse().toArray();
}

/**
 * Restores workspace data from an existing snapshot
 * @param {string} snapshotId
 * @param {'replace'|'merge'} mode
 */
export async function restoreFromSnapshot(snapshotId, mode = 'replace') {
  if (!db.backupSnapshots) throw new Error('Snapshot store not available');
  const snapshot = await db.backupSnapshots.get(snapshotId);
  if (!snapshot || !snapshot.data) {
    const l = getActiveLanguage();
    throw new Error(l === "en" ? "Snapshot not found or corrupted" : l === "ku" ? "کۆپی یەدەگ نەدۆزرایەوە یان تێکچووە" : "نسخه پشتیبان یافت نشد یا آسیب دیده است");
  }

  const payload = {
    version: snapshot.version || 6,
    appName: 'KarSync',
    exportedAt: snapshot.createdAt,
    data: snapshot.data
  };

  return await importDatabaseFromJSON(JSON.stringify(payload), mode);
}

/**
 * Deletes a snapshot from IndexedDB
 * @param {string} snapshotId
 */
export async function deleteSnapshot(snapshotId) {
  if (db.backupSnapshots) {
    await db.backupSnapshots.delete(snapshotId);
  }
}

/**
 * Initiates file download of a specific snapshot
 * @param {string} snapshotId
 */
export async function downloadSnapshotAsFile(snapshotId) {
  if (!db.backupSnapshots) throw new Error('Snapshot store not available');
  const snapshot = await db.backupSnapshots.get(snapshotId);
  const l = getActiveLanguage();
  if (!snapshot) throw new Error(l === "en" ? "Snapshot not found" : l === "ku" ? "کۆپی یەدەگ نەدۆزرایەوە" : "نسخه پشتیبان یافت نشد");

  const fullPayload = {
    version: snapshot.version || 6,
    appName: 'KarSync',
    exportedAt: snapshot.createdAt,
    summary: snapshot.summary,
    currency: 'IQD',
    data: snapshot.data
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(fullPayload, null, 2)
  )}`;

  const downloadAnchor = document.createElement('a');
  const dateStr = (snapshot.createdAt || new Date().toISOString()).split('T')[0];
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `karsync_snapshot_${dateStr}_${snapshot.id.slice(-6)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Exports all data from IndexedDB into a downloadable JSON file
 */
export async function exportDatabaseToJSON() {
  const backupData = await createFullBackupPayload({ triggerType: 'export_file' });
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(backupData, null, 2)
  )}`;

  const downloadAnchor = document.createElement('a');
  const dateStr = backupData.exportedAt.split('T')[0];
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `workshop_backup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  try {
    localStorage.setItem('karsync_last_backup_at', backupData.exportedAt);
  } catch (_) {}

  // Auto-record in snapshot history
  try {
    if (db.backupSnapshots) {
      const l = getActiveLanguage();
      const exportLabel = l === "en" ? "Exported JSON Backup" : l === "ku" ? "داگرتنی فایلی یەدەگ" : "دانلود فایل پشتیبان";
      await createAutoSnapshot("export_file", exportLabel);
    }
  } catch (_) {}

  const l = getActiveLanguage();
  const toastTitles = {
    fa: "پشتیبان‌گیری موفق",
    ku: "پاشەکەوتکردنی سەرکەوتوو",
    en: "Backup Successful"
  };
  const toastMessages = {
    fa: `فایل پشتیبان (${dateStr}) با موفقیت دانلود و ذخیره شد.`,
    ku: `فایلی یەدەگ (${dateStr}) بە سەرکەوتوویی داگیرا و پاشەکەوت کرا.`,
    en: `Backup file (${dateStr}) downloaded and saved successfully.`
  };
  emitToast({
    type: "success",
    title: toastTitles[l] || toastTitles.fa,
    message: toastMessages[l] || toastMessages.fa
  });

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
    const l = getActiveLanguage();
    throw new Error(l === "en" ? "Invalid JSON file format" : l === "ku" ? "فۆرماتی فایلی JSON نادروستە" : "فرمت فایل JSON نامعتبر است");
  }

  if (!parsed.data || (!Array.isArray(parsed.data.workers) && !Array.isArray(parsed.data.attendanceLogs))) {
    const l = getActiveLanguage();
    throw new Error(l === "en" ? "Invalid backup file schema" : l === "ku" ? "پێکهاتەی فایلی یەدەگ نادروستە" : "ساختار فایل پشتیبان معتبر نیست");
  }

  const {
    workers = [],
    attendanceLogs = [],
    settings = [],
    payments = [],
    projects = [],
    projectSections = [],
    groups = [],
    projectExpenses = [],
    expenseCategories = [],
    expenses = [],
    treasuryIncomes = [],
    financialAccounts = [],
    accountTransfers = [],
    counterparties = []
  } = parsed.data;

  // Build list of valid tables to include in the transaction
  const tablesToTransact = [];
  const registeredMap = [
    { table: db.workers, data: workers },
    { table: db.attendanceLogs, data: attendanceLogs },
    { table: db.settings, data: settings },
    { table: db.payments, data: payments },
    { table: db.projects, data: projects },
    { table: db.projectSections, data: projectSections },
    { table: db.groups, data: groups },
    { table: db.projectExpenses, data: projectExpenses },
    { table: db.expenseCategories, data: expenseCategories },
    { table: db.expenses, data: expenses },
    { table: db.treasuryIncomes, data: treasuryIncomes },
    { table: db.financialAccounts, data: financialAccounts },
    { table: db.accountTransfers, data: accountTransfers },
    { table: db.counterparties, data: counterparties }
  ];

  for (const item of registeredMap) {
    if (item.table) {
      tablesToTransact.push(item.table);
    }
  }

  await db.transaction('rw', tablesToTransact, async () => {
    if (mode === 'replace') {
      for (const item of registeredMap) {
        if (item.table) {
          await item.table.clear();
        }
      }
    }

    for (const item of registeredMap) {
      if (item.table && Array.isArray(item.data) && item.data.length > 0) {
        await item.table.bulkPut(item.data);
      }
    }
  });

  return {
    workersCount: workers.length,
    logsCount: attendanceLogs.length,
    paymentsCount: payments.length,
    expensesCount: expenses.length
  };
}

/**
 * Periodically verifies and executes scheduled auto-backup
 */
export async function checkAndRunAutoBackup() {
  try {
    const enabledStr = localStorage.getItem('karsync_auto_backup_enabled');
    const isEnabled = enabledStr === null ? true : enabledStr === 'true';
    if (!isEnabled) return { performed: false, reason: 'disabled' };

    const intervalDays = Math.max(1, parseInt(localStorage.getItem('karsync_auto_backup_interval_days') || '1', 10));
    const lastBackupStr = localStorage.getItem('karsync_last_backup_at');

    const now = new Date();
    if (lastBackupStr) {
      const lastDate = new Date(lastBackupStr);
      const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < intervalDays) {
        return { performed: false, reason: 'interval_not_elapsed', diffDays };
      }
    }

    // Ensure DB has at least some data before creating an auto-snapshot
    const [workersCount, logsCount, expensesCount] = await Promise.all([
      db.workers ? db.workers.count() : 0,
      db.attendanceLogs ? db.attendanceLogs.count() : 0,
      db.expenses ? db.expenses.count() : 0
    ]);

    if (workersCount === 0 && logsCount === 0 && expensesCount === 0) {
      return { performed: false, reason: 'empty_database' };
    }

    const l = getActiveLanguage();
    const autoLabel = l === "en" ? "Periodic Auto-Snapshot" : l === "ku" ? "پاشەکەوتی خولیی خۆکار" : "پشتیبان دوره‌ای خودکار";
    const snapshot = await createAutoSnapshot("auto", autoLabel);

    const autoTitles = {
      fa: "پشتیبان‌گیری خودکار",
      ku: "پاشەکەوتی خۆکار",
      en: "Automatic Backup"
    };
    const autoMessages = {
      fa: "نسخه پشتیبان دوره‌ای با موفقیت در تاریخچه محلی ایجاد شد.",
      ku: "کۆپی یەدەگی خولەیی بە سەرکەوتوویی لە بیرگەی لۆکاڵیدا تۆمارکرا.",
      en: "Periodic backup snapshot was successfully created in local storage."
    };
    emitToast({
      type: "success",
      title: autoTitles[l] || autoTitles.fa,
      message: autoMessages[l] || autoMessages.fa
    });

    return { performed: true, snapshot };
  } catch (err) {
    console.warn('Auto-backup background task error:', err);
    return { performed: false, error: err.message };
  }
}

/**
 * Clear all data and re-seed
 */
export async function resetDatabaseWithSeed() {
  await db.workers.clear();
  await db.attendanceLogs.clear();
  await db.settings.clear();
  if (db.backupSnapshots) await db.backupSnapshots.clear();
  await seedInitialDataIfEmpty();
}
