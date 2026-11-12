import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { usePermissions } from '../../context/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../../db/db';
import {
  getFinancialYears,
  ensureDefaultFinancialYears,
  createFinancialYear,
  updateFinancialYear,
  setActiveFinancialYear,
  closeFinancialYear,
  reopenFinancialYear,
  deleteFinancialYear,
  getPresetFinancialYear,
  jalaliToGregorian,
  gregorianToJalali
} from '../../services/financialYearService';
import {
  CalendarDays,
  Calendar,
  Lock,
  Unlock,
  Check,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Info,
  Clock,
  RotateCcw,
  ArrowRight,
  ChevronRight,
  Globe,
  Sun
} from 'lucide-react';

const COPY = {
  fa: {
    modalTitle: 'مدیریت سال‌ها و دوره‌های مالی (Fiscal Years)',
    modalSubtitle: 'تعریف سال مالی شمسی و میلادی، کنترل وضعیت بستن حساب‌ها و آغاز دوره جدید',
    activeBadge: 'سال مالی جاری',
    openStatus: 'باز (پذیرش اسناد)',
    closedStatus: 'بسته شده (قفل قطعی)',
    calendarJalali: 'تقویم شمسی (خورشیدی)',
    calendarGregorian: 'تقویم میلادی (گریگوری)',
    btnNewYear: 'تعریف سال مالی جدید',
    btnSetActive: 'انتخاب به عنوان سال جاری',
    btnCloseYear: 'بستن قطعی سال مالی',
    btnReopenYear: 'بازگشایی مجدد دوره',
    btnDelete: 'حذف سال مالی',
    btnEdit: 'ویرایش مشخصات',
    closeConfirmTitle: 'بستن قطعی سال مالی و قفل دفاتر',
    closeConfirmDesc: 'با بستن سال مالی، کلیه اسناد، هزینه‌ها و پرداخت‌های این دوره قفل شده و امکان ثبت سند جدید در این بازه مسدود می‌شود.',
    autoInitNextYearLabel: 'ایجاد و فعال‌سازی خودکار سال مالی جدید بلافاصله پس از بستن',
    closingNotesPlaceholder: 'توضیحات و مصوبات اختتامیه دوره مالی...',
    btnExecuteClose: 'بستن قطعی و قفل سال مالی',
    cancel: 'انصراف',
    save: 'ذخیره اطلاعات',
    titleLabel: 'عنوان سال مالی',
    titlePlaceholder: 'مثال: سال مالی ۱۴۰۴ یا Fiscal Year 2026',
    calendarTypeLabel: 'نوع مبنای تقویم دوره',
    startDateLabel: 'تاریخ شروع دوره',
    endDateLabel: 'تاریخ پایان دوره',
    descriptionLabel: 'توضیحات تکمیلی',
    descriptionPlaceholder: 'توضیحات، مصوبه هیئت مدیره یا شرایط پروژه...',
    makeDefaultLabel: 'تنظیم به عنوان سال مالی پیش‌فرض و فعال کارگاه',
    quickPresetsTitle: 'پیش‌تنظیم‌های استاندارد سالانه:',
    emptyYears: 'هیچ سال مالی ثبت نشده است؛ جهت شروع روی دکمه تعریف سال مالی جدید کلیک کنید.',
    accessDeniedTitle: 'عدم دسترسی به سال‌های مالی',
    accessDeniedDesc: 'تنها کاربران دارای مجوز مدیریت حسابداری مجاز به مشاهده و تغییر دوره‌های مالی هستند.'
  },
  ku: {
    modalTitle: 'بەڕێوەبردنی ساڵە داراییەکان (Fiscal Years)',
    modalSubtitle: 'پێناسەکردنی ساڵی دارایی بە تەقویمی کۆچی یان زاینی، داخستنی حیسابات و دەستپێکی ساڵی نوێ',
    activeBadge: 'ساڵی دارایی چالاک',
    openStatus: 'کراوە (تۆمارکردنی بەڵگەنامە)',
    closedStatus: 'داخراو (قوفڵکراوی یەکجاری)',
    calendarJalali: 'تەقویمی هەتاوی (کوردی/شمسی)',
    calendarGregorian: 'تەقویمی زاینی (گریگۆری)',
    btnNewYear: 'پێناسەکردنی ساڵی دارایی نوێ',
    btnSetActive: 'دیاریکردن وەک ساڵی بنەڕەتی',
    btnCloseYear: 'داخستنی یەکجاری ساڵی دارایی',
    btnReopenYear: 'کردنەوەی دووبارەی خولەکە',
    btnDelete: 'سڕینەوەی ساڵی دارایی',
    btnEdit: 'دەستکاریکردنی زانیاری',
    closeConfirmTitle: 'داخستنی یەکجاری و قوفڵکردنی دەفتەرەکان',
    closeConfirmDesc: 'بە داخستنی ساڵی دارایی، هەموو بەڵگەنامە و خەرجییەکان لەو ماوەیە قوفڵ دەبن و تۆمارکردنی نوێ ڕادەگیرێت.',
    autoInitNextYearLabel: 'دروستکردنی خۆکاری ساڵی دارایی نوێ ڕاستەوخۆ دوای داخستن',
    closingNotesPlaceholder: 'تێبینییەکانی داخستنی ساڵی دارایی...',
    btnExecuteClose: 'داخستنی یەکجاری ساڵی دارایی',
    cancel: 'پاشگەزبوونەوە',
    save: 'پاشەکەوتکردن',
    titleLabel: 'ناونیشانی ساڵی دارایی',
    titlePlaceholder: 'نموونە: ساڵی دارایی ٢٠٢٦ یان ١٤٠٤',
    calendarTypeLabel: 'جۆری تەقویمی خولەکە',
    startDateLabel: 'بەرواری دەستپێک',
    endDateLabel: 'بەرواری کۆتایی',
    descriptionLabel: 'تێبینی زیاتر',
    descriptionPlaceholder: 'تێبینی و بڕیارەکانی پڕۆژە...',
    makeDefaultLabel: 'دیاریکردن وەک ساڵی دارایی سەرەکی و چالاک',
    quickPresetsTitle: 'پێشوەختە ستانداردەکان:',
    emptyYears: 'هیچ ساڵێکی دارایی تۆمار نەکراوە؛ کلیک لەسەر پێناسەکردنی ساڵی نوێ بکە.',
    accessDeniedTitle: 'دەستپێڕانەگەیشتن بە ساڵە داراییەکان',
    accessDeniedDesc: 'تەنها ئەو بەکارهێنەرانەی مۆڵەتی ژمێریارییان هەیە دەتوانن ساڵە داراییەکان بەڕێوەببەن.'
  },
  en: {
    modalTitle: 'Fiscal Years & Accounting Periods',
    modalSubtitle: 'Define Solar Hijri & Gregorian fiscal years, close periods, and initialize new cycles',
    activeBadge: 'Active Fiscal Year',
    openStatus: 'Open (Accepting Entries)',
    closedStatus: 'Closed (Permanently Locked)',
    calendarJalali: 'Solar Hijri (Jalali)',
    calendarGregorian: 'Gregorian Calendar',
    btnNewYear: 'Define New Fiscal Year',
    btnSetActive: 'Set as Active Year',
    btnCloseYear: 'Close Fiscal Year',
    btnReopenYear: 'Reopen Period',
    btnDelete: 'Delete Year',
    btnEdit: 'Edit Details',
    closeConfirmTitle: 'Close Period & Lock Ledgers',
    closeConfirmDesc: 'Closing this fiscal year locks all transactions, vouchers, and backcharges. No retroactive modifications will be allowed.',
    autoInitNextYearLabel: 'Automatically initialize next consecutive fiscal year upon closing',
    closingNotesPlaceholder: 'Closing notes and period audit summary...',
    btnExecuteClose: 'Finalize & Close Fiscal Year',
    cancel: 'Cancel',
    save: 'Save Changes',
    titleLabel: 'Fiscal Year Title',
    titlePlaceholder: 'e.g. Fiscal Year 2026 or Solar FY 1404',
    calendarTypeLabel: 'Calendar System',
    startDateLabel: 'Period Start Date',
    endDateLabel: 'Period End Date',
    descriptionLabel: 'Description / Notes',
    descriptionPlaceholder: 'Board resolutions, workshop milestones or notes...',
    makeDefaultLabel: 'Set as active default fiscal year for this workshop',
    quickPresetsTitle: 'Standard Annual Presets:',
    emptyYears: 'No fiscal years recorded yet. Click Define New Fiscal Year to get started.',
    accessDeniedTitle: 'Access Restricted: Fiscal Years',
    accessDeniedDesc: 'Only users with the "accounting.manage" permission can configure or close fiscal years.'
  }
};

export default function FinancialYearsModal({ isOpen = true, onClose, embedded = false }) {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const { hasPermission } = usePermissions();
  const canManageAccounting = hasPermission('accounting.manage');
  const projectId = currentProject?.id || DEFAULT_PROJECT_ID;
  const t = COPY[language] || COPY.fa;

  // State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [closingYearTarget, setClosingYearTarget] = useState(null);
  const [closingNotes, setClosingNotes] = useState('');
  const [autoInitNext, setAutoInitNext] = useState(true);
  const [notification, setNotification] = useState(null);

  // Form State
  const [formCalendarType, setFormCalendarType] = useState(language === 'fa' ? 'jalali' : 'gregorian');
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStartDisplay, setFormStartDisplay] = useState('');
  const [formEndDisplay, setFormEndDisplay] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  // Auto-initialize standard Financial Years if empty on mount
  useEffect(() => {
    if (!canManageAccounting) return;
    if (!isOpen && !embedded) return;
    let isMounted = true;
    async function initDefaults() {
      try {
        if (!db.financialYears) return;
        const count = await db.financialYears.where('projectId').equals(projectId).count();
        if (count === 0 && isMounted) {
          await ensureDefaultFinancialYears(projectId);
        }
      } catch (err) {
        console.warn('Failed to ensure default financial years:', err);
      }
    }
    initDefaults();
    return () => { isMounted = false; };
  }, [isOpen, embedded, projectId, canManageAccounting]);

  // Live Query from Dexie
  const financialYears = useLiveQuery(
    async () => {
      return await getFinancialYears(projectId);
    },
    [projectId]
  ) || [];

  // Active Year
  const activeYear = useMemo(() => {
    return financialYears.find(y => y.isDefault) || financialYears.find(y => y.status === 'open') || financialYears[0] || null;
  }, [financialYears]);

  // Quick preset apply
  const handleApplyPreset = (yearNum, calType) => {
    const preset = getPresetFinancialYear(yearNum, calType);
    setFormCalendarType(calType);
    setFormTitle(language === 'ku' ? preset.title_ku : language === 'en' ? preset.title_en : preset.title);
    setFormStartDate(preset.startDate);
    setFormEndDate(preset.endDate);
    setFormStartDisplay(preset.startDisplay);
    setFormEndDisplay(preset.endDisplay);
  };

  const handleOpenNewForm = () => {
    const now = new Date();
    const gYear = now.getFullYear();
    const jData = gregorianToJalali(gYear, now.getMonth() + 1, now.getDate());
    const defaultCal = language === 'fa' ? 'jalali' : 'gregorian';
    const defaultYearNum = defaultCal === 'jalali' ? jData.jy : gYear;

    setEditingYear(null);
    setFormCalendarType(defaultCal);
    handleApplyPreset(defaultYearNum, defaultCal);
    setFormDescription('');
    setFormIsDefault(financialYears.length === 0);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (fy) => {
    setEditingYear(fy);
    setFormCalendarType(fy.calendarType || 'jalali');
    setFormTitle(fy.title || '');
    setFormStartDate(fy.startDate || '');
    setFormEndDate(fy.endDate || '');
    setFormStartDisplay(fy.startDisplay || fy.startDate || '');
    setFormEndDisplay(fy.endDisplay || fy.endDate || '');
    setFormDescription(fy.description || '');
    setFormIsDefault(Boolean(fy.isDefault));
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formTitle || !formStartDate || !formEndDate) return;

    try {
      if (editingYear) {
        await updateFinancialYear(editingYear.id, {
          title: formTitle,
          calendarType: formCalendarType,
          startDate: formStartDate,
          endDate: formEndDate,
          startDisplay: formStartDisplay || formStartDate,
          endDisplay: formEndDisplay || formEndDate,
          description: formDescription,
          isDefault: formIsDefault
        });
        setNotification({ type: 'success', message: 'مشخصات سال مالی با موفقیت به‌روزرسانی شد.' });
      } else {
        await createFinancialYear({
          projectId,
          title: formTitle,
          calendarType: formCalendarType,
          startDate: formStartDate,
          endDate: formEndDate,
          startDisplay: formStartDisplay || formStartDate,
          endDisplay: formEndDisplay || formEndDate,
          description: formDescription,
          isDefault: formIsDefault
        });
        setNotification({ type: 'success', message: 'سال مالی جدید با موفقیت ایجاد گردید.' });
      }
      setIsFormOpen(false);
      setEditingYear(null);
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'خطا در ثبت سال مالی' });
    }
  };

  const handleSetActive = async (id) => {
    try {
      await setActiveFinancialYear(id, projectId);
      setNotification({ type: 'success', message: 'سال مالی جاری کارگاه با موفقیت تغییر کرد.' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'خطا در تغییر سال مالی جاری' });
    }
  };

  const handleExecuteCloseYear = async () => {
    if (!closingYearTarget) return;
    try {
      const res = await closeFinancialYear(closingYearTarget.id, {
        closingNotes,
        initializeNextYear: autoInitNext
      });

      setClosingYearTarget(null);
      setClosingNotes('');
      setNotification({
        type: 'success',
        message: res.nextYear
          ? `سال مالی «${closingYearTarget.title}» بسته و سال مالی جدید «${res.nextYear.title}» آغاز گردید.`
          : `سال مالی «${closingYearTarget.title}» با موفقیت بسته و دفاتر قفل شدند.`
      });
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'خطا در بستن سال مالی' });
    }
  };

  const handleReopenYear = async (id) => {
    try {
      await reopenFinancialYear(id);
      setNotification({ type: 'success', message: 'سال مالی با موفقیت بازگشایی شد.' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'خطا در بازگشایی دوره مالی' });
    }
  };

  const handleDeleteYear = async (id) => {
    if (!window.confirm('آیا از حذف این سال مالی اطمینان دارید؟')) return;
    try {
      await deleteFinancialYear(id);
      setNotification({ type: 'success', message: 'سال مالی با موفقیت حذف شد.' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'امکان حذف سال مالی بسته شده وجود ندارد.' });
    }
  };

  if (!isOpen && !embedded) return null;

  const mainBody = (
    <div className={`space-y-5 ${embedded ? '' : 'p-5 sm:p-6 overflow-y-auto flex-1'}`}>
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs animate-in fade-in duration-150 ${
          notification.type === 'error'
            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <ShieldCheck className="w-4 h-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!canManageAccounting ? (
        <div className="p-8 text-center bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-rose-200 dark:border-rose-900/40">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{t.accessDeniedTitle}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.accessDeniedDesc}</p>
        </div>
      ) : (
        <>
          {/* Active Hero Card */}
          {activeYear && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 dark:from-sky-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border border-sky-300/40 dark:border-sky-800/40 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/90 dark:border-slate-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-sm shrink-0">
                  <Calendar className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{t.activeBadge}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                      activeYear.status === 'open'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                    }`}>
                      {activeYear.status === 'open' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{activeYear.status === 'open' ? t.openStatus : t.closedStatus}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                      {activeYear.calendarType === 'jalali' ? t.calendarJalali : t.calendarGregorian}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {activeYear.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5" dir="ltr">
                    {activeYear.startDisplay} ➔ {activeYear.endDisplay}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenNewForm}
                className="h-11 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.2]" />
                <span>{t.btnNewYear}</span>
              </button>
            </div>
          )}

          {/* Form Drawer (Inline Liquid Glass) */}
          {isFormOpen && (
            <form onSubmit={handleSaveForm} className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/90 dark:border-slate-800 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  <span>{editingYear ? t.btnEdit : t.btnNewYear}</span>
                </h4>
                <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Calendar Type Pill Selector */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
                  {t.calendarTypeLabel}
                </label>
                <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setFormCalendarType('jalali');
                      handleApplyPreset(1404, 'jalali');
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      formCalendarType === 'jalali'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>{t.calendarJalali}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormCalendarType('gregorian');
                      handleApplyPreset(2026, 'gregorian');
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      formCalendarType === 'gregorian'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{t.calendarGregorian}</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                  {t.quickPresetsTitle}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {formCalendarType === 'jalali' ? (
                    [1403, 1404, 1405, 1406].map(y => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => handleApplyPreset(y, 'jalali')}
                        className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-600 transition-colors border border-slate-200/60 dark:border-slate-700"
                      >
                        سال مالی {y}
                      </button>
                    ))
                  ) : (
                    [2024, 2025, 2026, 2027].map(y => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => handleApplyPreset(y, 'gregorian')}
                        className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-600 transition-colors border border-slate-200/60 dark:border-slate-700 font-mono"
                      >
                        FY {y}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {t.titleLabel} *
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder={t.titlePlaceholder}
                    required
                    className="w-full h-11 px-3.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {t.startDateLabel} (ISO) *
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={e => {
                      setFormStartDate(e.target.value);
                      if (!formStartDisplay) setFormStartDisplay(e.target.value);
                    }}
                    required
                    className="w-full h-11 px-3 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {t.endDateLabel} (ISO) *
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={e => {
                      setFormEndDate(e.target.value);
                      if (!formEndDisplay) setFormEndDisplay(e.target.value);
                    }}
                    required
                    className="w-full h-11 px-3 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    نمایش در تقویم کارگاه
                  </label>
                  <input
                    type="text"
                    value={formStartDisplay && formEndDisplay ? `${formStartDisplay} تا ${formEndDisplay}` : ''}
                    readOnly
                    className="w-full h-11 px-3 rounded-2xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {t.descriptionLabel}
                </label>
                <textarea
                  rows="2"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder={t.descriptionPlaceholder}
                  className="w-full p-3 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={e => setFormIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {t.makeDefaultLabel}
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-all active:scale-95"
                >
                  {t.save}
                </button>
              </div>
            </form>
          )}

          {/* Financial Years List */}
          <div className="space-y-3">
            {financialYears.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                {t.emptyYears}
              </div>
            ) : (
              financialYears.map((fy) => {
                const isClosed = fy.status === 'closed';
                const isDef = Boolean(fy.isDefault);

                return (
                  <div
                    key={fy.id}
                    className={`p-4 sm:p-5 rounded-3xl bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border transition-all ${
                      isDef
                        ? 'border-sky-400/70 dark:border-sky-600/60 shadow-[0_4px_20px_rgba(14,165,233,0.1)]'
                        : 'border-white/80 dark:border-slate-800 shadow-xs'
                    } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        isClosed
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : isDef
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {isClosed ? <Lock className="w-5 h-5 stroke-[2.2]" /> : <Calendar className="w-5 h-5 stroke-[2.2]" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {fy.title}
                          </h4>
                          {isDef && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500 text-white shadow-xs">
                              {t.activeBadge}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            !isClosed
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                          }`}>
                            {!isClosed ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            <span>{!isClosed ? t.openStatus : t.closedStatus}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
                            {fy.calendarType === 'jalali' ? 'شمسی' : 'میلادی'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1" dir="ltr">
                          {fy.startDisplay} ➔ {fy.endDisplay}
                        </p>

                        {fy.description && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-1">
                            {fy.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions Pill */}
                    <div className="flex items-center gap-1.5 flex-wrap self-end md:self-center">
                      {!isDef && !isClosed && (
                        <button
                          type="button"
                          onClick={() => handleSetActive(fy.id)}
                          className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-300 hover:text-sky-600 text-xs font-bold transition-all"
                        >
                          {t.btnSetActive}
                        </button>
                      )}

                      {!isClosed ? (
                        <button
                          type="button"
                          onClick={() => {
                            setClosingYearTarget(fy);
                            setClosingNotes('');
                            setAutoInitNext(true);
                          }}
                          className="h-8 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>{t.btnCloseYear}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReopenYear(fy.id)}
                          className="h-8 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>{t.btnReopenYear}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(fy)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        title={t.btnEdit}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {!isClosed && !isDef && (
                        <button
                          type="button"
                          onClick={() => handleDeleteYear(fy.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                          title={t.btnDelete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );

  const closeConfirmModal = closingYearTarget && (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {t.closeConfirmTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {closingYearTarget.title} ({closingYearTarget.startDisplay} تا {closingYearTarget.endDisplay})
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
          {t.closeConfirmDesc}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
            یادداشت و مصوبات اختتامیه دوره
          </label>
          <textarea
            rows="2"
            value={closingNotes}
            onChange={e => setClosingNotes(e.target.value)}
            placeholder={t.closingNotesPlaceholder}
            className="w-full p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden"
          />
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoInitNext}
            onChange={e => setAutoInitNext(e.target.checked)}
            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
          />
          <span className="text-xs font-bold text-sky-900 dark:text-sky-200">
            {t.autoInitNextYearLabel}
          </span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setClosingYearTarget(null)}
            className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleExecuteCloseYear}
            className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <Lock className="w-4 h-4 stroke-[2.2]" />
            <span>{t.btnExecuteClose}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="w-full space-y-5 animate-in fade-in duration-150" dir={direction}>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 shrink-0">
              <CalendarDays className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {t.modalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t.modalSubtitle}
              </p>
            </div>
          </div>
          {mainBody}
        </div>
        {closeConfirmModal}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" dir={direction}>
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl bg-white/45 dark:bg-slate-950/50 backdrop-blur-3xl backdrop-saturate-200 border border-white/70 dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.1)] flex flex-col my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/60 dark:border-white/10 flex items-center justify-between gap-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
              <CalendarDays className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {t.modalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.modalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-all active:scale-95"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {mainBody}
        {closeConfirmModal}
      </div>
    </div>
  );
}
