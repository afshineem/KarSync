import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { db, DEFAULT_PROJECT_ID, generateSectionId } from '../db/db';
import { pushProjectSectionLive, deleteProjectSectionLive } from '../services/realtimeSync';
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
  CalendarCheck,
  Layers,
  Plus
} from 'lucide-react';

export function ProjectSettingsModal() {
  const { t, language } = useLanguage();
  const { 
    currentProject, 
    updateProject, 
    archiveProject, 
    deleteProject, 
    isProjectSettingsModalOpen, 
    setIsProjectSettingsModalOpen,
    activeProjects
  } = useProject();

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'sections'
  const [newSectionName, setNewSectionName] = useState('');
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

  // Project sections
  const sections = useLiveQuery(async () => {
    if (!currentProject?.id) return [];
    return await db.projectSections.where('projectId').equals(currentProject.id).toArray();
  }, [currentProject?.id]) || [];

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    try {
      const newSec = {
        id: generateSectionId(),
        projectId: currentProject.id,
        userId: currentProject.userId || 'default_user',
        name: newSectionName.trim(),
        status: 'active',
        createdAt: new Date().toISOString()
      };
      await db.projectSections.add(newSec);
      pushProjectSectionLive(newSec).catch(() => {});
      setNewSectionName('');
    } catch (err) {
      console.error('Error adding section:', err);
    }
  };

  const handleDeleteSection = async (sec) => {
    if (window.confirm(language === 'fa' ? `آیا از حذف بخش «${sec.name}» اطمینان دارید؟` : 'Are you sure you want to delete this section?')) {
      await db.projectSections.delete(sec.id);
      deleteProjectSectionLive(sec.id).catch(() => {});
    }
  };

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

        {/* Tab Switcher: General vs Sections */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-3 gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'تنظیمات عمومی' : language === 'ku' ? 'ڕێکخستنی گشتی' : 'General'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'sections'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('projectSections') || 'بخش‌های پروژه'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-normal">
              {sections.length}
            </span>
          </button>
        </div>

        {/* Tab 1: General Settings Form */}
        {activeTab === 'general' ? (
          <>
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
          </>
        ) : (
          /* Tab 2: Project Sub-Sections Manager */
          <div className="p-6 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t('projectSections') || 'بخش‌های پروژه'}
              </h4>
              <p className="text-[11px] text-slate-400">
                {language === 'fa' 
                  ? 'تعریف زیرپروژه‌ها یا بخش‌های کاری (مانند زراعت، ساختمان‌سازی، راه‌سازی) جهت تفکیک دقیق هزینه‌ها و کارکرد پرسنل'
                  : 'Define structured sub-sections for strict cost and attendance allocation.'}
              </p>
            </div>

            {/* Add section form */}
            <form onSubmit={handleAddSection} className="flex gap-2">
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder={language === 'fa' ? 'نام بخش جدید (مثال: زراعت، تاسیسات...)' : 'New section name...'}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={!newSectionName.trim()}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{t('addSection') || 'افزودن'}</span>
              </button>
            </form>

            {/* List of sections */}
            <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
              {sections.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <span>{language === 'fa' ? 'هنوز بخشی برای این پروژه تعریف نشده است.' : 'No sub-sections defined for this project yet.'}</span>
                </div>
              ) : (
                sections.map((sec) => (
                  <div 
                    key={sec.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{sec.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(sec)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsProjectSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                {t('close') || 'بستن'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
