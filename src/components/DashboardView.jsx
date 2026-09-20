import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { EditRecordModal } from './EditRecordModal';
import { useProject } from '../context/ProjectContext';
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
  Sparkles
} from 'lucide-react';

export function DashboardView({ onOpenLoggingModal, setActiveTab }) {
  const { t, language, direction } = useLanguage();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  const [selectedSectionId, setSelectedSectionId] = useState('all');
  const [editingLog, setEditingLog] = useState(null);

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

  // Filter active workers
  const activeWorkers = useMemo(() => {
    return workers.filter((w) => w.isActive === 1);
  }, [workers]);

  // Aggregate monthly stats
  const monthlyStats = useMemo(() => {
    let totalNormalDays = 0;
    let totalHalfDays = 0;
    let totalOvertimeHours = 0;
    let totalPayroll = 0;

    logs.forEach((log) => {
      if (log.type === 'half') {
        totalHalfDays += 1;
      } else if (log.type === 'hourly') {
        // Hourly only, not standard day
      } else {
        totalNormalDays += 1;
      }
      totalOvertimeHours += Number(log.overtimeHours) || 0;
      totalPayroll += Number(log.totalDayPay) || 0;
    });

    const totalDaysCount = totalNormalDays + (totalHalfDays * 0.5);

    return {
      activeCount: activeWorkers.length,
      totalDaysCount,
      totalNormalDays,
      totalHalfDays,
      totalOvertimeHours,
      totalPayroll: roundCurrency(totalPayroll, currency)
    };
  }, [logs, activeWorkers, currency]);

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

        basePay += isNaN(logDaily) ? 0 : logDaily;
        otPay += isNaN(logOt) ? 0 : logOt;
        totalPay += isNaN(logTotal) ? 0 : logTotal;
      });

      return {
        ...worker,
        fullDays,
        halfDays,
        otHours,
        basePay: roundCurrency(basePay, currency),
        otPay: roundCurrency(otPay, currency),
        totalPay: roundCurrency(totalPay, currency),
        logsCount: workerLogs.length
      };
    });
  }, [workers, logs, currency]);

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
      
      {/* Header with Month Navigator & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-sky-500" />
            <span>{t('dashboard')}</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('workerSummaryTitle')}
          </p>
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

          {/* Quick Record Button (Icon-Only matching Floating Action Button & Add Worker size) */}
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
        
        {/* Card 1: Active Workers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('activeWorkersCount')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(monthlyStats.activeCount)}
            </span>
            <span className="text-xs text-slate-400 mx-2">
              / {workers.length} {t('workers')}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-medium">
            <button 
              onClick={() => setActiveTab('workers')} 
              className="hover:underline flex items-center gap-1"
            >
              <span>{t('workerList')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: Total Working Days */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('monthlyWorkingDays')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(monthlyStats.totalDaysCount)}
            </span>
            <span className="text-xs text-slate-400 mx-2">
              ({monthlyStats.totalNormalDays} + {monthlyStats.totalHalfDays}?0.5)
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <button 
              onClick={() => setActiveTab('calendar')} 
              className="hover:underline flex items-center gap-1"
            >
              <span>{t('calendarTitle')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 3: Total Overtime Hours */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('totalOvertimeHours')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {formatHoursAndMinutes(monthlyStats.totalOvertimeHours, language)}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            {t('overtimePay')}: {formatCurrency(logs.reduce((acc, l) => acc + (Number(l.calculatedOvertimeWage) || 0), 0), currency, language)}
          </div>
        </div>

        {/* Card 4: Total Payroll */}
        <div className="bg-gradient-to-br from-sky-600 to-sky-700 text-white rounded-2xl p-5 shadow-lg shadow-sky-600/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-sky-100">
              {t('totalPayrollExpense')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center backdrop-blur-sm">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black tracking-tight">
              {formatCurrency(monthlyStats.totalPayroll, currency, language)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-sky-200">
            <span>{selectedMonth}</span>
            <button 
              onClick={() => setActiveTab('calendar')}
              className="underline hover:text-white font-medium flex items-center gap-1"
            >
              <span>{t('reports')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Financial Overview Widget (Prompt Item 4) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
            <WalletCards className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {t('financialSummaryTitle')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('financialSummarySubtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">{t('totalPaidAll')} ({selectedMonth})</span>
            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatAmount(financialSummary.totalMonthPaid, currency)} <span className="text-xs font-normal">{getCurrencySymbol(currency, language)}</span>
            </span>
          </div>

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 block">{t('totalOutstandingPayable')}</span>
            <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatAmount(financialSummary.totalWorkshopOutstanding, currency)} <span className="text-xs font-normal">{getCurrencySymbol(currency, language)}</span>
            </span>
          </div>

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 block">{t('settlementStatus')}</span>
            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {financialSummary.settledCount} <span className="text-xs font-normal text-slate-400">/ {financialSummary.totalWorkers} {t('settledBadge')}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('financials')}
            className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 ms-auto"
          >
            <span>{t('goToFinancialsBtn')}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
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
                <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5" />
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
                        {formatHoursAndMinutes(activeSection.otHours, language)}
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
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {worker.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {worker.role || 'پرسنل'} • {days} روز کارکرد {otHours > 0 ? `(+${formatHoursAndMinutes(otHours, language)})` : ''}
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('workerSummaryTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedMonth} • {workers.length} {t('workers')}
            </p>
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
                  <th className="px-4 py-3 text-start">{t('workerName')}</th>
                  <th className="px-4 py-3 text-start">{t('workerRole')}</th>
                  <th className="px-4 py-3 text-center">{t('normalDays')}</th>
                  <th className="px-4 py-3 text-center">{t('halfDays')}</th>
                  <th className="px-4 py-3 text-center">{t('overtimeHours')}</th>
                  <th className="px-4 py-3 text-end">{t('basePay')} ({currency})</th>
                  <th className="px-4 py-3 text-end">{t('overtimePay')} ({currency})</th>
                  <th className="px-4 py-3 text-end font-bold text-sky-600 dark:text-sky-400">{t('netSalary')} ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workerSummaries.map((w) => {
                  const statusInfo = workerFinancialStatusMap.get(w.id);
                  const isWorkerSettled = statusInfo?.isSettled;

                  return (
                    <tr 
                      key={w.id} 
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isWorkerSettled ? 'bg-emerald-50/15 dark:bg-emerald-950/10' : ''
                      } ${w.isActive === 0 ? 'opacity-60 bg-slate-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white text-start">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${w.isActive === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <span>{w.name}</span>
                          {isWorkerSettled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 shadow-xs">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{t('settledBadge')}</span>
                            </span>
                          ) : w.totalPay > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 inline-flex items-center gap-1 shadow-xs">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{t('pendingBadge')}</span>
                            </span>
                          ) : null}
                        </div>
                      </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs text-start">
                      {w.role}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-700 dark:text-slate-300">
                      {w.fullDays}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-700 dark:text-slate-300">
                      {w.halfDays}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-amber-600 dark:text-amber-400">
                      {w.otHours > 0 ? formatHoursAndMinutes(w.otHours, language) : '0'}
                    </td>
                    <td className="px-4 py-3 text-end text-slate-600 dark:text-slate-400 font-mono">
                      {formatAmount(w.basePay, currency)}
                    </td>
                    <td className="px-4 py-3 text-end text-amber-600 dark:text-amber-400 font-medium font-mono">
                      {formatAmount(w.otPay, currency)}
                    </td>
                    <td className="px-4 py-3 text-end font-bold text-slate-900 dark:text-white">
                      <span className="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800/60 font-mono">
                        {formatAmount(w.totalPay, currency)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan="2" className="px-4 py-3 text-start">
                    {t('aggregatedTotalPay')} ({selectedMonth})
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                    {monthlyStats.totalNormalDays}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                    {monthlyStats.totalHalfDays}
                  </td>
                  <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">
                    {formatHoursAndMinutes(monthlyStats.totalOvertimeHours, language)}
                  </td>
                  <td className="px-4 py-3 text-end font-mono">
                    {formatAmount(logs.reduce((acc, l) => acc + (Number(l.calculatedDailyWage) || 0), 0), currency)}
                  </td>
                  <td className="px-4 py-3 text-end text-amber-600 dark:text-amber-400 font-mono">
                    {formatAmount(logs.reduce((acc, l) => acc + (Number(l.calculatedOvertimeWage) || 0), 0), currency)}
                  </td>
                  <td className="px-4 py-3 text-end text-sky-600 dark:text-sky-400 text-base font-black font-mono">
                    {formatAmount(monthlyStats.totalPayroll, currency)}
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-500" />
              <span>{t('recentTasksTitle')}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('recentTasksDesc')}
            </p>
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
                        <span className="font-bold text-slate-900 dark:text-white">{worker.name}</span>
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
                      <span className="text-amber-500 font-bold">
                        {log.type === 'hourly' ? '' : '+'}{formatHoursAndMinutes(log.overtimeHours, language)}
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

    </div>
  );
}