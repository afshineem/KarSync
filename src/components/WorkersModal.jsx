import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { WorkersView } from './WorkersView';

export function WorkersModal({ isOpen, onClose }) {
  const { language } = useLanguage();

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
      className="fixed inset-0 z-[100] w-screen h-[100dvh] max-h-[100dvh] bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/40">
            <Users className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              {language === 'fa' ? 'مدیریت پرسنل و کارگران' : language === 'ku' ? 'بەڕێوەبردنی کرێکاران و پرسنل' : 'Personnel & Workers Management'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
              {language === 'fa' ? 'کلید میانبر Shift + P • جهت بستن دکمه Esc را بزنید' : language === 'ku' ? 'کلیلەکانی خێرا Shift + P • داگرتنی Esc بۆ داخستن' : 'Shortcut: Shift + P • Press Esc to close'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all duration-150 active:scale-95"
          aria-label={language === 'fa' ? 'بستن (Esc)' : 'Close (Esc)'}
          title={language === 'fa' ? 'بستن (Esc)' : 'Close (Esc)'}
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Fullscreen Body */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <WorkersView />
        </div>
      </main>
    </div>,
    document.body
  );
}
