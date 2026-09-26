import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import {
  restoreExpenseLive,
  archiveExpenseLive,
  permanentDeleteExpenseLive,
  emptyExpensesTrashLive,
  restoreAllExpensesLive
} from '../services/realtimeSync';
import {
  Trash2,
  Archive,
  RotateCcw,
  X,
  Search,
  AlertTriangle,
  Receipt,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
  User,
  Building2,
  Wallet,
  Clock,
  Sparkles
} from 'lucide-react';

export default function ExpenseRecycleBinModal({ isOpen, onClose }) {
  const { currentProject } = useProject();
  const { t, language, direction } = useLanguage();
  const isRtl = direction === 'rtl';

  const projectId = currentProject?.id || 'prj_default_main';
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  const [activeSubTab, setActiveSubTab] = useState('trash'); // 'trash' | 'archive'
  const [searchQuery, setSearchQuery] = useState('');
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const [itemToDeletePermanently, setItemToDeletePermanently] = useState(null);
  const [showConfirmEmptyTrash, setShowConfirmEmptyTrash] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Live queries
  const allExpenses = useLiveQuery(
    async () => {
      const list = await db.expenses.toArray();
      return list.filter(e => !e.projectId || e.projectId === projectId || projectId === 'prj_default_main');
    },
    [projectId]
  ) || [];

  const categories = useLiveQuery(
    () => db.expenseCategories.where('projectId').equals(projectId).toArray(),
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

  const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    try {
      if (currency === 'IRT') return `${new Intl.NumberFormat('fa-IR').format(num)} تومان`;
      if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
      return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(num);
    } catch {
      return `${num.toLocaleString()} ${currency}`;
    }
  };

  const getCategoryHierarchy = (catId) => {
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
  };

  // Split into Trash and Archive
  const trashExpenses = useMemo(() => {
    return allExpenses
      .filter(e => Boolean(e.deletedAt))
      .sort((a, b) => new Date(b.deletedAt || b.updatedAt) - new Date(a.deletedAt || a.updatedAt));
  }, [allExpenses]);

  const archivedExpenses = useMemo(() => {
    return allExpenses
      .filter(e => !e.deletedAt && Boolean(e.isArchived))
      .sort((a, b) => new Date(b.archivedAt || b.updatedAt) - new Date(a.archivedAt || a.updatedAt));
  }, [allExpenses]);

  // Current list based on active tab
  const currentList = activeSubTab === 'trash' ? trashExpenses : archivedExpenses;

  // Filtered by search
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.toLowerCase().trim();
    return currentList.filter(exp => {
      const titleMatch = (exp.title || '').toLowerCase().includes(q);
      const descMatch = (exp.description || '').toLowerCase().includes(q);
      const personMatch = (exp.personName || workerMap.get(exp.personId) || '').toLowerCase().includes(q);
      const cat = getCategoryHierarchy(exp.categoryId);
      const catMatch = (cat.main + ' ' + cat.sub + ' ' + cat.item).toLowerCase().includes(q);
      return titleMatch || descMatch || personMatch || catMatch;
    });
  }, [currentList, searchQuery, workerMap]);

  // Aggregates
  const totalAmount = useMemo(() => {
    return filteredList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filteredList]);

  // Actions
  const handleRestore = async (expId) => {
    setIsProcessing(true);
    try {
      await restoreExpenseLive(expId);
      setToastMsg(language === 'fa' ? 'هزینه با موفقیت بازیابی شد.' : 'خەرجییەکە بە سەرکەوتوویی گەڕێندرایەوە.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnarchive = async (expId) => {
    setIsProcessing(true);
    try {
      await archiveExpenseLive(expId, false);
      setToastMsg(language === 'fa' ? 'هزینه از بایگانی خارج و به لیست فعال بازگشت.' : 'خەرجی لە ئەرشیف دەرهێندرا و گەڕایەوە بۆ چالاک.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToDeletePermanently) return;
    setIsProcessing(true);
    try {
      await permanentDeleteExpenseLive(itemToDeletePermanently.id);
      setItemToDeletePermanently(null);
      setToastMsg(language === 'fa' ? 'هزینه برای همیشه حذف گردید.' : 'خەرجییەکە بە یەکجاری سڕایەوە.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      await emptyExpensesTrashLive(projectId);
      setShowConfirmEmptyTrash(false);
      setToastMsg(language === 'fa' ? 'سطل زباله به طور کامل تخلیه شد.' : 'سەبەتەی سڕینەوە بە تەواوی بەتاڵکرا.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreAll = async () => {
    if (filteredList.length === 0) return;
    setIsProcessing(true);
    try {
      await restoreAllExpensesLive(filteredList.map(e => e.id));
      setToastMsg(language === 'fa' ? 'تمام هزینه‌ها با موفقیت بازیابی شدند.' : 'هەموو خەرجییەکان گەڕێندرانەوە.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div 
        dir={direction} 
        className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md ${
              activeSubTab === 'trash' 
                ? 'bg-gradient-to-tr from-rose-500 to-rose-600 shadow-rose-500/20' 
                : 'bg-gradient-to-tr from-amber-500 to-amber-600 shadow-amber-500/20'
            }`}>
              {activeSubTab === 'trash' ? <Trash2 className="w-5.5 h-5.5 stroke-[2.2]" /> : <Archive className="w-5.5 h-5.5 stroke-[2.2]" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('expensesArchiveAndTrash') || (language === 'fa' ? 'سطل زباله و آرشیو هزینه‌ها' : 'سەبەتەی سڕینەوە و ئەرشیفی خەرجییەکان')}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentProject?.name} • {language === 'fa' ? 'مدیریت، بازیابی و پاکسازی قطعی رکوردهای هزینه' : 'بەڕێوەبردن، گێڕانەوە و سڕینەوەی یەکجاری'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="px-5 sm:px-6 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
            <button
              onClick={() => setActiveSubTab('trash')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeSubTab === 'trash'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('trashExpensesTab') || (language === 'fa' ? 'سطل زباله (حذف‌شده‌ها)' : 'سەبەتەی سڕینەوە')}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeSubTab === 'trash' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {trashExpenses.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('archive')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeSubTab === 'archive'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{t('archivedExpensesTab') || (language === 'fa' ? 'بایگانی و آرشیو' : 'ئەرشیفکراوەکان')}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeSubTab === 'archive' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {archivedExpenses.length}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'fa' ? 'جستجو در این بخش...' : 'گەڕان...'}
              className="w-full ps-9 pe-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action & Stats Banner */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {filteredList.length} {language === 'fa' ? 'مورد یافت شد' : 'تۆمار دۆزرایەوە'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeSubTab === 'trash' && trashExpenses.length > 0 && (
              <>
                <button
                  onClick={handleRestoreAll}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3 h-3 text-emerald-500" />
                  <span>{t('restoreAllExpenses') || (language === 'fa' ? 'بازیابی همه' : 'گێڕانەوەی هەمووان')}</span>
                </button>

                <button
                  onClick={() => setShowConfirmEmptyTrash(true)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{t('emptyExpensesTrash') || (language === 'fa' ? 'خالی کردن سطل زباله' : 'بەتاڵکردنی سەبەتە')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Toast Message */}
        {toastMsg && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Content Body / Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredList.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 mb-3">
                {activeSubTab === 'trash' ? <Trash2 className="w-8 h-8" /> : <Archive className="w-8 h-8" />}
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {activeSubTab === 'trash' 
                  ? (t('emptyTrashExpenseDesc') || (language === 'fa' ? 'سطل زباله هزینه‌ها خالی است.' : 'سەبەتەی خەرجییە سڕاوەکان بەتاڵە.'))
                  : (t('emptyArchiveExpenseDesc') || (language === 'fa' ? 'هیچ هزینه‌ای در بخش بایگانی وجود ندارد.' : 'هیچ خەرجییەک لە ئەرشیفدا نییە.'))}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {activeSubTab === 'trash'
                  ? (language === 'fa' ? 'هزینه‌هایی که از تب اصلی حذف شوند به اینجا منتقل شده و تا زمان پاکسازی قطعی قابل بازیابی هستند.' : 'خەرجییە سڕاوەکان لەم بەشەدا دەپارێزرێن و دەتوانرێت بگەڕێندرێنەوە.')
                  : (language === 'fa' ? 'می‌توانید فاکتورها و هزینه‌های تسویه شده یا دوره‌های گذشته را بدون حذف، در آرشیو نگهداری فرمایید.' : 'دەتوانیت خەرجییە کۆنەکان لێرەدا ئەرشیف بکەیت بۆ پاککردنەوەی پێڕستەکە.')}
              </p>
            </div>
          ) : (
            filteredList.map((exp) => {
              const catInfo = getCategoryHierarchy(exp.categoryId);
              const person = exp.personName || workerMap.get(exp.personId) || '-';
              const section = sectionMap.get(exp.sectionId) || (language === 'fa' ? 'هزینه عمومی' : 'گشتی');

              return (
                <div
                  key={exp.id}
                  className="p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  {/* Left: Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    {exp.receiptUrl ? (
                      <button
                        onClick={() => setPreviewReceiptUrl(exp.receiptUrl)}
                        className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 relative group/pic"
                        title="مشاهده فاکتور"
                      >
                        <img src={exp.receiptUrl} alt="Receipt" className="w-full h-full object-cover group-hover/pic:scale-110 transition-transform" />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/pic:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 dark:text-white text-sm truncate">
                          {exp.title}
                        </span>
                        {catInfo.main && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {catInfo.main} {catInfo.sub ? `• ${catInfo.sub}` : ''}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {exp.expenseDate || exp.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{section}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{person}</span>
                        </span>
                        {exp.description && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px] text-slate-400 italic">
                              {exp.description}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Deletion / Archive Metadata */}
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>
                          {activeSubTab === 'trash'
                            ? `${language === 'fa' ? 'تاریخ حذف:' : 'کاتی سڕینەوە:'} ${exp.deletedAt ? new Date(exp.deletedAt).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US') : '-'}`
                            : `${language === 'fa' ? 'تاریخ بایگانی:' : 'کاتی ئەرشیف:'} ${exp.archivedAt ? new Date(exp.archivedAt).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US') : '-'}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="text-start md:text-end">
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                        {formatCurrency(exp.amount)}
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        exp.paymentStatus === 'paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                      }`}>
                        {exp.paymentStatus === 'paid' 
                          ? (language === 'fa' ? 'تسویه شده' : 'پارەدراو') 
                          : (language === 'fa' ? 'نسیه' : 'قەرز')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {activeSubTab === 'trash' ? (
                        <>
                          <button
                            onClick={() => handleRestore(exp.id)}
                            disabled={isProcessing}
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 transition-colors"
                            title={language === 'fa' ? 'بازیابی به هزینه‌های جاری' : 'گێڕانەوە'}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span className="hidden sm:inline">{language === 'fa' ? 'بازیابی' : 'گێڕانەوە'}</span>
                          </button>

                          <button
                            onClick={() => setItemToDeletePermanently(exp)}
                            disabled={isProcessing}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1 transition-colors"
                            title={language === 'fa' ? 'حذف دائمی و قطعی' : 'سڕینەوەی یەکجاری'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleUnarchive(exp.id)}
                            disabled={isProcessing}
                            className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors"
                            title={language === 'fa' ? 'خروج از بایگانی' : 'دەرهێنان لە ئەرشیف'}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span className="hidden sm:inline">{language === 'fa' ? 'خروج از بایگانی' : 'دەرهێنان لە ئەرشیف'}</span>
                          </button>

                          <button
                            onClick={async () => {
                              await restoreExpenseLive(exp.id);
                              await permanentDeleteExpenseLive(exp.id);
                            }}
                            disabled={isProcessing}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
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
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {language === 'fa' ? 'همگام‌سازی خودکار با سرور ابری فعال است' : 'هاوکاتکردنی ڕاستەوخۆ چالاکە'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs font-bold transition-colors"
          >
            {language === 'fa' ? 'بستن' : 'داخستن'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Delete Permanently */}
      {itemToDeletePermanently && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div dir={direction} className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {t('confirmPermanentDeleteExpense') || (language === 'fa' ? 'آیا از حذف دائمی این هزینه اطمینان دارید؟' : 'سڕینەوەی یەکجاری ئەم خەرجییە؟')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                «{itemToDeletePermanently.title}» - {formatCurrency(itemToDeletePermanently.amount)}
              </p>
              <p className="text-[11px] text-rose-500 font-semibold mt-2">
                {language === 'fa' ? 'این هزینه به طور قطعی پاک خواهد شد و قابل بازگشت نیست.' : 'ئەم خەرجییە بە تەواوی دەسڕدرێتەوە و ناگەڕێتەوە.'}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setItemToDeletePermanently(null)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/25 transition-all"
              >
                {language === 'fa' ? 'حذف قطعی' : 'سڕینەوەی یەکجاری'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Empty Trash */}
      {showConfirmEmptyTrash && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div dir={direction} className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {language === 'fa' ? 'تخلیه کامل سطل زباله؟' : 'بەتاڵکردنی سەبەتەی سڕینەوە؟'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'fa' 
                  ? `تمام ${trashExpenses.length} هزینه موجود در سطل زباله به طور دائم پاکسازی خواهند شد.` 
                  : `هەموو ${trashExpenses.length} خەرجی ناو سەبەتە بە یەکجاری دەسڕدرێنەوە.`}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowConfirmEmptyTrash(false)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
              </button>
              <button
                onClick={handleEmptyTrash}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/25 transition-all"
              >
                {language === 'fa' ? 'خالی کردن همه' : 'بەتاڵکردنی هەمووان'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for Receipt Preview */}
      {previewReceiptUrl && (
        <div 
          onClick={() => setPreviewReceiptUrl(null)}
          className="fixed inset-0 z-70 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
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
}
