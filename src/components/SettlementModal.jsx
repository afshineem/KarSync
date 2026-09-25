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

  // Separate into unsettled vs settled
  const unsettledLogs = useMemo(() => {
    return (workerLogs || [])
      .filter((l) => !l.isSettled)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [workerLogs]);

  const unsettledPayments = useMemo(() => {
    return (workerPayments || [])
      .filter((p) => !p.isSettled && (p.type === 'advance' || p.type === 'Advance_Payment'))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [workerPayments]);

  // Financial calculations for this worker: Strictly based on unsettled epoch records
  const calculations = useMemo(() => {
    const grossEarnings = roundCurrency(
      unsettledLogs.reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0),
      currency
    );

    const advancesDeducted = roundCurrency(
      unsettledPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      currency
    );

    const totalCumulativeDebt = roundCurrency(Math.max(0, grossEarnings - advancesDeducted), currency);

    const effectiveDays = unsettledLogs.reduce(
      (sum, l) => sum + (l.type === 'half' ? 0.5 : l.type === 'hourly' ? 0 : 1),
      0
    );

    const otHours = unsettledLogs.reduce((sum, l) => sum + (Number(l.overtimeHours) || 0), 0);

    return {
      unsettledLogs,
      unsettledPayments,
      grossEarnings,
      advancesDeducted,
      totalCumulativeDebt,
      effectiveDays,
      otHours
    };
  }, [unsettledLogs, unsettledPayments, currency]);

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
        ? `Payroll settlement (${calculations.unsettledLogs.length} unsettled days)` 
        : language === 'ku' 
          ? `تەسویەی حیساب (${calculations.unsettledLogs.length} ڕۆژی کارکرد)` 
          : `تسویه حساب کارکرد (${calculations.unsettledLogs.length} روز کارکرد باز)`;
      setNotes(defaultNote);
      setMarkAsSettled(true);
      setFeedback({ type: '', message: '' });
      setCompletedPayment(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, calculations.totalCumulativeDebt, calculations.unsettledLogs.length]);

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
        isSettled: true,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        remainingBalanceAfter: remainingAfter,
        grossEarningsCalculated: calculations.grossEarnings,
        priorBalanceDeducted: 0,
        advancesDeducted: calculations.advancesDeducted,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      await db.payments.put(settlementRecord);

      // If marked as settled, mark all these unsettled logs and advances as settled
      if (markAsSettled) {
        const logsToSettle = calculations.unsettledLogs.filter(l => (l.date || '') <= settlementDate);
        if (logsToSettle.length > 0) {
          const updatedLogs = logsToSettle.map(l => ({
            ...l,
            isSettled: true,
            settlementReceiptId: settlementRecord.id,
            updatedAt: now.toISOString()
          }));
          await db.attendanceLogs.bulkPut(updatedLogs);
          pushPaymentsLive().catch(() => {});
        }

        const advancesToSettle = calculations.unsettledPayments.filter(p => (p.date || '') <= settlementDate);
        if (advancesToSettle.length > 0) {
          const updatedAdv = advancesToSettle.map(p => ({
            ...p,
            isSettled: true,
            settlementReceiptId: settlementRecord.id,
            updatedAt: now.toISOString()
          }));
          await db.payments.bulkPut(updatedAdv);
        }
      }

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
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-y-auto"
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
                {worker.name} • {t('unsettledOnly') || 'روزهای تسویه نشده'}
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

        {/* Calculation Breakdown Card: Strictly for Unsettled Days */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          
          {/* Unsettled Days Count & Effective Days */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-500" />
              <span>کارکرد جدید در انتظار تسویه:</span>
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
              {calculations.unsettledLogs.length} روز ({calculations.effectiveDays} روز کاری)
              {calculations.otHours > 0 && ` + ${calculations.otHours}h اضافه‌کاری`}
            </span>
          </div>

          {/* Gross Earnings for Unsettled Days */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">ناخالص کارکرد تسویه نشده:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
              {formatAmount(calculations.grossEarnings, currency)} {getCurrencySymbol(currency, language)}
            </span>
          </div>

          {/* Unsettled Advances Deduction */}
          {calculations.advancesDeducted > 0 && (
            <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
              <span>(-) مساعده‌های تسویه نشده:</span>
              <span className="font-bold font-mono">
                {formatAmount(calculations.advancesDeducted, currency)} {getCurrencySymbol(currency, language)}
              </span>
            </div>
          )}

          {/* Total Net Due */}
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-sm">
            <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-emerald-500" />
              <span>مبلغ قابل پرداخت این تسویه:</span>
            </span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-base sm:text-lg">
              {formatAmount(calculations.totalCumulativeDebt, currency)} {getCurrencySymbol(currency, language)}
            </span>
          </div>
          
          <p className="text-[10px] text-slate-400 leading-tight">
            * تنها روزهایی که تاکنون تسویه نشده‌اند در این محاسبه لحاظ گردیده‌اند.
          </p>
        </div>

        {/* Detailed List of Unsettled Days */}
        <div className="mt-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-500" />
              <span>ریز روزهای کارکرد در انتظار تسویه:</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {calculations.unsettledLogs.length} روز ثبت‌شده
            </span>
          </div>

          {calculations.unsettledLogs.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 font-medium">
              تمامی روزهای کارکرد قبلی تسویه شده‌اند و روز تسویه‌نشده‌ای وجود ندارد.
            </div>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1.5 pe-1 hide-scrollbar">
              {calculations.unsettledLogs.map((l) => (
                <div key={l.id || l.date} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{l.date}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      l.type === 'hourly' 
                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300' 
                        : l.type === 'half'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {l.type === 'half' ? 'نیم‌روز' : l.type === 'hourly' ? 'ساعتی' : 'کامل'}
                    </span>
                    {l.overtimeHours > 0 && (
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-bold">
                        +{l.overtimeHours}h
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatAmount(l.totalDayPay, currency)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              ))}
            </div>
          )}
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
