import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { WorkersView } from './WorkersView';

// Scoped dictionary for WorkersModal
const COPY = {
  fa: {
    title: 'سامانه مدیریت پرسنل و کارکنان',
    subtitle: 'کلید میانبر Shift + P • جهت خروج کلید Esc را بزنید',
    closeTooltip: 'بستن (Esc)'
  },
  ku: {
    title: 'بەڕێوەبردنی کرێکاران و پرسنل',
    subtitle: 'کلیلەکانی خێرا Shift + P • داگرتنی Esc بۆ داخستن',
    closeTooltip: 'داخستن (Esc)'
  },
  en: {
    title: 'Personnel & Workers Management',
    subtitle: 'Shortcut: Shift + P • Press Esc to close',
    closeTooltip: 'Close (Esc)'
  }
};

export function WorkersModal({ isOpen, onClose }) {
  const { language } = useLanguage();
  const txt = COPY[language] || COPY.fa;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] w-screen h-[100dvh] max-h-[100dvh] bg-slate-900/60 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 lg:px-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between flex-shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              {txt.title}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
              {txt.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all duration-150 active:scale-95 border border-slate-200/80 dark:border-slate-700/80 shadow-xs cursor-pointer"
          aria-label={txt.closeTooltip}
          title={txt.closeTooltip}
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Fullscreen Body */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 lg:p-8 bg-[#f3f6f4] dark:bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <WorkersView />
        </div>
      </main>
    </div>,
    document.body
  );
}
