import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  X, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Search,
  DollarSign
} from 'lucide-react';
import { supabase } from '../services/realtimeSync';
import { db, getAttendanceLogId } from '../db/db';
import { formatCurrency, roundCurrency, formatDateDisplay, formatFullDateWithWeekday } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';

export default function AttendanceRecycleBinModal({ isOpen, onClose, workers = [] }) {
  const { language, t } = useLanguage();
  const { currentProject, currency = 'IQD' } = useProject();

  const [deletedLogs, setDeletedLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Map worker IDs to worker objects for quick lookup
  const workerMap = React.useMemo(() => {
    const map = {};
    workers.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [workers]);

  // Fetch deleted attendance logs from Supabase
  const fetchDeletedLogs = async () => {
    setIsLoading(true);
    try {
      if (!supabase) {
        setDeletedLogs([]);
        return;
      }

      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching deleted logs:', error);
      } else {
        setDeletedLogs(data || []);
      }
    } catch (err) {
      console.error('Fetch deleted logs failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDeletedLogs();
    }
  }, [isOpen]);

  // Restore a single log
  const handleRestoreLog = async (log) => {
    setRestoringId(log.id);
    try {
      const canonicalId = getAttendanceLogId(log.worker_id, log.date);
      const now = new Date().toISOString();

      // 1. Update Supabase deleted_at: null
      const { error } = await supabase
        .from('attendance_logs')
        .update({ deleted_at: null, updated_at: now })
        .eq('id', log.id);

      if (error) throw error;

      // 2. Parse metadata from notes
      let sectionId = log.section_id || null;
      let projectId = log.project_id || currentProject?.id || 'prj_default_main';
      let isSettled = log.is_settled || false;
      let settlementReceiptId = log.settlement_receipt_id || null;
      let cleanNotes = log.notes || '';

      if (cleanNotes.includes('__META__')) {
        try {
          const parts = cleanNotes.split('__META__');
          if (parts.length >= 3) {
            const meta = JSON.parse(parts[1]);
            if (meta.s) sectionId = meta.s;
            if (meta.p) projectId = meta.p;
            if (meta.st) isSettled = true;
            if (meta.rid) settlementReceiptId = meta.rid;
            cleanNotes = parts.slice(2).join('').trim();
          }
        } catch (_) {}
      }

      // 3. Put into local Dexie
      await db.attendanceLogs.put({
        id: canonicalId,
        workerId: log.worker_id,
        date: log.date,
        type: log.type || 'full',
        overtimeHours: Number(log.overtime_hours) || 0,
        calculatedDailyWage: roundCurrency(log.calculated_daily_wage, log.currency || currency),
        calculatedOvertimeWage: roundCurrency(log.calculated_overtime_wage, log.currency || currency),
        totalDayPay: roundCurrency(log.total_day_pay, log.currency || currency),
        notes: cleanNotes,
        sectionId,
        projectId,
        isSettled: Boolean(isSettled),
        settlementReceiptId,
        userId: log.user_id || 'default_user',
        createdAt: log.created_at || new Date(log.date).toISOString(),
        updatedAt: now
      });

      // 4. Proactively clear any pending deletion records in localStorage
      try {
        if (typeof localStorage !== 'undefined') {
          const PENDING_DELETED_LOGS_KEY = 'workshop_pending_deleted_logs';
          const list = JSON.parse(localStorage.getItem(PENDING_DELETED_LOGS_KEY) || '[]');
          const updated = list.filter(id => id !== log.id && id !== canonicalId);
          localStorage.setItem(PENDING_DELETED_LOGS_KEY, JSON.stringify(updated));
        }
      } catch (_) {}

      // 5. Notify the rest of the application
      window.dispatchEvent(new CustomEvent('workshop-sync-complete', { detail: { time: now } }));

      // 6. Remove from local deleted list
      setDeletedLogs((prev) => prev.filter((item) => item.id !== log.id));

      const workerName = workerMap[log.worker_id]?.name || (language === 'fa' ? 'پرسنل' : 'Worker');
      setToastMessage(language === 'fa' 
        ? `کارکرد ${workerName} در تاریخ ${log.date} با موفقیت بازیابی شد.` 
        : `Record for ${workerName} (${log.date}) restored successfully.`);

      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Failed to restore log:', err);
      alert('خطا در بازیابی رکورد: ' + err.message);
    } finally {
      setRestoringId(null);
    }
  };

  // Restore All filtered logs
  const handleRestoreAll = async () => {
    if (filteredLogs.length === 0) return;
    const confirmMsg = language === 'fa' 
      ? `آیا از بازیابی همه‌ی ${filteredLogs.length} رکورد حذف‌شده اطمینان دارید؟` 
      : `Are you sure you want to restore all ${filteredLogs.length} deleted records?`;

    if (!window.confirm(confirmMsg)) return;

    setIsLoading(true);
    let successCount = 0;
    for (const log of filteredLogs) {
      try {
        await handleRestoreLog(log);
        successCount++;
      } catch (err) {
        console.warn('Error during bulk restore:', err);
      }
    }
    setIsLoading(false);
    fetchDeletedLogs();
  };

  // Filter logs by search term (worker name or date)
  const filteredLogs = React.useMemo(() => {
    if (!searchTerm.trim()) return deletedLogs;
    const q = searchTerm.toLowerCase().trim();
    return deletedLogs.filter((l) => {
      const worker = workerMap[l.worker_id];
      const name = (worker?.name || '').toLowerCase();
      const date = (l.date || '').toLowerCase();
      const notes = (l.notes || '').toLowerCase();
      return name.includes(q) || date.includes(q) || notes.includes(q);
    });
  }, [deletedLogs, searchTerm, workerMap]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 start-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{language === 'fa' ? 'سطل بازیافت کارکرد پرسنل' : language === 'ku' ? 'تەنەکەی خۆڵ و گەڕاندنەوە' : 'Attendance Recycle Bin'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                  {deletedLogs.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'fa' 
                  ? 'رکوردهای حذف‌شده در کارکرد جاری را می‌توانید با یک کلیک فوراً بازیابی کنید.' 
                  : 'Restore deleted attendance records instantly with 1-click.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Actions */}
        <div className="py-3 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'fa' ? 'جستجو در نام پرسنل، تاریخ یا توضیحات...' : 'Search by name, date or notes...'}
              className="w-full ps-9 pe-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            type="button"
            onClick={fetchDeletedLogs}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-sky-600 transition-colors shrink-0"
            title={language === 'fa' ? 'به‌روزرسانی لیست' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-500' : ''}`} />
          </button>

          {filteredLogs.length > 0 && (
            <button
              type="button"
              onClick={handleRestoreAll}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{language === 'fa' ? 'بازیابی همه' : 'Restore All'}</span>
            </button>
          )}
        </div>

        {/* Main List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pe-1 py-1">
          {isLoading && deletedLogs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
              <span className="text-xs">{language === 'fa' ? 'در حال بارگذاری رکوردهای حذف‌شده...' : 'Loading deleted logs...'}</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 font-bold">
                ✓
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {searchTerm 
                  ? (language === 'fa' ? 'هیچ رکوردی منطبق با جستجو پیدا نشد.' : 'No matching records found.') 
                  : (language === 'fa' ? 'سطل بازیافت خالی است' : 'Recycle bin is empty')}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {language === 'fa' 
                  ? 'تمامی رکوردهای کارکرد در وضعیت امن قرار دارند و هیچ دیتای حذف‌شده‌ای وجود ندارد.' 
                  : 'All attendance records are active and no deleted logs were found.'}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const worker = workerMap[log.worker_id];
              const isRestoring = restoringId === log.id;
              const isSettled = Boolean(log.is_settled || (log.notes && log.notes.includes('"st":1')));

              return (
                <div
                  key={log.id}
                  className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left: Worker & Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold flex items-center justify-center text-xs shrink-0">
                        {worker?.name ? worker.name.charAt(0) : <User className="w-3.5 h-3.5" />}
                      </div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {worker?.name || (language === 'fa' ? 'پرسنل نامشخص' : 'Unknown Worker')}
                      </span>

                      {/* Date Badge */}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatFullDateWithWeekday(log.date, language)}</span>
                      </span>

                      {/* Type Badge */}
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        log.type === 'half'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : log.type === 'hourly'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}>
                        {log.type === 'half' ? (language === 'fa' ? 'نیم‌روز' : 'Half') : log.type === 'hourly' ? (language === 'fa' ? 'ساعتی' : 'Hourly') : (language === 'fa' ? 'روز کامل' : 'Full')}
                      </span>

                      {isSettled && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                          {language === 'fa' ? 'تسویه شده' : 'Settled'}
                        </span>
                      )}
                    </div>

                    {/* Stats & Notes Row */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      {Number(log.overtime_hours) > 0 && (
                        <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400">
                          <Clock className="w-3 h-3" />
                          <span>{log.overtime_hours} ساعت اضافه</span>
                        </span>
                      )}

                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        {formatCurrency(log.total_day_pay || 0, currency, language)}
                      </span>

                      {log.notes && (
                        <span className="italic truncate max-w-xs text-slate-400">
                          "{log.notes.replace(/__META__[\s\S]*?__META__/, '').trim()}"
                        </span>
                      )}

                      {log.deleted_at && (
                        <span className="text-[10px] text-rose-500/80 font-mono ms-auto">
                          حذف: {new Date(log.deleted_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Restore Button */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestoreLog(log)}
                      disabled={isRestoring}
                      className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-600 hover:text-white text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 hover:border-transparent text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                      <span>{isRestoring ? (language === 'fa' ? 'در حال بازیابی...' : 'Restoring...') : (language === 'fa' ? 'بازیابی' : 'Restore')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>{language === 'fa' ? 'حفاظت ابری از کارکرد پرسنل فعال است' : 'Cloud attendance protection active'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {language === 'fa' ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
