import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { formatCurrency, formatHoursAndMinutes, getCurrencySymbol, formatDateDisplay, roundCurrency } from '../utils/formatters';
import { 
  X, 
  Layers, 
  Building, 
  Users, 
  Clock, 
  Coins, 
  Calendar, 
  FileText, 
  TrendingUp, 
  ExternalLink,
  ChevronDown,
  Sparkles,
  Briefcase,
  Phone,
  CheckCircle2,
  CalendarDays,
  Percent,
  Calculator
} from 'lucide-react';

const SECTION_STATS_COPY = {
  fa: {
    workerFallback: 'پرسنل',
    sectionBadge: 'بخش پروژه',
    archivedBadge: 'بایگانی‌شده',
    projectFallback: 'پروژه',
    switchToProjectTitle: 'انتخاب این پروژه و ورود به بخش',
    switchProject: 'انتخاب پروژه',
    allTime: 'تمام دوران',
    byMonth: 'بر اساس ماه',
    logsLogged: 'لاگ ثبت‌شده',
    overviewTab: 'آمار کلیدی و خلاصه',
    crewTab: 'پرسنل و نیروها',
    activitiesTab: 'یادداشت‌ها و شرح کار',
    personDaysKPI: 'نفر-روز کارکرد',
    fullDays: 'کامل',
    halfDays: 'نیم‌روز',
    totalPayroll: 'کل دستمزد بخش',
    overtime: 'اضافه‌کاری',
    wagePrefix: 'دستمزد',
    activeWorkersCount: 'پرسنل فعال',
    defaultCrew: 'نیروی پیش‌فرض',
    financialBreakdown: 'تفکیک دستمزد پایه و اضافه کاری',
    baseWage: 'دستمزد پایه',
    overtimeWage: 'اضافه کاری',
    avgCostPerDay: 'میانگین روز',
    workforceSectionTitle: 'کارکرد پرسنل در این بخش',
    viewAll: 'مشاهده همه',
    noLogsForThisSection: 'هیچ کارکردی برای این بخش در این بازه ثبت نشده است.',
    dayUnit: 'روز',
    crewTabDesc: 'ریز کارکرد، ساعات اضافه‌کاری و مجموع دستمزد هر کارگر در این بخش:',
    noCrewForThisSection: 'هیچ پرسنلی در این بازه برای این بخش کار نکرده است.',
    defaultSectionBadge: 'بخش اصلی',
    ofSectionTotal: 'از کل کارکرد بخش',
    activitiesTabDesc: 'گزارش و یادداشت کارهای انجام‌شده ثبت‌شده در این بخش:',
    noActivitiesLogged: 'هیچ یادداشت فعالیتی برای این بخش ثبت نشده است.',
    halfDay: 'نیم‌روز',
    fullDay: 'تمام‌وقت',
    hourShort: 'س',
    currentActiveProject: 'پروژه فعال کنونی',
    close: 'بستن',
    initialFallback: '؟'
  },
  ku: {
    workerFallback: 'کارمەند',
    sectionBadge: 'بەشی پڕۆژە',
    archivedBadge: 'ئەرشیڤکراو',
    projectFallback: 'پڕۆژە',
    switchToProjectTitle: 'هەڵبژاردنی ئەم پڕۆژەیە و چوونە ناو بەش',
    switchProject: 'هەڵبژاردنی پڕۆژە',
    allTime: 'تەواوی کاتەکان',
    byMonth: 'بەپێی مانگ',
    logsLogged: 'تۆماری تۆمارکراو',
    overviewTab: 'ئامار و پوختەی سەرەکی',
    crewTab: 'کارمەندان و هێزی کار',
    activitiesTab: 'تێبینی و ڕوونکردنەوەی کار',
    personDaysKPI: 'کەس-ڕۆژی کارکردن',
    fullDays: 'تەواو',
    halfDays: 'نیوەڕۆژ',
    totalPayroll: 'تەواوی مووچەی بەش',
    overtime: 'زیادەکاری',
    wagePrefix: 'دەمزەرد/مووچە',
    activeWorkersCount: 'کارمەندانی چالاک',
    defaultCrew: 'کارمەندی بنەڕەتی',
    financialBreakdown: 'جیاکردنەوەی مووچەی بنەڕەتی و زیادەکاری',
    baseWage: 'مووچەی بنەڕەتی',
    overtimeWage: 'مووچەی زیادەکاری',
    avgCostPerDay: 'تێکڕای ڕۆژ',
    workforceSectionTitle: 'کارکردنی کارمەندان لەم بەشەدا',
    viewAll: 'بینینی هەموو',
    noLogsForThisSection: 'هیچ کارکردێک بۆ ئەم بەشە لەم ماوەیەدا تۆمار نەکراوە.',
    dayUnit: 'ڕۆژ',
    crewTabDesc: 'وردەکاریی کارکردن، کاتژمێری زیادەکاری و کۆی مووچەی هەر کارمەندێک لەم بەشەدا:',
    noCrewForThisSection: 'هیچ کارمەندێک لەم ماوەیەدا بۆ ئەم بەشە کاری نەکردووە.',
    defaultSectionBadge: 'بەشی سەرەکی',
    ofSectionTotal: 'لە کۆی کارکردنی بەش',
    activitiesTabDesc: 'ڕاپۆرت و تێبینیی کارە ئەنجامدراوەکانی ئەم بەشە:',
    noActivitiesLogged: 'هیچ تێبینییەکی چالاکی بۆ ئەم بەشە تۆمار نەکراوە.',
    halfDay: 'نیوەڕۆژ',
    fullDay: 'تەواوکات',
    hourShort: 'ک',
    currentActiveProject: 'پڕۆژەی چالاکی ئێستا',
    close: 'داخستن',
    initialFallback: '؟'
  },
  en: {
    workerFallback: 'Worker',
    sectionBadge: 'Project Section',
    archivedBadge: 'Archived',
    projectFallback: 'Project',
    switchToProjectTitle: 'Switch to this project and enter section',
    switchProject: 'Switch Project',
    allTime: 'All Time',
    byMonth: 'By Month',
    logsLogged: 'logs logged',
    overviewTab: 'Key Stats & Summary',
    crewTab: 'Crew & Workforce',
    activitiesTab: 'Activities & Work Notes',
    personDaysKPI: 'Person-Days',
    fullDays: 'Full',
    halfDays: 'Half',
    totalPayroll: 'Total Section Payroll',
    overtime: 'Overtime',
    wagePrefix: 'Wage',
    activeWorkersCount: 'Active Crew',
    defaultCrew: 'default crew',
    financialBreakdown: 'Base Wage vs Overtime Breakdown',
    baseWage: 'Base Wage',
    overtimeWage: 'Overtime',
    avgCostPerDay: 'Avg / Day',
    workforceSectionTitle: 'Section Workforce & Attendance',
    viewAll: 'View all',
    noLogsForThisSection: 'No attendance records logged for this section in this range.',
    dayUnit: 'days',
    crewTabDesc: 'Breakdown of days, overtime, and total wages per worker in this section:',
    noCrewForThisSection: 'No crew worked in this section during this period.',
    defaultSectionBadge: 'Default Section',
    ofSectionTotal: 'of section total',
    activitiesTabDesc: 'Daily work logs and activity notes logged for this section:',
    noActivitiesLogged: 'No activity notes logged for this section.',
    halfDay: 'Half-Day',
    fullDay: 'Full-Day',
    hourShort: 'h',
    currentActiveProject: 'Current Active Project',
    close: 'Close',
    initialFallback: '?'
  }
};

export function SectionStatsModal({ section, isOpen, onClose, onSwitchProject }) {
  const { language } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = SECTION_STATS_COPY[langKey] || SECTION_STATS_COPY.fa;

  const { switchProject, currentProject } = useProject();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'crew' | 'activities'
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'month'
  const [selectedMonth, setSelectedMonth] = useState('');

  // Fetch Parent Project
  const project = useLiveQuery(async () => {
    if (!section?.projectId) return null;
    return await db.projects.get(section.projectId);
  }, [section?.projectId]);

  // Fetch all workers
  const allWorkers = useLiveQuery(async () => {
    try {
      return await db.workers.toArray();
    } catch {
      return [];
    }
  }, []) || [];

  // Fetch all logs
  const allRawLogs = useLiveQuery(async () => {
    try {
      return await db.attendanceLogs.toArray();
    } catch {
      return [];
    }
  }, []) || [];

  // Filter logs belonging to this section
  const sectionLogs = useMemo(() => {
    if (!section?.id) return [];
    return allRawLogs.filter(l => !l.deletedAt && l.sectionId === section.id);
  }, [allRawLogs, section?.id]);

  // Extract available months from section logs for filtering
  const availableMonths = useMemo(() => {
    const set = new Set();
    sectionLogs.forEach(l => {
      if (l.date && l.date.length >= 7) {
        set.add(l.date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(set).sort().reverse();
  }, [sectionLogs]);

  // Set default month when available
  React.useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Filter logs by selected time period
  const filteredLogs = useMemo(() => {
    if (timeFilter === 'all') return sectionLogs;
    if (timeFilter === 'month' && selectedMonth) {
      return sectionLogs.filter(l => l.date && l.date.startsWith(selectedMonth));
    }
    return sectionLogs;
  }, [sectionLogs, timeFilter, selectedMonth]);

  // Create Worker Lookup Map
  const workerMap = useMemo(() => {
    const map = {};
    allWorkers.forEach(w => {
      map[w.id] = w;
    });
    return map;
  }, [allWorkers]);

  // Workers that have this section assigned as their default section
  const defaultWorkers = useMemo(() => {
    if (!section?.id) return [];
    return allWorkers.filter(w => !w.deletedAt && w.defaultSectionId === section.id);
  }, [allWorkers, section?.id]);

  const currency = project?.currency || 'IQD';

  // Compute Deep Statistics
  const stats = useMemo(() => {
    let totalPersonDays = 0;
    let fullDays = 0;
    let halfDays = 0;
    let hourlyDays = 0;
    let totalOvertimeHours = 0;
    let totalOvertimeWage = 0;
    let totalDailyWage = 0;
    let totalWageExpense = 0;

    const crewStatsMap = {};
    const activitiesList = [];

    filteredLogs.forEach(l => {
      const wObj = workerMap[l.workerId];
      const dailyWage = Number(l.dailyWage ?? wObj?.dailyWage ?? 0);
      const otH = Number(l.overtimeHours ?? 0);
      const otMultiplier = Number(l.overtimeMultiplier ?? 1.0);
      const stdHours = Number(l.standardWorkHours ?? 8) || 8;
      const hourlyRate = (dailyWage / stdHours) * otMultiplier;
      const otWage = otH * hourlyRate;

      let logDays = 0;
      let logBaseWage = 0;

      if (l.type === 'full') {
        fullDays += 1;
        logDays = 1;
        logBaseWage = dailyWage;
      } else if (l.type === 'half') {
        halfDays += 1;
        logDays = 0.5;
        logBaseWage = dailyWage * 0.5;
      } else if (l.type === 'hourly') {
        hourlyDays += 1;
        const workHours = Number(l.workHours ?? 0);
        logDays = workHours / stdHours;
        logBaseWage = (dailyWage / stdHours) * workHours;
      }

      totalPersonDays += logDays;
      totalOvertimeHours += otH;
      totalOvertimeWage += otWage;
      totalDailyWage += logBaseWage;
      totalWageExpense += (logBaseWage + otWage);

      // Track crew stats
      if (l.workerId) {
        if (!crewStatsMap[l.workerId]) {
          crewStatsMap[l.workerId] = {
            worker: wObj || { id: l.workerId, name: l.workerName || c.workerFallback, role: c.workerFallback },
            personDays: 0,
            fullDays: 0,
            halfDays: 0,
            overtimeHours: 0,
            totalPay: 0,
            isDefaultSection: wObj?.defaultSectionId === section?.id
          };
        }
        crewStatsMap[l.workerId].personDays += logDays;
        if (l.type === 'full') crewStatsMap[l.workerId].fullDays += 1;
        if (l.type === 'half') crewStatsMap[l.workerId].halfDays += 1;
        crewStatsMap[l.workerId].overtimeHours += otH;
        crewStatsMap[l.workerId].totalPay += (logBaseWage + otWage);
      }

      // Track note / activity if present
      const cleanNotes = (l.notes || '').trim();
      if (cleanNotes) {
        activitiesList.push({
          id: l.id,
          date: l.date,
          workerName: wObj?.name || c.workerFallback,
          type: l.type,
          overtimeHours: otH,
          notes: cleanNotes
        });
      }
    });

    // Sort crew by personDays desc
    const crewList = Object.values(crewStatsMap).sort((a, b) => b.personDays - a.personDays);

    // Sort activities by date desc
    activitiesList.sort((a, b) => b.date.localeCompare(a.date));

    const avgCostPerPersonDay = totalPersonDays > 0 ? totalWageExpense / totalPersonDays : 0;

    return {
      totalPersonDays,
      fullDays,
      halfDays,
      hourlyDays,
      totalOvertimeHours,
      totalOvertimeWage: roundCurrency(totalOvertimeWage, currency),
      totalDailyWage: roundCurrency(totalDailyWage, currency),
      totalWageExpense: roundCurrency(totalWageExpense, currency),
      activeWorkersCount: crewList.length,
      defaultWorkersCount: defaultWorkers.length,
      avgCostPerPersonDay: roundCurrency(avgCostPerPersonDay, currency),
      crewList,
      activitiesList,
      totalEntries: filteredLogs.length
    };
  }, [filteredLogs, workerMap, section?.id, defaultWorkers, currency, c]);

  if (!isOpen || !section) return null;

  const isCurrentProject = project?.id === currentProject?.id;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex no-print animate-in fade-in duration-200 flex items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-none sm:rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 flex-col h-full sm:h-auto max-h-none sm:max-h-[90vh] overflow-hidden my-auto"
      >
        {/* Header (Apple Liquid Glass Header) */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border-b border-slate-200/80 dark:border-white/10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 flex-shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {section.name}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                  {c.sectionBadge}
                </span>
                {section.status === 'archived' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                    {c.archivedBadge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <Building className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{project?.name || c.projectFallback}</span>
                <span>•</span>
                <span className="font-mono text-[11px]">{project?.currency || 'IQD'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Switch to Project button if not current */}
            {!isCurrentProject && project?.id && (
              <button
                type="button"
                onClick={() => {
                  switchProject(project.id);
                  if (onSwitchProject) onSwitchProject(project.id, section.id);
                  onClose();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-semibold border border-sky-200 dark:border-sky-800 transition-colors"
                title={c.switchToProjectTitle}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{c.switchProject}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar (All Time vs Month Filter) */}
        <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                timeFilter === 'all'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-600'
              }`}
            >
              {c.allTime}
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                timeFilter === 'month'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-600'
              }`}
            >
              {c.byMonth}
            </button>
          </div>

          {timeFilter === 'month' && availableMonths.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 ms-auto">
            {stats.totalEntries} {c.logsLogged}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-slate-200/60 dark:border-white/5 flex gap-4 overflow-x-auto text-xs sm:text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{c.overviewTab}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('crew')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'crew'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{c.crewTab} ({stats.crewList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activities')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'activities'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{c.activitiesTab} ({stats.activitiesList.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'overview' && (
            <>
              {/* 4 Main KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Person Days */}
                <div className="p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/60 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                    <span>{c.personDaysKPI}</span>
                    <CalendarDays className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-sky-700 dark:text-sky-300 mt-1 font-mono">
                    {stats.totalPersonDays}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {stats.fullDays} {c.fullDays} • {stats.halfDays} {c.halfDays}
                  </div>
                </div>

                {/* 2. Total Wages */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                    <span>{c.totalPayroll}</span>
                    <Coins className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1 truncate">
                    {formatCurrency(stats.totalWageExpense, currency)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {getCurrencySymbol(currency)}
                  </div>
                </div>

                {/* 3. Overtime Hours */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                    <span>{c.overtime}</span>
                    <Clock className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1 font-mono">
                    {formatHoursAndMinutes(stats.totalOvertimeHours)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {c.wagePrefix}: {formatCurrency(stats.totalOvertimeWage, currency)}
                  </div>
                </div>

                {/* 4. Active Crew Count */}
                <div className="p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                    <span>{c.activeWorkersCount}</span>
                    <Users className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-300 mt-1 font-mono">
                    {stats.activeWorkersCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {stats.defaultWorkersCount} {c.defaultCrew}
                  </div>
                </div>
              </div>

              {/* Financial Breakdown Progress Bar */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span>{c.financialBreakdown}</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                    {formatCurrency(stats.totalWageExpense, currency)} {getCurrencySymbol(currency)}
                  </span>
                </div>

                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  {stats.totalWageExpense > 0 && (
                    <>
                      <div 
                        style={{ width: `${(stats.totalDailyWage / stats.totalWageExpense) * 100}%` }}
                        className="h-full bg-sky-500 transition-all duration-500"
                        title={`${c.baseWage}: ${formatCurrency(stats.totalDailyWage, currency)}`}
                      />
                      <div 
                        style={{ width: `${(stats.totalOvertimeWage / stats.totalWageExpense) * 100}%` }}
                        className="h-full bg-indigo-500 transition-all duration-500"
                        title={`${c.overtimeWage}: ${formatCurrency(stats.totalOvertimeWage, currency)}`}
                      />
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span>{c.baseWage}: <strong>{formatCurrency(stats.totalDailyWage, currency)}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span>{c.overtimeWage}: <strong>{formatCurrency(stats.totalOvertimeWage, currency)}</strong></span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
                    <Calculator className="w-3 h-3" />
                    <span>{c.avgCostPerDay}: <strong>{formatCurrency(stats.avgCostPerPersonDay, currency)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Quick Preview of Crew */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>{c.workforceSectionTitle}</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('crew')}
                    className="text-sky-600 hover:text-sky-700 text-xs font-medium"
                  >
                    {c.viewAll} ({stats.crewList.length})
                  </button>
                </div>

                {stats.crewList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl">
                    {c.noLogsForThisSection}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {stats.crewList.slice(0, 5).map((cw) => {
                      const sharePct = stats.totalPersonDays > 0 ? ((cw.personDays / stats.totalPersonDays) * 100).toFixed(0) : 0;
                      return (
                        <div
                          key={cw.worker.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {(cw.worker.name || c.initialFallback).charAt(0)}
                            </div>
                            <div className="min-w-0 truncate">
                              <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {cw.worker.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {cw.worker.role || c.workerFallback}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-end flex-shrink-0">
                            <div>
                              <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                                {cw.personDays} {c.dayUnit}
                              </div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                {formatCurrency(cw.totalPay, currency)}
                              </div>
                            </div>
                            <div className="w-10 text-[10px] font-mono text-slate-400">
                              {sharePct}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'crew' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {c.crewTabDesc}
              </div>

              {stats.crewList.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl">
                  {c.noCrewForThisSection}
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.crewList.map((cw) => {
                    const sharePct = stats.totalPersonDays > 0 ? ((cw.personDays / stats.totalPersonDays) * 100).toFixed(1) : 0;
                    return (
                      <div
                        key={cw.worker.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {(cw.worker.name || c.initialFallback).charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                                  {cw.worker.name}
                                </span>
                                {cw.isDefaultSection && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                                    {c.defaultSectionBadge}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {cw.worker.role || c.workerFallback}
                              </div>
                            </div>
                          </div>

                          <div className="text-end flex-shrink-0">
                            <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(cw.totalPay, currency)} {getCurrencySymbol(currency)}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {cw.personDays} {c.dayUnit}
                            </div>
                          </div>
                        </div>

                        {/* Progress line */}
                        <div className="pt-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>{c.overtime}: {formatHoursAndMinutes(cw.overtimeHours)}</span>
                            <span>{sharePct}% {c.ofSectionTotal}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              style={{ width: `${sharePct}%` }}
                              className="h-full bg-sky-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activities' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {c.activitiesTabDesc}
              </div>

              {stats.activitiesList.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl">
                  {c.noActivitiesLogged}
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.activitiesList.map((act, index) => (
                    <div
                      key={act.id || index}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                          <FileText className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                          <span>{act.workerName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-normal">
                            {act.type === 'half' ? c.halfDay : c.fullDay}
                          </span>
                          {act.overtimeHours > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-normal">
                              +{act.overtimeHours} {c.hourShort}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                          {formatDateDisplay(act.date, language)}
                        </div>
                      </div>

                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed">
                        {act.notes}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2">
          {!isCurrentProject && project?.id ? (
            <button
              type="button"
              onClick={() => {
                switchProject(project.id);
                if (onSwitchProject) onSwitchProject(project.id, section.id);
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{c.switchToProjectTitle}</span>
            </button>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{c.currentActiveProject}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors ms-auto"
          >
            {c.close}
          </button>
        </div>
      </div>
    </div>
  );
}
