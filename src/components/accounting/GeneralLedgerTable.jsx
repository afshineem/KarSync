import React, { useState, useCallback, useMemo } from 'react';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import { 
  Table as TableIcon, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Filter, 
  Search, 
  Download, 
  Calendar, 
  Tag, 
  CreditCard, 
  Coins, 
  CheckCircle2, 
  Info,
  Clock,
  ShieldCheck,
  FileEdit,
  History,
  CheckSquare,
  Square,
  AlertCircle,
  X,
  Check,
  ChevronLeft,
  Layers,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { VerificationBadge } from '../common/VerificationBadge';
import { useTwoStageApproval } from '../../hooks/useTwoStageApproval';

/**
 * GeneralLedgerTable
 * دفتر کل جامع تراکنش‌های سیستم (ورودی‌ها و خروجی‌ها)
 * 
 * ویژگی‌ها:
 * - تایید نهایی اسناد و نمایش نام مدیر تاییدکننده
 * - تایید نهایی گروهی اسناد موقت/پیش‌نویس (Bulk Approval)
 * - حذف اسناد موقت و پیش‌نویس (Single & Bulk Delete)
 * - صدور سند اصلاحیه برای اسناد تایید شده (Amendment Workflow)
 * - تب‌های فیلتر سریع بر اساس وضعیت تایید (همه، پیش‌نویس، تایید نهایی، اصلاحیه)
 * - خروجی حرفه‌ای به اکسل (Excel Export) با درج وضعیت‌های جدید
 */
export function GeneralLedgerTable({
  ledgerItems = [],
  financialAccounts = [],
  ledgerStats = { total: 0, draft: 0, approved: 0, amended: 0 },
  approvalStatusFilter = 'all',
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
  currency = 'IQD',
  language = 'fa',
  projectName = 'KarSync',
  onDeleteDraftItem,
  onBatchDeleteDraftItems
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [amendmentModalTx, setAmendmentModalTx] = useState(null);
  const [historyModalTx, setHistoryModalTx] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { approveRecord, batchApproveRecords, amendRecord, canApprove, user } = useTwoStageApproval();

  // فیلتر اسناد پیش‌نویس در صفحه جاری
  const visibleDraftItems = useMemo(() => {
    return ledgerItems.filter((item) => item.status !== 'approved');
  }, [ledgerItems]);

  const isAllDraftsSelected = useMemo(() => {
    if (visibleDraftItems.length === 0) return false;
    return visibleDraftItems.every((item) => selectedIds.has(item.id));
  }, [visibleDraftItems, selectedIds]);

  // انتخاب یا لغو انتخاب همه پیش‌نویس‌ها
  const handleToggleSelectAllDrafts = useCallback(() => {
    if (isAllDraftsSelected) {
      setSelectedIds(new Set());
    } else {
      const nextSet = new Set(selectedIds);
      visibleDraftItems.forEach((item) => nextSet.add(item.id));
      setSelectedIds(nextSet);
    }
  }, [isAllDraftsSelected, visibleDraftItems, selectedIds]);

  // انتخاب تک سطر پیش‌نویس
  const handleToggleSelectItem = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // تایید نهایی تک سند
  const handleSingleApprove = useCallback(async (tx) => {
    if (!canApprove) {
      alert(language === 'fa' ? 'شما دسترسی لازم برای تایید نهایی را ندارید.' : 'دەسەڵاتت نییە.');
      return;
    }

    setApprovingId(tx.id);
    try {
      const tableName = tx.tableName || (tx.type === 'inflow' ? 'treasuryIncomes' : 'payments');
      await approveRecord(tableName, tx.id);
      
      setSelectedIds((prev) => {
        if (prev.has(tx.id)) {
          const next = new Set(prev);
          next.delete(tx.id);
          return next;
        }
        return prev;
      });

      setFeedbackMsg({
        type: 'success',
        text: language === 'fa' 
          ? `سند «${tx.title}» با موفقیت توسط ${user?.name || 'مدیر سیستم'} تایید نهایی شد.` 
          : 'بەڵگەنامە پەسەند کرا.'
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      console.error('Single approval error:', err);
      alert(err.message || 'خطا در تایید نهایی سند');
    } finally {
      setApprovingId(null);
    }
  }, [canApprove, language, approveRecord, user]);

  // تایید نهایی گروهی اسناد انتخابی
  const handleBatchApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!canApprove) {
      alert(language === 'fa' ? 'شما دسترسی لازم برای تایید گروهی را ندارید.' : 'دەسەڵاتت نییە.');
      return;
    }

    setIsBatchApproving(true);
    try {
      const itemsToApprove = [];
      selectedIds.forEach((id) => {
        const found = ledgerItems.find((item) => item.id === id);
        if (found) {
          itemsToApprove.push({
            tableName: found.tableName || (found.type === 'inflow' ? 'treasuryIncomes' : 'payments'),
            recordId: found.id
          });
        }
      });

      await batchApproveRecords(itemsToApprove);
      const approvedCount = itemsToApprove.length;
      setSelectedIds(new Set());

      setFeedbackMsg({
        type: 'success',
        text: language === 'fa' 
          ? `تعداد ${approvedCount} سند پیش‌نویس با موفقیت تایید نهایی شدند.` 
          : `${approvedCount} بەڵگەنامە پەسەند کران.`
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      console.error('Batch approval error:', err);
      alert(err.message || 'خطا در تایید گروهی اسناد');
    } finally {
      setIsBatchApproving(false);
    }
  }, [selectedIds, canApprove, language, ledgerItems, batchApproveRecords]);

  // حذف تک سند پیش‌نویس / موقت
  const handleConfirmDeleteSingle = useCallback(async () => {
    if (!documentToDelete || !onDeleteDraftItem) return;
    setIsDeleting(true);
    try {
      await onDeleteDraftItem(documentToDelete);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(documentToDelete.id);
        if (documentToDelete.transferId) {
          next.delete(`${documentToDelete.transferId}_in`);
          next.delete(`${documentToDelete.transferId}_out`);
        }
        return next;
      });
      setFeedbackMsg({
        type: 'success',
        text: language === 'fa' 
          ? `سند «${documentToDelete.title || documentToDelete.id}» با موفقیت حذف شد.` 
          : 'بەڵگەنامەی کاتی سڕایەوە.'
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
      setDocumentToDelete(null);
    } catch (err) {
      console.error('Delete draft item error:', err);
      alert(err.message || 'خطا در حذف سند موقت');
    } finally {
      setIsDeleting(false);
    }
  }, [documentToDelete, onDeleteDraftItem, language]);

  // حذف گروهی اسناد موقت / پیش‌نویس
  const handleConfirmBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0 || !onBatchDeleteDraftItems) return;
    setIsDeleting(true);
    try {
      const itemsToDelete = [];
      selectedIds.forEach((id) => {
        const found = ledgerItems.find((item) => item.id === id);
        if (found && found.status !== 'approved') {
          itemsToDelete.push(found);
        }
      });
      await onBatchDeleteDraftItems(itemsToDelete);
      const count = itemsToDelete.length;
      setSelectedIds(new Set());
      setIsBatchDeleteModalOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: language === 'fa' 
          ? `تعداد ${count} سند موقت با موفقیت حذف شدند.` 
          : `${count} بەڵگەنامەی کاتی سڕانەوە.`
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      console.error('Batch delete draft error:', err);
      alert(err.message || 'خطا در حذف گروهی اسناد موقت');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, ledgerItems, onBatchDeleteDraftItems, language]);

  // خروجی اکسل از دفتر کل
  const handleExportExcel = useCallback(() => {
    if (ledgerItems.length === 0) {
      alert(language === 'fa' ? 'هیچ تراکنشی برای صدور فایل اکسل یافت نشد.' : 'هیچ مامەڵەیەک نییە.');
      return;
    }

    const rows = ledgerItems.map((item, idx) => ({
      'ردیف': idx + 1,
      'تاریخ': item.rawDate,
      'نوع تراکنش': item.type === 'inflow' ? 'ورودی (+)' : 'خروجی (-)',
      'دسته‌بندی': item.categoryLabel,
      'مبلغ تراکنش': item.amount,
      'واحد پول': currency,
      'موجودی پس از تراکنش': item.runningBalance,
      'حساب': item.accountName || (item.accountType === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
      'عنوان و طرف‌حساب': item.title,
      'وضعیت تایید': item.status === 'approved' 
        ? `تایید نهایی (${item.approvedBy || 'مدیر سیستم'})` 
        : 'پیش‌نویس موقت',
      'تاریخ تایید': item.approvedAt || '',
      'اصلاحیه خورده': item.isAmended ? 'بله' : 'خیر',
      'مبلغ اولیه': item.originalAmount !== undefined ? item.originalAmount : item.amount,
      'دلیل اصلاحیه': item.amendmentReason || '',
      'توضیحات': item.description || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'GeneralLedger');
    const fileName = `KarSync_General_Ledger_${projectName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [ledgerItems, currency, language, projectName]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      {/* هدر دفتر کل */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
            <TableIcon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {language === 'fa' ? 'دفتر کل و اسناد مالی' : 'دەفتەری گشتی مامەڵە دارایییەکان'}
              </h2>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                {ledgerItems.length} {language === 'fa' ? 'تراکنش' : 'مامەڵە'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'fa' 
                ? 'نمای یکپارچه اسناد مالی، تسویه‌حساب‌ها، جریان نقدینگی با قابلیت تایید نهایی و صدور اصلاحیه' 
                : 'ڕیزبەندی هەموو مامەڵەکانی سندوق بەپێی بەروار'}
            </p>
          </div>
        </div>

        {/* دکمه‌های کنترل و خروجی */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isFilterOpen || dateFilterMode !== 'all' || categoryFilter !== 'all' || accountTypeFilter !== 'all'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'فیلترها' : 'فلتەرەکان'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'خروجی اکسل' : 'هەناردەی ئێکسڵ'}</span>
          </button>
        </div>
      </div>

      {/* تب‌های دسترسی سریع به وضعیت تایید اسناد (با زبان طراحی یکدست Navbar Liquid Glass) */}
      <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2 overflow-x-auto">
        {[
          {
            id: 'all',
            label: language === 'fa' ? 'همه اسناد' : 'هەموو',
            icon: Layers,
            count: ledgerStats?.total || 0
          },
          {
            id: 'draft',
            label: language === 'fa' ? 'اسناد موقت' : 'ڕەشنووسەکان',
            icon: Clock,
            count: ledgerStats?.draft || 0
          },
          {
            id: 'approved',
            label: language === 'fa' ? 'تایید نهایی' : 'پەسەندکراو',
            icon: ShieldCheck,
            count: ledgerStats?.approved || 0
          },
          {
            id: 'amended',
            label: language === 'fa' ? 'اصلاحیه‌ها' : 'دەستکاریکراوەکان',
            icon: History,
            count: ledgerStats?.amended || 0
          }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = approvalStatusFilter === tab.id;
          return (
            <div key={tab.id} className="relative group">
              <button
                type="button"
                onClick={() => setApprovalStatusFilter?.(tab.id)}
                className={`relative p-2.5 rounded-2xl transition-all duration-200 flex items-center gap-2 ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25 scale-105 font-bold border border-sky-400/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-5 h-5 transition-transform group-hover:scale-110 shrink-0" />
                
                {/* نمایش نام فقط در تب فعال */}
                {isActive && (
                  <span className="text-xs font-bold px-1 whitespace-nowrap animate-in fade-in duration-200">
                    {tab.label}
                  </span>
                )}

                {/* شمارنده وضعیت */}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full leading-none transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {tab.count}
                </span>

                {/* نقطه نشانگر فعال */}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs"></span>
                )}
              </button>

              {/* تولتیپ در حالت غیرفعال */}
              {!isActive && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {tab.label}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* پیام بازخورد موقت */}
      {feedbackMsg && (
        <div className={`p-3 px-5 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-b border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-b border-rose-500/20'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* نوار عملیات گروهی (تایید یا حذف گروهی اسناد موقت) */}
      {selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm text-white">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black">
                {language === 'fa' 
                  ? `تعداد ${selectedIds.size} سند پیش‌نویس انتخاب شد` 
                  : `${selectedIds.size} بەڵگەنامە دیاریکراوە`}
              </p>
              <p className="text-[11px] text-emerald-100">
                {language === 'fa' 
                  ? `امکان تایید نهایی رسمی یا حذف گروهی اسناد موقت انتخابی وجود دارد.` 
                  : 'دەتوانیت پەسەندیان بکەیت یان بەکۆمەڵ بیسڕیتەوە'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isBatchApproving || isDeleting}
              onClick={handleBatchApprove}
              className="px-4 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60"
            >
              {isBatchApproving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                  <span>{language === 'fa' ? 'در حال تایید...' : 'پەسەند دەکرێت...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>{language === 'fa' ? `تایید نهایی (${selectedIds.size})` : `پەسەندکردنی کۆمەڵ`}</span>
                </>
              )}
            </button>

            {onBatchDeleteDraftItems && (
              <button
                type="button"
                disabled={isBatchApproving || isDeleting}
                onClick={() => setIsBatchDeleteModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60"
                title="حذف گروهی اسناد موقت انتخاب شده"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>{language === 'fa' ? `حذف گروهی (${selectedIds.size})` : `سڕینەوەی کۆمەڵ`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={isBatchApproving || isDeleting}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors disabled:opacity-50"
            >
              {language === 'fa' ? 'لغو انتخاب‌ها' : 'پەشیمانبوونەوە'}
            </button>
          </div>
        </div>
      )}

      {/* پنل فیلترها و جستجو */}
      {(isFilterOpen || dateFilterMode !== 'all' || categoryFilter !== 'all' || accountTypeFilter !== 'all') && (
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs animate-in slide-in-from-top-2 duration-150">
          {/* فیلتر زمانی */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              <Calendar className="w-3 h-3 inline ml-1" />
              <span>{language === 'fa' ? 'بازه زمانی' : 'ماوەی کات'}</span>
            </label>
            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value)}
              className="w-full h-9 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">{language === 'fa' ? 'همه زمان‌ها (از ابتدا)' : 'هەموو کاتێک'}</option>
              <option value="this_month">{language === 'fa' ? 'این ماه (جاری)' : 'ئەم مانگە'}</option>
              <option value="last_month">{language === 'fa' ? 'ماه گذشته' : 'مانگی پێشوو'}</option>
              <option value="custom">{language === 'fa' ? 'بازه سفارشی...' : 'دیاریکراو...'}</option>
            </select>
          </div>

          {/* فیلتر دسته‌بندی */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              <Tag className="w-3 h-3 inline ml-1" />
              <span>{language === 'fa' ? 'دسته‌بندی تراکنش' : 'جۆری مامەڵە'}</span>
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">{language === 'fa' ? 'همه دسته‌بندی‌ها' : 'هەموو جۆرەکان'}</option>
              <option value="petty_cash">{language === 'fa' ? 'شارژ تنخواه و واریزی‌ها' : 'داهات و تەنخوا'}</option>
              <option value="worker_settlement">{language === 'fa' ? 'تسویه دستمزد پرسنل' : 'تەسویەی کرێکاران'}</option>
              <option value="advance_payment">{language === 'fa' ? 'مساعده پرداختی' : 'مساعدە'}</option>
              <option value="workshop_expense">{language === 'fa' ? 'هزینه کارگاه (فاکتورها)' : 'خەرجی کارگە'}</option>
            </select>
          </div>

          {/* فیلتر نوع حساب */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              <CreditCard className="w-3 h-3 inline ml-1" />
              <span>{language === 'fa' ? 'حساب مبدا/مقصد' : 'حیساب'}</span>
            </label>
            <select
              value={accountTypeFilter}
              onChange={(e) => setAccountTypeFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">{language === 'fa' ? 'همه حساب‌ها (نقد و بانک)' : 'هەموو حیسابەکان'}</option>
              <option value="cash">{language === 'fa' ? 'تمام صندوق‌های نقدی' : 'سندوقی کاش'}</option>
              <option value="bank">{language === 'fa' ? 'تمام کارت‌ها و بانک‌ها' : 'حیسابی بانک'}</option>
              {financialAccounts.length > 0 && (
                <optgroup label={language === 'fa' ? 'حساب‌های اختصاصی کارگاه' : 'حیسابە تایبەتەکان'}>
                  {financialAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.type === 'bank' ? '💳 ' : '🪙 '}
                      {acc.name}
                      {acc.isDefault ? ' ★' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* فیلتر جستجو متنی */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              <Search className="w-3 h-3 inline ml-1" />
              <span>{language === 'fa' ? 'جستجو در تراکنش‌ها' : 'گەڕان'}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="عنوان، طرف‌حساب، مبلغ..."
                className="w-full h-9 ps-8 pe-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* بازه سفارشی در صورت انتخاب */}
          {dateFilterMode === 'custom' && (
            <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-slate-200/60 dark:border-slate-700 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">از تاریخ:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">تا تاریخ:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* جدول داده‌های دفتر کل */}
      <div className="overflow-x-auto">
        {ledgerItems.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 flex items-center justify-center mb-3">
              <TableIcon className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {language === 'fa' ? 'هیچ تراکنشی مطابق با فیلترهای جاری یافت نشد' : 'هیچ مامەڵەیەک نەدۆزرایەوە'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {language === 'fa' 
                ? 'فیلترهای وضعیت یا دسته‌بندی را تغییر دهید، یا تراکنش‌های مالی و هزینه‌ها را ثبت نمایید.' 
                : 'فلتەرەکان پاک بکەرەوە.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                {/* چک‌باکس انتخاب گروهی */}
                <th className="py-3 px-3 w-10 text-center">
                  {visibleDraftItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleToggleSelectAllDrafts}
                      className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                      title={isAllDraftsSelected ? 'لغو انتخاب همه پیش‌نویس‌ها' : 'انتخاب همه اسناد پیش‌نویس جهت تایید گروهی'}
                    >
                      {isAllDraftsSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">#</span>
                  )}
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">{language === 'fa' ? 'تاریخ' : 'بەروار'}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{language === 'fa' ? 'نوع تراکنش' : 'جۆر'}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{language === 'fa' ? 'دسته‌بندی' : 'پۆلێن'}</th>
                <th className="py-3 px-3.5 font-mono whitespace-nowrap">{language === 'fa' ? 'مبلغ سند' : 'بڕە پارە'}</th>
                <th className="py-3 px-3.5 font-mono whitespace-nowrap">{language === 'fa' ? 'موجودی پس از تراکنش' : 'باڵانسی دواتر'}</th>
                <th className="py-3 px-3.5">{language === 'fa' ? 'عنوان و طرف‌حساب' : 'تێبینی'}</th>
                <th className="py-3 px-3.5 whitespace-nowrap text-center">{language === 'fa' ? 'وضعیت سند و تایید' : 'دۆخی پەسەندکردن'}</th>
                <th className="py-3 px-3.5 w-32 text-center whitespace-nowrap">{language === 'fa' ? 'عملیات سند' : 'کردار'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {ledgerItems.map((tx, idx) => {
                const isInflow = tx.type === 'inflow';
                const isPositiveBalance = tx.runningBalance >= 0;
                const isDraft = tx.status !== 'approved';
                const isSelected = selectedIds.has(tx.id);
                const isCurrentlyApproving = approvingId === tx.id;

                // استایل دسته‌بندی
                let categoryBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                if (tx.category === 'petty_cash') {
                  categoryBadgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
                } else if (tx.category === 'worker_settlement') {
                  categoryBadgeClass = 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
                } else if (tx.category === 'advance_payment') {
                  categoryBadgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
                } else if (tx.category === 'workshop_expense') {
                  categoryBadgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
                }

                return (
                  <tr 
                    key={tx.id + '_' + idx}
                    className={`transition-colors ${
                      isSelected 
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30' 
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    {/* چک‌باکس انتخاب یا شماره ردیف */}
                    <td className="py-3 px-3 text-center">
                      {isDraft ? (
                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(tx.id)}
                          className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="انتخاب جهت تایید گروهی"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">{idx + 1}</span>
                      )}
                    </td>

                    {/* تاریخ */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                      {tx.rawDate}
                    </td>

                    {/* نوع تراکنش: ورودی یا خروجی */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {isInflow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                          <span>{language === 'fa' ? 'ورودی (+)' : 'داهات (+)'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          <ArrowUpRight className="w-3 h-3 text-rose-500" />
                          <span>{language === 'fa' ? 'خروجی (-)' : 'خەرجی (-)'}</span>
                        </span>
                      )}
                    </td>

                    {/* دسته‌بندی */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${categoryBadgeClass}`}>
                        {tx.categoryLabel}
                      </span>
                    </td>

                    {/* مبلغ تراکنش */}
                    <td className={`py-3 px-3.5 whitespace-nowrap font-mono font-bold ${
                      isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      <div className="flex flex-col">
                        <span>{isInflow ? '+' : '-'}{formatCurrency(tx.amount, currency, language)}</span>
                        {tx.isAmended && tx.originalAmount !== undefined && (
                          <span className="text-[10px] text-slate-400 line-through">
                            {formatCurrency(tx.originalAmount, currency, language)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* موجودی پس از تراکنش (Running Balance) */}
                    <td className={`py-3 px-3.5 whitespace-nowrap font-mono font-bold ${
                      isPositiveBalance ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatCurrency(tx.runningBalance, currency, language)}
                    </td>

                    {/* عنوان و توضیحات */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2 max-w-md">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {tx.title}
                        </span>
                        {tx.accountName && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                            {tx.accountType === 'bank' ? (
                              <CreditCard className="w-2.5 h-2.5 text-sky-500" />
                            ) : (
                              <Coins className="w-2.5 h-2.5 text-amber-500" />
                            )}
                            <span className="truncate max-w-[110px]">{tx.accountName}</span>
                          </span>
                        )}
                      </div>
                      {tx.description && (
                        <div className="text-[11px] text-slate-400 max-w-sm truncate mt-0.5">
                          {tx.description}
                        </div>
                      )}
                      {tx.isAmended && tx.amendmentReason && (
                        <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 flex items-center gap-1">
                          <span>📝 دلیل اصلاحیه:</span>
                          <span className="truncate max-w-xs">{tx.amendmentReason}</span>
                        </div>
                      )}
                    </td>

                    {/* وضعیت تایید دو مرحله‌ای (با درج نام تایید کننده) */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <VerificationBadge 
                        status={tx.status} 
                        approvedBy={tx.approvedBy} 
                        approvedAt={tx.approvedAt} 
                        isAmended={tx.isAmended}
                        showDetails={true}
                        language={language}
                      />
                    </td>

                    {/* عملیات سند: تایید نهایی / حذف موقت / صدور اصلاحیه */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {isDraft ? (
                          <>
                            {/* دکمه تایید نهایی برای اسناد پیش‌نویس */}
                            <button
                              type="button"
                              disabled={isCurrentlyApproving || isDeleting}
                              onClick={() => handleSingleApprove(tx)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                              title="تایید نهایی این سند با نام مدیر جاری"
                            >
                              {isCurrentlyApproving ? (
                                <span className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>{language === 'fa' ? 'تایید نهایی' : 'پەسەندکردن'}</span>
                            </button>

                            {/* دکمه حذف برای سند موقت */}
                            {onDeleteDraftItem && (
                              <button
                                type="button"
                                disabled={isCurrentlyApproving || isDeleting}
                                onClick={() => setDocumentToDelete(tx)}
                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition-all active:scale-95 disabled:opacity-50"
                                title={language === 'fa' ? 'حذف این سند موقت' : 'سڕینەوەی ئەم بەڵگەنامە کاتییە'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          /* دکمه‌های صدور اصلاحیه و مشاهده سابقه برای اسناد تایید شده */
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setAmendmentModalTx(tx)}
                              className="px-2 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                              title="صدور سند اصلاحیه و تعدیل مبلغ"
                            >
                              <FileEdit className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>{language === 'fa' ? 'اصلاحیه' : 'دەستکاری'}</span>
                            </button>

                            {tx.isAmended && (
                              <button
                                type="button"
                                onClick={() => setHistoryModalTx(tx)}
                                className="p-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                                title="مشاهده سوابق و تاریخچه اصلاحیه"
                              >
                                <History className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* مودال صدور اصلاحیه سند تایید نهایی شده */}
      {amendmentModalTx && (
        <IssueAmendmentModal
          tx={amendmentModalTx}
          currency={currency}
          language={language}
          onClose={() => setAmendmentModalTx(null)}
          onSave={async (amendmentData) => {
            try {
              const tableName = amendmentModalTx.tableName || (amendmentModalTx.type === 'inflow' ? 'treasuryIncomes' : 'payments');
              await amendRecord(tableName, amendmentModalTx.id, amendmentData);
              setAmendmentModalTx(null);
              setFeedbackMsg({
                type: 'success',
                text: language === 'fa' 
                  ? `اصلاحیه برای سند «${amendmentModalTx.title}» با موفقیت ثبت شد.` 
                  : 'دەستکاری بە سەرکەوتوویی تۆمار کرا.'
              });
              setTimeout(() => setFeedbackMsg(null), 3500);
            } catch (err) {
              console.error('Amendment failed:', err);
              alert(err.message || 'خطا در ثبت سند اصلاحیه');
            }
          }}
        />
      )}

      {/* مودال مشاهده تاریخچه و سوابق اصلاحیه */}
      {historyModalTx && (
        <AmendmentHistoryModal
          tx={historyModalTx}
          currency={currency}
          language={language}
          onClose={() => setHistoryModalTx(null)}
        />
      )}

      {/* مودال تایید حذف تک سند موقت */}
      {documentToDelete && (
        <DeleteDraftConfirmModal
          tx={documentToDelete}
          currency={currency}
          language={language}
          isDeleting={isDeleting}
          onClose={() => setDocumentToDelete(null)}
          onConfirm={handleConfirmDeleteSingle}
        />
      )}

      {/* مودال تایید حذف گروهی اسناد موقت */}
      {isBatchDeleteModalOpen && (
        <BatchDeleteDraftConfirmModal
          count={selectedIds.size}
          language={language}
          isDeleting={isDeleting}
          onClose={() => setIsBatchDeleteModalOpen(false)}
          onConfirm={handleConfirmBatchDelete}
        />
      )}
    </div>
  );
}

/**
 * مودال صدور سند اصلاحیه برای سند تایید نهایی شده
 */
function IssueAmendmentModal({ tx, currency, language, onClose, onSave }) {
  const [amount, setAmount] = useState(String(tx.amount || 0));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState(tx.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert(language === 'fa' ? 'لطفاً دلیل صدور اصلاحیه را قید نمایید (الزامی است).' : 'تکایە هۆکاری دەستکاری دیاری بکە.');
      return;
    }

    const numAmount = Number(String(amount).replace(/,/g, ''));
    if (isNaN(numAmount) || numAmount < 0) {
      alert(language === 'fa' ? 'مبلغ وارد شده معتبر نیست.' : 'بڕە پارەکە دروست نییە.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        amount: numAmount,
        reason: reason.trim(),
        notes: notes.trim()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* هدر */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {language === 'fa' ? 'صدور اصلاحیه سند تایید نهایی' : 'تۆماری دەستکاری بەڵگەنامە'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'fa' ? 'تعدیل مشخصات یا مبلغ سند با حفظ تاریخچه حسابداری' : 'دەستکاریکردنی بەڵگەنامە'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه و فرم */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs">
          {/* باکس مشخصات سند جاری */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">سند اولیه:</span>
              <span className="font-bold text-slate-900 dark:text-white">{tx.title}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">تاریخ و دسته‌بندی:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{tx.rawDate} - {tx.categoryLabel}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700 pt-2">
              <span className="text-slate-500 font-medium">مبلغ فعلی سند:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white text-sm">
                {formatCurrency(tx.amount, currency, language)}
              </span>
            </div>
          </div>

          {/* فیلد مبلغ اصلاح شده جدید */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'fa' ? 'مبلغ جدید سند (پس از اصلاح)' : 'بڕە پارەی نوێ'}
            </label>
            <input
              type="text"
              required
              value={formatAmount(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/,/g, ''))}
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              placeholder="0"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {language === 'fa' 
                ? 'در صورت نیاز به تغییر مبلغ سند، مقدار جدید را وارد نمایید.' 
                : 'بڕی نوێ دیاری بکە.'}
            </p>
          </div>

          {/* فیلد دلیل اصلاحیه (الزامی) */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'fa' ? 'دلیل صدور اصلاحیه (الزامی)' : 'هۆکاری دەستکاری (پێویستە)'}
              <span className="text-rose-500 mr-1">*</span>
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={language === 'fa' ? 'مثال: اصلاح اشتباه ثبتی / تعدیل ساعت کارکرد / تخفیف فاکتور' : 'هۆکار'}
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* فیلد توضیحات تکمیلی */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'fa' ? 'توضیحات تکمیلی (اختیاری)' : 'تێبینی'}
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'fa' ? 'توضیحات اضافی در صورت نیاز...' : 'تێبینی...'}
              className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* دکمه‌های اقدام */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors"
            >
              {language === 'fa' ? 'انصراف' : 'پەشیمانبوونەوە'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{language === 'fa' ? 'در حال ثبت...' : 'تۆمار دەکرێت...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{language === 'fa' ? 'ثبت و صدور اصلاحیه' : 'تۆمارکردنی دەستکاری'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * مودال مشاهده سوابق و تاریخچه اصلاحیه‌های یک سند
 */
function AmendmentHistoryModal({ tx, currency, language, onClose }) {
  const historyList = Array.isArray(tx.amendmentHistory) ? tx.amendmentHistory : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* هدر */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {language === 'fa' ? 'تاریخچه و سوابق اصلاحیه سند' : 'مێژووی دەستکاری'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tx.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* لیست تاریخچه‌ها */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 text-xs">
          {/* خلاصه مبالغ */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">مبلغ اولیه سند:</span>
              <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(tx.originalAmount !== undefined ? tx.originalAmount : tx.amount, currency, language)}
              </span>
            </div>
            <div className="text-end">
              <span className="text-[11px] text-slate-400 block">مبلغ فعلی نهایی:</span>
              <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                {formatCurrency(tx.amount, currency, language)}
              </span>
            </div>
          </div>

          {historyList.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              <p>{language === 'fa' ? 'سابقه‌ای در تاریخچه ثبت نشده است.' : 'هیچ مێژوویەک نییە.'}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'لیست تغییرات و اصلاحیه‌های اعمال شده:' : 'گۆڕانکارییەکان:'}
              </h4>
              {historyList.map((entry, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/20 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-purple-700 dark:text-purple-300">
                      اصلاحیه #{idx + 1}
                    </span>
                    <span className="font-mono text-slate-400">
                      {entry.amendedAt ? entry.amendedAt.slice(0, 16).replace('T', ' ') : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono font-bold text-xs">
                    <span className="text-slate-500 line-through">
                      {formatCurrency(entry.previousAmount, currency, language)}
                    </span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-purple-700 dark:text-purple-300">
                      {formatCurrency(entry.newAmount, currency, language)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="font-bold">دلیل:</span> {entry.reason}
                  </div>
                  {entry.notes && (
                    <div className="text-[10px] text-slate-400">
                      <span className="font-bold">توضیحات:</span> {entry.notes}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-purple-100 dark:border-purple-900/40">
                    توسط: <span className="font-medium text-slate-600 dark:text-slate-300">{entry.amendedBy || 'مدیر سیستم'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * مودال تایید حذف سند موقت (پیش‌نویس)
 */
function DeleteDraftConfirmModal({ tx, currency, language, isDeleting, onClose, onConfirm }) {
  if (!tx) return null;
  const isRtl = language === 'fa' || language === 'ku';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* هدر مودال */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">
                {language === 'fa' ? 'حذف سند موقت' : 'سڕینەوەی بەڵگەنامەی کاتی'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'fa' ? 'حذف قطعی سند پیش‌نویس از سیستم حسابداری' : 'سڕینەوەی یەکجاری لە سیستەم'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوای خلاصه سند */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">
                {language === 'fa' ? 'عنوان / شرح سند:' : 'ناونیشان:'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
                {tx.title || 'سند مالی'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">
                {language === 'fa' ? 'سرفصل / دسته‌بندی:' : 'جۆر:'}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {tx.categoryLabel || '-'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">
                {language === 'fa' ? 'حساب یا صندوق:' : 'حیساب:'}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {tx.accountName || '-'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">
                {language === 'fa' ? 'تاریخ ثبت:' : 'بەروار:'}
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {tx.rawDate || '-'}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300 font-bold">
                {language === 'fa' ? 'مبلغ سند:' : 'بڕ:'}
              </span>
              <span className={`font-mono font-black text-sm ${tx.type === 'inflow' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {tx.type === 'inflow' ? '+' : '-'}{formatCurrency(tx.amount, currency, language)}
              </span>
            </div>
          </div>

          {/* پیام هشدار */}
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {language === 'fa' 
                ? 'این سند هنوز تایید نهایی نشده است. با حذف آن، رکورد به صورت کامل حذف شده و اثر مالی آن از موجودی حساب کسر یا برگشت داده می‌شود.' 
                : 'ئەم بەڵگەنامەیە هێشتا پەسەند نەکراوە. بە سڕینەوەی، بڕەکەی لە باڵانس دەگەڕێتەوە.'}
            </p>
          </div>
        </div>

        {/* دکمه‌های اقدام */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all disabled:opacity-50"
          >
            {language === 'fa' ? 'انصراف' : 'پەشیمانبوونەوە'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{language === 'fa' ? 'در حال حذف...' : 'سڕینەوە...'}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{language === 'fa' ? 'حذف قطعی سند' : 'سڕینەوە'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * مودال تایید حذف گروهی اسناد موقت
 */
function BatchDeleteDraftConfirmModal({ count, language, isDeleting, onClose, onConfirm }) {
  const isRtl = language === 'fa' || language === 'ku';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">
                {language === 'fa' ? 'حذف گروهی اسناد موقت' : 'سڕینەوەی کۆمەڵی بەڵگەنامەکان'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'fa' ? `تعداد ${count} سند پیش‌نویس جهت حذف انتخاب شده است` : `${count} بەڵگەنامە دیاریکراوە`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {language === 'fa' 
              ? `آیا از حذف کامل ${count} سند موقت/پیش‌نویس انتخاب شده مطمئن هستید؟` 
              : `ئایا دڵنیایت لە سڕینەوەی ئەم ${count} بەڵگەنامەیە؟`}
          </p>

          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {language === 'fa' 
                ? 'فقط اسناد موقت حذف خواهند شد (اسناد تایید نهایی شده مصون هستند). با انجام این کار، موجودی حساب‌ها و صندوق‌ها به‌صورت خودکار بازتنظیم می‌گردد.' 
                : 'تەنها بەڵگەنامە کاتییەکان دەسڕدرێنەوە. باڵانسی حیسابەکان خۆکارانە چاک دەکرێن.'}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all disabled:opacity-50"
          >
            {language === 'fa' ? 'انصراف' : 'پەشیمانبوونەوە'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{language === 'fa' ? 'در حال حذف...' : 'سڕینەوە...'}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{language === 'fa' ? `حذف ${count} سند موقت` : `سڕینەوەی ${count}`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GeneralLedgerTable;
