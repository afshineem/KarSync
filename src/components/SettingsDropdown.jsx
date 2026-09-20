import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fullSyncBothDirections } from '../services/realtimeSync';
import { 
  Languages, 
  Sun, 
  Moon, 
  Cloud, 
  RefreshCw, 
  KeyRound, 
  Database, 
  LogOut, 
  Info, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  FolderKanban
} from 'lucide-react';

export function SettingsDropdown({ 
  isOpen, 
  onClose, 
  theme, 
  toggleTheme, 
  onOpenBackupModal,
  onOpenChangePasswordModal,
  onOpenAboutModal,
  onOpenProjectSettings
}) {
  const { language, changeLanguage, t, direction } = useLanguage();
  const { logout } = useAuth();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [showLanguageSubmenu, setShowLanguageSubmenu] = useState(false);

  const dropdownRef = useRef(null);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Dynamic viewport edge containment: auto-clamp away from screen borders
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const adjustPosition = () => {
      if (!dropdownRef.current) return;
      dropdownRef.current.style.transform = 'none';
      const rect = dropdownRef.current.getBoundingClientRect();
      const padding = 10;
      if (rect.right > window.innerWidth - padding) {
        const overflow = rect.right - (window.innerWidth - padding);
        dropdownRef.current.style.transform = `translateX(-${overflow}px)`;
      } else if (rect.left < padding) {
        const underflow = padding - rect.left;
        dropdownRef.current.style.transform = `translateX(${underflow}px)`;
      }
    };
    adjustPosition();
    const frameId = requestAnimationFrame(adjustPosition);
    window.addEventListener('resize', adjustPosition);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', adjustPosition);
    };
  }, [isOpen, direction]);

  if (!isOpen) return null;

  const handleCloudSync = async () => {
    setIsSyncing(true);
    setSyncStatus('');
    try {
      await fullSyncBothDirections();
      setSyncStatus(language === 'fa' ? 'همگام‌سازی شد' : language === 'ku' ? 'هاوکاتکرا' : 'Synced');
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (err) {
      setSyncStatus(language === 'fa' ? 'خطا در همگام‌سازی' : 'Sync Error');
      setTimeout(() => setSyncStatus(''), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const languagesList = [
    { code: 'ku', label: 'کوردی (سۆرانی)' },
    { code: 'fa', label: 'فارسی' },
    { code: 'en', label: 'English' }
  ];

  return (
    <div 
      ref={dropdownRef}
      className={`absolute top-full mt-2 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] bg-white/40 dark:bg-slate-900/50 backdrop-blur-3xl backdrop-saturate-200 rounded-3xl border border-white/60 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.1)] z-50 py-2 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 select-none ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto`}
    >
      {/* 1. Language Selection */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowLanguageSubmenu(!showLanguageSubmenu)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Languages className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>{language === 'fa' ? 'زبان برنامه' : language === 'ku' ? 'زمانی بەرنامە' : 'Language'}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>{languagesList.find(l => l.code === language)?.label}</span>
            {direction === 'rtl' ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </button>

        {/* Submenu for languages */}
        {showLanguageSubmenu && (
          <div className="my-1 mx-2 p-1.5 bg-white/40 dark:bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 space-y-0.5 animate-in fade-in duration-100">
            {languagesList.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    changeLanguage(lang.code);
                    setShowLanguageSubmenu(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                    isSelected 
                      ? 'bg-sky-500/15 dark:bg-sky-500/25 text-sky-700 dark:text-sky-300 font-bold' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <span>{lang.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {theme === 'dark' ? (
            <Moon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          ) : (
            <Sun className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          )}
          <span>{language === 'fa' ? 'پوسته تاریک / روشن' : language === 'ku' ? 'ڕووکاری تاریک / ڕووناک' : 'Dark / Light Theme'}</span>
        </div>
        <span className="text-[11px] text-slate-400">
          {theme === 'dark' ? (language === 'fa' ? 'تاریک' : language === 'ku' ? 'تاریک' : 'Dark') : (language === 'fa' ? 'روشن' : language === 'ku' ? 'ڕووناک' : 'Light')}
        </span>
      </button>

      {/* 3. Cloud Sync (فقط با عنوان: "همگام‌سازی") */}
      <button
        type="button"
        onClick={handleCloudSync}
        disabled={isSyncing}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Cloud className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>{language === 'fa' ? 'همگام‌سازی' : language === 'ku' ? 'هاوکاتکردن' : 'Cloud Sync'}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          {syncStatus ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{syncStatus}</span>
          ) : (
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-500' : ''}`} />
          )}
        </div>
      </button>

      {/* 4. Project Management & Settings */}
      <button
        type="button"
        onClick={() => {
          onClose();
          if (onOpenProjectSettings) onOpenProjectSettings();
        }}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <FolderKanban className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>{language === 'fa' ? 'مدیریت و ویرایش پروژه‌ها' : language === 'ku' ? 'بەڕێوەبردنی پڕۆژەکان' : 'Project Management'}</span>
        </div>
      </button>

      {/* 5. Change Password */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenChangePasswordModal();
        }}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>{language === 'fa' ? 'تغییر رمز عبور' : language === 'ku' ? 'گۆڕینی تێپەڕەوشە' : 'Change Password'}</span>
        </div>
      </button>

      {/* 6. Backup & Data Management */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenBackupModal();
        }}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>{language === 'fa' ? 'پشتیبان‌گیری و داده‌ها' : language === 'ku' ? 'یەدەگگرتن و داتاکان' : 'Backup & Data'}</span>
        </div>
      </button>

      <div className="my-1 border-t border-white/40 dark:border-white/10"></div>

      {/* 7. Sign Out / Exit */}
      <button
        type="button"
        onClick={() => {
          onClose();
          if (window.confirm(t('logoutConfirm') || (language === 'fa' ? 'آیا مطمئن هستید که می‌خواهید از حساب خود خارج شوید؟' : 'Are you sure you want to sign out?'))) {
            logout();
          }
        }}
        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 dark:hover:bg-rose-500/20 transition-colors"
      >
        <LogOut className="w-4 h-4 text-rose-500" />
        <span>{language === 'fa' ? 'خروج از حساب' : language === 'ku' ? 'چوونەدەرەوە' : 'Sign Out'}</span>
      </button>

      <div className="my-1 border-t border-white/40 dark:border-white/10"></div>

      {/* 8. Dedicated About Link at bottom */}
      <div className="px-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenAboutModal();
          }}
          className="w-full px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          <span>{language === 'fa' ? 'درباره برنامه KarSync' : language === 'ku' ? 'دەربارەی بەرنامە' : 'About KarSync'}</span>
        </button>
      </div>
    </div>
  );
}
