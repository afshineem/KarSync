import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Lock, KeyRound, Eye, EyeOff, X, Check, AlertCircle } from 'lucide-react';

export function ChangePasswordModal({ isOpen, onClose }) {
  const { t, language } = useLanguage();
  const { changeAdminPassword } = useAuth();

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!currentPass || !newPass) return;
    if (newPass !== confirmPass) {
      setStatus({ 
        type: 'error', 
        message: language === 'fa' ? 'رمز عبور جدید و تکرار آن یکسان نیستند' : language === 'ku' ? 'تێپەڕەوشەی نوێ و دووبارەکردنەوەی وەک یەک نین' : 'Passwords do not match'
      });
      return;
    }
    if (newPass.length < 6) {
      setStatus({
        type: 'error',
        message: language === 'fa' ? 'رمز عبور باید حداقل ۶ کاراکتر باشد' : language === 'ku' ? 'تێپەڕەوشە دەبێت لانیکەم ٦ پیت بێت' : 'Password must be at least 6 characters'
      });
      return;
    }

    setLoading(true);
    try {
      const res = await changeAdminPassword(currentPass, newPass);
      if (res.success) {
        setStatus({
          type: 'success',
          message: language === 'fa' ? 'رمز عبور با موفقیت به‌روزرسانی شد' : language === 'ku' ? 'تێپەڕەوشە بە سەرکەوتوویی نوێکرایەوە' : 'Password changed successfully'
        });
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        setTimeout(() => {
          setStatus({ type: '', message: '' });
          onClose();
        }, 1500);
      } else {
        setStatus({
          type: 'error',
          message: res.error === 'currentPasswordWrong'
            ? (language === 'fa' ? 'رمز عبور فعلی اشتباه است' : language === 'ku' ? 'تێپەڕەوشەی ئێستا هەڵەیە' : 'Current password is incorrect')
            : res.error
        });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 sm:p-6 shadow-2xl relative text-slate-900 dark:text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {language === 'fa' ? 'تغییر رمز عبور' : language === 'ku' ? 'گۆڕینی تێپەڕەوشە' : 'Change Password'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'fa' ? 'امنیت ورود مدیر به برنامه' : language === 'ku' ? 'ئاسایشی چوونەژوورەوەی بەڕێوەبەر' : 'Admin account security'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Status */}
        {status.message && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            status.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
          }`}>
            {status.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
            <span>{status.message}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'fa' ? 'رمز عبور فعلی' : language === 'ku' ? 'تێپەڕەوشەی ئێستا' : 'Current Password'}
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 pe-9"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'رمز عبور جدید' : language === 'ku' ? 'تێپەڕەوشەی نوێ' : 'New Password'}
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 pe-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'تکرار رمز عبور جدید' : language === 'ku' ? 'دووبارەکردنەوەی تێپەڕەوشە' : 'Confirm Password'}
              </label>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              {language === 'fa' ? 'انصراف' : language === 'ku' ? 'پاشگەزبوونەوە' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading || !currentPass || !newPass}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? (language === 'fa' ? 'در حال ثبت...' : 'Updating...') : (language === 'fa' ? 'ثبت تغییرات' : language === 'ku' ? 'پاشەکەوتکردن' : 'Save')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
