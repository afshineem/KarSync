import React, { useState, useEffect, useMemo } from 'react';
import { db, generatePaymentId } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { pushPaymentsLive } from '../services/realtimeSync';
import { getTodayDateString, getCurrentYearMonth, formatAmount, roundCurrency, getCurrencySymbol } from '../utils/formatters';
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
  onSettlementComplete,
  arrearsList = [],
  onSelectWorker
}) {
  const { t, language } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';

  // Financial calculations for this worker: Prior months debt + Current month
  const calculations = useMemo(() => {
    // 1. Prior months (before this month)
    const priorGross = roundCurrency(workerLogs
      .filter((l) => l.date && l.date < month)
      .reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0), currency);

    const priorPaid = roundCurrency(workerPayments
      .filter((p) => (p.month && p.month < month) || (!p.month && p.date && p.date < month))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0), currency);

    const priorBalance = roundCurrency(Math.max(0, priorGross - priorPaid), currency); // > 0: workshop owes worker from past months

    // 2. Current selected month
    const currentMonthGross = roundCurrency(workerLogs
      .filter((l) => l.date && l.date.startsWith(month))
      .reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0), currency);

    const currentMonthAdvances = roundCurrency(workerPayments
      .filter((p) => (p.month === month || (!p.month && p.date && p.date.startsWith(month))) && p.type === 'advance')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0), currency);

    const currentMonthSettlements = roundCurrency(workerPayments
      .filter((p) => (p.month === month || (!p.month && p.date && p.date.startsWith(month))) && p.type === 'settlement')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0), currency);

    const currentMonthPaid = roundCurrency(currentMonthAdvances + currentMonthSettlements, currency);

    // 3. All-time cumulative
    const totalEarnings = roundCurrency(priorGross + currentMonthGross, currency);
    const totalPaid = roundCurrency(priorPaid + currentMonthPaid, currency);
    const totalCumulativeDebt = roundCurrency(Math.max(0, totalEarnings - totalPaid), currency);

    return {
      priorGross,
      priorPaid,
      priorBalance,
      currentMonthGross,
      currentMonthAdvances,
      currentMonthSettlements,
      currentMonthPaid,
      totalEarnings,
      totalPaid,
      totalCumulativeDebt
    };
  }, [workerLogs, workerPayments, month, currency]);

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
      setFinalPaymentAmount(calculations.totalCumulativeDebt > 0 ? String(calculations.totalCumulativeDebt) : '0');
      setSettlementDate(getTodayDateString());
      setReferenceNumber('');
      const defaultNote = language === 'en' 
        ? `Payroll settlement for ${month}` 
        : language === 'ku' 
          ? `تەسویەی حیساب بۆ مانگی ${month}` 
          : `تسویه حساب حقوق ${month}`;
      setNotes(defaultNote);
      setMarkAsSettled(true);
      setFeedback({ type: '', message: '' });
      setCompletedPayment(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !worker) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const payAmount = roundCurrency(Number(finalPaymentAmount), currency);
    if (isNaN(payAmount) || payAmount < 0) {
      setFeedback({ type: 'error', message: t('pleaseEnterValidAmount') });
      return;
    }

    setIsSubmitting(true);
    try {
      const remainingAfter = roundCurrency(Math.max(0, calculations.totalCumulativeDebt - payAmount), currency);
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const settlementRecord = {
        id: generatePaymentId(),
        projectId: currentProject?.id || 'prj_default_main',
        userId: user?.id || null,
        workerId: worker.id,
        workerName: worker.name,
        month: month,
        date: settlementDate,
        time: currentTime,
        amount: payAmount,
        currency: currency,
        type: 'settlement',
        status: markAsSettled ? 'settled' : 'partial',
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        remainingBalanceAfter: remainingAfter,
        grossEarningsCalculated: calculations.totalEarnings,
        priorBalanceDeducted: calculations.priorBalance,
        advancesDeducted: calculations.currentMonthAdvances,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      await db.payments.put(settlementRecord);
      pushPaymentsLive().catch(() => {});

      if (onSettlementComplete) {
        onSettlementComplete(settlementRecord);
      }

      onClose();
    } catch (err) {
      console.error('Settlement save error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Settlement save error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex no-print animate-in fade-in duration-150 flex items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white h-[100dvh] sm:h-auto sm:max-h-[85vh] flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
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

        {/* Workers With Arrears Selector */}
        {arrearsList.length > 0 && onSelectWorker && (
          <div className="mt-4 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('workersWithArrears') || 'پرسنل دارای معوقه / مانده:'}</label>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
              {arrearsList.map((arrWorker) => (
                <button
                  key={arrWorker.worker.id}
                  type="button"
                  onClick={() => onSelectWorker(arrWorker.worker)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                    worker.id === arrWorker.worker.id
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    <span>{arrWorker.worker.name}</span>
                    <span className="font-mono bg-white/50 dark:bg-black/20 px-1.5 rounded text-[10px]">
                      {arrWorker.netBalanceDue < 0 
                        ? `${formatAmount(Math.abs(arrWorker.netBalanceDue), currency)} (بدهکار)`
                        : `${formatAmount(arrWorker.netBalanceDue, currency)} (بستانکار)`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calculation Breakdown Card */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          
          {/* Prior Months Debt (if any) */}
          {calculations.priorBalance !== 0 && (
            <div className={`flex items-center justify-between text-xs ${
              calculations.priorBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              <span className="font-semibold">{t('priorBalanceDue')}:</span>
              <span className="font-bold font-mono">
                {calculations.priorBalance > 0 ? '+' : ''}{formatAmount(calculations.priorBalance, currency)} {getCurrencySymbol(currency, language)}
              </span>
            </div>
          )}

          {/* This Month's Gross Earnings */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">{t('thisMonthGross')} ({month}):</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
              {formatAmount(calculations.currentMonthGross, currency)} {getCurrencySymbol(currency, language)}
            </span>
          </div>

          {/* This Month's Advances */}
          {calculations.currentMonthAdvances > 0 && (
            <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
              <span>(-) {t('thisMonthAdvances')}:</span>
              <span className="font-bold font-mono">
                {formatAmount(calculations.currentMonthAdvances, currency)} {getCurrencySymbol(currency, language)}
              </span>
            </div>
          )}

          {/* Previous settlements in this month */}
          {calculations.currentMonthSettlements > 0 && (
            <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400">
              <span>(-) {t('previousSettlementsInMonth')}</span>
              <span className="font-bold font-mono">
                {formatAmount(calculations.currentMonthSettlements, currency)} {getCurrencySymbol(currency, language)}
              </span>
            </div>
          )}

          {/* Total Cumulative Debt */}
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-sm">
            <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-emerald-500" />
              <span>{t('totalCumulativeDebt')}:</span>
            </span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-base sm:text-lg">
              {formatAmount(calculations.totalCumulativeDebt, currency)} {getCurrencySymbol(currency, language)}
            </span>
          </div>
          
          <p className="text-[10px] text-slate-400 leading-tight">
            {t('cumulativeOutstandingNotice')}
          </p>
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
                  step={currency === 'IQD' ? '250' : '1'}
                  value={finalPaymentAmount}
                  onChange={(e) => setFinalPaymentAmount(e.target.value)}
                  onBlur={() => {
                    if (finalPaymentAmount !== '') {
                      setFinalPaymentAmount(String(roundCurrency(finalPaymentAmount, currency)));
                    }
                  }}
                  required
                  className="w-full px-3 py-2 text-sm font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-600 dark:text-emerald-400 font-mono pe-14"
                />
                <span className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-xs font-bold text-slate-400">
                  {getCurrencySymbol(currency, language)}
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
