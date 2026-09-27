import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  generateTOTPSecret,
  formatSecretForDisplay,
  getTOTPQRCodeSVG,
  verifyTOTPCode,
  generateBackupCodes
} from '../utils/totpSecurity';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Copy,
  Check,
  AlertCircle,
  Download,
  KeyRound,
  X,
  RefreshCw,
  Lock,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

export function TwoFactorModal({ isOpen, onClose }) {
  const { language, direction } = useLanguage();
  const { user, getTwoFactorConfig, enableTwoFactor, disableTwoFactor } = useAuth();

  const isRtl = direction === 'rtl';
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  // Config state
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState(1); // 1: QR & Secret, 2: Verification, 3: Backup Codes
  const [tempSecret, setTempSecret] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [testCode, setTestCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const current = getTwoFactorConfig();
    setConfig(current);
    setErrorMsg('');
    setShowDisableConfirm(false);
    setTestCode('');

    if (!current?.enabled) {
      // Initialize new secret
      const sec = generateTOTPSecret(20);
      setTempSecret(sec);
      const svg = getTOTPQRCodeSVG(user?.username || user?.email || 'admin', sec, 'KarSync');
      setQrSvg(svg);
      const bCodes = generateBackupCodes(8);
      setBackupCodes(bCodes);
      setStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(tempSecret.replace(/\s+/g, ''));
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } catch (_) {}
  };

  const handleCopyBackupCodes = async () => {
    try {
      const text = (config?.enabled ? config.backupCodes : backupCodes).join('\n');
      await navigator.clipboard.writeText(text);
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2500);
    } catch (_) {}
  };

  const handleDownloadBackupCodes = () => {
    const list = config?.enabled ? config.backupCodes : backupCodes;
    const content = `KarSync Two-Factor Authentication Backup Codes\nAccount: ${user?.username || user?.email || 'Admin'}\nDate: ${new Date().toLocaleString()}\n\n${list.join('\n')}\n\nKeep these codes in a safe, offline place. Each code can be used once.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karsync-2fa-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Step 2: Verify test code to enable 2FA
  const handleVerifyAndEnable = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!testCode.trim() || testCode.trim().length !== 6) {
      setErrorMsg(
        langKey === 'fa' ? 'کد باید ۶ رقمی باشد' : langKey === 'ku' ? 'کۆدەکە دەبێت ٦ ژمارە بێت' : 'Code must be 6 digits'
      );
      return;
    }

    setIsProcessing(true);
    try {
      const isValid = await verifyTOTPCode(testCode, tempSecret);
      if (!isValid) {
        setErrorMsg(
          langKey === 'fa'
            ? 'کد وارد شده نامعتبر است یا منقضی شده است. لطفاً کد جدید اپلیکیشن را وارد کنید.'
            : langKey === 'ku'
            ? 'کۆدی داخڵکراو هەڵەیە یان بەسەرچووە.'
            : 'Invalid or expired code. Please check your Authenticator app.'
        );
        setIsProcessing(false);
        return;
      }

      // Save to AuthContext
      await enableTwoFactor({
        secret: tempSecret,
        backupCodes
      });

      setConfig({ enabled: true, secret: tempSecret, backupCodes });
      setStep(3); // Show backup codes
    } catch (err) {
      setErrorMsg(err.message || 'Error enabling 2FA');
    } finally {
      setIsProcessing(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!disablePassword) return;

    setIsProcessing(true);
    try {
      const res = await disableTwoFactor(disablePassword);
      if (res.success) {
        setConfig({ enabled: false });
        setShowDisableConfirm(false);
        setDisablePassword('');
        // Reset wizard for future use
        const sec = generateTOTPSecret(20);
        setTempSecret(sec);
        const svg = getTOTPQRCodeSVG(user?.username || user?.email || 'admin', sec, 'KarSync');
        setQrSvg(svg);
        setBackupCodes(generateBackupCodes(8));
        setStep(1);
      } else {
        setErrorMsg(
          res.error === 'wrongPassword'
            ? (langKey === 'fa' ? 'رمز عبور وارد شده اشتباه است' : langKey === 'ku' ? 'تێپەڕەوشەی داخڵکراو هەڵەیە' : 'Incorrect password')
            : res.error
        );
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error disabling 2FA');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative text-slate-900 dark:text-white max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>{langKey === 'fa' ? 'تایید هویت دو مرحله‌ای (2FA)' : langKey === 'ku' ? 'پشتڕاستکردنەوەی دوو قۆناغی (2FA)' : 'Two-Factor Authentication (2FA)'}</span>
                {config?.enabled && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {langKey === 'fa' ? 'فعال' : langKey === 'ku' ? 'چالاکە' : 'Active'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {langKey === 'fa'
                  ? 'اتصال به Google Authenticator یا Microsoft Authenticator'
                  : langKey === 'ku'
                  ? 'بەستنەوە بە Google Authenticator یان Microsoft Authenticator'
                  : 'Google / Microsoft Authenticator TOTP App'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Error Alert */}
        {errorMsg && (
          <div className="mt-3.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* VIEW 1: 2FA ALREADY ENABLED */}
        {/* ----------------------------------------------------------- */}
        {config?.enabled && !showDisableConfirm && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <h4 className="font-bold text-emerald-900 dark:text-emerald-200">
                  {langKey === 'fa' ? 'حساب شما با تایید دو مرحله‌ای محافظت می‌شود' : langKey === 'ku' ? 'هەژمارەکەت پارێزراوە' : 'Your account is securely protected with 2FA'}
                </h4>
                <p className="text-emerald-800/80 dark:text-emerald-300/80 mt-1 leading-relaxed">
                  {langKey === 'fa'
                    ? 'در هر ورود، علاوه‌بر رمز عبور، کد ۶ رقمی تولیدشده توسط نرم‌افزار Authenticator نیز درخواست می‌شود.'
                    : langKey === 'ku'
                    ? 'لە کاتی چوونەژوورەوە، کۆدی ٦ ژمارەیی ئەپڵیکەیشنی Authenticator پێویست دەبێت.'
                    : 'A 6-digit verification code from your Authenticator app is required upon login.'}
                </p>
              </div>
            </div>

            {/* Backup Codes Section */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-sky-500" />
                  <span>{langKey === 'fa' ? 'کدهای بازیابی اضطراری (Backup Codes)' : langKey === 'ku' ? 'کۆدەکانی فریاگوزاری' : 'Emergency Backup Codes'}</span>
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {config.backupCodes?.length || 0} {langKey === 'fa' ? 'کد باقیمانده' : langKey === 'ku' ? 'کۆدی ماوە' : 'codes remaining'}
                </span>
              </div>

              {config.backupCodes && config.backupCodes.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 font-mono text-xs text-center">
                  {config.backupCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="py-1.5 px-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold tracking-wider select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs">
                  {langKey === 'fa' ? 'هیچ کد پشتیبان مصرف‌نشده‌ای باقی نمانده است.' : 'No backup codes left.'}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyBackupCodes}
                  className="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  {copiedBackup ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBackup ? (langKey === 'fa' ? 'کپی شد!' : 'کۆپیکرا!') : (langKey === 'fa' ? 'کپی کدها' : 'کۆپیکردن')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackupCodes}
                  className="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-sky-500" />
                  <span>{langKey === 'fa' ? 'دانلود فایل متنی' : 'داگرتن'}</span>
                </button>
              </div>
            </div>

            {/* Danger Zone: Disable 2FA */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDisableConfirm(true);
                  setErrorMsg('');
                }}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{langKey === 'fa' ? 'غیرفعال‌سازی تایید دو مرحله‌ای' : langKey === 'ku' ? 'ناچالاککردنی دوو قۆناغی' : 'Disable Two-Factor Authentication'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* VIEW 2: CONFIRM DISABLE 2FA */}
        {/* ----------------------------------------------------------- */}
        {config?.enabled && showDisableConfirm && (
          <form onSubmit={handleDisable2FA} className="mt-4 space-y-4">
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{langKey === 'fa' ? 'هشدار امنیتی' : 'ئاگاداری ئاسایش'}</span>
              </p>
              <p className="leading-relaxed">
                {langKey === 'fa'
                  ? 'با غیرفعال کردن تایید دو مرحله‌ای، امنیت حساب شما کاهش می‌یابد. برای تایید این عمل، لطفاً رمز عبور ورود خود را وارد نمایید:'
                  : 'Disabling 2FA reduces account security. Enter your password to confirm:'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {langKey === 'fa' ? 'رمز عبور ورود' : 'تێپەڕەوشە'}
              </label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDisableConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                {langKey === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
              </button>
              <button
                type="submit"
                disabled={isProcessing || !disablePassword}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isProcessing ? '...' : (langKey === 'fa' ? 'غیرفعال‌سازی نهایی' : 'ناچالاککردن')}
              </button>
            </div>
          </form>
        )}

        {/* ----------------------------------------------------------- */}
        {/* VIEW 3: SETUP WIZARD (NOT ENABLED) */}
        {/* ----------------------------------------------------------- */}
        {!config?.enabled && (
          <div className="mt-4">
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-4 px-2">
              {[1, 2, 3].map((s) => {
                const isActive = step === s;
                const isDone = step > s;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : isActive
                          ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4" /> : s}
                    </div>
                    <span className="text-[11px] font-bold hidden sm:inline text-slate-600 dark:text-slate-400">
                      {s === 1
                        ? (langKey === 'fa' ? 'اسکن بارکد' : 'سکانی بارکۆد')
                        : s === 2
                        ? (langKey === 'fa' ? 'تایید آزمایشی' : 'پشتڕاستکردنەوە')
                        : (langKey === 'fa' ? 'کدهای بازیابی' : 'کۆدی فریاگوزاری')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* STEP 1: Scan QR Code & Secret */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {langKey === 'fa'
                    ? '۱. نرم‌افزار Google Authenticator یا Microsoft Authenticator را روی گوشی خود باز کنید.'
                    : '1. Open Google Authenticator or Microsoft Authenticator on your phone.'}
                  <br />
                  {langKey === 'fa'
                    ? '۲. دکمه افزودن (+) و سپس Scan a QR code را بزنید و تصویر زیر را اسکن کنید:'
                    : '2. Tap add (+) and scan the QR code below:'}
                </p>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                  <div
                    className="w-48 h-48 rounded-xl overflow-hidden p-2 bg-white shadow-xs"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <span className="text-[11px] text-slate-400 mt-2 font-mono">
                    KarSync ({user?.username || 'admin'})
                  </span>
                </div>

                {/* Secret Key Text for Manual Entry */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {langKey === 'fa' ? 'یا ورود دستی کلید در اپلیکیشن (بدون دوربین):' : 'Or enter key manually:'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-sky-700 dark:text-sky-300 tracking-wider flex-1 select-all break-all">
                      {formatSecretForDisplay(tempSecret)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors flex-shrink-0 shadow-xs"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? (langKey === 'fa' ? 'کپی شد' : 'کۆپیکرا') : (langKey === 'fa' ? 'کپی کلید' : 'کۆپی')}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setStep(2);
                    }}
                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/25 flex items-center gap-2 transition-all"
                  >
                    <span>{langKey === 'fa' ? 'مرحله بعد: تایید کد' : 'قۆناغی دواتر'}</span>
                    {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Verify test 6-digit code */}
            {step === 2 && (
              <form onSubmit={handleVerifyAndEnable} className="space-y-4 animate-in fade-in duration-150">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {langKey === 'fa'
                    ? 'برای اطمینان از تنظیم صحیح، کد ۶ رقمی فعلی نمایش داده شده در اپلیکیشن Authenticator را وارد کنید:'
                    : 'Enter the 6-digit code from your Authenticator app to confirm setup:'}
                </p>

                <div className="flex flex-col items-center justify-center py-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    className="w-48 text-center tracking-[0.4em] font-mono text-2xl font-black px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-sky-500/50 rounded-2xl focus:outline-hidden focus:border-sky-500 shadow-inner text-slate-900 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-400 mt-2">
                    {langKey === 'fa' ? 'کد هر ۳۰ ثانیه یک‌بار عوض می‌شود' : 'Codes refresh every 30 seconds'}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setStep(1);
                    }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    {langKey === 'fa' ? 'بازگشت به بارکد' : 'گەڕانەوە'}
                  </button>

                  <button
                    type="submit"
                    disabled={isProcessing || testCode.length !== 6}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isProcessing ? '...' : (langKey === 'fa' ? 'بررسی و فعال‌سازی' : 'چالاککردن')}</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Backup Codes Display */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="text-xs font-bold">
                    {langKey === 'fa' ? 'تایید دو مرحله‌ای با موفقیت فعال شد!' : '2FA has been successfully enabled!'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {langKey === 'fa' ? 'کدهای بازیابی اضطراری شما' : 'Your Emergency Backup Codes'}
                    </h4>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {langKey === 'fa'
                      ? 'اگر به گوشی خود دسترسی نداشتید، می‌توانید با یکی از این کدها وارد شوید. هر کد فقط یک بار قابل استفاده است.'
                      : 'If you lose access to your phone, use these codes to log in. Each code is one-time use.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 font-mono text-xs text-center">
                    {backupCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="py-1.5 px-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold tracking-wider select-all"
                      >
                        {code}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyBackupCodes}
                      className="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      {copiedBackup ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedBackup ? (langKey === 'fa' ? 'کپی شد!' : 'کۆپیکرا!') : (langKey === 'fa' ? 'کپی همه کدها' : 'کۆپیکردن')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadBackupCodes}
                      className="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-500" />
                      <span>{langKey === 'fa' ? 'دانلود فایل متنی' : 'داگرتن'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/25 transition-all"
                  >
                    {langKey === 'fa' ? 'تکمیل و بستن' : 'تەواوکردن'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
