import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
const DEFAULT_PROJECT_ID = 'prj_default_main';
import { useProject } from '../context/ProjectContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatCurrency as formatGlobalCurrency } from '../utils/formatters';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Printer,
  X,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  Layers,
  User,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  Wallet,
  TrendingUp,
  Receipt,
  Eye,
  ChevronDown,
  Sparkles,
  ArrowUpRight,
  SlidersHorizontal,
  Table as TableIcon
} from 'lucide-react';


const COPY = {
  fa: {
    generalCategory: 'عمومی',
    unknownCategory: 'سرفصل نامشخص',
    generalUnassignedSection: 'عمومی / بدون بخش',
    sectionFallback: 'بخش',
    otherUnknownPerson: 'سایر / نامشخص',
    noExcelRecords: 'هیچ رکوردی برای خروجی اکسل یافت نشد.',
    statusPaid: 'تسویه شده',
    statusCredit: 'نسیه (بدهی)',
    methodCash: 'صندوق نقدی',
    methodBank: 'حساب بانکی',
    methodPettyCash: 'تنخواه سرپرست',
    excelColDate: 'تاریخ',
    excelColTitle: 'عنوان هزینه',
    excelColMainGroup: 'گروه اصلی',
    excelColSubGroup: 'زیرگروه',
    excelColMicroItem: 'هزینه خرد',
    excelColAmount: 'مبلغ',
    excelColCurrency: 'واحد پول',
    excelColPayee: 'طرف‌حساب',
    excelColSection: 'بخش پروژه',
    excelColStatus: 'وضعیت تسویه',
    excelColMethod: 'روش پرداخت',
    excelColDescription: 'توضیحات',
    excelTotalRow: 'مجموع کل اقلام فیلترشده',
    excelFileName: 'گزارش_تحلیلی_هزینه_ها',
    excelSheetName: 'هزینه‌ها',
    detailedReportTitle: 'گزارش تفصیلی هزینه‌ها و مخارج',
    headerTitle: 'آمار، تحلیل و خروجی هزینه‌ها',
    invoiceCountSuffix: 'فاکتور',
    headerSubtitle: 'فیلترهای ترکیبی، تحلیل سرفصل‌ها، خروجی اکسل و پرینت',
    excelExportBtn: 'خروجی اکسل',
    printBtn: 'چاپ گزارش (A4)',
    closeEsc: 'بستن (ESC)',
    reportDateLabel: 'تاریخ تهیه گزارش:',
    currencyLabel: 'واحد پول:',
    filtersTitle: 'فیلترهای چندگانه و همزمان (ترکیب دلخواه)',
    resetFilters: 'بازنشانی تمام فیلترها',
    payeeLabel: 'طرف‌حساب / شخص',
    allPayees: 'همه اشخاص و طرف‌های حساب',
    staffTag: 'پرسنل',
    sectionLabel: 'بخش پروژه',
    allSections: 'همه بخش‌ها',
    unassignedSection: 'عمومی / بدون بخش',
    paymentMethodLabel: 'روش پرداخت',
    allPaymentMethods: 'همه روش‌های پرداخت',
    settlementStatusLabel: 'وضعیت تسویه',
    allStatuses: 'همه وضعیت‌ها (تسویه و نسیه)',
    statusPaidFull: 'تسویه شده (پرداخت شده)',
    statusPendingCredit: 'معوق (پرداخت نشده / نسیه)',
    mainGroupLabel: 'سرفصل اصلی (سطح ۱)',
    allMainGroups: 'همه گروه‌های اصلی',
    subGroupLabel: 'زیرگروه (سطح ۲)',
    selectMainFirst: 'ابتدا گروه اصلی را انتخاب کنید',
    allSubGroups: 'همه زیرگروه‌ها',
    microItemLabel: 'هزینه خرد (سطح ۳)',
    selectSubFirst: 'ابتدا زیرگروه را انتخاب کنید',
    allMicroItems: 'همه ریزهزینه‌ها',
    allTime: 'همه زمان‌ها',
    specificMonth: 'ماه خاص',
    singleDay: 'روز خاص',
    dateRangeCustom: 'بازه دلخواه',
    fromLabel: 'از:',
    toLabel: 'تا:',
    searchPlaceholder: 'جستجوی متن...',
    totalFilteredAmount: 'مجموع مبالغ فیلترشده',
    ofProjectTotal: 'از کل هزینه‌های پروژه',
    paidCashBank: 'تسویه شده (پرداختی نقدی/بانک)',
    ofReportIsPaid: 'از این گزارش تسویه است',
    creditPendingDebt: 'معوق (نسیه / بدهی)',
    creditUnsettled: 'نسیه و تسویه نشده',
    invoicesAndAvg: 'تعداد و میانگین فاکتورها',
    invoicesUnit: 'فقره فاکتور',
    avgPerInvoice: 'میانگین هر فاکتور:',
    categoryDistribution: 'تفکیک سهم سرفصل‌های هزینه',
    sectionDistribution: 'تفکیک بر اساس بخش‌های پروژه',
    topPayees: 'طرف‌های حساب برتر (بیشترین مبالغ)',
    noData: 'داده‌ای وجود ندارد',
    tableTitle: 'ریز اقلام و فاکتورهای فیلترشده',
    rowsUnit: 'ردیف',
    noInvoicesFound: 'هیچ فاکتوری با شرایط فیلترهای انتخابی یافت نشد.',
    tableHeaderDate: 'تاریخ',
    tableHeaderTitle: 'عنوان هزینه',
    tableHeaderCategory: 'سرفصل هزینه',
    tableHeaderPayee: 'طرف‌حساب',
    tableHeaderSection: 'بخش پروژه',
    tableHeaderMethod: 'روش پرداخت',
    tableHeaderStatus: 'وضعیت',
    tableHeaderAmount: 'مبلغ',
    tableHeaderReceipt: 'رسید',
    viewReceiptTitle: 'مشاهده فاکتور',
    methodBankShort: 'بانکی',
    methodPettyCashShort: 'تنخواه',
    settledShort: 'تسویه',
    creditShort: 'نسیه',
    grandTotalFiltered: 'جمع کل مبالغ فیلترشده:'
  },
  ku: {
    generalCategory: 'گشتی',
    unknownCategory: 'نادیار',
    generalUnassignedSection: 'گشتی / بێ بەش',
    sectionFallback: 'بەش',
    otherUnknownPerson: 'کەسانی تر / نادیار',
    noExcelRecords: 'هیچ تۆمارێک بۆ هەناردەکردنی Excel نەدۆزرایەوە.',
    statusPaid: 'پارەدراو',
    statusCredit: 'قەرز (نەدراو)',
    methodCash: 'سندوقی کاش',
    methodBank: 'حیسابی بانکی',
    methodPettyCash: 'تەنخوای سەرپەرشتیار',
    excelColDate: 'بەروار',
    excelColTitle: 'بابەتی خەرجی',
    excelColMainGroup: 'گرووپی سەرەکی',
    excelColSubGroup: 'ژێرگرووپ',
    excelColMicroItem: 'وردەکاری',
    excelColAmount: 'بڕە پارە',
    excelColCurrency: 'دراو',
    excelColPayee: 'لایەنی بەرامبەر',
    excelColSection: 'بەشی پڕۆژە',
    excelColStatus: 'دۆخی پارەدان',
    excelColMethod: 'شێوازی پارەدان',
    excelColDescription: 'تێبینی',
    excelTotalRow: 'کۆی گشتی فلتەرکراوەکان',
    excelFileName: 'ڕاپۆرتی_شیکاری_خەرجییەکان',
    excelSheetName: 'خەرجییەکان',
    detailedReportTitle: 'ڕاپۆرتی وردی خەرجییەکان',
    headerTitle: 'ئامار، شیکاری و هەناردەی خەرجییەکان',
    invoiceCountSuffix: 'فاکتۆر',
    headerSubtitle: 'فلتەری تێکەڵ، شیکاری پۆلەکان، هەناردەی Excel و چاپکردن',
    excelExportBtn: 'هەناردەی Excel',
    printBtn: 'چاپکردنی ڕاپۆرت (A4)',
    closeEsc: 'داخستن (ESC)',
    reportDateLabel: 'بەرواری ئامادەکردن:',
    currencyLabel: 'دراو:',
    filtersTitle: 'فلتەرە فرەچەشنەکان (پێکەوەبەستنی دڵخواز)',
    resetFilters: 'پاککردنەوەی هەموو فلتەرەکان',
    payeeLabel: 'کەس / لایەنی بەرامبەر',
    allPayees: 'هەموو کەسەکان و لایەنەکان',
    staffTag: 'کارمەند',
    sectionLabel: 'بەشی پڕۆژە',
    allSections: 'هەموو بەشەکان',
    unassignedSection: 'گشتی / بێ بەش',
    paymentMethodLabel: 'شێوازی پارەدان',
    allPaymentMethods: 'هەموو شێوازەکانی پارەدان',
    settlementStatusLabel: 'دۆخی پارەدان',
    allStatuses: 'هەموو دۆخەکان (کاش و قەرز)',
    statusPaidFull: 'پارەدراو (تەواو دراو)',
    statusPendingCredit: 'نەدراو (قەرز / ماوە)',
    mainGroupLabel: 'گرووپی سەرەکی (ئاستی ١)',
    allMainGroups: 'هەموو گرووپە سەرەکییەکان',
    subGroupLabel: 'ژێرگرووپ (ئاستی ٢)',
    selectMainFirst: 'سەرەتا گرووپی سەرەکی دیاریبکە',
    allSubGroups: 'هەموو ژێرگرووپەکان',
    microItemLabel: 'وردەکاری خەرجی (ئاستی ٣)',
    selectSubFirst: 'سەرەتا ژێرگرووپ دیاریبکە',
    allMicroItems: 'هەموو وردەکارییەکان',
    allTime: 'هەموو کاتەکان',
    specificMonth: 'مانگی دیاریکراو',
    singleDay: 'ڕۆژی دیاریکراو',
    dateRangeCustom: 'ماوەی دڵخواز',
    fromLabel: 'لە:',
    toLabel: 'بۆ:',
    searchPlaceholder: 'گەڕان بەپێی دەق...',
    totalFilteredAmount: 'کۆی گشتی فلتەرکراو',
    ofProjectTotal: 'لە کۆی گشتی خەرجییەکانی پڕۆژە',
    paidCashBank: 'پارەدراو (کاش/بانک)',
    ofReportIsPaid: 'لە تەواوی ئەم ڕاپۆرتە دراوە',
    creditPendingDebt: 'نەدراو (قەرز / ماوە)',
    creditUnsettled: 'قەرز و نەدراو',
    invoicesAndAvg: 'ژمارە و تێکڕای فاکتۆرەکان',
    invoicesUnit: 'دانە فاکتۆر',
    avgPerInvoice: 'تێکڕای هەر فاکتۆرێک:',
    categoryDistribution: 'دابەشبوونی بەشە خەرجییەکان',
    sectionDistribution: 'دابەشبوون بەپێی بەشەکانی پڕۆژە',
    topPayees: 'لایەنە سەرەکییەکان (زۆرترین بڕ)',
    noData: 'داتا بەردەست نییە',
    tableTitle: 'وردەکاری بڕگە و فاکتۆرە فلتەرکراوەکان',
    rowsUnit: 'تۆمار',
    noInvoicesFound: 'هیچ فاکتۆرێک بەپێی ئەم مەرجانە نەدۆزرایەوە.',
    tableHeaderDate: 'بەروار',
    tableHeaderTitle: 'بابەت',
    tableHeaderCategory: 'پۆلێنکردنی خەرجی',
    tableHeaderPayee: 'لایەنی بەرامبەر',
    tableHeaderSection: 'بەش',
    tableHeaderMethod: 'شێواز',
    tableHeaderStatus: 'دۆخ',
    tableHeaderAmount: 'بڕە پارە',
    tableHeaderReceipt: 'پسوولە',
    viewReceiptTitle: 'بینینی پسوولە',
    methodBankShort: 'بانک',
    methodPettyCashShort: 'تەنخوا',
    settledShort: 'دراو',
    creditShort: 'قەرز',
    grandTotalFiltered: 'کۆی گشتی فلتەرکراو:'
  },
  en: {
    generalCategory: 'General',
    unknownCategory: 'Unknown Category',
    generalUnassignedSection: 'General / Unassigned',
    sectionFallback: 'Section',
    otherUnknownPerson: 'Other / Unassigned',
    noExcelRecords: 'No records found for Excel export.',
    statusPaid: 'Paid',
    statusCredit: 'Credit (Payable)',
    methodCash: 'Cash Register',
    methodBank: 'Bank Account',
    methodPettyCash: 'Site Petty Cash',
    excelColDate: 'Date',
    excelColTitle: 'Expense Title',
    excelColMainGroup: 'Main Group',
    excelColSubGroup: 'Subgroup',
    excelColMicroItem: 'Detail Item',
    excelColAmount: 'Amount',
    excelColCurrency: 'Currency',
    excelColPayee: 'Payee',
    excelColSection: 'Project Section',
    excelColStatus: 'Settlement Status',
    excelColMethod: 'Payment Method',
    excelColDescription: 'Description',
    excelTotalRow: 'Total of Filtered Items',
    excelFileName: 'Expense_Analytics_Report',
    excelSheetName: 'Expenses',
    detailedReportTitle: 'Detailed Expense & Expenditure Report',
    headerTitle: 'Expense Analytics, Reports & Export',
    invoiceCountSuffix: 'Invoices',
    headerSubtitle: 'Multi-filter queries, category breakdowns, Excel export & printing',
    excelExportBtn: 'Excel Export',
    printBtn: 'Print Report (A4)',
    closeEsc: 'Close (ESC)',
    reportDateLabel: 'Report Date:',
    currencyLabel: 'Currency:',
    filtersTitle: 'Multi-criteria Filters',
    resetFilters: 'Reset All Filters',
    payeeLabel: 'Payee / Person',
    allPayees: 'All Payees & Counterparties',
    staffTag: 'Staff',
    sectionLabel: 'Project Section',
    allSections: 'All Sections',
    unassignedSection: 'General / Unassigned',
    paymentMethodLabel: 'Payment Method',
    allPaymentMethods: 'All Payment Methods',
    settlementStatusLabel: 'Settlement Status',
    allStatuses: 'All Statuses (Paid & Credit)',
    statusPaidFull: 'Paid (Settled)',
    statusPendingCredit: 'Pending (Unpaid / Credit)',
    mainGroupLabel: 'Main Group (Level 1)',
    allMainGroups: 'All Main Groups',
    subGroupLabel: 'Subgroup (Level 2)',
    selectMainFirst: 'First select a main group',
    allSubGroups: 'All Subgroups',
    microItemLabel: 'Detail Item (Level 3)',
    selectSubFirst: 'First select a subgroup',
    allMicroItems: 'All Detail Items',
    allTime: 'All Time',
    specificMonth: 'Specific Month',
    singleDay: 'Single Day',
    dateRangeCustom: 'Custom Range',
    fromLabel: 'From:',
    toLabel: 'To:',
    searchPlaceholder: 'Search text...',
    totalFilteredAmount: 'Total Filtered Amount',
    ofProjectTotal: 'of total project expenses',
    paidCashBank: 'Paid (Cash / Bank)',
    ofReportIsPaid: 'of this report is paid',
    creditPendingDebt: 'Pending (Credit / Debt)',
    creditUnsettled: 'unsettled credit',
    invoicesAndAvg: 'Count & Average Invoice',
    invoicesUnit: 'Invoices',
    avgPerInvoice: 'Average per invoice:',
    categoryDistribution: 'Category Distribution Share',
    sectionDistribution: 'Project Section Distribution',
    topPayees: 'Top Payees (Highest Spend)',
    noData: 'No data available',
    tableTitle: 'Filtered Line Items & Invoices',
    rowsUnit: 'Rows',
    noInvoicesFound: 'No invoices match the selected filter criteria.',
    tableHeaderDate: 'Date',
    tableHeaderTitle: 'Title',
    tableHeaderCategory: 'Category',
    tableHeaderPayee: 'Payee',
    tableHeaderSection: 'Section',
    tableHeaderMethod: 'Method',
    tableHeaderStatus: 'Status',
    tableHeaderAmount: 'Amount',
    tableHeaderReceipt: 'Receipt',
    viewReceiptTitle: 'View Receipt',
    methodBankShort: 'Bank',
    methodPettyCashShort: 'Petty Cash',
    settledShort: 'Paid',
    creditShort: 'Credit',
    grandTotalFiltered: 'Grand Total of Filtered Items:'
  }
};

export default function ExpenseAnalyticsModal({ isOpen = true, onClose }) {
  const { currentProject } = useProject();
  const { t, language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = COPY[langKey];
  const isRtl = direction === 'rtl';

  const projectId = currentProject?.id || DEFAULT_PROJECT_ID;
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);

  // Live queries
  const expenses = useLiveQuery(
    async () => {
      const list = await db.expenses.toArray();
      const filtered = list.filter(e => !e.projectId || e.projectId === projectId || projectId === DEFAULT_PROJECT_ID);
      // Exclude soft-deleted items from analytics
      return filtered.filter(e => !e.deletedAt);
    },
    [projectId]
  ) || [];

  const categories = useLiveQuery(
    async () => {
      const list = await db.expenseCategories.toArray();
      return list.filter(c => !c.projectId || c.projectId === projectId || (projectId === DEFAULT_PROJECT_ID));
    },
    [projectId]
  ) || [];

  const sections = useLiveQuery(
    () => db.projectSections.where('projectId').equals(projectId).toArray(),
    [projectId]
  ) || [];

  const workers = useLiveQuery(
    () => db.workers.where('projectId').equals(projectId).toArray(),
    [projectId]
  ) || [];

  // Lookup maps
  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const sectionMap = useMemo(() => {
    const map = new Map();
    sections.forEach(s => map.set(s.id, s.name));
    return map;
  }, [sections]);

  const workerMap = useMemo(() => {
    const map = new Map();
    workers.forEach(w => map.set(w.id, w.name));
    return map;
  }, [workers]);

  // Formatter
  const formatCurrency = useCallback((amount) => {
    return formatGlobalCurrency(amount, currency, langKey);
  }, [currency, langKey]);

  // Hierarchical category info
  const getCategoryHierarchy = useCallback((catId) => {
    if (!catId) return { main: c.generalCategory, sub: '', item: '' };
    const target = categoryMap.get(catId);
    if (!target) return { main: c.unknownCategory, sub: '', item: '' };

    if (target.level === 3) {
      const parentSub = categoryMap.get(target.parentId);
      const parentMain = parentSub ? categoryMap.get(parentSub.parentId) : null;
      return {
        main: parentMain?.name || '',
        sub: parentSub?.name || '',
        item: target.name
      };
    } else if (target.level === 2) {
      const parentMain = categoryMap.get(target.parentId);
      return {
        main: parentMain?.name || '',
        sub: target.name,
        item: ''
      };
    }
    return { main: target.name, sub: '', item: '' };
  }, [categoryMap, language]);

  // Unique payees list (from workers + custom personName)
  const allPayees = useMemo(() => {
    const set = new Map();
    expenses.forEach((e) => {
      if (e.personId && workerMap.has(e.personId)) {
        set.set(`worker_${e.personId}`, { id: e.personId, name: workerMap.get(e.personId), isWorker: true });
      } else if (e.personName) {
        set.set(`name_${e.personName}`, { id: e.personName, name: e.personName, isWorker: false });
      }
    });
    return Array.from(set.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [expenses, workerMap]);

  // Filter States
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterMainCategory, setFilterMainCategory] = useState('all');
  const [filterSubCategory, setFilterSubCategory] = useState('all');
  const [filterMicroCategory, setFilterMicroCategory] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all'); // 'all' | 'cash' | 'bank' | 'petty_cash'
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all'); // 'all' | 'paid' | 'pending'
  const [dateFilterMode, setDateFilterMode] = useState('all'); // 'all' | 'month' | 'day' | 'range'
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateRangeStart, setDateRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateRangeEnd, setDateRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');

  // Sub-categories available based on selected main category
  const availableSubCategories = useMemo(() => {
    if (filterMainCategory === 'all') return [];
    return categories.filter(c => c.parentId === filterMainCategory && c.level === 2);
  }, [categories, filterMainCategory]);

  // Micro-categories available based on selected sub category
  const availableMicroCategories = useMemo(() => {
    if (filterSubCategory === 'all') return [];
    return categories.filter(c => c.parentId === filterSubCategory && c.level === 3);
  }, [categories, filterSubCategory]);

  // Reset all filters
  const handleResetFilters = () => {
    setFilterPerson('all');
    setFilterMainCategory('all');
    setFilterSubCategory('all');
    setFilterMicroCategory('all');
    setFilterSection('all');
    setFilterPaymentMethod('all');
    setFilterPaymentStatus('all');
    setDateFilterMode('all');
    setSearchQuery('');
  };

  // Check if any filter is active
  const isAnyFilterActive = useMemo(() => {
    return filterPerson !== 'all' ||
      filterMainCategory !== 'all' ||
      filterSubCategory !== 'all' ||
      filterMicroCategory !== 'all' ||
      filterSection !== 'all' ||
      filterPaymentMethod !== 'all' ||
      filterPaymentStatus !== 'all' ||
      dateFilterMode !== 'all' ||
      searchQuery.trim().length > 0;
  }, [
    filterPerson,
    filterMainCategory,
    filterSubCategory,
    filterMicroCategory,
    filterSection,
    filterPaymentMethod,
    filterPaymentStatus,
    dateFilterMode,
    searchQuery
  ]);

  // Multi-Filter Engine
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (exp.title || '').toLowerCase().includes(q);
        const descMatch = (exp.description || '').toLowerCase().includes(q);
        const personMatch = (exp.personName || workerMap.get(exp.personId) || '').toLowerCase().includes(q);
        const cat = getCategoryHierarchy(exp.categoryId);
        const catMatch = (cat.main + ' ' + cat.sub + ' ' + cat.item).toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !personMatch && !catMatch) return false;
      }

      // 2. Person / Payee Filter
      if (filterPerson !== 'all') {
        const expPayeeKey = exp.personId ? exp.personId : exp.personName;
        if (expPayeeKey !== filterPerson) return false;
      }

      // 3. Hierarchical Category Filter (3 Levels)
      if (filterMicroCategory !== 'all') {
        if (exp.categoryId !== filterMicroCategory) return false;
      } else if (filterSubCategory !== 'all') {
        const cat = categoryMap.get(exp.categoryId);
        if (!cat) return false;
        if (cat.id !== filterSubCategory && cat.parentId !== filterSubCategory) return false;
      } else if (filterMainCategory !== 'all') {
        const cat = categoryMap.get(exp.categoryId);
        if (!cat) return false;
        if (cat.id !== filterMainCategory) {
          if (cat.parentId !== filterMainCategory) {
            const parentSub = categoryMap.get(cat.parentId);
            if (!parentSub || parentSub.parentId !== filterMainCategory) return false;
          }
        }
      }

      // 4. Project Section Filter
      if (filterSection !== 'all') {
        if (filterSection === 'unassigned') {
          if (exp.sectionId) return false;
        } else if (exp.sectionId !== filterSection) {
          return false;
        }
      }

      // 5. Payment Method Filter
      if (filterPaymentMethod !== 'all') {
        if (exp.paymentMethod !== filterPaymentMethod) return false;
      }

      // 6. Payment Status Filter
      if (filterPaymentStatus !== 'all') {
        if (exp.paymentStatus !== filterPaymentStatus) return false;
      }

      // 7. Date Mode Filter
      const expDate = exp.expenseDate || exp.date || exp.createdAt?.slice(0, 10);
      if (dateFilterMode === 'month') {
        if (!expDate || !expDate.startsWith(selectedMonth)) return false;
      } else if (dateFilterMode === 'day') {
        if (expDate !== selectedDay) return false;
      } else if (dateFilterMode === 'range') {
        if (!expDate) return false;
        if (dateRangeStart && expDate < dateRangeStart) return false;
        if (dateRangeEnd && expDate > dateRangeEnd) return false;
      }

      return true;
    });
  }, [
    expenses,
    searchQuery,
    filterPerson,
    filterMicroCategory,
    filterSubCategory,
    filterMainCategory,
    filterSection,
    filterPaymentMethod,
    filterPaymentStatus,
    dateFilterMode,
    selectedMonth,
    selectedDay,
    dateRangeStart,
    dateRangeEnd,
    categoryMap,
    workerMap,
    getCategoryHierarchy
  ]);

  // Overall Project Expenses Total (for percentage calculations)
  const totalAllProjectExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  // Analytics Metrics
  const analyticsSummary = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;

    filteredExpenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      total += amt;
      if (e.paymentStatus === 'paid') paid += amt;
      else pending += amt;
    });

    const count = filteredExpenses.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    const projectSharePercent = totalAllProjectExpenses > 0 
      ? Math.round((total / totalAllProjectExpenses) * 100) 
      : 0;

    return { total, paid, pending, count, avg, projectSharePercent };
  }, [filteredExpenses, totalAllProjectExpenses]);

  // Category Breakdown Aggregates
  const categoryBreakdown = useMemo(() => {
    const map = new Map();
    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      const catInfo = getCategoryHierarchy(exp.categoryId);
      const key = catInfo.main || c.generalCategory;
      map.set(key, (map.get(key) || 0) + amt);
    });

    const total = analyticsSummary.total || 1;
    return Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percent: Math.round((amount / total) * 100)
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, analyticsSummary.total, getCategoryHierarchy, language]);

  // Section Breakdown Aggregates
  const sectionBreakdown = useMemo(() => {
    const map = new Map();
    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      const name = exp.sectionId ? (sectionMap.get(exp.sectionId) || c.sectionFallback) : c.generalUnassignedSection;
      map.set(name, (map.get(name) || 0) + amt);
    });

    const total = analyticsSummary.total || 1;
    return Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percent: Math.round((amount / total) * 100)
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, analyticsSummary.total, sectionMap, language]);

  // Top Payees Breakdown
  const topPayeesBreakdown = useMemo(() => {
    const map = new Map();
    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      const name = exp.personName || workerMap.get(exp.personId) || c.otherUnknownPerson;
      map.set(name, (map.get(name) || 0) + amt);
    });

    const total = analyticsSummary.total || 1;
    return Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percent: Math.round((amount / total) * 100)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [filteredExpenses, analyticsSummary.total, workerMap, language]);

  // Export Excel
  const handleExportExcel = useCallback(() => {
    if (filteredExpenses.length === 0) {
      alert(c.noExcelRecords);
      return;
    }

    const rows = filteredExpenses.map((exp, idx) => {
      const catInfo = getCategoryHierarchy(exp.categoryId);
      const person = exp.personName || workerMap.get(exp.personId) || '-';
      const section = sectionMap.get(exp.sectionId) || c.generalCategory;
      const statusLabel = exp.paymentStatus === 'paid' ? c.statusPaid : c.statusCredit;
      const methodLabel = exp.paymentMethod === 'cash' 
        ? c.methodCash 
        : exp.paymentMethod === 'bank' 
        ? c.methodBank 
        : c.methodPettyCash;

      return {
        '#': idx + 1,
        [c.excelColDate]: exp.expenseDate || '',
        [c.excelColTitle]: exp.title || '',
        [c.excelColMainGroup]: catInfo.main,
        [c.excelColSubGroup]: catInfo.sub,
        [c.excelColMicroItem]: catInfo.item,
        [c.excelColAmount]: Number(exp.amount) || 0,
        [c.excelColCurrency]: exp.currency || currency,
        [c.excelColPayee]: person,
        [c.excelColSection]: section,
        [c.excelColStatus]: statusLabel,
        [c.excelColMethod]: methodLabel,
        [c.excelColDescription]: exp.description || ''
      };
    });

    // Append summary row
    rows.push({
      '#': '',
      [c.excelColDate]: '',
      [c.excelColTitle]: c.excelTotalRow,
      [c.excelColMainGroup]: '',
      [c.excelColSubGroup]: '',
      [c.excelColMicroItem]: '',
      [c.excelColAmount]: analyticsSummary.total,
      [c.excelColCurrency]: currency,
      [c.excelColPayee]: '',
      [c.excelColSection]: '',
      [c.excelColStatus]: '',
      [c.excelColMethod]: '',
      [c.excelColDescription]: ''
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, c.excelSheetName);
    const fileName = `KarSync_Expense_Report_${currentProject?.name || 'Project'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [filteredExpenses, analyticsSummary.total, getCategoryHierarchy, workerMap, sectionMap, language, currency, currentProject]);

  // Print Report
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Keyboard Shortcuts Listener (Requirement 5 & 6)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Escape -> Close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Check Ctrl or Meta (Command key on Mac)
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl + P -> Print
      if (isCtrlOrMeta && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
        return;
      }

      // Ctrl + E -> Export Excel
      if (isCtrlOrMeta && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        handleExportExcel();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrint, handleExportExcel]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 z-[100] bg-slate-100 dark:bg-slate-950 flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white"
    >
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs no-print">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 flex-shrink-0">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{c.headerTitle}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-900/50">
                  {filteredExpenses.length} {c.invoiceCountSuffix}
                </span>
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {currentProject?.name} • {c.headerSubtitle}
              </p>
            </div>
          </div>

          {/* Action Buttons in Header (No shortcuts written on buttons per Requirement 6) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title={c.excelExportBtn}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">{c.excelExportBtn}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title={c.printBtn}
            >
              <Printer className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">{c.printBtn}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title={c.closeEsc}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Printable Official Header (Shown only during print) */}
        <div className="hidden print:block text-center border-b pb-4 mb-4">
          <h1 className="text-xl font-black">{currentProject?.name} - {c.detailedReportTitle}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {c.reportDateLabel} {new Date().toLocaleDateString(langKey === 'fa' ? 'fa-IR' : langKey === 'ku' ? 'ckb-IR' : 'en-US')} • {c.currencyLabel} {currency}
          </p>
        </div>

        {/* Multi-Filter Command Center Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4 no-print">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-rose-500" />
              <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
                {c.filtersTitle}
              </span>
            </div>

            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{c.resetFilters}</span>
              </button>
            )}
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filter 1: Person / Payee */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {c.payeeLabel}
              </label>
              <select
                value={filterPerson}
                onChange={(e) => setFilterPerson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{c.allPayees}</option>
                {allPayees.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.isWorker ? ` (${c.staffTag})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Filter 2: Project Section */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {c.sectionLabel}
              </label>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{c.allSections}</option>
                <option value="unassigned">{c.unassignedSection}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Filter 3: Payment Method */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {c.paymentMethodLabel}
              </label>
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{c.allPaymentMethods}</option>
                <option value="cash">{c.methodCash}</option>
                <option value="bank">{c.methodBank}</option>
                <option value="petty_cash">{c.methodPettyCash}</option>
              </select>
            </div>

            {/* Filter 4: Payment Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {c.settlementStatusLabel}
              </label>
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{c.allStatuses}</option>
                <option value="paid">{c.statusPaidFull}</option>
                <option value="pending">{c.statusPendingCredit}</option>
              </select>
            </div>
          </div>

          {/* Hierarchical Categories Row (3 Levels) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* Level 1: Main Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {c.mainGroupLabel}
              </label>
              <select
                value={filterMainCategory}
                onChange={(e) => {
                  setFilterMainCategory(e.target.value);
                  setFilterSubCategory('all');
                  setFilterMicroCategory('all');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{c.allMainGroups}</option>
                {categories.filter(c => c.level === 1 || !c.parentId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Level 2: Sub-category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {c.subGroupLabel}
              </label>
              <select
                disabled={filterMainCategory === 'all'}
                value={filterSubCategory}
                onChange={(e) => {
                  setFilterSubCategory(e.target.value);
                  setFilterMicroCategory('all');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
              >
                <option value="all">
                  {filterMainCategory === 'all' ? c.selectMainFirst : c.allSubGroups}
                </option>
                {availableSubCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Level 3: Micro-expense Item */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {c.microItemLabel}
              </label>
              <select
                disabled={filterSubCategory === 'all'}
                value={filterMicroCategory}
                onChange={(e) => setFilterMicroCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
              >
                <option value="all">
                  {filterSubCategory === 'all' ? c.selectSubFirst : c.allMicroItems}
                </option>
                {availableMicroCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Scope Row */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
              <button
                onClick={() => setDateFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {c.allTime}
              </button>
              <button
                onClick={() => setDateFilterMode('month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === 'month'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {c.specificMonth}
              </button>
              <button
                onClick={() => setDateFilterMode('day')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === 'day'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {c.singleDay}
              </button>
              <button
                onClick={() => setDateFilterMode('range')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === 'range'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {c.dateRangeCustom}
              </button>
            </div>

            {/* Dynamic Date Pickers */}
            <div className="flex items-center gap-2 flex-wrap">
              {dateFilterMode === 'month' && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                />
              )}
              {dateFilterMode === 'day' && (
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                />
              )}
              {dateFilterMode === 'range' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">{c.fromLabel}</span>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                  <span className="text-slate-400">{c.toLabel}</span>
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
              )}

              {/* Free Text Quick Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={c.searchPlaceholder}
                  className="w-full ps-8 pe-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Analytics KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Filtered Amount */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
              <span>{c.totalFilteredAmount}</span>
              <div className="w-7 h-7 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {formatCurrency(analyticsSummary.total)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <span>{analyticsSummary.projectSharePercent}% {c.ofProjectTotal}</span>
            </div>
          </div>

          {/* Card 2: Settled / Paid Amount */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
              <span>{c.paidCashBank}</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(analyticsSummary.paid)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {analyticsSummary.total > 0 ? Math.round((analyticsSummary.paid / analyticsSummary.total) * 100) : 0}% {c.ofReportIsPaid}
            </div>
          </div>

          {/* Card 3: Pending / Debts */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
              <span>{c.creditPendingDebt}</span>
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
              {formatCurrency(analyticsSummary.pending)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {analyticsSummary.total > 0 ? Math.round((analyticsSummary.pending / analyticsSummary.total) * 100) : 0}% {c.creditUnsettled}
            </div>
          </div>

          {/* Card 4: Count & Average */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
              <span>{c.invoicesAndAvg}</span>
              <div className="w-7 h-7 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-sky-600 dark:text-sky-400">
              {analyticsSummary.count} <span className="text-xs font-medium text-slate-400">{c.invoicesUnit}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {c.avgPerInvoice} <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(analyticsSummary.avg)}</span>
            </div>
          </div>
        </div>

        {/* Visual Distribution Charts (Categories & Sections) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart 1: Categories Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
              <PieChart className="w-4 h-4 text-rose-500" />
              <span>{c.categoryDistribution}</span>
            </div>
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{c.noData}</p>
            ) : (
              <div className="space-y-2.5 pt-1">
                {categoryBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{item.name}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.amount)} ({item.percent}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 2: Project Section Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
              <Building2 className="w-4 h-4 text-sky-500" />
              <span>{c.sectionDistribution}</span>
            </div>
            {sectionBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{c.noData}</p>
            ) : (
              <div className="space-y-2.5 pt-1">
                {sectionBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{item.name}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.amount)} ({item.percent}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 3: Top Payees / Persons */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
              <User className="w-4 h-4 text-emerald-500" />
              <span>{c.topPayees}</span>
            </div>
            {topPayeesBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{c.noData}</p>
            ) : (
              <div className="space-y-2.5 pt-1">
                {topPayeesBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{item.name}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.amount)} ({item.percent}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Itemized Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {c.tableTitle}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {filteredExpenses.length} {c.rowsUnit}
            </span>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              {c.noInvoicesFound}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold">
                    <th className="py-3 px-4 text-start">#</th>
                    <th className="py-3 px-4 text-start">{c.tableHeaderDate}</th>
                    <th className="py-3 px-4 text-start">{c.tableHeaderTitle}</th>
                    <th className="py-3 px-4 text-start">{c.tableHeaderCategory}</th>
                    <th className="py-3 px-4 text-start">{c.tableHeaderPayee}</th>
                    <th className="py-3 px-4 text-start">{c.tableHeaderSection}</th>
                    <th className="py-3 px-4 text-start">{c.tableHeaderMethod}</th>
                    <th className="py-3 px-4 text-start">{c.tableHeaderStatus}</th>
                    <th className="py-3 px-4 text-start font-mono">{c.tableHeaderAmount}</th>
                    <th className="py-3 px-4 text-center no-print">{c.tableHeaderReceipt}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredExpenses.map((exp, idx) => {
                    const catInfo = getCategoryHierarchy(exp.categoryId);
                    const payee = exp.personName || workerMap.get(exp.personId) || '—';
                    const sectionName = sectionMap.get(exp.sectionId) || c.generalCategory;
                    const isPaid = exp.paymentStatus === 'paid';
                    const methodLabel = exp.paymentMethod === 'cash' 
                      ? c.methodCash 
                      : exp.paymentMethod === 'bank' 
                      ? c.methodBankShort 
                      : c.methodPettyCashShort;

                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">{exp.expenseDate || exp.date}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-white block">{exp.title}</span>
                          {exp.description && <span className="text-[11px] text-slate-400 block truncate max-w-xs">{exp.description}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 block">{catInfo.main}</span>
                          {catInfo.sub && <span className="text-[10px] text-slate-400 block">{catInfo.sub} {catInfo.item ? `› ${catInfo.item}` : ''}</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{payee}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{sectionName}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{methodLabel}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            isPaid ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                          }`}>
                            {isPaid ? c.settledShort : c.creditShort}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-center no-print">
                          {exp.receiptUrl ? (
                            <button
                              onClick={() => setPreviewReceiptUrl(exp.receiptUrl)}
                              className="p-1 hover:text-rose-500 rounded transition-colors inline-block"
                              title={c.viewReceiptTitle}
                            >
                              <Eye className="w-4 h-4 text-slate-400 hover:text-rose-500" />
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={8} className="py-3.5 px-4 text-start">
                      {c.grandTotalFiltered}
                    </td>
                    <td colSpan={2} className="py-3.5 px-4 font-mono text-sm text-rose-600 dark:text-rose-400 font-black">
                      {formatCurrency(analyticsSummary.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for Receipt Preview */}
      {previewReceiptUrl && (
        <div 
          onClick={() => setPreviewReceiptUrl(null)}
          className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl p-2 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewReceiptUrl(null)}
              className="absolute top-4 end-4 w-9 h-9 rounded-full bg-slate-900/60 text-white flex items-center justify-center hover:bg-slate-900 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewReceiptUrl} alt="Receipt Full" className="w-full h-auto max-h-[80vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
