import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { db, DEFAULT_PROJECT_ID } from '../../db/db';
import { useProject } from '../../context/ProjectContext';
import { formatCurrency, formatAmount, getCurrencySymbol } from '../../utils/formatters';
import { useAccounting } from '../../hooks/useAccounting';
import { useAuth } from '../../context/AuthContext';
import { 
  CreditCard, 
  Coins, 
  Star, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Search,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  User,
  UserX,
  Briefcase,
  Calendar,
  Clock,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Scale,
  FileText,
  Globe,
  Lock
} from 'lucide-react';

/**
 * AccountSubsidiaryLedgerModal
 * مودال لوکس تمام‌صفحه Apple Liquid Glass برای مشاهده صورت گردش معین حساب‌ها و پرسنل
 * چیدمان ستونی دقیق طبق دستورالعمل:
 * ردیف / تاریخ و ساعت / سند / بابت / طرف حساب / شرح سند / + / - / مانده
 * بدون کپسول‌های اضافه و اشباع رنگ، با تایپوگرافی تمیز و هاور تعاملی برای سند و طرف‌حساب.
 */
const COPY = {
  fa: {
    title: 'صورت گردش معین حساب و اسناد مالی',
    close: 'بستن',
    partyWorker: 'طرف حساب: پرسنل',
    partyBank: 'حساب و کارت بانکی',
    partyCash: 'صندوق نقدینگی',
    liveBalanceWorker: 'مانده زنده طلب / تسویه پرسنل',
    liveBalanceAccount: 'موجودی و مانده نهایی زنده حساب',
    card1Worker: 'کل اسناد',
    card1Account: 'موجودی اولیه',
    rowsUnit: 'ردیف',
    card2Worker: 'کل کارکرد (+)',
    card2Account: 'کل وارده (+)',
    card3Worker: 'کل پرداختی (-)',
    card3Account: 'کل صادره (-)',
    filteredDocsCount: (cnt) => `${cnt} سند و گردش مالی`,
    dateAll: 'همه تاریخ‌ها',
    dateThisMonth: 'این ماه',
    dateLastMonth: 'ماه گذشته',
    dateCustom: 'بازه سفارشی',
    catAll: 'همه سرفصل‌ها',
    catAttendanceWage: 'کارکرد و دستمزد',
    catAdvance: 'مساعده',
    catSettlement: 'تسویه حساب دستمزد',
    catPettyCash: 'شارژ تنخواه و واریزی',
    catStaffAdvance: 'مساعده پرسنل',
    catWorkshopExpense: 'فاکتور و هزینه کارگاه',
    catTransfer: 'انتقال بین حساب‌ها',
    searchPh: 'جستجو در شرح سند یا شماره...',
    customRangeLabel: 'بازه سفارشی:',
    fromLabel: 'از:',
    toLabel: 'تا:',
    printHeaderTitle: (name) => `صورت گردش معین حساب: ${name}`,
    printGroup: 'گروه:',
    printRole: 'سمت:',
    printBank: 'بانک:',
    printCard: 'شماره کارت:',
    printReportDate: 'تاریخ گزارش:',
    printFinalBalance: 'مانده نهایی:',
    thIndex: '#',
    thDateTime: 'تاریخ و ساعت',
    thVoucher: 'سند',
    thCategory: 'بابت',
    thCounterparty: 'طرف حساب',
    thDescription: 'شرح سند',
    thInflow: '+',
    thOutflow: '-',
    thRunningBalance: 'مانده',
    thInflowTitle: 'وارده (ورودی +)',
    thOutflowTitle: 'صادره (خروجی -)',
    thBalanceTitle: 'مانده لحظه‌ای',
    openingRow: 'افتتاحیه',
    openingBadge: 'سند افتتاحیه دوره',
    openingDesc: 'ثبت مانده اولیه در ابتدای دوره مالی',
    openingSupervisor: 'سرپرست سیستم',
    emptyMsg: 'هیچ گردش مالی یا تراکنشی منطبق با فیلتر انتخابی یافت نشد.',
    refPrefix: 'رهگیری:',
    finalBalanceLabel: 'مانده نهایی حساب:',
    totalDocsLabel: 'تعداد کل اسناد:',
    excelBtn: 'خروجی اکسل',
    excelTitle: 'خروجی فایل اکسل',
    printBtn: 'چاپ معین',
    printTitle: 'چاپ صورت گردش حساب',
    creditor: 'طلبکار',
    debtor: 'بدهکار',
    positiveBalance: 'تراز مثبت',
    negativeBalance: 'تراز منفی',
    wageHalf: 'نیم‌روز کارکرد',
    wageHourly: 'ساعتی',
    wageDaily: 'کارکرد روزانه',
    wageDesc: (hrs, ot) => `ثبت کارکرد: ${hrs || 8} ساعت${ot ? ` + ${ot} ساعت اضافه` : ''}`,
    wageSource: 'حضور و غیاب',
    payAdvanceCat: 'مساعده پرسنل',
    paySettlementCat: 'تسویه دستمزد پرسنل',
    payAdvanceDesc: 'پرداخت مساعده نقدی/بانکی',
    paySettlementDesc: 'پرداخت تسویه حساب کارکرد',
    payBonusCat: 'عیدی و پاداش پرسنل',
    payBonusDesc: 'پرداخت پاداش / عیدی پرسنل',
    payLoanCat: 'وام و تسهیلات پرسنلی',
    defaultBadge: ' (پیش‌فرض)',
    inactiveBadge: ' (غیرفعال)',
    defaultTag: 'پیش‌فرض',
    card1Monthly: 'حقوق ثابت ماهانه',
    loanFacilityBadge: 'تسهیلات وام فعال',
    loanInstallmentLabel: 'قسط ماهانه:',
    fixedSalaryPresence: 'حضور روزانه (حقوق ثابت ماهانه)',
    loanFacilityDesc: 'اعطای تسهیلات وام پرسنلی (بازپرداخت اقساطی)',
    loanFacilityPill: 'تسهیلات وام',
    lblGroup: '• گروه:',
    lblRole: '• سمت:',
    lblBank: '• بانک:',
    lblCard: '• کارت:',
    swipeHint: 'برای مشاهده تمام ستون‌ها به طرفین بکشید',
    sortLabel: 'ترتیب:',
    sortNewest: 'جدید به قدیم',
    sortOldest: 'قدیم به جدید',
    viewCards: 'کارت‌ها',
    viewTable: 'جدول',
    currencyBadge: (c) => `واحد: ${c}`,
    summaryTotals: 'جمع ستون‌ها',
    balanceAfterTx: 'مانده:',
    scopeAllProjects: 'همه پروژه‌های شرکت',
    scopeThisProject: 'فقط این کارگاه',
    corporateSharedNotice: 'گردش حساب مشترک ستاد شرکت (محدود به اسناد این پروژه)',
    corporateSharedBadge: 'مشترک شرکت',
    excelHeaders: {
      row: 'ردیف',
      date: 'تاریخ',
      time: 'ساعت',
      voucher: 'شماره سند',
      category: 'بابت',
      counterparty: 'طرف حساب',
      desc: 'شرح تراکنش',
      inflow: 'وارده (+)',
      outflow: 'صادره (-)',
      balance: 'مانده',
      currency: 'واحد پول'
    }
  },
  ku: {
    title: 'دەفتەری دارایی و تۆمارەکان',
    close: 'داخستن',
    partyWorker: 'لایەنی پەیوەندیدار: کارمەند',
    partyBank: 'حیساب و کارتی بانکی',
    partyCash: 'سندوقی نەختینە',
    liveBalanceWorker: 'شایستەی دارایی کارمەند',
    liveBalanceAccount: 'باڵانسی کۆتایی ئەم حیسابە',
    card1Worker: 'سەرجەم بەڵگەنامەکان',
    card1Account: 'باڵانسی سەرەتایی',
    rowsUnit: 'ڕیز',
    card2Worker: 'سەرجەم کارکردن (+)',
    card2Account: 'سەرجەم هاتوو (+)',
    card3Worker: 'سەرجەم پارەدان (-)',
    card3Account: 'سەرجەم دەرچوو (-)',
    filteredDocsCount: (cnt) => `${cnt} تۆماری دارایی`,
    dateAll: 'هەموو بەروارەکان',
    dateThisMonth: 'ئەم مانگە',
    dateLastMonth: 'مانگی پێشوو',
    dateCustom: 'ماوەی دڵخواز',
    catAll: 'هەموو بابەتەکان',
    catAttendanceWage: 'کارکردن و مووچە',
    catAdvance: 'مساعدە / پێشەکی',
    catSettlement: 'تەسویەی حیساب',
    catPettyCash: 'پڕکردنەوەی نەختینە و واریز',
    catStaffAdvance: 'مساعدەی کارمەندان',
    catWorkshopExpense: 'فاکتەر و خەرجیی کارگە',
    catTransfer: 'گواستنەوە لە نێوان حیسابەکان',
    searchPh: 'گەڕان لە ڕوونکردنەوەی بەڵگەنامە...',
    customRangeLabel: 'ماوەی دڵخواز:',
    fromLabel: 'لە:',
    toLabel: 'تا:',
    printHeaderTitle: (name) => `دەفتەری دارایی: ${name}`,
    printGroup: 'گرووپ:',
    printRole: 'پلە:',
    printBank: 'بانک:',
    printCard: 'ژمارەی کارت:',
    printReportDate: 'بەرواری ڕاپۆرت:',
    printFinalBalance: 'باڵانسی کۆتایی:',
    thIndex: '#',
    thDateTime: 'بەروار و کات',
    thVoucher: 'بەڵگەنامە',
    thCategory: 'بابەت',
    thCounterparty: 'لایەنی پەیوەندیدار',
    thDescription: 'ڕوونکردنەوەی بەڵگەنامە',
    thInflow: '+',
    thOutflow: '-',
    thRunningBalance: 'باڵانس',
    thInflowTitle: 'هاتوو (ورودی +)',
    thOutflowTitle: 'دەرچوو (خروجی -)',
    thBalanceTitle: 'باڵانسی ساتەوەخت',
    openingRow: 'دەستپێک',
    openingBadge: 'بەڵگەنامەی سەرەتایی خول',
    openingDesc: 'تۆمارکردنی باڵانسی سەرەتایی لە دەستپێکی خولی دارایی',
    openingSupervisor: 'سەرپەرشتیاری سیستەم',
    emptyMsg: 'هیچ مامەڵەیەکی دارایی نەدۆزرایەوە.',
    refPrefix: 'بەدواداچوون:',
    finalBalanceLabel: 'باڵانسی کۆتایی حیساب:',
    totalDocsLabel: 'ژمارەی هەموو بەڵگەنامەکان:',
    excelBtn: 'دەرهێنانی ئەکسڵ',
    excelTitle: 'دەرهێنانی فایلی ئەکسڵ',
    printBtn: 'چاپکردنی دەفتەر',
    printTitle: 'چاپکردنی دەفتەری دارایی',
    creditor: 'شایستەی وەرگرتن',
    debtor: 'قەرزدار',
    positiveBalance: 'باڵانسی ئەرێنی',
    negativeBalance: 'باڵانسی نەرێنی',
    wageHalf: 'نیوەڕۆژ',
    wageHourly: 'کاتژمێری',
    wageDaily: 'ئامادەبوونی ڕۆژانە',
    wageDesc: (hrs, ot) => `ئامادەبوون: ${hrs || 8} کاتژمێر${ot ? ` + ${ot} کاتژمێری زیاتر` : ''}`,
    wageSource: 'ئامادەبوون',
    payAdvanceCat: 'تەنخوا/مساعدە',
    paySettlementCat: 'تەسویەی حیساب',
    payAdvanceDesc: 'پێدانی مساعدە',
    paySettlementDesc: 'تەسویەی پارەی کارکردن',
    payBonusCat: 'جەژنانە و پاداشت',
    payBonusDesc: 'پێدانی پاداشت / جەژنانە بە کارمەند',
    payLoanCat: 'قەرز و پێشینەی کارمەندان',
    defaultBadge: ' (بنەڕەتی)',
    inactiveBadge: ' (ناچالاک)',
    defaultTag: 'بنەڕەتی',
    card1Monthly: 'مووچەی جێگیری مانگانە',
    loanFacilityBadge: 'تەسهیلاتی قەرزی چالاک',
    loanInstallmentLabel: 'قیستی مانگانە:',
    fixedSalaryPresence: 'ئامادەبوونی ڕۆژانە (مووچەی جێگیر)',
    loanFacilityDesc: 'پێدانی قەرزی کارمەند (تەسهیلاتی قیستدار)',
    loanFacilityPill: 'تەسهیلاتی قەرز',
    lblGroup: '• گرووپ:',
    lblRole: '• پلە:',
    lblBank: '• بانک:',
    lblCard: '• کارت:',
    swipeHint: 'بۆ بینینی هەموو ستوونەکان پەنجە ڕابکێشە بۆ لای چەپ/ڕاست',
    sortLabel: 'ڕیزبەندی:',
    sortNewest: 'نوێ بۆ کۆن',
    sortOldest: 'کۆن بۆ نوێ',
    viewCards: 'کارتەکان',
    viewTable: 'خشتە',
    currencyBadge: (c) => `یەکە: ${c}`,
    summaryTotals: 'کۆی گشتی ستوونەکان',
    balanceAfterTx: 'باڵانس:',
    scopeAllProjects: 'هەموو پڕۆژەکان',
    scopeThisProject: 'تەنها ئەم پڕۆژەیە',
    corporateSharedNotice: 'بەڵگەنامەکانی حیسابی هاوبەشی کۆمپانیا (تەنها ئەم کارگەیە)',
    corporateSharedBadge: 'هاوبەشی کۆمپانیا',
    excelHeaders: {
      row: 'ڕیزبەندی',
      date: 'بەروار',
      time: 'کاتژمێر',
      voucher: 'ژمارەی بەڵگەنامە',
      category: 'بابەت',
      counterparty: 'لایەنی پەیوەندیدار',
      desc: 'ڕوونکردنەوەی مامەڵە',
      inflow: 'هاتوو (+)',
      outflow: 'دەرچوو (-)',
      balance: 'باڵانس',
      currency: 'دراو'
    }
  },
  en: {
    title: 'Subsidiary Ledger & Financial Records',
    close: 'Close',
    partyWorker: 'Counterparty: Staff',
    partyBank: 'Bank Card & Account',
    partyCash: 'Cash Drawer',
    liveBalanceWorker: 'Live Staff Payable Balance',
    liveBalanceAccount: 'Live Final Account Balance',
    card1Worker: 'Total Documents',
    card1Account: 'Opening Balance',
    rowsUnit: 'rows',
    card2Worker: 'Total Work (+)',
    card2Account: 'Total Inflow (+)',
    card3Worker: 'Total Paid (-)',
    card3Account: 'Total Outflow (-)',
    filteredDocsCount: (cnt) => `${cnt} Financial Documents`,
    dateAll: 'All Dates',
    dateThisMonth: 'This Month',
    dateLastMonth: 'Last Month',
    dateCustom: 'Custom Range',
    catAll: 'All Categories',
    catAttendanceWage: 'Attendance & Wages',
    catAdvance: 'Advance Payment',
    catSettlement: 'Wage Settlement',
    catPettyCash: 'Petty Cash & Deposit',
    catStaffAdvance: 'Staff Advance',
    catWorkshopExpense: 'Workshop Expense',
    catTransfer: 'Account Transfer',
    searchPh: 'Search description or voucher no...',
    customRangeLabel: 'Custom Range:',
    fromLabel: 'From:',
    toLabel: 'To:',
    printHeaderTitle: (name) => `Subsidiary Ledger: ${name}`,
    printGroup: 'Group:',
    printRole: 'Role:',
    printBank: 'Bank:',
    printCard: 'Card No:',
    printReportDate: 'Report Date:',
    printFinalBalance: 'Final Balance:',
    thIndex: '#',
    thDateTime: 'Date & Time',
    thVoucher: 'Voucher',
    thCategory: 'Category',
    thCounterparty: 'Counterparty',
    thDescription: 'Description',
    thInflow: '+',
    thOutflow: '-',
    thRunningBalance: 'Balance',
    thInflowTitle: 'Inflow (+)',
    thOutflowTitle: 'Outflow (-)',
    thBalanceTitle: 'Running Balance',
    openingRow: 'Opening',
    openingBadge: 'Opening Balance Voucher',
    openingDesc: 'Initial balance recorded at beginning of period',
    openingSupervisor: 'System Admin',
    emptyMsg: 'No financial transactions match the selected filter.',
    refPrefix: 'Ref:',
    finalBalanceLabel: 'Final Account Balance:',
    totalDocsLabel: 'Total Documents:',
    excelBtn: 'Export Excel',
    excelTitle: 'Export Excel File',
    printBtn: 'Print Ledger',
    printTitle: 'Print Subsidiary Ledger',
    creditor: 'Creditor (Owed)',
    debtor: 'Debtor',
    positiveBalance: 'Positive Balance',
    negativeBalance: 'Negative Balance',
    wageHalf: 'Half-Day',
    wageHourly: 'Hourly',
    wageDaily: 'Daily Attendance',
    wageDesc: (hrs, ot) => `Work logged: ${hrs || 8} hrs${ot ? ` + ${ot} hrs overtime` : ''}`,
    wageSource: 'Attendance',
    payAdvanceCat: 'Staff Advance',
    paySettlementCat: 'Wage Settlement',
    payAdvanceDesc: 'Cash/Bank Advance Payment',
    paySettlementDesc: 'Wage Settlement Payment',
    payBonusCat: 'Staff Bonus & Gift',
    payBonusDesc: 'Staff Bonus / Gift Payment',
    payLoanCat: 'Staff Loan Facility',
    defaultBadge: ' (Default)',
    inactiveBadge: ' (Inactive)',
    defaultTag: 'Default',
    card1Monthly: 'Fixed Monthly Salary',
    loanFacilityBadge: 'Active Staff Loan',
    loanInstallmentLabel: 'Monthly Installment:',
    fixedSalaryPresence: 'Daily Attendance (Fixed Salary)',
    loanFacilityDesc: 'Staff Loan Facility Disbursement (Installments)',
    loanFacilityPill: 'Staff Loan',
    lblGroup: '• Group:',
    lblRole: '• Role:',
    lblBank: '• Bank:',
    lblCard: '• Card:',
    swipeHint: 'Swipe left/right to view all columns',
    sortLabel: 'Sort:',
    sortNewest: 'Newest First',
    sortOldest: 'Oldest First',
    viewCards: 'Cards',
    viewTable: 'Table',
    currencyBadge: (c) => `Unit: ${c}`,
    summaryTotals: 'Column Totals',
    balanceAfterTx: 'Balance:',
    scopeAllProjects: 'All Company Projects',
    scopeThisProject: 'This Project Only',
    corporateSharedNotice: 'Corporate Shared Account (Scoped to this workshop project)',
    corporateSharedBadge: 'Corporate Shared',
    excelHeaders: {
      row: 'Row',
      date: 'Date',
      time: 'Time',
      voucher: 'Voucher No',
      category: 'Category',
      counterparty: 'Counterparty',
      desc: 'Description',
      inflow: 'Inflow (+)',
      outflow: 'Outflow (-)',
      balance: 'Balance',
      currency: 'Currency'
    }
  }
};

export function AccountSubsidiaryLedgerModal({
  isOpen,
  entity, // { type: 'account', data: account } | { type: 'worker', data: worker }
  accountData, // داده‌های مانده حساب (در صورت ارسال از بیرون)
  currency = 'IQD',
  language = 'fa',
  allAccounts = [],
  allWorkers = [],
  onSelectEntity,
  onClose
}) {
  const txt = COPY[language] || COPY.fa;
  const { currentProject, openWorkerProfile } = useProject();
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // هوک دسترسی کاربری
  const { user } = useAuth();
  const hasAllProjectsAccess = Boolean(user?.has_all_projects_access || user?.role === 'admin');

  // هوک مالی حسابداری
  const accounting = useAccounting();
  const effectiveCurrency = currency || accounting?.currency || 'IQD';
  const effectiveAccounts = (allAccounts && allAccounts.length > 0) ? allAccounts : (accounting?.financialAccounts || []);
  const effectiveWorkers = (allWorkers && allWorkers.length > 0) ? allWorkers : (accounting?.workers || []);

  const isRtl = language === 'fa' || language === 'ku';
  const entityType = entity?.type || 'account'; // 'account' | 'worker'
  const entityData = entity?.data || entity;

  const effectiveAccountData = accountData || (entityType === 'account' && entityData?.id ? accounting?.accountBalances?.get(String(entityData.id)) : null);

  // استیت‌های فیلتر، سورت و حالت نمایش
  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [projectScopeFilter, setProjectScopeFilter] = useState('all'); // 'all' | 'current'

  // استیت سورت زمانی دوطرفه: پیش‌فرض جدیدترین در بالا
  const [sortDirection, setSortDirection] = useState('desc');

  // استیت حالت نمایش در موبایل
  const [mobileViewMode, setMobileViewMode] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('karsync_subsidiary_mobile_view') || 'cards';
      }
    } catch (_) {}
    return 'cards';
  });

  const handleToggleMobileView = (mode) => {
    setMobileViewMode(mode);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('karsync_subsidiary_mobile_view', mode);
      }
    } catch (_) {}
  };

  // کنترل نمایش ترانزیشنی فوتر شناور با جهت اسکرول
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const lastScrollTopRef = useRef(0);
  const scrollContainerRef = useRef(null);

  const handleScroll = useCallback((e) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    const delta = currentScrollTop - lastScrollTopRef.current;

    if (currentScrollTop < 40) {
      setIsFooterVisible(true);
    } else if (delta > 10) {
      setIsFooterVisible(false);
    } else if (delta < -10) {
      setIsFooterVisible(true);
    }

    const isAtBottom = e.currentTarget.scrollHeight - currentScrollTop - e.currentTarget.clientHeight < 50;
    if (isAtBottom) {
      setIsFooterVisible(true);
    }

    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // بستن مودال با کلید Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ۱. بارگذاری اطلاعات پرسنل، گروه‌ها و طرف‌حساب‌ها جهت حل ریشه‌ای خالی بودن نام طرف‌حساب
  const workerId = entityType === 'worker' ? String(entityData?.id) : null;

  const workerLogs = useLiveQuery(
    async () => {
      if (!workerId) return [];
      try {
        const list = await db.attendanceLogs.where('workerId').equals(entityData.id).toArray();
        return list.filter((l) => !l.deletedAt);
      } catch (_) {
        return [];
      }
    },
    [workerId]
  ) || [];

  const workerPayments = useLiveQuery(
    async () => {
      if (!workerId) return [];
      try {
        const list = await db.payments.where('workerId').equals(entityData.id).toArray();
        return list.filter((p) => !p.deletedAt && p.status !== 'deleted');
      } catch (_) {
        return [];
      }
    },
    [workerId]
  ) || [];

  // بارگذاری تسهیلات وام پرسنلی جهت تفکیک از دستمزد جاری
  const workerLoans = useLiveQuery(
    async () => {
      if (!workerId || !db.loans) return [];
      try {
        const list = await db.loans.where('workerId').equals(String(entityData.id)).toArray();
        return list.filter((l) => !l.deletedAt && l.status !== 'deleted');
      } catch (_) {
        return [];
      }
    },
    [workerId]
  ) || [];

  const activeWorkerLoan = useMemo(() => {
    return (workerLoans || []).find((l) => l.status === 'active' && Number(l.remainingBalance) > 0);
  }, [workerLoans]);

  const groups = useLiveQuery(
    async () => {
      try {
        const list = await db.groups.toArray();
        return list.filter((g) => !g.deletedAt);
      } catch (_) {
        return [];
      }
    },
    []
  ) || [];

  const counterparties = useLiveQuery(
    async () => {
      try {
        const list = await db.counterparties.toArray();
        return list.filter((c) => !c.deletedAt);
      } catch (_) {
        return [];
      }
    },
    []
  ) || [];

  const groupMap = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => map.set(String(g.id), g.name));
    return map;
  }, [groups]);

  const workerMap = useMemo(() => {
    const map = new Map();
    effectiveWorkers.forEach((w) => map.set(String(w.id), w.name));
    return map;
  }, [effectiveWorkers]);

  const counterpartyMap = useMemo(() => {
    const map = new Map();
    counterparties.forEach((cp) => map.set(String(cp.id), cp.name));
    return map;
  }, [counterparties]);

  // محاسبه تراکنش‌های معین پرسنل با تفکیک ریشه‌ای حقوق ماهانه، وام و اضافه‌کاری
  const workerTransactionsData = useMemo(() => {
    if (entityType !== 'worker' || !entityData) {
      return { rawTransactions: [], initialBalance: 0, totalInflow: 0, totalOutflow: 0, currentBalance: 0 };
    }

    const isMonthly = entityData.wageType === 'monthly';
    const wDaily = Number(String(entityData.dailyRate || 0).replace(/,/g, '')) || 0;
    const wOtRate = Number(String(entityData.overtimeHourlyRate || 0).replace(/,/g, '')) || 0;

    const getLogPay = (l) => {
      const otH = Math.max(0, Number(l.overtimeHours) || 0);
      if (isMonthly) {
        // برای پرسنل حقوق ثابت ماهانه: حضور عادی دستمزد روزانه تولید نمی‌کند
        // فقط در صورت اضافه‌کاری یا جمعه‌کاری دستمزد مازاد محاسبه می‌شود
        let extraPay = 0;
        if (otH > 0) {
          extraPay += otH * (wOtRate || (Number(entityData.monthlySalary || 0) / 240));
        }
        const totalPay = Number(l.totalDayPay) || 0;
        if (totalPay > 0 && totalPay > extraPay) {
          extraPay = totalPay;
        }
        return extraPay;
      }

      let val = Number(l.totalDayPay);
      if (!isNaN(val) && val > 0) return val;
      if (l.type === 'half') return (wDaily * 0.5) + (otH * wOtRate);
      if (l.type === 'hourly') return otH * (wOtRate || (wDaily / 8));
      return wDaily + (otH * wOtRate);
    };

    const combinedEvents = [];

    // الف) کارکردها (حضور روزانه / اضافه‌کاری / دستمزد روزانه)
    workerLogs.forEach((l) => {
      const pay = getLogPay(l);
      const otH = Math.max(0, Number(l.overtimeHours) || 0);

      let catLabel = l.type === 'half' ? txt.wageHalf : l.type === 'hourly' ? txt.wageHourly : txt.wageDaily;
      let desc = l.note || txt.wageDesc(l.hours, l.overtimeHours);
      let evType = 'inflow';

      if (isMonthly) {
        if (pay > 0) {
          evType = 'inflow';
          catLabel = otH > 0 ? (txt.wageHourly || 'اضافه‌کاری') : txt.wageDaily;
          desc = l.note || (language === 'ku' ? `سەعاتی زیادەکاری: ${otH} کاتژمێر` : language === 'en' ? `Overtime: ${otH} hrs` : `اضافه‌کاری: ${otH} ساعت`);
        } else {
          evType = 'neutral_log';
          catLabel = txt.fixedSalaryPresence;
          desc = l.note || txt.fixedSalaryPresence;
        }
      }

      combinedEvents.push({
        id: `log_${l.id}`,
        rawDate: l.date || '',
        date: l.date || '',
        time: '',
        category: isMonthly ? (pay > 0 ? 'attendance_wage' : 'attendance_presence') : 'attendance_wage',
        categoryLabel: catLabel,
        description: desc,
        counterparty: entityData.name,
        type: evType,
        amount: pay,
        sourceLabel: txt.wageSource,
        createdAt: l.createdAt || l.date || ''
      });
    });

    // ب) پرداخت‌ها (مساعده، تسویه، پاداش، تسهیلات وام پرسنلی)
    workerPayments.forEach((p) => {
      const isAdvance = p.type === 'advance' || p.type === 'Advance_Payment';
      const isBonus = p.type === 'bonus' || p.type === 'eid';
      const isLoan = p.type === 'loan' || p.type === 'loan_disbursement';

      let cat = 'worker_settlement';
      let catLabel = txt.paySettlementCat;
      let evType = 'outflow';
      let desc = p.notes || p.note || p.description || txt.paySettlementDesc;

      if (isBonus) {
        cat = 'worker_bonus';
        catLabel = p.bonusTitle || txt.payBonusCat;
        evType = 'bonus_gift';
        desc = p.notes || p.note || p.description || txt.payBonusDesc;
      } else if (isAdvance) {
        cat = 'advance_payment';
        catLabel = txt.payAdvanceCat;
        evType = 'outflow';
        desc = p.notes || p.note || p.description || txt.payAdvanceDesc;
      } else if (isLoan) {
        // وام پرسنلی تسهیلات اقساطی است و نباید مانده دستمزد جاری را کسر کند
        cat = 'staff_loan';
        catLabel = txt.loanFacilityPill;
        evType = 'loan_facility';
        desc = p.notes || p.note || p.description || txt.loanFacilityDesc;
      }

      combinedEvents.push({
        id: `pay_${p.id}`,
        rawDate: (p.date || p.createdAt || '').slice(0, 10),
        date: (p.date || p.createdAt || '').slice(0, 10),
        time: (p.createdAt || '').slice(11, 16),
        category: cat,
        categoryLabel: catLabel,
        description: desc,
        counterparty: entityData.name,
        type: evType,
        amount: Number(p.amount) || 0,
        sourceLabel: isBonus ? txt.payBonusCat : isLoan ? txt.loanFacilityPill : txt.paySource,
        voucherNumber: p.voucherNumber || (p.createdAt ? `T-${(p.createdAt || '').slice(2,4)}${(p.createdAt || '').slice(5,7)}${String(p.id || 1).padStart(3, '0')}` : `T-2611${String(p.id || 1).padStart(3, '0')}`),
        originalItem: p,
        createdAt: p.createdAt || p.date || ''
      });
    });

    // مرتب‌سازی زمانی تقویمی از قدیم به جدید برای محاسبه خطی Running Balance
    combinedEvents.sort((a, b) => {
      if (a.rawDate !== b.rawDate) return (a.rawDate || '').localeCompare(b.rawDate || '');
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    let running = 0;
    let totalIn = 0;
    let totalOut = 0;

    combinedEvents.forEach((ev) => {
      if (ev.type === 'inflow') {
        running += ev.amount;
        totalIn += ev.amount;
      } else if (ev.type === 'outflow') {
        running -= ev.amount;
        totalOut += ev.amount;
      } else if (ev.type === 'bonus_gift') {
        ev.isBonus = true;
      } else if (ev.type === 'loan_facility') {
        ev.isLoanFacility = true;
      } else if (ev.type === 'neutral_log') {
        ev.isNeutral = true;
      }
      ev.runningBalance = running;
    });

    return {
      rawTransactions: combinedEvents,
      initialBalance: 0,
      totalInflow: totalIn,
      totalOutflow: totalOut,
      currentBalance: running
    };
  }, [entityType, entityData, workerLogs, workerPayments, txt, language]);

  // تشخیص مقادیر حساب یا پرسنل
  const isBank = entityType === 'account' && entityData?.type === 'bank';
  const isCash = entityType === 'account' && entityData?.type === 'cash';
  const isWorker = entityType === 'worker';
  const initialBalance = isWorker ? 0 : (Number(effectiveAccountData?.initialBalance) || 0);
  const currentBalance = isWorker ? workerTransactionsData.currentBalance : (Number(effectiveAccountData?.currentBalance) || 0);
  const totalInflow = isWorker ? workerTransactionsData.totalInflow : (Number(effectiveAccountData?.totalInflow) || 0);
  const totalOutflow = isWorker ? workerTransactionsData.totalOutflow : (Number(effectiveAccountData?.totalOutflow) || 0);
  const isPositive = currentBalance >= 0;

  const statusBadgeText = isWorker ? (isPositive ? txt.creditor : txt.debtor) : (isPositive ? txt.positiveBalance : txt.negativeBalance);

  // واکشی تراکنش‌های خام
  const rawTransactions = isWorker ? workerTransactionsData.rawTransactions : (effectiveAccountData?.transactions || []);

  // تابع بازیابی نام دقیق و قطعی طرف‌حساب برای تمامی اسناد
  const getTransactionCounterparty = useCallback((tx) => {
    if (isWorker) {
      return tx.counterparty || entityData?.name || '';
    }
    // اولویت ۱: نام صریح موجود در آبجکت
    if (tx.counterparty && tx.counterparty !== '-') return tx.counterparty;
    if (tx.personName && tx.personName !== '-') return tx.personName;
    if (tx.rawItem?.workerName) return tx.rawItem.workerName;
    if (tx.rawItem?.personName) return tx.rawItem.personName;
    if (tx.rawItem?.counterpartyName) return tx.rawItem.counterpartyName;
    if (tx.rawItem?.counterparty) return tx.rawItem.counterparty;
    if (tx.rawItem?.payer) return tx.rawItem.payer;
    if (tx.rawItem?.toAccountName) return tx.rawItem.toAccountName;
    if (tx.rawItem?.fromAccountName) return tx.rawItem.fromAccountName;

    // اولویت ۲: مپینگ شناسه پرسنل
    const wId = tx.rawItem?.workerId || tx.workerId;
    if (wId && workerMap.has(String(wId))) {
      return workerMap.get(String(wId));
    }

    // اولویت ۳: مپینگ شناسه طرف‌حساب
    const cpId = tx.rawItem?.counterpartyId || tx.counterpartyId;
    if (cpId && counterpartyMap.has(String(cpId))) {
      return counterpartyMap.get(String(cpId));
    }

    return '';
  }, [isWorker, entityData, workerMap, counterpartyMap]);

  // هندلر باز کردن سند مالی در مودال جزئیات سند
  const handleVoucherClick = useCallback((voucherNumber, rawItem) => {
    if (!voucherNumber) return;
    window.dispatchEvent(
      new CustomEvent('karsync-open-voucher', {
        detail: { voucherNumber, item: rawItem }
      })
    );
  }, []);

  // هندلر کلیک روی طرف‌حساب جهت ناوبری مستقیم به مودال پروفایل شخص
  const handleCounterpartyClick = useCallback((tx) => {
    // ۱. اگر در معین پرسنل هستیم و روی نام پرسنل کلیک شده
    if (isWorker && entityData?.id) {
      if (openWorkerProfile) {
        openWorkerProfile(String(entityData.id));
      }
      return;
    }

    const cpName = getTransactionCounterparty(tx);

    // ۲. بررسی تطابق با پرسنل (بر اساس workerId در خود تراکنش)
    const wId = tx.rawItem?.workerId || tx.workerId;
    if (wId) {
      if (openWorkerProfile) {
        openWorkerProfile(String(wId));
        return;
      }
    }

    // ۳. بررسی تطابق با پرسنل (بر اساس نام)
    if (cpName) {
      const matchedWorker = effectiveWorkers.find((w) => w.name?.trim() === cpName.trim());
      if (matchedWorker) {
        if (openWorkerProfile) {
          openWorkerProfile(String(matchedWorker.id));
          return;
        }
      }

      // ۴. بررسی تطابق با حساب بانکی / صندوق دیگر
      const matchedAccount = effectiveAccounts.find((a) => a.name?.trim() === cpName.trim());
      if (matchedAccount && onSelectEntity) {
        onSelectEntity({ type: 'account', data: matchedAccount });
        return;
      }

      // ۵. اگر طرف‌حساب تجاری است
      const matchedCp = counterparties.find((c) => c.name?.trim() === cpName.trim() || String(c.id) === String(tx.rawItem?.counterpartyId));
      if (matchedCp) {
        window.dispatchEvent(new CustomEvent('karsync-open-counterparties-modal'));
        return;
      }
    }
  }, [isWorker, entityData, getTransactionCounterparty, effectiveWorkers, effectiveAccounts, counterparties, onSelectEntity, openWorkerProfile]);

  // اعمال فیلترهای زمانی، دسته‌بندی و متن جستجو
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonthPrefix = `${curYear}-${curMonth}`;

    const prevDate = new Date(curYear, now.getMonth() - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    const lastMonthPrefix = `${prevYear}-${prevMonth}`;

    const q = searchQuery.trim().toLowerCase();

    return rawTransactions.filter((tx) => {
      // فیلتر تفکیک پروژه برای حساب‌های مشترک شرکت در سطح دسترسی مدیر ارشد
      if (entityType === 'account' && entityData?.isGlobal && hasAllProjectsAccess && projectScopeFilter === 'current') {
        const isCurProject = !tx.projectId || tx.projectId === targetProjectId || targetProjectId === DEFAULT_PROJECT_ID;
        if (!isCurProject) return false;
      }

      // فیلتر تاریخ
      if (dateFilter === 'this_month') {
        if (!tx.rawDate?.startsWith(thisMonthPrefix)) return false;
      } else if (dateFilter === 'last_month') {
        if (!tx.rawDate?.startsWith(lastMonthPrefix)) return false;
      } else if (dateFilter === 'custom') {
        if (customStart && tx.rawDate < customStart) return false;
        if (customEnd && tx.rawDate > customEnd) return false;
      }

      // فیلتر دسته
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) {
        return false;
      }

      // فیلتر متنی
      if (q) {
        const cpName = getTransactionCounterparty(tx);
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const partyMatch = cpName.toLowerCase().includes(q);
        const refMatch = (tx.reference || tx.rawItem?.referenceNumber || '').toLowerCase().includes(q);
        const catMatch = (tx.categoryLabel || '').toLowerCase().includes(q);
        const voucherMatch = (tx.voucherNumber || '').toLowerCase().includes(q);
        if (!descMatch && !partyMatch && !refMatch && !catMatch && !voucherMatch) return false;
      }

      return true;
    });
  }, [rawTransactions, dateFilter, customStart, customEnd, categoryFilter, searchQuery, getTransactionCounterparty, entityType, entityData, hasAllProjectsAccess, projectScopeFilter, targetProjectId]);

  // محاسبه سرجمع‌های ستونی (Column Totals)
  const columnTotals = useMemo(() => {
    let sumIn = 0;
    let sumOut = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === 'inflow') sumIn += Number(tx.amount) || 0;
      else if (tx.type === 'outflow') sumOut += Number(tx.amount) || 0;
    });
    return {
      sumInflow: sumIn,
      sumOutflow: sumOut,
      net: sumIn - sumOut
    };
  }, [filteredTransactions]);

  // سورت نهایی جهت نمایش: جدید به قدیم (پیش‌فرض) یا قدیم به جدید
  const displayedTransactions = useMemo(() => {
    if (sortDirection === 'desc') {
      return [...filteredTransactions].reverse();
    }
    return filteredTransactions;
  }, [filteredTransactions, sortDirection]);

  // خروجی اکسل هماهنگ با چیدمان و سورت انتخابی
  const handleExportExcel = useCallback(() => {
    const h = txt.excelHeaders;
    const rows = [
      ...((!isWorker && initialBalance > 0 && sortDirection === 'asc') ? [{
        [h.row]: txt.openingRow,
        [h.date]: '-',
        [h.time]: '-',
        [h.voucher]: '-',
        [h.category]: txt.openingBadge,
        [h.counterparty]: entityData?.keeperName || entityData?.holderName || txt.openingSupervisor,
        [h.desc]: txt.openingDesc,
        [h.inflow]: initialBalance,
        [h.outflow]: 0,
        [h.balance]: initialBalance,
        [h.currency]: effectiveCurrency
      }] : []),
      ...displayedTransactions.map((tx, idx) => ({
        [h.row]: idx + 1,
        [h.date]: tx.rawDate || tx.date,
        [h.time]: tx.time || '-',
        [h.voucher]: tx.voucherNumber || '-',
        [h.category]: tx.categoryLabel || tx.category,
        [h.counterparty]: getTransactionCounterparty(tx) || '-',
        [h.desc]: tx.description || '-',
        [h.inflow]: tx.type === 'inflow' ? tx.amount : 0,
        [h.outflow]: tx.type === 'outflow' ? tx.amount : 0,
        [h.balance]: tx.runningBalance,
        [h.currency]: effectiveCurrency
      })),
      ...((!isWorker && initialBalance > 0 && sortDirection === 'desc') ? [{
        [h.row]: txt.openingRow,
        [h.date]: '-',
        [h.time]: '-',
        [h.voucher]: '-',
        [h.category]: txt.openingBadge,
        [h.counterparty]: entityData?.keeperName || entityData?.holderName || txt.openingSupervisor,
        [h.desc]: txt.openingDesc,
        [h.inflow]: initialBalance,
        [h.outflow]: 0,
        [h.balance]: initialBalance,
        [h.currency]: effectiveCurrency
      }] : [])
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SubsidiaryLedger');
    const safeName = (entityData?.name || 'Ledger').replace(/\s+/g, '_');
    const fileName = `KarSync_Ledger_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [displayedTransactions, initialBalance, entityData, effectiveCurrency, isWorker, sortDirection, txt, getTransactionCounterparty]);

  // پرینت اختصاصی جدول معین
  const handlePrint = useCallback(() => {
    document.body.classList.add('is-printing-subsidiary-ledger');
    window.print();
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('is-printing-subsidiary-ledger');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('is-printing-subsidiary-ledger');
    };
  }, []);

  if (!isOpen || !entityData) return null;

  const groupName = isWorker && entityData.groupId ? groupMap.get(String(entityData.groupId)) : null;

  // ساختار سطر افتتاحیه برای چیدمان جدید
  const renderOpeningRow = () => {
    if (isWorker || initialBalance <= 0) return null;
    return (
      <tr className="opening-balance-row bg-slate-50/70 dark:bg-slate-900/40 border-y border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-colors">
        {/* ۱. ردیف */}
        <td className="py-3 px-3 text-center text-amber-500 font-bold">
          ★
        </td>
        {/* ۲. تاریخ و ساعت */}
        <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-400 dark:text-slate-500 text-[11px]">
          -
        </td>
        {/* ۳. سند */}
        <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-400 dark:text-slate-500 text-xs">
          -
        </td>
        {/* ۴. بابت */}
        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200 text-xs">
          {txt.openingBadge}
        </td>
        {/* ۵. طرف حساب */}
        <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 text-xs">
          {entityData?.keeperName || entityData?.holderName || txt.openingSupervisor}
        </td>
        {/* ۶. شرح سند */}
        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs">
          {txt.openingDesc}
        </td>
        {/* ۷. + (وارده) */}
        <td className="py-3 px-3 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-xs" dir="ltr">
          +{formatAmount(initialBalance, effectiveCurrency)}
        </td>
        {/* ۸. - (صادره) */}
        <td className="py-3 px-3 text-left font-mono text-slate-400 dark:text-slate-600 whitespace-nowrap text-xs" dir="ltr">
          -
        </td>
        {/* ۹. مانده */}
        <td className="py-3 px-3 text-left font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap text-xs" dir="ltr">
          {formatAmount(initialBalance, effectiveCurrency)}
        </td>
      </tr>
    );
  };

  const modalContent = (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="subsidiary-ledger-modal-root fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !p-0 z-[100] w-screen h-[100dvh] max-h-[100dvh] bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
    >
      {/* کانتینر اسکرول اصلی کل صفحه */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="subsidiary-ledger-scroll-container flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain relative touch-auto"
      >
        {/* هدر ناوبار شیشه‌ای شناور اپل */}
        <header className="no-print sticky top-0 z-30 px-3.5 py-2.5 sm:px-6 bg-white/75 dark:bg-slate-900/80 backdrop-blur-2xl backdrop-saturate-180 border-b border-white/60 dark:border-white/10 shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex items-center justify-between gap-2.5 shrink-0 transition-all">
          {/* سمت راست: هویت مودال و نام حساب/طرف‌حساب */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500/15 to-indigo-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20 shadow-2xs">
              <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">
                {txt.title}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
                <span>{isWorker ? txt.partyWorker : (isBank ? txt.partyBank : txt.partyCash)}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{entityData?.name}</span>
                {entityType === 'account' && entityData?.isGlobal && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                    <Globe className="w-2.5 h-2.5" />
                    <span>{txt.corporateSharedBadge}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* سمت چپ: ابزارها، سوییچر سریع و دکمه خروج */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* سوییچ سریع حساب */}
            {entityType === 'account' && effectiveAccounts.length > 1 && (
              <select
                value={entityData?.id || ''}
                onChange={(e) => {
                  const target = effectiveAccounts.find((a) => a.id === e.target.value);
                  if (target && onSelectEntity) onSelectEntity({ type: 'account', data: target });
                }}
                className="h-8 max-w-[125px] sm:max-w-[210px] px-2.5 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/90 dark:hover:bg-slate-700/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 truncate cursor-pointer transition-colors shadow-2xs"
              >
                {effectiveAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.type === 'bank' ? '💳 ' : '🪙 '}
                    {acc.name}
                    {acc.isDefault ? txt.defaultBadge : ''}
                  </option>
                ))}
              </select>
            )}

            {/* سوییچ سریع پرسنل */}
            {entityType === 'worker' && effectiveWorkers.length > 1 && (
              <select
                value={entityData?.id || ''}
                onChange={(e) => {
                  const target = effectiveWorkers.find((w) => String(w.id) === e.target.value);
                  if (target && onSelectEntity) onSelectEntity({ type: 'worker', data: target });
                }}
                className="h-8 max-w-[125px] sm:max-w-[210px] px-2.5 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/90 dark:hover:bg-slate-700/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 truncate cursor-pointer transition-colors shadow-2xs"
              >
                {effectiveWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    👤 {w.name}{w.isActive === 0 ? txt.inactiveBadge : ''}
                  </option>
                ))}
              </select>
            )}

            {/* دکمه خروج */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-500 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95"
              aria-label={txt.close}
              title={txt.close}
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </header>

        {/* محتوای درونی اسکرول: بنر هیرو، نوار فیلتر و جدول */}
        <div className="pb-36 sm:pb-28">
          {/* ۱. بنر هیروی اجرایی لوکس معین */}
          <div className="no-print px-3.5 py-3 sm:px-6 pt-3.5 sm:pt-4 max-w-7xl mx-auto w-full">
            <div className="relative overflow-hidden rounded-3xl p-4 sm:p-6 backdrop-blur-2xl bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-white border border-white/10 shadow-2xl">
              <div className="absolute top-0 right-1/4 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* هویت حساب + نمایش مانده زنده و واحد پول با فونت متصل و بی‌نقص */}
                <div className="lg:col-span-7 space-y-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                      isWorker
                        ? (entityData?.isActive !== 0 && entityData?.isActive !== false
                            ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-emerald-500/25'
                            : 'bg-slate-800 text-slate-400 border border-slate-700')
                        : isBank 
                        ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-sky-500/25'
                        : 'bg-gradient-to-tr from-amber-500 to-amber-700 text-white shadow-amber-500/25'
                    }`}>
                      {isWorker ? (
                        entityData?.isActive !== 0 && entityData?.isActive !== false ? <User className="w-5 h-5 stroke-[2.2]" /> : <UserX className="w-5 h-5 stroke-[2.2]" />
                      ) : isBank ? (
                        <CreditCard className="w-5 h-5 stroke-[2.2]" />
                      ) : (
                        <Wallet className="w-5 h-5 stroke-[2.2]" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                          {entityData?.name}
                        </h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          isPositive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {statusBadgeText}
                        </span>
                        {entityData?.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950">
                            <Star className="w-2.5 h-2.5 fill-amber-950" />
                            <span>{txt.defaultTag}</span>
                          </span>
                        )}
                        {activeWorkerLoan && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <span>★ {txt.loanFacilityBadge}:</span>
                            <span className="font-mono" dir="ltr">{formatAmount(activeWorkerLoan.remainingBalance, effectiveCurrency)}</span>
                            {Number(activeWorkerLoan.installmentAmount) > 0 && (
                              <span className="text-amber-200/80 ms-1 font-mono">
                                ({txt.loanInstallmentLabel} {formatAmount(activeWorkerLoan.installmentAmount, effectiveCurrency)})
                              </span>
                            )}
                          </span>
                        )}
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300 border border-white/10">
                          {txt.currencyBadge(effectiveCurrency)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400 mt-1">
                        <span>{isWorker ? txt.partyWorker : (isBank ? txt.partyBank : txt.partyCash)}</span>
                        {groupName && <span>{txt.lblGroup} <strong className="text-slate-300">{groupName}</strong></span>}
                        {entityData?.role && <span>{txt.lblRole} <strong className="text-slate-300">{entityData.role}</strong></span>}
                        {entityData?.bankName && <span>{txt.lblBank} <strong className="text-slate-300">{entityData.bankName}</strong></span>}
                        {entityData?.cardNumber && <span dir="ltr" className="font-mono text-slate-300">{txt.lblCard} {entityData.cardNumber}</span>}
                      </div>
                    </div>
                  </div>

                  {/* مانده لحظه‌ای و نهایی با حروف متصل و ارقام مونو */}
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      {isWorker ? txt.liveBalanceWorker : txt.liveBalanceAccount}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl sm:text-3xl md:text-4xl font-black font-mono tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">
                        {formatAmount(currentBalance, effectiveCurrency)}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-slate-300 font-sans">
                        {getCurrencySymbol(effectiveCurrency, language)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* سمت چپ: شاخص‌های سه‌گانه */}
                <div className="lg:col-span-5 grid grid-cols-3 gap-2.5 bg-white/5 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 block truncate">
                      {isWorker ? (entityData?.wageType === 'monthly' ? txt.card1Monthly : txt.card1Worker) : txt.card1Account}
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-slate-200 mt-1 block truncate" dir="ltr">
                      {isWorker 
                        ? (entityData?.wageType === 'monthly'
                            ? formatAmount(entityData.monthlySalary || entityData.salary || 0, effectiveCurrency)
                            : `${rawTransactions.length} ${txt.rowsUnit}`)
                        : formatAmount(initialBalance, effectiveCurrency)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
                    <span className="text-[10px] text-emerald-300 block truncate">
                      {isWorker ? txt.card2Worker : txt.card2Account}
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-emerald-400 mt-1 block truncate" dir="ltr">
                      +{formatAmount(totalInflow, effectiveCurrency)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col justify-between">
                    <span className="text-[10px] text-rose-300 block truncate">
                      {isWorker ? txt.card3Worker : txt.card3Account}
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-rose-400 mt-1 block truncate" dir="ltr">
                      -{formatAmount(totalOutflow, effectiveCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ۲. نوار فیلتر و سورت */}
          <div className="no-print px-3.5 py-1.5 sm:px-6 max-w-7xl mx-auto w-full">
            <div className="p-2.5 sm:p-3 sm:px-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                    {txt.filteredDocsCount(filteredTransactions.length)}
                  </span>
                </div>

                {/* سورت دوطرفه تقویمی */}
                <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSortDirection('desc')}
                    className={`h-7 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out flex items-center gap-1.5 cursor-pointer ${
                      sortDirection === 'desc'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title={txt.sortNewest}
                  >
                    <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                    {sortDirection === 'desc' && <span>{txt.sortNewest}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortDirection('asc')}
                    className={`h-7 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out flex items-center gap-1.5 cursor-pointer ${
                      sortDirection === 'asc'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title={txt.sortOldest}
                  >
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    {sortDirection === 'asc' && <span>{txt.sortOldest}</span>}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* ضامن موبایل: کارت‌ها vs جدول */}
                <div className="md:hidden inline-flex items-center p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleToggleMobileView('cards')}
                    className={`h-7 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out flex items-center gap-1.5 cursor-pointer ${
                      mobileViewMode === 'cards'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title={txt.viewCards}
                  >
                    <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                    {mobileViewMode === 'cards' && <span>{txt.viewCards}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMobileView('table')}
                    className={`h-7 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out flex items-center gap-1.5 cursor-pointer ${
                      mobileViewMode === 'table'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title={txt.viewTable}
                  >
                    <TableIcon className="w-3.5 h-3.5 shrink-0" />
                    {mobileViewMode === 'table' && <span>{txt.viewTable}</span>}
                  </button>
                </div>

                {/* فیلتر تاریخ */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-8 sm:h-9 px-2.5 sm:px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
                >
                  <option value="all">{txt.dateAll}</option>
                  <option value="this_month">{txt.dateThisMonth}</option>
                  <option value="last_month">{txt.dateLastMonth}</option>
                  <option value="custom">{txt.dateCustom}</option>
                </select>

                {/* فیلتر دسته */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 sm:h-9 px-2.5 sm:px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
                >
                  <option value="all">{txt.catAll}</option>
                  {isWorker ? (
                    <>
                      <option value="attendance_wage">{txt.catAttendanceWage}</option>
                      <option value="advance_payment">{txt.catAdvance}</option>
                      <option value="worker_settlement">{txt.catSettlement}</option>
                    </>
                  ) : (
                    <>
                      <option value="petty_cash">{txt.catPettyCash}</option>
                      <option value="worker_settlement">{txt.catSettlement}</option>
                      <option value="advance_payment">{txt.catStaffAdvance}</option>
                      <option value="workshop_expense">{txt.catWorkshopExpense}</option>
                      <option value="account_transfer">{txt.catTransfer}</option>
                    </>
                  )}
                </select>

                {/* تفکیک پروژه‌ها برای حساب مشترک شرکت در پنل مدیر ارشد */}
                {entityType === 'account' && entityData?.isGlobal && hasAllProjectsAccess && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setProjectScopeFilter('all')}
                      className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        projectScopeFilter === 'all'
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Globe className="w-3 h-3" />
                      <span>{txt.scopeAllProjects}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectScopeFilter('current')}
                      className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                        projectScopeFilter === 'current'
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{txt.scopeThisProject}</span>
                    </button>
                  </div>
                )}

                {/* جستجو */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={txt.searchPh}
                    className="w-36 sm:w-56 h-8 sm:h-9 ps-7 pe-2.5 sm:ps-8 sm:pe-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] sm:text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs transition-all"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2 sm:start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* پیام محافظت و تفکیک برای حساب مشترک در سطح دسترسی کارگاه */}
          {entityType === 'account' && entityData?.isGlobal && !hasAllProjectsAccess && (
            <div className="no-print mx-3.5 sm:mx-6 mb-2 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 max-w-7xl">
              <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="font-bold">{txt.corporateSharedNotice}</span>
            </div>
          )}

          {/* فیلتر تاریخ سفارشی */}
          {dateFilter === 'custom' && (
            <div className="no-print mx-3.5 sm:mx-6 mb-2 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center gap-3 text-xs shrink-0 text-slate-700 dark:text-slate-300 max-w-7xl">
              <span className="font-bold text-slate-700 dark:text-slate-300">{txt.customRangeLabel}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">{txt.fromLabel}</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 px-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">{txt.toLabel}</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 px-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          )}

          {/* سربرگ مشخصات معین مخصوص پرینت */}
          <div className="print-only px-6 mb-4 pb-3 border-b-2 border-slate-900 text-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-black text-slate-900">
                  {txt.printHeaderTitle(entityData?.name || '')}
                </h1>
                <div className="text-xs text-slate-700 mt-1 flex items-center gap-4">
                  <span>{isWorker ? txt.partyWorker : (isBank ? txt.partyBank : txt.partyCash)}</span>
                  {groupName && <span>{txt.printGroup} {groupName}</span>}
                  {entityData?.role && <span>{txt.printRole} {entityData.role}</span>}
                  {entityData?.bankName && <span>{txt.printBank} {entityData.bankName}</span>}
                  {entityData?.cardNumber && <span dir="ltr">{txt.printCard} {entityData.cardNumber}</span>}
                </div>
              </div>
              <div className="text-left text-xs font-mono text-slate-800">
                <div>{txt.printReportDate} {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'fa-IR')}</div>
                <div className="font-bold text-slate-900 mt-1" dir="ltr">
                  {txt.printFinalBalance} {formatCurrency(currentBalance, effectiveCurrency, language)}
                </div>
              </div>
            </div>
          </div>

          {/* ۳. بخش اصلی جدول و فید کارت‌ها */}
          <div className="px-3.5 sm:px-6 py-2 max-w-7xl mx-auto w-full">
            {/* حالت الف: فید کارت‌های موبایل */}
            <div className={`md:hidden ${mobileViewMode === 'cards' ? 'block' : 'hidden'}`}>
              {displayedTransactions.length === 0 ? (
                <div className="py-12 px-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-slate-800 text-center text-slate-400 dark:text-slate-500 text-xs">
                  {txt.emptyMsg}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* افتتاحیه در سورت صعودی */}
                  {!isWorker && initialBalance > 0 && sortDirection === 'asc' && (
                    <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ★ {txt.openingBadge}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {txt.openingRow}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {txt.openingDesc}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
                        <span className="text-[11px] text-slate-500 font-sans">{txt.balanceAfterTx}</span>
                        <span className="font-bold text-slate-900 dark:text-white" dir="ltr">
                          +{formatAmount(initialBalance, effectiveCurrency)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* کارت‌های تراکنش */}
                  {displayedTransactions.map((tx, idx) => {
                    const cpName = getTransactionCounterparty(tx);
                    return (
                      <div
                        key={tx.id + '_mcard_' + idx}
                        className="p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2.5"
                      >
                        {/* هدر کارت: تاریخ و ساعت + شماره سند (کلیک‌پذیر) */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{tx.rawDate}</span>
                            {tx.time && <span className="text-slate-400 ms-1">{tx.time}</span>}
                          </div>

                          {/* شماره سند */}
                          {tx.voucherNumber && (
                            <button
                              type="button"
                              onClick={() => handleVoucherClick(tx.voucherNumber, tx.originalItem || tx.rawItem || tx)}
                              className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 underline underline-offset-2 cursor-pointer transition-colors"
                            >
                              {tx.voucherNumber}
                            </button>
                          )}
                        </div>

                        {/* بابت + طرف‌حساب */}
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {tx.categoryLabel || tx.category}
                          </span>
                          {cpName && (
                            <button
                              type="button"
                              onClick={() => handleCounterpartyClick(tx)}
                              className="text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 text-[11px] font-medium transition-colors"
                            >
                              {cpName}
                            </button>
                          )}
                        </div>

                        {/* شرح سند */}
                        {tx.description && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                            {tx.description}
                            {tx.reference && (
                              <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                                {txt.refPrefix} {tx.reference}
                              </span>
                            )}
                          </div>
                        )}

                        {/* مبالغ: ورودی/خروجی و مانده */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <div>
                            {tx.type === 'inflow' ? (
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                                +{formatAmount(tx.amount, effectiveCurrency)}
                              </span>
                            ) : tx.type === 'outflow' ? (
                              <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm" dir="ltr">
                                -{formatAmount(tx.amount, effectiveCurrency)}
                              </span>
                            ) : tx.type === 'loan_facility' ? (
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm" dir="ltr" title={txt.loanFacilityDesc}>
                                ★ {formatAmount(tx.amount, effectiveCurrency)} ({txt.loanFacilityPill})
                              </span>
                            ) : (
                              <span className="font-mono text-slate-400 text-xs">
                                -
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-[10px] text-slate-400 font-sans">{txt.balanceAfterTx}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                              {formatAmount(tx.runningBalance, effectiveCurrency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* افتتاحیه در سورت نزولی */}
                  {!isWorker && initialBalance > 0 && sortDirection === 'desc' && (
                    <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ★ {txt.openingBadge}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {txt.openingRow}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {txt.openingDesc}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
                        <span className="text-[11px] text-slate-500 font-sans">{txt.balanceAfterTx}</span>
                        <span className="font-bold text-slate-900 dark:text-white" dir="ltr">
                          +{formatAmount(initialBalance, effectiveCurrency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* حالت ب: جدول اصلی و استاندارد معین */}
            <div className={`${mobileViewMode === 'table' ? 'block' : 'hidden md:block'}`}>
              <div className="md:hidden mb-2 px-3.5 py-1.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-2xs flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>👉</span>
                  <span>{txt.swipeHint}</span>
                  <span>👈</span>
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {filteredTransactions.length} {txt.rowsUnit}
                </span>
              </div>

              {/* کادر گلس جدول معین با چیدمان ستونی دقیق */}
              <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar touch-auto">
                  <table className="w-full text-right text-xs min-w-[780px] border-collapse">
                    {/* هدر جدول: ردیف / تاریخ و ساعت / سند / بابت / طرف حساب / شرح سند / + / - / مانده */}
                    <thead className="sticky top-0 z-10 bg-slate-100/85 dark:bg-slate-800/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80">
                      <tr className="text-slate-700 dark:text-slate-300 font-bold text-xs">
                        {/* ۱. ردیف */}
                        <th className="py-3.5 px-3 text-center w-12">{txt.thIndex}</th>
                        {/* ۲. تاریخ و ساعت */}
                        <th className="py-3.5 px-3 whitespace-nowrap w-28">{txt.thDateTime}</th>
                        {/* ۳. سند */}
                        <th className="py-3.5 px-3 whitespace-nowrap w-24">{txt.thVoucher}</th>
                        {/* ۴. بابت */}
                        <th className="py-3.5 px-3 whitespace-nowrap w-36">{txt.thCategory}</th>
                        {/* ۵. طرف حساب */}
                        <th className="py-3.5 px-3 whitespace-nowrap w-36">{txt.thCounterparty}</th>
                        {/* ۶. شرح سند */}
                        <th className="py-3.5 px-3 min-w-[200px]">{txt.thDescription}</th>
                        {/* ۷. + (وارده) */}
                        <th className="py-3.5 px-3 text-left w-28 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-black font-mono text-sm" title={txt.thInflowTitle}>
                          {txt.thInflow}
                        </th>
                        {/* ۸. - (صادره) */}
                        <th className="py-3.5 px-3 text-left w-28 whitespace-nowrap text-rose-600 dark:text-rose-400 font-black font-mono text-sm" title={txt.thOutflowTitle}>
                          {txt.thOutflow}
                        </th>
                        {/* ۹. مانده */}
                        <th className="py-3.5 px-3 text-left w-32 whitespace-nowrap" title={txt.thBalanceTitle}>
                          {txt.thRunningBalance}
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-normal">
                      {/* ردیف افتتاحیه در صورت سورت صعودی (قدیم به جدید) */}
                      {sortDirection === 'asc' && renderOpeningRow()}

                      {/* سطرهای تراکنش‌ها */}
                      {displayedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            {txt.emptyMsg}
                          </td>
                        </tr>
                      ) : (
                        displayedTransactions.map((tx, idx) => {
                          const cpName = getTransactionCounterparty(tx);
                          return (
                            <tr 
                              key={tx.id + '_row_' + idx}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors"
                            >
                              {/* ۱. ردیف */}
                              <td className="py-3 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* ۲. تاریخ و ساعت */}
                              <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                                <div>{tx.rawDate}</div>
                                {tx.time && <div className="text-[10px] text-slate-400 dark:text-slate-500">{tx.time}</div>}
                              </td>

                              {/* ۳. سند (شماره سند تعاملی با هاور شیک و باز کردن مودال سند) */}
                              <td className="py-3 px-3 whitespace-nowrap font-mono text-xs">
                                {tx.voucherNumber ? (
                                  <button
                                    type="button"
                                    onClick={() => handleVoucherClick(tx.voucherNumber, tx.originalItem || tx.rawItem || tx)}
                                    className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 hover:underline underline-offset-2 cursor-pointer transition-colors inline-flex items-center gap-1 group"
                                    title={`مشاهده سند: ${tx.voucherNumber}`}
                                  >
                                    <span>{tx.voucherNumber}</span>
                                    <FileText className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-sky-500 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-600">-</span>
                                )}
                              </td>

                              {/* ۴. بابت (متن ساده مشکی بدون کپسول و بدون اشباع رنگ) */}
                              <td className="py-3 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200 font-medium text-xs">
                                {tx.categoryLabel || tx.category}
                              </td>

                              {/* ۵. طرف حساب (لینک تعاملی با هاور شیک برای ناوبری به معین شخص) */}
                              <td className="py-3 px-3 whitespace-nowrap text-xs">
                                {cpName ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCounterpartyClick(tx)}
                                    className="text-slate-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 font-medium cursor-pointer transition-colors inline-flex items-center gap-1 group text-right"
                                    title={language === 'ku' ? `بینینی پڕۆفایلی: ${cpName}` : language === 'en' ? `View Profile: ${cpName}` : `مشاهده پروفایل: ${cpName}`}
                                  >
                                    <span className="group-hover:underline underline-offset-2">{cpName}</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-sky-500 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-600">-</span>
                                )}
                              </td>

                              {/* ۶. شرح سند */}
                              <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs">
                                <div>{tx.description}</div>
                                {tx.reference && (
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                    {txt.refPrefix} {tx.reference}
                                  </div>
                                )}
                              </td>

                              {/* ۷. + (وارده با رنگ سبز مونو) */}
                              <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400 text-left text-xs" dir="ltr">
                                {tx.type === 'inflow' ? `+${formatAmount(tx.amount, effectiveCurrency)}` : <span className="text-slate-300 dark:text-slate-600 font-normal">-</span>}
                              </td>

                              {/* ۸. - (صادره با رنگ قرمز مونو یا تسهیلات وام پرسنلی) */}
                              <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-left text-xs" dir="ltr">
                                {tx.type === 'outflow' ? (
                                  <span className="text-rose-600 dark:text-rose-400">-{formatAmount(tx.amount, effectiveCurrency)}</span>
                                ) : tx.type === 'loan_facility' ? (
                                  <span className="text-amber-600 dark:text-amber-400" title={txt.loanFacilityDesc}>
                                    ★ {formatAmount(tx.amount, effectiveCurrency)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 font-normal">-</span>
                                )}
                              </td>

                              {/* ۹. مانده (عدد خالص مشکی بدون کپسول و کادر اضافه) */}
                              <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-200 text-left text-xs" dir="ltr">
                                {formatAmount(tx.runningBalance, effectiveCurrency)}
                              </td>
                            </tr>
                          );
                        })
                      )}

                      {/* ردیف افتتاحیه در صورت سورت نزولی (جدید به قدیم) */}
                      {sortDirection === 'desc' && renderOpeningRow()}
                    </tbody>

                    {/* سطر جمع ستونی تراز شده انتهای جدول */}
                    <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs">
                      <tr>
                        <td colSpan={6} className="py-3.5 px-3.5 text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="font-black">{txt.summaryTotals}</span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              ({filteredTransactions.length} {txt.rowsUnit})
                            </span>
                          </div>
                        </td>

                        {/* جمع کل وارده‌ها (+) */}
                        <td className="py-3.5 px-3 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-xs" dir="ltr">
                          +{formatAmount(columnTotals.sumInflow, effectiveCurrency)}
                        </td>

                        {/* جمع کل صادره‌ها (-) */}
                        <td className="py-3.5 px-3 text-left font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap text-xs" dir="ltr">
                          -{formatAmount(columnTotals.sumOutflow, effectiveCurrency)}
                        </td>

                        {/* مانده کل دوره */}
                        <td className="py-3.5 px-3 text-left font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap text-xs" dir="ltr">
                          {formatAmount(columnTotals.net, effectiveCurrency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* فوتر شناور شیشه‌ای اپل با ترانزیشن هوشمند اسکرول */}
      <footer 
        className={`no-print fixed bottom-3 start-3 end-3 sm:start-6 sm:end-6 z-40 p-2.5 sm:px-5 rounded-3xl bg-white/75 dark:bg-slate-900/80 backdrop-blur-2xl backdrop-saturate-180 border border-white/60 dark:border-white/10 shadow-[0_12px_40px_rgb(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgb(0,0,0,0.4)] flex items-center justify-between gap-3 transform transition-all duration-300 ease-out ${
          isFooterVisible 
            ? 'translate-y-0 opacity-100 pointer-events-auto' 
            : 'translate-y-28 opacity-0 pointer-events-none'
        }`}
      >
        {/* خلاصه زنده مانده و وضعیت با خط فارسی متصل */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              {txt.finalBalanceLabel}
            </span>
            <div className="flex items-baseline gap-1.5" dir="ltr">
              <span 
                className={`text-sm sm:text-base md:text-lg font-black font-mono tracking-tight truncate ${
                  isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatAmount(currentBalance, effectiveCurrency)}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-sans">
                {getCurrencySymbol(effectiveCurrency, language)}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
              isPositive
                ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                : 'bg-rose-100/80 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
            }`}>
              {statusBadgeText}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{txt.totalDocsLabel}</span>
            <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
              {filteredTransactions.length} {txt.rowsUnit}
            </span>
          </div>
        </div>

        {/* دکمه‌های عملیاتی گلس */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* دکمه اکسل */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1.5 w-9 sm:w-auto h-9 sm:px-3.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-white/60 dark:border-white/10 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
            title={txt.excelTitle}
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">{txt.excelBtn}</span>
          </button>

          {/* دکمه چاپ */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 w-9 sm:w-auto h-9 sm:px-3.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-white/60 dark:border-white/10 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
            title={txt.printTitle}
          >
            <Printer className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline">{txt.printBtn}</span>
          </button>

          {/* دکمه بستن */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 dark:from-white dark:to-slate-100 dark:hover:from-white dark:hover:to-slate-200 text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <span>{txt.close}</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] bg-white/20 dark:bg-slate-800 text-white dark:text-slate-200 rounded font-mono">
              ESC
            </kbd>
          </button>
        </div>
      </footer>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default AccountSubsidiaryLedgerModal;
