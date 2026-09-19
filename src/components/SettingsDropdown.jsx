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
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Dynamic viewport edge containment: auto-clamp away from screen borders
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const adjustPosition = () => {
      if (!dropdownRef.current) return;
      dropdownRef.current.style.transform = 'none';
      const rect = dropdownRef.current.getBoundingClientRect();
      const padding = 12;
      if (rect.right > window.innerWidth - padding) {
        const overflow = rect.right - (window.innerWidth - padding);
        dropdownRef.current.style.transform = `translateX(-${overflow}px)`;
      } else if (rect.left < padding) {
        const underflow = padding - rect.left;
        dropdownRef.current.style.transform = `translateX(${underflow}px)`;
      }
    };
    adjustPosition();
    window.addEventListener('resize', adjustPosition);
    return () => window.removeEventListener('resize', adjustPosition);
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
      className={`absolute top-full mt-2 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-1.5 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 select-none ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto`}
    >
      {/* 1. Language Selection */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowLanguageSubmenu(!showLanguageSubmenu)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
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
          <div className="my-1 mx-2 p-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-0.5 animate-in fade-in duration-100">
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
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    isSelected 
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span>{lang.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />}
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
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
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
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
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
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
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
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>{language === 'fa' ? 'تغییر رمز عبور' : language === 'ku' ? 'گۆڕینی تێپەڕەوشە' : 'Change Password'}</span>
        </div>
      </button>

      {/* 5. Backup & Data Management */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenBackupModal();
        }}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>{language === 'fa' ? 'پشتیبان‌گیری و داده‌ها' : language === 'ku' ? 'یەدەگگرتن و داتاکان' : 'Backup & Data'}</span>
        </div>
      </button>

      <div className="my-1 border-t border-slate-100 dark:border-slate-800"></div>

      {/* 6. Sign Out / Exit */}
      <button
        type="button"
        onClick={() => {
          onClose();
          if (window.confirm(t('logoutConfirm') || (language === 'fa' ? 'آیا مطمئن هستید که می‌خواهید از حساب خود خارج شوید؟' : 'Are you sure you want to sign out?'))) {
            logout();
          }
        }}
        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
      >
        <LogOut className="w-4 h-4 text-rose-500" />
        <span>{language === 'fa' ? 'خروج از حساب' : language === 'ku' ? 'چوونەدەرەوە' : 'Sign Out'}</span>
      </button>

      <div className="my-1 border-t border-slate-100 dark:border-slate-800"></div>

      {/* 7. Dedicated About Link at bottom */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenAboutModal();
        }}
        className="w-full px-3.5 py-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        <span>{language === 'fa' ? 'درباره برنامه KarSync' : language === 'ku' ? 'دەربارەی بەرنامە' : 'About KarSync'}</span>
      </button>
    </div>
  );
}
