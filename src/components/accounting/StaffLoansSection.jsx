import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { pushLoansLive, deleteLoanLive } from '../../services/realtimeSync';
import { formatAmount, formatCurrency, getCurrencySymbol } from '../../utils/formatters';
import { 
  Calculator, 
  Coins, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  PauseCircle, 
  PlayCircle, 
  Edit3, 
  Trash2, 
  User, 
  Plus, 
  AlertCircle, 
  X, 
  Check, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

const COPY = {
  fa: {
    title: 'مدیریت وام و تسهیلات پرسنلی',
    subtitle: 'پایش وضعیت اقساط، مانده بدهی و ویرایش شرایط بازپرداخت تسهیلات پرسنل',
    newLoanBtn: '+ اعطای وام جدید',
    allTab: 'همه تسهیلات',
    activeTab: 'در حال بازپرداخت',
    settledTab: 'تسویه‌شده',
    pausedTab: 'متوقف / دارای تنفس',
    emptyTitle: 'هیچ وامی در این دسته‌بندی یافت نشد',
    emptySubtitle: 'برای پرداخت وام به پرسنل، روی دکمه «اعطای وام جدید» کلیک کنید.',
    totalPrincipalGranted: 'کل اصل وام‌های اعطایی',
    totalRepaid: 'مجموع اقساط وصول‌شده',
    totalOutstanding: 'مانده بدهی نزد پرسنل',
    activeLoansCount: 'وام‌های فعال در گردش',
    workerRecipient: 'پرسنل دریافت‌کننده:',
    principalAmount: 'اصل وام:',
    profitInterest: 'کارمزد / سود:',
    totalRepayable: 'کل بازپرداخت:',
    monthlyInstallment: 'قسط ماهانه:',
    remainingMonths: 'ماه‌های باقی‌مانده:',
    monthsSuffix: 'ماه',
    paidAmount: 'وصول‌شده:',
    remainingBalance: 'مانده طلب:',
    startMonth: 'شروع کسر از حقوق:',
    statusActive: 'فعال (در حال کسر)',
    statusSettled: 'تسویه کامل',
    statusPaused: 'متوقف (دارای تنفس)',
    rescheduleBtn: 'تغییر شرایط اقساط',
    pauseBtn: 'توقف موقت (تنفس)',
    resumeBtn: 'ادامه کسر اقساط',
    earlySettleBtn: 'تسویه کامل یکجا',
    deleteBtn: 'حذف وام',
    deleteConfirm: 'آیا از حذف این وام اطمینان دارید؟',
    rescheduleModalTitle: 'ویرایش شرایط بازپرداخت و اقساط وام',
    rescheduleModalSubtitle: 'تغییر مدت اقساط ماهانه، بازنگری مبالغ یا تغییر وضعیت وام',
    newMonthlyInstallmentLabel: 'مبلغ جدید قسط ماهانه:',
    newRemainingMonthsLabel: 'تعداد ماه‌های باقی‌مانده جدید:',
    loanStatusLabel: 'وضعیت وام:',
    rescheduleNotesLabel: 'توضیحات و دلیل تغییر شرایط:',
    notesPlaceholder: 'مثال: توافق با پرسنل جهت کاهش مبلغ قسط و افزایش مدت به درخواست وی...',
    saveChanges: 'ذخیره شرایط جدید',
    cancel: 'انصراف',
    zeroInterestBadge: 'بدون سود'
  },
  ku: {
    title: 'بەڕێوەبردنی قەرز و ئاسانکاری کرێکاران',
    subtitle: 'چاودێری دۆخی قیستەکان، باڵانسی ماوە و دەستکاری مەرجەکانی گەڕاندنەوە',
    newLoanBtn: '+ پێدانی قەرزی نوێ',
    allTab: 'هەموو قەرزەکان',
    activeTab: 'لە کاتی گەڕاندنەوە',
    settledTab: 'پاکتاوکراو',
    pausedTab: 'ڕاگیراو / پشوو',
    emptyTitle: 'هیچ قەرزێک لەم بەشەدا نەدۆزرایەوە',
    emptySubtitle: 'بۆ پێدانی قەرز بە کرێکاران، کلیک لەسەر دوگمەی «پێدانی قەرزی نوێ» بکەن.',
    totalPrincipalGranted: 'کۆی ئەسڵی قەرزە دراوەکان',
    totalRepaid: 'کۆی قیستە وەرگیراوەکان',
    totalOutstanding: 'باڵانسی ماوە لای کرێکاران',
    activeLoansCount: 'قەرزە چالاکەکان',
    workerRecipient: 'کرێکاری وەرگر:',
    principalAmount: 'ئەسڵی قەرز:',
    profitInterest: 'سوود / کارمۆزد:',
    totalRepayable: 'کۆی گەڕاندنەوە:',
    monthlyInstallment: 'قیستی مانگانە:',
    remainingMonths: 'مانگەکانی ماوە:',
    monthsSuffix: 'مانگ',
    paidAmount: 'وەرگیراو:',
    remainingBalance: 'باڵانسی ماوە:',
    startMonth: 'دەستپێکی داشکاندن:',
    statusActive: 'چالاک (لە کاتی داشکاندن)',
    statusSettled: 'پاکتاوی تەواو',
    statusPaused: 'ڕاگیراو (پشوو)',
    rescheduleBtn: 'دەستکاری مەرجەکانی قیست',
    pauseBtn: 'ڕاگرتنی کاتی (پشوو)',
    resumeBtn: 'دەستپێکردنەوەی قیست',
    earlySettleBtn: 'پاکتاوی تەواوی یەکجارەکی',
    deleteBtn: 'سڕینەوەی قەرز',
    deleteConfirm: 'ئایا دڵنیایت لە سڕینەوەی ئەم قەرزە؟',
    rescheduleModalTitle: 'دەستکاری مەرجەکانی گەڕاندنەوەی قەرز',
    rescheduleModalSubtitle: 'گۆڕینی ماوەی قیستەکان، پێداچوونەوە بە بڕەکان یان گۆڕینی دۆخ',
    newMonthlyInstallmentLabel: 'بڕی نوێی قیستی مانگانە:',
    newRemainingMonthsLabel: 'ژمارەی نوێی مانگە ماوەکان:',
    loanStatusLabel: 'دۆخی قەرز:',
    rescheduleNotesLabel: 'ڕوونکردنەوە و هۆکاری گۆڕانکاری:',
    notesPlaceholder: 'نموونە: ڕێککەوتن لەسەر کەمکردنەوەی قیستی مانگانە...',
    saveChanges: 'پاشەکەوتکردنی مەرجە نوێیەکان',
    cancel: 'پاشگەزبوونەوە',
    zeroInterestBadge: 'بێ سوود'
  },
  en: {
    title: 'Staff Loans & Facilities Management',
    subtitle: 'Monitor installment schedules, outstanding debt, and reschedule repayment terms',
    newLoanBtn: '+ Grant New Loan',
    allTab: 'All Loans',
    activeTab: 'Active Repaying',
    settledTab: 'Fully Settled',
    pausedTab: 'Paused / Grace Period',
    emptyTitle: 'No loans found in this category',
    emptySubtitle: 'Click "+ Grant New Loan" to disburse a staff loan with custom terms.',
    totalPrincipalGranted: 'Total Principal Disbursed',
    totalRepaid: 'Total Installments Repaid',
    totalOutstanding: 'Total Remaining Balance',
    activeLoansCount: 'Active Loans in Cycle',
    workerRecipient: 'Recipient Worker:',
    principalAmount: 'Principal Loan:',
    profitInterest: 'Agreed Profit/Fee:',
    totalRepayable: 'Total Repayable:',
    monthlyInstallment: 'Monthly Installment:',
    remainingMonths: 'Remaining Months:',
    monthsSuffix: 'Months',
    paidAmount: 'Repaid So Far:',
    remainingBalance: 'Remaining Due:',
    startMonth: 'Deduction Start Month:',
    statusActive: 'Active (Deducting)',
    statusSettled: 'Fully Settled',
    statusPaused: 'Paused (Grace Period)',
    rescheduleBtn: 'Reschedule Terms',
    pauseBtn: 'Pause Deductions',
    resumeBtn: 'Resume Deductions',
    earlySettleBtn: 'Early Full Settlement',
    deleteBtn: 'Delete Loan',
    deleteConfirm: 'Are you sure you want to delete this loan record?',
    rescheduleModalTitle: 'Reschedule Loan Terms & Installments',
    rescheduleModalSubtitle: 'Adjust installment duration, monthly amount, or change loan status',
    newMonthlyInstallmentLabel: 'New Monthly Installment:',
    newRemainingMonthsLabel: 'New Remaining Months:',
    loanStatusLabel: 'Loan Status:',
    rescheduleNotesLabel: 'Notes & Reason for Change:',
    notesPlaceholder: 'e.g. Worker requested lower monthly deduction and extended duration...',
    saveChanges: 'Save New Terms',
    cancel: 'Cancel',
    zeroInterestBadge: '0% Interest'
  }
};

export function StaffLoansSection({ onOpenNewLoanModal }) {
  const { language, direction } = useLanguage();
  const c = COPY[language] || COPY.fa;
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'settled' | 'paused'
  const [editingLoan, setEditingLoan] = useState(null);

  // Live Query from db.loans
  const allLoans = useLiveQuery(
    async () => {
      if (!db.loans) return [];
      const list = await db.loans.toArray();
      return list.filter((l) => !l.deletedAt && l.status !== 'deleted');
    },
    []
  ) || [];

  // Metrics
  const metrics = useMemo(() => {
    let totalPrincipal = 0;
    let totalRepaid = 0;
    let totalRemaining = 0;
    let activeCount = 0;

    allLoans.forEach((l) => {
      totalPrincipal += Number(l.principalAmount) || 0;
      totalRepaid += Number(l.totalPaid) || 0;
      totalRemaining += Number(l.remainingBalance) || 0;
      if (l.status === 'active') activeCount++;
    });

    return {
      totalPrincipal,
      totalRepaid,
      totalRemaining,
      activeCount
    };
  }, [allLoans]);

  // Filtered loans list
  const filteredLoans = useMemo(() => {
    return allLoans
      .filter((l) => {
        if (statusFilter === 'all') return true;
        return l.status === statusFilter;
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [allLoans, statusFilter]);

  // Actions
  const handleTogglePause = async (loan) => {
    const nextStatus = loan.status === 'paused' ? 'active' : 'paused';
    await db.loans.update(loan.id, {
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });
    pushLoansLive().catch(console.warn);
  };

  const handleEarlySettle = async (loan) => {
    if (!window.confirm(c.earlySettleBtn + '?')) return;
    await db.loans.update(loan.id, {
      status: 'settled',
      totalPaid: loan.totalRepayable,
      remainingBalance: 0,
      remainingMonths: 0,
      updatedAt: new Date().toISOString()
    });
    pushLoansLive().catch(console.warn);
  };

  const handleDelete = async (loan) => {
    if (!window.confirm(c.deleteConfirm)) return;
    await deleteLoanLive(loan.id);
  };

  return (
    <div dir={direction} className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Header Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
            <Calculator className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {c.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {c.subtitle}
            </p>
          </div>
        </div>

        {onOpenNewLoanModal && (
          <button
            type="button"
            onClick={onOpenNewLoanModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/25 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{c.newLoanBtn}</span>
          </button>
        )}
      </div>

      {/* 2. Top Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Principal */}
        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span>{c.totalPrincipalGranted}</span>
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatAmount(metrics.totalPrincipal, currency)}
              </span>
              <span className="text-xs font-bold text-slate-500">{getCurrencySymbol(currency, language)}</span>
            </div>
          </div>
        </div>

        {/* Total Repaid */}
        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <span>{c.totalRepaid}</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatAmount(metrics.totalRepaid, currency)}
              </span>
              <span className="text-xs font-bold text-emerald-500/70">{getCurrencySymbol(currency, language)}</span>
            </div>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-bold">
            <span>{c.totalOutstanding}</span>
            <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {formatAmount(metrics.totalRemaining, currency)}
              </span>
              <span className="text-xs font-bold text-indigo-500/70">{getCurrencySymbol(currency, language)}</span>
            </div>
          </div>
        </div>

        {/* Active Loans Count */}
        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span>{c.activeLoansCount}</span>
            <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {metrics.activeCount}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Filter Segment Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 w-full sm:w-auto sm:inline-flex overflow-x-auto">
        {[
          { id: 'all', label: c.allTab, count: allLoans.length },
          { id: 'active', label: c.activeTab, count: allLoans.filter((l) => l.status === 'active').length },
          { id: 'settled', label: c.settledTab, count: allLoans.filter((l) => l.status === 'settled').length },
          { id: 'paused', label: c.pausedTab, count: allLoans.filter((l) => l.status === 'paused').length }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 4. Loans Grid Cards */}
      {filteredLoans.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mx-auto">
            <Calculator className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
            {c.emptyTitle}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {c.emptySubtitle}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLoans.map((loan) => {
            const percentPaid = loan.totalRepayable > 0 
              ? Math.min(100, Math.round(((loan.totalPaid || 0) / loan.totalRepayable) * 100)) 
              : 100;

            const isSettled = loan.status === 'settled' || (loan.remainingBalance || 0) <= 0;
            const isPaused = loan.status === 'paused';

            return (
              <div
                key={loan.id}
                className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4 flex flex-col justify-between"
              >
                {/* Header: Worker & Status Badge */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {loan.workerName || '—'}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>{loan.date || loan.createdAt?.slice(0, 10)}</span>
                        {loan.startMonth && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {c.startMonth} {loan.startMonth}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full border shadow-2xs ${
                    isSettled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : isPaused
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  }`}>
                    {isSettled ? c.statusSettled : isPaused ? c.statusPaused : c.statusActive}
                  </span>
                </div>

                {/* Loan Numbers Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">{c.principalAmount}</span>
                    <span className="font-black font-mono text-slate-900 dark:text-white">
                      {formatCurrency(loan.principalAmount || 0, currency, language)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">{c.profitInterest}</span>
                    <span className="font-black font-mono text-blue-600 dark:text-blue-400">
                      {loan.interestAmount > 0 
                        ? formatCurrency(loan.interestAmount, currency, language) 
                        : c.zeroInterestBadge}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">{c.totalRepayable}</span>
                    <span className="font-black font-mono text-indigo-700 dark:text-indigo-300">
                      {formatCurrency(loan.totalRepayable || 0, currency, language)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">{c.monthlyInstallment}</span>
                    <span className="font-black font-mono text-slate-900 dark:text-white">
                      {formatCurrency(loan.monthlyInstallment || 0, currency, language)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">{c.remainingMonths}</span>
                    <span className="font-black font-mono text-slate-700 dark:text-slate-300">
                      {loan.remainingMonths ?? loan.installmentMonths} {c.monthsSuffix}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold mb-0.5">{c.remainingBalance}</span>
                    <span className="font-black font-mono text-rose-600 dark:text-rose-400">
                      {formatCurrency(loan.remainingBalance || 0, currency, language)}
                    </span>
                  </div>
                </div>

                {/* Repayment Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500 dark:text-slate-400">
                      {c.paidAmount} <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(loan.totalPaid || 0, currency, language)}</strong>
                    </span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-black">
                      {percentPaid}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        isSettled
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                      }`}
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>

                {/* Notes if present */}
                {loan.notes && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 p-2 rounded-xl italic">
                    {loan.notes}
                  </p>
                )}

                {/* Action Toolbar */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingLoan(loan)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title={c.rescheduleBtn}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{c.rescheduleBtn}</span>
                  </button>

                  {!isSettled && (
                    <button
                      type="button"
                      onClick={() => handleTogglePause(loan)}
                      className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                        isPaused
                          ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                          : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                      }`}
                      title={isPaused ? c.resumeBtn : c.pauseBtn}
                    >
                      {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                      <span>{isPaused ? c.resumeBtn : c.pauseBtn}</span>
                    </button>
                  )}

                  {!isSettled && (
                    <button
                      type="button"
                      onClick={() => handleEarlySettle(loan)}
                      className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      title={c.earlySettleBtn}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{c.earlySettleBtn}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(loan)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all cursor-pointer"
                    title={c.deleteBtn}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* 5. Reschedule Loan Modal */}
      {editingLoan && (
        <RescheduleLoanModal
          loan={editingLoan}
          currency={currency}
          onClose={() => setEditingLoan(null)}
          onSuccess={() => {
            setEditingLoan(null);
            pushLoansLive().catch(console.warn);
          }}
        />
      )}

    </div>
  );
}

// ----------------------------------------------------------------------
// Sub-Modal: Reschedule Loan Terms (ویرایش شرایط اقساط و بازپرداخت وام)
// ----------------------------------------------------------------------
function RescheduleLoanModal({ loan, currency, onClose, onSuccess }) {
  const { language, direction } = useLanguage();
  const c = COPY[language] || COPY.fa;

  const [monthlyInstallment, setMonthlyInstallment] = useState(String(loan.monthlyInstallment || ''));
  const [remainingMonths, setRemainingMonths] = useState(loan.remainingMonths ?? loan.installmentMonths ?? 1);
  const [status, setStatus] = useState(loan.status || 'active');
  const [notes, setNotes] = useState(loan.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const numInstallment = Number(String(monthlyInstallment).replace(/,/g, '')) || loan.monthlyInstallment;
      const numMonths = Math.max(1, parseInt(remainingMonths, 10) || 1);

      await db.loans.update(loan.id, {
        monthlyInstallment: numInstallment,
        remainingMonths: numMonths,
        status,
        notes: notes.trim() || null,
        updatedAt: new Date().toISOString()
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      alert(err.message || 'Error updating loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div dir={direction} className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {c.rescheduleModalTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {loan.workerName} - {c.remainingBalance}: {formatCurrency(loan.remainingBalance || 0, currency, language)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          
          {/* Monthly Installment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {c.newMonthlyInstallmentLabel}
            </label>
            <div className="relative flex rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden">
              <input
                type="text"
                inputMode="numeric"
                value={monthlyInstallment ? Number(String(monthlyInstallment).replace(/,/g, '')).toLocaleString() : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                  setMonthlyInstallment(raw);
                }}
                required
                className="w-full px-3.5 py-2.5 text-sm font-bold font-mono bg-transparent focus:outline-none text-slate-900 dark:text-white"
              />
              <div className="px-3 flex items-center justify-center bg-slate-200/50 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                {getCurrencySymbol(currency, language)}
              </div>
            </div>
          </div>

          {/* Remaining Months */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {c.newRemainingMonthsLabel}
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={remainingMonths}
              onChange={(e) => setRemainingMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
              required
              className="w-full px-3.5 py-2.5 text-sm font-bold font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {c.loanStatusLabel}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="active">{c.statusActive}</option>
              <option value="paused">{c.statusPaused}</option>
              <option value="settled">{c.statusSettled}</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {c.rescheduleNotesLabel}
            </label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={c.notesPlaceholder}
              className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {c.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              {c.saveChanges}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
