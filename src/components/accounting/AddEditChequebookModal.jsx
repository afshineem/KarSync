import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { createChequebook, updateChequebook } from '../../services/chequeService';
import {
  X,
  BookOpen,
  Landmark,
  Hash,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileCheck2
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export function AddEditChequebookModal({
  isOpen,
  onClose,
  bookToEdit = null,
  language: propLanguage
}) {
  const { t, language: ctxLang, direction } = useLanguage();
  const lang = propLanguage || ctxLang || 'fa';
  const { user } = useAuth();
  const { currentProject } = useProject();

  const [bankAccountId, setBankAccountId] = useState(bookToEdit?.bankAccountId || '');
  const [bankName, setBankName] = useState(bookToEdit?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(bookToEdit?.accountNumber || '');
  const [sayadSeries, setSayadSeries] = useState(bookToEdit?.sayadSeries || '');
  const [startSerial, setStartSerial] = useState(bookToEdit?.startSerial ? String(bookToEdit.startSerial) : '1001');
  const [totalLeaves, setTotalLeaves] = useState(bookToEdit?.totalLeaves ? String(bookToEdit.totalLeaves) : '25');
  const [notes, setNotes] = useState(bookToEdit?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live query for bank accounts
  const financialAccounts = useLiveQuery(
    async () => {
      if (!db.financialAccounts) return [];
      const list = await db.financialAccounts.toArray();
      return list.filter((a) => !a.deletedAt && a.isActive && a.type === 'bank');
    },
    []
  ) || [];

  if (!isOpen) return null;

  const handleBankChange = (accId) => {
    setBankAccountId(accId);
    const acc = financialAccounts.find((a) => a.id === accId);
    if (acc) {
      setBankName(acc.bankName || acc.name || '');
      setAccountNumber(acc.accountNumber || '');
    }
  };

  const leavesNum = Number(totalLeaves) || 25;
  const startNum = Number(startSerial) || 1;
  const endNum = startNum + leavesNum - 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!bankAccountId) {
      setErrorMsg('لطفاً حساب بانکی کارگاه را انتخاب کنید.');
      return;
    }

    if (startNum <= 0) {
      setErrorMsg('شماره سریال شروع نامعتبر است.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        projectId: currentProject?.id || 'prj_central',
        bankAccountId,
        bankName,
        accountNumber,
        sayadSeries: sayadSeries.trim(),
        startSerial: startNum,
        endSerial: endNum,
        totalLeaves: leavesNum,
        notes: notes.trim()
      };

      if (bookToEdit) {
        await updateChequebook(bookToEdit.id, payload);
      } else {
        await createChequebook(payload, user);
      }

      onClose();
    } catch (err) {
      console.error('[AddEditChequebookModal] Save error:', err);
      setErrorMsg(err.message || 'خطا در ثبت دسته‌چک');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
      dir={direction}
    >
      <div className="w-full max-w-lg rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center flex-shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {bookToEdit ? 'ویرایش دسته‌چک کارگاه' : 'تعریف دسته‌چک بانکی کارگاه'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                مدیریت برگه‌ها، شماره سریال‌ها و رصد صدور چک‌های کارگاه
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-slate-400" />
              <span>حساب بانکی کارگاه:</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => handleBankChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">--- انتخاب حساب بانکی ---</option>
              {financialAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} {acc.bankName ? `(${acc.bankName})` : ''} {acc.accountNumber ? `- ${acc.accountNumber}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                نام بانک و شعبه:
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="بانک ملت - مرکزی"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                سری / پیش‌شماره صیاد:
              </label>
              <input
                type="text"
                value={sayadSeries}
                onChange={(e) => setSayadSeries(e.target.value)}
                placeholder="مثال: الف/۸۴"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>سریال اولین برگه:</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={startSerial}
                onChange={(e) => setStartSerial(e.target.value)}
                placeholder="1001"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>تعداد برگ:</span>
              </label>
              <select
                value={totalLeaves}
                onChange={(e) => setTotalLeaves(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="10">۱۰ برگ</option>
                <option value="25">۲۵ برگ</option>
                <option value="50">۵۰ برگ</option>
                <option value="100">۱۰۰ برگ</option>
              </select>
            </div>
          </div>

          {/* Range Preview Badge */}
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center justify-between">
            <span>دامنه شماره برگه‌ها:</span>
            <span className="font-mono text-xs">
              از {startNum} تا {endNum} ({leavesNum} برگ)
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              یادداشت و توضیحات (اختیاری):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: دسته‌چک تحویل مهندس کارگاه جهت خرید مصالح..."
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              {t('cancel')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/25 active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت دسته‌چک'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
