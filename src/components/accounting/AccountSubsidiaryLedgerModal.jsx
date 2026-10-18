import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  Layers
} from 'lucide-react';

/**
 * AccountSubsidiaryLedgerModal
 * مودال فول‌اسکرین، اختصاصی و بدون حاشیه برای مشاهده معین مالی حساب‌ها و پرسنل
 * - پوشش ۱۰۰٪ تمام‌صفحه بدون کادر و پدینگ بیرونی
 * - پشتیبانی همزمان از معین حساب‌های بانکی/صندوق‌ها و معین مالی پرسنل (ورودی‌ها و خروجی‌ها)
 * - بدون دکمه‌های عملیاتی مزاحم (شارژ، واریز، ثبت لاگ)؛ صرفاً نمایش خالص گردش حساب
 * - بسته شدن سریع با کلید Escape یا دکمه ضربدر
 * - دارای جدول فیلترپذیر ریزتراکنش‌ها با محاسبه لحظه‌ای مانده (Running Balance)
 * - امکان خروجی فایل اکسل
 */
// Scoped dictionary for AccountSubsidiaryLedgerModal
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
    searchPh: 'جستجو در شرح سند...',
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
    thDateTime: 'تاریخ و زمان',
    thCategory: 'بابت / سرفصل',
    thDescription: 'شرح و توضیحات تراکنش',
    thCounterparty: 'طرف‌حساب',
    thInflowWorker: 'طلب / بستانکار (+)',
    thInflowAccount: 'وارده (ورودی +)',
    thOutflowWorker: 'پرداختی / بدهکار (-)',
    thOutflowAccount: 'صادره (خروجی -)',
    thRunningBalance: 'مانده لحظه‌ای',
    thSource: 'منبع',
    openingRow: 'افتتاحیه',
    openingBadge: 'موجودی اولیه',
    openingDesc: 'ثبت موجودی اولیه هنگام افتتاح حساب در سیستم',
    openingSupervisor: 'سرپرست',
    openingBaseSource: 'پایه',
    emptyMsg: 'هیچ گردش مالی یا تراکنشی منطبق با فیلتر انتخابی یافت نشد.',
    refPrefix: 'شماره ارجاع:',
    docFallback: 'سند',
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
    paySource: 'پرداخت مالی',
    defaultBadge: ' (پیش‌فرض)',
    inactiveBadge: ' (غیرفعال)',
    defaultTag: 'پیش‌فرض',
    lblGroup: '• گروه:',
    lblRole: '• سمت:',
    lblBank: '• بانک:',
    lblCard: '• کارت:',
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
    thCategory: 'بابەت / سەرپەڕ',
    thDescription: 'ڕوونکردنەوەی مامەڵە',
    thCounterparty: 'لایەنی پەیوەندیدار',
    thInflowWorker: 'شایستە / بستانکار (+)',
    thInflowAccount: 'هاتوو (ورودی +)',
    thOutflowWorker: 'دراو / بدهکار (-)',
    thOutflowAccount: 'دەرچوو (خروجی -)',
    thRunningBalance: 'باڵانسی ساتەوەخت',
    thSource: 'سەرچاوە',
    openingRow: 'دەستپێک',
    openingBadge: 'باڵانسی سەرەتایی',
    openingDesc: 'تۆمارکردنی باڵانسی سەرەتایی لە کاتی کردنەوەی حیساب',
    openingSupervisor: 'سەرپەرشتیار',
    openingBaseSource: 'بنەڕەت',
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
    paySource: 'پارەدان',
    defaultBadge: ' (بنەڕەتی)',
    inactiveBadge: ' (ناچالاک)',
    defaultTag: 'بنەڕەتی',
    lblGroup: '• گرووپ:',
    lblRole: '• پلە:',
    lblBank: '• بانک:',
    lblCard: '• کارت:',
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
    searchPh: 'Search transaction description...',
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
    thCategory: 'Category',
    thDescription: 'Transaction Description',
    thCounterparty: 'Counterparty',
    thInflowWorker: 'Credit / Due (+)',
    thInflowAccount: 'Inflow (+)',
    thOutflowWorker: 'Debit / Paid (-)',
    thOutflowAccount: 'Outflow (-)',
    thRunningBalance: 'Running Balance',
    thSource: 'Source',
    openingRow: 'Opening',
    openingBadge: 'Initial Balance',
    openingDesc: 'Initial balance recorded upon account creation',
    openingSupervisor: 'Supervisor',
    openingBaseSource: 'Base',
    emptyMsg: 'No financial transactions match the selected filter.',
    refPrefix: 'Ref No:',
    docFallback: 'Doc',
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
    paySource: 'Payment',
    defaultBadge: ' (Default)',
    inactiveBadge: ' (Inactive)',
    defaultTag: 'Default',
    lblGroup: '• Group:',
    lblRole: '• Role:',
    lblBank: '• Bank:',
    lblCard: '• Card:',
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

  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

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

    // ترکیب و مرتب‌سازی رویدادها بر اساس تاریخ
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
        sourceLabel: txt.wageSource
      });
    });

    // ب) پرداخت‌ها: مساعده‌ها و تسویه‌حساب‌ها (پرداختی به کارگر - خروجی از حساب کارگر)
    workerPayments.forEach((p) => {
      const isAdvance = p.type === 'advance' || p.type === 'Advance_Payment';
      const cat = isAdvance ? 'advance_payment' : 'worker_settlement';
      const catLabel = isAdvance ? txt.payAdvanceCat : txt.paySettlementCat;

      const desc = p.note || p.description || (isAdvance ? txt.payAdvanceDesc : txt.paySettlementDesc);

      combinedEvents.push({
        id: `pay_${p.id}`,
        rawDate: (p.date || p.createdAt || '').slice(0, 10),
        date: (p.date || p.createdAt || '').slice(0, 10),
        time: (p.createdAt || '').slice(11, 16),
        category: cat,
        categoryLabel: catLabel,
        description: desc,
        counterparty: entityData.name,
        type: 'outflow',
        amount: Number(p.amount) || 0,
        sourceLabel: txt.paySource
      });
    });

    // مرتب‌سازی زمانی از قدیم به جدید برای محاسبه Running Balance دقیق
    combinedEvents.sort((a, b) => (a.rawDate || '').localeCompare(b.rawDate || ''));

    let running = 0;
    let totalIn = 0;
    let totalOut = 0;

    combinedEvents.forEach((ev) => {
      if (ev.type === 'inflow') {
        running += ev.amount;
        totalIn += ev.amount;
      } else {
        running -= ev.amount;
        totalOut += ev.amount;
      }
      ev.runningBalance = running;
    });

    // معکوس کردن برای نمایش از جدیدترین به قدیمی‌ترین
    const rawTransactions = [...combinedEvents].reverse();

    return {
      rawTransactions,
      initialBalance: 0,
      totalInflow: totalIn,
      totalOutflow: totalOut,
      currentBalance: running // مانده طلب فعلی کارگر
    };
  }, [entityType, entityData, workerLogs, workerPayments, language]);

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

  const rawTransactions = isWorker ? workerTransactionsData.rawTransactions : (effectiveAccountData?.transactions || []);

  // فیلتر تراکنش‌ها
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
        if (!descMatch && !partyMatch && !refMatch && !catMatch) return false;
      }

      return true;
    });
  }, [rawTransactions, dateFilter, customStart, customEnd, categoryFilter, searchQuery]);

  // خروجی اکسل
  const handleExportExcel = useCallback(() => {
    const h = txt.excelHeaders;
    const rows = [
      ...(isWorker ? [] : [{
        [h.row]: txt.openingRow,
        [h.date]: '-',
        [h.time]: '-',
        [h.category]: txt.openingBadge,
        [h.desc]: txt.openingDesc,
        [h.counterparty]: entityData?.keeperName || entityData?.holderName || txt.openingSupervisor,
        [h.inflow]: initialBalance,
        [h.outflow]: 0,
        [h.balance]: initialBalance,
        [h.currency]: currency
      }]),
      ...filteredTransactions.map((tx, idx) => ({
        [h.row]: idx + 1,
        [h.date]: tx.rawDate || tx.date,
        [h.time]: tx.time || '-',
        [h.category]: tx.categoryLabel || tx.category,
        [h.desc]: tx.description || '-',
        [h.counterparty]: tx.counterparty || '-',
        [h.inflow]: tx.type === 'inflow' ? tx.amount : 0,
        [h.outflow]: tx.type === 'outflow' ? tx.amount : 0,
        [h.balance]: tx.runningBalance,
        [h.currency]: currency
      }))
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SubsidiaryLedger');
    const safeName = (entityData?.name || 'Ledger').replace(/\s+/g, '_');
    const fileName = `KarSync_Ledger_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [filteredTransactions, initialBalance, entityData, currency, isWorker]);

  // پرینت اختصاصی جدول معین در قالب لایت
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

  const modalContent = (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="subsidiary-ledger-modal-root fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !p-0 z-[100] w-screen h-[100dvh] max-h-[100dvh] bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
    >
      {/* نوار بالایی ابزار و خروج (Compact Glass Utility Bar) */}
      <div className="no-print px-4 py-2.5 sm:px-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <FileSpreadsheet className="w-4 h-4 text-sky-500" />
          <span>{txt.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* سوییچ سریع حساب / پرسنل */}
          {entityType === 'account' && effectiveAccounts.length > 1 && (
            <select
              value={entityData?.id || ''}
              onChange={(e) => {
                const target = effectiveAccounts.find((a) => a.id === e.target.value);
                if (target && onSelectEntity) onSelectEntity({ type: 'account', data: target });
              }}
              className="h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
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

          {entityType === 'worker' && effectiveWorkers.length > 1 && (
            <select
              value={entityData?.id || ''}
              onChange={(e) => {
                const target = effectiveWorkers.find((w) => String(w.id) === e.target.value);
                if (target && onSelectEntity) onSelectEntity({ type: 'worker', data: target });
              }}
              className="h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[150px] truncate"
            >
              {effectiveWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  👤 {w.name}{w.isActive === 0 ? txt.inactiveBadge : ''}
                </option>
              ))}
            </select>
          )}

          {/* دکمه خروج مینیمال */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label={txt.close}
            title={txt.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* بنر هیروی اجرایی لوکس معین (Executive Hero Banner) */}
      <div className="no-print px-4 py-3 sm:px-6 bg-[#f3f6f4] dark:bg-slate-950 shrink-0">
        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-white border border-white/10 shadow-2xl">
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
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      {entityData?.name}
                    </h1>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400 mt-0.5">
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
                    {formatCurrency(currentBalance, currency, language)}
                  </span>
                </div>
              </div>
            </div>

            {/* سمت چپ: کارت شیشه‌ای شاخص‌های سه‌گانه */}
            <div className="lg:col-span-5 grid grid-cols-3 gap-2.5 bg-white/5 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
              {/* ۱. افتتاحیه / مبنا */}
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block truncate">
                  {isWorker ? txt.card1Worker : txt.card1Account}
                </span>
                <span className="text-xs sm:text-sm font-black font-mono text-slate-200 mt-1 block truncate" dir="ltr">
                  {isWorker ? `${rawTransactions.length} ${txt.rowsUnit}` : formatCurrency(initialBalance, currency, language)}
                </span>
              </div>

              {/* ۲. کل وارده (ورودی +) */}
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
                <span className="text-[10px] text-emerald-300 block truncate">
                  {isWorker ? txt.card2Worker : txt.card2Account}
                </span>
                <span className="text-xs sm:text-sm font-black font-mono text-emerald-400 mt-1 block truncate" dir="ltr">
                  +{formatCurrency(totalInflow, currency, language)}
                </span>
              </div>

              {/* ۳. کل صادره (خروجی -) */}
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col justify-between">
                <span className="text-[10px] text-rose-300 block truncate">
                  {isWorker ? txt.card3Worker : txt.card3Account}
                </span>
                <span className="text-xs sm:text-sm font-black font-mono text-rose-400 mt-1 block truncate" dir="ltr">
                  -{formatCurrency(totalOutflow, currency, language)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* نوار فیلتر و جستجو (Glass Filter Bar) */}
      <div className="no-print px-4 py-2.5 sm:px-6 bg-[#f3f6f4] dark:bg-slate-950 shrink-0">
        <div className="p-3 sm:px-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
              {txt.filteredDocsCount(filteredTransactions.length)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* فیلتر تاریخ */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
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
              className="h-9 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
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
                className="w-44 sm:w-60 h-9 ps-8 pe-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>
      </div>

      {/* فیلتر تاریخ سفارشی */}
      {dateFilter === 'custom' && (
        <div className="no-print mx-4 sm:mx-6 mb-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center gap-3 text-xs shrink-0 text-slate-700 dark:text-slate-300">
          <span className="font-bold text-slate-700 dark:text-slate-300">{txt.customRangeLabel}</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">{txt.fromLabel}</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 px-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">{txt.toLabel}</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 px-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {/* بدنه اسکرول‌پذیر محتوا و جدول معین */}
      <div className="subsidiary-ledger-table-container flex-1 overflow-auto custom-scrollbar px-4 sm:px-6 pb-28">
        {/* سربرگ مشخصات معین مخصوص پرینت (در صفحه عادی مخفی، در پرینت آشکار) */}
        <div className="print-only mb-4 pb-3 border-b-2 border-slate-900 text-slate-900">
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
                {txt.printFinalBalance} {formatCurrency(currentBalance, currency, language)}
              </div>
            </div>
          </div>
        </div>

        {/* کادر گلس جدول معین */}
        <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <table className="w-full text-right text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80">
              <tr className="text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3.5 px-3.5 text-center w-12">#</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">{txt.thDateTime}</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">{txt.thCategory}</th>
                <th className="py-3.5 px-3.5 min-w-[200px]">{txt.thDescription}</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">{txt.thCounterparty}</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                  {isWorker ? txt.thInflowWorker : txt.thInflowAccount}
                </th>
                <th className="py-3.5 px-3.5 whitespace-nowrap text-rose-600 dark:text-rose-400">
                  {isWorker ? txt.thOutflowWorker : txt.thOutflowAccount}
                </th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">{txt.thRunningBalance}</th>
                <th className="py-3.5 px-3.5 text-center whitespace-nowrap">{txt.thSource}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-normal">
            {/* ردیف افتتاحیه برای حساب‌ها */}
            {!isWorker && initialBalance > 0 && (
              <tr className="opening-balance-row bg-amber-50/50 dark:bg-amber-950/25 font-semibold text-slate-700 dark:text-slate-200 border-b border-amber-200/50 dark:border-amber-900/30">
                <td className="py-3 px-3.5 text-center text-amber-600 dark:text-amber-400 font-bold">
                  ★
                </td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-400 dark:text-slate-400">
                  {txt.openingRow}
                </td>
                <td className="py-3 px-3.5">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {txt.openingBadge}
                  </span>
                </td>
                <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200">
                  {txt.openingDesc}
                </td>
                <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">
                  {entityData?.keeperName || entityData?.holderName || txt.openingSupervisor}
                </td>
                <td className="print-inflow py-3 px-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                  +{formatAmount(initialBalance, currency)}
                </td>
                <td className="py-3 px-3.5 font-mono text-slate-400 dark:text-slate-500" dir="ltr">
                  -
                </td>
                <td className="print-balance-positive py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                  {formatCurrency(initialBalance, currency, language)}
                </td>
                <td className="py-3 px-3.5 text-center">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                    {txt.openingBaseSource}
                  </span>
                </td>
              </tr>
            )}

            {/* ردیف‌های تراکنش‌ها */}
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  {txt.emptyMsg}
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, idx) => {
                return (
                  <tr 
                    key={tx.id + '_' + idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <td className="py-3 px-3.5 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                      <div>{tx.rawDate}</div>
                      {tx.time && <div className="text-[10px] text-slate-400 dark:text-slate-500">{tx.time}</div>}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.category === 'attendance_wage'
                          ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                          : tx.category === 'petty_cash'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : tx.category === 'worker_settlement'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          : tx.category === 'advance_payment'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {tx.categoryLabel}
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200">
                      <div>{tx.description}</div>
                      {tx.reference && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          {txt.refPrefix} {tx.reference}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                      {tx.counterparty || '-'}
                    </td>

                    {/* وارده / طلب */}
                    <td className="print-inflow py-3 px-3.5 whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                      {tx.type === 'inflow' ? `+${formatAmount(tx.amount, currency)}` : '-'}
                    </td>

                    {/* صادره / پرداختی */}
                    <td className="print-outflow py-3 px-3.5 whitespace-nowrap font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                      {tx.type === 'outflow' ? `-${formatAmount(tx.amount, currency)}` : '-'}
                    </td>

                    {/* مانده لحظه‌ای */}
                    <td className={`py-3 px-3.5 whitespace-nowrap font-mono font-bold ${tx.runningBalance >= 0 ? 'print-balance-positive' : 'print-balance-negative'}`} dir="ltr">
                      <span className={tx.runningBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}>
                        {formatCurrency(tx.runningBalance, currency, language)}
                      </span>
                    </td>

                    {/* منبع سند */}
                    <td className="py-3 px-3.5 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                        {tx.sourceLabel || txt.docFallback}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* داک چسبان شیشه‌ای پایین (Sticky Apple Liquid Glass Bottom Dock) */}
      <div className="no-print fixed bottom-0 start-0 end-0 z-30 p-3 sm:px-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] flex items-center justify-between">
        {/* خلاصه زنده مانده و تراکنش‌ها */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">{txt.finalBalanceLabel}</span>
            <span className={`text-base sm:text-lg font-black font-mono tracking-tight ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
              {formatCurrency(currentBalance, currency, language)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              isPositive
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
            }`}>
              {statusBadgeText}
            </span>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{txt.totalDocsLabel}</span>
            <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{filteredTransactions.length} {txt.rowsUnit}</span>
          </div>
        </div>

        {/* دکمه‌های عملیاتی */}
        <div className="flex items-center gap-2">
          {/* دکمه اکسل */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 sm:px-4 h-10 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-xs transition-all active:scale-95"
            title={txt.excelTitle}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">{txt.excelBtn}</span>
          </button>

          {/* دکمه چاپ */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 sm:px-4 h-10 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-xs transition-all active:scale-95"
            title={txt.printTitle}
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">{txt.printBtn}</span>
          </button>

          {/* دکمه بستن */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 sm:px-5 h-10 rounded-2xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <span>{txt.close}</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-slate-700 dark:bg-slate-200 text-slate-200 dark:text-slate-700 rounded-md font-mono">
              ESC
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default AccountSubsidiaryLedgerModal;
