import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
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
  Users2,
  UserCheck,
  FolderKanban,
  Keyboard,
  ShieldCheck,
  Building,
  Landmark,
  CheckCircle2,
  Building2,
  Copy,
  Check
} from 'lucide-react';

const SETTINGS_DROPDOWN_COPY = {
  fa: {
    synced: 'همگام شد',
    syncError: 'خطا در همگام‌سازی',
    userTitle: 'مدیر ارشد کارگاه',
    mainProject: 'پروژه مرکزی',
    accountShortcutTitle: 'ورود به مشخصات و امنیت حساب',
    systemAdmin: 'مدیر سیستم',
    adminBadge: 'مدیر',
    manageAccount: 'مدیریت حساب',
    projectsTitle: 'مدیریت پروژه‌ها و کارگاه‌ها',
    activeProjectPrefix: 'کارگاه فعال:',
    cloudSyncTitle: 'همگام‌سازی ابری اطلاعات',
    syncing: 'در حال سینک...',
    sync: 'همگام‌سازی',
    lightModeTitle: 'حالت روز (روشن)',
    light: 'روز',
    darkModeTitle: 'حالت شب (تاریک)',
    dark: 'شب',
    settingsTitle: 'تنظیمات',
    workers: 'مدیریت پرسنل',
    globalSettingsTitle: 'تنظیمات جامع سیستم',
    globalSettingsDesc: 'ظاهر، زبان، مالی، کارگاه‌ها و دیتابیس',
    users: 'کاربران',
    accountsTitle: 'حساب‌ها و کارت‌های بانکی',
    accounts: 'حساب‌ها',
    shortcuts: 'کلید میانبر',
    installPwa: 'نصب اپلیکیشن روی دستگاه',
    productTour: 'تور معرفی برنامه',
    setupChecklist: 'چک‌لیست راه‌اندازی کارگاه',
    logoutConfirm: 'آیا مطمئن هستید که می‌خواهید از حساب خود خارج شوید؟',
    logout: 'خروج از حساب کاربری',
    aboutSystem: 'درباره سیستم'
  },
  ku: {
    synced: 'هاوکاتکرا',
    syncError: 'هەڵە لە هاوکاتکردن',
    userTitle: 'بەڕێوەبەری باڵای کارگە',
    mainProject: 'پڕۆژەی سەرەکی',
    accountShortcutTitle: 'زانیاری و ئاسایشی هەژمار',
    systemAdmin: 'بەڕێوەبەری سیستەم',
    adminBadge: 'بەڕێوەبەر',
    manageAccount: 'بەڕێوەبردنی هەژمار',
    projectsTitle: 'بەڕێوەبردنی پڕۆژە و کارگەکان',
    activeProjectPrefix: 'کارگەی چالاک:',
    cloudSyncTitle: 'هاوکاتکردنی هەوریی زانیارییەکان',
    syncing: 'هاوکات دەکرێت...',
    sync: 'هاوکاتکردن',
    lightModeTitle: 'دۆخی ڕۆژ (ڕووناک)',
    light: 'ڕۆژ',
    darkModeTitle: 'دۆخی شەو (تاریک)',
    dark: 'شەو',
    settingsTitle: 'ڕێکخستنەکان',
    workers: 'بەڕێوەبردنی کرێکاران',
    globalSettingsTitle: 'ڕێکخستنە گشتییەکانی سیستەم',
    globalSettingsDesc: 'ڕووکار، زمان، دارایی، کارگەکان و داتابەیس',
    users: 'بەکارهێنەران',
    accountsTitle: 'حیساب و کارتە بانکییەکان',
    accounts: 'حیسابەکان',
    shortcuts: 'شۆرتکاتەکان',
    installPwa: 'دامەزراندنی ئەپ لەسەر ئامێر',
    productTour: 'گەشتی ناساندنی بەرنامە',
    setupChecklist: 'چک‌لیستی قۆناغەکانی کارگە',
    logoutConfirm: 'ئایا دڵنیایت لە چوونەدەرەوە لە هەژمارەکەت؟',
    logout: 'چوونەدەرەوە لە هەژمار',
    aboutSystem: 'دەربارەی سیستەم'
  },
  en: {
    synced: 'Synced',
    syncError: 'Sync Error',
    userTitle: 'Senior Workshop Manager',
    mainProject: 'Main Project',
    accountShortcutTitle: 'Account Profile & Security',
    systemAdmin: 'System Admin',
    adminBadge: 'Admin',
    manageAccount: 'Manage Account',
    projectsTitle: 'Projects & Sites Management',
    activeProjectPrefix: 'Active Project:',
    cloudSyncTitle: 'Cloud Data Synchronization',
    syncing: 'Syncing...',
    sync: 'Sync',
    lightModeTitle: 'Light Mode',
    light: 'Light',
    darkModeTitle: 'Dark Mode',
    dark: 'Dark',
    settingsTitle: 'Settings',
    workers: 'Personnel',
    globalSettingsTitle: 'Global System Settings',
    globalSettingsDesc: 'Appearance, Language, Finance, Projects & DB',
    users: 'Users',
    accountsTitle: 'Bank Accounts & Cards',
    accounts: 'Accounts',
    shortcuts: 'Shortcuts',
    installPwa: 'Install App on Device',
    productTour: 'Product Tour',
    setupChecklist: 'Setup Checklist',
    logoutConfirm: 'Are you sure you want to sign out?',
    logout: 'Sign Out',
    aboutSystem: 'About System'
  }
};

export function SettingsDropdown({ 
  isOpen, 
  onClose, 
  theme, 
  toggleTheme, 
  onOpenGlobalSettings,
  onOpenAboutModal,
  onOpenInstallModal
}) {
  const { language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = SETTINGS_DROPDOWN_COPY[langKey] || SETTINGS_DROPDOWN_COPY.fa;
  const isRtl = direction === 'rtl';

  const { user, logout } = useAuth();
  const { currentProject } = useProject();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [copiedWsCode, setCopiedWsCode] = useState(false);
  const activeWorkspace = useLiveQuery(async () => {
    try {
      if (db.workspaces) {
        const list = await db.workspaces.toArray();
        return list[0] || null;
      }
    } catch (_) {}
    return null;
  }, []);
  const displayWsCode = user?.workspaceCode || activeWorkspace?.workspace_code || 'KARS-101';

  const handleCopyWsCode = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(displayWsCode);
    setCopiedWsCode(true);
    setTimeout(() => setCopiedWsCode(false), 2000);
  };

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
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('');
    try {
      await fullSyncBothDirections();
      setSyncStatus(c.synced);
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (err) {
      setSyncStatus(c.syncError);
      setTimeout(() => setSyncStatus(''), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenTab = (tabId) => {
    onClose();
    if (onOpenGlobalSettings) {
      onOpenGlobalSettings(tabId);
    }
  };

  const userInitials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'AZ';
  const avatarUrl = user?.avatar || user?.photo || user?.supabaseUser?.user_metadata?.avatar_url;
  const userTitle = user?.title || c.userTitle;
  const projectName = currentProject?.name || c.mainProject;

  return (
    <div 
      ref={dropdownRef}
      className={`absolute top-full mt-2 w-80 sm:w-84 max-w-[calc(100vw-1.5rem)] bg-white/70 dark:bg-slate-950/70 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/60 dark:border-white/15 rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.2),inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.15)] z-[60] p-2.5 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 select-none ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto space-y-2`}
    >
      {/* 1. Glass User Identity Card with Direct Profile/Security Shortcut */}
      <div 
        onClick={() => handleOpenTab('account')}
        className="group relative p-3 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] border border-white/60 dark:border-white/10 transition-all cursor-pointer shadow-2xs"
        title={c.accountShortcutTitle}
      >
        <div className="flex items-center gap-3">
          {/* Avatar with Ring */}
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.name || c.systemAdmin}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-sky-500/40 shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-sky-500/20">
                {userInitials}
              </div>
            )}
            <span className="absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full shadow-2xs" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {user?.name || c.systemAdmin}
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                {c.adminBadge}
              </span>
            </div>

            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {userTitle}
            </div>

            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="truncate">{user?.email || 'admin@karsync.com'}</span>
              <span className="text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold flex items-center gap-0.5 flex-shrink-0">
                {c.manageAccount}
                {isRtl ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </span>
            </div>

            {/* Copyable Workshop Code Pill */}
            <div 
              onClick={handleCopyWsCode}
              title={copiedWsCode ? c.copied : `${c.workshopCode} ${displayWsCode}`}
              className="mt-2 inline-flex items-center justify-between w-full px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/20 transition-all cursor-pointer group/ws text-[11px]"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Building2 className="w-3 h-3 text-sky-500 flex-shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 font-medium text-[10px]">{c.workshopCode}</span>
                <span className="font-mono font-bold tracking-wider">{displayWsCode}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                {copiedWsCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">{c.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 opacity-60 group-hover/ws:opacity-100 transition-opacity" />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. High-Efficiency Quick Toolbar (Sync & Theme [APP_THEME_BUTTON]) */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/5">
        {/* Quick Cloud Sync */}
        <button
          type="button"
          onClick={handleCloudSync}
          disabled={isSyncing}
          className="py-2 px-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/60 dark:border-white/10 flex items-center justify-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-2xs group"
          title={c.cloudSyncTitle}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          <span className="truncate">
            {isSyncing ? c.syncing : syncStatus || c.sync}
          </span>
        </button>

        {/* [APP_THEME_BUTTON] Compact Day/Night Segmented Control */}
        <div className="flex rounded-xl bg-slate-200/60 dark:bg-slate-950/60 p-0.5 border border-slate-300/40 dark:border-white/5">
          <button
            type="button"
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`flex-1 py-1 px-1.5 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold transition-all duration-300 ease-in-out ${
              theme === 'light'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
            title={c.lightModeTitle}
          >
            <Sun className="w-3.5 h-3.5" />
            {theme === 'light' && <span>{c.light}</span>}
          </button>
          <button
            type="button"
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`flex-1 py-1 px-1.5 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold transition-all duration-300 ease-in-out ${
              theme === 'dark'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
            title={c.darkModeTitle}
          >
            <Moon className="w-3.5 h-3.5" />
            {theme === 'dark' && <span>{c.dark}</span>}
          </button>
        </div>
      </div>

      {/* 4. Large Icon-Only Shortcut Grid (Users, Accounts, Shortcuts, Personnel) */}
      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
        {/* Users */}
        <button
          type="button"
          onClick={() => handleOpenTab('users')}
          className="p-2.5 rounded-2xl bg-white/40 dark:bg-white/[0.03] hover:bg-white/80 dark:hover:bg-white/[0.08] border border-white/50 dark:border-white/5 flex items-center justify-center transition-all group shadow-2xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          title={c.users}
          aria-label={c.users}
        >
          <Users2 className="w-5 h-5 transition-transform group-hover:scale-110" />
        </button>

        {/* Accounts */}
        <button
          type="button"
          onClick={() => handleOpenTab('accounting_accounts')}
          className="p-2.5 rounded-2xl bg-white/40 dark:bg-white/[0.03] hover:bg-white/80 dark:hover:bg-white/[0.08] border border-white/50 dark:border-white/5 flex items-center justify-center transition-all group shadow-2xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          title={c.accountsTitle}
          aria-label={c.accounts}
        >
          <Landmark className="w-5 h-5 transition-transform group-hover:scale-110" />
        </button>

        {/* Shortcuts */}
        <button
          type="button"
          onClick={() => handleOpenTab('shortcuts')}
          className="p-2.5 rounded-2xl bg-white/40 dark:bg-white/[0.03] hover:bg-white/80 dark:hover:bg-white/[0.08] border border-white/50 dark:border-white/5 flex items-center justify-center transition-all group shadow-2xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          title={c.shortcuts}
          aria-label={c.shortcuts}
        >
          <Keyboard className="w-5 h-5 transition-transform group-hover:scale-110" />
        </button>

        {/* Personnel Management (Workers) */}
        <button
          type="button"
          onClick={() => {
            onClose();
            window.dispatchEvent(new CustomEvent('karsync-open-workers-modal'));
          }}
          className="p-2.5 rounded-2xl bg-white/40 dark:bg-white/[0.03] hover:bg-white/80 dark:hover:bg-white/[0.08] border border-white/50 dark:border-white/5 flex items-center justify-center transition-all group shadow-2xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          title={c.workers}
          aria-label={c.workers}
        >
          <UserCheck className="w-5 h-5 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* 5. Lower Actions Section */}
      <div className="border-t border-slate-200/60 dark:border-white/10 pt-1.5 space-y-1">
        {/* Simple Monochrome Settings Button (Moved to next section, above Product Tour) */}
        <button
          type="button"
          onClick={() => handleOpenTab('general')}
          className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors text-slate-700 dark:text-slate-200 group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:rotate-45 transition-transform duration-300" />
            <span>{c.settingsTitle}</span>
          </div>
          {isRtl ? (
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          )}
        </button>

        {/* Product Tour Action (Monochrome icon, no badge) */}
        <button
          type="button"
          onClick={() => {
            onClose();
            window.dispatchEvent(new CustomEvent('karsync-start-tour'));
          }}
          className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors text-slate-700 dark:text-slate-200 group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform" />
            <span>{c.productTour}</span>
          </div>
        </button>

        {/* PWA Install Quick Action (Monochrome icon, no badge) */}
        <button
          type="button"
          onClick={() => {
            onClose();
            if (onOpenInstallModal) onOpenInstallModal();
          }}
          className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.08] transition-colors text-slate-700 dark:text-slate-200 group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform" />
            <span>{c.installPwa}</span>
          </div>
        </button>

        {/* Logout Action (Keeps distinct danger rose styling) */}
        <button
          type="button"
          onClick={() => {
            onClose();
            if (window.confirm(c.logoutConfirm)) {
              logout();
            }
          }}
          className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 dark:hover:bg-rose-500/20 transition-colors"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span>{c.logout}</span>
        </button>
      </div>

      {/* Footer Version Info */}
      <div className="pt-1 border-t border-slate-200/40 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-sky-500" />
          <span>KarSync v0.9.0</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            if (onOpenGlobalSettings) onOpenGlobalSettings('about');
            else if (onOpenAboutModal) onOpenAboutModal();
          }}
          className="hover:text-sky-500 transition-colors font-medium"
        >
          {c.aboutSystem}
        </button>
      </div>
    </div>
  );
}
