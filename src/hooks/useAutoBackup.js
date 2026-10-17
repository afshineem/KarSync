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
import { emitToast } from '../context/NotificationContext';

export function useAutoBackup() {
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isConnectingDir, setIsConnectingDir] = useState(false);

  // Directory Sync state
  const [dirStatus, setDirStatus] = useState(() => ({
    supported: isFileSystemAccessSupported(),
    connected: false,
    dirName: null,
    permissionState: 'none'
  }));

  const refreshDirStatus = useCallback(async () => {
    try {
      const status = await getDirectorySyncStatus();
      setDirStatus(status);
    } catch (_) {}
  }, []);

  useEffect(() => {
    refreshDirStatus();
  }, [refreshDirStatus]);

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
    try {
      setIsTakingSnapshot(true);
      const snap = await createAutoSnapshot('manual', customLabel || 'پشتیبان دستی کاربر');
      emitToast({
        type: 'success',
        title: 'نقطه بازیابی ایجاد شد',
        message: 'نسخه پشتیبان جدید با موفقیت در تاریخچه محلی ثبت شد.'
      });
      return snap;
    } catch (err) {
      emitToast({
        type: 'error',
        title: 'خطا در پشتیبان‌گیری',
        message: err.message || 'خطایی در ثبت نسخه پشتیبان رخ داد.'
      });
      throw err;
    } finally {
      setIsTakingSnapshot(false);
    }
  }, []);

  const handleRestore = useCallback(async (snapshotId, mode = 'replace') => {
    try {
      setActionLoadingId(snapshotId);
      const res = await restoreFromSnapshot(snapshotId, mode);
      emitToast({
        type: 'success',
        title: 'بازیابی موفق',
        message: `اطلاعات با موفقیت بازیابی شدند (${res.workersCount} پرسنل، ${res.logsCount} لاگ).`
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
      return res;
    } catch (err) {
      emitToast({
        type: 'error',
        title: 'خطا در بازیابی',
        message: err.message
      });
      throw err;
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (snapshotId) => {
    try {
      setActionLoadingId(snapshotId);
      await deleteSnapshot(snapshotId);
      emitToast({
        type: 'success',
        title: 'حذف شد',
        message: 'نسخه پشتیبان از تاریخچه حذف گردید.'
      });
    } catch (err) {
      emitToast({
        type: 'error',
        title: 'خطا در حذف',
        message: err.message
      });
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleDownload = useCallback(async (snapshotId) => {
    try {
      await downloadSnapshotAsFile(snapshotId);
    } catch (err) {
      emitToast({
        type: 'error',
        title: 'خطا در دانلود',
        message: err.message
      });
    }
  }, []);

  // Directory connection actions
  const connectDirectory = useCallback(async () => {
    try {
      setIsConnectingDir(true);
      const res = await chooseBackupDirectory();
      if (!res.canceled) {
        await refreshDirStatus();
      }
    } catch (err) {
      emitToast({
        type: 'error',
        title: 'عدم دسترسی به پوشه',
        message: err.message || 'انتخاب پوشه توسط کاربر لغو گردید یا مجوز داده نشد.'
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
    try {
      setIsConnectingDir(true);
      const res = await writeBackupToConnectedDirectory();
      if (res.written) {
        emitToast({
          type: 'success',
          title: 'ذخیره در پوشه رایانه',
          message: `فایل «${res.fileName}» با موفقیت در پوشه «${res.dirName}» ذخیره شد.`
        });
      } else if (res.reason === 'permission_required') {
        emitToast({
          type: 'warning',
          title: 'مجوز لازم است',
          message: 'لطفاً یک‌بار دیگر دکمه انتخاب پوشه را بزنید تا مجوز نوشتن تایید گردد.'
        });
      } else {
        emitToast({
          type: 'error',
          title: 'خطا در ذخیره پوشه',
          message: res.error || 'پوشه‌ای متصل نیست.'
        });
      }
    } catch (err) {
      emitToast({
        type: 'error',
        title: 'خطا',
        message: err.message
      });
    } finally {
      setIsConnectingDir(false);
    }
  }, []);

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
    testDirectorySync
  };
}
