import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Lock, Unlock, LogOut, AlertCircle, Eye, EyeOff } from 'lucide-react';

export function LockScreenModal() {
  const { isScreenLocked, unlockScreen, user, logout } = useAuth();
  const { t, direction } = useLanguage();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  if (!isScreenLocked || !user) return null;

  const handleUnlock = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!password.trim()) return;

    setIsUnlocking(true);
    try {
      const res = await unlockScreen(password);
      if (!res.success) {
        setErrorMsg(t('incorrectPasswordError'));
      } else {
        setPassword('');
      }
    } catch (err) {
      setErrorMsg(err.message || t('errorOccurred'));
    } finally {
      setIsUnlocking(false);
    }
  };

  const displayName = user.name || t('dearUser');

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-slate-100 animate-in fade-in duration-200"
      dir={direction}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 sm:p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
        {/* App & User Icon */}
        <div className="relative mx-auto w-20 h-20 mb-4">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={displayName}
              className="w-full h-full object-cover rounded-3xl border-2 border-sky-500 shadow-xl"
            />
          ) : (
            <div className="w-full h-full rounded-3xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-xl">
              {user.name ? user.name.slice(0, 2).toUpperCase() : 'KS'}
            </div>
          )}
          <div className="absolute -bottom-1 -end-1 w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <h3 className="text-base font-extrabold text-white">
          {displayName}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {t('screenLockedDesc')}
        </p>

        {errorMsg && (
          <div className="mt-4 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="mt-5 space-y-3.5">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('enterPasswordPlaceholder')}
              required
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 pe-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              title={showPassword ? t('hidePassword') : t('showPassword')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isUnlocking || !password.trim()}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Unlock className="w-4 h-4" />
            <span>{isUnlocking ? t('unlockingScreen') : t('unlockScreenBtn')}</span>
          </button>
        </form>

        <div className="mt-5 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('logoutConfirm'))) {
                logout();
              }
            }}
            className="text-xs font-semibold text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('logoutAccount')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
