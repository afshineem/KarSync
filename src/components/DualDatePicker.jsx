import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  RotateCcw, 
  Check, 
  Sparkles,
  CalendarDays
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  isJalaliCalendar, 
  gregorianToJalali, 
  jalaliToGregorian, 
  getCalendarMonthDetails, 
  getCurrentYearMonth, 
  shiftCalendarMonth, 
  formatMonthWithYear, 
  formatDateDisplay, 
  formatFullDateWithWeekday,
  getTodayDateString,
  convertDigits,
  normalizeDigits
} from '../utils/formatters';

const COPY = {
  fa: {
    today: 'امروز',
    yesterday: 'دیروز',
    clear: 'پاک کردن',
    close: 'بستن',
    selectDate: 'انتخاب تاریخ',
    prevMonth: 'ماه قبل',
    nextMonth: 'ماه بعد',
    monthPicker: 'انتخاب ماه',
    quickPresets: 'میانبرها:',
    weekDaysJalali: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
    weekDaysGregorian: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']
  },
  ku: {
    today: 'ئەمڕۆ',
    yesterday: 'دوێنێ',
    clear: 'سڕینەوە',
    close: 'داخستن',
    selectDate: 'دیاریکردنی بەروار',
    prevMonth: 'مانگی پێشوو',
    nextMonth: 'مانگی داهاتوو',
    monthPicker: 'دیاریکردنی مانگ',
    quickPresets: 'خێرا:',
    weekDaysJalali: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'هـ'],
    weekDaysGregorian: ['ی', 'د', 'س', 'چ', 'پ', 'هـ', 'ش']
  },
  en: {
    today: 'Today',
    yesterday: 'Yesterday',
    clear: 'Clear',
    close: 'Close',
    selectDate: 'Select Date',
    prevMonth: 'Previous Month',
    nextMonth: 'Next Month',
    monthPicker: 'Select Month',
    quickPresets: 'Quick:',
    weekDaysJalali: ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'],
    weekDaysGregorian: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  }
};

/**
 * DualDatePicker
 * کامپوننت انتخابگر تاریخ دوتاریخه (شمسی و میلادی) سازگار با سیستم زبان و طراحی اپل
 * @param {string} value - تاریخ کانونیکال میلادی ISO YYYY-MM-DD
 * @param {function} onChange - بازخوانی با مقدار جدید YYYY-MM-DD
 * @param {string} label - برچسب فیلد
 * @param {string} placeholder - متن راهنما
 * @param {string} accentColor - رنگ تم ('emerald' | 'sky' | 'amber' | 'indigo' | 'rose')
 * @param {boolean} showWeekdayBadge - نمایش برچسب روز هفته
 * @param {boolean} required - اجباری بودن فیلد
 * @param {boolean} disabled - غیرفعال بودن فیلد
 * @param {string} className - کلاس کانتینر
 * @param {string} inputClassName - کلاس سفارشی فیلد اینپوت
 */
export function DualDatePicker({
  value,
  onChange,
  label,
  placeholder,
  accentColor = 'emerald',
  showWeekdayBadge = true,
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  id
}) {
  const { language, calendarType, numberFormat, direction } = useLanguage();
  const isJalali = isJalaliCalendar(calendarType, language);
  const copy = COPY[language] || COPY.fa;

  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState(null);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  const updatePopoverPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverWidth = window.innerWidth >= 640 ? 320 : 288;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 340 && rect.top > spaceBelow;
    const rawLeft = direction === 'rtl' ? rect.left : rect.right - popoverWidth;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - popoverWidth - 8));

    setPopoverPos(
      openUp
        ? { bottom: window.innerHeight - rect.top + 6, left }
        : { top: rect.bottom + 6, left }
    );
  }, [direction]);

  // Derive initial view month from current value or today
  const initialViewMonth = useMemo(() => {
    const targetDate = value || getTodayDateString();
    const parts = targetDate.split(/[-/]/).map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      if (isJalali) {
        const j = gregorianToJalali(parts[0], parts[1], parts[2]);
        return `${j.jy}-${String(j.jm).padStart(2, '0')}`;
      }
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}`;
    }
    return getCurrentYearMonth(calendarType, language);
  }, [value, isJalali, calendarType, language]);

  const [viewMonth, setViewMonth] = useState(initialViewMonth);

  // Sync viewMonth when modal opens or value changes meaningfully
  useEffect(() => {
    if (isOpen) {
      setViewMonth(initialViewMonth);
    }
  }, [isOpen, initialViewMonth]);

  // Click outside, Escape key, and viewport position sync
  useEffect(() => {
    if (!isOpen) {
      setPopoverPos(null);
      return;
    }

    updatePopoverPosition();

    const handleClickOutside = (e) => {
      const clickedContainer = containerRef.current && containerRef.current.contains(e.target);
      const clickedPopover = popoverRef.current && popoverRef.current.contains(e.target);
      if (!clickedContainer && !clickedPopover) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', updatePopoverPosition, true);
    window.addEventListener('resize', updatePopoverPosition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      window.removeEventListener('resize', updatePopoverPosition);
    };
  }, [isOpen, updatePopoverPosition]);

  // Month breakdown details
  const monthDetails = useMemo(() => {
    return getCalendarMonthDetails(viewMonth, calendarType, language);
  }, [viewMonth, calendarType, language]);

  // Calendar grid days with leading blanks
  const calendarDays = useMemo(() => {
    if (!monthDetails) return [];
    const days = [];
    const blankSlots = isJalali
      ? (monthDetails.firstDayOfWeek + 1) % 7
      : monthDetails.firstDayOfWeek;

    for (let i = 0; i < blankSlots; i++) {
      days.push(null);
    }

    monthDetails.days.forEach((d) => {
      days.push(d);
    });

    return days;
  }, [monthDetails, isJalali]);

  // Display text in input field
  const displayValue = useMemo(() => {
    if (!value) return '';
    return formatDateDisplay(value, language, numberFormat, calendarType);
  }, [value, language, numberFormat, calendarType]);

  // Month navigation handlers
  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewMonth((prev) => shiftCalendarMonth(prev, -1, calendarType, language));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewMonth((prev) => shiftCalendarMonth(prev, 1, calendarType, language));
  };

  // Day selection handler
  const handleSelectDay = (dayDateStr) => {
    if (onChange) {
      onChange(dayDateStr);
    }
    setIsOpen(false);
  };

  // Quick Preset Handlers
  const handleSelectToday = (e) => {
    e.stopPropagation();
    const today = getTodayDateString();
    if (onChange) onChange(today);
    setIsOpen(false);
  };

  const handleSelectYesterday = (e) => {
    e.stopPropagation();
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const yStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (onChange) onChange(yStr);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) onChange('');
    setIsOpen(false);
  };

  // Month title formatted
  const monthTitle = useMemo(() => {
    return formatMonthWithYear(viewMonth, language, calendarType, numberFormat);
  }, [viewMonth, language, calendarType, numberFormat]);

  // Weekday column header labels
  const weekDayLabels = isJalali ? copy.weekDaysJalali : copy.weekDaysGregorian;

  // Today ISO date string
  const todayStr = useMemo(() => getTodayDateString(), []);

  // Accent color classes mapping
  const colorMap = {
    emerald: {
      ring: 'focus:ring-emerald-500',
      border: 'border-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
      bgActive: 'bg-emerald-600 text-white',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    },
    sky: {
      ring: 'focus:ring-sky-500',
      border: 'border-sky-500',
      text: 'text-sky-600 dark:text-sky-400',
      bgActive: 'bg-sky-600 text-white',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
    },
    amber: {
      ring: 'focus:ring-amber-500',
      border: 'border-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      bgActive: 'bg-amber-600 text-white',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    },
    indigo: {
      ring: 'focus:ring-indigo-500',
      border: 'border-indigo-500',
      text: 'text-indigo-600 dark:text-indigo-400',
      bgActive: 'bg-indigo-600 text-white',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
    },
    rose: {
      ring: 'focus:ring-rose-500',
      border: 'border-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      bgActive: 'bg-rose-600 text-white',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
    }
  };

  const theme = colorMap[accentColor] || colorMap.emerald;

  // Direct manual text change parsing (e.g. typing 1405/08/23 or 2026-11-13)
  const handleInputChange = (e) => {
    const raw = normalizeDigits(e.target.value.trim());
    if (!raw) {
      if (onChange) onChange('');
      return;
    }

    const parts = raw.split(/[-/.]/).map(Number);
    if (parts.length === 3 && parts[0] > 0 && parts[1] > 0 && parts[2] > 0) {
      const y = parts[0];
      const m = parts[1];
      const d = parts[2];
      if (isJalali) {
        if (y >= 1300 && y <= 1500 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const g = jalaliToGregorian(y, m, d);
          if (onChange) onChange(g.dateString);
        }
      } else {
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (onChange) onChange(iso);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Optional Top Label */}
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={id} className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {showWeekdayBadge && value && (
            <span className={`text-[11px] font-bold font-mono ${theme.text}`}>
              {formatFullDateWithWeekday(value, language, numberFormat, calendarType)}
            </span>
          )}
        </div>
      )}

      {/* Input Box with Click Trigger */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          readOnly
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder || (isJalali ? '۱۴۰۵/۰۸/۲۳' : 'YYYY-MM-DD')}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full px-3.5 py-2 pe-9 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white cursor-pointer select-none transition-all shadow-xs focus:outline-none focus:ring-2 ${theme.ring} ${
            isOpen ? `ring-2 ${theme.ring} border-transparent` : ''
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${inputClassName}`}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          title={copy.selectDate}
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday badge below input (when no top label is used) */}
      {!label && showWeekdayBadge && value && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold">
          <CalendarDays className={`w-3.5 h-3.5 ${theme.text}`} />
          <span className={theme.text}>
            {formatFullDateWithWeekday(value, language, numberFormat, calendarType)}
          </span>
        </div>
      )}

      {/* Calendar Popover Dropdown (portaled to body to escape card stacking contexts) */}
      {isOpen && popoverPos && createPortal(
        <div
          ref={popoverRef}
          dir={direction}
          style={{ position: 'fixed', zIndex: 9999, ...popoverPos }}
          className="w-72 sm:w-80 p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header: Month Navigator */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={copy.prevMonth}
            >
              {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              {monthTitle}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={copy.nextMonth}
            >
              {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1.5">
            {weekDayLabels.map((lbl, idx) => (
              <div key={idx} className="py-0.5">
                {lbl}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((d, idx) => {
              if (!d) {
                return (
                  <div key={`blank_${idx}`} className="h-8 w-full rounded-lg opacity-10" />
                );
              }

              const isSelected = d.dateStr === value;
              const isToday = d.dateStr === todayStr;

              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => handleSelectDay(d.dateStr)}
                  className={`h-8 w-full rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center relative ${
                    isSelected
                      ? `${theme.bgActive} shadow-xs font-black scale-105 z-10`
                      : isToday
                      ? 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500 font-extrabold'
                      : d.isFriday
                      ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>
                    {convertDigits(d.dayNumber, numberFormat)}
                  </span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-sky-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer: Quick presets (Today, Yesterday, Clear) */}
          <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2 py-1 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {copy.today}
              </button>
              <button
                type="button"
                onClick={handleSelectYesterday}
                className="px-2 py-1 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {copy.yesterday}
              </button>
            </div>

            <div className="flex items-center gap-1">
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-1 rounded-md text-[10px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  {copy.clear}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 py-1 rounded-md text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {copy.close}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
export default DualDatePicker;
