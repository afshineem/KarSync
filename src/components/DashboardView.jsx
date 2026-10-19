import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { TasksModal } from './TasksModal';
import { TaskFormModal } from './TaskFormModal';
import { useProject } from '../context/ProjectContext';
import { useTasks } from '../hooks/useTasks';
import { pullExpensesLive } from '../services/realtimeSync';
import {
  formatAmount,
  getCurrentYearMonth,
  roundCurrency,
  getCurrencySymbol,
  formatMonthOnly
} from '../utils/formatters';
import { calculateWorkerFinancials } from '../utils/settlementCalculations';
import {
  Calendar,
  Coins,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Layers,
  UserCheck,
  Sparkles,
  ListTodo,
  Check,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Plus,
  PieChart,
  CalendarCheck,
  Building2,
  Copy
} from 'lucide-react';

export function DashboardView({ onOpenLoggingModal, setActiveTab }) {
  const {
    language,
    timeFormat,
    timeZone,
    calendarType,
    numberFormat,
    formatTime,
    formatDate,
    convertDigits
  } = useLanguage();
  const { user } = useAuth();
  const { currentProject, openWorkerProfile, openGlobalSettings } = useProject();
  const [copiedWsCode, setCopiedWsCode] = useState(false);
  const activeWorkspace = useLiveQuery(async () => {
    try {
      if (db.workspaces) {
        const list = await db.workspaces.toArray();
        return list[0] || null;
      }
    } catch (_) {}
    return null;
  }, []);
  const displayWsCode = user?.workspaceCode || activeWorkspace?.workspace_code || 'KARS-101';

  const handleCopyWsCode = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(displayWsCode);
    setCopiedWsCode(true);
    setTimeout(() => setCopiedWsCode(false), 2000);
  };
  const currency = currentProject?.currency || 'IQD';
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  // Trilingual UI Dictionary for DashboardView (Zero Cross-Language Leakage)
  const copy = {
    fa: {
      generalExpense: 'هزینه عمومی',
      unassignedSection: 'عمومی / بدون بخش',
      accountAndSettingsTitle: 'حساب کاربری و تنظیمات',
      dashboardTitle: 'پیشخوان کارگاه',
      activeProjectFallback: 'پروژه جاری',
      prevMonthTitle: 'ماه قبل',
      nextMonthTitle: 'ماه بعد',
      monthlyFinancialPulse: 'نبض مالی کارگاه در این ماه',
      totalGrossPayrollDesc: 'مجموع ناخالص حقوق و کارکرد ثبت‌شده پرسنل',
      settledLabel: 'تسویه‌شده:',
      pendingLabel: 'مانده معوق:',
      clearedSuffix: 'پوشش داده شده',
      totalAccumulatedDebtLabel: 'بدهی کل انباشته کارگاه:',
      totalWorkDaysLabel: 'کل کارکرد',
      daysUnit: 'روز',
      overtimeHoursSuffix: 'ساعت اضافه',
      activeForceLabel: 'پرسنل فعال',
      workersUnit: 'نفر',
      fullySettledSuffix: 'تسویه کامل',
      logShiftBtn: 'ثبت کارکرد',
      tasksBtn: 'تسک‌ها',
      todayAttendanceTitle: 'وضعیت حضور امروز',
      shiftRecordedToday: 'تکمیل شیفت امروز',
      recordedPresentLabel: 'حاضرین ثبت‌شده:',
      absentTodayLabel: 'غایبین امروز:',
      pendingLogLabel: 'ثبت‌نشده / بدون کارکرد:',
      quickLogTodayBtn: 'ثبت ورود یا کارکرد امروز کارگاه',
      costBreakdownTitle: 'توزیع مخارج ماه',
      costBreakdownSubtitle: 'دستمزد پرسنل در برابر فاکتورهای پروژه',
      payrollLabel: 'حقوق و دستمزد',
      expensesLabel: 'هزینه‌ها و تنخواه',
      viewFinancialLedgerBtn: 'مشاهده دفتر مالی و ثبت هزینه‌ها',
      activeSectionsTitle: 'بخش‌های فعال کارگاه',
      activeSectionsSubtitle: 'توزیع هزینه و نفر-روز در بخش‌های کارگاه',
      manageSectionsBtn: 'مدیریت بخش‌ها',
      noSectionLogsThisMonth: 'هنوز کارکردی برای بخش‌های کارگاه در این ماه ثبت نشده است.',
      workDaysSuffix: 'روز کارکرد',
      shareOfPayrollSuffix: 'سهم از حقوق',
      priorityTasksTitle: 'تسک‌های فوری امروز',
      openTasksSuffix: 'تسک در جریان',
      viewAllTasksBtn: 'مشاهده همه',
      noPendingTasksMsg: 'هیچ تسک در جریانی وجود ندارد. همه کارها انجام شده‌اند!',
      completeTaskTitle: 'تکمیل تسک',
      priorityHighBadge: 'فوری',
      priorityNormalBadge: 'عادی',
      createNewTaskBtn: 'افزودن تسک جدید',
      topSettlementPrioritiesTitle: 'اولویت‌های تسویه حساب پرسنل',
      topSettlementPrioritiesSubtitle: 'پرسنل دارای بیشترین مطالبات پرداخت‌نشده',
      openSettlementDeskBtn: 'ورود به میز تسویه کامل',
      allAccountsSettledMsg: 'تبریک! تمام حساب‌های پرسنل کاملاً تسویه هستند و بدهی معوقی وجود ندارد.',
      defaultWorkerRole: 'کارگر',
      pendingSettlementLabel: 'طلب معوق نیازمند پرداخت',
      workshopCode: 'کد کارگاه:',
      copied: 'کپی شد!'
    },
    ku: {
      generalExpense: 'خەرجی گشتی',
      unassignedSection: 'گشتی / بێ بەش',
      accountAndSettingsTitle: 'هەژماری بەکارهێنەر و ڕێکخستنەکان',
      dashboardTitle: 'داشبۆردی کارگە',
      activeProjectFallback: 'پڕۆژەی چالاک',
      prevMonthTitle: 'مانگی پێشوو',
      nextMonthTitle: 'مانگی داهاتوو',
      monthlyFinancialPulse: 'لێدانی دارایی کارگە لەم مانگەدا',
      totalGrossPayrollDesc: 'کۆی گشتی مووچە و کارکردی تۆمارکراوی کرێکاران',
      settledLabel: 'پاکتاوکراو:',
      pendingLabel: 'ماوەی دواکەوتوو:',
      clearedSuffix: 'پاکتاوکراو',
      totalAccumulatedDebtLabel: 'کۆی قەرزی کەڵەکەبووی کارگە:',
      totalWorkDaysLabel: 'کۆی کارکرد',
      daysUnit: 'ڕۆژ',
      overtimeHoursSuffix: 'کاتژمێر زیادە',
      activeForceLabel: 'کرێکارانی چالاک',
      workersUnit: 'کەس',
      fullySettledSuffix: 'پاکتاوکراو',
      logShiftBtn: 'تۆماری کارکرد',
      tasksBtn: 'ئەرکەکان',
      todayAttendanceTitle: 'دۆخی ئامادەبوونی ئەمڕۆ',
      shiftRecordedToday: 'تەواوبوونی شەفتی ئەمڕۆ',
      recordedPresentLabel: 'ئامادەبووانی تۆمارکراو:',
      absentTodayLabel: 'ئامادەنەبووانی ئەمڕۆ:',
      pendingLogLabel: 'تۆمارنەکراو / بێ تۆمار:',
      quickLogTodayBtn: 'تۆمارکردنی ئامادەبوون و کارکردی ئەمڕۆ',
      costBreakdownTitle: 'دابەشبوونی خەرجییەکانی مانگ',
      costBreakdownSubtitle: 'مووچەی کرێکاران بەرامبەر پسووڵە و خەرجییەکانی پڕۆژە',
      payrollLabel: 'مووچە و حەقدەست',
      expensesLabel: 'خەرجییەکان و سندوق',
      viewFinancialLedgerBtn: 'بینینی دەفتەری دارایی و تۆمارکردنی خەرجییەکان',
      activeSectionsTitle: 'بەشە چالاکەکانی کارگە',
      activeSectionsSubtitle: 'دابەشبوونی تێچوو و ڕۆژەکار لە بەشەکانی کارگە',
      manageSectionsBtn: 'بەڕێوەبردنی بەشەکان',
      noSectionLogsThisMonth: 'هێشتا هیچ کارکردێک بۆ بەشەکانی کارگە لەم مانگەدا تۆمار نەکراوە.',
      workDaysSuffix: 'ڕۆژ کارکرد',
      shareOfPayrollSuffix: 'پشک لە مووچە',
      priorityTasksTitle: 'ئەرکە گرنگەکانی ئەمڕۆ',
      openTasksSuffix: 'ئەرکی بەردەوام',
      viewAllTasksBtn: 'بینینی هەمووان',
      noPendingTasksMsg: 'هیچ ئەرکێکی بەردەوام نییە. هەموو کارەکان ئەنجام دراون!',
      completeTaskTitle: 'تەواوکردنی ئەرک',
      priorityHighBadge: 'فۆری',
      priorityNormalBadge: 'ئاسایی',
      createNewTaskBtn: 'زیادکردنی ئەرکی نوێ',
      topSettlementPrioritiesTitle: 'ئەولەویەتەکانی پاکتاوی حیسابی کرێکاران',
      topSettlementPrioritiesSubtitle: 'ئەو کرێکارانەی زۆرترین شایستەی نەدراویان هەیە',
      openSettlementDeskBtn: 'چوونە ناو مێزی پاکتاوی تەواو',
      allAccountsSettledMsg: 'پیرۆزە! تەواوی حیسابی کرێکاران پاکتاو کراوە و هیچ قەرزێکی دواکەوتوو نییە.',
      defaultWorkerRole: 'کرێکار',
      pendingSettlementLabel: 'بڕە پارەی شایستەی دواکەوتوو',
      workshopCode: 'کۆدی کارگە:',
      copied: 'کۆپی کرا!'
    },
    en: {
      generalExpense: 'General Expense',
      unassignedSection: 'General / Unassigned',
      accountAndSettingsTitle: 'Account & Settings',
      dashboardTitle: 'Workshop Dashboard',
      activeProjectFallback: 'Active Project',
      prevMonthTitle: 'Previous Month',
      nextMonthTitle: 'Next Month',
      monthlyFinancialPulse: 'Monthly Financial Pulse',
      totalGrossPayrollDesc: 'Total Gross Payroll for Selected Month',
      settledLabel: 'Settled:',
      pendingLabel: 'Pending:',
      clearedSuffix: 'Cleared',
      totalAccumulatedDebtLabel: 'Total Outstanding Debt:',
      totalWorkDaysLabel: 'Work Days',
      daysUnit: 'days',
      overtimeHoursSuffix: 'hrs OT',
      activeForceLabel: 'Active Force',
      workersUnit: 'workers',
      fullySettledSuffix: 'settled',
      logShiftBtn: 'Log Shift',
      tasksBtn: 'Tasks',
      todayAttendanceTitle: 'Today Attendance Pulse',
      shiftRecordedToday: 'Shift recorded today',
      recordedPresentLabel: 'Recorded Present:',
      absentTodayLabel: 'Absent Today:',
      pendingLogLabel: 'Pending Log:',
      quickLogTodayBtn: 'Quick Log Today Attendance',
      costBreakdownTitle: 'Monthly Cost Breakdown',
      costBreakdownSubtitle: 'Payroll vs Project Expenses',
      payrollLabel: 'Payroll',
      expensesLabel: 'Expenses',
      viewFinancialLedgerBtn: 'View Financial Ledger & Expenses',
      activeSectionsTitle: 'Active Workshop Sections',
      activeSectionsSubtitle: 'Cost & person-days allocation by section',
      manageSectionsBtn: 'Manage Sections',
      noSectionLogsThisMonth: 'No section logs recorded this month.',
      workDaysSuffix: 'days',
      shareOfPayrollSuffix: 'of payroll',
      priorityTasksTitle: 'Priority Tasks',
      openTasksSuffix: 'open tasks',
      viewAllTasksBtn: 'View All',
      noPendingTasksMsg: 'No pending tasks! All clear.',
      completeTaskTitle: 'Complete Task',
      priorityHighBadge: 'High',
      priorityNormalBadge: 'Normal',
      createNewTaskBtn: 'Create New Task',
      topSettlementPrioritiesTitle: 'Top Settlement Priorities',
      topSettlementPrioritiesSubtitle: 'Workers with highest pending balances',
      openSettlementDeskBtn: 'Open Settlement Desk',
      allAccountsSettledMsg: 'All worker accounts are settled! Zero outstanding debt.',
      defaultWorkerRole: 'Worker',
      pendingSettlementLabel: 'Pending settlement',
      workshopCode: 'Workshop Code:',
      copied: 'Copied!'
    }
  }[langKey];

  // Localize default seeded project names so they never leak Persian into Kurdish or English
  const localizeProjectName = (name) => {
    const raw = (name || '').trim();
    if (!raw) return copy.activeProjectFallback;
    const defaultProjectNames = new Set([
      'پروژه مرکزی (کارگاه)',
      'کارگاه مرکزی (پیش‌فرض)',
      'کارگاه مرکزی',
      'کارگاه من',
      'پروژه نمونه'
    ]);
    if (defaultProjectNames.has(raw)) {
      if (langKey === 'ku') return 'پڕۆژەی سەرەکی (کارگە)';
      if (langKey === 'en') return 'Main Workshop Project';
      return raw;
    }
    return raw;
  };

  // Localize default section names
  const localizeSectionName = (name) => {
    const raw = (name || '').trim();
    if (!raw) return copy.unassignedSection;
    if (raw === 'عمومی / بدون بخش' || raw === 'بخش عمومی' || raw === 'عمومی') {
      return copy.unassignedSection;
    }
    return raw;
  };

  // Localize common default worker roles if stored in Persian/Kurdish/English
  const localizeWorkerRole = (role) => {
    const raw = (role || '').trim();
    if (!raw) return copy.defaultWorkerRole;
    const roleMap = {
      'کارگر': { fa: 'کارگر', ku: 'کرێکار', en: 'Worker' },
      'کارگر ساده': { fa: 'کارگر ساده', ku: 'کرێکاری سادە', en: 'General Worker' },
      'استادکار': { fa: 'استادکار', ku: 'وەستا', en: 'Master Craftsman' },
      'سرپرست': { fa: 'سرپرست', ku: 'سەرپەرشتیار', en: 'Supervisor' },
      'جوشکار': { fa: 'جوشکار', ku: 'لەحیمچی', en: 'Welder' },
      'شاگرد': { fa: 'شاگرد', ku: 'شاگرد', en: 'Apprentice' },
      'برق‌کار': { fa: 'برق‌کار', ku: 'کارەباچی', en: 'Electrician' },
      'تکنسین': { fa: 'تکنسین', ku: 'تەکنیکار', en: 'Technician' }
    };
    if (roleMap[raw]) return roleMap[raw][langKey];
    return raw;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);

  // Shortcut: Shift + T to toggle Tasks modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isInput) return;

      if (e.shiftKey && (e.key === 'T' || e.key === 't' || e.code === 'KeyT')) {
        e.preventDefault();
        setIsTasksModalOpen((prev) => !prev);
      }
    };
    const handleCustomOpen = () => setIsTasksModalOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('karsync-open-tasks', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('karsync-open-tasks', handleCustomOpen);
    };
  }, []);

  const { tasks, isLoading: isTasksLoading, fetchTasks, addTask, updateTask, deleteTask } = useTasks(targetProjectId);

  useEffect(() => {
    fetchTasks(targetProjectId);
  }, [targetProjectId, fetchTasks]);

  const activeTasksList = useMemo(() => {
    const active = tasks.filter((tItem) => tItem.status !== 'completed');
    const pWeight = { high: 3, medium: 2, low: 1 };
    active.sort((a, b) => (pWeight[b.priority || 'medium'] || 0) - (pWeight[a.priority || 'medium'] || 0));
    return active.slice(0, 4);
  }, [tasks]);

  const activeTasksCount = tasks.filter((tItem) => tItem.status !== 'completed').length;

  // Fetch reactive data from Dexie scoped to active project
  const workers =
    useLiveQuery(
      async () => {
        const list = await db.workers.toArray();
        return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
      },
      [targetProjectId]
    ) || [];

  const allPayments =
    useLiveQuery(
      async () => {
        const [list, wList] = await Promise.all([db.payments.toArray(), db.workers.toArray()]);
        const projectWorkerIds = new Set(
          wList
            .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId)
            .map((w) => String(w.id))
        );
        return list.filter(
          (p) =>
            (p.projectId || DEFAULT_PROJECT_ID) === targetProjectId ||
            projectWorkerIds.has(String(p.workerId))
        );
      },
      [targetProjectId]
    ) || [];

  const allAllLogs =
    useLiveQuery(
      async () => {
        const [list, wList] = await Promise.all([db.attendanceLogs.toArray(), db.workers.toArray()]);
        const projectWorkerIds = new Set(
          wList
            .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId)
            .map((w) => String(w.id))
        );
        return list.filter(
          (l) =>
            (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId ||
            projectWorkerIds.has(String(l.workerId))
        );
      },
      [targetProjectId]
    ) || [];

  const rawLogs =
    useLiveQuery(
      async () => {
        const [list, wList] = await Promise.all([db.attendanceLogs.toArray(), db.workers.toArray()]);
        const projectWorkerIds = new Set(
          wList
            .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId)
            .map((w) => String(w.id))
        );
        const projLogs = list.filter(
          (l) =>
            (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId ||
            projectWorkerIds.has(String(l.workerId))
        );
        return projLogs.filter((l) => l.date && l.date.startsWith(selectedMonth));
      },
      [targetProjectId, selectedMonth]
    ) || [];

  const projectSections =
    useLiveQuery(
      async () => {
        if (!targetProjectId) return [];
        return await db.projectSections.where('projectId').equals(targetProjectId).toArray();
      },
      [targetProjectId]
    ) || [];

  // Project expenses
  const projectExpenses =
    useLiveQuery(
      async () => {
        const [listA, listB] = await Promise.all([
          db.expenses.toArray(),
          db.projectExpenses.toArray()
        ]);
        const combinedMap = new Map();
        listB.forEach((e) => {
          combinedMap.set(e.id, {
            ...e,
            expenseDate: e.date || e.expenseDate || e.createdAt?.slice(0, 10),
            title: e.title || e.category || copy.generalExpense
          });
        });
        listA.forEach((e) => {
          combinedMap.set(e.id, {
            ...e,
            date: e.expenseDate || e.date,
            expenseDate: e.expenseDate || e.date || e.createdAt?.slice(0, 10)
          });
        });
        const list = Array.from(combinedMap.values());
        return list.filter(
          (e) =>
            !e.deletedAt &&
            (!targetProjectId ||
              (e.projectId || DEFAULT_PROJECT_ID) === targetProjectId ||
              targetProjectId === DEFAULT_PROJECT_ID)
        );
      },
      [targetProjectId, copy.generalExpense]
    ) || [];

  const monthlyExpenses = useMemo(() => {
    return projectExpenses.filter((e) => {
      const d = e.expenseDate || e.date || e.createdAt?.slice(0, 10) || '';
      return d.startsWith(selectedMonth);
    });
  }, [projectExpenses, selectedMonth]);

  const monthlyExpensesTotal = useMemo(() => {
    return monthlyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [monthlyExpenses]);

  // Pull latest cloud expenses
  useEffect(() => {
    pullExpensesLive().catch(() => {});
    const onSync = () => pullExpensesLive().catch(() => {});
    window.addEventListener('workshop-expenses-sync', onSync);
    window.addEventListener('focus', onSync);
    return () => {
      window.removeEventListener('workshop-expenses-sync', onSync);
      window.removeEventListener('focus', onSync);
    };
  }, [targetProjectId]);

  // Live ticking Clock & Date
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const liveTimeString = useMemo(() => {
    return formatTime(currentDateTime, { includeSeconds: true });
  }, [currentDateTime, formatTime, timeFormat, timeZone, numberFormat, language]);

  const liveDateString = useMemo(() => {
    return formatDate(currentDateTime);
  }, [currentDateTime, formatDate, language, calendarType, timeZone, numberFormat]);

  // Today's Date String in YYYY-MM-DD
  const todayDateStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Deduplicate logs in memory by workerId + date
  const logs = useMemo(() => {
    const map = new Map();
    rawLogs.forEach((l) => {
      const key = `${String(l.workerId)}_${l.date}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, l);
      } else {
        const timeL = l.updatedAt || l.createdAt || '';
        const timeEx = existing.updatedAt || existing.createdAt || '';
        if (timeL.localeCompare(timeEx) > 0) {
          map.set(key, l);
        }
      }
    });
    return Array.from(map.values());
  }, [rawLogs]);

  // Settle calculations
  const settledLogIds = useMemo(() => {
    const ids = new Set();
    workers.forEach((w) => {
      const workerLogs = allAllLogs.filter((l) => String(l.workerId) === String(w.id));
      const workerPayments = allPayments.filter(
        (p) => String(p.workerId) === String(w.id) || (w.groupId && p.groupId === w.groupId)
      );
      const fin = calculateWorkerFinancials(w, workerLogs, workerPayments);
      workerLogs.forEach((l) => {
        if (fin.isLogSettled(l)) {
          ids.add(String(l.id));
        }
      });
    });
    return ids;
  }, [workers, allAllLogs, allPayments]);

  const isLogSettled = (log) => settledLogIds.has(String(log.id));

  // Active workers
  const activeWorkers = useMemo(() => {
    return workers.filter((w) => w.isActive === 1);
  }, [workers]);

  // Today's Live Attendance & Logs
  const todayAttendance = useMemo(() => {
    const todayLogs = allAllLogs.filter((l) => l.date === todayDateStr && l.type !== 'absent');
    const loggedWorkerIds = new Set(todayLogs.map((l) => String(l.workerId)));
    const presentCount = loggedWorkerIds.size;
    const totalActive = activeWorkers.length;
    const unloggedCount = Math.max(0, totalActive - presentCount);
    const isShiftLogged = todayLogs.length > 0;
    return {
      todayLogs,
      presentCount,
      totalActive,
      unloggedCount,
      isShiftLogged,
      ratePercent: totalActive > 0 ? Math.round((presentCount / totalActive) * 100) : 0
    };
  }, [allAllLogs, todayDateStr, activeWorkers]);

  // Aggregate monthly stats with before/after settlement breakdown
  const monthlyStats = useMemo(() => {
    let totalNormalDays = 0;
    let totalHalfDays = 0;
    let totalOvertimeHours = 0;
    let totalPayroll = 0;

    let settledDays = 0;
    let unsettledDays = 0;
    let settledOtHours = 0;
    let unsettledOtHours = 0;
    let settledPayroll = 0;
    let unsettledPayroll = 0;

    logs.forEach((log) => {
      const dayVal = log.type === 'half' ? 0.5 : log.type === 'hourly' ? 0 : 1;
      const otVal = Number(log.overtimeHours) || 0;
      const payVal = Number(log.totalDayPay) || 0;

      if (log.type === 'half') {
        totalHalfDays += 1;
      } else if (log.type !== 'hourly') {
        totalNormalDays += 1;
      }
      totalOvertimeHours += otVal;
      totalPayroll += payVal;

      const settled = isLogSettled(log);
      if (settled) {
        settledDays += dayVal;
        settledOtHours += otVal;
        settledPayroll += payVal;
      } else {
        unsettledDays += dayVal;
        unsettledOtHours += otVal;
        unsettledPayroll += payVal;
      }
    });

    const totalDaysCount = totalNormalDays + totalHalfDays * 0.5;

    return {
      activeCount: activeWorkers.length,
      totalDaysCount,
      totalNormalDays,
      totalHalfDays,
      settledDays,
      unsettledDays,
      totalOvertimeHours,
      settledOtHours,
      unsettledOtHours,
      totalPayroll: roundCurrency(totalPayroll, currency),
      settledPayroll: roundCurrency(settledPayroll, currency),
      unsettledPayroll: roundCurrency(unsettledPayroll, currency)
    };
  }, [logs, activeWorkers, isLogSettled, currency]);

  // Financial Status Map (Debt & Settlement status per worker)
  const workerFinancialStatusMap = useMemo(() => {
    const map = new Map();
    workers.forEach((w) => {
      const fin = calculateWorkerFinancials(w, allAllLogs, allPayments, currency);
      if (fin) {
        map.set(w.id, {
          worker: w,
          isSettled: fin.netBalanceDue <= 0,
          netDebt: Math.max(0, fin.netBalanceDue),
          totalAllTimePaid: fin.totalSettlementPaid + fin.settledAdvances + fin.unsettledAdvances,
          totalAllTimeGross: fin.settledGross + fin.unsettledGross
        });
      }
    });
    return map;
  }, [workers, allAllLogs, allPayments, currency]);

  // Workshop Outstanding Summary
  const financialSummary = useMemo(() => {
    let totalWorkshopOutstanding = 0;
    let settledCount = 0;
    const creditors = [];

    workers.forEach((w) => {
      const info = workerFinancialStatusMap.get(w.id);
      if (info) {
        totalWorkshopOutstanding += info.netDebt;
        if (info.isSettled) {
          settledCount++;
        } else if (info.netDebt > 0) {
          creditors.push({
            worker: w,
            netDebt: info.netDebt
          });
        }
      }
    });

    creditors.sort((a, b) => b.netDebt - a.netDebt);

    return {
      totalWorkshopOutstanding: roundCurrency(totalWorkshopOutstanding, currency),
      settledCount,
      totalWorkers: workers.length,
      topCreditors: creditors.slice(0, 3)
    };
  }, [workers, workerFinancialStatusMap, currency]);

  // Project section breakdown for current month
  const sectionBreakdown = useMemo(() => {
    if (projectSections.length === 0) return [];
    const map = {};

    projectSections.forEach((s) => {
      map[s.id] = {
        id: s.id,
        name: s.name,
        days: 0,
        otHours: 0,
        totalCost: 0,
        entriesCount: 0
      };
    });

    map['unassigned'] = {
      id: 'unassigned',
      name: copy.unassignedSection,
      days: 0,
      otHours: 0,
      totalCost: 0,
      entriesCount: 0
    };

    logs.forEach((l) => {
      const secId = l.sectionId && map[String(l.sectionId)] ? String(l.sectionId) : 'unassigned';
      const item = map[secId];
      const dayVal = l.type === 'hourly' ? 0 : l.type === 'half' ? 0.5 : 1.0;
      const otVal = Number(l.overtimeHours) || 0;
      const payVal = Number(l.totalDayPay) || 0;

      item.days += dayVal;
      item.otHours += otVal;
      item.totalCost += payVal;
      item.entriesCount += 1;
    });

    return Object.values(map)
      .filter((b) => b.entriesCount > 0)
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [logs, projectSections, copy.unassignedSection]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  // Settlement ratio for monthly payroll
  const settlementPercentage = useMemo(() => {
    if (monthlyStats.totalPayroll <= 0) return 100;
    return Math.min(100, Math.round((monthlyStats.settledPayroll / monthlyStats.totalPayroll) * 100));
  }, [monthlyStats]);

  // Expense vs Payroll Ratio
  const totalCombinedMonthlyCost = monthlyStats.totalPayroll + monthlyExpensesTotal;
  const payrollCostRatio =
    totalCombinedMonthlyCost > 0
      ? Math.round((monthlyStats.totalPayroll / totalCombinedMonthlyCost) * 100)
      : 0;
  const expenseCostRatio = totalCombinedMonthlyCost > 0 ? 100 - payrollCostRatio : 0;

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-1 sm:px-2">

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. LIQUID GLASS HEADER CAPSULE                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/30 transition-all duration-300">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-sky-500/10 dark:bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Welcome & Context */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => openGlobalSettings('account')}
              className="relative group p-0.5 rounded-full ring-2 ring-sky-500/20 hover:ring-sky-500/60 transition-all duration-300 cursor-pointer overflow-hidden flex-shrink-0"
              title={copy.accountAndSettingsTitle}
              aria-label={copy.accountAndSettingsTitle}
            >
              {user?.avatar || user?.photo || user?.supabaseUser?.user_metadata?.avatar_url ? (
                <img
                  src={user?.avatar || user?.photo || user?.supabaseUser?.user_metadata?.avatar_url}
                  alt={copy.accountAndSettingsTitle}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-sm">
                  {(user?.name || user?.email || 'K').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  {copy.dashboardTitle}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {localizeProjectName(currentProject?.name)}
                </span>
                {/* Workshop Code Pill */}
                <button
                  type="button"
                  onClick={handleCopyWsCode}
                  title={copiedWsCode ? copy.copied : `${copy.workshopCode} ${displayWsCode}`}
                  aria-label={copiedWsCode ? copy.copied : `${copy.workshopCode} ${displayWsCode}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/20 transition-all cursor-pointer group active:scale-95 shadow-2xs"
                >
                  <Building2 className="w-3.5 h-3.5 text-sky-500 group-hover:scale-110 transition-transform" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">{copy.workshopCode}</span>
                  <span className="font-mono font-bold tracking-wider">{displayWsCode}</span>
                  {copiedWsCode ? (
                    <Check className="w-3 h-3 text-emerald-500 animate-in zoom-in-75" />
                  ) : (
                    <Copy className="w-3 h-3 text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-200 transition-colors" />
                  )}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                <span>{liveDateString}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-sky-600 dark:text-sky-400 font-medium">{liveTimeString}</span>
              </p>
            </div>
          </div>

          {/* Month Selector Pill */}
          <div className="flex items-center self-start md:self-auto gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all cursor-pointer"
              title={copy.prevMonthTitle}
              aria-label={copy.prevMonthTitle}
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </button>
            <div className="flex items-center gap-2 px-3 text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[120px] justify-center">
              <Calendar className="w-4 h-4 text-sky-500" />
              <span>{formatMonthOnly(selectedMonth, language, calendarType, numberFormat)}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all cursor-pointer"
              title={copy.nextMonthTitle}
              aria-label={copy.nextMonthTitle}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. EXECUTIVE HERO BANNER: MONTHLY FINANCIAL PULSE                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">

          {/* Main Financial Statement */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider">
              <Banknote className="w-4 h-4" />
              <span>{copy.monthlyFinancialPulse}</span>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2">
                <span>{formatAmount(monthlyStats.totalPayroll, currency, numberFormat)}</span>
                <span className="text-sm sm:text-base font-bold text-sky-400">
                  {getCurrencySymbol(currency, language)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {copy.totalGrossPayrollDesc}
              </p>
            </div>

            {/* Progress Gauge */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-semibold flex-wrap gap-2">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {copy.settledLabel} {formatAmount(monthlyStats.settledPayroll, currency, numberFormat)}{' '}
                  {getCurrencySymbol(currency, language)}
                </span>
                <span className="text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {copy.pendingLabel} {formatAmount(monthlyStats.unsettledPayroll, currency, numberFormat)}{' '}
                  {getCurrencySymbol(currency, language)}
                </span>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-700 shadow-md"
                  style={{ width: `${settlementPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                <span>
                  {convertDigits(`${settlementPercentage}%`, numberFormat)} {copy.clearedSuffix}
                </span>
                <span>
                  {copy.totalAccumulatedDebtLabel}{' '}
                  {formatAmount(financialSummary.totalWorkshopOutstanding, currency, numberFormat)}{' '}
                  {getCurrencySymbol(currency, language)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Action Dock */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">

            {/* Metric: Working Days */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[11px] text-slate-400 block">{copy.totalWorkDaysLabel}</span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {convertDigits(monthlyStats.totalDaysCount, numberFormat)}{' '}
                <span className="text-xs font-normal text-slate-400">{copy.daysUnit}</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {convertDigits(monthlyStats.totalOvertimeHours, numberFormat)} {copy.overtimeHoursSuffix}
              </span>
            </div>

            {/* Metric: Active Force */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[11px] text-slate-400 block">{copy.activeForceLabel}</span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {convertDigits(monthlyStats.activeCount, numberFormat)}{' '}
                <span className="text-xs font-normal text-slate-400">{copy.workersUnit}</span>
              </span>
              <span className="text-[10px] text-emerald-400 mt-1 block">
                {convertDigits(financialSummary.settledCount, numberFormat)} {copy.fullySettledSuffix}
              </span>
            </div>

            {/* Quick Action 1: Add Log */}
            <button
              onClick={onOpenLoggingModal}
              className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all duration-300 cursor-pointer active:scale-95"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>{copy.logShiftBtn}</span>
            </button>

            {/* Quick Action 2: Manage Tasks */}
            <button
              onClick={() => setIsTasksModalOpen(true)}
              className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all duration-300 cursor-pointer active:scale-95"
            >
              <ListTodo className="w-4 h-4 text-sky-400" />
              <span>{copy.tasksBtn}</span>
              {activeTasksCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500 text-white font-black">
                  {convertDigits(activeTasksCount, numberFormat)}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. TWIN COMMAND TILES: TODAY ATTENDANCE + EXPENSES BREAKDOWN        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Tile A: Today's Shift & Live Attendance */}
        <div className="rounded-3xl p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {copy.todayAttendanceTitle}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {convertDigits(`${todayAttendance.ratePercent}%`, numberFormat)} {copy.shiftRecordedToday}
                  </span>
                </div>
              </div>

              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                {convertDigits(todayAttendance.presentCount, numberFormat)} /{' '}
                {convertDigits(todayAttendance.totalActive, numberFormat)}
              </span>
            </div>

            {/* Attendance Progress */}
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 mb-5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${todayAttendance.ratePercent}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
                <span className="text-slate-500 dark:text-slate-400 block">
                  {copy.recordedPresentLabel}
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {convertDigits(todayAttendance.presentCount, numberFormat)} {copy.workersUnit}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/15">
                <span className="text-slate-500 dark:text-slate-400 block">
                  {todayAttendance.isShiftLogged ? copy.absentTodayLabel : copy.pendingLogLabel}
                </span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400 mt-1 block">
                  {convertDigits(todayAttendance.unloggedCount, numberFormat)} {copy.workersUnit}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenLoggingModal}
            data-tour="quick-log-btn"
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200/60 dark:border-sky-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{copy.quickLogTodayBtn}</span>
          </button>
        </div>

        {/* Tile B: Financial Distribution (Payroll vs Expenses) */}
        <div className="rounded-3xl p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {copy.costBreakdownTitle}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {copy.costBreakdownSubtitle}
                  </span>
                </div>
              </div>

              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                {formatAmount(totalCombinedMonthlyCost, currency, numberFormat)}{' '}
                {getCurrencySymbol(currency, language)}
              </span>
            </div>

            {/* Split Distribution Bar */}
            <div className="space-y-3 mb-5">
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                <div
                  className="bg-sky-500 transition-all duration-500"
                  style={{ width: `${payrollCostRatio}%` }}
                  title={`${copy.payrollLabel}: ${convertDigits(`${payrollCostRatio}%`, numberFormat)}`}
                />
                <div
                  className="bg-purple-500 transition-all duration-500"
                  style={{ width: `${expenseCostRatio}%` }}
                  title={`${copy.expensesLabel}: ${convertDigits(`${expenseCostRatio}%`, numberFormat)}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-sky-500/5 border border-sky-500/15">
                  <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold mb-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>
                      {copy.payrollLabel} ({convertDigits(`${payrollCostRatio}%`, numberFormat)})
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200 block">
                    {formatAmount(monthlyStats.totalPayroll, currency, numberFormat)}{' '}
                    {getCurrencySymbol(currency, language)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-purple-500/5 border border-purple-500/15">
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold mb-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>
                      {copy.expensesLabel} ({convertDigits(`${expenseCostRatio}%`, numberFormat)})
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200 block">
                    {formatAmount(monthlyExpensesTotal, currency, numberFormat)}{' '}
                    {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('accounting')}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 border border-purple-200/60 dark:border-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{copy.viewFinancialLedgerBtn}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. WORKSHOP SECTIONS & HIGH-PRIORITY TASKS                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Sections Command Center (Col-span 7) */}
        <div className="lg:col-span-7 rounded-3xl p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  {copy.activeSectionsTitle}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {copy.activeSectionsSubtitle}
                </span>
              </div>
            </div>

            <button
              onClick={() => openGlobalSettings('projects')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {copy.manageSectionsBtn}
            </button>
          </div>

          {sectionBreakdown.length === 0 ? (
            <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs">
              {copy.noSectionLogsThisMonth}
            </div>
          ) : (
            <div className="space-y-3">
              {sectionBreakdown.slice(0, 4).map((sec) => {
                const percentOfTotal =
                  monthlyStats.totalPayroll > 0
                    ? Math.round((sec.totalCost / monthlyStats.totalPayroll) * 100)
                    : 0;
                return (
                  <div
                    key={sec.id}
                    className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {localizeSectionName(sec.name)}
                      </span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                        {formatAmount(sec.totalCost, currency, numberFormat)}{' '}
                        {getCurrencySymbol(currency, language)}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentOfTotal}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        {convertDigits(sec.days, numberFormat)} {copy.workDaysSuffix} •{' '}
                        {convertDigits(sec.otHours, numberFormat)} {copy.overtimeHoursSuffix}
                      </span>
                      <span className="font-semibold">
                        {convertDigits(`${percentOfTotal}%`, numberFormat)} {copy.shareOfPayrollSuffix}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* High Priority Tasks & Action Items (Col-span 5) */}
        <div className="lg:col-span-5 rounded-3xl p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ListTodo className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {copy.priorityTasksTitle}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {convertDigits(activeTasksCount, numberFormat)} {copy.openTasksSuffix}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsTasksModalOpen(true)}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                {copy.viewAllTasksBtn}
              </button>
            </div>

            {activeTasksList.length === 0 ? (
              <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs">
                {copy.noPendingTasksMsg}
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeTasksList.map((task) => {
                  const isHigh = task.priority === 'high';
                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between gap-2.5 hover:border-sky-500/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          onClick={async () => {
                            if (task.id) await updateTask(task.id, { status: 'completed' });
                          }}
                          className="w-5 h-5 rounded-lg border border-slate-300 dark:border-slate-600 hover:border-emerald-500 flex items-center justify-center flex-shrink-0 group/check cursor-pointer"
                          title={copy.completeTaskTitle}
                          aria-label={copy.completeTaskTitle}
                        >
                          <Check className="w-3.5 h-3.5 text-transparent group-hover/check:text-emerald-500" />
                        </button>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {task.title}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isHigh
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isHigh ? copy.priorityHighBadge : copy.priorityNormalBadge}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsNewTaskModalOpen(true)}
            className="w-full mt-4 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{copy.createNewTaskBtn}</span>
          </button>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. TOP SETTLEMENT PRIORITIES CAPSULE                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {copy.topSettlementPrioritiesTitle}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {copy.topSettlementPrioritiesSubtitle}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              try {
                localStorage.setItem('karsync_financials_active_section', 'workers');
              } catch (_) {}
              setActiveTab('accounting');
            }}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline self-start sm:self-auto flex items-center gap-1 cursor-pointer"
          >
            <span>{copy.openSettlementDeskBtn}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        {financialSummary.topCreditors.length === 0 ? (
          <div className="py-8 text-center text-emerald-600 dark:text-emerald-400 text-xs font-semibold bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
            {copy.allAccountsSettledMsg}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {financialSummary.topCreditors.map(({ worker, netDebt }) => (
              <div
                key={worker.id}
                onClick={() => openWorkerProfile(worker.id)}
                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 hover:border-sky-500/40 cursor-pointer transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-sky-500 transition-colors">
                    {worker.name}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {localizeWorkerRole(worker.role)}
                  </span>
                </div>

                <div className="text-base font-black text-rose-600 dark:text-rose-400 mt-2">
                  {formatAmount(netDebt, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  {copy.pendingSettlementLabel}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODALS                                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isTasksModalOpen && (
        <TasksModal
          isOpen={isTasksModalOpen}
          onClose={() => setIsTasksModalOpen(false)}
          tasks={tasks}
          isLoading={isTasksLoading}
          targetProjectId={targetProjectId}
          onAddTask={addTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onSelectTaskForDetails={(task) => setSelectedTaskForDetails(task)}
        />
      )}

      {isNewTaskModalOpen && (
        <TaskFormModal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          onSubmit={(formData) => addTask(formData)}
          targetProjectId={targetProjectId}
        />
      )}

    </div>
  );
}