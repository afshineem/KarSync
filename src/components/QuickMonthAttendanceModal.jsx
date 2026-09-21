import { pushLogsLive, deleteLogLive } from '../services/realtimeSync';
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, getAttendanceLogId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { 
  formatCurrency, 
  getCurrentYearMonth, 
  formatDateDisplay, 
  toDecimalHours, 
  fromDecimalHours, 
  formatHoursAndMinutes,
  formatTileHours,
  roundCurrency,
  getCurrencySymbol
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
  ChevronRight,
  SlidersHorizontal,
  Layers
} from 'lucide-react';

const MONTH_NAMES = {
  ku: [
    'کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان',
    'ئایار', 'حوزەیران', 'تەممووز', 'ئاب',
    'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'
  ],
  fa: [
    'ژانویه', 'فوریه', 'مارس', 'آوریل',
    'مه', 'ژوئن', 'ژوئیه', 'اوت',
    'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
};

export function QuickMonthAttendanceModal({ worker, isOpen, onClose }) {
  const { t, language, direction } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';
  const standardHours = currentProject?.standardWorkHours || 8;

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list'
  
  // dayConfigs map: dateStr ('YYYY-MM-DD') -> { type: 'full'|'half'|'hourly', overtimeHours: number, notes: string }
  const [dayConfigs, setDayConfigs] = useState({});
  const [selectedDayDate, setSelectedDayDate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // Fetch project sections for current project
  const projectSections = useLiveQuery(
    async () => {
      if (!targetProjectId) return [];
      return await db.projectSections.where('projectId').equals(targetProjectId).toArray();
    },
    [targetProjectId]
  ) || [];

  const [defaultSectionId, setDefaultSectionId] = useState('');

  useEffect(() => {
    if (worker?.defaultSectionId) {
      setDefaultSectionId(worker.defaultSectionId);
    } else {
      setDefaultSectionId('');
    }
  }, [worker?.id, worker?.defaultSectionId, isOpen]);

  // Fetch existing logs for this worker and month in active project with fallback
  const existingLogs = useLiveQuery(
    async () => {
      if (!worker || !isOpen) return [];
      const list = await db.attendanceLogs.where('workerId').equals(worker.id).toArray();
      return list.filter((l) => (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId && l.date.startsWith(selectedMonth));
    },
    [worker?.id, selectedMonth, isOpen, targetProjectId]
  ) || [];

  // When existing logs or month changes, populate dayConfigs
  useEffect(() => {
    if (!isOpen || !worker) return;
    const initialConfigs = {};
    existingLogs.forEach((l) => {
      initialConfigs[l.date] = {
        type: l.type || 'full',
        overtimeHours: Number(l.overtimeHours) || 0,
        notes: l.notes || '',
        sectionId: l.sectionId || ''
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

  // Formatted display for current month (ONLY month name)
  const monthDisplayTitle = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const names = MONTH_NAMES[language] || MONTH_NAMES.fa;
    return names[m - 1] || `${m}`;
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

  // Direct 1-Click Day Tile Toggle:
  const handleDayTileClick = (dateStr) => {
    const current = dayConfigs[dateStr];
    if (!current) {
      setDayConfigs((prev) => ({
        ...prev,
        [dateStr]: { 
          type: 'full', 
          overtimeHours: 0, 
          notes: '', 
          sectionId: defaultSectionId || null 
        }
      }));
      return;
    }

    if (current.type === 'full') {
      // Toggle off to absent
      setDayConfigs((prev) => {
        const updated = { ...prev };
        delete updated[dateStr];
        return updated;
      });
      if (selectedDayDate === dateStr) {
        setSelectedDayDate(null);
      }
      return;
    }

    // If it was half or hourly, toggle to standard full day
    setDayConfigs((prev) => ({
      ...prev,
      [dateStr]: { ...prev[dateStr], type: 'full' }
    }));
  };

  // Adjust overtime hours for an active day
  const handleOvertimeChange = (dateStr, delta) => {
    setSelectedDayDate(dateStr);
    setDayConfigs((prev) => {
      const current = prev[dateStr] || { 
        type: 'full', 
        overtimeHours: 0, 
        notes: '', 
        sectionId: defaultSectionId || null 
      };
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
      const cur = prev[selectedDayDate] || { 
        type: 'full', 
        overtimeHours: 0, 
        notes: '', 
        sectionId: defaultSectionId || null 
      };
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

  // Quick Action 1: Select all days of the month
  const handleSelectAllDays = () => {
    setDayConfigs((prev) => {
      const updated = { ...prev };
      const [y, m] = selectedMonth.split('-').map(Number);
      const daysCount = new Date(y, m, 0).getDate();

      for (let d = 1; d <= daysCount; d++) {
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        if (!updated[dateStr]) {
          updated[dateStr] = { 
            type: 'full', 
            overtimeHours: 0, 
            notes: '', 
            sectionId: defaultSectionId || null 
          };
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
            updated[dateStr] = { 
              type: 'full', 
              overtimeHours: 0, 
              notes: '', 
              sectionId: defaultSectionId || null 
            };
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
      : Math.round((worker?.dailyRate || 0) / standardHours);

    Object.values(dayConfigs).forEach((cfg) => {
      const otHours = Math.max(0, Number(cfg.overtimeHours) || 0);
      if (cfg.type === 'hourly') {
        hourlyDays += 1;
        totalHourlyHours += otHours;
        otPay += roundCurrency(otHours * effectiveHourlyRate, currency);
      } else if (cfg.type === 'half') {
        halfDays += 1;
        totalOt += otHours;
        basePay += roundCurrency((worker?.dailyRate || 0) * 0.5, currency);
        otPay += roundCurrency(otHours * (worker?.overtimeHourlyRate || 0), currency);
      } else {
        fullDays += 1;
        totalOt += otHours;
        basePay += roundCurrency(worker?.dailyRate || 0, currency);
        otPay += roundCurrency(otHours * (worker?.overtimeHourlyRate || 0), currency);
      }
    });

    const effectiveDays = fullDays + (halfDays * 0.5);
    const grandTotal = roundCurrency(basePay + otPay, currency);

    return {
      activeCount: Object.keys(dayConfigs).length,
      fullDays,
      halfDays,
      hourlyDays,
      effectiveDays: Number(effectiveDays.toFixed(1)),
      totalOt: Number(totalOt.toFixed(4)),
      totalHourlyHours: Number(totalHourlyHours.toFixed(4)),
      basePay: roundCurrency(basePay, currency),
      otPay: roundCurrency(otPay, currency),
      grandTotal
    };
  }, [dayConfigs, worker?.dailyRate, worker?.overtimeHourlyRate, currency, standardHours]);

  // Save changes to IndexedDB
  const handleSave = async () => {
    if (!worker) return;
    setIsSaving(true);

    try {
      const newLogs = [];
      await db.transaction('rw', db.attendanceLogs, async () => {
        // 1. Delete previous logs for this worker for the selected month in current project
        const list = await db.attendanceLogs.where('workerId').equals(worker.id).toArray();
        const oldLogs = list.filter((l) => (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId && l.date.startsWith(selectedMonth));
        
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
              : Math.round(worker.dailyRate / standardHours);
            calculatedDailyWage = 0;
            calculatedOvertimeWage = roundCurrency(otHours * effectiveHourlyRate, currency);
          } else {
            const factor = cfg.type === 'half' ? 0.5 : 1.0;
            calculatedDailyWage = roundCurrency(worker.dailyRate * factor, currency);
            calculatedOvertimeWage = roundCurrency(otHours * (worker.overtimeHourlyRate || 0), currency);
          }
          const totalDayPay = roundCurrency(calculatedDailyWage + calculatedOvertimeWage, currency);

          newLogs.push({
            id: getAttendanceLogId(worker.id, dateStr),
            projectId: currentProject?.id || 'prj_default_main',
            userId: user?.id || null,
            workerId: worker.id,
            date: dateStr,
            type: cfg.type,
            overtimeHours: otHours,
            calculatedDailyWage,
            calculatedOvertimeWage,
            totalDayPay,
            sectionId: cfg.sectionId || null,
            notes: cfg.notes || '',
            createdAt: new Date(dateStr).toISOString(),
            updatedAt: new Date().toISOString()
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
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-4 sm:p-6 shadow-2xl sm:max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 h-[100dvh] sm:h-auto sm:max-h-[85vh] flex-col overflow-y-auto"
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
          
          {/* Row 1: Month Navigator */}
          <div className="flex items-center justify-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 bg-gradient-to-r hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-800 dark:hover:to-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center shadow-xs"
              title={language === 'fa' ? 'ماه قبل' : language === 'ku' ? 'مانگی پێشوو' : 'Previous Month'}
            >
              {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Current Month Name Display & Direct Month Picker */}
            <div className="relative px-4 py-1 flex items-center justify-center flex-1 sm:min-w-[130px]">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white whitespace-nowrap text-center">
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
              onClick={handleNextMonth}
              className="p-2 bg-gradient-to-r hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-800 dark:hover:to-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center shadow-xs"
              title={language === 'fa' ? 'ماه بعد' : language === 'ku' ? 'مانگی داهاتوو' : 'Next Month'}
            >
              {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Preset Buttons & Section Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-1.5">
            {/* Row 2: Section Selector */}
            {projectSections.length > 0 && (
              <div className="flex items-center justify-between sm:justify-start gap-2 bg-white dark:bg-slate-900 px-3 py-2 sm:px-2 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
                <div className="flex items-center gap-2 sm:gap-1">
                  <Layers className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-sky-500 flex-shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium sm:hidden">
                    {language === 'fa' ? 'بخش پیش‌فرض:' : 'Default Section:'}
                  </span>
                </div>
                <select
                  value={defaultSectionId}
                  onChange={(e) => setDefaultSectionId(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-bold sm:font-semibold focus:outline-hidden cursor-pointer flex-1 sm:flex-none text-end sm:text-start"
                  title={language === 'fa' ? 'بخش پیش‌فرض این ماه' : 'Default section for this month'}
                >
                  <option value="" className="bg-white dark:bg-slate-800">
                    {language === 'fa' ? 'بخش عمومی' : 'General'}
                  </option>
                  {projectSections.map((sec) => (
                    <option key={sec.id} value={sec.id} className="bg-white dark:bg-slate-800">
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Row 3: Action Buttons */}
            <div className="flex items-center justify-center gap-2 sm:gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSelectAllExceptFridays}
                className="p-2.5 sm:p-2 bg-gradient-to-r hover:from-sky-500 hover:to-sky-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-500 hover:shadow-lg hover:shadow-sky-500/30 transition-all flex-1 sm:flex-none flex justify-center"
                title="انتخاب همه روزهای کاری به جز جمعه‌ها"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleSelectAllDays}
                className="p-2.5 sm:p-2 bg-gradient-to-r hover:from-sky-500 hover:to-sky-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-500 hover:shadow-lg hover:shadow-sky-500/30 transition-all flex-1 sm:flex-none flex justify-center"
                title="انتخاب همه روزهای ماه"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="p-2.5 sm:p-2 bg-gradient-to-r hover:from-rose-500 hover:to-rose-600 bg-white dark:bg-slate-900 text-rose-500 hover:text-white rounded-xl border border-rose-200 dark:border-rose-900/50 hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/30 transition-all flex-1 sm:flex-none flex justify-center"
                title={t('clearAllDays')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="w-px h-8 sm:h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              
              {/* View Toggle */}
              <button
                type="button"
                onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                className={`p-2.5 sm:p-2 rounded-xl border transition-all flex-1 sm:flex-none flex justify-center ${
                  viewMode === 'list' 
                    ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white border-sky-500 shadow-lg shadow-sky-500/30' 
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                title={viewMode === 'grid' ? 'تغییر به تفکیک روز' : 'تغییر به تقویم ماهانه'}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Tip Banner */}
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 px-1">
          <Info className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
          <span>{t('clickToToggleTip')}</span>
        </div>

        {/* Calendar / List Body */}
        <div className="my-3 overflow-y-auto flex-1 pe-1">
          
          {viewMode === 'grid' ? (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 text-center text-[11px] font-bold text-slate-400">
                {weekDayLabels.map((name, i) => (
                  <div key={i} className="py-1">
                    {name}
                  </div>
                ))}
              </div>

              {/* Day tiles */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
                {monthDays.map((day, idx) => {
                  if (!day) {
                    return (
                      <div 
                        key={`blank_${idx}`} 
                        className="min-h-[55px] sm:min-h-[70px] bg-slate-50/40 dark:bg-slate-800/20 rounded-xl opacity-30" 
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
                      className={`min-h-[55px] sm:min-h-[74px] p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between select-none transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-sky-500 ring-offset-1 dark:ring-offset-slate-900 z-10 scale-[1.02]'
                          : ''
                      } ${
                        isActive
                          ? 'bg-sky-50 dark:bg-sky-900/40 border-sky-400 dark:border-sky-500 shadow-xs'
                          : day.isFriday
                          ? 'bg-rose-50/40 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/40 text-rose-500'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:bg-slate-50/60'
                      }`}
                      onClick={() => handleDayTileClick(day.dateStr)}
                    >
                      {/* Clickable Day Area */}
                      <div className="flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-extrabold ${
                        isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {day.dayNumber}
                      </span>

                      <div className="flex items-center gap-1">
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
                        {/* Subtle adjustment icon button to open Day Inspector without altering status */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayDate(isSelected ? null : day.dateStr);
                          }}
                          className={`p-0.5 rounded-md transition-colors ${
                            isSelected 
                              ? 'bg-sky-500 text-white shadow-xs' 
                              : 'text-slate-400 hover:text-sky-600 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                          }`}
                          title={language === 'fa' ? 'تنظیمات و ساعت این روز' : 'Day inspector'}
                        >
                          <SlidersHorizontal className="w-2.5 h-2.5" />
                        </button>
                      </div>
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

              {/* Inline Day Inspector for Grid View */}
              {selectedDayDate && (() => {
                const activeCfg = dayConfigs[selectedDayDate] || {
                  type: 'full',
                  overtimeHours: 0,
                  notes: '',
                  sectionId: defaultSectionId || null
                };
                const { hours, minutes } = fromDecimalHours(activeCfg.overtimeHours);
                const isHourly = activeCfg.type === 'hourly';
                const isHalf = activeCfg.type === 'half';
                const isFull = activeCfg.type === 'full';

                const updateActiveCfg = (updates) => {
                  setDayConfigs((prev) => ({
                    ...prev,
                    [selectedDayDate]: {
                      ...(prev[selectedDayDate] || { 
                        type: 'full', 
                        overtimeHours: 0, 
                        notes: '', 
                        sectionId: defaultSectionId || null 
                      }),
                      ...updates
                    }
                  }));
                };

                return (
                  <div className="mt-3 mb-3 p-3 sm:p-4 bg-sky-50/90 dark:bg-sky-950/60 rounded-2xl border border-sky-200 dark:border-sky-800 shadow-md animate-in fade-in duration-150 w-full flex-shrink-0 space-y-3">
                    {/* Header: Day Info + Explicit Close Button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-extrabold text-xs flex items-center justify-center">
                          {selectedDayDate.split('-')[2]}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {formatDateDisplay(selectedDayDate, language)}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                            {isHourly
                              ? t('hourlyOnlyOption')
                              : isHalf
                              ? t('halfDayOption')
                              : isFull
                              ? t('fullDayOption')
                              : (language === 'fa' ? 'غایب / ثبت نشده' : 'Absent')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDayDate(null)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                          title={t('close') || 'بستن'}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Status Tabs (Full, Half, Hourly, Remove) + Section Selector */}
                    <div className="flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-200/60 dark:border-sky-800/60">
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => updateActiveCfg({ type: 'full' })}
                          className={`px-2.5 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                            isFull
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {t('fullDayOption')}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateActiveCfg({ type: 'half' })}
                          className={`px-2.5 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                            isHalf
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {t('halfDayOption')}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateActiveCfg({ 
                            type: 'hourly', 
                            overtimeHours: activeCfg.overtimeHours > 0 ? activeCfg.overtimeHours : 1 
                          })}
                          className={`px-2.5 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                            isHourly
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {t('hourlyOnlyOption')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDayConfigs((prev) => {
                              const cp = { ...prev };
                              delete cp[selectedDayDate];
                              return cp;
                            });
                            setSelectedDayDate(null);
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title={language === 'fa' ? 'حذف / غایب' : 'Remove / Absent'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Project Section Selector (if project has sections) */}
                      {projectSections.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                          <Layers className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                            {t('section') || 'بخش'}:
                          </span>
                          <select
                            value={activeCfg.sectionId || ''}
                            onChange={(e) => updateActiveCfg({ sectionId: e.target.value || null })}
                            className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
                          >
                            <option value="" className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {language === 'fa' ? 'عمومی / کل پروژه' : 'General / Entire Project'}
                            </option>
                            {projectSections.map((sec) => (
                              <option key={sec.id} value={sec.id} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {sec.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Row 3: Stepper for Hours & Minutes + Presets */}
                    <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 flex-col">
                      <div className="flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 flex-shrink-0 ${isHourly ? 'text-purple-500' : 'text-amber-500'}`} />
                          <span className="text-[11px] text-slate-700 dark:text-slate-200 font-bold whitespace-nowrap">
                            {isHourly ? t('workedTimeLabel') : t('overtimeHoursLabel')}:
                          </span>
                          
                          {/* Inputs in LTR for clean numbers */}
                          <div className="flex items-center gap-1 direction-ltr">
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700">
                              <input
                                type="number"
                                min="0"
                                max="24"
                                value={hours}
                                onChange={(e) => {
                                  const newH = Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0));
                                  const dec = toDecimalHours(newH, minutes);
                                  updateActiveCfg({ overtimeHours: dec });
                                }}
                                className="w-9 font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none text-xs"
                                title={t('hoursLabel')}
                              />
                              <span className="text-[10px] text-slate-400 ms-0.5 font-medium">{t('hourShort')}</span>
                            </div>
                            <span className="text-slate-400 font-bold">:</span>
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700">
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={minutes}
                                onChange={(e) => {
                                  const newM = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
                                  const dec = toDecimalHours(hours, newM);
                                  updateActiveCfg({ overtimeHours: dec });
                                }}
                                className="w-9 font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none text-xs"
                                title={t('minutesLabel')}
                              />
                              <span className="text-[10px] text-slate-400 ms-0.5 font-medium">{t('minuteShort')}</span>
                            </div>
                          </div>

                          {activeCfg.overtimeHours > 0 && (
                            <span className="text-[11px] font-extrabold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                              ({formatHoursAndMinutes(activeCfg.overtimeHours, language)})
                            </span>
                          )}
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1 flex-wrap mt-2">
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {language === 'en' ? 'Quick:' : language === 'fa' ? 'سریع:' : 'خێرا:'}
                          </span>
                          <button
                            type="button"
                            onClick={() => addMinutesToSelectedDay(15)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-700 dark:text-slate-200 hover:text-sky-700 rounded-lg text-[11px] font-bold transition-colors"
                          >
                            +15د
                          </button>
                          <button
                            type="button"
                            onClick={() => addMinutesToSelectedDay(30)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-700 dark:text-slate-200 hover:text-sky-700 rounded-lg text-[11px] font-bold transition-colors"
                          >
                            +30د
                          </button>
                          <button
                            type="button"
                            onClick={() => addMinutesToSelectedDay(60)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-700 dark:text-slate-200 hover:text-sky-700 rounded-lg text-[11px] font-bold transition-colors"
                          >
                            +1س
                          </button>
                          <button
                            type="button"
                            onClick={() => addMinutesToSelectedDay(120)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-slate-700 dark:text-slate-200 hover:text-sky-700 rounded-lg text-[11px] font-bold transition-colors"
                          >
                            +2س
                          </button>
                          {activeCfg.overtimeHours > 0 && (
                            <button
                              type="button"
                              onClick={() => updateActiveCfg({ overtimeHours: 0 })}
                              className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-bold transition-colors"
                              title="صفر کردن"
                            >
                              0
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Notes and Done Button */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={activeCfg.notes || ''}
                        onChange={(e) => updateActiveCfg({ notes: e.target.value })}
                        placeholder={t('notesOptional')}
                        className="flex-1 text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedDayDate(null)}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 flex-shrink-0 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{language === 'fa' ? 'ثبت روز' : 'Done'}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

            </>
          ) : (
            <div className="flex flex-col gap-2">
              {monthDays.filter(Boolean).map((day) => {
                const cfg = dayConfigs[day.dateStr];
                const isActive = !!cfg;
                const isFull = cfg && cfg.type === 'full';
                const isHalf = cfg && cfg.type === 'half';
                const isHourly = cfg && cfg.type === 'hourly';
                
                return (
                  <div key={day.dateStr} className="flex flex-col gap-1">
                  <div
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isActive 
                        ? selectedDayDate === day.dateStr
                          ? 'bg-sky-50 dark:bg-sky-900/40 border-sky-400 dark:border-sky-500 shadow-md shadow-sky-500/20 scale-[1.02] z-10'
                          : 'bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-800 shadow-sm hover:border-sky-300 dark:hover:border-sky-700'
                        : day.isFriday
                        ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-xs'
                    }`}
                    onClick={() => handleDayTileClick(day.dateStr)}
                  >
                    <div className="flex items-center gap-3 mb-2 sm:mb-0">
                      <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold ${
                        isActive 
                          ? 'bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/30' 
                          : day.isFriday
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        <span className="text-lg leading-none">{day.dayNumber}</span>
                        <span className="text-[9px] uppercase mt-0.5">{weekDayLabels[day.dayOfWeek]}</span>
                      </div>
                      
                      <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                           {formatDateDisplay(day.dateStr, language)}
                           {isActive && cfg.notes && (
                             <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" title={cfg.notes}></span>
                           )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {isActive ? (
                            <span className="text-sky-700 dark:text-sky-400">
                              {isFull ? t('fullDayOption') : isHalf ? t('halfDayOption') : t('hourlyOnlyOption')}
                            </span>
                          ) : (
                            day.isFriday ? (language === 'fa' ? 'جمعه (تعطیل)' : 'Friday') : (language === 'fa' ? 'غایب / کار نکرده' : 'Absent')
                          )}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 ms-14 sm:ms-0 bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 flex-wrap" onClick={e => e.stopPropagation()}>
                         
                         {/* Quick Type Toggle */}
                         {!isHourly && (
                           <button 
                             onClick={() => {
                               setDayConfigs(prev => ({
                                 ...prev,
                                 [day.dateStr]: {
                                   ...prev[day.dateStr],
                                   type: prev[day.dateStr].type === 'full' ? 'half' : 'full'
                                 }
                               }));
                             }}
                             className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                               isHalf 
                                 ? 'bg-amber-500 text-white' 
                                 : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                             }`}
                           >
                             {isHalf ? t('halfDayOption') : t('fullDayOption')}
                           </button>
                         )}

                         {/* Overtime Controls */}
                         <div className="flex items-center gap-1.5 sm:gap-2">
                           <span className="text-[10px] text-slate-400 font-semibold px-1 sm:px-2">{isHourly ? t('workedTimeLabel') : t('overtime')}</span>
                           <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg p-1 border border-slate-100 dark:border-slate-800">
                             <button onClick={() => handleOvertimeChange(day.dateStr, -0.5)} className="w-7 h-7 rounded-md bg-white dark:bg-slate-800 text-slate-600 hover:bg-rose-500 hover:text-white flex items-center justify-center font-bold transition-all shadow-xs">-</button>
                             <span className="text-xs font-bold text-slate-700 dark:text-slate-300 min-w-[36px] text-center">
                               {cfg.overtimeHours > 0 || isHourly ? formatTileHours(cfg.overtimeHours, isHourly, language) : '0'}
                             </span>
                             <button onClick={() => handleOvertimeChange(day.dateStr, 0.5)} className="w-7 h-7 rounded-md bg-white dark:bg-slate-800 text-slate-600 hover:bg-sky-500 hover:text-white flex items-center justify-center font-bold transition-all shadow-xs">+</button>
                           </div>
                         </div>
                         
                         <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

                         <button 
                           onClick={() => setSelectedDayDate(selectedDayDate === day.dateStr ? null : day.dateStr)}
                           className={`p-2.5 rounded-xl transition-all shadow-xs border ${selectedDayDate === day.dateStr ? 'bg-gradient-to-r from-sky-500 to-sky-600 border-sky-500 text-white shadow-sky-500/30' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-sky-600 hover:border-sky-300'}`}
                           title={language === 'fa' ? 'جزئیات بیشتر (ساعت و دقیقه)' : 'Details'}
                         >
                           <SlidersHorizontal className="w-4 h-4" />
                         </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Inline Day Inspector for List View */}
                  {selectedDayDate === day.dateStr && (() => {
                    const activeCfg = dayConfigs[selectedDayDate] || {
                      type: 'full',
                      overtimeHours: 0,
                      notes: '',
                      sectionId: defaultSectionId || null
                    };
                    const { hours, minutes } = fromDecimalHours(activeCfg.overtimeHours);
                    const isHourly = activeCfg.type === 'hourly';
                    const isHalf = activeCfg.type === 'half';
                    const isFull = activeCfg.type === 'full';

                    const updateActiveCfg = (updates) => {
                      setDayConfigs((prev) => ({
                        ...prev,
                        [selectedDayDate]: {
                          ...(prev[selectedDayDate] || { 
                            type: 'full', 
                            overtimeHours: 0, 
                            notes: '', 
                            sectionId: defaultSectionId || null 
                          }),
                          ...updates
                        }
                      }));
                    };

                    return (
                      <div className="ms-14 p-3 bg-sky-50/50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-900/40 animate-in fade-in duration-150 space-y-3">
                        {/* Row 2: Status Tabs (Full, Half, Hourly, Remove) */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateActiveCfg({ type: 'full' })}
                            className={`px-2.5 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                              isFull
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {t('fullDayOption')}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateActiveCfg({ type: 'half' })}
                            className={`px-2.5 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                              isHalf
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {t('halfDayOption')}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateActiveCfg({ 
                              type: 'hourly', 
                              overtimeHours: activeCfg.overtimeHours > 0 ? activeCfg.overtimeHours : 1 
                            })}
                            className={`px-2.5 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                              isHourly
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {t('hourlyOnlyOption')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDayConfigs((prev) => {
                                const cp = { ...prev };
                                delete cp[selectedDayDate];
                                return cp;
                              });
                              setSelectedDayDate(null);
                            }}
                            className="p-1.5 text-rose-500 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors ms-auto"
                            title={language === 'fa' ? 'حذف / غایب' : 'Remove / Absent'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {/* Section Selector */}
                        {projectSections.length > 0 && (
                          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs w-full max-w-sm">
                            <Layers className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                            <span className="text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                              {t('section') || 'بخش'}:
                            </span>
                            <select
                              value={activeCfg.sectionId || ''}
                              onChange={(e) => updateActiveCfg({ sectionId: e.target.value || null })}
                              className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-hidden cursor-pointer flex-1"
                            >
                              <option value="" className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {language === 'fa' ? 'عمومی / کل پروژه' : 'General / Entire Project'}
                              </option>
                              {projectSections.map((sec) => (
                                <option key={sec.id} value={sec.id} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {sec.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Exact Time Stepper */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 flex-shrink-0 ${isHourly ? 'text-purple-500' : 'text-amber-500'}`} />
                            
                            <div className="flex items-center gap-1 direction-ltr">
                              <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700">
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  value={hours}
                                  onChange={(e) => {
                                    const newH = Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0));
                                    const dec = toDecimalHours(newH, minutes);
                                    updateActiveCfg({ overtimeHours: dec });
                                  }}
                                  className="w-9 font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none text-xs"
                                />
                                <span className="text-[10px] text-slate-400 ms-0.5 font-medium">{t('hourShort')}</span>
                              </div>
                              <span className="text-slate-400 font-bold">:</span>
                              <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700">
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={minutes}
                                  onChange={(e) => {
                                    const newM = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
                                    const dec = toDecimalHours(hours, newM);
                                    updateActiveCfg({ overtimeHours: dec });
                                  }}
                                  className="w-9 font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none text-xs"
                                />
                                <span className="text-[10px] text-slate-400 ms-0.5 font-medium">{t('minuteShort')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button onClick={() => addMinutesToSelectedDay(15)} className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-sky-100 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors">+15د</button>
                            <button onClick={() => addMinutesToSelectedDay(30)} className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-sky-100 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors">+30د</button>
                            <button onClick={() => addMinutesToSelectedDay(60)} className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-sky-100 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors">+1س</button>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={activeCfg.notes || ''}
                            onChange={(e) => updateActiveCfg({ notes: e.target.value })}
                            placeholder={t('notesOptional')}
                            className="flex-1 text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                    );
                  })()}
                  
                  </div>
                );
              })}
            </div>
          )}

        </div>

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
              {formatCurrency(totals.grandTotal, currency, language)}
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
