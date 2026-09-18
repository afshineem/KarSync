import { deleteLogLive } from '../services/realtimeSync';
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { EditRecordModal } from './EditRecordModal';
import { 
  formatIQD, 
  formatNumber, 
  getCurrentYearMonth, 
  getTodayDateString, 
  formatDateDisplay, 
  formatFullDateWithWeekday, 
  formatHoursAndMinutes 
} from '../utils/formatters';
import { exportAttendanceToExcel, triggerPrintReport } from './ExportEngine';
import { 
  Calendar as CalendarIcon, 
  ListFilter, 
  FileSpreadsheet, 
  Printer, 
  Trash2, 
  Edit2,
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Clock, 
  Coins, 
  CalendarDays,
  X, 
  PieChart, 
  TableProperties, 
  FileText, 
  CalendarCheck, 
  PlusCircle, 
  Search, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export function CalendarReportsView({ onOpenLoggingModal }) {
  const { t, language, direction } = useLanguage();

  // Primary view mode: 'timeline' (لیست تفکیک روزانه) | 'calendar' (تقویم شبکه‌ای) | 'logs' (گزارش‌ها)
  const [viewMode, setViewMode] = useState('timeline'); 
  const [calendarMonth, setCalendarMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  const [editingLog, setEditingLog] = useState(null);

  // Timeline list controls
  const [filterOnlyWithLogs, setFilterOnlyWithLogs] = useState(true);
  const [sortAscending, setSortAscending] = useState(true);
  const [timelineSearch, setTimelineSearch] = useState('');

  // In Reporting mode: Sub-mode between 'summary' (گزارش مجموع) and 'detailed' (گزارش با جزییات)
  const [reportFormat, setReportFormat] = useState('summary'); 

  // Filters for reporting
  const [selectedWorkerId, setSelectedWorkerId] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  
  // Date range defaults to current month
  const [dateFrom, setDateFrom] = useState(() => `${getCurrentYearMonth()}-01`);
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, Number(m), 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  });

  // Inspected date string for quick modal inspection from monthly calendar
  const [inspectedDateStr, setInspectedDateStr] = useState(null);

  // Dexie live queries (Reactive)
  const workers = useLiveQuery(() => db.workers.toArray(), []) || [];
  const rawLogs = useLiveQuery(() => db.attendanceLogs.toArray(), []) || [];

  // Deduplicate logs by workerId + date in memory to guarantee 1 log per worker per day
  const allLogs = useMemo(() => {
    const map = new Map();
    rawLogs.forEach((l) => {
      const key = `${l.workerId}_${l.date}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, l);
      } else {
        const timeL = l.updatedAt || l.createdAt || '';
        const timeEx = existing.updatedAt || existing.createdAt || '';
        if (timeL.localeCompare(timeEx) > 0) {
          map.set(key, l);
        }
      }
    });
    return Array.from(map.values());
  }, [rawLogs]);

  const workerMap = useMemo(() => {
    const map = {};
    workers.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [workers]);

  // ========================================================
  // 1. MONTHLY TIMELINE DATA (Day-by-Day Detailed Breakdown)
  // ========================================================
  const monthTimelineData = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const totalDaysInMonth = new Date(y, m, 0).getDate();
    const list = [];

    let totalMonthDaysWorked = 0;
    let totalMonthOt = 0;
    let totalMonthSalary = 0;

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      const dayLogs = allLogs.filter((l) => l.date === dateStr);

      const totalWorkers = dayLogs.length;
      const fullDaysCount = dayLogs.filter((l) => l.type === 'full').length;
      const halfDaysCount = dayLogs.filter((l) => l.type === 'half').length;
      const hourlyDaysCount = dayLogs.filter((l) => l.type === 'hourly').length;
      const totalOvertime = dayLogs.reduce((acc, l) => acc + (Number(l.overtimeHours) || 0), 0);
      const totalPay = dayLogs.reduce((acc, l) => acc + (Number(l.totalDayPay) || 0), 0);

      if (totalWorkers > 0) {
        totalMonthDaysWorked += 1;
        totalMonthOt = Number((totalMonthOt + totalOvertime).toFixed(4));
        totalMonthSalary += totalPay;
      }

      // Collect notes
      const notesList = [];
      dayLogs.forEach((l) => {
        if (l.notes && l.notes.trim()) {
          const workerName = workerMap[l.workerId]?.name || 'نامشخص';
          notesList.push({
            workerId: l.workerId,
            workerName,
            text: l.notes.trim(),
            log: l
          });
        }
      });

      list.push({
        dayNumber: d,
        dateStr,
        logs: dayLogs,
        totalWorkers,
        fullDaysCount,
        halfDaysCount,
        totalOvertime,
        totalPay,
        notesList
      });
    }

    return {
      days: list,
      monthStats: {
        daysWorked: totalMonthDaysWorked,
        totalOvertime: Number(totalMonthOt.toFixed(4)),
        totalSalary: totalMonthSalary,
        totalEntries: allLogs.filter((l) => l.date.startsWith(calendarMonth)).length
      }
    };
  }, [calendarMonth, allLogs, workerMap]);

  // Filter & Search on timeline days
  const displayedTimelineDays = useMemo(() => {
    let result = monthTimelineData.days;

    if (filterOnlyWithLogs) {
      result = result.filter((d) => d.totalWorkers > 0);
    }

    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase();
      result = result.filter((d) => {
        if (d.dateStr.includes(q)) return true;
        const hasWorker = d.logs.some((l) => {
          const w = workerMap[l.workerId];
          return w && w.name.toLowerCase().includes(q);
        });
        if (hasWorker) return true;
        const hasNotes = d.notesList.some((n) => n.text.toLowerCase().includes(q));
        return hasNotes;
      });
    }

    if (!sortAscending) {
      result = [...result].reverse();
    }

    return result;
  }, [monthTimelineData, filterOnlyWithLogs, timelineSearch, sortAscending, workerMap]);

  // ========================================================
  // 2. CALENDAR GRID MATRIX
  // ========================================================
  const calendarData = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const firstDayIndex = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();

    const dayLogsMap = {};
    allLogs.forEach((l) => {
      if (l.date.startsWith(calendarMonth)) {
        if (!dayLogsMap[l.date]) dayLogsMap[l.date] = [];
        dayLogsMap[l.date].push(l);
      }
    });

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      const dayLogs = dayLogsMap[dateStr] || [];
      const totalWorkers = dayLogs.length;
      const totalOvertime = dayLogs.reduce((acc, l) => acc + (Number(l.overtimeHours) || 0), 0);
      const totalPay = dayLogs.reduce((acc, l) => acc + (Number(l.totalDayPay) || 0), 0);

      days.push({
        dayNumber: d,
        dateStr,
        logs: dayLogs,
        totalWorkers,
        totalOvertime,
        totalPay
      });
    }

    return days;
  }, [calendarMonth, allLogs]);

  // Modal inspection logs
  const inspectedDateLogs = useMemo(() => {
    if (!inspectedDateStr) return [];
    return allLogs.filter((l) => l.date === inspectedDateStr);
  }, [allLogs, inspectedDateStr]);

  const inspectedTotalPay = useMemo(() => {
    return inspectedDateLogs.reduce((acc, l) => acc + (Number(l.totalDayPay) || 0), 0);
  }, [inspectedDateLogs]);

  // ========================================================
  // 3. REPORTING ENGINE DATA (Summary vs Detailed)
  // ========================================================
  const filteredLogs = useMemo(() => {
    return allLogs
      .filter((log) => {
        if (selectedWorkerId !== 'all' && log.workerId !== selectedWorkerId) return false;
        if (selectedType !== 'all' && log.type !== selectedType) return false;
        if (dateFrom && log.date < dateFrom) return false;
        if (dateTo && log.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allLogs, selectedWorkerId, selectedType, dateFrom, dateTo]);

  const aggregatedStats = useMemo(() => {
    let days = 0;
    let otHours = 0;
    let basePay = 0;
    let otPay = 0;
    let totalPay = 0;

    filteredLogs.forEach((l) => {
      days += l.type === 'hourly' ? 0 : l.type === 'half' ? 0.5 : 1.0;
      otHours += Number(l.overtimeHours) || 0;
      basePay += Number(l.calculatedDailyWage) || 0;
      otPay += Number(l.calculatedOvertimeWage) || 0;
      totalPay += Number(l.totalDayPay) || 0;
    });

    return {
      entriesCount: filteredLogs.length,
      days,
      otHours,
      basePay,
      otPay,
      totalPay
    };
  }, [filteredLogs]);

  const summaryGroupedData = useMemo(() => {
    const grouped = {};

    filteredLogs.forEach((log) => {
      if (!grouped[log.workerId]) {
        grouped[log.workerId] = {
          workerId: log.workerId,
          fullDaysCount: 0,
          fullDaysPay: 0,
          halfDaysCount: 0,
          halfDaysPay: 0,
          hourlyDaysCount: 0,
          overtimeHours: 0,
          overtimePay: 0,
          totalPay: 0
        };
      }
      const g = grouped[log.workerId];
      if (log.type === 'half') {
        g.halfDaysCount += 1;
        g.halfDaysPay += Number(log.calculatedDailyWage) || 0;
      } else if (log.type === 'hourly') {
        g.hourlyDaysCount += 1;
      } else {
        g.fullDaysCount += 1;
        g.fullDaysPay += Number(log.calculatedDailyWage) || 0;
      }
      g.overtimeHours += Number(log.overtimeHours) || 0;
      g.overtimePay += Number(log.calculatedOvertimeWage) || 0;
      g.totalPay += Number(log.totalDayPay) || 0;
    });

    return Object.values(grouped).map((g) => {
      const worker = workerMap[g.workerId] || { name: 'Unknown', role: '' };
      return {
        ...g,
        worker
      };
    });
  }, [filteredLogs, workerMap]);

  // Delete an individual log
  const handleDeleteLog = async (logId) => {
    if (window.confirm(t('deleteLogConfirm'))) {
      await db.attendanceLogs.delete(logId);
      deleteLogLive(logId).catch(() => {});
    }
  };

  // Month shifting helper
  const handleMonthShift = (delta) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setCalendarMonth(`${newY}-${newM}`);
  };

  const weekDayLabels = language === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : language === 'fa'
    ? ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه']
    : ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'];

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Header: 3-Way Mode Switcher (Timeline Breakdown | Calendar Grid | Reports & Settlement) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-sky-500" />
            <span>{t('calendarLogs')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {viewMode === 'timeline' ? t('monthTimeline') : viewMode === 'calendar' ? t('calendarGridTab') : t('logsTitle')}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 3-Way Mode Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            {/* 1. Day-by-Day Timeline Breakdown (Default!) */}
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{t('monthTimeline')}</span>
            </button>

            {/* 2. Monthly Calendar Grid */}
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>{t('calendarGridTab')}</span>
            </button>

            {/* 3. Reports & Settlement */}
            <button
              onClick={() => setViewMode('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'logs'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>{t('logsTitle')}</span>
            </button>
          </div>

          {/* Export Buttons */}
          <button
            onClick={() => exportAttendanceToExcel({ logs: filteredLogs, workers, reportType: reportFormat, language })}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            title="Download Excel spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">{t('exportExcel')}</span>
          </button>

          <button
            onClick={triggerPrintReport}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            title="Print or Save PDF"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{t('printPdf')}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: MONTHLY DAY-BY-DAY BREAKDOWN LIST (TIMELINE)     */}
      {/* ======================================================== */}
      {viewMode === 'timeline' && (
        <div className="space-y-4 no-print">
          
          {/* Top Month Selector & Aggregate KPI Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Month navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMonthShift(direction === 'rtl' ? 1 : -1)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                  title="Previous Month"
                >
                  {direction === 'rtl' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
                <input
                  type="month"
                  value={calendarMonth}
                  onChange={(e) => setCalendarMonth(e.target.value)}
                  className="text-base sm:text-lg font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white px-3 py-1.5 cursor-pointer focus:outline-none"
                />
                <button
                  onClick={() => handleMonthShift(direction === 'rtl' ? -1 : 1)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                  title="Next Month"
                >
                  {direction === 'rtl' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>

              {/* Month KPI Summary Pills */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 rounded-xl font-bold flex items-center gap-1.5 border border-sky-100 dark:border-sky-900">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>{monthTimelineData.monthStats.daysWorked} {t('normalDays')}</span>
                </div>

                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-xl font-bold flex items-center gap-1.5 border border-amber-100 dark:border-amber-900">
                  <Clock className="w-3.5 h-3.5" />
                  <span>+{formatHoursAndMinutes(monthTimelineData.monthStats.totalOvertime, language)} {language === 'en' ? 'Overtime' : language === 'fa' ? 'اضافه‌کاری' : 'ئۆڤەرتایم'}</span>
                </div>

                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-1.5 border border-emerald-100 dark:border-emerald-900">
                  <Coins className="w-3.5 h-3.5" />
                  <span>{formatIQD(monthTimelineData.monthStats.totalSalary, language)}</span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute start-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  placeholder={t('timelineSearchPlaceholder')}
                  className="w-full ps-9 pe-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {timelineSearch && (
                  <button
                    onClick={() => setTimelineSearch('')}
                    className="absolute end-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                {/* Filter days with logs */}
                <button
                  onClick={() => setFilterOnlyWithLogs(!filterOnlyWithLogs)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                    filterOnlyWithLogs
                      ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{filterOnlyWithLogs ? t('filterOnlyWithLogs') : t('showAllMonthDays')}</span>
                </button>

                {/* Sort order */}
                <button
                  onClick={() => setSortAscending(!sortAscending)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"
                  title="تغییر ترتیب نمایش"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{sortAscending ? '۱ ⬅️ ۳۰' : '۳۰ ⬅️ ۱'}</span>
                </button>

                {/* Quick Add Log Button */}
                <button
                  onClick={() => onOpenLoggingModal && onOpenLoggingModal(getTodayDateString())}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('logDailyAttendance')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Timeline Days List */}
          {displayedTimelineDays.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-sky-500" />
              <p className="text-sm font-semibold">{t('noLogsForMonth')}</p>
              <button
                onClick={() => onOpenLoggingModal && onOpenLoggingModal(`${calendarMonth}-01`)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('logDailyAttendance')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayedTimelineDays.map((dayItem) => {
                const hasLogs = dayItem.totalWorkers > 0;
                const formattedDate = formatFullDateWithWeekday(dayItem.dateStr, language);
                const isFriday = new Date(dayItem.dateStr).getDay() === 5;

                return (
                  <div
                    key={dayItem.dateStr}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all p-4 sm:p-5 shadow-sm ${
                      hasLogs
                        ? 'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700'
                        : isFriday
                        ? 'border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10'
                        : 'border-slate-100 dark:border-slate-800/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* Day Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      {/* Left/Start: Day Badge & Formatted Date */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold text-sm border shadow-xs ${
                          hasLogs
                            ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                            : isFriday
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                          <span>{dayItem.dayNumber}</span>
                        </div>

                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{formattedDate}</span>
                            {isFriday && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                                جمعه
                              </span>
                            )}
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {dayItem.dateStr}
                          </span>
                        </div>
                      </div>

                      {/* Right/End: Day Metrics & Quick Actions */}
                      <div className="flex items-center gap-2">
                        {hasLogs ? (
                          <>
                            {/* Worker count */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              <Users className="w-3.5 h-3.5 text-sky-500" />
                              <span>{dayItem.totalWorkers} {t('workers')}</span>
                            </span>

                            {/* Overtime count if any */}
                            {dayItem.totalOvertime > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50">
                                <Clock className="w-3.5 h-3.5" />
                                <span>+{formatHoursAndMinutes(dayItem.totalOvertime, language)}</span>
                              </span>
                            )}

                            {/* Total day pay */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                              <Coins className="w-3.5 h-3.5" />
                              <span>{formatIQD(dayItem.totalPay, language)}</span>
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {t('noLogsThisDay')}
                          </span>
                        )}

                        {/* Quick Add / Edit button for this day */}
                        <button
                          onClick={() => onOpenLoggingModal && onOpenLoggingModal(dayItem.dateStr)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors border border-sky-200/60 dark:border-sky-800/60 ms-1"
                          title={t('quickAddLogThisDate')}
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('quickAddLogThisDate')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Day Content: Workers list with overtime + Notes */}
                    {hasLogs && (
                      <div className="mt-3.5 space-y-3">
                        {/* Workers Row / Badges */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{t('dayWorkersTitle')}:</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {dayItem.logs.map((log) => {
                              const worker = workerMap[log.workerId] || { name: 'Unknown', role: '' };
                              return (
                                <div
                                  key={log.id}
                                  className="group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 hover:border-sky-300 dark:hover:border-sky-600 transition-colors"
                                >
                                  {/* Worker name */}
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {worker.name}
                                  </span>

                                  {/* Attendance status badge */}
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                    log.type === 'hourly'
                                      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300'
                                      : log.type === 'half'
                                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                                      : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                                  }`}>
                                    {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDays') : t('normalDays')}
                                  </span>

                                  {/* Overtime chip if > 0 */}
                                  {log.overtimeHours > 0 && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>{log.type === 'hourly' ? '' : '+'}{formatHoursAndMinutes(log.overtimeHours, language)}</span>
                                    </span>
                                  )}

                                  {/* Calculated pay for worker */}
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold border-s ps-2 border-slate-200 dark:border-slate-700">
                                    {formatIQD(log.totalDayPay, language)}
                                  </span>

                                  {/* Edit action */}
                                  <button
                                    onClick={() => setEditingLog(log)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-sky-600 text-slate-400 transition-opacity"
                                    title={t('edit')}
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>

                                  {/* Delete action */}
                                  <button
                                    onClick={() => handleDeleteLog(log.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 text-slate-400 transition-opacity"
                                    title={t('delete')}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Daily Notes & Task Descriptions (متن توضیحات روز) */}
                        {dayItem.notesList.length > 0 && (
                          <div className="pt-2.5 border-t border-dashed border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 mb-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{t('dailyNotesTitle')}:</span>
                            </div>

                            <div className="p-3 bg-sky-50/50 dark:bg-sky-950/30 rounded-xl border border-sky-100 dark:border-sky-900/50 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-1.5">
                              {dayItem.notesList.map((noteItem, nIdx) => (
                                <div key={nIdx} className="flex items-start justify-between gap-2 group/note">
                                  <div className="flex items-start gap-2 flex-1">
                                    <span className="text-sky-500 font-bold mt-0.5">•</span>
                                    <div>
                                      {dayItem.notesList.length > 1 && (
                                        <span className="font-bold text-slate-900 dark:text-white me-1.5">
                                          {noteItem.workerName}:
                                        </span>
                                      )}
                                      <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {noteItem.text}
                                      </span>
                                    </div>
                                  </div>
                                  {noteItem.log && (
                                    <button
                                      onClick={() => setEditingLog(noteItem.log)}
                                      className="opacity-0 group-hover/note:opacity-100 p-0.5 hover:text-sky-600 text-slate-400 transition-opacity flex-shrink-0"
                                      title={t('edit')}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: MONTHLY CALENDAR GRID                            */}
      {/* ======================================================== */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm no-print">
          
          {/* Calendar Month Selector Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMonthShift(direction === 'rtl' ? 1 : -1)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-700 dark:text-slate-300"
              >
                {direction === 'rtl' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
              <input
                type="month"
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(e.target.value)}
                className="text-base sm:text-lg font-bold bg-transparent text-slate-900 dark:text-white px-2 py-1 cursor-pointer focus:outline-none"
              />
              <button
                onClick={() => handleMonthShift(direction === 'rtl' ? -1 : 1)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-700 dark:text-slate-300"
              >
                {direction === 'rtl' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            </div>

            <div className="text-xs text-slate-400">
              {allLogs.filter(l => l.date.startsWith(calendarMonth)).length} {t('totalEntries')}
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            {weekDayLabels.map((dayName, idx) => (
              <div key={idx} className="py-1">
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarData.map((dayItem, index) => {
              if (!dayItem) {
                return (
                  <div 
                    key={`blank_${index}`} 
                    className="min-h-[85px] sm:min-h-[110px] bg-slate-50/40 dark:bg-slate-800/20 rounded-xl opacity-40" 
                  />
                );
              }

              const hasLogs = dayItem.totalWorkers > 0;
              const isFriday = new Date(dayItem.dateStr).getDay() === 5;

              return (
                <div
                  key={dayItem.dateStr}
                  onClick={() => {
                    setInspectedDateStr(dayItem.dateStr);
                  }}
                  className={`min-h-[85px] sm:min-h-[110px] p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                    hasLogs
                      ? 'bg-white dark:bg-slate-800/80 border-sky-200 dark:border-sky-900/60 shadow-sm hover:border-sky-500 hover:scale-[1.02]'
                      : isFriday
                      ? 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                      : 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/60 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs sm:text-sm font-bold ${
                      hasLogs ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'
                    }`}>
                      {dayItem.dayNumber}
                    </span>
                    {hasLogs && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    )}
                  </div>

                  {hasLogs ? (
                    <div className="mt-1 space-y-1 text-[11px]">
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-semibold">
                        <Users className="w-3 h-3 text-sky-500" />
                        <span>{dayItem.totalWorkers}</span>
                      </div>
                      {dayItem.totalOvertime > 0 && (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="w-3 h-3" />
                          <span>+{formatHoursAndMinutes(dayItem.totalOvertime, language)}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                        {formatIQD(dayItem.totalPay, language)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300 dark:text-slate-600 text-center py-2">
                      -
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: REPORTS & SETTLEMENT                             */}
      {/* ======================================================== */}
      {viewMode === 'logs' && (
        <div className="space-y-6">
          
          {/* Controls & Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 no-print">
            {/* Format Toggle: Summary vs Detailed */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('reports')}:</span>
                <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setReportFormat('summary')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportFormat === 'summary'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <PieChart className="w-3.5 h-3.5" />
                    <span>{t('summaryReport')}</span>
                  </button>
                  <button
                    onClick={() => setReportFormat('detailed')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportFormat === 'detailed'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <TableProperties className="w-3.5 h-3.5" />
                    <span>{t('detailedReport')}</span>
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                {filteredLogs.length} {t('totalEntries')}
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Worker */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('filterByWorker')}</label>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">{t('allWorkers')}</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('filterByType')}</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">{t('allTypes')}</option>
                  <option value="full">{t('normalDays')}</option>
                  <option value="half">{t('halfDays')}</option>
                  <option value="hourly">{t('hourlyOnlyOption')}</option>
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('fromDate')}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                </input>
              </div>

              {/* To Date */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('toDate')}</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Aggregated KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-500">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium">{t('aggregatedDays')}</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{aggregatedStats.days}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium">{t('aggregatedOvertime')}</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatHoursAndMinutes(aggregatedStats.otHours, language)}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium">{t('basePay')}</span>
                <p className="text-base font-bold text-slate-900 dark:text-white truncate">{formatIQD(aggregatedStats.basePay, language)}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium">{t('aggregatedTotalPay')}</span>
                <p className="text-base font-bold text-slate-900 dark:text-white truncate">{formatIQD(aggregatedStats.totalPay, language)}</p>
              </div>
            </div>
          </div>

          {/* MAIN REPORT TABLE (SCREEN + PRINT) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:border-none print:shadow-none">
            
            {/* Print Header */}
            <div className="hidden print:block p-6 border-b border-slate-200 mb-4 text-center">
              <h1 className="text-2xl font-bold text-slate-900">{t('appName')}</h1>
              <p className="text-sm text-slate-600 mt-1">{t('reportHeaderTitle')}</p>
              <div className="flex justify-between items-center text-xs text-slate-500 mt-4 px-4">
                <span>{t('fromDate')}: {dateFrom} | {t('toDate')}: {dateTo}</span>
                <span>{reportFormat === 'summary' ? t('summaryReport') : t('detailedReport')}</span>
                <span>{t('reportGeneratedAt')}: {getTodayDateString()}</span>
              </div>
            </div>

            {/* Sub-view A: Summary Report Table (گزارش مجموع) */}
            {reportFormat === 'summary' ? (
              summaryGroupedData.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  {t('noDataForMonth')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                      <tr>
                        <th className="px-4 py-3.5 text-start">{t('workerName')}</th>
                        <th className="px-4 py-3.5 text-center">{t('fullDaysWithPay')}</th>
                        <th className="px-4 py-3.5 text-center">{t('halfDaysWithPay')}</th>
                        <th className="px-4 py-3.5 text-center">{t('overtimeWithPay')}</th>
                        <th className="px-4 py-3.5 text-end font-bold text-sky-600 dark:text-sky-400">{t('totalSummaryPay')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryGroupedData.map((row) => (
                        <tr key={row.workerId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">{row.worker.name}</div>
                            <div className="text-xs text-slate-400">{row.worker.role}</div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {row.fullDaysCount} {t('normalDays')}
                            </div>
                            <div className="text-xs text-slate-400">
                              ({formatIQD(row.fullDaysPay, language)})
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {row.halfDaysCount} {t('halfDays')}
                            </div>
                            <div className="text-xs text-slate-400">
                              ({formatIQD(row.halfDaysPay, language)})
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="font-bold text-amber-600 dark:text-amber-400">
                              {formatHoursAndMinutes(row.overtimeHours, language)}
                            </div>
                            <div className="text-xs text-slate-400">
                              ({formatIQD(row.overtimePay, language)})
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-end font-extrabold text-sky-600 dark:text-sky-400 text-base">
                            {formatIQD(row.totalPay, language)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold text-xs border-t-2 border-slate-300 dark:border-slate-700">
                      <tr>
                        <td className="px-4 py-3.5 text-start font-extrabold text-slate-900 dark:text-white">
                          مجموع کل ({summaryGroupedData.length} کارگر)
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold">
                          {summaryGroupedData.reduce((acc, r) => acc + r.fullDaysCount, 0)} روز
                          <div className="text-[11px] text-slate-500">
                            {formatIQD(summaryGroupedData.reduce((acc, r) => acc + r.fullDaysPay, 0), language)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold">
                          {summaryGroupedData.reduce((acc, r) => acc + r.halfDaysCount, 0)} روز
                          <div className="text-[11px] text-slate-500">
                            {formatIQD(summaryGroupedData.reduce((acc, r) => acc + r.halfDaysPay, 0), language)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-amber-600 dark:text-amber-400">
                          {formatHoursAndMinutes(summaryGroupedData.reduce((acc, r) => acc + r.overtimeHours, 0), language)}
                          <div className="text-[11px] text-slate-500">
                            {formatIQD(summaryGroupedData.reduce((acc, r) => acc + r.overtimePay, 0), language)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-end font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                          {formatIQD(summaryGroupedData.reduce((acc, r) => acc + r.totalPay, 0), language)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            ) : (
              /* Sub-view B: Detailed Report Table (گزارش با جزییات) */
              filteredLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  {t('noDataForMonth')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                      <tr>
                        <th className="px-4 py-3.5 text-start">{t('dateColumn')}</th>
                        <th className="px-4 py-3.5 text-start">{t('workerName')}</th>
                        <th className="px-4 py-3.5 text-center">{t('typeColumn')}</th>
                        <th className="px-4 py-3.5 text-center">{t('overtimeHours')}</th>
                        <th className="px-4 py-3.5 text-start">{t('notesColumn')}</th>
                        <th className="px-4 py-3.5 text-end font-bold text-sky-600 dark:text-sky-400">{t('netSalary')}</th>
                        <th className="px-4 py-3.5 text-center no-print">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredLogs.map((log) => {
                        const worker = workerMap[log.workerId] || { name: 'Unknown', role: '' };
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                              {log.date}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900 dark:text-white">{worker.name}</div>
                              <div className="text-xs text-slate-400">{worker.role}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                log.type === 'hourly'
                                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                  : log.type === 'half'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDays') : t('normalDays')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-amber-600 dark:text-amber-400">
                              {log.overtimeHours > 0 ? (log.type === 'hourly' ? formatHoursAndMinutes(log.overtimeHours, language) : `+${formatHoursAndMinutes(log.overtimeHours, language)}`) : '-'}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                              {log.notes || '-'}
                            </td>
                            <td className="px-4 py-3 text-end font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatIQD(log.totalDayPay, language)}
                            </td>
                            <td className="px-4 py-3 text-center no-print whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setEditingLog(log)}
                                  className="p-1.5 hover:bg-sky-50 dark:hover:bg-sky-950/50 text-slate-400 hover:text-sky-600 rounded-lg transition-colors"
                                  title={t('edit')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                  title={t('delete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Print Signatures */}
            <div className="hidden print:flex justify-around items-end pt-16 pb-8 border-t border-slate-200 mt-8 text-xs font-bold text-slate-700">
              <div className="text-center">
                <p className="mb-12">{t('signatureAccountant')}</p>
                <div className="w-40 border-b border-slate-400"></div>
              </div>
              <div className="text-center">
                <p className="mb-12">{t('signatureManager')}</p>
                <div className="w-40 border-b border-slate-400"></div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK DATE INSPECTION MODAL (From Grid click)            */}
      {/* ======================================================== */}
      {inspectedDateStr && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-sky-500" />
                  <span>{inspectedDateStr}</span>
                </h3>
                <span className="text-xs text-slate-400">
                  {inspectedDateLogs.length} {t('workers')} • {formatIQD(inspectedTotalPay, language)}
                </span>
              </div>
              <button
                onClick={() => setInspectedDateStr(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {inspectedDateLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  {t('noDataForMonth')}
                </div>
              ) : (
                inspectedDateLogs.map((log) => {
                  const worker = workerMap[log.workerId] || { name: 'Unknown', role: '' };
                  return (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{worker.name}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            log.type === 'hourly'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                              : log.type === 'half'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDays') : t('normalDays')}
                          </span>
                          {log.overtimeHours > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              {log.type === 'hourly' ? '' : '+'}{formatHoursAndMinutes(log.overtimeHours, language)}
                            </span>
                          )}
                          {log.notes && <span className="italic truncate max-w-[150px]">"{log.notes}"</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {formatIQD(log.totalDayPay, language)}
                        </span>
                        <button
                          onClick={() => setEditingLog(log)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors"
                          title={t('edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <button
                onClick={() => {
                  const targetDate = inspectedDateStr;
                  setInspectedDateStr(null);
                  if (onOpenLoggingModal) {
                    onOpenLoggingModal(targetDate);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('quickAddLogThisDate')}</span>
              </button>

              <button
                onClick={() => setInspectedDateStr(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Edit Record Modal */}
      <EditRecordModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
      />

    </div>
  );
}
