import React, { useState, useEffect, useMemo } from 'react';
import { db, generatePaymentId } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { pushPaymentsLive } from '../services/realtimeSync';
import { getTodayDateString, getCurrentYearMonth, formatAmount } from '../utils/formatters';
import { 
  CheckCircle2, 
  X, 
  User, 
  Calendar, 
  Coins, 
  FileText, 
  Hash, 
  Printer, 
  Check, 
  AlertCircle,
  Calculator,
  ArrowDownRight
} from 'lucide-react';

export function SettlementModal({ 
  isOpen, 
  onClose, 
  worker, 
  month = getCurrentYearMonth(),
  workerLogs = [],
  workerPayments = [],
  onSettlementComplete
}) {
  const { t, language } = useLanguage();

  // Financial calculations for this worker in this month
  const calculations = useMemo(() => {
    // 1. Gross earnings from attendance logs
    const grossEarnings = workerLogs
      .filter((l) => l.date && l.date.startsWith(month))
      .reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0);

    // 2. Previous advances already paid in this month
    const previousAdvances = workerPayments
      .filter((p) => p.month === month && p.type === 'advance')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // 3. Previous settlements in this month (if any)
    const previousSettlements = workerPayments
      .filter((p) => p.month === month && p.type === 'settlement')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const totalPaidSoFar = previousAdvances + previousSettlements;
    const balanceDue = Math.max(0, grossEarnings - totalPaidSoFar);

    return {
      grossEarnings,
      previousAdvances,
      previousSettlements,
      totalPaidSoFar,
      balanceDue
    };
  }, [workerLogs, workerPayments, month]);

  const [finalPaymentAmount, setFinalPaymentAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState(getTodayDateString());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [markAsSettled, setMarkAsSettled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [completedPayment, setCompletedPayment] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFinalPaymentAmount(calculations.balanceDue > 0 ? String(calculations.balanceDue) : '0');
      setSettlementDate(getTodayDateString());
      setReferenceNumber('');
      setNotes(`تسویه حساب حقوق ${month}`);
      setMarkAsSettled(true);
      setFeedback({ type: '', message: '' });
      setCompletedPayment(null);
    }
  }, [isOpen, calculations.balanceDue, month]);

  if (!isOpen || !worker) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const payAmount = Number(finalPaymentAmount);
    if (isNaN(payAmount) || payAmount < 0) {
      setFeedback({ type: 'error', message: 'مبلغ پرداختی نامعتبر است' });
      return;
    }

    setIsSubmitting(true);
    try {
      const remainingAfter = Math.max(0, calculations.balanceDue - payAmount);

      const settlementRecord = {
        id: generatePaymentId(),
        workerId: worker.id,
        month,
        date: settlementDate,
        type: 'settlement',
        amount: payAmount,
        calculatedEarnings: calculations.grossEarnings,
        previousAdvances: calculations.previousAdvances,
        remainingBalance: remainingAfter,
        status: markAsSettled ? 'settled' : (remainingAfter === 0 ? 'settled' : 'partial'),
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.payments.add(settlementRecord);
      pushPaymentsLive().catch(() => {});

      setCompletedPayment(settlementRecord);
      setFeedback({ type: 'success', message: t('settlementSuccessMsg') });

      if (onSettlementComplete) {
        onSettlementComplete(settlementRecord);
      }

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error saving settlement' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {t('settlementModalTitle')}
              </h3>
              <p className="text-xs text-slate-400">
                {worker.name} • {month}
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

        {/* Calculation Breakdown Card */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">{t('calculatedEarningsThisPeriod')}:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
              {formatAmount(calculations.grossEarnings)} دینار
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
            <span>(-) {t('previousAdvancesDeducted')}:</span>
            <span className="font-bold font-mono">
              {formatAmount(calculations.previousAdvances)} دینار
            </span>
          </div>

          {calculations.previousSettlements > 0 && (
            <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400">
              <span>(-) تسویه‌های قبلی همین ماه:</span>
              <span className="font-bold font-mono">
                {formatAmount(calculations.previousSettlements)} دینار
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-sm">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-sky-500" />
              <span>{t('netBalanceDue')}:</span>
            </span>
            <span className="font-black text-sky-600 dark:text-sky-400 font-mono text-base">
              {formatAmount(calculations.balanceDue)} دینار
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          
          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('finalPaymentAmount')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={finalPaymentAmount}
                  onChange={(e) => setFinalPaymentAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-600 dark:text-emerald-400 font-mono pe-14"
                />
                <span className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-xs font-bold text-slate-400">
                  دینار
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('settlementDate')}
              </label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Reference / Document Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('referenceNumber')}
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={t('referencePlaceholder')}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="2"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Mark as Settled Checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 cursor-pointer">
            <input
              type="checkbox"
              checked={markAsSettled}
              onChange={(e) => setMarkAsSettled(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              {t('markAsSettledCheckbox')}
            </span>
          </label>

          {/* Action Buttons */}
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
              disabled={isSubmitting}
              className="w-2/3 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : t('settleBtn')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
