import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Download, X, Smartphone, Monitor, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';

export function InstallPwaModal({ isOpen, onClose }) {
  const { language, direction } = useLanguage();
  const [canPrompt, setCanPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    if (window.karsyncDeferredInstallPrompt) {
      setCanPrompt(true);
    }

    const handlePromptReady = () => setCanPrompt(true);
    window.addEventListener('karsync-install-ready', handlePromptReady);
    return () => window.removeEventListener('karsync-install-ready', handlePromptReady);
  }, [isOpen]);

  if (!isOpen) return null;

  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  const handleInstallClick = async () => {
    const promptEvent = window.karsyncDeferredInstallPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        window.karsyncDeferredInstallPrompt = null;
        setCanPrompt(false);
        onClose();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir={direction}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {langKey === 'fa' ? 'نصب برنامه KarSync (PWA)' : langKey === 'ku' ? 'دابەزاندنی KarSync' : 'Install KarSync App'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {langKey === 'fa' ? 'دسترسی آفلاین سریع مانند اپلیکیشن بومی' : 'Offline, fast & standalone access'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Already Installed Badge */}
        {isInstalled && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              {langKey === 'fa' ? 'برنامه هم‌اکنون به صورت اپلیکیشن مستقل نصب است!' : 'KarSync is already running as installed app!'}
            </span>
          </div>
        )}

        {/* Native Browser Install Prompt Button (Chrome/Edge/Android) */}
        {canPrompt && !isInstalled && (
          <div className="mt-4 p-4 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-2xl text-center space-y-3">
            <p className="text-xs font-bold text-sky-950 dark:text-sky-200">
              {langKey === 'fa'
                ? 'مرورگر شما از نصب مستقیم با یک کلیک پشتیبانی می‌کند:'
                : 'Your browser supports one-click install:'}
            </p>
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-sky-600/25 flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{langKey === 'fa' ? 'نصب فوری برنامه روی این دستگاه' : 'Install KarSync Now'}</span>
            </button>
          </div>
        )}

        {/* Instructions for Different Browsers */}
        <div className="mt-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{langKey === 'fa' ? 'راهنمای نصب در مرورگرهای مختلف:' : 'Installation Guide by Browser:'}</span>
          </h4>

          {/* Chrome & Edge */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-1">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-sky-500" />
              <span>گوگل کروم و مایکروسافت اج (کامپیوتر و اندروید)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              روی آیکون نصب (Download) در سمت راست نوار آدرس کلیک کنید یا از منوی ۳ نقطه گزینه <b>Install KarSync</b> را انتخاب نمایید.
            </p>
          </div>

          {/* Firefox Mobile */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-1">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-orange-500" />
              <span>فایرفاکس (اندروید)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              منوی سه نقطه را باز کرده و گزینه <b>Install</b> (یا افزودن به صفحه اصلی) را بزنید.
            </p>
          </div>

          {/* Firefox Desktop note */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-1">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-indigo-500" />
              <span>فایرفاکس دسکتاپ (ویندوز / مک / لینوکس)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              شرکت موزیلا قابلیت نصب PWA در نسخه دسکتاپ فایرفاکس را حذف کرده است. برای داشتن برنامه به عنوان اپلیکیشن مستقل در ویندوز/لینوکس، استفاده از <b>Chrome</b> یا <b>Edge</b> پیشنهاد می‌شود، یا می‌توانید صفحه را با کلید <b>Ctrl+D</b> بوک‌مارک نمایید.
            </p>
          </div>

          {/* Safari iOS */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-1">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-sky-500" />
              <span>سافاری آیفون و آیپد (iOS)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              دکمه Share (اشتراک‌گذاری در پایین صفحه) را لمس کرده و سپس <b>Add to Home Screen</b> (افزودن به صفحه اصلی) را انتخاب کنید.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
          >
            {langKey === 'fa' ? 'متوجه شدم و بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
