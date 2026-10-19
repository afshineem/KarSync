import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { 
  Building2, 
  User, 
  Phone, 
  Coins, 
  FolderPlus, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2,
  Sparkles,
  Check,
  Briefcase,
  Layers,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

export function OnboardingModal() {
  const { t, language, direction } = useLanguage();
  const { user, completeOnboarding } = useAuth();
  const { createProject } = useProject();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1: Workspace & Profile
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('IQD');

  // Step 2: First Project
  const [projectName, setProjectName] = useState('');
  const [standardWorkHours, setStandardWorkHours] = useState(8);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.0);

  const currencies = [
    { 
      code: 'IQD', 
      label: t('iqdCurrency') || (language === 'ku' ? 'دیناری عێراقی (IQD)' : language === 'fa' ? 'دینار عراق (IQD)' : 'Iraqi Dinar (IQD)'), 
      symbol: 'د.ع',
      desc: language === 'ku' ? 'دراوی بنەڕەتی هەرێمی کوردستان و عێراق' : language === 'fa' ? 'ارز رایج اقلیم کردستان و عراق' : 'Primary currency in Iraq & Kurdistan'
    },
    { 
      code: 'IRT', 
      label: t('irtCurrency') || (language === 'ku' ? 'تۆمەنی ئێران (IRT)' : language === 'fa' ? 'تومان ایران (IRT)' : 'Iranian Toman (IRT)'), 
      symbol: 'تومان',
      desc: language === 'ku' ? 'تۆمەنی ئێران بۆ پڕۆژە هاوبەشەکان' : language === 'fa' ? 'تومان ایران برای پروژه‌های داخلی' : 'Iranian Toman'
    },
    { 
      code: 'USD', 
      label: t('usdCurrency') || (language === 'ku' ? 'دۆلاری ئەمریکی (USD)' : language === 'fa' ? 'دلار آمریکا (USD)' : 'US Dollar (USD)'), 
      symbol: '$',
      desc: language === 'ku' ? 'دراوی نێودەوڵەتی و بازرگانی' : language === 'fa' ? 'ارز بین‌المللی و بازرگانی' : 'International currency'
    }
  ];

  const handleNext = (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMsg(t('companyNameRequired') || (language === 'ku' ? 'ناوی کارگە یان کۆمپانیا پێویستە' : language === 'fa' ? 'نام شرکت یا کارگاه الزامی است' : 'Company or workshop name is required'));
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setErrorMsg(t('projectNameRequired') || (language === 'ku' ? 'ناوی پڕۆژە پێویستە' : language === 'fa' ? 'نام پروژه الزامی است' : 'Project name is required'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Create first project
      await createProject({
        name: projectName.trim(),
        currency: defaultCurrency,
        standardWorkHours: Number(standardWorkHours) || 8,
        overtimeMultiplier: Number(overtimeMultiplier) || 1.0
      });

      // 2. Complete onboarding profile
      await completeOnboarding({
        companyName: companyName.trim(),
        fullName: fullName.trim() || user?.name,
        phone: phone.trim(),
        defaultCurrency
      });
    } catch (err) {
      console.error('Onboarding error:', err);
      setErrorMsg(err.message || t('onboardingError') || (language === 'ku' ? 'هەڵە لە تەواوکردنی ڕێکخستنی سەرەتایی' : language === 'fa' ? 'خطا در تکمیل فرآیند راه‌اندازی' : 'Error completing onboarding'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200 select-none"
      dir={direction}
    >
      {/* دیالوگ شیشه‌ای پرچمدار در مرکز صفحه */}
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-[#f3f6f4]/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.35)] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ۱. هیرو هدر خوش‌آمدگویی Apple Liquid Glass */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white p-5 sm:p-7 border-b border-slate-800/80 shrink-0">
          {/* اورب‌های نورانی امبینت */}
          <div className="absolute -top-12 -end-12 w-48 h-48 bg-sky-500/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -start-8 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 shrink-0 border border-white/20">
                <Sparkles className="w-6 h-6 animate-pulse text-sky-100 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-sky-300 border border-white/10 text-[10px] font-black uppercase tracking-wider mb-1">
                  <Zap className="w-3 h-3 text-sky-400" />
                  <span>KarSync SaaS</span>
                </div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white truncate">
                  {t('welcomeToKarSync') || (language === 'ku' ? 'بەخێربێن بۆ سیستەمی بازرگانی KarSync' : language === 'fa' ? 'به سامانه تجاری KarSync خوش آمدید' : 'Welcome to KarSync SaaS')}
                </h1>
                <p className="text-xs text-slate-300/90 font-medium mt-0.5 line-clamp-1">
                  {t('onboardingIntro') || (language === 'ku' ? 'تەنها ٢ هەنگاو ماوە بۆ ڕێکخستنی شوێنی کار و یەکەمین پڕۆژەتان.' : language === 'fa' ? 'تنها ۲ مرحله تا راه‌اندازی کامل فضای کاری و نخستین پروژه شما باقی مانده است.' : 'Only 2 steps away from launching your workspace and first project.')}
                </p>
              </div>
            </div>

            {/* کنترل کپسولی استپر دو مرحله‌ای با تم برنامه [APP_THEME_BUTTON] */}
            <div className="inline-flex items-center p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 self-start sm:self-center shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                step === 1 
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' 
                  : 'text-slate-300'
              }`}>
                <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-mono">1</span>
                <span>{t('stepWorkspace') || (language === 'ku' ? 'زانیاری کارگە' : language === 'fa' ? 'مشخصات کارگاه' : 'Workspace')}</span>
              </div>

              <div className="w-4 h-0.5 bg-white/20 mx-1 rounded-full" />

              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                step === 2 
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' 
                  : 'text-slate-300'
              }`}>
                <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-mono">2</span>
                <span>{t('stepProject') || (language === 'ku' ? 'پڕۆژەی یەکەم' : language === 'fa' ? 'پروژه نخست' : 'Project')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ۲. محتوای اسکرول‌پذیر فرم درون کارت‌های Apple Glass */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 && (
            <form id="onboarding-step1-form" onSubmit={handleNext} className="space-y-4">
              
              {/* کارت مشخصات سازمان و کارگاه */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-black text-sky-600 dark:text-sky-400 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <Building2 className="w-4 h-4" />
                  <span>{language === 'ku' ? 'پێناسەی شوێنی کار و کۆمپانیا' : language === 'fa' ? 'مشخصات سازمان و کارگاه' : 'Workspace Information'}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('companyOrWorkshopName') || (language === 'ku' ? 'ناوی کارگە یان کۆمپانیا' : language === 'fa' ? 'نام شرکت یا کارگاه' : 'Company or Workshop Name')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={t('companyPlaceholder') || (language === 'ku' ? 'وەک: کارگەی ئاسنگەری و دارتاشی زاگرۆس' : language === 'fa' ? 'مثلاً: کارگاه صنایع فلزی زاگرس' : 'e.g., Zagros Steel Works')}
                      className="w-full ps-10 pe-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('managerFullName') || (language === 'ku' ? 'ناوی بەڕێوەبەر' : language === 'fa' ? 'نام و نام‌خانوادگی مدیر' : 'Manager Full Name')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t('managerNamePlaceholder') || (language === 'ku' ? 'ئەفشین زارعی' : language === 'fa' ? 'افشین زارعی' : 'Afshin Zarei')}
                        className="w-full ps-10 pe-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('phoneNumber') || (language === 'ku' ? 'ژمارەی مۆبایل' : language === 'fa' ? 'شماره تماس' : 'Phone Number')}
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t('phonePlaceholder') || (language === 'ku' ? 'وەک: ٠٧٥٠... / ٠٩١٨...' : language === 'fa' ? 'مثال: ۰۹۱۸... / ۰۷۵۰...' : '+964 750 ... / 0918 ...')}
                        className="w-full ps-10 pe-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition-all shadow-inner text-left font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* کارت انتخاب ارز مرجع کارگاه */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-black text-sky-600 dark:text-sky-400">
                    <Coins className="w-4 h-4" />
                    <span>{t('defaultWorkspaceCurrency') || (language === 'ku' ? 'دراوی بنەڕەتی کارگە' : language === 'fa' ? 'ارز پیش‌فرض کارگاه' : 'Default Workspace Currency')}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {language === 'ku' ? 'دواییش دەگۆڕدرێت' : language === 'fa' ? 'قابل تغییر در تنظیمات' : 'Changeable anytime'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {currencies.map((c) => {
                    const isSelected = defaultCurrency === c.code;
                    return (
                      <button
                        type="button"
                        key={c.code}
                        onClick={() => setDefaultCurrency(c.code)}
                        className={`p-3.5 rounded-2xl border text-start transition-all duration-300 relative cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-400/80 dark:border-sky-700 shadow-sm shadow-sky-500/10 ring-2 ring-sky-500/20'
                            : 'bg-white/60 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-900 dark:text-white font-mono">
                            {c.code}
                          </span>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all ${
                            isSelected 
                              ? 'bg-sky-500 text-white shadow-xs' 
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                          }`}>
                            {isSelected ? <Check className="w-3 h-3 stroke-[2.5]" /> : c.symbol}
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                            {c.label}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                            {c.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </form>
          )}

          {step === 2 && (
            <form id="onboarding-step2-form" onSubmit={handleComplete} className="space-y-4">
              
              {/* کارت تعریف اولین پروژه */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-black text-sky-600 dark:text-sky-400 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <FolderPlus className="w-4 h-4" />
                  <span>{language === 'ku' ? 'پێناسەی یەکەمین پڕۆژە' : language === 'fa' ? 'مشخصات اولین پروژه کارگاه' : 'First Project Setup'}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('firstProjectName') || (language === 'ku' ? 'ناوی یەکەمین پڕۆژە یان لق' : language === 'fa' ? 'نام اولین پروژه یا شعبه' : 'First Project Name or Site')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FolderPlus className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder={t('projectNamePlaceholder') || (language === 'ku' ? 'وەک: پڕۆژەی ناوەندی کارگە' : language === 'fa' ? 'مثلاً: پروژه مرکزی کارگاه' : 'e.g., Central Workshop Project')}
                      className="w-full ps-10 pe-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* ساعات کار استاندارد و ضریب اضافه‌کاری */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('standardWorkHours') || (language === 'ku' ? 'سەعاتی کاری بنەڕەتی' : language === 'fa' ? 'ساعات کار استاندارد روزانه' : 'Standard Work Hours')}
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="number"
                        min="1"
                        max="24"
                        step="0.5"
                        value={standardWorkHours}
                        onChange={(e) => setStandardWorkHours(e.target.value)}
                        className="w-full ps-10 pe-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition-all shadow-inner font-mono"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {t('workHoursHint') || (language === 'ku' ? 'بە گشتی ٨ کاتژمێر لە ڕۆژێکدا' : language === 'fa' ? 'معمولاً ۸ ساعت در روز' : 'Standard 8 hours per day')}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('overtimeMultiplier') || (language === 'ku' ? 'زەریبی ئۆڤەرتایم' : language === 'fa' ? 'ضریب اضافه‌کاری' : 'Overtime Multiplier')}
                    </label>
                    <div className="relative">
                      <TrendingUp className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                      <select
                        value={overtimeMultiplier}
                        onChange={(e) => setOvertimeMultiplier(Number(e.target.value))}
                        className="w-full ps-10 pe-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition-all shadow-inner cursor-pointer"
                      >
                        <option value={1.0}>1.0x ({t('rateStandard') || (language === 'ku' ? 'ئاسایی' : language === 'fa' ? 'عادی' : 'Standard')})</option>
                        <option value={1.25}>1.25x (+25%)</option>
                        <option value={1.5}>1.5x ({t('rateOvertime15') || (language === 'ku' ? '١.٥ ئەوەندە' : language === 'fa' ? '۱.۵ برابر' : '1.5x')})</option>
                        <option value={2.0}>2.0x ({t('rateDouble') || (language === 'ku' ? '٢ ئەوەندە' : language === 'fa' ? '۲ برابر' : '2.0x')})</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {t('multiplierHint') || (language === 'ku' ? 'زەریبی حیسابکردنی کرێی کاتژمێری ئۆڤەرتایم' : language === 'fa' ? 'ضریب محاسبه دستمزد ساعتی اضافه‌کار' : 'Rate multiplier for extra hours')}
                    </span>
                  </div>
                </div>
              </div>

              {/* کارت راهنمای امنیت و آفلاین Dexie */}
              <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/60 flex items-start gap-2.5 text-xs text-sky-800 dark:text-sky-200">
                <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  {language === 'ku' 
                    ? 'داتاکانی پڕۆژە لەسەر ئامێرەکەت بە شێوازی سەرهێڵ و ئۆفلاین (Local DB) دەپارێزرێن و دەستبەجێ لەگەڵ سێرڤەری هەوری هاوکات دەبن.' 
                    : language === 'fa' 
                    ? 'تمامی داده‌ها به صورت کاملاً آفلاین روی دیتابیس محلی ذخیره شده و به محض اتصال اینترنت با فضای ابری همگام می‌گردند.' 
                    : 'Your workspace data is safely stored in local offline DB and synchronizes seamlessly with the cloud.'}
                </p>
              </div>

            </form>
          )}

        </div>

        {/* ۳. فوتر داک شیشه‌ای چسبیده (Sticky Glass Action Dock) */}
        <div className="px-5 sm:px-6 py-3.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold font-mono">
            <span>{language === 'ku' ? 'هەنگاو' : language === 'fa' ? 'مرحله' : 'Step'} {step} / 2</span>
          </div>

          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                {t('back') || (language === 'ku' ? 'گەڕانەوە' : language === 'fa' ? 'بازگشت' : 'Back')}
              </button>
            )}

            {step === 1 ? (
              <button
                type="submit"
                form="onboarding-step1-form"
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <span>{t('continueToStep2') || (language === 'ku' ? 'هەنگاوی دووەم: دروستکردنی پڕۆژە' : language === 'fa' ? 'مرحله بعد: ایجاد پروژه' : 'Next: Setup Project')}</span>
                {direction === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="submit"
                form="onboarding-step2-form"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('finishAndStart') || (language === 'ku' ? 'تەواوکردن و دەستپێکردن' : language === 'fa' ? 'تکمیل و شروع به کار' : 'Complete & Start')}</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
