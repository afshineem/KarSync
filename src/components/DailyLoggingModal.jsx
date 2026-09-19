import { pushLogsLive } from '../services/realtimeSync';
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAttendanceLogId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { 
  formatCurrency, 
  getTodayDateString, 
  toDecimalHours, 
  fromDecimalHours, 
  formatHoursAndMinutes, 
  roundCurrency,
  getCurrencySymbol 
} from '../utils/formatters';
import { EditRecordModal } from './EditRecordModal';
import { 
  Plus, 
  Calendar, 
  Clock, 
  FileText, 
  AlertTriangle, 
  Check, 
  X, 
  UserCheck, 
  Coins,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Edit2,
  Users,
  ShieldAlert,
  Layers
} from 'lucide-react';

export function DailyLoggingModal({ isOpen, onClose, initialDate }) {
  const { t, language } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';
  const standardHours = currentProject?.standardWorkHours || 8;

  const [selectedDate, setSelectedDate] = useState(initialDate || getTodayDateString());
  const [selectedWorkers, setSelectedWorkers] = useState({});
  const [workerConfigs, setWorkerConfigs] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingLog, setEditingLog] = useState(null);

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

  const handleDefaultSectionChange = (newSecId) => {
    setDefaultSectionId(newSecId);
    setWorkerConfigs((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        updated[id] = { ...updated[id], sectionId: newSecId || null };
      });
      return updated;
    });
  };

  // Fetch active workers for current project with fallback for legacy records
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId && w.isActive === 1);
    },
    [targetProjectId]
  ) || [];

  // Fetch existing logs for the selected date to detect pre-existing logs
  const existingDateLogs = useLiveQuery(
    async () => {
      const list = await db.attendanceLogs.toArray();
      return list.filter((l) => (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId && l.date === selectedDate);
    },
    [targetProjectId, selectedDate]
  ) || [];

  const existingWorkerLogMap = useMemo(() => {
    const map = {};
    existingDateLogs.forEach((l) => {
      map[l.workerId] = l;
    });
    return map;
  }, [existingDateLogs]);

  // Separate workers into available to log vs already logged
  const { unloggedWorkers, alreadyLoggedWorkers } = useMemo(() => {
    const unlogged = [];
    const alreadyLogged = [];
    workers.forEach((w) => {
      const log = existingWorkerLogMap[w.id];
      if (log) {
        alreadyLogged.push({ worker: w, log });
      } else {
        unlogged.push(w);
      }
    });
    return { unloggedWorkers: unlogged, alreadyLoggedWorkers: alreadyLogged };
  }, [workers, existingWorkerLogMap]);

  // When date changes or modal opens, initialize selections for UNLOGGED workers only
  useEffect(() => {
    if (!isOpen) return;
    if (initialDate) {
      setSelectedDate(initialDate);
    }

    const initialSelected = {};
    const initialConfigs = {};

    unloggedWorkers.forEach((w) => {
      initialSelected[w.id] = true;
      initialConfigs[w.id] = {
        type: 'full',
        overtimeHours: 0,
        notes: '',
        sectionId: defaultSectionId || null
      };
    });

    setSelectedWorkers(initialSelected);
    setWorkerConfigs(initialConfigs);
  }, [isOpen, selectedDate, unloggedWorkers.length, defaultSectionId]);

  // Handle worker checkbox toggle
  const toggleWorkerSelection = (workerId) => {
    // If worker is already logged, do not allow toggling on
    if (existingWorkerLogMap[workerId]) return;

    setSelectedWorkers((prev) => ({
      ...prev,
      [workerId]: !prev[workerId]
    }));
  };

  // Select all / Deselect all for unlogged workers
  const handleSelectAll = () => {
    const all = {};
    unloggedWorkers.forEach((w) => {
      all[w.id] = true;
    });
    setSelectedWorkers(all);
  };

  const handleDeselectAll = () => {
    const none = {};
    unloggedWorkers.forEach((w) => {
      none[w.id] = false;
    });
    setSelectedWorkers(none);
  };

  // Update granular config per worker
  const updateWorkerConfig = (workerId, field, value) => {
    setWorkerConfigs((prev) => ({
      ...prev,
      [workerId]: {
        ...(prev[workerId] || { type: 'full', overtimeHours: 0, notes: '' }),
        [field]: value
      }
    }));
  };

  // Calculate day wage preview for a worker
  const calculateWorkerDayPay = (worker) => {
    const cfg = workerConfigs[worker.id] || { type: 'full', overtimeHours: 0 };
    const otHours = Math.max(0, Number(cfg.overtimeHours) || 0);
    const hourlyRate = worker.overtimeHourlyRate > 0 
      ? worker.overtimeHourlyRate 
      : Math.round((worker.dailyRate || 0) / standardHours);

    let basePay = 0;
    let otPay = 0;

    if (cfg.type === 'hourly') {
      basePay = 0;
      otPay = roundCurrency(otHours * hourlyRate, currency);
    } else {
      const baseFactor = cfg.type === 'half' ? 0.5 : 1.0;
      basePay = roundCurrency((worker.dailyRate || 0) * baseFactor, currency);
      otPay = roundCurrency(otHours * (worker.overtimeHourlyRate || 0), currency);
    }

    return {
      basePay,
      otPay,
      total: roundCurrency(basePay + otPay, currency)
    };
  };

  // Stepper handlers for hours & minutes
  const handleHoursChange = (workerId, val) => {
    const h = Math.max(0, Math.min(24, parseInt(val, 10) || 0));
    const currentOt = Number(workerConfigs[workerId]?.overtimeHours) || 0;
    const { minutes } = fromDecimalHours(currentOt);
    const newDecimal = toDecimalHours(h, minutes);
    updateWorkerConfig(workerId, 'overtimeHours', newDecimal);
  };

  const handleMinutesChange = (workerId, val) => {
    const m = Math.max(0, Math.min(59, parseInt(val, 10) || 0));
    const currentOt = Number(workerConfigs[workerId]?.overtimeHours) || 0;
    const { hours } = fromDecimalHours(currentOt);
    const newDecimal = toDecimalHours(hours, m);
    updateWorkerConfig(workerId, 'overtimeHours', newDecimal);
  };

  const addTime = (workerId, deltaMinutes) => {
    const currentOt = Number(workerConfigs[workerId]?.overtimeHours) || 0;
    const { hours, minutes } = fromDecimalHours(currentOt);
    let totalMinutes = hours * 60 + minutes + deltaMinutes;
    if (totalMinutes < 0) totalMinutes = 0;
    const newHours = Math.min(24, Math.floor(totalMinutes / 60));
    const newMinutes = newHours >= 24 ? 0 : totalMinutes % 60;
    const newDecimal = toDecimalHours(newHours, newMinutes);
    updateWorkerConfig(workerId, 'overtimeHours', newDecimal);
  };

  // Batch Save to IndexedDB
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    const checkedWorkerIds = Object.keys(selectedWorkers).filter(
      (id) => selectedWorkers[id]
    );

    if (checkedWorkerIds.length === 0) {
      alert(t('noWorkerSelectedError'));
      return;
    }

    // Safety guard: Ensure no already logged worker is submitted again
    const duplicates = checkedWorkerIds.filter((id) => existingWorkerLogMap[id]);
    if (duplicates.length > 0) {
      const names = duplicates.map((id) => workers.find((w) => w.id === id)?.name || id).join(', ');
      alert(t('workerAlreadyLoggedError', { name: names }));
      return;
    }

    setIsSaving(true);
    try {
      const savedLogs = [];
      await db.transaction('rw', db.attendanceLogs, async () => {
        for (const workerId of checkedWorkerIds) {
          const worker = workers.find((w) => w.id === workerId);
          if (!worker) continue;

          const cfg = workerConfigs[workerId] || { type: 'full', overtimeHours: 0, notes: '' };
          const otHours = Math.max(0, Number(cfg.overtimeHours) || 0);
          const hourlyRate = worker.overtimeHourlyRate > 0 
            ? worker.overtimeHourlyRate 
            : Math.round((worker.dailyRate || 0) / standardHours);

          let calculatedDailyWage = 0;
          let calculatedOvertimeWage = 0;

          if (cfg.type === 'hourly') {
            calculatedDailyWage = 0;
            calculatedOvertimeWage = roundCurrency(otHours * hourlyRate, currency);
          } else {
            const baseFactor = cfg.type === 'half' ? 0.5 : 1.0;
            calculatedDailyWage = roundCurrency(worker.dailyRate * baseFactor, currency);
            calculatedOvertimeWage = roundCurrency(otHours * (worker.overtimeHourlyRate || 0), currency);
          }
          const totalDayPay = roundCurrency(calculatedDailyWage + calculatedOvertimeWage, currency);

          // Deterministic unique ID per worker per date
          const canonicalId = getAttendanceLogId(workerId, selectedDate);
          const newRecord = {
            id: canonicalId,
            workerId,
            projectId: currentProject?.id || 'prj_default_main',
            userId: user?.id || null,
            sectionId: cfg.sectionId || defaultSectionId || null,
            date: selectedDate,
            type: cfg.type,
            overtimeHours: otHours,
            calculatedDailyWage,
            calculatedOvertimeWage,
            totalDayPay,
            notes: cfg.notes ? cfg.notes.trim() : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await db.attendanceLogs.put(newRecord);
          savedLogs.push(newRecord);
        }
      });

      // Realtime push to Supabase
      if (savedLogs.length > 0) {
        pushLogsLive(savedLogs).catch((err) => console.warn('Supabase live push warning:', err));
      }

      setToastMessage(t('batchSavedSuccess', { count: checkedWorkerIds.length }));
      setTimeout(() => {
        setToastMessage('');
        onClose();
      }, 900);

    } catch (err) {
      console.error('Error saving batch attendance:', err);
      alert('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = Object.keys(selectedWorkers).filter(id => selectedWorkers[id]).length;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-4 sm:p-6 shadow-2xl my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {t('logDailyAttendance')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('workerSelectionNotice')} ({selectedCount} / {unloggedWorkers.length})
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

        {/* Success Toast Banner */}
        {toastMessage && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
            <Check className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Date Selector & Quick Toggles */}
        <div className="mt-4 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              {t('selectDate')}:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {projectSections.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
              <Layers className="w-4 h-4 text-sky-500 flex-shrink-0" />
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {t('section') || 'بخش'}:
              </label>
              <select
                value={defaultSectionId}
                onChange={(e) => handleDefaultSectionChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
              >
                <option value="" className="bg-white dark:bg-slate-800">
                  {language === 'fa' ? 'عمومی / کل پروژه' : 'General'}
                </option>
                {projectSections.map((sec) => (
                  <option key={sec.id} value={sec.id} className="bg-white dark:bg-slate-800">
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {unloggedWorkers.length > 0 && (
            <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-medium">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
              >
                {t('selectAll')}
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
              >
                {t('deselectAll')}
              </button>
            </div>
          )}

        </div>

        {/* Scrollable Workers Selection List */}
        <div className="overflow-y-auto flex-1 my-4 pe-1 space-y-4">
          
          {/* Case A: All active workers are already logged */}
          {unloggedWorkers.length === 0 && (
            <div className="p-4 sm:p-5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>{t('allWorkersAlreadyLoggedNotice')}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                {t('alreadyLoggedSectionDesc')}
              </p>
            </div>
          )}

          {/* Section 1: Workers Available to Log */}
          {unloggedWorkers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                <span>{t('readyToLogCount', { count: unloggedWorkers.length })}:</span>
                <span className="text-slate-400 font-normal">
                  {selectedCount} کارگر انتخاب‌شده
                </span>
              </div>

              {unloggedWorkers.map((worker) => {
                const isChecked = !!selectedWorkers[worker.id];
                const cfg = workerConfigs[worker.id] || { type: 'full', overtimeHours: 0, notes: '' };
                const pay = calculateWorkerDayPay(worker);
                const { hours, minutes } = fromDecimalHours(cfg.overtimeHours);

                return (
                  <div
                    key={worker.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isChecked
                        ? 'bg-sky-50/40 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800 shadow-sm'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    {/* Header Row: Checkbox, Name, Role, Pay Preview */}
                    <div className="flex items-center justify-between gap-2">
                      <div 
                        onClick={() => toggleWorkerSelection(worker.id)}
                        className="flex items-center gap-3 cursor-pointer select-none flex-1"
                      >
                        <button
                          type="button"
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'bg-sky-600 text-white'
                              : 'border-2 border-slate-300 dark:border-slate-600 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>

                        <div>
                          <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                            {worker.name}
                          </span>
                          <p className="text-xs text-slate-400">
                            {worker.role} • {formatCurrency(worker.dailyRate, currency, language)}
                          </p>
                        </div>
                      </div>

                      {/* Calculated Day Wage Preview */}
                      {isChecked && (
                        <div className="text-end">
                          <span className="text-[11px] text-slate-400 block">{t('calculatedDayTotal')}</span>
                          <span className="text-sm sm:text-base font-extrabold text-sky-600 dark:text-sky-400">
                            {formatCurrency(pay.total, currency, language)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Controls Row when Checked */}
                    {isChecked && (
                      <div className="mt-3 pt-3 border-t border-sky-100 dark:border-sky-900/60 space-y-2.5 text-xs">
                        
                        {/* Upper Row: Day Type Toggle (Full, Half, Hourly) & Hours:Minutes Stepper */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          
                          {/* Day Type Toggle Buttons */}
                          <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-xs sm:flex-1 sm:max-w-md">
                            <button
                              type="button"
                              onClick={() => updateWorkerConfig(worker.id, 'type', 'full')}
                              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs transition-all ${
                                cfg.type === 'full'
                                  ? 'bg-sky-600 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {t('fullDayOption')}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateWorkerConfig(worker.id, 'type', 'half')}
                              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs transition-all ${
                                cfg.type === 'half'
                                  ? 'bg-amber-600 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {t('halfDayOption')}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateWorkerConfig(worker.id, 'type', 'hourly')}
                              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs transition-all ${
                                cfg.type === 'hourly'
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {t('hourlyOnlyOption')}
                            </button>
                          </div>

                          {/* Hours & Minutes Dual Stepper */}
                          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 rounded-xl px-2.5 py-1 border border-slate-200 dark:border-slate-700 shadow-xs self-start sm:self-auto">
                            <Clock className="w-3.5 h-3.5 text-sky-500 me-1" />
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {cfg.type === 'hourly' ? t('workedTimeLabel') : t('overtimeHoursLabel')}:
                            </span>
                            
                            {/* Hours Box */}
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="24"
                                value={hours}
                                onChange={(e) => handleHoursChange(worker.id, e.target.value)}
                                className="w-8 text-center font-bold text-xs bg-slate-100 dark:bg-slate-800 rounded py-0.5 text-slate-900 dark:text-white focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-400 ms-0.5">{t('hourShort')}</span>
                            </div>

                            <span className="font-bold text-slate-400">:</span>

                            {/* Minutes Box */}
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="59"
                                step="5"
                                value={minutes}
                                onChange={(e) => handleMinutesChange(worker.id, e.target.value)}
                                className="w-8 text-center font-bold text-xs bg-slate-100 dark:bg-slate-800 rounded py-0.5 text-slate-900 dark:text-white focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-400 ms-0.5">{t('minuteShort')}</span>
                            </div>

                            {/* Micro Stepper Buttons (+ / -) */}
                            <div className="flex items-center gap-0.5 ms-1 border-s ps-1.5 border-slate-200 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => addTime(worker.id, 15)}
                                className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold"
                                title="+15m"
                              >
                                +15m
                              </button>
                              <button
                                type="button"
                                onClick={() => addTime(worker.id, -15)}
                                className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold"
                                title="-15m"
                              >
                                -15m
                              </button>
                            </div>
                          </div>

                        </div>

                        {/* Optional Worker Project Section Allocation */}
                        {projectSections.length > 0 && (
                          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 shadow-xs">
                            <Layers className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {t('section') || 'بخش'}:
                            </span>
                            <select
                              value={cfg.sectionId ?? (defaultSectionId || '')}
                              onChange={(e) => updateWorkerConfig(worker.id, 'sectionId', e.target.value || null)}
                              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer w-full"
                            >
                              <option value="" className="bg-white dark:bg-slate-800">
                                {language === 'fa' ? 'عمومی / کل پروژه' : 'General'}
                              </option>
                              {projectSections.map((sec) => (
                                <option key={sec.id} value={sec.id} className="bg-white dark:bg-slate-800">
                                  {sec.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Lower Row: Notes & Tasks Performed (100% Full Width) */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 shadow-xs">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={cfg.notes}
                            onChange={(e) => updateWorkerConfig(worker.id, 'notes', e.target.value)}
                            placeholder={t('notesPlaceholder')}
                            className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                          />
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Section 2: Already Logged Workers on this Date (Prevent Duplication + 1-Click Edit) */}
          {alreadyLoggedWorkers.length > 0 && (
            <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>{t('alreadyLoggedSectionTitle')} ({alreadyLoggedWorkers.length} نفر):</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  جهت تغییر از دکمه ویرایش استفاده فرمایید
                </span>
              </div>

              <div className="space-y-2">
                {alreadyLoggedWorkers.map(({ worker, log }) => (
                  <div
                    key={worker.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {worker.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        log.type === 'hourly'
                          ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400'
                          : log.type === 'half'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDayOption') : t('fullDayOption')}
                      </span>
                      {log.overtimeHours > 0 && (
                        <span className="bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded text-[11px] font-medium">
                          {log.type === 'hourly' ? '' : '+'}{formatHoursAndMinutes(log.overtimeHours, language)}
                        </span>
                      )}
                      {log.notes && (
                        <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-xs">
                          "{log.notes}"
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="font-extrabold text-slate-700 dark:text-slate-300">
                        {formatCurrency(log.totalDayPay, currency, language)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingLog(log)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 border border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-400 hover:border-sky-400 rounded-lg text-xs font-semibold transition-all shadow-xs"
                        title={t('editWorkerRecord')}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{t('editWorkerRecord')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {unloggedWorkers.length > 0 ? (
              selectedCount > 0 ? (
                <span className="font-semibold text-sky-600 dark:text-sky-400">
                  {selectedCount} {t('workers')} {t('active')}
                </span>
              ) : (
                <span>{t('noWorkerSelectedError')}</span>
              )
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                همه کارگران در این تاریخ قبلاً ثبت شده‌اند
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
            >
              {t('cancel')}
            </button>
            {unloggedWorkers.length > 0 && (
              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={isSaving || selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white font-medium text-sm rounded-xl shadow-md shadow-sky-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? t('savingAttendance') : t('saveBatchAttendance')}</span>
              </button>
            )}
          </div>
        </div>

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

/**
 * Persistent Floating Action Button (FAB)
 */
export function FloatingActionButton({ onClick }) {
  const { t, direction } = useLanguage();

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 ${
        direction === 'rtl' ? 'left-4 sm:left-6' : 'right-4 sm:right-6'
      } z-30 no-print`}
    >
      <button
        onClick={onClick}
        aria-label={t('logDailyAttendance')}
        className="group relative flex items-center gap-3 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white p-4 sm:px-5 sm:py-3.5 rounded-full shadow-2xl shadow-sky-600/40 ring-4 ring-sky-500/20 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <Plus className="w-6 h-6 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />
        <span className="hidden sm:inline font-bold text-sm tracking-tight whitespace-nowrap">
          {t('logDailyAttendance')}
        </span>
      </button>
    </div>
  );
}
