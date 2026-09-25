import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { 
  formatCurrency,
  formatAmount, 
  formatHoursAndMinutes, 
  getCurrentYearMonth, 
  getTodayDateString, 
  roundCurrency,
  getCurrencySymbol,
  formatDayMonth,
  formatMonthOnly
} from '../utils/formatters';
import { SettlementModal } from './SettlementModal';
import { AdvancePaymentModal } from './AdvancePaymentModal';
import { WorkerFinancialProfileModal } from './WorkerFinancialProfileModal';
import { EditPaymentModal } from './EditPaymentModal';
import { DateFilterComponent } from './DateFilterComponent';
import { fullSyncBothDirections, pushPaymentsLive, recordPendingPaymentDeletion } from '../services/realtimeSync';
import { 
  WalletCards, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Coins, 
  Banknote, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Receipt, 
  PlusCircle, 
  Calendar, 
  CalendarDays,
  CalendarRange,
  SlidersHorizontal,
  Users, 
  RefreshCw,
  Check,
  X,
  Trash2,
  Edit3,
  Layers,
  ChevronDown,
  ChevronUp,
  Archive,
  RotateCcw
} from 'lucide-react';

export function FinancialsView() {
  const { t, language, direction } = useLanguage();
  const { currentProject, dateFilter, setDateFilter } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const [filterMode, setFilterMode] = useState('monthly');
  const selectedMonth = dateFilter.month || getCurrentYearMonth();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState(() => getTodayDateString());
  const [selectedWorkerId, setSelectedWorkerId] = useState('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'settled' | 'overpaid'

  // Modals state
  const [settlementTargetWorker, setSettlementTargetWorker] = useState(null);
  const [advanceTargetWorker, setAdvanceTargetWorker] = useState(null);
  const [historyTargetWorker, setHistoryTargetWorker] = useState(null);
  const [isGlobalAdvanceModalOpen, setIsGlobalAdvanceModalOpen] = useState(false);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [tempFromDate, setTempFromDate] = useState(fromDate);
  const [tempToDate, setTempToDate] = useState(toDate);
  const [transactionTab, setTransactionTab] = useState('active'); // 'active' | 'archived' | 'trash'

  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // Project sections live query
  const projectSections = useLiveQuery(
    async () => {
      if (!targetProjectId) return [];
      return await db.projectSections.where('projectId').equals(targetProjectId).toArray();
    },
    [targetProjectId]
  ) || [];

  const [sectionFinancialView, setSectionFinancialView] = useState('concise'); // 'concise' | 'detailed'
  const [expandedSectionFinancialId, setExpandedSectionFinancialId] = useState(null);

  // Live queries from IndexedDB scoped to active project with fallback for legacy records
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  const allLogs = useLiveQuery(
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

  // Compute worker financial summaries with cumulative prior debt & FIFO settlement status
  const workerFinancials = useMemo(() => {
    return workers.map((w) => {
      const allWorkerLogs = allLogs.filter((l) => String(l.workerId) === String(w.id));
      const allWorkerPayments = allPayments.filter((p) => String(p.workerId) === String(w.id) && !p.deletedAt);

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

      // Unsettled open records for this worker across entire history
      const unsettledWorkerLogs = allWorkerLogs.filter((l) => !l.isSettled);
      const unsettledWorkerPayments = allWorkerPayments.filter((p) => !p.isSettled);

      const unsettledGross = roundCurrency(unsettledWorkerLogs.reduce((sum, l) => sum + getLogPay(l), 0), currency);
      const unsettledAdvances = roundCurrency(
        unsettledWorkerPayments
          .filter((p) => p.type === 'advance' || p.type === 'Advance_Payment')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
        currency
      );

      // True open balance due is strictly unsettled work minus unsettled advances
      const netBalanceDue = roundCurrency(unsettledGross - unsettledAdvances, currency);

      // Total All-Time Gross & Paid across entire database history
      const totalAllTimeGross = roundCurrency(allWorkerLogs.reduce((sum, l) => sum + getLogPay(l), 0), currency);
      const totalAllTimePaid = roundCurrency(allWorkerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), currency);

      // Determine period boundaries
      let currentLogs = [];
      let priorLogs = [];
      let currentPayments = [];
      let priorPayments = [];
      let periodEndDate = '';

      if (dateFilter?.mode === 'unsettled_only') {
        periodEndDate = getTodayDateString();
        currentLogs = unsettledWorkerLogs;
        priorLogs = [];
        currentPayments = unsettledWorkerPayments;
        priorPayments = [];
      } else if (filterMode === 'monthly') {
        periodEndDate = `${selectedMonth}-31`;
        currentLogs = allWorkerLogs.filter((l) => l.date && l.date.startsWith(selectedMonth));
        // ONLY count prior logs that were NEVER settled as prior arrears!
        priorLogs = allWorkerLogs.filter((l) => l.date && l.date < selectedMonth && !l.isSettled);
        currentPayments = allWorkerPayments.filter((p) => p.month === selectedMonth || (!p.month && p.date && p.date.startsWith(selectedMonth)));
        priorPayments = allWorkerPayments.filter((p) => ((p.month && p.month < selectedMonth) || (!p.month && p.date && p.date < selectedMonth)) && !p.isSettled);
      } else {
        // Date range mode
        periodEndDate = toDate;
        currentLogs = allWorkerLogs.filter((l) => l.date && l.date >= fromDate && l.date <= toDate);
        priorLogs = allWorkerLogs.filter((l) => l.date && l.date < fromDate && !l.isSettled);
        currentPayments = allWorkerPayments.filter((p) => {
          if (p.date) return p.date >= fromDate && p.date <= toDate;
          if (p.month) return p.month >= fromDate.slice(0, 7) && p.month <= toDate.slice(0, 7);
          return false;
        });
        priorPayments = allWorkerPayments.filter((p) => {
          if (p.isSettled) return false;
          if (p.date) return p.date < fromDate;
          if (p.month) return p.month < fromDate.slice(0, 7);
          return false;
        });
      }

      // 1. Current Period Attendance & Gross
      let fullDays = 0;
      let halfDays = 0;
      let hourlyDays = 0;
      let otHours = 0;
      let grossEarnings = 0;

      currentLogs.forEach((l) => {
        if (l.type === 'full') fullDays++;
        else if (l.type === 'half') halfDays++;
        else if (l.type === 'hourly') hourlyDays++;

        otHours += Number(l.overtimeHours) || 0;
        grossEarnings += getLogPay(l);
      });

      const effectiveDays = fullDays + halfDays * 0.5;

      // 2. Prior Months Arrears Attendance & Gross
      let priorFullDays = 0;
      let priorHalfDays = 0;
      let priorHourlyDays = 0;
      let priorOtHours = 0;
      let priorGross = 0;

      priorLogs.forEach((l) => {
        if (l.type === 'full') priorFullDays++;
        else if (l.type === 'half') priorHalfDays++;
        else if (l.type === 'hourly') priorHourlyDays++;

        priorOtHours += Number(l.overtimeHours) || 0;
        priorGross += getLogPay(l);
      });

      const priorEffectiveDays = priorFullDays + priorHalfDays * 0.5;
      const priorGrossRounded = roundCurrency(priorGross, currency);
      const priorPaid = roundCurrency(priorPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), currency);
      const priorBalance = roundCurrency(Math.max(0, priorGrossRounded - priorPaid), currency);

      // 3. Current Period Payments
      const totalAdvances = roundCurrency(currentPayments
        .filter((p) => p.type === 'advance')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0), currency);

      const totalSettlements = roundCurrency(currentPayments
        .filter((p) => p.type === 'settlement')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0), currency);

      const totalPaidPeriod = roundCurrency(totalAdvances + totalSettlements, currency);

      // 4. Gross cumulative earnings up to this inspected period
      const grossUpToPeriod = roundCurrency(allWorkerLogs
        .filter((l) => l.date && l.date <= periodEndDate)
        .reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0), currency);

      // 5. FIFO Cumulative Settlement Status
      let status = 'pending';
      if (totalAllTimeGross === 0 && totalAllTimePaid === 0) {
        status = 'no_activity';
      } else if (totalAllTimePaid > totalAllTimeGross) {
        status = 'overpaid';
      } else if (netBalanceDue === 0 && totalAllTimeGross > 0) {
        status = 'settled';
      } else if (totalAllTimePaid >= grossUpToPeriod && grossUpToPeriod > 0) {
        status = 'settled';
      } else {
        status = 'pending';
      }

      const hasSettledRecord = currentPayments.some((p) => p.type === 'settlement' && p.status === 'settled');

      return {
        worker: w,
        fullDays,
        halfDays,
        hourlyDays,
        effectiveDays,
        otHours,
        grossEarnings: roundCurrency(grossEarnings, currency),
        priorFullDays,
        priorHalfDays,
        priorEffectiveDays,
        priorOtHours,
        priorGross: priorGrossRounded,
        priorBalance,
        totalAdvances,
        totalSettlements,
        totalPaidPeriod,
        totalAllTimeGross,
        totalAllTimePaid,
        grossUpToPeriod,
        netBalanceDue,
        status,
        hasSettledRecord,
        currentLogs,
        currentPayments
      };
    });
  }, [workers, allLogs, allPayments, filterMode, selectedMonth, fromDate, toDate, dateFilter, currency]);

  // Project sections financial distribution (concise & comprehensive matrix)
  const sectionFinancials = useMemo(() => {
    if (projectSections.length === 0) return [];
    const map = {};

    projectSections.forEach((s) => {
      map[s.id] = {
        id: s.id,
        name: s.name,
        personDays: 0,
        otHours: 0,
        basePay: 0,
        otPay: 0,
        totalCost: 0,
        workerStats: {}
      };
    });

    map['unassigned'] = {
      id: 'unassigned',
      name: language === 'fa' ? 'عمومی / بدون بخش' : 'General / Unassigned',
      personDays: 0,
      otHours: 0,
      basePay: 0,
      otPay: 0,
      totalCost: 0,
      workerStats: {}
    };

    const workerMap = {};
    workers.forEach((w) => { workerMap[String(w.id)] = w; });

    let totalSectionPayroll = 0;

    // Filter logs for selected period
    const logsInPeriod = allLogs.filter((l) => {
      if (filterMode === 'monthly') {
        return l.date && l.date.startsWith(selectedMonth);
      } else {
        return l.date && l.date >= fromDate && l.date <= toDate;
      }
    });

    logsInPeriod.forEach((l) => {
      const secId = l.sectionId && map[l.sectionId] ? l.sectionId : 'unassigned';
      const item = map[secId];
      const dayVal = l.type === 'hourly' ? 0 : l.type === 'half' ? 0.5 : 1.0;
      const otVal = Number(l.overtimeHours) || 0;
      const totalDayPay = Number(l.totalDayPay) || 0;
      const baseDayPay = Number(l.calculatedDailyWage) || 0;
      const otDayPay = Number(l.calculatedOvertimeWage) || 0;

      item.personDays += dayVal;
      item.otHours += otVal;
      item.basePay += baseDayPay;
      item.otPay += otDayPay;
      item.totalCost += totalDayPay;
      totalSectionPayroll += totalDayPay;

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
      item.workerStats[wId].totalPay += totalDayPay;
    });

    return Object.values(map)
      .filter((sec) => sec.totalCost > 0 || (sec.id !== 'unassigned' && projectSections.some(s => s.id === sec.id)))
      .map((sec) => {
        const sharePercent = totalSectionPayroll > 0
          ? Math.round((sec.totalCost / totalSectionPayroll) * 100)
          : 0;
        const workersList = Object.values(sec.workerStats).sort((a, b) => b.totalPay - a.totalPay);
        const avgDailyCost = sec.personDays > 0 ? Math.round(sec.totalCost / sec.personDays) : 0;
        return {
          ...sec,
          sharePercent,
          workersList,
          workerCount: workersList.length,
          avgDailyCost
        };
      });
  }, [allLogs, projectSections, workers, filterMode, selectedMonth, fromDate, toDate, language]);

  // Aggregate KPI metrics
  const aggregateMetrics = useMemo(() => {
    let totalGross = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let settledCount = 0;
    let relevantWorkersCount = 0;

    workerFinancials.forEach((item) => {
      if (selectedWorkerId !== 'all' && item.worker.id !== selectedWorkerId) {
        return;
      }

      totalGross += item.grossEarnings;
      totalPaid += item.totalPaidPeriod;
      totalOutstanding += item.netBalanceDue;

      if (item.grossEarnings > 0 || item.totalAllTimeGross > 0 || item.netBalanceDue > 0 || item.totalPaidPeriod > 0) {
        relevantWorkersCount++;
        if (item.status === 'settled') {
          settledCount++;
        }
      }
    });

    return {
      totalGross: roundCurrency(totalGross, currency),
      totalPaid: roundCurrency(totalPaid, currency),
      totalOutstanding: roundCurrency(totalOutstanding, currency),
      settledCount,
      relevantWorkersCount: relevantWorkersCount || workers.filter((w) => w.isActive === 1).length
    };
  }, [workerFinancials, selectedWorkerId, workers, currency]);

  // Filtered workers for table
  const displayedRows = useMemo(() => {
    return workerFinancials.filter((item) => {
      // Worker dropdown filter
      if (selectedWorkerId !== 'all' && item.worker.id !== selectedWorkerId) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.worker.name.toLowerCase().includes(q);
        const matchRole = item.worker.role.toLowerCase().includes(q);
        if (!matchName && !matchRole) return false;
      }

      // Status filter
      if (statusFilter === 'pending') return item.status === 'pending';
      if (statusFilter === 'settled') return item.status === 'settled';
      if (statusFilter === 'overpaid') return item.status === 'overpaid';

      // Show workers who have activity or debt or are active
      const hasAnyActivity = item.grossEarnings > 0 || item.priorGross > 0 || item.totalAllTimeGross > 0 || item.netBalanceDue > 0 || item.totalPaidPeriod > 0;
      if (item.worker.isActive === 0 && !hasAnyActivity && !searchTerm.trim() && selectedWorkerId === 'all') {
        return false;
      }

      return true;
    });
  }, [workerFinancials, selectedWorkerId, searchTerm, statusFilter]);

  // Month navigation helpers
  const handleShiftMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleOpenSettlement = () => {
    if (selectedWorkerId && selectedWorkerId !== 'all') {
      const w = workers.find((x) => String(x.id) === String(selectedWorkerId));
      if (w) {
        setSettlementTargetWorker(w);
        return;
      }
    }
    const dueRow = displayedRows.find((r) => r.netBalanceDue > 0);
    if (dueRow?.worker) {
      setSettlementTargetWorker(dueRow.worker);
    } else if (workers.length > 0) {
      setSettlementTargetWorker(workers[0]);
    }
  };

  const statusCounts = useMemo(() => {
    let pending = 0;
    let settled = 0;
    let overpaid = 0;
    const list = selectedWorkerId !== 'all'
      ? workerFinancials.filter((item) => item.worker.id === selectedWorkerId)
      : workerFinancials;

    list.forEach((item) => {
      if (item.status === 'settled') settled++;
      else if (item.status === 'overpaid') overpaid++;
      else pending++;
    });
    return {
      all: list.length,
      pending,
      settled,
      overpaid
    };
  }, [workerFinancials, selectedWorkerId]);

  const activePayments = useMemo(() => allPayments.filter(p => !p.deletedAt && !p.isArchived), [allPayments]);
  const archivedPayments = useMemo(() => allPayments.filter(p => !p.deletedAt && p.isArchived), [allPayments]);
  const trashPayments = useMemo(() => allPayments.filter(p => !!p.deletedAt), [allPayments]);

  const displayedPayments = useMemo(() => {
    let list = [];
    if (transactionTab === 'archived') list = archivedPayments;
    else if (transactionTab === 'trash') list = trashPayments;
    else list = activePayments;

    return [...list].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }, [transactionTab, activePayments, archivedPayments, trashPayments]);

  const handleArchivePayment = async (payment) => {
    try {
      await db.payments.update(payment.id, {
        isArchived: true,
        updatedAt: new Date().toISOString()
      });
      pushPaymentsLive().catch(() => {});
    } catch (err) {
      console.error('Error archiving payment:', err);
    }
  };

  const handleUnarchivePayment = async (payment) => {
    try {
      await db.payments.update(payment.id, {
        isArchived: false,
        updatedAt: new Date().toISOString()
      });
      pushPaymentsLive().catch(() => {});
    } catch (err) {
      console.error('Error unarchiving payment:', err);
    }
  };

  const handleMovePaymentToTrash = async (payment) => {
    const desc = payment.workerName || payment.notes || formatAmount(payment.amount, currency);
    if (window.confirm((t('moveToTrash') || 'انتقال به سطل آشغال') + `: ${desc}؟`)) {
      try {
        await db.payments.update(payment.id, {
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        pushPaymentsLive().catch(() => {});
      } catch (err) {
        console.error('Error moving payment to trash:', err);
      }
    }
  };

  const handleRestorePayment = async (payment) => {
    try {
      await db.payments.update(payment.id, {
        deletedAt: null,
        updatedAt: new Date().toISOString()
      });
      pushPaymentsLive().catch(() => {});
    } catch (err) {
      console.error('Error restoring payment:', err);
    }
  };

  const handlePermanentDeletePayment = async (payment) => {
    if (window.confirm(t('permanentDeleteConfirm') || 'آیا از حذف دائمی این تراکنش مطمئن هستید؟ این عملیات غیرقابل بازگشت است.')) {
      try {
        recordPendingPaymentDeletion(payment.id);
        await db.payments.delete(payment.id);
        pushPaymentsLive().catch(() => {});
      } catch (err) {
        console.error('Error permanently deleting payment:', err);
      }
    }
  };

  const handleEmptyPaymentsTrash = async () => {
    if (trashPayments.length === 0) return;
    if (window.confirm(t('emptyTrashConfirm') || 'آیا از حذف دائمی تمام موارد موجود در سطل آشغال مطمئن هستید؟')) {
      try {
        for (const p of trashPayments) {
          recordPendingPaymentDeletion(p.id);
          await db.payments.delete(p.id);
        }
        pushPaymentsLive().catch(() => {});
      } catch (err) {
        console.error('Error emptying payments trash:', err);
      }
    }
  };

  return (
    <div className="space-y-6 pb-20 no-print" dir={direction}>
      
      {/* Top Header Bar & Dual Filter Controls (Monthly vs Custom Date Range + Worker Dropdown) */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <WalletCards className="w-6 h-6 text-sky-500" />
              <span>{t('financialDashboard')}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('financialDashboardSubtitle')}
            </p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          
          {/* Row 1 on Mobile / Left on PC */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            {/* Mode Switcher: Monthly vs Unsettled (Global DateFilterComponent) */}
            <DateFilterComponent />

            {/* Quick Actions: Settlement + Add Advance */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner flex-shrink-0">
              <button
                type="button"
                onClick={handleOpenSettlement}
                aria-label={t('settleBtn') || 'ثبت تسویه حساب'}
                title={t('settleBtn') || 'ثبت تسویه حساب'}
                className="p-2 sm:p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-white/80 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-700/60 rounded-xl transition-all duration-200"
              >
                <CheckCircle2 className="w-5.5 h-5.5 flex-shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setIsGlobalAdvanceModalOpen(true)}
                aria-label={t('addAdvanceBtn') || 'ثبت مساعده'}
                title={t('addAdvanceBtn') || 'ثبت مساعده'}
                className="p-2 sm:p-2.5 text-slate-500 hover:text-amber-600 hover:bg-white/80 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-slate-700/60 rounded-xl transition-all duration-200"
              >
                <Banknote className="w-5.5 h-5.5 flex-shrink-0" />
              </button>
            </div>
          </div>

          {/* Row 2 on Mobile / Right on PC */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 hide-scrollbar sm:ms-auto">
            
            {/* Date Selector */}
            {dateFilter?.mode === 'unsettled_only' ? (
              <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-inner flex-shrink-0">
                <Clock className="w-4 h-4" />
                <span>{t('unsettledOnly') || 'از آخرین تسویه (تمامی کارکردهای باز)'}</span>
              </div>
            ) : filterMode === 'monthly' ? (
              <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl p-1 border border-slate-200/90 dark:border-slate-700/70 shadow-inner flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(direction === 'rtl' ? 1 : -1)}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70 transition-colors flex-shrink-0"
                  title="Previous Month"
                >
                  {direction === 'rtl' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>

                <div className="relative flex items-center justify-center cursor-pointer min-w-[6rem] sm:min-w-[7rem]">
                  <div className="pointer-events-none px-2 py-0.5 text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 text-center w-full">
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
                  onClick={() => handleShiftMonth(direction === 'rtl' ? -1 : 1)}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70 transition-colors flex-shrink-0"
                  title="Next Month"
                >
                  {direction === 'rtl' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempFromDate(fromDate);
                  setTempToDate(toDate);
                  setIsDateRangeModalOpen(true);
                }}
                className="flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl p-2 px-3 sm:px-4 border border-slate-200/90 dark:border-slate-700/70 shadow-inner text-xs font-semibold hover:bg-slate-200/90 dark:hover:bg-slate-700/90 transition-colors flex-shrink-0"
              >
                <div className="flex items-center gap-1.5 leading-tight text-[11px] sm:text-xs whitespace-nowrap">
                  <span className="text-slate-500 dark:text-slate-400 font-normal">{t('fromDateLabel') || 'از'}</span>
                  <span className="text-slate-700 dark:text-slate-200 font-bold font-mono">{formatDayMonth(fromDate, language)}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal ms-1">{t('toDateLabel') || 'تا'}</span>
                  <span className="text-slate-700 dark:text-slate-200 font-bold font-mono">{formatDayMonth(toDate, language)}</span>
                </div>
                <Calendar className="w-4 h-4 text-sky-500 flex-shrink-0 ms-2" />
              </button>
            )}

            {/* Worker Selector Dropdown */}
            <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl p-1.5 px-3 border border-slate-200/90 dark:border-slate-700/70 shadow-inner flex-shrink-0">
              <Users className="w-5 h-5 text-sky-600 dark:text-sky-400 flex-shrink-0" />
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-white text-xs font-bold py-1 focus:outline-none cursor-pointer sm:w-40 appearance-none"
              >
                <option value="all">{t('allWorkersOption')}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isActive === 0 ? `(${t('inactive')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Gross Payroll */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('totalCalculatedPayroll')}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {formatAmount(aggregateMetrics.totalGross, currency)}
            </span>
            <span className="text-xs text-slate-400 ms-1 font-bold">{getCurrencySymbol(currency, language)}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {filterMode === 'monthly' ? `${selectedMonth}` : `${fromDate} ➔ ${toDate}`}
          </div>
        </div>

        {/* Card 2: Total Paid (Advances + Settlements) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('totalPaidAdvances')}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatAmount(aggregateMetrics.totalPaid, currency)}
            </span>
            <span className="text-xs text-slate-400 ms-1 font-bold">{getCurrencySymbol(currency, language)}</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <span>{t('totalPaidAll')}</span>
          </div>
        </div>

        {/* Card 3: Total Outstanding Balance Due */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('totalOutstandingPayable')}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatAmount(aggregateMetrics.totalOutstanding, currency)}
            </span>
            <span className="text-xs text-slate-400 ms-1 font-bold">{getCurrencySymbol(currency, language)}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {t('netBalanceDueLabel')}
          </div>
        </div>

        {/* Card 4: Settled Ratio */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-5 rounded-3xl shadow-lg shadow-indigo-600/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100">
              {t('settlementStatus')}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center backdrop-blur-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black tracking-tight">
              {aggregateMetrics.settledCount} <span className="text-lg font-bold text-indigo-200">/ {aggregateMetrics.relevantWorkersCount}</span>
            </span>
          </div>
          <div className="mt-2 text-[11px] text-indigo-200 font-semibold">
            {aggregateMetrics.settledCount === aggregateMetrics.relevantWorkersCount && aggregateMetrics.relevantWorkersCount > 0
              ? t('settledBadge')
              : `${aggregateMetrics.relevantWorkersCount - aggregateMetrics.settledCount} ${t('pendingBadge')}`}
          </div>
        </div>

      </div>

      {/* Project Sections Financial Breakdown Widget (Prompt Item 6: Concise vs Detailed Admin View) */}
      {sectionFinancials.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{t('sectionFinancials') || 'مالی و هزینه‌های بخش‌های پروژه'}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {sectionFinancials.length} {language === 'fa' ? 'بخش دارای کارکرد' : 'Sections'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {filterMode === 'monthly'
                    ? `توزیع مالی ماه ${selectedMonth}`
                    : `توزیع مالی بازه ${fromDate} تا ${toDate}`}
                </p>
              </div>
            </div>

            {/* View Mode Toggle: Concise vs Detailed */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSectionFinancialView('concise')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  sectionFinancialView === 'concise'
                    ? 'bg-sky-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('conciseView') || 'نمای مختصر'}
              </button>
              <button
                type="button"
                onClick={() => setSectionFinancialView('detailed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  sectionFinancialView === 'detailed'
                    ? 'bg-sky-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('detailedView') || 'نمای جامع (ماتریس)'}
              </button>
            </div>
          </div>

          {/* Mode 1: Concise Cards View */}
          {sectionFinancialView === 'concise' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {sectionFinancials.map((sec) => (
                <div
                  key={sec.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {sec.name}
                    </span>
                    <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 bg-sky-100/60 dark:bg-sky-950/80 px-2 py-0.5 rounded-md font-mono">
                      {sec.sharePercent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${sec.sharePercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      {sec.workerCount} نفر • {sec.personDays} نفر-روز
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                      {formatCurrency(sec.totalCost, currency, language)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span>{t('avgDailyCostPerPerson') || 'میانگین هر روز'}:</span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(sec.avgDailyCost, currency, language)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mode 2: Detailed Matrix Table View */}
          {sectionFinancialView === 'detailed' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-3.5">{t('section') || 'بخش'}</th>
                    <th className="py-3 px-3 text-center">{t('activeWorkersInSection') || 'تعداد پرسنل'}</th>
                    <th className="py-3 px-3 text-center">{t('personDays') || 'نفر-روز'}</th>
                    <th className="py-3 px-3 text-center">{t('overtime') || 'اضافه‌کاری'}</th>
                    <th className="py-3 px-3.5">{language === 'fa' ? 'دستمزد عادی' : 'Base Wage'}</th>
                    <th className="py-3 px-3.5">{language === 'fa' ? 'دستمزد اضافه' : 'Overtime Pay'}</th>
                    <th className="py-3 px-3.5 font-black">{t('totalGrossPayroll') || 'کل هزینه بخش'}</th>
                    <th className="py-3 px-3 text-center">{t('shareOfProjectPayroll') || 'سهم'}</th>
                    <th className="py-3 px-3 text-center">{language === 'fa' ? 'ریز پرسنل' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sectionFinancials.map((sec) => {
                    const isExpanded = expandedSectionFinancialId === sec.id;
                    return (
                      <React.Fragment key={sec.id}>
                        <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors font-medium">
                          <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Layers className="w-4 h-4 text-sky-500 flex-shrink-0" />
                            <span>{sec.name}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {sec.workerCount} نفر
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {sec.personDays}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-amber-600 dark:text-amber-400">
                            {formatHoursAndMinutes(sec.otHours, language)}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-300">
                            {formatCurrency(sec.basePay, currency, language)}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-amber-600 dark:text-amber-400">
                            {formatCurrency(sec.otPay, currency, language)}
                          </td>
                          <td className="py-3 px-3.5 font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                            {formatCurrency(sec.totalCost, currency, language)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-100/60 dark:bg-sky-950/80 px-2 py-0.5 rounded-md font-mono">
                              {sec.sharePercent}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setExpandedSectionFinancialId(isExpanded ? null : sec.id)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/60 transition-colors inline-flex items-center gap-1"
                            >
                              <span>{isExpanded ? (language === 'fa' ? 'بستن' : 'Close') : (language === 'fa' ? 'مشاهده پرسنل' : 'Crew')}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Crew Sub-table */}
                        {isExpanded && (
                          <tr className="bg-sky-50/40 dark:bg-sky-950/20">
                            <td colSpan={9} className="p-3">
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-sky-200/60 dark:border-sky-800/60 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-sky-700 dark:text-sky-300">
                                  <span>{t('participatingWorkers') || 'پرسنل مشارکت‌کننده در بخش'} «{sec.name}»:</span>
                                  <span>{sec.workersList.length} کارگر</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                  {sec.workersList.map(({ worker, days, otHours, totalPay }) => (
                                    <div
                                      key={worker.id}
                                      className="p-2.5 bg-slate-50 dark:bg-slate-800/70 rounded-lg border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                                    >
                                      <div>
                                        <span className="font-bold text-slate-900 dark:text-white block">
                                          {worker.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                          {days} روز {otHours > 0 ? `(+${formatHoursAndMinutes(otHours, language)})` : ''}
                                        </span>
                                      </div>
                                      <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                                        {formatCurrency(totalPay, currency, language)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-5 h-5 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchWorkerPlaceholder')}
            className="w-full ps-10 pe-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white shadow-xs"
          />
        </div>

        {/* Status Filter Segmented Control (Google M3 Icon-First with Active Title Expansion) */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner overflow-x-auto">
          {[
            { id: 'all', label: t('filterAll') || 'همه', count: statusCounts.all, icon: SlidersHorizontal, activeClass: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' },
            { id: 'pending', label: t('filterPending') || 'در انتظار', count: statusCounts.pending, icon: Clock, activeClass: 'bg-amber-600 text-white shadow-md shadow-amber-600/30' },
            { id: 'settled', label: t('filterSettled') || 'تسویه شده', count: statusCounts.settled, icon: CheckCircle2, activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' },
            { id: 'overpaid', label: t('filterOverpaid') || 'اضافه پرداخت', count: statusCounts.overpaid, icon: AlertCircle, activeClass: 'bg-rose-600 text-white shadow-md shadow-rose-600/30' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                aria-label={`${tab.label} (${tab.count})`}
                title={`${tab.label} (${tab.count})`}
                className={`relative flex items-center gap-2 rounded-xl transition-all duration-200 ${
                  isSelected
                    ? `${tab.activeClass} font-bold py-2.5 px-3.5 sm:py-3 sm:px-4`
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60 p-2.5 sm:p-3'
                }`}
              >
                <Icon className="w-5.5 h-5.5 flex-shrink-0" />
                {isSelected && (
                  <span className="text-xs font-semibold whitespace-nowrap animate-fade-in flex items-center gap-1.5">
                    <span>{tab.label}</span>
                    <span className="text-[10px] bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded-full font-mono">
                      {tab.count}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Financial Ledger Table with Prior-Months Breakdown Columns (Item 2.2) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {t('financialSummaryTitle')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {filterMode === 'monthly' ? selectedMonth : `${fromDate} ➔ ${toDate}`} • {displayedRows.length} {t('workers')}
            </p>
          </div>
        </div>

        {displayedRows.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-sm">
            {t('noDataForMonth')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px] leading-snug">
                <tr>
                  {/* 1. Worker Name */}
                  <th className="px-3 py-2.5 text-start whitespace-nowrap">
                    {t('colWorker')}
                  </th>

                  {/* 2. Current Month Work */}
                  <th className="px-2 py-2 text-center whitespace-nowrap">
                    <div className="font-bold">{t('colCurrentWork')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t('colCurrentWorkSub')}</div>
                  </th>

                  {/* 3. Prior Months Work */}
                  <th className="px-2 py-2 text-center whitespace-nowrap">
                    <div className="font-bold">{t('colPriorWork')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t('colPriorWorkSub')}</div>
                  </th>

                  {/* 4. Current Month Gross */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colCurrentGross')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 5. Prior Months Arrears */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colPriorGross')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 6. Total Combined Gross */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colTotalGross')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 7. Total Paid */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colTotalPaid')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t('colTotalPaidSub')}</div>
                  </th>

                  {/* 8. Net Balance Due */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colNetBalance')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 9. Settlement Status */}
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">
                    {t('colStatus')}
                  </th>

                  {/* 10. Financial Actions */}
                  <th className="px-2.5 py-2.5 text-center whitespace-nowrap">
                    {t('colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedRows.map((row) => {
                  const isSettled = row.status === 'settled';
                  const isPending = row.status === 'pending';
                  const isOverpaid = row.status === 'overpaid';

                  return (
                    <tr 
                      key={row.worker.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        row.worker.isActive === 0 ? 'opacity-70 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* 1. Worker Name & Role */}
                      <td className="px-3 py-2.5 text-start font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.worker.isActive === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <div>
                            <span className="block">{row.worker.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal block">
                              {row.worker.role} {row.worker.isActive === 0 ? `• (${t('inactive')})` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Current Month Work (Days / Overtime) */}
                      <td className="px-2 py-2.5 text-center font-mono whitespace-nowrap">
                        {row.effectiveDays > 0 || row.otHours > 0 ? (
                          <>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {row.effectiveDays} {t('daysCountUnit')}
                            </span>
                            {row.otHours > 0 && (
                              <span className="text-[10px] text-sky-600 dark:text-sky-400 block font-semibold">
                                +{formatHoursAndMinutes(row.otHours, language)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 3. Prior Months Arrears Work (Days / Overtime) */}
                      <td className="px-2 py-2.5 text-center font-mono whitespace-nowrap">
                        {row.priorEffectiveDays > 0 || row.priorOtHours > 0 ? (
                          <>
                            <span className="font-bold text-amber-700 dark:text-amber-400">
                              {row.priorEffectiveDays} {t('daysCountUnit')}
                            </span>
                            {row.priorOtHours > 0 && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-500 block font-semibold">
                                +{formatHoursAndMinutes(row.priorOtHours, language)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 4. Current Month Gross Payroll */}
                      <td className="px-2.5 py-2.5 text-end font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {formatAmount(row.grossEarnings, currency)}
                      </td>

                      {/* 5. Prior Months Gross Arrears */}
                      <td className="px-2.5 py-2.5 text-end font-mono whitespace-nowrap text-amber-600 dark:text-amber-400 font-semibold">
                        {row.priorGross > 0 ? formatAmount(row.priorGross, currency) : '—'}
                      </td>

                      {/* 6. Total Combined Gross Earnings */}
                      <td className="px-2.5 py-2.5 text-end font-extrabold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {formatAmount(row.totalAllTimeGross, currency)}
                      </td>

                      {/* 7. Total Paid (Advances + Settlements) */}
                      <td className="px-2.5 py-2.5 text-end text-emerald-600 dark:text-emerald-400 font-bold font-mono whitespace-nowrap">
                        {row.totalAllTimePaid > 0 ? formatAmount(row.totalAllTimePaid, currency) : '—'}
                      </td>

                      {/* 8. Net Balance Due (To Settle) */}
                      <td className="px-2.5 py-2.5 text-end font-mono whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-xl text-xs font-black inline-block ${
                          row.netBalanceDue === 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : row.netBalanceDue < 0
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          {row.netBalanceDue === 0
                            ? t('fullySettledZero')
                            : row.netBalanceDue < 0
                            ? `${formatAmount(Math.abs(row.netBalanceDue), currency)} (بدهکار)`
                            : `${formatAmount(row.netBalanceDue, currency)} (بستانکار)`}
                        </span>
                        {row.priorBalance > 0 && !isSettled && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-normal mt-0.5">
                            {t('priorArrearsSubtitle').replace('{amount}', formatAmount(row.priorBalance, currency))}
                          </span>
                        )}
                      </td>

                      {/* 9. Settlement Status Badge (FIFO) */}
                      <td className="px-2 py-2.5 text-center whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t('settledBadge')}</span>
                          </span>
                        ) : isOverpaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                            <AlertCircle className="w-3 h-3" />
                            <span>{t('overpaid')}</span>
                          </span>
                        ) : row.grossEarnings > 0 || row.netBalanceDue > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>{t('pendingBadge')}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">{t('noActivityPeriod')}</span>
                        )}
                      </td>

                      {/* 10. Financial Actions */}
                      <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          
                          {/* Settle Button */}
                          <button
                            type="button"
                            onClick={() => setSettlementTargetWorker(row.worker)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] shadow-xs transition-all flex items-center gap-0.5 active:scale-95"
                            title={t('settleBtn')}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t('settleBtn')}</span>
                          </button>

                          {/* Add Advance Button */}
                          <button
                            type="button"
                            onClick={() => setAdvanceTargetWorker(row.worker)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[10px] transition-colors flex items-center gap-0.5"
                            title={t('addAdvanceBtn')}
                          >
                            <PlusCircle className="w-3 h-3 text-amber-500" />
                            <span>{t('advanceType')}</span>
                          </button>

                          {/* History Button */}
                          <button
                            type="button"
                            onClick={() => setHistoryTargetWorker(row.worker)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                            title={t('paymentHistory')}
                          >
                            <Receipt className="w-3.5 h-3.5 text-sky-500" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Table Footnote */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              <span>{currency === 'IQD' ? t('allAmountsInIQDNote') : `* ${t('currency')}: ${currency} (${getCurrencySymbol(currency, language)})`}</span>
            </div>
          </div>
        )}

      </div>

      {/* Recent Financial Activity / Ledger with Archive & Trash */}
      <div className="mt-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{t('recentFinancialActivity') || 'رفتار مالی (تراکنش‌های اخیر)'}</h3>
              <p className="text-[11px] text-slate-400 font-semibold">{t('recentFinancialActivitySub') || 'امکان مدیریت، بایگانی موقت و بازیابی تراکنش‌ها'}</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Segmented Status Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs">
              <button
                type="button"
                onClick={() => setTransactionTab('active')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  transactionTab === 'active'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>{t('activeTransactions') || 'جاری'}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-200 dark:bg-slate-600 font-mono">
                  {activePayments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTransactionTab('archived')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  transactionTab === 'archived'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{t('archivedTransactions') || 'بایگانی'}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-mono">
                  {archivedPayments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTransactionTab('trash')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  transactionTab === 'trash'
                    ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('trashTransactions') || 'سطل آشغال'}</span>
                {trashPayments.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-mono">
                    {trashPayments.length}
                  </span>
                )}
              </button>
            </div>

            {/* Empty Trash Button */}
            {transactionTab === 'trash' && trashPayments.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyPaymentsTrash}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl transition-colors"
                title={t('emptyTrash')}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('emptyTrash') || 'خالی کردن سطل آشغال'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {displayedPayments.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              {transactionTab === 'trash' ? (
                <>
                  <Trash2 className="w-10 h-10 mx-auto opacity-20 mb-3" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('emptyTrashDesc') || 'سطل آشغال تراکنش‌ها در حال حاضر خالی است.'}</p>
                </>
              ) : transactionTab === 'archived' ? (
                <>
                  <Archive className="w-10 h-10 mx-auto opacity-20 mb-3" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">هیچ تراکنش بایگانی‌شده‌ای وجود ندارد.</p>
                </>
              ) : (
                <>
                  <Receipt className="w-10 h-10 mx-auto opacity-20 mb-3" />
                  <p className="text-xs font-semibold">{t('noPaymentsFound') || 'هیچ تراکنشی یافت نشد'}</p>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-start font-bold w-32">{t('date') || 'تاریخ'}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('workerName')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('type') || 'بابت'}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('description') || 'شرح'}</th>
                  <th className="px-4 py-3 text-end font-bold">{t('amount')}</th>
                  <th className="px-4 py-3 text-center font-bold w-28">{t('actions') || 'عملیات'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {displayedPayments.slice(0, 50).map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="font-bold">{payment.date}</div>
                      <div className="text-[10px] text-slate-400">{payment.time}</div>
                    </td>
                    <td className="px-4 py-2.5 font-bold whitespace-nowrap">
                      {payment.workerName || workers.find(w => w.id === payment.workerId)?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        payment.type === 'settlement' 
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      }`}>
                        {payment.type === 'settlement' ? (t('settlementType') || 'تسویه حساب') : (t('advanceType') || 'علی‌الحساب')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] truncate max-w-[150px]" title={payment.notes}>
                      {payment.notes || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-end font-mono font-bold whitespace-nowrap">
                      {formatAmount(payment.amount, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {transactionTab === 'active' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingPayment(payment)}
                              className="p-1.5 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors"
                              title={t('edit') || 'ویرایش'}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchivePayment(payment)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
                              title={t('archive') || 'بایگانی'}
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePaymentToTrash(payment)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                              title={t('moveToTrash') || 'انتقال به سطل آشغال'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {transactionTab === 'archived' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUnarchivePayment(payment)}
                              className="flex items-center gap-1 px-2 py-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                              title={t('unarchive') || 'خروج از بایگانی'}
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>{t('unarchive') || 'خروج از بایگانی'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePaymentToTrash(payment)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                              title={t('moveToTrash') || 'انتقال به سطل آشغال'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {transactionTab === 'trash' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRestorePayment(payment)}
                              className="flex items-center gap-1 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                              title={t('restore') || 'بازیابی'}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{t('restore') || 'بازیابی'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePermanentDeletePayment(payment)}
                              className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 rounded-lg transition-colors"
                              title={t('permanentDelete') || 'حذف دائمی'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Settlement Modal */}
      {settlementTargetWorker && (
        <SettlementModal
          isOpen={!!settlementTargetWorker}
          onClose={() => setSettlementTargetWorker(null)}
          worker={settlementTargetWorker}
          month={selectedMonth}
          workerLogs={allLogs.filter((l) => l.workerId === settlementTargetWorker.id)}
          workerPayments={allPayments.filter((p) => p.workerId === settlementTargetWorker.id)}
          onSettlementComplete={(record) => {
            // Refreshes live via Dexie liveQuery
          }}
          arrearsList={workerFinancials.filter((w) => w.netBalanceDue !== 0)}
          onSelectWorker={(w) => setSettlementTargetWorker(w)}
        />
      )}

      {/* Advance Modal for Specific Worker */}
      {advanceTargetWorker && (
        <AdvancePaymentModal
          isOpen={!!advanceTargetWorker}
          onClose={() => setAdvanceTargetWorker(null)}
          workers={workers}
          targetWorkerId={advanceTargetWorker.id}
          targetMonth={selectedMonth}
        />
      )}

      {/* Global Advance Modal */}
      {isGlobalAdvanceModalOpen && (
        <AdvancePaymentModal
          isOpen={isGlobalAdvanceModalOpen}
          onClose={() => setIsGlobalAdvanceModalOpen(false)}
          workers={workers.filter((w) => w.isActive === 1)}
          targetWorkerId={workers.filter((w) => w.isActive === 1)[0]?.id}
          targetMonth={selectedMonth}
        />
      )}

      {/* Worker Financial Profile (replaces legacy Payment History) */}
      {historyTargetWorker && (
        <WorkerFinancialProfileModal
          worker={historyTargetWorker}
          logs={allLogs.filter(l => String(l.workerId) === String(historyTargetWorker.id))}
          payments={allPayments.filter(p => String(p.workerId) === String(historyTargetWorker.id))}
          currency={currency}
          onClose={() => setHistoryTargetWorker(null)}
          onEditLog={() => {}} 
        />
      )}

      {/* Date Range Selection Modal */}
      {isDateRangeModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDateRangeModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-sky-500" />
                {t('filterModeDateRange') || 'انتخاب بازه زمانی'}
              </h3>
              <button
                onClick={() => setIsDateRangeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t('fromDateLabel') || 'از تاریخ'}</label>
                <div className="relative">
                  <input
                    type="date"
                    value={tempFromDate}
                    onChange={(e) => setTempFromDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer font-mono"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t('toDateLabel') || 'تا تاریخ'}</label>
                <div className="relative">
                  <input
                    type="date"
                    value={tempToDate}
                    onChange={(e) => setTempToDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => setIsDateRangeModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {t('cancel') || 'انصراف'}
              </button>
              <button
                onClick={() => {
                  setFromDate(tempFromDate);
                  setToDate(tempToDate);
                  setIsDateRangeModalOpen(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-500/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {t('confirm') || 'تایید'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      <EditPaymentModal
        isOpen={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        currency={currency}
      />

    </div>
  );
}
