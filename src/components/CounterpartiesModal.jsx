import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Briefcase } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { CounterpartiesView } from './CounterpartiesView';

const COPY = {
  fa: {
    title: 'مدیریت طرف‌حساب‌ها و اشخاص',
    subtitle: 'کارفرمایان، تامین‌کنندگان مصالح، پیمانکاران فرعی و مشتریان پروژه',
    closeAria: 'بستن (Esc)'
  },
  ku: {
    title: 'بەڕێوەبردنی لایەنەکانی حیساب',
    subtitle: 'خاوەن کارەکان، دابینکەران و بەڵێندەرە لاوەکییەکان',
    closeAria: 'داخستن (Esc)'
  },
  en: {
    title: 'Counterparties Management',
    subtitle: 'Clients, material suppliers, subcontractors, and project stakeholders',
    closeAria: 'Close (Esc)'
  }
};

export function CounterpartiesModal({ isOpen, onClose }) {
  const { language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = COPY[langKey] || COPY.fa;

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
      dir={direction}
      className="fixed inset-0 z-[100] w-screen h-[100dvh] max-h-[100dvh] bg-[#f3f6f4] dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
            <Briefcase className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                {c.title}
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-900/60">
                Shift + C
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5 hidden sm:block">
              {c.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          aria-label={c.closeAria}
          title={c.closeAria}
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Fullscreen Body - scrollable with #f3f6f4 background */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 lg:p-8 bg-[#f3f6f4] dark:bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <CounterpartiesView />
        </div>
      </main>
    </div>,
    document.body
  );
}
