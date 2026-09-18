import React, { useState, useEffect } from 'react';
import { db, generatePaymentId } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { pushPaymentsLive } from '../services/realtimeSync';
import { getTodayDateString, getCurrentYearMonth, formatAmount, roundIQD } from '../utils/formatters';
import { 
  Banknote, 
  X, 
  User, 
  Calendar, 
  Coins, 
  FileText, 
  Hash, 
  Check, 
  AlertCircle 
} from 'lucide-react';

export function AdvancePaymentModal({ 
  isOpen, 
  onClose, 
  workers = [], 
  targetWorkerId = null, 
  targetMonth = null 
}) {
  const { t, language } = useLanguage();

  const [workerId, setWorkerId] = useState(targetWorkerId || '');
  const [month, setMonth] = useState(targetMonth || getCurrentYearMonth());
  const [date, setDate] = useState(getTodayDateString());
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (isOpen) {
      setWorkerId(targetWorkerId || (workers[0]?.id || ''));
      setMonth(targetMonth || getCurrentYearMonth());
      setDate(getTodayDateString());
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      setFeedback({ type: '', message: '' });
    }
  }, [isOpen, targetWorkerId, targetMonth, workers]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const numAmount = roundIQD(Number(amount));
    if (!workerId) {
      setFeedback({ type: 'error', message: t('pleaseSelectWorker') });
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: 'error', message: t('pleaseEnterValidAmount') });
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const newPayment = {
        id: generatePaymentId(),
        workerId,
        month,
        date,
        time: currentTime,
        type: 'advance',
        amount: numAmount,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        status: 'partial',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      await db.payments.add(newPayment);
      pushPaymentsLive().catch(() => {});

      setFeedback({ type: 'success', message: t('advanceSuccessMsg') });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error saving advance' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedWorker = workers.find((w) => w.id === workerId);

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 sm:p-6 shadow-2xl my-auto animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {t('advanceModalTitle')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('advanceModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
          }`}>
            {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          
          {/* Worker Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('workerName')}
            </label>
            <div className="relative">
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
              >
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Month & Date Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('monthView')}
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('paymentDate')}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Amount in IQD */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('paymentAmount')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="250"
                step="250"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => {
                  if (amount !== '') {
                    setAmount(String(roundIQD(amount)));
                  }
                }}
                placeholder="25000"
                required
                className="w-full px-3.5 py-2.5 text-sm font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-amber-600 dark:text-amber-400 font-mono pe-14"
              />
              <span className="absolute inset-y-0 end-0 pe-3 flex items-center text-xs font-bold text-slate-400">
                {t('currencySymbol')}
              </span>
            </div>
            {Number(amount) > 0 && (
              <p className="mt-1 text-[11px] text-slate-400 font-mono">
                {formatAmount(Number(amount))} {t('currencyName')}
              </p>
            )}
          </div>

          {/* Reference / Receipt Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('referenceNumber')}
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={t('referencePlaceholder')}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Notes / Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="2"
              placeholder="شرح علت پرداخت، مساعده یا واریزی..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className="w-2/3 py-2.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-400 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Coins className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : t('addAdvanceBtn')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
