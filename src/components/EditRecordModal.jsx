import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAttendanceLogId } from '../db/db';
import { pushLogsLive, deleteLogLive } from '../services/realtimeSync';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  formatIQD, 
  formatDateDisplay, 
  formatFullDateWithWeekday, 
  toDecimalHours, 
  fromDecimalHours, 
  formatHoursAndMinutes,
  roundIQD
} from '../utils/formatters';
import { 
  X, 
  Trash2, 
  Check, 
  Clock, 
  FileText, 
  User, 
  Calendar, 
  Coins, 
  ChevronUp, 
  ChevronDown, 
  RotateCcw,
  Edit3
} from 'lucide-react';

export function EditRecordModal({ log, isOpen, onClose }) {
  const { t, language } = useLanguage();

  const worker = useLiveQuery(
    () => (log?.workerId ? db.workers.get(log.workerId) : null),
    [log?.workerId]
  );

  const [type, setType] = useState('full');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Synchronize state when log changes or modal opens
  useEffect(() => {
    if (!isOpen || !log) return;

    setType(log.type || 'full');
    const { hours: h, minutes: m } = fromDecimalHours(log.overtimeHours || 0);
    setHours(h);
    setMinutes(m);
    setNotes(log.notes || '');
    setToastMessage('');
    setIsSaving(false);
  }, [isOpen, log]);

  if (!isOpen || !log) return null;

  // Real-time calculations
  const decimalHours = toDecimalHours(hours, minutes);
  const hourlyRate = (worker?.overtimeHourlyRate > 0)
    ? worker.overtimeHourlyRate
    : Math.round((worker?.dailyRate || 0) / 8);

  let calculatedDailyWage = 0;
  let calculatedOvertimeWage = 0;

  if (type === 'hourly') {
    calculatedDailyWage = 0;
    calculatedOvertimeWage = roundIQD(decimalHours * hourlyRate);
  } else {
    const baseFactor = type === 'half' ? 0.5 : 1.0;
    calculatedDailyWage = roundIQD((worker?.dailyRate || 0) * baseFactor);
    calculatedOvertimeWage = roundIQD(decimalHours * (worker?.overtimeHourlyRate || 0));
  }
  const totalDayPay = roundIQD(calculatedDailyWage + calculatedOvertimeWage);

  // Stepper handlers
  const handleHoursChange = (val) => {
    setHours(Math.max(0, Math.min(24, Number(val) || 0)));
  };

  const handleMinutesChange = (val) => {
    setMinutes(Math.max(0, Math.min(59, Number(val) || 0)));
  };

  const addMinutes = (delta) => {
    let totalM = hours * 60 + minutes + delta;
    if (totalM < 0) totalM = 0;
    const newH = Math.min(24, Math.floor(totalM / 60));
    const newM = newH >= 24 ? 0 : totalM % 60;
    setHours(newH);
    setMinutes(newM);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!log) return;

    setIsSaving(true);
    try {
      const canonicalId = getAttendanceLogId(log.workerId, log.date);
      const updatedRecord = {
        ...log,
        id: canonicalId,
        type,
        overtimeHours: decimalHours,
        calculatedDailyWage,
        calculatedOvertimeWage,
        totalDayPay,
        notes: notes ? notes.trim() : '',
        updatedAt: new Date().toISOString()
      };

      if (log.id !== canonicalId) {
        await db.attendanceLogs.delete(log.id);
        deleteLogLive(log.id).catch(() => {});
      }
      await db.attendanceLogs.put(updatedRecord);

      // Realtime sync to Supabase
      try {
        await pushLogsLive([updatedRecord]);
      } catch (syncErr) {
        console.warn('Supabase sync failed during edit:', syncErr);
      }

      setToastMessage(t('editRecordSuccess'));
      setTimeout(() => {
        setIsSaving(false);
        setToastMessage('');
        onClose();
      }, 500);
    } catch (err) {
      console.error('Error saving edited record:', err);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!log) return;
    if (window.confirm(t('deleteLogConfirm'))) {
      try {
        await db.attendanceLogs.delete(log.id);
        deleteLogLive(log.id).catch(() => {});
        onClose();
      } catch (err) {
        console.error('Error deleting log:', err);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-4 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {t('editRecordTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('editRecordDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Worker & Date Pill Header */}
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-sky-500" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {worker?.name || '...'}
            </span>
            {worker?.role && (
              <span className="text-slate-400">({worker.role})</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatFullDateWithWeekday(log.date, language)}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          
          {/* Day Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('typeColumn')}:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('full')}
                className={`py-2 px-2 sm:px-3 text-xs font-bold rounded-xl border transition-all ${
                  type === 'full'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50'
                }`}
              >
                {t('fullDayOption')}
              </button>
              <button
                type="button"
                onClick={() => setType('half')}
                className={`py-2 px-2 sm:px-3 text-xs font-bold rounded-xl border transition-all ${
                  type === 'half'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-500/50'
                }`}
              >
                {t('halfDayOption')}
              </button>
              <button
                type="button"
                onClick={() => setType('hourly')}
                className={`py-2 px-2 sm:px-3 text-xs font-bold rounded-xl border transition-all ${
                  type === 'hourly'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-500/50'
                }`}
              >
                {t('hourlyOnlyOption')}
              </button>
            </div>
          </div>

          {/* Time inputs: Hours and Minutes Stepper */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>
                  {type === 'hourly' ? t('workedTimeLabel') : t('overtimeHoursLabel')}
                </span>
              </label>
              {decimalHours > 0 && (
                <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                  {formatHoursAndMinutes(decimalHours, language)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Hours Stepper */}
              <div className="flex-1 flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-2 py-1 shadow-sm">
                <span className="text-xs font-semibold text-slate-400 me-2">
                  {t('hoursLabel')}:
                </span>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={hours}
                  onChange={(e) => handleHoursChange(e.target.value)}
                  className="w-full bg-transparent text-sm font-extrabold text-slate-900 dark:text-white text-center focus:outline-none"
                />
                <div className="flex flex-col ms-1">
                  <button
                    type="button"
                    onClick={() => setHours((h) => Math.min(24, h + 1))}
                    className="p-0.5 text-slate-400 hover:text-sky-500"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHours((h) => Math.max(0, h - 1))}
                    className="p-0.5 text-slate-400 hover:text-sky-500"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <span className="font-extrabold text-slate-400 text-base">:</span>

              {/* Minutes Stepper */}
              <div className="flex-1 flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-2 py-1 shadow-sm">
                <span className="text-xs font-semibold text-slate-400 me-2">
                  {t('minutesLabel')}:
                </span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => handleMinutesChange(e.target.value)}
                  className="w-full bg-transparent text-sm font-extrabold text-slate-900 dark:text-white text-center focus:outline-none"
                />
                <div className="flex flex-col ms-1">
                  <button
                    type="button"
                    onClick={() => addMinutes(5)}
                    className="p-0.5 text-slate-400 hover:text-sky-500"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => addMinutes(-5)}
                    className="p-0.5 text-slate-400 hover:text-sky-500"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick adjust chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[11px]">
              <span className="text-slate-400 text-[10px] me-1">تنظیم سریع:</span>
              <button
                type="button"
                onClick={() => addMinutes(15)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => addMinutes(30)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
              >
                +30m
              </button>
              <button
                type="button"
                onClick={() => addMinutes(60)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
              >
                +1h
              </button>
              <button
                type="button"
                onClick={() => { setHours(0); setMinutes(0); }}
                className="px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-medium ms-auto flex items-center gap-1"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>0:00</span>
              </button>
            </div>
          </div>

          {/* Notes & Tasks Performed (توضیحات و شرح کار) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-500" />
              <span>{t('notesLabel')}</span>
            </label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none leading-relaxed"
            />
          </div>

          {/* Live Pay Calculation Summary Box */}
          <div className="p-3.5 bg-gradient-to-br from-slate-50 to-sky-50/40 dark:from-slate-800/60 dark:to-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900/50">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
              <span>{t('dailyRateLabel')}:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formatIQD(worker?.dailyRate || 0, language)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
              <span>{t('calculatedDayTotal')}</span>
              <span className="text-base font-extrabold text-sky-600 dark:text-sky-400">
                {formatIQD(totalDayPay, language)}
              </span>
            </div>
          </div>

          {toastMessage && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {toastMessage}
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('delete')}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm shadow-sky-600/20 flex items-center gap-1.5 transition-all"
              >
                {isSaving ? (
                  <span>{t('savingAttendance')}</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t('saveChanges')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
