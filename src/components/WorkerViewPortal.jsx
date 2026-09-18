import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatAmount, formatHoursAndMinutes, getCurrentYearMonth } from '../utils/formatters';
import { 
  User, 
  LogOut, 
  Calendar, 
  Clock, 
  Coins, 
  Briefcase, 
  Printer, 
  ChevronRight, 
  ChevronLeft, 
  Sun, 
  Moon, 
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  WalletCards,
  Banknote,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

export function WorkerViewPortal({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const { t, language, changeLanguage, direction } = useLanguage();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'

  // Query this worker's info from Dexie
  const worker = useLiveQuery(
    () => (user?.workerId ? db.workers.get(user.workerId) : null),
    [user?.workerId]
  );

  // Query only this worker's logs
  const logs = useLiveQuery(
    () => (user?.workerId ? db.attendanceLogs.where('workerId').equals(user.workerId).toArray() : []),
    [user?.workerId]
  ) || [];

  // Query only this worker's payments (advances and settlements)
  const payments = useLiveQuery(
    () => (user?.workerId ? db.payments.where('workerId').equals(user.workerId).toArray() : []),
    [user?.workerId]
  ) || [];

  // Filter logs by selected month
  const monthlyLogs = useMemo(() => {
    return logs
      .filter((l) => l.date && l.date.startsWith(selectedMonth))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, selectedMonth]);

  // Filter payments by selected month
  const monthlyPayments = useMemo(() => {
    return payments
      .filter((p) => p.month === selectedMonth || (p.date && p.date.startsWith(selectedMonth)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [payments, selectedMonth]);

  // Compute monthly totals for this worker
  const totals = useMemo(() => {
    let fullDays = 0;
    let halfDays = 0;
    let hourlyDays = 0;
    let totalOtHours = 0;
    let totalBasePay = 0;
    let totalOtPay = 0;
    let netSalary = 0;

    for (const l of monthlyLogs) {
      if (l.type === 'full') fullDays++;
      else if (l.type === 'half') halfDays++;
      else if (l.type === 'hourly') hourlyDays++;

      totalOtHours += Number(l.overtimeHours) || 0;
      totalBasePay += Number(l.calculatedDailyWage) || 0;
      totalOtPay += Number(l.calculatedOvertimeWage) || 0;
      netSalary += Number(l.totalDayPay) || 0;
    }

    const effectiveDays = fullDays + halfDays * 0.5;

    return {
      fullDays,
      halfDays,
      hourlyDays,
      effectiveDays,
      totalOtHours,
      totalBasePay,
      totalOtPay,
      netSalary
    };
  }, [monthlyLogs]);

  // Financial status & settlement calculation
  const financialStatus = useMemo(() => {
    const grossEarned = totals.netSalary;
    let advances = 0;
    let settlements = 0;
    let isMarkedSettled = false;

    for (const p of monthlyPayments) {
      const amt = Number(p.amount) || 0;
      if (p.type === 'advance') advances += amt;
      else if (p.type === 'settlement') {
        settlements += amt;
        if (p.status === 'settled') isMarkedSettled = true;
      }
    }

    const totalPaid = advances + settlements;
    const balance = grossEarned - totalPaid; // > 0: workshop owes worker, < 0: worker owes workshop, 0: exact
    const isSettled = isMarkedSettled || (grossEarned > 0 && balance === 0);

    return {
      grossEarned,
      advances,
      settlements,
      totalPaid,
      balance,
      isSettled
    };
  }, [totals.netSalary, monthlyPayments]);

  // Month navigation helpers
  const handleShiftMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  // Format Persian/Kurdish day of week
  const getDayName = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'en' ? 'en-US' : 'fa-IR', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200" dir={direction}>
      
      {/* Top Navigation Bar */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-3 no-print">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          
          {/* Logo & Worker Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 font-black">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {user?.name || worker?.name}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 text-[11px] font-bold">
                  {worker?.role || t('workerRole')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t('readOnlyNotice')}
              </p>
            </div>
          </div>

          {/* Right Controls: Theme, Language, Logout */}
          <div className="flex items-center gap-2">
            
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Language Switcher Mini */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold gap-0.5">
              <button
                onClick={() => changeLanguage('ku')}
                className={`px-2 py-1 rounded-lg transition-all ${language === 'ku' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
              >
                کو
              </button>
              <button
                onClick={() => changeLanguage('fa')}
                className={`px-2 py-1 rounded-lg transition-all ${language === 'fa' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
              >
                فا
              </button>
              <button
                onClick={() => changeLanguage('en')}
                className={`px-2 py-1 rounded-lg transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
              >
                EN
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-bold text-xs border border-red-200 dark:border-red-800/60 transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>

          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 pb-20">
        
        {/* Month Selector Bar & Print Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          
          {/* Month Switcher */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleShiftMonth(-1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-500" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-black text-base sm:text-lg text-slate-900 dark:text-white border-none focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleShiftMonth(1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all no-print"
          >
            <Printer className="w-4 h-4" />
            <span>{t('printMyPayslip')}</span>
          </button>

        </div>

        {/* 1. Settlement Status Banner (Dedicated Requirement #5) */}
        <div className={`p-5 rounded-3xl border transition-all ${
          financialStatus.isSettled
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
            : financialStatus.balance > 0
            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
            : financialStatus.balance < 0
            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
            : 'bg-slate-100/80 dark:bg-slate-900 border-slate-300 dark:border-slate-800'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                financialStatus.isSettled
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : financialStatus.balance > 0
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : financialStatus.balance < 0
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-slate-500 text-white'
              }`}>
                {financialStatus.isSettled ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {t('settlementStatus')}:{' '}
                    <span className={
                      financialStatus.isSettled 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : financialStatus.balance > 0 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-rose-600 dark:text-rose-400'
                    }>
                      {financialStatus.isSettled ? t('workerSettledStatus') : t('workerPendingStatus')}
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {financialStatus.isSettled
                    ? (language === 'ku' ? 'سەرجەم حەقدەست و مافە داراییەکانی ئەم مانگە بە تەواوی تەسویە کراوە.' : 'تمام حقوق و مطالبات مالی مربوط به این ماه به صورت کامل تسویه شده است.')
                    : financialStatus.balance > 0
                    ? (language === 'ku' ? 'هێشتا بڕە پارەیەک وەک مافی شایستەی ئەم مانگە ماوە و تەسویەی کۆتایی ئەنجام نەدراوە.' : 'مطالبات این ماه هنوز به صورت نهایی تسویه نشده و دارای مانده پرداخت است.')
                    : (language === 'ku' ? 'بڕی پێشەکییە وەرگیراوەکان لە کارکردی ئەم مانگە زیاترە.' : 'مجموع پیش‌پرداخت‌های دریافتی از کل کارکرد این ماه بیشتر است.')
                  }
                </p>
              </div>
            </div>

            {/* Transparent Balance Display */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-start sm:text-end">
              <span className="text-[11px] font-bold text-slate-400 block">
                {t('remainingBalanceIQD')}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5 justify-start sm:justify-end">
                <span className={`text-xl sm:text-2xl font-black font-mono ${
                  financialStatus.balance === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : financialStatus.balance > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatAmount(Math.abs(financialStatus.balance))}
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {financialStatus.balance === 0 
                    ? 'دینار (تسویه)' 
                    : financialStatus.balance > 0 
                    ? 'دینار (طلب شما)' 
                    : 'دینار (بدهکار)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Financial & Work Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Worked Days */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{t('totalMonthWorkedDays')}</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {totals.effectiveDays}
              </span>
              <span className="text-[11px] text-slate-400 ms-1 font-bold">
                ({totals.fullDays} {t('fullDayWork')}{totals.halfDays > 0 ? ` • ${totals.halfDays} ${t('halfDayWork')}` : ''})
              </span>
            </div>
          </div>

          {/* Card 2: Total Gross Earnings */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{t('totalCalculatedPayroll')}</span>
              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                {formatAmount(totals.netSalary)}
              </span>
              <span className="text-[11px] text-slate-400 ms-1 font-bold">دینار</span>
            </div>
          </div>

          {/* Card 3: Total Advances & Payments Received */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{t('totalPaidAdvances')}</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {formatAmount(financialStatus.totalPaid)}
              </span>
              <span className="text-[11px] text-slate-400 ms-1 font-bold">دینار</span>
            </div>
          </div>

          {/* Card 4: Net Balance Due */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{t('netBalanceDue')}</span>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <WalletCards className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-xl sm:text-2xl font-black font-mono ${
                financialStatus.balance <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
              }`}>
                {formatAmount(Math.max(0, financialStatus.balance))}
              </span>
              <span className="text-[11px] text-slate-400 ms-1 font-bold">دینار</span>
            </div>
          </div>

        </div>

        {/* 2. Personal Payment History & Advances Ledger (Requirement #5) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-500" />
              <span>{t('paymentHistory')} ({selectedMonth})</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-bold">
              {monthlyPayments.length} {language === 'ku' ? 'پارەدان' : 'تراکنش دریافتی'}
            </span>
          </div>

          {monthlyPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {t('noPaymentsRecorded')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4 text-start font-bold">#</th>
                    <th className="py-3 px-4 text-start font-bold">{t('paymentDate')}</th>
                    <th className="py-3 px-4 text-center font-bold">{t('status')}</th>
                    <th className="py-3 px-4 text-end font-bold">{t('paymentAmount')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('referenceNumber')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('notesLabel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {monthlyPayments.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 font-mono whitespace-nowrap">
                        {p.date}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          p.type === 'settlement'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          {p.type === 'settlement' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {p.type === 'settlement' ? t('settlementType') : t('advanceType')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end font-black font-mono text-slate-900 dark:text-white whitespace-nowrap">
                        {formatAmount(p.amount)} <span className="text-[10px] text-slate-400 font-normal">دینار</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        {p.referenceNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {p.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. Detailed Attendance Timesheet Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-500" />
              <span>{t('myMonthlyReport')}</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-bold">
              {t('allAmountsInIQDNote')}
            </span>
          </div>

          {monthlyLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              {t('noLogsForMonth')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4 text-start font-bold">#</th>
                    <th className="py-3 px-4 text-start font-bold">{t('date')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('workType')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('overtimeHours')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('baseWageIQD')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('overtimeWageIQD')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('netPayIQD')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('taskNotesTitle')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {monthlyLogs.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        <div>{l.date}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{getDayName(l.date)}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {l.type === 'full' && (
                          <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                            {t('fullDay')}
                          </span>
                        )}
                        {l.type === 'half' && (
                          <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                            {t('halfDay')}
                          </span>
                        )}
                        {l.type === 'hourly' && (
                          <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                            {t('hourlyOnly')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-600 dark:text-slate-300 font-mono">
                        {l.overtimeHours > 0 ? formatHoursAndMinutes(l.overtimeHours) : '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 font-mono">
                        {formatAmount(l.calculatedDailyWage)}
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {l.calculatedOvertimeWage > 0 ? formatAmount(l.calculatedOvertimeWage) : '—'}
                      </td>
                      <td className="py-3 px-4 font-black text-sky-600 dark:text-sky-400 font-mono">
                        {formatAmount(l.totalDayPay)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {l.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/70 dark:bg-slate-800/80 font-black text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                    <td colSpan={3} className="py-3.5 px-4 text-start font-black">
                      {t('total')}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {formatHoursAndMinutes(totals.totalOtHours)}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {formatAmount(totals.totalBasePay)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-amber-600 dark:text-amber-400">
                      {formatAmount(totals.totalOtPay)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-sky-600 dark:text-sky-400 text-sm">
                      {formatAmount(totals.netSalary)}
                    </td>
                    <td className="py-3.5 px-4 text-[10px] text-slate-400">
                      {t('allAmountsInIQDNote')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        </div>

        {/* Dual Signature Blocks (Printed Payslip) */}
        <div className="hidden print:flex justify-around items-end pt-16 pb-6 mt-8 border-t border-slate-300 text-xs font-bold text-slate-800">
          <div className="text-center">
            <p className="mb-14">{t('receiptWorkerSign')}</p>
            <div className="w-44 border-b border-slate-600"></div>
          </div>
          <div className="text-center">
            <p className="mb-14">{t('receiptManagerSign')}</p>
            <div className="w-44 border-b border-slate-600"></div>
          </div>
        </div>

      </main>
    </div>
  );
}
