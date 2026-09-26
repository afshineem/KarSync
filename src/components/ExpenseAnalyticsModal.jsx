import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
const DEFAULT_PROJECT_ID = 'prj_default_main';
import { useProject } from '../context/ProjectContext';
import { useLanguage } from '../i18n/LanguageContext';
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

export default function ExpenseAnalyticsModal({ isOpen = true, onClose }) {
  const { currentProject } = useProject();
  const { t, language, direction } = useLanguage();
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
    const num = Number(amount) || 0;
    try {
      if (currency === 'IRT') return `${new Intl.NumberFormat('fa-IR').format(num)} تومان`;
      if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
      return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(num);
    } catch {
      return `${num.toLocaleString()} ${currency}`;
    }
  }, [currency]);

  // Hierarchical category info
  const getCategoryHierarchy = useCallback((catId) => {
    if (!catId) return { main: language === 'fa' ? 'عمومی' : 'گشتی', sub: '', item: '' };
    const target = categoryMap.get(catId);
    if (!target) return { main: language === 'fa' ? 'سرفصل نامشخص' : 'نادیار', sub: '', item: '' };

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
      const key = catInfo.main || (language === 'fa' ? 'عمومی' : 'گشتی');
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
      const name = exp.sectionId ? (sectionMap.get(exp.sectionId) || 'بخش') : (language === 'fa' ? 'عمومی / بدون بخش' : 'گشتی');
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
      const name = exp.personName || workerMap.get(exp.personId) || (language === 'fa' ? 'سایر / نامشخص' : 'نادیار');
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
      alert(language === 'fa' ? 'هیچ رکوردی برای خروجی اکسل یافت نشد.' : 'هیچ خەرجییەک نییە.');
      return;
    }

    const rows = filteredExpenses.map((exp, idx) => {
      const catInfo = getCategoryHierarchy(exp.categoryId);
      const person = exp.personName || workerMap.get(exp.personId) || '-';
      const section = sectionMap.get(exp.sectionId) || (language === 'fa' ? 'عمومی' : 'گشتی');
      const statusLabel = exp.paymentStatus === 'paid' 
        ? (language === 'fa' ? 'تسویه شده' : 'پارەدراو') 
        : (language === 'fa' ? 'نسیه (بدهی)' : 'قەرز');
      const methodLabel = exp.paymentMethod === 'cash' 
        ? (language === 'fa' ? 'صندوق نقدی' : 'کاش') 
        : exp.paymentMethod === 'bank' 
        ? (language === 'fa' ? 'حساب بانکی' : 'بانک') 
        : (language === 'fa' ? 'تنخواه سرپرست' : 'تەنخوا');

      return {
        '#': idx + 1,
        [language === 'fa' ? 'تاریخ' : 'بەروار']: exp.expenseDate || '',
        [language === 'fa' ? 'عنوان هزینه' : 'بابەت']: exp.title || '',
        [language === 'fa' ? 'گروه اصلی' : 'گرووپی سەرەکی']: catInfo.main,
        [language === 'fa' ? 'زیرگروه' : 'ژێرگرووپ']: catInfo.sub,
        [language === 'fa' ? 'هزینه خرد' : 'وردەکاری']: catInfo.item,
        [language === 'fa' ? 'مبلغ' : 'بڕە پارە']: Number(exp.amount) || 0,
        [language === 'fa' ? 'واحد پول' : 'دراو']: exp.currency || currency,
        [language === 'fa' ? 'طرف‌حساب' : 'لایەنی بەرامبەر']: person,
        [language === 'fa' ? 'بخش پروژه' : 'بەشی پڕۆژە']: section,
        [language === 'fa' ? 'وضعیت تسویه' : 'دۆخی پارەدان']: statusLabel,
        [language === 'fa' ? 'روش پرداخت' : 'شێوازی پارەدان']: methodLabel,
        [language === 'fa' ? 'توضیحات' : 'تێبینی']: exp.description || ''
      };
    });

    // Append summary row
    rows.push({
      '#': '',
      [language === 'fa' ? 'تاریخ' : 'بەروار']: '',
      [language === 'fa' ? 'عنوان هزینه' : 'بابەت']: language === 'fa' ? 'مجموع کل اقلام فیلترشده' : 'کۆی گشتی',
      [language === 'fa' ? 'گروه اصلی' : 'گرووپی سەرەکی']: '',
      [language === 'fa' ? 'زیرگروه' : 'ژێرگرووپ']: '',
      [language === 'fa' ? 'هزینه خرد' : 'وردەکاری']: '',
      [language === 'fa' ? 'مبلغ' : 'بڕە پارە']: analyticsSummary.total,
      [language === 'fa' ? 'واحد پول' : 'دراو']: currency,
      [language === 'fa' ? 'طرف‌حساب' : 'لایەنی بەرامبەر']: '',
      [language === 'fa' ? 'بخش پروژه' : 'بەشی پڕۆژە']: '',
      [language === 'fa' ? 'وضعیت تسویه' : 'دۆخی پارەدان']: '',
      [language === 'fa' ? 'روش پرداخت' : 'شێوازی پارەدان']: '',
      [language === 'fa' ? 'توضیحات' : 'تێبینی']: ''
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ExpenseAnalytics');
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
                <span>{t('expenseAnalyticsAndExport') || (language === 'fa' ? 'آمار، تحلیل و خروجی هزینه‌ها' : 'ئامار و هەناردەی خەرجییەکان')}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-900/50">
                  {filteredExpenses.length} {language === 'fa' ? 'فاکتور' : 'فاکتۆر'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {currentProject?.name} • {language === 'fa' ? 'فیلترهای ترکیبی، تحلیل سرفصل‌ها، خروجی اکسل و پرینت' : 'فلتەری تێکەڵ، ڕاپۆرت و چاپی گشتگیر'}
              </p>
            </div>
          </div>

          {/* Action Buttons in Header (No shortcuts written on buttons per Requirement 6) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title={language === 'fa' ? 'خروجی اکسل' : 'هەناردەی Excel'}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">{t('exportExcel') || (language === 'fa' ? 'خروجی اکسل' : 'هەناردەی Excel')}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title={language === 'fa' ? 'چاپ گزارش' : 'چاپکردنی ڕاپۆرت'}
            >
              <Printer className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">{t('printReport') || (language === 'fa' ? 'چاپ گزارش' : 'چاپکردنی ڕاپۆرت')}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title={language === 'fa' ? 'بستن' : 'داخستن'}
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
          <h1 className="text-xl font-black">{currentProject?.name} - {language === 'fa' ? 'گزارش تفصیلی هزینه‌ها و مخارج' : 'ڕاپۆرتی خەرجییەکان'}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'fa' ? 'تاریخ تهیه گزارش:' : 'بەرواری ئامادەکردن:'} {new Date().toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US')} • {language === 'fa' ? 'واحد پول:' : 'دراو:'} {currency}
          </p>
        </div>

        {/* Multi-Filter Command Center Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4 no-print">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-rose-500" />
              <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
                {language === 'fa' ? 'فیلترهای چندگانه و همزمان (ترکیب دلخواه)' : 'فلتەرە فرەچەشنەکان (پێکەوەبەستنی دڵخواز)'}
              </span>
            </div>

            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('resetFilters') || (language === 'fa' ? 'بازنشانی تمام فیلترها' : 'پاککردنەوەی هەموو فلتەرەکان')}</span>
              </button>
            )}
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filter 1: Person / Payee */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'طرف‌حساب / شخص' : 'کەس / لایەنی بەرامبەر'}
              </label>
              <select
                value={filterPerson}
                onChange={(e) => setFilterPerson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{language === 'fa' ? 'همه اشخاص و طرف‌های حساب' : 'هەموو کەسەکان'}</option>
                {allPayees.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.isWorker ? `(${language === 'fa' ? 'پرسنل' : 'کرێکار'})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Filter 2: Project Section */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'بخش پروژه' : 'بەشی پڕۆژە'}
              </label>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{language === 'fa' ? 'همه بخش‌ها' : 'هەموو بەشەکان'}</option>
                <option value="unassigned">{language === 'fa' ? 'عمومی / بدون بخش' : 'گشتی'}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Filter 3: Payment Method */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'روش پرداخت' : 'شێوازی پارەدان'}
              </label>
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{language === 'fa' ? 'همه روش‌های پرداخت' : 'هەموو شێوازەکان'}</option>
                <option value="cash">{language === 'fa' ? 'صندوق نقدی' : 'کاش'}</option>
                <option value="bank">{language === 'fa' ? 'حساب بانکی' : 'بانک'}</option>
                <option value="petty_cash">{language === 'fa' ? 'تنخواه سرپرست' : 'تەنخوا'}</option>
              </select>
            </div>

            {/* Filter 4: Payment Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'وضعیت تسویه' : 'دۆخی پارەدان'}
              </label>
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">{language === 'fa' ? 'همه وضعیت‌ها (تسویه و نسیه)' : 'هەموو دۆخەکان'}</option>
                <option value="paid">{language === 'fa' ? 'تسویه شده (پرداخت شده)' : 'پارەدراو'}</option>
                <option value="pending">{language === 'fa' ? 'معوق (پرداخت نشده / نسیه)' : 'قەرز'}</option>
              </select>
            </div>
          </div>

          {/* Hierarchical Categories Row (3 Levels) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* Level 1: Main Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'سرفصل اصلی (سطح ۱)' : 'گرووپی سەرەکی (ئاستی ١)'}
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
                <option value="all">{language === 'fa' ? 'همه گروه‌های اصلی' : 'هەموو گرووپە سەرەکییەکان'}</option>
                {categories.filter(c => c.level === 1 || !c.parentId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Level 2: Sub-category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'زیرگروه (سطح ۲)' : 'ژێرگرووپ (ئاستی ٢)'}
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
                  {filterMainCategory === 'all' 
                    ? (language === 'fa' ? 'ابتدا گروه اصلی را انتخاب کنید' : 'سەرەتا گرووپی سەرەکی دیاریبکە') 
                    : (language === 'fa' ? 'همه زیرگروه‌ها' : 'هەموو ژێرگرووپەکان')}
                </option>
                {availableSubCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Level 3: Micro-expense Item */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'هزینه خرد (سطح ۳)' : 'وردەکاری خەرجی (ئاستی ٣)'}
              </label>
              <select
                disabled={filterSubCategory === 'all'}
                value={filterMicroCategory}
                onChange={(e) => setFilterMicroCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
              >
                <option value="all">
                  {filterSubCategory === 'all' 
                    ? (language === 'fa' ? 'ابتدا زیرگروه را انتخاب کنید' : 'سەرەتا ژێرگرووپ دیاریبکە') 
                    : (language === 'fa' ? 'همه ریزهزینه‌ها' : 'هەموو وردەکارییەکان')}
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
                {t('allTime') || (language === 'fa' ? 'همه زمان‌ها' : 'هەموو کاتەکان')}
              </button>
              <button
                onClick={() => setDateFilterMode('month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === 'month'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('specificMonth') || (language === 'fa' ? 'ماه خاص' : 'مانگی دیاریکراو')}
              </button>
              <button
                onClick={() => setDateFilterMode('day')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === 'day'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('singleDay') || (language === 'fa' ? 'روز خاص' : 'ڕۆژی دیاریکراو')}
              </button>
              <button
                onClick={() => setDateFilterMode('range')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === 'range'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('dateRangeCustom') || (language === 'fa' ? 'بازه دلخواه' : 'ماوەی بەروار')}
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
                  <span className="text-slate-400">{language === 'fa' ? 'از:' : 'لە:'}</span>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                  <span className="text-slate-400">{language === 'fa' ? 'تا:' : 'بۆ:'}</span>
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
                  placeholder={language === 'fa' ? 'جستجوی متن...' : 'گەڕان...'}
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
              <span>{language === 'fa' ? 'مجموع مبالغ فیلترشده' : 'کۆی گشتی فلتەرکراو'}</span>
              <div className="w-7 h-7 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {formatCurrency(analyticsSummary.total)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <span>{analyticsSummary.projectSharePercent}% {language === 'fa' ? 'از کل هزینه‌های پروژه' : 'لە گشتی پڕۆژە'}</span>
            </div>
          </div>

          {/* Card 2: Settled / Paid Amount */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
              <span>{language === 'fa' ? 'تسویه شده (پرداختی نقدی/بانک)' : 'پارەی پاکتاوکراو'}</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(analyticsSummary.paid)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {analyticsSummary.total > 0 ? Math.round((analyticsSummary.paid / analyticsSummary.total) * 100) : 0}% {language === 'fa' ? 'از این گزارش تسویه است' : 'دراوە'}
            </div>
          </div>

          {/* Card 3: Pending / Debts */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
              <span>{language === 'fa' ? 'معوق (نسیه / بدهی)' : 'قەرزی نەدراو'}</span>
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
              {formatCurrency(analyticsSummary.pending)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {analyticsSummary.total > 0 ? Math.round((analyticsSummary.pending / analyticsSummary.total) * 100) : 0}% {language === 'fa' ? 'نسیه و تسویه نشده' : 'قەرز'}
            </div>
          </div>

          {/* Card 4: Count & Average */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
              <span>{language === 'fa' ? 'تعداد و میانگین فاکتورها' : 'ژمارە و تێکڕای فاکتۆر'}</span>
              <div className="w-7 h-7 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-sky-600 dark:text-sky-400">
              {analyticsSummary.count} <span className="text-xs font-medium text-slate-400">{language === 'fa' ? 'فقره فاکتور' : 'فاکتۆر'}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {language === 'fa' ? 'میانگین هر فاکتور:' : 'تێکڕای فاکتۆر:'} <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(analyticsSummary.avg)}</span>
            </div>
          </div>
        </div>

        {/* Visual Distribution Charts (Categories & Sections) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart 1: Categories Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
              <PieChart className="w-4 h-4 text-rose-500" />
              <span>{t('categoryDistribution') || (language === 'fa' ? 'تفکیک سهم سرفصل‌های هزینه' : 'دابەشبوونی بەشە خەرجییەکان')}</span>
            </div>
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{language === 'fa' ? 'داده‌ای وجود ندارد' : 'داتا بەردەست نییە'}</p>
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
              <span>{t('sectionDistribution') || (language === 'fa' ? 'تفکیک بر اساس بخش‌های پروژه' : 'دابەشبوون بەپێی بەشەکان')}</span>
            </div>
            {sectionBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{language === 'fa' ? 'داده‌ای وجود ندارد' : 'داتا بەردەست نییە'}</p>
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
              <span>{language === 'fa' ? 'طرف‌های حساب برتر (بیشترین مبالغ)' : 'لایەنە سەرەکییەکان'}</span>
            </div>
            {topPayeesBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{language === 'fa' ? 'داده‌ای وجود ندارد' : 'داتا بەردەست نییە'}</p>
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
                {language === 'fa' ? 'ریز اقلام و فاکتورهای فیلترشده' : 'وردەکاری فاکتۆرەکان'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {filteredExpenses.length} {language === 'fa' ? 'ردیف' : 'تۆمار'}
            </span>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              {language === 'fa' ? 'هیچ فاکتوری با شرایط فیلترهای انتخابی یافت نشد.' : 'هیچ تۆمارێک نەدۆزرایەوە.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold">
                    <th className="py-3 px-4 text-start">#</th>
                    <th className="py-3 px-4 text-start">{language === 'fa' ? 'تاریخ' : 'بەروار'}</th>
                    <th className="py-3 px-4 text-start">{language === 'fa' ? 'عنوان هزینه' : 'بابەت'}</th>
                    <th className="py-3 px-4 text-start">{language === 'fa' ? 'سرفصل هزینه' : 'پۆلێنکردن'}</th>
                    <th className="py-3 px-4 text-start">{language === 'fa' ? 'طرف‌حساب' : 'لایەنی بەرامبەر'}</th>
                    <th className="py-3 px-4 text-start">{language === 'fa' ? 'بخش پروژه' : 'بەش'}</th>
                    <th className="py-3 px-4 text-start">{language === 'fa' ? 'روش پرداخت' : 'شێواز'}</th>
                    <th className="py-3 px-4 text-start">{language === 'fa' ? 'وضعیت' : 'دۆخ'}</th>
                    <th className="py-3 px-4 text-start font-mono">{language === 'fa' ? 'مبلغ' : 'بڕە پارە'}</th>
                    <th className="py-3 px-4 text-center no-print">{language === 'fa' ? 'رسید' : 'پسوولە'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredExpenses.map((exp, idx) => {
                    const catInfo = getCategoryHierarchy(exp.categoryId);
                    const payee = exp.personName || workerMap.get(exp.personId) || '—';
                    const sectionName = sectionMap.get(exp.sectionId) || (language === 'fa' ? 'عمومی' : 'گشتی');
                    const isPaid = exp.paymentStatus === 'paid';
                    const methodLabel = exp.paymentMethod === 'cash' 
                      ? (language === 'fa' ? 'صندوق نقدی' : 'کاش') 
                      : exp.paymentMethod === 'bank' 
                      ? (language === 'fa' ? 'بانکی' : 'بانک') 
                      : (language === 'fa' ? 'تنخواه' : 'تەنخوا');

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
                            {isPaid ? (language === 'fa' ? 'تسویه' : 'دراو') : (language === 'fa' ? 'نسیه' : 'قەرز')}
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
                              title="مشاهده فاکتور"
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
                      {language === 'fa' ? 'جمع کل مبالغ فیلترشده:' : 'کۆی گشتی فلتەرکراو:'}
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
