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
  pullChequesLive,
  pullChequebooksLive,
  pullGlobalOverdraftPolicyLive,
  syncFinancialDataLive,
  softDeleteExpenseLive,
  recordPendingPaymentDeletion,
  pushPaymentsLive,
  rollbackPaymentSettlement,
  pushAllFinancialAccountsToCloud
} from '../services/realtimeSync';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  getCurrentYearMonth, 
  getTodayDateString, 
  roundCurrency,
  shiftCalendarMonth,
  isDateInMonth,
  getCalendarMonthDetails
} from '../utils/formatters';
import { getDeterministicVoucher, generateNextVoucherNumber } from '../services/voucherNumberService';
import { calculateProfitAndLoss } from '../services/profitAndLossService';

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
  const { language, calendarType } = useLanguage();

  const projectId = currentProject?.id || DEFAULT_PROJECT_ID;
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  // فیلترهای تب حسابداری
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentYearMonth(calendarType, language));

  useEffect(() => {
    setSelectedMonth(getCurrentYearMonth(calendarType, language));
  }, [calendarType, language]);
  const [dateFilterMode, setDateFilterMode] = useState('all'); // 'all' | 'month' | 'this_month' | 'last_month' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'petty_cash' | 'worker_settlement' | 'advance_payment' | 'workshop_expense' | 'account_transfer'
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all'); // 'all' | 'cash' | 'bank'
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('all'); // 'all' | 'draft' | 'approved' | 'amended'
  const [profitAndLossBasis, setProfitAndLossBasis] = useState('realized'); // 'realized' | 'accrual'

  const [syncTick, setSyncTick] = useState(0);

  // گوش دادن به رویدادهای همگام‌سازی ابری و بارگذاری اولیه داده‌های مالی
  useEffect(() => {
    const handleSync = () => {
      setSyncTick((t) => t + 1);
    };
    window.addEventListener('workshop-accounts-sync', handleSync);
    window.addEventListener('workshop-incomes-sync', handleSync);
    window.addEventListener('workshop-transfers-sync', handleSync);
    window.addEventListener('workshop-payments-sync', handleSync);
    window.addEventListener('workshop-expenses-sync', handleSync);
    window.addEventListener('workshop-cheques-sync', handleSync);
    window.addEventListener('workshop-chequebooks-sync', handleSync);
    window.addEventListener('workshop-logs-sync', handleSync);
    window.addEventListener('karsync:accounting-sync', handleSync);

    pullFinancialAccountsLive().catch(console.warn);
    pullTreasuryIncomesLive().catch(console.warn);
    pullAccountTransfersLive().catch(console.warn);
    pullGlobalOverdraftPolicyLive().catch(console.warn);
    purgeBankToBankTransfers().catch(console.warn);
    pullChequesLive().catch(console.warn);
    pullChequebooksLive().catch(console.warn);

    return () => {
      window.removeEventListener('workshop-accounts-sync', handleSync);
      window.removeEventListener('workshop-incomes-sync', handleSync);
      window.removeEventListener('workshop-transfers-sync', handleSync);
      window.removeEventListener('workshop-payments-sync', handleSync);
      window.removeEventListener('workshop-expenses-sync', handleSync);
      window.removeEventListener('workshop-cheques-sync', handleSync);
      window.removeEventListener('workshop-chequebooks-sync', handleSync);
      window.removeEventListener('workshop-logs-sync', handleSync);
      window.removeEventListener('karsync:accounting-sync', handleSync);
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

  const counterparties = useLiveQuery(
    async () => {
      if (!db.counterparties) return [];
      const list = await db.counterparties.toArray();
      return list.filter((cp) => !cp.deletedAt && (!cp.projectId || cp.projectId === projectId || projectId === DEFAULT_PROJECT_ID));
    },
    [projectId]
  ) || [];

  // لاگ‌های کارکرد روزانه جهت محاسبه تعهدی سود و زیان کارگاه
  const attendanceLogs = useLiveQuery(
    async () => {
      if (!db.attendanceLogs) return [];
      const list = await db.attendanceLogs.toArray();
      const projectWorkerIds = new Set(workers.map((w) => String(w.id)));
      return list.filter(
        (l) => !l.deletedAt && (!l.projectId || l.projectId === projectId || projectId === DEFAULT_PROJECT_ID || projectWorkerIds.has(String(l.workerId)))
      );
    },
    [projectId, workers, syncTick]
  ) || [];

  const workerMap = useMemo(() => {
    const map = new Map();
    workers.forEach((w) => {
      map.set(String(w.id), w.name);
    });
    return map;
  }, [workers]);

  const counterpartyMap = useMemo(() => {
    const map = new Map();
    counterparties.forEach((cp) => {
      map.set(String(cp.id), cp);
    });
    return map;
  }, [counterparties]);

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
          // مساعده‌ها، پاداش‌ها/عیدی‌ها، وام‌ها و تسویه‌ها خروجی واقعی پول هستند
          const isAdvance = p.type === 'advance' || p.type === 'Advance_Payment';
          const isBonus = p.type === 'bonus' || p.type === 'eid';
          const isLoan = p.type === 'loan' || p.type === 'loan_disbursement';
          const isSettlement = p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled' || p.settlement_status === 'settled' || Boolean(p.isSettled);
          return isAdvance || isBonus || isSettlement || isLoan;
        })
        .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    },
    [projectId, workers, syncTick]
  ) || [];

  // د) هزینه‌های کارگاه (فاکتورها و ماشین‌آلات)
  const allProjectExpenses = useLiveQuery(
    async () => {
      if (!db.expenses) return [];
      const list = await db.expenses.toArray();
      return list
        .filter((e) => {
          if (e.deletedAt) return false;
          const matchesProject = !e.projectId || e.projectId === projectId || projectId === DEFAULT_PROJECT_ID;
          return matchesProject;
        })
        .sort((a, b) => (b.expenseDate || b.createdAt || '').localeCompare(a.expenseDate || a.createdAt || ''));
    },
    [projectId, syncTick]
  ) || [];

  const expenses = useMemo(() => {
    return allProjectExpenses.filter((e) => e.paymentStatus === 'paid' || !e.paymentStatus);
  }, [allProjectExpenses]);

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
      list = list.filter((acc) => !acc.deletedAt && acc.status !== 'deleted' && (acc.isGlobal || !acc.projectId || acc.projectId === projectId || acc.projectId === DEFAULT_PROJECT_ID || projectId === DEFAULT_PROJECT_ID));
      return list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
    },
    [projectId, user, syncTick]
  ) || [];

  const hasAllProjectsAccess = Boolean(user?.has_all_projects_access || String(user?.role || '').toLowerCase() === 'admin');

  // Company-wide queries for real global bank accounts & multi-project reconciliation
  const allCompanyIncomes = useLiveQuery(
    async () => {
      if (!db.treasuryIncomes) return [];
      const list = await db.treasuryIncomes.toArray();
      return list.filter((inc) => !inc.deletedAt);
    },
    [syncTick]
  ) || [];

  const allCompanyPayments = useLiveQuery(
    async () => {
      if (!db.payments) return [];
      const list = await db.payments.toArray();
      return list.filter((p) => {
        if (p.deletedAt) return false;
        const isAdvance = p.type === 'advance' || p.type === 'Advance_Payment';
        const isBonus = p.type === 'bonus' || p.type === 'eid';
        const isLoan = p.type === 'loan' || p.type === 'loan_disbursement';
        const isSettlement = p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled' || p.settlement_status === 'settled' || Boolean(p.isSettled);
        return isAdvance || isBonus || isSettlement || isLoan;
      });
    },
    [syncTick]
  ) || [];

  const allCompanyExpenses = useLiveQuery(
    async () => {
      if (!db.expenses) return [];
      const list = await db.expenses.toArray();
      return list.filter((e) => !e.deletedAt && (e.paymentStatus === 'paid' || !e.paymentStatus));
    },
    [syncTick]
  ) || [];

  const allCompanyTransfers = useLiveQuery(
    async () => {
      if (!db.accountTransfers) return [];
      const list = await db.accountTransfers.toArray();
      return list.filter((trf) => !trf.deletedAt);
    },
    [syncTick]
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

  // ز) چک‌ها و اسناد تجاری (چک‌های دریافتی و پرداختی صیادی)
  const cheques = useLiveQuery(
    async () => {
      if (!db.cheques) return [];
      const list = await db.cheques.toArray();
      return list
        .filter((chk) => !chk.deletedAt && (!chk.projectId || chk.projectId === projectId || projectId === DEFAULT_PROJECT_ID))
        .sort((a, b) => (b.dueDate || b.issueDate || b.createdAt || '').localeCompare(a.dueDate || a.issueDate || a.createdAt || ''));
    },
    [projectId, syncTick]
  ) || [];

  // ح) دسته‌چک‌های بانکی کارگاه
  const chequebooks = useLiveQuery(
    async () => {
      if (!db.chequebooks) return [];
      const list = await db.chequebooks.toArray();
      return list
        .filter((cb) => !cb.deletedAt && (!cb.projectId || cb.projectId === projectId || projectId === DEFAULT_PROJECT_ID))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },
    [projectId, syncTick]
  ) || [];

  // ط) محاسبات آماری اسناد تجاری
  const chequeStats = useMemo(() => {
    let inwardTotal = 0;
    let outwardTotal = 0;
    let inHandTotal = 0;
    let overdueTotal = 0;
    const today = new Date().toISOString().slice(0, 10);

    cheques.forEach((chk) => {
      const amt = Number(chk.amount) || 0;
      if (chk.type === 'inward') {
        inwardTotal += amt;
        if (chk.status === 'in_hand') {
          inHandTotal += amt;
        }
      } else {
        outwardTotal += amt;
      }

      if ((chk.status === 'in_hand' || chk.status === 'issued') && chk.dueDate && chk.dueDate < today) {
        overdueTotal += amt;
      }
    });

    return {
      inwardTotal,
      outwardTotal,
      inHandTotal,
      overdueTotal,
      totalCount: cheques.length,
    };
  }, [cheques]);

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
  const currentMonthPrefix = useMemo(() => {
    return getCurrentYearMonth(calendarType, language);
  }, [calendarType, language]);

  const lastMonthPrefix = useMemo(() => {
    return shiftCalendarMonth(currentMonthPrefix, -1, calendarType, language);
  }, [currentMonthPrefix, calendarType, language]);

  const checkDateMatch = useCallback((dateStr) => {
    if (!dateStr) return true;
    const cleanDate = dateStr.slice(0, 10);

    if (dateFilterMode === 'month' || dateFilterMode === 'this_month') {
      const targetMonth = selectedMonth || currentMonthPrefix;
      return isDateInMonth(cleanDate, targetMonth, calendarType, language);
    }
    if (dateFilterMode === 'last_month') {
      return isDateInMonth(cleanDate, lastMonthPrefix, calendarType, language);
    }
    if (dateFilterMode === 'custom') {
      if (customStartDate && cleanDate < customStartDate) return false;
      if (customEndDate && cleanDate > customEndDate) return false;
      return true;
    }
    return true; // 'all'
  }, [dateFilterMode, selectedMonth, currentMonthPrefix, lastMonthPrefix, customStartDate, customEndDate, calendarType, language]);

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
      const isGlobalAcc = Boolean(acc.isGlobal);
      const isMaskedForUser = isGlobalAcc && !hasAllProjectsAccess;

      map.set(String(acc.id), {
        account: acc,
        initialBalance: Number(acc.initialBalance) || 0,
        totalInflow: 0,
        totalOutflow: 0,
        currentBalance: Number(acc.initialBalance) || 0,
        projectInflow: 0,
        projectOutflow: 0,
        inflowsCount: 0,
        outflowsCount: 0,
        isGlobal: isGlobalAcc,
        isMasked: isMaskedForUser,
        transactions: []
      });
    });

    // ۱. ورودی‌های تنخواه و واریزی‌ها
    const incomeList = hasAllProjectsAccess ? allCompanyIncomes : treasuryIncomes;
    incomeList.forEach((inc) => {
      const amt = Number(inc.amount) || 0;
      let targetId = inc.accountId ? String(inc.accountId) : (inc.accountType === 'bank' ? defaultBankId : defaultCashId);
      if (targetId && map.has(targetId)) {
        const entry = map.get(targetId);
        const isThisProject = !inc.projectId || inc.projectId === projectId || projectId === DEFAULT_PROJECT_ID;

        // If local account and not this project, skip
        if (!entry.isGlobal && !isThisProject) return;

        // If global account but user is restricted to a single project, skip other projects' data
        if (entry.isGlobal && !hasAllProjectsAccess && !isThisProject) return;

        entry.totalInflow += amt;
        entry.inflowsCount += 1;
        if (isThisProject) entry.projectInflow += amt;
        
        const cp = inc.counterpartyId ? counterpartyMap.get(String(inc.counterpartyId)) : null;
        const payerName = cp ? cp.name : (inc.payer || '');
        const descPrefix = payerName ? `واریزکننده: ${payerName}` : '';
        const finalDesc = [descPrefix, inc.description].filter(Boolean).join(' - ');

        entry.transactions.push({
          id: inc.id,
          projectId: inc.projectId || projectId,
          rawDate: (inc.date || inc.createdAt || '').slice(0, 10),
          time: inc.time || (inc.createdAt ? inc.createdAt.slice(11, 16) : ''),
          createdAt: inc.createdAt || (inc.date ? `${inc.date}T00:00:00Z` : ''),
          type: 'inflow',
          category: 'petty_cash',
          categoryLabel: 'شارژ تنخواه / واریزی',
          title: inc.title || 'واریز تنخواه کارگاه',
          description: finalDesc,
          personName: payerName,
          inflowAmount: amt,
          outflowAmount: 0,
          amount: amt,
          voucherNumber: inc.voucherNumber || getDeterministicVoucher(inc),
          isSystem: false,
          rawItem: inc
        });
      }
    });

    // ۲. پرداختی‌های پرسنل (مساعده، تسویه دستمزد، وام)
    const paymentList = hasAllProjectsAccess ? allCompanyPayments : payments;
    paymentList.forEach((p) => {
      const amt = Number(p.amount) || 0;
      let targetId = p.accountId ? String(p.accountId) : (p.paymentMethod === 'bank' || p.accountType === 'bank' ? defaultBankId : defaultCashId);
      if (targetId && map.has(targetId)) {
        const entry = map.get(targetId);
        const isThisProject = !p.projectId || p.projectId === projectId || projectId === DEFAULT_PROJECT_ID;

        if (!entry.isGlobal && !isThisProject) return;
        if (entry.isGlobal && !hasAllProjectsAccess && !isThisProject) return;

        entry.totalOutflow += amt;
        entry.outflowsCount += 1;
        if (isThisProject) entry.projectOutflow += amt;

        const isAdvance = p.type === 'advance' || p.type === 'Advance_Payment';
        const isBonus = p.type === 'bonus' || p.type === 'eid';
        const isLoan = p.type === 'loan' || p.type === 'loan_disbursement';
        const workerName = p.workerName || workerMap.get(String(p.workerId)) || 'پرسنل';
        const category = isBonus ? 'worker_bonus' : isAdvance ? 'advance_payment' : isLoan ? 'staff_loan' : 'worker_settlement';
        const categoryLabel = isBonus ? (p.bonusTitle || 'عیدی و پاداش پرسنل') : isAdvance ? 'مساعده پرسنل' : isLoan ? 'وام و تسهیلات پرسنلی' : 'تسویه دستمزد پرسنل';
        const title = isBonus ? `پرداخت عیدی/پاداش به ${workerName}` : isAdvance ? `پرداخت مساعده به ${workerName}` : isLoan ? `اعطای وام پرسنلی به ${workerName}` : `تسویه حساب نهایی ${workerName}`;
        entry.transactions.push({
          id: p.id,
          projectId: p.projectId || projectId,
          rawDate: (p.date || p.createdAt || '').slice(0, 10),
          time: p.time || (p.createdAt ? p.createdAt.slice(11, 16) : ''),
          createdAt: p.createdAt || (p.date ? `${p.date}T00:00:00Z` : ''),
          type: 'outflow',
          category,
          categoryLabel,
          title,
          description: p.notes || (p.referenceNumber ? `کد رهگیری: ${p.referenceNumber}` : ''),
          personName: workerName,
          inflowAmount: 0,
          outflowAmount: amt,
          amount: amt,
          voucherNumber: p.voucherNumber || getDeterministicVoucher(p),
          isSystem: true,
          rawItem: p
        });
      }
    });

    // ۳. هزینه‌ها و فاکتورهای کارگاه
    const expenseList = hasAllProjectsAccess ? allCompanyExpenses : expenses;
    expenseList.forEach((e) => {
      const amt = Number(e.amount) || 0;
      let targetId = e.accountId ? String(e.accountId) : (e.paymentMethod === 'bank' || e.accountType === 'bank' ? defaultBankId : defaultCashId);
      if (targetId && map.has(targetId)) {
        const entry = map.get(targetId);
        const isThisProject = !e.projectId || e.projectId === projectId || projectId === DEFAULT_PROJECT_ID;

        if (!entry.isGlobal && !isThisProject) return;
        if (entry.isGlobal && !hasAllProjectsAccess && !isThisProject) return;

        entry.totalOutflow += amt;
        entry.outflowsCount += 1;
        if (isThisProject) entry.projectOutflow += amt;

        entry.transactions.push({
          id: e.id,
          projectId: e.projectId || projectId,
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
          voucherNumber: e.voucherNumber || getDeterministicVoucher(e),
          isSystem: true,
          rawItem: e
        });
      }
    });

    // ۴. تراکنش‌های انتقال وجه بین حساب‌ها (کارت به کارت / صندوق به بانک)
    const transferList = hasAllProjectsAccess ? allCompanyTransfers : accountTransfers;
    transferList.forEach((trf) => {
      const amt = Number(trf.amount) || 0;
      const rawDate = (trf.date || trf.createdAt || '').slice(0, 10);
      const time = trf.time || (trf.createdAt ? trf.createdAt.slice(11, 16) : '');
      const createdAt = trf.createdAt || (trf.date ? `${trf.date}T00:00:00Z` : '');
      const vNo = trf.voucherNumber || getDeterministicVoucher(trf);
      const isThisProject = !trf.projectId || trf.projectId === projectId || projectId === DEFAULT_PROJECT_ID;

      // خروجی از حساب مبدأ
      if (trf.fromAccountId && map.has(String(trf.fromAccountId))) {
        const fromEntry = map.get(String(trf.fromAccountId));
        if (fromEntry.isGlobal || isThisProject) {
          if (!fromEntry.isGlobal || hasAllProjectsAccess || isThisProject) {
            fromEntry.totalOutflow += amt;
            fromEntry.outflowsCount += 1;
            if (isThisProject) fromEntry.projectOutflow += amt;

            fromEntry.transactions.push({
              id: `${trf.id}_out`,
              projectId: trf.projectId || projectId,
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
              voucherNumber: vNo,
              isSystem: false,
              isTransfer: true,
              rawItem: trf
            });
          }
        }
      }

      // ورودی به حساب مقصد
      if (trf.toAccountId && map.has(String(trf.toAccountId))) {
        const toEntry = map.get(String(trf.toAccountId));
        if (toEntry.isGlobal || isThisProject) {
          if (!toEntry.isGlobal || hasAllProjectsAccess || isThisProject) {
            toEntry.totalInflow += amt;
            toEntry.inflowsCount += 1;
            if (isThisProject) toEntry.projectInflow += amt;

            toEntry.transactions.push({
              id: `${trf.id}_in`,
              projectId: trf.projectId || projectId,
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
              voucherNumber: vNo,
              isSystem: false,
              isTransfer: true,
              rawItem: trf
            });
          }
        }
      }
    });

    // محاسبه موجودی زنده و مانده تجمعی (Running Balance) برای هر حساب
    map.forEach((entry) => {
      if (entry.isMasked) {
        // برای مدیر کارگاهی با دسترسی محدود، موجودی کل شرکت ماسک می‌شود و فقط تراز پروژه نشان داده می‌شود
        entry.currentBalance = entry.totalInflow - entry.totalOutflow;
        entry.realBalance = null;
      } else {
        // برای مدیر ارشد یا حساب محلی، موجودی واقعی با احتساب مانده اولیه محاسبه می‌گردد
        entry.currentBalance = entry.initialBalance + entry.totalInflow - entry.totalOutflow;
        entry.realBalance = entry.currentBalance;
      }

      entry.transactions.sort((a, b) => {
        if (a.rawDate !== b.rawDate) return a.rawDate.localeCompare(b.rawDate);
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });

      let running = entry.isMasked ? 0 : entry.initialBalance;
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
  }, [
    financialAccounts,
    hasAllProjectsAccess,
    allCompanyIncomes,
    treasuryIncomes,
    allCompanyPayments,
    payments,
    allCompanyExpenses,
    expenses,
    allCompanyTransfers,
    accountTransfers,
    counterpartyMap,
    workerMap,
    projectId
  ]);

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

    let totalBonuses = 0;
    payments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      totalPersonnel += amt;
      if (p.type === 'advance') {
        totalAdvances += amt;
      } else if (p.type === 'bonus' || p.type === 'eid') {
        totalBonuses += amt;
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
  // ۳.۵ محاسبه جامع و تفکیکی صورت سود و زیان (P&L) کارگاه
  // ----------------------------------------------------
  const profitAndLossData = useMemo(() => {
    return calculateProfitAndLoss({
      incomes: treasuryIncomes,
      expenses,
      payments,
      attendanceLogs,
      workers,
      counterparties,
      currency,
      basis: profitAndLossBasis,
      dateFilter: {
        mode: dateFilterMode,
        startDate: customStartDate,
        endDate: customEndDate,
        selectedMonth
      }
    });
  }, [
    treasuryIncomes,
    expenses,
    payments,
    attendanceLogs,
    workers,
    counterparties,
    currency,
    profitAndLossBasis,
    dateFilterMode,
    customStartDate,
    customEndDate,
    selectedMonth
  ]);

  // ----------------------------------------------------
  // ۴. ساخت دفتر کل تراکنش‌ها (General Ledger) با Running Balance
  // ----------------------------------------------------
  const { ledgerItems, filteredLedgerItems, ledgerStats } = useMemo(() => {
    const rawTransactions = [];

    const checkIsValidAmendment = (item) => {
      if (!item || !item.isAmended) return false;
      if (item.id === 'pay_mu78pbii_r6wsv' && Number(item.amount) === Number(item.originalAmount)) {
        return false;
      }
      return Array.isArray(item.amendmentHistory) ? item.amendmentHistory.length > 0 : Boolean(item.amendmentReason);
    };

    // ۱. تراکنش‌های ورودی (تنخواه و واریزی‌ها)
    treasuryIncomes.forEach((inc) => {
      const dateStr = (inc.date || inc.createdAt || '').slice(0, 10);
      const acc = inc.accountId ? accountMap.get(String(inc.accountId)) : null;
      const cp = inc.counterpartyId ? counterpartyMap.get(String(inc.counterpartyId)) : null;
      const payerName = cp ? cp.name : (inc.payer || '');
      const descPrefix = payerName ? `واریزکننده: ${payerName}` : '';
      const finalDesc = [descPrefix, inc.description].filter(Boolean).join(' - ');

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
        description: finalDesc,
        tableName: 'treasuryIncomes',
        voucherNumber: inc.voucherNumber || getDeterministicVoucher(inc),
        bankTrackingCode: inc.bankTrackingCode || inc.trackingCode || '',
        bankDocumentNumber: inc.bankDocumentNumber || inc.documentNumber || '',
        chequeNumber: inc.chequeNumber || '',
        chequeId: inc.chequeId || null,
        status: (inc.status === 'approved' || inc.approval_status === 'approved') ? 'approved' : 'draft',
        approvedBy: inc.approvedBy || inc.approved_by_name || null,
        approvedAt: inc.approvedAt || inc.approved_at || null,
        isAmended: checkIsValidAmendment(inc),
        originalAmount: inc.originalAmount,
        amendmentReason: inc.amendmentReason,
        amendedBy: inc.amendedBy,
        amendedAt: inc.amendedAt,
        amendmentHistory: inc.amendmentHistory || [],
        isSystem: false, // قابل ویرایش و حذف مستقیم
        rawItem: inc
      });
    });

    // ۲. تراکنش‌های پرداختی پرسنل و پیمانکاران (مساعده، تسویه دستمزد، وام، اقساط صورت‌وضعیت قرارداد)
    payments.forEach((p) => {
      const dateStr = (p.date || p.createdAt || '').slice(0, 10);
      const isAdvance = p.type === 'advance' || p.type === 'Advance_Payment';
      const isBonus = p.type === 'bonus' || p.type === 'eid';
      const isLoan = p.type === 'loan' || p.type === 'loan_disbursement';
      const isContractPayment = p.type === 'contract_settlement_payment';
      const workerName = p.workerName || workerMap.get(String(p.workerId)) || (isContractPayment ? 'پیمانکار' : 'پرسنل');
      const acc = p.accountId ? accountMap.get(String(p.accountId)) : null;
      const category = isContractPayment ? 'contract_payment' : (isBonus ? 'worker_bonus' : isAdvance ? 'advance_payment' : isLoan ? 'staff_loan' : 'worker_settlement');
      const categoryLabel = isContractPayment ? 'پرداخت صورت‌وضعیت قرارداد' : (isBonus ? (p.bonusTitle || 'عیدی و پاداش پرسنل') : isAdvance ? 'مساعده پرسنل' : isLoan ? 'وام و تسهیلات پرسنلی' : 'تسویه دستمزد پرسنل');
      const title = isContractPayment ? (p.notes || `پرداخت صورت‌وضعیت قرارداد به ${workerName}`) : (isBonus ? `پرداخت عیدی/پاداش به ${workerName}` : isAdvance ? `پرداخت مساعده به ${workerName}` : isLoan ? `اعطای وام پرسنلی به ${workerName}` : `تسویه حساب نهایی ${workerName}`);

      rawTransactions.push({
        id: p.id,
        rawDate: dateStr,
        createdAt: p.createdAt || `${dateStr}T00:00:00Z`,
        type: 'outflow', // خروجی
        category,
        categoryLabel,
        isContractPayment,
        contractId: p.contractId || null,
        settlementId: p.settlementId || null,
        amount: Number(p.amount) || 0,
        accountType: p.accountType || acc?.type || p.paymentMethod || 'cash',
        accountId: p.accountId || null,
        accountName: acc?.name || (p.paymentMethod === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
        title,
        description: p.notes || (p.referenceNumber ? `کد رهگیری: ${p.referenceNumber}` : ''),
        personName: workerName,
        tableName: 'payments',
        voucherNumber: p.voucherNumber || getDeterministicVoucher(p),
        bankTrackingCode: p.bankTrackingCode || p.trackingCode || p.referenceNumber || '',
        bankDocumentNumber: p.bankDocumentNumber || p.documentNumber || '',
        chequeNumber: p.chequeNumber || '',
        chequeId: p.chequeId || null,
        status: (p.status === 'approved' || p.approval_status === 'approved') ? 'approved' : 'draft',
        approvedBy: p.approvedBy || p.approved_by_name || null,
        approvedAt: p.approvedAt || p.approved_at || null,
        isAmended: checkIsValidAmendment(p),
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

    // ۳. تراکنش‌های هزینه کارگاه و صورت‌وضعیت‌های تعهدی قرارداد
    allProjectExpenses.forEach((e) => {
      const dateStr = (e.expenseDate || e.createdAt || '').slice(0, 10);
      const acc = e.accountId ? accountMap.get(String(e.accountId)) : null;
      const isContract = Boolean(e.isContractSettlement || e.contractId);
      const category = isContract ? 'contract_settlement' : 'workshop_expense';
      const categoryLabel = isContract ? 'صورت‌وضعیت قرارداد' : 'هزینه کارگاه (فاکتور)';

      rawTransactions.push({
        id: e.id,
        rawDate: dateStr,
        createdAt: e.createdAt || `${dateStr}T00:00:00Z`,
        type: 'outflow', // خروجی
        category,
        categoryLabel,
        isContractSettlement: isContract,
        contractId: e.contractId || null,
        paymentStatus: e.paymentStatus || 'unpaid',
        paidAmount: Number(e.paidAmount) || 0,
        remainingAmount: e.remainingAmount !== undefined ? Number(e.remainingAmount) : Number(e.amount) || 0,
        amount: Number(e.amount) || 0,
        accountType: e.accountType || acc?.type || e.paymentMethod || 'cash',
        accountId: e.accountId || null,
        accountName: acc?.name || (e.paymentMethod === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
        title: e.title || (isContract ? 'صورت‌وضعیت قرارداد' : 'هزینه کارگاه'),
        description: e.personName ? `طرف‌حساب: ${e.personName}` : (e.description || ''),
        personName: e.personName || '',
        tableName: 'expenses',
        voucherNumber: e.voucherNumber || getDeterministicVoucher(e),
        bankTrackingCode: e.bankTrackingCode || '',
        bankDocumentNumber: e.bankDocumentNumber || '',
        chequeNumber: e.chequeNumber || '',
        chequeId: e.chequeId || null,
        status: (e.status === 'approved' || e.approval_status === 'approved') ? 'approved' : 'draft',
        approvedBy: e.approvedBy || e.approved_by_name || null,
        approvedAt: e.approvedAt || e.approved_at || null,
        isAmended: checkIsValidAmendment(e),
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
      const normalizedStatus = (trf.status === 'approved' || trf.approval_status === 'approved') ? 'approved' : 'draft';
      const isTrfAmended = checkIsValidAmendment(trf);

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
        voucherNumber: trf.voucherNumber || getDeterministicVoucher(trf),
        bankTrackingCode: trf.bankTrackingCode || trf.trackingCode || trf.reference || '',
        bankDocumentNumber: trf.bankDocumentNumber || trf.documentNumber || '',
        status: normalizedStatus,
        approvedBy: trf.approvedBy || trf.approved_by_name || null,
        approvedAt: trf.approvedAt || trf.approved_at || null,
        isAmended: isTrfAmended,
        originalAmount: trf.originalAmount,
        amendmentReason: trf.amendmentReason,
        amendedBy: trf.amendedBy,
        amendedAt: trf.amendedAt,
        amendmentHistory: trf.amendmentHistory || [],
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
        voucherNumber: trf.voucherNumber || getDeterministicVoucher(trf),
        status: normalizedStatus,
        approvedBy: trf.approvedBy || trf.approved_by_name || null,
        approvedAt: trf.approvedAt || trf.approved_at || null,
        isAmended: isTrfAmended,
        originalAmount: trf.originalAmount,
        amendmentReason: trf.amendmentReason,
        amendedBy: trf.amendedBy,
        amendedAt: trf.amendedAt,
        amendmentHistory: trf.amendmentHistory || [],
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

    // فیلتر کردن ردیف‌ها بر اساس تاریخ، دسته‌بندی، حساب و جستجو (پیش از تب وضعیت تایید)
    const searchLower = searchQuery.trim().toLowerCase();

    const baseFiltered = ledgerWithBalances.filter((tx) => {
      // فیلتر تاریخ
      if (!checkDateMatch(tx.rawDate)) return false;

      // فیلتر دسته‌بندی
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;

      // فیلتر حساب یا نوع حساب (صندوق / بانک / حساب خاص)
      if (accountTypeFilter !== 'all') {
        if (accountTypeFilter === 'cash' && tx.accountType !== 'cash') return false;
        else if (accountTypeFilter === 'bank' && tx.accountType !== 'bank') return false;
        else if (accountTypeFilter !== 'cash' && accountTypeFilter !== 'bank') {
          if (tx.accountId !== accountTypeFilter) return false;
        }
      }

      // فیلتر جستجو متنی (شامل جستجوی شماره سند، عنوان، طرف‌حساب و شرح)
      if (searchLower) {
        const matchesVoucher = (tx.voucherNumber || '').toLowerCase().includes(searchLower);
        const matchesTitle = (tx.title || '').toLowerCase().includes(searchLower);
        const matchesDesc = (tx.description || '').toLowerCase().includes(searchLower);
        const matchesPerson = (tx.personName || '').toLowerCase().includes(searchLower);
        const matchesAccount = (tx.accountName || '').toLowerCase().includes(searchLower);
        const matchesAmount = String(tx.amount).includes(searchLower);
        if (!matchesVoucher && !matchesTitle && !matchesDesc && !matchesPerson && !matchesAccount && !matchesAmount) return false;
      }

      return true;
    });

    // محاسبه دقیق شمارنده‌های ۴ تب بر اساس فیلترهای جاری تا عدد کنار هر تب ۱۰۰٪ منطبق با لیست همان تب باشد
    let total = 0;
    let draft = 0;
    let approved = 0;
    let amended = 0;

    baseFiltered.forEach((tx) => {
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

    // اعمال فیلتر تب وضعیت تایید (همه اسناد / اسناد موقت / تایید نهایی / اصلاحیه‌ها)
    const filtered = baseFiltered.filter((tx) => {
      if (approvalStatusFilter === 'draft') {
        return tx.status !== 'approved';
      }
      if (approvalStatusFilter === 'approved') {
        return tx.status === 'approved';
      }
      if (approvalStatusFilter === 'amended') {
        return Boolean(tx.isAmended);
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
      filteredLedgerItems: filtered,
      ledgerStats: { total, draft, approved, amended }
    };
  }, [treasuryIncomes, payments, allProjectExpenses, accountTransfers, workerMap, counterpartyMap, accountMap, checkDateMatch, categoryFilter, accountTypeFilter, searchQuery, approvalStatusFilter]);

  // ----------------------------------------------------
  // ۵. تجمیع روزانه جریان نقدینگی (Cash Flow Chart Data)
  // ----------------------------------------------------
  const cashFlowChartData = useMemo(() => {
    // ماه مبنا جهت ترسیم نمودار
    const targetMonth = selectedMonth || getCurrentYearMonth(calendarType, language);
    const monthDetails = getCalendarMonthDetails(targetMonth, calendarType, language);

    // ایجاد آرایه‌ای برای تک تک روزهای ماه
    const dailyMap = {};
    monthDetails.days.forEach((dayInfo) => {
      const fullDate = dayInfo.dateStr;
      dailyMap[fullDate] = {
        day: dayInfo.dayNumber,
        dayNumber: String(dayInfo.dayNumber).padStart(2, '0'),
        date: fullDate,
        inflow: 0,
        outflow: 0,
        net: 0
      };
    });

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
  }, [selectedMonth, treasuryIncomes, payments, expenses, currency, calendarType, language]);

  // ----------------------------------------------------
  // ۶. متدهای CRUD برای مدیریت واریزی‌ها و شارژ تنخواه
  // ----------------------------------------------------
  // ۶. متدهای CRUD برای مدیریت واریزی‌ها، شارژ تنخواه و حساب‌ها
  // ----------------------------------------------------
  const addIncome = useCallback(async ({ amount, date, title, accountType, accountId, accountName, description, payer, counterpartyId, status }) => {
    const numAmount = Number(String(amount).replace(/,/g, ''));
    if (!numAmount || numAmount <= 0) {
      throw new Error('مبلغ واریزی باید بزرگتر از صفر باشد');
    }

    const fallbackTitle = (title && title.trim()) ? title.trim() : `افزایش موجودی ${accountName || (accountType === 'bank' ? 'کارت بانکی' : 'صندوق')}`;

    const now = new Date();
    const effectiveDate = date || getTodayDateString();
    const voucherNumber = await generateNextVoucherNumber({ date: effectiveDate, isDraft: true });

    const newRecord = {
      id: generateTreasuryIncomeId(),
      projectId,
      counterpartyId: counterpartyId || null,
      userId: user?.id || user?.userId || 'default_user',
      amount: numAmount,
      date: effectiveDate,
      voucherNumber,
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

    const isGlobal = accountData.isGlobal !== undefined
      ? Boolean(accountData.isGlobal)
      : (accountData.type === 'bank');
    const scope = accountData.scope || (isGlobal ? 'global' : 'project');

    const record = {
      id: newId,
      projectId: isGlobal ? (DEFAULT_PROJECT_ID || projectId) : projectId,
      userId: user?.id || 'default_user',
      name: accountData.name?.trim() || (accountData.type === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
      type: accountData.type || 'bank', // 'bank' | 'cash'
      isGlobal,
      scope,
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
      // غیرفعال کردن پیش‌فرض از سایر حساب‌های این پروژه یا حساب‌های مشترک
      const allAccs = await db.financialAccounts.toArray();
      const updates = allAccs
        .filter((a) => (a.isGlobal || a.projectId === projectId) && a.isDefault)
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

    if (cleanMods.isGlobal !== undefined) {
      cleanMods.scope = cleanMods.isGlobal ? 'global' : 'project';
    }

    if (cleanMods.isDefault) {
      const allAccs = await db.financialAccounts.toArray();
      const updates = allAccs
        .filter((a) => a.id !== id && a.isDefault)
        .map((a) => db.financialAccounts.update(a.id, { isDefault: false, updatedAt: now }));
      await Promise.all(updates);
    }

    await db.financialAccounts.update(id, cleanMods);
    const updatedAccount = await db.financialAccounts.get(id);
    if (updatedAccount) {
      pushFinancialAccountLive(updatedAccount).catch(console.warn);
    }
    await pushAllFinancialAccountsToCloud();
    window.dispatchEvent(new CustomEvent('workshop-accounts-sync'));
  }, []);

  const setDefaultAccount = useCallback(async (id) => {
    if (!id) return;
    const allAccs = await db.financialAccounts.toArray();
    const strTargetId = String(id);
    const updates = allAccs.map((a) =>
      db.financialAccounts.update(a.id, {
        isDefault: String(a.id) === strTargetId,
        updatedAt: new Date().toISOString()
      })
    );
    await Promise.all(updates);
    await pushAllFinancialAccountsToCloud();
    window.dispatchEvent(new CustomEvent('workshop-accounts-sync'));
  }, []);

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
    const strTargetId = accountId ? String(accountId) : null;
    let acc = strTargetId ? financialAccounts.find((a) => String(a.id) === strTargetId) : null;
    if (!acc && strTargetId && accountBalances.has(strTargetId)) {
      acc = accountBalances.get(strTargetId)?.account;
    }
    if (!acc) {
      acc = defaultAccount;
    }
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
    const effectiveDate = date || getTodayDateString();
    const voucherNumber = await generateNextVoucherNumber({ date: effectiveDate, isDraft: true });

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
      date: effectiveDate,
      voucherNumber,
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
    // موتور و داده‌های صورت سود و زیان (P&L)
    profitAndLossData,
    profitAndLossBasis,
    setProfitAndLossBasis,
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
    // چک‌ها و اسناد تجاری
    cheques,
    chequebooks,
    chequeStats,
    // متدهای انتقال بین حساب‌ها (حساب به حساب)
    accountTransfers,
    transferBetweenAccounts,
    deleteTransfer,
    // همگام‌سازی فوری حساب‌ها
    syncFinancialAccounts
  };
}
