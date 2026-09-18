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
import { 
  WalletCards, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Coins, 
  Banknote, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Receipt, 
  PlusCircle, 
  UserCheck, 
  Printer, 
  TrendingUp, 
  ArrowUpRight 
} from 'lucide-react';

export function FinancialsView() {
  const { t, language, direction } = useLanguage();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  const [isAllTime, setIsAllTime] = useState(false);
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

  // Filter logs & payments by current month or all-time
  const filteredLogs = useMemo(() => {
    if (isAllTime) return allLogs;
    return allLogs.filter((l) => l.date && l.date.startsWith(selectedMonth));
  }, [allLogs, selectedMonth, isAllTime]);

  const filteredPayments = useMemo(() => {
    if (isAllTime) return allPayments;
    return allPayments.filter((p) => p.month === selectedMonth);
  }, [allPayments, selectedMonth, isAllTime]);

  // Compute worker financial summaries with cumulative prior debt
  const workerFinancials = useMemo(() => {
    return workers.map((w) => {
      const allWorkerLogs = allLogs.filter((l) => l.workerId === w.id);
      const allWorkerPayments = allPayments.filter((p) => p.workerId === w.id);

      // 1. Current Month (or All Time) Logs
      const wLogs = isAllTime 
        ? allWorkerLogs 
        : allWorkerLogs.filter((l) => l.date && l.date.startsWith(selectedMonth));
      
      let fullDays = 0;
      let halfDays = 0;
      let hourlyDays = 0;
      let otHours = 0;
      let grossEarnings = 0;

      wLogs.forEach((l) => {
        if (l.type === 'full') fullDays++;
        else if (l.type === 'half') halfDays++;
        else if (l.type === 'hourly') hourlyDays++;

        otHours += Number(l.overtimeHours) || 0;
        grossEarnings += Number(l.totalDayPay) || 0;
      });

      const effectiveDays = fullDays + halfDays * 0.5;

      // 2. Current Month Payments
      const wPayments = isAllTime
        ? allWorkerPayments
        : allWorkerPayments.filter((p) => p.month === selectedMonth || (!p.month && p.date && p.date.startsWith(selectedMonth)));

      const totalAdvances = wPayments
        .filter((p) => p.type === 'advance')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const totalSettlements = wPayments
        .filter((p) => p.type === 'settlement')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const totalPaidThisMonth = totalAdvances + totalSettlements;

      // 3. Prior Months Unpaid Debt (before selectedMonth)
      const priorLogs = isAllTime 
        ? [] 
        : allWorkerLogs.filter((l) => l.date && l.date < selectedMonth);
      const priorPayments = isAllTime 
        ? [] 
        : allWorkerPayments.filter((p) => (p.month && p.month < selectedMonth) || (!p.month && p.date && p.date < selectedMonth));

      const priorGross = priorLogs.reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0);
      const priorPaid = priorPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const priorBalance = priorGross - priorPaid; // > 0: unpaid debt from previous months

      // 4. Cumulative All-Time Totals
      const totalAllTimeGross = isAllTime ? grossEarnings : (priorGross + grossEarnings);
      const totalAllTimePaid = isAllTime ? totalPaidThisMonth : (priorPaid + totalPaidThisMonth);
      const totalCumulativeDebt = totalAllTimeGross - totalAllTimePaid;

      // Status
      const hasSettledRecord = wPayments.some((p) => p.type === 'settlement' && p.status === 'settled');
      
      let status = 'pending';
      if (totalAllTimeGross === 0 && totalAllTimePaid === 0) {
        status = 'no_activity';
      } else if (hasSettledRecord || (totalCumulativeDebt <= 0 && totalAllTimeGross > 0)) {
        status = 'settled';
      } else if (totalCumulativeDebt < 0) {
        status = 'overpaid';
      } else {
        status = 'pending';
      }

      return {
        worker: w,
        fullDays,
        halfDays,
        hourlyDays,
        effectiveDays,
        otHours,
        grossEarnings,
        totalAdvances,
        totalSettlements,
        totalPaid: totalPaidThisMonth,
        priorBalance,
        totalCumulativeDebt,
        netBalance: totalCumulativeDebt,
        status,
        hasSettledRecord,
        wLogs,
        wPayments
      };
    });
  }, [workers, allLogs, allPayments, selectedMonth, isAllTime]);

  // Aggregate KPI metrics
  const aggregateMetrics = useMemo(() => {
    let totalGross = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let settledCount = 0;
    let activeWorkersCount = 0;

    workerFinancials.forEach((item) => {
      if (item.worker.isActive === 1) {
        activeWorkersCount++;
        totalGross += item.grossEarnings;
        totalPaid += item.totalPaid;
        if (item.totalCumulativeDebt > 0) {
          totalOutstanding += item.totalCumulativeDebt;
        }
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
      activeWorkersCount
    };
  }, [workerFinancials]);

  // Filtered workers for table
  const displayedRows = useMemo(() => {
    return workerFinancials.filter((item) => {
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
      return true;
    });
  }, [workerFinancials, searchTerm, statusFilter]);

  // Month navigation helpers
  const handleShiftMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
    setIsAllTime(false);
  };

  return (
    <div className="space-y-6 pb-20 no-print" dir={direction}>
      
      {/* Top Header & Month Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <WalletCards className="w-6 h-6 text-sky-500" />
            <span>{t('financialDashboard')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('financialDashboardSubtitle')}
          </p>
        </div>

        {/* Controls & Quick Action */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Month Shifter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleShiftMonth(direction === 'rtl' ? 1 : -1)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title="Previous Month"
            >
              {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setIsAllTime(false);
              }}
              className="bg-transparent text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 px-2 py-1 focus:outline-none cursor-pointer font-mono"
            />

            <button
              onClick={() => handleShiftMonth(direction === 'rtl' ? -1 : 1)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title="Next Month"
            >
              {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Record Advance Button */}
          <button
            type="button"
            onClick={() => setIsGlobalAdvanceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-2xl shadow-md shadow-amber-600/20 transition-all active:scale-95"
          >
            <Banknote className="w-4 h-4" />
            <span>{t('addAdvanceBtn')}</span>
          </button>

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
            <span className="text-xs text-slate-400 ms-1 font-bold">دینار</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            مجموع ناخالص حقوق پرسنل در {selectedMonth}
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
            <span className="text-xs text-slate-400 ms-1 font-bold">دینار</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <span>واریز شده به حساب نیروها</span>
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
            <span className="text-xs text-slate-400 ms-1 font-bold">دینار</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            مبلغ کل باقیمانده جهت تسویه کامل
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
              {aggregateMetrics.settledCount} <span className="text-lg font-bold text-indigo-200">/ {aggregateMetrics.activeWorkersCount}</span>
            </span>
          </div>
          <div className="mt-2 text-[11px] text-indigo-200 font-semibold">
            {aggregateMetrics.settledCount === aggregateMetrics.activeWorkersCount && aggregateMetrics.activeWorkersCount > 0
              ? 'تمامی پرسنل تسویه شده‌اند'
              : `${aggregateMetrics.activeWorkersCount - aggregateMetrics.settledCount} کارگر در انتظار تسویه`}
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
            placeholder="جستجوی کارگر بر اساس نام یا نقش..."
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

      {/* Main Financial Overview Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              صورت‌حساب و وضعیت مالی پرسنل
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedMonth} • {displayedRows.length} کارگر
            </p>
          </div>
        </div>

        {displayedRows.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-sm">
            هیچ کارگری با این فیلتر یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-start">{t('workerName')}</th>
                  <th className="px-4 py-3 text-start">{t('workerRole')}</th>
                  <th className="px-4 py-3 text-center">کارکرد (روز / اضافه)</th>
                  <th className="px-4 py-3 text-end">{t('totalCalculatedPayroll')} (دینار)</th>
                  <th className="px-4 py-3 text-end">{t('totalPaidAdvances')} (دینار)</th>
                  <th className="px-4 py-3 text-end">{t('netBalanceDue')} (دینار)</th>
                  <th className="px-4 py-3 text-center">{t('settlementStatus')}</th>
                  <th className="px-4 py-3 text-center">عملیات مالی</th>
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
                        row.worker.isActive === 0 ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3.5 text-start font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${row.worker.isActive === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <span>{row.worker.name}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5 text-start text-slate-500 dark:text-slate-400">
                        {row.worker.role}
                      </td>

                      {/* Attendance breakdown */}
                      <td className="px-4 py-3.5 text-center font-mono">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {row.effectiveDays} روز
                        </span>
                        {row.otHours > 0 && (
                          <span className="text-[11px] text-amber-500 block font-semibold">
                            +{formatHoursAndMinutes(row.otHours)}
                          </span>
                        )}
                      </td>

                      {/* Gross Earnings */}
                      <td className="px-4 py-3.5 text-end font-bold text-slate-900 dark:text-white font-mono">
                        {formatAmount(row.grossEarnings)}
                      </td>

                      {/* Advances Paid */}
                      <td className="px-4 py-3.5 text-end text-amber-600 dark:text-amber-400 font-bold font-mono">
                        {row.totalPaid > 0 ? formatAmount(row.totalPaid) : '-'}
                      </td>

                      {/* Net Balance Due (Total Cumulative Debt) */}
                      <td className="px-4 py-3.5 text-end font-mono">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-block ${
                          isSettled
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : isOverpaid
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          {isSettled && row.totalCumulativeDebt <= 0
                            ? '۰ (تسویه کامل)'
                            : formatAmount(row.totalCumulativeDebt)}
                        </span>
                        {row.priorBalance > 0 && !isSettled && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-normal mt-0.5">
                            (+{formatAmount(row.priorBalance)} معوقه قبلی)
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t('settled')}</span>
                          </span>
                        ) : isOverpaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                            <AlertCircle className="w-3 h-3" />
                            <span>{t('overpaid')}</span>
                          </span>
                        ) : row.grossEarnings > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>{t('hasBalance')}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">بدون کارکرد</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Settle Button */}
                          <button
                            type="button"
                            onClick={() => setSettlementTargetWorker(row.worker)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[11px] shadow-xs transition-all flex items-center gap-1"
                            title={t('settleBtn')}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t('settleBtn')}</span>
                          </button>

                          {/* Add Advance Button */}
                          <button
                            type="button"
                            onClick={() => setAdvanceTargetWorker(row.worker)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-[11px] transition-colors flex items-center gap-1"
                            title={t('addAdvanceBtn')}
                          >
                            <PlusCircle className="w-3 h-3 text-amber-500" />
                            <span>{t('addAdvanceBtn')}</span>
                          </button>

                          {/* History Button */}
                          <button
                            type="button"
                            onClick={() => setHistoryTargetWorker(row.worker)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
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
            // Can trigger a refresh or toast
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
          month={selectedMonth}
        />
      )}

    </div>
  );
}
