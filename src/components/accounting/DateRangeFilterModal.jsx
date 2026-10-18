import React, { useState } from 'react';
import { CalendarRange, X, Calendar, Check, RotateCcw } from 'lucide-react';
import { getCurrentYearMonth } from '../../utils/formatters';

/**
 * DateRangeFilterModal
 * مودال انتخاب بازه زمانی دلخواه برای اسناد دفتر کل و حسابداری
 */
// Scoped dictionary for DateRangeFilterModal
const COPY = {
  fa: {
    title: 'انتخاب بازه زمانی اسناد مالی',
    subtitle: 'فیلتر اسناد ثبت شده بر اساس تاریخ دلخواه یا پیش‌فرض',
    quickPresets: 'بازه‌های زمانی سریع',
    thisMonth: 'این ماه (جاری)',
    lastMonth: 'ماه گذشته',
    last30Days: '۳۰ روز اخیر',
    allDocuments: 'همه اسناد (از ابتدا)',
    orCustom: 'یا انتخاب بازه دلخواه',
    startDate: 'از تاریخ (شروع):',
    endDate: 'تا تاریخ (پایان):',
    showAll: 'نمایش همه',
    cancel: 'انصراف',
    apply: 'اعمال بازه'
  },
  ku: {
    title: 'دیاریکردنی ماوەی کاتی بەڵگەنامەکان',
    subtitle: 'فلتەرکردنی بەڵگەنامە تۆمارکراوەکان بەپێی بەروار',
    quickPresets: 'ماوەی کاتی خێرا',
    thisMonth: 'ئەم مانگە (ئێستا)',
    lastMonth: 'مانگی پێشوو',
    last30Days: '٣٠ ڕۆژی ڕابردوو',
    allDocuments: 'هەموو بەڵگەنامەکان (لە سەرەتاوە)',
    orCustom: 'یان دیاریکردنی ماوەی دڵخواز',
    startDate: 'لە بەرواری (دەستپێک):',
    endDate: 'تا بەرواری (کۆتایی):',
    showAll: 'پیشاندانی هەمووی',
    cancel: 'پاشگەزبوونەوە',
    apply: 'جێبەجێکردن'
  },
  en: {
    title: 'Select Financial Documents Date Range',
    subtitle: 'Filter documents by custom or preset date ranges',
    quickPresets: 'Quick Date Presets',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    last30Days: 'Last 30 Days',
    allDocuments: 'All Documents (All Time)',
    orCustom: 'Or Choose Custom Range',
    startDate: 'Start Date:',
    endDate: 'End Date:',
    showAll: 'Show All',
    cancel: 'Cancel',
    apply: 'Apply Filter'
  }
};

export function DateRangeFilterModal({
  isOpen,
  onClose,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  dateFilterMode,
  setDateFilterMode,
  selectedMonth,
  setSelectedMonth,
  onApply,
  language = 'fa'
}) {
  const txt = COPY[language] || COPY.fa;
  const [startDate, setStartDate] = useState(customStartDate || '');
  const [endDate, setEndDate] = useState(customEndDate || '');

  if (!isOpen) return null;

  const handleApplyCustom = () => {
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
    setDateFilterMode('custom');
    if (onApply) onApply();
    onClose();
  };

  const handleQuickPreset = (preset) => {
    if (preset === 'this_month') {
      setSelectedMonth(getCurrentYearMonth());
      setDateFilterMode('month');
      setCustomStartDate('');
      setCustomEndDate('');
    } else if (preset === 'last_month') {
      setDateFilterMode('last_month');
      setCustomStartDate('');
      setCustomEndDate('');
    } else if (preset === 'last_30_days') {
      const today = new Date();
      const past30 = new Date(today);
      past30.setDate(past30.getDate() - 30);
      const startStr = past30.toISOString().slice(0, 10);
      const endStr = today.toISOString().slice(0, 10);
      setStartDate(startStr);
      setEndDate(endStr);
      setCustomStartDate(startStr);
      setCustomEndDate(endStr);
      setDateFilterMode('custom');
    } else if (preset === 'all') {
      setDateFilterMode('all');
      setCustomStartDate('');
      setCustomEndDate('');
    }
    if (onApply) onApply();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* هدر مودال */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {txt.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {txt.subtitle}
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

        {/* بدنه مودال */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* دکمه‌های بازه سریع */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              {txt.quickPresets}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPreset('this_month')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  dateFilterMode === 'month' || dateFilterMode === 'this_month'
                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {txt.thisMonth}
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('last_month')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  dateFilterMode === 'last_month'
                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {txt.lastMonth}
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('last_30_days')}
                className="px-3 py-2 rounded-xl text-xs font-bold border bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all"
              >
                {txt.last30Days}
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  dateFilterMode === 'all'
                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {txt.allDocuments}
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400">
              {txt.orCustom}
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* فیلدهای تاریخ شروع و پایان */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {txt.startDate}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 ps-9 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {txt.endDate}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 ps-9 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* فوتر مودال */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleQuickPreset('all')}
            className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{txt.showAll}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              {txt.cancel}
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              disabled={!startDate && !endDate}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{txt.apply}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
