import React from 'react';
import { FileText, ShieldCheck, Clock, Hash } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * VoucherBadge
 * Clickable, interactive badge displaying official KarSync voucher numbers.
 * Distinguishes between Temporary (T-YYMMNNN) and Permanent (YYMMNNN).
 */
export function VoucherBadge({
  voucherNumber,
  isDraft: explicitDraft,
  onClick,
  size = 'md',
  className = '',
  item = null
}) {
  const { language } = useLanguage();

  if (!voucherNumber) return null;

  const isDraft = explicitDraft !== undefined 
    ? explicitDraft 
    : (voucherNumber.startsWith('T-') || voucherNumber.startsWith('t-'));

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick(voucherNumber, item);
    } else {
      window.dispatchEvent(
        new CustomEvent('karsync-open-voucher', {
          detail: { voucherNumber, item }
        })
      );
    }
  };

  const titleTooltip = isDraft
    ? (language === 'ku' 
        ? 'بەڵگەنامەی دارایی کاتی (ڕەشنووس) - کلیک بکە بۆ بینینی فۆڕم' 
        : language === 'en' 
        ? 'Draft Financial Voucher - Click to view official slip' 
        : 'سند مالی موقت (پیش‌نویس) - کلیک برای مشاهده برگه سند')
    : (language === 'ku' 
        ? 'بەڵگەنامەی دارایی فەرمی و هەمیشەیی - کلیک بکە بۆ بینینی فۆڕم' 
        : language === 'en' 
        ? 'Official Permanent Voucher - Click to view official slip' 
        : 'سند مالی رسمی و دائم - کلیک برای مشاهده برگه سند');

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1 rounded-md font-mono',
    sm: 'px-2 py-0.5 text-xs gap-1 rounded-lg font-mono',
    md: 'px-2.5 py-1 text-xs gap-1.5 rounded-xl font-mono',
    lg: 'px-3 py-1.5 text-sm gap-2 rounded-2xl font-mono'
  }[size] || 'px-2.5 py-1 text-xs gap-1.5 rounded-xl font-mono';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={titleTooltip}
      aria-label={titleTooltip}
      className={`inline-flex items-center font-bold tracking-wider transition-all duration-200 cursor-pointer select-none active:scale-95 group ${
        isDraft
          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 dark:border-amber-600/50 shadow-xs'
          : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/40 dark:border-sky-600/50 shadow-xs'
      } ${sizeClasses} ${className}`}
    >
      {isDraft ? (
        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 group-hover:rotate-12 transition-transform" />
      ) : (
        <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
      )}
      <span className="dir-ltr text-left font-black">{voucherNumber}</span>
    </button>
  );
}
