import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { EditRecordModal } from './EditRecordModal';
import { UserProfileModal } from './UserProfileModal';
import { useProject } from '../context/ProjectContext';
import { pullExpensesLive } from '../services/realtimeSync';
import { 
  formatCurrency, 
  formatAmount, 
  formatNumber, 
  getCurrentYearMonth, 
  formatHoursAndMinutes, 
  roundCurrency,
  getCurrencySymbol,
  formatMonthOnly
} from '../utils/formatters';
import { 
  Users, 
  Calendar, 
  Clock, 
  Coins, 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle, 
  FileEdit, 
  TrendingUp, 
  FileText, 
  Briefcase, 
  CheckCircle2, 
  Banknote,
  ArrowUpRight,
  WalletCards,
  FileSpreadsheet,
  Edit2,
  Layers,
  CalendarPlus,
  Activity,
  UserCheck,
  X,
  Sparkles,
  Receipt,
  CalendarCheck,
  ListTodo
} from 'lucide-react';

export function DashboardView({ onOpenLoggingModal, setActiveTab }) {
  const { t, language, direction } = useLanguage();
  const { user } = useAuth();
  const { currentProject, openWorkerProfile } = useProject();
  const currency = currentProject?.currency || 'IQD';
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  const [selectedSectionId, setSelectedSectionId] = useState('all');
  const [editingLog, setEditingLog] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Fetch reactive data from Dexie scoped to active project with fallback for legacy records
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  const allPayments = useLiveQuery(
    async () => {
      const [list, wList] = await Promise.all([
        db.payments.toArray(),
        db.workers.toArray()
      ]);
      const projectWorkerIds = new Set(
        wList
          .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId)
          .map((w) => String(w.id))
      );
      return list.filter((p) => 
        (p.projectId || DEFAULT_PROJECT_ID) === targetProjectId || 
        projectWorkerIds.has(String(p.workerId))
      );
    },
    [targetProjectId]
  ) || [];

  const allAllLogs = useLiveQuery(
    async () => {
      const [list, wList] = await Promise.all([
        db.attendanceLogs.toArray(),
        db.workers.toArray()
      ]);
      const projectWorkerIds = new Set(
        wList
          .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId)
          .map((w) => String(w.id))
      );
      return list.filter((l) => 
        (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId || 
        projectWorkerIds.has(String(l.workerId))
      );
    },
    [targetProjectId]
  ) || [];

  const rawLogs = useLiveQuery(
    async () => {
      const [list, wList] = await Promise.all([
        db.attendanceLogs.toArray(),
        db.workers.toArray()
      ]);
      const projectWorkerIds = new Set(
        wList
          .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId)
          .map((w) => String(w.id))
      );
      const projLogs = list.filter((l) => 
        (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId || 
        projectWorkerIds.has(String(l.workerId))
      );
      return projLogs.filter((l) => l.date && l.date.startsWith(selectedMonth));
    },
    [targetProjectId, selectedMonth]
  ) || [];

  const projectSections = useLiveQuery(
    async () => {
      if (!targetProjectId) return [];
      return await db.projectSections.where('projectId').equals(targetProjectId).toArray();
    },
    [targetProjectId]
  ) || [];

  // Live query for project expenses (reading modern db.expenses and fallback db.projectExpenses)
  const projectExpenses = useLiveQuery(
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
          title: e.title || e.category || 'هزینه عمومی'
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
      return list.filter((e) => 
        !e.deletedAt && 
        (!targetProjectId || (e.projectId || DEFAULT_PROJECT_ID) === targetProjectId || targetProjectId === DEFAULT_PROJECT_ID)
      );
    },
    [targetProjectId]
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

  const recentExpenses = useMemo(() => {
    return [...projectExpenses].sort((a, b) => {
      const dateA = a.expenseDate || a.date || a.createdAt || '';
      const dateB = b.expenseDate || b.date || b.createdAt || '';
      return dateB.localeCompare(dateA);
    }).slice(0, 5);
  }, [projectExpenses]);

  // Pull latest cloud expenses when dashboard mounts or project changes
  useEffect(() => {
    pullExpensesLive().catch(() => {});
    const onSync = () => {
      pullExpensesLive().catch(() => {});
    };
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
    return currentDateTime.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }, [currentDateTime]);

  const liveDateString = useMemo(() => {
    return currentDateTime.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, [currentDateTime]);

  // Format hours float to digital HH:mm format with English digits (e.g. 42:16)
  const formatDigitalHours = (hoursFloat) => {
    const totalMins = Math.round(Math.max(0, Number(hoursFloat) || 0) * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

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

  // Settlement payments and per-worker last settlement date
  const settlementPayments = useMemo(() => {
    return allPayments.filter((p) => 
      !p.deletedAt && 
      (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled')
    );
  }, [allPayments]);

  const workerLastSettlementMap = useMemo(() => {
    const map = new Map();
    settlementPayments.forEach((p) => {
      const wId = String(p.workerId);
      const d = p.date || p.createdAt?.slice(0, 10);
      if (d) {
        const cur = map.get(wId);
        if (!cur || d > cur) map.set(wId, d);
      }
    });
    return map;
  }, [settlementPayments]);

  const isLogSettled = (log) => {
    if (log.isSettled) return true;
    if (log.settlementReceiptId) return true;
    const lastDate = workerLastSettlementMap.get(String(log.workerId));
    if (lastDate && log.date && log.date <= lastDate) return true;
    return false;
  };

  // Filter active workers
  const activeWorkers = useMemo(() => {
    return workers.filter((w) => w.isActive === 1);
  }, [workers]);

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

    const totalDaysCount = totalNormalDays + (totalHalfDays * 0.5);

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
  }, [logs, activeWorkers, workerLastSettlementMap, currency]);

  // Project section breakdown & comprehensive analytics for current month
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
        entriesCount: 0,
        workerStats: {},
        activities: []
      };
    });

    map['unassigned'] = {
      id: 'unassigned',
      name: language === 'fa' ? 'عمومی / بدون بخش' : 'General / Unassigned',
      days: 0,
      otHours: 0,
      totalCost: 0,
      entriesCount: 0,
      workerStats: {},
      activities: []
    };

    const workerMap = {};
    workers.forEach((w) => { workerMap[String(w.id)] = w; });

    logs.forEach((l) => {
      const secId = l.sectionId && map[l.sectionId] ? l.sectionId : 'unassigned';
      const item = map[secId];
      const dayVal = l.type === 'hourly' ? 0 : l.type === 'half' ? 0.5 : 1.0;
      const otVal = Number(l.overtimeHours) || 0;
      const payVal = Number(l.totalDayPay) || 0;

      item.days += dayVal;
      item.otHours += otVal;
      item.totalCost += payVal;
      item.entriesCount += 1;

      // Track worker stats in this section
      const wId = String(l.workerId);
      const wObj = workerMap[wId];
      if (!item.workerStats[wId]) {
        item.workerStats[wId] = {
          worker: wObj || { id: wId, name: 'کارگر ' + wId, role: '' },
          days: 0,
          otHours: 0,
          totalPay: 0
        };
      }
      item.workerStats[wId].days += dayVal;
      item.workerStats[wId].otHours += otVal;
      item.workerStats[wId].totalPay += payVal;

      // Track activities / work notes
      if (l.notes && l.notes.trim()) {
        item.activities.push({
          id: l.id,
          date: l.date,
          workerName: wObj?.name || 'کارگر',
          workerRole: wObj?.role || '',
          notes: l.notes.trim(),
          type: l.type,
          overtimeHours: otVal
        });
      }
    });

    // Format workers array & sort activities by date desc
    return Object.values(map).map((sec) => {
      return {
        ...sec,
        workers: Object.values(sec.workerStats).sort((a, b) => b.days - a.days),
        distinctWorkersCount: Object.keys(sec.workerStats).length,
        activities: sec.activities.sort((a, b) => b.date.localeCompare(a.date))
      };
    }).filter((b) => b.entriesCount > 0 || (b.id !== 'unassigned' && projectSections.some(s => s.id === b.id)));
  }, [logs, projectSections, workers, language]);

  // Aggregate per-worker breakdown for the selected month
  const workerSummaries = useMemo(() => {
    return workers.map((worker) => {
      const workerLogs = logs.filter((l) => String(l.workerId) === String(worker.id));
      
      let fullDays = 0;
      let halfDays = 0;
      let otHours = 0;
      let basePay = 0;
      let otPay = 0;
      let totalPay = 0;
      let settledPay = 0;
      let unsettledPay = 0;

      const wDaily = Number(String(worker.dailyRate).replace(/,/g, '')) || 0;
      const wOtRate = Number(String(worker.overtimeHourlyRate).replace(/,/g, '')) || 0;

      workerLogs.forEach((l) => {
        if (l.type === 'half') {
          halfDays += 1;
        } else if (l.type === 'hourly') {
          // Hourly only
        } else {
          fullDays += 1;
        }
        const otH = Math.max(0, Number(l.overtimeHours) || 0);
        otHours += otH;

        let logDaily = Number(l.calculatedDailyWage);
        let logOt = Number(l.calculatedOvertimeWage);
        let logTotal = Number(l.totalDayPay);

        // Safe recalculation if record had 0 or NaN wage
        if (isNaN(logTotal) || logTotal <= 0) {
          if (l.type === 'half') {
            logDaily = wDaily * 0.5;
            logOt = otH * wOtRate;
          } else if (l.type === 'hourly') {
            logDaily = 0;
            logOt = otH * (wOtRate || (wDaily / 8));
          } else {
            logDaily = wDaily;
            logOt = otH * wOtRate;
          }
          logTotal = logDaily + logOt;
        }

        const validDaily = isNaN(logDaily) ? 0 : logDaily;
        const validOt = isNaN(logOt) ? 0 : logOt;
        const validTotal = isNaN(logTotal) ? 0 : logTotal;

        basePay += validDaily;
        otPay += validOt;
        totalPay += validTotal;

        if (isLogSettled(l)) {
          settledPay += validTotal;
        } else {
          unsettledPay += validTotal;
        }
      });

      return {
        ...worker,
        fullDays,
        halfDays,
        otHours,
        basePay: roundCurrency(basePay, currency),
        otPay: roundCurrency(otPay, currency),
        totalPay: roundCurrency(totalPay, currency),
        settledPay: roundCurrency(settledPay, currency),
        unsettledPay: roundCurrency(unsettledPay, currency),
        logsCount: workerLogs.length
      };
    });
  }, [workers, logs, workerLastSettlementMap, currency]);

  // Compute FIFO settlement status and debt per worker for the current month
  const workerFinancialStatusMap = useMemo(() => {
    const map = new Map();
    workers.forEach((w) => {
      const wLogs = allAllLogs.filter((l) => String(l.workerId) === String(w.id));
      const wPayments = allPayments.filter((p) => String(p.workerId) === String(w.id));
      const wDaily = Number(String(w.dailyRate).replace(/,/g, '')) || 0;
      const wOtRate = Number(String(w.overtimeHourlyRate).replace(/,/g, '')) || 0;

      const getLogPay = (l) => {
        let val = Number(l.totalDayPay);
        if (!isNaN(val) && val > 0) return val;
        const otH = Math.max(0, Number(l.overtimeHours) || 0);
        if (l.type === 'half') return (wDaily * 0.5) + (otH * wOtRate);
        if (l.type === 'hourly') return otH * (wOtRate || (wDaily / 8));
        return wDaily + (otH * wOtRate);
      };

      const totalAllTimeGross = roundCurrency(wLogs.reduce((sum, l) => sum + getLogPay(l), 0), currency);
      const totalAllTimePaid = roundCurrency(wPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), currency);
      const grossUpToPeriod = roundCurrency(wLogs
        .filter((l) => l.date && l.date <= `${selectedMonth}-31`)
        .reduce((sum, l) => sum + getLogPay(l), 0), currency);
      const netDebt = roundCurrency(Math.max(0, totalAllTimeGross - totalAllTimePaid), currency);

      let isSettled = false;
      if (totalAllTimeGross === 0 && totalAllTimePaid === 0) {
        isSettled = true;
      } else if (netDebt === 0 && totalAllTimeGross > 0) {
        isSettled = true;
      } else if (totalAllTimePaid >= grossUpToPeriod && grossUpToPeriod > 0) {
        isSettled = true;
      }
      map.set(w.id, { isSettled, netDebt, totalAllTimePaid, totalAllTimeGross });
    });
    return map;
  }, [workers, allAllLogs, allPayments, selectedMonth, currency]);

  // Financial summary metrics for Dashboard Overview Widget
  const financialSummary = useMemo(() => {
    let totalMonthPaid = 0;
    allPayments.forEach((p) => {
      if (p.month === selectedMonth || (!p.month && p.date && p.date.startsWith(selectedMonth))) {
        totalMonthPaid += Number(p.amount) || 0;
      }
    });

    let totalWorkshopOutstanding = 0;
    let settledCount = 0;
    workers.forEach((w) => {
      const info = workerFinancialStatusMap.get(w.id);
      if (info) {
        totalWorkshopOutstanding += info.netDebt;
        if (info.isSettled) settledCount++;
      }
    });

    return {
      totalMonthPaid: roundCurrency(totalMonthPaid, currency),
      totalWorkshopOutstanding: roundCurrency(totalWorkshopOutstanding, currency),
      settledCount,
      totalWorkers: workers.length
    };
  }, [allPayments, selectedMonth, workers, workerFinancialStatusMap, currency]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const prevMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(prevMonth);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    const nextMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonth);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header with User Profile, Project Name, Live Clock & Month Navigator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div 
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-3.5 cursor-pointer group p-1.5 -m-1.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all select-none"
          title={language === 'ku' ? 'ڕێکخستنەکانی پرۆفایلی بەکارھێنەر' : 'تنظیمات پروفایل کاربر'}
        >
          <div className="relative flex-shrink-0">
            {user?.avatar || user?.photo || user?.supabaseUser?.user_metadata?.avatar_url ? (
              <img
                src={user.avatar || user.photo || user.supabaseUser.user_metadata.avatar_url}
                alt={user?.name || 'کاربر'}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-sky-500/30 shadow-md transition-transform group-hover:scale-105 group-hover:border-sky-500"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-sky-600/25 border border-white/20 transition-transform group-hover:scale-105">
                {(user?.name ? user.name.slice(0, 1) : 'U').toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-1 -end-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 ring-2 ring-emerald-500/20" title="آنلاین"></span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {user?.name || user?.email?.split('@')[0] || (language === 'ku' ? 'بەکارھێنەر' : 'مدیر سیستم')}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {currentProject?.name || (language === 'ku' ? 'پڕۆژەی کارگە' : 'پروژه کارگاه')}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-medium text-slate-600 dark:text-slate-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-sky-500 animate-pulse" />
              <span className="font-bold">{liveTimeString}</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span>{liveDateString}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector Controls */}
          <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl p-1 border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
            <button
              type="button"
              onClick={direction === 'rtl' ? handleNextMonth : handlePrevMonth}
              className="p-1.5 sm:p-2 hover:bg-white dark:hover:bg-slate-700/70 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous Month"
            >
              {direction === 'rtl' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <div className="relative flex items-center justify-center cursor-pointer min-w-[5rem]">
              <div className="pointer-events-none px-2 py-1 text-sm font-black text-slate-800 dark:text-slate-200 text-center">
                {formatMonthOnly(selectedMonth, language)}
              </div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={direction === 'rtl' ? handlePrevMonth : handleNextMonth}
              className="p-1.5 sm:p-2 hover:bg-white dark:hover:bg-slate-700/70 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
              title="Next Month"
            >
              {direction === 'rtl' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>

          {/* Quick Record Button */}
          <button
            type="button"
            onClick={onOpenLoggingModal}
            aria-label={t('logDailyAttendance')}
            title={t('logDailyAttendance')}
            className="p-2.5 sm:p-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl shadow-md shadow-sky-600/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center border border-sky-500/30 cursor-pointer group"
          >
            <CalendarPlus className="w-5.5 h-5.5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Working Days with Settled vs Unsettled */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-emerald-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
                {t('monthlyWorkingDays') || 'روزهای کاری ثبت‌شده'}
              </span>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
                <Calendar className="w-5.5 h-5.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                {formatNumber(monthlyStats.totalDaysCount)}
              </span>
              <span className="text-xs text-slate-400">
                {language === 'ku' ? 'ڕۆژ کارکرد' : 'روز کارکرد'}
              </span>
            </div>
          </div>

          {/* 2-Part Split: تسویه نشده / تسویه شده */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200/50 dark:border-amber-800/40">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-bold mb-0.5">
                {language === 'ku' ? 'یەکلایی نەکراوە' : 'تسویه نشده'}
              </span>
              <span className="font-extrabold text-amber-700 dark:text-amber-300 font-mono text-sm">
                {formatNumber(monthlyStats.unsettledDays)} <span className="text-[10px] font-normal">{language === 'ku' ? 'ڕۆژ' : 'روز'}</span>
              </span>
            </div>
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-bold mb-0.5">
                {language === 'ku' ? 'یەکلایی کراوە' : 'تسویه شده'}
              </span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 font-mono text-sm">
                {formatNumber(monthlyStats.settledDays)} <span className="text-[10px] font-normal">{language === 'ku' ? 'ڕۆژ' : 'روز'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Overtime Hours with Settled vs Unsettled */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-amber-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
                {t('totalOvertimeHours') || 'مجموع اضافه‌کاری'}
              </span>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
                <Clock className="w-5.5 h-5.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                {formatDigitalHours(monthlyStats.totalOvertimeHours)}
              </span>
              <span className="text-xs text-slate-400">
                {language === 'ku' ? 'کۆی گشتی' : 'مجموع'}
              </span>
            </div>
          </div>

          {/* 2-Part Split: تسویه نشده / تسویه شده */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200/50 dark:border-amber-800/40">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-bold mb-0.5">
                {language === 'ku' ? 'یەکلایی نەکراوە' : 'تسویه نشده'}
              </span>
              <span className="font-extrabold text-amber-700 dark:text-amber-300 font-mono text-sm">
                {formatDigitalHours(monthlyStats.unsettledOtHours)}
              </span>
            </div>
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-bold mb-0.5">
                {language === 'ku' ? 'یەکلایی کراوە' : 'تسویه شده'}
              </span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 font-mono text-sm">
                {formatDigitalHours(monthlyStats.settledOtHours)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Payroll with Settled vs Unsettled (Primary Blue Gradient) */}
        <div className="bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 text-white rounded-2xl p-5 border border-sky-400/30 shadow-lg shadow-sky-600/25 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-sky-100">
                {t('totalPayrollExpense') || 'کل دستمزد و حقوق'}
              </span>
              <div className="w-11 h-11 rounded-2xl bg-white/20 text-white flex items-center justify-center shadow-md shadow-sky-900/20 backdrop-blur-sm flex-shrink-0 border border-white/20">
                <Coins className="w-5.5 h-5.5 text-amber-200" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                {formatAmount(monthlyStats.totalPayroll, currency)}
              </span>
              <span className="text-xs text-sky-100 font-medium">{getCurrencySymbol(currency, language)}</span>
            </div>
          </div>

          {/* 2-Part Split: تسویه نشده / تسویه شده */}
          <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/15 dark:bg-white/10 backdrop-blur-xs p-2 rounded-xl border border-white/20">
              <span className="text-[10px] text-sky-100 block font-bold mb-0.5">
                {language === 'ku' ? 'یەکلایی نەکراوە' : 'تسویه نشده'}
              </span>
              <span className="font-extrabold text-amber-200 font-mono text-xs">
                {formatAmount(monthlyStats.unsettledPayroll, currency)} <span className="text-[9px] font-normal">{getCurrencySymbol(currency, language)}</span>
              </span>
            </div>
            <div className="bg-white/15 dark:bg-white/10 backdrop-blur-xs p-2 rounded-xl border border-white/20">
              <span className="text-[10px] text-sky-100 block font-bold mb-0.5">
                {language === 'ku' ? 'یەکلایی کراوە' : 'تسویه شده'}
              </span>
              <span className="font-extrabold text-emerald-200 font-mono text-xs">
                {formatAmount(monthlyStats.settledPayroll, currency)} <span className="text-[9px] font-normal">{getCurrencySymbol(currency, language)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Active Workers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-sky-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
                {t('activeWorkersCount')}
              </span>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 flex-shrink-0">
                <Users className="w-5.5 h-5.5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                {formatNumber(monthlyStats.activeCount)}
              </span>
              <span className="text-xs text-slate-400 mx-2">
                / {workers.length} {t('workers')}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-sky-600 dark:text-sky-400 font-medium">
            <button 
              onClick={() => setActiveTab('workers')} 
              className="hover:underline flex items-center gap-1"
            >
              <span>{t('workerList')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-400">
              {workers.length - monthlyStats.activeCount} {language === 'ku' ? 'ناچالاک' : 'غیرفعال'}
            </span>
          </div>
        </div>

      </div>

      {/* 2-Part Expense Tile */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
          
          {/* Side 1: مجموع هزینه‌های این ماه */}
          <div className="flex-1 flex items-center gap-4 bg-rose-50/50 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 flex-shrink-0">
              <Receipt className="w-5.5 h-5.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                  {language === 'ku' ? 'کۆی خەرجییەکانی ئەم مانگە' : 'مجموع هزینه‌های این ماه'} ({selectedMonth})
                </span>
                <span className="text-[11px] font-semibold text-rose-500/80 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-full">
                  {monthlyExpenses.length} {language === 'ku' ? 'تۆمار' : 'مورد'}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
                  {formatAmount(monthlyExpensesTotal, currency)}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {getCurrencySymbol(currency, language)}
                </span>
              </div>
              <button 
                onClick={() => setActiveTab('expenses')}
                className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <span>{language === 'ku' ? 'بینینی هەموو خەرجییەکان' : 'مدیریت و ثبت هزینه‌ها'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="hidden md:block w-px self-stretch bg-slate-200 dark:bg-slate-800"></div>

          {/* Side 2: لیست چند هزینه آخر */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                  <Banknote className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'ku' ? 'دوایین خەرجییە تۆمارکراوەکان' : 'چند هزینه آخر پروژه'}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('expenses')}
                className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline"
              >
                {language === 'ku' ? 'زیاتر' : 'مشاهده همه'}
              </button>
            </div>

            {recentExpenses.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                {language === 'ku' ? 'هیچ خەرجییەک تۆمار نەکراوە.' : 'هنوز هزینه‌ای در این پروژه ثبت نشده است.'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {exp.title || exp.category || 'هزینه عمومی'}
                      </span>
                      {exp.category && exp.title && (
                        <span className="text-[10px] text-slate-400 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded">
                          {exp.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ms-2">
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {formatAmount(exp.amount, currency)} <span className="text-[10px] font-normal text-slate-400">{getCurrencySymbol(currency, language)}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {(exp.expenseDate || exp.date || '').slice(5)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Project Tasks & Work Schedule Section (بخش تسک‌ها به جای خلاصه مالی) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 flex-shrink-0">
              <ListTodo className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{language === 'ku' ? 'ئەرکەکان و بەرنامەی کاری پڕۆژە' : 'تسک‌ها و برنامه کاری پروژه'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300">
                  {language === 'ku' ? 'بەم زووانە' : 'به‌زودی'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'ku' 
                  ? 'ئەم بەشە لە داهاتوودا تەواو دەکرێت و بەستراوەتەوە بە ساڵنامەی کارەکانی پڕۆژە.'
                  : 'این بخش در ادامه تکمیل خواهد شد و تقویم کارهایی است که قرار است در پروژه انجام شود.'}
              </p>
            </div>
          </div>
        </div>

        <div className="py-8 px-4 text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <h4 className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300">
            {language === 'ku' ? 'ئەرکەکان لێرە نیشان دەدرێن' : 'تسک‌ها اینجا نشان داده می‌شود'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {language === 'ku'
              ? 'تەواوی ئەرکەکان، ئەولەویەتەکان و پلانی ڕۆژانەی کارکردنی تیم لەم شوێنە بەڕێوە دەبرێن.'
              : 'تمامی تسک‌ها، اولویت‌بندی‌ها و تقویم اقدامات اجرایی کارگاه به زودی در این قسمت قرار خواهد گرفت.'}
          </p>
        </div>
      </div>

      {/* Dynamic Project Sections Command Center (Section Hub) */}
      {sectionBreakdown.length > 0 && (() => {
        const activeSection = selectedSectionId !== 'all' 
          ? sectionBreakdown.find((s) => s.id === selectedSectionId) 
          : null;

        return (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            {/* Header & Section Filter Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
                  <Layers className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{t('sectionCommandCenter') || 'مرکز فرماندهی و تحلیل بخش‌های پروژه'}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                      {sectionBreakdown.length} {language === 'fa' ? 'بخش' : 'Sections'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'fa' ? `تحلیل تعاملی کارکرد، پرسنل و هزینه‌های ماه ${selectedMonth}` : `Interactive analytics for ${selectedMonth}`}
                  </p>
                </div>
              </div>

              {/* Section Selector Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedSectionId('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedSectionId === 'all'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t('allSections') || 'نمای مقایسه‌ای'}</span>
                </button>

                {sectionBreakdown.map((sec) => {
                  const percent = monthlyStats.totalPayroll > 0
                    ? Math.round((sec.totalCost / monthlyStats.totalPayroll) * 100)
                    : 0;
                  const isSelected = selectedSectionId === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{sec.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {percent}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* View A: Overview / Comparative Grid of All Sections */}
            {selectedSectionId === 'all' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sectionBreakdown.map((sec) => {
                  const percent = monthlyStats.totalPayroll > 0
                    ? Math.round((sec.totalCost / monthlyStats.totalPayroll) * 100)
                    : 0;
                  return (
                    <div 
                      key={sec.id}
                      onClick={() => setSelectedSectionId(sec.id)}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-pointer group space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {sec.name}
                        </span>
                        <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 bg-sky-100/60 dark:bg-sky-950/80 px-2 py-0.5 rounded-md font-mono">
                          {percent}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-sky-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-sky-500" />
                          <span>{sec.distinctWorkersCount} نفر ({sec.days} نفر-روز)</span>
                        </span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                          {formatCurrency(sec.totalCost, currency, language)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-400 font-semibold pt-0.5 group-hover:underline">
                        <span>{sec.activities.length} یادداشت فعالیت</span>
                        <span className="flex items-center gap-0.5">
                          <span>مشاهده جزئیات</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View B: Deep Dive into a Single Section */}
            {activeSection && (
              <div className="space-y-4 animate-fade-in">
                {/* Active Section Banner & KPIs */}
                <div className="p-4 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40 rounded-2xl border border-sky-200 dark:border-sky-800/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-black text-slate-900 dark:text-white">
                        {activeSection.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setSelectedSectionId('all')}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800 transition-colors"
                        title="بازگشت به همه بخش‌ها"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      گزارش تحلیلی تفکیکی این بخش در ماه {selectedMonth}
                    </p>
                  </div>

                  {/* 4 Mini KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-white/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">{t('personDays') || 'نفر-روز'}</span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                        {activeSection.days}
                      </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-white/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">{t('sectionCost') || 'کل دستمزد'}</span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono truncate block">
                        {formatCurrency(activeSection.totalCost, currency, language)}
                      </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-white/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">{t('overtime') || 'اضافه‌کاری'}</span>
                      <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                        {formatDigitalHours(activeSection.otHours)}
                      </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-white/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">{t('activeWorkersInSection') || 'پرسنل فعال'}</span>
                      <span className="text-sm font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                        {activeSection.distinctWorkersCount} نفر
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid of Crew & Activities Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Box: Active Crew in this Section */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-sky-500" />
                        <span>{t('activeWorkersInSection') || 'پرسنل فعال در این بخش'} ({activeSection.workers.length})</span>
                      </h5>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
                      {activeSection.workers.map(({ worker, days, otHours, totalPay }) => (
                        <div 
                          key={worker.id}
                          className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span 
                              onClick={() => openWorkerProfile(worker.id)}
                              className="font-bold text-slate-900 dark:text-white block cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors"
                              title="مشاهده پروفایل جامع پرسنل"
                            >
                              {worker.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {worker.role || 'پرسنل'} • {days} روز کارکرد {otHours > 0 ? `(+${formatDigitalHours(otHours)})` : ''}
                            </span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {formatCurrency(totalPay, currency, language)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Box: Activities & Notes Timeline */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <span>{t('sectionActivities') || 'لاگ فعالیت‌ها و شرح کارها'} ({activeSection.activities.length})</span>
                      </h5>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
                      {activeSection.activities.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                          {t('noActivitiesLogged') || 'یادداشت یا شرح فعالیتی برای این بخش در این ماه ثبت نشده است.'}
                        </div>
                      ) : (
                        activeSection.activities.map((act) => (
                          <div 
                            key={act.id}
                            className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sky-600 dark:text-sky-400 text-[11px] font-mono">
                                {act.date}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                {act.workerName} {act.workerRole ? `(${act.workerRole})` : ''}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-200 pt-0.5 leading-relaxed bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg">
                              «{act.notes}»
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Worker Summary Table / Card List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 flex-shrink-0">
              <Users className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {t('workerSummaryTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {selectedMonth} • {workers.length} {t('workers')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('calendar')}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-500" />
            <span>{t('reports')} & {t('exportExcel')}</span>
          </button>
        </div>

        {workerSummaries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {t('noDataForMonth')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-start">{t('workerName')}</th>
                  <th className="px-3 sm:px-4 py-3 text-start">{t('workerRole')}</th>
                  <th className="px-2 sm:px-3 py-3 text-center">{t('normalDays')}</th>
                  <th className="px-2 sm:px-3 py-3 text-center">{t('halfDays')}</th>
                  <th className="px-2 sm:px-3 py-3 text-center">{t('overtimeHours')}</th>
                  <th className="px-3 sm:px-4 py-3 text-end font-bold text-slate-800 dark:text-slate-200">{language === 'ku' ? 'کۆی کارکرد' : 'کل کارکرد'} ({currency})</th>
                  <th className="px-3 sm:px-4 py-3 text-end font-bold text-emerald-600 dark:text-emerald-400">{language === 'ku' ? 'یەکلایی کراوە' : 'تسویه شده'} ({currency})</th>
                  <th className="px-3 sm:px-4 py-3 text-end font-bold text-amber-600 dark:text-amber-400">{language === 'ku' ? 'یەکلایی نەکراوە' : 'تسویه نشده'} ({currency})</th>
                  <th className="px-3 sm:px-4 py-3 text-center">{t('status') || 'وضعیت'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workerSummaries.map((w) => {
                  const statusInfo = workerFinancialStatusMap.get(w.id);
                  const isWorkerSettled = statusInfo?.isSettled || (w.totalPay > 0 && w.unsettledPay === 0);

                  return (
                    <tr 
                      key={w.id} 
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isWorkerSettled ? 'bg-emerald-50/15 dark:bg-emerald-950/10' : ''
                      } ${w.isActive === 0 ? 'opacity-60 bg-slate-50/40' : ''}`}
                    >
                      <td className="px-3 sm:px-4 py-3 font-semibold text-slate-900 dark:text-white text-start">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${w.isActive === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <span className="truncate">{w.name}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-slate-500 dark:text-slate-400 text-xs text-start">
                        {w.role}
                      </td>
                      <td className="px-2 sm:px-3 py-3 text-center font-medium text-slate-700 dark:text-slate-300">
                        {w.fullDays}
                      </td>
                      <td className="px-2 sm:px-3 py-3 text-center font-medium text-slate-700 dark:text-slate-300">
                        {w.halfDays}
                      </td>
                      <td className="px-2 sm:px-3 py-3 text-center font-medium text-amber-600 dark:text-amber-400 font-mono">
                        {w.otHours > 0 ? formatDigitalHours(w.otHours) : '0:00'}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-end font-bold text-slate-900 dark:text-white font-mono">
                        {formatAmount(w.totalPay, currency)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-end text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                        {formatAmount(w.settledPay, currency)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-end text-amber-600 dark:text-amber-400 font-bold font-mono">
                        {formatAmount(w.unsettledPay, currency)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        {isWorkerSettled ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>{language === 'ku' ? 'یەکلایی کراوە' : 'تسویه شده'}</span>
                          </span>
                        ) : w.totalPay > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 inline-flex items-center gap-1 shadow-xs">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{language === 'ku' ? 'یەکلایی نەکراوە' : 'تسویه نشده'}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 inline-block">
                            {language === 'ku' ? 'بێ کارکرد' : 'بدون کارکرد'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan="2" className="px-3 sm:px-4 py-3 text-start">
                    {t('aggregatedTotalPay')} ({selectedMonth})
                  </td>
                  <td className="px-2 sm:px-3 py-3 text-center text-slate-700 dark:text-slate-300 font-mono">
                    {monthlyStats.totalNormalDays}
                  </td>
                  <td className="px-2 sm:px-3 py-3 text-center text-slate-700 dark:text-slate-300 font-mono">
                    {monthlyStats.totalHalfDays}
                  </td>
                  <td className="px-2 sm:px-3 py-3 text-center text-amber-600 dark:text-amber-400 font-mono">
                    {formatDigitalHours(monthlyStats.totalOvertimeHours)}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-end text-slate-900 dark:text-white font-black font-mono">
                    {formatAmount(monthlyStats.totalPayroll, currency)}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-end text-emerald-600 dark:text-emerald-400 font-black font-mono">
                    {formatAmount(monthlyStats.settledPayroll, currency)}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-end text-amber-600 dark:text-amber-400 font-black font-mono">
                    {formatAmount(monthlyStats.unsettledPayroll, currency)}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-center text-xs font-normal text-slate-400">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>* {t('projectCurrency') || 'ارز مالی این پروژه'}: <strong>{currency} ({getCurrencySymbol(currency, language)})</strong></span>
            </div>
          </div>
        )}
      </div>

    
      {/* Recent Tasks & Work Notes Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
              <FileText className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {t('recentTasksTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('recentTasksDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('calendar')}
            className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>{t('dayView')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {logs.filter(l => l.notes && l.notes.trim()).length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            {t('noTasksRecorded')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {logs.filter(l => l.notes && l.notes.trim()).slice(-6).reverse().map((log) => {
              const worker = workers.find(w => w.id === log.workerId) || { name: 'Unknown', role: '' };
              return (
                <div key={log.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span 
                          onClick={() => openWorkerProfile(log.workerId)}
                          className="font-bold text-slate-900 dark:text-white cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors"
                          title="مشاهده پروفایل جامع پرسنل"
                        >
                          {worker.name}
                        </span>
                        <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">({log.date})</span>
                      </div>
                      <button
                        onClick={() => setEditingLog(log)}
                        className="p-1 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={t('edit')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium line-clamp-3">
                      {log.notes}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDayOption') : t('fullDayOption')}</span>
                    {log.overtimeHours > 0 && (
                      <span className="text-amber-500 font-bold font-mono">
                        {log.type === 'hourly' ? '' : '+'}{formatDigitalHours(log.overtimeHours)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated Edit Record Modal */}
      <EditRecordModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
      />

      {/* User Profile Settings Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

    </div>
  );
}