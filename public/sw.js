const CACHE_NAME = 'karsync-cache-v31';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/karsync-icon.png',
  '/karsync-icon-192.png',
  '/karsync-logo.png',
  '/fonts/NotoSansArabic.woff2',
  '/fonts/Exo2-Regular.woff2'
];

/* ========================================================================== */
/* Background Worker Notification State Store (IndexedDB inside SW)           */
/* ========================================================================== */
const SW_DB_NAME = 'karsync_sw_worker_db';
const SW_STORE_NAME = 'worker_config';
const SW_CONFIG_KEY = 'active_worker';
let lastSwCheckAt = 0;

function openSwDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SW_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SW_STORE_NAME)) {
        db.createObjectStore(SW_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getSwWorkerConfig() {
  try {
    const db = await openSwDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SW_STORE_NAME, 'readonly');
      const req = tx.objectStore(SW_STORE_NAME).get(SW_CONFIG_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setSwWorkerConfig(config) {
  try {
    const db = await openSwDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SW_STORE_NAME, 'readwrite');
      if (config) {
        tx.objectStore(SW_STORE_NAME).put(config, SW_CONFIG_KEY);
      } else {
        tx.objectStore(SW_STORE_NAME).delete(SW_CONFIG_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IDB errors in restricted contexts
  }
}

function formatNum(num) {
  const n = Math.round(Number(num) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getWorkTypeLabel(type, lang) {
  if (lang === 'ku') {
    if (type === 'full') return 'ڕۆژی تەواو';
    if (type === 'half') return 'نیو ڕۆژ';
    return 'کاتژمێری';
  }
  if (type === 'full') return 'روز کامل';
  if (type === 'half') return 'نیم‌روز';
  return 'ساعتی';
}

function buildLogSignature(l) {
  const isSettled = Boolean(l.is_settled || l.isSettled);
  return `${l.type || 'full'}|${Number(l.overtime_hours ?? l.overtimeHours) || 0}|${Number(l.total_day_pay ?? l.totalDayPay) || 0}|${isSettled ? 1 : 0}`;
}

/**
 * Background check executed directly inside the Service Worker (even when no app tab is open).
 * Strictly inspects ONLY the authenticated worker's own attendance logs and settlements/payments.
 */
async function checkWorkerPortalUpdatesInSW(force = false) {
  const now = Date.now();
  if (!force && now - lastSwCheckAt < 25000) return;
  lastSwCheckAt = now;

  try {
    // If an active visible client window is already focused, let the foreground UI handle live updates
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasFocusedVisibleClient = clientList.some((c) => c.focused && c.visibilityState === 'visible');
    if (hasFocusedVisibleClient && !force) return;

    const cfg = await getSwWorkerConfig();
    if (!cfg || !cfg.enabled || !cfg.token || !cfg.workerId || !cfg.supabaseUrl || !cfg.supabaseKey) {
      return;
    }

    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/worker_portal_login`, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseKey,
        Authorization: `Bearer ${cfg.supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_token: cfg.token })
    });

    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.ok) return;

    const workerIdStr = String(cfg.workerId);
    const lang = cfg.language || 'fa';
    const currencySymbol = cfg.currencySymbol || 'د.ع';

    // Strictly filter ONLY this worker's own records (never notify for other workers or admin events)
    const myLogs = (data.logs || []).filter((l) => String(l.worker_id || l.workerId) === workerIdStr);
    const myPayments = (data.payments || []).filter((p) => String(p.worker_id || p.workerId) === workerIdStr);

    const prevLogSigs = cfg.knownLogSigs || {};
    const prevPayIds = new Set(cfg.knownPaymentIds || []);

    const nextLogSigs = {};
    const nextPayIds = [];
    const notificationsToShow = [];

    for (const l of myLogs) {
      const sig = buildLogSignature(l);
      nextLogSigs[l.id] = sig;

      if (cfg.initialized) {
        const prevSig = prevLogSigs[l.id];
        if (!prevSig) {
          // Brand new attendance log recorded for this worker
          const wType = getWorkTypeLabel(l.type, lang);
          const ot = Number(l.overtime_hours ?? l.overtimeHours) || 0;
          const pay = Number(l.total_day_pay ?? l.totalDayPay) || 0;
          notificationsToShow.push({
            tag: `karsync_worker_log_${l.id}`,
            title: lang === 'ku' ? 'تۆمارکردنی کارکردی نوێ • KarSync' : 'ثبت کارکرد جدید • KarSync',
            body:
              lang === 'ku'
                ? `کارکردی ڕۆژی ${l.date} (${wType}${ot > 0 ? ` + ${ot} کاتژمێر سەروەخت` : ''}) بە بڕی ${formatNum(pay)} ${currencySymbol} بۆ تۆ تۆمار کرا.`
                : `کارکرد تاریخ ${l.date} (${wType}${ot > 0 ? ` + ${ot} ساعت اضافه‌کاری` : ''}) به مبلغ ${formatNum(pay)} ${currencySymbol} برای شما ثبت شد.`
          });
        } else if (prevSig !== sig) {
          const prevSettled = prevSig.endsWith('|1');
          const nowSettled = sig.endsWith('|1');
          if (!prevSettled && nowSettled) {
            notificationsToShow.push({
              tag: `karsync_worker_log_settled_${l.id}`,
              title: lang === 'ku' ? 'تەسویەکردنی کارکرد • KarSync' : 'تسویه‌حساب کارکرد • KarSync',
              body:
                lang === 'ku'
                  ? `کارکردی ڕۆژی ${l.date} تەسویە کرا.`
                  : `کارکرد روز ${l.date} شما تسویه‌حساب شد.`
            });
          } else {
            const wType = getWorkTypeLabel(l.type, lang);
            const pay = Number(l.total_day_pay ?? l.totalDayPay) || 0;
            notificationsToShow.push({
              tag: `karsync_worker_log_upd_${l.id}_${Date.now()}`,
              title: lang === 'ku' ? 'نوێکردنەوەی کارکرد • KarSync' : 'ویرایش و ثبت کارکرد • KarSync',
              body:
                lang === 'ku'
                  ? `کارکردی ڕۆژی ${l.date} (${wType}) بە بڕی ${formatNum(pay)} ${currencySymbol} نوێکرایەوە.`
                  : `کارکرد تاریخ ${l.date} (${wType}) به مبلغ ${formatNum(pay)} ${currencySymbol} بروزرسانی شد.`
            });
          }
        }
      }
    }

    for (const p of myPayments) {
      nextPayIds.push(p.id);
      if (cfg.initialized && !prevPayIds.has(p.id)) {
        const isSettlement = p.type === 'settlement';
        const amt = formatNum(p.amount);
        notificationsToShow.push({
          tag: `karsync_worker_pay_${p.id}`,
          title: isSettlement
            ? lang === 'ku'
              ? 'تۆمارکردنی تەسویەحیساب • KarSync'
              : 'ثبت تسویه‌حساب جدید • KarSync'
            : lang === 'ku'
            ? 'تۆمارکردنی پێشەکی (مساعده) • KarSync'
            : 'ثبت پرداختی / مساعده جدید • KarSync',
          body: isSettlement
            ? lang === 'ku'
              ? `بڕی ${amt} ${currencySymbol} وەک تەسویەحیساب لە بەرواری ${p.date} بۆ تۆ تۆمار کرا.`
              : `مبلغ ${amt} ${currencySymbol} بابت تسویه‌حساب در تاریخ ${p.date} برای شما ثبت شد.`
            : lang === 'ku'
            ? `بڕی ${amt} ${currencySymbol} وەک پێشەکی لە بەرواری ${p.date} بۆ تۆ تۆمار کرا.`
            : `مبلغ ${amt} ${currencySymbol} بابت مساعده در تاریخ ${p.date} برای شما ثبت شد.`
        });
      }
    }

    await setSwWorkerConfig({
      ...cfg,
      initialized: true,
      knownLogSigs: nextLogSigs,
      knownPaymentIds: nextPayIds,
      updatedAt: Date.now()
    });

    for (const notif of notificationsToShow.slice(0, 3)) {
      await self.registration.showNotification(notif.title, {
        body: notif.body,
        icon: '/karsync-icon-192.png',
        badge: '/karsync-icon.png',
        tag: notif.tag,
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: '/#portal', workerOnly: true }
      });
    }
  } catch {
    // Silent fail on offline or network hiccup
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(ASSETS_TO_CACHE.map((url) => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/* ========================================================================== */
/* Message, PeriodicSync, Sync, Push & NotificationClick Listeners            */
/* ========================================================================== */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'SYNC_WORKER_SW_STATE') {
    event.waitUntil(setSwWorkerConfig(data.payload));
  } else if (data.type === 'CLEAR_WORKER_SW_STATE') {
    event.waitUntil(setSwWorkerConfig(null));
  } else if (data.type === 'CHECK_WORKER_UPDATES_NOW') {
    event.waitUntil(checkWorkerPortalUpdatesInSW(true));
  } else if (data.type === 'SHOW_OS_NOTIFICATION' && data.payload) {
    const { title, body, tag, url } = data.payload;
    event.waitUntil(
      self.registration.showNotification(title || 'KarSync', {
        body: body || '',
        icon: '/karsync-icon-192.png',
        badge: '/karsync-icon.png',
        tag: tag || 'karsync_notif_' + Date.now(),
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: url || '/' }
      })
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'karsync-worker-bg-check') {
    event.waitUntil(checkWorkerPortalUpdatesInSW(true));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'karsync-worker-sync') {
    event.waitUntil(checkWorkerPortalUpdatesInSW(true));
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      if (event.data) {
        try {
          const payload = event.data.json();
          const cfg = await getSwWorkerConfig();
          // Strict guard: only display push if it matches this worker's ID and is attendance/settlement
          if (
            cfg &&
            cfg.workerId &&
            String(payload.workerId) === String(cfg.workerId) &&
            (payload.category === 'attendance' || payload.category === 'settlement')
          ) {
            await self.registration.showNotification(payload.title || 'KarSync', {
              body: payload.body || '',
              icon: '/karsync-icon-192.png',
              badge: '/karsync-icon.png',
              tag: payload.tag || 'karsync_push_' + Date.now(),
              renotify: true,
              vibrate: [200, 100, 200],
              data: { url: '/#portal' }
            });
            return;
          }
        } catch {
          // Fallback to checking RPC directly
        }
      }
      await checkWorkerPortalUpdatesInSW(true);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'WORKER_NOTIFICATION_CLICKED' });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Opportunistically check for background worker notifications when SW wakes up
  checkWorkerPortalUpdatesInSW(false).catch(() => {});

  if (event.request.url.includes('supabase.co')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
