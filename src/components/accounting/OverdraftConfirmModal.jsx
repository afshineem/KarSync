import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatters';
import { AlertTriangle, X, ShieldAlert, ArrowDownRight, Check, Ban } from 'lucide-react';

/**
 * OverdraftConfirmModal
 * مودال تایید و هشدار اضافه برداشت (کسری موجودی)
 * با سطح لایه z-[250] جهت نمایش بالاتر از تمام مودال‌های تمام‌صفحه
 */
// Scoped dictionary for OverdraftConfirmModal
const COPY = {
  fa: {
    accountFallback: 'حساب انتخابی',
    titleBlocked: 'خطای کسری موجودی حساب (غیرمجاز)',
    titleWarn: 'هشدار کسری موجودی حساب',
    descBlocked: (acc) => `موجودی حساب «${acc}» کمتر از مبلغ درخواستی تراکنش است و بر اساس تنظیمات سیستم، اضافه برداشت و ثبت با مانده منفی «همیشه نامجاز» است. امکان ثبت این تراکنش با این حساب وجود ندارد.`,
    descWarn: (acc) => `مبلغ تراکنش انتخابی از موجودی فعلی حساب «${acc}» بیشتر است و ثبت آن منجر به منفی شدن موجودی حساب خواهد شد.`,
    currentBalance: 'موجودی فعلی حساب:',
    requestedAmount: 'مبلغ درخواستی تراکنش:',
    shortfall: 'کسری موجودی:',
    newBalanceNegative: 'مانده جدید (منفی):',
    tipBlocked: 'برای ادامه لطفاً حساب دیگری انتخاب کرده یا ابتدا از طریق بخش واریزی‌ها حساب را شارژ نمایید.',
    tipWarn: 'سیاست حساب بر روی «پرسش در هر بار» است. آیا تایید می‌کنید؟',
    btnUnderstand: 'متوجه شدم (بازگشت و اصلاح)',
    btnCancel: 'انصراف و اصلاح',
    btnConfirmNegative: 'تایید و ثبت با موجودی منفی'
  },
  ku: {
    accountFallback: 'حیسابی هەڵبژێردراو',
    titleBlocked: 'هەڵەی کەمبوونی باڵانس (قەدەغە)',
    titleWarn: 'ئاگاداری کەمبوونی باڵانسی حیساب',
    descBlocked: (acc) => `باڵانسی حیسابی «${acc}» لە بڕی داواکراو کەمترە و بەپێی سیاسەتی سیستەم کەمبوونی باڵانس «قەدەغەیە». تۆمارکردن ناکرێت.`,
    descWarn: (acc) => `بڕی داواکراو لە باڵانسی ئێستای حیسابی «${acc}» زیاترە و دەبێتە هۆی نێگەتیڤ بوونی باڵانس.`,
    currentBalance: 'باڵانسی ئێستا:',
    requestedAmount: 'بڕی داواکراوی مامەڵە:',
    shortfall: 'بڕی کەمیی باڵانس:',
    newBalanceNegative: 'باڵانسی نوێ (نێگەتیڤ):',
    tipBlocked: 'تکایە حیسابێکی تر هەڵبژێرە یاخود باڵانسی حیساب زیاد بکە.',
    tipWarn: 'سیاسەتی حیساب لەسەر «پرسیارکردن لە هەر جارێک» دانراوە. ئایا پەسەندی دەکەیت؟',
    btnUnderstand: 'تێگەیشتم (گەڕانەوە و چاککردن)',
    btnCancel: 'پاشگەزبوونەوە و چاککردن',
    btnConfirmNegative: 'پەسەندکردن و تۆمارکردن بە باڵانسی نێگەتیڤ'
  },
  en: {
    accountFallback: 'Selected Account',
    titleBlocked: 'Insufficient Balance Error (Blocked)',
    titleWarn: 'Account Overdraft Warning',
    descBlocked: (acc) => `The balance of account "${acc}" is less than requested, and system policy strictly prohibits negative balances. This transaction cannot be processed.`,
    descWarn: (acc) => `The requested transaction amount exceeds the current balance of account "${acc}" and will result in a negative balance.`,
    currentBalance: 'Current Account Balance:',
    requestedAmount: 'Requested Amount:',
    shortfall: 'Balance Shortfall:',
    newBalanceNegative: 'New Balance (Negative):',
    tipBlocked: 'Please choose another account or recharge this account before proceeding.',
    tipWarn: 'Account policy is set to "Ask each time". Do you wish to approve this overdraft?',
    btnUnderstand: 'Understood (Go Back & Edit)',
    btnCancel: 'Cancel & Edit',
    btnConfirmNegative: 'Approve & Record with Negative Balance'
  }
};

export function OverdraftConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  accountName = '',
  currentBalance = 0,
  requestedAmount = 0,
  currency = 'IQD',
  language = 'fa',
  isBlocked = false
}) {
  const txt = COPY[language] || COPY.fa;
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
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200/80 dark:border-rose-900/60 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* هدر هشدار */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          isBlocked 
            ? 'bg-rose-100/80 dark:bg-rose-950/70 border-rose-200 dark:border-rose-900/60' 
            : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isBlocked
                ? 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-600/30'
                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
            }`}>
              {isBlocked ? <Ban className="w-5 h-5 stroke-[2.4]" /> : <AlertTriangle className="w-5 h-5 stroke-[2.3]" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isBlocked ? txt.titleBlocked : txt.titleWarn}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {accountName || txt.accountFallback}
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
            {isBlocked ? txt.descBlocked(accountName || txt.accountFallback) : txt.descWarn(accountName || txt.accountFallback)}
          </p>

          {/* کارت مقایسه مبالغ */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {txt.currentBalance}
              </span>
              <span className={`font-mono font-bold ${currentBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                {formatCurrency(currentBalance, currency, language)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {txt.requestedAmount}
              </span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(requestedAmount, currency, language)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-bold">
              {isBlocked ? (
                <>
                  <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" />
                    <span>{txt.shortfall}</span>
                  </span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {formatCurrency(shortfall, currency, language)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>{txt.newBalanceNegative}</span>
                  </span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm" dir="ltr">
                    {formatCurrency(resultingBalance, currency, language)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className={`p-3 rounded-xl border flex items-center gap-2 text-[11px] ${
            isBlocked
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/60 text-amber-800 dark:text-amber-300'
          }`}>
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              {isBlocked ? txt.tipBlocked : txt.tipWarn}
            </span>
          </div>
        </div>

        {/* دکمه‌های اقدام */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          {isBlocked ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 flex items-center justify-center gap-1.5 transition-all"
            >
              <span>{txt.btnUnderstand}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {txt.btnCancel}
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
                <span>{txt.btnConfirmNegative}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
export default OverdraftConfirmModal;
