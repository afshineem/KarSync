import { pushLogsLive, deleteLogLive } from '../services/realtimeSync';
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, getAttendanceLogId } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  formatIQD, 
  getCurrentYearMonth, 
  formatDateDisplay, 
  toDecimalHours, 
  fromDecimalHours, 
  formatHoursAndMinutes,
  formatTileHours,
  roundIQD
} from '../utils/formatters';
import { 
  Calendar, 
  Check, 
  Clock, 
  X, 
  Sparkles, 
  Coins, 
  Trash2, 
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const MONTH_NAMES = {
  ku: [
    'کانوونی دووەم (Jan)', 'شوبات (Feb)', 'ئازار (Mar)', 'نیسان (Apr)',
    'ئایار (May)', 'حوزەیران (Jun)', 'تەممووز (Jul)', 'ئاب (Aug)',
    'ئەیلوول (Sep)', 'تشرینی یەکەم (Oct)', 'تشرینی دووەم (Nov)', 'کانوونی یەکەم (Dec)'
  ],
  fa: [
    'ژانویه (Jan)', 'فوریه (Feb)', 'مارس (Mar)', 'آوریل (Apr)',
    'مه (May)', 'ژوئن (Jun)', 'ژوئیه (Jul)', 'اوت (Aug)',
    'سپتامبر (Sep)', 'اکتبر (Oct)', 'نوامبر (Nov)', 'دسامبر (Dec)'
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
};

export function QuickMonthAttendanceModal({ worker, isOpen, onClose }) {
  const { t, language, direction } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  
  // dayConfigs map: dateStr ('YYYY-MM-DD') -> { type: 'full'|'half'|'hourly', overtimeHours: number, notes: string }
  const [dayConfigs, setDayConfigs] = useState({});
  const [selectedDayDate, setSelectedDayDate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Fetch existing logs for this worker and month
  const existingLogs = useLiveQuery(
    () => {
      if (!worker || !isOpen) return [];
      return db.attendanceLogs
        .where('workerId')
        .equals(worker.id)
        .filter((l) => l.date.startsWith(selectedMonth))
        .toArray();
    },
    [worker?.id, selectedMonth, isOpen]
  ) || [];

  // When existing logs or month changes, populate dayConfigs
  useEffect(() => {
    if (!isOpen || !worker) return;
    const initialConfigs = {};
    existingLogs.forEach((l) => {
      initialConfigs[l.date] = {
        type: l.type || 'full',
        overtimeHours: Number(l.overtimeHours) || 0,
        notes: l.notes || ''
      };
    });
    setDayConfigs(initialConfigs);
  }, [existingLogs.length, selectedMonth, isOpen, worker?.id]);

  // Month navigation: previous and next month
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(prevStr);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextStr);
  };

  // Formatted display for current month
  const monthDisplayTitle = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const names = MONTH_NAMES[language] || MONTH_NAMES.fa;
    const monthName = names[m - 1] || `${m}`;
    return `${monthName} ${y}`;
  }, [selectedMonth, language]);

  // Calendar days array for the selected month
  const monthDays = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const firstDayIndex = new Date(y, m - 1, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(y, m, 0).getDate();

    const days = [];
    // Leading blanks
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Days 1..daysInMonth
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(dateStr).getDay();
      days.push({
        dayNumber: d,
        dateStr,
        dayOfWeek,
        isFriday: dayOfWeek === 5
      });
    }
    return days;
  }, [selectedMonth]);

  // Click on a day tile:
  // - If day is absent (not active): mark as Full Day and select day
  // - If day is already active but not selected: select it so Day Inspector opens below without altering status
  // - If day is already selected: cycle type (Full -> Half -> Hourly -> Absent)
  const handleDayTileClick = (dateStr) => {
    const current = dayConfigs[dateStr];
    if (!current) {
      setSelectedDayDate(dateStr);
      setDayConfigs((prev) => ({
        ...prev,
        [dateStr]: { type: 'full', overtimeHours: 0, notes: '' }
      }));
      return;
    }

    if (selectedDayDate !== dateStr) {
      setSelectedDayDate(dateStr);
      return;
    }

    // Already selected: cycle states
    setDayConfigs((prev) => {
      const cur = prev[dateStr];
      if (!cur) return prev;
      if (cur.type === 'full') {
        return {
          ...prev,
          [dateStr]: { ...cur, type: 'half' }
        };
      } else if (cur.type === 'half') {
        return {
          ...prev,
          [dateStr]: { ...cur, type: 'hourly', overtimeHours: cur.overtimeHours > 0 ? cur.overtimeHours : 1 }
        };
      } else {
        // Remove / Mark Absent
        const updated = { ...prev };
        delete updated[dateStr];
        setSelectedDayDate(null);
        return updated;
      }
    });
  };

  // Adjust overtime hours for an active day
  const handleOvertimeChange = (dateStr, delta) => {
    setSelectedDayDate(dateStr);
    setDayConfigs((prev) => {
      const current = prev[dateStr] || { type: 'full', overtimeHours: 0, notes: '' };
      const currentOt = Number(current.overtimeHours) || 0;
      const newOt = Number(Math.max(0, currentOt + delta).toFixed(4));
      return {
        ...prev,
        [dateStr]: { ...current, overtimeHours: newOt }
      };
    });
  };

  // Quick increment/decrement minutes for the currently selected day in the inspector
  const addMinutesToSelectedDay = (delta) => {
    if (!selectedDayDate) return;
    setDayConfigs((prev) => {
      const cur = prev[selectedDayDate] || { type: 'full', overtimeHours: 0, notes: '' };
      const { hours, minutes } = fromDecimalHours(cur.overtimeHours);
      let totalM = hours * 60 + minutes + delta;
      if (totalM < 0) totalM = 0;
      const newH = Math.min(24, Math.floor(totalM / 60));
      const newM = newH >= 24 ? 0 : totalM % 60;
      const dec = toDecimalHours(newH, newM);
      return {
        ...prev,
        [selectedDayDate]: { ...cur, overtimeHours: dec }
      };
    });
  };

  // Quick Action 1: Select first 15 days of the month (excluding Fridays)
  const handleSelectFirst15Days = () => {
    setDayConfigs((prev) => {
      const updated = { ...prev };
      const [y, m] = selectedMonth.split('-').map(Number);
      const daysCount = Math.min(15, new Date(y, m, 0).getDate());

      for (let d = 1; d <= daysCount; d++) {
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const isFriday = new Date(dateStr).getDay() === 5;
        if (!isFriday) {
          if (!updated[dateStr]) {
            updated[dateStr] = { type: 'full', overtimeHours: 0, notes: '' };
          }
        }
      }
      return updated;
    });
  };

  // Quick Action 2: Select all workdays of the month (excluding Fridays)
  const handleSelectAllExceptFridays = () => {
    setDayConfigs((prev) => {
      const updated = { ...prev };
      const [y, m] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const isFriday = new Date(dateStr).getDay() === 5;
        if (!isFriday) {
          if (!updated[dateStr]) {
            updated[dateStr] = { type: 'full', overtimeHours: 0, notes: '' };
          }
        }
      }
      return updated;
    });
  };

  // Quick Action 3: Clear all
  const handleClearAll = () => {
    setDayConfigs({});
    setSelectedDayDate(null);
  };

  // Live calculation metrics
  const totals = useMemo(() => {
    let fullDays = 0;
    let halfDays = 0;
    let hourlyDays = 0;
    let totalOt = 0;
    let totalHourlyHours = 0;
    let basePay = 0;
    let otPay = 0;

    const effectiveHourlyRate = worker?.overtimeHourlyRate > 0 
      ? worker.overtimeHourlyRate 
      : Math.round((worker?.dailyRate || 0) / 8);

    Object.values(dayConfigs).forEach((cfg) => {
      const otHours = Math.max(0, Number(cfg.overtimeHours) || 0);
      if (cfg.type === 'hourly') {
        hourlyDays += 1;
        totalHourlyHours += otHours;
        otPay += roundIQD(otHours * effectiveHourlyRate);
      } else if (cfg.type === 'half') {
        halfDays += 1;
        totalOt += otHours;
        basePay += roundIQD((worker?.dailyRate || 0) * 0.5);
        otPay += roundIQD(otHours * (worker?.overtimeHourlyRate || 0));
      } else {
        fullDays += 1;
        totalOt += otHours;
        basePay += roundIQD(worker?.dailyRate || 0);
        otPay += roundIQD(otHours * (worker?.overtimeHourlyRate || 0));
      }
    });

    const effectiveDays = fullDays + (halfDays * 0.5);
    const grandTotal = roundIQD(basePay + otPay);

    return {
      activeCount: Object.keys(dayConfigs).length,
      fullDays,
      halfDays,
      hourlyDays,
      effectiveDays: Number(effectiveDays.toFixed(1)),
      totalOt: Number(totalOt.toFixed(4)),
      totalHourlyHours: Number(totalHourlyHours.toFixed(4)),
      basePay: roundIQD(basePay),
      otPay: roundIQD(otPay),
      grandTotal
    };
  }, [dayConfigs, worker?.dailyRate, worker?.overtimeHourlyRate]);

  // Save changes to IndexedDB
  const handleSave = async () => {
    if (!worker) return;
    setIsSaving(true);

    try {
      const newLogs = [];
      await db.transaction('rw', db.attendanceLogs, async () => {
        // 1. Delete previous logs for this worker for the selected month
        const oldLogs = await db.attendanceLogs
          .where('workerId')
          .equals(worker.id)
          .filter((l) => l.date.startsWith(selectedMonth))
          .toArray();
        
        for (const ol of oldLogs) {
          await db.attendanceLogs.delete(ol.id);
          deleteLogLive(ol.id).catch(() => {});
        }

        // 2. Insert all configured days
        for (const [dateStr, cfg] of Object.entries(dayConfigs)) {
          const otHours = Math.max(0, Number(cfg.overtimeHours) || 0);
          let calculatedDailyWage = 0;
          let calculatedOvertimeWage = 0;

          if (cfg.type === 'hourly') {
            const effectiveHourlyRate = worker.overtimeHourlyRate > 0 
              ? worker.overtimeHourlyRate 
              : Math.round(worker.dailyRate / 8);
            calculatedDailyWage = 0;
            calculatedOvertimeWage = roundIQD(otHours * effectiveHourlyRate);
          } else {
            const factor = cfg.type === 'half' ? 0.5 : 1.0;
            calculatedDailyWage = roundIQD(worker.dailyRate * factor);
            calculatedOvertimeWage = roundIQD(otHours * (worker.overtimeHourlyRate || 0));
          }
          const totalDayPay = roundIQD(calculatedDailyWage + calculatedOvertimeWage);

          newLogs.push({
            id: getAttendanceLogId(worker.id, dateStr),
            workerId: worker.id,
            date: dateStr,
            type: cfg.type,
            overtimeHours: otHours,
            calculatedDailyWage,
            calculatedOvertimeWage,
            totalDayPay,
            notes: cfg.notes || '',
            createdAt: new Date(dateStr).toISOString()
          });
        }

        if (newLogs.length > 0) {
          await db.attendanceLogs.bulkPut(newLogs);
        }
      });

      // Realtime push to Supabase
      if (newLogs.length > 0) {
        pushLogsLive(newLogs).catch((err) => console.warn('Supabase live push warning:', err));
      }

      setToastMessage(t('savedQuickAttendanceSuccess', { days: totals.effectiveDays, name: worker.name }));
      setTimeout(() => {
        setToastMessage('');
        onClose();
      }, 900);

    } catch (err) {
      console.error('Error saving quick month attendance:', err);
      alert('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Weekday column headers
  const weekDayLabels = language === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : language === 'fa'
    ? ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه']
    : ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'];

  if (!isOpen || !worker) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-4 sm:p-6 shadow-2xl my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('quickMonthlyAttendance')}</span>
                <span className="text-sky-600 dark:text-sky-400 font-semibold">• {worker.name}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('quickMonthSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Toast */}
        {toastMessage && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
            <Check className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Month Selector with Previous / Next Month Arrows & Quick Preset Buttons */}
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Robust Month Navigator: < Previous Month | Month Display | Next Month > */}
          <div className="flex items-center justify-between sm:justify-start gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              type="button"
              onClick={direction === 'rtl' ? handleNextMonth : handlePrevMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 text-xs font-semibold"
              title={language === 'fa' ? 'ماه قبل' : language === 'ku' ? 'مانگی پێشوو' : 'Previous Month'}
            >
              {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {language === 'fa' ? 'ماه قبل' : language === 'ku' ? 'مانگی پێشوو' : 'Prev'}
              </span>
            </button>

            {/* Current Month Name Display & Direct Month Picker */}
            <div className="relative px-2 py-1 flex items-center justify-center">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white whitespace-nowrap text-center">
                {monthDisplayTitle}
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="کلیک برای انتخاب مستقیم ماه از تقویم"
              />
            </div>

            <button
              type="button"
              onClick={direction === 'rtl' ? handlePrevMonth : handleNextMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 text-xs font-semibold"
              title={language === 'fa' ? 'ماه بعد' : language === 'ku' ? 'مانگی داهاتوو' : 'Next Month'}
            >
              <span className="hidden sm:inline">
                {language === 'fa' ? 'ماه بعد' : language === 'ku' ? 'مانگی داهاتوو' : 'Next'}
              </span>
              {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium self-end sm:self-auto">
            <button
              type="button"
              onClick={handleSelectFirst15Days}
              className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1"
              title="تیک زدن خودکار روزهای ۱ تا ۱۵ این ماه"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('selectFirst15Days')}</span>
            </button>
            <button
              type="button"
              onClick={handleSelectAllExceptFridays}
              className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors font-medium"
              title="تیک زدن همه روزهای کاری ماه"
            >
              {t('selectAllExceptFridays')}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
              title={t('clearAllDays')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Tip Banner */}
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 px-1">
          <Info className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
          <span>{t('clickToToggleTip')}</span>
        </div>

        {/* Mini Calendar Grid */}
        <div className="my-3 overflow-y-auto flex-1 pe-1">
          
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 text-center text-[11px] font-bold text-slate-400">
            {weekDayLabels.map((name, i) => (
              <div key={i} className="py-1">
                {name}
              </div>
            ))}
          </div>

          {/* Day tiles */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {monthDays.map((day, idx) => {
              if (!day) {
                return (
                  <div 
                    key={`blank_${idx}`} 
                    className="min-h-[60px] sm:min-h-[70px] bg-slate-50/40 dark:bg-slate-800/20 rounded-xl opacity-30" 
                  />
                );
              }

              const cfg = dayConfigs[day.dateStr];
              const isFull = cfg && cfg.type === 'full';
              const isHalf = cfg && cfg.type === 'half';
              const isHourly = cfg && cfg.type === 'hourly';
              const isActive = !!cfg;
              const isSelected = selectedDayDate === day.dateStr;

              return (
                <div
                  key={day.dateStr}
                  className={`min-h-[64px] sm:min-h-[74px] p-1.5 rounded-xl border flex flex-col justify-between select-none transition-all ${
                    isSelected
                      ? 'ring-2 ring-sky-500 ring-offset-1 dark:ring-offset-slate-900 z-10'
                      : ''
                  } ${
                    isFull
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 shadow-sm'
                      : isHalf
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 shadow-sm'
                      : isHourly
                      ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-400 dark:border-purple-700 shadow-sm'
                      : day.isFriday
                      ? 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:bg-slate-50/60'
                  }`}
                >
                  {/* Clickable Day Area */}
                  <div
                    onClick={() => handleDayTileClick(day.dateStr)}
                    className="cursor-pointer flex-1 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${
                        isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {day.dayNumber}
                      </span>

                      {isFull && (
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                          ✓
                        </span>
                      )}
                      {isHalf && (
                        <span className="px-1 py-0.2 rounded bg-amber-500 text-white text-[9px] font-bold">
                          ½
                        </span>
                      )}
                      {isHourly && (
                        <span className="px-1 py-0.2 rounded bg-purple-600 text-white text-[8px] font-bold">
                          ⏱
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] font-semibold mt-1">
                      {isFull ? (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {language === 'en' ? '1.0 Day' : language === 'fa' ? '۱ روز' : '١ ڕۆژ'}
                        </span>
                      ) : isHalf ? (
                        <span className="text-amber-700 dark:text-amber-300">
                          {language === 'en' ? '0.5 Day' : language === 'fa' ? 'نیم‌روز' : 'نیوەڕۆژ'}
                        </span>
                      ) : isHourly ? (
                        <span className="text-purple-700 dark:text-purple-300 truncate block">
                          {language === 'en' ? 'Hourly' : language === 'fa' ? 'ساعتی' : 'سەعاتی'}
                        </span>
                      ) : day.isFriday ? (
                        <span className="text-slate-400 text-[9px]">
                          {language === 'en' ? 'Fri' : language === 'fa' ? 'جمعه' : 'هەینی'}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-[9px]">-</span>
                      )}
                    </div>
                  </div>

                  {/* Overtime or Worked Hours Stepper / Badge (Only when day is active) */}
                  {isActive && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDayDate(day.dateStr);
                      }}
                      className="mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] cursor-pointer"
                      title={cfg.overtimeHours > 0 ? formatHoursAndMinutes(cfg.overtimeHours, language) : (isHourly ? '0h' : t('overtime'))}
                    >
                      <span className={`font-extrabold px-1 py-0.5 rounded text-[10px] ${
                        isHourly 
                          ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' 
                          : cfg.overtimeHours > 0
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                          : 'text-slate-400 dark:text-slate-500 font-normal'
                      }`}>
                        {cfg.overtimeHours > 0 || isHourly
                          ? formatTileHours(cfg.overtimeHours, isHourly, language)
                          : '+۰'}
                      </span>
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOvertimeChange(day.dateStr, 0.5)}
                          className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 hover:bg-sky-500 hover:text-white flex items-center justify-center text-[9px] font-bold"
                          title="+30 min"
                        >
                          +
                        </button>
                        {cfg.overtimeHours > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOvertimeChange(day.dateStr, -0.5)}
                            className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white flex items-center justify-center text-[9px] font-bold"
                            title="-30 min"
                          >
                            -
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>

        {/* Inline Day Inspector for Granular Hours and Minutes */}
        {selectedDayDate && (
          <div className="mb-3 p-3 bg-sky-50/80 dark:bg-sky-950/40 rounded-2xl border border-sky-200 dark:border-sky-800 shadow-sm animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              
              {/* Day info */}
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-extrabold text-xs flex items-center justify-center">
                  {selectedDayDate.split('-')[2]}
                </span>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatDateDisplay(selectedDayDate, language)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    {dayConfigs[selectedDayDate] ? (
                      dayConfigs[selectedDayDate].type === 'hourly'
                        ? t('hourlyOnlyOption')
                        : dayConfigs[selectedDayDate].type === 'half'
                        ? t('halfDayOption')
                        : t('fullDayOption')
                    ) : (language === 'fa' ? 'غایب / ثبت نشده' : 'Absent')}
                  </span>
                </div>
              </div>

              {/* Day Type Selector */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    const cur = dayConfigs[selectedDayDate] || { overtimeHours: 0, notes: '' };
                    setDayConfigs(prev => ({ ...prev, [selectedDayDate]: { ...cur, type: 'full' } }));
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    dayConfigs[selectedDayDate]?.type === 'full'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t('fullDayOption')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = dayConfigs[selectedDayDate] || { overtimeHours: 0, notes: '' };
                    setDayConfigs(prev => ({ ...prev, [selectedDayDate]: { ...cur, type: 'half' } }));
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    dayConfigs[selectedDayDate]?.type === 'half'
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t('halfDayOption')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = dayConfigs[selectedDayDate] || { overtimeHours: 0, notes: '' };
                    setDayConfigs(prev => ({ 
                      ...prev, 
                      [selectedDayDate]: { 
                        ...cur, 
                        type: 'hourly', 
                        overtimeHours: cur.overtimeHours > 0 ? cur.overtimeHours : 1 
                      } 
                    }));
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    dayConfigs[selectedDayDate]?.type === 'hourly'
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t('hourlyOnlyOption')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDayConfigs(prev => {
                      const cp = { ...prev };
                      delete cp[selectedDayDate];
                      return cp;
                    });
                    setSelectedDayDate(null);
                  }}
                  className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  title="حذف / غایب"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Exact Hours & Minutes Stepper and Quick Presets */}
              {dayConfigs[selectedDayDate] && (() => {
                const cur = dayConfigs[selectedDayDate];
                const { hours, minutes } = fromDecimalHours(cur.overtimeHours);
                const isHourly = cur.type === 'hourly';
                return (
                  <div className="flex flex-col gap-1.5 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${isHourly ? 'text-purple-500' : 'text-amber-500'}`} />
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                        {isHourly ? t('workedTimeLabel') : t('overtimeHoursLabel')}:
                      </span>
                      
                      {/* Inputs in LTR for clean numbers */}
                      <div className="flex items-center gap-1 direction-ltr">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-1 py-0.5 border border-slate-200 dark:border-slate-700">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            value={hours}
                            onChange={(e) => {
                              const newH = Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0));
                              const dec = toDecimalHours(newH, minutes);
                              setDayConfigs(prev => ({
                                ...prev,
                                [selectedDayDate]: { ...prev[selectedDayDate], overtimeHours: dec }
                              }));
                            }}
                            className="w-9 font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none text-xs"
                            title={t('hoursLabel')}
                          />
                          <span className="text-[10px] text-slate-400 ms-0.5 pe-1">{t('hourShort')}</span>
                        </div>
                        <span className="text-slate-400 font-bold">:</span>
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-1 py-0.5 border border-slate-200 dark:border-slate-700">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={minutes}
                            onChange={(e) => {
                              const newM = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
                              const dec = toDecimalHours(hours, newM);
                              setDayConfigs(prev => ({
                                ...prev,
                                [selectedDayDate]: { ...prev[selectedDayDate], overtimeHours: dec }
                              }));
                            }}
                            className="w-9 font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none text-xs"
                            title={t('minutesLabel')}
                          />
                          <span className="text-[10px] text-slate-400 ms-0.5 pe-1">{t('minuteShort')}</span>
                        </div>
                      </div>

                      {/* Readable confirmation label */}
                      {cur.overtimeHours > 0 && (
                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                          ({formatHoursAndMinutes(cur.overtimeHours, language)})
                        </span>
                      )}
                    </div>

                    {/* Quick Add minute preset buttons */}
                    <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {language === 'en' ? 'Quick:' : language === 'fa' ? 'سریع:' : 'خێرا:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => addMinutesToSelectedDay(15)}
                        className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-700 dark:text-slate-200 hover:text-sky-700 rounded text-[10px] font-semibold transition-colors"
                      >
                        +15د
                      </button>
                      <button
                        type="button"
                        onClick={() => addMinutesToSelectedDay(30)}
                        className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-700 dark:text-slate-200 hover:text-sky-700 rounded text-[10px] font-semibold transition-colors"
                      >
                        +30د
                      </button>
                      <button
                        type="button"
                        onClick={() => addMinutesToSelectedDay(60)}
                        className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-700 dark:text-slate-200 hover:text-sky-700 rounded text-[10px] font-semibold transition-colors"
                      >
                        +1س
                      </button>
                      <button
                        type="button"
                        onClick={() => addMinutesToSelectedDay(120)}
                        className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-700 dark:text-slate-200 hover:text-sky-700 rounded text-[10px] font-semibold transition-colors"
                      >
                        +2س
                      </button>
                      {cur.overtimeHours > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDayConfigs(prev => ({
                              ...prev,
                              [selectedDayDate]: { ...prev[selectedDayDate], overtimeHours: 0 }
                            }));
                          }}
                          className="px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 rounded text-[10px] font-semibold transition-colors"
                          title="صفر کردن"
                        >
                          0
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Optional Notes Input for the Selected Day */}
            {dayConfigs[selectedDayDate] && (
              <div className="mt-2 pt-2 border-t border-sky-100 dark:border-sky-900/60 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {t('notes')}:
                </span>
                <input
                  type="text"
                  value={dayConfigs[selectedDayDate]?.notes || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDayConfigs(prev => ({
                      ...prev,
                      [selectedDayDate]: { ...prev[selectedDayDate], notes: val }
                    }));
                  }}
                  placeholder={t('notesOptional')}
                  className="w-full text-xs px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Live Calculation Summary Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">{t('effectiveDaysTotal')}</span>
            <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
              {totals.effectiveDays} {t('normalDays')}
              {totals.hourlyDays > 0 && (
                <span className="text-xs text-purple-600 dark:text-purple-400 block font-normal">
                  +{totals.hourlyDays} {language === 'fa' ? 'روز ساعتی' : 'سەعاتی'}
                </span>
              )}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">{t('totalOvertimeHours')}</span>
            <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
              {formatHoursAndMinutes(Number((totals.totalOt + totals.totalHourlyHours).toFixed(4)), language)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">{t('netSalary')}</span>
            <span className="text-sm sm:text-base font-extrabold text-sky-600 dark:text-sky-400">
              {formatIQD(totals.grandTotal, language)}
            </span>
          </div>
        </div>

        {/* Modal Footer: Save & Cancel Buttons */}
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span>{totals.activeCount} {t('monthlyWorkingDays')}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white font-semibold text-xs rounded-xl shadow-md shadow-sky-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? t('savingAttendance') : t('saveQuickAttendance')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
