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
  Sparkles
} from 'lucide-react';

export function OnboardingModal() {
  const { t, language } = useLanguage();
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
    { code: 'IQD', label: t('iqdCurrency') || 'دینار عراق (IQD)', symbol: 'د.ع' },
    { code: 'IRT', label: t('irtCurrency') || 'تومان ایران (IRT)', symbol: 'تومان' },
    { code: 'USD', label: t('usdCurrency') || 'دلار آمریکا (USD)', symbol: '$' }
  ];

  const handleNext = (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMsg(t('companyNameRequired') || 'نام شرکت یا کارگاه الزامی است');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setErrorMsg(t('projectNameRequired') || 'نام پروژه الزامی است');
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
      setErrorMsg(err.message || 'Error completing onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/80 backdrop-blur-md animate-fade-in flex items-center justify-center p-0 sm:p-4 print:p-0">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-3xl shadow-2xl max-w-lg w-full transition-all h-[100dvh] sm:h-auto sm:max-h-[85vh] flex-col overflow-y-auto">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-sky-600 to-indigo-700 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="inline-flex p-3 rounded-2xl bg-white/15 backdrop-blur-md shadow-inner mb-3">
            <Sparkles className="w-8 h-8 text-sky-200 animate-pulse" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {t('welcomeToKarSync') || 'به سامانه تجاری KarSync خوش آمدید'}
          </h2>
          <p className="text-xs sm:text-sm text-sky-100/90 mt-1 max-w-sm mx-auto">
            {t('onboardingIntro') || 'تنها ۲ مرحله تا راه‌اندازی کامل فضای کاری و نخستین پروژه شما باقی مانده است.'}
          </p>

          {/* Stepper Progress */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              step === 1 ? 'bg-white text-sky-700 shadow-md' : 'bg-white/20 text-white'
            }`}>
              <span>1</span>
              <span>{t('stepWorkspace') || 'مشخصات کارگاه'}</span>
            </div>
            <div className="w-6 h-0.5 bg-white/30 rounded-full" />
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              step === 2 ? 'bg-white text-sky-700 shadow-md' : 'bg-white/20 text-white'
            }`}>
              <span>2</span>
              <span>{t('stepProject') || 'پروژه نخست'}</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('companyOrWorkshopName') || 'نام کارگاه / سازمان'} *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t('companyPlaceholder') || 'مثلاً: کارگاه صنایع فلزی زاگرس'}
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('managerFullName') || 'نام و نام‌خانوادگی مدیر'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('managerNamePlaceholder') || 'افشین زارعی'}
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('phoneNumber') || 'شماره تماس'}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+964 750 ... / 0918 ..."
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden text-left dir-ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('defaultWorkspaceCurrency') || 'ارز پیش‌فرض کارگاه'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {currencies.map((c) => (
                    <button
                      type="button"
                      key={c.code}
                      onClick={() => setDefaultCurrency(c.code)}
                      className={`py-2.5 px-2 rounded-xl border text-center text-xs font-bold transition-all ${
                        defaultCurrency === c.code
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 shadow-xs ring-2 ring-sky-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div>{c.code}</div>
                      <div className="text-[10px] font-normal opacity-80 mt-0.5">{c.symbol}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md shadow-sky-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <span>{t('continueToStep2') || 'مرحله بعد: ایجاد پروژه'}</span>
                  {language === 'en' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleComplete} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('firstProjectName') || 'نام اولین پروژه یا شعبه'} *
                </label>
                <div className="relative">
                  <FolderPlus className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={t('projectNamePlaceholder') || 'مثلاً: پروژه مرکزی کارگاه'}
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('standardWorkHours') || 'ساعات کار استاندارد'}
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
                      className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    {t('workHoursHint') || 'معمولاً ۸ ساعت در روز'}
                  </span>
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
                      className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    >
                      <option value={1.0}>1.0x ({t('rateStandard') || 'عادی'})</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x ({t('rateOvertime15') || '۱.۵ برابر'})</option>
                      <option value={2.0}>2.0x ({t('rateDouble') || '۲ برابر'})</option>
                    </select>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    {t('multiplierHint') || 'ضریب محاسبه کرێی سەعاتی'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  className="py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-all"
                >
                  {t('back') || 'بازگشت'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{t('finishAndStart') || 'تکمیل و شروع به کار'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
