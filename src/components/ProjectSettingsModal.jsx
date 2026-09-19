import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Settings2, 
  X, 
  Clock, 
  TrendingUp, 
  Coins, 
  Check, 
  Archive, 
  Trash2, 
  AlertTriangle,
  Users,
  CalendarCheck
} from 'lucide-react';

export function ProjectSettingsModal() {
  const { t } = useLanguage();
  const { 
    currentProject, 
    updateProject, 
    archiveProject, 
    deleteProject, 
    isProjectSettingsModalOpen, 
    setIsProjectSettingsModalOpen,
    activeProjects
  } = useProject();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('IQD');
  const [standardWorkHours, setStandardWorkHours] = useState(8);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (currentProject) {
      setName(currentProject.name || '');
      setCurrency(currentProject.currency || 'IQD');
      setStandardWorkHours(currentProject.standardWorkHours || 8);
      setOvertimeMultiplier(currentProject.overtimeMultiplier || 1.0);
      setNotes(currentProject.notes || '');
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [currentProject, isProjectSettingsModalOpen]);

  // Project statistics
  const stats = useLiveQuery(async () => {
    if (!currentProject?.id) return { workers: 0, logs: 0 };
    const [workersCount, logsCount] = await Promise.all([
      db.workers.where('projectId').equals(currentProject.id).count(),
      db.attendanceLogs.where('projectId').equals(currentProject.id).count()
    ]);
    return { workers: workersCount, logs: logsCount };
  }, [currentProject?.id], { workers: 0, logs: 0 });

  if (!isProjectSettingsModalOpen || !currentProject) return null;

  const isDefaultProject = currentProject.id === DEFAULT_PROJECT_ID;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t('projectNameRequired') || 'نام پروژه الزامی است');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await updateProject(currentProject.id, {
        name: name.trim(),
        currency,
        standardWorkHours: Number(standardWorkHours) || 8,
        overtimeMultiplier: Number(overtimeMultiplier) || 1.0,
        notes: notes.trim()
      });

      setSuccessMsg(t('projectSavedSuccess') || 'تنظیمات پروژه با موفقیت ذخیره شد');
      setTimeout(() => {
        setIsProjectSettingsModalOpen(false);
      }, 1000);
    } catch (err) {
      console.error('Update project error:', err);
      setErrorMsg(err.message || 'Error updating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (isDefaultProject) {
      alert(t('cannotArchiveDefaultProject') || 'پروژه پیش‌فرض سیستم قابل بایگانی نیست');
      return;
    }
    if (confirm(t('confirmArchiveProject') || 'آیا از بایگانی کردن این پروژه اطمینان دارید؟')) {
      try {
        await archiveProject(currentProject.id);
        setIsProjectSettingsModalOpen(false);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleDelete = async () => {
    if (isDefaultProject) {
      alert(t('cannotDeleteDefaultProject') || 'پروژه پیش‌فرض سیستم قابل حذف نیست');
      return;
    }
    if (confirm(t('confirmDeleteProject') || 'آیا از حذف این پروژه اطمینان دارید؟ تمامی رکوردهای مرتبط در این پروژه حذف خواهند شد.')) {
      try {
        await deleteProject(currentProject.id);
        setIsProjectSettingsModalOpen(false);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const currencies = [
    { code: 'IQD', label: t('iqdCurrency') || 'دینار عراق', symbol: 'د.ع' },
    { code: 'IRT', label: t('irtCurrency') || 'تومان ایران', symbol: 'تومان' },
    { code: 'USD', label: t('usdCurrency') || 'دلار آمریکا', symbol: '$' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={() => setIsProjectSettingsModalOpen(false)}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {t('manageProjectSettings') || 'تنظیمات و پیکربندی پروژه'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentProject.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsProjectSettingsModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats Pill */}
        <div className="px-6 pt-4 pb-1">
          <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-500" />
              <span className="text-slate-500 dark:text-slate-400">{t('workersCount') || 'کرێکاران'}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{stats.workers}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-500 dark:text-slate-400">{t('recordedLogs') || 'تۆمارەکانی ئامادەبوون'}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{stats.logs}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs">
              {successMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('projectName') || 'نام پروژه / کارگاه'} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('projectCurrency') || 'ارز مالی این پروژه'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {currencies.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`py-2 px-2 rounded-xl border text-center text-xs font-bold transition-all ${
                    currency === c.code
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>{c.code}</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">{c.symbol}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('standardWorkHours') || 'ساعت کار روزانه'}
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={standardWorkHours}
                  onChange={(e) => setStandardWorkHours(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('overtimeMultiplier') || 'ضریب اضافه‌کاری'}
              </label>
              <div className="relative">
                <TrendingUp className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                <select
                  value={overtimeMultiplier}
                  onChange={(e) => setOvertimeMultiplier(Number(e.target.value))}
                  className="w-full pr-10 pl-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                >
                  <option value={1.0}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2.0}>2.0x</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('notes') || 'توضیحات و مشخصات'}
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Danger Zone: Archive / Delete */}
          {!isDefaultProject && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleArchive}
                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 flex items-center gap-1.5 font-medium transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{t('archiveProject') || 'بایگانی کردن پروژه'}</span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1.5 font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('deleteProject') || 'حذف این پروژه'}</span>
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsProjectSettingsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/25 flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('saveChanges') || 'ذخیره تغییرات'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
