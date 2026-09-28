import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatters';
import { AlertTriangle, X, ShieldAlert, ArrowDownRight, Check } from 'lucide-react';

/**
 * OverdraftConfirmModal
 * مودال تایید اضافه برداشت (کسری موجودی)
 * در صورتی که سیاست حساب یا سیستم بر روی «هر بار پرسیده شود» باشد،
 * قبل از ثبت تراکنش فراخوانی می‌شود تا کاربر را از کسری موجودی آگاه کرده و تاییدیه بگیرد.
 */
export function OverdraftConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  accountName = 'حساب انتخابی',
  currentBalance = 0,
  requestedAmount = 0,
  currency = 'IQD',
  language = 'fa'
}) {
  const shortfall = Math.max(0, requestedAmount - currentBalance);
  const resultingBalance = currentBalance - requestedAmount;

  // بستن با کلید Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200/80 dark:border-rose-900/60 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* هدر هشدار */}
        <div className="p-4 sm:p-5 bg-rose-50/70 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'fa' ? 'هشدار کسری موجودی حساب' : 'ئاگاداری کەمبوونی باڵانسی حیساب'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {accountName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* محتوای محاسبه کسری */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {language === 'fa' 
              ? `مبلغ تراکنش انتخابی از موجودی فعلی حساب «${accountName}» بیشتر است و ثبت آن منجر به منفی شدن موجودی حساب خواهد شد.`
              : `بڕی داواکراو لە باڵانسی ئێستای حیساب زیاترە و دەبێتە هۆی کەمبوون و باڵانسی نێگەتیڤ.`}
          </p>

          {/* کارت مقایسه مبالغ */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {language === 'fa' ? 'موجودی فعلی حساب:' : 'باڵانسی ئێستا:'}
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {formatCurrency(currentBalance, currency, language)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {language === 'fa' ? 'مبلغ درخواستی تراکنش:' : 'بڕی مامەڵە:'}
              </span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(requestedAmount, currency, language)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-bold">
              <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>{language === 'fa' ? 'مانده جدید (منفی):' : 'باڵانسی نوێ (نێگەتیڤ):'}</span>
              </span>
              <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm" dir="ltr">
                {formatCurrency(resultingBalance, currency, language)}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              {language === 'fa' 
                ? 'سیاست حساب بر روی «پرسش در هر بار» است. آیا تایید می‌کنید؟' 
                : 'ئایا ڕێگە بە کەمبوونی باڵانس و تۆمارکردن دەدەیت؟'}
            </span>
          </div>
        </div>

        {/* دکمه‌های اقدام */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {language === 'fa' ? 'انصراف و اصلاح' : 'پەشیمانبوونەوە'}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center gap-1.5 shadow-md shadow-rose-500/25 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{language === 'fa' ? 'تایید و ثبت با موجودی منفی' : 'پەسەندکردن و تۆمار'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
export default OverdraftConfirmModal;
