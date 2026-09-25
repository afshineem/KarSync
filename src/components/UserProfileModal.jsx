import React, { useState, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  X, 
  Camera, 
  Trash2, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  ShieldCheck,
  UserCheck,
  Sparkles
} from 'lucide-react';

export function UserProfileModal({ isOpen, onClose }) {
  const { language } = useLanguage();
  const { user, updateUserProfile, changeAdminPassword } = useAuth();

  const fileInputRef = useRef(null);

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || user?.email?.split('@')[0] || '');
  const [avatar, setAvatar] = useState(user?.avatar || user?.photo || user?.supabaseUser?.user_metadata?.avatar_url || '');

  // Password change state
  const [enablePasswordChange, setEnablePasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Handle image upload with auto-resize via Canvas
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (< 5MB initial)
    if (file.size > 5 * 1024 * 1024) {
      setStatus({
        type: 'error',
        message: language === 'ku' ? 'قەبارەی وێنە نابێت لە ٥ مێگابایت زیاتر بێت' : 'حجم تصویر نباید بیشتر از ۵ مگابایت باشد.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Resize to maximum 256x256 for compact storage
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatar(dataUrl);
        setStatus({ type: '', message: '' });
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!name.trim()) {
      setStatus({
        type: 'error',
        message: language === 'ku' ? 'تکایە ناوی تەواو بنووسە' : 'لطفاً نام کاربر را وارد کنید.'
      });
      return;
    }

    setLoading(true);
    try {
      // 1. If password change is requested, validate & execute
      if (enablePasswordChange) {
        if (!currentPassword || !newPassword) {
          setStatus({
            type: 'error',
            message: language === 'ku' ? 'تکایە هەموو خانەکانی تێپەڕەوشە پڕبکەرەوە' : 'لطفاً تمام فیلدهای رمز عبور را تکمیل کنید.'
          });
          setLoading(false);
          return;
        }

        if (newPassword !== confirmPassword) {
          setStatus({
            type: 'error',
            message: language === 'ku' ? 'تێپەڕەوشەی نوێ و دووبارەکردنەوەی وەک یەک نین' : 'رمز عبور جدید و تکرار آن یکسان نیستند.'
          });
          setLoading(false);
          return;
        }

        if (newPassword.length < 6) {
          setStatus({
            type: 'error',
            message: language === 'ku' ? 'تێپەڕەوشە دەبێت لانیکەم ٦ پیت بێت' : 'رمز عبور باید حداقل ۶ کاراکتر باشد.'
          });
          setLoading(false);
          return;
        }

        const passRes = await changeAdminPassword(currentPassword, newPassword);
        if (!passRes.success) {
          setStatus({
            type: 'error',
            message: passRes.error === 'currentPasswordWrong'
              ? (language === 'ku' ? 'تێپەڕەوشەی ئێستا هەڵەیە' : 'رمز عبور فعلی نادرست است.')
              : passRes.error
          });
          setLoading(false);
          return;
        }
      }

      // 2. Save profile updates
      const profileRes = await updateUserProfile({
        name: name.trim(),
        avatar: avatar || '',
        username: username.trim()
      });

      if (profileRes.success) {
        setStatus({
          type: 'success',
          message: language === 'ku' ? 'پرۆفایل بە سەرکەوتوویی نوێکرایەوە' : 'اطلاعات پروفایل با موفقیت ذخیره شد.'
        });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setStatus({
          type: 'error',
          message: profileRes.error || (language === 'ku' ? 'هەڵەیەک ڕوویدا' : 'خطایی در ذخیره اطلاعات رخ داد.')
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
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4 print:p-0 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative text-slate-900 dark:text-white h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-y-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {language === 'ku' ? 'ڕێکخستنەکانی پرۆفایلی بەکارھێنەر' : 'تنظیمات پروفایل کاربر'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ku' ? 'گۆڕینی وێنە، ناو و تێپەڕەوشەی چوونەژوورەوە' : 'ویرایش تصویر، نام و امنیت حساب کاربری'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="space-y-5 pt-4 flex-1 flex flex-col justify-between">
          <div className="space-y-5">
            
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
              <div className="relative group">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name || 'User Avatar'}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-sky-500/40 shadow-md shadow-sky-600/15"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-sky-600/25 border border-white/20">
                    {(name ? name.slice(0, 1) : 'U').toUpperCase()}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -end-1.5 p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-md transition-transform hover:scale-110 active:scale-95 border-2 border-white dark:border-slate-900"
                  title={language === 'ku' ? 'گۆڕینی وێنە' : 'تغییر تصویر'}
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 text-center sm:text-start space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  {language === 'ku' ? 'وێنەی سەرەکی بەکارھێنەر' : 'تصویر نمایه کاربر'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'ku' 
                    ? 'فۆرماتەکانی JPG, PNG پشتیوانی دەکرێن (ئۆتۆماتیک بچووک دەکرێتەوە)'
                    : 'فرمت‌های JPG و PNG پشتیبانی می‌شوند (فشرده‌سازی خودکار)'}
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-600 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-sky-500" />
                    <span>{language === 'ku' ? 'هەڵبژاردنی وێنە' : 'انتخاب تصویر جدید'}</span>
                  </button>

                  {avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors flex items-center gap-1 shadow-xs"
                      title={language === 'ku' ? 'سڕینەوەی وێنە' : 'حذف تصویر'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'ku' ? 'سڕینەوە' : 'حذف'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs Section */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'ku' ? 'ناوی بەکارھێنەر (ناو و پاشناو)' : 'نام و نام خانوادگی کاربر'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: افشین زارعی"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'ku' ? 'ناوی چوونەژوورەوە (یوزەرنەیم)' : 'نام کاربری (شناسه ورود)'}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all font-mono"
                />
              </div>

              {user?.email && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    {language === 'ku' ? 'ئیمەیڵی پەیوەستکراو:' : 'ایمیل متصل:'}
                  </span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {user.email}
                  </span>
                </div>
              )}
            </div>

            {/* Password Change Toggle Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {language === 'ku' ? 'گۆڕینی تێپەڕەوشەی چوونەژوورەوە' : 'تغییر رمز عبور ورود'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enablePasswordChange}
                  onChange={(e) => {
                    setEnablePasswordChange(e.target.checked);
                    if (!e.target.checked) {
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }
                  }}
                  className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-600 focus:ring-sky-500 cursor-pointer"
                />
              </label>

              {enablePasswordChange && (
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'ku' ? 'تێپەڕەوشەی ئێستا' : 'رمز عبور فعلی'}
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute inset-y-0 end-0 px-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'ku' ? 'تێپەڕەوشەی نوێ' : 'رمز عبور جدید'}
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPass ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute inset-y-0 end-0 px-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'ku' ? 'دووبارەکردنەوەی تێپەڕەوشەی نوێ' : 'تکرار رمز عبور جدید'}
                      </label>
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Alert Status */}
            {status.message && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150 ${
                status.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}>
                {status.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{status.message}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              {language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-tr from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-600/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{language === 'ku' ? 'پاشەکەوتکردنی گۆڕانکارییەکان' : 'ذخیره تغییرات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
