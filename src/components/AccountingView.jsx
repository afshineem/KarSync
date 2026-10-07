import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAccounting } from '../hooks/useAccounting';
import { FinancialBalanceCards } from './accounting/FinancialBalanceCards';
import { CashFlowChart } from './accounting/CashFlowChart';
import { IncomeManagementSection } from './accounting/IncomeManagementSection';
import { GeneralLedgerTable } from './accounting/GeneralLedgerTable';
import { AddEditIncomeModal } from './accounting/AddEditIncomeModal';
import { AccountsSettingsTab } from './accounting/AccountsSettingsTab';
import { AccountBalanceTiles } from './accounting/AccountBalanceTiles';
import { AccountTransferModal } from './accounting/AccountTransferModal';
import { DateRangeFilterModal } from './accounting/DateRangeFilterModal';
import { formatMonthOnly, getCurrentYearMonth } from '../utils/formatters';
import { 
  Landmark, 
  Plus, 
  CreditCard, 
  X, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  ArrowLeftRight, 
  Check,
  BookOpen,
  LayoutDashboard,
  ArrowDownLeft,
  Users,
  CalendarRange,
  BarChart3,
  Info
} from 'lucide-react';

/**
 * AccountingView
 * نمای اصلی تب «حسابداری و خزانه‌داری» (Accounting & Treasury)
 * 
 * سازمان‌دهی شده با زبان طراحی متریال گوگل، داک ناوبری مایع اپل و رنگ سازمانی پرایمری KarSync:
 * ۱. تراز و حساب‌ها (داشبورد تراز مالی، کارت‌های بانکی، صندوق‌ها، نمودار روند نقدینگی)
 * ۲. دفتر کل تراکنش‌ها (فیلترها، تایید نهایی اسناد موقت، اصلاحیه، خروجی اکسل)
 * ۳. ورودی‌ها و تنخواه (مدیریت شارژ تنخواه، تزریق نقدینگی)
 * ۴. مدیریت حساب‌ها و کارت‌ها (تعریف، ویرایش، حساب پیش‌فرض و سقف اعتبار)
 */
export function AccountingView({ 
  initialSubTab = 'overview', 
  hideInternalSubNav = false,
  hideHeader = false 
}) {
  const { t, language, direction } = useLanguage();
  const { currentProject, openWorkerProfile } = useProject();

  const [activeViewTab, setActiveViewTab] = useState(initialSubTab); // 'overview' | 'ledger' | 'income' | 'accounts'

  // هماهنگی ساب‌تب در صورت تغییر توسط والد
  useEffect(() => {
    if (initialSubTab) {
      setActiveViewTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [placeholderNotice, setPlaceholderNotice] = useState(null);
  const [initialTransferSourceId, setInitialTransferSourceId] = useState(null);
  const [quickDepositAccount, setQuickDepositAccount] = useState(null);

  // پیام اعلان موقت
  useEffect(() => {
    if (placeholderNotice) {
      const timer = setTimeout(() => setPlaceholderNotice(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [placeholderNotice]);

  // فراخوانی هوک اختصاصی حسابداری جهت مدیریت State و محاسبات زنده
  const {
    currency,
    dashboardStats,
    treasuryIncomes,
    financialAccounts,
    accountBalances,
    accountBalancesList,
    globalOverdraftPolicy,
    updateGlobalOverdraftPolicy,
    addAccount,
    updateAccount,
    setDefaultAccount,
    deleteAccount,
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
    selectedMonth,
    setSelectedMonth,
    cashFlowChartData,
    addIncome,
    updateIncome,
    deleteIncome,
    deleteDraftLedgerItem,
    batchDeleteDraftLedgerItems,
    accountTransfers,
    transferBetweenAccounts
  } = useAccounting();

  // جابه‌جایی ماه در ویجت ماه‌نما
  const handleShiftMonth = (delta) => {
    const [year, month] = (selectedMonth || getCurrentYearMonth()).split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
    setDateFilterMode('month');
  };

  const viewTabs = [
    {
      id: 'overview',
      label: language === 'fa' ? 'تراز و حساب‌ها' : 'هاوسەنگی و باڵانس',
      icon: LayoutDashboard,
      count: financialAccounts.length
    },
    {
      id: 'ledger',
      label: language === 'fa' ? 'دفتر کل' : 'دەفتەری گشتی',
      icon: BookOpen,
      count: ledgerStats?.total || 0,
      badge: ledgerStats?.draft > 0 ? ledgerStats.draft : null
    },
    {
      id: 'income',
      label: language === 'fa' ? 'ورودی‌ها و تنخواه' : 'داهات و تەنخوا',
      icon: ArrowDownLeft,
      count: treasuryIncomes.length
    },
    {
      id: 'accounts',
      label: language === 'fa' ? 'کارت‌ها و صندوق‌ها' : 'کارت و سندووق',
      icon: CreditCard,
      count: financialAccounts.length
    }
  ];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* هدر اصلی ماژول حسابداری */}
      {!hideHeader ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 flex-shrink-0">
              <Landmark className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {language === 'fa' ? 'حسابداری و خزانه‌داری' : 'ژمێریاری و خەزێنەداری'}
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                  {currentProject?.name || (language === 'fa' ? 'پروژه کارگاه' : 'پڕۆژە')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'fa' 
                  ? 'مدیریت یکپارچه تنخواه، تراز لحظه‌ای صندوق، کنترل هزینه‌ها و دفتر کل تراکنش‌ها' 
                  : 'بەڕێوەبردنی تەنخوا، هاوسەنگی سندووق و دەفتەری گشتی مامەڵەکان'}
              </p>
            </div>
          </div>

          {/* ناحیه کنترل تاریخ و داک اقدامات سریع */}
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-center justify-center md:justify-end gap-2.5 sm:gap-3">
            {/* ۱. اینپوت ماه‌نما (Month Navigator) - ارتفاع دقیقاً برابر با داک دکمه‌ها و هم‌عرض فقط در موبایل */}
            <div className="h-[52px] sm:h-[58px] w-full max-w-[340px] sm:w-auto sm:max-w-none flex items-center justify-between bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl p-1 sm:p-1.5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex-shrink-0">
              <button
                type="button"
                onClick={() => handleShiftMonth(direction === 'rtl' ? -1 : 1)}
                className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
                title={language === 'fa' ? 'ماه قبل' : 'مانگی پێشوو'}
                aria-label={language === 'fa' ? 'ماه قبل' : 'مانگی پێشوو'}
              >
                {direction === 'rtl' ? <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" /> : <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />}
              </button>

              <div className="relative flex-1 h-full flex items-center justify-center cursor-pointer min-w-[6rem] sm:min-w-[8rem] px-2 sm:px-4">
                <div className="pointer-events-none text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 text-center w-full truncate">
                  {formatMonthOnly(selectedMonth, language) || selectedMonth}
                </div>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setDateFilterMode('month');
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title={language === 'fa' ? 'انتخاب ماه' : 'هەڵبژاردنی مانگ'}
                />
              </div>

              <button
                type="button"
                onClick={() => handleShiftMonth(direction === 'rtl' ? 1 : -1)}
                className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
                title={language === 'fa' ? 'ماه بعد' : 'مانگی داهاتوو'}
                aria-label={language === 'fa' ? 'ماه بعد' : 'مانگی داهاتوو'}
              >
                {direction === 'rtl' ? <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" /> : <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />}
              </button>
            </div>

            {/* ۲. داک دکمه‌های آیکونی اقدامات حسابداری (چینش: بازه زمانی، گزارش، معین، انتقال، شارژ موجودی) */}
            <div className="h-[52px] sm:h-[58px] w-full max-w-[340px] sm:w-auto sm:max-w-none flex items-center justify-between sm:justify-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex-shrink-0">
              {/* دکمه ۱: بازه زمانی جهت مشاهده‌ی اسناد */}
              <button
                type="button"
                onClick={() => setIsDateRangeModalOpen(true)}
                className={`relative h-full aspect-square rounded-xl transition-all active:scale-95 group flex items-center justify-center focus:outline-hidden ${
                  dateFilterMode === 'custom'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'
                    : 'text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-700/80'
                }`}
                title={
                  dateFilterMode === 'custom'
                    ? (language === 'fa' ? `بازه سفارشی فعال: از ${customStartDate || '...'} تا ${customEndDate || '...'}` : `ماوەی دیاریکراو: ${customStartDate} - ${customEndDate}`)
                    : (language === 'fa' ? 'بازه زمانی جهت مشاهده‌ی اسناد' : 'ماوەی کاتی بینینی بەڵگەنامەکان')
                }
                aria-label={language === 'fa' ? 'بازه زمانی جهت مشاهده‌ی اسناد' : 'ماوەی کاتی بینینی بەڵگەنامەکان'}
              >
                <CalendarRange className="w-5.5 h-5.5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
                {dateFilterMode === 'custom' && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                )}
              </button>

              {/* دکمه ۲: گزارش و آمار */}
              <button
                type="button"
                onClick={() => {
                  setPlaceholderNotice(
                    language === 'fa'
                      ? 'بخش گزارش و آمار حرفه‌ای برای ارائه به مدیران به زودی فعال خواهد شد.'
                      : 'بەشی ئامار و ڕاپۆرتەکان بەم زووانە چالاک دەکرێت.'
                  );
                }}
                className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 group flex items-center justify-center focus:outline-hidden"
                title={language === 'fa' ? 'گزارش و آمار (آمارگیری دقیق و حرفه‌ای برای ارائه به مدیران)' : 'ئامار و ڕاپۆرتەکان بۆ بەڕێوەبەران'}
                aria-label={language === 'fa' ? 'گزارش و آمار' : 'ئامار و ڕاپۆرتەکان'}
              >
                <BarChart3 className="w-5.5 h-5.5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
              </button>

              {/* دکمه ۳: معین افراد و حساب‌ها */}
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('karsync-open-subsidiary-search'));
                }}
                className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 group flex items-center justify-center focus:outline-hidden"
                title={language === 'fa' ? 'معین افراد/حساب‌ها (Shift+M)' : 'دەفتەری حیسابی کەسەکان و حیسابەکان (Shift+M)'}
                aria-label={language === 'fa' ? 'معین افراد و حساب‌ها' : 'دەفتەری حیسابی کەسەکان'}
              >
                <Users className="w-5.5 h-5.5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
              </button>

              {/* دکمه ۴: انتقال به حساب */}
              <button
                type="button"
                onClick={() => {
                  setInitialTransferSourceId(null);
                  setIsTransferModalOpen(true);
                }}
                className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 group flex items-center justify-center focus:outline-hidden"
                title={language === 'fa' ? 'انتقال حساب به حساب' : 'گواستنەوە لە نێوان حیسابەکان'}
                aria-label={language === 'fa' ? 'انتقال حساب به حساب' : 'گواستنەوە لە نێوان حیسابەکان'}
              >
                <ArrowLeftRight className="w-5.5 h-5.5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
              </button>

              {/* دکمه ۵: شارژ موجودی */}
              <button
                type="button"
                onClick={() => {
                  setQuickDepositAccount(null);
                  setIsQuickAddModalOpen(true);
                }}
                className="h-full aspect-square rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white transition-all shadow-md shadow-sky-500/25 active:scale-95 hover:scale-105 group flex items-center justify-center focus:outline-hidden"
                title={language === 'fa' ? 'شارژ موجودی (واریز نقدی یا بانکی به صندوق/حساب)' : 'زیادکردنی باڵانس (داهات/تەنخوا)'}
                aria-label={language === 'fa' ? 'شارژ موجودی' : 'زیادکردنی باڵانس'}
              >
                <Plus className="w-5.5 h-5.5 sm:w-6 sm:h-6 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* نوار ابزار در حالت میزبانی شده داخل کانتینر ادغام‌شده (کاملاً یکسان با تب اول) */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* سمت راست: آیکون، عنوان و نشانگر وضعیت تب فرعی دقیقا هم‌اندازه تب اول */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 flex-shrink-0">
              {activeViewTab === 'accounts' && <CreditCard className="w-6 h-6 stroke-[2.2]" />}
              {activeViewTab === 'ledger' && <BookOpen className="w-6 h-6 stroke-[2.2]" />}
              {activeViewTab === 'income' && <ArrowDownLeft className="w-6 h-6 stroke-[2.2]" />}
              {activeViewTab !== 'accounts' && activeViewTab !== 'ledger' && activeViewTab !== 'income' && <Landmark className="w-6 h-6 stroke-[2.2]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {activeViewTab === 'accounts' && (language === 'fa' ? 'مدیریت و تراز کارت‌ها و صندوق‌ها' : 'بەڕێوەبردنی کارتەکان و سندووق')}
                  {activeViewTab === 'ledger' && (language === 'fa' ? 'دفتر کل اسناد و تراکنش‌های کارگاه' : 'دەفتەری گشتی مامەڵەکان')}
                  {activeViewTab === 'income' && (language === 'fa' ? 'ورودی‌های نقدینگی و درآمدهای پروژه' : 'داهات و تەنخوا')}
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                  {currentProject?.name || (language === 'fa' ? 'پروژه کارگاه' : 'پڕۆژە')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeViewTab === 'accounts' && (language === 'fa' ? 'کنترل سرفصل‌ها، تراز صندوق و کارت‌های بانکی فعال' : 'کۆنترۆڵی سندووق و کارتە بانکییەکان')}
                {activeViewTab === 'ledger' && (language === 'fa' ? 'ثبت و تایید اسناد دو مرحله‌ای، مغایرت‌گیری و گردش حساب' : 'تۆمارکردن و پەسەندکردنی بەڵگەنامەکان')}
                {activeViewTab === 'income' && (language === 'fa' ? 'تزریق نقدینگی، شارژ تنخواه و واریزی‌های کارفرما' : 'تەنخوا و داهاتە نوێیەکان')}
              </p>
            </div>
          </div>

          {/* سمت چپ: کنترل ماه‌نما و داک دکمه‌های آیکونی بزرگ (دقیقا برابر با تب اول: h-[52px] sm:h-[58px]) */}
          <div className="w-full xl:w-auto flex flex-col sm:flex-row items-center justify-center xl:justify-end gap-2.5 sm:gap-3 flex-wrap">
            {/* ۱. ماه‌نمای تعاملی با دکمه‌های قبل و بعد - هم‌اندازه تب اول */}
            <div className="h-[52px] sm:h-[58px] w-full max-w-[340px] sm:w-auto sm:max-w-none flex items-center justify-between bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl p-1 sm:p-1.5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex-shrink-0">
              <button
                type="button"
                onClick={() => handleShiftMonth(direction === 'rtl' ? -1 : 1)}
                className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
                title={language === 'fa' ? 'ماه قبل' : 'مانگی پێشوو'}
                aria-label={language === 'fa' ? 'ماه قبل' : 'مانگی پێشوو'}
              >
                {direction === 'rtl' ? <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" /> : <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />}
              </button>

              <div className="relative flex-1 h-full flex items-center justify-center cursor-pointer min-w-[6rem] sm:min-w-[7rem] px-2 sm:px-3">
                <div className="pointer-events-none text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 text-center w-full truncate">
                  {formatMonthOnly(selectedMonth, language) || selectedMonth}
                </div>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setDateFilterMode('month');
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title={language === 'fa' ? 'انتخاب ماه' : 'هەڵبژاردنی مانگ'}
                />
              </div>

              <button
                type="button"
                onClick={() => handleShiftMonth(direction === 'rtl' ? 1 : -1)}
                className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
                title={language === 'fa' ? 'ماه بعد' : 'مانگی داهاتوو'}
                aria-label={language === 'fa' ? 'ماه بعد' : 'مانگی داهاتوو'}
              >
                {direction === 'rtl' ? <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" /> : <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />}
              </button>
            </div>

            {/* ۲. داک اکشن‌های سریع - هم‌ارتفاع با تب اول (h-[52px] sm:h-[58px]) با آیکون‌های بزرگ w-5.5 sm:w-6 */}
            <div className="h-[52px] sm:h-[58px] w-full max-w-[340px] sm:w-auto sm:max-w-none flex items-center justify-between sm:justify-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex-shrink-0">
              {/* دکمه معین افراد و حساب‌ها */}
              <div className="relative group h-full">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('karsync-open-subsidiary-search'))}
                  className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 flex items-center justify-center focus:outline-hidden"
                  aria-label={language === 'fa' ? 'معین افراد و حساب‌ها' : 'دەفتەری حیسابی کەسەکان'}
                >
                  <Users className="w-5.5 h-5.5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover:translate-y-0 whitespace-nowrap z-50">
                  {language === 'fa' ? 'معین افراد و حساب‌ها (Shift+M)' : 'دەفتەری حیسابی کەسەکان'}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                </div>
              </div>

              {/* دکمه انتقال وجه بین حساب‌ها */}
              <div className="relative group h-full">
                <button
                  type="button"
                  onClick={() => {
                    setInitialTransferSourceId(null);
                    setIsTransferModalOpen(true);
                  }}
                  className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 flex items-center justify-center focus:outline-hidden"
                  aria-label={language === 'fa' ? 'انتقال حساب به حساب' : 'گواستنەوە'}
                >
                  <ArrowLeftRight className="w-5.5 h-5.5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover:translate-y-0 whitespace-nowrap z-50">
                  {language === 'fa' ? 'انتقال حساب به حساب' : 'گواستنەوە'}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                </div>
              </div>

              {/* دکمه شارژ موجودی (تنخواه) */}
              <div className="relative group h-full">
                <button
                  type="button"
                  onClick={() => {
                    setQuickDepositAccount(null);
                    setIsQuickAddModalOpen(true);
                  }}
                  className="h-full aspect-square rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-md shadow-sky-500/25 active:scale-95 hover:scale-105 transition-all flex items-center justify-center focus:outline-hidden"
                  aria-label={language === 'fa' ? 'شارژ موجودی' : 'زیادکردنی باڵانس'}
                >
                  <Plus className="w-5.5 h-5.5 sm:w-6 sm:h-6 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover:translate-y-0 whitespace-nowrap z-50">
                  {language === 'fa' ? 'شارژ موجودی (تنخواه / واریز)' : 'زیادکردنی باڵانس'}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* پیام بازخورد برای بخش‌های آماده‌سازی آینده */}
      {placeholderNotice && (
        <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 bg-indigo-50/90 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{placeholderNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPlaceholderNotice(null)}
            className="p-1 rounded-lg text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* نوار ناوبری زیرمنوها (طراحی داک مایع شبیه ناوبار و هزینه‌ها) */}
      {!hideInternalSubNav && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <nav
            aria-label="Accounting views"
            className="flex items-center gap-1.5 sm:gap-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl backdrop-saturate-200 p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-white/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_4px_20px_rgba(0,0,0,0.4)] w-fit flex-wrap"
          >
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeViewTab === tab.id;
            return (
              <div key={tab.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setActiveViewTab(tab.id);
                  }}
                  aria-label={tab.label}
                  className={`relative rounded-xl sm:rounded-2xl transition-all duration-300 ease-out flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 px-3.5 py-2.5 sm:px-4 sm:py-3 gap-2 scale-105 font-bold border border-sky-400/30'
                      : 'p-2.5 sm:p-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.08] hover:scale-105'
                  }`}
                >
                  <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2] transition-transform duration-200 group-hover:scale-110 shrink-0" />

                  {/* نام تب - فقط روی دکمه‌ی انتخاب شده نمایش داده می‌شود */}
                  {isActive && (
                    <span className="text-xs sm:text-sm font-black whitespace-nowrap tracking-tight animate-in fade-in zoom-in-95 duration-200">
                      {tab.label}
                    </span>
                  )}

                  {/* نشانگر تعداد روی تب فعال */}
                  {isActive && (
                    tab.badge ? (
                      <span className="ms-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-amber-500 text-white shadow-xs animate-in fade-in duration-200">
                        {tab.badge}
                      </span>
                    ) : tab.count > 0 ? (
                      <span className="ms-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-none bg-white/20 text-white animate-in fade-in duration-200">
                        {tab.count}
                      </span>
                    ) : null
                  )}

                  {/* بج کوچک نشانگر روی تب غیرفعال اگر بج ضروری (مانند اسناد موقت) وجود داشته باشد */}
                  {!isActive && tab.badge && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black bg-amber-500 text-white shadow-xs ring-2 ring-white dark:ring-slate-900 animate-in fade-in duration-200">
                      {tab.badge}
                    </span>
                  )}

                  {/* نقطه نشانگر فعال */}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs animate-in fade-in duration-200" />
                  )}
                </button>

                {/* تولتیپ در حالت هاور برای دکمه‌های غیرفعال */}
                {!isActive && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50">
                    {tab.label}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
      )}

      {/* بدنه محتوا بر اساس تب انتخابی */}
      {activeViewTab === 'overview' ? (
        /* تب ۱: نمای کلی و تراز نقدینگی */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* اعلان اسناد نیازمند تایید مدیر با دکمه هدایت سریع به دفتر کل */}
          {ledgerStats?.draft > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 dark:from-amber-950/40 dark:via-amber-900/40 dark:to-amber-950/40 border border-amber-300/80 dark:border-amber-700/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                    {language === 'fa' 
                      ? `تعداد ${ledgerStats.draft} سند مالی موقت (پیش‌نویس) در انتظار تایید نهایی هستند.` 
                      : `${ledgerStats.draft} بەڵگەنامەی ڕەشنووس چاوەڕوانی پەسەندکردنن.`}
                  </h4>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    {language === 'fa' 
                      ? 'تسویه‌حساب‌ها و هزینه‌های ثبت شده تا زمان تایید نهایی مدیر، وضعیت پیش‌نویس دارند.' 
                      : 'بەڵگەنامەکان تا پەسەندکردنی کۆتایی ڕەشنووسن.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveViewTab('ledger');
                  setApprovalStatusFilter?.('draft');
                }}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center gap-1.5 self-start sm:self-center transition-all active:scale-95"
              >
                <span>{language === 'fa' ? 'مشاهده و تایید اسناد' : 'بینین و پەسەندکردن'}</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ۱. کارت‌های خلاصه وضعیت تراز مالی */}
          <section aria-label="Financial Balance Dashboard">
            <FinancialBalanceCards
              stats={dashboardStats}
              currency={currency}
              language={language}
            />
          </section>

          {/* ۲. کاشی‌های اعلام موجودی کارت‌ها و صندوق‌ها */}
          <section aria-label="Accounts and Cash Boxes Balance Tiles">
            <AccountBalanceTiles
              accounts={financialAccounts}
              accountBalances={accountBalances}
              currency={currency}
              language={language}
              onSelectAccount={(acc) => {
                if (acc) {
                  window.dispatchEvent(new CustomEvent('karsync-open-subsidiary-ledger', {
                    detail: { type: 'account', data: acc }
                  }));
                }
              }}
              onQuickDeposit={(acc) => {
                setQuickDepositAccount(acc);
                setIsQuickAddModalOpen(true);
              }}
              onQuickTransfer={(acc) => {
                setInitialTransferSourceId(acc?.id || null);
                setIsTransferModalOpen(true);
              }}
            />
          </section>

          {/* ۳. نمودار جریان نقدینگی */}
          <section aria-label="Cash Flow Chart">
            <CashFlowChart
              chartData={cashFlowChartData}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              currency={currency}
              language={language}
            />
          </section>
        </div>
      ) : activeViewTab === 'ledger' ? (
        /* تب ۲: دفتر کل تراکنش‌ها */
        <section id="general-ledger-section" aria-label="General Ledger Table" className="animate-in fade-in duration-200">
          <GeneralLedgerTable
            ledgerItems={filteredLedgerItems}
            financialAccounts={financialAccounts}
            ledgerStats={ledgerStats}
            approvalStatusFilter={approvalStatusFilter}
            setApprovalStatusFilter={setApprovalStatusFilter}
            dateFilterMode={dateFilterMode}
            setDateFilterMode={setDateFilterMode}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            accountTypeFilter={accountTypeFilter}
            setAccountTypeFilter={setAccountTypeFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            currency={currency}
            language={language}
            projectName={currentProject?.name || 'KarSync'}
            onDeleteDraftItem={deleteDraftLedgerItem}
            onBatchDeleteDraftItems={batchDeleteDraftLedgerItems}
          />
        </section>
      ) : activeViewTab === 'income' ? (
        /* تب ۳: ورودی‌ها و تنخواه دریافتی */
        <section aria-label="Income and Petty Cash Management" className="animate-in fade-in duration-200">
          <IncomeManagementSection
            incomes={treasuryIncomes}
            onAddIncome={addIncome}
            onUpdateIncome={updateIncome}
            onDeleteIncome={deleteIncome}
            currency={currency}
            language={language}
          />
        </section>
      ) : activeViewTab === 'accounts' ? (
        /* تب ۴: تنظیمات حساب‌ها و کارت‌های بانکی */
        <section aria-label="Accounts and Cards Management" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm animate-in fade-in duration-200">
          <AccountsSettingsTab
            accounts={financialAccounts}
            accountBalances={accountBalances}
            globalOverdraftPolicy={globalOverdraftPolicy}
            onUpdateGlobalOverdraftPolicy={updateGlobalOverdraftPolicy}
            onAddAccount={addAccount}
            onUpdateAccount={updateAccount}
            onSetDefaultAccount={setDefaultAccount}
            onDeleteAccount={deleteAccount}
            onQuickDeposit={(acc) => {
              setQuickDepositAccount(acc);
              setIsQuickAddModalOpen(true);
            }}
            onQuickTransfer={(acc) => {
              setInitialTransferSourceId(acc?.id || null);
              setIsTransferModalOpen(true);
            }}
            currency={currency}
            language={language}
          />
        </section>
      ) : null}

      {/* مودال سریع ثبت واریزی */}
      {isQuickAddModalOpen && (
        <AddEditIncomeModal
          isOpen={isQuickAddModalOpen}
          onClose={() => {
            setIsQuickAddModalOpen(false);
            setQuickDepositAccount(null);
          }}
          onSave={addIncome}
          initialData={quickDepositAccount ? { accountId: quickDepositAccount.id, accountType: quickDepositAccount.type } : null}
          currency={currency}
          language={language}
        />
      )}

      {/* مودال انتقال وجه بین حساب‌ها (کارت به کارت / صندوق به بانک) */}
      {isTransferModalOpen && (
        <AccountTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setInitialTransferSourceId(null);
          }}
          onTransfer={transferBetweenAccounts}
          accounts={financialAccounts}
          accountBalances={accountBalances}
          globalOverdraftPolicy={globalOverdraftPolicy}
          initialFromAccountId={initialTransferSourceId}
          currency={currency}
          language={language}
        />
      )}

      {/* مودال مدیریت حساب‌ها (جهت پشتیبانی از باز شدن در صورت نیاز) */}
      {isAccountsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {language === 'fa' ? 'مدیریت کارت‌های بانکی و صندوق‌ها' : 'بەڕێوەبردنی کارت و سندووقەکان'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'fa' ? 'تعریف حساب‌ها و تعیین حساب پیش‌فرض برای واریز و پرداخت‌ها' : 'حیسابەکان و دیاریکردنی بنەڕەتی'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <AccountsSettingsTab
                accounts={financialAccounts}
                accountBalances={accountBalances}
                globalOverdraftPolicy={globalOverdraftPolicy}
                onUpdateGlobalOverdraftPolicy={updateGlobalOverdraftPolicy}
                onAddAccount={addAccount}
                onUpdateAccount={updateAccount}
                onSetDefaultAccount={setDefaultAccount}
                onDeleteAccount={deleteAccount}
                onQuickDeposit={(acc) => {
                  setIsAccountsModalOpen(false);
                  setQuickDepositAccount(acc);
                  setIsQuickAddModalOpen(true);
                }}
                onQuickTransfer={(acc) => {
                  setIsAccountsModalOpen(false);
                  setInitialTransferSourceId(acc?.id || null);
                  setIsTransferModalOpen(true);
                }}
                currency={currency}
                language={language}
              />
            </div>
          </div>
        </div>
      )}

      {/* مودال انتخاب بازه زمانی دلخواه اسناد مالی */}
      {isDateRangeModalOpen && (
        <DateRangeFilterModal
          isOpen={isDateRangeModalOpen}
          onClose={() => setIsDateRangeModalOpen(false)}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
          dateFilterMode={dateFilterMode}
          setDateFilterMode={setDateFilterMode}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          onApply={() => {
            setIsDateRangeModalOpen(false);
            if (activeViewTab !== 'ledger') {
              setActiveViewTab('ledger');
            }
          }}
          language={language}
        />
      )}
    </div>
  );
}
export default AccountingView;
