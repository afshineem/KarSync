import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  getSyncConfig, 
  saveSyncConfig, 
  getLastSyncTime, 
  testConnectionUnified, 
  performSyncUnified,
  pullAllUnified 
} from '../services/syncService';
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw, 
  Server, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  X,
  HelpCircle,
  Eye,
  EyeOff,
  Zap,
  HardDrive
} from 'lucide-react';

export function SyncModal({ isOpen, onClose }) {
  const { t, language, direction } = useLanguage();

  const [provider, setProvider] = useState('supabase'); // 'supabase' | 'php'
  const [supabaseUrl, setSupabaseUrl] = useState('https://akeferuiyijsmgmjqnqc.supabase.co');
  const [supabaseKey, setSupabaseKey] = useState('sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk');
  
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  
  const [autoSync, setAutoSync] = useState(true);
  const [showKey, setShowKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const [testResult, setTestResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSyncConfig();
      setProvider(cfg.provider || 'supabase');
      setSupabaseUrl(cfg.supabaseUrl || 'https://akeferuiyijsmgmjqnqc.supabase.co');
      setSupabaseKey(cfg.supabaseKey || 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk');
      setServerUrl(cfg.serverUrl || '');
      setApiKey(cfg.apiKey || '');
      setAutoSync(cfg.autoSync !== false);
      setLastSync(getLastSyncTime());
      setTestResult(null);
      setSyncResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveSyncConfig({
      provider,
      supabaseUrl: supabaseUrl.trim(),
      supabaseKey: supabaseKey.trim(),
      serverUrl: serverUrl.trim(),
      apiKey: apiKey.trim(),
      autoSync
    });
  };

  const handleTestConnection = async () => {
    handleSaveConfig();
    setIsTesting(true);
    setTestResult(null);
    setSyncResult(null);

    try {
      const res = await testConnectionUnified({
        provider,
        supabaseUrl: supabaseUrl.trim(),
        supabaseKey: supabaseKey.trim(),
        serverUrl: serverUrl.trim(),
        apiKey: apiKey.trim()
      });
      setTestResult({
        success: true,
        message: res.message
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleManualSync = async () => {
    handleSaveConfig();
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await performSyncUnified();
      setLastSync(res.serverTime);
      setSyncResult({
        success: true,
        message: t('syncSuccess')
      });
    } catch (err) {
      setSyncResult({
        success: false,
        message: err.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullAll = async () => {
    if (!window.confirm(t('pullAllConfirm'))) {
      return;
    }
    handleSaveConfig();
    setIsPulling(true);
    setSyncResult(null);

    try {
      const res = await pullAllUnified();
      setLastSync(new Date().toISOString());
      setSyncResult({
        success: true,
        message: t('pullAllSuccess')
      });
    } catch (err) {
      setSyncResult({
        success: false,
        message: err.message
      });
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-none sm:max-h-[92vh] h-[100dvh] sm:h-auto sm:max-h-[85vh] flex-col overflow-y-auto"
        dir={direction}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('syncModalTitle')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('syncModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* Provider Selection Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{t('selectCloudType')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider('supabase')}
                className={`p-3 rounded-2xl border text-start transition-all flex items-center gap-2.5 ${
                  provider === 'supabase'
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Zap className="w-5 h-5 text-emerald-500" />
                <div>
                  <div className="font-bold text-xs">{t('supabaseProvider')}</div>
                  <div className="text-[10px] text-slate-400">{t('supabaseProviderDesc')}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('php')}
                className={`p-3 rounded-2xl border text-start transition-all flex items-center gap-2.5 ${
                  provider === 'php'
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                }`}
              >
                <HardDrive className="w-5 h-5 text-sky-500" />
                <div>
                  <div className="font-bold text-xs">{t('phpProvider')}</div>
                  <div className="text-[10px] text-slate-400">{t('phpProviderDesc')}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Last sync banner */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">{t('lastSyncLabel')}</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {lastSync 
                ? (language === 'en' ? new Date(lastSync).toLocaleString('en-US') : new Date(lastSync).toLocaleString('fa-IR'))
                : t('noSyncYet')
              }
            </span>
          </div>

          {/* Form: SUPABASE */}
          {provider === 'supabase' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t('supabaseUrlLabel')}</span>
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzabcdefghijklm.supabase.co"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-start"
                  dir="ltr"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {t('supabaseUrlHelp')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('supabaseKeyLabel')}</span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="sb_publishable_..."
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 pe-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute end-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Form: PHP MySQL */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-sky-500" />
                  <span>{t('phpUrlLabel')}</span>
                </label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://yourdomain.com/api/api.php"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-start"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('phpKeyLabel')}</span>
                </label>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('phpKeyPlaceholder')}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          )}

          {/* Auto sync checkbox */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {t('autoSyncOnOnline')}
            </span>
          </label>

          {/* Test connection alert */}
          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{testResult.message}</span>
            </div>
          )}

          {/* Sync result alert */}
          {syncResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              syncResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
            }`}>
              {syncResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{syncResult.message}</span>
            </div>
          )}

          {/* Info Card */}
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>{t('offlineSupportTitle')}</span>
            </div>
            <p>
              {t('offlineSupportDesc')}
            </p>
          </div>

        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex-wrap items-center justify-between gap-2">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? t('testingConnection') : t('testConnectionBtn')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePullAll}
              disabled={isPulling}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-xl transition-colors border border-amber-200 dark:border-amber-800 disabled:opacity-50"
              title={t('pullAllTitle')}
            >
              <Download className={`w-3.5 h-3.5 ${isPulling ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{t('pullAllBtn')}</span>
            </button>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <CloudCheck className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? t('syncingCloud') : t('cloudSyncBtn')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
