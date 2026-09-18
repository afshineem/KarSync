import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { EditRecordModal } from './EditRecordModal';
import { formatIQD, formatNumber, getCurrentYearMonth, formatHoursAndMinutes } from '../utils/formatters';
import { 
  Users, 
  Calendar, 
  Clock, 
  Coins, 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle, 
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet, 
  FileText,
  Edit2
} from 'lucide-react';

export function DashboardView({ onOpenLoggingModal, setActiveTab }) {
  const { t, language, direction } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  const [editingLog, setEditingLog] = useState(null);

  // Fetch reactive data from Dexie
  const workers = useLiveQuery(() => db.workers.toArray(), []) || [];
  const rawLogs = useLiveQuery(
    () => db.attendanceLogs.where('date').startsWith(selectedMonth).toArray(),
    [selectedMonth]
  ) || [];

  // Deduplicate logs in memory by workerId + date
  const logs = useMemo(() => {
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

  // Filter active workers
  const activeWorkers = useMemo(() => {
    return workers.filter((w) => w.isActive === 1);
  }, [workers]);

  // Aggregate monthly stats
  const monthlyStats = useMemo(() => {
    let totalNormalDays = 0;
    let totalHalfDays = 0;
    let totalOvertimeHours = 0;
    let totalPayroll = 0;

    logs.forEach((log) => {
      if (log.type === 'half') {
        totalHalfDays += 1;
      } else if (log.type === 'hourly') {
        // Hourly only, not standard day
      } else {
        totalNormalDays += 1;
      }
      totalOvertimeHours += Number(log.overtimeHours) || 0;
      totalPayroll += Number(log.totalDayPay) || 0;
    });

    const totalDaysCount = totalNormalDays + (totalHalfDays * 0.5);

    return {
      activeCount: activeWorkers.length,
      totalDaysCount,
      totalNormalDays,
      totalHalfDays,
      totalOvertimeHours,
      totalPayroll
    };
  }, [logs, activeWorkers]);

  // Aggregate per-worker breakdown for the selected month
  const workerSummaries = useMemo(() => {
    return workers.map((worker) => {
      const workerLogs = logs.filter((l) => l.workerId === worker.id);
      
      let fullDays = 0;
      let halfDays = 0;
      let otHours = 0;
      let basePay = 0;
      let otPay = 0;
      let totalPay = 0;

      workerLogs.forEach((l) => {
        if (l.type === 'half') {
          halfDays += 1;
        } else if (l.type === 'hourly') {
          // Hourly only
        } else {
          fullDays += 1;
        }
        otHours += Number(l.overtimeHours) || 0;
        basePay += Number(l.calculatedDailyWage) || 0;
        otPay += Number(l.calculatedOvertimeWage) || 0;
        totalPay += Number(l.totalDayPay) || 0;
      });

      return {
        ...worker,
        fullDays,
        halfDays,
        otHours,
        basePay,
        otPay,
        totalPay,
        logsCount: workerLogs.length
      };
    });
  }, [workers, logs]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const prevMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(prevMonth);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    const nextMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonth);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header with Month Navigator & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-sky-500" />
            <span>{t('dashboard')}</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('workerSummaryTitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector Controls */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={direction === 'rtl' ? handleNextMonth : handlePrevMonth}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous Month"
            >
              {direction === 'rtl' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 dark:text-slate-200 px-2 py-1 focus:outline-none cursor-pointer"
            />
            <button
              onClick={direction === 'rtl' ? handlePrevMonth : handleNextMonth}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Next Month"
            >
              {direction === 'rtl' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>

          {/* Quick Record Button */}
          <button
            onClick={onOpenLoggingModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-medium text-sm rounded-xl shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('logDailyAttendance')}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Active Workers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('activeWorkersCount')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(monthlyStats.activeCount)}
            </span>
            <span className="text-xs text-slate-400 mx-2">
              / {workers.length} {t('workers')}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-medium">
            <button 
              onClick={() => setActiveTab('workers')} 
              className="hover:underline flex items-center gap-1"
            >
              <span>{t('workerList')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: Total Working Days */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('monthlyWorkingDays')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(monthlyStats.totalDaysCount)}
            </span>
            <span className="text-xs text-slate-400 mx-2">
              ({monthlyStats.totalNormalDays} + {monthlyStats.totalHalfDays}?0.5)
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <button 
              onClick={() => setActiveTab('calendar')} 
              className="hover:underline flex items-center gap-1"
            >
              <span>{t('calendarTitle')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 3: Total Overtime Hours */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('totalOvertimeHours')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {formatHoursAndMinutes(monthlyStats.totalOvertimeHours, language)}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            {t('overtimePay')}: {formatIQD(logs.reduce((acc, l) => acc + (Number(l.calculatedOvertimeWage) || 0), 0), language)}
          </div>
        </div>

        {/* Card 4: Total Payroll (IQD) */}
        <div className="bg-gradient-to-br from-sky-600 to-sky-700 text-white rounded-2xl p-5 shadow-lg shadow-sky-600/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-sky-100">
              {t('totalPayrollExpense')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center backdrop-blur-sm">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black tracking-tight">
              {formatIQD(monthlyStats.totalPayroll, language)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-sky-200">
            <span>{selectedMonth}</span>
            <button 
              onClick={() => setActiveTab('calendar')}
              className="underline hover:text-white font-medium flex items-center gap-1"
            >
              <span>{t('reports')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Worker Summary Table / Card List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('workerSummaryTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedMonth} • {workers.length} {t('workers')}
            </p>
          </div>

          <button
            onClick={() => setActiveTab('calendar')}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-500" />
            <span>{t('reports')} & {t('exportExcel')}</span>
          </button>
        </div>

        {workerSummaries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {t('noDataForMonth')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <th className="px-4 py-3 text-start">{t('workerName')}</th>
                  <th className="px-4 py-3 text-start">{t('workerRole')}</th>
                  <th className="px-4 py-3 text-center">{t('normalDays')}</th>
                  <th className="px-4 py-3 text-center">{t('halfDays')}</th>
                  <th className="px-4 py-3 text-center">{t('overtimeHours')}</th>
                  <th className="px-4 py-3 text-end">{t('basePay')}</th>
                  <th className="px-4 py-3 text-end">{t('overtimePay')}</th>
                  <th className="px-4 py-3 text-end font-bold text-sky-600 dark:text-sky-400">{t('netSalary')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workerSummaries.map((w) => (
                  <tr 
                    key={w.id} 
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      w.isActive === 0 ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white text-start">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${w.isActive === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        <span>{w.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs text-start">
                      {w.role}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-700 dark:text-slate-300">
                      {w.fullDays}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-700 dark:text-slate-300">
                      {w.halfDays}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-amber-600 dark:text-amber-400">
                      {w.otHours > 0 ? formatHoursAndMinutes(w.otHours, language) : '0'}
                    </td>
                    <td className="px-4 py-3 text-end text-slate-600 dark:text-slate-400">
                      {formatIQD(w.basePay, language)}
                    </td>
                    <td className="px-4 py-3 text-end text-amber-600 dark:text-amber-400 font-medium">
                      {formatIQD(w.otPay, language)}
                    </td>
                    <td className="px-4 py-3 text-end font-bold text-slate-900 dark:text-white">
                      <span className="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800/60">
                        {formatIQD(w.totalPay, language)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan="2" className="px-4 py-3 text-start">
                    {t('aggregatedTotalPay')} ({selectedMonth})
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                    {monthlyStats.totalNormalDays}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                    {monthlyStats.totalHalfDays}
                  </td>
                  <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">
                    {formatHoursAndMinutes(monthlyStats.totalOvertimeHours, language)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {formatIQD(logs.reduce((acc, l) => acc + (Number(l.calculatedDailyWage) || 0), 0), language)}
                  </td>
                  <td className="px-4 py-3 text-end text-amber-600 dark:text-amber-400">
                    {formatIQD(logs.reduce((acc, l) => acc + (Number(l.calculatedOvertimeWage) || 0), 0), language)}
                  </td>
                  <td className="px-4 py-3 text-end text-sky-600 dark:text-sky-400 text-base font-black">
                    {formatIQD(monthlyStats.totalPayroll, language)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    
      {/* Recent Tasks & Work Notes Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-500" />
              <span>{t('recentTasksTitle')}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('recentTasksDesc')}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('calendar')}
            className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>{t('dayView')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {logs.filter(l => l.notes && l.notes.trim()).length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            {t('noTasksRecorded')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {logs.filter(l => l.notes && l.notes.trim()).slice(-6).reverse().map((log) => {
              const worker = workers.find(w => w.id === log.workerId) || { name: 'Unknown', role: '' };
              return (
                <div key={log.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white">{worker.name}</span>
                        <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">({log.date})</span>
                      </div>
                      <button
                        onClick={() => setEditingLog(log)}
                        className="p-1 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={t('edit')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium line-clamp-3">
                      {log.notes}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDayOption') : t('fullDayOption')}</span>
                    {log.overtimeHours > 0 && (
                      <span className="text-amber-500 font-bold">
                        {log.type === 'hourly' ? '' : '+'}{formatHoursAndMinutes(log.overtimeHours, language)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated Edit Record Modal */}
      <EditRecordModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
      />

    </div>
  );
}