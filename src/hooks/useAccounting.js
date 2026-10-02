import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  db, 
  DEFAULT_PROJECT_ID, 
  generateTreasuryIncomeId, 
  generateAccountId, 
  generateTransferId,
  seedDefaultFinancialAccounts, 
  purgeBankToBankTransfers,
  migrateClosedTransactionsToCashBox,
  getGlobalOverdraftPolicy,
  setGlobalOverdraftPolicy
} from '../db/db';
import { 
  pushFinancialAccountLive, 
  deleteFinancialAccountLive, 
  pushTreasuryIncomeLive, 
  deleteTreasuryIncomeLive, 
  pushAccountTransferLive,
  deleteAccountTransferLive,
  pushGlobalOverdraftPolicyLive, 
  pullFinancialAccountsLive, 
  pullTreasuryIncomesLive, 
  pullAccountTransfersLive,
  pullGlobalOverdraftPolicyLive,
  syncFinancialDataLive,
  softDeleteExpenseLive,
  recordPendingPaymentDeletion,
  pushPaymentsLive,
  rollbackPaymentSettlement
} from '../services/realtimeSync';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { getCurrentYearMonth, getTodayDateString, roundCurrency } from '../utils/formatters';

/**
 * useAccounting
 * هوک اختصاصی مدیریت داده‌های مالی، خزانه‌داری، تراز و دفتر کل KarSync
 * 
 * وظایف اصلی:
 * ۱. خواندن زنده و یکپارچه داده‌های تنخواه، پرداختی‌های پرسنل، هزینه‌ها و انتقالات از Dexie IndexedDB
 * ۲. محاسبه زنده کارت‌های ۴گانه داشبورد تراز مالی (ورودی‌ها، خروجی پرسنل، خروجی فاکتورها، مانده صندوق)
 * ۳. ساخت دفتر کل تراکنش‌ها (General Ledger) با محاسبه خودکار «موجودی پس از تراکنش» (Running Balance)
 * ۴. تجمیع روزانه جریان نقدینگی (Cash Flow) جهت رسم نمودار میله‌ای دوگانه
 * ۵. ارائه توابع ثبت، ویرایش، انتقال و حذف واریزی‌ها و تنخواه
 */
export function useAccounting(options = {}) {
  const { currentProject } = useProject();
  const { user } = useAuth();

  const projectId = currentProject?.id || DEFAULT_PROJECT_ID;
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  // فیلترهای تب حسابداری
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentYearMonth());
  const [dateFilterMode, setDateFilterMode] = useState('month'); // 'month' | 'all' | 'this_month' | 'last_month' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'petty_cash' | 'worker_settlement' | 'advance_payment' | 'workshop_expense' | 'account_transfer'
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all'); // 'all' | 'cash' | 'bank'
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('all'); // 'all' | 'draft' | 'approved' | 'amended'

  const [syncTick, setSyncTick] = useState(0);

  // گوش دادن به رویدادهای همگام‌سازی ابری و بارگذاری اولیه داده‌های مالی
  useEffect(() => {
    const handleSync = () => {
      setSyncTick((t) => t + 1);
    };
    window.addEventListener('workshop-accounts-sync', handleSync);
    window.addEventListener('workshop-incomes-sync', handleSync);
    window.addEventListener('workshop-transfers-sync', handleSync);

    pullFinancialAccountsLive().catch(console.warn);
    pullTreasuryIncomesLive().catch(console.warn);
    pullAccountTransfersLive().catch(console.warn);
    pullGlobalOverdraftPolicyLive().catch(console.warn);
    purgeBankToBankTransfers().catch(console.warn);

    return () => {
      window.removeEventListener('workshop-accounts-sync', handleSync);
      window.removeEventListener('workshop-incomes-sync', handleSync);
      window.removeEventListener('workshop-transfers-sync', handleSync);
    };
  }, []);

  // ----------------------------------------------------
  // ۱. فراخوانی زنده داده‌ها از IndexedDB (Real-time Live Queries)
  // ----------------------------------------------------

  // الف) پرسنل پروژه جهت بازیابی نام‌ها
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => !w.deletedAt && (!w.projectId || w.projectId === projectId || projectId === DEFAULT_PROJECT_ID));
    },
    [projectId]
  ) || [];

  const workerMap = useMemo(() => {
    const map = new Map();
    workers.forEach((w) => {
      map.set(String(w.id), w.name);
    });
    return map;
  }, [workers]);

  // ب) واریزی‌ها و شارژ تنخواه (Treasury Incomes)
  const treasuryIncomes = useLiveQuery(
    async () => {
      if (!db.treasuryIncomes) return [];
      const list = await db.treasuryIncomes.toArray();
      return list
        .filter((inc) => !inc.deletedAt && (!inc.projectId || inc.projectId === projectId || projectId === DEFAULT_PROJECT_ID))
        .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    },
    [projectId, syncTick]
  ) || [];

  // ج) پرداختی‌های مالی به پرسنل (مساعده + تسویه حساب‌ها)
  const payments = useLiveQuery(
    async () => {
      const list = await db.payments.toArray();
      const projectWorkerIds = new Set(workers.map((w) => String(w.id)));

      return list
        .filter((p) => {
          if (p.deletedAt) return false;
          const matchesProject = !p.projectId || p.projectId === projectId || projectId === DEFAULT_PROJECT_ID || projectWorkerIds.has(String(p.workerId));
          if (!matchesProject) return false;
          // فقط مساعده‌ها و تسویه‌ها خروجی واقعی پول هستند
          const isAdvance = p.type === 'advance';
          const isSettlement = p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled';
          return isAdvance || isSettlement;
        })
        .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    },
    [projectId, workers, syncTick]
  ) || [];

  // د) هزینه‌های کارگاه (فاکتورها و ماشین‌آلات)
  const expenses = useLiveQuery(
    async () => {
      if (!db.expenses) return [];
      const list = await db.expenses.toArray();
      return list
        .filter((e) => {
          if (e.deletedAt) return false;
          const matchesProject = !e.projectId || e.projectId === projectId || projectId === DEFAULT_PROJECT_ID;
          if (!matchesProject) return false;
          // طبق دستور کاربر: فقط فاکتورهایی که به حالت "پرداخت شده" درآمده‌اند، خروجی نقدینگی محسوب می‌شوند
          return e.paymentStatus === 'paid';
        })
        .sort((a, b) => (b.expenseDate || b.createdAt || '').localeCompare(a.expenseDate || a.createdAt || ''));
    },
    [projectId, syncTick]
  ) || [];

  // ه) حساب‌های مالی (کارت‌های بانکی و صندوق‌های نقدی)
  const financialAccounts = useLiveQuery(
    async () => {
      if (!db.financialAccounts) return [];
      let list = await db.financialAccounts.toArray();
      const hasActiveCash = list.some((acc) => acc.type === 'cash' && !acc.deletedAt && acc.status !== 'deleted');
      const hasActiveBank = list.some((acc) => acc.type === 'bank' && !acc.deletedAt && acc.status !== 'deleted');
      if (!hasActiveCash || !hasActiveBank) {
        await seedDefaultFinancialAccounts(projectId, user?.id);
        list = await db.financialAccounts.toArray();
      }
      list = list.filter((acc) => !acc.deletedAt && (!acc.projectId || acc.projectId === projectId || projectId === DEFAULT_PROJECT_ID));
      return list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
    },
    [projectId, user, syncTick]
  ) || [];

  const defaultAccount = useMemo(() => {
    return financialAccounts.find((a) => a.isDefault && a.isActive) || financialAccounts[0] || null;
  }, [financialAccounts]);

  const accountMap = useMemo(() => {
    const map = new Map();
    financialAccounts.forEach((acc) => {
      map.set(String(acc.id), acc);
    });
    return map;
  }, [financialAccounts]);

  // و) تراکنش‌های انتقال وجه بین حساب‌ها (کارت به کارت / صندوق به بانک)
  const accountTransfers = useLiveQuery(
    async () => {
      if (!db.accountTransfers) return [];
      const list = await db.accountTransfers.toArray();
      return list
        .filter((trf) => !trf.deletedAt && (!trf.projectId || trf.projectId === projectId || projectId === DEFAULT_PROJECT_ID))
        .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    },
    [projectId, syncTick]
  ) || [];

  // سیاست سراسری اضافه برداشت (Overdraft Policy)
  const globalOverdraftSetting = useLiveQuery(
    async () => {
      return await getGlobalOverdraftPolicy();
    },
    []
  );
  const globalOverdraftPolicy = globalOverdraftSetting || 'ask_each_time';

  const updateGlobalOverdraftPolicy = useCallback(async (newPolicy) => {
    await setGlobalOverdraftPolicy(newPolicy);
    pushGlobalOverdraftPolicyLive(newPolicy).catch(console.warn);
  }, []);

  // ----------------------------------------------------
  // ۲. توابع کمکی تاریخ برای اعمال بازه‌های فیلتر
  // ----------------------------------------------------
  const currentMonthPrefix = getCurrentYearMonth(); // مثلاً 2026-09
  const lastMonthPrefix = useMemo(() => {
    const [y, m] = currentMonthPrefix.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${prevY}-${prevM}`;
  }, [currentMonthPrefix]);

  const checkDateMatch = useCallback((dateStr) => {
    if (!dateStr) return true;
    const cleanDate = dateStr.slice(0, 10);

    if (dateFilterMode === 'month' || dateFilterMode === 'this_month') {
      const targetMonth = selectedMonth || currentMonthPrefix;
      return cleanDate.startsWith(targetMonth);
    }
    if (dateFilterMode === 'last_month') {
      return cleanDate.startsWith(lastMonthPrefix);
    }
    if (dateFilterMode === 'custom') {
      if (customStartDate && cleanDate < customStartDate) return false;
      if (customEndDate && cleanDate > customEndDate) return false;
      return true;
    }
    return true; // 'all'
  }, [dateFilterMode, selectedMonth, currentMonthPrefix, lastMonthPrefix, customStartDate, customEndDate]);

  // ----------------------------------------------------
  // ۲.۵ محاسبه زنده موجودی و دفتر معین تک‌تک حساب‌ها و صندوق‌ها
  // ----------------------------------------------------
  const accountBalances = useMemo(() => {
    const defaultCash = financialAccounts.find((a) => a.type === 'cash' && a.isDefault) || financialAccounts.find((a) => a.type === 'cash');
    const defaultBank = financialAccounts.find((a) => a.type === 'bank' && a.isDefault) || financialAccounts.find((a) => a.type === 'bank');
    const defaultCashId = defaultCash ? String(defaultCash.id) : null;
    const defaultBankId = defaultBank ? String(defaultBank.id) : null;

    const map = new Map();

    financialAccounts.forEach((acc) => {
      map.set(String(acc.id), {
        account: acc,
        initialBalance: Number(acc.initialBalance) || 0,
        totalInflow: 0,
        totalOutflow: 0,
        currentBalance: Number(acc.initialBalance) || 0,
        inflowsCount: 0,
        outflowsCount: 0,
        transactions: []
      });
    });

    // ۱. ورودی‌های تنخواه و واریزی‌ها
    treasuryIncomes.forEach((inc) => {
      const amt = Number(inc.amount) || 0;
      let targetId = inc.accountId ? String(inc.accountId) : (inc.accountType === 'bank' ? defaultBankId : defaultCashId);
      if (targetId && map.has(targetId)) {
        const entry = map.get(targetId);
        entry.totalInflow += amt;
        entry.inflowsCount += 1;
        entry.transactions.push({
          id: inc.id,
          rawDate: (inc.date || inc.createdAt || '').slice(0, 10),
          time: inc.time || (inc.createdAt ? inc.createdAt.slice(11, 16) : ''),
          createdAt: inc.createdAt || (inc.date ? `${inc.date}T00:00:00Z` : ''),
          type: 'inflow',
          category: 'petty_cash',
          categoryLabel: 'شارژ تنخواه / واریزی',
          title: inc.title || 'واریز تنخواه کارگاه',
          description: inc.description || (inc.payer ? `واریزکننده: ${inc.payer}` : ''),
          personName: inc.payer || '',
          inflowAmount: amt,
          outflowAmount: 0,
          amount: amt,
          isSystem: false,
          rawItem: inc
        });
      }
    });

    // ۲. پرداختی‌های پرسنل (مساعده و تسویه دستمزد)
    payments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      let targetId = p.accountId ? String(p.accountId) : (p.paymentMethod === 'bank' || p.accountType === 'bank' ? defaultBankId : defaultCashId);
      if (targetId && map.has(targetId)) {
        const entry = map.get(targetId);
        entry.totalOutflow += amt;
        entry.outflowsCount += 1;
        const isAdvance = p.type === 'advance';
        const workerName = p.workerName || workerMap.get(String(p.workerId)) || 'پرسنل';
        entry.transactions.push({
          id: p.id,
          rawDate: (p.date || p.createdAt || '').slice(0, 10),
          time: p.time || (p.createdAt ? p.createdAt.slice(11, 16) : ''),
          createdAt: p.createdAt || (p.date ? `${p.date}T00:00:00Z` : ''),
          type: 'outflow',
          category: isAdvance ? 'advance_payment' : 'worker_settlement',
          categoryLabel: isAdvance ? 'مساعده پرسنل' : 'تسویه دستمزد پرسنل',
          title: isAdvance ? `پرداخت مساعده به ${workerName}` : `تسویه حساب نهایی ${workerName}`,
          description: p.notes || (p.referenceNumber ? `کد رهگیری: ${p.referenceNumber}` : ''),
          personName: workerName,
          inflowAmount: 0,
          outflowAmount: amt,
          amount: amt,
          isSystem: true,
          rawItem: p
        });
      }
    });

    // ۳. هزینه‌ها و فاکتورهای کارگاه
    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      let targetId = e.accountId ? String(e.accountId) : (e.paymentMethod === 'bank' || e.accountType === 'bank' ? defaultBankId : defaultCashId);
      if (targetId && map.has(targetId)) {
        const entry = map.get(targetId);
        entry.totalOutflow += amt;
        entry.outflowsCount += 1;
        entry.transactions.push({
          id: e.id,
          rawDate: (e.expenseDate || e.createdAt || '').slice(0, 10),
          time: e.time || (e.createdAt ? e.createdAt.slice(11, 16) : ''),
          createdAt: e.createdAt || (e.expenseDate ? `${e.expenseDate}T00:00:00Z` : ''),
          type: 'outflow',
          category: 'workshop_expense',
          categoryLabel: 'هزینه کارگاه (فاکتور)',
          title: e.title || 'هزینه کارگاه',
          description: e.personName ? `طرف‌حساب: ${e.personName}` : (e.description || ''),
          personName: e.personName || '',
          inflowAmount: 0,
          outflowAmount: amt,
          amount: amt,
          isSystem: true,
          rawItem: e
        });
      }
    });

    // ۴. تراکنش‌های انتقال وجه بین حساب‌ها (کارت به کارت / صندوق به بانک)
    accountTransfers.forEach((trf) => {
      const amt = Number(trf.amount) || 0;
      const rawDate = (trf.date || trf.createdAt || '').slice(0, 10);
      const time = trf.time || (trf.createdAt ? trf.createdAt.slice(11, 16) : '');
      const createdAt = trf.createdAt || (trf.date ? `${trf.date}T00:00:00Z` : '');

      // خروجی از حساب مبدأ
      if (trf.fromAccountId && map.has(String(trf.fromAccountId))) {
        const fromEntry = map.get(String(trf.fromAccountId));
        fromEntry.totalOutflow += amt;
        fromEntry.outflowsCount += 1;
        fromEntry.transactions.push({
          id: `${trf.id}_out`,
          transferId: trf.id,
          rawDate,
          time,
          createdAt,
          type: 'outflow',
          category: 'account_transfer',
          categoryLabel: 'انتقال وجه بین حساب‌ها',
          title: `انتقال به ${trf.toAccountName || 'حساب مقصد'}`,
          description: trf.description || (trf.reference ? `پیگیری: ${trf.reference}` : ''),
          personName: trf.toAccountName || '',
          inflowAmount: 0,
          outflowAmount: amt,
          amount: amt,
          isSystem: false,
          isTransfer: true,
          rawItem: trf
        });
      }

      // ورودی به حساب مقصد
      if (trf.toAccountId && map.has(String(trf.toAccountId))) {
        const toEntry = map.get(String(trf.toAccountId));
        toEntry.totalInflow += amt;
        toEntry.inflowsCount += 1;
        toEntry.transactions.push({
          id: `${trf.id}_in`,
          transferId: trf.id,
          rawDate,
          time,
          createdAt,
          type: 'inflow',
          category: 'account_transfer',
          categoryLabel: 'انتقال وجه بین حساب‌ها',
          title: `دریافت از ${trf.fromAccountName || 'حساب مبدأ'}`,
          description: trf.description || (trf.reference ? `پیگیری: ${trf.reference}` : ''),
          personName: trf.fromAccountName || '',
          inflowAmount: amt,
          outflowAmount: 0,
          amount: amt,
          isSystem: false,
          isTransfer: true,
          rawItem: trf
        });
      }
    });

    // محاسبه موجودی زنده و مانده تجمعی (Running Balance) برای هر حساب
    map.forEach((entry) => {
      entry.currentBalance = entry.initialBalance + entry.totalInflow - entry.totalOutflow;

      entry.transactions.sort((a, b) => {
        if (a.rawDate !== b.rawDate) return a.rawDate.localeCompare(b.rawDate);
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });

      let running = entry.initialBalance;
      entry.transactions = entry.transactions.map((tx, idx) => {
        if (tx.type === 'inflow') {
          running += tx.amount;
        } else {
          running -= tx.amount;
        }
        return {
          ...tx,
          rowNumber: idx + 1,
          runningBalance: running
        };
      });
    });

    return map;
  }, [financialAccounts, treasuryIncomes, payments, expenses, accountTransfers, workerMap]);

  const accountBalancesList = useMemo(() => {
    return Array.from(accountBalances.values());
  }, [accountBalances]);

  // ----------------------------------------------------
  // ۳. تجمیع کلان مبالغ برای داشبورد ۴گانه تراز مالی با احتساب موجودی اولیه
  // ----------------------------------------------------
  const dashboardStats = useMemo(() => {
    // موجودی‌های اولیه تمام حساب‌های فعال
    let totalInitialBalances = 0;
    financialAccounts.forEach((acc) => {
      if (acc.isActive !== false) {
        totalInitialBalances += Number(acc.initialBalance) || 0;
      }
    });

    // ۱. کل بودجه دریافتی (ورودی‌ها): مجموع تمام مبالغ تنخواه و بودجه واریز شده
    let totalInflow = 0;
    let cashInflow = 0;
    let bankInflow = 0;

    treasuryIncomes.forEach((inc) => {
      const amt = Number(inc.amount) || 0;
      totalInflow += amt;
      if (inc.accountType === 'cash') cashInflow += amt;
      else bankInflow += amt;
    });

    // ۲. کل پرداختی‌ها به پرسنل: مجموع تسویه‌حساب‌ها و مساعده‌ها
    let totalPersonnel = 0;
    let totalAdvances = 0;
    let totalSettlements = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      totalPersonnel += amt;
      if (p.type === 'advance') {
        totalAdvances += amt;
      } else {
        totalSettlements += amt;
      }
    });

    // ۳. کل هزینه‌های کارگاه: سرجمع مبالغ فاکتورها و ماشین‌آلات پرداخت شده
    let totalExpenses = 0;
    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      totalExpenses += amt;
    });

    // ۴. موجودی کل خزانه = کل منابع در دسترس (موجودی اولیه حساب‌ها + ورودی‌های جدید) - کل مصارف
    const totalOutflow = totalPersonnel + totalExpenses;
    const totalFundsAvailable = totalInitialBalances + totalInflow;
    const currentTreasuryBalance = totalFundsAvailable - totalOutflow;

    const personnelRatio = totalFundsAvailable > 0 ? Math.round((totalPersonnel / totalFundsAvailable) * 100) : 0;
    const expenseRatio = totalFundsAvailable > 0 ? Math.round((totalExpenses / totalFundsAvailable) * 100) : 0;
    const burnRatio = totalFundsAvailable > 0 ? Math.round((totalOutflow / totalFundsAvailable) * 100) : 0;

    return {
      totalInitialBalances: roundCurrency(totalInitialBalances, currency),
      totalFundsAvailable: roundCurrency(totalFundsAvailable, currency),
      totalInflow: roundCurrency(totalInflow, currency),
      cashInflow: roundCurrency(cashInflow, currency),
      bankInflow: roundCurrency(bankInflow, currency),
      incomesCount: treasuryIncomes.length,

      totalPersonnel: roundCurrency(totalPersonnel, currency),
      totalAdvances: roundCurrency(totalAdvances, currency),
      totalSettlements: roundCurrency(totalSettlements, currency),
      personnelPaymentsCount: payments.length,

      totalExpenses: roundCurrency(totalExpenses, currency),
      expensesCount: expenses.length,

      totalOutflow: roundCurrency(totalOutflow, currency),
      currentTreasuryBalance: roundCurrency(currentTreasuryBalance, currency),
      isPositiveBalance: currentTreasuryBalance >= 0,
      burnRatio,
      personnelRatio,
      expenseRatio
    };
  }, [financialAccounts, treasuryIncomes, payments, expenses, currency]);

  // ----------------------------------------------------
  // ۴. ساخت دفتر کل تراکنش‌ها (General Ledger) با Running Balance
  // ----------------------------------------------------
  const { ledgerItems, filteredLedgerItems } = useMemo(() => {
    const rawTransactions = [];

    // ۱. تراکنش‌های ورودی (تنخواه و واریزی‌ها)
    treasuryIncomes.forEach((inc) => {
      const dateStr = (inc.date || inc.createdAt || '').slice(0, 10);
      const acc = inc.accountId ? accountMap.get(String(inc.accountId)) : null;
      rawTransactions.push({
        id: inc.id,
        rawDate: dateStr,
        createdAt: inc.createdAt || `${dateStr}T00:00:00Z`,
        type: 'inflow', // ورودی
        category: 'petty_cash',
        categoryLabel: 'شارژ تنخواه / واریزی',
        amount: Number(inc.amount) || 0,
        accountType: inc.accountType || acc?.type || 'bank',
        accountId: inc.accountId || null,
        accountName: acc?.name || (inc.accountType === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
        title: inc.title || 'واریز تنخواه کارگاه',
        description: inc.description || inc.payer ? `واریزکننده: ${inc.payer || ''}` : '',
        tableName: 'treasuryIncomes',
        status: inc.status || 'draft',
        approvedBy: inc.approvedBy || inc.approved_by_name || null,
        approvedAt: inc.approvedAt || inc.approved_at || null,
        isAmended: Boolean(inc.isAmended),
        originalAmount: inc.originalAmount,
        amendmentReason: inc.amendmentReason,
        amendedBy: inc.amendedBy,
        amendedAt: inc.amendedAt,
        amendmentHistory: inc.amendmentHistory || [],
        isSystem: false, // قابل ویرایش و حذف مستقیم
        rawItem: inc
      });
    });

    // ۲. تراکنش‌های پرداختی پرسنل (مساعده و تسویه دستمزد)
    payments.forEach((p) => {
      const dateStr = (p.date || p.createdAt || '').slice(0, 10);
      const isAdvance = p.type === 'advance';
      const workerName = p.workerName || workerMap.get(String(p.workerId)) || 'پرسنل';
      const acc = p.accountId ? accountMap.get(String(p.accountId)) : null;

      rawTransactions.push({
        id: p.id,
        rawDate: dateStr,
        createdAt: p.createdAt || `${dateStr}T00:00:00Z`,
        type: 'outflow', // خروجی
        category: isAdvance ? 'advance_payment' : 'worker_settlement',
        categoryLabel: isAdvance ? 'مساعده پرسنل' : 'تسویه دستمزد پرسنل',
        amount: Number(p.amount) || 0,
        accountType: p.accountType || acc?.type || p.paymentMethod || 'cash',
        accountId: p.accountId || null,
        accountName: acc?.name || (p.paymentMethod === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
        title: isAdvance ? `پرداخت مساعده به ${workerName}` : `تسویه حساب نهایی ${workerName}`,
        description: p.notes || (p.referenceNumber ? `کد رهگیری: ${p.referenceNumber}` : ''),
        personName: workerName,
        tableName: 'payments',
        status: p.approval_status || (p.status === 'approved' ? 'approved' : 'draft'),
        approvedBy: p.approvedBy || p.approved_by_name || null,
        approvedAt: p.approvedAt || p.approved_at || null,
        isAmended: Boolean(p.isAmended),
        originalAmount: p.originalAmount,
        amendmentReason: p.amendmentReason,
        amendedBy: p.amendedBy,
        amendedAt: p.amendedAt,
        amendmentHistory: p.amendmentHistory || [],
        isSystem: false,
        systemSource: 'financials',
        rawItem: p
      });
    });

    // ۳. تراکنش‌های هزینه کارگاه (فاکتورها و ماشین‌آلات پرداخت شده)
    expenses.forEach((e) => {
      const dateStr = (e.expenseDate || e.createdAt || '').slice(0, 10);
      const acc = e.accountId ? accountMap.get(String(e.accountId)) : null;

      rawTransactions.push({
        id: e.id,
        rawDate: dateStr,
        createdAt: e.createdAt || `${dateStr}T00:00:00Z`,
        type: 'outflow', // خروجی
        category: 'workshop_expense',
        categoryLabel: 'هزینه کارگاه (فاکتور)',
        amount: Number(e.amount) || 0,
        accountType: e.accountType || acc?.type || e.paymentMethod || 'cash',
        accountId: e.accountId || null,
        accountName: acc?.name || (e.paymentMethod === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
        title: e.title || 'هزینه کارگاه',
        description: e.personName ? `طرف‌حساب: ${e.personName}` : (e.description || ''),
        personName: e.personName || '',
        tableName: 'expenses',
        status: e.status || 'draft',
        approvedBy: e.approvedBy || e.approved_by_name || null,
        approvedAt: e.approvedAt || e.approved_at || null,
        isAmended: Boolean(e.isAmended),
        originalAmount: e.originalAmount,
        amendmentReason: e.amendmentReason,
        amendedBy: e.amendedBy,
        amendedAt: e.amendedAt,
        amendmentHistory: e.amendmentHistory || [],
        isSystem: false,
        systemSource: 'expenses',
        rawItem: e
      });
    });

    // ۴. تراکنش‌های انتقال وجه بین حساب‌ها (کارت به کارت / صندوق به بانک)
    accountTransfers.forEach((trf) => {
      const dateStr = (trf.date || trf.createdAt || '').slice(0, 10);
      const createdAt = trf.createdAt || `${dateStr}T00:00:00Z`;

      rawTransactions.push({
        id: `${trf.id}_out`,
        transferId: trf.id,
        rawDate: dateStr,
        createdAt,
        type: 'outflow',
        category: 'account_transfer',
        categoryLabel: 'انتقال وجه بین حساب‌ها',
        amount: Number(trf.amount) || 0,
        accountType: trf.fromAccountType || 'bank',
        accountId: trf.fromAccountId,
        accountName: trf.fromAccountName,
        targetAccountName: trf.toAccountName,
        title: `انتقال به ${trf.toAccountName || 'حساب مقصد'}`,
        description: trf.description || (trf.reference ? `شماره ارجاع: ${trf.reference}` : ''),
        personName: trf.toAccountName || '',
        tableName: 'accountTransfers',
        status: trf.status || trf.approval_status || 'draft',
        approvedBy: trf.approvedBy || trf.approved_by_name || null,
        approvedAt: trf.approvedAt || trf.approved_at || null,
        isSystem: false,
        isTransfer: true,
        transferDirection: 'out',
        rawItem: trf
      });

      rawTransactions.push({
        id: `${trf.id}_in`,
        transferId: trf.id,
        rawDate: dateStr,
        createdAt,
        type: 'inflow',
        category: 'account_transfer',
        categoryLabel: 'انتقال وجه بین حساب‌ها',
        amount: Number(trf.amount) || 0,
        accountType: trf.toAccountType || 'bank',
        accountId: trf.toAccountId,
        accountName: trf.toAccountName,
        sourceAccountName: trf.fromAccountName,
        title: `دریافت از ${trf.fromAccountName || 'حساب مبدأ'}`,
        description: trf.description || (trf.reference ? `شماره ارجاع: ${trf.reference}` : ''),
        personName: trf.fromAccountName || '',
        tableName: 'accountTransfers',
        status: trf.status || trf.approval_status || 'draft',
        approvedBy: trf.approvedBy || trf.approved_by_name || null,
        approvedAt: trf.approvedAt || trf.approved_at || null,
        isSystem: false,
        isTransfer: true,
        transferDirection: 'in',
        rawItem: trf
      });
    });

    // مرتب‌سازی صعودی جهت محاسبه دقیق موجودی پس از هر تراکنش (Running Balance)
    rawTransactions.sort((a, b) => {
      if (a.rawDate !== b.rawDate) {
        return a.rawDate.localeCompare(b.rawDate);
      }
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    let runningAccumulator = 0;
    const ledgerWithBalances = rawTransactions.map((tx, idx) => {
      if (tx.type === 'inflow') {
        runningAccumulator += tx.amount;
      } else {
        runningAccumulator -= tx.amount;
      }
      return {
        ...tx,
        rowNumber: idx + 1,
        runningBalance: runningAccumulator
      };
    });

    // فیلتر کردن ردیف‌ها بر اساس گزینه‌های کاربر
    const searchLower = searchQuery.trim().toLowerCase();

    const filtered = ledgerWithBalances.filter((tx) => {
      // فیلتر تاریخ
      if (!checkDateMatch(tx.rawDate)) return false;

      // فیلتر دسته‌بندی
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;

      // فیلتر وضعیت تایید (پیش‌نویس، تایید نهایی، اصلاحیه)
      if (approvalStatusFilter === 'draft') {
        if (tx.status === 'approved') return false;
      } else if (approvalStatusFilter === 'approved') {
        if (tx.status !== 'approved') return false;
      } else if (approvalStatusFilter === 'amended') {
        if (!tx.isAmended) return false;
      }

      // فیلتر حساب یا نوع حساب (صندوق / بانک / حساب خاص)
      if (accountTypeFilter !== 'all') {
        if (accountTypeFilter === 'cash' && tx.accountType !== 'cash') return false;
        else if (accountTypeFilter === 'bank' && tx.accountType !== 'bank') return false;
        else if (accountTypeFilter !== 'cash' && accountTypeFilter !== 'bank') {
          if (tx.accountId !== accountTypeFilter) return false;
        }
      }

      // فیلتر جستجو متنی
      if (searchLower) {
        const matchesTitle = (tx.title || '').toLowerCase().includes(searchLower);
        const matchesDesc = (tx.description || '').toLowerCase().includes(searchLower);
        const matchesPerson = (tx.personName || '').toLowerCase().includes(searchLower);
        const matchesAccount = (tx.accountName || '').toLowerCase().includes(searchLower);
        const matchesAmount = String(tx.amount).includes(searchLower);
        if (!matchesTitle && !matchesDesc && !matchesPerson && !matchesAccount && !matchesAmount) return false;
      }

      return true;
    });

    // مرتب‌سازی نزولی (جدیدترین به قدیمی‌ترین) برای نمایش در جدول
    filtered.sort((a, b) => {
      if (b.rawDate !== a.rawDate) {
        return b.rawDate.localeCompare(a.rawDate);
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return {
      ledgerItems: ledgerWithBalances,
      filteredLedgerItems: filtered
    };
  }, [treasuryIncomes, payments, expenses, accountTransfers, workerMap, accountMap, checkDateMatch, categoryFilter, accountTypeFilter, searchQuery, approvalStatusFilter]);

  // آمار وضعیت اسناد دفتر کل (کل، پیش‌نویس، تایید نهایی، اصلاحیه)
  const ledgerStats = useMemo(() => {
    let total = 0;
    let draft = 0;
    let approved = 0;
    let amended = 0;

    (ledgerItems || []).forEach((tx) => {
      total++;
      if (tx.isAmended) {
        amended++;
      }
      if (tx.status === 'approved') {
        approved++;
      } else {
        draft++;
      }
    });

    return { total, draft, approved, amended };
  }, [ledgerItems]);

  // ----------------------------------------------------
  // ۵. تجمیع روزانه جریان نقدینگی (Cash Flow Chart Data)
  // ----------------------------------------------------
  const cashFlowChartData = useMemo(() => {
    // ماه مبنا جهت ترسیم نمودار (مثلاً '2026-09')
    const targetMonth = selectedMonth || getCurrentYearMonth();
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // محاسبه تعداد روزهای این ماه میلادی
    const daysInMonth = new Date(year, month, 0).getDate();

    // ایجاد آرایه‌ای برای تک تک روزهای ماه
    const dailyMap = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dayPad = String(d).padStart(2, '0');
      const fullDate = `${targetMonth}-${dayPad}`;
      dailyMap[fullDate] = {
        day: d,
        dayNumber: dayPad,
        date: fullDate,
        inflow: 0,
        outflow: 0,
        net: 0
      };
    }

    // مجموع ورودی‌های این ماه
    treasuryIncomes.forEach((inc) => {
      const dStr = (inc.date || inc.createdAt || '').slice(0, 10);
      if (dailyMap[dStr]) {
        dailyMap[dStr].inflow += Number(inc.amount) || 0;
      }
    });

    // مجموع خروجی‌های پرسنل این ماه
    payments.forEach((p) => {
      const dStr = (p.date || p.createdAt || '').slice(0, 10);
      if (dailyMap[dStr]) {
        dailyMap[dStr].outflow += Number(p.amount) || 0;
      }
    });

    // مجموع خروجی‌های فاکتورهای این ماه
    expenses.forEach((e) => {
      const dStr = (e.expenseDate || e.createdAt || '').slice(0, 10);
      if (dailyMap[dStr]) {
        dailyMap[dStr].outflow += Number(e.amount) || 0;
      }
    });

    const chartPoints = Object.values(dailyMap).map((item) => ({
      ...item,
      net: item.inflow - item.outflow
    }));

    // یافتن بیشترین مقدار برای مقیاس‌بندی ارتفاع میله‌ها
    let maxVal = 0;
    let monthTotalInflow = 0;
    let monthTotalOutflow = 0;

    chartPoints.forEach((pt) => {
      if (pt.inflow > maxVal) maxVal = pt.inflow;
      if (pt.outflow > maxVal) maxVal = pt.outflow;
      monthTotalInflow += pt.inflow;
      monthTotalOutflow += pt.outflow;
    });

    return {
      month: targetMonth,
      points: chartPoints,
      maxDailyAmount: maxVal || 1000000,
      monthTotalInflow: roundCurrency(monthTotalInflow, currency),
      monthTotalOutflow: roundCurrency(monthTotalOutflow, currency),
      monthNetBalance: roundCurrency(monthTotalInflow - monthTotalOutflow, currency)
    };
  }, [selectedMonth, treasuryIncomes, payments, expenses, currency]);

  // ----------------------------------------------------
  // ۶. متدهای CRUD برای مدیریت واریزی‌ها و شارژ تنخواه
  // ----------------------------------------------------
  // ۶. متدهای CRUD برای مدیریت واریزی‌ها، شارژ تنخواه و حساب‌ها
  // ----------------------------------------------------
  const addIncome = useCallback(async ({ amount, date, title, accountType, accountId, accountName, description, payer, status }) => {
    const numAmount = Number(String(amount).replace(/,/g, ''));
    if (!numAmount || numAmount <= 0) {
      throw new Error('مبلغ واریزی باید بزرگتر از صفر باشد');
    }

    const fallbackTitle = (title && title.trim()) ? title.trim() : `افزایش موجودی ${accountName || (accountType === 'bank' ? 'کارت بانکی' : 'صندوق')}`;

    const now = new Date();
    const newRecord = {
      id: generateTreasuryIncomeId(),
      projectId,
      userId: user?.id || user?.userId || 'default_user',
      amount: numAmount,
      date: date || getTodayDateString(),
      title: fallbackTitle,
      accountId: accountId || null,
      accountName: accountName || '',
      accountType: accountType || 'bank', // 'cash' | 'bank'
      payer: payer ? payer.trim() : '',
      description: description ? description.trim() : '',
      status: 'draft',
      approval_status: 'draft',
      created_by: user?.id || user?.userId || 'user',
      createdBy: user?.name || user?.title || user?.email || '',
      approved_by: null,
      approvedBy: null,
      approved_at: null,
      approvedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await db.treasuryIncomes.add(newRecord);
    pushTreasuryIncomeLive(newRecord).catch(console.warn);
    return newRecord;
  }, [projectId, user]);

  const updateIncome = useCallback(async (id, modifications) => {
    if (!id) throw new Error('شناسه واریزی الزامی است');

    const existing = await db.treasuryIncomes.get(id);
    if (existing && (existing.status === 'approved' || existing.approval_status === 'approved')) {
      throw new Error('اسناد مالی تایید نهایی شده به جهت الزامات حسابداری غیرقابل ویرایش مستقیم هستند.');
    }

    const cleanMods = { ...modifications, updatedAt: new Date().toISOString() };
    if ('amount' in cleanMods) {
      cleanMods.amount = Number(String(cleanMods.amount).replace(/,/g, '')) || 0;
    }
    if ('title' in cleanMods && cleanMods.title) {
      cleanMods.title = cleanMods.title.trim();
    }
    if ('description' in cleanMods && cleanMods.description) {
      cleanMods.description = cleanMods.description.trim();
    }

    await db.treasuryIncomes.update(id, cleanMods);
    const updated = await db.treasuryIncomes.get(id);
    if (updated) {
      pushTreasuryIncomeLive(updated).catch(console.warn);
    }
  }, []);

  const deleteIncome = useCallback(async (id) => {
    if (!id) throw new Error('شناسه واریزی الزامی است');
    await deleteTreasuryIncomeLive(id).catch(console.warn);
  }, []);

  // متدهای مدیریت حساب‌های بانکی و صندوق‌ها
  const addAccount = useCallback(async (accountData) => {
    const now = new Date().toISOString();
    const newId = generateAccountId();
    const isFirst = financialAccounts.length === 0;

    const record = {
      id: newId,
      projectId,
      userId: user?.id || 'default_user',
      name: accountData.name?.trim() || (accountData.type === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
      type: accountData.type || 'bank', // 'bank' | 'cash'
      bankName: accountData.bankName?.trim() || '',
      cardNumber: accountData.cardNumber?.trim() || '',
      accountNumber: accountData.accountNumber?.trim() || '',
      holderName: accountData.holderName?.trim() || '',
      keeperName: accountData.keeperName?.trim() || '',
      initialBalance: Number(String(accountData.initialBalance || 0).replace(/,/g, '')) || 0,
      isDefault: Boolean(accountData.isDefault || isFirst),
      overdraftPolicy: accountData.overdraftPolicy || 'global',
      isActive: true,
      color: accountData.color || (accountData.type === 'bank' ? 'sky' : 'amber'),
      notes: accountData.notes?.trim() || '',
      createdAt: now,
      updatedAt: now
    };

    if (record.isDefault) {
      // غیرفعال کردن پیش‌فرض از سایر حساب‌های این پروژه
      const allAccs = await db.financialAccounts.toArray();
      const updates = allAccs
        .filter((a) => a.projectId === projectId && a.isDefault)
        .map((a) => db.financialAccounts.update(a.id, { isDefault: false }));
      await Promise.all(updates);
    }

    await db.financialAccounts.add(record);
    pushFinancialAccountLive(record).catch(console.warn);
    return record;
  }, [projectId, user, financialAccounts.length]);

  const updateAccount = useCallback(async (id, modifications) => {
    if (!id) return;
    const now = new Date().toISOString();
    const cleanMods = { ...modifications, updatedAt: now };

    if (cleanMods.isDefault) {
      const allAccs = await db.financialAccounts.toArray();
      const updates = allAccs
        .filter((a) => a.id !== id && a.projectId === projectId && a.isDefault)
        .map((a) => db.financialAccounts.update(a.id, { isDefault: false }));
      await Promise.all(updates);
    }

    await db.financialAccounts.update(id, cleanMods);
    const updated = await db.financialAccounts.get(id);
    if (updated) {
      pushFinancialAccountLive(updated).catch(console.warn);
    }
  }, [projectId]);

  const setDefaultAccount = useCallback(async (id) => {
    if (!id) return;
    const allAccs = await db.financialAccounts.toArray();
    const promises = allAccs
      .filter((a) => a.projectId === projectId)
      .map((a) => db.financialAccounts.update(a.id, { isDefault: a.id === id }));
    await Promise.all(promises);
    const updatedList = await db.financialAccounts.toArray();
    for (const acc of updatedList) {
      pushFinancialAccountLive(acc).catch(console.warn);
    }
  }, [projectId]);

  // حذف ایمن حساب با اعتبارسنجی جامع گردش‌های مالی و قوانین حسابداری
  const deleteAccount = useCallback(async (id) => {
    if (!id) return;
    const strId = String(id);

    // ۰. حساب‌های اصلی سیستمی به هیچ عنوان نباید حذف شوند
    if (strId === 'acc_default_cash' || strId === 'acc_default_bank') {
      throw new Error('صندوق نقدی و کارت بانکی اصلی سیستم غیرقابل حذف می‌باشند.');
    }

    const targetAcc = financialAccounts.find(a => String(a.id) === strId);
    if (targetAcc?.isDefault) {
      throw new Error('حساب یا صندوق پیش‌فرض سیستم قابل حذف نمی‌باشد. در صورت تمایل ابتدا حساب دیگری را به عنوان پیش‌فرض تعیین کنید.');
    }

    if (targetAcc) {
      const activeSameType = financialAccounts.filter(a => a.type === targetAcc.type && !a.deletedAt && a.status !== 'deleted');
      if (activeSameType.length <= 1) {
        throw new Error(`حذف آخرین ${targetAcc.type === 'cash' ? 'صندوق نقدی' : 'حساب بانکی'} مجاز نمی‌باشد. حداقل یک ${targetAcc.type === 'cash' ? 'صندوق' : 'حساب'} باید در سیستم فعال باشد.`);
      }
    }

    // ۱. بررسی گردش‌های مالی در آبجکت محاسباتی مانده حساب
    const balanceData = accountBalances.get(strId);
    if (balanceData && balanceData.transactions && balanceData.transactions.length > 0) {
      throw new Error(`حساب «${balanceData.account?.name || targetAcc?.name || ''}» دارای ${balanceData.transactions.length} گردش مالی و سند ثبت‌شده است و طبق مقررات حسابداری امکان حذف آن وجود ندارد.`);
    }

    // ۲. بررسی استفاده در پرداخت‌ها یا تسویه‌حساب‌ها (استفاده از toArray جهت عدم وابستگی به ایندکس دکسی)
    const allPayments = await db.payments.toArray();
    const isDefaultCash = targetAcc?.isDefault && targetAcc?.type === 'cash';
    const usedInPayments = allPayments.some(p => !p.deletedAt && (String(p.accountId) === strId || (isDefaultCash && (p.paymentMethod !== 'bank' && !p.accountId))));
    if (usedInPayments) {
      throw new Error('این حساب در پرداخت‌ها یا تسویه‌حساب‌های پرسنل استفاده شده است و امکان حذف آن وجود ندارد.');
    }

    // ۳. بررسی استفاده در هزینه‌های کارگاه
    if (db.expenses) {
      const allExpenses = await db.expenses.toArray();
      const usedInExpenses = allExpenses.some(e => !e.deletedAt && (String(e.accountId) === strId || (isDefaultCash && (e.paymentMethod !== 'bank' && !e.accountId))));
      if (usedInExpenses) {
        throw new Error('این حساب در هزینه‌های ثبت‌شده کارگاه استفاده شده است و امکان حذف آن وجود ندارد.');
      }
    }

    // ۴. بررسی استفاده در واریزی‌ها یا تنخواه
    if (db.treasuryIncomes) {
      const allIncomes = await db.treasuryIncomes.toArray();
      const usedInIncomes = allIncomes.some(inc => !inc.deletedAt && (String(inc.accountId) === strId || (isDefaultCash && (inc.accountType === 'cash' && !inc.accountId))));
      if (usedInIncomes) {
        throw new Error('این حساب در واریزی‌ها یا تنخواه کارگاه استفاده شده است و امکان حذف آن وجود ندارد.');
      }
    }

    // ۵. بررسی استفاده در انتقالات حساب به حساب
    if (db.accountTransfers) {
      const allTransfers = await db.accountTransfers.toArray();
      const usedInTransfers = allTransfers.some(t => !t.deletedAt && (String(t.fromAccountId) === strId || String(t.toAccountId) === strId));
      if (usedInTransfers) {
        throw new Error('این حساب در تراکنش‌های انتقال وجه بین حساب‌ها استفاده شده است و امکان حذف آن وجود ندارد.');
      }
    }

    await deleteFinancialAccountLive(id).catch(console.warn);
  }, [financialAccounts, accountBalances]);

  // بررسی اضافه برداشت بر اساس سیاست حساب و سراسری
  const checkAccountOverdraft = useCallback((accountId, amount) => {
    const numAmount = Number(amount) || 0;
    const acc = financialAccounts.find((a) => String(a.id) === String(accountId)) || defaultAccount;
    if (!acc) {
      return {
        hasSufficientFunds: true,
        account: null,
        currentBalance: 0,
        requestedAmount: numAmount,
        shortfall: 0,
        effectivePolicy: globalOverdraftPolicy
      };
    }

    const accBalanceData = accountBalances.get(String(acc.id));
    const currentBalance = accBalanceData ? accBalanceData.currentBalance : (Number(acc.initialBalance) || 0);
    const hasSufficientFunds = currentBalance >= numAmount;
    const shortfall = Math.max(0, numAmount - currentBalance);
    const effectivePolicy = (acc.overdraftPolicy && acc.overdraftPolicy !== 'global') 
      ? acc.overdraftPolicy 
      : globalOverdraftPolicy;

    return {
      hasSufficientFunds,
      account: acc,
      currentBalance,
      requestedAmount: numAmount,
      shortfall,
      effectivePolicy
    };
  }, [financialAccounts, defaultAccount, accountBalances, globalOverdraftPolicy]);

  // متد انتقال وجه بین حساب‌ها (کارت به کارت / صندوق به بانک)
  const transferBetweenAccounts = useCallback(async ({
    fromAccountId,
    toAccountId,
    amount,
    date,
    reference,
    description
  }) => {
    const numAmount = Number(String(amount).replace(/,/g, ''));
    if (!numAmount || numAmount <= 0) {
      throw new Error('مبلغ انتقال باید بزرگتر از صفر باشد');
    }
    if (!fromAccountId || !toAccountId) {
      throw new Error('حساب مبدأ و مقصد هر دو باید مشخص شوند');
    }
    if (String(fromAccountId) === String(toAccountId)) {
      throw new Error('حساب مبدأ و مقصد نمی‌تواند یکسان باشد');
    }

    const fromAcc = financialAccounts.find(a => String(a.id) === String(fromAccountId));
    const toAcc = financialAccounts.find(a => String(a.id) === String(toAccountId));

    if (!fromAcc || !toAcc) {
      throw new Error('حساب انتخاب‌شده نامعتبر است');
    }

    // بررسی اضافه برداشت بر اساس سیاست حساب مبدأ
    const overdraftCheck = checkAccountOverdraft(fromAccountId, numAmount);
    if (!overdraftCheck.hasSufficientFunds && overdraftCheck.effectivePolicy === 'never_allow') {
      throw new Error(`موجودی حساب ${fromAcc.name} برای این انتقال ناکافی است و اضافه برداشت مجاز نمی‌باشد.`);
    }

    const now = new Date();
    const newTransfer = {
      id: generateTransferId(),
      projectId,
      userId: user?.id || user?.userId || 'default_user',
      fromAccountId: String(fromAcc.id),
      fromAccountName: fromAcc.name,
      fromAccountType: fromAcc.type,
      toAccountId: String(toAcc.id),
      toAccountName: toAcc.name,
      toAccountType: toAcc.type,
      amount: numAmount,
      date: date || getTodayDateString(),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      reference: reference ? reference.trim() : '',
      description: description ? description.trim() : '',
      status: 'draft',
      approval_status: 'draft',
      created_by: user?.id || user?.userId || 'user',
      createdBy: user?.name || user?.title || user?.email || '',
      approved_by: null,
      approvedBy: null,
      approved_at: null,
      approvedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    if (db.accountTransfers) {
      await db.accountTransfers.add(newTransfer);
    }
    pushAccountTransferLive(newTransfer).catch(console.warn);
    return newTransfer;
  }, [projectId, user, financialAccounts, checkAccountOverdraft]);

  const deleteTransfer = useCallback(async (transferId) => {
    if (!transferId) return;
    await deleteAccountTransferLive(transferId).catch(console.warn);
  }, []);

  const syncFinancialAccounts = useCallback(async () => {
    return await syncFinancialDataLive();
  }, []);

  const migrateClosedTransactions = useCallback(async (forceAll = false) => {
    return await migrateClosedTransactionsToCashBox(projectId, forceAll);
  }, [projectId]);

  const deleteDraftLedgerItem = useCallback(async (tx) => {
    if (!tx) return;
    if (tx.status === 'approved' || tx.approval_status === 'approved') {
      throw new Error('اسناد مالی تایید نهایی شده به جهت الزامات مالی و حسابداری غیرقابل حذف هستند.');
    }

    const tbl = tx.tableName || (tx.type === 'inflow' ? 'treasuryIncomes' : 'payments');
    if (tbl === 'accountTransfers') {
      const trfId = tx.transferId || String(tx.id).replace(/_(in|out)$/, '');
      await deleteAccountTransferLive(trfId);
    } else if (tbl === 'treasuryIncomes') {
      await deleteTreasuryIncomeLive(tx.id);
    } else if (tbl === 'expenses') {
      await softDeleteExpenseLive(tx.id);
    } else if (tbl === 'payments') {
      recordPendingPaymentDeletion(tx.id);
      await rollbackPaymentSettlement(tx.id).catch(console.warn);
      await db.payments.delete(tx.id);
      pushPaymentsLive().catch(() => {});
    }

    setSyncTick((t) => t + 1);
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }, []);

  const batchDeleteDraftLedgerItems = useCallback(async (txListOrIds) => {
    if (!txListOrIds || txListOrIds.length === 0) return;
    const processedTransfers = new Set();

    for (const item of txListOrIds) {
      let tx = item;
      if (typeof item === 'string') {
        tx = ledgerItems.find((li) => li.id === item);
      }
      if (!tx || tx.status === 'approved' || tx.approval_status === 'approved') continue;

      const tbl = tx.tableName || (tx.type === 'inflow' ? 'treasuryIncomes' : 'payments');
      if (tbl === 'accountTransfers') {
        const trfId = tx.transferId || String(tx.id).replace(/_(in|out)$/, '');
        if (processedTransfers.has(trfId)) continue;
        processedTransfers.add(trfId);
        await deleteAccountTransferLive(trfId).catch(console.warn);
      } else if (tbl === 'treasuryIncomes') {
        await deleteTreasuryIncomeLive(tx.id).catch(console.warn);
      } else if (tbl === 'expenses') {
        await softDeleteExpenseLive(tx.id).catch(console.warn);
      } else if (tbl === 'payments') {
        recordPendingPaymentDeletion(tx.id);
        await rollbackPaymentSettlement(tx.id).catch(console.warn);
        await db.payments.delete(tx.id).catch(console.warn);
        pushPaymentsLive().catch(() => {});
      }
    }

    setSyncTick((t) => t + 1);
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }, [ledgerItems]);

  return {
    projectId,
    currency,
    // آمار داشبورد ۴گانه
    dashboardStats,
    // لیست‌های خام و تفکیک شده
    treasuryIncomes,
    payments,
    expenses,
    // حساب‌های بانکی و صندوق‌ها
    financialAccounts,
    defaultAccount,
    accountMap,
    accountBalances,
    accountBalancesList,
    globalOverdraftPolicy,
    updateGlobalOverdraftPolicy,
    checkAccountOverdraft,
    addAccount,
    updateAccount,
    setDefaultAccount,
    deleteAccount,
    migrateClosedTransactions,
    // دفتر کل و فیلترها
    ledgerItems,
    filteredLedgerItems,
    ledgerStats,
    approvalStatusFilter,
    setApprovalStatusFilter,
    dateFilterMode,
    setDateFilterMode,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    categoryFilter,
    setCategoryFilter,
    accountTypeFilter,
    setAccountTypeFilter,
    searchQuery,
    setSearchQuery,
    deleteDraftLedgerItem,
    batchDeleteDraftLedgerItems,
    // داده‌های نمودار جریان نقدینگی
    selectedMonth,
    setSelectedMonth,
    cashFlowChartData,
    // متدهای CRUD واریزی‌ها
    addIncome,
    updateIncome,
    deleteIncome,
    // متدهای انتقال بین حساب‌ها (حساب به حساب)
    accountTransfers,
    transferBetweenAccounts,
    deleteTransfer,
    // همگام‌سازی فوری حساب‌ها
    syncFinancialAccounts
  };
}
