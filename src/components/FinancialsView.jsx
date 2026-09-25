import React, { useState, useMemo, useRef } from 'react';
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
import { calculateWorkerFinancials } from '../utils/settlementCalculations.js';
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
  RotateCcw,
  Crown
} from 'lucide-react';

export function FinancialsView() {
  const { t, language, direction } = useLanguage();
  const { currentProject, dateFilter, setDateFilter } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const [filterMode, setFilterMode] = useState('monthly');
  const selectedMonth = dateFilter.month || getCurrentYearMonth();
  const setSelectedMonth = (m) => setDateFilter((prev) => ({ ...prev, month: m }));
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState(() => getTodayDateString());
  const [selectedWorkerId, setSelectedWorkerId] = useState('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'settled' | 'overpaid'
  const [settlementViewTab, setSettlementViewTab] = useState('current'); // 'current' (جاری) | 'settled' (تسویه شده)

  // Modals state
  const [settlementTargetWorker, setSettlementTargetWorker] = useState(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementInitialMode, setSettlementInitialMode] = useState('individual');
  const [settlementInitialGroupId, setSettlementInitialGroupId] = useState(null);
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

  // Live query groups for current project with fallback for legacy/unscoped records
  const groups = useLiveQuery(
    async () => {
      try {
        const [allDbGroups, allDbWorkers] = await Promise.all([
          db.groups.toArray(),
          db.workers.toArray()
        ]);
        const projectWorkerGroupIds = new Set(
          allDbWorkers
            .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId && w.groupId)
            .map((w) => String(w.groupId))
        );
        let list = allDbGroups.filter((g) => 
          !targetProjectId || 
          !g.projectId || 
          String(g.projectId) === String(targetProjectId) ||
          (g.projectId || DEFAULT_PROJECT_ID) === targetProjectId ||
          projectWorkerGroupIds.has(String(g.id))
        );
        if (list.length === 0 && allDbGroups.length > 0) {
          list = allDbGroups;
        }
        return list;
      } catch (err) {
        console.error('Error fetching groups in FinancialsView:', err);
        return [];
      }
    },
    [targetProjectId]
  ) || [];

  // 1. Current / Open Financials (تب جاری)
  // Strictly active personnel (w.isActive === 1 && !w.deletedAt)
  // Strictly unpaid/unsettled work and open debt (!log.isSettled, !payment.isSettled)
  // Double-Barrier Guard: Any log on or before worker's latest settlement date is NEVER treated as unsettled!
  // Zero data from previously settled cycles!
  const currentActiveRows = useMemo(() => {
    return workers
      .filter((w) => !w.deletedAt && w.isActive === 1)
      .map((w) => {
        const fin = calculateWorkerFinancials(w, allLogs, allPayments, currency);
        return {
          ...fin,
          // Generic mappings for dashboard/KPI compatibility
          grossEarnings: fin.unsettledGross,
          totalPaidPeriod: fin.unsettledAdvances,
          totalAllTimeGross: fin.unsettledGross,
          totalAllTimePaid: fin.unsettledAdvances,
          priorGross: 0,
          priorEffectiveDays: 0,
          priorOtHours: 0,
          priorBalance: 0
        };
      })
      .filter((row) => row.netBalanceDue !== 0 || row.effectiveDays > 0 || row.unsettledAdvances > 0);
  }, [workers, allLogs, allPayments, currency]);

  // 2. Settled Financials History (تب تسویه شده)
  // All personnel (active and inactive: w.isActive === 1 || w.isActive === 0)
  // Strictly data that has been settled (log.isSettled, payment.isSettled, or dated <= lastSettlementDate)
  const settledHistoryRows = useMemo(() => {
    return workers
      .filter((w) => !w.deletedAt)
      .map((w) => {
        const fin = calculateWorkerFinancials(w, allLogs, allPayments, currency);
        return {
          worker: fin.worker,
          settledLogs: fin.settledLogs,
          settledPayments: fin.settledPayments,
          settlementReceipts: fin.settlementReceipts,
          fullDays: fin.settledFullDays,
          halfDays: fin.settledHalfDays,
          hourlyDays: fin.settledHourlyDays,
          effectiveDays: fin.settledEffectiveDays,
          otHours: fin.settledOtHours,
          settledGross: fin.settledGross,
          settledAdvances: fin.settledAdvances,
          totalSettlementPaid: fin.totalSettlementPaid,
          lastSettlementDate: fin.lastSettlementDate,
          settlementsCount: fin.settlementReceipts.length,
          status: 'settled',
          // Generic mappings for dashboard/KPI compatibility
          grossEarnings: fin.settledGross,
          totalPaidPeriod: fin.totalSettlementPaid,
          totalAllTimeGross: fin.settledGross,
          totalAllTimePaid: fin.totalSettlementPaid,
          netBalanceDue: 0,
          priorGross: 0,
          priorEffectiveDays: 0,
          priorOtHours: 0,
          priorBalance: 0
        };
      })
      .filter((row) => row.effectiveDays > 0 || row.settlementsCount > 0 || row.totalSettlementPaid > 0);
  }, [workers, allLogs, allPayments, currency]);

  // Active view alias
  const workerFinancials = settlementViewTab === 'current' ? currentActiveRows : settledHistoryRows;

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

  // Aggregate KPI metrics based on current tab view
  const aggregateMetrics = useMemo(() => {
    let currentGross = 0;
    let currentAdvances = 0;
    let currentNetDue = 0;
    let activeWithDueCount = 0;

    currentActiveRows.forEach((item) => {
      if (selectedWorkerId !== 'all' && String(item.worker.id) !== String(selectedWorkerId)) return;
      currentGross += item.unsettledGross;
      currentAdvances += item.unsettledAdvances;
      currentNetDue += item.netBalanceDue;
      if (item.netBalanceDue > 0 || item.effectiveDays > 0) {
        activeWithDueCount++;
      }
    });

    let settledGross = 0;
    let settledPaid = 0;
    let settledAdvances = 0;
    let settledWorkersCount = 0;

    settledHistoryRows.forEach((item) => {
      if (selectedWorkerId !== 'all' && String(item.worker.id) !== String(selectedWorkerId)) return;
      settledGross += item.settledGross;
      settledPaid += item.totalSettlementPaid;
      settledAdvances += item.settledAdvances;
      settledWorkersCount++;
    });

    const isCurrent = settlementViewTab === 'current';

    return {
      isCurrent,
      currentGross: roundCurrency(currentGross, currency),
      currentAdvances: roundCurrency(currentAdvances, currency),
      currentNetDue: roundCurrency(currentNetDue, currency),
      activeWithDueCount,
      totalActiveWorkers: workers.filter((w) => w.isActive === 1 && !w.deletedAt).length,
      settledGross: roundCurrency(settledGross, currency),
      settledPaid: roundCurrency(settledPaid, currency),
      settledAdvances: roundCurrency(settledAdvances, currency),
      settledWorkersCount,
      totalGross: isCurrent ? roundCurrency(currentGross, currency) : roundCurrency(settledGross, currency),
      totalPaid: isCurrent ? roundCurrency(currentAdvances, currency) : roundCurrency(settledPaid, currency),
      totalOutstanding: isCurrent ? roundCurrency(currentNetDue, currency) : 0,
      settledCount: isCurrent ? (currentActiveRows.length - activeWithDueCount) : settledWorkersCount,
      relevantWorkersCount: isCurrent ? currentActiveRows.length : settledHistoryRows.length
    };
  }, [currentActiveRows, settledHistoryRows, settlementViewTab, selectedWorkerId, workers, currency]);

  // Filtered workers for current and settled tabs
  const displayedCurrentRows = useMemo(() => {
    return currentActiveRows.filter((item) => {
      if (selectedWorkerId !== 'all' && String(item.worker.id) !== String(selectedWorkerId)) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (item.worker.name || '').toLowerCase().includes(q);
        const matchRole = (item.worker.role || '').toLowerCase().includes(q);
        if (!matchName && !matchRole) return false;
      }
      return true;
    });
  }, [currentActiveRows, selectedWorkerId, statusFilter, searchTerm]);

  const displayedSettledRows = useMemo(() => {
    return settledHistoryRows.filter((item) => {
      if (selectedWorkerId !== 'all' && String(item.worker.id) !== String(selectedWorkerId)) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (item.worker.name || '').toLowerCase().includes(q);
        const matchRole = (item.worker.role || '').toLowerCase().includes(q);
        if (!matchName && !matchRole) return false;
      }
      return true;
    });
  }, [settledHistoryRows, selectedWorkerId, searchTerm]);

  const displayedRows = settlementViewTab === 'current' ? displayedCurrentRows : displayedSettledRows;

  // Month navigation helpers
  const handleShiftMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleOpenSettlement = () => {
    let target = null;
    if (selectedWorkerId && selectedWorkerId !== 'all') {
      target = workers.find((x) => String(x.id) === String(selectedWorkerId));
    }
    if (!target) {
      const dueRow = displayedCurrentRows.find((r) => r.netBalanceDue > 0);
      target = dueRow?.worker || (currentActiveRows.length > 0 ? currentActiveRows[0].worker : workers[0]);
    }
    if (target) {
      setSettlementTargetWorker(target);
      setSettlementInitialMode(target.teamRole === 'Master' && target.groupId ? 'group' : 'individual');
      setSettlementInitialGroupId(target.groupId || null);
      setIsSettlementModalOpen(true);
    }
  };

  const handleOpenGroupSettlement = () => {
    if (groups.length > 0) {
      const g = groups[0];
      const master = workers.find((w) => w.groupId === g.id && w.teamRole === 'Master') || workers.find((w) => w.groupId === g.id) || workers[0];
      setSettlementTargetWorker(master || null);
      setSettlementInitialMode('group');
      setSettlementInitialGroupId(g.id);
      setIsSettlementModalOpen(true);
    } else {
      handleOpenSettlement();
    }
  };

  const statusCounts = useMemo(() => {
    let pending = 0;
    let settled = 0;
    let overpaid = 0;
    const baseList = currentActiveRows.filter((item) => {
      if (selectedWorkerId !== 'all' && String(item.worker.id) !== String(selectedWorkerId)) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (item.worker.name || '').toLowerCase().includes(q);
        const matchRole = (item.worker.role || '').toLowerCase().includes(q);
        if (!matchName && !matchRole) return false;
      }
      return true;
    });

    baseList.forEach((item) => {
      if (item.status === 'settled') settled++;
      else if (item.status === 'overpaid') overpaid++;
      else pending++;
    });
    return {
      all: baseList.length,
      pending,
      settled,
      overpaid
    };
  }, [currentActiveRows, selectedWorkerId, searchTerm]);

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
          
          {/* Row 1 on Mobile / Left on PC: Quick Actions */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            {/* Quick Actions: Settlement + Group Settlement + Add Advance */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner flex-shrink-0">
              <button
                type="button"
                onClick={handleOpenSettlement}
                aria-label={t('settleBtn') || 'ثبت تسویه حساب فردی'}
                title={t('settleBtn') || 'ثبت تسویه حساب فردی'}
                className="p-2 sm:p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-white/80 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-700/60 rounded-xl transition-all duration-200"
              >
                <CheckCircle2 className="w-5.5 h-5.5 flex-shrink-0" />
              </button>

              {groups.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenGroupSettlement}
                  aria-label="تسویه با سرپرست گروه"
                  title="تسویه حساب گروهی با سرپرست"
                  className="p-2 sm:p-2.5 text-slate-500 hover:text-amber-600 hover:bg-white/80 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-slate-700/60 rounded-xl transition-all duration-200"
                >
                  <Users className="w-5.5 h-5.5 flex-shrink-0" />
                </button>
              )}

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
            {filterMode === 'monthly' ? (
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
              {settlementViewTab === 'current'
                ? (t('currentGrossTitle') || 'کارکرد ناخالص جاری (تسویه‌نشده)')
                : (t('settledGrossTitle') || 'مجموع کارکرد ناخالص تسویه‌شده')}
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
            {settlementViewTab === 'current'
              ? 'حق‌الزحمه روزها و ساعات کارکرد باز'
              : 'شامل کلیه کارکردهای تسویه‌شده قبلی'}
          </div>
        </div>

        {/* Card 2: Total Paid (Advances / Settlement Receipts) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {settlementViewTab === 'current'
                ? (t('unsettledAdvancesTitle') || 'مساعده‌های باز (کسر از حقوق)')
                : (t('settledPaidTitle') || 'کل مبالغ پرداختی تسویه')}
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
            <span>
              {settlementViewTab === 'current'
                ? 'مساعده پرداخت‌شده جاری'
                : 'اسناد و رسیدهای تسویه پرداخت‌شده'}
            </span>
          </div>
        </div>

        {/* Card 3: Total Outstanding Balance Due */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {settlementViewTab === 'current'
                ? (t('totalOutstandingPayable') || 'خالص مانده قابل تسویه')
                : (t('settledAdvancesTitle') || 'مساعده‌های کسر شده')}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {settlementViewTab === 'current'
                ? formatAmount(aggregateMetrics.totalOutstanding, currency)
                : formatAmount(aggregateMetrics.settledAdvances, currency)}
            </span>
            <span className="text-xs text-slate-400 ms-1 font-bold">{getCurrencySymbol(currency, language)}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {settlementViewTab === 'current'
              ? (t('netBalanceDueLabel') || 'خالص بدهی جهت تسویه حساب')
              : 'مساعده‌های مستهلک‌شده در اسناد تسویه'}
          </div>
        </div>

        {/* Card 4: Settled Ratio / Count */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-5 rounded-3xl shadow-lg shadow-indigo-600/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100">
              {settlementViewTab === 'current'
                ? (t('settlementStatus') || 'وضعیت پرسنل فعال')
                : (t('settledWorkersCountTitle') || 'پرسنل دارای سابقه تسویه')}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center backdrop-blur-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black tracking-tight">
              {settlementViewTab === 'current' ? (
                <>
                  {aggregateMetrics.settledCount} <span className="text-lg font-bold text-indigo-200">/ {aggregateMetrics.relevantWorkersCount}</span>
                </>
              ) : (
                <>
                  {aggregateMetrics.settledWorkersCount} <span className="text-base font-bold text-indigo-200">نفر</span>
                </>
              )}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-indigo-200 font-semibold">
            {settlementViewTab === 'current' ? (
              aggregateMetrics.settledCount === aggregateMetrics.relevantWorkersCount && aggregateMetrics.relevantWorkersCount > 0
                ? (t('allSettledBadge') || 'همه تسویه‌شده')
                : `${aggregateMetrics.relevantWorkersCount - aggregateMetrics.settledCount} نفر دارای مانده`
            ) : (
              'کلیه پرسنل (فعال و غیرفعال)'
            )}
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

      {/* Settlement View Mode Tabs (تب جاری vs تب تسویه شده), Status Filters & Expandable Search */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center md:justify-start gap-3 sm:gap-4 flex-wrap">
        
        {/* Line 1 on mobile: Main View Mode Tabs (Centered, Not Full Width) */}
        <div className="flex justify-center w-full md:w-auto">
          <div className="inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
            {/* Tab 1: Current Unsettled (تب جاری) */}
            <button
              type="button"
              onClick={() => setSettlementViewTab('current')}
              title={t('tabCurrentFinancials')}
              aria-label={t('tabCurrentFinancials')}
              className={`group relative flex items-center justify-center gap-2 rounded-xl transition-all duration-300 ease-out text-xs font-bold ${
                settlementViewTab === 'current'
                  ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/35 border border-sky-400/30 py-2.5 px-4 scale-102 flex-none'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08] p-2.5'
              }`}
            >
              <Clock className={`w-5.5 h-5.5 flex-shrink-0 transition-transform duration-300 ${
                settlementViewTab === 'current' ? 'scale-105' : 'group-hover:scale-110'
              }`} />
              
              {settlementViewTab === 'current' && (
                <span className="whitespace-nowrap animate-in fade-in slide-in-from-right-2 duration-200 flex items-center gap-2">
                  <span>{t('tabCurrentFinancials')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-white/25 text-white shadow-xs">
                    {currentActiveRows.length}
                  </span>
                </span>
              )}
            </button>

            {/* Tab 2: Settled History (تب تسویه شده) */}
            <button
              type="button"
              onClick={() => setSettlementViewTab('settled')}
              title={t('tabSettledFinancials')}
              aria-label={t('tabSettledFinancials')}
              className={`group relative flex items-center justify-center gap-2 rounded-xl transition-all duration-300 ease-out text-xs font-bold ${
                settlementViewTab === 'settled'
                  ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/35 border border-sky-400/30 py-2.5 px-4 scale-102 flex-none'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08] p-2.5'
              }`}
            >
              <CheckCircle2 className={`w-5.5 h-5.5 flex-shrink-0 transition-transform duration-300 ${
                settlementViewTab === 'settled' ? 'scale-105' : 'group-hover:scale-110'
              }`} />
              
              {settlementViewTab === 'settled' && (
                <span className="whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-200 flex items-center gap-2">
                  <span>{t('tabSettledFinancials')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-white/25 text-white shadow-xs">
                    {settledHistoryRows.length}
                  </span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Line 2 on mobile: Status Filters & Search Controls (Centered, Not Full Width) */}
        <div className="flex items-center justify-center flex-wrap gap-2 w-full md:w-auto">
          {/* Status Filter (Only in Current Tab: All, Pending Due, Overpaid) */}
          {settlementViewTab === 'current' && (
            <div className="inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
              {[
                { id: 'all', title: t('filterAll') || 'همه پرسنل معوقه', icon: Users, count: statusCounts.all },
                { id: 'pending', title: t('filterPending') || 'دارای معوقه (طلبکار)', icon: Coins, count: statusCounts.pending },
                { id: 'overpaid', title: t('filterOverpaid') || 'بدهکار به کارگاه', icon: Banknote, count: statusCounts.overpaid }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    title={tab.title}
                    aria-label={tab.title}
                    className={`group relative flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 ease-out ${
                      isSelected
                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/35 border border-sky-400/30 scale-105'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : 'bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Expandable Search Input / Button with smooth animation */}
          <div className="relative flex items-center">
            {!(isSearchOpen || searchTerm) ? (
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 150);
                }}
                title={t('searchWorkerPlaceholder') || 'جستجو بر اساس نام یا مهارت...'}
                aria-label={t('searchWorkerPlaceholder') || 'جستجو'}
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/70 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-inner transition-all duration-200"
              >
                <Search className="w-5 h-5 flex-shrink-0 transition-transform hover:scale-110" />
              </button>
            ) : (
              <div className="relative flex items-center transition-all duration-300 ease-out w-48 sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute start-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onBlur={() => {
                    if (!searchTerm.trim()) {
                      setIsSearchOpen(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchTerm('');
                      setIsSearchOpen(false);
                    }
                  }}
                  placeholder={t('searchWorkerPlaceholder')}
                  className="w-full ps-9 pe-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-sky-400/50 dark:border-sky-500/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white shadow-xs transition-all"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchTerm('');
                    setIsSearchOpen(false);
                  }}
                  title="بستن جستجو"
                  className="absolute end-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Main Table: Either Current Tab OR Settled Tab */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* Table Header Banner */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${settlementViewTab === 'current' ? 'bg-sky-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {settlementViewTab === 'current'
                  ? t('tableCurrentTitle')
                  : t('tableSettledTitle')}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {settlementViewTab === 'current'
                ? t('tableCurrentSubtitle')
                : t('tableSettledSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {displayedRows.length} {t('workers')}
            </span>
          </div>
        </div>

        {/* Empty State */}
        {displayedRows.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-sm">
            {settlementViewTab === 'current'
              ? t('emptyCurrentWorkers')
              : t('emptySettledWorkers')}
          </div>
        ) : settlementViewTab === 'current' ? (
          /* TAB 1: CURRENT ACTIVE PERSONNEL (UNSETTLED ONLY) */
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px] leading-snug">
                <tr>
                  {/* 1. Worker Name */}
                  <th className="px-3 py-3 text-start whitespace-nowrap">
                    {t('colWorker')}
                  </th>

                  {/* 2. Unsettled Work (Days + OT) */}
                  <th className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="font-bold">{t('colCurrentWork')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t('colOpenDaysOT')}</div>
                  </th>

                  {/* 3. Daily Rate */}
                  <th className="px-3 py-3 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colDailyWage')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 4. Unsettled Gross */}
                  <th className="px-3 py-3 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colCurrentGross')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 5. Unsettled Advances */}
                  <th className="px-3 py-3 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colOpenAdvanceDeducted')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 6. Net Balance Due */}
                  <th className="px-3 py-3 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colNetBalanceDue')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 7. Status */}
                  <th className="px-3 py-3 text-center whitespace-nowrap">
                    {t('colStatus')}
                  </th>

                  {/* 8. Actions */}
                  <th className="px-3 py-3 text-center whitespace-nowrap">
                    {t('colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedCurrentRows.map((row) => {
                  const isSettled = row.status === 'settled';
                  const isPending = row.status === 'pending';
                  const isOverpaid = row.status === 'overpaid';

                  return (
                    <tr 
                      key={row.worker.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Worker Name & Role */}
                      <td className="px-3 py-3 text-start font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" title="نیروی فعال"></span>
                          <div>
                            <span className="block font-black">{row.worker.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal block">
                              {row.worker.role || 'نیرو'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Unsettled Days & OT */}
                      <td className="px-3 py-3 text-center font-mono whitespace-nowrap">
                        {row.effectiveDays > 0 || row.otHours > 0 ? (
                          <>
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {row.effectiveDays} {t('daysCountUnit')}
                            </span>
                            {row.otHours > 0 && (
                              <span className="text-[10px] text-sky-600 dark:text-sky-400 block font-semibold">
                                +{formatHoursAndMinutes(row.otHours, language)}
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-normal">
                              ({row.fullDays} کامل{row.halfDays > 0 ? ` + ${row.halfDays} نیمه` : ''})
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-normal">{language === 'fa' ? 'بدون کارکرد باز' : language === 'ku' ? 'بێ کارکردی کراوە' : 'No open work'}</span>
                        )}
                      </td>

                      {/* 3. Daily Rate */}
                      <td className="px-3 py-3 text-end font-mono whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {formatAmount(row.worker.dailyRate, currency)}
                      </td>

                      {/* 4. Unsettled Gross */}
                      <td className="px-3 py-3 text-end font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {formatAmount(row.unsettledGross, currency)}
                      </td>

                      {/* 5. Unsettled Advances */}
                      <td className="px-3 py-3 text-end text-amber-600 dark:text-amber-400 font-bold font-mono whitespace-nowrap">
                        {row.unsettledAdvances > 0 ? formatAmount(row.unsettledAdvances, currency) : '—'}
                      </td>

                      {/* 6. Net Balance Due */}
                      <td className="px-3 py-3 text-end font-mono whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-block ${
                          row.netBalanceDue === 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : row.netBalanceDue < 0
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                        }`}>
                          {row.netBalanceDue === 0
                            ? (language === 'fa' ? 'تسویه (۰)' : language === 'ku' ? 'تەسویە (٠)' : 'Settled (0)')
                            : row.netBalanceDue < 0
                            ? `${formatAmount(Math.abs(row.netBalanceDue), currency)} (${language === 'fa' ? 'بدهکار' : language === 'ku' ? 'قەرزدار' : 'Debtor'})`
                            : `${formatAmount(row.netBalanceDue, currency)} (${language === 'fa' ? 'مانده طلب' : language === 'ku' ? 'ماوەی داواکراو' : 'Credit Due'})`}
                        </span>
                      </td>

                      {/* 7. Status */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t('settledStatusBadge')}</span>
                          </span>
                        ) : isOverpaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                            <AlertCircle className="w-3 h-3" />
                            <span>{t('overpaid')}</span>
                          </span>
                        ) : row.netBalanceDue > 0 || row.effectiveDays > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>{language === 'fa' ? 'در انتظار تسویه' : language === 'ku' ? 'چاوەڕوانی تەسویە' : 'Pending Settlement'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">{language === 'fa' ? 'بدون بدهی' : language === 'ku' ? 'بێ قەرز' : 'Zero Balance'}</span>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Settle Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSettlementTargetWorker(row.worker);
                              setSettlementInitialMode(row.worker.teamRole === 'Master' && row.worker.groupId ? 'group' : 'individual');
                              setSettlementInitialGroupId(row.worker.groupId || null);
                              setIsSettlementModalOpen(true);
                            }}
                            className={`px-2.5 py-1.5 text-white rounded-xl font-bold text-[11px] shadow-xs transition-all flex items-center gap-1 active:scale-95 ${
                              row.worker.teamRole === 'Master' && row.worker.groupId
                                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                            }`}
                            title={row.worker.teamRole === 'Master' && row.worker.groupId ? (language === 'fa' ? 'تسویه گروهی با سرپرست' : language === 'ku' ? 'تەسویەی گشتی لەگەڵ سەرپەرشتیار' : 'Group Settlement') : t('settleBtn')}
                          >
                            {row.worker.teamRole === 'Master' && row.worker.groupId ? (
                              <Crown className="w-3.5 h-3.5 text-amber-200" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>{row.worker.teamRole === 'Master' && row.worker.groupId ? (language === 'fa' ? 'تسویه گروهی' : language === 'ku' ? 'تەسویەی گروپ' : 'Group Settle') : t('settleBtn')}</span>
                          </button>

                          {/* Add Advance Button */}
                          <button
                            type="button"
                            onClick={() => setAdvanceTargetWorker(row.worker)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-[11px] transition-colors flex items-center gap-1"
                            title={t('addAdvanceBtn')}
                          >
                            <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
                            <span>{t('advanceType')}</span>
                          </button>

                          {/* Profile History Button */}
                          <button
                            type="button"
                            onClick={() => setHistoryTargetWorker(row.worker)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                            title={language === 'fa' ? 'پروفایل و پرونده مالی' : language === 'ku' ? 'پڕۆفایلی دارایی' : 'Financial Profile'}
                          >
                            <Receipt className="w-4 h-4 text-sky-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: SETTLED PERSONNEL ARCHIVE (ALL PERSONNEL, SETTLED PORTION ONLY) */
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px] leading-snug">
                <tr>
                  {/* 1. Worker Name & Status */}
                  <th className="px-3 py-3 text-start whitespace-nowrap">
                    {t('colWorker')}
                  </th>

                  {/* 2. Total Settled Work */}
                  <th className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="font-bold">{t('colSettledWork')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{language === 'fa' ? 'روزهای تسویه شده / اضافه‌کار' : language === 'ku' ? 'ڕۆژانی یەکلاکراوە / ئۆڤەرتایم' : 'Settled Days / OT'}</div>
                  </th>

                  {/* 3. Settled Gross Earnings */}
                  <th className="px-3 py-3 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colSettledGross')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 4. Settled Advances Deducted */}
                  <th className="px-3 py-3 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colSettledAdvances')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 5. Total Settlement Amount Paid */}
                  <th className="px-3 py-3 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colTotalSettlementPaid')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({getCurrencySymbol(currency, language)})</div>
                  </th>

                  {/* 6. Last Settlement Date & Count */}
                  <th className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="font-bold">{t('colLastSettlementReceipts')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t('receiptDocsCount')}</div>
                  </th>

                  {/* 7. Status */}
                  <th className="px-3 py-3 text-center whitespace-nowrap">
                    {t('colStatus')}
                  </th>

                  {/* 8. Actions */}
                  <th className="px-3 py-3 text-center whitespace-nowrap">
                    {t('colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedSettledRows.map((row) => {
                  return (
                    <tr 
                      key={row.worker.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Worker Name, Role & Active Badge */}
                      <td className="px-3 py-3 text-start font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${row.worker.isActive === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black">{row.worker.name}</span>
                              <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                                row.worker.isActive === 1
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              }`}>
                                {row.worker.isActive === 1 ? t('activeBadge') : t('inactiveBadge')}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                              {row.worker.role || (language === 'fa' ? 'نیرو' : 'Staff')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Total Settled Work (Days / Overtime) */}
                      <td className="px-3 py-3 text-center font-mono whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {row.effectiveDays} {t('daysCountUnit')}
                        </span>
                        {row.otHours > 0 && (
                          <span className="text-[10px] text-sky-600 dark:text-sky-400 block font-semibold">
                            +{formatHoursAndMinutes(row.otHours, language)}
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-normal">
                          ({row.fullDays} {t('normalDays')}{row.halfDays > 0 ? ` + ${row.halfDays} ${t('halfDays')}` : ''})
                        </span>
                      </td>

                      {/* 3. Settled Gross Earnings */}
                      <td className="px-3 py-3 text-end font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {formatAmount(row.settledGross, currency)}
                      </td>

                      {/* 4. Settled Advances Deducted */}
                      <td className="px-3 py-3 text-end text-amber-600 dark:text-amber-400 font-bold font-mono whitespace-nowrap">
                        {row.settledAdvances > 0 ? formatAmount(row.settledAdvances, currency) : '—'}
                      </td>

                      {/* 5. Total Settlement Paid */}
                      <td className="px-3 py-3 text-end text-emerald-600 dark:text-emerald-400 font-extrabold font-mono whitespace-nowrap">
                        {formatAmount(row.totalSettlementPaid, currency)}
                      </td>

                      {/* 6. Last Settlement Date & Documents Count */}
                      <td className="px-3 py-3 text-center font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {row.lastSettlementDate || '—'}
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {row.settlementsCount} {t('receiptCountSuffix')}
                        </span>
                      </td>

                      {/* 7. Settled Status */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t('settledFinalBadge')}</span>
                        </span>
                      </td>

                      {/* 8. Actions */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setHistoryTargetWorker(row.worker)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-[11px] transition-colors inline-flex items-center gap-1.5"
                          title={language === 'fa' ? 'مشاهده اسناد تسویه و ریز سوابق' : language === 'ku' ? 'بینینی بەڵگەنامەکانی تەسویە' : 'View Settlement Receipts'}
                        >
                          <Receipt className="w-3.5 h-3.5 text-sky-500" />
                          <span>{t('viewSettlementReceipts')}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footnote */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span>{currency === 'IQD' ? t('allAmountsInIQDNote') : `* ${t('currency')}: ${currency} (${getCurrencySymbol(currency, language)})`}</span>
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            {settlementViewTab === 'current'
              ? t('footnoteCurrentBasis')
              : t('footnoteSettledBasis')}
          </span>
        </div>

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
            {/* Segmented Status Tabs (Navbar / Liquid Dock style) */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
              {[
                { 
                  id: 'active', 
                  title: t('activeTransactions') || 'تراکنش‌های جاری', 
                  icon: Receipt, 
                  count: activePayments.length 
                },
                { 
                  id: 'archived', 
                  title: t('archivedTransactions') || 'تراکنش‌های بایگانی‌شده', 
                  icon: Archive, 
                  count: archivedPayments.length 
                },
                { 
                  id: 'trash', 
                  title: t('trashTransactions') || 'تراکنش‌های حذف‌شده', 
                  icon: Trash2, 
                  count: trashPayments.length 
                }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = transactionTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTransactionTab(tab.id)}
                    title={tab.title}
                    aria-label={tab.title}
                    className={`group relative flex items-center justify-center gap-2 rounded-xl transition-all duration-300 ease-out text-xs font-bold ${
                      isSelected
                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/35 border border-sky-400/30 py-2 px-3.5 scale-102'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08] p-2'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
                      isSelected ? 'scale-105' : 'group-hover:scale-110'
                    }`} />
                    {isSelected && (
                      <span className="whitespace-nowrap animate-in fade-in slide-in-from-right-2 duration-200 flex items-center gap-1.5">
                        <span>{tab.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-white/25 text-white shadow-xs">
                          {tab.count}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
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
      {isSettlementModalOpen && (
        <SettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => {
            setIsSettlementModalOpen(false);
            setSettlementTargetWorker(null);
          }}
          worker={settlementTargetWorker}
          month={selectedMonth}
          workerLogs={settlementTargetWorker ? allLogs.filter((l) => String(l.workerId) === String(settlementTargetWorker.id)) : []}
          workerPayments={settlementTargetWorker ? allPayments.filter((p) => String(p.workerId) === String(settlementTargetWorker.id)) : []}
          allWorkers={workers}
          allGroups={groups}
          allLogs={allLogs}
          allPayments={allPayments}
          initialMode={settlementInitialMode}
          initialGroupId={settlementInitialGroupId}
          onSettlementComplete={(record) => {
            // Refreshes live via Dexie liveQuery
          }}
          arrearsList={workerFinancials.filter((w) => w.netBalanceDue !== 0)}
          onSelectWorker={(w) => {
            setSettlementTargetWorker(w);
            setSettlementInitialMode(w.teamRole === 'Master' && w.groupId ? 'group' : 'individual');
            setSettlementInitialGroupId(w.groupId || null);
          }}
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
