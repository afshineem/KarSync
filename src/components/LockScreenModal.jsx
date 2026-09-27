import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Lock, Unlock, LogOut, AlertCircle, Eye, EyeOff } from 'lucide-react';

export function LockScreenModal() {
  const { isScreenLocked, unlockScreen, user, logout } = useAuth();
  const { language, direction } = useLanguage();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  if (!isScreenLocked || !user) return null;

  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  const handleUnlock = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!password.trim()) return;

    setIsUnlocking(true);
    try {
      const res = await unlockScreen(password);
      if (!res.success) {
        setErrorMsg(
          langKey === 'fa'
            ? 'رمز عبور وارد شده اشتباه است'
            : langKey === 'ku'
            ? 'تێپەڕەوشەی داخڵکراو هەڵەیە'
            : 'Incorrect password'
        );
      } else {
        setPassword('');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error');
    } finally {
      setIsUnlocking(false);
    }
  };

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
              alt={user.name || 'User'}
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
          {user.name || 'کاربر گرامی'}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {langKey === 'fa'
            ? 'سیستم بر اثر بی‌حرکتی قفل شده است'
            : langKey === 'ku'
            ? 'سیستەم بەهۆی ناچالاکییەوە قفڵکراوە'
            : 'Screen locked due to inactivity'}
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
              placeholder={langKey === 'fa' ? 'رمز عبور ورود را وارد کنید' : 'Enter password'}
              required
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 pe-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
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
            <span>{isUnlocking ? '...' : (langKey === 'fa' ? 'بازگشایی قفل' : 'کردنەوەی قفڵ')}</span>
          </button>
        </form>

        <div className="mt-5 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(langKey === 'fa' ? 'آیا مایل به خروج از حساب کاربری هستید؟' : 'Do you want to log out?')) {
                logout();
              }
            }}
            className="text-xs font-semibold text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{langKey === 'fa' ? 'خروج از حساب کاربری' : 'Log out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
