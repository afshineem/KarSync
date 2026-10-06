import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import {
  X,
  Plus,
  Edit2,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Flag,
  ArrowRight
} from 'lucide-react';

export function TaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  taskToEdit = null,
  parentTask = null,
  targetProjectId = null
}) {
  const { language, direction } = useLanguage();

  // Load project groups for easy selection
  const dbGroups = useLiveQuery(
    async () => {
      const list = await db.groups.toArray();
      if (!targetProjectId) return list;
      return list.filter(g => !g.projectId || g.projectId === targetProjectId || g.projectId === DEFAULT_PROJECT_ID);
    },
    [targetProjectId]
  ) || [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('not_started'); // 'not_started' | 'in_progress' | 'completed'
  const [priority, setPriority] = useState('medium'); // 'low' | 'medium' | 'high'
  const [selectedGroup, setSelectedGroup] = useState('');
  const [customGroup, setCustomGroup] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Pre-fill fields only when modal opens or target task changes
  useEffect(() => {
    if (!isOpen) return;

    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setStatus(taskToEdit.status || 'not_started');
      setPriority(taskToEdit.priority || 'medium');
      setEstimatedHours(taskToEdit.estimated_hours ? String(taskToEdit.estimated_hours) : '');
      setStartDate(taskToEdit.start_date || '');
      setDueDate(taskToEdit.due_date || '');

      const grp = taskToEdit.group_name || '';
      setSelectedGroup(grp || '');
      setCustomGroup('');
    } else {
      // Defaults for new task
      setTitle('');
      setDescription('');
      setStatus('not_started');
      setPriority('medium');
      setSelectedGroup('');
      setCustomGroup('');
      setEstimatedHours('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
    }
    setFormError('');
  }, [isOpen, taskToEdit?.id]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError(language === 'ku' ? 'تکایە ناوی ئەرکەکە بنووسە' : 'لطفاً نام تسک را وارد کنید.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      let finalGroupName = '';
      let finalGroupId = null;

      if (selectedGroup === 'custom') {
        finalGroupName = customGroup.trim();
      } else if (selectedGroup) {
        finalGroupName = selectedGroup;
        const matched = dbGroups.find(g => g.name === selectedGroup);
        if (matched) finalGroupId = String(matched.id);
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        group_name: finalGroupName || null,
        group_id: finalGroupId || null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        start_date: startDate || null,
        due_date: dueDate || null,
        project_id: targetProjectId || null,
        parent_id: taskToEdit ? taskToEdit.parent_id : (parentTask ? parentTask.id : null)
      };

      const res = await onSubmit(payload, taskToEdit ? taskToEdit.id : null);
      if (res && res.success === false) {
        setFormError(res.error || 'خطا در ثبت تسک در سرور');
        return;
      }
      onClose();
    } catch (err) {
      console.error('Error submitting task form:', err);
      setFormError(err.message || 'خطا در ثبت تسک');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(taskToEdit);
  const isSubtask = Boolean(parentTask || taskToEdit?.parent_id);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md transition-all animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir={direction}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all scale-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
              isEditing 
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-amber-500/20' 
                : isSubtask 
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-sky-500/20'
                : 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-600/20'
            }`}>
              {isEditing ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                {isEditing ? (
                  language === 'ku' ? 'دەستکاری کردنی ئەرک' : 'ویرایش تسک'
                ) : isSubtask ? (
                  language === 'ku' ? 'سابتسکی نوێ' : 'افزودن سابتسک جدید'
                ) : (
                  language === 'ku' ? 'تۆمارکردنی ئەرکی نوێ' : 'ثبت تسک جدید'
                )}
              </h3>
              {parentTask && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-xs sm:max-w-sm mt-0.5">
                  {language === 'ku' ? 'سەر بە: ' : 'زیرمجموعه: '} {parentTask.title}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isSubtask 
                ? (language === 'ku' ? 'ناونیشانی سابتسک *' : 'عنوان سابتسک *') 
                : (language === 'ku' ? 'ناونیشانی ئەرک *' : 'عنوان تسک *')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === 'ku' ? 'نموونە: ئامادەکردنی داربەست و چیمەنتۆ...' : 'مثال: قالب‌بندی ستون‌های طبقه اول...'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* 2. Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>{language === 'ku' ? 'دۆخی جێبەجێکردن' : 'وضعیت تسک'}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setStatus('not_started')}
                  className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all ${
                    status === 'not_started'
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'ku' ? 'دەستپێنەکراو' : 'شروع نشده'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('in_progress')}
                  className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all ${
                    status === 'in_progress'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'ku' ? 'لە جێبەجێکردندا' : 'در حال انجام'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('completed')}
                  className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all ${
                    status === 'completed'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'ku' ? 'تەواوکراو' : 'پایان یافته'}
                </button>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-amber-500" />
                <span>{language === 'ku' ? 'ئەولەویەت' : 'اولویت'}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setPriority('low')}
                  className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all ${
                    priority === 'low'
                      ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'ku' ? 'کەم' : 'کم'}
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('medium')}
                  className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all ${
                    priority === 'medium'
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'ku' ? 'مامناوەند' : 'متوسط'}
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('high')}
                  className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all ${
                    priority === 'high'
                      ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'ku' ? 'فۆری / بەرز' : 'فوری / بالا'}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Description / Specs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'ku' ? 'وردەکاری و ڕوونکردنەوە' : 'مشخصات و توضیحات تکمیلی'}</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'ku' ? 'تێبینی و ڕێنماییە پێویستەکان بۆ جێبەجێکردن...' : 'توضیحات لازم، مصالح یا نکات ایمنی مورد نیاز برای اجرا...'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* 4. Assigned Work Group */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span>{language === 'ku' ? 'گرووپی کاری جێبەجێکار' : 'گروه کاری مجری'}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
              >
                <option value="">{language === 'ku' ? '-- بێ گرووپ / گشتی --' : '-- بدون گروه / عمومی --'}</option>
                {dbGroups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
                {selectedGroup && selectedGroup !== 'custom' && !dbGroups.some(g => g.name === selectedGroup) && (
                  <option value={selectedGroup}>{selectedGroup}</option>
                )}
                <option value="custom">{language === 'ku' ? '+ ناوی گرووپی تر (تایبەت)' : '+ نام گروه جدید / سفارشی'}</option>
              </select>

              {selectedGroup === 'custom' && (
                <input
                  type="text"
                  value={customGroup}
                  onChange={(e) => setCustomGroup(e.target.value)}
                  placeholder={language === 'ku' ? 'ناوی گرووپ بنووسە...' : 'نام گروه مجری را بنویسید...'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* 5. Estimation & Timeline */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50 space-y-3">
            <div className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-500" />
              <span>{language === 'ku' ? 'خەمڵاندنی کات و بەروار' : 'برآورد زمانی و تخمین پایان'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Estimated Hours */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {language === 'ku' ? 'تەخمینی کاتژمێر' : 'تخمین نفر-ساعت'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    placeholder="مثال: ۸"
                    className="w-full ps-3 pe-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-sky-500"
                  />
                  <span className="absolute end-2.5 top-2.5 text-xs text-slate-400 pointer-events-none">
                    {language === 'ku' ? 'کاتژمێر' : 'ساعت'}
                  </span>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{language === 'ku' ? 'بەرواری دەستپێک' : 'تاریخ شروع'}</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-sky-500"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-rose-400" />
                  <span>{language === 'ku' ? 'بەرواری تەواوبوون' : 'تخمین پایان / سررسید'}</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl text-white text-sm font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                isEditing
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-600/25'
              }`}
            >
              {isSubmitting ? (
                <span>{language === 'ku' ? 'تکایە چاوەڕێ بن...' : 'در حال ذخیره...'}</span>
              ) : (
                <>
                  <span>{isEditing ? (language === 'ku' ? 'پاشەکەوتکردنی گۆڕانکاری' : 'ذخیره تغییرات') : (language === 'ku' ? 'تۆمارکردنی ئەرک' : 'ثبت نهایی')}</span>
                  <ArrowRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
