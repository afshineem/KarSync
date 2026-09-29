import { db, seedInitialDataIfEmpty } from './db';

/**
 * Exports all data from IndexedDB into a formatted JSON string and triggers download
 */
export async function exportDatabaseToJSON() {
  const workers = await db.workers.toArray();
  const attendanceLogs = await db.attendanceLogs.toArray();
  const settings = await db.settings.toArray();
  const payments = await db.payments.toArray();
  const treasuryIncomes = db.treasuryIncomes ? await db.treasuryIncomes.toArray() : [];
  const expenses = db.expenses ? await db.expenses.toArray() : [];
  const financialAccounts = db.financialAccounts ? await db.financialAccounts.toArray() : [];
  const accountTransfers = db.accountTransfers ? await db.accountTransfers.toArray() : [];

  const backupData = {
    version: 5,
    appName: 'KarSync',
    exportedAt: new Date().toISOString(),
    currency: 'IQD',
    data: {
      workers,
      attendanceLogs,
      settings,
      payments,
      treasuryIncomes,
      expenses,
      financialAccounts,
      accountTransfers
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

  const { 
    workers = [], 
    attendanceLogs = [], 
    settings = [], 
    payments = [],
    treasuryIncomes = [],
    expenses = [],
    financialAccounts = [],
    accountTransfers = []
  } = parsed.data;

  const tablesToTransact = [db.workers, db.attendanceLogs, db.settings, db.payments];
  if (db.treasuryIncomes) tablesToTransact.push(db.treasuryIncomes);
  if (db.expenses) tablesToTransact.push(db.expenses);
  if (db.financialAccounts) tablesToTransact.push(db.financialAccounts);
  if (db.accountTransfers) tablesToTransact.push(db.accountTransfers);

  if (mode === 'replace') {
    await db.transaction('rw', tablesToTransact, async () => {
      await db.workers.clear();
      await db.attendanceLogs.clear();
      await db.settings.clear();
      await db.payments.clear();
      if (db.treasuryIncomes) await db.treasuryIncomes.clear();
      if (db.expenses) await db.expenses.clear();
      if (db.financialAccounts) await db.financialAccounts.clear();
      if (db.accountTransfers) await db.accountTransfers.clear();

      if (workers.length > 0) await db.workers.bulkPut(workers);
      if (attendanceLogs.length > 0) await db.attendanceLogs.bulkPut(attendanceLogs);
      if (settings.length > 0) await db.settings.bulkPut(settings);
      if (payments.length > 0) await db.payments.bulkPut(payments);
      if (db.treasuryIncomes && treasuryIncomes.length > 0) await db.treasuryIncomes.bulkPut(treasuryIncomes);
      if (db.expenses && expenses.length > 0) await db.expenses.bulkPut(expenses);
      if (db.financialAccounts && financialAccounts.length > 0) await db.financialAccounts.bulkPut(financialAccounts);
      if (db.accountTransfers && accountTransfers.length > 0) await db.accountTransfers.bulkPut(accountTransfers);
    });
  } else {
    // Merge mode
    await db.transaction('rw', tablesToTransact, async () => {
      if (workers.length > 0) await db.workers.bulkPut(workers);
      if (attendanceLogs.length > 0) await db.attendanceLogs.bulkPut(attendanceLogs);
      if (settings.length > 0) await db.settings.bulkPut(settings);
      if (payments.length > 0) await db.payments.bulkPut(payments);
      if (db.treasuryIncomes && treasuryIncomes.length > 0) await db.treasuryIncomes.bulkPut(treasuryIncomes);
      if (db.expenses && expenses.length > 0) await db.expenses.bulkPut(expenses);
      if (db.financialAccounts && financialAccounts.length > 0) await db.financialAccounts.bulkPut(financialAccounts);
      if (db.accountTransfers && accountTransfers.length > 0) await db.accountTransfers.bulkPut(accountTransfers);
    });
  }

  return {
    workersCount: workers.length,
    logsCount: attendanceLogs.length,
    paymentsCount: payments.length
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
