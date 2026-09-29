import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, formatAmount, getTodayDateString } from '../../utils/formatters';
import { OverdraftConfirmModal } from './OverdraftConfirmModal';
import { 
  X, 
  ArrowLeftRight, 
  ArrowRight,
  CreditCard, 
  Coins, 
  AlertTriangle, 
  Ban, 
  HelpCircle, 
  CheckCircle2, 
  Calendar, 
  FileText, 
  Hash, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';

/**
 * AccountTransferModal
 * مودال انتقال وجه بین حساب‌ها و صندوق‌ها (کارت به کارت، صندوق به بانک، بانک به صندوق)
 */
export function AccountTransferModal({
  isOpen,
  onClose,
  onTransfer,
  accounts = [],
  accountBalances = new Map(),
  globalOverdraftPolicy = 'ask_each_time',
  initialFromAccountId = null,
  currency = 'IQD',
  language = 'fa'
}) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => getTodayDateString());
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overdraftPromptData, setOverdraftPromptData] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // حساب‌های فعال
  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => a.isActive !== false);
  }, [accounts]);

  const prevIsOpenRef = React.useRef(false);

  // تنظیم اولیه حساب‌ها فقط هنگام باز شدن مودال
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setErrorMsg('');
      setToastMessage(null);
      setOverdraftPromptData(null);
      setAmount('');
      setDate(getTodayDateString());
      setReference('');
      setDescription('');

      if (activeAccounts.length >= 2) {
        const initialFrom = initialFromAccountId 
          ? activeAccounts.find((a) => String(a.id) === String(initialFromAccountId))?.id 
          : (activeAccounts.find((a) => a.type === 'cash')?.id || activeAccounts[0].id);
        
        const remaining = activeAccounts.filter((a) => String(a.id) !== String(initialFrom));
        const initialTo = remaining[0]?.id || '';

        setFromAccountId(String(initialFrom));
        setToAccountId(String(initialTo));
      } else if (activeAccounts.length === 1) {
        setFromAccountId(String(activeAccounts[0].id));
        setToAccountId('');
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialFromAccountId]);

  // در صورت لود دیرهنگام حساب‌ها، حساب‌های مبدأ و مقصد را فقط در صورت خالی بودن ست کن (بدون پاک کردن مبلغ)
  useEffect(() => {
    if (isOpen && !fromAccountId && activeAccounts.length > 0) {
      const initialFrom = initialFromAccountId 
        ? activeAccounts.find((a) => String(a.id) === String(initialFromAccountId))?.id 
        : (activeAccounts.find((a) => a.type === 'cash')?.id || activeAccounts[0].id);
      setFromAccountId(String(initialFrom));
      if (!toAccountId && activeAccounts.length >= 2) {
        const remaining = activeAccounts.filter((a) => String(a.id) !== String(initialFrom));
        setToAccountId(String(remaining[0]?.id || ''));
      }
    }
  }, [isOpen, fromAccountId, toAccountId, activeAccounts, initialFromAccountId]);

  // آبجکت حساب‌های انتخاب شده
  const fromAccount = useMemo(() => {
    return activeAccounts.find((a) => String(a.id) === String(fromAccountId)) || null;
  }, [activeAccounts, fromAccountId]);

  const toAccount = useMemo(() => {
    return activeAccounts.find((a) => String(a.id) === String(toAccountId)) || null;
  }, [activeAccounts, toAccountId]);

  // موجودی زنده حساب مبدأ و مقصد
  const fromBalance = useMemo(() => {
    if (!fromAccount) return 0;
    const b = accountBalances.get(String(fromAccount.id));
    return b ? b.currentBalance : (Number(fromAccount.initialBalance) || 0);
  }, [fromAccount, accountBalances]);

  const toBalance = useMemo(() => {
    if (!toAccount) return 0;
    const b = accountBalances.get(String(toAccount.id));
    return b ? b.currentBalance : (Number(toAccount.initialBalance) || 0);
  }, [toAccount, accountBalances]);

  // محاسبه مبلغ عددی
  const numericAmount = useMemo(() => {
    return Number(String(amount).replace(/,/g, '')) || 0;
  }, [amount]);

  // سیاست اضافه برداشت حساب مبدأ
  const effectiveOverdraftPolicy = useMemo(() => {
    if (!fromAccount) return globalOverdraftPolicy;
    return (fromAccount.overdraftPolicy && fromAccount.overdraftPolicy !== 'global')
      ? fromAccount.overdraftPolicy
      : globalOverdraftPolicy;
  }, [fromAccount, globalOverdraftPolicy]);

  // وضعیت کسری موجودی حساب مبدأ
  const isOverdraft = useMemo(() => {
    return numericAmount > 0 && fromBalance < numericAmount;
  }, [numericAmount, fromBalance]);

  const shortfallAmount = useMemo(() => {
    return Math.max(0, numericAmount - fromBalance);
  }, [numericAmount, fromBalance]);

  // جابجایی مبدأ و مقصد
  const handleSwap = () => {
    const prevFrom = fromAccountId;
    const prevTo = toAccountId;
    setFromAccountId(prevTo);
    setToAccountId(prevFrom);
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(raw ? Number(raw).toLocaleString('en-US') : '');
    setErrorMsg('');
  };

  // دکمه‌های مقدار سریع
  const handleQuickPercent = (pct) => {
    if (fromBalance > 0) {
      const val = Math.floor(fromBalance * (pct / 100));
      setAmount(val > 0 ? Number(val).toLocaleString('en-US') : '');
    }
  };

  const executeTransfer = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg('');

      await onTransfer({
        fromAccountId,
        toAccountId,
        amount: numericAmount,
        date,
        reference: reference.trim(),
        description: description.trim()
      });

      if (isOverdraft) {
        setToastMessage({
          type: 'warning',
          text: language === 'fa'
            ? `انتقال وجه انجام شد، اما موجودی حساب ${fromAccount?.name || 'مبدأ'} منفی گردید (${formatAmount(fromBalance - numericAmount, currency)} ${currency}).`
            : 'مامەڵەکە ئەنجامدرا بەڵام باڵانسی حیسابی سەرچاوە کەم بوویەوە.'
        });
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'خطا در ثبت انتقال وجه');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (activeAccounts.length < 2) {
      setErrorMsg(language === 'fa' ? 'برای انتقال وجه، حداقل دو حساب فعال باید در سیستم تعریف شده باشد.' : 'پێویستە لانی کەم دوو حیساب هەبێت.');
      return;
    }

    if (!fromAccountId || !toAccountId) {
      setErrorMsg(language === 'fa' ? 'لطفاً هر دو حساب مبدأ و مقصد را انتخاب کنید.' : 'تکایە هەردوو حیسابەکە دیاری بکە.');
      return;
    }

    if (fromAccountId === toAccountId) {
      setErrorMsg(language === 'fa' ? 'حساب مبدأ و مقصد نمی‌تواند یکسان باشد.' : 'حیسابی سەرچاوە و مەبەست نابێت یەک بن.');
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg(language === 'fa' ? 'لطفاً مبلغ معتبری برای انتقال وارد نمایید.' : 'تکایە بڕە پارەیەکی دروست بنووسە.');
      return;
    }

    // بررسی کسری موجودی حساب مبدأ بر اساس سیاست
    if (isOverdraft) {
      if (effectiveOverdraftPolicy === 'never_allow') {
        setOverdraftPromptData({
          isBlocked: true,
          accountName: fromAccount?.name || 'حساب مبدأ',
          currentBalance: fromBalance,
          requestedAmount: numericAmount,
          shortfall: shortfallAmount,
          currency
        });
        return;
      }

      if (effectiveOverdraftPolicy === 'ask_each_time') {
        setOverdraftPromptData({
          isBlocked: false,
          accountName: fromAccount?.name || 'حساب مبدأ',
          currentBalance: fromBalance,
          requestedAmount: numericAmount,
          shortfall: shortfallAmount,
          currency
        });
        return;
      }
    }

    executeTransfer();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* هدر مدال */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {language === 'fa' ? 'انتقال وجه بین حساب‌ها' : 'گواستنەوەی پارە لە نێوان حیسابەکان'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'fa' 
                  ? 'کارت به کارت، واریز از صندوق به بانک یا انتقال وجه داخلی' 
                  : 'گواستنەوە لە نێوان کارتی بانکی و سندووقی کارگە'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* اعلان هشدار یا موفقیت */}
        {toastMessage && (
          <div className="p-3 px-5 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* فرم محتوا */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeAccounts.length < 2 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{language === 'fa' ? 'برای استفاده از این قابلیت، حداقل باید دو حساب یا صندوق تعریف کرده باشید.' : 'پێویستە دوو حیساب هەبێت.'}</span>
            </div>
          )}

          {/* بخش انتخاب مبدأ و مقصد به صورت دو ستونه همراه دکمه جابجایی */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3 relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              {/* حساب مبدأ */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500 me-1.5"></span>
                  {language === 'fa' ? 'از حساب (مبدأ):' : 'لە حیسابی:'}
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                >
                  {activeAccounts.map((acc) => {
                    const bal = accountBalances.get(String(acc.id))?.currentBalance ?? (Number(acc.initialBalance) || 0);
                    return (
                      <option key={acc.id} value={acc.id}>
                        {acc.type === 'bank' ? '💳 ' : '🪙 '}
                        {acc.name} ({formatAmount(bal, currency)})
                      </option>
                    );
                  })}
                </select>
                {fromAccount && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
                    <span>{language === 'fa' ? 'موجودی فعلی:' : 'باڵانس:'}</span>
                    <span className={`font-mono font-bold ${fromBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`} dir="ltr">
                      {formatCurrency(fromBalance, currency, language)}
                    </span>
                  </div>
                )}
              </div>

              {/* حساب مقصد */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 me-1.5"></span>
                  {language === 'fa' ? 'به حساب (مقصد):' : 'بۆ حیسابی:'}
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                >
                  {activeAccounts.map((acc) => {
                    const bal = accountBalances.get(String(acc.id))?.currentBalance ?? (Number(acc.initialBalance) || 0);
                    const isSame = String(acc.id) === String(fromAccountId);
                    return (
                      <option key={acc.id} value={acc.id} disabled={isSame}>
                        {acc.type === 'bank' ? '💳 ' : '🪙 '}
                        {acc.name} {isSame ? '(مبدأ است)' : `(${formatAmount(bal, currency)})`}
                      </option>
                    );
                  })}
                </select>
                {toAccount && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
                    <span>{language === 'fa' ? 'موجودی فعلی:' : 'باڵانس:'}</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                      {formatCurrency(toBalance, currency, language)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* دکمه جابجایی مبدأ و مقصد در وسط */}
            <div className="flex justify-center -my-1">
              <button
                type="button"
                onClick={handleSwap}
                title={language === 'fa' ? 'جابجایی حساب مبدأ و مقصد' : 'گۆڕینەوەی حیسابەکان'}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 flex items-center gap-1.5 shadow-xs transition-all active:scale-95 text-[11px] font-bold"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{language === 'fa' ? 'جابجایی جهت انتقال' : 'گۆڕینەوە'}</span>
              </button>
            </div>
          </div>

          {/* فیلد مبلغ انتقال */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {language === 'fa' ? `مبلغ انتقال (${currency}):` : `بڕی پارە (${currency}):`}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                value={amount}
                onChange={handleAmountChange}
                placeholder="مثال: ۵,۰۰۰,۰۰۰"
                className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-base font-bold font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                dir="ltr"
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {currency}
              </span>
            </div>

            {/* دکمه‌های سریع مبلغ بر اساس موجودی مبدأ */}
            {fromBalance > 0 && (
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                <span className="text-[10px] text-slate-400 shrink-0">
                  {language === 'fa' ? 'درصد از مبدأ:' : 'ڕێژە:'}
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickPercent(25)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600"
                >
                  ۲۵٪
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPercent(50)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600"
                >
                  ۵۰٪
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPercent(100)}
                  className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900"
                >
                  {language === 'fa' ? 'تمام موجودی (۱۰۰٪)' : 'هەمووی'}
                </button>
              </div>
            )}
          </div>

          {/* بنر هشدار کسری موجودی حساب مبدأ */}
          {isOverdraft && (
            <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 animate-in fade-in duration-150 ${
              effectiveOverdraftPolicy === 'never_allow'
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-200'
            }`}>
              {effectiveOverdraftPolicy === 'never_allow' ? (
                <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="text-xs font-bold">
                  {effectiveOverdraftPolicy === 'never_allow'
                    ? (language === 'fa' ? 'انتقال نامجاز: موجودی حساب مبدأ ناکافی است' : 'باڵانسی سەرچاوە بەشی ئەم گواستنەوەیە ناکات')
                    : (language === 'fa' ? 'هشدار اضافه برداشت: تراز مبدأ منفی خواهد شد' : 'ئاگاداری: باڵانسی سەرچاوە کەم دەبێتەوە')}
                </p>
                <p className="text-[11px] opacity-90">
                  {language === 'fa' 
                    ? `موجودی فعلی: ${formatAmount(fromBalance, currency)} ${currency} | کسری: ${formatAmount(shortfallAmount, currency)} ${currency}` 
                    : `باڵانس: ${formatAmount(fromBalance, currency)}`}
                </p>
              </div>
            </div>
          )}

          {/* تاریخ و شماره پیگیری ارجاع */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <Calendar className="w-3 h-3 inline ml-1 text-slate-400" />
                <span>{language === 'fa' ? 'تاریخ انتقال:' : 'بەروار:'}</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <Hash className="w-3 h-3 inline ml-1 text-slate-400" />
                <span>{language === 'fa' ? 'کد رهگیری / شماره فیش:' : 'کۆدی بەدواداچوون:'}</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="اختیاری (مثال: ۵۸۴۲۱)"
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* توضیحات / بابت */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <FileText className="w-3 h-3 inline ml-1 text-slate-400" />
              <span>{language === 'fa' ? 'توضیحات و علت انتقال:' : 'تێبینی و هۆکار:'}</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: شارژ نقدینگی صندوق کارگاه از طریق کارت بانکی"
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* دکمه‌های پایانی */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (isOverdraft && effectiveOverdraftPolicy === 'never_allow') || activeAccounts.length < 2}
              className={`px-5 py-2.5 rounded-2xl text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isOverdraft && effectiveOverdraftPolicy === 'never_allow'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                  : 'bg-gradient-to-r from-indigo-500 to-sky-600 hover:from-indigo-600 hover:to-sky-700 shadow-indigo-500/25'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{language === 'fa' ? 'در حال ثبت...' : 'تۆمار دەکرێت...'}</span>
                </>
              ) : isOverdraft && effectiveOverdraftPolicy === 'never_allow' ? (
                <>
                  <Ban className="w-4 h-4" />
                  <span>{language === 'fa' ? 'انتقال نامجاز (کسری موجودی)' : 'قەدەغەیە'}</span>
                </>
              ) : (
                <>
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>{language === 'fa' ? 'تایید و انتقال وجه' : 'گواستنەوەی پارە'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* مدال تایید کسری موجودی حساب مبدأ */}
      {overdraftPromptData && (
        <OverdraftConfirmModal
          isOpen={Boolean(overdraftPromptData)}
          onClose={() => setOverdraftPromptData(null)}
          onConfirm={() => {
            setOverdraftPromptData(null);
            executeTransfer();
          }}
          isBlocked={overdraftPromptData.isBlocked}
          accountName={overdraftPromptData.accountName}
          currentBalance={overdraftPromptData.currentBalance}
          requestedAmount={overdraftPromptData.requestedAmount}
          shortfall={overdraftPromptData.shortfall}
          currency={currency}
          language={language}
        />
      )}
    </div>,
    document.body
  );
}
export default AccountTransferModal;
