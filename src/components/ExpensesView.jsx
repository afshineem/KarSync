import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useProject } from '../context/ProjectContext';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  softDeleteExpenseLive, 
  restoreExpenseLive, 
  archiveExpenseLive, 
  permanentDeleteExpenseLive, 
  emptyExpensesTrashLive, 
  restoreAllExpensesLive, 
  deleteExpenseLive, 
  pullExpensesLive 
} from '../services/realtimeSync';
import { AddExpenseModal } from './AddExpenseModal';
import ExpenseRecycleBinModal from './ExpenseRecycleBinModal';
import ExpenseAnalyticsModal from './ExpenseAnalyticsModal';
import * as XLSX from 'xlsx';
import {
  Receipt,
  PlusCircle,
  Plus,
  BarChart3,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  User,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  X,
  TrendingUp,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Tag,
  Archive,
  RotateCcw
} from 'lucide-react';

export { AddExpenseModal, ExpenseRecycleBinModal, ExpenseAnalyticsModal };

export function ExpensesView() {
  const { currentProject } = useProject();
  const { t, language, direction } = useLanguage();
  const isRtl = direction === 'rtl';

  const projectId = currentProject?.id || 'prj_default_main';
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  // Currency Formatter
  const formatCurrency = (amount, customCurr = null) => {
    const curr = customCurr || currency;
    const num = Number(amount) || 0;
    try {
      if (curr === 'IRT') return `${new Intl.NumberFormat('fa-IR').format(num)} تومان`;
      if (curr === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
      return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(num);
    } catch {
      return `${num.toLocaleString()} ${curr}`;
    }
  };

  // Instant Realtime sync on mount, tab focus, or WebSocket broadcast event
  useEffect(() => {
    pullExpensesLive(true).catch(() => {});
    const onSync = () => {
      pullExpensesLive(true).catch(() => {});
    };
    window.addEventListener('workshop-expenses-sync', onSync);
    window.addEventListener('focus', onSync);
    return () => {
      window.removeEventListener('workshop-expenses-sync', onSync);
      window.removeEventListener('focus', onSync);
    };
  }, [projectId]);

  // Live Queries
  const expenses = useLiveQuery(
    async () => {
      const list = await db.expenses.toArray();
      const filtered = list.filter(e => !e.projectId || e.projectId === projectId || (projectId === 'prj_default_main'));
      return filtered.sort((a, b) => new Date(b.expenseDate || b.createdAt) - new Date(a.expenseDate || a.createdAt));
    },
    [projectId]
  ) || [];

  const categories = useLiveQuery(
    async () => {
      const list = await db.expenseCategories.toArray();
      return list.filter(c => !c.projectId || c.projectId === projectId || (projectId === 'prj_default_main'));
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

  // Lookup Maps
  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const sectionMap = useMemo(() => {
    const map = new Map();
    sections.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sections]);

  const workerMap = useMemo(() => {
    const map = new Map();
    workers.forEach((w) => map.set(w.id, w.name));
    return map;
  }, [workers]);

  // Modal & Tab States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState(null);
  const [isRecycleBinModalOpen, setIsRecycleBinModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [currentViewTab, setCurrentViewTab] = useState('active'); // 'active' | 'archived' | 'trash'
  const [toastMsg, setToastMsg] = useState('');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'custom'
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'paid' | 'pending'
  const [selectedMethod, setSelectedMethod] = useState('all'); // 'all' | 'cash' | 'bank' | 'petty_cash'
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);

  // Quick helper to resolve full category hierarchy breadcrumbs
  const getCategoryHierarchy = (catId) => {
    if (!catId) return { main: 'عمومی', sub: '', item: '' };
    const target = categoryMap.get(catId);
    if (!target) return { main: 'سرفصل نامشخص', sub: '', item: '' };

    if (target.level === 3) {
      const parentSub = categoryMap.get(target.parentId);
      const parentMain = parentSub ? categoryMap.get(parentSub.parentId) : null;
      return {
        main: parentMain?.name || 'گروه اصلی',
        sub: parentSub?.name || '',
        item: target.name
      };
    } else if (target.level === 2) {
      const parentMain = categoryMap.get(target.parentId);
      return {
        main: parentMain?.name || 'گروه اصلی',
        sub: target.name,
        item: ''
      };
    } else {
      return {
        main: target.name,
        sub: '',
        item: ''
      };
    }
  };

  // Partition expenses into Active, Archived, and Trash
  const activeExpenses = useMemo(() => {
    return expenses.filter(e => !e.deletedAt && !e.isArchived);
  }, [expenses]);

  const archivedExpenses = useMemo(() => {
    return expenses.filter(e => !e.deletedAt && Boolean(e.isArchived));
  }, [expenses]);

  const trashExpenses = useMemo(() => {
    return expenses.filter(e => Boolean(e.deletedAt));
  }, [expenses]);

  const currentTabExpenses = useMemo(() => {
    if (currentViewTab === 'trash') return trashExpenses;
    if (currentViewTab === 'archived') return archivedExpenses;
    return activeExpenses;
  }, [currentViewTab, activeExpenses, archivedExpenses, trashExpenses]);

  // Tab items config matching project Liquid Glass Dock design system
  const viewTabs = useMemo(() => [
    {
      id: 'active',
      label: t('activeExpensesTab') || (language === 'fa' ? 'هزینه‌های جاری' : 'خەرجییە چالاکەکان'),
      icon: Receipt,
      count: activeExpenses.length,
      activeGradient: 'bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 text-white shadow-lg shadow-rose-500/30 border border-rose-400/40',
      activeColor: 'text-rose-500'
    },
    {
      id: 'archived',
      label: t('archivedExpensesTab') || (language === 'fa' ? 'بایگانی و آرشیو' : 'ئەرشیفکراوەکان'),
      icon: Archive,
      count: archivedExpenses.length,
      activeGradient: 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/30 border border-amber-400/40',
      activeColor: 'text-amber-500'
    },
    {
      id: 'trash',
      label: t('trashExpensesTab') || (language === 'fa' ? 'سطل زباله' : 'سەبەتەی سڕینەوە'),
      icon: Trash2,
      count: trashExpenses.length,
      activeGradient: 'bg-gradient-to-r from-rose-600 via-red-600 to-red-700 text-white shadow-lg shadow-rose-600/30 border border-rose-400/40',
      activeColor: 'text-rose-500'
    }
  ], [t, language, activeExpenses.length, archivedExpenses.length, trashExpenses.length]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const currentYearMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);

    return currentTabExpenses.filter((exp) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (exp.title || '').toLowerCase().includes(query);
        const descMatch = (exp.description || '').toLowerCase().includes(query);
        const personMatch = (exp.personName || workerMap.get(exp.personId) || '').toLowerCase().includes(query);
        const catInfo = getCategoryHierarchy(exp.categoryId);
        const catMatch = (catInfo.main + ' ' + catInfo.sub + ' ' + catInfo.item).toLowerCase().includes(query);

        if (!titleMatch && !descMatch && !personMatch && !catMatch) return false;
      }

      // 2. Date Range
      if (dateRangeFilter === 'this_month') {
        if (!exp.expenseDate?.startsWith(currentYearMonth)) return false;
      } else if (dateRangeFilter === 'last_month') {
        if (!exp.expenseDate?.startsWith(lastMonthStr)) return false;
      }

      // 3. Section
      if (selectedSection !== 'all') {
        if (selectedSection === 'unassigned') {
          if (exp.sectionId) return false;
        } else if (exp.sectionId !== selectedSection) {
          return false;
        }
      }

      // 4. Category
      if (selectedCategory !== 'all') {
        const cat = categoryMap.get(exp.categoryId);
        if (!cat) return false;
        if (cat.id !== selectedCategory && cat.parentId !== selectedCategory) {
          const parentSub = categoryMap.get(cat.parentId);
          if (!parentSub || parentSub.parentId !== selectedCategory) return false;
        }
      }

      // 5. Person
      if (selectedPerson !== 'all') {
        if (exp.personId !== selectedPerson) return false;
      }

      // 6. Payment Status
      if (selectedStatus !== 'all' && exp.paymentStatus !== selectedStatus) {
        return false;
      }

      // 7. Payment Method
      if (selectedMethod !== 'all' && exp.paymentMethod !== selectedMethod) {
        return false;
      }

      return true;
    });
  }, [
    currentTabExpenses,
    searchQuery,
    dateRangeFilter,
    selectedSection,
    selectedCategory,
    selectedPerson,
    selectedStatus,
    selectedMethod,
    categoryMap,
    workerMap
  ]);

  // KPI Calculations (based on active expenses)
  const stats = useMemo(() => {
    let totalAll = 0;
    let totalThisMonth = 0;
    let totalPaid = 0;
    let totalPending = 0;
    const sectionExpensesMap = {};

    const currentYearMonth = new Date().toISOString().slice(0, 7);

    activeExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalAll += amt;

      if (exp.expenseDate?.startsWith(currentYearMonth)) {
        totalThisMonth += amt;
      }

      if (exp.paymentStatus === 'paid') {
        totalPaid += amt;
      } else {
        totalPending += amt;
      }

      // Section accumulation
      const secKey = exp.sectionId || 'unassigned';
      sectionExpensesMap[secKey] = (sectionExpensesMap[secKey] || 0) + amt;
    });

    // Determine top spending section
    let topSectionName = language === 'fa' ? 'بدون بخش مشخص' : 'دیارینەکراو';
    let topSectionAmount = 0;

    Object.entries(sectionExpensesMap).forEach(([secId, amt]) => {
      if (amt > topSectionAmount) {
        topSectionAmount = amt;
        topSectionName = secId === 'unassigned' 
          ? (language === 'fa' ? 'هزینه عمومی پروژه' : 'خەرجی گشتی') 
          : (sectionMap.get(secId) || 'بخش پروژه');
      }
    });

    const topSectionPercent = totalAll > 0 ? Math.round((topSectionAmount / totalAll) * 100) : 0;

    return {
      totalAll,
      totalThisMonth,
      totalPaid,
      totalPending,
      count: activeExpenses.length,
      topSectionName,
      topSectionAmount,
      topSectionPercent
    };
  }, [activeExpenses, sectionMap, language]);

  // Actions
  const handleEdit = (exp) => {
    setEditingExpense(exp);
    setIsAddModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await softDeleteExpenseLive(expenseToDelete.id);
      setToastMsg(language === 'fa' ? 'هزینه به سطل زباله منتقل شد.' : 'خەرجی بۆ سەبەتەی سڕینەوە گوێزرایەوە.');
      setTimeout(() => setToastMsg(''), 3000);
      setExpenseToDelete(null);
    } catch (err) {
      console.error('Delete expense error:', err);
    }
  };

  const handleRestore = async (expId) => {
    try {
      await restoreExpenseLive(expId);
      setToastMsg(language === 'fa' ? 'هزینه با موفقیت بازیابی شد.' : 'خەرجییەکە گەڕێندرایەوە.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error('Restore expense error:', err);
    }
  };

  const handleArchive = async (expId, isArchived = true) => {
    try {
      await archiveExpenseLive(expId, isArchived);
      setToastMsg(isArchived 
        ? (language === 'fa' ? 'هزینه به بخش بایگانی منتقل گردید.' : 'خەرجییەکە ئەرشیفکرا.') 
        : (language === 'fa' ? 'هزینه از بایگانی خارج و به لیست فعال بازگشت.' : 'خەرجی لە ئەرشیف دەرهێندرا.'));
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error('Archive expense error:', err);
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToPermanentDelete) return;
    try {
      await permanentDeleteExpenseLive(itemToPermanentDelete.id);
      setItemToPermanentDelete(null);
      setToastMsg(language === 'fa' ? 'هزینه برای همیشه حذف گردید.' : 'خەرجییەکە بە یەکجاری سڕایەوە.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error('Permanent delete error:', err);
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      alert(language === 'fa' ? 'هیچ هزینه‌ای برای خروجی وجود ندارد.' : 'هیچ خەرجییەک نییە بۆ هەناردەکردن.');
      return;
    }

    const rows = filteredExpenses.map((exp, idx) => {
      const catInfo = getCategoryHierarchy(exp.categoryId);
      const person = exp.personName || workerMap.get(exp.personId) || '-';
      const section = sectionMap.get(exp.sectionId) || (language === 'fa' ? 'هزینه عمومی' : 'خەرجی گشتی');
      const statusLabel = exp.paymentStatus === 'paid' 
        ? (language === 'fa' ? 'تسویه شده' : 'پارەدراو') 
        : (language === 'fa' ? 'پرداخت نشده (نسیه)' : 'قەرز');
      const methodLabel = exp.paymentMethod === 'cash' 
        ? (language === 'fa' ? 'صندوق نقدی' : 'کاش') 
        : exp.paymentMethod === 'bank' 
        ? (language === 'fa' ? 'حساب بانکی' : 'بانک') 
        : (language === 'fa' ? 'تنخواه سرپرست' : 'تەنخوا');

      return {
        '#': idx + 1,
        [language === 'fa' ? 'تاریخ فاکتور' : 'بەروار']: exp.expenseDate || '',
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
        [language === 'fa' ? 'رسید پیوست دارد؟' : 'پسوولە هەیە؟']: exp.receiptUrl ? 'بله' : 'خیر',
        [language === 'fa' ? 'یادداشت و توضیحات' : 'تێبینی']: exp.description || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
    const fileName = `KarSync_Expenses_${currentProject?.name || 'Project'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div dir={direction} className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Receipt className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{language === 'fa' ? 'مدیریت هزینه‌ها و مخارج' : 'بەڕێوەبردنی خەرجییەکان'}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                {stats.count} {language === 'fa' ? 'فاکتور' : 'فاکتۆر'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentProject?.name} • {language === 'fa' ? 'ثبت هزینه‌های مصالح، ماشین‌آلات، خدمات و تنخواه' : 'تۆماری خەرجییەکانی پڕۆژە و کارگە'}
            </p>
          </div>
        </div>

        {/* Actions Dock: Archive & Trash | Analytics & Export | Add New Expense */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs self-start sm:self-center">
          {/* Button 1: Trash & Archive */}
          <button
            type="button"
            onClick={() => setIsRecycleBinModalOpen(true)}
            className="relative p-2.5 sm:p-3 rounded-xl text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 group focus:outline-hidden"
            title={t('expensesArchiveAndTrash') || (language === 'fa' ? 'سطل زباله و آرشیو' : 'سەبەتەی سڕینەوە و ئەرشیف')}
            aria-label={t('expensesArchiveAndTrash') || (language === 'fa' ? 'سطل زباله و آرشیو' : 'سەبەتەی سڕینەوە و ئەرشیف')}
          >
            <Archive className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 group-hover:scale-110 transition-transform" />
            {(trashExpenses.length > 0 || archivedExpenses.length > 0) && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono bg-rose-500 text-white font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 leading-none shadow-xs">
                {trashExpenses.length + archivedExpenses.length}
              </span>
            )}
          </button>

          {/* Button 2: Analytics & Export (Formerly Excel Export) */}
          <button
            type="button"
            onClick={() => setIsAnalyticsModalOpen(true)}
            className="p-2.5 sm:p-3 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 group focus:outline-hidden"
            title={t('analyticsAndExport') || (language === 'fa' ? 'آمار و خروجی' : 'ئامار و هەناردە')}
            aria-label={t('analyticsAndExport') || (language === 'fa' ? 'آمار و خروجی' : 'ئامار و هەناردە')}
          >
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Button 3: Add New Expense */}
          <button
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setIsAddModalOpen(true);
            }}
            className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white transition-all shadow-md shadow-rose-500/25 active:scale-95 hover:scale-105 group focus:outline-hidden"
            title={language === 'fa' ? 'ثبت هزینه جدید' : 'تۆمارکردنی خەرجی نوێ'}
            aria-label={language === 'fa' ? 'ثبت هزینه جدید' : 'تۆمارکردنی خەرجی نوێ'}
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total All-time Expenses */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>{language === 'fa' ? 'مجموع کل هزینه‌ها' : 'کۆی گشتی خەرجییەکان'}</span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
            {formatCurrency(stats.totalAll)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
            <span>{language === 'fa' ? 'هزینه این ماه:' : 'ئەم مانگە:'}</span>
            <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
              {formatCurrency(stats.totalThisMonth)}
            </span>
          </div>
        </div>

        {/* Card 2: Settled / Paid Amount */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>{language === 'fa' ? 'مبالغ تسویه شده (پرداختی)' : 'پارەی پاکتاوکراو (دراو)'}</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatCurrency(stats.totalPaid)}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.totalAll > 0 ? (stats.totalPaid / stats.totalAll) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {stats.totalAll > 0 ? Math.round((stats.totalPaid / stats.totalAll) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Card 3: Pending / Debts */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>{language === 'fa' ? 'مبالغ معوق (نسیه / بدهی)' : 'قەرزی نەدراو (پاشکەوت)'}</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
            {formatCurrency(stats.totalPending)}
          </div>
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            {stats.totalPending > 0 
              ? (language === 'fa' ? 'تعهدات پرداخت نشده به طرف‌های حساب' : 'قەرزی ماوە لەسەر پڕۆژە') 
              : (language === 'fa' ? 'تمامی فاکتورها تسویه شده‌اند' : 'هەموو فاکتۆرەکان دراون')}
          </p>
        </div>

        {/* Card 4: Top Spending Section */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>{language === 'fa' ? 'بخش پرهزینه پروژه' : 'پڕخەرجیترین بەش'}</span>
            <div className="w-7 h-7 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 truncate">
            {stats.topSectionName}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
              {formatCurrency(stats.topSectionAmount)}
            </span>
            <span className="bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-md font-bold font-mono">
              {stats.topSectionPercent}% {language === 'fa' ? 'از کل' : 'لە گشتی'}
            </span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* View Segmented Tabs: Active | Archived | Trash (Apple Liquid Glass Dock with dynamic label expand & large icons) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav 
          aria-label="Expense views"
          className="flex items-center gap-1.5 sm:gap-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl backdrop-saturate-200 p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-white/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_4px_20px_rgba(0,0,0,0.4)] w-fit"
        >
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentViewTab === tab.id;
            return (
              <div key={tab.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setCurrentViewTab(tab.id)}
                  aria-label={tab.label}
                  className={`relative rounded-xl sm:rounded-2xl transition-all duration-300 ease-out flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                    isActive
                      ? `${tab.activeGradient} px-4 py-2.5 sm:px-5 sm:py-2.5 gap-2.5 scale-[1.02]`
                      : 'p-2.5 sm:p-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className={`w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2] transition-transform duration-200 ${
                    isActive ? 'scale-105' : 'group-hover:scale-110'
                  }`} />

                  {/* Smooth text label & badge visible ONLY on active tab */}
                  {isActive && (
                    <div className="flex items-center gap-2 overflow-hidden animate-in fade-in slide-in-from-start-2 duration-200">
                      <span className="text-xs sm:text-sm font-black whitespace-nowrap tracking-tight">
                        {tab.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-black bg-white/25 dark:bg-black/20 text-white backdrop-blur-xs shadow-xs leading-none">
                        {tab.count}
                      </span>
                    </div>
                  )}

                  {/* Inactive count badge pill on top corner */}
                  {!isActive && tab.count > 0 && (
                    <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold bg-slate-200/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-300 flex items-center justify-center leading-none shadow-xs border border-white dark:border-slate-800">
                      {tab.count}
                    </span>
                  )}

                  {/* Active dot indicator */}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-xs"></span>
                  )}
                </button>

                {/* Micro-Tooltip (Hover when not active) */}
                {!isActive && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-md text-white text-[11px] font-bold rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    <span>{tab.label}</span>
                    <span className="ms-1.5 font-mono opacity-80 font-normal">({tab.count})</span>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-solid border-t-slate-900/90 dark:border-t-slate-800/95 border-t-4 border-x-transparent border-x-4 border-b-0" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Batch Actions when viewing Trash */}
        {currentViewTab === 'trash' && trashExpenses.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await restoreAllExpensesLive(trashExpenses.map(e => e.id));
                setToastMsg(language === 'fa' ? 'تمام هزینه‌ها بازیابی شدند.' : 'هەموو خەرجییەکان گەڕێندرانەوە.');
                setTimeout(() => setToastMsg(''), 3000);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('restoreAllExpenses') || (language === 'fa' ? 'بازیابی همه' : 'گێڕانەوەی هەمووان')}</span>
            </button>
            <button
              onClick={async () => {
                if (confirm(language === 'fa' ? 'آیا از خالی کردن سطل زباله و حذف قطعی تمام هزینه‌ها اطمینان دارید؟' : 'ئایا دڵنیایت لە بەتاڵکردنی سەبەتە؟')) {
                  await emptyExpensesTrashLive(projectId);
                  setToastMsg(language === 'fa' ? 'سطل زباله خالی شد.' : 'سەبەتە بەتاڵکرا.');
                  setTimeout(() => setToastMsg(''), 3000);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('emptyExpensesTrash') || (language === 'fa' ? 'خالی کردن سطل زباله' : 'بەتاڵکردنی سەبەتە')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Contextual Notice Banner for Trash or Archive */}
      {currentViewTab === 'trash' && (
        <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-2xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
            <span>
              {language === 'fa' 
                ? 'شما در حال مشاهده سطل زباله هستید. هزینه‌های این بخش در داشبورد و آمار جاری محاسبه نمی‌شوند و تا پاکسازی قطعی قابل بازیابی هستند.' 
                : 'ئێستا لە سەبەتەی سڕینەوەیت. تۆمارەکان لێرە ناژمێردرێن و دەتوانیت بیانگەڕێنیتەوە.'}
            </span>
          </div>
        </div>
      )}

      {currentViewTab === 'archived' && (
        <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {language === 'fa' 
                ? 'شما در حال مشاهده هزینه‌های بایگانی‌شده هستید. این هزینه‌ها در سوابق و گزارشات مالی حفظ شده‌اند اما از جدول جاری خارج شده‌اند.' 
                : 'ئێستا لە بەشی ئەرشیفیت. ئەم خەرجییانە لە تۆمارە داراییەکاندا پارێزراون بەڵام لە لیستی سەرەکیدا نین.'}
            </span>
          </div>
        </div>
      )}

      {/* Advanced Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'fa' ? 'جستجو در عنوان، طرف‌حساب، توضیحات...' : 'گەڕان لە ناونیشان، کەس، تێبینی...'}
              className={`w-full py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                isRtl ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${isRtl ? 'left-3' : 'right-3'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Range Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shrink-0">
            <button
              onClick={() => setDateRangeFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                dateRangeFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {language === 'fa' ? 'همه' : 'هەموو'}
            </button>
            <button
              onClick={() => setDateRangeFilter('this_month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                dateRangeFilter === 'this_month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {language === 'fa' ? 'این ماه' : 'ئەم مانگە'}
            </button>
            <button
              onClick={() => setDateRangeFilter('last_month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                dateRangeFilter === 'last_month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {language === 'fa' ? 'ماه قبل' : 'مانگی پێشوو'}
            </button>
          </div>

          {/* Toggle More Filters */}
          <button
            onClick={() => setIsFilterPanelExpanded(!isFilterPanelExpanded)}
            className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              isFilterPanelExpanded || selectedSection !== 'all' || selectedCategory !== 'all' || selectedPerson !== 'all' || selectedStatus !== 'all'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'فیلترها' : 'فلتەرەکان'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterPanelExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded Filters Drawer */}
        {isFilterPanelExpanded && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
            {/* Filter by Section */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {language === 'fa' ? 'بخش پروژه' : 'بەشی پڕۆژە'}
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{language === 'fa' ? 'همه بخش‌ها' : 'هەموو بەشەکان'}</option>
                <option value="unassigned">{language === 'fa' ? 'هزینه عمومی (بدون بخش)' : 'گشتی'}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {language === 'fa' ? 'سرفصل هزینه' : 'پۆلێنکردن'}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{language === 'fa' ? 'همه سرفصل‌ها' : 'هەموو پۆلەکان'}</option>
                {categories.filter((c) => c.level === 1 || !c.parentId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Payee */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {language === 'fa' ? 'طرف‌حساب (شخص)' : 'لایەنی بەرامبەر'}
              </label>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{language === 'fa' ? 'همه اشخاص' : 'هەموو کەسەکان'}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Settlement Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {language === 'fa' ? 'وضعیت تسویه' : 'دۆخی پارەدان'}
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{language === 'fa' ? 'همه وضعیت‌ها' : 'هەموو دۆخەکان'}</option>
                <option value="paid">{language === 'fa' ? 'تسویه شده' : 'پارەدراو'}</option>
                <option value="pending">{language === 'fa' ? 'پرداخت نشده (نسیه)' : 'قەرز'}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Expenses List View */}
      {filteredExpenses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Receipt className="w-8 h-8 opacity-40" />
          </div>
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            {language === 'fa' ? 'هیچ فاکتور هزینه‌ای یافت نشد' : 'هیچ خەرجییەک نەدۆزرایەوە'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {expenses.length === 0 
              ? (language === 'fa' ? 'برای شروع اولین هزینه یا فاکتور پروژه را از دکمه بالا ثبت کنید.' : 'یەکەمین خەرجی پڕۆژە لە ڕێگەی دوگمەی سەرەوە تۆمار بکە.') 
              : (language === 'fa' ? 'با تغییر فیلترهای جستجو نتایج بیشتری مشاهده خواهید کرد.' : 'فلتەرەکان پاک بکەرەوە بۆ بینینی هەموو تۆمارەکان.')}
          </p>
          {expenses.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDateRangeFilter('all');
                setSelectedSection('all');
                setSelectedCategory('all');
                setSelectedPerson('all');
                setSelectedStatus('all');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200"
            >
              {language === 'fa' ? 'پاک کردن فیلترها' : 'سڕینەوەی فلتەرەکان'}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold">
                    <th className="py-3.5 px-4 text-start">{language === 'fa' ? 'تاریخ' : 'بەروار'}</th>
                    <th className="py-3.5 px-4 text-start">{language === 'fa' ? 'عنوان هزینه' : 'بابەت'}</th>
                    <th className="py-3.5 px-4 text-start">{language === 'fa' ? 'سرفصل (۳ سطحی)' : 'پۆلێنکردن'}</th>
                    <th className="py-3.5 px-4 text-start">{language === 'fa' ? 'طرف‌حساب' : 'لایەنی بەرامبەر'}</th>
                    <th className="py-3.5 px-4 text-start">{language === 'fa' ? 'بخش پروژه' : 'بەش'}</th>
                    <th className="py-3.5 px-4 text-start">{language === 'fa' ? 'مبلغ' : 'بڕە پارە'}</th>
                    <th className="py-3.5 px-4 text-start">{language === 'fa' ? 'وضعیت تسویه' : 'دۆخ'}</th>
                    <th className="py-3.5 px-4 text-center">{language === 'fa' ? 'رسید' : 'پسوولە'}</th>
                    <th className="py-3.5 px-4 text-end">{language === 'fa' ? 'عملیات' : 'کردار'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredExpenses.map((exp) => {
                    const catInfo = getCategoryHierarchy(exp.categoryId);
                    const payee = exp.personName || workerMap.get(exp.personId) || '—';
                    const sectionName = sectionMap.get(exp.sectionId) || (language === 'fa' ? 'عمومی' : 'گشتی');
                    const isPaid = exp.paymentStatus === 'paid';

                    return (
                      <tr 
                        key={exp.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Date */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {exp.expenseDate}
                        </td>

                        {/* Title & Notes */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                            {exp.title}
                          </p>
                          {exp.description && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-xs mt-0.5">
                              {exp.description}
                            </p>
                          )}
                        </td>

                        {/* Hierarchical Category Badge */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {catInfo.item || catInfo.sub || catInfo.main}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {catInfo.main} {catInfo.sub ? `› ${catInfo.sub}` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Payee / Person */}
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {payee}
                        </td>

                        {/* Section */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {sectionName}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4">
                          <span className="font-black font-mono text-sm tracking-tight text-slate-900 dark:text-white">
                            {formatCurrency(exp.amount, exp.currency)}
                          </span>
                        </td>

                        {/* Settlement Status */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50'
                          }`}>
                            {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            <span>{isPaid ? (language === 'fa' ? 'تسویه شده' : 'پارەدراو') : (language === 'fa' ? 'معوق (نسیه)' : 'قەرز')}</span>
                          </span>
                        </td>

                        {/* Receipt Thumbnail / Eye */}
                        <td className="py-3.5 px-4 text-center">
                          {exp.receiptUrl ? (
                            <button
                              onClick={() => setPreviewReceiptUrl(exp.receiptUrl)}
                              className="relative group p-1 inline-flex rounded-lg hover:ring-2 hover:ring-rose-400 transition-all"
                              title="مشاهده تصویر فاکتور"
                            >
                              <img
                                src={exp.receiptUrl}
                                alt="Receipt"
                                className="w-8 h-8 object-cover rounded-md border border-slate-200 dark:border-slate-700 shadow-xs"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            {currentViewTab === 'trash' ? (
                              <>
                                <button
                                  onClick={() => handleRestore(exp.id)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs"
                                  title={language === 'fa' ? 'بازیابی به هزینه‌های جاری' : 'گێڕانەوە'}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  <span className="hidden xl:inline">{language === 'fa' ? 'بازیابی' : 'گێڕانەوە'}</span>
                                </button>
                                <button
                                  onClick={() => setItemToPermanentDelete(exp)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                  title={language === 'fa' ? 'حذف دائمی' : 'سڕینەوەی یەکجاری'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : currentViewTab === 'archived' ? (
                              <>
                                <button
                                  onClick={() => handleArchive(exp.id, false)}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs"
                                  title={language === 'fa' ? 'خروج از بایگانی' : 'دەرهێنان لە ئەرشیف'}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  <span className="hidden xl:inline">{language === 'fa' ? 'خروج از آرشیو' : 'دەرهێنان'}</span>
                                </button>
                                <button
                                  onClick={() => setExpenseToDelete(exp)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                  title={language === 'fa' ? 'انتقال به سطل زباله' : 'بردن بۆ سەبەتە'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleArchive(exp.id, true)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors"
                                  title={language === 'fa' ? 'بایگانی کردن هزینه' : 'ئەرشیفکردن'}
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEdit(exp)}
                                  className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-xl transition-colors"
                                  title="ویرایش"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setExpenseToDelete(exp)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                  title={language === 'fa' ? 'انتقال به سطل زباله' : 'سڕینەوە'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden space-y-3">
            {filteredExpenses.map((exp) => {
              const catInfo = getCategoryHierarchy(exp.categoryId);
              const payee = exp.personName || workerMap.get(exp.personId);
              const sectionName = sectionMap.get(exp.sectionId) || (language === 'fa' ? 'عمومی' : 'گشتی');
              const isPaid = exp.paymentStatus === 'paid';

              return (
                <div
                  key={exp.id}
                  className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                          {exp.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span>{exp.expenseDate}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {catInfo.item || catInfo.sub || catInfo.main}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-end">
                      <div className="font-black font-mono text-base text-slate-900 dark:text-white">
                        {formatCurrency(exp.amount, exp.currency)}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold mt-1 ${
                        isPaid 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                      }`}>
                        {isPaid ? (language === 'fa' ? 'تسویه' : 'دراو') : (language === 'fa' ? 'معوق' : 'قەرز')}
                      </span>
                    </div>
                  </div>

                  {exp.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                      {exp.description}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg font-medium">
                        {sectionName}
                      </span>
                      {payee && (
                        <span>{language === 'fa' ? 'به:' : 'بۆ:'} {payee}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {exp.receiptUrl && (
                        <button
                          onClick={() => setPreviewReceiptUrl(exp.receiptUrl)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg"
                          title="مشاهده فاکتور"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {currentViewTab === 'trash' ? (
                        <>
                          <button
                            onClick={() => handleRestore(exp.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg flex items-center gap-1 font-bold text-xs"
                            title={language === 'fa' ? 'بازیابی' : 'گێڕانەوە'}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>{language === 'fa' ? 'بازیابی' : 'گێڕانەوە'}</span>
                          </button>
                          <button
                            onClick={() => setItemToPermanentDelete(exp)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                            title={language === 'fa' ? 'حذف دائمی' : 'سڕینەوەی یەکجاری'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : currentViewTab === 'archived' ? (
                        <>
                          <button
                            onClick={() => handleArchive(exp.id, false)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg flex items-center gap-1 font-bold text-xs"
                            title={language === 'fa' ? 'خروج از بایگانی' : 'دەرهێنان لە ئەرشیف'}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>{language === 'fa' ? 'خروج از آرشیو' : 'دەرهێنان'}</span>
                          </button>
                          <button
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg"
                            title={language === 'fa' ? 'انتقال به سطل زباله' : 'بردن بۆ سەبەتە'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleArchive(exp.id, true)}
                            className="p-1.5 text-slate-500 hover:text-amber-500 rounded-lg"
                            title={language === 'fa' ? 'بایگانی کردن هزینه' : 'ئەرشیفکردن'}
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(exp)}
                            className="p-1.5 text-slate-500 hover:text-sky-500 rounded-lg"
                            title="ویرایش"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg"
                            title={language === 'fa' ? 'انتقال به سطل زباله' : 'سڕینەوە'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Expense Modal */}
      {isAddModalOpen && (
        <AddExpenseModal
          isOpen={isAddModalOpen}
          expenseToEdit={editingExpense}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Receipt Image Preview Lightbox */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-3xl w-full max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center p-3 border border-slate-800">
            <button
              onClick={() => setPreviewReceiptUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewReceiptUrl}
              alt="Receipt preview"
              className="max-h-[80vh] w-auto object-contain rounded-2xl"
            />
            <div className="w-full pt-3 px-3 flex items-center justify-between text-xs text-slate-400">
              <span>{language === 'fa' ? 'تصویر فاکتور / رسید ضمیمه شده' : 'وێنەی فاکتۆری هاوپێچکراو'}</span>
              <a
                href={previewReceiptUrl}
                target="_blank"
                rel="noreferrer"
                download="invoice_receipt.jpg"
                className="text-rose-400 hover:underline flex items-center gap-1 font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{language === 'fa' ? 'باز کردن در تب جدید' : 'کردنەوە لە پەڕەی نوێ'}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            dir={direction}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === 'fa' ? 'انتقال هزینه به سطل زباله' : 'بردن بۆ سەبەتەی سڕینەوە'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'fa' 
                  ? `آیا از انتقال هزینه «${expenseToDelete.title}» به سطل زباله اطمینان دارید؟ این هزینه از لیست جاری خارج شده اما تا پاکسازی قطعی قابل بازیابی خواهد بود.` 
                  : `ئایا دڵنیایت لە بردن بۆ سەبەتەی سڕینەوە؟ دەتوانیت دواتر بیگەڕێنیتەوە.`}
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-md shadow-rose-600/30"
              >
                {language === 'fa' ? 'انتقال به سطل زباله' : 'بردن بۆ سەبەتە'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Dialog */}
      {itemToPermanentDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            dir={direction}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === 'fa' ? 'حذف قطعی و دائمی هزینه' : 'سڕینەوەی یەکجاری خەرجی'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'fa' 
                  ? `آیا از حذف دائمی هزینه «${itemToPermanentDelete.title}» اطمینان دارید؟ این عملیات کاملاً غیرقابل بازگشت است.` 
                  : `ئایا دڵنیایت لە سڕینەوەی یەکجاری؟ ئەم کردارە ناگەڕێتەوە.`}
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToPermanentDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-md shadow-rose-600/30"
              >
                {language === 'fa' ? 'حذف قطعی' : 'سڕینەوەی یەکجاری'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Expense Recycle Bin & Archive Modal */}
      {isRecycleBinModalOpen && (
        <ExpenseRecycleBinModal
          isOpen={isRecycleBinModalOpen}
          onClose={() => setIsRecycleBinModalOpen(false)}
        />
      )}

      {/* Fullscreen Expense Analytics & Custom Reporting Modal */}
      {isAnalyticsModalOpen && (
        <ExpenseAnalyticsModal
          isOpen={isAnalyticsModalOpen}
          onClose={() => setIsAnalyticsModalOpen(false)}
        />
      )}

    </div>
  );
}
