import React from 'react';
import { ShieldCheck, FileEdit, CheckCircle2, Clock, Shield } from 'lucide-react';

/**
 * VerificationBadge
 * نشان وضعیت تایید سند (دو مرحله‌ای: پیش‌نویس / تایید شده)
 * 
 * @param {string} status - 'draft' | 'approved'
 * @param {string} approvedBy - نام تاییدکننده
 * @param {string} approvedAt - تاریخ تایید
 * @param {string} size - 'xs' | 'sm' | 'md'
 * @param {string} language - 'fa' | 'ku' | 'en'
 */
export function VerificationBadge({
  status = 'draft',
  approvedBy = null,
  approvedAt = null,
  size = 'sm',
  language = 'fa',
  showDetails = true,
  isAmended = false
}) {
  const isApproved = status === 'approved';

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[9px] gap-1',
    sm: 'px-2 py-0.5 text-[10px] sm:text-[11px] gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5'
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5'
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.sm;
  const currentIconSize = iconSizes[size] || iconSizes.sm;

  if (isApproved) {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <span
            className={`inline-flex items-center rounded-xl font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs transition-colors ${currentSizeClass}`}
            title={
              approvedBy || approvedAt
                ? `تایید شده توسط: ${approvedBy || 'مدیر'} ${approvedAt ? `در ${approvedAt.slice(0, 10)}` : ''}`
                : (language === 'fa' ? 'سند تایید نهایی شده' : 'پەسەندکراوی کۆتایی')
            }
          >
            <ShieldCheck className={`${currentIconSize} text-emerald-600 dark:text-emerald-400 shrink-0`} />
            <span>{language === 'fa' ? 'تایید نهایی' : language === 'ku' ? 'پەسەندکراوی کۆتایی' : 'Approved'}</span>
          </span>

          {isAmended && (
            <span 
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/70 shadow-xs"
              title="این سند دارای سابقه اصلاحیه می‌باشد"
            >
              <span>📝</span>
              <span>{language === 'fa' ? 'اصلاحیه' : 'دەستکاریکراو'}</span>
            </span>
          )}
        </div>

        {showDetails && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium inline-flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400">👤</span>
            <span className="truncate max-w-[120px]">{approvedBy || (language === 'fa' ? 'مدیر' : 'بەڕێوەبەر')}</span>
          </span>
        )}
      </div>
    );
  }

  // Draft status
  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span
        className={`inline-flex items-center rounded-xl font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 shadow-xs transition-colors ${currentSizeClass}`}
        title={language === 'fa' ? 'پیش‌نویس موقت (در انتظار تایید نهایی مدیر)' : 'ڕەشنووس'}
      >
        <Clock className={`${currentIconSize} text-amber-500 shrink-0`} />
        <span>{language === 'fa' ? 'پیش‌نویس موقت' : language === 'ku' ? 'ڕەشنووس' : 'Draft'}</span>
      </span>
      {showDetails && (
        <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 font-normal">
          {language === 'fa' ? 'در انتظار تایید' : 'چاوەڕوانی پەسەند'}
        </span>
      )}
    </div>
  );
}

export default VerificationBadge;
