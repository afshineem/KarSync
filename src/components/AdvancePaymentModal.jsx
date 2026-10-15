import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generatePaymentId } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { pushPaymentsLive } from '../services/realtimeSync';
import { 
  getTodayDateString, 
  getCurrentYearMonth, 
  formatAmount, 
  roundCurrency, 
  getCurrencySymbol, 
  formatCurrency 
} from '../utils/formatters';
import { 
  Banknote, 
  X, 
  User, 
  Calendar, 
  Coins, 
  FileText, 
  Hash, 
  Check, 
  AlertCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Ban, 
  HelpCircle, 
  CheckCircle2, 
  Landmark, 
  Star, 
  CreditCard,
  Wallet,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAccounting } from '../hooks/useAccounting';
import { OverdraftConfirmModal } from './accounting/OverdraftConfirmModal';

export function AdvancePaymentModal({ 
  isOpen, 
  onClose, 
  workers = [], 
  targetWorkerId = null, 
  targetMonth = null 
}) {
  const { t, language, direction } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';

  const [workerId, setWorkerId] = useState(targetWorkerId || '');
  const [month, setMonth] = useState(targetMonth || getCurrentYearMonth());
  const [date, setDate] = useState(getTodayDateString());
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [toastMessage, setToastMessage] = useState(null);
  const { checkAccountOverdraft, accountBalances } = useAccounting();
  const [overdraftPromptData, setOverdraftPromptData] = useState(null);

  // Financial accounts live query
  const financialAccounts = useLiveQuery(
    async () => {
      if (!db.financialAccounts) return [];
      const list = await db.financialAccounts.toArray();
      return list.filter((a) => !a.deletedAt && a.isActive);
    },
    []
  ) || [];

  const defaultAccount = useMemo(() => {
    return financialAccounts.find((a) => a.isDefault) || financialAccounts[0] || null;
  }, [financialAccounts]);

  const effectiveAccountId = selectedAccountId || defaultAccount?.id || (financialAccounts[0]?.id ? String(financialAccounts[0].id) : '');

  const currentOverdraft = useMemo(() => {
    const numAmount = roundCurrency(Number(amount), currency);
    if (isNaN(numAmount) || numAmount <= 0 || !effectiveAccountId) return null;
    return checkAccountOverdraft(effectiveAccountId, numAmount);
  }, [amount, effectiveAccountId, currency, checkAccountOverdraft]);

  useEffect(() => {
    if (isOpen) {
      setWorkerId(targetWorkerId || (workers[0]?.id || ''));
      setMonth(targetMonth || getCurrentYearMonth());
      setDate(getTodayDateString());
      setAmount('');
      setSelectedAccountId(effectiveAccountId);
      setReferenceNumber('');
      setNotes('');
      setFeedback({ type: '', message: '' });
      setToastMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultAccount]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const selectedWorker = useMemo(() => {
    return workers.find((w) => String(w.id) === String(workerId)) || null;
  }, [workers, workerId]);

  // Quick amount presets based on currency
  const quickAmounts = useMemo(() => {
    if (currency === 'IQD') {
      return [25000, 50000, 100000, 250000, 500000];
    }
    if (currency === 'IRR') {
      return [500000, 1000000, 2000000, 5000000];
    }
    return [50, 100, 200, 500];
  }, [currency]);

  if (!isOpen) return null;

  const handleSubmit = async (e, bypassOverdraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback({ type: '', message: '' });

    const numAmount = roundCurrency(Number(amount), currency);
    if (!workerId) {
      setFeedback({ type: 'error', message: t('pleaseSelectWorker') });
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: 'error', message: t('pleaseEnterValidAmount') });
      return;
    }

    if (!bypassOverdraft) {
      const overdraftCheck = checkAccountOverdraft(selectedAccountId, numAmount);
      if (!overdraftCheck.hasSufficientFunds) {
        if (overdraftCheck.effectivePolicy === 'never_allow') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || 'حساب انتخابی',
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: numAmount,
            shortfall: overdraftCheck.shortfall,
            isBlocked: true
          });
          setFeedback({
            type: 'error',
            message: language === 'fa'
              ? `موجودی حساب انتخابی (${overdraftCheck.account?.name || 'صندوق/بانک'}) برای پرداخت این مساعده کافی نیست و سیاست کارگاه بر روی «همیشه نامجاز» تنظیم شده است.`
              : 'باڵانسی حیساب بەش ناکات و کەمبوون قەدەغەیە.'
          });
          return;
        } else if (overdraftCheck.effectivePolicy === 'ask_each_time') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || 'حساب انتخابی',
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: numAmount,
            shortfall: overdraftCheck.shortfall,
            isBlocked: false
          });
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const derivedMonth = date ? date.slice(0, 7) : month;

      const workerName = selectedWorker?.name || 'Unknown';

      const newPayment = {
        id: generatePaymentId(),
        projectId: currentProject?.id || 'prj_default_main',
        userId: user?.id || null,
        workerId,
        workerName,
        month: derivedMonth,
        date,
        time: currentTime,
        type: 'advance',
        amount: numAmount,
        currency,
        accountId: selectedAccountId || null,
        accountName: financialAccounts.find((a) => a.id === selectedAccountId)?.name || '',
        accountType: financialAccounts.find((a) => a.id === selectedAccountId)?.type || 'cash',
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        status: 'draft',
        approval_status: 'draft',
        settlement_status: 'partial',
        created_by: user?.id || 'admin',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      await db.payments.add(newPayment);
      pushPaymentsLive().catch(() => {});

      const finalCheck = checkAccountOverdraft(selectedAccountId, numAmount);
      if (numAmount > 0 && !finalCheck.hasSufficientFunds) {
        const resultingNeg = Math.abs(finalCheck.currentBalance - numAmount);
        setToastMessage({
          type: 'warning',
          text: language === 'fa'
            ? `مساعده ثبت شد. توجه: موجودی حساب «${finalCheck.account?.name || 'صندوق'}» به منفی ${formatCurrency(resultingNeg, currency, language)} رسید.`
            : `مامەڵە تۆمارکرا. باڵانسی حیساب بووە بە نێگەتیڤ.`
        });
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setFeedback({ type: 'success', message: t('advanceSuccessMsg') });
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error saving advance' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div 
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white select-none"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[260] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200 ${
          toastMessage.type === 'warning'
            ? 'bg-amber-600 text-white shadow-amber-600/30'
            : 'bg-emerald-600 text-white shadow-emerald-600/30'
        }`}>
          {toastMessage.type === 'warning' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs z-20">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
              <Banknote className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {t('advanceModalTitle')}
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60">
                  {currentProject?.name || 'پروژه جاری'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {language === 'fa' ? 'پرداخت علی‌الحساب، مساعده هفتگی یا وام پرسنل کارگاه' : t('advanceModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            title="بستن (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Body - #f3f6f4 container */}
      <div className="flex-1 overflow-y-auto bg-[#f3f6f4] dark:bg-slate-950 py-5 px-3 sm:px-6">
        <div className="max-w-3xl mx-auto w-full space-y-4">

          {/* Feedback message banner */}
          {feedback.message && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-xs border ${
              feedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
            }`}>
              {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Card 1: Worker & Date Info */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300">
                <User className="w-4 h-4 text-amber-500" />
                <span>مشخصات دریافت‌کننده و زمان پرداخت</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Worker Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('workerName')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={workerId}
                      onChange={(e) => setWorkerId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white cursor-pointer"
                    >
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.role ? `(${w.role})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedWorker && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>نرخ پایه: {formatCurrency(selectedWorker.dailyRate || 0, currency, language)}</span>
                      <span className="text-slate-300">|</span>
                      <span>نوع: {selectedWorker.wageType === 'contract' ? 'کنتراتی' : 'روزمزد'}</span>
                    </div>
                  )}
                </div>

                {/* Date Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('paymentDate')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white font-mono cursor-pointer"
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    مساعده در گزارش کارکرد ماه جاری این پرسنل کسر خواهد شد.
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Financial Details & Payment Account */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>مبلغ پرداختی و حساب مبدا</span>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('paymentAmount')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={currency === 'IQD' ? '250' : '1'}
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => {
                      if (amount !== '') {
                        setAmount(String(roundCurrency(amount, currency)));
                      }
                    }}
                    placeholder={currency === 'IQD' ? '250,000' : '100'}
                    required
                    className="w-full px-4 py-3 text-base sm:text-lg font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-amber-600 dark:text-amber-400 font-mono pe-16"
                  />
                  <span className="absolute inset-y-0 end-0 pe-4 flex items-center text-xs font-black text-slate-400">
                    {getCurrencySymbol(currency, language)}
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold ml-1">مبالغ سریع:</span>
                  {quickAmounts.map((qAmount) => (
                    <button
                      key={qAmount}
                      type="button"
                      onClick={() => setAmount(String(qAmount))}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-950/60 text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 border border-slate-200/80 dark:border-slate-700/80 transition-colors"
                    >
                      {formatAmount(qAmount, currency)}
                    </button>
                  ))}
                </div>

                {Number(amount) > 0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-bold font-mono">
                    معادل: {formatAmount(Number(amount), currency)} {getCurrencySymbol(currency, language)}
                  </p>
                )}
              </div>

              {/* Financial Account */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Landmark className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                    <span>حساب یا صندوق پرداختی</span>
                  </label>
                  {defaultAccount && (
                    <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-500" />
                      <span>پیش‌فرض: {defaultAccount.name}</span>
                    </span>
                  )}
                </div>

                {financialAccounts.length > 0 ? (
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white cursor-pointer font-bold"
                  >
                    {financialAccounts.map((acc) => {
                      const b = accountBalances?.get(String(acc.id))?.currentBalance ?? (Number(acc.initialBalance) || 0);
                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.type === 'bank' ? '💳 کارت بانکی: ' : '🪙 صندوق نقدی: '}
                          {acc.name} {acc.bankName ? `(${acc.bankName})` : ''} - موجودی: {formatCurrency(b, currency, language)} {acc.isDefault ? '⭐ [پیش‌فرض]' : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="text-xs text-slate-400 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                    صندوق نقدی کارگاه
                  </div>
                )}

                {/* Overdraft warning badge */}
                {currentOverdraft && !currentOverdraft.hasSufficientFunds && (
                  <div className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                    currentOverdraft.effectivePolicy === 'never_allow'
                      ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300'
                  }`}>
                    {currentOverdraft.effectivePolicy === 'never_allow' ? (
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <div className="font-bold">
                        {currentOverdraft.effectivePolicy === 'never_allow'
                          ? 'کسری موجودی - ثبت غیرمجاز'
                          : currentOverdraft.effectivePolicy === 'always_allow'
                            ? 'هشدار کسری موجودی (مجاز در تنظیمات سیستم)'
                            : 'هشدار کسری موجودی حساب'}
                      </div>
                      <div className="text-[11px] leading-relaxed opacity-90">
                        {currentOverdraft.effectivePolicy === 'never_allow'
                          ? `موجودی حساب انتخابی (${formatCurrency(currentOverdraft.currentBalance, currency, language)}) کافی نیست (کسری: ${formatCurrency(currentOverdraft.shortfall, currency, language)}). بر اساس تنظیمات سیستم، ثبت با موجودی منفی «غیرمجاز» است.`
                          : currentOverdraft.effectivePolicy === 'always_allow'
                            ? `مبلغ مساعده از موجودی فعلی حساب (${formatCurrency(currentOverdraft.currentBalance, currency, language)}) بیشتر است (کسری: ${formatCurrency(currentOverdraft.shortfall, currency, language)}). با توجه به تنظیم بودن بر روی «همیشه مجاز»، این تراکنش با مانده منفی ثبت خواهد شد.`
                            : `مبلغ مساعده از موجودی حساب (${formatCurrency(currentOverdraft.currentBalance, currency, language)}) بیشتر است (کسری: ${formatCurrency(currentOverdraft.shortfall, currency, language)}). هنگام کلیک بر روی ثبت، پنجره تأیید کسر موجودی نمایش داده می‌شود.`}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Reference & Notes */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>اطلاعات تکمیلی و رسید</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Reference Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('referenceNumber')}
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder={t('referencePlaceholder')}
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('notes')}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="شرح علت پرداخت، مساعده یا واریزی..."
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Sticky/Fixed Footer Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
              >
                {t('cancel')} (ESC)
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !amount}
                className={`px-8 py-2.5 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                  currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === 'never_allow'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/25'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === 'never_allow' ? (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>کسری موجودی (غیرمجاز)</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    <span>{isSubmitting ? 'در حال ثبت...' : t('addAdvanceBtn')}</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </div>
      </div>

      {/* مودال تایید کسری موجودی حساب برای مساعده */}
      {overdraftPromptData && (
        <OverdraftConfirmModal
          isOpen={Boolean(overdraftPromptData)}
          onClose={() => setOverdraftPromptData(null)}
          onConfirm={() => handleSubmit(null, true)}
          accountName={overdraftPromptData.accountName}
          currentBalance={overdraftPromptData.currentBalance}
          requestedAmount={overdraftPromptData.requestedAmount}
          currency={currency}
          language={language}
          isBlocked={Boolean(overdraftPromptData.isBlocked)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
