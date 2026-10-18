import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { exportDatabaseToJSON, importDatabaseFromJSON, resetDatabaseWithSeed } from '../db/backup';
import { 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  X, 
  ShieldCheck,
} from 'lucide-react';

const COPY = {
  fa: {
    modalTitle: 'پشتیبان‌گیری و بازیابی داده‌ها',
    zeroServerBadge: '۱۰۰٪ پایگاه داده محلی (بدون وابستگی به سرور)',
    close: 'بستن',
    description: 'تمام اطلاعات به صورت کاملاً آفلاین و ایمن روی حافظه همین دستگاه ذخیره می‌شود. می‌توانید از پایگاه داده فایل خروجی بگیرید یا آن را بازیابی کنید.',
    exportTitle: 'دانلود فایل پشتیبان (JSON)',
    exportSubtitle: 'خروجی کامل از تمام پرسنل، تنظیمات، کارکردها و اسناد مالی در قالب یک فایل JSON.',
    exportBtn: 'دانلود فایل پشتیبان',
    exportSuccess: 'فایل پشتیبان با موفقیت دانلود و ذخیره شد.',
    importTitle: 'بازیابی اطلاعات از فایل پشتیبان',
    chooseFileFirst: 'لطفاً ابتدا یک فایل معتبر پشتیبان (JSON) انتخاب فرمایید.',
    replaceMode: 'جایگزینی کامل (حذف قبلی‌ها و ورود دیتای فایل)',
    mergeMode: 'ادغام داده‌ها (افزودن و بروزرسانی رکوردها)',
    importBtn: 'شروع عملیات بازیابی اطلاعات',
    importSuccess: (wCount, lCount) => `داده‌ها با موفقیت بازیابی شدند (${wCount} پرسنل، ${lCount} رکورد کارکرد)`,
    resetDefaultData: 'بازنشانی پایگاه داده به حالت اولیه دمو',
    resetConfirm: 'هشدار جدی: آیا از پاکسازی کامل اطلاعات و بازنشانی به داده‌های اولیه دمو اطمینان دارید؟ تمام اطلاعات ثبت‌شده حذف خواهند شد.',
    resetSuccess: 'پایگاه داده با موفقیت به اطلاعات پیش‌فرض دمو بازنشانی شد.',
    cancel: 'انصراف'
  },
  ku: {
    modalTitle: 'پاشەکەوت و گەڕاندنەوەی زانیارییەکان',
    zeroServerBadge: '١٠٠٪ بنکەدراوەی لۆکاڵی (بێ پێویستی بە سێرڤەر)',
    close: 'داخستن',
    description: 'هەموو زانیارییەکان بەتەواوی لەناو مۆبایل یان کۆمپیوتەرەکەتدا دەمێننەوە. لێرەوە دەتوانی کۆپی یەدەگ دابگریت یان بیگەڕێنیتەوە.',
    exportTitle: 'داگرتنی فایلی یەدەگ (JSON)',
    exportSubtitle: 'دەرکردنی تەواوی کرێکاران، ڕێکخستنەکان، کارکرد و بەڵگەنامە داراییەکان لە یەک فایلی JSON.',
    exportBtn: 'داگرتنی فایلی یەدەگ',
    exportSuccess: 'فایلی یەدەگ بە سەرکەوتوویی داگیرا و پاشەکەوت کرا.',
    importTitle: 'گەڕاندنەوەی زانیاری لە فایلی یەدەگەوە',
    chooseFileFirst: 'تکایە سەرەتا فایلێکی دروستی یەدەگ (JSON) دیاری بکە.',
    replaceMode: 'جێگرتنەوەی تەواو (سڕینەوەی پێشووەکان و دانانی داتای نوێ)',
    mergeMode: 'تێکەڵکردنی داتا (زیادکردن و نوێکردنەوەی تۆمارەکان)',
    importBtn: 'دەستپێکردنی گەڕاندنەوەی زانیاری',
    importSuccess: (wCount, lCount) => `زانیارییەکان بە سەرکەوتوویی هێنرانەوە (${wCount} کرێکار، ${lCount} تۆماری کارکرد)`,
    resetDefaultData: 'گێڕانەوەی بنکەدراوە بۆ داتای سەرەتایی نموونەیی',
    resetConfirm: 'ئاگاداری مەترسیدار: ئایا دڵنیایت لە سڕینەوەی هەموو داتاکان و گەڕاندنەوە بۆ دۆخی سەرەتایی؟ هەموو تۆمارەکان دەسڕێنەوە.',
    resetSuccess: 'بنکەدراوەکە بە سەرکەوتوویی بۆ داتای سەرەتایی نموونەیی گەڕێندرایەوە.',
    cancel: 'پاشگەزبوونەوە'
  },
  en: {
    modalTitle: 'Data Backup & Restore',
    zeroServerBadge: '100% Local IndexedDB (Zero Server Dependencies)',
    close: 'Close',
    description: 'All data is stored directly on this device via IndexedDB with zero backend server dependencies. You can export a JSON backup or restore anytime.',
    exportTitle: 'Export Backup JSON',
    exportSubtitle: 'Exports all workers, settings, attendance logs, and financial records into a single JSON file.',
    exportBtn: 'Export Backup',
    exportSuccess: 'Backup file exported and downloaded successfully.',
    importTitle: 'Restore Database from JSON Backup',
    chooseFileFirst: 'Please select a valid backup JSON file first.',
    replaceMode: 'Complete Overwrite (Erase existing & load file)',
    mergeMode: 'Smart Merge (Add new & update existing records)',
    importBtn: 'Start Database Restore',
    importSuccess: (wCount, lCount) => `Database restored successfully (${wCount} workers, ${lCount} attendance logs)`,
    resetDefaultData: 'Reset Database to Initial Demo Data',
    resetConfirm: 'CRITICAL WARNING: Are you sure you want to erase all records and reset the system to initial demo data? This cannot be undone.',
    resetSuccess: 'Database successfully reset to initial demo data.',
    cancel: 'Cancel'
  }
};

export function BackupModal({ isOpen, onClose }) {
  const { language, direction, convertDigits } = useLanguage();
  const copy = COPY[language] || COPY.fa;

  const [restoreMode, setRestoreMode] = useState('replace'); // 'replace' | 'merge'
  const [selectedFile, setSelectedFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Handle Export
  const handleExport = async () => {
    try {
      setIsLoading(true);
      await exportDatabaseToJSON();
      setStatusMessage({
        type: 'success',
        text: copy.exportSuccess
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatusMessage({ type: '', text: '' });
    }
  };

  // Handle Import
  const handleImport = async () => {
    if (!selectedFile) {
      setStatusMessage({ type: 'error', text: copy.chooseFileFirst });
      return;
    }

    try {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          const res = await importDatabaseFromJSON(content, restoreMode);
          const wCount = convertDigits ? convertDigits(res.workersCount, language) : res.workersCount;
          const lCount = convertDigits ? convertDigits(res.logsCount, language) : res.logsCount;
          setStatusMessage({
            type: 'success',
            text: copy.importSuccess(wCount, lCount)
          });
          setSelectedFile(null);
        } catch (err) {
          setStatusMessage({ type: 'error', text: err.message });
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsText(selectedFile);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
      setIsLoading(false);
    }
  };

  // Handle Reset to Demo
  const handleResetDemo = async () => {
    if (window.confirm(copy.resetConfirm)) {
      try {
        setIsLoading(true);
        await resetDatabaseWithSeed();
        setStatusMessage({
          type: 'success',
          text: copy.resetSuccess
        });
      } catch (err) {
        setStatusMessage({ type: 'error', text: err.message });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div 
      dir={direction}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex animate-in fade-in duration-150 items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 h-[100dvh] sm:h-auto sm:max-h-[85vh] flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {copy.modalTitle}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>{copy.zeroServerBadge}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title={copy.close}
            aria-label={copy.close}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast Notification */}
        {statusMessage.text && (
          <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
          }`}>
            {statusMessage.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {copy.description}
        </p>

        {/* Section 1: Export Backup JSON */}
        <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Download className="w-4 h-4 text-sky-500" />
                <span>{copy.exportTitle}</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {copy.exportSubtitle}
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={isLoading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-sky-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{copy.exportBtn}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Restore from Backup */}
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-emerald-500" />
            <span>{copy.importTitle}</span>
          </h4>

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name="restoreMode"
                value="replace"
                checked={restoreMode === 'replace'}
                onChange={() => setRestoreMode('replace')}
                className="text-sky-600"
              />
              <span>{copy.replaceMode}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name="restoreMode"
                value="merge"
                checked={restoreMode === 'merge'}
                onChange={() => setRestoreMode('merge')}
                className="text-sky-600"
              />
              <span>{copy.mergeMode}</span>
            </label>
          </div>

          <button
            onClick={handleImport}
            disabled={isLoading || !selectedFile}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{copy.importBtn}</span>
          </button>
        </div>

        {/* Section 3: Reset Demo Data */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={handleResetDemo}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 hover:underline font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{copy.resetDefaultData}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors"
          >
            {copy.cancel}
          </button>
        </div>

      </div>
    </div>
  );
}
