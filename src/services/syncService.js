import { db } from '../db/db';

const SYNC_CONFIG_KEY = 'workshop_sync_config';
const LAST_SYNC_KEY = 'workshop_last_sync_time';

export function getSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading sync config:', e);
  }
  return {
    provider: 'supabase', // 'supabase' | 'php'
    supabaseUrl: 'https://akeferuiyijsmgmjqnqc.supabase.co',
    supabaseKey: 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk',
    serverUrl: '',
    apiKey: '',
    autoSync: true
  };
}

export function saveSyncConfig(config) {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
}

export function getLastSyncTime() {
  return localStorage.getItem(LAST_SYNC_KEY) || null;
}

export function setLastSyncTime(timeStr) {
  localStorage.setItem(LAST_SYNC_KEY, timeStr);
}

// ------------------------------------------------------------------------
// SUPABASE SYNC ENGINE
// ------------------------------------------------------------------------

export async function testSupabaseConnection(supabaseUrl, publishableKey) {
  if (!supabaseUrl || !supabaseUrl.trim()) {
    throw new Error('لطفاً آدرس پروژه سوپابیس (Project URL) را وارد کنید.');
  }
  if (!publishableKey || !publishableKey.trim()) {
    throw new Error('لطفاً Publishable Key را وارد کنید.');
  }

  const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
  const testUrl = `${cleanUrl}/rest/v1/workers?select=id&limit=1`;

  const response = await fetch(testUrl, {
    method: 'GET',
    headers: {
      'apikey': publishableKey.trim(),
      'Authorization': `Bearer ${publishableKey.trim()}`,
      'Accept': 'application/json'
    },
    cache: 'no-cache'
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      if (errJson.message) detail = errJson.message;
    } catch (_) {}

    if (response.status === 404 || detail.includes('does not exist')) {
      throw new Error('جداول در دیتابیس سوپابیس پیدا نشدند. لطفاً کدهای SQL را در بخش SQL Editor سوپابیس Run کنید.');
    }
    throw new Error(`خطای ارتباط با سوپابیس: HTTP ${response.status} ${detail}`);
  }

  return {
    success: true,
    message: 'اتصال به دیتابیس ابری سوپابیس با موفقیت برقرار شد!'
  };
}

export async function syncWithSupabase() {
  const { fullSyncBothDirections } = await import('./realtimeSync');
  await fullSyncBothDirections();
  const nowTime = new Date().toISOString();
  return {
    success: true,
    serverTime: nowTime
  };
}

export async function pullAllFromSupabase() {
  const config = getSyncConfig();
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error('مشخصات سوپابیس تنظیم نشده است.');
  }

  const cleanUrl = config.supabaseUrl.trim().replace(/\/+$/, '');
  const headers = {
    'apikey': config.supabaseKey.trim(),
    'Authorization': `Bearer ${config.supabaseKey.trim()}`,
    'Accept': 'application/json'
  };

  const [wRes, lRes] = await Promise.all([
    fetch(`${cleanUrl}/rest/v1/workers?select=*`, { headers }),
    fetch(`${cleanUrl}/rest/v1/attendance_logs?select=*`, { headers })
  ]);

  if (!wRes.ok || !lRes.ok) {
    throw new Error('خطا در دریافت اطلاعات از سرور ابری سوپابیس.');
  }

  const workers = await wRes.json();
  const logs = await lRes.json();

  await db.transaction('rw', [db.workers, db.attendanceLogs], async () => {
    await db.workers.clear();
    await db.attendanceLogs.clear();

    for (const w of workers) {
      if (!w.deleted_at) {
        await db.workers.put({
          id: w.id,
          name: w.name,
          phone: w.phone || '',
          role: w.role,
          dailyRate: Number(w.daily_rate) || 0,
          overtimeHourlyRate: Number(w.overtime_hourly_rate) || 0,
          isActive: Number(w.is_active) === 0 ? 0 : 1,
          createdAt: w.created_at,
          updatedAt: w.updated_at
        });
      }
    }

    for (const l of logs) {
      if (!l.deleted_at) {
        await db.attendanceLogs.put({
          id: l.id,
          workerId: l.worker_id,
          date: l.date,
          type: l.type,
          overtimeHours: Number(l.overtime_hours) || 0,
          calculatedDailyWage: Number(l.calculated_daily_wage) || 0,
          calculatedOvertimeWage: Number(l.calculated_overtime_wage) || 0,
          totalDayPay: Number(l.total_day_pay) || 0,
          notes: l.notes || '',
          createdAt: l.created_at,
          updatedAt: l.updated_at
        });
      }
    }
  });

  const nowTime = new Date().toISOString();
  setLastSyncTime(nowTime);
  window.dispatchEvent(new CustomEvent('workshop-sync-complete'));

  return {
    success: true,
    workersCount: workers.length,
    logsCount: logs.length
  };
}

// ------------------------------------------------------------------------
// UNIVERSAL ROUTER (Supports both Supabase & Custom PHP/MySQL)
// ------------------------------------------------------------------------

export async function testConnectionUnified(config) {
  if (config.provider === 'supabase') {
    return await testSupabaseConnection(config.supabaseUrl, config.supabaseKey);
  } else {
    // PHP MySQL fallback
    return await testServerConnection(config.serverUrl, config.apiKey);
  }
}

export async function performSyncUnified() {
  const config = getSyncConfig();
  if (config.provider === 'supabase') {
    return await syncWithSupabase();
  } else {
    return await performSync();
  }
}

export async function pullAllUnified() {
  const config = getSyncConfig();
  if (config.provider === 'supabase') {
    return await pullAllFromSupabase();
  } else {
    return await pullAllFromServer();
  }
}

// PHP Server fallback functions
export async function testServerConnection(serverUrl, apiKey) {
  if (!serverUrl || !serverUrl.trim()) throw new Error('لطفاً آدرس سرور را وارد کنید.');
  const cleanUrl = serverUrl.trim();
  const urlWithAction = cleanUrl.includes('?') ? `${cleanUrl}&action=ping` : `${cleanUrl}?action=ping`;
  const headers = { 'Accept': 'application/json' };
  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    headers['X-API-Key'] = apiKey.trim();
  }
  const response = await fetch(urlWithAction, { method: 'GET', headers, cache: 'no-cache' });
  if (!response.ok) throw new Error(`خطای سرور: HTTP ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'پاسخ نامعتبر از سرور');
  return data;
}

export async function performSync() {
  const config = getSyncConfig();
  if (!config.serverUrl) throw new Error('آدرس سرور تنظیم نشده است.');
  const cleanUrl = config.serverUrl.trim();
  const syncUrl = cleanUrl.includes('?') ? `${cleanUrl}&action=sync` : `${cleanUrl}?action=sync`;
  const lastSyncTime = getLastSyncTime() || '1970-01-01 00:00:00';
  const localWorkers = await db.workers.toArray();
  const localLogs = await db.attendanceLogs.toArray();

  const response = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey.trim()}` } : {})
    },
    body: JSON.stringify({ lastSyncTime, changes: { workers: localWorkers, logs: localLogs } })
  });

  const resJson = await response.json();
  if (!resJson.success) throw new Error(resJson.error || 'همگام‌سازی با خطا مواجه شد.');
  setLastSyncTime(resJson.serverTime);
  window.dispatchEvent(new CustomEvent('workshop-sync-complete', { detail: resJson }));
  return { success: true, serverTime: resJson.serverTime };
}

export async function pullAllFromServer() {
  const config = getSyncConfig();
  if (!config.serverUrl) throw new Error('آدرس سرور تنظیم نشده است.');
  const cleanUrl = config.serverUrl.trim();
  const pullUrl = cleanUrl.includes('?') ? `${cleanUrl}&action=pull_all` : `${cleanUrl}?action=pull_all`;
  const response = await fetch(pullUrl, {
    headers: { ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey.trim()}` } : {}) }
  });
  const resJson = await response.json();
  if (!resJson.success || !resJson.data) throw new Error(resJson.error || 'داده‌ای دریافت نشد.');
  const { workers, logs } = resJson.data;
  await db.transaction('rw', [db.workers, db.attendanceLogs], async () => {
    await db.workers.clear();
    await db.attendanceLogs.clear();
    if (workers) await db.workers.bulkAdd(workers);
    if (logs) await db.attendanceLogs.bulkAdd(logs);
  });
  setLastSyncTime(resJson.serverTime);
  window.dispatchEvent(new CustomEvent('workshop-sync-complete'));
  return { success: true };
}
