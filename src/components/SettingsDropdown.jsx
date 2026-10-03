import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fullSyncBothDirections } from '../services/realtimeSync';
import { 
  Sun, 
  Moon, 
  Cloud, 
  RefreshCw, 
  LogOut, 
  ChevronRight, 
  ChevronLeft,
  Settings,
  Sparkles,
  Download,
  User,
  Users
} from 'lucide-react';
import PermissionGate from './PermissionGate';

export function SettingsDropdown({ 
  isOpen, 
  onClose, 
  theme, 
  toggleTheme, 
  onOpenGlobalSettings,
  onOpenAboutModal,
  onOpenInstallModal,
  onOpenUsersModal
}) {
  const { language, t, direction } = useLanguage();
  const isRtl = direction === 'rtl';
  const { user, logout } = useAuth();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

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
      setSyncStatus(language === 'fa' ? 'همگام شد' : language === 'ku' ? 'هاوکاتکرا' : 'Synced');
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (err) {
      setSyncStatus(language === 'fa' ? 'خطای سینک' : 'Sync Error');
      setTimeout(() => setSyncStatus(''), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const userInitials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'AZ';
  const avatarUrl = user?.avatar || user?.photo || user?.supabaseUser?.user_metadata?.avatar_url;
  const userTitle = user?.title || (language === 'fa' ? 'مدیر ارشد کارگاه' : 'بەڕێوەبەری پڕۆژە');

  return (
    <div 
      ref={dropdownRef}
      className={`absolute top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white/70 dark:bg-slate-950/70 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/60 dark:border-white/15 rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.2),inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.15)] z-50 p-2 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 select-none ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto`}
    >
      {/* 1. User Identity Card Header */}
      <div className="p-3 mb-1.5 bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-800/60 dark:to-slate-800/30 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.name || 'User'}
            className="w-12 h-12 rounded-2xl object-cover border-2 border-sky-500/30 shadow-md flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-sky-500/20 flex-shrink-0">
            {userInitials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {user?.name || (language === 'fa' ? 'مدیر سیستم' : 'بەڕێوەبەری سیستەم')}
            </h4>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
              Admin
            </span>
          </div>
          <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 truncate mt-0.5">
            {userTitle}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
            {user?.email || 'admin@karsync.com'}
          </p>
        </div>
      </div>

      {/* 2. Prominent Primary Action: Open Global Settings Hub */}
      <button
        type="button"
        onClick={() => {
          onClose();
          if (onOpenGlobalSettings) onOpenGlobalSettings('general');
        }}
        className="w-full p-2.5 mb-1.5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-sky-500/10 hover:from-sky-500/15 hover:via-indigo-500/15 hover:to-sky-500/15 border border-sky-500/30 text-sky-900 dark:text-sky-200 flex items-center justify-between transition-all group shadow-2xs"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
          </div>
          <div className="text-start">
            <div className="text-xs font-bold leading-tight">
              {language === 'fa' ? 'تنظیمات' : language === 'ku' ? 'ڕێکخستنەکان' : 'Settings'}
            </div>
            <div className="text-[10px] text-sky-600/70 dark:text-sky-400/70 mt-0.5">
              {language === 'fa' ? 'پروژه‌ها، سرفصل‌ها، تم و دیتابیس' : 'پڕۆژەکان، ڕووکار و بنکەدراوە'}
            </div>
          </div>
        </div>
        {isRtl ? <ChevronLeft className="w-4 h-4 text-sky-600 dark:text-sky-400 group-hover:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-4 h-4 text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform" />}
      </button>

      {/* 3. Fast Micro-Toggles Section (Language removed per request) */}
      <div className="space-y-0.5 py-1">
        {/* Quick Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span>{language === 'fa' ? 'حالت شب / روز' : language === 'ku' ? 'دۆخی شەو / ڕۆژ' : 'Dark / Light Mode'}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {theme === 'dark' ? (language === 'fa' ? 'تاریک' : 'Dark') : (language === 'fa' ? 'روشن' : 'Light')}
          </span>
        </button>

        {/* Quick Cloud Sync */}
        <button
          type="button"
          onClick={handleCloudSync}
          disabled={isSyncing}
          className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-emerald-500" />
            <span>{language === 'fa' ? 'همگام‌سازی ابری' : language === 'ku' ? 'هاوکاتکردنی هەور' : 'Cloud Sync'}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            {syncStatus ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{syncStatus}</span>
            ) : (
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-500' : ''}`} />
            )}
          </div>
        </button>

        {/* PWA Install Quick Action */}
        <button
          type="button"
          onClick={() => {
            onClose();
            if (onOpenInstallModal) onOpenInstallModal();
          }}
          className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors text-slate-800 dark:text-slate-200"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-amber-500" />
            <span>{language === 'fa' ? 'نصب اپلیکیشن KarSync' : 'Install KarSync App'}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
            PWA
          </span>
        </button>


      </div>
      <div className="my-1 border-t border-slate-200/60 dark:border-white/10"></div>

      {/* 4. Logout Action */}
      <button
        type="button"
        onClick={() => {
          onClose();
          if (window.confirm(t('logoutConfirm') || (language === 'fa' ? 'آیا مطمئن هستید که می‌خواهید از حساب خود خارج شوید؟' : 'Are you sure you want to sign out?'))) {
            logout();
          }
        }}
        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 dark:hover:bg-rose-500/20 transition-colors"
      >
        <LogOut className="w-4 h-4 text-rose-500" />
        <span>{language === 'fa' ? 'خروج از حساب' : language === 'ku' ? 'چوونەدەرەوە' : 'Sign Out'}</span>
      </button>

      {/* 5. Version Info Link */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            if (onOpenGlobalSettings) onOpenGlobalSettings('about');
            else if (onOpenAboutModal) onOpenAboutModal();
          }}
          className="w-full py-1 text-center text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-sky-500" />
          <span>KarSync v1.2.0 PWA</span>
        </button>
      </div>
    </div>
  );
}
