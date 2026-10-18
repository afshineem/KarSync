import { db } from '../db/db';
import { createFullBackupPayload } from '../db/backup';
import { emitToast } from '../context/NotificationContext';

const SETTINGS_KEY = 'backup_directory_handle';

/**
 * Checks if the browser supports the File System Access API
 */
export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Retrieves the stored FileSystemDirectoryHandle from IndexedDB
 */
export async function getStoredDirectoryHandle() {
  if (!isFileSystemAccessSupported()) return null;
  try {
    if (!db.settings) return null;
    const record = await db.settings.get(SETTINGS_KEY);
    return record?.handle || null;
  } catch (err) {
    console.warn('Error reading directory handle from db:', err);
    return null;
  }
}

/**
 * Verifies or requests readwrite permissions for the directory handle
 * @param {FileSystemDirectoryHandle} handle
 * @param {boolean} requestIfNeeded
 */
export async function verifyDirectoryPermission(handle, requestIfNeeded = true) {
  if (!handle) return false;
  try {
    const opts = { mode: 'readwrite' };
    const state = await handle.queryPermission(opts);
    if (state === 'granted') return true;

    if (requestIfNeeded) {
      const requested = await handle.requestPermission(opts);
      return requested === 'granted';
    }
    return false;
  } catch (err) {
    console.warn('Error checking directory permission:', err);
    return false;
  }
}

/**
 * Prompts user to pick a directory on their local computer and stores the handle
 */
export async function chooseBackupDirectory() {
  if (!isFileSystemAccessSupported()) {
    throw new Error('BROWSER_UNSUPPORTED');
  }

  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    const isGranted = await verifyDirectoryPermission(handle, true);
    if (!isGranted) {
      throw new Error('PERMISSION_DENIED');
    }

    const dirName = handle.name || 'KarSync_Backups';

    if (db.settings) {
      await db.settings.put({
        key: SETTINGS_KEY,
        handle,
        dirName,
        updatedAt: new Date().toISOString()
      });
    }

    try {
      localStorage.setItem('karsync_backup_dir_name', dirName);
      localStorage.setItem('karsync_backup_dir_connected', 'true');
    } catch (_) {}

    function getActiveLanguage() {
      try {
        const lang = localStorage.getItem('workshop_lang');
        if (lang === 'ku' || lang === 'en') return lang;
      } catch (_) {}
      return 'fa';
    }

    const lang = getActiveLanguage();
    const connectMessages = {
      title: {
        fa: 'اتصال موفق پوشه',
        ku: 'بەستنەوەی سەرکەوتووانەی بوخچە',
        en: 'Folder Connected Successfully'
      },
      message: {
        fa: `پوشه «${dirName}» با موفقیت جهت پشتیبان‌گیری خودکار انتخاب و متصل گردید.`,
        ku: `بوخچەی «${dirName}» بە سەرکەوتوویی بۆ پاشەکەوتکردنی خۆگەڕ هەڵبژێردرا و بەسترایەوە.`,
        en: `Folder "${dirName}" successfully selected and connected for automatic backups.`
      }
    };

    emitToast({
      type: 'success',
      title: connectMessages.title[lang] || connectMessages.title.fa,
      message: connectMessages.message[lang] || connectMessages.message.fa
    });

    return { success: true, dirName, handle };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { canceled: true };
    }
    throw err;
  }
}

/**
 * Disconnects the local backup directory
 */
export async function disconnectBackupDirectory() {
  try {
    if (db.settings) {
      await db.settings.delete(SETTINGS_KEY);
    }
    try {
      localStorage.removeItem('karsync_backup_dir_name');
      localStorage.removeItem('karsync_backup_dir_connected');
    } catch (_) {}

    function getActiveLanguage() {
      try {
        const lang = localStorage.getItem('workshop_lang');
        if (lang === 'ku' || lang === 'en') return lang;
      } catch (_) {}
      return 'fa';
    }

    const lang = getActiveLanguage();
    const disconnectMessages = {
      title: {
        fa: 'قطع اتصال پوشه',
        ku: 'پچڕاندنی بەستنەوەی بوخچە',
        en: 'Folder Disconnected'
      },
      message: {
        fa: 'اتصال پوشه محلی لغو گردید. پشتیبان‌گیری‌ها کماکان در ماشین زمان داخلی ثبت می‌شوند.',
        ku: 'پەیوەندیی بوخچەی ناوخۆیی هەڵوەشێنرایەوە. پاشەکەوتکردنەکان هێشتا لە مێژووی ناوخۆیدا تۆمار دەکرێن.',
        en: 'Local folder disconnected. Backups will continue to be saved to local history.'
      }
    };

    emitToast({
      type: 'info',
      title: disconnectMessages.title[lang] || disconnectMessages.title.fa,
      message: disconnectMessages.message[lang] || disconnectMessages.message.fa
    });

    return true;
  } catch (err) {
    console.warn('Error disconnecting backup directory:', err);
    return false;
  }
}

/**
 * Writes a full JSON backup file into the connected local directory
 * and applies retention limit (removing oldest files)
 * @param {object} [customPayload] - optional custom payload
 */
export async function writeBackupToConnectedDirectory(customPayload = null) {
  if (!isFileSystemAccessSupported()) {
    return { written: false, reason: 'unsupported' };
  }

  const handle = await getStoredDirectoryHandle();
  if (!handle) {
    return { written: false, reason: 'not_connected' };
  }

  const hasPermission = await verifyDirectoryPermission(handle, false);
  if (!hasPermission) {
    return { written: false, reason: 'permission_required' };
  }

  try {
    const payload = customPayload || (await createFullBackupPayload({ triggerType: 'native_directory' }));
    const jsonString = JSON.stringify(payload, null, 2);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `karsync_backup_${dateStr}_${timeStr}.json`;

    // Write file to directory
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(jsonString);
    await writable.close();

    // Retention cleanup in directory: keep N newest backup files
    let maxFiles = 10;
    try {
      const savedMax = localStorage.getItem('karsync_auto_backup_max_snapshots');
      if (savedMax) maxFiles = Math.max(3, parseInt(savedMax, 10));
    } catch (_) {}

    const existingBackupFiles = [];
    try {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.startsWith('karsync_backup_') && entry.name.endsWith('.json')) {
          existingBackupFiles.push(entry);
        }
      }

      if (existingBackupFiles.length > maxFiles) {
        // Sort by filename (which includes ISO date string) ascending
        existingBackupFiles.sort((a, b) => a.name.localeCompare(b.name));
        const toRemove = existingBackupFiles.slice(0, existingBackupFiles.length - maxFiles);
        for (const oldEntry of toRemove) {
          try {
            await handle.removeEntry(oldEntry.name);
          } catch (_) {}
        }
      }
    } catch (cleanErr) {
      console.warn('Retention cleanup in directory failed:', cleanErr);
    }

    return {
      written: true,
      fileName,
      dirName: handle.name || 'KarSync_Backups',
      size: new Blob([jsonString]).size
    };
  } catch (err) {
    console.warn('Error writing backup to local directory:', err);
    return { written: false, error: err.message };
  }
}

/**
 * Returns current status of local directory sync
 */
export async function getDirectorySyncStatus() {
  const supported = isFileSystemAccessSupported();
  if (!supported) {
    return { supported: false, connected: false, dirName: null, permissionState: 'unsupported' };
  }

  const handle = await getStoredDirectoryHandle();
  if (!handle) {
    return { supported: true, connected: false, dirName: null, permissionState: 'none' };
  }

  let permissionState = 'prompt';
  try {
    permissionState = await handle.queryPermission({ mode: 'readwrite' });
  } catch (_) {}

  return {
    supported: true,
    connected: true,
    dirName: handle.name || localStorage.getItem('karsync_backup_dir_name') || 'Local Folder',
    permissionState
  };
}
