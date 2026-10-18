import { logAuditAction } from "../services/auditLogger";
import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, Banknote, FileText, Hash, Check, Lock } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../db/db';
import { pushPaymentsLive, recordPendingPaymentDeletion, rollbackPaymentSettlement } from '../services/realtimeSync';

const COPY = {
  fa: {
    lockedApprovedError: 'این سند تایید نهایی شده و قفل است. طبق موازین مالیاتی، تغییر مستقیم آن مجاز نبوده و تعدیل تنها با صدور اصلاحیه در تب حسابداری امکان‌پذیر است.',
    cannotDeleteApproved: 'اسناد مالی تایید نهایی شده به دلیل قوانین مالیاتی غیرقابل حذف هستند.',
    validAmountError: 'لطفاً مبلغ معتبری وارد کنید',
    dateRequiredError: 'وارد کردن تاریخ الزامی است',
    editError: 'خطا در ویرایش',
    deleteError: 'خطا در حذف',
    moveToTrashConfirm: 'آیا از انتقال این سند پرداختی به سطل زباله اطمینان دارید؟',
    editTransaction: 'ویرایش تراکنش',
    settlementType: 'تسویه حساب',
    advanceType: 'علی‌الحساب',
    date: 'تاریخ',
    time: 'زمان',
    amount: 'مبلغ',
    referenceNumber: 'شماره پیگیری',
    refPlaceholder: 'مثلا: ۱۲۳۴۵۶',
    description: 'شرح',
    notesPlaceholder: 'توضیحات اضافی...',
    delete: 'حذف',
    saveChanges: 'ثبت تغییرات',
    saving: 'در حال ثبت...',
    lockedNotice: 'این سند تایید نهایی شده و قفل است. طبق موازین مالیاتی، حذف یا ویرایش مستقیم آن مجاز نبوده و تعدیل صرفاً از طریق صدور اصلاحیه در تب حسابداری امکان‌پذیر است.',
    approvedLockedBtn: 'سند تایید شده و غیرقابل تغییر',
    auditDeletePayment: 'حذف / ابطال سند پرداختی/تسویه'
  },
  ku: {
    lockedApprovedError: 'ئەم بەڵگەنامەیە پەسەندکراوی کۆتایییە و قفڵە. بەپێی ڕێساکانی باج، دەستکاریکردنی ڕاستەوخۆ ڕێگاپێنەدراوە و هەموارکردن تەنها لە ڕێگەی دەرهێنانی چاکسازی لە بەشی ژمێریاری دەکرێت.',
    cannotDeleteApproved: 'بەڵگەنامە دارایییە پەسەندکراوەکان بەهۆی یاساکانی باجەوە ناسڕدرێنەوە.',
    validAmountError: 'تکایە بڕێکی دروست بنووسە',
    dateRequiredError: 'دیاریکردنی بەروار پێویستە',
    editError: 'هەڵە لە دەستکاریکردن',
    deleteError: 'هەڵە لە سڕینەوە',
    moveToTrashConfirm: 'دڵنیایت لە گواستنەوەی ئەم بەڵگەنامەی پارەدانە بۆ تەنەکەی خۆڵ؟',
    editTransaction: 'دەستکاریکردنی مامەڵە',
    settlementType: 'پاکتاوی حیساب',
    advanceType: 'پێشەکی',
    date: 'بەروار',
    time: 'کات',
    amount: 'بڕ',
    referenceNumber: 'ژمارەی بەدواداچوون',
    refPlaceholder: 'نموونە: ١٢٣٤٥٦',
    description: 'ڕوونکردنەوە',
    notesPlaceholder: 'تێبینی زیاتر...',
    delete: 'سڕینەوە',
    saveChanges: 'پاشەکەوتکردنی گۆڕانکارییەکان',
    saving: 'تۆماردەکرێت...',
    lockedNotice: 'ئەم بەڵگەنامەیە پەسەندکراوی کۆتایییە و قفڵە. دەستکاریکردن یان سڕینەوەی ڕاستەوخۆ ڕێگاپێنەدراوە و تعدیل تەنها لە ڕێگەی دەرهێنانی چاکسازی لە بەشی ژمێریاری دەکرێت.',
    approvedLockedBtn: 'بەڵگەنامەکە پەسەندکراوە و ناگۆڕدرێت',
    auditDeletePayment: 'سڕینەوە / پووچەڵکردنەوەی بەڵگەنامەی پارەدان/پاکتاو'
  },
  en: {
    lockedApprovedError: 'This document is finalized and locked. Direct editing is not permitted under tax regulations; adjustments must be issued via amendments in Accounting.',
    cannotDeleteApproved: 'Finalized financial documents cannot be deleted due to tax regulations.',
    validAmountError: 'Please enter a valid amount',
    dateRequiredError: 'Date is required',
    editError: 'Error updating transaction',
    deleteError: 'Error deleting transaction',
    moveToTrashConfirm: 'Are you sure you want to move this payment record to trash?',
    editTransaction: 'Edit Transaction',
    settlementType: 'Settlement',
    advanceType: 'Advance',
    date: 'Date',
    time: 'Time',
    amount: 'Amount',
    referenceNumber: 'Reference Number',
    refPlaceholder: 'e.g. 123456',
    description: 'Description',
    notesPlaceholder: 'Additional notes...',
    delete: 'Delete',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    lockedNotice: 'This record is finalized and locked. Direct deletion or editing is prohibited; adjustments must be issued via amendments in Accounting.',
    approvedLockedBtn: 'Document approved & locked',
    auditDeletePayment: 'Delete / Void payment or settlement document'
  }
};

export function EditPaymentModal({ isOpen, onClose, payment, currency }) {
  const { t, language } = useLanguage();
  const c = COPY[language] || COPY.fa;
  const { currentProject } = useProject();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (isOpen && payment) {
      setDate(payment.date || '');
      setTime(payment.time || '');
      setAmount(String(payment.amount) || '');
      setReferenceNumber(payment.referenceNumber || '');
      setNotes(payment.notes || '');
      setFeedback({ type: '', message: '' });
    }
  }, [isOpen, payment]);

  if (!isOpen || !payment) return null;

  const isApproved = payment?.status === 'approved' || payment?.approval_status === 'approved';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (isApproved) {
      setFeedback({ type: 'error', message: c.lockedApprovedError });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      setFeedback({ type: 'error', message: c.validAmountError });
      return;
    }

    if (!date) {
      setFeedback({ type: 'error', message: c.dateRequiredError });
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedPayment = {
        ...payment,
        date,
        time,
        amount: numAmount,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        updatedAt: new Date().toISOString()
      };

      await db.payments.put(updatedPayment);
      pushPaymentsLive().catch(() => {});
      
      onClose();
    } catch (err) {
      console.error('Error updating payment:', err);
      setFeedback({ type: 'error', message: err.message || c.editError });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isApproved) {
      alert(c.cannotDeleteApproved);
      return;
    }
    if (window.confirm(c.moveToTrashConfirm)) {
      try {
        setIsSubmitting(true);
        await db.payments.update(payment.id, {
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        await rollbackPaymentSettlement(payment.id).catch(console.warn);
        pushPaymentsLive().catch(() => {});

        logAuditAction({
          actionType: 'DELETE_PAYMENT',
          entityType: 'payments',
          entityId: payment.id,
          projectId: payment.projectId,
          details: {
            description: `${c.auditDeletePayment}: ${payment.amount}`,
            amount: payment.amount
          }
        });

        onClose();
      } catch (err) {
        console.error('Error moving payment to trash:', err);
        setFeedback({ type: 'error', message: err.message || c.deleteError });
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex animate-in fade-in duration-150 flex items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white relative h-[100dvh] sm:h-auto sm:max-h-[85vh] flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              payment.type === 'settlement' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
            }`}>
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm">{c.editTransaction}</h3>
              <p className="text-[10px] text-slate-500">{payment.workerName} • {payment.type === 'settlement' ? c.settlementType : c.advanceType}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedback.message && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
          }`}>
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{c.date}</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                  required
                />
              </div>
            </div>
            <div className="w-1/3">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{c.time}</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{c.amount} ({currency})</label>
            <div className="relative">
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">{currency}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full ps-12 pe-3 py-2.5 text-base font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono text-end tracking-wider"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{c.referenceNumber}</label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono"
                placeholder={c.refPlaceholder}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{c.description}</label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 resize-none h-20"
                placeholder={c.notesPlaceholder}
              />
            </div>
          </div>

          {isApproved && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{c.lockedNotice}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            {!isApproved && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="p-2.5 text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 rounded-xl transition-colors flex-shrink-0 cursor-pointer"
                title={c.delete}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || isApproved}
              className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-md shadow-sky-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isApproved ? c.approvedLockedBtn : (isSubmitting ? c.saving : c.saveChanges)}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
