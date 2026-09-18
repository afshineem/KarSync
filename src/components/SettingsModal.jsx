import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fullSyncBothDirections } from '../services/realtimeSync';
import { 
  Settings, 
  X, 
  Sun, 
  Moon, 
  Languages, 
  Cloud, 
  Check, 
  CheckCircle2, 
  Database, 
  RefreshCw, 
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  LogOut
} from 'lucide-react';

export function SettingsModal({ 
  isOpen, 
  onClose, 
  theme, 
  toggleTheme, 
  onOpenBackupModal
}) {
  const { language, changeLanguage, t, direction } = useLanguage();
  const { changeAdminPassword, logout } = useAuth();
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');

  // Admin password change form state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [isChangingPass, setIsChangingPass] = useState(false);

  if (!isOpen) return null;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', message: '' });
    if (!currentPassInput || !newPassInput) return;
    if (newPassInput !== confirmPassInput) {
      setPasswordStatus({ type: 'error', message: t('passwordMismatch') });
      return;
    }
    setIsChangingPass(true);
    try {
      const res = await changeAdminPassword(currentPassInput, newPassInput);
      if (res.success) {
        setPasswordStatus({ type: 'success', message: t('passwordChangedSuccess') });
        setCurrentPassInput('');
        setNewPassInput('');
        setConfirmPassInput('');
        setTimeout(() => {
          setPasswordStatus({ type: '', message: '' });
          setShowPasswordChange(false);
        }, 2000);
      } else {
        setPasswordStatus({
          type: 'error',
          message: res.error === 'currentPasswordWrong' 
            ? (language === 'en' ? 'Current password is incorrect!' : language === 'ku' ? 'تێپەڕەوشەی ئێستا هەڵەیە!' : 'رمز عبور فعلی اشتباه است!') 
            : res.error
        });
      }
    } catch (err) {
      setPasswordStatus({ type: 'error', message: err.message });
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleManualQuickSync = async () => {
    setIsSyncingLive(true);
    setSyncFeedback('');
    try {
      await fullSyncBothDirections();
      setSyncFeedback(language === 'en' ? 'Synced successfully with Supabase!' : language === 'ku' ? 'بە سەرکەوتوویی لەگەڵ سوپابەیس هاوکاتکرا!' : 'با موفقیت با سرور ابری سوپابیس همگام شد!');
      setTimeout(() => setSyncFeedback(''), 3500);
    } catch (err) {
      setSyncFeedback(err.message || 'Sync error');
      setTimeout(() => setSyncFeedback(''), 4000);
    } finally {
      setIsSyncingLive(false);
    }
  };

  const languagesList = [
    { code: 'ku', label: 'کوردی (سۆرانی)', flag: '☀️' },
    { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' }
  ];

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header: KarSync */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1.5 flex-shrink-0">
              <img 
                src="/karsync-icon.png" 
                alt="KarSync" 
                className="w-full h-full object-contain dark:brightness-0 dark:invert transition-all" 
              />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {t('settings')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                KarSync • {t('settingsSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={t('close') || 'بستن'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Settings Body */}
        <div className="my-4 space-y-4 overflow-y-auto pe-1 flex-1">
          
          {/* Section 1: Language Switcher */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2 mb-2.5">
              <Languages className="w-4 h-4 text-sky-500" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t('languageSelect')}
              </h4>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {languagesList.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => changeLanguage(lang.code)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20 scale-[1.02]'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 ms-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Dark Mode / Light Mode Theme */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2 mb-2.5">
              <Sun className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t('appearance')}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'light') toggleTheme();
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  theme === 'light'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 scale-[1.02]'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>{t('themeLight')}</span>
                {theme === 'light' && <Check className="w-3.5 h-3.5 ms-1" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (theme !== 'dark') toggleTheme();
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  theme === 'dark'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 scale-[1.02]'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>{t('themeDark')}</span>
                {theme === 'dark' && <Check className="w-3.5 h-3.5 ms-1" />}
              </button>
            </div>
          </div>

          {/* Section 3: Supabase Cloud Database Status & Quick Sync */}
          <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/70 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center">
                  <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute -top-0.5 -right-0.5 opacity-75"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5"></span>
                </div>
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  {t('cloudSyncTitle')}
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{t('cloudSyncStatusConnected')}</span>
              </span>
            </div>

            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed mb-3">
              {t('cloudSyncDesc')}
            </p>

            {/* Sync Feedback Toast */}
            {syncFeedback && (
              <div className="mb-2.5 p-2 bg-emerald-100 dark:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>{syncFeedback}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleManualQuickSync}
              disabled={isSyncingLive}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLive ? 'animate-spin' : ''}`} />
              <span>{isSyncingLive ? (language === 'en' ? 'Syncing...' : language === 'ku' ? 'هاوکات دەکرێت...' : 'در حال هماهنگ‌سازی...') : t('cloudSyncBtn')}</span>
            </button>
          </div>

          {/* Section 4: Change Admin Password */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('changeAdminPassword')}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(!showPasswordChange);
                  setPasswordStatus({ type: '', message: '' });
                }}
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
              >
                {showPasswordChange ? (language === 'en' ? 'Cancel' : language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف') : (language === 'en' ? 'Change' : language === 'ku' ? 'گۆڕین' : 'تغییر رمز')}
              </button>
            </div>

            {showPasswordChange ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-2">
                {passwordStatus.message && (
                  <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    passwordStatus.type === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {passwordStatus.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
                    <span>{passwordStatus.message}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('currentPassword')}
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassInput}
                      onChange={(e) => setCurrentPassInput(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 pe-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {t('newPassword')}
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassInput}
                        onChange={(e) => setNewPassInput(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 pe-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {t('confirmNewPassword')}
                    </label>
                    <input
                      type="password"
                      value={confirmPassInput}
                      onChange={(e) => setConfirmPassInput(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPass || !currentPassInput || !newPassInput}
                  className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isChangingPass ? (language === 'en' ? 'Updating...' : language === 'ku' ? 'نوێدەکرێتەوە...' : 'در حال ثبت...') : t('changeAdminPassword')}</span>
                </button>
              </form>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'en' ? 'Secure admin account access and update password anytime.' : language === 'ku' ? 'پاراستنی هەژماری بەڕێوەبەر و گۆڕینی تێپەڕەوشە لە هەر کاتێکدا.' : 'تغییر رمز عبور ورود ادمین به برنامه جهت حفظ امنیت داده‌ها.'}
              </p>
            )}
          </div>

          {/* Section 4: Database Backup & Restore */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('backupRestoreTitle')}
                </h4>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              {t('backupRestoreDesc')}
            </p>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBackupModal();
              }}
              className="w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Database className="w-3.5 h-3.5 text-sky-500" />
              <span>{t('openBackupModalBtn')}</span>
            </button>
          </div>

          {/* Section 5: Logout Account */}
          <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/40">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('logoutConfirm'))) {
                  onClose();
                  logout();
                }
              }}
              className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('logoutAccount')}</span>
            </button>
          </div>

          {/* Section 6: Modal Footer - Owner Copyright & Social Links (Scrolls naturally) */}
          <div className="pt-5 mt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
            
            {/* Creator & Ownership Badge */}
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              <ShieldCheck className="w-4 h-4 text-sky-500" />
              <span>{t('ownerName')}</span>
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              {t('developedBy')} • {t('allRightsReserved')}
            </p>

            {/* Social Links: Telegram & Instagram (Icons Only) */}
            <div className="flex items-center justify-center gap-3 mt-3 pb-2">
              
              {/* Telegram Icon Button */}
              <a
                href="https://t.me/afshineem"
                target="_blank"
                rel="noopener noreferrer"
                title="Telegram: @afshineem"
                aria-label="Telegram"
                className="w-10 h-10 rounded-2xl bg-sky-500/10 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 border border-sky-200/70 dark:border-sky-800/70 transition-all flex items-center justify-center group shadow-xs hover:scale-110 active:scale-95"
              >
                <svg className="w-5 h-5 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </a>

              {/* Instagram Icon Button */}
              <a
                href="https://instagram.com/afshineem"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram: @afshineem"
                aria-label="Instagram"
                className="w-10 h-10 rounded-2xl bg-pink-500/10 hover:bg-pink-500/25 text-pink-600 dark:text-pink-400 border border-pink-200/70 dark:border-pink-800/70 transition-all flex items-center justify-center group shadow-xs hover:scale-110 active:scale-95"
              >
                <svg className="w-5 h-5 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
