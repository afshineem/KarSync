import React, { useMemo } from 'react';
import { 
  formatCurrency, 
  formatAmount, 
  getCurrencySymbol 
} from '../../utils/formatters';
import { 
  Users, 
  Receipt, 
  Banknote, 
  CheckCircle2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Printer, 
  FileSpreadsheet, 
  PieChart, 
  Layers, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  ArrowRight,
  CalendarRange,
  RotateCcw
} from 'lucide-react';

const COPY = {
  fa: {
    sectionTitle: 'گزارش و آنالیز جامع مصارف پروژه',
    sectionSubtitle: 'شفاف‌سازی کامل هزینه‌ها، سهم سرفصل‌ها و جریان ورود و خروج نقدینگی',
    periodTotalSpend: 'کل مصارف و هزینه‌های دوره',
    periodTotalInflow: 'کل ورودی و شارژ تنخواه',
    periodNetCash: 'تراز خالص نقدینگی دوره',
    ratioWages: 'سهم دستمزد و تسویه‌ها:',
    ratioExpenses: 'سهم فاکتورهای کارگاه:',
    spendBreakdownTitle: 'تفکیک هوشمند سرفصل‌ها (این پول کجا خرج شده؟)',
    spendBreakdownSubtitle: 'سهم درصدی و ریالی هر بخش از مجموع کل مخارج ثبت شده',
    personnelCategoryTitle: 'دستمزد، مساعده و تسویه پرسنل',
    personnelCategoryDesc: 'مجموع پرداختی‌های قطعی بابت کارکرد، مساعده و تسویه‌حساب',
    noExpensesInPeriod: 'در این بازه زمانی هیچ هزینه‌ای ثبت نشده است.',
    transactionsCount: (cnt) => `${cnt} سند`,
    viewInLedger: 'مشاهده در دفتر کل',
    topCounterpartiesTitle: 'طرف‌حساب‌ها و دریافت‌کنندگان عمده وجه',
    topCounterpartiesSubtitle: 'فروشندگان، پیمانکاران و اشخاصی که بیشترین پرداختی را در این دوره داشته‌اند',
    noCounterparties: 'هیچ طرف‌حسابی در این بازه ثبت نشده است.',
    manageCounterparties: 'مدیریت کامل طرف‌حساب‌ها',
    printReport: 'چاپ گزارش رسمی مالی',
    exportExcel: 'خروجی اکسل کامل',
    dailyTrendTitle: 'روند روزانه نقدینگی (ورود و خروج)',
    inflowLegend: 'ورودی (تنخواه / واریز)',
    outflowLegend: 'خروجی (حقوق و هزینه‌ها)',
    surplus: 'مازاد نقدینگی',
    deficit: 'کسری نقدینگی',
    otherExpenses: 'سایر هزینه‌های جاری',
    periodMonthly: 'ماه جاری',
    periodAllTime: 'همه دوره‌ها (کل اسناد)',
    periodCustom: 'بازه دلخواه',
    prevMonth: 'ماه قبل',
    nextMonth: 'ماه بعد',
    btnViewAllTime: 'مشاهده همه اسناد مالی (کل دوره)',
    noExpensesSuggestion: 'در این ماه سندی ثبت نشده است، اما ممکن است در سایر ماه‌ها اسنادی داشته باشید.'
  },
  ku: {
    sectionTitle: 'ڕاپۆرت و شیکاریی گشتی خەرجییەکانی پڕۆژە',
    sectionSubtitle: 'ڕوونکردنەوەی تەواوی خەرجییەکان، پشکی بەشەکان و ڕۆیشتنی پارە',
    periodTotalSpend: 'کۆی خەرجییەکانی ئەم ماوەیە',
    periodTotalInflow: 'کۆی داهات و تنخوا',
    periodNetCash: 'تەرازووی پوختی نەختینە',
    ratioWages: 'پشکی مووچە و پاکتاوکردن:',
    ratioExpenses: 'پشکی فاکتەرەکانی کارگە:',
    spendBreakdownTitle: 'دابەشبوونی وردی خەرجییەکان (ئەم پارەیە لە چیدا خەرجکراوە؟)',
    spendBreakdownSubtitle: 'پشکی سەدی و بڕی پارەی هەر بەشێک لە کۆی گشتی خەرجییەکان',
    personnelCategoryTitle: 'مووچە، موساعەدە و پاکتاوی کرێکاران',
    personnelCategoryDesc: 'کۆی پارەدانی کۆتایی بۆ کارکرد، پێشینە و تەواوکاری',
    noExpensesInPeriod: 'لەەم ماوەیەدا هیچ خەرجییەک تۆمار نەکراوە.',
    transactionsCount: (cnt) => `${cnt} بەڵگەنامە`,
    viewInLedger: 'بینین لە دەفتەری گشتی',
    topCounterpartiesTitle: 'لایەنەکان و وەرگرانی سەرەکیی پارە',
    topCounterpartiesSubtitle: 'فرۆشیاران، بەڵێندەران و ئەو کەسانەی زۆرترین پارەیان پێدراوە',
    noCounterparties: 'هیچ لایەنێک لەم ماوەیەدا تۆمار نەکراوە.',
    manageCounterparties: 'بەڕێوەبردنی لایەنەکان',
    printReport: 'چاپکردنی ڕاپۆرتی فەرمی دارایی',
    exportExcel: 'هەناردەی Excelی تەواو',
    dailyTrendTitle: 'ڕەوتی ڕۆژانەی نەختینە (هاتوو و ڕۆیشتوو)',
    inflowLegend: 'هاتوو (داهات / تەنخوا)',
    outflowLegend: 'ڕۆیشتوو (مووچە و خەرجی)',
    surplus: 'زیادەی نەختینە',
    deficit: 'کەمیی نەختینە',
    otherExpenses: 'خەرجییە جۆراوجۆرەکان',
    periodMonthly: 'ئەم مانگە',
    periodAllTime: 'هەموو کاتەکان (سەرجەم بەڵگەنامەکان)',
    periodCustom: 'ماوەی دڵخواز',
    prevMonth: 'مانگی پێشوو',
    nextMonth: 'مانگی داهاتوو',
    btnViewAllTime: 'پیشاندانی سەرجەم بەڵگەنامەکان (هەمووی)',
    noExpensesSuggestion: 'لەەم مانگەدا هیچ بەڵگەنامەیەک نییە، بەڵام ڕەنگە لە مانگەکانی دیکەدا هەبێت.'
  },
  en: {
    sectionTitle: 'Comprehensive Project Spend Analytics',
    sectionSubtitle: 'Full transparency on expenses, category shares, and liquidity pulse',
    periodTotalSpend: 'Total Period Outflow',
    periodTotalInflow: 'Total Period Inflow',
    periodNetCash: 'Net Period Flow',
    ratioWages: 'Payroll & Settlements Share:',
    ratioExpenses: 'Workshop Expenses Share:',
    spendBreakdownTitle: 'Where Did The Money Go? (Spend Breakdown)',
    spendBreakdownSubtitle: 'Percentage share and volume of each expenditure category',
    personnelCategoryTitle: 'Staff Wages, Advances & Settlements',
    personnelCategoryDesc: 'Total finalized disbursements for payroll, advances, and settlements',
    noExpensesInPeriod: 'No expenses or disbursements recorded in this period.',
    transactionsCount: (cnt) => `${cnt} Records`,
    viewInLedger: 'View in Ledger',
    topCounterpartiesTitle: 'Major Payees & Counterparties',
    topCounterpartiesSubtitle: 'Suppliers, sub-contractors, and payees with highest payouts',
    noCounterparties: 'No counterparty transactions found in this period.',
    manageCounterparties: 'Manage All Counterparties',
    printReport: 'Print Official Report',
    exportExcel: 'Export Full Excel',
    dailyTrendTitle: 'Daily Liquidity Trend (Inflow vs Outflow)',
    inflowLegend: 'Inflow (Petty Cash / Deposit)',
    outflowLegend: 'Outflow (Payroll & Expenses)',
    surplus: 'Surplus',
    deficit: 'Deficit',
    otherExpenses: 'Other Operational Expenses',
    periodMonthly: 'Current Month',
    periodAllTime: 'All Time (All Records)',
    periodCustom: 'Custom Range',
    prevMonth: 'Previous Month',
    nextMonth: 'Next Month',
    btnViewAllTime: 'View All-Time Financial Records',
    noExpensesSuggestion: 'No records in this specific month, but records may exist in other periods.'
  }
};

// Preset high-contrast distinctive colors for categories
const CATEGORY_COLORS = [
  { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/20', lightBg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  { bg: 'bg-sky-500', text: 'text-sky-500', ring: 'ring-sky-500/20', lightBg: 'bg-sky-50 dark:bg-sky-950/40', border: 'border-sky-200 dark:border-sky-800' },
  { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/20', lightBg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
  { bg: 'bg-indigo-500', text: 'text-indigo-500', ring: 'ring-indigo-500/20', lightBg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-200 dark:border-indigo-800' },
  { bg: 'bg-rose-500', text: 'text-rose-500', ring: 'ring-rose-500/20', lightBg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800' },
  { bg: 'bg-purple-500', text: 'text-purple-500', ring: 'ring-purple-500/20', lightBg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800' },
  { bg: 'bg-teal-500', text: 'text-teal-500', ring: 'ring-teal-500/20', lightBg: 'bg-teal-50 dark:bg-teal-950/40', border: 'border-teal-200 dark:border-teal-800' },
  { bg: 'bg-orange-500', text: 'text-orange-500', ring: 'ring-orange-500/20', lightBg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800' }
];

export function SpendAnalyticsSection({
  spendData,
  currency = 'IQD',
  language = 'fa',
  filterMode = 'monthly',
  selectedMonth = '',
  fromDate = '',
  toDate = '',
  onSelectCategory,
  onOpenCounterparties,
  onPrint,
  onExportExcel,
  onChangeFilterMode,
  onShiftMonth,
  onOpenDateRange
}) {
  const txt = COPY[language] || COPY.fa;

  // Robust Destructuring with Dual-Naming Fallback
  const totalInflows = Number(spendData?.totalInflows ?? spendData?.totalInflow ?? 0);
  const totalOutflows = Number(spendData?.totalOutflows ?? spendData?.totalOutflow ?? 0);
  const netFlow = Number(spendData?.netFlow ?? (totalInflows - totalOutflows));
  const totalPersonnelOutflow = Number(spendData?.totalPersonnelOutflow ?? spendData?.totalWorkerOutflows ?? 0);
  const totalExpensesOutflow = Number(spendData?.totalExpensesOutflow ?? spendData?.totalWorkshopExpenses ?? 0);
  const hasAnyRecordsAllTime = Boolean(spendData?.hasAnyRecordsAllTime);

  const rawCategories = spendData?.categoriesBreakdown || spendData?.categoriesList || [];
  const rawCounterparties = spendData?.topCounterparties || spendData?.counterpartiesList || [];

  // Percentages of personnel vs expenses
  const personnelSharePercent = totalOutflows > 0 ? Math.round((totalPersonnelOutflow / totalOutflows) * 100) : 0;
  const expensesSharePercent = totalOutflows > 0 ? (100 - personnelSharePercent) : 0;

  // Normalized Categories with percent & safe properties
  const categoriesBreakdown = useMemo(() => {
    return rawCategories.map((cat, idx) => {
      const amt = Number(cat.amount) || 0;
      const pct = cat.percent !== undefined 
        ? Math.round(Number(cat.percent)) 
        : cat.percentage !== undefined 
        ? Math.round(Number(cat.percentage)) 
        : totalOutflows > 0 
        ? Math.round((amt / totalOutflows) * 100) 
        : 0;

      return {
        ...cat,
        id: cat.id || idx,
        name: cat.name || cat.title || 'سایر',
        amount: amt,
        count: Number(cat.count) || 0,
        percent: pct
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [rawCategories, totalOutflows]);

  // Normalized Counterparties with totalAmount & percent
  const topCounterparties = useMemo(() => {
    return rawCounterparties.map((cp, idx) => {
      const amt = Number(cp.totalAmount ?? cp.amount ?? 0);
      const pct = cp.percent !== undefined 
        ? Math.round(Number(cp.percent)) 
        : cp.percentage !== undefined 
        ? Math.round(Number(cp.percentage)) 
        : totalOutflows > 0 
        ? Math.round((amt / totalOutflows) * 100) 
        : 0;

      return {
        ...cp,
        id: cp.id || idx,
        name: cp.name || cp.workerName || cp.vendorName || 'نامشخص',
        totalAmount: amt,
        amount: amt,
        count: Number(cp.count) || 1,
        type: cp.type || 'counterparty',
        percent: pct
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [rawCounterparties, totalOutflows]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ======================================================== */}
      {/* 0. LIQUID GLASS PERIOD & FILTER BAR (نوار هوشمند فیلتر) */}
      {/* ======================================================== */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-white/60 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {txt.sectionTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {filterMode === 'all' 
                ? txt.periodAllTime 
                : filterMode === 'custom' 
                ? `${fromDate || ''} - ${toDate || ''}` 
                : `${txt.periodMonthly}: ${selectedMonth || ''}`}
            </p>
          </div>
        </div>

        {/* Quick Filter Segmented Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold overflow-x-auto max-w-full">
          
          {/* Monthly Button with Steppers */}
          <div className="flex items-center gap-0.5">
            {onShiftMonth && (
              <button
                type="button"
                onClick={() => onShiftMonth(language === 'en' ? -1 : 1)}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
                title={txt.prevMonth}
              >
                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onChangeFilterMode && onChangeFilterMode('monthly')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                filterMode === 'monthly'
                  ? 'bg-sky-500 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{txt.periodMonthly}</span>
              {selectedMonth && <span className="ms-1 font-mono text-[11px] opacity-90 dir-ltr inline-block">({selectedMonth})</span>}
            </button>

            {onShiftMonth && (
              <button
                type="button"
                onClick={() => onShiftMonth(language === 'en' ? 1 : -1)}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
                title={txt.nextMonth}
              >
                <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
              </button>
            )}
          </div>

          {/* All-Time Button */}
          {onChangeFilterMode && (
            <button
              type="button"
              onClick={() => onChangeFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-sky-500 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {txt.periodAllTime}
            </button>
          )}

          {/* Custom Date Range Trigger */}
          {onOpenDateRange && (
            <button
              type="button"
              onClick={onOpenDateRange}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'custom'
                  ? 'bg-amber-500 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>{filterMode === 'custom' && fromDate ? `${fromDate} - ${toDate}` : txt.periodCustom}</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. TOP 3 EXECUTIVE KPI TILES (کل مصارف، ورودی، تراز خالص) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Tile 1: کل مصارف و هزینه‌ها (Outflow) */}
        <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {txt.periodTotalSpend}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-900/40">
              <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight" dir="ltr">
              {formatAmount(totalOutflows, currency)}
              <span className="text-xs font-bold text-slate-400 ms-1.5">{getCurrencySymbol(currency, language)}</span>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{txt.ratioWages} <strong className="text-slate-800 dark:text-slate-200 font-mono">{personnelSharePercent}%</strong></span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>{txt.ratioExpenses} <strong className="text-slate-800 dark:text-slate-200 font-mono">{expensesSharePercent}%</strong></span>
            </div>
          </div>
        </div>

        {/* Tile 2: کل ورودی و تنخواه (Inflow) */}
        <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {txt.periodTotalInflow}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-900/40">
              <ArrowDownLeft className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight" dir="ltr">
              {formatAmount(totalInflows, currency)}
              <span className="text-xs font-bold text-slate-400 ms-1.5">{getCurrencySymbol(currency, language)}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              {txt.inflowLegend}
            </p>
          </div>
        </div>

        {/* Tile 3: تراز خالص دوره (Net Flow) */}
        <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {txt.periodNetCash}
            </span>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              netFlow >= 0 
                ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border-sky-200/60 dark:border-sky-900/40' 
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40'
            }`}>
              {netFlow >= 0 ? <TrendingUp className="w-5 h-5 stroke-[2.2]" /> : <TrendingDown className="w-5 h-5 stroke-[2.2]" />}
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              netFlow >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'
            }`} dir="ltr">
              {formatAmount(netFlow, currency)}
              <span className="text-xs font-bold text-slate-400 ms-1.5">{getCurrencySymbol(currency, language)}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${netFlow >= 0 ? 'bg-sky-500' : 'bg-amber-500'}`} />
              <span>{netFlow >= 0 ? txt.surplus : txt.deficit}</span>
            </p>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 2. THE LIQUID SPEND BREAKDOWN BAR («این پول کجا خرج شده؟») */}
      {/* ======================================================== */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-sky-500" />
              <span>{txt.spendBreakdownTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {txt.spendBreakdownSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto no-print">
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title={txt.exportExcel}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">{txt.exportExcel}</span>
              </button>
            )}

            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title={txt.printReport}
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">{txt.printReport}</span>
              </button>
            )}
          </div>
        </div>

        {/* N-Color Proportional Segmented Bar */}
        {totalOutflows > 0 && categoriesBreakdown.length > 0 ? (
          <div className="space-y-2">
            <div className="h-6 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 flex overflow-hidden gap-1 border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
              {categoriesBreakdown.map((cat, idx) => {
                const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                const widthPercent = Math.max(cat.percent, 2); // Minimum 2% so small segments remain visible
                return (
                  <div
                    key={cat.id || idx}
                    style={{ width: `${widthPercent}%` }}
                    className={`h-full rounded-lg ${color.bg} transition-all duration-300 relative group cursor-pointer hover:opacity-90`}
                    title={`${cat.name}: ${cat.percent}% (${formatAmount(cat.amount, currency)} ${getCurrencySymbol(currency, language)})`}
                    onClick={() => onSelectCategory && onSelectCategory(cat.id || cat.name)}
                  />
                );
              })}
            </div>

            {/* Quick Legend Badges below the bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {categoriesBreakdown.map((cat, idx) => {
                const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                return (
                  <div
                    key={cat.id || idx}
                    onClick={() => onSelectCategory && onSelectCategory(cat.id || cat.name)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer hover:border-sky-400 transition-all"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${color.bg} shrink-0`} />
                    <span className="font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                    <span className="font-mono font-black text-slate-500 dark:text-slate-400">{cat.percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <p>{txt.noExpensesInPeriod}</p>
            {filterMode !== 'all' && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onChangeFilterMode && onChangeFilterMode('all')}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/25 transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{txt.btnViewAllTime}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detailed Category Cards Grid */}
        {categoriesBreakdown.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
            {categoriesBreakdown.map((cat, idx) => {
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              return (
                <div
                  key={cat.id || idx}
                  onClick={() => onSelectCategory && onSelectCategory(cat.id || cat.name)}
                  className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-200 border ${color.border} ${color.lightBg} hover:shadow-md cursor-pointer flex flex-col justify-between space-y-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl ${color.bg} text-white flex items-center justify-center font-bold shrink-0 shadow-xs`}>
                        {cat.isPayroll ? <Users className="w-4.5 h-4.5" /> : <Layers className="w-4.5 h-4.5" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 dark:text-white text-xs truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {cat.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {txt.transactionsCount(cat.count || 0)}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono ${color.bg} text-white shadow-xs`}>
                      {cat.percent}%
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono" dir="ltr">
                        {formatCurrency(cat.amount, currency, language)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform cursor-pointer"
                    >
                      <span>{txt.viewInLedger}</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* 3. MAJOR PAYEES & COUNTERPARTIES (طرف‌حساب‌های عمده)      */}
      {/* ======================================================== */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-500" />
              <span>{txt.topCounterpartiesTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {txt.topCounterpartiesSubtitle}
            </p>
          </div>

          {onOpenCounterparties && (
            <button
              type="button"
              onClick={onOpenCounterparties}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer active:scale-95 no-print"
            >
              <span>{txt.manageCounterparties}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          )}
        </div>

        {topCounterparties && topCounterparties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {topCounterparties.map((cp, idx) => (
              <div
                key={cp.id || idx}
                className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:border-indigo-400 transition-all"
              >
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                    {cp.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {cp.type === 'worker' ? txt.personnelCategoryTitle : cp.type || txt.otherExpenses} • {txt.transactionsCount(cp.count || 1)}
                  </span>
                </div>

                <div className="text-end shrink-0">
                  <span className="font-mono font-black text-xs sm:text-sm text-slate-900 dark:text-white block" dir="ltr">
                    {formatAmount(cp.totalAmount, currency)}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-500 font-mono">
                    {cp.percent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <p>{txt.noCounterparties}</p>
            {filterMode !== 'all' && (
              <button
                type="button"
                onClick={() => onChangeFilterMode && onChangeFilterMode('all')}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <span>{txt.btnViewAllTime}</span>
                <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </button>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
