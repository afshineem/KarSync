import React, { useState, useMemo } from 'react';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { AddEditIncomeModal } from './AddEditIncomeModal';
import { 
  ArrowDownLeft, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CreditCard, 
  Coins, 
  Calendar, 
  User, 
  FileText,
  AlertTriangle,
  ChevronDown,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { VerificationBadge } from '../common/VerificationBadge';
import { useTwoStageApproval } from '../../hooks/useTwoStageApproval';

/**
 * IncomeManagementSection
 * بخش مدیریت ورودی‌ها و تنخواه
 * شامل دکمه «ثبت واریزی جدید»، جدول و لیست واریزی‌ها با قابلیت ویرایش و حذف
 */
// Scoped dictionary for IncomeManagementSection
const COPY = {
  fa: {
    alertApproved: 'این سند واریزی تایید شده و غیرقابل حذف یا ویرایش است.',
    title: 'مدیریت ورودی‌ها و تنخواه دریافتی',
    itemsCount: (cnt) => `${cnt} مورد`,
    subtitle: 'ثبت و مدیریت مبالغ شارژ تنخواه، تزریق نقدینگی و واریزی‌های کارفرما',
    btnNewIncome: 'ثبت واریزی جدید',
    searchPh: 'جستجو در عنوان، واریزکننده یا مبلغ...',
    totalFilteredLabel: 'مجموع موارد نمایش‌داده‌شده:',
    emptyTitle: 'هنوز هیچ واریزی یا شارژ تنخواهی ثبت نشده است',
    emptySubtitle: 'با ثبت اولین واریزی، تراز نقدینگی و موجودی صندوق‌ها به صورت خودکار به‌روزرسانی می‌شود.',
    btnFirstIncome: 'ثبت اولین واریزی تنخواه',
    thDate: 'تاریخ واریز',
    thTitlePayer: 'عنوان و واریزکننده',
    thAccount: 'حساب واریزی',
    thAmount: 'مبلغ واریزی',
    thStatus: 'وضعیت تایید',
    thDesc: 'توضیحات',
    thActions: 'عملیات',
    approveTooltip: 'تایید نهایی سند واریزی',
    btnApprove: 'تایید',
    lockedTooltip: 'این سند تایید شده و غیرقابل تغییر است.',
    lockedLabel: 'قفل تایید',
    editTooltip: 'ویرایش واریزی',
    deleteTooltip: 'حذف واریزی',
    deleteConfirmTitle: 'آیا از حذف این واریزی مطمئن هستید؟',
    cancel: 'انصراف',
    confirmDelete: 'حذف قطعی'
  },
  ku: {
    alertApproved: 'ئەم بەڵگەنامەیە پەسەندکراوە و ناسڕدرێتەوە یان دەستکاری ناکرێت.',
    title: 'بەڕێوەبردنی داهات و تەنخوا',
    itemsCount: (cnt) => `${cnt} تۆمار`,
    subtitle: 'تۆمارکردن و بەڕێوەبردنی تەنخوا، نەختینە و داهاتی کارگە',
    btnNewIncome: 'تۆماری داهاتی نوێ',
    searchPh: 'گەڕان لە ناونیشان، داهاتدەر یان بڕە پارە...',
    totalFilteredLabel: 'کۆی داهاتی فلتەرکراو:',
    emptyTitle: 'هێشتا هیچ داهات یان تەنخوایەک تۆمار نەکراوە',
    emptySubtitle: 'بە تۆمارکردنی یەکەم داهات، باڵانسی سندوقەکان بە شێوەی خۆکار نوێ دەبێتەوە.',
    btnFirstIncome: 'تۆمارکردنی یەکەم داهات',
    thDate: 'بەرواری داهات',
    thTitlePayer: 'بابەت و پارەدەر',
    thAccount: 'حیساب',
    thAmount: 'بڕە پارە',
    thStatus: 'دۆخی پەسەندکردن',
    thDesc: 'تێبینی',
    thActions: 'کردارەکان',
    approveTooltip: 'پەسەندکردنی کۆتایی بەڵگەنامە',
    btnApprove: 'پەسەندکردن',
    lockedTooltip: 'ئەم بەڵگەنامەیە قفڵ کراوە و ناتوانرێت دەستکاری بکرێت.',
    lockedLabel: 'قفڵکراو',
    editTooltip: 'دەستکاری',
    deleteTooltip: 'سڕینەوە',
    deleteConfirmTitle: 'دڵنیایت لە سڕینەوەی ئەم داهاتە؟',
    cancel: 'پاشگەزبوونەوە',
    confirmDelete: 'سڕینەوە'
  },
  en: {
    alertApproved: 'This deposit document is approved and locked from edits or deletion.',
    title: 'Inflows & Petty Cash Management',
    itemsCount: (cnt) => `${cnt} items`,
    subtitle: 'Record & manage petty cash refills, liquidity injections, and employer deposits',
    btnNewIncome: 'New Deposit / Inflow',
    searchPh: 'Search title, depositor, or amount...',
    totalFilteredLabel: 'Total Displayed Inflows:',
    emptyTitle: 'No deposits or petty cash recharges recorded yet',
    emptySubtitle: 'Recording deposits automatically updates treasury balances and cash drawers.',
    btnFirstIncome: 'Record First Deposit',
    thDate: 'Deposit Date',
    thTitlePayer: 'Title & Depositor',
    thAccount: 'Target Account',
    thAmount: 'Deposit Amount',
    thStatus: 'Approval Status',
    thDesc: 'Description',
    thActions: 'Actions',
    approveTooltip: 'Final Approval of Deposit',
    btnApprove: 'Approve',
    lockedTooltip: 'This document is approved and locked.',
    lockedLabel: 'Approved & Locked',
    editTooltip: 'Edit Deposit',
    deleteTooltip: 'Delete Deposit',
    deleteConfirmTitle: 'Are you sure you want to delete this deposit?',
    cancel: 'Cancel',
    confirmDelete: 'Delete Permanently'
  }
};

export function IncomeManagementSection({ 
  incomes = [], 
  onAddIncome, 
  onUpdateIncome, 
  onDeleteIncome, 
  currency = 'IQD',
  language = 'fa' 
}) {
  const txt = COPY[language] || COPY.fa;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [incomeToDelete, setIncomeToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { canApprove, canModifyRecord, approveRecord } = useTwoStageApproval();
  const [approvingIncomeId, setApprovingIncomeId] = useState(null);

  const handleApproveIncome = async (inc) => {
    try {
      setApprovingIncomeId(inc.id);
      await approveRecord('treasuryIncomes', inc.id);
    } catch (err) {
      alert(err.message || 'خطا در تایید واریزی');
    } finally {
      setApprovingIncomeId(null);
    }
  };

  // فیلتر جستجو در واریزی‌ها
  const filteredIncomes = useMemo(() => {
    if (!searchQuery.trim()) return incomes;
    const q = searchQuery.toLowerCase();
    return incomes.filter((inc) => {
      const matchTitle = (inc.title || '').toLowerCase().includes(q);
      const matchDesc = (inc.description || '').toLowerCase().includes(q);
      const matchPayer = (inc.payer || '').toLowerCase().includes(q);
      const matchAmt = String(inc.amount).includes(q);
      return matchTitle || matchDesc || matchPayer || matchAmt;
    });
  }, [incomes, searchQuery]);

  // مجموع مبالغ واریزی‌های فیلتر شده
  const totalFilteredAmount = useMemo(() => {
    return filteredIncomes.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [filteredIncomes]);

  const handleConfirmDelete = async () => {
    if (!incomeToDelete) return;
    if (!canModifyRecord(incomeToDelete)) {
      alert(txt.alertApproved);
      setIncomeToDelete(null);
      return;
    }
    try {
      await onDeleteIncome(incomeToDelete.id);
      setIncomeToDelete(null);
    } catch (err) {
      alert(err.message || 'خطا در حذف واریزی');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* هدر بخش و دکمه ثبت واریزی */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/60 dark:border-sky-800/60">
            <ArrowDownLeft className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {txt.title}
              </h2>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                {txt.itemsCount(incomes.length)}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {txt.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* دکمه ثبت واریزی جدید */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{txt.btnNewIncome}</span>
          </button>
        </div>
      </div>

      {/* نوار جستجو و خلاصه سریع */}
      <div className="p-3 sm:px-5 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={txt.searchPh}
            className="w-full h-9 ps-8 pe-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
          <Search className="w-4 h-4 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            {txt.totalFilteredLabel}
          </span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
            {formatCurrency(totalFilteredAmount, currency, language)}
          </span>
        </div>
      </div>

      {/* جدول واریزی‌ها */}
      <div className="overflow-x-auto">
        {filteredIncomes.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 flex items-center justify-center mb-3">
              <ArrowDownLeft className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {txt.emptyTitle}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {txt.emptySubtitle}
            </p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{txt.btnFirstIncome}</span>
            </button>
          </div>
        ) : (
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                <th className="py-3 px-3.5 w-12 text-center">#</th>
                <th className="py-3 px-3.5">{txt.thDate}</th>
                <th className="py-3 px-3.5">{txt.thTitlePayer}</th>
                <th className="py-3 px-3.5">{txt.thAccount}</th>
                <th className="py-3 px-3.5 font-mono">{txt.thAmount}</th>
                <th className="py-3 px-3.5 whitespace-nowrap text-center">{txt.thStatus}</th>
                <th className="py-3 px-3.5">{txt.thDesc}</th>
                <th className="py-3 px-3.5 w-28 text-center">{txt.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredIncomes.map((inc, idx) => {
                const isBank = inc.accountType === 'bank';
                return (
                  <tr 
                    key={inc.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                      {inc.date || inc.createdAt?.slice(0, 10)}
                    </td>

                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {inc.title}
                      </div>
                      {inc.payer && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          <span>{inc.payer}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {isBank ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                          <CreditCard className="w-3 h-3" />
                          <span>کارت بانکی</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                          <Coins className="w-3 h-3" />
                          <span>صندوق نقدی</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(inc.amount, currency, language)}
                    </td>

                    {/* وضعیت تایید دو مرحله‌ای */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <VerificationBadge 
                        status={inc.status} 
                        approvedBy={inc.approvedBy} 
                        approvedAt={inc.approvedAt} 
                      />
                    </td>

                    <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {inc.description || '-'}
                    </td>

                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {inc.status !== 'approved' && canApprove && (
                          <button
                            type="button"
                            onClick={() => handleApproveIncome(inc)}
                            disabled={approvingIncomeId === inc.id}
                            title={txt.approveTooltip}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-1 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{txt.btnApprove}</span>
                          </button>
                        )}

                        {inc.status === 'approved' ? (
                          <div 
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg flex items-center gap-1 text-[10px] font-medium border border-slate-200/60 dark:border-slate-700/60"
                            title={txt.lockedTooltip}
                          >
                            <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              {txt.lockedLabel}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                            <button
                              type="button"
                              onClick={() => setEditingIncome(inc)}
                              title={txt.editTooltip}
                              className="p-1 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIncomeToDelete(inc)}
                              title={txt.deleteTooltip}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* مودال افزودن واریزی */}
      {isAddModalOpen && (
        <AddEditIncomeModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={onAddIncome}
          currency={currency}
          language={language}
        />
      )}

      {/* مودال ویرایش واریزی */}
      {editingIncome && (
        <AddEditIncomeModal
          isOpen={Boolean(editingIncome)}
          onClose={() => setEditingIncome(null)}
          onSave={(data) => onUpdateIncome(editingIncome.id, data)}
          initialData={editingIncome}
          currency={currency}
          language={language}
        />
      )}

      {/* دیالوگ تأیید حذف */}
      {incomeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {txt.deleteConfirmTitle}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              {incomeToDelete.title} - {formatCurrency(incomeToDelete.amount, currency, language)}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIncomeToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {txt.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
              >
                {txt.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
