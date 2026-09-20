import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, Banknote, FileText, Hash, Check } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../db/db';
import { pushPaymentsLive, recordPendingPaymentDeletion } from '../services/realtimeSync';

export function EditPaymentModal({ isOpen, onClose, payment, currency }) {
  const { t } = useLanguage();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      setFeedback({ type: 'error', message: t('pleaseEnterValidAmount') || 'لطفاً مبلغ معتبری وارد کنید' });
      return;
    }

    if (!date) {
      setFeedback({ type: 'error', message: t('dateIsRequired') || 'وارد کردن تاریخ الزامی است' });
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
      setFeedback({ type: 'error', message: err.message || 'خطا در ویرایش' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(t('moveToTrash') || 'انتقال به سطل آشغال؟')) {
      try {
        setIsSubmitting(true);
        await db.payments.update(payment.id, {
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        pushPaymentsLive().catch(() => {});
        onClose();
      } catch (err) {
        console.error('Error moving payment to trash:', err);
        setFeedback({ type: 'error', message: err.message || 'خطا در حذف' });
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white relative"
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
              <h3 className="font-black text-sm">{t('editTransaction') || 'ویرایش تراکنش'}</h3>
              <p className="text-[10px] text-slate-500">{payment.workerName} • {payment.type === 'settlement' ? (t('settlementType') || 'تسویه حساب') : (t('advanceType') || 'علی‌الحساب')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
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
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('date') || 'تاریخ'}</label>
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
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('time') || 'زمان'}</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('amount')} ({currency})</label>
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
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('referenceNumber') || 'شماره پیگیری'}</label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono"
                placeholder="مثلا: 123456"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('description') || 'شرح'}</label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 resize-none h-20"
                placeholder={t('notesPlaceholder') || 'توضیحات اضافی...'}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="p-2.5 text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 rounded-xl transition-colors flex-shrink-0"
              title={t('delete')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-md shadow-sky-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? '...' : (t('save') || 'ثبت تغییرات')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
