import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { 
  FolderPlus, 
  X, 
  Clock, 
  TrendingUp, 
  FileText, 
  Coins,
  Check
} from 'lucide-react';

export function NewProjectModal() {
  const { t } = useLanguage();
  const { isNewProjectModalOpen, setIsNewProjectModalOpen, createProject } = useProject();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('IQD');
  const [standardWorkHours, setStandardWorkHours] = useState(8);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isNewProjectModalOpen) return null;

  const currencies = [
    { code: 'IQD', label: t('iqdCurrency') || 'دینار عراق', symbol: 'د.ع' },
    { code: 'IRT', label: t('irtCurrency') || 'تومان ایران', symbol: 'تومان' },
    { code: 'USD', label: t('usdCurrency') || 'دلار آمریکا', symbol: '$' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t('projectNameRequired') || 'نام پروژه الزامی است');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await createProject({
        name: name.trim(),
        currency,
        standardWorkHours: Number(standardWorkHours) || 8,
        overtimeMultiplier: Number(overtimeMultiplier) || 1.0,
        notes: notes.trim()
      });

      // Reset and close
      setName('');
      setNotes('');
      setIsNewProjectModalOpen(false);
    } catch (err) {
      console.error('Create project error:', err);
      setErrorMsg(err.message || 'Error creating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={() => setIsNewProjectModalOpen(false)}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {t('createNewProject') || 'ایجاد پروژه جدید'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('createNewProjectDesc') || 'تعریف کارگاه، سایت ساختمانی یا شعبه جدید'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsNewProjectModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('projectName') || 'نام پروژه / کارگاه'} *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projectNamePlaceholder') || 'مثلاً: پروژه ویلایی پیرمام'}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
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
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
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
                  className="w-full pr-10 pl-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
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
                  className="w-full pr-10 pl-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
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
              {t('notes') || 'توضیحات / آدرس کارگاه (اختیاری)'}
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('projectNotesPlaceholder') || 'موقعیت مکانی، مشخصات پیمانکار، و...'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewProjectModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('createProjectBtn') || 'ثبت و فعال‌سازی پروژه'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
