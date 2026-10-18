import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  createAutoSnapshot,
  restoreFromSnapshot,
  deleteSnapshot,
  downloadSnapshotAsFile,
  checkAndRunAutoBackup
} from '../db/backup';
import {
  isFileSystemAccessSupported,
  getDirectorySyncStatus,
  chooseBackupDirectory,
  disconnectBackupDirectory,
  writeBackupToConnectedDirectory
} from '../services/localDirectoryBackup';
import {
  getGoogleDriveSyncStatus,
  connectGoogleDrive,
  disconnectGoogleDrive,
  uploadBackupToGoogleDrive,
  setCustomGoogleClientId
} from '../services/googleDriveService';
import { emitToast } from '../context/NotificationContext';

function getActiveLanguage() {
  try {
    const lang = localStorage.getItem('workshop_lang');
    if (lang === 'ku' || lang === 'en') return lang;
  } catch (_) {}
  return 'fa';
}

const TOAST_MESSAGES = {
  manualBackupLabel: {
    fa: 'پشتیبان دستی کاربر',
    ku: 'پاشەکەوتی دەستیی بەکارهێنەر',
    en: 'User Manual Backup'
  },
  snapshotSuccessTitle: {
    fa: 'نقطه بازیابی ایجاد شد',
    ku: 'خاڵی گەڕاندنەوە دروستکرا',
    en: 'Restore Point Created'
  },
  snapshotSuccessMsg: {
    fa: 'نسخه پشتیبان جدید با موفقیت در تاریخچه محلی ثبت شد.',
    ku: 'کۆپییەکی نوێی پاشەکەوت بە سەرکەوتوویی لە مێژووی ناوخۆیدا تۆمارکرا.',
    en: 'New backup snapshot successfully saved to local history.'
  },
  snapshotErrorTitle: {
    fa: 'خطا در پشتیبان‌گیری',
    ku: 'هەڵە لە پاشەکەوتکردندا',
    en: 'Backup Failed'
  },
  snapshotErrorMsg: {
    fa: 'خطایی در ثبت نسخه پشتیبان رخ داد.',
    ku: 'هەڵەیەک لە تۆمارکردنی وەشانی پاشەکەوت ڕوویدا.',
    en: 'An error occurred while creating backup.'
  },
  restoreSuccessTitle: {
    fa: 'بازیابی موفق',
    ku: 'گەڕاندنەوەی سەرکەوتوو',
    en: 'Restore Successful'
  },
  restoreSuccessMsg: {
    fa: 'اطلاعات با موفقیت بازیابی شدند ({workers} پرسنل، {logs} لاگ).',
    ku: 'زانیارییەکان بە سەرکەوتوویی گەڕێنرانەوە ({workers} کارمەند، {logs} تۆمار).',
    en: 'Data successfully restored ({workers} workers, {logs} logs).'
  },
  restoreErrorTitle: {
    fa: 'خطا در بازیابی',
    ku: 'هەڵە لە گەڕاندنەوەدا',
    en: 'Restore Failed'
  },
  deleteSuccessTitle: {
    fa: 'حذف شد',
    ku: 'سڕایەوە',
    en: 'Deleted'
  },
  deleteSuccessMsg: {
    fa: 'نسخه پشتیبان از تاریخچه حذف گردید.',
    ku: 'وەشانی پاشەکەوت لە مێژوو سڕایەوە.',
    en: 'Backup snapshot removed from history.'
  },
  deleteErrorTitle: {
    fa: 'خطا در حذف',
    ku: 'هەڵە لە سڕینەوەدا',
    en: 'Delete Failed'
  },
  downloadErrorTitle: {
    fa: 'خطا در دانلود',
    ku: 'هەڵە لە دابەزاندندا',
    en: 'Download Failed'
  },
  dirAccessErrorTitle: {
    fa: 'عدم دسترسی به پوشه',
    ku: 'دەستپێڕانەگەیشتن بە بوخچە',
    en: 'Folder Access Denied'
  },
  dirAccessErrorMsg: {
    fa: 'انتخاب پوشه توسط کاربر لغو گردید یا مجوز داده نشد.',
    ku: 'هەڵبژاردنی بوخچە لەلایەن بەکارهێنەرەوە هەڵوەشێنرایەوە یان مۆڵەت نەدرا.',
    en: 'Folder selection was cancelled or permission was denied.'
  },
  dirSyncSuccessTitle: {
    fa: 'ذخیره در پوشه رایانه',
    ku: 'پاشەکەوتکردن لە بوخچەی کۆمپیوتەر',
    en: 'Saved to Computer Folder'
  },
  dirSyncSuccessMsg: {
    fa: 'فایل «{fileName}» با موفقیت در پوشه «{dirName}» ذخیره شد.',
    ku: 'فایلی «{fileName}» بە سەرکەوتوویی لە بوخچەی «{dirName}» پاشەکەوت کرا.',
    en: 'File "{fileName}" was successfully saved to "{dirName}".'
  },
  dirPermissionWarningTitle: {
    fa: 'مجوز لازم است',
    ku: 'مۆڵەت پێویستە',
    en: 'Permission Required'
  },
  dirPermissionWarningMsg: {
    fa: 'لطفاً یک‌بار دیگر دکمه انتخاب پوشه را بزنید تا مجوز نوشتن تایید گردد.',
    ku: 'تکایە جارێکی تر کرتە لەسەر دوگمەی هەڵبژاردنی بوخچە بکە تا مۆڵەتی نووسین پشتڕاست بکرێتەوە.',
    en: 'Please click choose folder again to grant write permissions.'
  },
  dirSyncErrorTitle: {
    fa: 'خطا در ذخیره پوشه',
    ku: 'هەڵە لە پاشەکەوتکردن لە بوخچە',
    en: 'Folder Save Failed'
  },
  noDirConnectedMsg: {
    fa: 'پوشه‌ای متصل نیست.',
    ku: 'هیچ بوخچەیەک نەبەستراوەتەوە.',
    en: 'No folder is connected.'
  },
  generalErrorTitle: {
    fa: 'خطا',
    ku: 'هەڵە',
    en: 'Error'
  },
  gdriveConnectErrorTitle: {
    fa: 'خطا در اتصال به Google Drive',
    ku: 'هەڵە لە بەستنەوە بە گووگڵ درایڤ',
    en: 'Google Drive Connection Failed'
  },
  gdriveConnectErrorMsg: {
    fa: 'ورود توسط کاربر لغو شد یا دسترسی داده نشد.',
    ku: 'چوونەژوورەوە لەلایەن بەکارهێنەرەوە هەڵوەشێنرایەوە یان دەستپێگەیشتن نەدرا.',
    en: 'Sign in was cancelled or permission was not granted.'
  },
  gdriveUploadSuccessTitle: {
    fa: 'آپلود در Google Drive',
    ku: 'بارکردن بۆ گووگڵ درایڤ',
    en: 'Uploaded to Google Drive'
  },
  gdriveUploadSuccessMsg: {
    fa: 'فایل «{fileName}» با موفقیت در پوشه KarSync در درایو شما ذخیره گردید.',
    ku: 'فایلی «{fileName}» بە سەرکەوتوویی لە بوخچەی KarSync لە درایڤەکەتدا پاشەکەوت کرا.',
    en: 'File "{fileName}" successfully saved to KarSync folder in your Drive.'
  },
  sessionExpiredTitle: {
    fa: 'نشست منقضی شده است',
    ku: 'ماوەی دانیشتن بەسەرچووە',
    en: 'Session Expired'
  },
  sessionExpiredMsg: {
    fa: 'لطفاً یک‌بار دیگر دکمه اتصال به Google Drive را کلیک نمایید تا توکن شما تمدید گردد.',
    ku: 'تکایە جارێکی تر کرتە لەسەر دوگمەی بەستنەوە بە گووگڵ درایڤ بکە تا تۆکنەکەت نوێ بکرێتەوە.',
    en: 'Please click connect to Google Drive again to refresh your access token.'
  },
  gdriveUploadErrorTitle: {
    fa: 'خطا در آپلود ابری',
    ku: 'هەڵە لە بارکردنی هەوریدا',
    en: 'Cloud Upload Failed'
  },
  noGdriveConnectedMsg: {
    fa: 'حساب گوگل متصل نیست.',
    ku: 'هەژماری گووگڵ نەبەستراوەتەوە.',
    en: 'Google account is not connected.'
  }
};

export function useAutoBackup() {
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isConnectingDir, setIsConnectingDir] = useState(false);
  const [isGdriveLoading, setIsGdriveLoading] = useState(false);

  // Directory Sync state
  const [dirStatus, setDirStatus] = useState(() => ({
    supported: isFileSystemAccessSupported(),
    connected: false,
    dirName: null,
    permissionState: 'none'
  }));

  // Google Drive state
  const [gdriveStatus, setGdriveStatus] = useState(() => ({
    isConfigured: false,
    isConnected: false,
    userEmail: null,
    folderId: null,
    lastUploadAt: null,
    clientId: ''
  }));

  const refreshDirStatus = useCallback(async () => {
    try {
      const status = await getDirectorySyncStatus();
      setDirStatus(status);
    } catch (_) {}
  }, []);

  const refreshGdriveStatus = useCallback(async () => {
    try {
      const status = await getGoogleDriveSyncStatus();
      setGdriveStatus(status);
    } catch (_) {}
  }, []);

  useEffect(() => {
    refreshDirStatus();
    refreshGdriveStatus();
  }, [refreshDirStatus, refreshGdriveStatus]);

  // Configuration state
  const [config, setConfig] = useState(() => {
    let enabled = true;
    let intervalDays = 1;
    let maxSnapshots = 10;
    try {
      const e = localStorage.getItem('karsync_auto_backup_enabled');
      if (e !== null) enabled = e === 'true';
      const i = localStorage.getItem('karsync_auto_backup_interval_days');
      if (i) intervalDays = parseInt(i, 10);
      const m = localStorage.getItem('karsync_auto_backup_max_snapshots');
      if (m) maxSnapshots = parseInt(m, 10);
    } catch (_) {}
    return { enabled, intervalDays, maxSnapshots };
  });

  // Reactive live query for snapshots
  const snapshots = useLiveQuery(
    async () => {
      try {
        if (!db.backupSnapshots) return [];
        return await db.backupSnapshots.orderBy('createdAt').reverse().toArray();
      } catch (err) {
        console.warn('Error reading backupSnapshots:', err);
        return [];
      }
    },
    [],
    []
  );

  // Check last backup time from localStorage or newest snapshot
  const lastBackupAt = snapshots && snapshots.length > 0 ? snapshots[0].createdAt : null;

  // Background auto-backup trigger on launch + periodic interval
  useEffect(() => {
    const timer = setTimeout(() => {
      checkAndRunAutoBackup();
    }, 5000);

    const interval = setInterval(() => {
      checkAndRunAutoBackup();
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const updateConfig = useCallback((newPartial) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newPartial };
      try {
        if (newPartial.enabled !== undefined) {
          localStorage.setItem('karsync_auto_backup_enabled', String(newPartial.enabled));
        }
        if (newPartial.intervalDays !== undefined) {
          localStorage.setItem('karsync_auto_backup_interval_days', String(newPartial.intervalDays));
        }
        if (newPartial.maxSnapshots !== undefined) {
          localStorage.setItem('karsync_auto_backup_max_snapshots', String(newPartial.maxSnapshots));
        }
      } catch (_) {}
      return updated;
    });
  }, []);

  const triggerManualSnapshot = useCallback(async (customLabel = '') => {
    const lang = getActiveLanguage();
    try {
      setIsTakingSnapshot(true);
      const defaultLabel = TOAST_MESSAGES.manualBackupLabel[lang] || TOAST_MESSAGES.manualBackupLabel.fa;
      const snap = await createAutoSnapshot('manual', customLabel || defaultLabel);
      emitToast({
        type: 'success',
        title: TOAST_MESSAGES.snapshotSuccessTitle[lang] || TOAST_MESSAGES.snapshotSuccessTitle.fa,
        message: TOAST_MESSAGES.snapshotSuccessMsg[lang] || TOAST_MESSAGES.snapshotSuccessMsg.fa
      });
      return snap;
    } catch (err) {
      emitToast({
        type: 'error',
        title: TOAST_MESSAGES.snapshotErrorTitle[lang] || TOAST_MESSAGES.snapshotErrorTitle.fa,
        message: err.message || (TOAST_MESSAGES.snapshotErrorMsg[lang] || TOAST_MESSAGES.snapshotErrorMsg.fa)
      });
      throw err;
    } finally {
      setIsTakingSnapshot(false);
    }
  }, []);

  const handleRestore = useCallback(async (snapshotId, mode = 'replace') => {
    const lang = getActiveLanguage();
    try {
      setActionLoadingId(snapshotId);
      const res = await restoreFromSnapshot(snapshotId, mode);
      const template = TOAST_MESSAGES.restoreSuccessMsg[lang] || TOAST_MESSAGES.restoreSuccessMsg.fa;
      emitToast({
        type: 'success',
        title: TOAST_MESSAGES.restoreSuccessTitle[lang] || TOAST_MESSAGES.restoreSuccessTitle.fa,
        message: template.replace('{workers}', res.workersCount).replace('{logs}', res.logsCount)
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
      return res;
    } catch (err) {
      emitToast({
        type: 'error',
        title: TOAST_MESSAGES.restoreErrorTitle[lang] || TOAST_MESSAGES.restoreErrorTitle.fa,
        message: err.message
      });
      throw err;
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (snapshotId) => {
    const lang = getActiveLanguage();
    try {
      setActionLoadingId(snapshotId);
      await deleteSnapshot(snapshotId);
      emitToast({
        type: 'success',
        title: TOAST_MESSAGES.deleteSuccessTitle[lang] || TOAST_MESSAGES.deleteSuccessTitle.fa,
        message: TOAST_MESSAGES.deleteSuccessMsg[lang] || TOAST_MESSAGES.deleteSuccessMsg.fa
      });
    } catch (err) {
      emitToast({
        type: 'error',
        title: TOAST_MESSAGES.deleteErrorTitle[lang] || TOAST_MESSAGES.deleteErrorTitle.fa,
        message: err.message
      });
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleDownload = useCallback(async (snapshotId) => {
    const lang = getActiveLanguage();
    try {
      await downloadSnapshotAsFile(snapshotId);
    } catch (err) {
      emitToast({
        type: 'error',
        title: TOAST_MESSAGES.downloadErrorTitle[lang] || TOAST_MESSAGES.downloadErrorTitle.fa,
        message: err.message
      });
    }
  }, []);

  // Directory connection actions
  const connectDirectory = useCallback(async () => {
    const lang = getActiveLanguage();
    try {
      setIsConnectingDir(true);
      const res = await chooseBackupDirectory();
      if (!res.canceled) {
        await refreshDirStatus();
      }
    } catch (err) {
      emitToast({
        type: 'error',
        title: TOAST_MESSAGES.dirAccessErrorTitle[lang] || TOAST_MESSAGES.dirAccessErrorTitle.fa,
        message: err.message || (TOAST_MESSAGES.dirAccessErrorMsg[lang] || TOAST_MESSAGES.dirAccessErrorMsg.fa)
      });
    } finally {
      setIsConnectingDir(false);
    }
  }, [refreshDirStatus]);

  const disconnectDirectory = useCallback(async () => {
    await disconnectBackupDirectory();
    await refreshDirStatus();
  }, [refreshDirStatus]);

  const testDirectorySync = useCallback(async () => {
    const lang = getActiveLanguage();
    try {
      setIsConnectingDir(true);
      const res = await writeBackupToConnectedDirectory();
      if (res.written) {
        const template = TOAST_MESSAGES.dirSyncSuccessMsg[lang] || TOAST_MESSAGES.dirSyncSuccessMsg.fa;
        emitToast({
          type: 'success',
          title: TOAST_MESSAGES.dirSyncSuccessTitle[lang] || TOAST_MESSAGES.dirSyncSuccessTitle.fa,
          message: template.replace('{fileName}', res.fileName).replace('{dirName}', res.dirName)
        });
      } else if (res.reason === 'permission_required') {
        emitToast({
          type: 'warning',
          title: TOAST_MESSAGES.dirPermissionWarningTitle[lang] || TOAST_MESSAGES.dirPermissionWarningTitle.fa,
          message: TOAST_MESSAGES.dirPermissionWarningMsg[lang] || TOAST_MESSAGES.dirPermissionWarningMsg.fa
        });
      } else {
        emitToast({
          type: 'error',
          title: TOAST_MESSAGES.dirSyncErrorTitle[lang] || TOAST_MESSAGES.dirSyncErrorTitle.fa,
          message: res.error || (TOAST_MESSAGES.noDirConnectedMsg[lang] || TOAST_MESSAGES.noDirConnectedMsg.fa)
        });
      }
    } catch (err) {
      emitToast({
        type: 'error',
        title: TOAST_MESSAGES.generalErrorTitle[lang] || TOAST_MESSAGES.generalErrorTitle.fa,
        message: err.message
      });
    } finally {
      setIsConnectingDir(false);
    }
  }, []);

  // Google Drive actions
  const connectGdrive = useCallback(async (clientIdOverride = null) => {
    const lang = getActiveLanguage();
    try {
      setIsGdriveLoading(true);
      const res = await connectGoogleDrive(clientIdOverride);
      if (res?.success) {
        await refreshGdriveStatus();
      }
      return res;
    } catch (err) {
      if (err.message === 'NO_CLIENT_ID') {
        throw err;
      }
      emitToast({
        type: 'error',
        title: TOAST_MESSAGES.gdriveConnectErrorTitle[lang] || TOAST_MESSAGES.gdriveConnectErrorTitle.fa,
        message: err.message || (TOAST_MESSAGES.gdriveConnectErrorMsg[lang] || TOAST_MESSAGES.gdriveConnectErrorMsg.fa)
      });
      throw err;
    } finally {
      setIsGdriveLoading(false);
    }
  }, [refreshGdriveStatus]);

  const disconnectGdrive = useCallback(async () => {
    await disconnectGoogleDrive();
    await refreshGdriveStatus();
  }, [refreshGdriveStatus]);

  const testGdriveUpload = useCallback(async () => {
    const lang = getActiveLanguage();
    try {
      setIsGdriveLoading(true);
      const res = await uploadBackupToGoogleDrive();
      if (res.uploaded) {
        const template = TOAST_MESSAGES.gdriveUploadSuccessMsg[lang] || TOAST_MESSAGES.gdriveUploadSuccessMsg.fa;
        emitToast({
          type: 'success',
          title: TOAST_MESSAGES.gdriveUploadSuccessTitle[lang] || TOAST_MESSAGES.gdriveUploadSuccessTitle.fa,
          message: template.replace('{fileName}', res.fileName)
        });
        await refreshGdriveStatus();
      } else if (res.reason === 'token_expired') {
        emitToast({
          type: 'warning',
          title: TOAST_MESSAGES.sessionExpiredTitle[lang] || TOAST_MESSAGES.sessionExpiredTitle.fa,
          message: TOAST_MESSAGES.sessionExpiredMsg[lang] || TOAST_MESSAGES.sessionExpiredMsg.fa
        });
      } else {
        emitToast({
          type: 'error',
          title: TOAST_MESSAGES.gdriveUploadErrorTitle[lang] || TOAST_MESSAGES.gdriveUploadErrorTitle.fa,
          message: res.error || (TOAST_MESSAGES.noGdriveConnectedMsg[lang] || TOAST_MESSAGES.noGdriveConnectedMsg.fa)
        });
      }
    } catch (err) {
      emitToast({
        type: 'error',
        title: TOAST_MESSAGES.generalErrorTitle[lang] || TOAST_MESSAGES.generalErrorTitle.fa,
        message: err.message
      });
    } finally {
      setIsGdriveLoading(false);
    }
  }, [refreshGdriveStatus]);

  const updateGdriveClientId = useCallback((newId) => {
    setCustomGoogleClientId(newId);
    refreshGdriveStatus();
  }, [refreshGdriveStatus]);

  return {
    snapshots,
    config,
    updateConfig,
    lastBackupAt,
    isTakingSnapshot,
    actionLoadingId,
    triggerManualSnapshot,
    handleRestore,
    handleDelete,
    handleDownload,
    dirStatus,
    isConnectingDir,
    connectDirectory,
    disconnectDirectory,
    testDirectorySync,
    gdriveStatus,
    isGdriveLoading,
    connectGdrive,
    disconnectGdrive,
    testGdriveUpload,
    updateGdriveClientId
  };
}
