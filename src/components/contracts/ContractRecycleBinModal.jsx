import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import {
  isContractLockedFromDeletion,
  restoreContract,
  archiveContract,
  unarchiveContract,
  permanentDeleteContract,
  restoreAllContracts,
  emptyContractsTrash
} from '../../services/contractService';
import { formatDateDisplay } from '../../utils/formatters';
import {
  Trash2,
  Archive,
  RotateCcw,
  X,
  Search,
  AlertTriangle,
  FileSignature,
  FileCheck2,
  CheckCircle2,
  Lock,
  Layers,
  Building2,
  Clock,
  Sparkles,
  Eye,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

const COPY = {
  fa: {
    modalTitle: 'سطل بازیافت و آرشیو قراردادها',
    modalSubtitle: 'مدیریت قراردادهای حذف‌شده، بازیابی سوابق مالی و بایگانی پیمان‌ها',
    trashTab: 'سطل بازیافت (حذف‌شده‌ها)',
    archiveTab: 'بایگانی و آرشیو قراردادها',
    searchPlaceholder: 'جستجو در شماره، موضوع یا طرف‌حساب قرارداد...',
    itemsFound: 'مورد',
    restoreAll: 'بازیابی همه',
    emptyTrash: 'خالی کردن سطل بازیافت',
    emptyTrashDesc: 'سطل بازیافت قراردادها خالی است.',
    emptyArchiveDesc: 'هیچ قراردادی در بخش بایگانی وجود ندارد.',
    emptyTrashSub: 'قراردادهایی که حذف موقت شوند به اینجا منتقل شده و در صورت عدم وجود اسناد مالی قطعی قابل پاکسازی هستند.',
    emptyArchiveSub: 'قراردادهای تسویه‌شده، اتمام‌یافته یا پروژه‌های گذشته را می‌توانید بدون حذف، در آرشیو نگهداری فرمایید.',
    deletedAtLabel: 'تاریخ حذف:',
    archivedAtLabel: 'تاریخ بایگانی:',
    restoreBtn: 'بازیابی قرارداد',
    restoreSuccess: 'قرارداد با موفقیت بازیابی شد.',
    restoreAllSuccess: 'قراردادها با موفقیت بازیابی شدند.',
    permanentDeleteBtn: 'حذف دائمی',
    permanentDeleteSuccess: 'قرارداد برای همیشه پاک شد.',
    unarchiveBtn: 'خروج از بایگانی',
    unarchiveSuccess: 'قرارداد از بایگانی خارج و به لیست فعال بازگشت.',
    viewDetails: 'مشاهده جزئیات',
    closeBtn: 'بستن',
    hasFinancialRecords: 'دارای سند مالی قطعی (تسویه‌شده)',
    needsRestoreWarning: 'این قرارداد دارای گردش مالی یا اسناد پرداخت در حسابداری است؛ حذف قطعی آن غیرمجاز بوده و باید بازیابی شود.',
    lockedPermanentDeleteTip: 'حذف قطعی این رکورد به جهت حفظ انضباط اسناد مالی قفل است.',
    confirmDeleteTitle: 'آیا از حذف دائمی این قرارداد اطمینان دارید؟',
    confirmDeleteDesc: 'این قرارداد به طور کامل پاک خواهد شد و قابل بازگشت نیست. (تنها قراردادهای فاقد سند مالی قطعی قابل حذف هستند)',
    confirmEmptyTrashTitle: 'آیا از تخلیه سطل بازیافت اطمینان دارید؟',
    confirmEmptyTrashDesc: 'قراردادهای فاقد سند مالی پاکسازی می‌شوند. رکوردهای دارای سند مالی قطعی جهت حفظ سلامت دفاتر حسابداری حفظ خواهند شد.',
    cancelBtn: 'انصراف',
    confirmDeleteConfirm: 'حذف قطعی',
    confirmEmptyConfirm: 'تخلیه امن سطل',
    contractNumber: 'شماره پیمان:',
    counterparty: 'طرف‌حساب:',
    amount: 'ارزش قرارداد:',
    settled: 'تسویه‌شده'
  },
  ku: {
    modalTitle: 'سەبەتەی سڕینەوە و ئەرشیفی گرێبەستەکان',
    modalSubtitle: 'بەڕێوەبردنی گرێبەستە سڕاوەکان، گێڕانەوەی بەڵگەنامە داراییەکان و پاراستنی عەقدەکان',
    trashTab: 'سەبەتەی سڕینەوە (سڕاوەکان)',
    archiveTab: 'ئەرشیف و پارێزراوەکان',
    searchPlaceholder: 'گەڕان لە ژمارە، ناونیشان یان لایەنی گرێبەست...',
    itemsFound: 'دانە',
    restoreAll: 'گێڕانەوەی هەمووان',
    emptyTrash: 'بەتاڵکردنی سەبەتە',
    emptyTrashDesc: 'سەبەتەی سڕینەوەی گرێبەستەکان بەتاڵە.',
    emptyArchiveDesc: 'هیچ گرێبەستێک لە بەشی ئەرشیفدا نییە.',
    emptyTrashSub: 'ئەو گرێبەستانەی بە کاتی سڕاونەتەوە لێرە دەمێننەوە و دەتوانیت بییانگێڕیتەوە.',
    emptyArchiveSub: 'گرێبەستە تەواوبووەکان یان تسویەکراوەکان دەتوانیت لە ئەرشیفدا بپارێزیت بەبێ سڕینەوە.',
    deletedAtLabel: 'بەرواری سڕینەوە:',
    archivedAtLabel: 'بەرواری ئەرشیف:',
    restoreBtn: 'گێڕانەوەی گرێبەست',
    restoreSuccess: 'گرێبەست بە سەرکەوتوویی گەڕێندرایەوە.',
    restoreAllSuccess: 'گرێبەستەکان بە سەرکەوتوویی گەڕێندرانەوە.',
    permanentDeleteBtn: 'سڕینەوەی یەکجاری',
    permanentDeleteSuccess: 'گرێبەست بۆ هەمیشە سڕایەوە.',
    unarchiveBtn: 'دەرهێنان لە ئەرشیف',
    unarchiveSuccess: 'گرێبەست لە ئەرشیف دەرهێندرا و گەڕایەوە لیستی چالاک.',
    viewDetails: 'بینینی وردەکاری',
    closeBtn: 'داخستن',
    hasFinancialRecords: 'خاوەنی بەڵگەنامەی دارایی قطعییە (تسویەکراو)',
    needsRestoreWarning: 'ئەم گرێبەستە سەنەدی دارایی و پارەدانی هەیە لە ژمێریاریدا؛ سڕینەوەی قەدەغەیە و پێویستە بگەڕێندرێتەوە.',
    lockedPermanentDeleteTip: 'سڕینەوەی یەکجاری قفڵ کراوە بۆ پاراستنی حیسابات.',
    confirmDeleteTitle: 'ئایا دڵنیایت لە سڕینەوەی یەکجاریی ئەم گرێبەستە؟',
    confirmDeleteDesc: 'ئەم عەقدە بە یەکجاری دەسڕدرێتەوە و ناگەڕێتەوە.',
    confirmEmptyTrashTitle: 'ئایا دڵنیایت لە بەتاڵکردنی سەبەتە؟',
    confirmEmptyTrashDesc: 'تەنها ئەو گرێبەستانە دەسڕدرێنەوە کە سەنەدی ژمێریارییان نییە.',
    cancelBtn: 'پەشیمانبوونەوە',
    confirmDeleteConfirm: 'سڕینەوەی یەکجاری',
    confirmEmptyConfirm: 'بەتاڵکردنی سەبەتە',
    contractNumber: 'ژمارەی عەقد:',
    counterparty: 'لایەنی گرێبەست:',
    amount: 'بەهای گرێبەست:',
    settled: 'تسویەکراو'
  },
  en: {
    modalTitle: 'Contracts Recycle Bin & Archive',
    modalSubtitle: 'Manage deleted contracts, restore financial records, and organize archived agreements',
    trashTab: 'Recycle Bin (Deleted)',
    archiveTab: 'Archived Contracts',
    searchPlaceholder: 'Search by number, title, or contractor name...',
    itemsFound: 'contracts',
    restoreAll: 'Restore All',
    emptyTrash: 'Empty Trash',
    emptyTrashDesc: 'The contracts recycle bin is empty.',
    emptyArchiveDesc: 'No contracts found in the archive.',
    emptyTrashSub: 'Contracts moved to trash can be restored back to active state at any time.',
    emptyArchiveSub: 'Completed or settled agreements can be safely kept in archive without deleting financial history.',
    deletedAtLabel: 'Deleted At:',
    archivedAtLabel: 'Archived At:',
    restoreBtn: 'Restore Contract',
    restoreSuccess: 'Contract successfully restored.',
    restoreAllSuccess: 'All eligible contracts restored.',
    permanentDeleteBtn: 'Delete Permanently',
    permanentDeleteSuccess: 'Contract permanently deleted.',
    unarchiveBtn: 'Unarchive Contract',
    unarchiveSuccess: 'Contract restored to active contracts.',
    viewDetails: 'View Details',
    closeBtn: 'Close',
    hasFinancialRecords: 'Has Final Vouchers (Settled)',
    needsRestoreWarning: 'This contract contains posted accounting vouchers or payments; permanent deletion is blocked to protect ledger integrity. Please restore it.',
    lockedPermanentDeleteTip: 'Permanent deletion is locked to protect accounting vouchers.',
    confirmDeleteTitle: 'Permanently delete this contract?',
    confirmDeleteDesc: 'This contract will be completely removed and cannot be undone. Only unvouchered contracts can be purged.',
    confirmEmptyTrashTitle: 'Empty contracts recycle bin?',
    confirmEmptyTrashDesc: 'Only unvouchered contracts will be purged. Contracts with financial vouchers will be preserved.',
    cancelBtn: 'Cancel',
    confirmDeleteConfirm: 'Delete Permanently',
    confirmEmptyConfirm: 'Empty Trash',
    contractNumber: 'Contract No:',
    counterparty: 'Counterparty:',
    amount: 'Contract Value:',
    settled: 'Settled'
  }
};

export default function ContractRecycleBinModal({
  isOpen,
  onClose,
  trashContracts = [],
  archivedContracts = [],
  onSelectContractForDetail
}) {
  const { language, direction, calendarType, numberFormat } = useLanguage();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';
  const copy = COPY[language] || COPY.fa;

  const [activeTab, setActiveTab] = useState('trash'); // 'trash' | 'archive'
  const [searchQuery, setSearchQuery] = useState('');
  const [contractToPermanentDelete, setContractToPermanentDelete] = useState(null);
  const [isConfirmingEmptyTrash, setIsConfirmingEmptyTrash] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filtered active list
  const currentList = useMemo(() => {
    const source = activeTab === 'trash' ? trashContracts : archivedContracts;
    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase().trim();
    return source.filter((c) => {
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchNumber = (c.contractNumber || '').toLowerCase().includes(q);
      const matchParty = (c.counterpartyName || '').toLowerCase().includes(q);
      return matchTitle || matchNumber || matchParty;
    });
  }, [activeTab, trashContracts, archivedContracts, searchQuery]);

  const showNotification = (msg, type = 'success') => {
    setActionNotice({ msg, type });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleRestore = async (contractId) => {
    setIsProcessing(true);
    try {
      await restoreContract(contractId);
      showNotification(copy.restoreSuccess, 'success');
    } catch (err) {
      showNotification(err.message || 'Error restoring contract', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnarchive = async (contractId) => {
    setIsProcessing(true);
    try {
      await unarchiveContract(contractId);
      showNotification(copy.unarchiveSuccess, 'success');
    } catch (err) {
      showNotification(err.message || 'Error unarchiving contract', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreAll = async () => {
    setIsProcessing(true);
    try {
      const count = await restoreAllContracts(currentProject?.id);
      showNotification(`${count} ${copy.restoreAllSuccess}`, 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!contractToPermanentDelete) return;
    setIsProcessing(true);
    try {
      await permanentDeleteContract(contractToPermanentDelete.id);
      setContractToPermanentDelete(null);
      showNotification(copy.permanentDeleteSuccess, 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      const res = await emptyContractsTrash(currentProject?.id);
      setIsConfirmingEmptyTrash(false);
      showNotification(
        `${res.deletedCount} ${copy.permanentDeleteSuccess}${res.preservedCount > 0 ? ` (${res.preservedCount} قرارداد دارای سند مالی حفظ شدند)` : ''}`,
        'success'
      );
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !p-0 z-[110] w-screen h-[100dvh] max-h-[100dvh] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden
          bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl backdrop-saturate-200
          border border-white/70 dark:border-white/10
          shadow-[0_25px_60px_rgba(0,0,0,0.22),inset_0_1px_1px_0_rgba(255,255,255,0.8)]
          dark:shadow-[0_25px_60px_rgba(0,0,0,0.7),inset_0_1px_1px_0_rgba(255,255,255,0.1)]"
      >
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              {activeTab === 'trash' ? <Trash2 className="w-5 h-5 stroke-[2.2]" /> : <Archive className="w-5 h-5 stroke-[2.2]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight">
                  {copy.modalTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {currentList.length} {copy.itemsFound}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {copy.modalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={copy.closeBtn}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Notice Banner */}
        {actionNotice && (
          <div
            className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 border-b animate-in fade-in duration-200 ${
              actionNotice.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {actionNotice.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{actionNotice.msg}</span>
          </div>
        )}

        {/* Tabs & Controls */}
        <div className="px-5 sm:px-7 py-3 border-b border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
          {/* Segmented Control */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/50 dark:border-slate-700/60 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('trash')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'trash'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{copy.trashTab}</span>
              {trashContracts.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'trash' ? 'bg-amber-700 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}>
                  {trashContracts.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>{copy.archiveTab}</span>
              {archivedContracts.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'archive' ? 'bg-primary-hover text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}>
                  {archivedContracts.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Box & Bulk Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                className="w-full ltr:pl-9 rtl:pr-9 py-2 px-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {activeTab === 'trash' && trashContracts.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRestoreAll}
                  disabled={isProcessing}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title={copy.restoreAll}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{copy.restoreAll}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingEmptyTrash(true)}
                  disabled={isProcessing}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title={copy.emptyTrash}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{copy.emptyTrash}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[60vh] space-y-3.5 custom-scrollbar">
          {currentList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-50/50 dark:bg-slate-950/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto">
                {activeTab === 'trash' ? <Trash2 className="w-7 h-7" /> : <Archive className="w-7 h-7" />}
              </div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'trash' ? copy.emptyTrashDesc : copy.emptyArchiveDesc}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {activeTab === 'trash' ? copy.emptyTrashSub : copy.emptyArchiveSub}
              </p>
            </div>
          ) : (
            currentList.map((contract) => {
              const isLocked = isContractLockedFromDeletion(contract);
              const settlements = Array.isArray(contract.settlements) ? contract.settlements : [];
              const finalAmount = contract.finalPayableAmount !== null && contract.finalPayableAmount !== undefined
                ? contract.finalPayableAmount
                : contract.totalEstimatedAmount;

              return (
                <div
                  key={contract.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Info & Badges */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {contract.contractNumber}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {contract.title}
                      </h4>
                      {isLocked && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center gap-1 shadow-xs">
                          <Lock className="w-3 h-3" />
                          <span>{copy.hasFinancialRecords}</span>
                        </span>
                      )}
                      {settlements.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {settlements.length} صورت‌وضعیت
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div>
                        <span className="font-semibold text-slate-400">{copy.counterparty} </span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{contract.counterpartyName || '---'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400">{copy.amount} </span>
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200" dir="ltr">
                          {Number(finalAmount || 0).toLocaleString()} {currency}
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="font-semibold text-slate-400">
                          {activeTab === 'trash' ? copy.deletedAtLabel : copy.archivedAtLabel}{' '}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-300">
                          {formatDateDisplay(
                            activeTab === 'trash' ? contract.deletedAt : contract.archivedAt,
                            language,
                            numberFormat,
                            calendarType
                          )}
                        </span>
                      </div>
                    </div>

                    {activeTab === 'trash' && isLocked && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <span>{copy.needsRestoreWarning}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {activeTab === 'trash' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRestore(contract.id)}
                          disabled={isProcessing}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{copy.restoreBtn}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isLocked) {
                              showNotification(copy.lockedPermanentDeleteTip, 'error');
                            } else {
                              setContractToPermanentDelete(contract);
                            }
                          }}
                          disabled={isProcessing || isLocked}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isLocked
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-pointer active:scale-95'
                          }`}
                          title={isLocked ? copy.lockedPermanentDeleteTip : copy.permanentDeleteBtn}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{copy.permanentDeleteBtn}</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {onSelectContractForDetail && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onSelectContractForDetail(contract);
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{copy.viewDetails}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUnarchive(contract.id)}
                          disabled={isProcessing}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{copy.unarchiveBtn}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>سامانه امنیت دفاتر مالی و جلوگیری از حذف تصادفی تعهدات پیمانکاری</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {copy.closeBtn}
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Permanent Delete */}
      {contractToPermanentDelete && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {copy.confirmDeleteTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {copy.confirmDeleteDesc}
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-2">
                {contractToPermanentDelete.contractNumber} • {contractToPermanentDelete.title}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContractToPermanentDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {copy.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {copy.confirmDeleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Empty Trash */}
      {isConfirmingEmptyTrash && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {copy.confirmEmptyTrashTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {copy.confirmEmptyTrashDesc}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingEmptyTrash(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {copy.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {copy.confirmEmptyConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
