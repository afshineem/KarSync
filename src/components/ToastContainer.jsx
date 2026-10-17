import React from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useNotifications();
  const { direction } = useLanguage();
  const isRtl = direction === 'rtl';

  if (!toasts || toasts.length === 0 || typeof document === 'undefined') {
    return null;
  }

  const getVisualConfig = (type) => {
    switch (type) {
      case 'error':
        return {
          icon: AlertCircle,
          containerBorder: 'border-rose-500/35 dark:border-rose-500/40',
          glowShadow: 'shadow-[0_12px_36px_-4px_rgba(244,63,94,0.22)] dark:shadow-[0_12px_36px_-4px_rgba(244,63,94,0.35)]',
          iconWrap: 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/25',
          titleColor: 'text-rose-950 dark:text-rose-200',
          barColor: 'bg-gradient-to-r from-rose-500 to-rose-400'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          containerBorder: 'border-amber-500/35 dark:border-amber-500/40',
          glowShadow: 'shadow-[0_12px_36px_-4px_rgba(245,158,11,0.20)] dark:shadow-[0_12px_36px_-4px_rgba(245,158,11,0.30)]',
          iconWrap: 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/25',
          titleColor: 'text-amber-950 dark:text-amber-200',
          barColor: 'bg-gradient-to-r from-amber-500 to-amber-400'
        };
      case 'info':
        return {
          icon: Info,
          containerBorder: 'border-sky-500/35 dark:border-sky-500/40',
          glowShadow: 'shadow-[0_12px_36px_-4px_rgba(14,165,233,0.20)] dark:shadow-[0_12px_36px_-4px_rgba(14,165,233,0.30)]',
          iconWrap: 'bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/25',
          titleColor: 'text-sky-950 dark:text-sky-200',
          barColor: 'bg-gradient-to-r from-sky-500 to-sky-400'
        };
      case 'success':
      default:
        return {
          icon: CheckCircle2,
          containerBorder: 'border-emerald-500/35 dark:border-emerald-500/40',
          glowShadow: 'shadow-[0_12px_36px_-4px_rgba(16,185,129,0.22)] dark:shadow-[0_12px_36px_-4px_rgba(16,185,129,0.35)]',
          iconWrap: 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
          titleColor: 'text-emerald-950 dark:text-emerald-200',
          barColor: 'bg-gradient-to-r from-emerald-500 to-teal-400'
        };
    }
  };

  return createPortal(
    <div
      dir={direction}
      aria-live="polite"
      className={`fixed z-[9999] pointer-events-none flex flex-col gap-2.5 w-full max-w-sm px-3 sm:px-0 top-4 sm:top-auto sm:bottom-6 ${
        isRtl ? 'left-0 sm:left-6' : 'right-0 sm:right-6'
      }`}
    >
      {toasts.map((item) => {
        const cfg = getVisualConfig(item.type);
        const Icon = cfg.icon;

        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-white/88 dark:bg-slate-900/88 backdrop-blur-2xl backdrop-saturate-200 border ${cfg.containerBorder} ${cfg.glowShadow} p-3.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 zoom-in-95`}
          >
            <div className="flex items-start gap-3">
              {/* Glowing Status Icon Pill */}
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${cfg.iconWrap}`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                {item.title && (
                  <h4 className={`text-xs font-black leading-tight ${cfg.titleColor}`}>
                    {item.title}
                  </h4>
                )}
                {item.message && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words">
                    {item.message}
                  </p>
                )}
                {item.action && item.action.label && (
                  <button
                    type="button"
                    onClick={() => {
                      if (item.action.onClick) item.action.onClick();
                      removeToast(item.id);
                    }}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900/5 dark:bg-white/10 hover:bg-slate-900/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 transition-colors"
                  >
                    {item.action.label}
                  </button>
                )}
              </div>

              {/* Dismiss X Button */}
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                aria-label="Close"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtle Bottom Accent Bar */}
            <div className={`absolute bottom-0 inset-x-0 h-1 ${cfg.barColor} opacity-80`} />
          </div>
        );
      })}
    </div>,
    document.body
  );
}
