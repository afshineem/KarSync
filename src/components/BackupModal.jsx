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

export function BackupModal({ isOpen, onClose }) {
  const { t } = useLanguage();
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
        text: t('restoreSuccess')
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
      setStatusMessage({ type: 'error', text: 'Please choose a backup JSON file' });
      return;
    }

    try {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          const res = await importDatabaseFromJSON(content, restoreMode);
          setStatusMessage({
            type: 'success',
            text: `${t('restoreSuccess')} (${res.workersCount} workers, ${res.logsCount} logs)`
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
    if (window.confirm(t('resetWarning'))) {
      try {
        setIsLoading(true);
        await resetDatabaseWithSeed();
        setStatusMessage({
          type: 'success',
          text: 'Database successfully reset to initial demo data.'
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
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
                {t('backupModalTitle')}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>100% Local IndexedDB (Zero Server)</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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
          {t('backupDescription')}
        </p>

        {/* Section 1: Export Backup JSON */}
        <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Download className="w-4 h-4 text-sky-500" />
                <span>{t('exportBackupBtn')}</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Exports all workers, settings, and logs into a single JSON file.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={isLoading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-sky-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('exportBackupBtn')}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Restore from Backup */}
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-emerald-500" />
            <span>{t('importBackupBtn')}</span>
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
              <span>{t('replaceMode')}</span>
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
              <span>{t('mergeMode')}</span>
            </label>
          </div>

          <button
            onClick={handleImport}
            disabled={isLoading || !selectedFile}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('importBackupBtn')}</span>
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
            <span>{t('resetDefaultData')}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors"
          >
            {t('cancel')}
          </button>
        </div>

      </div>
    </div>
  );
}
