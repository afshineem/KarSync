import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  CheckCircle2, 
  Circle, 
  ChevronUp, 
  ChevronDown, 
  Sparkles, 
  X, 
  ArrowLeft, 
  ArrowRight, 
  FolderKanban, 
  Layers, 
  Wallet, 
  Users, 
  UserPlus, 
  CalendarCheck2, 
  Trophy, 
  RotateCcw
} from 'lucide-react';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';

export function FloatingSetupChecklist() {
  const { t, language, direction } = useLanguage();
  const { user } = useAuth();
  const { openProjectSettings, openGlobalSettings } = useProject();
  const isRtl = direction === 'rtl';

  const userKey = user?.id || user?.userId || "default_user";
  const DISMISS_STORAGE_KEY = "karsync_setup_checklist_dismissed_" + userKey;

  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      // Check both user-scoped key and fallback key
      return localStorage.getItem(DISMISS_STORAGE_KEY) === "true" || localStorage.getItem("karsync_setup_checklist_dismissed") === "true";
    } catch {
      return false;
    }
  });

  // Keep isDismissed in sync when user object finishes loading
  useEffect(() => {
    try {
      const isSavedDismissed = localStorage.getItem(DISMISS_STORAGE_KEY) === "true" || localStorage.getItem("karsync_setup_checklist_dismissed") === "true";
      if (isSavedDismissed) {
        setIsDismissed(true);
      }
    } catch (_) {}
  }, [DISMISS_STORAGE_KEY]);

  const [isExpanded, setIsExpanded] = useState(false);

  // Allow reopening externally from settings or navigation
  useEffect(() => {
    const handleReopen = () => {
      setIsDismissed(false);
      setIsExpanded(true);
      try {
        localStorage.removeItem(DISMISS_STORAGE_KEY);
      } catch (_) {}
    };
    window.addEventListener('karsync-open-setup-checklist', handleReopen);
    return () => window.removeEventListener('karsync-open-setup-checklist', handleReopen);
  }, [DISMISS_STORAGE_KEY]);

  // Reactive Live Queries for task completion detection
  const projectsCount = useLiveQuery(async () => {
    const list = await db.projects?.toArray() || [];
    return list.filter((p) => !p.deletedAt && p.name && p.name !== 'پروژه مرکزی (کارگاه)').length;
  }, []) ?? 0;

  const sectionsCount = useLiveQuery(async () => {
    return await db.projectSections?.count() || 0;
  }, []) ?? 0;

  const accountsCount = useLiveQuery(async () => {
    const list = await db.financialAccounts?.toArray() || [];
    return list.filter((a) => !a.deletedAt && a.status !== 'deleted').length;
  }, []) ?? 0;

  const counterpartiesOrGroupsCount = useLiveQuery(async () => {
    const cCount = await db.counterparties?.count() || 0;
    const gCount = await db.groups?.count() || 0;
    return cCount + gCount;
  }, []) ?? 0;

  const workersCount = useLiveQuery(async () => {
    const list = await db.workers?.toArray() || [];
    return list.filter((w) => !w.deletedAt && w.isActive !== 0).length;
  }, []) ?? 0;

  const logsOrTasksCount = useLiveQuery(async () => {
    const lCount = await db.attendanceLogs?.count() || 0;
    let tCount = 0;
    try {
      if (db.tasks) tCount = await db.tasks.count();
    } catch (_) {}
    return lCount + tCount;
  }, []) ?? 0;

  // Define the 6 Core Setup Tasks
  const tasks = useMemo(() => {
    return [
      {
        id: 'project',
        title: t('setupTask1Title') || (language === 'ku' ? 'پێناسەکردن یان تەواوکردنی یەکەمین پڕۆژە' : language === 'fa' ? 'تعریف یا تکمیل نخستین پروژه' : 'Define or complete first project'),
        desc: t('setupTask1Desc') || (language === 'ku' ? 'زانیاری، دراوی سەرەکی و کاتژمێرەکانی پڕۆژە ڕێکبخە' : language === 'fa' ? 'مشخصات، ارز پایه و ساعات کاری پروژه را تنظیم کنید' : 'Set project name, currency, and standard work hours'),
        icon: FolderKanban,
        isCompleted: projectsCount > 0,
        action: () => {
          if (openProjectSettings) openProjectSettings();
          setIsExpanded(false);
        }
      },
      {
        id: 'sections',
        title: t('setupTask2Title') || (language === 'ku' ? 'زیادکردنی بەشەکانی کار بۆ ناو پڕۆژە' : language === 'fa' ? 'افزودن بخش‌های کاری به پروژه' : 'Add project working sections'),
        desc: t('setupTask2Desc') || (language === 'ku' ? 'بەشەکانی پڕۆژە بۆ پۆلێنکردنی خەرجی و کارکرد دابنێ' : language === 'fa' ? 'فازها یا بخش‌های تفکیکی پروژه را برای دسته‌بندی هزینه و کارکرد ایجاد کنید' : 'Create project sections for tracking costs and tasks'),
        icon: Layers,
        isCompleted: sectionsCount > 0,
        action: () => {
          if (openProjectSettings) openProjectSettings();
          setIsExpanded(false);
        }
      },
      {
        id: 'financials',
        title: t('setupTask3Title') || (language === 'ku' ? 'بەڕێوەبردنی سەرچاوە داراییەکان و دانانی ژمارەحساب' : language === 'fa' ? 'مدیریت منابع مالی و تعریف حساب‌ها' : 'Financial management & accounts'),
        desc: t('setupTask3Desc') || (language === 'ku' ? 'سندووقی کاش، حسابەکانی بانک یان تەنخواهی کارگە تۆمار بکە' : language === 'fa' ? 'صندوق نقد، حساب‌های بانکی یا تنخواه‌گردان کارگاه را ثبت کنید' : 'Register cash register, bank accounts, or petty cash'),
        icon: Wallet,
        isCompleted: accountsCount > 0,
        action: () => {
          if (openGlobalSettings) openGlobalSettings('accounts');
          setIsExpanded(false);
        }
      },
      {
        id: 'counterparties_groups',
        title: t('setupTask4Title') || (language === 'ku' ? 'ناساندنی یەکەمین لایەنی حساب یان گرووپی کار' : language === 'fa' ? 'تعریف اولین طرف‌حساب یا گروه کاری' : 'Create first counterparty or work group'),
        desc: t('setupTask4Desc') || (language === 'ku' ? 'خاوەنکار، بەڵێندەر، فرۆشیاری کەرەستە یان تیمەکانی کار زیاد بکە' : language === 'fa' ? 'کارفرمایان، پیمانکاران، فروشندگان مصالح یا تیم‌های کاری را اضافه کنید' : 'Add employers, contractors, material suppliers, or work teams'),
        icon: Users,
        isCompleted: counterpartiesOrGroupsCount > 0,
        action: () => {
          window.dispatchEvent(new CustomEvent('karsync-open-counterparties-modal'));
          setIsExpanded(false);
        }
      },
      {
        id: 'workers',
        title: t('setupTask5Title') || (language === 'ku' ? 'زیادکردنی یەکەمین کرێکار یان وەستا' : language === 'fa' ? 'افزودن نخستین کارگر یا استادکار' : 'Add first worker or team member'),
        desc: t('setupTask5Desc') || (language === 'ku' ? 'کارمەندان، نرخی کرێی ڕۆژانە و ئۆڤەرتایمیان تۆمار بکە' : language === 'fa' ? 'پرسنل، نرخ دستمزد روزانه و اضافه کاری آن‌ها را ثبت کنید' : 'Register personnel, daily wage rates, and overtime'),
        icon: UserPlus,
        isCompleted: workersCount > 0,
        action: () => {
          window.dispatchEvent(new CustomEvent('karsync-open-new-worker'));
          setIsExpanded(false);
        }
      },
      {
        id: 'attendance_tasks',
        title: t('setupTask6Title') || (language === 'ku' ? 'تۆمارکردنی یەکەمین کارکردی ڕۆژانە یان ئەرک' : language === 'fa' ? 'ثبت نخستین کارکرد روزانه یا تسک' : 'Log first daily attendance or task'),
        desc: t('setupTask6Desc') || (language === 'ku' ? 'ئامادەبوون، ئۆڤەرتایم یان کارە ئەنجامدراوەکانی ئەمڕۆ تۆمار بکە' : language === 'fa' ? 'حضور و غیاب، اضافه کاری یا کارهای انجام‌شده امروز را ثبت نمایید' : 'Record attendance, overtime, or today tasks'),
        icon: CalendarCheck2,
        isCompleted: logsOrTasksCount > 0,
        action: () => {
          window.dispatchEvent(new CustomEvent('karsync-open-daily-logging'));
          setIsExpanded(false);
        }
      }
    ];
  }, [
    projectsCount, 
    sectionsCount, 
    accountsCount, 
    counterpartiesOrGroupsCount, 
    workersCount, 
    logsOrTasksCount, 
    t, 
    language, 
    openProjectSettings, 
    openGlobalSettings
  ]);

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const totalCount = tasks.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isAllComplete = completedCount === totalCount;

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsExpanded(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, "true");
      localStorage.setItem("karsync_setup_checklist_dismissed", "true");
    } catch (_) {}
  };

  const toLocalDigits = (num) => {
    if (language === 'en') return String(num);
    return String(num).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <>
      {/* Backdrop overlay when expanded on mobile */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Floating Widget Container */}
      <div 
        dir={direction}
        className={`fixed z-40 bottom-20 md:bottom-8 ${
          isRtl ? 'right-4 sm:right-8' : 'left-4 sm:left-8'
        } flex flex-col ${isRtl ? 'items-end' : 'items-start'} gap-3 no-print select-none`}
      >
        {/* Expanded Mini-Window (Apple Liquid Glass Card) */}
        {isExpanded && (
          <div className="w-[92vw] sm:w-[420px] max-h-[82vh] flex flex-col rounded-3xl bg-[#f3f6f4]/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/80 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.22)] overflow-hidden animate-in zoom-in-95 fade-in duration-200 origin-bottom">
            
            {/* Header */}
            <div className="relative p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  isAllComplete 
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white' 
                    : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white'
                }`}>
                  {isAllComplete ? <Trophy className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 truncate">
                    {t('setupChecklistTitle') || (language === 'ku' ? 'قۆناغەکانی دەستپێکردنی سیستم' : language === 'fa' ? 'مراحل راه‌اندازی سیستم' : 'System Setup Checklist')}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    {t('setupChecklistSubtitle') || (language === 'ku' ? 'بۆ ڕێکخستنی شوێنی کار ئەم قۆناغانە تەواو بکە' : language === 'fa' ? 'برای راه‌اندازی کارگاه این مراحل را دنبال کنید' : 'Follow these steps to launch your workshop')}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0"
                title={t('close') || 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Progress Bar Section */}
            <div className="px-4 sm:px-5 py-3.5 bg-white/40 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center justify-between gap-2 text-xs font-bold mb-2">
                <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isAllComplete ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                  {isAllComplete ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t('setupAllCompletedTitle') || (language === 'ku' ? 'قۆناغەکان تەواو بوون' : language === 'fa' ? 'تمام مراحل تکمیل شد' : 'All steps completed')}
                    </span>
                  ) : (
                    <span>
                      {toLocalDigits(progressPercent)}٪ {t('completed') || (language === 'ku' ? 'تەواوکراوە' : language === 'fa' ? 'تکمیل شده' : 'completed')}
                    </span>
                  )}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-mono font-bold bg-slate-200/60 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg">
                  {toLocalDigits(completedCount)} / {toLocalDigits(totalCount)}
                </span>
              </div>

              {/* Animated Progress Bar */}
              <div className="h-2 w-full bg-slate-200/80 dark:bg-slate-800/80 rounded-full overflow-hidden p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isAllComplete 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                      : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Scrollable Tasks List */}
            <div className="p-3 sm:p-4 overflow-y-auto max-h-[46vh] space-y-2.5">
              {tasks.map((task, idx) => {
                const IconComponent = task.icon;
                return (
                  <div
                    key={task.id}
                    onClick={task.action}
                    className={`group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                      task.isCompleted
                        ? 'bg-white/40 dark:bg-slate-900/40 border-emerald-200/60 dark:border-emerald-900/40 opacity-80 hover:opacity-100 hover:bg-white/80 dark:hover:bg-slate-800/80'
                        : 'bg-white/90 dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-600/60 shadow-xs hover:shadow-md hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Status Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        task.isCompleted
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60'
                      }`}>
                        {task.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <IconComponent className="w-4 h-4" />
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="min-w-0">
                        <div className={`text-xs sm:text-sm font-bold transition-all ${
                          task.isCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                        }`}>
                          {task.title}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px] sm:max-w-[280px]">
                          {task.desc}
                        </div>
                      </div>
                    </div>

                    {/* Action Arrow / Check Badge */}
                    <div className="shrink-0 flex items-center">
                      {task.isCompleted ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                          {t('done') || 'تکمیل'}
                        </span>
                      ) : (
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/60 transition-all">
                          {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Dock */}
            <div className="p-3.5 sm:p-4 bg-white/80 dark:bg-slate-950/80 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs font-bold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors py-1.5 px-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                {t('setupDismissBtn') || (language === 'ku' ? 'پشتگوێخستن' : language === 'fa' ? 'صرف‌نظر کردن' : 'Dismiss')}
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className={`text-xs font-bold px-4 py-2 rounded-xl text-white shadow-md transition-all active:scale-95 cursor-pointer ${
                  isAllComplete
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                }`}
              >
                {isAllComplete 
                  ? (t('setupDoneAction') || (language === 'ku' ? 'داخستنی لیست' : language === 'fa' ? 'بستن چک‌لیست' : 'Done'))
                  : (t('close') || (language === 'ku' ? 'داخستن' : language === 'fa' ? 'بستن' : 'Close'))}
              </button>
            </div>

          </div>
        )}

        {/* Collapsed Floating Trigger Pill */}
        {!isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="group relative flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl sm:rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/80 dark:border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.22)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          >
            {/* Glowing Icon Orb */}
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl sm:rounded-full flex items-center justify-center text-white shrink-0 shadow-sm transition-transform group-hover:rotate-12 ${
              isAllComplete
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
            }`}>
              {isAllComplete ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>

            {/* Label */}
            <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 whitespace-nowrap">
              {t('setupChecklistFloatingBtn') || (language === 'ku' ? 'تەواوکردنی قۆناغەکان' : language === 'fa' ? 'تکمیل مراحل راه‌اندازی' : 'Setup Checklist')}
            </span>

            {/* Live Progress Fraction / Percentage Badge */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 ${
              isAllComplete
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-blue-100/80 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}>
              <span>{toLocalDigits(completedCount)}/{toLocalDigits(totalCount)}</span>
              {!isAllComplete && (
                <span className="text-[10px] opacity-75">({toLocalDigits(progressPercent)}٪)</span>
              )}
            </div>

            {/* Expand indicator */}
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform group-hover:-translate-y-0.5" />
          </button>
        )}
      </div>
    </>
  );
}
