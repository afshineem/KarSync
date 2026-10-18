import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import {
  Bell,
  BellOff,
  CheckCheck,
  Settings,
  X,
  CalendarClock,
  Wallet,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowUpLeft,
  ArrowUpRight,
  Layers
} from 'lucide-react';

const NOTIFICATION_DROPDOWN_COPY = {
  fa: {
    title: 'مرکز اعلان‌ها و هشدارها',
    activeProjectFallback: 'پروژه فعال',
    markAllAsRead: 'علامت‌گذاری همه به عنوان خوانده‌شده',
    notificationSettings: 'تنظیمات و شخصی‌سازی اعلان‌ها',
    tabs: {
      all: 'همه',
      attendance: 'کارکرد',
      financial: 'مالی',
      system: 'سیستم'
    },
    emptyTitle: 'همه‌چیز مرتب است!',
    emptyDesc: 'در حال حاضر هیچ هشدار یا یادآوری فعالی در این بخش وجود ندارد.',
    dismiss: 'بستن این اعلان',
    customizeRules: 'شخصی‌سازی قوانین و زمان‌بندی اعلان‌ها'
  },
  ku: {
    title: 'ناوەندی ئاگادارکردنەوەکان',
    activeProjectFallback: 'پڕۆژەی چالاک',
    markAllAsRead: 'خوێندنەوەی هەموو',
    notificationSettings: 'ڕێکخستنی ئاگادارکردنەوەکان',
    tabs: {
      all: 'هەموو',
      attendance: 'کارکرد',
      financial: 'دارایی',
      system: 'سیستەم'
    },
    emptyTitle: 'هەموو شتێک ڕێکە!',
    emptyDesc: 'لە ئێستادا هیچ ئاگادارکردنەوەیەکی چالاک لەم بەشەدا نییە.',
    dismiss: 'داخستنی ئەم ئاگادارکردنەوەیە',
    customizeRules: 'ڕێکخستنی یاساکانی ئاگادارکردنەوە'
  },
  en: {
    title: 'Notification Center',
    activeProjectFallback: 'Active Project',
    markAllAsRead: 'Mark all as read',
    notificationSettings: 'Notification Settings',
    tabs: {
      all: 'All',
      attendance: 'Attendance',
      financial: 'Financial',
      system: 'System'
    },
    emptyTitle: 'All caught up!',
    emptyDesc: 'There are no active alerts or reminders in this category right now.',
    dismiss: 'Dismiss',
    customizeRules: 'Customize Notification Rules & Schedule'
  }
};

export function NotificationDropdown({ isOpen, onClose, onOpenNotificationSettings }) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    executeNotificationAction
  } = useNotifications();

  const { language, direction, formatNumber } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = NOTIFICATION_DROPDOWN_COPY[langKey] || NOTIFICATION_DROPDOWN_COPY.fa;

  const { currentProject } = useProject();
  const isRtl = direction === 'rtl';

  const [activeCategory, setActiveCategory] = useState('all');
  const dropdownRef = useRef(null);

  // Close when clicking outside
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

  // Dynamic viewport edge containment (identical to SettingsDropdown)
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

  // Filter tabs adhering strictly to [APP_THEME_BUTTON] specification
  const filterTabs = useMemo(
    () => [
      {
        id: 'all',
        label: c.tabs.all,
        icon: Layers
      },
      {
        id: 'attendance',
        label: c.tabs.attendance,
        icon: CalendarClock
      },
      {
        id: 'financial',
        label: c.tabs.financial,
        icon: Wallet
      },
      {
        id: 'system',
        label: c.tabs.system,
        icon: ShieldAlert
      }
    ],
    [c]
  );

  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    return notifications.filter((n) => n.category === activeCategory);
  }, [notifications, activeCategory]);

  if (!isOpen) return null;

  const getSeverityStyles = (severity, category) => {
    if (severity === 'critical') {
      return {
        icon: AlertCircle,
        badgeBg: 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/25',
        cardBorder: 'border-rose-500/25 dark:border-rose-500/30',
        dotColor: 'bg-rose-500',
        actionBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
      };
    }
    if (severity === 'warning') {
      return {
        icon: AlertTriangle,
        badgeBg: 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/25',
        cardBorder: 'border-amber-500/25 dark:border-amber-500/30',
        dotColor: 'bg-amber-500',
        actionBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
      };
    }
    const CategoryIcon =
      category === 'financial' ? Wallet : category === 'attendance' ? CalendarClock : Info;
    return {
      icon: CategoryIcon,
      badgeBg: 'bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/25',
      cardBorder: 'border-slate-200/70 dark:border-white/10',
      dotColor: 'bg-sky-500',
      actionBtn: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-500/20'
    };
  };

  const ActionArrow = isRtl ? ArrowUpLeft : ArrowUpRight;

  return (
    <div
      ref={dropdownRef}
      dir={direction}
      className="absolute top-full mt-2 w-88 sm:w-96 max-w-[calc(100vw-1.25rem)] bg-white/78 dark:bg-slate-950/78 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/60 dark:border-white/15 rounded-3xl shadow-[0_16px_48px_0_rgba(0,0,0,0.22),inset_0_1px_1px_0_rgba(255,255,255,0.85)] dark:shadow-[0_16px_48px_0_rgba(0,0,0,0.65),inset_0_1px_1px_0_rgba(255,255,255,0.15)] z-50 p-3 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 select-none ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto flex flex-col gap-2.5"
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 dark:bg-sky-500/20 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {c.title}
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-rose-500 text-white leading-none">
                  {formatNumber(unreadCount)}
                </span>
              )}
            </div>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {currentProject?.name || c.activeProjectFallback}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              title={c.markAllAsRead}
              className="p-2 rounded-xl text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenNotificationSettings) onOpenNotificationSettings();
            }}
            title={c.notificationSettings}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Segmented Filter Bar ([APP_THEME_BUTTON] Pattern) */}
      <div className="flex items-center justify-between gap-1 p-1 rounded-2xl bg-slate-200/55 dark:bg-slate-900/75 border border-white/60 dark:border-white/5">
        {filterTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          const catCount =
            tab.id === 'all'
              ? notifications.length
              : notifications.filter((n) => n.category === tab.id).length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              title={tab.label}
              aria-label={tab.label}
              className={`relative flex items-center justify-center gap-1.5 py-1.5 rounded-xl transition-all duration-300 ease-in-out ${
                isActive
                  ? 'flex-1 px-3 bg-gradient-to-r from-sky-500 to-sky-600 text-white font-bold shadow-sm shadow-sky-500/30'
                  : 'px-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
              {isActive && (
                <span className="text-[11px] font-bold whitespace-nowrap animate-in fade-in duration-200">
                  {tab.label}
                  {catCount > 0 ? ` (${formatNumber(catCount)})` : ''}
                </span>
              )}
              {!isActive && catCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Notification Cards List */}
      <div className="max-h-96 overflow-y-auto pr-0.5 space-y-2 custom-scrollbar">
        {filteredNotifications.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl bg-white/45 dark:bg-slate-900/45 border border-white/60 dark:border-white/5 space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {c.emptyTitle}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {c.emptyDesc}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const style = getSeverityStyles(item.severity, item.category);
            const Icon = style.icon;
            const itemKey = item.dedupKey || item.id;

            return (
              <div
                key={itemKey}
                onClick={() => markAsRead(itemKey)}
                className={`group relative rounded-2xl p-3 transition-all duration-200 border ${
                  item.isRead
                    ? 'bg-white/45 dark:bg-slate-900/45 border-slate-200/60 dark:border-white/5 opacity-80 hover:opacity-100'
                    : `bg-white/85 dark:bg-slate-900/85 ${style.cardBorder} shadow-xs`
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Severity / Category Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${style.badgeBg}`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white leading-snug flex items-center gap-1.5">
                        {!item.isRead && (
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dotColor}`} />
                        )}
                        <span>{item.title}</span>
                      </h4>

                      {/* Dismiss Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(itemKey);
                        }}
                        title={c.dismiss}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors flex-shrink-0 opacity-70 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {/* Action Footer */}
                    {item.actionLabel && (
                      <div className="mt-2.5 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            executeNotificationAction(item);
                            onClose();
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-xs transition-all active:scale-95 ${style.actionBtn}`}
                        >
                          <span>{item.actionLabel}</span>
                          <ActionArrow className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Bottom Quick Footer to Notification Settings */}
      <div className="pt-1 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            if (onOpenNotificationSettings) onOpenNotificationSettings();
          }}
          className="w-full py-2 px-3 rounded-xl text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors flex items-center justify-center gap-1.5"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>
            {c.customizeRules}
          </span>
        </button>
      </div>
    </div>
  );
}
