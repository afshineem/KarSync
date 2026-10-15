import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db, generateId, DEFAULT_PROJECT_ID } from '../db/db';
import { pushWorkerLive } from '../services/realtimeSync';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  X, 
  UserPlus, 
  Users, 
  Layers, 
  Key, 
  AlertCircle, 
  Check, 
  Briefcase, 
  Phone, 
  Coins, 
  Clock,
  Sparkles
} from 'lucide-react';

export function AddWorkerModal({ isOpen, onClose, workerToEdit = null, onSuccess }) {
  const { t, language, direction } = useLanguage();
  const { user, setWorkerCredentials, getWorkerCredentialsMap } = useAuth();
  const { currentProject } = useProject();

  const workerCreds = getWorkerCredentialsMap();
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: '',
    groupId: '',
    teamRole: 'Worker',
    wageType: 'standard',
    dailyRate: '35000',
    overtimeHourlyRate: '5000',
    defaultSectionId: '',
    isActive: 1,
    username: '',
    password: ''
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live queries for groups and project sections
  const groups = useLiveQuery(
    async () => {
      const list = await db.groups.toArray();
      return list.filter((g) => !g.projectId || g.projectId === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  const projectSections = useLiveQuery(
    async () => {
      if (!targetProjectId) return [];
      return await db.projectSections.where('projectId').equals(targetProjectId).toArray();
    },
    [targetProjectId]
  ) || [];

  // Reset or populate form
  useEffect(() => {
    if (isOpen) {
      if (workerToEdit) {
        const creds = workerCreds[workerToEdit.id] || {};
        setFormData({
          name: workerToEdit.name || '',
          phone: workerToEdit.phone || '',
          role: workerToEdit.role || '',
          groupId: workerToEdit.groupId || '',
          teamRole: workerToEdit.teamRole || 'Worker',
          wageType: workerToEdit.wageType || 'standard',
          dailyRate: String(workerToEdit.dailyRate ?? '35000'),
          overtimeHourlyRate: String(workerToEdit.overtimeHourlyRate ?? '5000'),
          defaultSectionId: workerToEdit.defaultSectionId || '',
          isActive: workerToEdit.isActive ?? 1,
          username: creds.username || workerToEdit.username || '',
          password: creds.password || workerToEdit.password || ''
        });
      } else {
        setFormData({
          name: '',
          phone: '',
          role: '',
          groupId: '',
          teamRole: 'Worker',
          wageType: 'standard',
          dailyRate: '35000',
          overtimeHourlyRate: '5000',
          defaultSectionId: '',
          isActive: 1,
          username: '',
          password: ''
        });
      }
      setFormError('');
    }
  }, [isOpen, workerToEdit]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError(t('validationNameRequired') || 'نام و نام خانوادگی الزامی است');
      return;
    }

    const isContract = formData.wageType === 'contract';
    const dailyRate = isContract ? 0 : Number(formData.dailyRate);
    const overtimeRate = isContract ? 0 : Number(formData.overtimeHourlyRate);

    if (isNaN(dailyRate) || dailyRate < 0 || isNaN(overtimeRate) || overtimeRate < 0) {
      setFormError(t('validationRatesPositive') || 'مقادیر دستمزد و اضافه‌کاری باید عددی معتبر و مثبت باشند');
      return;
    }

    try {
      setIsSubmitting(true);
      let targetWorkerId = null;

      if (workerToEdit) {
        targetWorkerId = workerToEdit.id;
        const updatedWorker = {
          ...workerToEdit,
          projectId: workerToEdit.projectId || targetProjectId,
          userId: workerToEdit.userId || user?.id || 'default_user',
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          role: formData.role.trim(),
          groupId: formData.groupId ? String(formData.groupId) : null,
          teamRole: formData.teamRole || 'Worker',
          wageType: formData.wageType || 'standard',
          dailyRate: dailyRate,
          overtimeHourlyRate: overtimeRate,
          defaultSectionId: formData.defaultSectionId ? String(formData.defaultSectionId) : null,
          isActive: Number(formData.isActive),
          username: (formData.username || '').trim(),
          password: (formData.password || '').trim(),
          updatedAt: new Date().toISOString()
        };

        await db.workers.update(workerToEdit.id, updatedWorker);
        await pushWorkerLive(updatedWorker);

        // Migrate past attendance records to the new section if default section was changed
        const oldSection = workerToEdit.defaultSectionId;
        const newSection = updatedWorker.defaultSectionId;
        if (newSection && oldSection !== newSection) {
          const logs = await db.attendanceLogs.where('workerId').equals(workerToEdit.id).toArray();
          const logsToUpdate = logs.filter(l => !l.sectionId || l.sectionId === oldSection);
          if (logsToUpdate.length > 0) {
            const now = new Date().toISOString();
            const bulkUpdates = logsToUpdate.map(l => ({
              ...l,
              sectionId: newSection,
              updatedAt: now
            }));
            await db.attendanceLogs.bulkPut(bulkUpdates);
            window.dispatchEvent(new CustomEvent('workshop-logs-updated'));
          }
        }
      } else {
        targetWorkerId = generateId();
        const newWorker = {
          id: targetWorkerId,
          projectId: targetProjectId,
          userId: user?.id || 'default_user',
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          role: formData.role.trim(),
          groupId: formData.groupId ? String(formData.groupId) : null,
          teamRole: formData.teamRole || 'Worker',
          wageType: formData.wageType || 'standard',
          dailyRate: dailyRate,
          overtimeHourlyRate: overtimeRate,
          defaultSectionId: formData.defaultSectionId ? String(formData.defaultSectionId) : null,
          isActive: 1,
          username: (formData.username || '').trim(),
          password: (formData.password || '').trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await db.workers.add(newWorker);
        await pushWorkerLive(newWorker);
      }

      if (targetWorkerId) {
        await setWorkerCredentials(targetWorkerId, formData.username, formData.password);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving worker:', err);
      setFormError(err.message || 'خطا در ثبت مشخصات پرسنل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      dir={direction}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-[#f3f6f4] dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <UserPlus className="w-5.5 h-5.5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight">
                {workerToEdit ? (language === 'fa' ? 'ویرایش مشخصات پرسنل' : 'دەستکاریکردنی کرێکار') : (language === 'fa' ? 'تعریف پرسنل / کارگر جدید' : 'زیادکردنی کرێکاری نوێ')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'fa' ? 'مشخصات فردی، مهارت، دستمزد روزانه و اطلاعات ورود به پورتال' : 'زانیاری تاکەکەسی، مووچە و دەستگەیشتن'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
            title="بستن (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 bg-[#f3f6f4] dark:bg-slate-950 space-y-4 max-h-[75vh] overflow-y-auto">
          {formError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form id="add-worker-form" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Card 1: Personal Info */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <Users className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {language === 'fa' ? 'اطلاعات هویتی و تماس' : 'زانیاری کەسی'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('fullName') || 'نام و نام خانوادگی'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ئاراس ئەحمەد / علی رضایی"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('phoneNumber') || 'شماره موبایل'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0750 123 4567"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('roleOrTitle') || 'عنوان شغل / تخصص'}
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="وەستا / جوشکار / آرماتوربند"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Card 2: Team and Project Section */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {language === 'fa' ? 'گروه کاری و بخش کارگاه' : 'گرووپ و بەش'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === 'fa' ? 'گروه کاری' : 'گرووپ'}
                  </label>
                  <select
                    value={formData.groupId || ''}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">{language === 'fa' ? 'بدون گروه (انفرادی)' : 'بێ گرووپ'}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === 'fa' ? 'نقش در گروه' : 'ڕۆڵ لە گرووپ'}
                  </label>
                  <select
                    value={formData.teamRole || 'Worker'}
                    onChange={(e) => setFormData({ ...formData, teamRole: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Worker">{language === 'fa' ? 'کارگر (عادی)' : 'کرێکار'}</option>
                    <option value="Master">{language === 'fa' ? 'استادکار (سرپرست)' : 'وەستا / سەرپەرشتیار'}</option>
                  </select>
                </div>
              </div>

              {projectSections.length > 0 && (
                <div className="space-y-1 pt-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-500" />
                      <span>{t('defaultSection') || 'بخش پیش‌فرض کاری'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">({t('optional') || 'اختیاری'})</span>
                  </label>
                  <select
                    value={formData.defaultSectionId || ''}
                    onChange={(e) => setFormData({ ...formData, defaultSectionId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">{t('noSection') || 'بدون بخش (عمومی)'}</option>
                    {projectSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Card 3: Wage & Rates */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {language === 'fa' ? 'سیستم دستمزد و نرخ کارکرد' : 'جۆری کرێ و پارە'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'fa' ? 'نوع قرارداد دستمزد' : 'جۆری کرێ'}
                </label>
                <select
                  value={formData.wageType || 'standard'}
                  onChange={(e) => setFormData({ ...formData, wageType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                >
                  <option value="standard">{language === 'fa' ? 'عادی (مزد روزانه و اضافه کاری)' : 'ستاندارد (کرێی ڕۆژانە)'}</option>
                  <option value="contract">{language === 'fa' ? 'کنتراکت (توافقی / مقاطعه کاری)' : 'گرێبەست (بڕاوە)'}</option>
                </select>
              </div>

              <div 
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity"
                style={{ opacity: formData.wageType === 'contract' ? 0.45 : 1, pointerEvents: formData.wageType === 'contract' ? 'none' : 'auto' }}
              >
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('dailyRateLabel') || 'دستمزد روزانه'} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={formData.dailyRate}
                    onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('overtimeRateLabel') || 'نرخ هر ساعت اضافه کاری'} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={formData.overtimeHourlyRate}
                    onChange={(e) => setFormData({ ...formData, overtimeHourlyRate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Card 4: Portal Login Credentials */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <Key className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {t('workerLoginCredentials') || 'دسترسی اختصاصی پورتال پرسنل'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('username') || 'نام کاربری'}
                  </label>
                  <input
                    type="text"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. feryad"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('password') || 'کلمه عبور'}
                  </label>
                  <input
                    type="text"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="e.g. 1234"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Action Footer */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            کلید <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono">Esc</kbd> برای انصراف
          </span>
          <div className="flex items-center gap-3 ms-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors font-bold cursor-pointer"
            >
              {t('cancel') || 'انصراف'}
            </button>
            <button
              type="submit"
              form="add-worker-form"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-black rounded-2xl shadow-md shadow-sky-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                language === 'fa' ? 'در حال ثبت...' : 'تۆماردەکرێت...'
              ) : (
                workerToEdit ? (language === 'fa' ? 'ذخیره تغییرات' : 'پاشەکەوتکردن') : (language === 'fa' ? 'ثبت پرسنل' : 'تۆمارکردن')
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
