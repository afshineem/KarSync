import Dexie from 'dexie';

export const db = new Dexie('WorkshopAttendanceDB');

// Request persistent storage so the browser/OS never evicts IndexedDB
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

// Define tables and indexes
db.version(1).stores({
  workers: 'id, name, role, isActive, createdAt',
  attendanceLogs: 'id, workerId, date, type, [workerId+date]',
  settings: 'key'
});

db.version(2).stores({
  payments: 'id, workerId, date, month, type, status, createdAt'
});

db.version(3).stores({
  projects: 'id, userId, name, status, createdAt',
  workers: 'id, projectId, userId, name, role, isActive, createdAt',
  attendanceLogs: 'id, projectId, userId, workerId, date, type, [workerId+date], [projectId+workerId+date]',
  payments: 'id, projectId, userId, workerId, date, month, type, status, createdAt'
});

db.version(4).stores({
  projectSections: 'id, projectId, userId, name, status, createdAt',
  attendanceLogs: 'id, projectId, sectionId, userId, workerId, date, type, [workerId+date], [projectId+workerId+date]'
});

db.version(5).stores({
  workers: 'id, projectId, defaultSectionId, userId, name, role, isActive, createdAt'
});

db.version(6).stores({
  groups: 'id, projectId, name, deductFoodExpense, createdAt',
  workers: 'id, projectId, defaultSectionId, groupId, userId, name, role, teamRole, isActive, createdAt',
  attendanceLogs: 'id, projectId, sectionId, userId, workerId, date, type, isSettled, settlementReceiptId, [workerId+date], [projectId+workerId+date]',
  payments: 'id, projectId, userId, workerId, groupId, date, month, type, status, isSettled, settlementReceiptId, createdAt'
});

db.version(7).stores({
  projectExpenses: 'id, projectId, date, category, createdAt'
});

db.version(8).stores({
  expenseCategories: 'id, projectId, userId, parentId, name, level, createdAt',
  expenses: 'id, projectId, sectionId, categoryId, personId, paymentStatus, paymentMethod, currency, expenseDate, createdAt'
});

db.version(9).stores({
  treasuryIncomes: 'id, projectId, date, accountType, createdAt'
});

db.version(10).stores({
  financialAccounts: 'id, projectId, type, isDefault, isActive, createdAt'
});

db.version(11).stores({
  expenses: 'id, projectId, sectionId, categoryId, personId, paymentStatus, paymentMethod, currency, expenseDate, status, created_by, approved_by, createdAt',
  payments: 'id, projectId, userId, workerId, groupId, date, month, type, status, isSettled, settlementReceiptId, approval_status, created_by, approved_by, createdAt',
  treasuryIncomes: 'id, projectId, date, accountType, status, created_by, approved_by, createdAt',
  attendanceLogs: 'id, projectId, sectionId, userId, workerId, date, type, isSettled, status, created_by, approved_by, settlementReceiptId, [workerId+date], [projectId+workerId+date]'
});

db.version(12).stores({
  accountTransfers: 'id, projectId, fromAccountId, toAccountId, date, status, created_by, approved_by, createdAt'
});

db.version(13).stores({
  workspaces: 'id, workspace_code, owner_id',
  app_users: 'id, workspace_id, username, role, is_active, session_version',
  current_session: 'id, user_id, workspace_id, session_token, last_active',
  audit_logs: 'id, workspace_id, user_id, entity_type, action_type, createdAt'
});

db.version(14).stores({
  counterparties: 'id, projectId, type, name, status, createdAt',
  treasuryIncomes: 'id, projectId, counterpartyId, date, accountType, status, created_by, approved_by, createdAt'
});

db.version(15).stores({
  backupSnapshots: 'id, createdAt, triggerType, version'
});

db.version(16).stores({
  loans: 'id, projectId, workerId, status, startMonth, createdAt'
});

db.version(17).stores({
  payments: 'id, projectId, userId, workerId, groupId, date, month, type, status, isSettled, settlementReceiptId, approval_status, voucherNumber, created_by, approved_by, createdAt',
  expenses: 'id, projectId, sectionId, categoryId, personId, paymentStatus, paymentMethod, currency, expenseDate, status, voucherNumber, created_by, approved_by, createdAt',
  treasuryIncomes: 'id, projectId, counterpartyId, date, accountType, status, voucherNumber, created_by, approved_by, createdAt',
  accountTransfers: 'id, projectId, fromAccountId, toAccountId, date, status, voucherNumber, created_by, approved_by, createdAt',
  loans: 'id, projectId, workerId, status, startMonth, voucherNumber, createdAt'
});

db.version(18).stores({
  payments: 'id, projectId, userId, workerId, groupId, date, month, type, status, isSettled, settlementReceiptId, approval_status, voucherNumber, bankTrackingCode, bankDocumentNumber, created_by, approved_by, createdAt',
  expenses: 'id, projectId, sectionId, categoryId, personId, paymentStatus, paymentMethod, currency, expenseDate, status, voucherNumber, bankTrackingCode, bankDocumentNumber, chequeId, created_by, approved_by, createdAt',
  treasuryIncomes: 'id, projectId, counterpartyId, date, accountType, status, voucherNumber, bankTrackingCode, bankDocumentNumber, chequeId, created_by, approved_by, createdAt',
  accountTransfers: 'id, projectId, fromAccountId, toAccountId, date, status, voucherNumber, bankTrackingCode, bankDocumentNumber, created_by, approved_by, createdAt',
  loans: 'id, projectId, workerId, status, startMonth, voucherNumber, createdAt',
  cheques: 'id, projectId, type, bankAccountId, counterpartyId, chequeNumber, sayadNumber, nationalId, dueDate, issueDate, status, amount, voucherNumber, bankTrackingCode, bankDocumentNumber, created_by, approved_by, createdAt',
  chequebooks: 'id, projectId, bankAccountId, bankName, startSerial, endSerial, totalLeaves, usedLeaves, status, createdAt'
});

db.version(19).stores({
  contracts: 'id, projectId, counterpartyId, contractNumber, title, status, startDate, estimatedEndDate, actualEndDate, delayPenaltyPerDay, totalEstimatedAmount, finalPayableAmount, voucherId, created_by, approved_by, createdAt, updatedAt',
  expenses: 'id, projectId, sectionId, categoryId, personId, paymentStatus, paymentMethod, currency, expenseDate, status, voucherNumber, bankTrackingCode, bankDocumentNumber, chequeId, contractId, isContractorBackcharge, created_by, approved_by, createdAt'
});

db.version(20).stores({
  workers: 'id, projectId, isGlobal, defaultSectionId, groupId, userId, name, role, teamRole, isActive, createdAt'
});

db.version(21).stores({
  financialAccounts: 'id, projectId, isGlobal, scope, type, isDefault, isActive, createdAt'
}).upgrade(async tx => {
  const accounts = await tx.table('financialAccounts').toArray();
  for (const acc of accounts) {
    const isGlobal = acc.isGlobal !== undefined ? Boolean(acc.isGlobal) : (acc.type === 'bank');
    const scope = acc.scope || (isGlobal ? 'global' : 'project');
    await tx.table('financialAccounts').update(acc.id, { isGlobal, scope });
  }
});

db.version(22).stores({
  expenseCategories: 'id, projectId, userId, parentId, name, code, level, isSystem, createdAt'
});

// Helper to generate UUIDs
export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

// Helper to generate Counterparty IDs
export function generateCounterpartyId() {
  return 'cpt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Transfer IDs
export function generateTransferId() {
  return 'trf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Project IDs
export function generateProjectId() {
  return 'prj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Project Section IDs
export function generateSectionId() {
  return 'sec_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Group IDs
export function generateGroupId() {
  return 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Payment / Settlement IDs
export function generatePaymentId() {
  return 'pay_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Loan IDs
export function generateLoanId() {
  return 'loan_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Cheque IDs
export function generateChequeId() {
  return 'chk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Chequebook IDs
export function generateChequebookId() {
  return 'chb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Contract IDs
export function generateContractId() {
  return 'ctr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Expense IDs
export function generateExpenseId() {
  return 'exp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Expense Category IDs
export function generateCategoryId() {
  return 'cat_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Treasury Income IDs
export function generateTreasuryIncomeId() {
  return 'inc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// Helper to generate Financial Account IDs (Bank card / Cash box)
export function generateAccountId() {
  return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
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

export const DEFAULT_PROJECT_ID = 'prj_default_main';

// Ensure any record inserted or updated always has projectId and userId defaults and clean types
db.workers.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.userId) obj.userId = 'default_user';
  if (obj.dailyRate !== undefined) obj.dailyRate = Number(String(obj.dailyRate).replace(/,/g, '')) || 0;
  if (obj.overtimeHourlyRate !== undefined) obj.overtimeHourlyRate = Number(String(obj.overtimeHourlyRate).replace(/,/g, '')) || 0;
  if (obj.defaultSectionId !== undefined) obj.defaultSectionId = obj.defaultSectionId ? String(obj.defaultSectionId) : null;
});
db.workers.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
  if ('dailyRate' in modifications && modifications.dailyRate !== undefined) {
    modifications.dailyRate = Number(String(modifications.dailyRate).replace(/,/g, '')) || 0;
  }
  if ('overtimeHourlyRate' in modifications && modifications.overtimeHourlyRate !== undefined) {
    modifications.overtimeHourlyRate = Number(String(modifications.overtimeHourlyRate).replace(/,/g, '')) || 0;
  }
  if ('defaultSectionId' in modifications) {
    modifications.defaultSectionId = modifications.defaultSectionId ? String(modifications.defaultSectionId) : null;
  }
});

db.attendanceLogs.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (obj.workerId !== undefined) obj.workerId = String(obj.workerId);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.userId) obj.userId = 'default_user';
  if (obj.overtimeHours !== undefined) obj.overtimeHours = Number(obj.overtimeHours) || 0;
  if (obj.calculatedDailyWage !== undefined) obj.calculatedDailyWage = Number(obj.calculatedDailyWage) || 0;
  if (obj.calculatedOvertimeWage !== undefined) obj.calculatedOvertimeWage = Number(obj.calculatedOvertimeWage) || 0;
  if (obj.totalDayPay !== undefined) obj.totalDayPay = Number(obj.totalDayPay) || 0;
});
db.attendanceLogs.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
  if ('workerId' in modifications && modifications.workerId !== undefined) {
    modifications.workerId = String(modifications.workerId);
  }
  if ('overtimeHours' in modifications && modifications.overtimeHours !== undefined) {
    modifications.overtimeHours = Number(modifications.overtimeHours) || 0;
  }
  if ('calculatedDailyWage' in modifications && modifications.calculatedDailyWage !== undefined) {
    modifications.calculatedDailyWage = Number(modifications.calculatedDailyWage) || 0;
  }
  if ('calculatedOvertimeWage' in modifications && modifications.calculatedOvertimeWage !== undefined) {
    modifications.calculatedOvertimeWage = Number(modifications.calculatedOvertimeWage) || 0;
  }
  if ('totalDayPay' in modifications && modifications.totalDayPay !== undefined) {
    modifications.totalDayPay = Number(modifications.totalDayPay) || 0;
  }
});

db.payments.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (obj.workerId !== undefined) obj.workerId = String(obj.workerId);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.userId) obj.userId = 'default_user';
  if (obj.amount !== undefined) obj.amount = Number(String(obj.amount).replace(/,/g, '')) || 0;
});
db.payments.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
  if ('workerId' in modifications && modifications.workerId !== undefined) {
    modifications.workerId = String(modifications.workerId);
  }
  if ('amount' in modifications && modifications.amount !== undefined) {
    modifications.amount = Number(String(modifications.amount).replace(/,/g, '')) || 0;
  }
});

db.counterparties.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.createdAt) obj.createdAt = new Date().toISOString();
});
db.counterparties.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
});

db.contracts.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.createdAt) obj.createdAt = new Date().toISOString();
  if (!obj.status) obj.status = 'active';
});
db.contracts.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
  modifications.updatedAt = new Date().toISOString();
});

db.projectSections.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.userId) obj.userId = 'default_user';
  if (!obj.status) obj.status = 'active';
});
db.projectSections.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
});

// Expenses & Hierarchical Categories Hooks
db.expenses.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.userId) obj.userId = 'default_user';
  if (obj.amount !== undefined) obj.amount = Number(String(obj.amount).replace(/,/g, '')) || 0;
  if (!obj.paymentStatus) obj.paymentStatus = 'paid';
  if (!obj.paymentMethod) obj.paymentMethod = 'cash';
  if (!obj.currency) obj.currency = 'IQD';
  if (!obj.expenseDate) obj.expenseDate = new Date().toISOString().slice(0, 10);
});
db.expenses.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
  if ('amount' in modifications && modifications.amount !== undefined) {
    modifications.amount = Number(String(modifications.amount).replace(/,/g, '')) || 0;
  }
});

db.expenseCategories.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.userId) obj.userId = 'default_user';
  if (obj.parentId !== undefined) obj.parentId = obj.parentId ? String(obj.parentId) : null;
  if (!obj.level) obj.level = 1;
});
db.expenseCategories.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
});

// Treasury Incomes Hooks
db.treasuryIncomes.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.userId) obj.userId = 'default_user';
  if (obj.amount !== undefined) obj.amount = Number(String(obj.amount).replace(/,/g, '')) || 0;
  if (!obj.accountType) obj.accountType = 'bank';
  if (!obj.date) obj.date = new Date().toISOString().slice(0, 10);
});
db.treasuryIncomes.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
  if ('amount' in modifications && modifications.amount !== undefined) {
    modifications.amount = Number(String(modifications.amount).replace(/,/g, '')) || 0;
  }
});

// Financial Accounts (Bank Cards / Cash Boxes) Hooks
db.financialAccounts.hook('creating', function (primKey, obj) {
  if (obj.id !== undefined) obj.id = String(obj.id);
  if (!obj.projectId) obj.projectId = DEFAULT_PROJECT_ID;
  if (!obj.userId) obj.userId = 'default_user';
  if (!obj.type) obj.type = 'bank';
  if (obj.isDefault === undefined) obj.isDefault = false;
  if (obj.isActive === undefined) obj.isActive = true;
  if (obj.initialBalance !== undefined) obj.initialBalance = Number(String(obj.initialBalance).replace(/,/g, '')) || 0;
  if (!obj.overdraftPolicy) obj.overdraftPolicy = 'global';
});
db.financialAccounts.hook('updating', function (modifications, primKey, obj) {
  if ('projectId' in modifications && !modifications.projectId) {
    modifications.projectId = DEFAULT_PROJECT_ID;
  }
  if ('initialBalance' in modifications && modifications.initialBalance !== undefined) {
    modifications.initialBalance = Number(String(modifications.initialBalance).replace(/,/g, '')) || 0;
  }
});

// Strict Immutability: Deleting Hooks for Approved Financial Records & Expenses
// The guard protects records from being deleted by USERS. Wiping the local cache of a device
// (logout / switching accounts / worker link login) is not a user deletion — the cloud copy
// stays untouched — so those flows run inside withImmutabilityBypass().
let immutabilityBypassDepth = 0;
export async function withImmutabilityBypass(fn) {
  immutabilityBypassDepth++;
  try {
    return await fn();
  } finally {
    immutabilityBypassDepth--;
  }
}

/**
 * Deep wipe of all local IndexedDB tables and tenant-specific localStorage keys.
 * Used on user logout, account switching, or tenant change to guarantee 100% zero-leakage.
 */
export async function wipeAllLocalData() {
  await withImmutabilityBypass(async () => {
    for (const table of db.tables) {
      try {
        await table.clear();
      } catch (err) {
        console.warn(`[Wipe] Warning clearing table ${table.name}:`, err);
      }
    }
  });

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
      if (
        key.startsWith('workshop_') ||
        (key.startsWith('karsync_') && !key.startsWith('karsync_product_tour_seen') && !key.startsWith('karsync_setup_checklist_dismissed')) ||
        key === 'last_active_user_id' ||
        key === 'last_active_workspace_id' ||
        key === 'workshop_auth_session' ||
        key === 'admin_auth' ||
        key === 'worker_creds_map' ||
        key === 'login_attempts'
      ) {
        if (!preserveKeys.has(key)) {
          localStorage.removeItem(key);
        }
      }
    }
  }
}

db.payments.hook('deleting', function (primKey, obj) {
  if (immutabilityBypassDepth > 0) return;
  if (obj && (obj.status === 'approved' || obj.approval_status === 'approved')) {
    throw new Error('403 Forbidden: اسناد مالی تایید نهایی شده به جهت الزامات مالیاتی و تعادل حسابداری غیرقابل حذف هستند.');
  }
});

db.expenses.hook('deleting', function (primKey, obj) {
  if (immutabilityBypassDepth > 0) return;
  if (obj && (obj.status === 'approved' || obj.approval_status === 'approved')) {
    throw new Error('403 Forbidden: هزینه‌های کارگاه با سند تایید نهایی شده به جهت الزامات مالیاتی غیرقابل حذف هستند.');
  }
});

// Ensure at least one active project exists and migrate legacy records to it
export async function ensureDefaultProjectExists(userId = 'default_user') {
  try {
    const projectCount = await db.projects.count();
    let currentDefault = await db.projects.get(DEFAULT_PROJECT_ID);

    if (projectCount === 0) {
      currentDefault = {
        id: DEFAULT_PROJECT_ID,
        userId: userId || 'default_user',
        name: 'پروژه مرکزی (کارگاه)',
        currency: 'IQD',
        standardWorkHours: 8,
        overtimeMultiplier: 1.0,
        status: 'active',
        notes: 'پروژه پیش‌فرض سیستم',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };
      await db.projects.put(currentDefault);
    }

    const activePrj = currentDefault || (await db.projects.toCollection().first());
    const fallbackProjectId = activePrj?.id || DEFAULT_PROJECT_ID;

    // Forcefully migrate ALL workers, logs, and payments without a valid projectId
    const allWorkers = await db.workers.toArray();
    for (const w of allWorkers) {
      if (!w.projectId) {
        await db.workers.update(w.id, { projectId: fallbackProjectId, userId: w.userId || userId || 'default_user' });
      }
    }

    const allLogs = await db.attendanceLogs.toArray();
    for (const l of allLogs) {
      if (!l.projectId) {
        await db.attendanceLogs.update(l.id, { projectId: fallbackProjectId, userId: l.userId || userId || 'default_user' });
      }
    }

    const allPayments = await db.payments.toArray();
    for (const p of allPayments) {
      if (!p.projectId) {
        await db.payments.update(p.id, { projectId: fallbackProjectId, userId: p.userId || userId || 'default_user' });
      }
    }

    return activePrj;
  } catch (err) {
    console.warn('ensureDefaultProjectExists warning:', err);
    return null;
  }
}

// Default 3-Tier Expense Categories Structure with Hierarchical Coding
export const DEFAULT_EXPENSE_CATEGORIES_TREE = [
  {
    code: '10',
    name: 'مصالح و متریال ساختمانی',
    subcategories: [
      {
        code: '101',
        name: 'مصالح پایه‌ای و سفت‌کاری',
        items: [
          { code: '1011', name: 'سیمان تیپ ۲ و ۵' },
          { code: '1012', name: 'ماسه شسته، بادی و شن' },
          { code: '1013', name: 'آجر فشاری، سفال و بلوک سیمانی/پوکه' },
          { code: '1014', name: 'گچ و خاک ساختمانی' }
        ]
      },
      {
        code: '102',
        name: 'آهن‌آلات و سازه فلزی',
        items: [
          { code: '1021', name: 'میلگرد و خاموت آماده' },
          { code: '1022', name: 'تیرآهن، ناودانی و نبشی' },
          { code: '1023', name: 'قوطی و پروفیل آهن' },
          { code: '1024', name: 'سیم آرماتوربندی، رابیتس و الکترود جوشکاری' }
        ]
      },
      {
        code: '103',
        name: 'تأسیسات مکانیکی و برقی',
        items: [
          { code: '1031', name: 'لوله و اتصالات پلیکا و پلی‌اتیلن' },
          { code: '1032', name: 'کابل، سیم، لوله خرطومی و قوطی کلید' },
          { code: '1033', name: 'شیرآلات، پمپ و مخزن آب موقت کارگاه' }
        ]
      },
      {
        code: '104',
        name: 'عایق، چسب و شیمیایی ساختمان',
        items: [
          { code: '1041', name: 'ایزوگام، قیر و گونی' },
          { code: '1042', name: 'چسب بتن، سنگ، روان‌کننده و ضدیخ' },
          { code: '1043', name: 'ضدزنگ، رنگ روغنی و تینر' }
        ]
      }
    ]
  },
  {
    code: '20',
    name: 'ماشین‌آلات، ابزار و ترابری',
    subcategories: [
      {
        code: '201',
        name: 'اجاره ماشین‌آلات و تجهیزات سنگین',
        items: [
          { code: '2011', name: 'اجاره جرثقیل و بالابر' },
          { code: '2012', name: 'لودر، بیل مکانیکی و بابکت' },
          { code: '2013', name: 'بتونیر، میکسر و پمپ بتن' },
          { code: '2014', name: 'کمپرسور و چکش برقی/هیدرولیکی' }
        ]
      },
      {
        code: '202',
        name: 'سوخت، روانکار و تعمیرات دستگاه‌ها',
        items: [
          { code: '2021', name: 'گازوئیل ژنراتور و موتور برق' },
          { code: '2022', name: 'بنزین، روغن موتور و روغن هیدرولیک' },
          { code: '2023', name: 'سرویس دوره‌ای، فیلترها و تعویض قطعه' }
        ]
      },
      {
        code: '203',
        name: 'ابزارآلات و تجهیزات مصرفی کارگاه',
        items: [
          { code: '2031', name: 'صفحه برش سنگ، فرز و پروفیل‌بر' },
          { code: '2032', name: 'مته، دریل، قلم بتن‌کن و پیکور' },
          { code: '2033', name: 'کابل برق سیار و پروژکتور کارگاهی' }
        ]
      },
      {
        code: '204',
        name: 'حمل و نقل و باربری',
        items: [
          { code: '2041', name: 'کرایه نیسان و خاور' },
          { code: '2042', name: 'کرایه تریلی و کفی' },
          { code: '2043', name: 'دستمزد کارگر متفرقه تخلیه و بارگیری' }
        ]
      }
    ]
  },
  {
    code: '30',
    name: 'پیمانکاری جزئی و خدمات فنی',
    subcategories: [
      {
        code: '301',
        name: 'اکیپ‌های دستمزدی متفرقه',
        items: [
          { code: '3011', name: 'دستمزد روزمزد کارگران نظافت و نخاله‌برداری' },
          { code: '3012', name: 'اکیپ متفرقه تخریب و خاکبرداری دستی' }
        ]
      },
      {
        code: '302',
        name: 'آزمایشگاه و خدمات مهندسی کارگاه',
        items: [
          { code: '3021', name: 'آزمایشگاه بتن، میلگرد و جوش' },
          { code: '3022', name: 'نقشه‌برداری و پیاده‌سازی نقشه' },
          { code: '3023', name: 'چاپ نقشه و پلات مهندسی' }
        ]
      }
    ]
  },
  {
    code: '40',
    name: 'سربار، ایمنی و هزینه‌های جاری کارگاه',
    subcategories: [
      {
        code: '401',
        name: 'تغذیه و پذیرایی پرسنل',
        items: [
          { code: '4011', name: 'چای، قند، شکر و ملزومات آبدارخانه' },
          { code: '4012', name: 'ناهار و وعده غذایی گروهی پرسنل' },
          { code: '4013', name: 'آب آشامیدنی معدنی و یخ کارگاه' }
        ]
      },
      {
        code: '402',
        name: 'بهداشت، ایمنی و محیط زیست (HSE)',
        items: [
          { code: '4021', name: 'کفش و کلاه ایمنی' },
          { code: '4022', name: 'دستکش کار، عینک محافظ و ماسک' },
          { code: '4023', name: 'شارژ کپسول آتش‌نشانی و جعبه کمک‌های اولیه' }
        ]
      },
      {
        code: '403',
        name: 'اداری، اقامت و ارتباطات',
        items: [
          { code: '4031', name: 'شارژ اینترنت، مودم و قبوض ارتباطی' },
          { code: '4032', name: 'دفتر، زونکن، پوشه و اقلام اداری' },
          { code: '4033', name: 'اسکان کارگران، کرایه کانکس و ملزومات خواب' }
        ]
      }
    ]
  }
];

export async function deduplicateExpenseCategories(projectId = null) {
  try {
    const list = await db.expenseCategories.toArray();
    const filtered = projectId 
      ? list.filter(c => !c.projectId || c.projectId === projectId || projectId === DEFAULT_PROJECT_ID)
      : list;

    const seen = new Map();
    const idsToDelete = [];
    const idRemap = new Map();

    for (const cat of filtered) {
      const key = `${cat.projectId || 'main'}_${cat.level || 1}_${cat.parentId || 'root'}_${(cat.name || '').trim().toLowerCase()}`;
      if (seen.has(key)) {
        const kept = seen.get(key);
        idsToDelete.push(cat.id);
        idRemap.set(cat.id, kept.id);
      } else {
        seen.set(key, cat);
      }
    }

    if (idsToDelete.length > 0) {
      for (const cat of filtered) {
        if (cat.parentId && idRemap.has(cat.parentId)) {
          await db.expenseCategories.update(cat.id, { parentId: idRemap.get(cat.parentId) });
        }
      }

      const allExpenses = await db.expenses.toArray();
      for (const exp of allExpenses) {
        if (exp.categoryId && idRemap.has(exp.categoryId)) {
          await db.expenses.update(exp.id, { categoryId: idRemap.get(exp.categoryId) });
        }
      }

      for (const id of idsToDelete) {
        await db.expenseCategories.delete(id);
      }
      console.log(`🧹 Cleaned up ${idsToDelete.length} duplicate expense categories.`);
      return idsToDelete.length;
    }
  } catch (err) {
    console.warn('deduplicateExpenseCategories warning:', err);
  }
  return 0;
}

export async function seedDefaultExpenseCategories(projectId = DEFAULT_PROJECT_ID, userId = 'default_user') {
  try {
    await deduplicateExpenseCategories(projectId);
    const existing = await db.expenseCategories.where('projectId').equals(projectId).toArray();
    
    // Check if existing categories need codes, isSystem, or userId adoption
    if (existing && existing.length > 0) {
      let needsUpdate = false;
      const updates = [];

      // Build quick lookup map by category name from DEFAULT_EXPENSE_CATEGORIES_TREE
      const codeLookup = new Map();
      DEFAULT_EXPENSE_CATEGORIES_TREE.forEach(mg => {
        codeLookup.set(mg.name, { code: mg.code, level: 1 });
        mg.subcategories.forEach(sg => {
          codeLookup.set(sg.name, { code: sg.code, level: 2 });
          sg.items.forEach((item, itemIdx) => {
            const itemName = typeof item === 'object' ? item.name : item;
            const itemCode = typeof item === 'object' ? item.code : `${sg.code}${itemIdx + 1}`;
            codeLookup.set(itemName, { code: itemCode, level: 3 });
          });
        });
      });

      for (const cat of existing) {
        let changed = false;
        const patch = { ...cat };

        // Adopt userId if currently 'default_user' or missing and a real user ID is provided
        if (userId && userId !== 'default_user' && (!patch.userId || patch.userId === 'default_user')) {
          patch.userId = userId;
          changed = true;
        }

        // Backfill code or isSystem
        if (!patch.code || patch.isSystem === undefined) {
          const match = codeLookup.get(patch.name);
          if (match) {
            patch.code = match.code;
            patch.level = match.level;
            patch.isSystem = true;
            changed = true;
          } else {
            patch.isSystem = patch.isSystem ?? false;
            changed = true;
          }
        }

        if (changed) {
          updates.push(patch);
          needsUpdate = true;
        }
      }

      if (updates.length > 0) {
        await db.expenseCategories.bulkPut(updates);
        console.log(`✅ Updated ${updates.length} existing expense categories with codes/userId for project:`, projectId);
        return true;
      }

      if (!needsUpdate) return false;
    }

    const categoriesToAdd = [];
    const now = new Date().toISOString();
    const pidClean = String(projectId || DEFAULT_PROJECT_ID).replace(/[^a-zA-Z0-9]/g, '');
    const pidSlice = pidClean.length >= 6 ? pidClean.slice(-6) : pidClean.padEnd(6, '0');

    DEFAULT_EXPENSE_CATEGORIES_TREE.forEach((mainGroup, mainIdx) => {
      const mainId = `cat_l1_${pidSlice}_${mainIdx + 1}`;
      categoriesToAdd.push({
        id: mainId,
        projectId,
        userId: userId || 'default_user',
        name: mainGroup.name,
        code: mainGroup.code,
        parentId: null,
        level: 1,
        isSystem: true,
        createdAt: now
      });

      mainGroup.subcategories.forEach((subGroup, subIdx) => {
        const subId = `cat_l2_${pidSlice}_${mainIdx + 1}_${subIdx + 1}`;
        categoriesToAdd.push({
          id: subId,
          projectId,
          userId: userId || 'default_user',
          name: subGroup.name,
          code: subGroup.code,
          parentId: mainId,
          level: 2,
          isSystem: true,
          createdAt: now
        });

        subGroup.items.forEach((item, itemIdx) => {
          const itemId = `cat_l3_${pidSlice}_${mainIdx + 1}_${subIdx + 1}_${itemIdx + 1}`;
          categoriesToAdd.push({
            id: itemId,
            projectId,
            userId: userId || 'default_user',
            name: typeof item === 'object' ? item.name : item,
            code: typeof item === 'object' ? item.code : `${subGroup.code}${itemIdx + 1}`,
            parentId: subId,
            level: 3,
            isSystem: true,
            createdAt: now
          });
        });
      });
    });

    if (categoriesToAdd.length > 0) {
      await db.expenseCategories.bulkPut(categoriesToAdd);
      console.log(`✅ Seeded ${categoriesToAdd.length} 3-tier expense categories with codes for project:`, projectId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('seedDefaultExpenseCategories warning:', err);
    return false;
  }
}

/**
 * Check if a category (or any of its descendant subcategories) is used in any registered expense.
 * Categories with existing transactions MUST NEVER be deleted.
 * @param {string} categoryId 
 * @returns {Promise<{ hasExpenses: boolean, count: number, sampleExpenseTitles: string[] }>}
 */
export async function checkCategoryHasExpenses(categoryId) {
  try {
    if (!categoryId) return { hasExpenses: false, count: 0, sampleExpenseTitles: [] };

    const allCategories = await db.expenseCategories.toArray();
    const targetIds = new Set([categoryId]);

    // Recursively collect all descendant category IDs
    let added = true;
    while (added) {
      added = false;
      for (const cat of allCategories) {
        if (cat.parentId && targetIds.has(cat.parentId) && !targetIds.has(cat.id)) {
          targetIds.add(cat.id);
          added = true;
        }
      }
    }

    // Query expenses for any usage of targetIds in categoryId, subCategoryId, or mainCategoryId
    const allExpenses = await db.expenses.toArray();
    const matchingExpenses = allExpenses.filter(e => {
      return (
        (e.categoryId && targetIds.has(e.categoryId)) ||
        (e.subCategoryId && targetIds.has(e.subCategoryId)) ||
        (e.mainCategoryId && targetIds.has(e.mainCategoryId))
      );
    });

    return {
      hasExpenses: matchingExpenses.length > 0,
      count: matchingExpenses.length,
      sampleExpenseTitles: matchingExpenses.slice(0, 3).map(e => e.title || 'هزینه بدون عنوان')
    };
  } catch (err) {
    console.warn('checkCategoryHasExpenses error:', err);
    return { hasExpenses: false, count: 0, sampleExpenseTitles: [] };
  }
}

/**
 * Reset expense categories to KarSync's standard 52-category hierarchical catalogue.
 * Rule:
 * 1. Standard 52 categories are restored/updated with exact codes and levels (isSystem: true).
 * 2. Custom categories that HAVE transactions are 100% PRESERVED alongside defaults so historical vouchers remain intact.
 * 3. Custom categories with NO transactions are removed to clean up the catalogue.
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<{ success: boolean, restoredCount: number, preservedManualCount: number, deletedCount: number }>}
 */
export async function resetExpenseCategoriesToDefault(projectId = DEFAULT_PROJECT_ID, userId = 'default_user') {
  try {
    const allCategories = await db.expenseCategories.toArray();
    const allExpenses = await db.expenses.toArray();

    // Set of all category IDs referenced in any registered expense
    const referencedCatIds = new Set();
    allExpenses.forEach(exp => {
      if (exp.categoryId) referencedCatIds.add(exp.categoryId);
      if (exp.subCategoryId) referencedCatIds.add(exp.subCategoryId);
      if (exp.mainCategoryId) referencedCatIds.add(exp.mainCategoryId);
    });

    // Also include any ancestors of referenced categories so hierarchy remains intact
    const catMap = new Map();
    allCategories.forEach(c => catMap.set(c.id, c));

    const preservedAncestorIds = new Set(referencedCatIds);
    for (const refId of referencedCatIds) {
      let curr = catMap.get(refId);
      while (curr && curr.parentId) {
        preservedAncestorIds.add(curr.parentId);
        curr = catMap.get(curr.parentId);
      }
    }

    // Build standard system categories mapping
    const pidClean = String(projectId || DEFAULT_PROJECT_ID).replace(/[^a-zA-Z0-9]/g, '');
    const pidSlice = pidClean.length >= 6 ? pidClean.slice(-6) : pidClean.padEnd(6, '0');
    const now = new Date().toISOString();

    const standardCategories = [];

    DEFAULT_EXPENSE_CATEGORIES_TREE.forEach((mainGroup, mainIdx) => {
      const mainId = `cat_l1_${pidSlice}_${mainIdx + 1}`;
      const mainCat = {
        id: mainId,
        projectId,
        userId: userId || 'default_user',
        name: mainGroup.name,
        code: mainGroup.code,
        parentId: null,
        level: 1,
        isSystem: true,
        createdAt: now
      };
      standardCategories.push(mainCat);

      mainGroup.subcategories.forEach((subGroup, subIdx) => {
        const subId = `cat_l2_${pidSlice}_${mainIdx + 1}_${subIdx + 1}`;
        const subCat = {
          id: subId,
          projectId,
          userId: userId || 'default_user',
          name: subGroup.name,
          code: subGroup.code,
          parentId: mainId,
          level: 2,
          isSystem: true,
          createdAt: now
        };
        standardCategories.push(subCat);

        subGroup.items.forEach((item, itemIdx) => {
          const itemId = `cat_l3_${pidSlice}_${mainIdx + 1}_${subIdx + 1}_${itemIdx + 1}`;
          const itemName = typeof item === 'object' ? item.name : item;
          const itemCode = typeof item === 'object' ? item.code : `${subGroup.code}${itemIdx + 1}`;
          const itemCat = {
            id: itemId,
            projectId,
            userId: userId || 'default_user',
            name: itemName,
            code: itemCode,
            parentId: subId,
            level: 3,
            isSystem: true,
            createdAt: now
          };
          standardCategories.push(itemCat);
        });
      });
    });

    const standardIdSet = new Set(standardCategories.map(c => c.id));

    // Categories to delete: those NOT standard, and NOT referenced in expenses
    const idsToDelete = [];
    let preservedManualCount = 0;

    for (const cat of allCategories) {
      if (standardIdSet.has(cat.id)) continue;

      if (preservedAncestorIds.has(cat.id)) {
        // Referenced in expenses: MUST BE PRESERVED!
        preservedManualCount++;
      } else {
        // Unreferenced manual category: clean it up
        idsToDelete.push(cat.id);
      }
    }

    if (idsToDelete.length > 0) {
      for (const id of idsToDelete) {
        await db.expenseCategories.delete(id);
      }
    }

    // Put all standard categories into database
    await db.expenseCategories.bulkPut(standardCategories);

    return {
      success: true,
      restoredCount: standardCategories.length,
      preservedManualCount,
      deletedCount: idsToDelete.length
    };
  } catch (err) {
    console.error('resetExpenseCategoriesToDefault error:', err);
    throw err;
  }
}

// Migrate legacy projectExpenses into modern expenses table
export async function migrateLegacyProjectExpenses() {
  try {
    const legacyExpenses = await db.projectExpenses.toArray();
    if (!legacyExpenses || legacyExpenses.length === 0) return;

    const modernExpensesCount = await db.expenses.count();
    if (modernExpensesCount === 0 && legacyExpenses.length > 0) {
      const migrated = legacyExpenses.map((le) => ({
        id: le.id || generateExpenseId(),
        projectId: le.projectId || DEFAULT_PROJECT_ID,
        userId: 'default_user',
        sectionId: null,
        categoryId: null,
        personId: null,
        personName: '',
        title: le.title || 'هزینه عمومی',
        amount: Number(le.amount) || 0,
        currency: 'IQD',
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        receiptUrl: null,
        description: le.category ? `دسته‌بندی قبلی: ${le.category}` : '',
        expenseDate: le.date || new Date().toISOString().slice(0, 10),
        createdAt: le.createdAt || new Date().toISOString()
      }));
      await db.expenses.bulkPut(migrated);
      console.log(`✅ Migrated ${migrated.length} legacy projectExpenses to new expenses table.`);
    }
  } catch (err) {
    console.warn('migrateLegacyProjectExpenses warning:', err);
  }
}

// Seed default cash box and bank card if missing
export async function seedDefaultFinancialAccounts(projectId = DEFAULT_PROJECT_ID, userId = 'default_user') {
  try {
    if (!db.financialAccounts) return;
    const now = new Date().toISOString();
    const allAccounts = await db.financialAccounts.toArray();
    const activeCash = allAccounts.find((a) => a.type === 'cash' && !a.deletedAt && a.status !== 'deleted');
    const activeBank = allAccounts.find((a) => a.type === 'bank' && !a.deletedAt && a.status !== 'deleted');

    let changed = false;

    if (!activeCash) {
      const existingCash = await db.financialAccounts.get('acc_default_cash');
      const cashRecord = {
        id: 'acc_default_cash',
        projectId: projectId || DEFAULT_PROJECT_ID,
        userId: userId || 'default_user',
        name: 'صندوق نقدی کارگاه',
        type: 'cash',
        isGlobal: false,
        scope: 'project',
        keeperName: 'سرپرست کارگاه',
        initialBalance: existingCash?.initialBalance || 0,
        isDefault: true,
        isActive: true,
        color: 'amber',
        notes: 'صندوق نقدی پیش‌فرض جهت پرداخت‌ها و مخارج روزمره کارگاه',
        deletedAt: null,
        status: 'active',
        createdAt: existingCash?.createdAt || now,
        updatedAt: now
      };
      await db.financialAccounts.put(cashRecord);
      changed = true;
      console.log('✅ Restored/seeded default cash box (acc_default_cash).');
    }

    if (!activeBank) {
      const existingBank = await db.financialAccounts.get('acc_default_bank');
      const bankRecord = {
        id: 'acc_default_bank',
        projectId: projectId || DEFAULT_PROJECT_ID,
        userId: userId || 'default_user',
        name: 'کارت بانکی تنخواه کارگاه',
        type: 'bank',
        isGlobal: true,
        scope: 'global',
        bankName: 'بانک ملت',
        holderName: 'کارفرما',
        cardNumber: '',
        accountNumber: '',
        initialBalance: existingBank?.initialBalance || 0,
        isDefault: activeCash ? false : true,
        isActive: true,
        color: 'sky',
        notes: 'کارت بانکی مشترک جهت واریزی‌های کارفرما و پرداخت‌های آنلاین پروژه‌ها',
        deletedAt: null,
        status: 'active',
        createdAt: existingBank?.createdAt || now,
        updatedAt: now
      };
      await db.financialAccounts.put(bankRecord);
      changed = true;
      console.log('✅ Restored/seeded default bank card (acc_default_bank).');
    }

    // اطمینان از وجود فقط و فقط یک حساب پیش‌فرض فعال
    const currentList = await db.financialAccounts.toArray();
    const activeAccounts = currentList.filter((a) => !a.deletedAt && a.status !== 'deleted');
    const defaultAccounts = activeAccounts.filter((a) => a.isDefault);
    if (defaultAccounts.length > 1) {
      // اگر بیش از یک حساب به عنوان پیش‌فرض ثبت شده بود، فقط اولین حساب را پیش‌فرض نگه می‌داریم و بقیه را false می‌کنیم
      const [primaryDefault, ...others] = defaultAccounts;
      for (const o of others) {
        await db.financialAccounts.update(o.id, { isDefault: false, updatedAt: now });
      }
      changed = true;
    } else if (defaultAccounts.length === 0 && activeAccounts.length > 0) {
      const targetDefault = activeAccounts.find((a) => a.type === 'cash') || activeAccounts[0];
      await db.financialAccounts.update(targetDefault.id, { isDefault: true, updatedAt: now });
      changed = true;
    }

    if (changed && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workshop-accounts-sync'));
    }
  } catch (err) {
    console.warn('seedDefaultFinancialAccounts error:', err);
  }
}

/**
 * migrateClosedTransactionsToCashBox
 * انتساب تمام تراکنش‌های بسته شده قبلی (هزینه‌های پرداخت شده، تسویه‌ها و مساعده‌های پرسنل)
 * به حساب صندوق نقدی کارگاه
 */
export async function migrateClosedTransactionsToCashBox(projectId = DEFAULT_PROJECT_ID, forceAll = false) {
  try {
    if (!db.financialAccounts) return { success: false, updatedPaymentsCount: 0, updatedExpensesCount: 0 };

    // اطمینان از وجود حساب‌های پایه
    await seedDefaultFinancialAccounts(projectId);

    // یافتن حساب صندوق نقدی
    let cashAccount = await db.financialAccounts.where('type').equals('cash').first();
    if (!cashAccount) {
      cashAccount = await db.financialAccounts.get('acc_default_cash');
    }
    if (!cashAccount) {
      cashAccount = {
        id: 'acc_default_cash',
        name: 'صندوق نقدی کارگاه',
        type: 'cash'
      };
    }

    const cashId = cashAccount.id || 'acc_default_cash';
    const cashName = cashAccount.name || 'صندوق نقدی کارگاه';

    let updatedPaymentsCount = 0;
    let updatedExpensesCount = 0;

    // ۱. پرداختی‌های پرسنل (تسویه‌ها و مساعده‌های بسته شده)
    if (db.payments) {
      const allPayments = await db.payments.toArray();
      const paymentsToUpdate = [];

      for (const p of allPayments) {
        const isClosed = p.isSettled || p.status === 'settled' || p.type === 'settlement' || p.type === 'advance';
        const needsUpdate = forceAll || !p.accountId || !p.accountType || (p.paymentMethod === 'cash' && p.accountId !== cashId);
        
        if (isClosed && needsUpdate) {
          paymentsToUpdate.push({
            ...p,
            accountId: cashId,
            accountName: cashName,
            accountType: 'cash',
            paymentMethod: 'cash',
            updatedAt: new Date().toISOString()
          });
        }
      }

      if (paymentsToUpdate.length > 0) {
        await db.payments.bulkPut(paymentsToUpdate);
        updatedPaymentsCount = paymentsToUpdate.length;
        console.log(`✅ Migrated ${updatedPaymentsCount} closed payments to cash box.`);
      }
    }

    // ۲. هزینه‌های کارگاه که پرداخت شده‌اند
    if (db.expenses) {
      const allExpenses = await db.expenses.toArray();
      const expensesToUpdate = [];

      for (const exp of allExpenses) {
        const isPaid = exp.paymentStatus === 'paid' || !exp.paymentStatus;
        const needsUpdate = forceAll || !exp.accountId || !exp.accountType || (exp.paymentMethod === 'cash' && exp.accountId !== cashId);

        if (isPaid && needsUpdate) {
          expensesToUpdate.push({
            ...exp,
            accountId: cashId,
            accountName: cashName,
            accountType: 'cash',
            paymentMethod: 'cash',
            updatedAt: new Date().toISOString()
          });
        }
      }

      if (expensesToUpdate.length > 0) {
        await db.expenses.bulkPut(expensesToUpdate);
        updatedExpensesCount = expensesToUpdate.length;
        console.log(`✅ Migrated ${updatedExpensesCount} paid expenses to cash box.`);
      }
    }

    // ۳. ورودی‌های تنخواه نقدی بدون حساب
    if (db.treasuryIncomes) {
      const allIncomes = await db.treasuryIncomes.toArray();
      const incomesToUpdate = [];
      for (const inc of allIncomes) {
        if (inc.accountType === 'cash' && !inc.accountId) {
          incomesToUpdate.push({
            ...inc,
            accountId: cashId,
            accountName: cashName,
            updatedAt: new Date().toISOString()
          });
        }
      }
      if (incomesToUpdate.length > 0) {
        await db.treasuryIncomes.bulkPut(incomesToUpdate);
      }
    }

    return {
      success: true,
      updatedPaymentsCount,
      updatedExpensesCount,
      cashAccount
    };
  } catch (err) {
    console.error('migrateClosedTransactionsToCashBox error:', err);
    return { success: false, error: err, updatedPaymentsCount: 0, updatedExpensesCount: 0 };
  }
}

// Seed initial settings only (NO fake or dummy workers or logs)
export async function seedInitialDataIfEmpty(userId = 'default_user') {
  await purgeDummySeedWorkers();
  await ensureDefaultProjectExists(userId);
  await seedDefaultExpenseCategories(DEFAULT_PROJECT_ID, userId);
  await seedDefaultFinancialAccounts(DEFAULT_PROJECT_ID, userId);
  await migrateLegacyProjectExpenses();
  await purgeBankToBankTransfers();

  const settingsCount = await db.settings.count();
  const currentLang = (typeof localStorage !== 'undefined' ? (localStorage.getItem('workshop_lang') || localStorage.getItem('karsync_language')) : null) || 'ku';
  if (settingsCount === 0) {
    await db.settings.bulkAdd([
      { key: 'workshop_name', value: 'کارگەی ئاسنگەری و دارتاشی (Central Workshop)' },
      { key: 'default_currency', value: 'IQD' },
      { key: 'language', value: currentLang },
      { key: 'global_overdraft_policy', value: 'ask_each_time' }
    ]);
  } else {
    const existingLang = await db.settings.get('language');
    if (!existingLang) {
      await db.settings.put({ key: 'language', value: currentLang });
    }
    const existing = await db.settings.get('global_overdraft_policy');
    if (!existing) {
      await db.settings.put({ key: 'global_overdraft_policy', value: 'ask_each_time' });
    }
  }
}

/**
 * دریافت سیاست سراسری برداشت در صورت کسری موجودی
 * @returns {'always_allow' | 'ask_each_time' | 'never_allow'}
 */
export async function getGlobalOverdraftPolicy() {
  try {
    const s = await db.settings.get('global_overdraft_policy');
    return s?.value || 'ask_each_time';
  } catch {
    return 'ask_each_time';
  }
}

/**
 * ذخیره سیاست سراسری برداشت در صورت کسری موجودی
 * @param {'always_allow' | 'ask_each_time' | 'never_allow'} policy
 */
export async function setGlobalOverdraftPolicy(policy) {
  try {
    await db.settings.put({ key: 'global_overdraft_policy', value: policy });
    return true;
  } catch (err) {
    console.error('setGlobalOverdraftPolicy error:', err);
    return false;
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

/**
 * Reconciles and backfills isSettled flags for workers who have completed settlements.
 * Ensures all attendance logs and advances prior to a recorded settlement are marked isSettled = true.
 */
export async function reconcileSettlementEpochs() {
  try {
    const allPayments = await db.payments.toArray();
    const settlements = allPayments.filter(
      (p) => !p.deletedAt && (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled')
    );

    if (settlements.length === 0) return;

    let totalLogsUpdated = [];
    let totalAdvancesUpdated = [];

    const referencedReceiptIds = new Set();
    (await db.attendanceLogs.toArray()).forEach((l) => {
      if (l.settlementReceiptId) referencedReceiptIds.add(String(l.settlementReceiptId));
    });
    allPayments.forEach((p) => {
      if (p.settlementReceiptId) referencedReceiptIds.add(String(p.settlementReceiptId));
    });

    for (const st of settlements) {
      const effectivePeriodEnd = st.periodEndDate || (st.month ? `${st.month}-31` : (st.date || '9999-12-31'));
      const stDate = effectivePeriodEnd;

      let workerIdsToSettle = [];
      if (st.workerId) {
        workerIdsToSettle.push(String(st.workerId));
      }

      // If settlement is explicitly an active group settlement, include all group members
      if (st.isGroupSettlement && st.groupId) {
        const groupWorkers = await db.workers.filter((w) => w.groupId === st.groupId).toArray();
        groupWorkers.forEach((w) => {
          const wIdStr = String(w.id);
          if (!workerIdsToSettle.includes(wIdStr)) workerIdsToSettle.push(wIdStr);
        });
      }

      for (const workerIdStr of workerIdsToSettle) {
        // Clean any wrongly settled future logs worked strictly after settlement cutoff
        const workerLogs = await db.attendanceLogs.where('workerId').equals(workerIdStr).toArray();
        const wronglySettled = workerLogs.filter((l) => l.settlementReceiptId === st.id && (l.date || '') > effectivePeriodEnd);
        if (wronglySettled.length > 0) {
          const cleanWrongly = wronglySettled.map((l) => {
            let cleanNotes = l.notes || '';
            if (cleanNotes.includes('"st":1') || cleanNotes.includes('"st": 1')) {
              cleanNotes = cleanNotes.replace(/"st":\s*1,?/g, '').replace(/,"rid":\s*"[^"]*"/g, '').replace(/"rid":\s*"[^"]*",?/g, '');
            }
            return {
              ...l,
              isSettled: false,
              settlementReceiptId: null,
              notes: cleanNotes,
              updatedAt: new Date().toISOString()
            };
          });
          await db.attendanceLogs.bulkPut(cleanWrongly);
        }
      }

      if (referencedReceiptIds.has(String(st.id))) {
        continue;
      }

      for (const workerIdStr of workerIdsToSettle) {
        // 1. Mark logs on or before settlement period end date as settled
        const workerLogs = await db.attendanceLogs.where('workerId').equals(workerIdStr).toArray();
        const logsToSettle = workerLogs.filter((l) => (!l.isSettled || !l.settlementReceiptId) && l.date <= stDate);

        if (logsToSettle.length > 0) {
          const updatedLogs = logsToSettle.map((l) => ({
            ...l,
            isSettled: true,
            settlementReceiptId: l.settlementReceiptId || st.id,
            updatedAt: new Date().toISOString()
          }));
          await db.attendanceLogs.bulkPut(updatedLogs);
          totalLogsUpdated.push(...updatedLogs);
        }

        // Ensure logs strictly AFTER this settlement period end date are NOT marked settled by this settlement
        const falselySettledLogs = workerLogs.filter((l) => 
          (l.settlementReceiptId === st.id || (l.isSettled && !l.settlementReceiptId)) && l.date > stDate
        );
        if (falselySettledLogs.length > 0) {
          const resetLogs = falselySettledLogs.map((l) => {
            let cleanNotes = l.notes || '';
            if (cleanNotes.includes('"st":1') || cleanNotes.includes('"st": 1')) {
              cleanNotes = cleanNotes.replace(/"st":\s*1,?/g, '').replace(/,"rid":\s*"[^"]*"/g, '').replace(/"rid":\s*"[^"]*",?/g, '');
            }
            return {
              ...l,
              isSettled: false,
              settlementReceiptId: null,
              notes: cleanNotes,
              updatedAt: new Date().toISOString()
            };
          });
          await db.attendanceLogs.bulkPut(resetLogs);
        }

        // 2. Mark previous advances on or before settlement date as settled
        const workerAdvances = allPayments.filter(
          (p) => !p.deletedAt && 
                 String(p.workerId) === workerIdStr && 
                 p.id !== st.id && 
                 (p.type === 'advance' || p.type === 'Advance_Payment') && 
                 (!p.isSettled || !p.settlementReceiptId) && 
                 (p.date || '') <= stDate
        );

        if (workerAdvances.length > 0) {
          const updatedAdvances = workerAdvances.map((p) => ({
            ...p,
            isSettled: true,
            settlementReceiptId: p.settlementReceiptId || st.id,
            updatedAt: new Date().toISOString()
          }));
          await db.payments.bulkPut(updatedAdvances);
          totalAdvancesUpdated.push(...updatedAdvances);
        }
      }
    }

    return { totalLogsUpdated, totalAdvancesUpdated };
  } catch (err) {
    console.warn('reconcileSettlementEpochs warning:', err);
    return { totalLogsUpdated: [], totalAdvancesUpdated: [] };
  }
}

/**
 * بررسی تایید نهایی بودن سند
 */
export function isRecordApproved(record) {
  if (!record) return false;
  return record.status === 'approved' || record.approval_status === 'approved';
}

/**
 * بررسی امکان حذف پرسنل (Worker Deletion Protection)
 * شروط منع قطعی حذف:
 * ۱. داشتن حتی ۱ ساعت سابقه ثبت کارکرد در attendanceLogs
 * ۲. داشتن هرگونه سند مالی موقت یا غیرموقت در payments (مساعده، تسویه)
 * پرسنل در این شرایط تحت هیچ عنوانی نباید قابل حذف باشند، اما قابلیت بایگانی (آرشیو) برقرار است.
 */
export async function canDeleteWorker(workerId) {
  if (!workerId) return { canDelete: true };
  const strId = String(workerId);

  // ۱. بررسی سوابق حضور و غیاب / کارکرد
  const logsCount = await db.attendanceLogs
    .where('workerId')
    .equals(strId)
    .count();

  if (logsCount > 0) {
    return {
      canDelete: false,
      reason: 'attendance',
      count: logsCount,
      message: 'این نیرو دارای سابقه ثبت کارکرد در پروژه است و طبق استانداردهای حسابداری و مقررات مالیاتی تحت هیچ شرایطی قابل حذف نیست. می‌توانید وضعیت ایشان را به «بایگانی» تغییر دهید.'
    };
  }

  // ۲. بررسی اسناد مالی (مساعده، تسویه حساب موقت یا دائم)
  const paymentsCount = await db.payments
    .where('workerId')
    .equals(strId)
    .count();

  if (paymentsCount > 0) {
    return {
      canDelete: false,
      reason: 'financial',
      count: paymentsCount,
      message: 'برای این نیرو اسناد مالی (مساعده یا تسویه حساب) ثبت شده است و جهت حفظ یکپارچگی دفاتر حسابداری قابل حذف نیست. می‌توانید وضعیت ایشان را به «بایگانی» تغییر دهید.'
    };
  }

  // ۳. بررسی اسناد هزینه و مخارج منتسب به شخص
  const expensesCount = await db.expenses
    .where('personId')
    .equals(strId)
    .count();

  if (expensesCount > 0) {
    return {
      canDelete: false,
      reason: 'expense',
      count: expensesCount,
      message: 'برای این نیرو اسناد هزینه و مخارج ثبت شده است و جهت حفظ یکپارچگی دفاتر مالی قابل حذف نیست. می‌توانید وضعیت ایشان را به «بایگانی» تغییر دهید.'
    };
  }

  return { canDelete: true };
}

/**
 * بررسی عدم تغییرپذیری سند تایید شده (Immutability Check)
 * اگر وضعیت سند 'approved' باشد، اجازه ویرایش، آرشیو یا حذف داده نمی‌شود.
 */
export function assertRecordMutable(record) {
  if (!record) return;
  if (isRecordApproved(record)) {
    const error = new Error('403 Forbidden: این سند تایید نهایی شده است و به دلایل حفظ نظم حسابداری و مقررات مالیاتی غیرقابل ویرایش، آرشیو یا حذف می‌باشد. در صورت نیاز از صدور اصلاحیه استفاده نمایید.');
    error.statusCode = 403;
    error.code = 'RECORD_IMMUTABLE';
    throw error;
  }
}

/**
 * پاکسازی 플래گ اصلاحیه آزمایشی قدیمی که مبلغ آن تغییر نکرده بود
 */
export async function purgeBankToBankTransfers() {
  try {
    if (db.payments) {
      const legacyAmended = await db.payments.get('pay_mu78pbii_r6wsv');
      if (legacyAmended && legacyAmended.isAmended && Number(legacyAmended.amount) === Number(legacyAmended.originalAmount)) {
        const cleaned = { ...legacyAmended };
        delete cleaned.isAmended;
        delete cleaned.originalAmount;
        delete cleaned.previousAmount;
        delete cleaned.amendmentReason;
        delete cleaned.amendedBy;
        delete cleaned.amended_by;
        delete cleaned.amendedAt;
        delete cleaned.amendmentHistory;
        await db.payments.put(cleaned);
      }
    }
  } catch (err) {
    console.warn('purgeBankToBankTransfers notice:', err);
  }
}

/**
 * متد تایید نهایی سند و اعمال سیستم دو مرحله‌ای (Two-Stage Verification)
 * همراه با چک دقیق نقش کاربر (تنها کاربر ادمین با هویت معتبر اجازه تایید دارد)
 */
export async function approveRecord(tableName, recordId, currentUser = null) {
  if (!currentUser || currentUser.role !== 'admin') {
    const error = new Error('تنها کاربران با نقش «مدیر ارشد (Admin)» مجاز به تایید نهایی اسناد هستند.');
    error.statusCode = 403;
    error.code = 'ROLE_UNAUTHORIZED';
    throw error;
  }

  const table = db.table(tableName);
  if (!table) {
    throw new Error(`Table ${tableName} not found in database.`);
  }

  // اصلاح شناسه اسناد انتقال وجه در صورتی که پسوند جهت جریان داشته باشند
  const cleanRecordId = tableName === 'accountTransfers' 
    ? String(recordId).replace(/_(in|out)$/, '') 
    : recordId;

  const record = await table.get(cleanRecordId);
  if (!record) {
    throw new Error(`Record ${cleanRecordId} not found in ${tableName}.`);
  }

  const now = new Date().toISOString();
  const userId = currentUser?.id || currentUser?.userId || 'admin';
  const userName = currentUser?.name || currentUser?.title || currentUser?.email || 'مدیر';

  const updatePayload = {
    status: 'approved',
    approval_status: 'approved', // سازگاری با payments
    approved_by: userId,
    approvedBy: userName,
    approved_by_name: userName,
    approved_at: now,
    approvedAt: now,
    updatedAt: now
  };

  await table.update(cleanRecordId, updatePayload);
  return { ...record, ...updatePayload };
}

/**
 * تایید نهایی گروهی اسناد (Batch / Bulk Approval)
 * @param {Array<{ tableName: string, recordId: string | number }>} items
 * @param {object} currentUser
 */
export async function batchApproveRecords(items, currentUser = null) {
  if (!currentUser || currentUser.role !== 'admin') {
    const error = new Error('تنها کاربران با نقش «مدیر ارشد (Admin)» مجاز به تایید نهایی اسناد هستند.');
    error.statusCode = 403;
    error.code = 'ROLE_UNAUTHORIZED';
    throw error;
  }

  if (!Array.isArray(items) || items.length === 0) return [];

  const now = new Date().toISOString();
  const userId = currentUser?.id || currentUser?.userId || 'admin';
  const userName = currentUser?.name || currentUser?.title || currentUser?.email || 'مدیر';

  const updatePayload = {
    status: 'approved',
    approval_status: 'approved',
    approved_by: userId,
    approvedBy: userName,
    approved_by_name: userName,
    approved_at: now,
    approvedAt: now,
    updatedAt: now
  };

  const results = [];
  const processedTransfers = new Set();
  for (const item of items) {
    const { tableName } = item;
    let { recordId } = item;
    if (tableName === 'accountTransfers') {
      recordId = String(recordId).replace(/_(in|out)$/, '');
      if (processedTransfers.has(recordId)) continue;
      processedTransfers.add(recordId);
    }
    const table = db.table(tableName);
    if (table) {
      await table.update(recordId, updatePayload);
      results.push({ tableName, recordId, success: true });
    }
  }

  return results;
}

/**
 * صدور سند اصلاحیه برای سند تایید نهایی شده (Amendment / Adjustment)
 * با حفظ کامل تاریخچه حسابداری و پیوند به سند اولیه
 * @param {string} tableName - 'payments' | 'expenses' | 'treasuryIncomes'
 * @param {string|number} recordId
 * @param {object} amendmentData - { amount, reason, notes, date }
 * @param {object} currentUser
 */
export async function amendRecord(tableName, recordId, amendmentData, currentUser = null) {
  if (!currentUser || currentUser.role !== 'admin') {
    const error = new Error('تنها کاربران با نقش «مدیر ارشد (Admin)» مجاز به صدور اصلاحیه اسناد هستند.');
    error.statusCode = 403;
    error.code = 'ROLE_UNAUTHORIZED';
    throw error;
  }

  const table = db.table(tableName);
  if (!table) {
    throw new Error(`Table ${tableName} not found in database.`);
  }

  const cleanRecordId = tableName === 'accountTransfers' 
    ? String(recordId).replace(/_(in|out)$/, '') 
    : recordId;

  const record = await table.get(cleanRecordId);
  if (!record) {
    throw new Error(`Record ${cleanRecordId} not found in ${tableName}.`);
  }

  const now = new Date().toISOString();
  const userId = currentUser?.id || currentUser?.userId || 'admin';
  const userName = currentUser?.name || currentUser?.title || currentUser?.email || 'مدیر';

  const prevAmount = Number(record.amount) || 0;
  const newAmount = Number(amendmentData.amount !== undefined ? amendmentData.amount : prevAmount);

  const historyEntry = {
    previousAmount: prevAmount,
    newAmount: newAmount,
    diffAmount: newAmount - prevAmount,
    reason: amendmentData.reason || 'اصلاحیه مشخصات یا مبلغ سند',
    notes: amendmentData.notes || '',
    amendedBy: userName,
    amended_by: userId,
    amendedAt: now
  };

  const existingHistory = Array.isArray(record.amendmentHistory) ? record.amendmentHistory : [];

  const updatePayload = {
    amount: newAmount,
    isAmended: true,
    originalAmount: record.originalAmount !== undefined ? record.originalAmount : prevAmount,
    previousAmount: prevAmount,
    amendmentReason: amendmentData.reason || 'اصلاحیه مشخصات یا مبلغ سند',
    amendedBy: userName,
    amended_by: userId,
    amendedAt: now,
    amendmentHistory: [...existingHistory, historyEntry],
    updatedAt: now
  };

  if (amendmentData.date) {
    if (tableName === 'expenses') updatePayload.expenseDate = amendmentData.date;
    else updatePayload.date = amendmentData.date;
  }

  if (amendmentData.notes) {
    updatePayload.notes = amendmentData.notes;
  }

  await table.update(cleanRecordId, updatePayload);
  return { ...record, ...updatePayload };
}


