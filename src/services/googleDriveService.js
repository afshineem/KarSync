import { db } from '../db/db';
import { createFullBackupPayload } from '../db/backup';
import { emitToast } from '../context/NotificationContext';

const SETTINGS_KEY = 'gdrive_auth_state';
const DRIVE_FOLDER_NAME = 'KarSync Backups';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

// Default Client ID or from environment variable
export function getGoogleClientId() {
  if (typeof localStorage !== 'undefined') {
    const customId = localStorage.getItem('karsync_gdrive_client_id');
    if (customId && customId.trim()) return customId.trim();
  }
  return import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';
}

export function setCustomGoogleClientId(clientId) {
  if (typeof localStorage !== 'undefined') {
    if (clientId && clientId.trim()) {
      localStorage.setItem('karsync_gdrive_client_id', clientId.trim());
    } else {
      localStorage.removeItem('karsync_gdrive_client_id');
    }
  }
}

/**
 * Loads the Google Identity Services (GIS) client library dynamically
 */
let gisLoadingPromise = null;
export function loadGoogleGisScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);

  if (gisLoadingPromise) return gisLoadingPromise;

  gisLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-gis-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-sdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = (err) => reject(new Error('Failed to load Google Identity Services SDK'));
    document.head.appendChild(script);
  });

  return gisLoadingPromise;
}

/**
 * Retrieves stored authentication state from IndexedDB or localStorage
 */
export async function getStoredGdriveAuth() {
  try {
    let authRecord = null;
    if (db.settings) {
      authRecord = await db.settings.get(SETTINGS_KEY);
    }
    if (!authRecord && typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('karsync_gdrive_token');
      const email = localStorage.getItem('karsync_gdrive_email');
      const folderId = localStorage.getItem('karsync_gdrive_folder_id');
      const expiresAt = localStorage.getItem('karsync_gdrive_expires_at');
      if (token) {
        authRecord = { token, email, folderId, expiresAt: Number(expiresAt) || 0 };
      }
    }
    return authRecord;
  } catch (err) {
    console.warn('Error reading gdrive auth state:', err);
    return null;
  }
}

/**
 * Saves authentication state
 */
export async function saveGdriveAuth(authData) {
  try {
    if (db.settings) {
      await db.settings.put({
        key: SETTINGS_KEY,
        ...authData,
        updatedAt: new Date().toISOString()
      });
    }
    if (typeof localStorage !== 'undefined') {
      if (authData.token) localStorage.setItem('karsync_gdrive_token', authData.token);
      if (authData.email) localStorage.setItem('karsync_gdrive_email', authData.email);
      if (authData.folderId) localStorage.setItem('karsync_gdrive_folder_id', authData.folderId);
      if (authData.expiresAt) localStorage.setItem('karsync_gdrive_expires_at', String(authData.expiresAt));
      localStorage.setItem('karsync_gdrive_connected', 'true');
    }
  } catch (err) {
    console.warn('Error saving gdrive auth:', err);
  }
}

/**
 * Disconnects Google Drive
 */
export async function disconnectGoogleDrive() {
  try {
    const auth = await getStoredGdriveAuth();
    if (auth?.token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(auth.token, () => {});
    }

    if (db.settings) {
      await db.settings.delete(SETTINGS_KEY);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('karsync_gdrive_token');
      localStorage.removeItem('karsync_gdrive_email');
      localStorage.removeItem('karsync_gdrive_folder_id');
      localStorage.removeItem('karsync_gdrive_expires_at');
      localStorage.removeItem('karsync_gdrive_connected');
    }

    emitToast({
      type: 'info',
      title: 'قطع اتصال Google Drive',
      message: 'اتصال به حساب گوگل قطع گردید.'
    });

    return true;
  } catch (err) {
    console.warn('Error disconnecting google drive:', err);
    return false;
  }
}

/**
 * Fetches user profile email from Google
 */
async function fetchGoogleUserEmail(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data.email || null;
    }
  } catch (_) {}
  return null;
}

/**
 * Finds or creates the dedicated "KarSync Backups" folder on Google Drive
 */
export async function getOrCreateKarSyncFolder(accessToken) {
  try {
    // 1. Search for existing folder
    const q = `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // 2. Folder not found; create it
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Automated offline snapshots and backups created by KarSync'
      })
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }
  } catch (err) {
    console.warn('Error creating/finding KarSync folder:', err);
  }
  return null;
}

/**
 * Requests OAuth2 token and connects user's Google Drive account
 */
export async function connectGoogleDrive(clientIdOverride = null) {
  const clientId = clientIdOverride || getGoogleClientId();
  if (!clientId) {
    throw new Error('NO_CLIENT_ID');
  }

  await loadGoogleGisScript();

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          const token = tokenResponse.access_token;
          const expiresIn = Number(tokenResponse.expires_in) || 3600;
          const expiresAt = Date.now() + expiresIn * 1000;

          // Fetch user's email
          const email = await fetchGoogleUserEmail(token);

          // Get or create backup folder
          const folderId = await getOrCreateKarSyncFolder(token);

          const authData = {
            token,
            email,
            folderId,
            expiresAt
          };

          await saveGdriveAuth(authData);

          emitToast({
            type: 'success',
            title: 'اتصال به Google Drive',
            message: `حساب ${email || 'گوگل'} با موفقیت جهت پشتیبان‌گیری ابری متصل گردید.`
          });

          resolve({
            success: true,
            email,
            folderId
          });
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Uploads a JSON backup file to user's Google Drive folder
 * and applies retention limit (deleting oldest files in the folder)
 */
export async function uploadBackupToGoogleDrive(customPayload = null) {
  const auth = await getStoredGdriveAuth();
  if (!auth || !auth.token) {
    return { uploaded: false, reason: 'not_connected' };
  }

  // Check if token has expired
  if (auth.expiresAt && Date.now() > auth.expiresAt) {
    return { uploaded: false, reason: 'token_expired' };
  }

  let folderId = auth.folderId;
  if (!folderId) {
    folderId = await getOrCreateKarSyncFolder(auth.token);
    if (folderId) {
      auth.folderId = folderId;
      await saveGdriveAuth(auth);
    }
  }

  try {
    const payload = customPayload || (await createFullBackupPayload({ triggerType: 'gdrive_cloud' }));
    const jsonString = JSON.stringify(payload, null, 2);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `karsync_backup_${dateStr}_${timeStr}.json`;

    // Multipart upload payload
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: `KarSync automated backup created on ${dateStr}`,
      parents: folderId ? [folderId] : []
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonString +
      closeDelimiter;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Google Drive API error: ${uploadRes.status} ${errText}`);
    }

    const uploadedFileData = await uploadRes.json();

    try {
      localStorage.setItem('karsync_gdrive_last_upload_at', new Date().toISOString());
    } catch (_) {}

    // Retention cleanup on Google Drive
    if (folderId) {
      try {
        let maxFiles = 10;
        try {
          const savedMax = localStorage.getItem('karsync_auto_backup_max_snapshots');
          if (savedMax) maxFiles = Math.max(3, parseInt(savedMax, 10));
        } catch (_) {}

        const listQ = `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`;
        const listRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQ)}&orderBy=createdTime asc&fields=files(id,name,createdTime)`,
          {
            headers: { Authorization: `Bearer ${auth.token}` }
          }
        );

        if (listRes.ok) {
          const listData = await listRes.json();
          const files = listData.files || [];
          if (files.length > maxFiles) {
            const toDelete = files.slice(0, files.length - maxFiles);
            for (const file of toDelete) {
              await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${auth.token}` }
              });
            }
          }
        }
      } catch (cleanErr) {
        console.warn('GDrive retention cleanup failed:', cleanErr);
      }
    }

    return {
      uploaded: true,
      fileId: uploadedFileData.id,
      fileName,
      folderId
    };
  } catch (err) {
    console.warn('Error uploading to Google Drive:', err);
    return { uploaded: false, error: err.message };
  }
}

/**
 * Retrieves list of backup files currently inside Google Drive KarSync folder
 */
export async function listGoogleDriveBackups() {
  const auth = await getStoredGdriveAuth();
  if (!auth?.token || !auth?.folderId) return [];

  try {
    const q = `'${auth.folderId}' in parents and trashed = false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,size,createdTime,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${auth.token}` }
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.files || [];
    }
  } catch (err) {
    console.warn('Error listing gdrive files:', err);
  }
  return [];
}

/**
 * Returns status overview of Google Drive integration
 */
export async function getGoogleDriveSyncStatus() {
  const clientId = getGoogleClientId();
  const auth = await getStoredGdriveAuth();
  const isConnected = !!(auth && auth.token && auth.folderId);
  const lastUploadAt = typeof localStorage !== 'undefined' ? localStorage.getItem('karsync_gdrive_last_upload_at') : null;

  return {
    isConfigured: !!clientId,
    isConnected,
    userEmail: auth?.email || (typeof localStorage !== 'undefined' ? localStorage.getItem('karsync_gdrive_email') : null),
    folderId: auth?.folderId,
    lastUploadAt,
    clientId
  };
}
