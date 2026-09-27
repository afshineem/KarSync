import React, { useState, useMemo } from 'react';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ChevronRight, 
  ChevronLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Info
} from 'lucide-react';

/**
 * CashFlowChart
 * نمودار میله‌ای دوگانه جریان نقدینگی روزانه در ماه جاری
 * 
 * - محور X: روزهای ماه جاری (۱ الی ۳۰/۳۱)
 * - میله سبز: مجموع ورودی‌های آن روز (شارژ تنخواه و بودجه)
 * - میله قرمز: مجموع خروجی‌های آن روز (دستمزد پرسنل + هزینه‌های کارگاه)
 * - تعاملی همراه با Tooltip هوشمند و انتخاب ماه
 */
export function CashFlowChart({
  chartData,
  selectedMonth,
  setSelectedMonth,
  currency = 'IQD',
  language = 'fa'
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const { points = [], maxDailyAmount = 1, monthTotalInflow, monthTotalOutflow, monthNetBalance } = chartData;

  // تغییر ماه جاری به قبل و بعد
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const newMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    const newMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const isNetPositive = monthNetBalance >= 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-4">
      {/* هدر نمودار و جابجایی ماه */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/60 dark:border-sky-800/60">
            <BarChart3 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {language === 'fa' ? 'نمودار جریان نقدینگی ماهانه (Cash Flow)' : 'هێڵکاری ڕۆیشتنی پارەی مانگانە'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'fa' 
                ? 'مقایسه روزانه ورودی‌های تنخواه در برابر خروجی‌ها (دستمزد پرسنل و هزینه‌ها)' 
                : 'بەراوردی داهات و خەرجی ڕۆژانە'}
            </p>
          </div>
        </div>

        {/* انتخابگر ماه و راهنما */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          {/* راهنمای رنگ‌ها (Legend) */}
          <div className="hidden md:flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block shadow-2xs" />
              <span>{language === 'fa' ? 'ورودی‌ها (تنخواه)' : 'داهات'}</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="w-3 h-3 rounded-md bg-rose-500 inline-block shadow-2xs" />
              <span>{language === 'fa' ? 'خروجی‌ها (حقوق و هزینه‌ها)' : 'خەرجی'}</span>
            </span>
          </div>

          {/* کلیدهای جابجایی ماه */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={handleNextMonth}
              title={language === 'fa' ? 'ماه بعد' : 'مانگی دواتر'}
              className="p-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
              {selectedMonth}
            </span>
            <button
              type="button"
              onClick={handlePrevMonth}
              title={language === 'fa' ? 'ماه قبل' : 'مانگی پێشوو'}
              className="p-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* نوارهای خلاصه ماه جاری */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {language === 'fa' ? 'مجموع ورودی این ماه' : 'کۆی داهاتی ئەم مانگە'}
            </span>
          </div>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
            +{formatCurrency(monthTotalInflow, currency, language)}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {language === 'fa' ? 'مجموع خروجی این ماه' : 'کۆی خەرجی ئەم مانگە'}
            </span>
          </div>
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
            -{formatCurrency(monthTotalOutflow, currency, language)}
          </span>
        </div>

        <div className={`p-3 rounded-2xl border flex items-center justify-between ${
          isNetPositive 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {isNetPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-xs">
              {language === 'fa' ? 'خالص نقدینگی این ماه' : 'باڵانسی پوختی مانگ'}
            </span>
          </div>
          <span className="font-mono font-bold text-xs">
            {formatCurrency(monthNetBalance, currency, language)}
          </span>
        </div>
      </div>

      {/* بخش گرافیکی نمودار میله‌ای دوگانه */}
      <div className="relative pt-6 pb-2">
        {/* هاور تولتیپ هوشمند شناور */}
        {hoveredPoint && (
          <div className="absolute top-0 start-1/2 -translate-x-1/2 z-20 bg-slate-900/95 dark:bg-slate-950/95 text-white backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-slate-700/80 text-xs pointer-events-none flex items-center gap-4 transition-all">
            <div className="font-mono font-bold text-amber-300 border-e border-slate-700 pe-3">
              {hoveredPoint.date}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-mono">
                ورودی: +{formatCurrency(hoveredPoint.inflow, currency, language)}
              </span>
              <span className="text-rose-400 font-mono">
                خروجی: -{formatCurrency(hoveredPoint.outflow, currency, language)}
              </span>
              <span className={`font-mono font-bold ${hoveredPoint.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                تراز: {formatCurrency(hoveredPoint.net, currency, language)}
              </span>
            </div>
          </div>
        )}

        {/* خطوط راهنمای افقی پس‌زمینه */}
        <div className="absolute inset-x-0 top-12 bottom-8 flex flex-col justify-between pointer-events-none opacity-20 dark:opacity-10">
          <div className="border-b border-slate-400 border-dashed w-full" />
          <div className="border-b border-slate-400 border-dashed w-full" />
          <div className="border-b border-slate-400 border-dashed w-full" />
          <div className="border-b border-slate-400 w-full" />
        </div>

        {/* ظرف اصلی میله‌ها */}
        <div className="h-56 sm:h-64 flex items-end justify-between gap-1 sm:gap-1.5 px-1 pt-8 overflow-x-auto">
          {points.map((pt) => {
            // محاسبه درصد ارتفاع هر میله متناسب با حداکثر مقدار
            const inflowHeight = maxDailyAmount > 0 
              ? Math.max(pt.inflow > 0 ? 6 : 0, Math.round((pt.inflow / maxDailyAmount) * 100)) 
              : 0;
            const outflowHeight = maxDailyAmount > 0 
              ? Math.max(pt.outflow > 0 ? 6 : 0, Math.round((pt.outflow / maxDailyAmount) * 100)) 
              : 0;

            const isHovered = hoveredPoint?.day === pt.day;

            return (
              <div
                key={pt.day}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                className={`flex-1 min-w-[16px] sm:min-w-[20px] max-w-[36px] flex flex-col items-center justify-end h-full group cursor-pointer transition-all ${
                  isHovered ? 'scale-105' : ''
                }`}
              >
                {/* میله‌های دوگانه (سبز و قرمز) کنار هم */}
                <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full pb-1">
                  {/* میله سبز (ورودی) */}
                  <div 
                    style={{ height: `${inflowHeight}%` }}
                    className={`w-1/2 rounded-t-sm sm:rounded-t-md transition-all duration-300 ${
                      pt.inflow > 0 
                        ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500 group-hover:to-emerald-300 shadow-xs' 
                        : 'bg-transparent'
                    }`}
                  />

                  {/* میله قرمز (خروجی) */}
                  <div 
                    style={{ height: `${outflowHeight}%` }}
                    className={`w-1/2 rounded-t-sm sm:rounded-t-md transition-all duration-300 ${
                      pt.outflow > 0 
                        ? 'bg-gradient-to-t from-rose-600 to-rose-400 group-hover:from-rose-500 group-hover:to-rose-300 shadow-xs' 
                        : 'bg-transparent'
                    }`}
                  />
                </div>

                {/* برچسب روز در محور X */}
                <span className={`text-[10px] sm:text-[11px] font-mono mt-1 transition-colors ${
                  isHovered 
                    ? 'text-sky-600 dark:text-sky-400 font-bold' 
                    : pt.inflow > 0 || pt.outflow > 0 
                    ? 'text-slate-700 dark:text-slate-300 font-bold' 
                    : 'text-slate-400 dark:text-slate-600'
                }`}>
                  {pt.dayNumber}
                </span>
              </div>
            );
          })}
        </div>

        {/* زیرنویس روزهای ماه محور X */}
        <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-2">
          <span>{language === 'fa' ? 'روزهای ماه' : 'ڕۆژەکانی مانگ'} ({selectedMonth})</span>
        </div>
      </div>
    </div>
  );
}
