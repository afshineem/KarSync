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
  X
} from 'lucide-react';

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
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Grouped DB counts
  const operationalData = [
    {
      id: 'workers',
      label: language === 'fa' ? 'پرسنل فعال' : 'کرێکارانی چالاک',
      count: dbCounts.workers,
      sub: language === 'fa' ? `از کل ${dbCounts.totalWorkers} پرونده` : `لە کۆی ${dbCounts.totalWorkers}`,
      icon: Users2,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10 dark:bg-sky-500/20'
    },
    {
      id: 'logs',
      label: language === 'fa' ? 'لاگ‌های تردد و کارکرد' : 'تۆماری ئامادەبوون',
      count: dbCounts.logs,
      sub: language === 'fa' ? 'ثبت‌های روزانه حضور' : 'تۆمارە ڕۆژانەکان',
      icon: Calendar,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20'
    },
    {
      id: 'payments',
      label: language === 'fa' ? 'پرداخت‌ها و مساعده‌ها' : 'پێشەکی و پارەدان',
      count: dbCounts.payments,
      sub: language === 'fa' ? 'اسناد و رسیدهای تسویه' : 'پسووڵەی پارەدان',
      icon: Wallet,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 dark:bg-amber-500/20'
    },
    {
      id: 'expenses',
      label: language === 'fa' ? 'فاکتورهای هزینه' : 'خەرجییەکان',
      count: dbCounts.expenses,
      sub: language === 'fa' ? 'هزینه‌ها و مخارج جاری' : 'پسووڵەی خەرجی',
      icon: Receipt,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 dark:bg-rose-500/20'
    }
  ];

  const structuralData = [
    {
      id: 'projects',
      label: language === 'fa' ? 'پروژه‌ها و کارگاه‌ها' : 'پڕۆژەکان',
      count: dbCounts.projects,
      sub: language === 'fa' ? 'محیط‌های کاری فعال' : 'پڕۆژەی چالاک',
      icon: FolderKanban,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 dark:bg-blue-500/20'
    },
    {
      id: 'sections',
      label: language === 'fa' ? 'بخش‌ها و فازها' : 'بەشەکانی پڕۆژە',
      count: dbCounts.sections,
      sub: language === 'fa' ? 'فازها و زون‌های کاری' : 'زۆن و بەشەکان',
      icon: Building,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10 dark:bg-indigo-500/20'
    },
    {
      id: 'categories',
      label: language === 'fa' ? 'سرفصل‌های هزینه‌ها' : 'سەردێڕەکان',
      count: dbCounts.categories,
      sub: language === 'fa' ? 'دسته‌بندی ۳ سطحی' : 'سەردێڕی خەرجی',
      icon: Layers,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 dark:bg-purple-500/20'
    },
    {
      id: 'groups',
      label: language === 'fa' ? 'تیم‌ها و گروه‌های کاری' : 'گرووپەکان',
      count: dbCounts.groups,
      sub: language === 'fa' ? 'اکیپ‌ها و کارگروه‌ها' : 'گرووپی کارمەندان',
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

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-150">
      
      {/* 1. Supabase Cloud Sync Card (Health & Sync Monitor) */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              navigator.onLine 
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}>
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'fa' ? 'مرکز همگام‌سازی ابری زنده' : 'ناوەندی هاوکاتکردنی هەوری'}
                </h4>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  navigator.onLine 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${navigator.onLine ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{navigator.onLine ? (language === 'fa' ? 'آنلاین و متصل' : 'سەرهێڵ') : (language === 'fa' ? 'آفلاین' : 'ئۆفلاین')}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'fa'
                  ? 'ارتباط دوطرفه با پایگاه داده ابری Supabase • ذخیره‌سازی محلی در دیتابیس دستگاه (IndexedDB)'
                  : 'پەیوەندی دوولایەنە لەگەڵ بنکەدراوەی Supabase'}
              </p>
            </div>
          </div>

          {/* Sync Trigger with [APP_THEME_BUTTON] specification */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 disabled:opacity-50 text-xs font-bold"
              title={language === 'fa' ? 'همگام‌سازی دستی' : 'هاوکاتکردنی دەستی'}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? (language === 'fa' ? 'در حال همگام‌سازی...' : 'هاوکاتکردن...') : (language === 'fa' ? 'همگام‌سازی دستی' : 'هاوکاتکردن')}</span>
            </button>
          </div>
        </div>

        {syncStatusMsg && (
          <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center gap-2 border border-sky-200 dark:border-sky-800 animate-in fade-in">
            <Check className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Structured Local Database Metrics */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-500" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {language === 'fa' ? 'آمار داده‌های محلی و حافظه دستگاه (IndexedDB)' : 'ئاماری داتاکانی ئامێر'}
            </h4>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold">
            {language === 'fa' ? 'وضعیت سلامت: مطلوب' : 'تەندروست'}
          </span>
        </div>

        {/* Section A: Operational Data */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-sky-500" />
            <span>{language === 'fa' ? 'داده‌های عملیاتی و مالی جاری:' : 'داتاکانی کارکردن و دارایی:'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {operationalData.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 transition-all hover:border-slate-300 dark:hover:border-slate-600"
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

        {/* Section B: Structural Data */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-indigo-500" />
            <span>{language === 'fa' ? 'ساختار، پروژه‌ها و دسته‌بندی‌ها:' : 'پڕۆژە و پۆلێنکردن:'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {structuralData.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 transition-all hover:border-slate-300 dark:hover:border-slate-600"
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

      {/* 3. Modern Backup & Restore Dropzone Hub */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-5">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-emerald-500" />
            <span>{language === 'fa' ? 'پشتیبان‌گیری و بازیابی داده‌ها (Backup & Restore)' : 'پاشەکەوت و هێنانەوەی داتا'}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'fa'
              ? 'دریافت خروجی کامل و آفلاین از تمامی اطلاعات سیستم به فرمت استاندارد JSON جهت نگهداری یا انتقال بین سیستم‌ها.'
              : 'داگرتن یان هێنانەوەی فایلی یەدەگی JSON بۆ پاراستنی داتاکان.'}
          </p>
        </div>

        {/* Quick Export Button */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {language === 'fa' ? 'دانلود فایل نسخه پشتیبان (Export Database)' : 'داگرتنی فایلی یەدەگی سیستم'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {language === 'fa' ? 'شامل کلیه پرسنل، لاگ‌ها، پرداخت‌ها، فاکتورها و تنظیمات' : 'هەموو داتاکانی کارگە لەخۆدەگرێت'}
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
            <span>{language === 'fa' ? 'دانلود فایل JSON' : 'داگرتنی JSON'}</span>
          </button>
        </div>

        {/* Restore Section with Segmented Mode Selector [APP_THEME_BUTTON] */}
        <div className="pt-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ArrowUpFromLine className="w-4 h-4 text-sky-500" />
                <span>{language === 'fa' ? 'بازیابی اطلاعات از فایل پشتیبان (Restore):' : 'گەڕاندنەوەی زانیارییەکان:'}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {language === 'fa' ? 'شیوه بازنویسی داده‌ها را انتخاب کنید:' : 'شێوازی گەڕاندنەوە دیاریبکە:'}
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
                  <span>{language === 'fa' ? 'جایگزینی کامل (Clean)' : 'جێگرتنەوەی تەواو'}</span>
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
                  <span>{language === 'fa' ? 'ادغام با موجودی (Merge)' : 'تێکەڵکردن'}</span>
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
                  : 'ئاگاداری: هەموو داتاکانی ئێستا دەسڕدرێنەوە و داتای ناو فایلەکە جێگیر دەبێت.'}
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
                  <span>{language === 'fa' ? 'حذف و انتخاب فایل دیگر' : 'لابردن'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="w-7 h-7 text-slate-400 mb-1" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'fa' ? 'فایل JSON را به اینجا بکشید یا برای انتخاب کلیک کنید' : 'فایلی JSON لێرە دابنێ'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {language === 'fa' ? 'پشتیبانی از فایل‌های پشتیبان استاندارد کارسینک' : 'پشتیوانی فایلی ستانداردی KarSync'}
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
              <span>{backupLoading ? (language === 'fa' ? 'در حال بازیابی...' : 'هێنانەوە...') : (language === 'fa' ? 'تایید و بازیابی اطلاعات' : 'هێنانەوەی داتا')}</span>
            </button>
          </div>

          {/* Feedback Message */}
          {backupMsg.text && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
              backupMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}>
              {backupMsg.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{backupMsg.text}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
