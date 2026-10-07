import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../../db/db';
import { useProject } from '../../context/ProjectContext';
import { 
  Search, 
  X, 
  Users, 
  User, 
  UserX, 
  CreditCard, 
  Wallet, 
  ChevronLeft, 
  ArrowUpDown, 
  CornerDownLeft, 
  SearchX,
  Sparkles
} from 'lucide-react';

/**
 * تابع نرمال‌سازی متون فارسی، عربی و کردی جهت جستجوی بدون حساسیت به حروف یکسان
 */
function normalizeSearchText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[آأإ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // حذف نیم‌فاصله‌ها
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * SubsidiarySearchModal
 * مودال جستجوی سریع به سبک Spotlight / Command Palette برای معین گردش مالی پرسنل و حساب‌ها
 * - ایندکس کامل تمام پرسنل (فعال با آیکون سبز/آبی و غیرفعال با آیکون و بج خاکستری متمایز)
 * - ایندکس حساب‌های بانکی و صندوق‌های نقدی
 * - ناوبری کیبورد با ArrowUp / ArrowDown / Enter / Escape
 * - فیلتر بلادرنگ با نرمال‌سازی حروف
 */
export function SubsidiarySearchModal({
  isOpen,
  onClose,
  onSelectAccount,
  onSelectWorker,
  language = 'fa'
}) {
  const { currentProject, openWorkerProfile } = useProject();
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef(null);
  const activeItemRef = useRef(null);
  const listContainerRef = useRef(null);

  // ۱. بارگذاری تمام پرسنل پروژه جاری (شامل فعال و غیرفعال بدون فیلتر حذفی)
  const workers = useLiveQuery(
    async () => {
      try {
        const list = await db.workers.toArray();
        return list.filter(
          (w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId && !w.deletedAt
        );
      } catch (err) {
        console.warn('Error loading workers for search index:', err);
        return [];
      }
    },
    [targetProjectId]
  ) || [];

  // ۲. بارگذاری گروه‌های کاری جهت نمایش در زیرعنوان پرسنل
  const groups = useLiveQuery(
    async () => {
      try {
        const list = await db.groups.toArray();
        return list.filter((g) => !g.deletedAt);
      } catch (err) {
        return [];
      }
    },
    []
  ) || [];

  // ۳. بارگذاری حساب‌های بانکی و صندوق‌ها
  const accounts = useLiveQuery(
    async () => {
      try {
        const list = await db.financialAccounts.toArray();
        return list.filter(
          (a) => (a.projectId || DEFAULT_PROJECT_ID) === targetProjectId && !a.deletedAt && a.status !== 'deleted'
        );
      } catch (err) {
        console.warn('Error loading accounts for search index:', err);
        return [];
      }
    },
    [targetProjectId]
  ) || [];

  // مپ شناسه گروه به نام گروه
  const groupMap = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => map.set(String(g.id), g.name));
    return map;
  }, [groups]);

  // ساخت آرایه یکپارچه ایندکس جستجو (Search Index)
  const searchIndex = useMemo(() => {
    const items = [];

    // الف) افزودن حساب‌ها و صندوق‌های نقدی در اولویت ابتدایی
    accounts.forEach((a) => {
      const isCash = a.type === 'cash';
      const accNum = a.accountNumber || a.cardNumber;
      const subtitleParts = [];
      if (a.bankName) subtitleParts.push(a.bankName);
      if (accNum) subtitleParts.push(`••• ${String(accNum).slice(-4)}`);
      
      const defaultSubtitle = isCash
        ? (language === 'fa' ? 'صندوق تنخواه نقدی کارگاه' : 'سندووقی نەختینەی کارگە')
        : (language === 'fa' ? 'حساب جاری بانکی' : 'حیسابی بانکی');

      items.push({
        id: `account_${a.id}`,
        type: 'account',
        isCash: isCash,
        isDefault: Boolean(a.isDefault),
        title: a.name || (isCash ? (language === 'fa' ? 'صندوق نقدی' : 'سندووقی نەختینە') : (language === 'fa' ? 'حساب بانکی' : 'حیسابی بانکی')),
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(' • ') : defaultSubtitle,
        badgeText: isCash
          ? (language === 'fa' ? 'صندوق نقدی' : 'سندووقی نەختینە')
          : (language === 'fa' ? 'حساب بانکی' : 'حیسابی بانکی'),
        data: a
      });
    });

    // ب) افزودن تمام پرسنل (فعال و غیرفعال با تفکیک دقیق استیت)
    workers.forEach((w) => {
      const isActive = w.isActive === 1 || w.isActive === true || w.isActive === '1';
      const groupName = w.groupId ? groupMap.get(String(w.groupId)) : null;
      
      const subtitleParts = [];
      if (groupName) subtitleParts.push(groupName);
      if (w.role) subtitleParts.push(w.role);
      if (w.phone) subtitleParts.push(w.phone);

      const defaultSubtitle = language === 'fa' ? 'پرسنل کارگاه' : 'کارمەندی کارگە';

      items.push({
        id: `worker_${w.id}`,
        type: 'worker',
        isActive: isActive,
        title: w.name || (language === 'fa' ? 'پرسنل بدون نام' : 'کارمەندی بێ ناو'),
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(' • ') : defaultSubtitle,
        badgeText: isActive
          ? (language === 'fa' ? 'پرسنل فعال' : 'چالاک')
          : (language === 'fa' ? 'پرسنل غیرفعال' : 'ناچالاک'),
        data: w
      });
    });

    return items;
  }, [accounts, workers, groupMap, language]);

  // فیلتر آنی نتایج بر اساس تایپ کاربر با نرمال‌سازی
  const filteredResults = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    if (!q) {
      return searchIndex;
    }

    return searchIndex.filter((item) => {
      const titleNorm = normalizeSearchText(item.title);
      const subtitleNorm = normalizeSearchText(item.subtitle);
      return titleNorm.includes(q) || subtitleNorm.includes(q);
    });
  }, [searchIndex, searchQuery]);

  // ریست کردن ایندکس فعال با تغییر جستجو
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  // اسکرول نرم آیتم فعال به داخل دید کاربر
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  // فوکوس خودکار روی اینپوت جستجو هنگام باز شدن مودال
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setActiveIndex(0);
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // عملیات انتخاب آیتم
  const handleSelectItem = (item) => {
    if (!item) return;
    onClose();

    if (item.type === 'worker') {
      if (onSelectWorker) {
        onSelectWorker(item.data);
      } else if (openWorkerProfile) {
        openWorkerProfile(item.data.id);
      }
    } else if (item.type === 'account') {
      if (onSelectAccount) {
        onSelectAccount(item.data);
      }
    }
  };

  // مدیریت ناوبری کیبورد
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredResults.length === 0) return;
      setActiveIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredResults.length === 0) return;
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[activeIndex]) {
        handleSelectItem(filteredResults[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] w-screen h-screen flex items-start sm:items-center justify-center p-3 sm:p-4 pt-16 sm:pt-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* هدر اسپات‌لایت با اینپوت جستجو */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850/60">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 absolute right-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === 'fa'
                  ? 'جستجوی نام پرسنل (فعال/غیرفعال)، نام بانک یا صندوق...'
                  : 'گەڕان بەدوای ناوی کرێکار، بانک یان سندووق...'
              }
              className="w-full pr-11 pl-10 py-3 text-sm sm:text-base rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all shadow-inner"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute left-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="پاک کردن"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <span className="absolute left-3 hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                Shift+M
              </span>
            )}
          </div>
        </div>

        {/* لیست نتایج جستجو */}
        <div 
          ref={listContainerRef}
          className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-1 divide-y divide-slate-100/60 dark:divide-slate-800/60 custom-scrollbar min-h-[220px]"
        >
          {filteredResults.length === 0 ? (
            /* وضعیت عدم یافتن نتیجه (Empty State) */
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <SearchX className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'موردی یافت نشد' : 'هیچ ئەنجامێک نەدۆزرایەوە'}
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                {language === 'fa'
                  ? `هیچ پرسنل یا حسابی با عبارت «${searchQuery}» پیدا نشد. املای کلمه را بررسی کنید.`
                  : `هیچ کەسێک یان حیسابێک بەم ناوە نەدۆزرایەوە.`}
              </p>
            </div>
          ) : (
            filteredResults.map((item, index) => {
              const isSelected = index === activeIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  ref={isSelected ? activeItemRef : null}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-3 text-right transition-all group ${
                    isSelected
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/15 ring-1.5 ring-emerald-500/40 shadow-xs'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  {/* بخش راست: آیکون و مشخصات */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* آیکون تفکیک‌شده بر اساس نوع آیتم */}
                    {item.type === 'worker' ? (
                      item.isActive ? (
                        /* پرسنل فعال: آیکون سبز/آبی شاداب */
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                          <User className="w-5 h-5" />
                        </div>
                      ) : (
                        /* پرسنل غیرفعال: آیکون و پس‌زمینه خاکستری متمایز */
                        <div className="w-10 h-10 rounded-2xl bg-slate-200/90 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center shrink-0">
                          <UserX className="w-5 h-5" />
                        </div>
                      )
                    ) : (
                      item.isCash ? (
                        /* صندوق نقدی */
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                          <Wallet className="w-5 h-5" />
                        </div>
                      ) : (
                        /* حساب بانکی */
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
                          <CreditCard className="w-5 h-5" />
                        </div>
                      )
                    )}

                    {/* عنوان و زیرعنوان */}
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold truncate ${
                            item.type === 'worker' && !item.isActive
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {item.title}
                        </span>

                        {/* نشانگرهای تفکیک وضعیت و نوع حساب */}
                        {item.type === 'worker' ? (
                          item.isActive ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 shrink-0">
                              {language === 'fa' ? 'فعال' : 'چالاک'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                              {language === 'fa' ? 'غیرفعال' : 'ناچالاک'}
                            </span>
                          )
                        ) : (
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                item.isCash
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                                  : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30'
                              }`}
                            >
                              {item.badgeText}
                            </span>
                            {item.isDefault && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30 shrink-0">
                                {language === 'fa' ? 'پیش‌فرض' : 'بنەڕەتی'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* بخش چپ: نشانگر مشاهده معین و Enter */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                      {item.type === 'worker'
                        ? (language === 'fa' ? 'معین پرسنل' : 'دەفتەری کەس')
                        : (language === 'fa' ? 'معین حساب' : 'دەفتەری حیساب')}
                    </span>
                    {isSelected ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold shadow-xs flex items-center gap-1 animate-in fade-in">
                        <span>Enter</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    ) : (
                      <ChevronLeft className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* فوتر راهنمای کلیدها */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">↓</kbd>
              <span>{language === 'fa' ? 'جابه‌جایی' : 'جووڵە'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">Enter</kbd>
              <span>{language === 'fa' ? 'مشاهده معین' : 'بینینی دەفتەر'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">Esc</kbd>
              <span>{language === 'fa' ? 'بستن' : 'داخستن'}</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'معین سریع KarSync' : 'دەفتەری خێرا'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default SubsidiarySearchModal;
