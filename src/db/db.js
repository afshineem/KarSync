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
db.payments.hook('deleting', function (primKey, obj) {
  if (obj && (obj.status === 'approved' || obj.approval_status === 'approved')) {
    throw new Error('403 Forbidden: اسناد مالی تایید نهایی شده به جهت الزامات مالیاتی و تعادل حسابداری غیرقابل حذف هستند.');
  }
});

db.expenses.hook('deleting', function (primKey, obj) {
  if (obj && (obj.status === 'approved' || obj.approval_status === 'approved')) {
    throw new Error('403 Forbidden: هزینه‌های کارگاه با سند تایید نهایی شده به جهت الزامات مالیاتی غیرقابل حذف هستند.');
  }
});

// Ensure at least one active project exists and migrate legacy records to it
export async function ensureDefaultProjectExists(userId = 'default_user') {
  try {
    const projectCount = await db.projects.count();
    let currentDefault = await db.projects.get(DEFAULT_PROJECT_ID);

    if (projectCount === 0 || !currentDefault) {
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

    // Forcefully migrate ALL workers, logs, and payments without a valid projectId
    const allWorkers = await db.workers.toArray();
    for (const w of allWorkers) {
      if (!w.projectId) {
        await db.workers.update(w.id, { projectId: DEFAULT_PROJECT_ID, userId: w.userId || userId || 'default_user' });
      }
    }

    const allLogs = await db.attendanceLogs.toArray();
    for (const l of allLogs) {
      if (!l.projectId) {
        await db.attendanceLogs.update(l.id, { projectId: DEFAULT_PROJECT_ID, userId: l.userId || userId || 'default_user' });
      }
    }

    const allPayments = await db.payments.toArray();
    for (const p of allPayments) {
      if (!p.projectId) {
        await db.payments.update(p.id, { projectId: DEFAULT_PROJECT_ID, userId: p.userId || userId || 'default_user' });
      }
    }

    return currentDefault;
  } catch (err) {
    console.warn('ensureDefaultProjectExists warning:', err);
    return null;
  }
}

// Default 3-Tier Expense Categories Structure
export const DEFAULT_EXPENSE_CATEGORIES_TREE = [
  {
    name: 'مصالح و متریال ساختمانی',
    subcategories: [
      {
        name: 'مصالح پایه‌ای',
        items: ['سیمان تیپ ۲ و ۵', 'ماسه شسته و بادی', 'گچ و خاک ساختمانی', 'آجر فشاری و بلوک سیمانی']
      },
      {
        name: 'آهن‌آلات و سازه فلزی',
        items: ['میلگرد و خاموت', 'تیرآهن و ناودانی', 'قوطی و پروفیل آهن', 'الکترود و سیم جوش']
      },
      {
        name: 'عایق و شیمیایی ساختمان',
        items: ['ایزوگام و قیر', 'چسب بتن و سنگ', 'ضدزنگ و رنگ روغنی', 'تینر و حلال‌ها']
      }
    ]
  },
  {
    name: 'ماشین‌آلات و تجهیزات',
    subcategories: [
      {
        name: 'اجاره ماشین‌آلات سنگین',
        items: ['اجاره جرثقیل و بالابر', 'لودر و بیل مکانیکی', 'بتونیر و میکسر', 'کمپرسور و چکش برقی']
      },
      {
        name: 'سوخت و نگهداری دستگاه‌ها',
        items: ['گازوئیل ژنراتور و موتور برق', 'بنزین و روغن هیدرولیک', 'سرویس دوره‌ای و تعویض قطعه']
      },
      {
        name: 'ابزارآلات و تجهیزات کارگاه',
        items: ['صفحه برش و سنگ فرز', 'مته، دریل و قلم بتن‌کن', 'کابل برق و پروژکتور کارگاهی', 'تجهیزات و عینک ایمنی']
      }
    ]
  },
  {
    name: 'پیمانکاری و خدمات فنی',
    subcategories: [
      {
        name: 'حمل و نقل و باربری',
        items: ['کرایه نیسان و خاور', 'کرایه تریلی و کفی', 'دستمزد کارگر تخلیه بار']
      },
      {
        name: 'تأسیسات مکانیکی و آب',
        items: ['لوله و اتصالات پلیکا/پلی‌اتیلن', 'شیرآلات و اتصالات برنجی', 'پمپ و مخزن آب موقت']
      },
      {
        name: 'تأسیسات الکتریکی و تابلو برق',
        items: ['کابل‌کشی و جعبه فیوز', 'کلید و پریز صنعتی', 'انشعاب موقت برق']
      }
    ]
  },
  {
    name: 'هزینه‌های جاری و تنخواه',
    subcategories: [
      {
        name: 'خوراک و پذیرایی پرسنل',
        items: ['چای، قند و ملزومات', 'ناهار و وعده غذایی گروهی', 'آب آشامیدنی و یخ کارگاه']
      },
      {
        name: 'ایمنی و بهداشت (HSE)',
        items: ['کفش و کلاه ایمنی', 'دستکش کار و عینک محافظ', 'شارژ کپسول آتش‌نشانی', 'جعبه کمک‌های اولیه']
      },
      {
        name: 'اداری و تنخواه عمومی کارگاه',
        items: ['شارژ اینترنت و قبوض ارتباطی', 'دفتر، پوشه و اقلام اداری', 'هزینه ایاب و ذهاب اداری']
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
    const existingCount = await db.expenseCategories.where('projectId').equals(projectId).count();
    if (existingCount > 0) return;

    const categoriesToAdd = [];
    const now = new Date().toISOString();

    DEFAULT_EXPENSE_CATEGORIES_TREE.forEach((mainGroup, mainIdx) => {
      const mainId = `cat_l1_${projectId.slice(-6)}_${mainIdx + 1}`;
      categoriesToAdd.push({
        id: mainId,
        projectId,
        userId: userId || 'default_user',
        name: mainGroup.name,
        parentId: null,
        level: 1,
        createdAt: now
      });

      mainGroup.subcategories.forEach((subGroup, subIdx) => {
        const subId = `cat_l2_${projectId.slice(-6)}_${mainIdx + 1}_${subIdx + 1}`;
        categoriesToAdd.push({
          id: subId,
          projectId,
          userId: userId || 'default_user',
          name: subGroup.name,
          parentId: mainId,
          level: 2,
          createdAt: now
        });

        subGroup.items.forEach((item, itemIdx) => {
          const itemId = `cat_l3_${projectId.slice(-6)}_${mainIdx + 1}_${subIdx + 1}_${itemIdx + 1}`;
          categoriesToAdd.push({
            id: itemId,
            projectId,
            userId: userId || 'default_user',
            name: item,
            parentId: subId,
            level: 3,
            createdAt: now
          });
        });
      });
    });

    if (categoriesToAdd.length > 0) {
      await db.expenseCategories.bulkPut(categoriesToAdd);
      console.log(`✅ Seeded ${categoriesToAdd.length} 3-tier expense categories for project:`, projectId);
    }
  } catch (err) {
    console.warn('seedDefaultExpenseCategories warning:', err);
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
        bankName: 'بانک ملت',
        holderName: 'کارفرما',
        cardNumber: '',
        accountNumber: '',
        initialBalance: existingBank?.initialBalance || 0,
        isDefault: activeCash ? false : true,
        isActive: true,
        color: 'sky',
        notes: 'کارت بانکی تنخواه جهت واریزی‌های کارفرما و پرداخت‌های آنلاین',
        deletedAt: null,
        status: 'active',
        createdAt: existingBank?.createdAt || now,
        updatedAt: now
      };
      await db.financialAccounts.put(bankRecord);
      changed = true;
      console.log('✅ Restored/seeded default bank card (acc_default_bank).');
    }

    // اطمینان از وجود حداقل یک حساب پیش‌فرض فعال
    const currentList = await db.financialAccounts.toArray();
    const hasDefault = currentList.some((a) => a.isDefault && !a.deletedAt && a.status !== 'deleted');
    if (!hasDefault && currentList.length > 0) {
      const targetDefault = currentList.find((a) => a.type === 'cash' && !a.deletedAt) || currentList[0];
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
  if (settingsCount === 0) {
    await db.settings.bulkAdd([
      { key: 'workshop_name', value: 'کارگەی ئاسنگەری و دارتاشی (Central Workshop)' },
      { key: 'default_currency', value: 'IQD' },
      { key: 'language', value: 'ku' },
      { key: 'global_overdraft_policy', value: 'ask_each_time' }
    ]);
  } else {
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

    for (const st of settlements) {
      let stDate = st.date || (st.createdAt ? st.createdAt.slice(0, 10) : '9999-12-31');
      if (st.createdAt && st.createdAt.startsWith('2026-09') && st.createdAt <= '2026-09-22' && stDate < '2026-09-20') {
        stDate = '2026-09-20';
        await db.payments.update(st.id, { date: '2026-09-20', updatedAt: new Date().toISOString() });
      }
      let workerIdsToSettle = [];

      if (st.workerId) {
        workerIdsToSettle.push(String(st.workerId));
      }

      // If settlement is explicitly an active group settlement, find all group members
      if (st.isGroupSettlement && st.groupId) {
        const groupWorkers = await db.workers.filter((w) => w.groupId === st.groupId).toArray();
        groupWorkers.forEach((w) => {
          const wIdStr = String(w.id);
          if (!workerIdsToSettle.includes(wIdStr)) workerIdsToSettle.push(wIdStr);
        });
      }

      for (const workerIdStr of workerIdsToSettle) {
        // 1. Mark logs on or before settlement date as settled
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
 * پاکسازی اسناد انتقال بانک به بانک ایجاد شده قبلی از پایگاه داده محلی و ابری طبق درخواست کاربر
 */
export async function purgeBankToBankTransfers() {
  try {
    if (!db.accountTransfers) return;
    const allTransfers = await db.accountTransfers.toArray();
    if (!allTransfers || allTransfers.length === 0) return;

    // شناسایی ۲ سند انتقال بانک به بانک ایجاد شده پیش از اصلاحیه
    const toDelete = allTransfers.filter((trf) => {
      const isBankToBank = (trf.fromAccountType === 'bank' && trf.toAccountType === 'bank');
      const isLegacyAutoApproved = (trf.status === 'approved' && (trf.approved_by === 'admin' || !trf.approvedBy || trf.approvedBy === 'مدیر سیستم'));
      return isBankToBank || isLegacyAutoApproved;
    });

    if (toDelete.length > 0) {
      for (const item of toDelete) {
        await db.accountTransfers.delete(item.id);
      }
      try {
        const { deleteAccountTransferLive } = await import('../services/realtimeSync');
        for (const item of toDelete) {
          await deleteAccountTransferLive(item.id);
        }
      } catch (cloudErr) {
        console.warn('Realtime cloud sync for purged transfers deferred:', cloudErr);
      }
      console.log(`✅ [KarSync DB] Successfully purged ${toDelete.length} bank-to-bank transfer documents.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('workshop-transfers-sync'));
        window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
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


