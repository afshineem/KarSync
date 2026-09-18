import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  formatAmount, 
  formatHoursAndMinutes, 
  getCurrentYearMonth, 
  getTodayDateString 
} from '../utils/formatters';
import { SettlementModal } from './SettlementModal';
import { AdvancePaymentModal } from './AdvancePaymentModal';
import { PaymentHistoryModal } from './PaymentHistoryModal';
import { fullSyncBothDirections } from '../services/realtimeSync';
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
  Users,
  RefreshCw
} from 'lucide-react';

export function FinancialsView() {
  const { t, language, direction } = useLanguage();
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // Filter mode: 'monthly' | 'range'
  const [filterMode, setFilterMode] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
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

  // Live queries from IndexedDB
  const workers = useLiveQuery(() => db.workers.toArray(), []) || [];
  const allLogs = useLiveQuery(() => db.attendanceLogs.toArray(), []) || [];
  const allPayments = useLiveQuery(() => db.payments.toArray(), []) || [];

  // Compute worker financial summaries with cumulative prior debt & FIFO settlement status
  const workerFinancials = useMemo(() => {
    return workers.map((w) => {
      const allWorkerLogs = allLogs.filter((l) => l.workerId === w.id);
      const allWorkerPayments = allPayments.filter((p) => p.workerId === w.id);

      // Total All-Time Gross & Paid across entire database history
      const totalAllTimeGross = allWorkerLogs.reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0);
      const totalAllTimePaid = allWorkerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const netBalanceDue = Math.max(0, totalAllTimeGross - totalAllTimePaid);

      // Determine period boundaries
      let currentLogs = [];
      let priorLogs = [];
      let currentPayments = [];
      let priorPayments = [];
      let periodEndDate = '';

      if (filterMode === 'monthly') {
        periodEndDate = `${selectedMonth}-31`;
        currentLogs = allWorkerLogs.filter((l) => l.date && l.date.startsWith(selectedMonth));
        priorLogs = allWorkerLogs.filter((l) => l.date && l.date < selectedMonth);
        currentPayments = allWorkerPayments.filter((p) => p.month === selectedMonth || (!p.month && p.date && p.date.startsWith(selectedMonth)));
        priorPayments = allWorkerPayments.filter((p) => (p.month && p.month < selectedMonth) || (!p.month && p.date && p.date < selectedMonth));
      } else {
        // Date range mode
        periodEndDate = toDate;
        currentLogs = allWorkerLogs.filter((l) => l.date && l.date >= fromDate && l.date <= toDate);
        priorLogs = allWorkerLogs.filter((l) => l.date && l.date < fromDate);
        currentPayments = allWorkerPayments.filter((p) => {
          if (p.date) return p.date >= fromDate && p.date <= toDate;
          if (p.month) return p.month >= fromDate.slice(0, 7) && p.month <= toDate.slice(0, 7);
          return false;
        });
        priorPayments = allWorkerPayments.filter((p) => {
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
        grossEarnings += Number(l.totalDayPay) || 0;
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
        priorGross += Number(l.totalDayPay) || 0;
      });

      const priorEffectiveDays = priorFullDays + priorHalfDays * 0.5;
      const priorPaid = priorPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const priorBalance = Math.max(0, priorGross - priorPaid);

      // 3. Current Period Payments
      const totalAdvances = currentPayments
        .filter((p) => p.type === 'advance')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const totalSettlements = currentPayments
        .filter((p) => p.type === 'settlement')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const totalPaidPeriod = totalAdvances + totalSettlements;

      // 4. Gross cumulative earnings up to this inspected period
      const grossUpToPeriod = allWorkerLogs
        .filter((l) => l.date && l.date <= periodEndDate)
        .reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0);

      // 5. FIFO Cumulative Settlement Status
      // If the worker's cumulative payments to date cover all gross wages earned up to this period,
      // this period is fully settled (even if the settlement was processed in a subsequent month)!
      let status = 'pending';
      if (totalAllTimeGross === 0 && totalAllTimePaid === 0) {
        status = 'no_activity';
      } else if (netBalanceDue === 0 && totalAllTimeGross > 0) {
        status = 'settled';
      } else if (totalAllTimePaid >= grossUpToPeriod && grossUpToPeriod > 0) {
        status = 'settled';
      } else if (totalAllTimePaid > totalAllTimeGross) {
        status = 'overpaid';
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
        grossEarnings,
        priorFullDays,
        priorHalfDays,
        priorEffectiveDays,
        priorOtHours,
        priorGross,
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
  }, [workers, allLogs, allPayments, filterMode, selectedMonth, fromDate, toDate]);

  // Aggregate KPI metrics (Includes all workers with activity/debt, even if inactive, per user requirement 2.1)
  const aggregateMetrics = useMemo(() => {
    let totalGross = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let settledCount = 0;
    let relevantWorkersCount = 0;

    workerFinancials.forEach((item) => {
      // Check if this worker should be included in worker dropdown filter
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
      totalGross,
      totalPaid,
      totalOutstanding,
      settledCount,
      relevantWorkersCount: relevantWorkersCount || workers.filter((w) => w.isActive === 1).length
    };
  }, [workerFinancials, selectedWorkerId, workers]);

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

  const handleQuickSync = async () => {
    setIsSyncingLive(true);
    try {
      await fullSyncBothDirections();
      setSyncStatusMsg(language === 'en' ? 'Synced!' : language === 'ku' ? 'هاوکاتکرا!' : 'سینک شد!');
      setTimeout(() => setSyncStatusMsg(''), 2500);
    } catch (err) {
      console.warn('Manual sync failed:', err);
    } finally {
      setIsSyncingLive(false);
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

          {/* Quick Actions: Sync + Add Advance Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickSync}
              disabled={isSyncingLive}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs transition-all active:scale-95 disabled:opacity-50"
              title={language === 'en' ? 'Sync now with Cloud' : language === 'ku' ? 'هاوکاتکردنی خێرا لەگەڵ هەور' : 'سینک فوری با سرور ابری'}
            >
              <RefreshCw className={`w-4 h-4 text-sky-500 ${isSyncingLive ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {syncStatusMsg || (isSyncingLive ? (language === 'en' ? 'Syncing...' : language === 'ku' ? 'هاوکات دەکرێت...' : 'در حال سینک...') : (language === 'en' ? 'Cloud Sync' : language === 'ku' ? 'سینکی هەور' : 'سینک ابری'))}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsGlobalAdvanceModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-2xl shadow-md shadow-amber-600/20 transition-all active:scale-95"
            >
              <Banknote className="w-4 h-4" />
              <span>{t('addAdvanceBtn')}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Mode Switcher: Monthly vs Date Range */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFilterMode('monthly')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterMode === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('filterModeMonthly')}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('range')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterMode === 'range'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('filterModeDateRange')}
              </button>
            </div>

            {/* Date Selector based on mode */}
            {filterMode === 'monthly' ? (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(direction === 'rtl' ? 1 : -1)}
                  className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                  title="Previous Month"
                >
                  {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 px-2 py-0.5 focus:outline-none cursor-pointer font-mono"
                />

                <button
                  type="button"
                  onClick={() => handleShiftMonth(direction === 'rtl' ? -1 : 1)}
                  className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                  title="Next Month"
                >
                  {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 px-3 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400">{t('fromDateLabel')}</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400">{t('toDateLabel')}</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Worker Selector Dropdown */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 px-3 border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
            <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {t('selectWorkerLabel')}
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer flex-1 sm:w-48"
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
              {formatAmount(aggregateMetrics.totalGross)}
            </span>
            <span className="text-xs text-slate-400 ms-1 font-bold">{t('currencySymbol')}</span>
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
              {formatAmount(aggregateMetrics.totalPaid)}
            </span>
            <span className="text-xs text-slate-400 ms-1 font-bold">{t('currencySymbol')}</span>
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
              {formatAmount(aggregateMetrics.totalOutstanding)}
            </span>
            <span className="text-xs text-slate-400 ms-1 font-bold">{t('currencySymbol')}</span>
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

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchWorkerPlaceholder')}
            className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('filterAll')}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{t('filterPending')}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('settled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === 'settled'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{t('filterSettled')}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('overpaid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === 'overpaid'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            <span>{t('filterOverpaid')}</span>
          </button>
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
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({t('currencySymbol')})</div>
                  </th>

                  {/* 5. Prior Months Arrears */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colPriorGross')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({t('currencySymbol')})</div>
                  </th>

                  {/* 6. Total Combined Gross */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colTotalGross')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({t('currencySymbol')})</div>
                  </th>

                  {/* 7. Total Paid */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colTotalPaid')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t('colTotalPaidSub')}</div>
                  </th>

                  {/* 8. Net Balance Due */}
                  <th className="px-2.5 py-2 text-end whitespace-nowrap">
                    <div className="font-bold">{t('colNetBalance')}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">({t('currencySymbol')})</div>
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
                        {formatAmount(row.grossEarnings)}
                      </td>

                      {/* 5. Prior Months Gross Arrears */}
                      <td className="px-2.5 py-2.5 text-end font-mono whitespace-nowrap text-amber-600 dark:text-amber-400 font-semibold">
                        {row.priorGross > 0 ? formatAmount(row.priorGross) : '—'}
                      </td>

                      {/* 6. Total Combined Gross Earnings */}
                      <td className="px-2.5 py-2.5 text-end font-extrabold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {formatAmount(row.totalAllTimeGross)}
                      </td>

                      {/* 7. Total Paid (Advances + Settlements) */}
                      <td className="px-2.5 py-2.5 text-end text-emerald-600 dark:text-emerald-400 font-bold font-mono whitespace-nowrap">
                        {row.totalAllTimePaid > 0 ? formatAmount(row.totalAllTimePaid) : '—'}
                      </td>

                      {/* 8. Net Balance Due (To Settle) */}
                      <td className="px-2.5 py-2.5 text-end font-mono whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-xl text-xs font-black inline-block ${
                          isSettled
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : isOverpaid
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          {isSettled && row.netBalanceDue <= 0
                            ? t('fullySettledZero')
                            : formatAmount(row.netBalanceDue)}
                        </span>
                        {row.priorBalance > 0 && !isSettled && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-normal mt-0.5">
                            {t('priorArrearsSubtitle').replace('{amount}', formatAmount(row.priorBalance))}
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
              <span>{t('allAmountsInIQDNote')}</span>
            </div>
          </div>
        )}

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

      {/* Payment History & Ledger Modal */}
      {historyTargetWorker && (
        <PaymentHistoryModal
          isOpen={!!historyTargetWorker}
          onClose={() => setHistoryTargetWorker(null)}
          worker={historyTargetWorker}
          payments={allPayments.filter((p) => p.workerId === historyTargetWorker.id)}
          month={filterMode === 'monthly' ? selectedMonth : null}
        />
      )}

    </div>
  );
}
