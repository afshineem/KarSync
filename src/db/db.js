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

// Helper to generate UUIDs
export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
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

export async function seedDefaultExpenseCategories(projectId = DEFAULT_PROJECT_ID, userId = 'default_user') {
  try {
    const existingCount = await db.expenseCategories.where('projectId').equals(projectId).count();
    if (existingCount > 0) return;

    const categoriesToAdd = [];
    const now = new Date().toISOString();

    DEFAULT_EXPENSE_CATEGORIES_TREE.forEach((mainGroup, mainIdx) => {
      const mainId = `cat_l1_${projectId.slice(-6)}_${mainIdx + 1}_${Date.now().toString(36)}`;
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
        const subId = `cat_l2_${projectId.slice(-6)}_${mainIdx + 1}_${subIdx + 1}_${Date.now().toString(36)}`;
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
          const itemId = `cat_l3_${projectId.slice(-6)}_${mainIdx + 1}_${subIdx + 1}_${itemIdx + 1}_${Date.now().toString(36)}`;
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

// Seed initial settings only (NO fake or dummy workers or logs)
export async function seedInitialDataIfEmpty(userId = 'default_user') {
  await purgeDummySeedWorkers();
  await ensureDefaultProjectExists(userId);
  await seedDefaultExpenseCategories(DEFAULT_PROJECT_ID, userId);
  await migrateLegacyProjectExpenses();

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

