import React, { useState, useRef } from 'react';
import {
  Cloud,
  RefreshCw,
  Database,
  Download,
  Upload,
  Check,
  AlertCircle,
  AlertTriangle,
  FolderKanban,
  Users2,
  Calendar,
  Wallet,
  Receipt,
  Layers,
  Building,
  Activity,
  FileJson,
  ShieldCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  History,
  Clock,
  Sparkles,
  RotateCcw,
  Trash2,
  CheckCircle2,
  HardDrive,
  CalendarClock,
  Settings2,
  FolderSync,
  FolderCheck,
  FolderPlus,
  FolderOpen
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAutoBackup } from '../../hooks/useAutoBackup';

export default function DataSyncSettingsTab({
  language = 'fa',
  isRtl = true,
  dbCounts,
  isSyncing,
  syncStatusMsg,
  handleManualSync,
  handleDownloadBackup,
  handleImportBackup,
  restoreMode,
  setRestoreMode,
  backupFile,
  setBackupFile,
  backupLoading,
  backupMsg
}) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Time Machine & Auto-Backup hook
  const {
    snapshots = [],
    config: autoBackupConfig,
    updateConfig: updateAutoBackupConfig,
    lastBackupAt,
    isTakingSnapshot,
    actionLoadingId,
    triggerManualSnapshot,
    handleRestore,
    handleDelete,
    handleDownload,
    dirStatus,
    isConnectingDir,
    connectDirectory,
    disconnectDirectory,
    testDirectorySync
  } = useAutoBackup();

  // Restore confirmation modal state
  const [confirmModalSnap, setConfirmModalSnap] = useState(null);
  const [confirmModalMode, setConfirmModalMode] = useState('replace');
  const [isRestoringSnap, setIsRestoringSnap] = useState(false);

  // Grouped DB counts
  const operationalData = [
    {
      id: 'workers',
      label: language === 'fa' ? 'پرسنل فعال' : language === 'ku' ? 'کرێکارانی چالاک' : 'Active Workers',
      count: dbCounts.workers,
      sub: language === 'fa' ? `از کل ${dbCounts.totalWorkers} پرونده` : language === 'ku' ? `لە کۆی ${dbCounts.totalWorkers}` : `Out of ${dbCounts.totalWorkers} total`,
      icon: Users2,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10 dark:bg-sky-500/20'
    },
    {
      id: 'logs',
      label: language === 'fa' ? 'لاگ‌های تردد و کارکرد' : language === 'ku' ? 'تۆماری ئامادەبوون' : 'Attendance Logs',
      count: dbCounts.logs,
      sub: language === 'fa' ? 'ثبت‌های روزانه حضور' : language === 'ku' ? 'تۆمارە ڕۆژانەکان' : 'Daily work logs',
      icon: Calendar,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20'
    },
    {
      id: 'payments',
      label: language === 'fa' ? 'پرداخت‌ها و مساعده‌ها' : language === 'ku' ? 'پێشەکی و پارەدان' : 'Payments & Advances',
      count: dbCounts.payments,
      sub: language === 'fa' ? 'اسناد و رسیدهای تسویه' : language === 'ku' ? 'پسووڵەی پارەدان' : 'Settlement receipts',
      icon: Wallet,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 dark:bg-amber-500/20'
    },
    {
      id: 'expenses',
      label: language === 'fa' ? 'فاکتورهای هزینه' : language === 'ku' ? 'خەرجییەکان' : 'Expenses & Bills',
      count: dbCounts.expenses,
      sub: language === 'fa' ? 'هزینه‌ها و مخارج جاری' : language === 'ku' ? 'پسووڵەی خەرجی' : 'Operational invoices',
      icon: Receipt,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 dark:bg-rose-500/20'
    }
  ];

  const structuralData = [
    {
      id: 'projects',
      label: language === 'fa' ? 'پروژه‌ها و کارگاه‌ها' : language === 'ku' ? 'پڕۆژەکان' : 'Projects & Sites',
      count: dbCounts.projects,
      sub: language === 'fa' ? 'محیط‌های کاری فعال' : language === 'ku' ? 'پڕۆژەی چالاک' : 'Active workspaces',
      icon: FolderKanban,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 dark:bg-blue-500/20'
    },
    {
      id: 'sections',
      label: language === 'fa' ? 'بخش‌ها و فازها' : language === 'ku' ? 'بەشەکانی پڕۆژە' : 'Project Sections',
      count: dbCounts.sections,
      sub: language === 'fa' ? 'فازها و زون‌های کاری' : language === 'ku' ? 'زۆن و بەشەکان' : 'Zones & phases',
      icon: Building,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10 dark:bg-indigo-500/20'
    },
    {
      id: 'categories',
      label: language === 'fa' ? 'سرفصل‌های هزینه‌ها' : language === 'ku' ? 'سەردێڕەکان' : 'Expense Categories',
      count: dbCounts.categories,
      sub: language === 'fa' ? 'دسته‌بندی ۳ سطحی' : language === 'ku' ? 'سەردێڕی خەرجی' : 'Hierarchical headers',
      icon: Layers,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 dark:bg-purple-500/20'
    },
    {
      id: 'groups',
      label: language === 'fa' ? 'تیم‌ها و گروه‌های کاری' : language === 'ku' ? 'گرووپەکان' : 'Working Teams',
      count: dbCounts.groups,
      sub: language === 'fa' ? 'اکیپ‌ها و کارگروه‌ها' : language === 'ku' ? 'گرووپی کارمەندان' : 'Worker crews',
      icon: Users2,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10 dark:bg-cyan-500/20'
    }
  ];

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.json')) {
        setBackupFile(file);
      }
    }
  };

  // Date formatter for snapshots
  const formatSnapshotDate = (isoStr) => {
    if (!isoStr) return t('neverBackedUp');
    try {
      const d = new Date(isoStr);
      if (language === 'fa') {
        return (
          d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) +
          ' ' +
          d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        );
      } else if (language === 'ku') {
        return (
          d.toLocaleDateString('ckb', { year: 'numeric', month: 'short', day: 'numeric' }) +
          ' ' +
          d.toLocaleTimeString('ckb', { hour: '2-digit', minute: '2-digit' })
        );
      } else {
        return (
          d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) +
          ' ' +
          d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        );
      }
    } catch (_) {
      return isoStr;
    }
  };

  const totalSnapshotsSize = snapshots.reduce((acc, s) => acc + (s.dataSize || 0), 0);
  const formattedSnapshotsSize =
    totalSnapshotsSize > 1024 * 1024
      ? `${(totalSnapshotsSize / (1024 * 1024)).toFixed(2)} MB`
      : `${(totalSnapshotsSize / 1024).toFixed(1)} KB`;

  const intervalPresets = [
    { value: 1, label: t('intervalDaily') },
    { value: 3, label: t('intervalThreeDays') },
    { value: 7, label: t('intervalWeekly') },
    { value: 30, label: t('intervalMonthly') }
  ];

  const maxSnapshotsPresets = [5, 10, 20];

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-150">
      {/* 1. Supabase Cloud Sync Card (Health & Sync Monitor) */}
      <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 border border-sky-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'fa' ? 'سرویس همگام‌سازی ابری (Cloud Sync)' : language === 'ku' ? 'هاوکاتکردنی کلاود (Cloud Sync)' : 'Cloud Sync Engine'}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {language === 'fa' ? 'فعال' : language === 'ku' ? 'چالاک' : 'Active'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'fa'
                  ? 'ارتباط پیوسته با پایگاه داده جهت اشتراک‌گذاری تغییرات میان کاربران.'
                  : language === 'ku'
                  ? 'پەیوەندی بەردەوام بە سێرڤەر بۆ هاوبەشکردنی گۆڕانکارییەکان.'
                  : 'Real-time synchronization with cloud database across workspace devices.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-all duration-200 shadow-xs active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? (language === 'fa' ? 'در حال همگام‌سازی...' : language === 'ku' ? 'هاوکاتکردن...' : 'Syncing...') : (language === 'fa' ? 'همگام‌سازی دستی' : language === 'ku' ? 'هاوکاتکردنی دەستی' : 'Sync Now')}</span>
          </button>
        </div>

        {syncStatusMsg && (
          <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Database Anatomy & Metrics */}
      <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-500" />
            <span>{language === 'fa' ? 'وضعیت پایگاه داده محلی (IndexedDB)' : language === 'ku' ? 'دۆخی داتابەیسی ناوخۆیی' : 'Local Database Status (IndexedDB)'}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'fa'
              ? 'اطلاعات در مرورگر شما به صورت آفلاین ذخیره شده و مستقل از قطعی اینترنت عمل می‌کند.'
              : language === 'ku'
              ? 'داتاکان لەناو مۆبایل یان کۆمپیوتەری خۆت بە شێوەی ئۆفلاین پارێزراون.'
              : 'Workspace records are securely retained offline inside IndexedDB storage.'}
          </p>
        </div>

        {/* Operational Records */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>{language === 'fa' ? 'داده‌های عملیاتی و حسابداری:' : language === 'ku' ? 'داتای کارگێڕی و دارایی:' : 'Operational & Accounting Data:'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {operationalData.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 transition-all hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{item.label}</span>
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${item.bg}`}>
                      <Icon className={`w-3 h-3 ${item.color}`} />
                    </div>
                  </div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">{item.count}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{item.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Structural Records */}
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
            <span>{language === 'fa' ? 'ساختار، پروژه‌ها و دسته‌بندی‌ها:' : language === 'ku' ? 'پڕۆژە و پۆلێنکردن:' : 'Structures, Projects & Headers:'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {structuralData.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 transition-all hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{item.label}</span>
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${item.bg}`}>
                      <Icon className={`w-3 h-3 ${item.color}`} />
                    </div>
                  </div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">{item.count}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{item.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. APPLE LIQUID GLASS TIME MACHINE HUB (ماشین زمان و نقاط بازگشت خودکار) */}
      <div className="p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md shadow-sm space-y-6">
        {/* Header with trigger button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-emerald-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 border border-sky-500/20 shadow-xs">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {t('timeMachineTitle')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{language === 'fa' ? 'هوشمند' : language === 'ku' ? 'زیرەک' : 'Smart'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {t('timeMachineSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => triggerManualSnapshot()}
            disabled={isTakingSnapshot}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 text-white flex items-center justify-center gap-2 transition-all duration-300 shadow-md shadow-primary/20 active:scale-95 flex-shrink-0"
          >
            <Sparkles className={`w-4 h-4 ${isTakingSnapshot ? 'animate-spin' : ''}`} />
            <span>{isTakingSnapshot ? t('creatingSnapshot') : t('createManualSnapshotBtn')}</span>
          </button>
        </div>

        {/* Live Status Pill & Storage Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Status Indicator */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  autoBackupConfig.enabled ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {autoBackupConfig.enabled && (
                <div className="absolute w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {autoBackupConfig.enabled ? t('autoBackupStatusActive') : t('autoBackupStatusDisabled')}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="truncate">{t('lastBackupLabel')} {formatSnapshotDate(lastBackupAt)}</span>
              </div>
            </div>
          </div>

          {/* Storage & Snapshots Count */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-slate-400" />
              <div>
                <div className="text-[11px] text-slate-400">{t('totalSnapshotsStored')}</div>
                <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                  {snapshots.length} / {autoBackupConfig.maxSnapshots} {language === 'fa' ? 'نسخه' : language === 'ku' ? 'وەشان' : 'snapshots'}
                </div>
              </div>
            </div>
            <div className="text-end">
              <div className="text-[10px] text-slate-400">{t('snapshotSizeLabel')}</div>
              <div className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {formattedSnapshotsSize}
              </div>
            </div>
          </div>
        </div>

        {/* Schedule & Retention Controls [APP_THEME_BUTTON] */}
        <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t('autoBackupSettingsTitle')}
              </span>
            </div>

            {/* Toggle Auto Backup */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoBackupConfig.enabled}
                onChange={(e) => updateAutoBackupConfig({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {autoBackupConfig.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 animate-in fade-in">
              {/* Interval Preset Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>{t('backupIntervalLabel')}</span>
                </label>
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  {intervalPresets.map((preset) => {
                    const isSelected = autoBackupConfig.intervalDays === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => updateAutoBackupConfig({ intervalDays: preset.value })}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all duration-300 ease-in-out truncate ${
                          isSelected
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Max Retention Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  <span>{t('maxSnapshotsLabel')}</span>
                </label>
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  {maxSnapshotsPresets.map((count) => {
                    const isSelected = autoBackupConfig.maxSnapshots === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => updateAutoBackupConfig({ maxSnapshots: count })}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all duration-300 ease-in-out ${
                          isSelected
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {count} {language === 'fa' ? 'نسخه' : language === 'ku' ? 'وەشان' : 'snaps'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Snapshots Timeline List */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-500" />
              <span>{t('snapshotsHistoryTitle')}</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              {snapshots.length} {language === 'fa' ? 'نقطه ثبت‌شده' : language === 'ku' ? 'خاڵی تۆمارکراو' : 'points'}
            </span>
          </div>

          {snapshots.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2 bg-slate-50/40 dark:bg-slate-800/20">
              <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {t('noSnapshotsYet')}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {snapshots.map((snap) => {
                const isAuto = snap.triggerType === 'auto';
                const isExport = snap.triggerType === 'export_file';
                const snapSizeKb = snap.dataSize ? (snap.dataSize / 1024).toFixed(1) : '0';
                const totalEntities =
                  (snap.summary?.workersCount || 0) +
                  (snap.summary?.logsCount || 0) +
                  (snap.summary?.expensesCount || 0) +
                  (snap.summary?.paymentsCount || 0);

                return (
                  <div
                    key={snap.id}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Trigger Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isAuto
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : isExport
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                          }`}
                        >
                          {isAuto
                            ? t('triggerAutoBadge')
                            : isExport
                            ? t('triggerExportBadge')
                            : t('triggerManualBadge')}
                        </span>

                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {formatSnapshotDate(snap.createdAt)}
                        </span>

                        <span className="text-[10px] text-slate-400 font-mono">
                          ({snapSizeKb} KB)
                        </span>
                      </div>

                      {/* Summary Metrics Chips */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span>
                          {language === 'fa' ? 'پرسنل:' : language === 'ku' ? 'کرێکار:' : 'Workers:'}{' '}
                          <strong className="text-slate-700 dark:text-slate-200">{snap.summary?.workersCount || 0}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          {language === 'fa' ? 'لاگ‌ها:' : language === 'ku' ? 'تۆمار:' : 'Logs:'}{' '}
                          <strong className="text-slate-700 dark:text-slate-200">{snap.summary?.logsCount || 0}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          {language === 'fa' ? 'فاکتورها:' : language === 'ku' ? 'خەرجی:' : 'Expenses:'}{' '}
                          <strong className="text-slate-700 dark:text-slate-200">{snap.summary?.expensesCount || 0}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          {language === 'fa' ? 'پرداخت‌ها:' : language === 'ku' ? 'پارەدان:' : 'Payments:'}{' '}
                          <strong className="text-slate-700 dark:text-slate-200">{snap.summary?.paymentsCount || 0}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Actions Toolbar [APP_THEME_BUTTON] */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
                      {/* Restore Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModalSnap(snap);
                          setConfirmModalMode('replace');
                        }}
                        disabled={actionLoadingId === snap.id}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500/10 hover:bg-sky-500 text-sky-600 dark:text-sky-400 hover:text-white transition-all flex items-center gap-1.5"
                        title={t('restoreActionBtn')}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('restoreActionBtn')}</span>
                      </button>

                      {/* Download JSON Button */}
                      <button
                        type="button"
                        onClick={() => handleDownload(snap.id)}
                        disabled={actionLoadingId === snap.id}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        title={t('downloadActionBtn')}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('confirmDeleteSnapshot'))) {
                            handleDelete(snap.id);
                          }
                        }}
                        disabled={actionLoadingId === snap.id}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                        title={t('deleteActionBtn')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. NATIVE LOCAL DIRECTORY SYNC (پشتیبان‌گیری روی پوشه فیزیکی سیستم) */}
      <div className="p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-sky-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/20 shadow-xs">
              <FolderSync className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {t('localDirSyncTitle')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {language === 'fa' ? 'دیسک سخت' : language === 'ku' ? 'هارددیسک' : 'Hard Drive'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {t('localDirSyncSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Directory Status Box */}
        {!dirStatus.supported ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{t('dirStatusUnsupported')}</span>
          </div>
        ) : dirStatus.connected ? (
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <FolderCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {t('dirStatusConnected')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                    <span>{t('connectedFolderLabel')}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700/60 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 truncate">
                      {dirStatus.dirName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar [APP_THEME_BUTTON] */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={testDirectorySync}
                  disabled={isConnectingDir}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className={`w-3.5 h-3.5 ${isConnectingDir ? 'animate-spin' : ''}`} />
                  <span>{t('testDirectoryWriteBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={connectDirectory}
                  disabled={isConnectingDir}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 transition-all flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{t('changeDirectoryBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={disconnectDirectory}
                  disabled={isConnectingDir}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t('disconnectDirectoryBtn')}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center flex-shrink-0">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('dirStatusDisconnected')}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'fa'
                    ? 'با انتخاب یک پوشه، نسخه‌های پشتیبان بدون نیاز به اینترنت و بدون باز کردن پنجره دانلود، مستقیماً روی رایانه شما ذخیره می‌شوند.'
                    : language === 'ku'
                    ? 'بە دیاریکردنی بوخچەیەک، فایلەکان بەبێ ئینتەرنێت و بێدەنگ ڕاستەوخۆ لەسەر کۆمپیوتەرەکەت پاشەکەوت دەکرێن.'
                    : 'Select a local directory to silently save scheduled backup files to your hard drive.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={connectDirectory}
              disabled={isConnectingDir}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-all shadow-md shadow-primary/20 active:scale-95 flex items-center justify-center gap-2 flex-shrink-0"
            >
              <FolderPlus className={`w-4 h-4 ${isConnectingDir ? 'animate-spin' : ''}`} />
              <span>{t('selectDirectoryBtn')}</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Physical Backup File Export & Import Hub (برای انتقال دستی بین سیستم‌ها) */}
      <div className="p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-5">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-emerald-500" />
            <span>{language === 'fa' ? 'انتقال فیزیکی فایل (خروجی و ورودی دستی JSON)' : language === 'ku' ? 'گواستنەوەی فیزیکی فایل (JSON)' : 'Physical File Transfer (JSON Export & Import)'}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'fa'
              ? 'جهت جابه‌جایی دستی اطلاعات بین دو دستگاه مختلف یا ذخیره در فلش‌مموری.'
              : language === 'ku'
              ? 'بۆ گواستنەوەی دەستی داتاکان لە نێوان دوو ئامێردا یان هەڵگرتن لەسەر فلاش.'
              : 'Export an external offline file for transferring records to another device or flash drive.'}
          </p>
        </div>

        {/* Quick Export Button */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {language === 'fa' ? 'دانلود فایل کامل پایگاه داده' : language === 'ku' ? 'داگرتنی فایلی تەواوی داتابەیس' : 'Download Full Database Backup'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {language === 'fa' ? 'شامل کلیه پرسنل، لاگ‌ها، پرداخت‌ها، فاکتورها، حساب‌ها و تنظیمات' : language === 'ku' ? 'هەموو داتاکانی کارگە لەخۆدەگرێت' : 'Includes all workers, logs, expenses, payments and accounts'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={backupLoading}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-sm active:scale-95 flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'fa' ? 'دانلود فایل JSON' : language === 'ku' ? 'داگرتنی JSON' : 'Export JSON'}</span>
          </button>
        </div>

        {/* Restore Section with Segmented Mode Selector [APP_THEME_BUTTON] */}
        <div className="pt-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ArrowUpFromLine className="w-4 h-4 text-sky-500" />
                <span>{language === 'fa' ? 'بازیابی اطلاعات از فایل خارجی:' : language === 'ku' ? 'گەڕاندنەوەی زانیارییەکان لە فایلی دەرەکی:' : 'Import Records from External JSON:'}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {language === 'fa' ? 'شیوه بازنویسی داده‌ها را انتخاب کنید:' : language === 'ku' ? 'شێوازی گەڕاندنەوە دیاریبکە:' : 'Select database write mode:'}
              </div>
            </div>

            {/* Segmented Control [APP_THEME_BUTTON] */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs self-start sm:self-center">
              <button
                type="button"
                onClick={() => setRestoreMode('replace')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ease-in-out ${
                  restoreMode === 'replace'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {restoreMode === 'replace' && (
                  <span>{language === 'fa' ? 'جایگزینی کامل (Clean)' : language === 'ku' ? 'جێگرتنەوەی تەواو' : 'Clean Replace'}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRestoreMode('merge')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ease-in-out ${
                  restoreMode === 'merge'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {restoreMode === 'merge' && (
                  <span>{language === 'fa' ? 'ادغام با موجودی (Merge)' : language === 'ku' ? 'تێکەڵکردن' : 'Merge Records'}</span>
                )}
              </button>
            </div>
          </div>

          {/* Warning for Clean Replace */}
          {restoreMode === 'replace' && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                {language === 'fa'
                  ? 'هشدار: در حالت جایگزینی کامل، تمامی اطلاعات فعلی حذف شده و داده‌های موجود در فایل JSON از نو ثبت می‌گردند.'
                  : language === 'ku'
                  ? 'ئاگاداری: هەموو داتاکانی ئێستا دەسڕدرێنەوە و داتای ناو فایلەکە جێگیر دەبێت.'
                  : 'Warning: Clean replace will clear all current workspace data and replace it with data from the JSON file.'}
              </span>
            </div>
          )}

          {/* Interactive Drag & Drop Box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-200 ${
              isDragOver
                ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20'
                : backupFile
                ? 'border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                : 'border-slate-300 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-600 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setBackupFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {backupFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileJson className="w-8 h-8 text-emerald-500" />
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{backupFile.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({(backupFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBackupFile(null);
                  }}
                  className="text-[11px] text-rose-500 hover:underline flex items-center gap-1 mt-1"
                >
                  <X className="w-3 h-3" />
                  <span>{language === 'fa' ? 'حذف و انتخاب فایل دیگر' : language === 'ku' ? 'لابردن' : 'Remove & choose another'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="w-7 h-7 text-slate-400 mb-1" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'fa' ? 'فایل JSON را به اینجا بکشید یا برای انتخاب کلیک کنید' : language === 'ku' ? 'فایلی JSON لێرە دابنێ' : 'Drag & drop backup JSON file here or click to browse'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {language === 'fa' ? 'پشتیبانی از فایل‌های پشتیبان استاندارد کارسینک' : language === 'ku' ? 'پشتیوانی فایلی ستانداردی KarSync' : 'Supports standard KarSync JSON export snapshots'}
                </div>
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImportBackup}
              disabled={!backupFile || backupLoading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/20 active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>{backupLoading ? (language === 'fa' ? 'در حال بازیابی...' : language === 'ku' ? 'هێنانەوە...' : 'Restoring...') : (language === 'fa' ? 'تایید و بازیابی اطلاعات' : language === 'ku' ? 'هێنانەوەی داتا' : 'Confirm & Restore Data')}</span>
            </button>
          </div>

          {/* Feedback Message */}
          {backupMsg.text && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                backupMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {backupMsg.type === 'success' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{backupMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION RESTORE MODAL (Apple Liquid Glass) */}
      {confirmModalSnap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-white/60 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 border border-sky-500/20">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('confirmRestoreTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {t('confirmRestoreDesc')}
                </p>
              </div>
            </div>

            {/* Target snapshot details */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>{formatSnapshotDate(confirmModalSnap.createdAt)}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {language === 'fa' ? 'شناسه نسخه:' : language === 'ku' ? 'ناسنامەی وەشان:' : 'Snapshot ID:'}{' '}
                <span className="font-mono text-slate-600 dark:text-slate-300">{confirmModalSnap.id}</span>
              </div>
            </div>

            {/* Mode selection */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'نحوه اعمال بازگشت:' : language === 'ku' ? 'شێوازی گەڕاندنەوە:' : 'Rollback Mode:'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmModalMode('replace')}
                  className={`p-3 rounded-2xl border text-start transition-all ${
                    confirmModalMode === 'replace'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">
                    {language === 'fa' ? 'جایگزینی کامل' : language === 'ku' ? 'جێگرتنەوەی تەواو' : 'Clean Replace'}
                  </div>
                  <div className="text-[10px] opacity-75 mt-0.5">
                    {language === 'fa' ? 'داده‌های فعلی با این نسخه جایگزین می‌شوند' : language === 'ku' ? 'داتاکانی ئێستا دەسڕدرێنەوە' : 'Overwrite current data'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmModalMode('merge')}
                  className={`p-3 rounded-2xl border text-start transition-all ${
                    confirmModalMode === 'merge'
                      ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">
                    {language === 'fa' ? 'ادغام اطلاعات' : language === 'ku' ? 'تێکەڵکردنی داتا' : 'Merge Data'}
                  </div>
                  <div className="text-[10px] opacity-75 mt-0.5">
                    {language === 'fa' ? 'رکوردها بدون حذف موارد جدید اضافه می‌شوند' : language === 'ku' ? 'تێکەڵ دەکرێت بەبێ سڕینەوە' : 'Merge without clearing new'}
                  </div>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalSnap(null)}
                disabled={isRestoringSnap}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                {language === 'fa' ? 'انصراف' : language === 'ku' ? 'پاشگەزبوونەوە' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsRestoringSnap(true);
                    await handleRestore(confirmModalSnap.id, confirmModalMode);
                    setConfirmModalSnap(null);
                  } finally {
                    setIsRestoringSnap(false);
                  }
                }}
                disabled={isRestoringSnap}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRestoringSnap ? 'animate-spin' : ''}`} />
                <span>
                  {isRestoringSnap
                    ? language === 'fa' ? 'در حال بازیابی...' : language === 'ku' ? 'هێنانەوە...' : 'Restoring...'
                    : language === 'fa' ? 'تأیید و بازگشت' : language === 'ku' ? 'پشتڕاستکردنەوە' : 'Confirm Rollback'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
