import React, { useState, useId } from 'react';
import {
  AlertTriangle,
  Trash2,
  FolderKanban,
  ShieldCheck,
  Users2,
  Building,
  Wallet,
  Receipt,
  Calendar,
  Coins,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  Flame,
  Check
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { isGoogleUser, verifyAdminReauth, performWorkspaceFactoryReset } from '../../services/workspaceResetService';

export default function WorkspaceResetModal({ isOpen, onClose }) {
  const { t, language, direction } = useLanguage();
  const { user } = useAuth();
  const isRtl = direction === 'rtl';

  const [step, setStep] = useState(1); // 1 = Warning Audit, 2 = Isolated Reauth
  const [typedEmail, setTypedEmail] = useState('');
  const [typedPassword, setTypedPassword] = useState('');
  const [typedKeyword, setTypedKeyword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDone, setIsDone] = useState(false);

  // Anti-autofill unique nonce
  const nonceId = useId().replace(/:/g, '_');

  if (!isOpen) return null;

  const isGoogle = isGoogleUser(user);

  const resetItems = [
    {
      icon: FolderKanban,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      title: t('factoryResetItemProjects')
    },
    {
      icon: ShieldCheck,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10 border-sky-500/20',
      title: t('factoryResetItemUsers')
    },
    {
      icon: Users2,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
      title: t('factoryResetItemWorkers')
    },
    {
      icon: Building,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      title: t('factoryResetItemCounterparties')
    },
    {
      icon: Wallet,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/20',
      title: t('factoryResetItemAccounts')
    },
    {
      icon: Receipt,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/20',
      title: t('factoryResetItemVouchers')
    },
    {
      icon: Calendar,
      color: 'text-teal-500',
      bg: 'bg-teal-500/10 border-teal-500/20',
      title: t('factoryResetItemAttendance')
    },
    {
      icon: Coins,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 border-rose-500/20',
      title: t('factoryResetItemExpenses')
    },
    {
      icon: Layers,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10 border-orange-500/20',
      title: t('factoryResetItemCategories')
    }
  ];

  const handleProceedToAuth = () => {
    setErrorMsg('');
    setStep(2);
  };

  const isSubmitDisabled = () => {
    if (isLoading || isDone) return true;
    if (!typedEmail.trim()) return true;
    if (isGoogle) {
      const kw = typedKeyword.trim().toUpperCase();
      return kw !== 'DELETE' && kw !== 'حذف' && kw !== 'سڕینەوە';
    }
    return !typedPassword.trim();
  };

  const handleExecuteReset = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitDisabled()) return;

    setErrorMsg('');
    setIsLoading(true);

    try {
      // 1. Verify Reauth
      await verifyAdminReauth({
        user,
        email: typedEmail,
        password: typedPassword,
        confirmationKeyword: typedKeyword
      });

      // 2. Perform Factory Reset
      await performWorkspaceFactoryReset({ user });

      setIsDone(true);

      // 3. Reload app into blank onboarding state
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error('[WorkspaceReset] Execution error:', err);
      if (err.code === 'EMAIL_MISMATCH') {
        setErrorMsg(t('factoryResetEmailMismatch'));
      } else if (err.code === 'KEYWORD_MISMATCH') {
        setErrorMsg(t('factoryResetKeywordMismatch'));
      } else if (err.code === 'INVALID_CREDENTIALS') {
        setErrorMsg(t('factoryResetInvalidCreds'));
      } else {
        setErrorMsg(err.message || t('errorOccurred'));
      }
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      dir={direction}
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-rose-200/90 dark:border-rose-900/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-rose-100 dark:border-rose-950/60 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center flex-shrink-0 shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {t('factoryResetModalTitle')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 animate-pulse">
                  {language === 'fa' ? 'منطقه بحرانی' : language === 'ku' ? 'مەترسیدار' : 'Danger Zone'}
                </span>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                {t('factoryResetWarningHeader')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading || isDone}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* STEP 1: DETAILED AUDIT & WARNING BREAKDOWN */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Alert Callout */}
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs leading-relaxed">
                  <div className="font-bold text-rose-700 dark:text-rose-300">
                    {t('factoryResetWarningHeader')}
                  </div>
                  <div>
                    {t('factoryResetWarningDesc')}
                  </div>
                </div>
              </div>

              {/* 9 Categories Being Destroyed */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>{t('factoryResetWarningListHeader')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {resetItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3 transition-all"
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${item.bg}`}>
                          <Icon className={`w-4 h-4 ${item.color}`} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {item.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* What happens next explanation */}
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs leading-relaxed flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <span>{t('factoryResetConsequenceDesc')}</span>
              </div>
            </div>
          )}

          {/* STEP 2: ISOLATED RE-AUTHENTICATION */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Back to Step 1 */}
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isLoading || isDone}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 transition-all"
              >
                {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>{language === 'fa' ? 'بازگشت به فهرست هشدارها' : language === 'ku' ? 'گەڕانەوە بۆ لیستی ئاگادارییەکان' : 'Back to Warning Details'}</span>
              </button>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-rose-700 dark:text-rose-300">
                  <ShieldCheck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>{t('factoryResetAuthTitle')}</span>
                </div>
                <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                  {isGoogle ? t('factoryResetGoogleAuthDesc') : t('factoryResetAuthDesc')}
                </p>
              </div>

              {/* Provider Info Card */}
              {isGoogle && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                      G
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t('factoryResetGoogleBadge')}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Google OAuth
                  </span>
                </div>
              )}

              {/* ISOLATED FORM (Strict Anti-Autofill Environment) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleExecuteReset();
                }}
                autoComplete="off"
                data-form-type="other"
                className="space-y-4"
              >
                {/* Hidden dummy fields to capture browser autofill heuristics */}
                <input
                  type="text"
                  name={`fake_email_${nonceId}`}
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                />
                <input
                  type="password"
                  name={`fake_pass_${nonceId}`}
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                />

                {/* Isolated Email Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('factoryResetTypeEmailLabel')}</span>
                  </label>
                  <input
                    type="text"
                    name={`isolated_owner_email_${nonceId}`}
                    id={`isolated_owner_email_${nonceId}`}
                    value={typedEmail}
                    onChange={(e) => setTypedEmail(e.target.value)}
                    placeholder={t('factoryResetTypeEmailPlaceholder')}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    data-form-type="other"
                    data-lpignore="true"
                    disabled={isLoading || isDone}
                    className="w-full px-4 py-3 rounded-2xl text-xs font-mono bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400">
                    {language === 'fa'
                      ? `باید دقیقاً برابر «${user?.email}» باشد.`
                      : language === 'ku'
                      ? `دەبێت ڕێک هاوتای «${user?.email}» بێت.`
                      : `Must exactly match "${user?.email}".`}
                  </p>
                </div>

                {/* For Standard Email/Password Accounts: Isolated Password Field */}
                {!isGoogle && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('factoryResetTypePasswordLabel')}</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name={`isolated_owner_pwd_${nonceId}`}
                        id={`isolated_owner_pwd_${nonceId}`}
                        value={typedPassword}
                        onChange={(e) => setTypedPassword(e.target.value)}
                        placeholder={t('factoryResetTypePasswordPlaceholder')}
                        autoComplete="new-password"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck="false"
                        data-form-type="other"
                        data-lpignore="true"
                        disabled={isLoading || isDone}
                        className="w-full px-4 py-3 rounded-2xl text-xs font-mono bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all ltr:pr-10 rtl:pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* For Google Accounts: Explicit Confirmation Keyword */}
                {isGoogle && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-rose-500" />
                      <span>{t('factoryResetGoogleConfirmLabel')}</span>
                    </label>
                    <input
                      type="text"
                      name={`isolated_confirm_kw_${nonceId}`}
                      id={`isolated_confirm_kw_${nonceId}`}
                      value={typedKeyword}
                      onChange={(e) => setTypedKeyword(e.target.value)}
                      placeholder={t('factoryResetGoogleConfirmPlaceholder')}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                      data-form-type="other"
                      disabled={isLoading || isDone}
                      className="w-full px-4 py-3 rounded-2xl text-xs font-mono font-bold bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all text-center tracking-wider"
                    />
                  </div>
                )}

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Success Banner */}
                {isDone && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{t('factoryResetSuccess')}</span>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Sticky Glass Bottom Dock */}
        <div className="px-6 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading || isDone}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-40"
          >
            {t('cancel')}
          </button>

          {step === 1 ? (
            <button
              type="button"
              onClick={handleProceedToAuth}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/25 active:scale-95 flex items-center gap-2"
            >
              <span>{t('factoryResetProceedToAuth')}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExecuteReset}
              disabled={isSubmitDisabled()}
              className="px-6 py-2.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white transition-all shadow-md shadow-rose-600/30 active:scale-95 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('factoryResetExecuting')}</span>
                </>
              ) : isDone ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('factoryResetSuccess')}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{t('factoryResetExecuteBtn')}</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
