import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { usePermissions } from '../context/AuthContext';
import { useAccounting } from '../hooks/useAccounting';
import * as XLSX from 'xlsx';
import { 
  formatCurrency, 
  formatAmount, 
  formatHoursDigital, 
  getCurrentYearMonth, 
  getTodayDateString, 
  roundCurrency, 
  getCurrencySymbol, 
  formatMonthOnly 
} from '../utils/formatters';

// Modals
import { SettlementModal } from './SettlementModal';
import { AdvancePaymentModal } from './AdvancePaymentModal';
import { WorkerFinancialProfileModal } from './WorkerFinancialProfileModal';
import { EditPaymentModal } from './EditPaymentModal';
import { AddEditIncomeModal } from './accounting/AddEditIncomeModal';
import { AccountTransferModal } from './accounting/AccountTransferModal';
import { AddEditAccountModal } from './accounting/AddEditAccountModal';
import { AccountSubsidiaryLedgerModal } from './accounting/AccountSubsidiaryLedgerModal';
import { CounterpartiesView } from './CounterpartiesView';
import { SpendAnalyticsSection } from './accounting/SpendAnalyticsSection';
import { GeneralLedgerTable } from './accounting/GeneralLedgerTable';
import { StaffLoansSection } from './accounting/StaffLoansSection';

// Utilities & LiveSync
import { calculateWorkerFinancials } from '../utils/settlementCalculations.js';
import { 
  pushPaymentsLive, 
  recordPendingPaymentDeletion, 
  rollbackPaymentSettlement 
} from '../services/realtimeSync';

// Icons
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
  CalendarRange, 
  Users, 
  Check, 
  X, 
  Trash2, 
  Edit3, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Archive, 
  RotateCcw, 
  BookOpen, 
  CreditCard, 
  ArrowLeftRight, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Landmark, 
  LayoutGrid, 
  List, 
  Sparkles, 
  Download, 
  FileSpreadsheet,
  Filter,
  Eye,
  Plus,
  Briefcase,
  Printer,
  BarChart3,
  PieChart,
  Building2,
  TrendingUp,
  TrendingDown,
  Calculator
} from 'lucide-react';

const SUMMARY_LAYOUT_KEY = 'karsync_financials_worker_layout';
const FINANCIAL_SECTION_KEY = 'karsync_financials_active_section';


const COPY = {
  fa: {
    pageTitle: 'حسابداری و امور مالی',
    pageSubtitle: 'مرکز مقتدر پایش نقدینگی، تسویه‌حساب پرسنل، حساب‌های بانکی و دفتر روزنامه',
    settlementRecord: 'تسویه حساب پرسنل',
    advancePayment: 'مساعده پرسنل',
    staffFallback: 'پرسنل',
    cashboxFallback: 'صندوق نقدی',
    noTransactionsToExport: 'هیچ تراکنشی برای خروجی اکسل وجود ندارد.',
    excelColDate: 'تاریخ',
    excelColTitle: 'عنوان تراکنش',
    excelColParty: 'طرف حساب / پرسنل',
    excelColAccount: 'منبع پرداخت / صندوق',
    excelColAmount: (curr) => 'مبلغ (' + curr + ')',
    excelColNotes: 'توضیحات',
    counterpartiesBtn: 'طرف‌حساب‌ها و کارفرمایان',
    counterpartiesLabel: 'طرف‌حساب‌ها',
    subsidiarySearchBtn: 'جستجوی معین افراد و حساب‌ها (Shift+M)',
    subsidiarySearchLabel: 'سرچ معین',
    exportExcelBtn: 'خروجی اکسل دفتر مالی',
    printPdfBtn: 'چاپ گزارش مالی',
    treasuryPulse: 'نبض زنده مالی و خزانه‌داری پروژه',
    prevMonth: 'ماه قبل',
    nextMonth: 'ماه بعد',
    totalLiquidity: 'موجودی کل نقدینگی در صندوق‌ها و کارت‌های بانکی',
    accountsUnit: 'حساب',
    wagesDue: 'مطالبات پرسنل:',
    netLiquidity: 'تراز نقدینگی:',
    dueCrew: 'دارای طلب:',
    personsUnit: 'نفر',
    depositAction: 'شارژ حساب / ورود پول',
    advanceAction: 'پرداخت مساعده',
    settlementAction: 'تسویه حساب پرسنل',
    transferAction: 'انتقال بین حساب‌ها',
    workerBalancesTab: 'تراز و کارنامه پرسنل',
    workerBalancesTabShort: 'کارنامه',
    loansTab: 'وام و تسهیلات',
    loansTabShort: 'وام‌ها',
    accountsTab: 'صندوق‌ها و حساب‌های مالی',
    accountsTabShort: 'حساب‌ها',
    ledgerTab: 'دفتر روزنامه تراکنش‌ها',
    ledgerTabShort: 'دفتر کل',
    customDateRange: 'فیلتر بازه زمانی دلخواه',
    dateRange: 'بازه زمانی',
    addAccount: 'تعریف حساب یا کارت بانکی جدید',
    newAccount: 'حساب جدید',
    allFilter: 'همه',
    dueFilter: 'طلبکاران',
    settledFilter: 'تسویه‌شده',
    searchCrewPlaceholder: 'جستجوی نام پرسنل...',
    cardViewTitle: 'نمایش کارتی',
    cardViewLabel: 'کارت',
    listViewTitle: 'نمایش لیستی',
    listViewLabel: 'لیست',
    noWorkersFound: 'هیچ کارگری با این مشخصات یافت نشد.',
    staffRoleFallback: 'پرسنل کارگاه',
    fullSettled: 'تسویه کامل',
    hasDue: 'دارای طلب',
    grossEarnings: 'کل کارکرد ناخالص',
    advanceReceived: 'مساعده دریافتی',
    netDue: 'خالص مانده طلب',
    recordAdvanceTooltip: 'ثبت مساعده برای این نیرو',
    settleBtn: 'تسویه',
    dueBalance: 'مانده طلب',
    cashboxNameFallback: 'صندوق نقدی کارگاه',
    bankAccountFallback: 'حساب بانکی',
    transactionsUnit: 'تراکنش',
    bankType: 'بانکی',
    cashType: 'نقدی',
    currentBalanceHint: 'موجودی فعلی (برای مشاهده تراکنش‌ها کلیک کنید)',
    editAccountTooltip: 'ویرایش حساب',
    depositShort: 'شارژ',
    ledgerTitle: 'دفتر روزنامه تراکنش‌های مالی و پرداختی‌ها',
    recordedTransactions: 'تراکنش ثبت‌شده',
    exportExcel: 'خروجی اکسل',
    noTransactionsInPeriod: 'هیچ تراکنشی در این دوره ثبت نشده است.',
    thDate: 'تاریخ',
    thDesc: 'شرح و نوع تراکنش',
    thParty: 'طرف حساب / پرسنل',
    thAccountSource: 'صندوق / منبع پرداخت',
    thAmount: (sym) => 'مبلغ تراکنش (' + sym + ')',
    thActions: 'عملیات',
    viewAndEditTooltip: 'مشاهده و ویرایش',
    manageCounterpartiesModalTitle: 'مدیریت طرف‌حساب‌ها و کارفرمایان',
    dateRangeModalTitle: 'انتخاب بازه زمانی دلخواه',
    fromDateLabel: 'از تاریخ',
    toDateLabel: 'تا تاریخ',
    cancelBtn: 'انصراف',
    confirmRangeBtn: 'تایید بازه',
    analyticsTab: 'گزارش و آنالیز مصارف',
    analyticsTabShort: 'آنالیز',
    heroTreasuryTab: 'موجودی و خزانه',
    heroFlowTab: 'گردش مالی ماه',
    periodTotalSpend: 'کل مصارف و هزینه‌ها',
    periodTotalInflow: 'کل ورودی تنخواه:',
    periodNetCash: 'تراز خالص دوره:',
    outflowDocsCount: 'سند پرداختی',
    thCategory: 'سرفصل هزینه',
    thFlow: 'جریان',
    flowIn: 'ورودی',
    flowOut: 'خروجی',
    flowTransfer: 'انتقال',
    workshopExpense: 'هزینه کارگاه',
    pettyCashIncome: 'شارژ تنخواه / واریز',
    transferTitle: 'انتقال حساب به حساب',
    printReportHeader: 'صورت وضعیت مالی و عملکرد خزانه‌داری کارگاه',
    reportPeriod: 'دوره گزارش:',
    printDate: 'تاریخ چاپ:',
    accountantSign: 'امضای حسابدار / امور مالی',
    projectManagerSign: 'امضای مدیر کارگاه / پروژه',
    employerSign: 'امضای کارفرما / سرمایه‌گذار',
    allCategories: 'همه سرفصل‌ها',
    activeFilterCategory: (name) => `فیلتر سرفصل فعال: ${name}`,
    clearFilter: 'حذف فیلتر',
    draftBannerTitle: (cnt) => `تعداد ${cnt} سند مالی موقت (پیش‌نویس) در انتظار تأیید نهایی شماست.`,
    draftBannerDesc: 'اسناد تسویه‌حساب، مساعده و هزینه‌ها تا زمان تأیید نهایی مدیر در وضعیت پیش‌نویس قرار دارند.',
    reviewAndApproveBtn: 'بررسی و تأیید اسناد'
  },
  ku: {
    pageTitle: 'حیسابداری و کاروباری دارایی',
    pageSubtitle: 'ناوەندی بەڕێوەبردنی نەختینە، تەرازووی کرێکاران، حیسابە بانکییەکان و دەفتەری گشتی',
    settlementRecord: 'تەواوکاری و پاکتاوی کرێکاران',
    advancePayment: 'موساعەدەی کرێکاران',
    staffFallback: 'کرێکار',
    cashboxFallback: 'سندوقی کاش',
    noTransactionsToExport: 'هیچ مامەڵەیەک بۆ هەناردەکردنی Excel نییە.',
    excelColDate: 'بەروار',
    excelColTitle: 'بابەتی مامەڵە',
    excelColParty: 'لایەنی بەرامبەر / کرێکار',
    excelColAccount: 'سەرچاوەی پارەدان / سندوق',
    excelColAmount: (curr) => 'بڕ (' + curr + ')',
    excelColNotes: 'تێبینی',
    counterpartiesBtn: 'لایەنەکان و خاوەنکارەکان',
    counterpartiesLabel: 'لایەنەکان',
    subsidiarySearchBtn: 'گەڕانی دەفتەری حیسابی کەسەکان و حیسابەکان (Shift+M)',
    subsidiarySearchLabel: 'گەڕانی معین',
    exportExcelBtn: 'هەناردەی Excel بۆ دەفتەری دارایی',
    printPdfBtn: 'چاپکردنی ڕاپۆرتی دارایی',
    treasuryPulse: 'لێدانی ڕاستەوخۆی دارایی و خەزێنەی پڕۆژە',
    prevMonth: 'مانگی پێشوو',
    nextMonth: 'مانگی داهاتوو',
    totalLiquidity: 'کۆی گشتی نەختینە لە سندوق و کارتە بانکییەکاندا',
    accountsUnit: 'حیساب',
    wagesDue: 'شایستەی کرێکاران:',
    netLiquidity: 'تەرازووی نەختینە:',
    dueCrew: 'خاوەن ماف:',
    personsUnit: 'کەس',
    depositAction: 'بارکردنی حیساب / هێنانی پارە',
    advanceAction: 'پارەدانی موساعەدە',
    settlementAction: 'تەواوکاری و پاکتاوی کرێکاران',
    transferAction: 'گواستنەوەی نێوان حیسابەکان',
    workerBalancesTab: 'تەرازووی کرێکاران',
    workerBalancesTabShort: 'تەرازوو',
    loansTab: 'قەرز و ئاسانکاری',
    loansTabShort: 'قەرزەکان',
    accountsTab: 'سندوق و کارتەکان',
    accountsTabShort: 'حیسابەکان',
    ledgerTab: 'دەفتەری گشتی',
    ledgerTabShort: 'دەفتەر',
    customDateRange: 'ماوەی بەرواری دڵخواز',
    dateRange: 'ماوەی بەروار',
    addAccount: 'پێناسەکردنی حیساب یان کارتی نوێ',
    newAccount: 'حیسابی نوێ',
    allFilter: 'هەموو',
    dueFilter: 'خاوەن مافەکان',
    settledFilter: 'پاکتاوکراوەکان',
    searchCrewPlaceholder: 'گەڕان بەپێی ناوی کرێکار...',
    cardViewTitle: 'پیشاندانی کارتی',
    cardViewLabel: 'کارت',
    listViewTitle: 'پیشاندانی لیستی',
    listViewLabel: 'لیست',
    noWorkersFound: 'هیچ کرێکارێک بەم زانیارییانە نەدۆزرایەوە.',
    staffRoleFallback: 'کرێکاری کارگە',
    fullSettled: 'پاکتاوی تەواو',
    hasDue: 'مافی ماوە',
    grossEarnings: 'کۆی گشتی شایستە',
    advanceReceived: 'موساعەدەی وەرگیراو',
    netDue: 'ماوەی تەواوی شایستە',
    recordAdvanceTooltip: 'تۆمارکردنی موساعەدە بۆ ئەم کرێکارە',
    settleBtn: 'پاکتاو',
    dueBalance: 'ماوەی شایستە',
    cashboxNameFallback: 'سندوقی کاشی کارگە',
    bankAccountFallback: 'حیسابی بانکی',
    transactionsUnit: 'مامەڵە',
    bankType: 'بانکی',
    cashType: 'کاش',
    currentBalanceHint: 'باڵانسی ئێستا (کلیک بکە بۆ بینینی مامەڵەکان)',
    editAccountTooltip: 'دەستکاریکردنی حیساب',
    depositShort: 'بارکردن',
    ledgerTitle: 'دەفتەری گشتیی مامەڵە داراییەکان و پارەدانەکان',
    recordedTransactions: 'مامەڵەی تۆمارکراو',
    exportExcel: 'هەناردەی Excel',
    noTransactionsInPeriod: 'هیچ مامەڵەیەک لەم ماوەیەدا تۆمار نەکراوە.',
    thDate: 'بەروار',
    thDesc: 'ڕوونکردنەوە و جۆری مامەڵە',
    thParty: 'لایەنی بەرامبەر / کرێکار',
    thAccountSource: 'سندوق / سەرچاوەی پارەدان',
    thAmount: (sym) => 'بڕی مامەڵە (' + sym + ')',
    thActions: 'کردارەکان',
    viewAndEditTooltip: 'بینین و دەستکاریکردن',
    manageCounterpartiesModalTitle: 'بەڕێوەبردنی لایەنەکان و خاوەنکارەکان',
    dateRangeModalTitle: 'دیاریکردنی ماوەی بەرواری دڵخواز',
    fromDateLabel: 'لە بەرواری',
    toDateLabel: 'بۆ بەرواری',
    cancelBtn: 'پاشگەزبوونەوە',
    confirmRangeBtn: 'پەسەندکردنی ماوە',
    analyticsTab: 'ڕاپۆرت و شیکاری خەرجییەکان',
    analyticsTabShort: 'شیکاری',
    heroTreasuryTab: 'باڵانس و خەزێنە',
    heroFlowTab: 'ڕۆیشتنی پارەی مانگ',
    periodTotalSpend: 'کۆی خەرجی و دەرچووەکان',
    periodTotalInflow: 'کۆی داهاتی تنخوا:',
    periodNetCash: 'باڵانسی پوختی مانگ:',
    outflowDocsCount: 'بەڵگەنامەی خەرجی',
    thCategory: 'بەشی خەرجی',
    thFlow: 'جۆری ڕۆیشتن',
    flowIn: 'داهات',
    flowOut: 'خەرجی',
    flowTransfer: 'گواستنەوە',
    workshopExpense: 'خەرجی کارگە',
    pettyCashIncome: 'داهات / تەنخوا',
    transferTitle: 'گواستنەوەی نێوان حیسابەکان',
    printReportHeader: 'ڕاپۆرتی دارایی و کارکردی خەزێنەی کارگە',
    reportPeriod: 'ماوەی ڕاپۆرت:',
    printDate: 'بەرواری چاپ:',
    accountantSign: 'واژۆی ژمێریار',
    projectManagerSign: 'واژۆی بەڕێوەبەری پڕۆژە',
    employerSign: 'واژۆی خاوەنکار',
    allCategories: 'هەموو بەشەکان',
    activeFilterCategory: (name) => `فلتەری بەشی چالاک: ${name}`,
    clearFilter: 'سڕینەوەی فلتەر',
    draftBannerTitle: (cnt) => `${cnt} بەڵگەنامەی دارایی چاوەڕوانی پەسەندکردنی کۆتاییە.`,
    draftBannerDesc: 'بەڵگەنامە تۆمارکراوەکان تا پەسەندکردنی بەڕێوەبەر لە دۆخی ڕەشنووسدان.',
    reviewAndApproveBtn: 'پشکنین و پەسەندکردنی بەڵگەنامەکان'
  },
  en: {
    pageTitle: 'Finance & Accounting',
    pageSubtitle: 'Command center for liquidity tracking, crew settlements, accounts & general ledger',
    settlementRecord: 'Worker Settlement',
    advancePayment: 'Worker Advance',
    staffFallback: 'Worker',
    cashboxFallback: 'Cash Register',
    noTransactionsToExport: 'No transactions to export.',
    excelColDate: 'Date',
    excelColTitle: 'Transaction Title',
    excelColParty: 'Party / Worker',
    excelColAccount: 'Payment Source / Account',
    excelColAmount: (curr) => 'Amount (' + curr + ')',
    excelColNotes: 'Notes',
    counterpartiesBtn: 'Counterparties & Employers',
    counterpartiesLabel: 'Counterparties',
    subsidiarySearchBtn: 'Search Subsidiary Ledger (Shift+M)',
    subsidiarySearchLabel: 'Search Ledger',
    exportExcelBtn: 'Export Ledger to Excel',
    printPdfBtn: 'Print Financial Report',
    treasuryPulse: 'Project Financial & Treasury Pulse',
    prevMonth: 'Previous Month',
    nextMonth: 'Next Month',
    totalLiquidity: 'Total Cash Balance in Registers & Bank Accounts',
    accountsUnit: 'Accounts',
    wagesDue: 'Wages Due:',
    netLiquidity: 'Net Liquidity:',
    dueCrew: 'Due Crew:',
    personsUnit: 'Workers',
    depositAction: 'Deposit / Cash Inflow',
    advanceAction: 'Pay Advance',
    settlementAction: 'Final Settlement',
    transferAction: 'Account Transfer',
    workerBalancesTab: 'Worker Balances',
    workerBalancesTabShort: 'Balances',
    loansTab: 'Staff Loans',
    loansTabShort: 'Loans',
    accountsTab: 'Accounts & Wallets',
    accountsTabShort: 'Accounts',
    ledgerTab: 'Financial Ledger',
    ledgerTabShort: 'Ledger',
    customDateRange: 'Custom Date Range',
    dateRange: 'Date Range',
    addAccount: 'Add Account / Bank Card',
    newAccount: 'New Account',
    allFilter: 'All',
    dueFilter: 'Due Crew',
    settledFilter: 'Settled',
    searchCrewPlaceholder: 'Search crew name...',
    cardViewTitle: 'Card View',
    cardViewLabel: 'Card',
    listViewTitle: 'List View',
    listViewLabel: 'List',
    noWorkersFound: 'No workers found matching this criteria.',
    staffRoleFallback: 'Site Worker',
    fullSettled: 'Fully Settled',
    hasDue: 'Has Due Balance',
    grossEarnings: 'Gross Wages',
    advanceReceived: 'Advance Received',
    netDue: 'Net Due Balance',
    recordAdvanceTooltip: 'Record advance for this worker',
    settleBtn: 'Settle',
    dueBalance: 'Due Balance',
    cashboxNameFallback: 'Site Cash Register',
    bankAccountFallback: 'Bank Account',
    transactionsUnit: 'Transactions',
    bankType: 'Bank',
    cashType: 'Cash',
    currentBalanceHint: 'Current balance (click to view ledger)',
    editAccountTooltip: 'Edit Account',
    depositShort: 'Deposit',
    ledgerTitle: 'General Financial & Payment Ledger',
    recordedTransactions: 'Transactions Recorded',
    exportExcel: 'Excel Export',
    noTransactionsInPeriod: 'No transactions recorded in this period.',
    thDate: 'Date',
    thDesc: 'Description & Transaction Type',
    thParty: 'Party / Worker',
    thAccountSource: 'Account / Source',
    thAmount: (sym) => 'Amount (' + sym + ')',
    thActions: 'Actions',
    viewAndEditTooltip: 'View & Edit',
    manageCounterpartiesModalTitle: 'Manage Counterparties & Employers',
    dateRangeModalTitle: 'Select Custom Date Range',
    fromDateLabel: 'From Date',
    toDateLabel: 'To Date',
    cancelBtn: 'Cancel',
    confirmRangeBtn: 'Apply Range',
    analyticsTab: 'Spend Analytics',
    analyticsTabShort: 'Analytics',
    heroTreasuryTab: 'Treasury Health',
    heroFlowTab: 'Monthly Flow',
    periodTotalSpend: 'Total Period Outflows',
    periodTotalInflow: 'Total Period Inflow:',
    periodNetCash: 'Net Period Flow:',
    outflowDocsCount: 'Paid Invoices',
    thCategory: 'Category',
    thFlow: 'Flow',
    flowIn: 'Inflow',
    flowOut: 'Outflow',
    flowTransfer: 'Transfer',
    workshopExpense: 'Workshop Expense',
    pettyCashIncome: 'Petty Cash Recharge / Deposit',
    transferTitle: 'Account Transfer',
    printReportHeader: 'Workshop Treasury & Financial Statement',
    reportPeriod: 'Report Period:',
    printDate: 'Printed on:',
    accountantSign: 'Accountant Signature',
    projectManagerSign: 'Project Manager Signature',
    employerSign: 'Employer / Client Signature',
    allCategories: 'All Categories',
    activeFilterCategory: (name) => `Active Category Filter: ${name}`,
    clearFilter: 'Clear Filter',
    draftBannerTitle: (cnt) => `${cnt} draft financial documents are awaiting your final approval.`,
    draftBannerDesc: 'Recorded settlements, advances, and expenses remain in draft status until approved by admin.',
    reviewAndApproveBtn: 'Review & Approve Documents'
  }
};

export function FinancialsView() {
  const { t, language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = COPY[langKey];
  const { currentProject, dateFilter, setDateFilter, openWorkerProfile } = useProject();
  const currency = currentProject?.currency || 'IQD';
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // Active main section: 'analytics' | 'workers' | 'loans' | 'accounts' | 'ledger'
  const [activeSection, setActiveSectionState] = useState(() => {
    try {
      const saved = localStorage.getItem(FINANCIAL_SECTION_KEY);
      return saved && ['analytics', 'workers', 'loans', 'accounts', 'ledger'].includes(saved) ? saved : 'analytics';
    } catch {
      return 'analytics';
    }
  });

  const setActiveSection = (sec) => {
    setActiveSectionState(sec);
    try {
      localStorage.setItem(FINANCIAL_SECTION_KEY, sec);
    } catch (_) {}
  };

  // Hero view mode: 'flow' (گردش مالی و مصارف ماه) | 'treasury' (وضعیت موجودی صندوق و طلب کارگران)
  const [heroMode, setHeroMode] = useState('flow');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('all');

  // Month & Date filters
  const selectedMonth = dateFilter.month || getCurrentYearMonth();
  const setSelectedMonth = (m) => setDateFilter((prev) => ({ ...prev, month: m }));
  const [filterMode, setFilterMode] = useState('monthly'); // 'monthly' | 'custom'
  const [fromDate, setFromDate] = useState(() => `${getCurrentYearMonth()}-01`);
  const [toDate, setToDate] = useState(() => getTodayDateString());
  const [tempFromDate, setTempFromDate] = useState(fromDate);
  const [tempToDate, setTempToDate] = useState(toDate);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('all');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('all'); // 'all' | 'due' | 'settled'

  // Workers layout mode: 'grid' | 'list'
  const [workerLayoutMode, setWorkerLayoutMode] = useState(() => {
    try {
      return localStorage.getItem(SUMMARY_LAYOUT_KEY) || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleSetWorkerLayoutMode = (mode) => {
    setWorkerLayoutMode(mode);
    try {
      localStorage.setItem(SUMMARY_LAYOUT_KEY, mode);
    } catch (_) {}
  };

  // Accounting Hook (Supplies Treasury, Accounts, and Two-Stage Approval Ledger logic)
  const {
    financialAccounts: accounts = [],
    accountBalances = new Map(),
    addIncome,
    updateIncome,
    transferBetweenAccounts,
    addAccount,
    updateAccount,
    globalOverdraftPolicy = 'ask_each_time',
    filteredLedgerItems = [],
    ledgerStats = { total: 0, draft: 0, approved: 0, amended: 0 },
    approvalStatusFilter,
    setApprovalStatusFilter,
    dateFilterMode: ledgerDateFilterMode,
    setDateFilterMode: setLedgerDateFilterMode,
    selectedMonth: ledgerSelectedMonth,
    setSelectedMonth: setLedgerSelectedMonth,
    customStartDate: ledgerCustomStartDate,
    setCustomStartDate: setLedgerCustomStartDate,
    customEndDate: ledgerCustomEndDate,
    setCustomEndDate: setLedgerCustomEndDate,
    categoryFilter: ledgerCatFilter,
    setCategoryFilter: setLedgerCatFilter,
    accountTypeFilter: ledgerAccountTypeFilter,
    setAccountTypeFilter: setLedgerAccountTypeFilter,
    searchQuery: ledgerSearchQuery,
    setSearchQuery: setLedgerSearchQuery,
    deleteDraftLedgerItem,
    batchDeleteDraftLedgerItems
  } = useAccounting();

  const { hasPermission } = usePermissions();
  const canManageSettlement = hasPermission('settlement.manage');
  const canManageAccounting = hasPermission('accounting.manage');

  // Listen for notification or external command to open the Ledger & filter drafts
  useEffect(() => {
    try {
      const pendingFilter = localStorage.getItem('karsync_financials_approval_filter');
      if (pendingFilter) {
        setActiveSection('ledger');
        setApprovalStatusFilter?.(pendingFilter);
        setLedgerDateFilterMode?.('all');
        localStorage.removeItem('karsync_financials_approval_filter');
      }
    } catch (_) {}

    const handleOpenLedgerEvent = (e) => {
      setActiveSection('ledger');
      if (e.detail?.filterStatus) {
        setApprovalStatusFilter?.(e.detail.filterStatus);
        setLedgerDateFilterMode?.('all');
      }
    };
    const handleOpenPaymentEdit = (e) => {
      if (e.detail?.payment) {
        setEditingPayment(e.detail.payment);
      }
    };
    window.addEventListener('karsync-open-financial-ledger', handleOpenLedgerEvent);
    window.addEventListener('karsync-open-payment-modal', handleOpenPaymentEdit);
    return () => {
      window.removeEventListener('karsync-open-financial-ledger', handleOpenLedgerEvent);
      window.removeEventListener('karsync-open-payment-modal', handleOpenPaymentEdit);
    };
  }, [setApprovalStatusFilter, setLedgerDateFilterMode]);

  const handleSaveIncome = async (data) => {
    if (data.id) {
      await updateIncome(data.id, data);
    } else {
      await addIncome(data);
    }
  };

  const handleTransferFunds = async (transferData) => {
    await transferBetweenAccounts(transferData);
  };

  const handleSaveAccount = async (accData) => {
    if (accData.id) {
      await updateAccount(accData.id, accData);
    } else {
      await addAccount(accData);
    }
  };

  // Modals state
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementTargetWorker, setSettlementTargetWorker] = useState(null);
  const [settlementInitialMode, setSettlementInitialMode] = useState('individual');
  const [settlementInitialGroupId, setSettlementInitialGroupId] = useState(null);
  const [advanceTargetWorker, setAdvanceTargetWorker] = useState(null);
  const [isGlobalAdvanceModalOpen, setIsGlobalAdvanceModalOpen] = useState(false);
  const [isGlobalLoanModalOpen, setIsGlobalLoanModalOpen] = useState(false);
  const [historyTargetWorker, setHistoryTargetWorker] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [isCounterpartiesModalOpen, setIsCounterpartiesModalOpen] = useState(false);

  // Live query for active loans count (for tab badge)
  const activeLoansList = useLiveQuery(
    async () => {
      if (!db.loans) return [];
      const list = await db.loans.toArray();
      return list.filter((l) => !l.deletedAt && l.status === 'active' && (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  // Live Queries for Workers, Logs & Payments
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  const groups = useLiveQuery(
    async () => {
      const list = await db.groups.toArray();
      return list.filter((g) => !g.projectId || g.projectId === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  const groupMap = useMemo(() => {
    const map = {};
    groups.forEach((g) => { map[g.id] = g; });
    return map;
  }, [groups]);

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

  const allExpenses = useLiveQuery(
    async () => {
      if (!db.expenses) return [];
      const list = await db.expenses.toArray();
      return list.filter((e) => (e.projectId || DEFAULT_PROJECT_ID) === targetProjectId && !e.deletedAt);
    },
    [targetProjectId]
  ) || [];

  const expenseCategories = useLiveQuery(
    async () => {
      if (!db.expenseCategories) return [];
      return await db.expenseCategories.toArray();
    },
    []
  ) || [];

  const categoryMap = useMemo(() => {
    const map = {};
    expenseCategories.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [expenseCategories]);

  const allIncomes = useLiveQuery(
    async () => {
      if (!db.treasuryIncomes) return [];
      const list = await db.treasuryIncomes.toArray();
      return list.filter((inc) => (inc.projectId || DEFAULT_PROJECT_ID) === targetProjectId && !inc.deletedAt);
    },
    [targetProjectId]
  ) || [];

  const allTransfers = useLiveQuery(
    async () => {
      if (!db.accountTransfers) return [];
      const list = await db.accountTransfers.toArray();
      return list.filter((tr) => (tr.projectId || DEFAULT_PROJECT_ID) === targetProjectId && !tr.deletedAt);
    },
    [targetProjectId]
  ) || [];

  const counterparties = useLiveQuery(
    async () => {
      if (!db.counterparties) return [];
      const list = await db.counterparties.toArray();
      return list.filter((cp) => (cp.projectId || DEFAULT_PROJECT_ID) === targetProjectId && !cp.deletedAt);
    },
    [targetProjectId]
  ) || [];

  const counterpartiesMap = useMemo(() => {
    const map = {};
    counterparties.forEach((cp) => {
      map[cp.id] = cp;
    });
    return map;
  }, [counterparties]);

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

  // Date period helper for analytics & ledger
  const isInSelectedPeriod = (dateStr) => {
    if (!dateStr) return false;
    const cleanDate = String(dateStr).slice(0, 10);
    if (filterMode === 'all') {
      return true;
    }
    if (filterMode === 'monthly') {
      return cleanDate.startsWith(selectedMonth);
    }
    if (filterMode === 'custom' && fromDate && toDate) {
      return cleanDate >= fromDate && cleanDate <= toDate;
    }
    return true;
  };

  // Comprehensive Spend & Outflow Analytics (ماه جاری یا بازه انتخابی)
  const spendData = useMemo(() => {
    let totalWorkerOutflows = 0;
    let workerAdvanceTotal = 0;
    let workerSettlementTotal = 0;
    let totalWorkshopExpenses = 0;
    let totalInflow = 0;
    let totalTransfers = 0;

    const categoryAggregates = {};
    const counterpartyAggregates = {};

    // 1. Worker Payments (Advances + Settlements)
    allPayments.forEach((p) => {
      if (p.deletedAt) return;
      const pDate = p.date || p.createdAt?.slice(0, 10);
      if (!isInSelectedPeriod(pDate)) return;

      const amt = Number(p.amount) || 0;
      totalWorkerOutflows += amt;

      const catKey = p.type === 'settlement' ? 'settlements' : 'advances';
      const catName = p.type === 'settlement' ? c.settlementRecord : c.advancePayment;
      const catColor = p.type === 'settlement' ? '#0ea5e9' : '#f59e0b';

      if (p.type === 'settlement') workerSettlementTotal += amt;
      else workerAdvanceTotal += amt;

      if (!categoryAggregates[catKey]) {
        categoryAggregates[catKey] = {
          id: catKey,
          name: catName,
          amount: 0,
          count: 0,
          color: catColor,
          isPayroll: true
        };
      }
      categoryAggregates[catKey].amount += amt;
      categoryAggregates[catKey].count += 1;

      // Track worker as counterparty
      const wName = p.workerName || workers.find((w) => String(w.id) === String(p.workerId))?.name || c.staffFallback;
      if (!counterpartyAggregates[wName]) {
        counterpartyAggregates[wName] = { name: wName, amount: 0, count: 0, type: 'worker' };
      }
      counterpartyAggregates[wName].amount += amt;
      counterpartyAggregates[wName].count += 1;
    });

    // 2. Workshop Operational Expenses (از جدول db.expenses)
    allExpenses.forEach((exp) => {
      if (exp.deletedAt) return;
      const eDate = exp.expenseDate || exp.date || exp.createdAt?.slice(0, 10);
      if (!isInSelectedPeriod(eDate)) return;

      const amt = Number(exp.amount) || 0;
      totalWorkshopExpenses += amt;

      const catObj = exp.categoryId ? categoryMap[exp.categoryId] : null;
      const catId = exp.categoryId ? String(exp.categoryId) : 'uncategorized';
      const catName = catObj?.name || exp.categoryName || c.workshopExpense;
      const catColor = catObj?.color || '#8b5cf6';

      if (!categoryAggregates[catId]) {
        categoryAggregates[catId] = {
          id: catId,
          name: catName,
          amount: 0,
          count: 0,
          color: catColor,
          isPayroll: false
        };
      }
      categoryAggregates[catId].amount += amt;
      categoryAggregates[catId].count += 1;

      // Track Counterparty (فروشنده / پیمانکار جزء / خدمات)
      const cpName = exp.counterpartyName || counterpartiesMap[exp.counterpartyId]?.name || exp.vendorName || c.workshopExpense;
      if (!counterpartyAggregates[cpName]) {
        counterpartyAggregates[cpName] = { name: cpName, amount: 0, count: 0, type: 'vendor' };
      }
      counterpartyAggregates[cpName].amount += amt;
      counterpartyAggregates[cpName].count += 1;
    });

    // 3. Incomes / Deposits into accounts
    allIncomes.forEach((inc) => {
      if (inc.deletedAt) return;
      const incDate = inc.date || inc.createdAt?.slice(0, 10);
      if (!isInSelectedPeriod(incDate)) return;
      totalInflow += Number(inc.amount) || 0;
    });

    // 4. Transfers between accounts
    allTransfers.forEach((tr) => {
      if (tr.deletedAt) return;
      const trDate = tr.date || tr.createdAt?.slice(0, 10);
      if (!isInSelectedPeriod(trDate)) return;
      totalTransfers += Number(tr.amount) || 0;
    });

    const totalOutflow = totalWorkerOutflows + totalWorkshopExpenses;

    // Check if there are any transactions across all-time in the project
    const hasAnyRecordsAllTime = (allPayments.length + allExpenses.length + allIncomes.length) > 0;

    // Convert category aggregates to sorted array with percentages
    const categoriesList = Object.values(categoryAggregates)
      .map((cat) => {
        const amt = Number(cat.amount) || 0;
        const pct = totalOutflow > 0 ? (amt / totalOutflow) * 100 : 0;
        return {
          ...cat,
          amount: amt,
          percentage: pct,
          percent: Math.round(pct)
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const counterpartiesList = Object.values(counterpartyAggregates)
      .map((cp) => {
        const amt = Number(cp.amount) || 0;
        const pct = totalOutflow > 0 ? (amt / totalOutflow) * 100 : 0;
        return {
          ...cp,
          amount: amt,
          totalAmount: amt,
          percentage: pct,
          percent: Math.round(pct)
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return {
      // Both naming conventions for total outflow
      totalOutflow,
      totalOutflows: totalOutflow,
      // Both naming conventions for total inflow
      totalInflow,
      totalInflows: totalInflow,
      // Net flow
      netFlow: totalInflow - totalOutflow,
      // Subtotals
      totalWorkerOutflows,
      totalPersonnelOutflow: totalWorkerOutflows,
      workerAdvanceTotal,
      workerSettlementTotal,
      totalWorkshopExpenses,
      totalExpensesOutflow: totalWorkshopExpenses,
      totalTransfers,
      // Lists and breakdowns (supporting both property names)
      categoriesList,
      categoriesBreakdown: categoriesList,
      counterpartiesList,
      topCounterparties: counterpartiesList,
      hasAnyRecordsAllTime
    };
  }, [allPayments, allExpenses, allIncomes, allTransfers, categoryMap, counterpartiesMap, workers, filterMode, selectedMonth, fromDate, toDate, c]);

  // Month navigation helpers
  const handleShiftMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
    setFilterMode('monthly');
  };

  // Worker Financials Matrix
  const workerFinancials = useMemo(() => {
    return workers.map((worker) => {
      const workerLogs = allLogs.filter((l) => String(l.workerId) === String(worker.id));
      const workerPayments = allPayments.filter(
        (p) => String(p.workerId) === String(worker.id) || (worker.groupId && p.groupId === worker.groupId)
      );
      return calculateWorkerFinancials(worker, workerLogs, workerPayments);
    });
  }, [workers, allLogs, allPayments]);

  // Aggregate Metrics for Hero Cockpit
  const heroMetrics = useMemo(() => {
    // 1. Total liquid balance across all active accounts
    let totalCashBalance = 0;
    accounts.forEach((acc) => {
      const entry = accountBalances?.get?.(String(acc.id));
      const bal = entry ? (Number(entry.currentBalance) || 0) : (Number(acc.initialBalance) || 0);
      totalCashBalance += bal;
    });

    // 2. Total pending wage dues across all active workers
    let totalWagesDue = 0;
    let totalWagesGross = 0;
    let totalAdvancesPaid = 0;
    let workersWithDueCount = 0;

    workerFinancials.forEach((wf) => {
      totalWagesGross += wf.unsettledGross;
      totalAdvancesPaid += wf.unsettledAdvances;
      if (wf.netBalanceDue > 0) {
        totalWagesDue += wf.netBalanceDue;
        workersWithDueCount += 1;
      }
    });

    // 3. Net Liquidity Status (Cash minus Pending Due)
    const netLiquidity = totalCashBalance - totalWagesDue;

    return {
      totalCashBalance: roundCurrency(totalCashBalance, currency),
      totalWagesDue: roundCurrency(totalWagesDue, currency),
      netLiquidity: roundCurrency(netLiquidity, currency),
      totalWagesGross: roundCurrency(totalWagesGross, currency),
      totalAdvancesPaid: roundCurrency(totalAdvancesPaid, currency),
      workersWithDueCount,
      activeWorkersCount: workers.filter((w) => w.isActive === 1).length
    };
  }, [accounts, accountBalances, workerFinancials, workers, currency]);

  // Filtered workers list
  const displayedWorkers = useMemo(() => {
    return workerFinancials.filter((wf) => {
      if (selectedWorkerId !== 'all' && String(wf.worker.id) !== String(selectedWorkerId)) return false;
      if (workerStatusFilter === 'due' && wf.netBalanceDue <= 0) return false;
      if (workerStatusFilter === 'settled' && wf.netBalanceDue > 0) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (wf.worker.name || '').toLowerCase().includes(q);
        const matchRole = (wf.worker.role || '').toLowerCase().includes(q);
        const matchGroup = (groupMap[wf.worker.groupId]?.name || '').toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchGroup) return false;
      }
      return true;
    }).sort((a, b) => b.netBalanceDue - a.netBalanceDue); // Sort by highest outstanding due first
  }, [workerFinancials, selectedWorkerId, workerStatusFilter, searchTerm, groupMap]);

  // Unified Transactions Ledger List (پرداختی‌ها، هزینه‌های کارگاه، واریزی‌ها و انتقالات)
  const ledgerTransactions = useMemo(() => {
    const list = [];

    // 1. Payments to Workers (Advance & Settlement)
    allPayments
      .filter((p) => !p.deletedAt)
      .forEach((p) => {
        const pDate = p.date || p.createdAt?.slice(0, 10) || '';
        if (!isInSelectedPeriod(pDate)) return;

        const isSettlement = p.type === 'settlement';
        const categoryKey = isSettlement ? 'settlements' : 'advances';

        // Filter by category if set
        if (ledgerCategoryFilter !== 'all' && ledgerCategoryFilter !== categoryKey) return;

        list.push({
          id: `payment_${p.id}`,
          date: pDate,
          timestamp: new Date(pDate || 0).getTime(),
          category: categoryKey,
          categoryName: isSettlement ? c.settlementRecord : c.advancePayment,
          title: isSettlement ? c.settlementRecord : c.advancePayment,
          party: p.workerName || (workers.find((w) => String(w.id) === String(p.workerId))?.name) || c.staffFallback,
          amount: Number(p.amount) || 0,
          flow: 'out',
          accountId: p.accountId || null,
          accountName: p.accountName || (accounts.find((a) => String(a.id) === String(p.accountId))?.name) || '',
          notes: p.notes || '',
          raw: p
        });
      });

    // 2. Workshop Expenses (هزینه‌های کارگاه، متریال، فاکتورها)
    allExpenses
      .filter((e) => !e.deletedAt)
      .forEach((exp) => {
        const eDate = exp.expenseDate || exp.date || exp.createdAt?.slice(0, 10) || '';
        if (!isInSelectedPeriod(eDate)) return;

        const catId = exp.categoryId ? String(exp.categoryId) : 'uncategorized';
        if (ledgerCategoryFilter !== 'all' && ledgerCategoryFilter !== catId) return;

        const catObj = exp.categoryId ? categoryMap[exp.categoryId] : null;
        const catName = catObj?.name || exp.categoryName || c.workshopExpense;
        const partyName = exp.counterpartyName || counterpartiesMap[exp.counterpartyId]?.name || exp.vendorName || c.workshopExpense;

        list.push({
          id: `expense_${exp.id}`,
          date: eDate,
          timestamp: new Date(eDate || 0).getTime(),
          category: catId,
          categoryName: catName,
          title: exp.title || exp.description || catName,
          party: partyName,
          amount: Number(exp.amount) || 0,
          flow: 'out',
          accountId: exp.accountId || null,
          accountName: exp.accountName || (accounts.find((a) => String(a.id) === String(exp.accountId))?.name) || '',
          notes: exp.notes || exp.description || '',
          raw: exp
        });
      });

    // 3. Incomes & Deposits (واریزی‌ها و شارژ تنخواه)
    if (ledgerCategoryFilter === 'all' || ledgerCategoryFilter === 'incomes') {
      allIncomes
        .filter((inc) => !inc.deletedAt)
        .forEach((inc) => {
          const incDate = inc.date || inc.createdAt?.slice(0, 10) || '';
          if (!isInSelectedPeriod(incDate)) return;

          list.push({
            id: `income_${inc.id}`,
            date: incDate,
            timestamp: new Date(incDate || 0).getTime(),
            category: 'incomes',
            categoryName: c.pettyCashIncome,
            title: inc.source || inc.title || c.pettyCashIncome,
            party: inc.payerName || inc.source || c.pettyCashIncome,
            amount: Number(inc.amount) || 0,
            flow: 'in',
            accountId: inc.accountId || null,
            accountName: inc.accountName || (accounts.find((a) => String(a.id) === String(inc.accountId))?.name) || '',
            notes: inc.notes || inc.description || '',
            raw: inc
          });
        });
    }

    // 4. Transfers between accounts
    if (ledgerCategoryFilter === 'all' || ledgerCategoryFilter === 'transfers') {
      allTransfers
        .filter((tr) => !tr.deletedAt)
        .forEach((tr) => {
          const trDate = tr.date || tr.createdAt?.slice(0, 10) || '';
          if (!isInSelectedPeriod(trDate)) return;

          const fromAccName = accounts.find((a) => String(a.id) === String(tr.fromAccountId))?.name || '';
          const toAccName = accounts.find((a) => String(a.id) === String(tr.toAccountId))?.name || '';

          list.push({
            id: `transfer_${tr.id}`,
            date: trDate,
            timestamp: new Date(trDate || 0).getTime(),
            category: 'transfers',
            categoryName: c.transferTitle,
            title: `${fromAccName} -> ${toAccName}`,
            party: c.transferTitle,
            amount: Number(tr.amount) || 0,
            flow: 'transfer',
            accountId: tr.fromAccountId || null,
            accountName: `${fromAccName} -> ${toAccName}`,
            notes: tr.notes || tr.description || '',
            raw: tr
          });
        });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [allPayments, allExpenses, allIncomes, allTransfers, categoryMap, counterpartiesMap, workers, accounts, ledgerCategoryFilter, filterMode, selectedMonth, fromDate, toDate, c]);

  // Export Comprehensive Financials to Multi-Sheet Excel
  const handleExportLedgerExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Spend & Cash Flow Summary
    const summaryRows = [
      { [c.thCategory]: c.periodTotalSpend, [c.excelColAmount(currency)]: spendData.totalOutflow },
      { [c.thCategory]: c.periodTotalInflow, [c.excelColAmount(currency)]: spendData.totalInflow },
      { [c.thCategory]: c.periodNetCash, [c.excelColAmount(currency)]: spendData.netFlow },
      {},
      { [c.thCategory]: '=== ' + c.analyticsTab + ' ===', [c.excelColAmount(currency)]: '' },
      ...spendData.categoriesList.map((cat) => ({
        [c.thCategory]: cat.name,
        [c.excelColAmount(currency)]: cat.amount,
        '%': Math.round(cat.percentage) + '%',
        Count: cat.count
      }))
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Summary_Analytics');

    // Sheet 2: General Ledger Transactions
    if (ledgerTransactions.length > 0) {
      const ledgerRows = ledgerTransactions.map((tx) => ({
        [c.excelColDate]: tx.date,
        [c.thFlow]: tx.flow === 'in' ? c.flowIn : tx.flow === 'out' ? c.flowOut : c.flowTransfer,
        [c.thCategory]: tx.categoryName || '',
        [c.excelColTitle]: tx.title,
        [c.excelColParty]: tx.party,
        [c.excelColAccount]: tx.accountName || c.cashboxFallback,
        [c.excelColAmount(currency)]: tx.amount,
        [c.excelColNotes]: tx.notes || ''
      }));
      const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);
      XLSX.utils.book_append_sheet(workbook, wsLedger, 'General_Ledger');
    }

    // Sheet 3: Worker Balances & Wage Dues
    const workerRows = displayedWorkers.map((wf) => ({
      Worker: wf.worker.name,
      Role: wf.worker.role || '',
      UnsettledGross: wf.unsettledGross,
      UnsettledAdvances: wf.unsettledAdvances,
      NetBalanceDue: wf.netBalanceDue
    }));
    const wsWorkers = XLSX.utils.json_to_sheet(workerRows);
    XLSX.utils.book_append_sheet(workbook, wsWorkers, 'Worker_Balances');

    const periodLabel = filterMode === 'monthly' ? selectedMonth : `${fromDate}_${toDate}`;
    XLSX.writeFile(workbook, `KarSync_Financial_Report_${periodLabel}.xlsx`);
  };

  // Quick Action Handlers
  const handleOpenIndividualSettlement = (worker = null) => {
    const target = worker || displayedWorkers.find((w) => w.netBalanceDue > 0)?.worker || workers[0];
    if (target) {
      setSettlementTargetWorker(target);
      setSettlementInitialMode(target.teamRole === 'Master' && target.groupId ? 'group' : 'individual');
      setSettlementInitialGroupId(target.groupId || null);
      setIsSettlementModalOpen(true);
    }
  };

  const handleOpenAdvance = (worker = null) => {
    if (worker) {
      setAdvanceTargetWorker(worker);
    } else {
      setIsGlobalAdvanceModalOpen(true);
    }
  };

  return (
    <div className="space-y-5 select-none pb-12 animate-in fade-in duration-300">

      {/* ======================================================== */}
      {/* 1. TOP HEADER (همگام با زبان طراحی کارسینک و گزارش کارکرد)  */}
      {/* ======================================================== */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Right: Module Title & Icon */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 shrink-0">
              <Landmark className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                {c.pageTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {c.pageSubtitle}
              </p>
            </div>
          </div>

          {/* Left: General Utilities Dock (همگام با داک گزارش کارکرد) */}
          <div className="h-[52px] sm:h-[56px] flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner shrink-0 backdrop-blur-md self-end sm:self-auto">
            {/* دکمه طرف‌حساب‌ها */}
            {canManageAccounting && (
              <button
                type="button"
                onClick={() => setIsCounterpartiesModalOpen(true)}
                className="h-full px-2.5 sm:px-3 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-white hover:bg-sky-500 dark:hover:bg-sky-500 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs bg-sky-500/10 dark:bg-sky-500/10 border border-sky-500/20"
                title={c.counterpartiesBtn}
              >
                <Briefcase className="w-4.5 h-4.5 shrink-0" />
                <span className="hidden sm:inline">{c.counterpartiesLabel}</span>
              </button>
            )}

            {/* دکمه سرچ معین (Shift+M) */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('karsync-open-subsidiary-search'))}
              className="h-full px-2.5 sm:px-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-500 dark:hover:bg-emerald-500 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20"
              title={c.subsidiarySearchBtn}
              aria-label={c.subsidiarySearchLabel}
            >
              <Search className="w-4.5 h-4.5 shrink-0" />
              <span className="hidden sm:inline">{c.subsidiarySearchLabel}</span>
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* خروجی اکسل */}
            <button
              type="button"
              onClick={handleExportLedgerExcel}
              className="h-full aspect-square text-slate-500 hover:text-emerald-600 hover:bg-white/80 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-700/60 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center cursor-pointer"
              title={c.exportExcelBtn}
            >
              <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
            </button>

            {/* چاپ و پرینت */}
            <button
              type="button"
              onClick={() => window.print()}
              className="h-full aspect-square text-slate-500 hover:text-sky-600 hover:bg-white/80 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:bg-slate-700/60 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center cursor-pointer"
              title={c.printPdfBtn}
            >
              <Printer className="w-4.5 h-4.5 shrink-0" />
            </button>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. EXECUTIVE HERO COCKPIT (نمای مقتدر دارک و شیشه‌ای)    */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Main Financial Metrics */}
          <div className={`${(canManageAccounting || canManageSettlement) ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Dual Mode Switcher: Flow vs Treasury */}
              <div className="inline-flex items-center p-1 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setHeroMode('flow')}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                    heroMode === 'flow'
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>{c.heroFlowTab}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroMode('treasury')}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                    heroMode === 'treasury'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>{c.heroTreasuryTab}</span>
                </button>
              </div>

              {/* Month Switcher Pill */}
              <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(direction === 'rtl' ? 1 : -1)}
                  className="p-1.5 hover:bg-white/20 rounded-xl transition-all text-white cursor-pointer"
                  title={c.prevMonth}
                >
                  {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <div className="relative flex items-center justify-center cursor-pointer min-w-[6.5rem]">
                  <span className="text-xs font-bold text-white px-2 py-0.5">
                    {formatMonthOnly(selectedMonth, language)}
                  </span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      setFilterMode('monthly');
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleShiftMonth(direction === 'rtl' ? -1 : 1)}
                  className="p-1.5 hover:bg-white/20 rounded-xl transition-all text-white cursor-pointer"
                  title={c.nextMonth}
                >
                  {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Big Headline Figure: Depends on heroMode */}
            {heroMode === 'flow' ? (
              <div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2">
                  <span className="text-rose-400">{formatAmount(spendData.totalOutflow, currency)}</span>
                  <span className="text-sm sm:text-base font-bold text-slate-300">{getCurrencySymbol(currency, language)}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <span>{c.periodTotalSpend}</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span className="text-rose-400 font-bold font-mono">
                    {spendData.categoriesList.reduce((acc, cat) => acc + cat.count, 0)} {c.outflowDocsCount}
                  </span>
                </p>
              </div>
            ) : (
              <div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2">
                  <span>{formatAmount(heroMetrics.totalCashBalance, currency)}</span>
                  <span className="text-sm sm:text-base font-bold text-sky-400">{getCurrencySymbol(currency, language)}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <span>{c.totalLiquidity}</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-emerald-400 font-bold font-mono">{accounts.length} {c.accountsUnit}</span>
                </p>
              </div>
            )}

            {/* Quick Metrics Badges */}
            {heroMode === 'flow' ? (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-300">{c.periodTotalInflow}</span>
                  <span className="font-black text-emerald-300 font-mono">
                    {formatAmount(spendData.totalInflow, currency)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span className="text-slate-300">{c.periodNetCash}</span>
                  <span className={`font-black font-mono ${spendData.netFlow >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                    {formatAmount(spendData.netFlow, currency)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-slate-300">{c.categoriesTitle}:</span>
                  <span className="font-black text-white font-mono">{spendData.categoriesList.length}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-slate-300">{c.wagesDue}</span>
                  <span className="font-black text-amber-300 font-mono">
                    {formatAmount(heroMetrics.totalWagesDue, currency)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-300">{c.netLiquidity}</span>
                  <span className={`font-black font-mono ${heroMetrics.netLiquidity >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                    {formatAmount(heroMetrics.netLiquidity, currency)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span className="text-slate-300">{c.dueCrew}</span>
                  <span className="font-black text-white">{heroMetrics.workersWithDueCount} {c.personsUnit}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Dock (4 Action Buttons) */}
          {(canManageAccounting || canManageSettlement) && (
            <div className="lg:col-span-5 grid grid-cols-2 gap-2.5 sm:gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              {/* 1. شارژ حساب / ورودی پول */}
              {canManageAccounting && (
                <button
                  type="button"
                  onClick={() => setIsIncomeModalOpen(true)}
                  className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>{c.depositAction}</span>
                </button>
              )}

              {/* 2. پرداخت مساعده */}
              {canManageSettlement && (
                <button
                  type="button"
                  onClick={() => handleOpenAdvance()}
                  className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs shadow-lg shadow-amber-500/25 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <Banknote className="w-4 h-4" />
                  <span>{c.advanceAction}</span>
                </button>
              )}

              {/* 3. ثبت تسویه حساب نهایی */}
              {canManageSettlement && (
                <button
                  type="button"
                  onClick={() => handleOpenIndividualSettlement()}
                  className="col-span-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{c.settlementAction}</span>
                </button>
              )}

              {/* 4. انتقال وجه بین حساب‌ها */}
              {canManageAccounting && (
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="col-span-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                  <span>{c.transferAction}</span>
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ======================================================== */}
      {/* 2.5 PENDING APPROVALS BANNER (اسناد موقت در انتظار تایید) */}
      {/* ======================================================== */}
      {ledgerStats?.draft > 0 && activeSection !== 'ledger' && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 dark:from-amber-950/40 dark:via-amber-900/40 dark:to-amber-950/40 border border-amber-300/80 dark:border-amber-700/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top duration-200 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                {c.draftBannerTitle(ledgerStats.draft)}
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                {c.draftBannerDesc}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveSection('ledger');
              setApprovalStatusFilter?.('draft');
              setLedgerDateFilterMode?.('all');
            }}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/25 flex items-center gap-1.5 self-start sm:self-center transition-all active:scale-95 cursor-pointer"
          >
            <span>{c.reviewAndApproveBtn}</span>
            {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. CENTRAL SEGMENTED CONTROLLER (تم یکپارچه دکمه کارسینک) */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap no-print">
        
        {/* Main 4 Section Tabs (APP_THEME_BUTTON style) */}
        <div className="h-[50px] sm:h-[56px] w-full sm:w-auto max-w-full overflow-x-auto no-scrollbar flex items-center justify-between sm:justify-start gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner backdrop-blur-md">
          {[
            {
              id: 'analytics',
              label: c.analyticsTab,
              shortLabel: c.analyticsTabShort,
              icon: BarChart3
            },
            {
              id: 'workers',
              label: c.workerBalancesTab,
              shortLabel: c.workerBalancesTabShort,
              icon: Users
            },
            {
              id: 'loans',
              label: c.loansTab,
              shortLabel: c.loansTabShort,
              icon: Calculator,
              badge: activeLoansList.length > 0 ? activeLoansList.length : null
            },
            {
              id: 'accounts',
              label: c.accountsTab,
              shortLabel: c.accountsTabShort,
              icon: Landmark
            },
            {
              id: 'ledger',
              label: c.ledgerTab,
              shortLabel: c.ledgerTabShort,
              icon: Receipt,
              badge: ledgerStats?.draft > 0 ? ledgerStats.draft : null
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                aria-label={tab.label}
                title={tab.label}
                className={`relative h-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'flex-1 sm:flex-initial bg-sky-500 text-white shadow-md shadow-sky-500/30 font-bold px-3 sm:px-4'
                    : 'px-2 sm:px-3 text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                {isSelected && (
                  <span className="text-xs font-semibold whitespace-nowrap animate-in fade-in duration-200">
                    <span className="inline sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </span>
                )}
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black leading-none ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side helper dock: Custom Range, New Account */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Custom Date Range Filter */}
          <button
            type="button"
            onClick={() => {
              setTempFromDate(fromDate);
              setTempToDate(toDate);
              setIsDateRangeModalOpen(true);
            }}
            className={`h-[52px] sm:h-[56px] px-3.5 rounded-2xl border transition-all duration-200 flex items-center gap-2 text-xs font-bold cursor-pointer active:scale-95 ${
              filterMode === 'custom'
                ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/25'
                : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title={c.customDateRange}
          >
            <CalendarRange className="w-4 h-4" />
            <span className="hidden sm:inline">
              {filterMode === 'custom' ? `${fromDate} - ${toDate}` : c.dateRange}
            </span>
          </button>

          {/* New Account Button (Accessible in Accounts section or always) */}
          {canManageAccounting && (
            <button
              type="button"
              onClick={() => {
                setEditingAccount(null);
                setIsAccountModalOpen(true);
              }}
              className="h-[52px] sm:h-[56px] px-3.5 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              title={c.addAccount}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{c.newAccount}</span>
            </button>
          )}

        </div>

      </div>

      {/* ======================================================== */}
      {/* 4. SECTION 0: SPEND & OUTFLOW ANALYTICS (گزارش و آنالیز) */}
      {/* ======================================================== */}
      {activeSection === 'analytics' && (
        <SpendAnalyticsSection
          spendData={spendData}
          currency={currency}
          language={language}
          filterMode={filterMode}
          selectedMonth={selectedMonth}
          fromDate={fromDate}
          toDate={toDate}
          onSelectCategory={(catId) => {
            if (catId === 'settlements') {
              setLedgerCatFilter?.('worker_settlement');
              setLedgerSearchQuery?.('');
            } else if (catId === 'advances') {
              setLedgerCatFilter?.('advance_payment');
              setLedgerSearchQuery?.('');
            } else {
              setLedgerCatFilter?.('workshop_expense');
              const catObj = (spendData.categoriesList || spendData.categoriesBreakdown || []).find(
                (c) => c.id === catId || c.name === catId
              );
              setLedgerSearchQuery?.(catObj?.name || '');
            }
            setActiveSection('ledger');
          }}
          onPrintReport={() => window.print()}
          onOpenCounterparties={() => setIsCounterpartiesModalOpen(true)}
          onChangeFilterMode={(mode) => setFilterMode(mode)}
          onShiftMonth={handleShiftMonth}
          onSelectMonth={(m) => {
            setSelectedMonth(m);
            setFilterMode('monthly');
          }}
          onOpenDateRange={() => {
            setTempFromDate(fromDate);
            setTempToDate(toDate);
            setIsDateRangeModalOpen(true);
          }}
        />
      )}

      {/* ======================================================== */}
      {/* 4. SECTION 1: WORKER FINANCIAL BALANCES (کارنامه پرسنل)  */}
      {/* ======================================================== */}
      {activeSection === 'workers' && (
        <div className="space-y-4">
          
          {/* Subheader: Status filter, Search, Layout switcher */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/70 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-md">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              {[
                { id: 'all', label: c.allFilter },
                { id: 'due', label: c.dueFilter },
                { id: 'settled', label: c.settledFilter }
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setWorkerStatusFilter(st.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    workerStatusFilter === st.id
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute start-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={c.searchCrewPlaceholder}
                className="w-full ps-9 pe-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Layout Mode Switcher (Grid vs List) */}
            <div className="inline-flex items-center p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleSetWorkerLayoutMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 ease-in-out cursor-pointer ${
                  workerLayoutMode === 'grid'
                    ? 'bg-sky-500 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title={c.cardViewTitle}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {workerLayoutMode === 'grid' && (
                  <span className="text-[11px] whitespace-nowrap">{c.cardViewLabel}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSetWorkerLayoutMode('list')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 ease-in-out cursor-pointer ${
                  workerLayoutMode === 'list'
                    ? 'bg-sky-500 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title={c.listViewTitle}
              >
                <List className="w-3.5 h-3.5" />
                {workerLayoutMode === 'list' && (
                  <span className="text-[11px] whitespace-nowrap">{c.listViewLabel}</span>
                )}
              </button>
            </div>
          </div>

          {/* Workers Content Canvas */}
          {displayedWorkers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 text-xs">
              {c.noWorkersFound}
            </div>
          ) : workerLayoutMode === 'grid' ? (
            /* Mode 1: Grid Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedWorkers.map((wf) => {
                const isSettled = wf.netBalanceDue <= 0;
                return (
                  <div
                    key={wf.worker.id}
                    className="group relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 hover:border-sky-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between space-y-4"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center font-black text-sky-600 dark:text-sky-400 text-sm shadow-xs">
                          {wf.worker.name?.charAt(0) || 'W'}
                        </div>
                        <div>
                          <h4 
                            onClick={() => openWorkerProfile(wf.worker.id)}
                            className="font-black text-slate-900 dark:text-white text-sm hover:text-sky-500 transition-colors cursor-pointer"
                          >
                            {wf.worker.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {wf.worker.role || c.staffRoleFallback}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                        isSettled
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                      }`}>
                        {isSettled ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        <span>{isSettled ? c.fullSettled : c.hasDue}</span>
                      </span>
                    </div>

                    {/* Breakdown Capsule */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{c.grossEarnings}</span>
                        <span className="font-bold font-mono text-slate-700 dark:text-slate-200">
                          {formatAmount(wf.unsettledGross, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">{c.advanceReceived}</span>
                        <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                          {formatAmount(wf.unsettledAdvances, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Due Amount & Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{c.netDue}</span>
                        <span className={`text-base font-black font-mono ${wf.netBalanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatCurrency(wf.netBalanceDue, currency, language)}
                        </span>
                      </div>

                      {canManageSettlement && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAdvance(wf.worker)}
                            className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-xl transition-all cursor-pointer"
                            title={c.recordAdvanceTooltip}
                          >
                            <Banknote className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenIndividualSettlement(wf.worker)}
                            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                          >
                            {c.settleBtn}
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            /* Mode 2: Compact 2-Column List */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {displayedWorkers.map((wf) => {
                const isSettled = wf.netBalanceDue <= 0;
                return (
                  <div
                    key={wf.worker.id}
                    className="group relative overflow-hidden rounded-2xl px-4 py-3 backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-black/20 hover:border-sky-400 transition-all duration-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500/15 to-indigo-500/15 border border-sky-400/25 flex items-center justify-center font-black text-sky-600 dark:text-sky-400 text-xs shrink-0">
                        {wf.worker.name?.charAt(0) || 'W'}
                      </div>
                      <div className="min-w-0">
                        <h4 
                          onClick={() => openWorkerProfile(wf.worker.id)}
                          className="font-black text-slate-900 dark:text-white text-xs hover:text-sky-500 transition-colors truncate cursor-pointer"
                        >
                          {wf.worker.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium block truncate">
                          {wf.worker.role || c.staffFallback}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-end">
                        <span className="text-[9px] text-slate-400 block font-bold">{c.dueBalance}</span>
                        <span className={`font-mono font-black text-xs sm:text-sm block ${wf.netBalanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatCurrency(wf.netBalanceDue, currency, language)}
                        </span>
                      </div>

                      {canManageSettlement && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenAdvance(wf.worker)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-all cursor-pointer"
                            title={c.recordAdvanceTooltip}
                          >
                            <Banknote className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenIndividualSettlement(wf.worker)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                          >
                            {c.settleBtn}
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* 4.5. SECTION 1.5: STAFF LOANS & FACILITIES (وام و تسهیلات) */}
      {/* ======================================================== */}
      {activeSection === 'loans' && (
        <StaffLoansSection onOpenNewLoanModal={() => setIsGlobalLoanModalOpen(true)} />
      )}

      {/* ======================================================== */}
      {/* 5. SECTION 2: ACCOUNTS & TREASURY (صندوق‌ها و حساب‌ها)   */}
      {/* ======================================================== */}
      {activeSection === 'accounts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const entry = accountBalances?.get?.(String(acc.id));
              const bal = entry ? (Number(entry.currentBalance) || 0) : (Number(acc.initialBalance) || 0);
              const txCount = entry?.transactions?.length || 0;
              const isBank = acc.type === 'bank';
              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountForLedger(acc)}
                  className="group relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 hover:border-sky-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between space-y-4 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${
                        isBank 
                          ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-sky-500/25' 
                          : 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/25'
                      }`}>
                        {isBank ? <CreditCard className="w-6 h-6 stroke-[2]" /> : <Landmark className="w-6 h-6 stroke-[2]" />}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-sm group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {acc.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {isBank ? (acc.bankName || c.bankAccountFallback) : c.cashboxNameFallback}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
                        {txCount} {c.transactionsUnit}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {isBank ? c.bankType : c.cashType}
                      </span>
                    </div>
                  </div>

                  {/* Account Numbers if any */}
                  {isBank && acc.cardNumber && (
                    <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-xs text-slate-600 dark:text-slate-300 text-center tracking-wider">
                      {acc.cardNumber}
                    </div>
                  )}

                  {/* Balance Display */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">{c.currentBalanceHint}</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                        {formatCurrency(bal, currency, language)}
                      </span>
                    </div>

                    {canManageAccounting && (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAccount(acc);
                            setIsAccountModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                          title={c.editAccountTooltip}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsIncomeModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>{c.depositShort}</span>
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. SECTION 3: UNIFIED GENERAL LEDGER (دفتر روزنامه و تایید اسناد) */}
      {/* ======================================================== */}
      {activeSection === 'ledger' && (
        <section id="general-ledger-section" aria-label="General Ledger Table" className="animate-in fade-in duration-200">
          <GeneralLedgerTable
            ledgerItems={filteredLedgerItems}
            financialAccounts={accounts}
            ledgerStats={ledgerStats}
            approvalStatusFilter={approvalStatusFilter}
            setApprovalStatusFilter={setApprovalStatusFilter}
            dateFilterMode={ledgerDateFilterMode}
            setDateFilterMode={setLedgerDateFilterMode}
            selectedMonth={ledgerSelectedMonth}
            setSelectedMonth={setLedgerSelectedMonth}
            customStartDate={ledgerCustomStartDate}
            setCustomStartDate={setLedgerCustomStartDate}
            customEndDate={ledgerCustomEndDate}
            setCustomEndDate={setLedgerCustomEndDate}
            categoryFilter={ledgerCatFilter}
            setCategoryFilter={setLedgerCatFilter}
            accountTypeFilter={ledgerAccountTypeFilter}
            setAccountTypeFilter={setLedgerAccountTypeFilter}
            searchQuery={ledgerSearchQuery}
            setSearchQuery={setLedgerSearchQuery}
            currency={currency}
            language={language}
            projectName={currentProject?.name || 'KarSync'}
            onDeleteDraftItem={deleteDraftLedgerItem}
            onBatchDeleteDraftItems={batchDeleteDraftLedgerItems}
          />
        </section>
      )}

      {/* ======================================================== */}
      {/* 7. MODALS & SUB-WINDOWS                                  */}
      {/* ======================================================== */}

      {/* Counterparties Modal */}
      {isCounterpartiesModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCounterpartiesModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[85vh] shadow-2xl overflow-y-auto border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 p-2 sm:p-4">
            <div className="flex items-center justify-between pb-3 px-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4.5 h-4.5 text-sky-500" />
                <span>{c.manageCounterpartiesModalTitle}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCounterpartiesModalOpen(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 sm:p-4">
              <CounterpartiesView />
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Income Modal (شارژ حساب) */}
      <AddEditIncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        onSave={async (data) => {
          await handleSaveIncome(data);
          setIsIncomeModalOpen(false);
        }}
        currency={currency}
        language={language}
      />

      {/* Account Transfer Modal (انتقال وجه) */}
      <AccountTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransfer={async (transferData) => {
          await handleTransferFunds(transferData);
          setIsTransferModalOpen(false);
        }}
        accounts={accounts}
        accountBalances={accountBalances}
        globalOverdraftPolicy={globalOverdraftPolicy}
        currency={currency}
        language={language}
      />

      {/* Add / Edit Account Modal (حساب جدید) */}
      <AddEditAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
        onSave={async (accData) => {
          await handleSaveAccount(accData);
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
        initialData={editingAccount}
        currency={currency}
        language={language}
      />

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
          arrearsList={workerFinancials.filter((w) => w.netBalanceDue !== 0)}
          onSelectWorker={(w) => {
            setSettlementTargetWorker(w || null);
            setSettlementInitialMode(w?.teamRole === 'Master' && w?.groupId ? 'group' : 'individual');
            setSettlementInitialGroupId(w?.groupId || null);
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
          targetWorkerId={null}
          targetMonth={selectedMonth}
        />
      )}

      {/* Global Staff Loan Modal */}
      {isGlobalLoanModalOpen && (
        <AdvancePaymentModal
          isOpen={isGlobalLoanModalOpen}
          onClose={() => setIsGlobalLoanModalOpen(false)}
          workers={workers.filter((w) => w.isActive === 1)}
          targetWorkerId={null}
          targetMonth={selectedMonth}
          initialPaymentType="loan"
        />
      )}

      {/* Worker Financial Profile Modal */}
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
                <span>{c.dateRangeModalTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDateRangeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{c.fromDateLabel}</label>
                <input
                  type="date"
                  value={tempFromDate}
                  onChange={(e) => setTempFromDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{c.toDateLabel}</label>
                <input
                  type="date"
                  value={tempToDate}
                  onChange={(e) => setTempToDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={() => setIsDateRangeModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {c.cancelBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate(tempFromDate);
                  setToDate(tempToDate);
                  setFilterMode('custom');
                  setIsDateRangeModalOpen(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-500/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{c.confirmRangeBtn}</span>
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

      {/* Account Transactions Ledger Modal (معین حساب بانکی / صندوق) */}
      <AccountSubsidiaryLedgerModal
        isOpen={!!selectedAccountForLedger}
        entity={selectedAccountForLedger ? { type: 'account', data: selectedAccountForLedger } : null}
        accountData={selectedAccountForLedger ? accountBalances?.get?.(String(selectedAccountForLedger.id)) : null}
        currency={currency}
        language={language}
        allAccounts={accounts}
        allWorkers={workers}
        onClose={() => setSelectedAccountForLedger(null)}
      />

      {/* ======================================================== */}
      {/* 8. PRINTABLE EXECUTIVE STATEMENT (فقط در زمان پرینت فعال است) */}
      {/* ======================================================== */}
      <div className="hidden print:block text-black p-6 space-y-6">
        <div className="border-b-2 border-black pb-4 text-center">
          <h1 className="text-xl font-bold">{c.printReportHeader}</h1>
          <p className="text-sm mt-1 text-gray-600">
            {c.reportPeriod} {filterMode === 'monthly' ? formatMonthOnly(selectedMonth, language) : `${fromDate} - ${toDate}`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {c.printDate} {getTodayDateString()}
          </p>
        </div>

        {/* Executive Numbers */}
        <div className="grid grid-cols-3 gap-4 text-center border p-4 rounded-lg bg-gray-50">
          <div>
            <div className="text-xs text-gray-500">{c.periodTotalSpend}</div>
            <div className="text-lg font-bold font-mono">{formatAmount(spendData.totalOutflow, currency)} {getCurrencySymbol(currency, language)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{c.periodTotalInflow}</div>
            <div className="text-lg font-bold font-mono">{formatAmount(spendData.totalInflow, currency)} {getCurrencySymbol(currency, language)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{c.periodNetCash}</div>
            <div className="text-lg font-bold font-mono">{formatAmount(spendData.netFlow, currency)} {getCurrencySymbol(currency, language)}</div>
          </div>
        </div>

        {/* Category Breakdown Table */}
        <div>
          <h3 className="font-bold text-sm mb-2">{c.categoriesTitle}</h3>
          <table className="w-full text-right border text-xs">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2 border-l">{c.thCategory}</th>
                <th className="p-2 border-l">{c.documentsCount}</th>
                <th className="p-2 border-l">{c.sharePercent}</th>
                <th className="p-2 text-left">{c.amountTitle} ({getCurrencySymbol(currency, language)})</th>
              </tr>
            </thead>
            <tbody>
              {spendData.categoriesList.map((cat) => (
                <tr key={cat.id} className="border-b">
                  <td className="p-2 border-l font-bold">{cat.name}</td>
                  <td className="p-2 border-l">{cat.count}</td>
                  <td className="p-2 border-l">{Math.round(cat.percentage)}%</td>
                  <td className="p-2 text-left font-mono font-bold">{formatAmount(cat.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures Dock */}
        <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs">
          <div className="border-t border-gray-400 pt-2 font-bold">{c.accountantSign}</div>
          <div className="border-t border-gray-400 pt-2 font-bold">{c.projectManagerSign}</div>
          <div className="border-t border-gray-400 pt-2 font-bold">{c.employerSign}</div>
        </div>
      </div>

    </div>
  );
}
