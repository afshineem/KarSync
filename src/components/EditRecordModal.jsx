import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAttendanceLogId, DEFAULT_PROJECT_ID } from '../db/db';
import { pushLogsLive, deleteLogLive } from '../services/realtimeSync';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth, usePermissions } from '../context/AuthContext';
import { 
  formatCurrency, 
  formatFullDateWithWeekday, 
  toDecimalHours, 
  fromDecimalHours, 
  formatHoursAndMinutes,
  roundCurrency,
  getCurrencySymbol
} from '../utils/formatters';
import { getReceiptPeriodEnd } from '../utils/settlementCalculations.js';
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
  Edit3,
  Layers,
  Lock,
  Sun,
  CloudSun,
  Timer,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

export function EditRecordModal({ log, isOpen, onClose }) {
  const { t, language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  const copy = {
    fa: {
      editRecordTitle: 'ویرایش کارکرد',
      editRecordDesc: 'ویرایش حضور و غیاب، ساعات اضافه‌کاری و وضعیت روز',
      lockedNoticeTitle: 'این رکورد کارکرد در برگه تسویه حساب نهایی قفل شده است',
      lockedNoticeDesc: 'به منظور حفظ یکپارچگی حسابداری و اسناد تسویه، امکان تغییر ساعات یا حذف این روز وجود ندارد. برای اعمال تغییرات ابتدا باید برگه تسویه مربوطه بازبینی شود.',
      settledBadge: 'تسویه‌شده',
      settledLockedNotice: 'تسویه و قفل شده',
      unmodifiable: 'غیرقابل ویرایش',
      dayStatusLabel: 'وضعیت روز:',
      fullDayOption: 'روز کامل',
      halfDayOption: 'نیمه‌روز',
      hourlyOnlyOption: 'ساعتی',
      overtimeHours: 'ساعات اضافه‌کاری',
      overtimeDesc: 'میزان کارکرد مازاد بر ساعات استاندارد',
      hours: 'ساعت',
      minutes: 'دقیقه',
      quickPresets: 'پیش‌فرض‌های سریع:',
      preset15Min: '{copy.preset15Min}',
      preset30Min: '{copy.preset30Min}',
      preset1Hour: '{copy.preset1Hour}',
      zero: 'صفر',
      generalEntireProject: 'عمومی / کل پروژه',
      projectSections: 'بخش کارگاهی پروژه',
      notesLabel: 'توضیحات و شرح کارکرد',
      notesPlaceholder: 'شرح کارهای انجام شده توسط پرسنل در این روز...',
      dailyRateLabel: 'نرخ دستمزد روزانه:',
      basePlusOvertime: 'دستمزد پایه روز + اضافه‌کاری:',
      calculatedDayTotal: 'مجموع دستمزد محاسبه‌شده:',
      delete: 'حذف',
      cancel: 'انصراف',
      saveChanges: 'ذخیره تغییرات',
      savingAttendance: 'در حال ذخیره‌سازی...',
      closeEsc: 'بستن (ESC)',
      deleteConfirm: 'آیا از حذف این رکورد کارکرد اطمینان دارید؟',
      editLockedAlert: 'این رکورد در امور مالی تسویه شده و قفل است. امکان ویرایش آن وجود ندارد.',
      deleteLockedAlert: 'این رکورد در امور مالی تسویه شده و قفل است. امکان حذف آن وجود ندارد.',
      editRecordSuccess: 'تغییرات با موفقیت ذخیره شد',
      personnelDefault: 'پرسنل کارگاه'
    },
    ku: {
      editRecordTitle: 'دەستکاریکردنی کارکرد',
      editRecordDesc: 'دەستکاریکردنی ئامادەبوون، کاتژمێری زیادە و دۆخی ڕۆژ',
      lockedNoticeTitle: 'ئەم تۆمارەی کارکرد لە شایستەی کۆتایی یەکلاکراوەدا قفڵە',
      lockedNoticeDesc: 'بەمەبەستی پاراستنی دروستیی حیسابداری و بەڵگەنامەکان، گۆڕینی کاتژمێر یان سڕینەوەی ئەم ڕۆژە ڕێگەنەدراوە. بۆ ئەنجامدانی گۆڕانکاری پێویستە پسوولەی پەیوەندیدار پێداچوونەوەی بۆ بکرێت.',
      settledBadge: 'یەکلاکراوە',
      settledLockedNotice: 'یەکلاکراوە و قفڵە',
      unmodifiable: 'دەستکاری ناکرێت',
      dayStatusLabel: 'دۆخی ڕۆژ:',
      fullDayOption: 'ڕۆژی تەواو',
      halfDayOption: 'نیوەڕۆژ',
      hourlyOnlyOption: 'کاتژمێری',
      overtimeHours: 'کاتژمێری زیادەکاری',
      overtimeDesc: 'بڕی کارکردی زیاتر لە دەوامی ئاسایی',
      hours: 'کاتژمێر',
      minutes: 'خولەک',
      quickPresets: 'دیاریکراوی خێرا:',
      preset15Min: '+١٥ خولەک',
      preset30Min: '+٣٠ خولەک',
      preset1Hour: '+١ کاتژمێر',
      zero: 'سفر',
      generalEntireProject: 'گشتی / تەواوی پڕۆژە',
      projectSections: 'بەشی پڕۆژە',
      notesLabel: 'تێبینی و ڕوونکردنەوە',
      notesPlaceholder: 'ڕوونکردنەوەی کارە ئەنجامدراوەکان لەم ڕۆژەدا...',
      dailyRateLabel: 'نرخی کرێی ڕۆژانە:',
      basePlusOvertime: 'حەقدەستی بنەڕەتی + زیادەکاری:',
      calculatedDayTotal: 'کۆی گشتیی حەقدەست:',
      delete: 'سڕینەوە',
      cancel: 'پاشگەزبوونەوە',
      saveChanges: 'پاشەکەوتکردنی گۆڕانکاری',
      savingAttendance: 'خەریکی پاشەکەوتکردن...',
      closeEsc: 'داخستن (ESC)',
      deleteConfirm: 'ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی کارکرد؟',
      editLockedAlert: 'ئەم تۆمارە لە بەشی دارایی یەکلاکراوەتەوە و قفڵە. دەستکاریکردنی مەحاڵە.',
      deleteLockedAlert: 'ئەم تۆمارە لە بەشی دارایی یەکلاکراوەتەوە و قفڵە. سڕینەوەی مەحاڵە.',
      editRecordSuccess: 'گۆڕانکارییەکان بە سەرکەوتوویی پاشەکەوت کران',
      personnelDefault: 'کارمەندی پڕۆژە'
    },
    en: {
      editRecordTitle: 'Edit Attendance Record',
      editRecordDesc: 'Edit attendance, overtime hours, and day shift status',
      lockedNoticeTitle: 'This attendance log is locked in a final settlement',
      lockedNoticeDesc: 'To preserve accounting and payroll ledger consistency, hours cannot be modified and this record cannot be deleted while locked.',
      settledBadge: 'Settled',
      settledLockedNotice: 'Settled & Locked',
      unmodifiable: 'Locked / Read-only',
      dayStatusLabel: 'Day Status:',
      fullDayOption: 'Full Day',
      halfDayOption: 'Half Day',
      hourlyOnlyOption: 'Hourly',
      overtimeHours: 'Overtime Hours',
      overtimeDesc: 'Hours worked beyond standard day shift',
      hours: 'Hours',
      minutes: 'Minutes',
      quickPresets: 'Quick Presets:',
      preset15Min: '+15 Min',
      preset30Min: '+30 Min',
      preset1Hour: '+1 Hour',
      zero: 'Zero',
      generalEntireProject: 'General / Entire Project',
      projectSections: 'Project Section',
      notesLabel: 'Notes & Tasks Performed',
      notesPlaceholder: 'Description of work performed by personnel on this day...',
      dailyRateLabel: 'Daily Rate:',
      basePlusOvertime: 'Base Day Wage + Overtime:',
      calculatedDayTotal: 'Calculated Day Total:',
      delete: 'Delete',
      cancel: 'Cancel',
      saveChanges: 'Save Changes',
      savingAttendance: 'Saving...',
      closeEsc: 'Close (ESC)',
      deleteConfirm: 'Are you sure you want to delete this attendance log?',
      editLockedAlert: 'This record is settled and locked. It cannot be edited.',
      deleteLockedAlert: 'This record is settled and locked. It cannot be deleted.',
      editRecordSuccess: 'Changes saved successfully',
      personnelDefault: 'Workshop Personnel'
    }
  }[langKey];
  const { currentProject } = useProject();
  const { user } = useAuth();
  const { canModifyDate } = usePermissions();
  const currency = currentProject?.currency || 'IQD';
  const standardHours = currentProject?.standardWorkHours || 8;

  const targetProjectId = log?.projectId || currentProject?.id || DEFAULT_PROJECT_ID;
  const projectSections = useLiveQuery(
    async () => {
      if (!targetProjectId) return [];
      return await db.projectSections.where('projectId').equals(targetProjectId).toArray();
    },
    [targetProjectId]
  ) || [];

  const worker = useLiveQuery(
    () => (log?.workerId ? db.workers.get(log.workerId) : null),
    [log?.workerId]
  );

  const allPayments = useLiveQuery(() => db.payments.toArray(), []) || [];
  const isSettled = useMemo(() => {
    if (!log) return false;
    const activePayments = allPayments.filter((p) => !p.deletedAt && p.status !== 'deleted');
    // A log is settled only if explicitly linked to an active settlement receipt
    if (log.settlementReceiptId) {
      const receipt = activePayments.find((p) => String(p.id) === String(log.settlementReceiptId));
      if (receipt) {
        const receiptPeriodEnd = getReceiptPeriodEnd(receipt);
        // Guard: a log worked after the receipt period end cannot be paid by that receipt
        if (receiptPeriodEnd && (log.date || '') > receiptPeriodEnd) {
          return false;
        }
        return true;
      }
    }
    // Legacy support: only if record itself is marked isSettled AND worker has settlements
    if (log.isSettled) {
      const workerSettlements = activePayments.filter((p) => 
        (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled') &&
        (String(p.workerId) === String(log.workerId) || (worker?.groupId && p.groupId === worker.groupId))
      );
      if (workerSettlements.length > 0) {
        const sortedSt = workerSettlements.sort((a, b) => {
          const endA = getReceiptPeriodEnd(a) || '';
          const endB = getReceiptPeriodEnd(b) || '';
          return endB.localeCompare(endA);
        });
        const lastStPeriodEnd = getReceiptPeriodEnd(sortedSt[0]);
        if (lastStPeriodEnd && log.date && log.date <= lastStPeriodEnd) {
          return true;
        }
      }
    }
    return false;
  }, [log, allPayments, worker]);

  const [type, setType] = useState('full');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [notes, setNotes] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Synchronize state when log changes or modal opens
  useEffect(() => {
    if (!isOpen || !log) return;

    setType(log.type || 'full');
    const { hours: h, minutes: m } = fromDecimalHours(log.overtimeHours || 0);
    setHours(h);
    setMinutes(m);
    setNotes(log.notes || '');
    setSectionId(log.sectionId || '');
    setToastMessage('');
    setIsSaving(false);
  }, [isOpen, log]);

  if (!isOpen || !log) return null;

  // Real-time calculations
  const decimalHours = toDecimalHours(hours, minutes);
  const hourlyRate = (worker?.overtimeHourlyRate > 0)
    ? worker.overtimeHourlyRate
    : Math.round((worker?.dailyRate || 0) / standardHours);

  let calculatedDailyWage = 0;
  let calculatedOvertimeWage = 0;

  if (type === 'hourly') {
    calculatedDailyWage = 0;
    calculatedOvertimeWage = roundCurrency(decimalHours * hourlyRate, currency);
  } else {
    const baseFactor = type === 'half' ? 0.5 : 1.0;
    calculatedDailyWage = roundCurrency((worker?.dailyRate || 0) * baseFactor, currency);
    calculatedOvertimeWage = roundCurrency(decimalHours * (worker?.overtimeHourlyRate || 0), currency);
  }
  const totalDayPay = roundCurrency(calculatedDailyWage + calculatedOvertimeWage, currency);

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
    if (isSettled) {
      alert(copy.editLockedAlert);
      return;
    }

    setIsSaving(true);
    try {
      const canonicalId = getAttendanceLogId(log.workerId, log.date);
      const updatedRecord = {
        ...log,
        id: canonicalId,
        projectId: log.projectId || currentProject?.id || 'prj_default_main',
        userId: log.userId || user?.id || null,
        type,
        overtimeHours: decimalHours,
        calculatedDailyWage,
        calculatedOvertimeWage,
        totalDayPay,
        sectionId: sectionId || null,
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

      setToastMessage(copy.editRecordSuccess);
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
    if (isSettled) {
      alert(copy.deleteLockedAlert);
      return;
    }
    if (window.confirm(copy.deleteConfirm)) {
      try {
        await db.attendanceLogs.delete(log.id);
        deleteLogLive(log.id).catch(() => {});
        onClose();
      } catch (err) {
        console.error('Error deleting log:', err);
      }
    }
  };

  const modalContent = (
    <div 
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white select-none"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[260] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm font-bold bg-emerald-600 text-white shadow-emerald-600/30 animate-in fade-in slide-in-from-top-4 duration-200">
          <Check className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs z-20">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <Edit3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {copy.editRecordTitle}
                </h2>
                {isSettled && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/60 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>{copy.settledBadge}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {copy.editRecordDesc}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            title={copy.closeEsc}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area - #f3f6f4 container */}
      <div className="flex-1 overflow-y-auto bg-[#f3f6f4] dark:bg-slate-950 py-5 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto w-full space-y-4">

          {/* Locked Record Notice if Settled */}
          {isSettled && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/80 rounded-2xl flex items-start gap-3 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-xs">
              <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-black">{copy.lockedNoticeTitle}</div>
                <div className="text-[11px] leading-relaxed opacity-90 font-medium">
                  {copy.lockedNoticeDesc}
                </div>
              </div>
            </div>
          )}

          {/* Worker & Date Overview Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-sm">
                  {worker?.name ? worker.name.charAt(0) : <User className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    {worker?.name || '...'}
                  </div>
                  <div className="text-xs text-slate-400 font-medium mt-0.5">
                    {worker?.role || copy.personnelDefault}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Calendar className="w-4 h-4 text-sky-500" />
                <span>{formatFullDateWithWeekday(log.date, language)}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <fieldset disabled={isSettled} className={`space-y-4 ${isSettled ? 'opacity-65 pointer-events-none select-none' : ''}`}>

              {/* Card 1: Day Type Segmented Control */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-3">
                  {t('typeColumn')} ({copy.dayStatusLabel}):
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setType('full')}
                    className={`py-3 px-2 sm:px-4 text-xs font-black rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                      type === 'full'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>{copy.fullDayOption}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('half')}
                    className={`py-3 px-2 sm:px-4 text-xs font-black rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                      type === 'half'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/25'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-500/50'
                    }`}
                  >
                    <CloudSun className="w-4 h-4" />
                    <span>{copy.halfDayOption}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('hourly')}
                    className={`py-3 px-2 sm:px-4 text-xs font-black rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                      type === 'hourly'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/25'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-500/50'
                    }`}
                  >
                    <Timer className="w-4 h-4" />
                    <span>{copy.hourlyOnlyOption}</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Hours and Minutes Stepper */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-500" />
                    <span>
                      {type === 'hourly' ? t('workedTimeLabel') : t('overtimeHoursLabel')}
                    </span>
                  </label>
                  {decimalHours > 0 && (
                    <span className="text-xs font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                      {formatHoursAndMinutes(decimalHours, language)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 max-w-sm mx-auto my-2">
                  {/* Hours Stepper */}
                  <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <span className="text-xs font-bold text-slate-400 me-2">
                      {t('hoursLabel')}:
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={hours}
                      onChange={(e) => handleHoursChange(e.target.value)}
                      className="w-full bg-transparent text-base font-black text-slate-900 dark:text-white text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex flex-col ms-1">
                      <button
                        type="button"
                        onClick={() => setHours((h) => Math.min(24, h + 1))}
                        className="p-0.5 text-slate-400 hover:text-sky-500 transition-colors"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setHours((h) => Math.max(0, h - 1))}
                        className="p-0.5 text-slate-400 hover:text-sky-500 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <span className="font-black text-slate-400 text-lg">:</span>

                  {/* Minutes Stepper */}
                  <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <span className="text-xs font-bold text-slate-400 me-2">
                      {t('minutesLabel')}:
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={minutes}
                      onChange={(e) => handleMinutesChange(e.target.value)}
                      className="w-full bg-transparent text-base font-black text-slate-900 dark:text-white text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex flex-col ms-1">
                      <button
                        type="button"
                        onClick={() => addMinutes(5)}
                        className="p-0.5 text-slate-400 hover:text-sky-500 transition-colors"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addMinutes(-5)}
                        className="p-0.5 text-slate-400 hover:text-sky-500 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick adjust chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-400 text-[11px] font-bold me-1">تنظیم سریع:</span>
                  <button
                    type="button"
                    onClick={() => addMinutes(15)}
                    className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors"
                  >
                    +۱۵ دقیقه
                  </button>
                  <button
                    type="button"
                    onClick={() => addMinutes(30)}
                    className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors"
                  >
                    +۳۰ دقیقه
                  </button>
                  <button
                    type="button"
                    onClick={() => addMinutes(60)}
                    className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors"
                  >
                    +۱ ساعت
                  </button>
                  <button
                    type="button"
                    onClick={() => { setHours(0); setMinutes(0); }}
                    className="px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-bold flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{copy.zero}</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Project Section & Notes */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                {/* Project Section */}
                {projectSections.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-sky-500" />
                      <span>{t('projectSections') || 'بخش کارگاهی پروژه'}</span>
                    </label>
                    <select
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">
                        {copy.generalEntireProject}
                      </option>
                      {projectSections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notes & Tasks Performed */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-sky-500" />
                    <span>{t('notesLabel')}</span>
                  </label>
                  <textarea
                    rows="2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={copy.notesPlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Card 4: Live Wage Calculation Summary */}
              <div className="bg-white dark:bg-slate-900 border border-sky-200/90 dark:border-sky-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-2.5 border-b border-slate-100 dark:border-slate-800 font-bold">
                  <span>{t('dailyRateLabel')}:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {formatCurrency(worker?.dailyRate || 0, currency, language)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 py-2 border-b border-slate-100 dark:border-slate-800 font-bold">
                  <span>{copy.basePlusOvertime}</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {formatCurrency(calculatedDailyWage, currency, language)} + {formatCurrency(calculatedOvertimeWage, currency, language)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2.5">
                  <span className="text-xs font-black text-slate-900 dark:text-white">{t('calculatedDayTotal')}:</span>
                  <span className="text-lg font-black text-sky-600 dark:text-sky-400 font-mono">
                    {formatCurrency(totalDayPay, currency, language)}
                  </span>
                </div>
              </div>

            </fieldset>

            {/* Sticky/Fixed Modal Footer Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {!isSettled ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2.5 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{copy.delete}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{copy.settledLockedNotice}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors shadow-xs"
                >
                  {copy.cancel} (ESC)
                </button>
                {!isSettled ? (
                  <button
                    type="submit"
                    disabled={isSaving || !canModifyDate(log?.date)}
                    className="px-7 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-sky-500/25 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isSaving ? (
                      <span>{copy.savingAttendance}</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{copy.saveChanges}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-80"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{copy.unmodifiable}</span>
                  </button>
                )}
              </div>
            </div>

          </form>

        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
