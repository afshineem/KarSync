import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { evaluatePasswordStrength } from '../utils/passwordSecurity';
import { 
  Lock, 
  User, 
  Mail,
  Building2,
  Eye, 
  EyeOff, 
  AlertCircle, 
  LogIn, 
  UserPlus,
  Check,
  Sun,
  Moon,
  Smartphone,
  KeyRound,
  ShieldCheck,
  Clock,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

export function LoginView({ theme, toggleTheme }) {
  const { login, signUp, completeTwoFactorLogin, getLoginLockStatus } = useAuth();
  const { t, language, changeLanguage, direction } = useLanguage();

  const isRtl = direction === 'rtl';
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup' | '2fa'

  // Sign In Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA Challenge State
  const [totpCode, setTotpCode] = useState('');
  const [isUsingBackup, setIsUsingBackup] = useState(false);

  // Sign Up Form State
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupCompanyName, setSignupCompanyName] = useState('');
  const [signupFullName, setSignupFullName] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate Limiting Lock Countdown
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const status = getLoginLockStatus();
    if (status.isLocked) {
      setRemainingSeconds(status.remainingSeconds);
    }
  }, []);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingSeconds]);

  const formatLockTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (remainingSeconds > 0) {
      setErrorMessage(
        langKey === 'fa'
          ? `حساب موقتاً قفل است. لطفاً ${formatLockTime(remainingSeconds)} دیگر صبر کنید.`
          : langKey === 'ku'
          ? `هەژمارەکە قفڵ کراوە. تکایە ${formatLockTime(remainingSeconds)} چاوەڕێ بکە.`
          : `Account locked. Please wait ${formatLockTime(remainingSeconds)}.`
      );
      return;
    }

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage(t('invalidCredentials') || 'لطفاً نام کاربری/ایمیل و رمز عبور را وارد کنید');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(identifier, password);
      if (!res.success) {
        if (res.error === 'rateLimited') {
          setRemainingSeconds(res.remainingSeconds || 300);
          setErrorMessage(
            langKey === 'fa'
              ? 'تعداد تلاش‌های ناموفق بیش از حد مجاز بود. حساب به مدت ۵ دقیقه قفل شد.'
              : langKey === 'ku'
              ? 'هەوڵی هەڵەی زۆر درا. بۆ ماوەی ٥ خولەک قفڵ کرا.'
              : 'Too many failed attempts. Login locked for 5 minutes.'
          );
        } else {
          setErrorMessage(
            res.error === 'invalidCredentials'
              ? (t('invalidCredentials') || 'مشخصات ورود اشتباه است')
              : res.error
          );
        }
      } else if (res.requires2FA) {
        // Switch to 2FA view
        setAuthMode('2fa');
        setTotpCode('');
        setIsUsingBackup(false);
      }
    } catch (err) {
      setErrorMessage(err.message || t('invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2FASubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!totpCode.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await completeTwoFactorLogin(totpCode);
      if (!res.success) {
        if (res.error === 'rateLimited') {
          setRemainingSeconds(300);
          setErrorMessage(
            langKey === 'fa'
              ? 'به دلیل تلاش‌های ناموفق مکرر، ورود قفل شد.'
              : 'Too many attempts. Account locked.'
          );
        } else {
          setErrorMessage(
            langKey === 'fa'
              ? 'کد تایید یا کد پشتیبان نامعتبر است. لطفاً دوباره امتحان کنید.'
              : langKey === 'ku'
              ? 'کۆدی پشتڕاستکردنەوە هەڵەیە.'
              : 'Invalid verification or backup code.'
          );
        }
      }
    } catch (err) {
      setErrorMessage(err.message || '2FA Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!signupEmail.trim() || !signupPassword.trim()) {
      setErrorMessage(t('missingEmailPassword') || 'ایمیل و رمز عبور الزامی است');
      return;
    }

    const strength = evaluatePasswordStrength(signupPassword);
    if (!strength.isAcceptable) {
      setErrorMessage(
        langKey === 'fa'
          ? 'رمز عبور انتخاب شده ضعیف است. لطفاً از رمز قوی‌تر شامل حروف، اعداد یا نمادها استفاده کنید.'
          : langKey === 'ku'
          ? 'وشەی نهێنی لاوازە. تکایە وشەیەکی بەهێزتر بەکاربهێنە.'
          : 'Password is too weak. Please use a stronger password with letters, digits or symbols.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUp(signupEmail, signupPassword, {
        company_name: signupCompanyName.trim() || 'کارگاه من',
        full_name: signupFullName.trim() || signupEmail.split('@')[0]
      });

      if (!res.success) {
        setErrorMessage(res.error || 'خطا در ثبت‌نام');
      } else if (res.message === 'checkEmailConfirmation') {
        setSuccessMessage(t('checkEmailVerification') || 'لینک تایید به ایمیل شما ارسال شد. لطفاً ایمیل خود را بررسی کنید.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'خطا در ثبت‌نام');
    } finally {
      setIsSubmitting(false);
    }
  };

  const languagesList = [
    { code: 'ku', label: 'کوردی' },
    { code: 'fa', label: 'فارسی' },
    { code: 'en', label: 'English' }
  ];

  return (
    <div 
      className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-sky-500 selection:text-white transition-colors duration-200"
      dir={direction}
    >
      {/* Top Controls Bar */}
      <div className="w-full max-w-md flex items-center justify-between mb-3">
        {toggleTheme ? (
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-xs hover:text-sky-500 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>
        ) : <div />}
        <div className="inline-flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs gap-1">
          {languagesList.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => changeLanguage(lang.code)}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                language === lang.code
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Auth Card */}
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* App Logo & Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <img 
            src="/karsync-logo.png" 
            alt="KarSync" 
            className="w-16 h-16 object-contain mb-3 drop-shadow-md hover:scale-105 transition-transform"
          />
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            KarSync
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {langKey === 'fa' ? 'سیستم مدیریت حضور، کارکرد و تسویه حساب' : langKey === 'ku' ? 'سیستەمی بەڕێوەبردنی ئامادەبوون و مووچە' : 'Workshop Attendance & Financial Manager'}
          </p>
        </div>

        {/* Tab Switcher (Only in signin/signup modes) */}
        {authMode !== '2fa' && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setErrorMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signin'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('signInTab') || 'ورود به حساب'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signup'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('signUpTab') || 'ثبت‌نام جدید'}</span>
            </button>
          </div>
        )}

        {/* Lockout Warning */}
        {remainingSeconds > 0 && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 animate-spin" />
            <span>
              {langKey === 'fa'
                ? `ورود به سیستم قفل است. زمان باقیمانده: ${formatLockTime(remainingSeconds)}`
                : `Login temporarily locked. Remaining: ${formatLockTime(remainingSeconds)}`}
            </span>
          </div>
        )}

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* 1. Sign In Form */}
        {/* ----------------------------------------------------------- */}
        {authMode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-sky-500" />
                <span>{t('emailOrUsername') || 'ایمیل یا نام کاربری / کد پرسنلی'}</span>
              </label>
              <input
                type="text"
                autoComplete="username"
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin / email@domain.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all text-left dir-ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('password')}</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 pe-11 transition-all text-left dir-ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || remainingSeconds > 0}
              className="w-full mt-2 py-3 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-md shadow-sky-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{t('loginBtn')}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ----------------------------------------------------------- */}
        {/* 2. Two-Factor Authentication (2FA) Challenge Screen */}
        {/* ----------------------------------------------------------- */}
        {authMode === '2fa' && (
          <form onSubmit={handleVerify2FASubmit} className="space-y-4 animate-in fade-in duration-150">
            <div className="p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 text-center">
              <div className="w-10 h-10 mx-auto rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/30 mb-2">
                <Smartphone className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-sky-950 dark:text-sky-200">
                {langKey === 'fa' ? 'تایید هویت دو مرحله‌ای (2FA)' : 'Two-Factor Authentication'}
              </h4>
              <p className="text-xs text-sky-800/80 dark:text-sky-300/80 mt-1 leading-relaxed">
                {isUsingBackup
                  ? (langKey === 'fa' ? 'یکی از کدهای بازیابی ۸ رقمی خود را وارد کنید:' : 'Enter one of your 8-character emergency backup codes:')
                  : (langKey === 'fa' ? 'کد ۶ رقمی نمایش داده شده در Google/Microsoft Authenticator را وارد کنید:' : 'Enter the 6-digit code from your Authenticator app:')}
              </p>
            </div>

            <div>
              {isUsingBackup ? (
                <input
                  type="text"
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="XXXX-XXXX"
                  required
                  className="w-full text-center tracking-widest font-mono text-lg font-bold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 uppercase"
                />
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl font-black px-3.5 py-3 bg-slate-50 dark:bg-slate-800/80 border-2 border-sky-500/40 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-sky-500 shadow-inner"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !totpCode.trim()}
              className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-md shadow-sky-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{langKey === 'fa' ? 'تایید و ورود به سیستم' : 'Verify & Sign In'}</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsUsingBackup(!isUsingBackup);
                  setTotpCode('');
                  setErrorMessage('');
                }}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {isUsingBackup
                    ? (langKey === 'fa' ? 'ورود با اپلیکیشن Authenticator' : 'Use Authenticator app')
                    : (langKey === 'fa' ? 'استفاده از کد بازیابی اضطراری' : 'Use emergency backup code')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMessage('');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                {langKey === 'fa' ? 'بازگشت' : 'Back'}
              </button>
            </div>
          </form>
        )}

        {/* ----------------------------------------------------------- */}
        {/* 3. Sign Up Form */}
        {/* ----------------------------------------------------------- */}
        {authMode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-sky-500" />
                <span>{t('workEmail') || 'ایمیل کاری'} *</span>
              </label>
              <input
                type="email"
                required
                autoFocus
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="manager@company.com"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all text-left dir-ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('password')} *</span>
              </label>
              <input
                type="password"
                required
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all text-left dir-ltr"
              />
              {/* Password Strength Meter */}
              <PasswordStrengthMeter password={signupPassword} showChecks={true} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t('companyOrWorkshopName') || 'نام کارگاه / سازمان'}</span>
              </label>
              <input
                type="text"
                value={signupCompanyName}
                onChange={(e) => setSignupCompanyName(e.target.value)}
                placeholder={t('companyPlaceholder') || 'کارگاه فلزکاری نوین'}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t('managerFullName') || 'نام مدیر'}</span>
              </label>
              <input
                type="text"
                value={signupFullName}
                onChange={(e) => setSignupFullName(e.target.value)}
                placeholder="افشین زارعی"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{t('createAccountBtn') || 'ثبت‌نام و ورود'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            {t('ownerName')} • {t('allRightsReserved')}
          </p>
        </div>

      </div>
    </div>
  );
}
