import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { emitToast } from '../context/NotificationContext';
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
  ArrowRight,
  Layers,
  Sparkles,
  ListTodo,
  Timer,
  CalendarClock,
  Check
} from 'lucide-react';

export function TaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  taskToEdit = null,
  parentTask = null,
  targetProjectId = null
}) {
  const { language, direction, formatNumber } = useLanguage();
  const { currentProject } = useProject();
  const isRtl = direction === 'rtl';

  const effectiveProjectId = targetProjectId || currentProject?.id || DEFAULT_PROJECT_ID;

  // Load project groups for quick pill selection
  const dbGroups = useLiveQuery(
    async () => {
      const list = await db.groups.toArray();
      if (!effectiveProjectId) return list;
      return list.filter(
        (g) =>
          !g.projectId ||
          g.projectId === effectiveProjectId ||
          g.projectId === DEFAULT_PROJECT_ID
      );
    },
    [effectiveProjectId]
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

  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Pre-fill fields when modal opens or target task changes
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
      // Defaults for new task / subtask
      setTitle('');
      setDescription('');
      setStatus('not_started');
      setPriority(parentTask?.priority || 'medium');
      setSelectedGroup(parentTask?.group_name || '');
      setCustomGroup('');
      setEstimatedHours('');
      setStartDate(todayDateStr);
      setDueDate('');
    }
    setFormError('');
  }, [isOpen, taskToEdit?.id, parentTask?.id, todayDateStr]);

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

  const isEditing = Boolean(taskToEdit);
  const isSubtask = Boolean(parentTask || taskToEdit?.parent_id);

  // Quick date offset helper for Due Date chips
  const applyDueDateOffset = (daysToAdd) => {
    const base = startDate ? new Date(startDate) : new Date();
    if (isNaN(base.getTime())) return;
    base.setDate(base.getDate() + daysToAdd);
    const formatted = base.toISOString().split('T')[0];
    setDueDate(formatted);
  };

  const hourPresets = [
    { val: '2', label: language === 'fa' ? '۲ ساعت' : language === 'ku' ? '٢ کاتژمێر' : '2h' },
    { val: '4', label: language === 'fa' ? '۴ ساعت (نیم‌روز)' : language === 'ku' ? '٤ کاتژمێر' : '4h' },
    { val: '8', label: language === 'fa' ? '۸ ساعت (۱ روز کاری)' : language === 'ku' ? '٨ کاتژمێر (١ ڕۆژ)' : '8h (1d)' },
    { val: '16', label: language === 'fa' ? '۱۶ ساعت (۲ روز)' : language === 'ku' ? '١٦ کاتژمێر' : '16h' },
    { val: '24', label: language === 'fa' ? '۲۴ ساعت (۳ روز)' : language === 'ku' ? '٢٤ کاتژمێر' : '24h' },
    { val: '40', label: language === 'fa' ? '۴۰ ساعت (۱ هفته)' : language === 'ku' ? '٤٠ کاتژمێر' : '40h' }
  ];

  const duePresets = [
    { days: 0, label: language === 'fa' ? 'امروز' : language === 'ku' ? 'ئەمڕۆ' : 'Today' },
    { days: 1, label: language === 'fa' ? 'فردا' : language === 'ku' ? 'سبەینێ' : 'Tomorrow' },
    { days: 3, label: language === 'fa' ? '۳ روز دیگر' : language === 'ku' ? '٣ ڕۆژی تر' : '+3 Days' },
    { days: 7, label: language === 'fa' ? '۱ هفته دیگر' : language === 'ku' ? '١ هەفتەی تر' : '+1 Week' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      const msg =
        language === 'ku'
          ? 'تکایە ناونیشانی ئەرکەکە بنووسە'
          : language === 'fa'
          ? 'لطفاً عنوان تسک را وارد کنید.'
          : 'Please enter a task title.';
      setFormError(msg);
      emitToast({
        type: 'warning',
        title: language === 'fa' ? 'نقص اطلاعات' : 'زانیاری ناتەواو',
        message: msg
      });
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
        const matched = dbGroups.find((g) => g.name === selectedGroup);
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
        project_id: effectiveProjectId || null,
        parent_id: taskToEdit ? taskToEdit.parent_id : parentTask ? parentTask.id : null
      };

      const res = await onSubmit(payload, taskToEdit ? taskToEdit.id : null);
      if (res && res.success === false) {
        const errMsg = res.error || (language === 'fa' ? 'خطا در ثبت تسک در سرور' : 'هەڵە لە تۆمارکردنی ئەرک');
        setFormError(errMsg);
        emitToast({
          type: 'error',
          title: language === 'fa' ? 'خطا در ثبت تسک' : 'هەڵە ڕوویدا',
          message: errMsg
        });
        return;
      }

      emitToast({
        type: 'success',
        title: isEditing
          ? language === 'fa'
            ? 'تسک ویرایش شد'
            : 'ئەرکەکە نوێکرایەوە'
          : isSubtask
          ? language === 'fa'
            ? 'سابتسک جدید ثبت شد'
            : 'سابتسکی نوێ تۆمارکرا'
          : language === 'fa'
          ? 'تسک جدید با موفقیت ثبت شد'
          : 'ئەرکی نوێ تۆمارکرا',
        message: `«${title.trim()}» ${
          finalGroupName ? `(${finalGroupName})` : ''
        }`
      });

      onClose();
    } catch (err) {
      console.error('Error submitting task form:', err);
      const errMsg = err.message || (language === 'fa' ? 'خطا در ثبت تسک' : 'هەڵە لە تۆمارکردنی ئەرک');
      setFormError(errMsg);
      emitToast({
        type: 'error',
        title: language === 'fa' ? 'خطا در ثبت تسک' : 'هەڵە ڕوویدا',
        message: errMsg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper labels for Sticky Bottom Dock summary
  const statusMeta = {
    not_started: {
      label: language === 'fa' ? 'شروع نشده' : language === 'ku' ? 'دەستپێنەکراو' : 'Not Started',
      badgeClass:
        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    },
    in_progress: {
      label: language === 'fa' ? 'در حال انجام' : language === 'ku' ? 'لە جێبەجێکردندا' : 'In Progress',
      badgeClass:
        'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
    },
    completed: {
      label: language === 'fa' ? 'پایان یافته' : language === 'ku' ? 'تەواوکراو' : 'Completed',
      badgeClass:
        'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    }
  }[status] || {
    label: status,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const priorityMeta = {
    low: {
      label: language === 'fa' ? 'اولویت کم' : language === 'ku' ? 'ئەولەویەتی کەم' : 'Low Priority',
      badgeClass:
        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    },
    medium: {
      label: language === 'fa' ? 'اولویت متوسط' : language === 'ku' ? 'ئەولەویەتی مامناوەند' : 'Medium Priority',
      badgeClass:
        'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    },
    high: {
      label: language === 'fa' ? 'فوری / بالا' : language === 'ku' ? 'فۆری / بەرز' : 'High Priority',
      badgeClass:
        'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
    }
  }[priority];

  const activeGroupLabel =
    selectedGroup === 'custom'
      ? customGroup.trim() || (language === 'fa' ? 'گروه سفارشی' : 'گرووپی تایبەت')
      : selectedGroup || (language === 'fa' ? 'عمومی کارگاه' : 'گشتی');

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir={direction}
    >
      <div className="bg-[#f3f6f4] dark:bg-slate-950 rounded-3xl w-full max-w-5xl max-h-[93vh] flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.28)] border border-white/60 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* ========================================================= */}
        {/* 1. APPLE GLASS TOP HEADER                                 */}
        {/* ========================================================= */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3.5 shrink-0 z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${
                  isEditing
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-amber-500/25'
                    : isSubtask
                    ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-sky-500/25'
                    : 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-600/25'
                }`}
              >
                {isEditing ? (
                  <Edit2 className="w-5 h-5 stroke-[2.2]" />
                ) : isSubtask ? (
                  <Layers className="w-5 h-5 stroke-[2.2]" />
                ) : (
                  <ListTodo className="w-5 h-5 stroke-[2.2]" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {isEditing
                      ? language === 'ku'
                        ? 'دەستکاریکردنی ئەرک'
                        : language === 'fa'
                        ? 'ویرایش مشخصات تسک اجرایی'
                        : 'Edit Task'
                      : isSubtask
                      ? language === 'ku'
                        ? 'تۆمارکردنی سابتسکی نوێ'
                        : language === 'fa'
                        ? 'افزودن زیرمجموعه (سابتسک) جدید'
                        : 'Add New Subtask'
                      : language === 'ku'
                      ? 'تۆمارکردنی ئەرکی نوێ'
                      : language === 'fa'
                      ? 'تعریف و ثبت تسک جدید کارگاه'
                      : 'Create New Workshop Task'}
                  </h2>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                    {currentProject?.name || (language === 'fa' ? 'پروژه فعال' : 'پڕۆژەی چالاک')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
                  {parentTask
                    ? `${language === 'ku' ? 'سەر بە ئەرکی: ' : 'زیرمجموعه تسک مادر: '} «${parentTask.title}»`
                    : language === 'ku'
                    ? 'دیاریکردنی وردەکاری، گرووپی جێبەجێکار، ئەولەویەت و کاتی تەواوبوونی کارەکە'
                    : 'برنامه‌ریزی شرح فعالیت، تخصیص به تیم اجرایی، تعیین اولویت و تخمین نفر-ساعت'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shrink-0"
              title={language === 'fa' ? 'بستن (ESC)' : 'Close (ESC)'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. SCROLLABLE 12-COLUMN APPLE LIQUID GLASS BODY           */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto bg-[#f3f6f4] dark:bg-slate-950 p-4 sm:p-6">
          <form id="task-glass-form" onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* ─────────────────────────────────────────────────────────── */}
              {/* PRIMARY COLUMN (7 Cols): Title, Specs & Work Group          */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-7 space-y-5">
                {/* Card 1: Task Title & Execution Specs */}
                <div className="p-5 rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                        {language === 'fa'
                          ? 'عنوان و شرح فنی عملیات'
                          : language === 'ku'
                          ? 'ناونیشان و وردەکاری جێبەجێکردن'
                          : 'Task Title & Technical Specs'}
                      </span>
                    </div>
                    {isSubtask && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        {language === 'fa' ? 'سابتسک زیرمجموعه' : 'سابتسک'}
                      </span>
                    )}
                  </div>

                  {/* Parent Task Context Banner (when creating a subtask) */}
                  {parentTask && (
                    <div className="p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/50 flex items-center gap-2.5 text-xs">
                      <Layers className="w-4 h-4 text-sky-500 shrink-0" />
                      <div className="truncate">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          {language === 'fa' ? 'تسک اصلی: ' : 'ئەرکی سەرەکی: '}
                        </span>
                        <span className="font-black text-sky-900 dark:text-sky-200">
                          {parentTask.title}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Task Title Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isSubtask
                        ? language === 'ku'
                          ? 'ناونیشانی سابتسک'
                          : 'عنوان سابتسک اجرایی'
                        : language === 'ku'
                        ? 'ناونیشانی ئەرک'
                        : 'عنوان تسک / فعالیت کارگاهی'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        language === 'ku'
                          ? 'نموونە: ئامادەکردنی داربەست و چیمەنتۆی نهۆمی یەکەم...'
                          : 'مثال: آرماتوربندی و قالب‌بندی ستون‌های محور شمالی طبقه اول...'
                      }
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all placeholder:font-normal placeholder:text-slate-400"
                      autoFocus
                    />
                  </div>

                  {/* Description / Technical Notes */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'ku'
                        ? 'وردەکاری، کەرەستە و تێبینییەکانی جێبەجێکردن'
                        : 'مشخصات اجرایی، مصالح موردنیاز و نکات کنترلی'}
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        language === 'ku'
                          ? 'تێبینی و ڕێنماییە پێویستەکان بۆ جێبەجێکردن لێرە بنووسە...'
                          : 'جزئیات فنی، استانداردهای اجرایی، ابزارآلات یا نکات ایمنی مربوط به این تسک را وارد کنید...'
                      }
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs sm:text-sm leading-relaxed focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all placeholder:text-slate-400 resize-none"
                    />
                  </div>
                </div>

                {/* Card 2: Assigned Work Team / Group (Interactive Quick Pills + Custom) */}
                <div className="p-5 rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block">
                          {language === 'ku'
                            ? 'تیم یان گرووپی جێبەجێکار'
                            : 'تیم یا گروه کاری مجری'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {language === 'ku'
                            ? 'ئەم ئەرکە دەدرێت بە کام گرووپی کارگە؟'
                            : 'مشخص کنید کدام اکیپ یا گروه کاری مسئول اجرای این فعالیت است'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Group Selection Chips */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGroup('')}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                        selectedGroup === ''
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700'
                      }`}
                    >
                      {selectedGroup === '' && <Check className="w-3.5 h-3.5" />}
                      <span>
                        {language === 'ku' ? 'گشتی / بێ گرووپ' : 'عمومی / بدون گروه خاص'}
                      </span>
                    </button>

                    {dbGroups.map((g) => {
                      const isSelected = selectedGroup === g.name;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGroup(g.name)}
                          className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{g.name}</span>
                        </button>
                      );
                    })}

                    {/* Legacy custom group value when editing */}
                    {selectedGroup &&
                      selectedGroup !== 'custom' &&
                      !dbGroups.some((g) => g.name === selectedGroup) && (
                        <button
                          type="button"
                          onClick={() => setSelectedGroup(selectedGroup)}
                          className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/25 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{selectedGroup}</span>
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => setSelectedGroup('custom')}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                        selectedGroup === 'custom'
                          ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                          : 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200/70 dark:border-sky-800/60'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {language === 'ku' ? 'گرووپی تایبەت / نوێ' : 'نام گروه سفارشی'}
                      </span>
                    </button>
                  </div>

                  {selectedGroup === 'custom' && (
                    <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      <input
                        type="text"
                        value={customGroup}
                        onChange={(e) => setCustomGroup(e.target.value)}
                        placeholder={
                          language === 'ku'
                            ? 'ناوی گرووپی جێبەجێکار بنووسە...'
                            : 'نام اکیپ، پیمانکار یا گروه مجری را بنویسید...'
                        }
                        className="w-full px-4 py-2.5 rounded-2xl border border-sky-300 dark:border-sky-700 bg-sky-50/40 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-hidden transition-all"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────── */}
              {/* SECONDARY COLUMN (5 Cols): Status, Priority & Timeline      */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-5 space-y-5">
                {/* Card 3: Execution Status & Priority Level */}
                <div className="p-5 rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Flag className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      {language === 'ku'
                        ? 'دۆخی جێبەجێکردن و ئەولەویەت'
                        : 'وضعیت اجرا و درجه اهمیت'}
                    </span>
                  </div>

                  {/* Status Segmented Pill Bar */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        {language === 'ku' ? 'دۆخی ئێستای ئەرک:' : 'وضعیت فعلی تسک:'}
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => setStatus('not_started')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                          status === 'not_started'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {language === 'ku' ? 'دەستپێنەکراو' : 'شروع نشده'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus('in_progress')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                          status === 'in_progress'
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/25'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {language === 'ku' ? 'لە جێبەجێکردندا' : 'در حال انجام'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus('completed')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                          status === 'completed'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/25'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {language === 'ku' ? 'تەواوکراو' : 'پایان یافته'}
                      </button>
                    </div>
                  </div>

                  {/* Priority Segmented Pill Bar */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        {language === 'ku' ? 'ئاستی ئەولەویەت:' : 'سطح اولویت و فوریت:'}
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => setPriority('low')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                          priority === 'low'
                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {language === 'ku' ? 'کەم' : 'کم / عادی'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriority('medium')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                          priority === 'medium'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {language === 'ku' ? 'مامناوەند' : 'متوسط'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriority('high')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                          priority === 'high'
                            ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-600/25'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {language === 'ku' ? 'فۆری / بەرز' : 'فوری / بالا'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card 4: Time Estimation & Schedule (with Quick Chips) */}
                <div className="p-5 rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CalendarClock className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      {language === 'ku'
                        ? 'خەمڵاندنی کات و خشتەی زەمەنی'
                        : 'برآورد نفر-ساعت و زمان‌بندی'}
                    </span>
                  </div>

                  {/* Estimated Hours Input + Quick Chips */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-emerald-500" />
                        {language === 'ku' ? 'خەمڵاندنی کاتژمێری کار:' : 'تخمین حجم کار (نفر-ساعت):'}
                      </span>
                      {estimatedHours && (
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                          {formatNumber(estimatedHours)}{' '}
                          {language === 'ku' ? 'کاتژمێر' : 'ساعت'}
                        </span>
                      )}
                    </label>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={estimatedHours}
                        onChange={(e) => setEstimatedHours(e.target.value)}
                        placeholder={language === 'ku' ? 'نموونە: 8' : 'مثال: ۸'}
                        className="w-full ps-4 pe-14 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-black font-mono outline-hidden focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                      <span className="absolute end-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                        {language === 'ku' ? 'کاتژمێر' : 'ساعت'}
                      </span>
                    </div>

                    {/* Quick Hour Presets */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {hourPresets.map((item) => {
                        const isSelected = String(estimatedHours) === item.val;
                        return (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() =>
                              setEstimatedHours(isSelected ? '' : item.val)
                            }
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400 border border-slate-200/70 dark:border-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Start Date & Due Date Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-500" />
                        <span>{language === 'ku' ? 'بەرواری دەستپێک' : 'تاریخ شروع'}</span>
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-bold outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-rose-500" />
                        <span>
                          {language === 'ku' ? 'بەرواری تەواوبوون' : 'موعد تحویل / سررسید'}
                        </span>
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-bold outline-hidden focus:ring-2 focus:ring-rose-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Quick Due Date Chips */}
                  <div className="flex items-center justify-between flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      {language === 'ku' ? 'دیاریکردنی خێرای مۆڵەت:' : 'انتخاب سریع سررسید:'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {duePresets.map((p) => (
                        <button
                          key={p.days}
                          type="button"
                          onClick={() => applyDueDateOffset(p.days)}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/70 dark:border-slate-700 transition-all cursor-pointer"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* ========================================================= */}
        {/* 3. STICKY APPLE GLASS BOTTOM DOCK (Summary + Actions)     */}
        {/* ========================================================= */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 shrink-0 shadow-lg z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Live Summary Chips (Start Side) */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border ${statusMeta.badgeClass}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{statusMeta.label}</span>
              </span>

              {priorityMeta && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border ${priorityMeta.badgeClass}`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{priorityMeta.label}</span>
                </span>
              )}

              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>{activeGroupLabel}</span>
              </span>

              {estimatedHours && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {formatNumber(estimatedHours)}{' '}
                    {language === 'ku' ? 'کاتژمێر' : 'ساعت'}
                  </span>
                </span>
              )}
            </div>

            {/* Action Buttons (End Side) */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                {language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف'}
              </button>

              <button
                type="submit"
                form="task-glass-form"
                disabled={isSubmitting}
                className={`px-6 py-2.5 rounded-2xl text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                  isEditing
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
                    : isSubtask
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 shadow-sky-500/25'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-600/25'
                }`}
              >
                {isSubmitting ? (
                  <span>
                    {language === 'ku' ? 'تکایە چاوەڕێ بن...' : 'در حال ذخیره...'}
                  </span>
                ) : (
                  <>
                    <span>
                      {isEditing
                        ? language === 'ku'
                          ? 'پاشەکەوتکردنی گۆڕانکاری'
                          : 'ذخیره تغییرات تسک'
                        : isSubtask
                        ? language === 'ku'
                          ? 'تۆمارکردنی سابتسک'
                          : 'ثبت نهایی سابتسک'
                        : language === 'ku'
                        ? 'تۆمارکردنی ئەرک'
                        : 'ثبت نهایی تسک'}
                    </span>
                    <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
