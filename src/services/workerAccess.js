/**
 * Worker access links (magic link / QR login) — client side.
 *
 * A worker opens his/her own read-only profile from a personal link such as
 *   https://<app>/#t=<64-char-random-token>
 * with NO username, password or workspace code.
 *
 * Security model (see supabase/migrations/20261011_worker_access_links.sql):
 *  - The raw token exists only in the link. The server stores just its SHA-256 hash.
 *  - The token lives in the URL *fragment* (#...), which browsers never send to servers
 *    and never leak through the Referer header.
 *  - The worker device talks to Supabase ONLY through two RPCs:
 *      worker_portal_login(token)  -> returns that worker's own data (nothing else)
 *      (admin) create_worker_access_link / revoke_worker_access_links
 *  - No admin credentials, other workers' credentials or other tenants' data are
 *    ever sent to the worker's device.
 */
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { supabase, pushWorkerLive } from './realtimeSync';

export const WORKER_ACCESS_TOKEN_KEY = 'karsync_worker_access_token';
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

/** Read the access token from the URL fragment (#t=...). Returns null if absent/invalid. */
export function readAccessTokenFromUrl() {
  try {
    const m = (window.location.hash || '').match(/[#&]t=([A-Za-z0-9_-]{32,128})(?:&|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Remove the token from the address bar (so it is not bookmarked / shared by accident). */
export function clearAccessTokenFromUrl() {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (_) {}
}

export function getStoredWorkerAccessToken() {
  try {
    return localStorage.getItem(WORKER_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearStoredWorkerAccessToken() {
  try {
    localStorage.removeItem(WORKER_ACCESS_TOKEN_KEY);
  } catch (_) {}
}

export function buildWorkerAccessUrl(token) {
  return `${window.location.origin}/#t=${token}`;
}

/* ------------------------------------------------------------------ */
/* Admin side                                                          */
/* ------------------------------------------------------------------ */

/**
 * Create (or regenerate) the access link of a worker. Any previous link of the
 * same worker is deactivated. Returns { token, url }.
 */
export async function createWorkerAccessLink(workerId) {
  // The worker must exist in the cloud before a token can point to it
  try {
    const local = await db.workers.get(workerId);
    if (local) await pushWorkerLive(local);
  } catch (_) {}

  const { data, error } = await supabase.rpc('create_worker_access_link', { p_worker_id: workerId });
  if (error) {
    const err = new Error(error.message || 'create_worker_access_link failed');
    err.code = error.code;
    throw err;
  }
  return { token: data, url: buildWorkerAccessUrl(data) };
}

/** Deactivate every active link of a worker. */
export async function revokeWorkerAccessLinks(workerId) {
  const { error } = await supabase.rpc('revoke_worker_access_links', { p_worker_id: workerId });
  if (error) {
    const err = new Error(error.message || 'revoke_worker_access_links failed');
    err.code = error.code;
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Worker side                                                         */
/* ------------------------------------------------------------------ */

function mapWorker(w) {
  const meta = w.meta || {};
  return {
    id: w.id,
    name: w.name,
    phone: w.phone || '',
    role: w.role || 'کارگر',
    dailyRate: Number(w.daily_rate) || 0,
    overtimeHourlyRate: Number(w.overtime_hourly_rate) || 0,
    isActive: Number(w.is_active) === 0 ? 0 : 1,
    defaultSectionId: meta.defaultSectionId ?? null,
    groupId: meta.groupId ?? null,
    teamRole: meta.teamRole || 'Worker',
    wageType: meta.wageType || 'standard',
    isArchived: meta.isArchived !== undefined ? !!meta.isArchived : false,
    status: meta.status || (meta.isArchived ? 'archived' : 'active'),
    username: '',
    password: '',
    projectId: w.project_id_resolved || w.project_id || DEFAULT_PROJECT_ID,
    userId: 'worker_portal',
    createdAt: w.created_at,
    updatedAt: w.updated_at
  };
}

function mapLog(l) {
  let sectionId = l.section_id || null;
  let projectId = l.project_id || DEFAULT_PROJECT_ID;
  let isSettled = Boolean(l.is_settled);
  let settlementReceiptId = l.settlement_receipt_id || null;
  let notes = l.notes || '';

  // Same "__META__{...}__META__" convention used by the admin sync
  if (notes.includes('__META__')) {
    const parts = notes.split('__META__');
    if (parts.length >= 3) {
      try {
        const meta = JSON.parse(parts[1]);
        if (meta.s) sectionId = meta.s;
        if (meta.p) projectId = meta.p;
        isSettled = Boolean(meta.st);
        settlementReceiptId = meta.rid || null;
        notes = parts.slice(2).join('').trim();
      } catch (_) {}
    }
  }

  return {
    id: l.id,
    workerId: l.worker_id,
    date: l.date,
    type: l.type || 'full',
    overtimeHours: Number(l.overtime_hours) || 0,
    calculatedDailyWage: Number(l.calculated_daily_wage) || 0,
    calculatedOvertimeWage: Number(l.calculated_overtime_wage) || 0,
    totalDayPay: Number(l.total_day_pay) || 0,
    notes,
    sectionId,
    projectId,
    isSettled,
    settlementReceiptId,
    userId: 'worker_portal',
    createdAt: l.created_at,
    updatedAt: l.updated_at
  };
}

function mapPayment(p) {
  return {
    ...p,
    projectId: p.projectId || p.project_id || DEFAULT_PROJECT_ID,
    userId: p.userId || p.user_id || 'worker_portal',
    amount: Number(p.amount) || 0
  };
}

function mapProject(p) {
  return {
    id: p.id,
    userId: 'worker_portal',
    name: p.name,
    currency: p.currency || 'IQD',
    standardWorkHours: Number(p.standardWorkHours) || 8,
    overtimeMultiplier: Number(p.overtimeMultiplier) || 1.0,
    status: p.status || 'active',
    notes: ''
  };
}

/** Replace the local copy of the portal data with what the server returned. */
async function applyBundle(bundle) {
  const workers = (bundle.workers || []).map(mapWorker);
  const logs = (bundle.logs || []).map(mapLog);
  const payments = (bundle.payments || []).map(mapPayment);
  const projects = (bundle.projects || []).map(mapProject);
  const groups = bundle.group ? [bundle.group] : [];

  await db.transaction('rw', [db.workers, db.attendanceLogs, db.payments, db.groups, db.projects], async () => {
    await db.workers.clear();
    await db.attendanceLogs.clear();
    await db.payments.clear();
    await db.groups.clear();

    if (workers.length) await db.workers.bulkPut(workers);
    if (logs.length) await db.attendanceLogs.bulkPut(logs);
    if (payments.length) await db.payments.bulkPut(payments);
    if (groups.length) await db.groups.bulkPut(groups);
    if (projects.length) await db.projects.bulkPut(projects);
  });
}

/**
 * Validate a token and load the worker's data.
 * Resolves to { success: true, workerId, name } or { success: false, error } where error is one of:
 *   'invalid_token' | 'account_blocked' | 'offline' | 'network' | 'not_configured'
 *
 * @param {string} token
 * @param {{ beforeApply?: (workerId: string) => Promise<void> | void }} [opts]
 */
export async function loginWithAccessToken(token, opts = {}) {
  if (!token || !TOKEN_RE.test(token)) return { success: false, error: 'invalid_token' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { success: false, error: 'offline' };
  }

  let res;
  try {
    res = await supabase.rpc('worker_portal_login', { p_token: token });
  } catch (err) {
    return { success: false, error: 'network', detail: err?.message };
  }

  const { data, error } = res || {};
  if (error) {
    // PGRST202 = function not found -> the SQL migration has not been applied yet
    if (error.code === 'PGRST202' || /Could not find the function/i.test(error.message || '')) {
      return { success: false, error: 'not_configured', detail: error.message };
    }
    return { success: false, error: 'network', detail: error.message };
  }
  if (!data?.ok) {
    return { success: false, error: data?.error || 'invalid_token' };
  }

  if (opts.beforeApply) await opts.beforeApply(data.worker_id);
  await applyBundle(data);

  try {
    localStorage.setItem(WORKER_ACCESS_TOKEN_KEY, token);
  } catch (_) {}

  const me = (data.workers || []).find((w) => w.id === data.worker_id);
  return { success: true, workerId: data.worker_id, name: me?.name || '' };
}

/** Re-download the worker's data using the token saved on this device. */
export async function refreshWorkerPortalData() {
  const token = getStoredWorkerAccessToken();
  if (!token) return { success: false, error: 'no_token' };
  return loginWithAccessToken(token);
}
