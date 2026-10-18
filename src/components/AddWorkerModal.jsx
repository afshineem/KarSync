import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db, generateId, DEFAULT_PROJECT_ID } from '../db/db';
import { pushWorkerLive } from '../services/realtimeSync';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatCurrency } from '../utils/formatters';
import { 
  X, 
  UserPlus, 
  UserCheck,
  Users, 
  Layers, 
  Key, 
  AlertCircle, 
  CheckCircle2, 
  Briefcase, 
  Phone, 
  Coins, 
  Clock,
  Sparkles,
  ShieldCheck,
  User,
  Calculator,
  Eye,
  EyeOff,
  Building2,
  CalendarCheck
} from 'lucide-react';

const COMMON_ROLES = [
  'استادکار',
  'جوشکار',
  'بنا',
  'آرماتوربند',
  'قالب‌بند',
  'سیم‌کش / برقکار',
  'لوله‌کش',
  'گچ‌کار',
  'نقاش',
  'راننده / اپراتور',
  'کارگر ساده'
];

const QUICK_DAILY_RATES_IQD = [
  { label: '۲۵ هزار', val: 25000 },
  { label: '۳۰ هزار', val: 30000 },
  { label: '۳۵ هزار', val: 35000 },
  { label: '۴۰ هزار', val: 40000 },
  { label: '۵۰ هزار', val: 50000 },
  { label: '۶۰ هزار', val: 60000 },
];

// Scoped dictionary for AddWorkerModal
const COPY = {
  fa: {
    rolePresets: ['استادکار', 'جوشکار', 'بنا', 'آرماتوربند', 'قالب‌بند', 'سیم‌کش / برقکار', 'لوله‌کش', 'گچ‌کار', 'نقاش', 'راننده / اپراتور', 'کارگر ساده'],
    quickRates: [
      { label: '۲۵ هزار', val: 25000 },
      { label: '۳۰ هزار', val: 30000 },
      { label: '۳۵ هزار', val: 35000 },
      { label: '۴۰ هزار', val: 40000 },
      { label: '۵۰ هزار', val: 50000 },
      { label: '۶۰ هزار', val: 60000 }
    ],
    errNameRequired: 'نام و نام خانوادگی الزامی است',
    errRatesPositive: 'مقادیر دستمزد و اضافه‌کاری باید عددی معتبر و مثبت باشند',
    errSaveWorker: 'خطا در ثبت مشخصات پرسنل',
    editTitle: 'ویرایش پرونده پرسنل',
    createTitle: 'تعریف پرسنل / کارگر جدید',
    projectFallback: 'پروژه فعال',
    badgeActiveStatus: 'شاغل / فعال',
    badgeInactiveStatus: 'غیرفعال',
    subtitle: 'مشخصات هویتی، قرارداد کار، دستمزد روزانه، تعیین گروه کاری و دسترسی پورتال',
    closeEsc: 'بستن (ESC)',
    close: 'بستن',
    secIdentity: 'اطلاعات هویتی و ارتباطی',
    lblFullName: 'نام و نام خانوادگی',
    phFullName: 'ئاراس ئەحمەد / علی رضایی',
    lblPhone: 'شماره موبایل تماس',
    lblRole: 'عنوان شغل و مهارت تخصصی',
    phRole: 'استادکار بنا / جوشکار اسکلت / آرماتوربند',
    quickSuggestion: 'پیشنهاد سریع:',
    statusTitle: '{txt.statusTitle}',
    statusDesc: '{txt.statusDesc}',
    statusActiveLabel: 'فعال (شاغل)',
    statusInactiveLabel: 'غیرفعال (مرخص شده)',
    secWages: 'سیستم دستمزد و نرخ کارکرد',
    wageDaily: '{txt.wageDaily}',
    wageContract: '{txt.wageContract}',
    contractBannerTitle: 'پرسنل به صورت کنتراکت (توافقی) تعریف شده است',
    contractBannerDesc: '{txt.contractBannerDesc}',
    lblDailyRate: 'نرخ دستمزد یک روز کامل',
    unitPrefix: 'واحد:',
    commonAmounts: 'مبالغ رایج:',
    lblOvertimeRate: 'نرخ هر ساعت اضافه‌کاری',
    autoCalcTitle: 'محاسبه نرخ بر مبنای تقسیم مزد روزانه به ۸ ساعت کار',
    autoCalcBtn: 'محاسبه خودکار (پایه ۸ ساعت)',
    secOrg: 'گروه کاری و سازماندهی در کارگاه',
    lblWorkGroup: 'گروه کاری',
    optNoGroup: 'بدون گروه (انفرادی / عمومی)',
    lblRoleInTeam: 'نقش در تیم',
    roleWorker: '{txt.roleWorker}',
    roleMaster: '{txt.roleMaster}',
    lblDefaultSection: 'بخش کاری پیش‌فرض',
    lblOptional: 'اختیاری',
    optNoSection: 'بدون بخش مشخص (عمومی کارگاه)',
    secPortal: 'دسترسی اختصاصی پورتال پرسنل',
    portalSub: 'ورود مستقیم به پنل کارکرد',
    lblUsername: 'نام کاربری',
    lblPassword: 'کلمه عبور اختصاصی',
    previewCardTitle: 'پیش‌نمایش زنده کارت پرسنل',
    badgeActiveShort: 'شاغل',
    badgeInactiveShort: 'غیرفعال',
    nameFallback: 'نام و نام خانوادگی',
    roleFallback: 'عنوان تخصص / مهارت',
    financialEstimateTitle: '{txt.financialEstimateTitle}',
    lblContractType: 'نوع قرارداد:',
    contractContractType: 'کنتراکت / مقاطعه‌کاری',
    contractDailyType: 'مزد روزانه عادی',
    lblPreviewDailyRate: 'دستمزد روزانه:',
    valAgreed: 'توافقی',
    lblPreviewOvertime: 'نرخ اضافه کاری:',
    perHour: '/ ساعت',
    lblEstimate30Days: 'برآورد ۳۰ روز کارکرد:',
    cloudSyncTitle: 'یکپارچگی و همگام‌سازی ابری',
    cloudSyncDesc: '{txt.cloudSyncDesc}',
    selectedWorker: 'پرسنل انتخابی:',
    defining: 'در حال تعریف...',
    dockWage: '• دستمزد:',
    btnCancel: 'انصراف (ESC)',
    saving: 'در حال ثبت...',
    btnSaveEdit: 'ذخیره تغییرات پرسنل',
    btnSaveCreate: 'ثبت و صدور پرونده پرسنل'
  },
  ku: {
    rolePresets: ['وەستا', 'لەحیمچی', 'وەستای دیوار', 'شیشبەند', 'قاڵبەند', 'کارەباچی', 'بۆریچی', 'پلاگینچی', 'بۆیۆچی', 'شۆفێر', 'کرێکاری سادە'],
    quickRates: [
      { label: '۲۵ هەزار', val: 25000 },
      { label: '۳۰ هەزار', val: 30000 },
      { label: '۳۵ هەزار', val: 35000 },
      { label: '۴۰ هەزار', val: 40000 },
      { label: '۵۰ هەزار', val: 50000 },
      { label: '۶۰ هەزار', val: 60000 }
    ],
    errNameRequired: 'ناوی تەواو پێویستە',
    errRatesPositive: 'حەقدەست و زیادەکاری دەبێت ژمارەی پۆزەتیڤ بن',
    errSaveWorker: 'هەڵە لە تۆمارکردنی زانیاری کارمەند',
    editTitle: 'دەستکاریکردنی پەڕگەی کرێکار',
    createTitle: 'زیادکردنی کرێکاری نوێ',
    projectFallback: 'پڕۆژەی چالاک',
    badgeActiveStatus: 'چالاک',
    badgeInactiveStatus: 'ناچالاک',
    subtitle: 'زانیاری تاکەکەسی، شێوازی کرێ، گرووپ و زانیاری چوونەژوورەوە',
    closeEsc: 'داخستن (ESC)',
    close: 'داخستن',
    secIdentity: 'زانیاری تاکەکەسی و پەیوەندی',
    lblFullName: 'ناوی تەواو',
    phFullName: 'ئاراس ئەحمەد / علی رضایی',
    lblPhone: 'ژمارەی مۆبایل',
    lblRole: 'پلە و پیشەی تایبەتمەند',
    phRole: 'وەستای دیوار / لەحیمچی / شیشبەند',
    quickSuggestion: 'پێشنیاری خێرا:',
    statusTitle: 'دۆخی چالاکی کارمەند لە کارگە',
    statusDesc: 'کرێکارانی ناچالاک لە لیستی ڕۆژانەدا شاراوە دەبن.',
    statusActiveLabel: 'چالاک',
    statusInactiveLabel: 'ناچالاک (مۆڵەتپێدراو)',
    secWages: 'جۆری کرێ و پارە',
    wageDaily: 'حەقدەستی ڕۆژانە',
    wageContract: 'کۆنتراکت (پەیمانکاری)',
    contractBannerTitle: 'کرێکار بە شێوەی کۆنتراکت دیاریکراوە',
    contractBannerDesc: 'بۆ کرێکارانی کۆنتراکت، کرێی ڕۆژانە و زیادەکاری بە صفر ئەژمار دەکرێت و پارەکەی بەپێی ڕێککەوتن دەدرێت.',
    lblDailyRate: 'حەقدەستی یەک ڕۆژی تەواو',
    unitPrefix: 'دراو:',
    commonAmounts: 'بڕە باوەکان:',
    lblOvertimeRate: 'کرێی هەر کاتژمێرێک زیادەکاری',
    autoCalcTitle: 'ئەژمارکردن بەپێی دابەشکردنی حەقدەستی ڕۆژانە بەسەر ٨ کاتژمێر',
    autoCalcBtn: 'ئەژمارکردنی خۆکار (بناغەی ٨ کاتژمێر)',
    secOrg: 'گرووپ و ڕێکخستن',
    lblWorkGroup: 'گرووپی کار',
    optNoGroup: 'بێ گرووپ (ئازاد / گشتی)',
    lblRoleInTeam: 'ڕۆڵ لە تیم',
    roleWorker: 'کرێکاری ئاسایی',
    roleMaster: 'وەستا / سەرپەرشتیار',
    lblDefaultSection: 'بەشی کاری بنەڕەتی',
    lblOptional: 'ئارەزوومەندانە',
    optNoSection: 'بێ بەشی دیاریکراو (گشتی)',
    secPortal: 'چوونەژوورەوەی تایبەت بە پۆرتال',
    portalSub: 'چوونەژوورەوەی ڕاستەوخۆ',
    lblUsername: 'ناوی بەکارهێنەر',
    lblPassword: 'وشەی نهێنی تایبەت',
    previewCardTitle: 'پێشبینینی کارتی کرێکار',
    badgeActiveShort: 'چالاک',
    badgeInactiveShort: 'ناچالاک',
    nameFallback: 'ناوی تەواو',
    roleFallback: 'پلە / پیشە',
    financialEstimateTitle: 'خەمڵاندنی دارایی',
    lblContractType: 'جۆری پەیماننامە:',
    contractContractType: 'کۆنتراکت / پەیمانکاری',
    contractDailyType: 'حەقدەستی ڕۆژانەی ئاسایی',
    lblPreviewDailyRate: 'حەقدەستی ڕۆژانە:',
    valAgreed: 'ڕێککەوتن',
    lblPreviewOvertime: 'حەقدەستی زیادەکاری:',
    perHour: '/ کاتژمێر',
    lblEstimate30Days: 'خەمڵاندنی ٣٠ ڕۆژ کار:',
    cloudSyncTitle: 'هاوکاتکردنی کلاود',
    cloudSyncDesc: 'زانیارییەکان بە شێوەی ئۆفلاین پاشەکەوت دەکرێن و بە گەڕانەوەی ئینتەرنێت هاوکات دەبن.',
    selectedWorker: 'کرێکاری دیاریکراو:',
    defining: 'لە پێناسەکردندا...',
    dockWage: '• حەقدەست:',
    btnCancel: 'پاشگەزبوونەوە (ESC)',
    saving: 'تۆماردەکرێت...',
    btnSaveEdit: 'پاشەکەوتکردنی گۆڕانکارییەکان',
    btnSaveCreate: 'تۆمارکردنی کرێکار'
  },
  en: {
    rolePresets: ['Master Craftsman', 'Welder', 'Mason', 'Rebar Tier', 'Formworker', 'Electrician', 'Plumber', 'Plasterer', 'Painter', 'Driver / Operator', 'General Laborer'],
    quickRates: [
      { label: '25k', val: 25000 },
      { label: '30k', val: 30000 },
      { label: '35k', val: 35000 },
      { label: '40k', val: 40000 },
      { label: '50k', val: 50000 },
      { label: '60k', val: 60000 }
    ],
    errNameRequired: 'Full name is required',
    errRatesPositive: 'Wage and overtime rates must be valid positive numbers',
    errSaveWorker: 'Error saving personnel details',
    editTitle: 'Edit Personnel File',
    createTitle: 'Register New Worker',
    projectFallback: 'Active Project',
    badgeActiveStatus: 'Active',
    badgeInactiveStatus: 'Inactive',
    subtitle: 'Identity, wage contract, daily rates, team assignment, and portal access',
    closeEsc: 'Close (ESC)',
    close: 'Close',
    secIdentity: 'Identity & Contact Information',
    lblFullName: 'Full Name',
    phFullName: 'John Doe / Ali Rezaei',
    lblPhone: 'Phone Number',
    lblRole: 'Job Title & Specialty',
    phRole: 'Master Mason / Welder / Rebar Tier',
    quickSuggestion: 'Quick Suggestions:',
    statusTitle: 'Workshop Activity Status',
    statusDesc: 'Inactive workers are hidden from the daily attendance logging list.',
    statusActiveLabel: 'Active',
    statusInactiveLabel: 'Inactive (Dismissed)',
    secWages: 'Wage System & Working Rates',
    wageDaily: 'Daily Wage',
    wageContract: 'Contract (Piecework)',
    contractBannerTitle: 'Worker is designated as Contract / Agreed',
    contractBannerDesc: 'For contract workers, daily wage and hourly overtime are set to zero, and payments are logged via contracts or settlements.',
    lblDailyRate: 'Full Day Wage Rate',
    unitPrefix: 'Currency:',
    commonAmounts: 'Common Rates:',
    lblOvertimeRate: 'Hourly Overtime Rate',
    autoCalcTitle: 'Calculate rate by dividing daily wage by 8 hours',
    autoCalcBtn: 'Auto Calculate (8-Hour Basis)',
    secOrg: 'Work Team & Workshop Organization',
    lblWorkGroup: 'Work Team',
    optNoGroup: 'No Group (Individual / General)',
    lblRoleInTeam: 'Role in Team',
    roleWorker: 'Regular Worker',
    roleMaster: 'Master Craftsman / Foreman',
    lblDefaultSection: 'Default Work Section',
    lblOptional: 'Optional',
    optNoSection: 'No Specific Section (General)',
    secPortal: 'Personnel Dedicated Portal Access',
    portalSub: 'Direct access to worker dashboard',
    lblUsername: 'Username',
    lblPassword: 'Dedicated Password',
    previewCardTitle: 'Live Personnel Card Preview',
    badgeActiveShort: 'Active',
    badgeInactiveShort: 'Inactive',
    nameFallback: 'Full Name',
    roleFallback: 'Role / Specialty',
    financialEstimateTitle: 'Financial Estimate & Rates',
    lblContractType: 'Contract Type:',
    contractContractType: 'Contract / Piecework',
    contractDailyType: 'Regular Daily Wage',
    lblPreviewDailyRate: 'Daily Wage:',
    valAgreed: 'Agreed',
    lblPreviewOvertime: 'Overtime Rate:',
    perHour: '/ hour',
    lblEstimate30Days: 'Estimated 30-Day Pay:',
    cloudSyncTitle: 'Cloud Sync & Integrity',
    cloudSyncDesc: 'Personnel data is saved offline and synchronizes with cloud database in real-time when connected.',
    selectedWorker: 'Selected Worker:',
    defining: 'Registering...',
    dockWage: '• Wage:',
    btnCancel: 'Cancel (ESC)',
    saving: 'Saving...',
    btnSaveEdit: 'Save Changes',
    btnSaveCreate: 'Register Personnel'
  }
};

export function AddWorkerModal({ isOpen, onClose, workerToEdit = null, onSuccess }) {
  const { t, language, direction } = useLanguage();
  const txt = COPY[language] || COPY.fa;
  const POPULAR_ROLES = txt.rolePresets;
  const QUICK_DAILY_RATES = txt.quickRates;
  const { user, setWorkerCredentials, getWorkerCredentialsMap } = useAuth();
  const { currentProject, currency = 'IQD' } = useProject();

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

  const [showPassword, setShowPassword] = useState(false);
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
      setShowPassword(false);
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

  const selectedGroup = useMemo(() => {
    return groups.find(g => String(g.id) === String(formData.groupId));
  }, [groups, formData.groupId]);

  const selectedSection = useMemo(() => {
    return projectSections.find(s => String(s.id) === String(formData.defaultSectionId));
  }, [projectSections, formData.defaultSectionId]);

  // محاسبات برآوردی
  const numericDailyRate = formData.wageType === 'contract' ? 0 : (Number(formData.dailyRate) || 0);
  const numericOvertimeRate = formData.wageType === 'contract' ? 0 : (Number(formData.overtimeHourlyRate) || 0);
  const estimatedMonthlySalary = numericDailyRate * 30;

  // محاسبه خودکار نرخ اضافه کاری بر مبنای ۸ ساعت کار استاندارد
  const handleAutoCalculateOvertime = () => {
    if (numericDailyRate > 0) {
      // فرمول رایج: (دستمزد روزانه تقسیم بر ۸ ساعت) × ۱.۲۵ یا گرد شده
      const hourlyBase = Math.round(numericDailyRate / 8);
      setFormData(prev => ({ ...prev, overtimeHourlyRate: String(hourlyBase) }));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError(txt.errNameRequired);
      return;
    }

    const isContract = formData.wageType === 'contract';
    const dailyRate = isContract ? 0 : Number(formData.dailyRate);
    const overtimeRate = isContract ? 0 : Number(formData.overtimeHourlyRate);

    if (isNaN(dailyRate) || dailyRate < 0 || isNaN(overtimeRate) || overtimeRate < 0) {
      setFormError(txt.errRatesPositive);
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
        await db.workers.put(updatedWorker);
        await pushWorkerLive(updatedWorker);
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
      setFormError(err.message || txt.errSaveWorker);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[110] bg-slate-900/60 backdrop-blur-md flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Header: Apple Liquid Glass Identity Banner                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 shadow-xs z-20">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              {workerToEdit ? (
                <UserCheck className="w-5.5 h-5.5 stroke-[2.2]" />
              ) : (
                <UserPlus className="w-5.5 h-5.5 stroke-[2.2]" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {workerToEdit ? txt.editTitle : txt.createTitle}
                </h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                  {currentProject?.name || txt.projectFallback}
                </span>
                {workerToEdit && (
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    formData.isActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60'
                  }`}>
                    {formData.isActive ? txt.badgeActiveStatus : txt.badgeInactiveStatus}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
                {txt.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shrink-0"
            title={txt.closeEsc}
            aria-label={txt.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Scrollable Body: Responsive 12-Column Layout               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#f3f6f4] dark:bg-slate-950 pb-28">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
          
          <form id="add-worker-form" onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-3 shadow-xs animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* ───────────────────────────────────────────────────────────── */}
              {/* ستون راست (۷ ستون): فرم ورودی و کارت‌های تنظیمات              */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-7 space-y-5">

                {/* کارت ۱: اطلاعات هویتی و ارتباطی */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <User className="w-4.5 h-4.5 text-sky-500" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      {txt.secIdentity}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* نام و نام خانوادگی */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {txt.lblFullName} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={txt.phFullName}
                        className="w-full px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:outline-none transition-all"
                      />
                    </div>

                    {/* شماره موبایل */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {txt.lblPhone}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          dir="ltr"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="0750 123 4567"
                          className="w-full px-4 py-2.5 ps-10 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:outline-none transition-all"
                        />
                        <Phone className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* عنوان شغل / مهارت و چیپ‌های سریع */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {txt.lblRole}
                    </label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder={txt.phRole}
                      className="w-full px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:outline-none transition-all"
                    />

                    {/* چیپ‌های انتخاب سریع تخصص */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400 font-medium me-1">{txt.quickSuggestion}</span>
                      {COMMON_ROLES.slice(0, 6).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, role }))}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                            formData.role === role
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* وضعیت فعال بودن (در صورت ویرایش) */}
                  {workerToEdit && (
                    <div className="pt-2 flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {txt.statusTitle}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {txt.statusDesc}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isActive: prev.isActive ? 0 : 1 }))}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          formData.isActive
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-rose-500 text-white shadow-xs'
                        }`}
                      >
                        {formData.isActive ? txt.statusActiveLabel : txt.statusInactiveLabel}
                      </button>
                    </div>
                  )}
                </div>

                {/* کارت ۲: شرایط مالی و سیستم دستمزد */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4.5 h-4.5 text-amber-500" />
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                        {txt.secWages}
                      </span>
                    </div>

                    {/* سگمنت نوع دستمزد (عادی / کنتراکت) */}
                    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, wageType: 'standard' }))}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          formData.wageType === 'standard'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {txt.wageDaily}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, wageType: 'contract' }))}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          formData.wageType === 'contract'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {txt.wageContract}
                      </button>
                    </div>
                  </div>

                  {formData.wageType === 'contract' ? (
                    <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black mb-0.5">{txt.contractBannerTitle}</strong>
                        {txt.contractBannerDesc}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* دستمزد روزانه */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {txt.lblDailyRate} <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[11px] font-mono text-slate-400">
                            {txt.unitPrefix} {currency}
                          </span>
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="500"
                            required
                            value={formData.dailyRate}
                            onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                            className="w-full px-4 py-2.5 ps-10 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none transition-all"
                          />
                          <Coins className="w-4.5 h-4.5 text-amber-500 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* چیپ‌های مبالغ سریع متداول */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[11px] text-slate-400 font-medium me-1">{txt.commonAmounts}</span>
                          {QUICK_DAILY_RATES_IQD.map((chip) => (
                            <button
                              key={chip.val}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, dailyRate: String(chip.val) }))}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono transition-all cursor-pointer ${
                                String(formData.dailyRate) === String(chip.val)
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* نرخ اضافه‌کاری ساعتی */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {txt.lblOvertimeRate} <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleAutoCalculateOvertime}
                            className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                            title={txt.autoCalcTitle}
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>{txt.autoCalcBtn}</span>
                          </button>
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="250"
                            required
                            value={formData.overtimeHourlyRate}
                            onChange={(e) => setFormData({ ...formData, overtimeHourlyRate: e.target.value })}
                            className="w-full px-4 py-2.5 ps-10 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:outline-none transition-all"
                          />
                          <Clock className="w-4.5 h-4.5 text-sky-500 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* کارت ۳: گروه کاری و بخش پیش‌فرض پروژه */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <Briefcase className="w-4.5 h-4.5 text-indigo-500" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      {txt.secOrg}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* انتخاب گروه کاری */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {txt.lblWorkGroup}
                      </label>
                      <select
                        value={formData.groupId || ''}
                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none cursor-pointer transition-all"
                      >
                        <option value="">{txt.optNoGroup}</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* نقش در گروه */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {txt.lblRoleInTeam}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, teamRole: 'Worker' }))}
                          className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                            formData.teamRole === 'Worker'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-slate-700/70'
                          }`}
                        >
                          {txt.roleWorker}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, teamRole: 'Master' }))}
                          className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                            formData.teamRole === 'Master'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-slate-700/70'
                          }`}
                        >
                          {txt.roleMaster}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* بخش کاری پیش‌فرض پروژه (در صورت وجود) */}
                  {projectSections.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-sky-500" />
                          <span>{txt.lblDefaultSection}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">({txt.lblOptional})</span>
                      </label>
                      <select
                        value={formData.defaultSectionId || ''}
                        onChange={(e) => setFormData({ ...formData, defaultSectionId: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:outline-none cursor-pointer transition-all"
                      >
                        <option value="">{txt.optNoSection}</option>
                        {projectSections.map((sec) => (
                          <option key={sec.id} value={sec.id}>{sec.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* کارت ۴: دسترسی اختصاصی پورتال پرسنل */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Key className="w-4.5 h-4.5 text-emerald-500" />
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                        {txt.secPortal}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{txt.portalSub}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* نام کاربری */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {txt.lblUsername}
                      </label>
                      <input
                        type="text"
                        value={formData.username || ''}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="e.g. feryad"
                        className="w-full px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all font-mono"
                      />
                    </div>

                    {/* کلمه عبور */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {txt.lblPassword}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password || ''}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full px-4 py-2.5 pe-10 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => !p)}
                          className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* ستون چپ (۵ ستون): پیش‌نمایش زنده کارت هویتی و خلاصه مالی       */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-5">

                {/* ۱. پیش‌نمایش زنده کارت شناسایی پرسنل */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white shadow-xl border border-slate-800 relative overflow-hidden space-y-4">
                  {/* اورب نوری پس‌زمینه */}
                  <div className="absolute top-0 end-0 w-44 h-44 bg-sky-500/15 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{txt.previewCardTitle}</span>
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      formData.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {formData.isActive ? txt.badgeActiveShort : txt.badgeInactiveShort}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 relative z-10 pt-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-sky-500/20 shrink-0">
                      {formData.name.trim() ? formData.name.trim().charAt(0) : <User className="w-7 h-7" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-black truncate tracking-tight text-white">
                        {formData.name.trim() || txt.nameFallback}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-sky-300 font-bold">
                          {formData.role.trim() || txt.roleFallback}
                        </span>
                        {selectedGroup && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/10 text-slate-300 border border-white/10">
                            {selectedGroup.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {formData.phone && (
                    <div className="text-xs font-mono text-slate-300 flex items-center gap-2 pt-1 border-t border-white/10 relative z-10" dir="ltr">
                      <Phone className="w-3.5 h-3.5 text-sky-400" />
                      <span>{formData.phone}</span>
                    </div>
                  )}
                </div>

                {/* ۲. کارت پیش‌بینی و محاسبات مالی */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Calculator className="w-4.5 h-4.5 text-amber-500" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      {txt.financialEstimateTitle}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">{txt.lblContractType}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {formData.wageType === 'contract' ? txt.contractContractType : txt.contractDailyType}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">{txt.lblPreviewDailyRate}</span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                        {formData.wageType === 'contract' ? txt.valAgreed : formatCurrency(numericDailyRate, currency, language)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">{txt.lblPreviewOvertime}</span>
                      <span className="font-mono font-black text-sky-600 dark:text-sky-400 text-sm" dir="ltr">
                        {formData.wageType === 'contract' ? '—' : `${formatCurrency(numericOvertimeRate, currency, language)} ${txt.perHour}`}
                      </span>
                    </div>

                    {formData.wageType !== 'contract' && (
                      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                        <span className="text-amber-800 dark:text-amber-300 font-bold">{txt.lblEstimate30Days}</span>
                        <span className="font-mono font-black text-amber-700 dark:text-amber-300 text-sm" dir="ltr">
                          {formatCurrency(estimatedMonthlySalary, currency, language)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ۳. جعبه پیام راهنمای کارگاهی */}
                <div className="p-4 rounded-3xl bg-sky-50/70 dark:bg-sky-950/30 backdrop-blur-md border border-sky-200/70 dark:border-sky-900/40 shadow-xs space-y-1.5 text-xs text-sky-900 dark:text-sky-200">
                  <div className="font-bold flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{txt.cloudSyncTitle}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {txt.cloudSyncDesc}
                  </p>
                </div>

              </div>

            </div>

          </form>

        </div>
      </main>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. Sticky Bottom Action Dock                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <footer className="fixed bottom-0 start-0 end-0 z-30 p-3.5 sm:px-6 lg:px-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] flex items-center justify-between gap-3">
        {/* خلاصه انتخابی */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-slate-400">{txt.selectedWorker}</span>
            <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-xs">
              {formData.name.trim() || txt.defining}
            </span>
          </div>

          {formData.wageType !== 'contract' && numericDailyRate > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 hidden md:inline">{txt.dockWage}</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                {formatCurrency(numericDailyRate, currency, language)}
              </span>
            </div>
          )}
        </div>

        {/* دکمه‌های اکشن */}
        <div className="flex items-center gap-2.5 ms-auto shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 sm:px-5 h-11 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {txt.btnCancel}
          </button>

          <button
            type="submit"
            form="add-worker-form"
            disabled={isSubmitting}
            className="px-6 sm:px-7 h-11 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-black rounded-2xl shadow-md shadow-sky-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{txt.saving}</span>
              </>
            ) : (
              <>
                {workerToEdit ? <CheckCircle2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                <span>
                  {workerToEdit ? txt.btnSaveEdit : txt.btnSaveCreate}
                </span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
