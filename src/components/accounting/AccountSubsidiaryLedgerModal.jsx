import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { db, DEFAULT_PROJECT_ID } from '../../db/db';
import { useProject } from '../../context/ProjectContext';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { useAccounting } from '../../hooks/useAccounting';
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
  Hash
} from 'lucide-react';
import { VoucherBadge } from './VoucherBadge';

/**
 * AccountSubsidiaryLedgerModal
 * مودال لوکس تمام‌صفحه Apple Liquid Glass برای مشاهده صورت گردش معین حساب‌ها و پرسنل
 * - بلور واقعی اپل در هدر و فوتر چسبان با نفوذ محتوا از زیر آنها
 * - موتور سورت دوطرفه تقویمی (جدیدترین به قدیمی‌ترین / قدیمی‌ترین به جدیدترین)
 * - رفع کامل باگ اسکرول لمسی عمودی در موبایل
 * - کنترل دوگانه نمایش در موبایل: فید کارت‌های شیشه‌ای (کامل) یا جدول فشرده ماتریسی [APP_THEME_BUTTON]
 * - حذف کامل کلمه تکراری «دینار» از سلول‌ها و جایگزینی با نشان متمرکز واحد پولی و ارقام مونو
 * - ردیف افتتاحیه لوکس و سطر جمع ستونی هوشمند (Column Totals)
 * - پشتیبانی ۱۰۰٪ سه‌زبانه (فارسی، کوردی، انگلیسی) بدون نشت واژگان
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
    thCategory: 'بابت / سند مالی',
    thDescription: 'شرح و پیگیری سند',
    thCounterparty: 'طرف‌حساب',
    thInflowWorker: 'طلب / بستانکار (+)',
    thInflowAccount: 'وارده (ورودی +)',
    thOutflowWorker: 'پرداختی / بدهکار (-)',
    thOutflowAccount: 'صادره (خروجی -)',
    thRunningBalance: 'مانده لحظه‌ای',
    thSource: 'منبع',
    openingRow: 'افتتاحیه',
    openingBadge: 'سند افتتاحیه دوره',
    openingDesc: 'ثبت مانده اولیه در ابتدای دوره مالی',
    openingSupervisor: 'سرپرست سیستم',
    openingBaseSource: 'پایه مالی',
    emptyMsg: 'هیچ گردش مالی یا تراکنشی منطبق با فیلتر انتخابی یافت نشد.',
    refPrefix: 'شماره ارجاع:',
    docFallback: 'سند مالی',
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
    payAdvanceCat: 'پرداخت مساعده',
    paySettlementCat: 'تسویه حساب دستمزد',
    payAdvanceDesc: 'پرداخت مساعده نقدی/بانکی',
    paySettlementDesc: 'پرداخت تسویه حساب کارکرد',
    payBonusCat: 'عیدی و پاداش',
    payBonusDesc: 'پرداخت پاداش / عیدی پرسنل',
    paySource: 'پرداخت مالی',
    defaultBadge: ' (پیش‌فرض)',
    inactiveBadge: ' (غیرفعال)',
    defaultTag: 'پیش‌فرض',
    lblGroup: '• گروه:',
    lblRole: '• سمت:',
    lblBank: '• بانک:',
    lblCard: '• کارت:',
    swipeHint: 'برای پیمایش ستون‌ها به طرفین بکشید',
    sortLabel: 'ترتیب:',
    sortNewest: 'جدید به قدیم',
    sortOldest: 'قدیم به جدید',
    viewCards: 'کارت‌ها',
    viewTable: 'جدول',
    currencyBadge: (c) => `واحد مبالغ: ${c}`,
    summaryTotals: 'جمع ستون‌ها',
    sumInflow: 'مجموع وارده (+)',
    sumOutflow: 'مجموع صادره (-)',
    periodNet: 'تراز فیلتر',
    balanceAfterTx: 'مانده لحظه‌ای:',
    inflowPill: 'وارده (+)',
    outflowPill: 'صادره (-)',
    excelHeaders: {
      row: 'ردیف',
      date: 'تاریخ',
      time: 'ساعت',
      category: 'بابت / سرفصل',
      desc: 'شرح تراکنش',
      counterparty: 'طرف حساب',
      inflow: 'وارده (ورودی +)',
      outflow: 'صادره (خروجی -)',
      balance: 'مانده لحظه‌ای',
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
    thDateTime: 'بەروار و کاتژمێر',
    thCategory: 'بابەت / بەڵگەنامەی دارایی',
    thDescription: 'ڕوونکردنەوە و بەدواداچوون',
    thCounterparty: 'لایەنی پەیوەندیدار',
    thInflowWorker: 'شایستە / بستانکار (+)',
    thInflowAccount: 'هاتوو (ورودی +)',
    thOutflowWorker: 'دراو / بدهکار (-)',
    thOutflowAccount: 'دەرچوو (خروجی -)',
    thRunningBalance: 'باڵانسی ساتەوەخت',
    thSource: 'سەرچاوە',
    openingRow: 'دەستپێک',
    openingBadge: 'بەڵگەنامەی سەرەتایی خول',
    openingDesc: 'تۆمارکردنی باڵانسی سەرەتایی لە دەستپێکی خولی دارایی',
    openingSupervisor: 'سەرپەرشتیاری سیستەم',
    openingBaseSource: 'بنەڕەتی دارایی',
    emptyMsg: 'هیچ مامەڵەیەکی دارایی نەدۆزرایەوە.',
    refPrefix: 'ژمارەی بەدواداچوون:',
    docFallback: 'بەڵگەنامە',
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
    paySource: 'پارەدان',
    defaultBadge: ' (بنەڕەتی)',
    inactiveBadge: ' (ناچالاک)',
    defaultTag: 'بنەڕەتی',
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
    currencyBadge: (c) => `یەکەی دارایی: ${c}`,
    summaryTotals: 'کۆی گشتی ستوونەکان',
    sumInflow: 'سەرجەم هاتوو (+)',
    sumOutflow: 'سەرجەم دەرچوو (-)',
    periodNet: 'باڵانسی فلتەر',
    balanceAfterTx: 'باڵانسی ساتەوەخت:',
    inflowPill: 'هاتوو (+)',
    outflowPill: 'دەرچوو (-)',
    excelHeaders: {
      row: 'ڕیزبەندی',
      date: 'بەروار',
      time: 'کاتژمێر',
      category: 'بابەت / سەرپەڕ',
      desc: 'ڕوونکردنەوەی مامەڵە',
      counterparty: 'لایەنی پەیوەندیدار',
      inflow: 'هاتوو (+)',
      outflow: 'دەرچوو (-)',
      balance: 'باڵانسی ساتەوەخت',
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
    thCategory: 'Category / Voucher',
    thDescription: 'Description & Tracking',
    thCounterparty: 'Counterparty',
    thInflowWorker: 'Credit / Due (+)',
    thInflowAccount: 'Inflow (+)',
    thOutflowWorker: 'Debit / Paid (-)',
    thOutflowAccount: 'Outflow (-)',
    thRunningBalance: 'Running Balance',
    thSource: 'Source',
    openingRow: 'Opening',
    openingBadge: 'Opening Balance Voucher',
    openingDesc: 'Initial balance recorded at beginning of period',
    openingSupervisor: 'System Admin',
    openingBaseSource: 'Base Ledger',
    emptyMsg: 'No financial transactions match the selected filter.',
    refPrefix: 'Ref No:',
    docFallback: 'Voucher',
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
    payAdvanceCat: 'Advance Payment',
    paySettlementCat: 'Wage Settlement',
    payAdvanceDesc: 'Cash/Bank Advance Payment',
    paySettlementDesc: 'Wage Settlement Payment',
    payBonusCat: 'Bonus & Gift',
    payBonusDesc: 'Staff Bonus / Gift Payment',
    paySource: 'Payment',
    defaultBadge: ' (Default)',
    inactiveBadge: ' (Inactive)',
    defaultTag: 'Default',
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
    currencyBadge: (c) => `Currency: ${c}`,
    summaryTotals: 'Column Totals',
    sumInflow: 'Total Inflow (+)',
    sumOutflow: 'Total Outflow (-)',
    periodNet: 'Filter Net',
    balanceAfterTx: 'Balance:',
    inflowPill: 'Inflow (+)',
    outflowPill: 'Outflow (-)',
    excelHeaders: {
      row: 'Row',
      date: 'Date',
      time: 'Time',
      category: 'Category',
      desc: 'Description',
      counterparty: 'Counterparty',
      inflow: 'Inflow (+)',
      outflow: 'Outflow (-)',
      balance: 'Running Balance',
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
  const { currentProject } = useProject();
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // هوک مالی حسابداری برای تأمین مستقل داده‌های حساب‌ها در صورت فراخوانی از تب‌های غیرحسابداری
  const accounting = useAccounting();
  const effectiveCurrency = currency || accounting?.currency || 'IQD';
  const effectiveAccounts = (allAccounts && allAccounts.length > 0) ? allAccounts : (accounting?.financialAccounts || []);
  const effectiveWorkers = (allWorkers && allWorkers.length > 0) ? allWorkers : (accounting?.workers || []);

  const isRtl = language === 'fa' || language === 'ku';
  const entityType = entity?.type || 'account'; // 'account' | 'worker'
  const entityData = entity?.data || entity;

  const effectiveAccountData = accountData || (entityType === 'account' && entityData?.id ? accounting?.accountBalances?.get(String(entityData.id)) : null);

  // استیت‌های فیلتر، سورت و حالت نمایش
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // استیت سورت زمانی دوطرفه: پیش‌فرض جدیدترین در بالا (طبق درخواست کاربر)
  const [sortDirection, setSortDirection] = useState('desc'); // 'desc' | 'asc'

  // استیت حالت نمایش در موبایل با ذخیره علاقه‌مندی کاربر در localStorage
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

  // کنترل نمایش ترانزیشنی فوتر شناور با جهت اسکرول (Apple Liquid Glass Floating Dock)
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const lastScrollTopRef = useRef(0);
  const scrollContainerRef = useRef(null);

  const handleScroll = useCallback((e) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    const delta = currentScrollTop - lastScrollTopRef.current;

    // در نمای اول و بالای صفحه (Initial View) فوتر همیشه نمایان است
    if (currentScrollTop < 40) {
      setIsFooterVisible(true);
    } 
    // اسکرول به سمت پایین (Scroll Down) -> مخفی شدن فوتر با ترانزیشن به سمت پایین
    else if (delta > 10) {
      setIsFooterVisible(false);
    } 
    // اسکرول به سمت بالا (Scroll Up) -> بازگشت فوری فوتر به جای اولیه با ترانزیشن
    else if (delta < -10) {
      setIsFooterVisible(true);
    }

    // اگر کاربر به انتهای لیست رسید، فوتر مجدداً نمایش داده شود تا دکمه‌ها و جمع کل در دسترس باشند
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

  // ۱. بارگذاری اطلاعات تکمیلی پرسنل در صورت انتخاب پرسنل
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

  const groupMap = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => map.set(String(g.id), g.name));
    return map;
  }, [groups]);

  // محاسبه تراکنش‌های معین برای پرسنل (طلب کارکرد = ورودی، مساعده و تسویه = خروجی)
  const workerTransactionsData = useMemo(() => {
    if (entityType !== 'worker' || !entityData) {
      return { rawTransactions: [], initialBalance: 0, totalInflow: 0, totalOutflow: 0, currentBalance: 0 };
    }

    const wDaily = Number(String(entityData.dailyRate || 0).replace(/,/g, '')) || 0;
    const wOtRate = Number(String(entityData.overtimeHourlyRate || 0).replace(/,/g, '')) || 0;

    const getLogPay = (l) => {
      let val = Number(l.totalDayPay);
      if (!isNaN(val) && val > 0) return val;
      const otH = Math.max(0, Number(l.overtimeHours) || 0);
      if (l.type === 'half') return (wDaily * 0.5) + (otH * wOtRate);
      if (l.type === 'hourly') return otH * (wOtRate || (wDaily / 8));
      return wDaily + (otH * wOtRate);
    };

    // ترکیب رویدادها
    const combinedEvents = [];

    // الف) کارکردها و دستمزدها (طلب کارگر - ورودی به حساب کارگر)
    workerLogs.forEach((l) => {
      const pay = getLogPay(l);
      const catLabel = l.type === 'half' ? txt.wageHalf : l.type === 'hourly' ? txt.wageHourly : txt.wageDaily;
      const desc = l.note || txt.wageDesc(l.hours, l.overtimeHours);

      combinedEvents.push({
        id: `log_${l.id}`,
        rawDate: l.date || '',
        date: l.date || '',
        time: '',
        category: 'attendance_wage',
        categoryLabel: catLabel,
        description: desc,
        counterparty: entityData.name,
        type: 'inflow',
        amount: pay,
        sourceLabel: txt.wageSource,
        createdAt: l.createdAt || l.date || ''
      });
    });

    // ب) پرداخت‌ها: مساعده‌ها، پاداش‌ها و تسویه‌حساب‌ها (پرداختی به کارگر)
    workerPayments.forEach((p) => {
      const isAdvance = p.type === 'advance' || p.type === 'Advance_Payment';
      const isBonus = p.type === 'bonus' || p.type === 'eid';
      const cat = isBonus ? 'worker_bonus' : isAdvance ? 'advance_payment' : 'worker_settlement';
      const catLabel = isBonus ? (p.bonusTitle || txt.payBonusCat) : isAdvance ? txt.payAdvanceCat : txt.paySettlementCat;
      const desc = p.notes || p.note || p.description || (isBonus ? txt.payBonusDesc : isAdvance ? txt.payAdvanceDesc : txt.paySettlementDesc);

      combinedEvents.push({
        id: `pay_${p.id}`,
        rawDate: (p.date || p.createdAt || '').slice(0, 10),
        date: (p.date || p.createdAt || '').slice(0, 10),
        time: (p.createdAt || '').slice(11, 16),
        category: cat,
        categoryLabel: catLabel,
        description: desc,
        counterparty: entityData.name,
        type: isBonus ? 'bonus_gift' : 'outflow',
        amount: Number(p.amount) || 0,
        sourceLabel: isBonus ? (txt.payBonusCat || 'عیدی و پاداش') : txt.paySource,
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
      } else if (ev.type === 'bonus_gift') {
        ev.isBonus = true;
      } else {
        running -= ev.amount;
        totalOut += ev.amount;
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
  }, [entityType, entityData, workerLogs, workerPayments, txt]);

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

  // واکشی تراکنش‌های خام (در توالی زمانی تقویمی)
  const rawTransactions = isWorker ? workerTransactionsData.rawTransactions : (effectiveAccountData?.transactions || []);

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
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const partyMatch = (tx.counterparty || '').toLowerCase().includes(q);
        const refMatch = (tx.reference || '').toLowerCase().includes(q);
        const catMatch = (tx.categoryLabel || '').toLowerCase().includes(q);
        const voucherMatch = (tx.voucherNumber || '').toLowerCase().includes(q);
        if (!descMatch && !partyMatch && !refMatch && !catMatch && !voucherMatch) return false;
      }

      return true;
    });
  }, [rawTransactions, dateFilter, customStart, customEnd, categoryFilter, searchQuery]);

  // محاسبه سرجمع‌های ستونی (Column Totals) برای ردیف‌های فیلتر شده
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

  // خروجی اکسل هماهنگ با ترتیب سورت انتخابی کاربر
  const handleExportExcel = useCallback(() => {
    const h = txt.excelHeaders;
    const rows = [
      ...((!isWorker && initialBalance > 0 && sortDirection === 'asc') ? [{
        [h.row]: txt.openingRow,
        [h.date]: '-',
        [h.time]: '-',
        [h.category]: txt.openingBadge,
        [h.desc]: txt.openingDesc,
        [h.counterparty]: entityData?.keeperName || entityData?.holderName || txt.openingSupervisor,
        [h.inflow]: initialBalance,
        [h.outflow]: 0,
        [h.balance]: initialBalance,
        [h.currency]: effectiveCurrency
      }] : []),
      ...displayedTransactions.map((tx, idx) => ({
        [h.row]: idx + 1,
        [h.date]: tx.rawDate || tx.date,
        [h.time]: tx.time || '-',
        [h.category]: tx.categoryLabel || tx.category,
        [h.desc]: tx.description || '-',
        [h.counterparty]: tx.counterparty || '-',
        [h.inflow]: tx.type === 'inflow' ? tx.amount : 0,
        [h.outflow]: tx.type === 'outflow' ? tx.amount : 0,
        [h.balance]: tx.runningBalance,
        [h.currency]: effectiveCurrency
      })),
      ...((!isWorker && initialBalance > 0 && sortDirection === 'desc') ? [{
        [h.row]: txt.openingRow,
        [h.date]: '-',
        [h.time]: '-',
        [h.category]: txt.openingBadge,
        [h.desc]: txt.openingDesc,
        [h.counterparty]: entityData?.keeperName || entityData?.holderName || txt.openingSupervisor,
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
  }, [displayedTransactions, initialBalance, entityData, effectiveCurrency, isWorker, sortDirection, txt]);

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

  // ساختار کامپوننت سطر افتتاحیه برای استفاده در جدول
  const renderOpeningRow = () => {
    if (isWorker || initialBalance <= 0) return null;
    return (
      <tr className="opening-balance-row bg-amber-500/10 dark:bg-amber-500/15 border-y border-amber-200/80 dark:border-amber-800/60 font-semibold text-slate-800 dark:text-amber-100 transition-colors">
        <td className="py-3.5 px-3 text-center text-amber-600 dark:text-amber-400 font-bold">
          <Star className="w-4 h-4 mx-auto fill-amber-500 text-amber-500" />
        </td>
        <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-amber-700 dark:text-amber-300">
          {txt.openingRow}
        </td>
        <td className="py-3.5 px-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
            {txt.openingBadge}
          </span>
        </td>
        <td className="py-3.5 px-3 text-slate-800 dark:text-slate-100 font-medium">
          {txt.openingDesc}
        </td>
        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
          {entityData?.keeperName || entityData?.holderName || txt.openingSupervisor}
        </td>
        {/* وارده (+) */}
        <td className="py-3.5 px-3 text-left font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap" dir="ltr">
          +{formatAmount(initialBalance, effectiveCurrency)}
        </td>
        {/* صادره (-) */}
        <td className="py-3.5 px-3 text-left font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap" dir="ltr">
          -
        </td>
        {/* مانده لحظه‌ای */}
        <td className="py-3.5 px-3 text-left font-mono font-black text-slate-900 dark:text-white whitespace-nowrap" dir="ltr">
          <span className="inline-block px-2.5 py-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs">
            {formatAmount(initialBalance, effectiveCurrency)}
          </span>
        </td>
        {/* منبع */}
        <td className="py-3.5 px-3 text-center whitespace-nowrap">
          <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {txt.openingBaseSource}
          </span>
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
      {/* کانتینر اسکرول اصلی کل صفحه: محتوا به صورت طبیعی به زیر هدر نفوذ می‌کند و بلور شیشه‌ای فعال می‌شود */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="subsidiary-ledger-scroll-container flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain relative touch-auto"
      >
        {/* هدر ناوبار شیشه‌ای شناور اپل (Sticky Top Inside Scroll Container) */}
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

            {/* دکمه خروج مینیمال اپل */}
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

        {/* محتوای درونی اسکرول: بنر هیرو، نوار فیلتر و ابزار، و ماتریس جدول/کارت‌ها */}
        <div className="pb-36 sm:pb-28">
          {/* ۱. بنر هیروی اجرایی لوکس معین (Executive Hero Banner) */}
          <div className="no-print px-3.5 py-3 sm:px-6 pt-3.5 sm:pt-4 max-w-7xl mx-auto w-full">
            <div className="relative overflow-hidden rounded-3xl p-4 sm:p-6 backdrop-blur-2xl bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-white border border-white/10 shadow-2xl">
              {/* حباب‌های بلورین درخشان در پس‌زمینه */}
              <div className="absolute top-0 right-1/4 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* سمت راست: هویت حساب + نمایش مانده زنده و وضعیت */}
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

                  {/* مانده لحظه‌ای و نهایی */}
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      {isWorker ? txt.liveBalanceWorker : txt.liveBalanceAccount}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl sm:text-3xl md:text-4xl font-black font-mono tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">
                        {formatCurrency(currentBalance, effectiveCurrency, language)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* سمت چپ: کارت شیشه‌ای شاخص‌های سه‌گانه با ارقام خالص و خوانا */}
                <div className="lg:col-span-5 grid grid-cols-3 gap-2.5 bg-white/5 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
                  {/* ۱. افتتاحیه / مبنا */}
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 block truncate">
                      {isWorker ? txt.card1Worker : txt.card1Account}
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-slate-200 mt-1 block truncate" dir="ltr">
                      {isWorker ? `${rawTransactions.length} ${txt.rowsUnit}` : formatAmount(initialBalance, effectiveCurrency)}
                    </span>
                  </div>

                  {/* ۲. کل وارده (ورودی +) */}
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
                    <span className="text-[10px] text-emerald-300 block truncate">
                      {isWorker ? txt.card2Worker : txt.card2Account}
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-emerald-400 mt-1 block truncate" dir="ltr">
                      +{formatAmount(totalInflow, effectiveCurrency)}
                    </span>
                  </div>

                  {/* ۳. کل صادره (خروجی -) */}
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

          {/* ۲. نوار فیلتر و کنترل‌های سورت و حالت نمایش (Glass Control Toolbar) */}
          <div className="no-print px-3.5 py-1.5 sm:px-6 max-w-7xl mx-auto w-full">
            <div className="p-2.5 sm:p-3 sm:px-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
              {/* بخش راست: تعداد اسناد فیلترشده + کنترل سورت زمانی [APP_THEME_BUTTON] */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                    {txt.filteredDocsCount(filteredTransactions.length)}
                  </span>
                </div>

                {/* کنترل سورت دوطرفه تقویمی با تم برنامه [APP_THEME_BUTTON] */}
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

              {/* بخش چپ: فیلترهای تاریخ، سرفصل، جستجو و ضامن حالت نمایش در موبایل */}
              <div className="flex flex-wrap items-center gap-2">
                {/* ضامن حالت نمایش در موبایل (کارت‌ها vs جدول) با استایل [APP_THEME_BUTTON] */}
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

          {/* سربرگ مشخصات معین مخصوص پرینت فیزیکی */}
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

          {/* ۳. بخش اصلی نمایش: فید کارت‌های شیشه‌ای موبایل یا جدول لوکس دسکتاپ */}
          <div className="px-3.5 sm:px-6 py-2 max-w-7xl mx-auto w-full">
            {/* حالت الف: فید کارت‌های شیشه‌ای موبایل (Mobile Glass Cards Feed) */}
            <div className={`md:hidden ${mobileViewMode === 'cards' ? 'block' : 'hidden'}`}>
              {displayedTransactions.length === 0 ? (
                <div className="py-12 px-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-slate-800 text-center text-slate-400 dark:text-slate-500 text-xs">
                  {txt.emptyMsg}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* ردیف افتتاحیه در صورت سورت صعودی (قدیم به جدید) */}
                  {!isWorker && initialBalance > 0 && sortDirection === 'asc' && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-800/60 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-200">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{txt.openingBadge}</span>
                        </span>
                        <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                          {txt.openingRow}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {txt.openingDesc}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-amber-200/50 dark:border-amber-800/40 font-mono text-xs">
                        <span className="text-[11px] text-slate-500">{txt.balanceAfterTx}</span>
                        <span className="font-black text-slate-900 dark:text-white" dir="ltr">
                          +{formatAmount(initialBalance, effectiveCurrency)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* کارت‌های تراکنش‌ها */}
                  {displayedTransactions.map((tx, idx) => (
                    <div
                      key={tx.id + '_card_' + idx}
                      className="p-3.5 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-white/70 dark:border-slate-800/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-all space-y-2.5"
                    >
                      {/* هدر کارت: تاریخ و ساعت + بج سرفصل و سند مالی */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tx.rawDate}</span>
                          {tx.time && (
                            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3 ms-1" />
                              <span>{tx.time}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            tx.category === 'attendance_wage'
                              ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                              : tx.category === 'petty_cash'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : tx.category === 'worker_settlement'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                              : tx.category === 'advance_payment'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : tx.category === 'account_transfer'
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}>
                            {tx.categoryLabel}
                          </span>
                          {tx.voucherNumber && (
                            <VoucherBadge
                              voucherNumber={tx.voucherNumber}
                              item={tx.originalItem || tx}
                              size="xs"
                            />
                          )}
                        </div>
                      </div>

                      {/* بدنه کارت: شرح تراکنش و طرف‌حساب/مرجع */}
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                          {tx.description}
                        </div>
                        {(tx.counterparty || tx.reference) && (
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {tx.counterparty && (
                              <span className="flex items-center gap-1 font-medium">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{tx.counterparty}</span>
                              </span>
                            )}
                            {tx.reference && (
                              <span className="font-mono text-[10px] text-slate-400">
                                {txt.refPrefix} {tx.reference}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* فوتر داخلی کارت: تفکیک مبلغ تراکنش و مانده لحظه‌ای */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        {/* مبلغ تراکنش */}
                        <div>
                          {tx.type === 'inflow' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-black text-xs border border-emerald-500/20" dir="ltr">
                              +{formatAmount(tx.amount, effectiveCurrency)}
                            </span>
                          ) : tx.type === 'outflow' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 font-mono font-black text-xs border border-rose-500/20" dir="ltr">
                              -{formatAmount(tx.amount, effectiveCurrency)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-black text-xs border border-amber-500/20" dir="ltr">
                              ★ {formatAmount(tx.amount, effectiveCurrency)}
                            </span>
                          )}
                        </div>

                        {/* مانده لحظه‌ای پس از تراکنش */}
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-[10px] text-slate-400 font-sans">{txt.balanceAfterTx}</span>
                          <span className={`font-black ${tx.runningBalance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                            {formatAmount(tx.runningBalance, effectiveCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* ردیف افتتاحیه در صورت سورت نزولی (جدید به قدیم) در انتهای لیست */}
                  {!isWorker && initialBalance > 0 && sortDirection === 'desc' && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-800/60 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-200">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{txt.openingBadge}</span>
                        </span>
                        <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                          {txt.openingRow}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {txt.openingDesc}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-amber-200/50 dark:border-amber-800/40 font-mono text-xs">
                        <span className="text-[11px] text-slate-500">{txt.balanceAfterTx}</span>
                        <span className="font-black text-slate-900 dark:text-white" dir="ltr">
                          +{formatAmount(initialBalance, effectiveCurrency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* حالت ب: جدول لوکس شیشه‌ای (در دسکتاپ همیشه فعال، در موبایل وابسته به ضامن) */}
            <div className={`${mobileViewMode === 'table' ? 'block' : 'hidden md:block'}`}>
              {/* راهنمای اسکرول افقی روی موبایل وقتی در حالت جدول است */}
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

              {/* کادر گلس جدول معین با کانتینر اسکرول بدون هیچ قفل لمسی */}
              <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar touch-auto">
                  <table className="w-full text-right text-xs min-w-[760px] border-collapse">
                    {/* هدر شیشه‌ای جدول با نشان‌های تفکیک‌شده */}
                    <thead className="sticky top-0 z-10 bg-slate-100/80 dark:bg-slate-800/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80">
                      <tr className="text-slate-600 dark:text-slate-300 font-bold">
                        <th className="py-3.5 px-3 text-center w-12">{txt.thIndex}</th>
                        <th className="py-3.5 px-3 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{txt.thDateTime}</span>
                          </span>
                        </th>
                        <th className="py-3.5 px-3 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                            <span>{txt.thCategory}</span>
                          </span>
                        </th>
                        <th className="py-3.5 px-3 min-w-[200px]">
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            <span>{txt.thDescription}</span>
                          </span>
                        </th>
                        <th className="py-3.5 px-3 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{txt.thCounterparty}</span>
                          </span>
                        </th>
                        <th className="py-3.5 px-3 whitespace-nowrap text-left text-emerald-600 dark:text-emerald-400">
                          <span className="inline-flex items-center gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>{isWorker ? txt.thInflowWorker : txt.thInflowAccount}</span>
                            <span className="text-[10px] font-mono text-emerald-500/80">[{effectiveCurrency}]</span>
                          </span>
                        </th>
                        <th className="py-3.5 px-3 whitespace-nowrap text-left text-rose-600 dark:text-rose-400">
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>{isWorker ? txt.thOutflowWorker : txt.thOutflowAccount}</span>
                            <span className="text-[10px] font-mono text-rose-500/80">[{effectiveCurrency}]</span>
                          </span>
                        </th>
                        <th className="py-3.5 px-3 whitespace-nowrap text-left">
                          <span className="inline-flex items-center gap-1">
                            <Scale className="w-3.5 h-3.5 text-slate-400" />
                            <span>{txt.thRunningBalance}</span>
                            <span className="text-[10px] font-mono text-slate-400">[{effectiveCurrency}]</span>
                          </span>
                        </th>
                        <th className="py-3.5 px-3 text-center whitespace-nowrap">{txt.thSource}</th>
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
                        displayedTransactions.map((tx, idx) => (
                          <tr 
                            key={tx.id + '_row_' + idx}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors"
                          >
                            {/* ردیف */}
                            <td className="py-3 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            {/* تاریخ و ساعت */}
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                              <div>{tx.rawDate}</div>
                              {tx.time && <div className="text-[10px] text-slate-400 dark:text-slate-500">{tx.time}</div>}
                            </td>

                            {/* سرفصل + بج سند حسابداری */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  tx.category === 'attendance_wage'
                                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                                    : tx.category === 'petty_cash'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : tx.category === 'worker_settlement'
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                    : tx.category === 'advance_payment'
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : tx.category === 'account_transfer'
                                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                }`}>
                                  {tx.categoryLabel}
                                </span>
                                {tx.voucherNumber && (
                                  <VoucherBadge
                                    voucherNumber={tx.voucherNumber}
                                    item={tx.originalItem || tx}
                                    size="xs"
                                  />
                                )}
                              </div>
                            </td>

                            {/* شرح و پیگیری */}
                            <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium">
                              <div>{tx.description}</div>
                              {tx.reference && (
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                  {txt.refPrefix} {tx.reference}
                                </div>
                              )}
                            </td>

                            {/* طرف‌حساب */}
                            <td className="py-3 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                              {tx.counterparty || '-'}
                            </td>

                            {/* وارده / طلب (+) - مبالغ بدون کلمه تکراری دینار */}
                            <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400 text-left" dir="ltr">
                              {tx.type === 'inflow' ? `+${formatAmount(tx.amount, effectiveCurrency)}` : '-'}
                            </td>

                            {/* صادره / پرداختی (-) - مبالغ بدون کلمه تکراری دینار */}
                            <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-rose-600 dark:text-rose-400 text-left" dir="ltr">
                              {tx.type === 'outflow' ? `-${formatAmount(tx.amount, effectiveCurrency)}` : '-'}
                            </td>

                            {/* مانده لحظه‌ای - مبالغ بدون کلمه تکراری دینار */}
                            <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-left" dir="ltr">
                              <span className={`inline-block px-2.5 py-0.5 rounded-xl border shadow-2xs ${
                                tx.runningBalance >= 0 
                                  ? 'bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-200/80 dark:border-slate-700/80' 
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80'
                              }`}>
                                {formatAmount(tx.runningBalance, effectiveCurrency)}
                              </span>
                            </td>

                            {/* منبع سند */}
                            <td className="py-3 px-3 text-center">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                                {tx.sourceLabel || txt.docFallback}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}

                      {/* ردیف افتتاحیه در صورت سورت نزولی (جدید به قدیم) */}
                      {sortDirection === 'desc' && renderOpeningRow()}
                    </tbody>

                    {/* سطر جمع ستونی هوشمند (Column Totals Sticky/End Footer) */}
                    <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs">
                      <tr>
                        <td colSpan={5} className="py-3.5 px-3.5 text-slate-700 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-black">{txt.summaryTotals}</span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              ({filteredTransactions.length} {txt.rowsUnit})
                            </span>
                          </div>
                        </td>

                        {/* جمع کل وارده‌ها */}
                        <td className="py-3.5 px-3 text-left font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap bg-emerald-500/5" dir="ltr">
                          +{formatAmount(columnTotals.sumInflow, effectiveCurrency)}
                        </td>

                        {/* جمع کل صادره‌ها */}
                        <td className="py-3.5 px-3 text-left font-mono font-black text-rose-600 dark:text-rose-400 whitespace-nowrap bg-rose-500/5" dir="ltr">
                          -{formatAmount(columnTotals.sumOutflow, effectiveCurrency)}
                        </td>

                        {/* مانده تراز فیلتر */}
                        <td className="py-3.5 px-3 text-left font-mono font-black whitespace-nowrap" dir="ltr">
                          <span className={`inline-block px-2.5 py-0.5 rounded-xl border shadow-2xs ${
                            columnTotals.net >= 0
                              ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-100/80 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}>
                            {formatAmount(columnTotals.net, effectiveCurrency)}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[10px]">
                          Σ
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

      {/* فوتر شناور شیشه‌ای اپل با ترانزیشن هوشمند اسکرول (Apple Liquid Glass Floating Dock) */}
      <footer 
        className={`no-print fixed bottom-3 start-3 end-3 sm:start-6 sm:end-6 z-40 p-2.5 sm:px-5 rounded-3xl bg-white/75 dark:bg-slate-900/80 backdrop-blur-2xl backdrop-saturate-180 border border-white/60 dark:border-white/10 shadow-[0_12px_40px_rgb(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgb(0,0,0,0.4)] flex items-center justify-between gap-3 transform transition-all duration-300 ease-out ${
          isFooterVisible 
            ? 'translate-y-0 opacity-100 pointer-events-auto' 
            : 'translate-y-28 opacity-0 pointer-events-none'
        }`}
      >
        {/* خلاصه زنده مانده و وضعیت */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              {txt.finalBalanceLabel}
            </span>
            <span 
              className={`text-sm sm:text-base md:text-lg font-black font-mono tracking-tight truncate ${
                isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`} 
              dir="ltr"
            >
              {formatCurrency(currentBalance, effectiveCurrency, language)}
            </span>
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
