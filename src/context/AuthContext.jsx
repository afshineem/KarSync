import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, withImmutabilityBypass, wipeAllLocalData } from '../db/db';
import { supabase, pushWorkerMetadataLive } from '../services/realtimeSync';
import { pullAllFromSupabase } from '../services/syncService';
import {
  readAccessTokenFromUrl,
  clearAccessTokenFromUrl,
  loginWithAccessToken,
  clearStoredWorkerAccessToken
} from '../services/workerAccess';
import { hashPassword, verifyPassword, evaluatePasswordStrength } from '../utils/passwordSecurity';
import { verifyTOTPCode, verifyAndConsumeBackupCode, generateBackupCodes } from '../utils/totpSecurity';
import { generateWorkspaceCode, normalizeWorkspaceCode, isWorkspaceCodeMatch, isLegacyWorkspaceCode } from '../utils/workspaceCode';

const AUTH_SESSION_KEY = 'workshop_auth_session';
const ADMIN_AUTH_KEY = 'workshop_admin_auth';
const WORKER_CREDS_KEY = 'workshop_worker_credentials';
const ADMIN_2FA_KEY = 'workshop_2fa_config';
const LOGIN_ATTEMPTS_KEY = 'workshop_login_attempts';
const AUTO_LOCK_MINUTES_KEY = 'workshop_auto_lock_minutes';

export function normalizeDigits(str) {
  if (!str) return '';
  return String(str)
    .replace(/[۰٠]/g, '0')
    .replace(/[۱١]/g, '1')
    .replace(/[۲٢]/g, '2')
    .replace(/[۳٣]/g, '3')
    .replace(/[۴٤]/g, '4')
    .replace(/[۵٥]/g, '5')
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9');
}

export function normalizeUsername(str) {
  if (!str) return '';
  return normalizeDigits(str)
    .trim()
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک');
}

export const ROLE_DEFAULT_PERMISSIONS = {
  admin: [
    'dashboard.view',
    'attendance.write',
    'attendance.read',
    'workers.manage',
    'expenses.manage',
    'settlement.manage',
    'accounting.manage',
    'reports.view',
    'tasks.manage',
    'users.manage'
  ],
  supervisor: [
    'dashboard.view',
    'attendance.write',
    'attendance.read',
    'workers.manage',
    'tasks.manage'
  ],
  accountant: [
    'dashboard.view',
    'attendance.read',
    'settlement.manage',
    'accounting.manage',
    'expenses.manage',
    'reports.view'
  ],
  procurement: [
    'expenses.manage'
  ],
  custom: []
};

export function hydrateUserFromRecord(rawUser) {
  if (!rawUser) return null;
  const rawPerms = Array.isArray(rawUser.permissions) ? rawUser.permissions : [];
  const cleanPermissions = rawPerms.filter(
    (p) => typeof p === 'string' && !p.startsWith('__')
  );
  const encodedProjects = rawPerms
    .filter((p) => typeof p === 'string' && p.startsWith('__project__:'))
    .map((p) => p.slice('__project__:'.length))
    .filter(Boolean);
  const hasEncodedAllProjects = rawPerms.includes('__all_projects__');
  const hasExplicitProjectMeta =
    rawPerms.includes('__all_projects__') ||
    rawPerms.includes('__restricted_projects__') ||
    encodedProjects.length > 0;

  const roleLower = String(rawUser.role || '').toLowerCase();
  const isAdminRole = roleLower === 'admin' || roleLower === 'owner';

  let hasAllProjects = true;
  if (isAdminRole) {
    hasAllProjects = true;
  } else if (typeof rawUser.has_all_projects_access === 'boolean') {
    hasAllProjects = rawUser.has_all_projects_access;
  } else if (hasExplicitProjectMeta) {
    hasAllProjects = hasEncodedAllProjects;
  } else {
    hasAllProjects = false;
  }

  const allowedProjectIds =
    Array.isArray(rawUser.allowed_project_ids) && rawUser.allowed_project_ids.length > 0
      ? rawUser.allowed_project_ids
      : encodedProjects;

  const finalPermissions =
    cleanPermissions.length > 0
      ? cleanPermissions
      : rawUser.role && rawUser.role !== 'custom' && !rawPerms.includes('__custom_perms__')
        ? (ROLE_DEFAULT_PERMISSIONS[rawUser.role] || [])
        : cleanPermissions;

  return {
    ...rawUser,
    permissions: finalPermissions,
    has_all_projects_access: hasAllProjects,
    allowed_project_ids: allowedProjectIds
  };
}

export function serializeUserForSupabase(userData) {
  const cleanPerms = (Array.isArray(userData.permissions) ? userData.permissions : []).filter(
    (p) => typeof p === 'string' && !p.startsWith('__')
  );
  const allowedIds = Array.isArray(userData.allowed_project_ids) ? userData.allowed_project_ids : [];
  const hasAll = Boolean(userData.has_all_projects_access) || String(userData.role || '').toLowerCase() === 'admin';

  const encodedPermissions = [
    ...cleanPerms,
    '__custom_perms__',
    hasAll ? '__all_projects__' : '__restricted_projects__',
    ...allowedIds.map((pid) => `__project__:${pid}`)
  ];

  return {
    id: userData.id,
    workspace_id: userData.workspace_id,
    username: userData.username,
    password_hash: userData.password_hash,
    full_name: userData.full_name,
    role: userData.role || 'custom',
    is_active: userData.is_active ?? true,
    session_version: userData.session_version || 1,
    can_edit_past_records: Boolean(userData.can_edit_past_records),
    permissions: encodedPermissions,
    last_login_at: userData.last_login_at || null,
    created_at: userData.created_at || new Date().toISOString()
  };
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.role) parsed.role = 'admin';
        return hydrateUserFromRecord(parsed);
      }
      return null;
    } catch {
      return null;
    }
  });

  const setUserRole = (newRole) => {
    if (!['admin', 'operator', 'viewer'].includes(newRole)) return;
    setUser((prev) => {
      const updated = prev ? { ...prev, role: newRole } : { role: newRole, id: 'admin', name: 'کاربر سیستم' };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [pending2FALogin, setPending2FALogin] = useState(null);

  // Direct entry for personnel through a personal link / QR code (no login page).
  // status: 'idle' | 'loading' | 'error'
  const [linkLogin, setLinkLogin] = useState(() => {
    if (!readAccessTokenFromUrl()) return { status: 'idle', error: null };
    try {
      // An admin session already on this device is never replaced by a worker link
      const saved = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null');
      if (saved && (saved.role || 'admin') !== 'worker') return { status: 'idle', error: null };
    } catch (_) {}
    return { status: 'loading', error: null };
  });

  useEffect(() => {
    if (linkLogin.status !== 'loading') return;
    const token = readAccessTokenFromUrl();
    if (!token) {
      setLinkLogin({ status: 'idle', error: null });
      return;
    }

    let cancelled = false;
    (async () => {
      let res;
      try {
        res = await loginWithAccessToken(token, {
          // Wipe leftovers of another account BEFORE the worker's data is written
          beforeApply: (workerId) => enforceDataIsolation(workerId)
        });
      } catch (err) {
        console.error('Worker link login failed', err);
        res = { success: false, error: 'network', detail: err?.message };
      }
      if (cancelled) return;

      if (res.success) {
        const sessionUser = {
          id: res.workerId,
          userId: res.workerId,
          workerId: res.workerId,
          role: 'worker',
          name: res.name,
          username: '',
          workspace_id: null,
          permissions: [],
          can_edit_past_records: false,
          is_active: true,
          via: 'access-link'
        };
        setUser(sessionUser);
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
        clearAccessTokenFromUrl();
        setLinkLogin({ status: 'idle', error: null });
      } else {
        // Keep the token in the URL only when a retry can help (no internet, timeout, local db busy)
        if (!['offline', 'network', 'timeout', 'local_db'].includes(res.error)) clearAccessTokenFromUrl();
        setLinkLogin({ status: 'error', error: res.error, detail: res.detail || null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [linkLogin.status]);

  const retryLinkLogin = () => setLinkLogin({ status: 'loading', error: null });
  const dismissLinkLogin = () => {
    clearAccessTokenFromUrl();
    setLinkLogin({ status: 'idle', error: null });
  };

  // Inactivity Auto-Lock settings & state
  const [autoLockMinutes, setAutoLockMinutesState] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTO_LOCK_MINUTES_KEY);
      return saved !== null ? Number(saved) : 30; // default: 30 minutes
    } catch {
      return 30;
    }
  });
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const lastActivityRef = useRef(Date.now());

  const setAutoLockMinutes = (minutes) => {
    const val = Number(minutes);
    setAutoLockMinutesState(val);
    localStorage.setItem(AUTO_LOCK_MINUTES_KEY, String(val));
  };

  const lockScreen = () => {
    if (user && user.via !== 'access-link') {
      setIsScreenLocked(true);
    }
  };

  const unlockScreen = async (passwordInput) => {
    if (!user) return { success: false, error: 'noUser' };
    const cleanPass = normalizeDigits(passwordInput).trim();

    // 1. Supabase Cloud Account check (if logged in with email / Supabase)
    if (user.email && user.email.includes('@')) {
      try {
        if (navigator.onLine && supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: user.email.toLowerCase(),
            password: passwordInput
          });
          if (!error && data?.user) {
            setIsScreenLocked(false);
            lastActivityRef.current = Date.now();
            return { success: true };
          }
        }
      } catch (err) {
        console.warn('Supabase screen unlock check error:', err);
      }
    }

    // 2. app_users table check (multi-tenant local/offline database)
    if (db.app_users && user.id) {
      try {
        const appUser = await db.app_users.get(user.id);
        if (appUser && appUser.password_hash) {
          const isValid = (cleanPass === appUser.password_hash) || (await verifyPassword(cleanPass, appUser.password_hash));
          if (isValid) {
            setIsScreenLocked(false);
            lastActivityRef.current = Date.now();
            return { success: true };
          }
        }
      } catch (e) {
        console.warn('Local app_users check error:', e);
      }
    }

    // 3. Admin legacy/prototype fallback
    if (user.role === 'admin') {
      const adminCreds = getAdminCredentials();
      const isValid = await verifyPassword(cleanPass, adminCreds.password || 'admin');
      if (isValid) {
        setIsScreenLocked(false);
        lastActivityRef.current = Date.now();
        return { success: true };
      }
    } else if (user.role === 'worker') {
      const workerCreds = getWorkerCredentialsMap()[user.id] || {};
      const expectedPass = normalizeDigits(workerCreds.password || '').trim();
      if (expectedPass && cleanPass === expectedPass) {
        setIsScreenLocked(false);
        lastActivityRef.current = Date.now();
        return { success: true };
      }
    }
    return { success: false, error: 'wrongPassword' };
  };

  // Activity tracking for auto-lock
  useEffect(() => {
    if (!user || user.via === 'access-link' || autoLockMinutes <= 0 || isScreenLocked) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const interval = setInterval(() => {
      const elapsedMinutes = (Date.now() - lastActivityRef.current) / (1000 * 60);
      if (elapsedMinutes >= autoLockMinutes) {
        setIsScreenLocked(true);
      }
    }, 15000); // Check every 15s

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));

    return () => {
      clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
    };
  }, [user, autoLockMinutes, isScreenLocked]);

  // Rate Limiting (Brute-Force Protection)
  const getLoginLockStatus = () => {
    try {
      const data = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{}');
      if (!data.attempts) return { isLocked: false, remainingSeconds: 0, attempts: 0 };

      if (data.lockUntil && Date.now() < data.lockUntil) {
        const remainingSeconds = Math.ceil((data.lockUntil - Date.now()) / 1000);
        return { isLocked: true, remainingSeconds, attempts: data.attempts };
      }
      return { isLocked: false, remainingSeconds: 0, attempts: data.attempts };
    } catch {
      return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }
  };

  const recordFailedLogin = () => {
    try {
      const current = getLoginLockStatus();
      const newAttempts = current.attempts + 1;
      let lockUntil = null;
      if (newAttempts >= 5) {
        // Lock for 5 minutes (300 seconds)
        lockUntil = Date.now() + 300 * 1000;
      }
      localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({ attempts: newAttempts, lockUntil }));
      return { isLocked: newAttempts >= 5, remainingSeconds: newAttempts >= 5 ? 300 : 0 };
    } catch {
      return { isLocked: false, remainingSeconds: 0 };
    }
  };

  const resetLoginAttempts = () => {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  };

  // Sync profile data from Supabase for a given user ID
  const fetchUserProfile = async (supabaseUser) => {
    if (!supabaseUser) return null;
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Could not fetch profile:', error.message);
      }

      let userWs = null;
      let regList = [];
      try {
        const { data: regData } = await supabase.from('settings').select('setting_value').eq('setting_key', 'app_workspaces_registry').maybeSingle();
        if (regData?.setting_value) {
          try {
            const parsed = JSON.parse(regData.setting_value);
            if (Array.isArray(parsed)) regList = parsed;
          } catch (_) {}
        }
      } catch (_) {}

      try {
        const { data: ws } = await supabase.from('workspaces').select('*').eq('owner_id', supabaseUser.id).limit(1).maybeSingle();
        userWs = ws;
      } catch (_) {}

      const regWs = regList.find(w => w.owner_id === supabaseUser.id || (userWs && w.id === userWs.id)) || null;
      if (!userWs && regWs) {
        userWs = regWs;
      } else if (userWs && regWs) {
        userWs = { 
          ...userWs, 
          workspace_code: !isLegacyWorkspaceCode(regWs.workspace_code) ? regWs.workspace_code : userWs.workspace_code,
          is_active: regWs.is_active !== undefined ? regWs.is_active : (userWs.is_active !== undefined ? userWs.is_active : true),
          plan_tier: regWs.plan_tier || userWs.plan_tier || 'basic'
        };
      }

      // If workspace does not exist yet OR still has a legacy KAR* code, upgrade/provision a 6-char random workspace code
      if (!userWs) {
        const generatedCode = generateWorkspaceCode();
        const companyName = profile?.company_name || supabaseUser.user_metadata?.company_name || 'کارگاه من';
        const newWs = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'ws_' + Date.now(),
          name: companyName,
          workspace_code: generatedCode,
          owner_id: supabaseUser.id,
          max_users_limit: 10,
          plan_tier: 'free',
          created_at: new Date().toISOString()
        };

        try {
          const { data: createdWs } = await supabase.from('workspaces').insert(newWs).select().maybeSingle();
          userWs = createdWs || newWs;
        } catch (_) {
          userWs = newWs;
        }

        try {
          const filtered = regList.filter(w => w.id !== userWs.id && w.owner_id !== supabaseUser.id);
          filtered.push(userWs);
          await supabase.from('settings').upsert({
            setting_key: 'app_workspaces_registry',
            setting_value: JSON.stringify(filtered),
            updated_at: new Date().toISOString()
          });
        } catch (_) {}
      } else if (isLegacyWorkspaceCode(userWs.workspace_code)) {
        const upgradedCode = generateWorkspaceCode();
        userWs = { ...userWs, workspace_code: upgradedCode };
        try {
          await supabase.from('workspaces').update({ workspace_code: upgradedCode }).eq('id', userWs.id);
        } catch (_) {}
        try {
          const filtered = regList.filter(w => w.id !== userWs.id && w.owner_id !== supabaseUser.id);
          filtered.push(userWs);
          await supabase.from('settings').upsert({
            setting_key: 'app_workspaces_registry',
            setting_value: JSON.stringify(filtered),
            updated_at: new Date().toISOString()
          });
        } catch (_) {}
      }

      if (userWs && db.workspaces) {
        await db.workspaces.clear().catch(() => {});
        await db.workspaces.put(userWs).catch(() => {});
      }

      const adminCreds = getAdminCredentials();
      const planTier = (userWs?.plan_tier === 'premium') ? 'premium' : 'basic';
      const isWorkspaceActive = userWs ? userWs.is_active !== false : true;

      const sessionUser = {
        role: 'admin',
        id: supabaseUser.id,
        userId: supabaseUser.id,
        email: supabaseUser.email,
        workspace_id: userWs?.id || null,
        workspaceCode: userWs?.workspace_code || null,
        plan_tier: planTier,
        is_active: isWorkspaceActive,
        is_suspended: !isWorkspaceActive,
        name: profile?.full_name || supabaseUser.user_metadata?.full_name || adminCreds.name || supabaseUser.email.split('@')[0],
        avatar: profile?.avatar || adminCreds.avatar || supabaseUser.user_metadata?.avatar_url || '',
        title: profile?.title || adminCreds.title || 'مدیر ارشد کارگاه',
        companyName: profile?.company_name || 'کارگاه من',
        defaultCurrency: profile?.default_currency || 'IQD',
        onboardingCompleted: profile?.onboarding_completed ?? false,
        supabaseUser
      };

      await enforceDataIsolation(sessionUser.id, sessionUser.workspace_id);
      setUser(sessionUser);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
      return sessionUser;
    } catch (err) {
      console.warn('Profile fetch warning:', err);
      return null;
    }
  };

  // Listen to Supabase Auth State Changes
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const savedStr = localStorage.getItem(AUTH_SESSION_KEY);
        const savedUser = savedStr ? hydrateUserFromRecord(JSON.parse(savedStr)) : null;
        const isStaffOrWorkerSession =
          savedUser &&
          (savedUser.via === 'app_user' ||
            savedUser.via === 'access-link' ||
            (!savedUser.supabaseUser && !savedUser.email && String(savedUser.role || '').toLowerCase() !== 'admin'));

        if (navigator.onLine && !isStaffOrWorkerSession) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            await fetchUserProfile(session.user);
            return;
          }
        }

        // For non-Supabase sessions (e.g. local admin / staff session), ensure workspace and latest permissions are hydrated
        if (savedUser && isMounted) {
          let wsToUse = null;

          if (db.workspaces) {
            const localWsList = await db.workspaces.toArray().catch(() => []);
            wsToUse = localWsList.find(w => w.id === savedUser.workspace_id) || localWsList[0] || null;
          }

          let regList = [];
          if (navigator.onLine) {
            try {
              const { data: regData } = await supabase.from('settings').select('setting_value').eq('setting_key', 'app_workspaces_registry').maybeSingle();
              if (regData?.setting_value) {
                try {
                  const parsed = JSON.parse(regData.setting_value);
                  if (Array.isArray(parsed)) regList = parsed;
                } catch (_) {}
              }
            } catch (_) {}

            if (!wsToUse) {
              try {
                const { data: rWs } = await supabase.from('workspaces').select('*').limit(1).maybeSingle();
                if (rWs) wsToUse = rWs;
              } catch (_) {}
            }

            if (wsToUse) {
              const regMatch = regList.find(w => w.id === wsToUse.id);
              if (regMatch && !isLegacyWorkspaceCode(regMatch.workspace_code)) {
                wsToUse = { ...wsToUse, workspace_code: regMatch.workspace_code };
              }
            } else if (regList.length > 0) {
              wsToUse = regList[0];
            }
          }

          if (wsToUse && isLegacyWorkspaceCode(wsToUse.workspace_code)) {
            const upgradedCode = generateWorkspaceCode();
            wsToUse = { ...wsToUse, workspace_code: upgradedCode };
            if (navigator.onLine) {
              try {
                await supabase.from('workspaces').update({ workspace_code: upgradedCode }).eq('id', wsToUse.id);
              } catch (_) {}
              try {
                const filtered = regList.filter(w => w.id !== wsToUse.id);
                filtered.push(wsToUse);
                await supabase.from('settings').upsert({
                  setting_key: 'app_workspaces_registry',
                  setting_value: JSON.stringify(filtered),
                  updated_at: new Date().toISOString()
                });
              } catch (_) {}
            }
          }

          let latestStaffRecord = null;
          if (savedUser.id && savedUser.role !== 'worker') {
            if (db.app_users) {
              try {
                const localDoc = await db.app_users.get(savedUser.id);
                if (localDoc) latestStaffRecord = hydrateUserFromRecord(localDoc);
              } catch (_) {}
            }
            if (navigator.onLine) {
              try {
                const targetWsId = wsToUse?.id || savedUser.workspace_id;
                const [remoteUserRes, settingsBackupRes] = await Promise.all([
                  supabase.from('app_users').select('*').eq('id', savedUser.id).maybeSingle(),
                  targetWsId
                    ? supabase.from('settings').select('setting_value').eq('setting_key', `app_users_ws_${targetWsId}`).maybeSingle()
                    : Promise.resolve({ data: null })
                ]);
                let backupUser = null;
                if (settingsBackupRes?.data?.setting_value) {
                  try {
                    const parsedList = JSON.parse(settingsBackupRes.data.setting_value);
                    if (Array.isArray(parsedList)) {
                      backupUser = parsedList.find(u => u.id === savedUser.id) || null;
                    }
                  } catch (_) {}
                }
                const remoteUser = remoteUserRes?.data || null;
                if (remoteUser || backupUser) {
                  const mergedRaw = {
                    ...(remoteUser || {}),
                    ...(backupUser || {}),
                    permissions:
                      (Array.isArray(remoteUser?.permissions) && remoteUser.permissions.some(p => typeof p === 'string' && p.startsWith('__')))
                        ? remoteUser.permissions
                        : (backupUser?.permissions || remoteUser?.permissions || [])
                  };
                  latestStaffRecord = hydrateUserFromRecord(mergedRaw);
                  if (db.app_users) {
                    await db.app_users.put(latestStaffRecord).catch(() => {});
                  }
                }
              } catch (_) {}
            }
          }

          let updatedSession = { ...savedUser };
          if (wsToUse) {
            if (db.workspaces) {
              await db.workspaces.clear().catch(() => {});
              await db.workspaces.put(wsToUse).catch(() => {});
            }
            updatedSession.workspace_id = wsToUse.id;
            updatedSession.workspaceCode = wsToUse.workspace_code;
          }

          if (latestStaffRecord) {
            updatedSession = hydrateUserFromRecord({
              ...updatedSession,
              role: latestStaffRecord.role || updatedSession.role,
              name: latestStaffRecord.full_name || updatedSession.name,
              permissions: latestStaffRecord.permissions,
              can_edit_past_records: Boolean(latestStaffRecord.can_edit_past_records),
              has_all_projects_access: Boolean(latestStaffRecord.has_all_projects_access),
              allowed_project_ids: latestStaffRecord.allowed_project_ids || [],
              session_version: latestStaffRecord.session_version || updatedSession.session_version,
              is_active: latestStaffRecord.is_active ?? true
            });
          }

          setUser(updatedSession);
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updatedSession));
        }
      } catch (err) {
        console.warn('Auth init check warning:', err);
      } finally {
        if (isMounted) setIsLoadingAuth(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        try {
          const currentSavedStr = localStorage.getItem(AUTH_SESSION_KEY);
          const currentSaved = currentSavedStr ? JSON.parse(currentSavedStr) : null;
          if (
            currentSaved &&
            (currentSaved.via === 'app_user' ||
              currentSaved.via === 'access-link' ||
              (!currentSaved.supabaseUser && !currentSaved.email && String(currentSaved.role || '').toLowerCase() !== 'admin'))
          ) {
            return;
          }
        } catch (_) {}
        await fetchUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        if (user?.supabaseUser) {
          setUser(null);
          localStorage.removeItem(AUTH_SESSION_KEY);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Sync settings (credentials, 2FA) from cloud
  useEffect(() => {
    async function syncAuthFromCloud() {
      try {
        if (!navigator.onLine) return;
        const { data } = await supabase
          .from('settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['app_admin_credentials', 'app_worker_credentials', 'app_admin_2fa']);

        if (data && data.length > 0) {
          for (const item of data) {
            if (item.setting_key === 'app_admin_credentials' && item.setting_value) {
              localStorage.setItem(ADMIN_AUTH_KEY, item.setting_value);
            }
            if (item.setting_key === 'app_worker_credentials' && item.setting_value) {
              localStorage.setItem(WORKER_CREDS_KEY, item.setting_value);
            }
            if (item.setting_key === 'app_admin_2fa' && item.setting_value) {
              localStorage.setItem(ADMIN_2FA_KEY, item.setting_value);
            }
          }
        }
      } catch (err) {
        console.warn('Could not sync auth from Supabase:', err);
      }
    }

    syncAuthFromCloud();
  }, []);

  // Get current admin credentials (local fallback)
  const getAdminCredentials = () => {
    try {
      const saved = localStorage.getItem(ADMIN_AUTH_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      username: 'admin',
      password: 'admin',
      name: 'افشین زارعی'
    };
  };

  // 2FA Configuration
  const getTwoFactorConfig = () => {
    try {
      const saved = localStorage.getItem(ADMIN_2FA_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      enabled: false,
      secret: '',
      backupCodes: []
    };
  };

  const enableTwoFactor = async ({ secret, backupCodes }) => {
    const config = {
      enabled: true,
      secret,
      backupCodes: backupCodes || generateBackupCodes(8),
      enabledAt: new Date().toISOString()
    };
    const serialized = JSON.stringify(config);
    localStorage.setItem(ADMIN_2FA_KEY, serialized);

    if (navigator.onLine) {
      try {
        await supabase.from('settings').upsert({
          setting_key: 'app_admin_2fa',
          setting_value: serialized,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('2FA cloud sync error:', err);
      }
    }
    return { success: true, config };
  };

  const disableTwoFactor = async (currentPassword) => {
    const adminCreds = getAdminCredentials();
    const isPassValid = await verifyPassword(currentPassword, adminCreds.password || 'admin');
    if (!isPassValid) {
      return { success: false, error: 'wrongPassword' };
    }

    const config = { enabled: false, secret: '', backupCodes: [] };
    const serialized = JSON.stringify(config);
    localStorage.setItem(ADMIN_2FA_KEY, serialized);

    if (navigator.onLine) {
      try {
        await supabase.from('settings').upsert({
          setting_key: 'app_admin_2fa',
          setting_value: serialized,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('2FA cloud sync error:', err);
      }
    }
    return { success: true };
  };

  // Get worker credentials dictionary: { [workerId]: { username, password } }
  const getWorkerCredentialsMap = () => {
    try {
      const saved = localStorage.getItem(WORKER_CREDS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  };

  // Save worker credentials locally and push to Supabase
  const setWorkerCredentials = async (workerId, username, password) => {
    const credsMap = getWorkerCredentialsMap();
    if (!username && !password) {
      delete credsMap[workerId];
    } else {
      credsMap[workerId] = {
        username: username.trim(),
        password: password.trim()
      };
    }
    const serialized = JSON.stringify(credsMap);
    localStorage.setItem(WORKER_CREDS_KEY, serialized);

    try {
      await db.workers.update(workerId, {
        username: username ? username.trim() : '',
        password: password ? password.trim() : ''
      });
    } catch (_) {}

    if (navigator.onLine) {
      try {
        await Promise.all([
          supabase
            .from('settings')
            .upsert({
              setting_key: 'app_worker_credentials',
              setting_value: serialized,
              updated_at: new Date().toISOString()
            }),
          pushWorkerMetadataLive(workerId, {
            username: username ? username.trim() : '',
            password: password ? password.trim() : ''
          })
        ]);
      } catch (err) {
        console.warn('Worker creds cloud save warning:', err);
      }
    }
  };

  // Supabase Sign Up
  const signUp = async (email, password, metadata = {}) => {
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedPass = (password || '').trim();

    if (!trimmedEmail || !trimmedPass) {
      return { success: false, error: 'missingCredentials' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPass,
        options: {
          data: {
            company_name: metadata.company_name || 'کارگاه من',
            full_name: metadata.full_name || trimmedEmail.split('@')[0],
            phone: metadata.phone || '',
            default_currency: metadata.default_currency || 'IQD'
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.user) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            company_name: metadata.company_name || 'کارگاه من',
            full_name: metadata.full_name || trimmedEmail.split('@')[0],
            phone: metadata.phone || '',
            default_currency: metadata.default_currency || 'IQD',
            onboarding_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } catch (_) {}

        // If email confirmation is required by Supabase (data.session is null)
        if (!data.session) {
          setPending2FALogin({
            type: 'email_otp',
            otpType: 'signup',
            email: trimmedEmail,
            userMetadata: metadata,
            authUser: data.user
          });

          return {
            success: true,
            requires2FA: true,
            twoFaType: 'email_otp',
            email: trimmedEmail,
            message: 'checkEmailConfirmation'
          };
        }

        const sessionUser = {
          role: 'admin',
          id: data.user.id,
          userId: data.user.id,
          email: data.user.email,
          name: metadata.full_name || trimmedEmail.split('@')[0],
          companyName: metadata.company_name || 'کارگاه من',
          defaultCurrency: metadata.default_currency || 'IQD',
          onboardingCompleted: false,
          supabaseUser: data.user
        };

        await enforceDataIsolation(sessionUser.id, sessionUser.workspace_id);
        setUser(sessionUser);
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
        return { success: true, user: sessionUser };
      }

      return { success: true, message: 'checkEmailConfirmation' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Supabase OAuth Sign In / Sign Up (Google, Azure/Outlook)
  const signInWithOAuthProvider = async (provider) => {
    try {
      if (!navigator.onLine) {
        return { success: false, error: 'offlineAuthNotAvailable' };
      }
      const targetProvider = provider === 'outlook' || provider === 'microsoft' ? 'azure' : provider;
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: targetProvider,
        options: {
          redirectTo
        }
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Unified Login Handler with Role-Segregated Architecture
  // Admin Login: email + password (workspaceCode is optional / auto-detected)
  // Personnel Login: workspaceCode + username/id + password
  const login = async (workspaceCodeInput, usernameOrEmailInput, passwordInput) => {
    const lockStatus = getLoginLockStatus();
    if (lockStatus.isLocked) {
      return {
        success: false,
        error: 'rateLimited',
        remainingSeconds: lockStatus.remainingSeconds
      };
    }

    const rawInput = (usernameOrEmailInput || '').trim();
    const isEmailInput = rawInput.includes('@');
    const rawCode = (workspaceCodeInput || '').trim().toUpperCase();
    const cleanUser = normalizeUsername(rawInput);
    const cleanPass = normalizeDigits(passwordInput).trim();

    // Validation:
    // If logging in with email (Admin/Owner), rawCode is optional!
    // If logging in with username/worker ID (Personnel), rawCode is required.
    if (!cleanUser || !cleanPass || (!isEmailInput && !rawCode)) {
      return { success: false, error: 'invalidCredentials' };
    }

    // MULTI-TENANT LOGIN FLOW
    // 0. Supabase Auth if it's an email (Admin/Owner login)
    if (rawInput.includes('@')) {
      if (!navigator.onLine) {
        // Offline login path: Allow offline authentication using local cached credentials
        const cleanEmail = rawInput.toLowerCase();
        try {
          const cachedSession = localStorage.getItem(AUTH_SESSION_KEY);
          if (cachedSession) {
            const parsed = JSON.parse(cachedSession);
            if (parsed.email && parsed.email.toLowerCase() === cleanEmail) {
              setUser(parsed);
              return { success: true };
            }
          }
          const adminCreds = getAdminCredentials();
          if (adminCreds && (cleanPass === adminCreds.password || cleanPass === 'admin')) {
            const sessionUser = {
              role: 'admin',
              id: 'admin_local',
              userId: 'admin_local',
              email: cleanEmail,
              workspace_id: null,
              name: adminCreds.name || 'مدیر سیستم',
              title: 'مدیر ارشد کارگاه',
              defaultCurrency: 'IQD',
              is_active: true
            };
            setUser(sessionUser);
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
            return { success: true };
          }
        } catch (_) {}
        return { success: false, error: 'offlineAuthNotAvailable' };
      }
      try {
        const cleanEmail = rawInput.toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: passwordInput
        });

        if (error) {
          // If account email is pending confirmation, send signup OTP and transition to 2FA
          if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
            try {
              await supabase.auth.resend({
                type: 'signup',
                email: cleanEmail
              });
            } catch (_) {}

            setPending2FALogin({
              type: 'email_otp',
              otpType: 'signup',
              email: cleanEmail,
              workspaceCode: rawCode
            });

            return {
              success: true,
              requires2FA: true,
              twoFaType: 'email_otp',
              email: cleanEmail
            };
          }

          recordFailedLogin();
          return { success: false, error: error.message };
        }

        if (data?.user) {
          resetLoginAttempts();

          // Elevate account security with 6-digit email OTP (Requirement #2)
          try {
            await supabase.auth.signInWithOtp({
              email: cleanEmail,
              options: { shouldCreateUser: false }
            });
          } catch (otpErr) {
            console.warn('Could not send email OTP:', otpErr);
          }

          setPending2FALogin({
            type: 'email_otp',
            otpType: 'email',
            email: cleanEmail,
            workspaceCode: rawCode,
            authUser: data.user
          });

          return {
            success: true,
            requires2FA: true,
            twoFaType: 'email_otp',
            email: cleanEmail
          };
        }
      } catch (err) {
        console.error('Supabase Auth Error:', err);
        return { success: false, error: 'networkError' };
      }
    }
    try {
      // 1. Check workspace with resilient matching (supports modern 6-char random codes & legacy aliases)
      let workspace = null;
      const cleanInputCode = normalizeWorkspaceCode(rawCode);

      if (db.workspaces) {
        try {
          const allLocalWs = await db.workspaces.toArray();
          workspace = allLocalWs.find(ws => isWorkspaceCodeMatch(cleanInputCode, ws.workspace_code)) || null;
        } catch (_) {}
      }
      
      if (!workspace && navigator.onLine) {
        // Fallback A: Supabase settings workspaces registry (resilient to RLS and contains latest 6-char codes)
        try {
          const { data: regData } = await supabase.from('settings').select('setting_value').eq('setting_key', 'app_workspaces_registry').maybeSingle();
          if (regData?.setting_value) {
            const regList = JSON.parse(regData.setting_value);
            if (Array.isArray(regList)) {
              workspace = regList.find(ws => isWorkspaceCodeMatch(cleanInputCode, ws.workspace_code)) || null;
              if (workspace && db.workspaces) await db.workspaces.put(workspace).catch(() => {});
            }
          }
        } catch (_) {}

        // Fallback B: Supabase workspaces table
        if (!workspace) {
          try {
            const { data: allRemoteWs } = await supabase.from('workspaces').select('*');
            if (allRemoteWs && allRemoteWs.length > 0) {
              const matchedRemote = allRemoteWs.find(ws => isWorkspaceCodeMatch(cleanInputCode, ws.workspace_code)) || null;
              if (matchedRemote) {
                workspace = matchedRemote;
                // Check if settings registry has an upgraded 6-char code for this workspace
                try {
                  const { data: regData } = await supabase.from('settings').select('setting_value').eq('setting_key', 'app_workspaces_registry').maybeSingle();
                  if (regData?.setting_value) {
                    const regList = JSON.parse(regData.setting_value);
                    const regMatch = Array.isArray(regList) ? regList.find(w => w.id === matchedRemote.id) : null;
                    if (regMatch && !isLegacyWorkspaceCode(regMatch.workspace_code)) {
                      workspace = { ...matchedRemote, workspace_code: regMatch.workspace_code };
                    }
                  }
                } catch (_) {}
                if (db.workspaces) await db.workspaces.put(workspace).catch(() => {});
              }
            }
          } catch (_) {}
        }
      }

      if (!workspace) {
        recordFailedLogin();
        return { success: false, error: 'invalidWorkspaceCode' };
      }

      if (workspace.is_active === false) {
        recordFailedLogin();
        return { success: false, error: 'workspaceSuspended' };
      }

      // 2. Check user in app_users (System users: operator, viewer, etc.)
      let appUser = null;
      if (db.app_users) {
        try {
          const userArr = await db.app_users.toArray();
          appUser = userArr.find(u => normalizeUsername(u.username) === cleanUser && (!u.workspace_id || u.workspace_id === workspace.id)) ||
                    userArr.find(u => normalizeUsername(u.username) === cleanUser) || null;
        } catch (_) {}
      }

      if (navigator.onLine) {
        let remoteMatched = null;
        let settingsMatched = null;

        // A: Check remote app_users table
        try {
          const { data: remoteUsers } = await supabase.from('app_users').select('*');
          if (remoteUsers && remoteUsers.length > 0) {
            remoteMatched = remoteUsers.find(u => normalizeUsername(u.username) === cleanUser && u.workspace_id === workspace.id) ||
                            remoteUsers.find(u => normalizeUsername(u.username) === cleanUser) || null;
          }
        } catch (_) {}

        // B: Check resilient scoped settings registry (any app_users_ws_* key)
        try {
          const { data: sRows } = await supabase.from('settings').select('setting_key, setting_value').like('setting_key', 'app_users_ws_%');
          if (sRows && sRows.length > 0) {
            const sortedRows = [...sRows].sort((a, b) => (a.setting_key === `app_users_ws_${workspace.id}` ? -1 : 1));
            for (const row of sortedRows) {
              if (row.setting_value) {
                try {
                  const sUsers = JSON.parse(row.setting_value);
                  if (Array.isArray(sUsers)) {
                    const matched = sUsers.find(u => normalizeUsername(u.username) === cleanUser);
                    if (matched) {
                      settingsMatched = matched;
                      break;
                    }
                  }
                } catch (_) {}
              }
            }
          }
        } catch (_) {}

        if (remoteMatched || settingsMatched) {
          const merged = {
            ...(remoteMatched || {}),
            ...(settingsMatched || {}),
            permissions:
              (Array.isArray(remoteMatched?.permissions) && remoteMatched.permissions.some(p => typeof p === 'string' && p.startsWith('__')))
                ? remoteMatched.permissions
                : (settingsMatched?.permissions || remoteMatched?.permissions || [])
          };
          appUser = hydrateUserFromRecord(merged);
          if (db.app_users) await db.app_users.put(appUser).catch(() => {});
        }
      }

      if (appUser) {
        appUser = hydrateUserFromRecord(appUser);
      }

      // 2.3 Check worker credentials fallback (for personnel / workshop workers login)
      if (!appUser) {
        let workerCredsMap = getWorkerCredentialsMap();

        // Always merge with latest cloud worker credentials when online so newly added workers are immediately found
        if (navigator.onLine) {
          try {
            const [cRes, mRes, mGlobalRes] = await Promise.all([
              supabase.from('settings').select('setting_value').eq('setting_key', 'app_worker_credentials').maybeSingle(),
              supabase.from('settings').select('setting_value').eq('setting_key', `app_worker_metadata_ws_${workspace.id}`).maybeSingle(),
              supabase.from('settings').select('setting_value').eq('setting_key', 'app_worker_metadata').maybeSingle()
            ]);

            let mergedCloudCreds = { ...workerCredsMap };
            if (cRes.data?.setting_value) {
              try { mergedCloudCreds = { ...mergedCloudCreds, ...JSON.parse(cRes.data.setting_value) }; } catch (_) {}
            }
            for (const metaSource of [mGlobalRes.data?.setting_value, mRes.data?.setting_value]) {
              if (metaSource) {
                try {
                  const metaMap = JSON.parse(metaSource);
                  for (const [wId, meta] of Object.entries(metaMap)) {
                    if (meta && meta.username && meta.password) {
                      mergedCloudCreds[wId] = { username: meta.username, password: meta.password };
                    }
                  }
                } catch (_) {}
              }
            }

            if (Object.keys(mergedCloudCreds).length > 0) {
              workerCredsMap = mergedCloudCreds;
              localStorage.setItem(WORKER_CREDS_KEY, JSON.stringify(mergedCloudCreds));
            }
          } catch (_) {}
        }

        // Match against worker credentials map
        for (const [workerId, creds] of Object.entries(workerCredsMap)) {
          if (creds.username && normalizeUsername(creds.username) === cleanUser) {
            const storedPass = normalizeDigits(creds.password).trim();
            if (storedPass === cleanPass) {
              let workerName = cleanUser;
              let isActive = true;

              // Check worker status locally
              if (db.workers) {
                try {
                  const w = await db.workers.get(workerId);
                  if (w) {
                    workerName = w.name || cleanUser;
                    if (w.isActive === 0) isActive = false;
                  }
                } catch (_) {}
              }

              // Check worker status remotely if not found locally
              if (workerName === cleanUser && navigator.onLine) {
                try {
                  const { data: remoteW } = await supabase.from('workers').select('name, is_active').eq('id', workerId).maybeSingle();
                  if (remoteW) {
                    workerName = remoteW.name || cleanUser;
                    if (remoteW.is_active === 0) isActive = false;
                  }
                } catch (_) {}
              }

              if (!isActive) {
                return { success: false, error: 'accountBlocked' };
              }

              appUser = {
                id: workerId,
                workspace_id: workspace.id,
                username: cleanUser,
                full_name: workerName,
                role: 'worker',
                is_active: true,
                session_version: 1,
                can_edit_past_records: false,
                password_hash: cleanPass
              };
              break;
            }
          }
        }
      }

      // 2.5 Check legacy admin credentials fallback (for prototype/local development)
      const adminCreds = getAdminCredentials();
      const isLegacyAdmin = (cleanUser === 'admin' && cleanPass === 'admin') || (cleanUser === adminCreds.username && cleanPass === adminCreds.password);

      if (isLegacyAdmin) {
        if (!appUser) {
          appUser = {
            id: 'admin_local',
            workspace_id: workspace.id,
            username: cleanUser,
            full_name: adminCreds.name || 'مدیر سیستم',
            role: 'admin',
            is_active: true,
            session_version: 1,
            can_edit_past_records: true,
            password_hash: cleanPass
          };
          if (db.app_users) await db.app_users.put(appUser);
          if (navigator.onLine) supabase.from('app_users').upsert(appUser).then();
        } else if (!appUser.password_hash) {
          appUser.password_hash = cleanPass;
          if (db.app_users) await db.app_users.put(appUser);
          if (navigator.onLine) supabase.from('app_users').update({ password_hash: cleanPass }).eq('id', appUser.id).then();
        }
      } else {
        // Authenticate appUser credentials
        if (!appUser) {
          const rec = recordFailedLogin();
          return {
            success: false,
            error: rec.isLocked ? 'rateLimited' : 'invalidCredentials',
            remainingSeconds: rec.remainingSeconds
          };
        }

        const storedPass = normalizeDigits(appUser.password_hash || '').trim();
        const isPassValid = 
          (storedPass && storedPass === cleanPass) ||
          (appUser.password_hash && (await verifyPassword(cleanPass, appUser.password_hash)));

        if (!isPassValid) {
          const rec = recordFailedLogin();
          return {
            success: false,
            error: rec.isLocked ? 'rateLimited' : 'invalidCredentials',
            remainingSeconds: rec.remainingSeconds
          };
        }
      }

      if (!appUser.is_active) {
        return { success: false, error: 'userDeactivated' };
      }

      // Login Success!
      resetLoginAttempts();

      // Update last login
      if (navigator.onLine) {
        supabase.from('app_users').update({ last_login_at: new Date().toISOString() }).eq('id', appUser.id).then();
      }

      const sessionToken = generateToken();
      const sessionData = {
        id: sessionToken,
        user_id: appUser.id,
        workspace_id: workspace.id,
        session_token: sessionToken,
        last_active: new Date().toISOString()
      };

      if (db.current_session) {
        await db.current_session.clear();
        await db.current_session.put(sessionData);
      }

      const hydratedAppUser = hydrateUserFromRecord(appUser);
      const sessionUser = hydrateUserFromRecord({
        id: hydratedAppUser.id,
        userId: hydratedAppUser.id,
        workerId: hydratedAppUser.role === 'worker' ? hydratedAppUser.id : undefined,
        role: hydratedAppUser.role,
        name: hydratedAppUser.full_name,
        username: hydratedAppUser.username,
        workspace_id: workspace.id,
        workspaceCode: workspace.workspace_code,
        plan_tier: workspace.plan_tier === 'premium' ? 'premium' : 'basic',
        permissions: hydratedAppUser.permissions || [],
        can_edit_past_records: Boolean(hydratedAppUser.can_edit_past_records),
        has_all_projects_access: Boolean(hydratedAppUser.has_all_projects_access),
        allowed_project_ids: hydratedAppUser.allowed_project_ids || [],
        session_version: hydratedAppUser.session_version,
        is_active: true,
        via: hydratedAppUser.role === 'worker' ? 'worker' : 'app_user'
      });

      // Save first so onAuthStateChange sees this is an app_user session
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
      if (String(hydratedAppUser.role || '').toLowerCase() !== 'admin') {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (_) {}
      }

      await enforceDataIsolation(sessionUser.id, sessionUser.workspace_id);
      setUser(sessionUser);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));

      if (navigator.onLine && hydratedAppUser.role !== 'worker') {
        pullAllFromSupabase().catch((err) => console.warn('Sync after staff login warning:', err));
      }
      
      // Async log
      import('../services/auditLogger').then(({ logAuditAction }) => {
        logAuditAction({
          actionType: 'USER_LOGIN',
          entityType: 'user',
          entityId: appUser.id,
          details: { description: `ورود کاربر ${appUser.full_name}` }
        });
      });

      return { success: true, role: appUser.role, user: sessionUser };

    } catch (err) {
      console.error('Login flow error:', err);
    }

    // Record failure
    const rec = recordFailedLogin();
    return {
      success: false,
      error: rec.isLocked ? 'rateLimited' : 'invalidCredentials',
      remainingSeconds: rec.remainingSeconds
    };
  };

  const generateToken = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
  // Complete 2FA login verification (Email OTP & Authenticator TOTP)
  const completeTwoFactorLogin = async (codeOrBackup, emailParam) => {
    const cleanInput = normalizeDigits(String(codeOrBackup || '')).trim();
    const pending = pending2FALogin;
    const targetEmail = emailParam || pending?.email;

    // 1. Email OTP Verification (Requirement #2: 6-digit email temporary code)
    if (targetEmail || pending?.type === 'email_otp') {
      const emailToVerify = targetEmail || pending?.email;
      const otpType = pending?.otpType || 'email';

      try {
        let verifyRes = await supabase.auth.verifyOtp({
          email: emailToVerify,
          token: cleanInput,
          type: otpType === 'signup' ? 'signup' : 'email'
        });

        if (verifyRes.error) {
          // Fallback to alternate type
          const altType = otpType === 'signup' ? 'email' : 'signup';
          const altRes = await supabase.auth.verifyOtp({
            email: emailToVerify,
            token: cleanInput,
            type: altType
          });
          if (!altRes.error) {
            verifyRes = altRes;
          }
        }

        if (verifyRes.error) {
          recordFailedLogin();
          return { success: false, error: 'invalid2FACode', detail: verifyRes.error.message };
        }

        const verifiedUser = verifyRes.data?.user || pending?.authUser;
        if (verifiedUser) {
          resetLoginAttempts();
          let sessionUser = await fetchUserProfile(verifiedUser);

          // Workspace setup if provided or needed
          try {
            let wsData = null;
            if (pending?.workspaceCode) {
              const { data: existingWs } = await supabase.from('workspaces').select('*').eq('workspace_code', pending.workspaceCode).maybeSingle();
              wsData = existingWs;
            }
            if (!wsData) {
              const { data: ownerWs } = await supabase.from('workspaces').select('*').eq('owner_id', verifiedUser.id).limit(1).maybeSingle();
              wsData = ownerWs;
            }
            if (!wsData) {
              const generatedCode = generateWorkspaceCode();
              const companyName = verifiedUser.user_metadata?.company_name || 'کارگاه من';
              const newWs = {
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'ws_' + Date.now(),
                name: companyName,
                workspace_code: generatedCode,
                owner_id: verifiedUser.id,
                max_users_limit: 10,
                plan_tier: 'free',
                created_at: new Date().toISOString()
              };

              try {
                const { data: createdWs } = await supabase.from('workspaces').insert(newWs).select().maybeSingle();
                wsData = createdWs || newWs;
              } catch (_) {
                wsData = newWs;
              }

              // Resiliently register in settings table
              try {
                const { data: regData } = await supabase.from('settings').select('setting_value').eq('setting_key', 'app_workspaces_registry').maybeSingle();
                let regList = [];
                if (regData?.setting_value) {
                  try { regList = JSON.parse(regData.setting_value); } catch (_) {}
                }
                const filtered = regList.filter(w => w.id !== wsData.id && w.owner_id !== verifiedUser.id);
                filtered.push(wsData);
                await supabase.from('settings').upsert({
                  setting_key: 'app_workspaces_registry',
                  setting_value: JSON.stringify(filtered),
                  updated_at: new Date().toISOString()
                });
              } catch (_) {}
            }
            if (wsData) {
              sessionUser.workspace_id = wsData.id;
              sessionUser.workspaceCode = wsData.workspace_code;
              if (db.workspaces) await db.workspaces.put(wsData);

              const { data: existingAdmin } = await supabase.from('app_users').select('*').eq('id', verifiedUser.id).maybeSingle();
              if (!existingAdmin) {
                const newAdmin = {
                  id: verifiedUser.id,
                  workspace_id: wsData.id,
                  username: verifiedUser.email ? verifiedUser.email.split('@')[0] : 'admin',
                  full_name: sessionUser.name || 'مدیر سیستم',
                  role: 'admin',
                  is_active: true,
                  session_version: 1,
                  can_edit_past_records: true
                };
                await supabase.from('app_users').insert(newAdmin);
                if (db.app_users) await db.app_users.put(newAdmin);
              }
            }
          } catch (e) {
            console.warn('Workspace sync error:', e);
          }

          await enforceDataIsolation(sessionUser.id, sessionUser.workspace_id);
          setUser(sessionUser);
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
          setPending2FALogin(null);

          // Force sync
          if (navigator.onLine) {
            console.log('🔄 Forcing full sync after 2FA login...');
            await pullAllFromSupabase().catch(err => console.warn('Forced sync failed:', err));
          }

          return { success: true, role: 'admin', user: sessionUser };
        }
      } catch (err) {
        console.error('Email OTP verify error:', err);
        return { success: false, error: 'networkError' };
      }
    }

    // 2. Local Authenticator App TOTP code or Backup code
    const twoFactor = getTwoFactorConfig();
    if (!twoFactor?.enabled) return { success: false, error: '2faNotActive' };

    // Check 1: 6-digit TOTP code
    let isTotpValid = false;
    if (/^\d{6}$/.test(cleanInput)) {
      isTotpValid = await verifyTOTPCode(cleanInput, twoFactor.secret);
    }

    // Check 2: Emergency backup code
    let isBackupValid = false;
    if (!isTotpValid) {
      const backupRes = verifyAndConsumeBackupCode(cleanInput, twoFactor.backupCodes);
      if (backupRes.valid) {
        isBackupValid = true;
        // Save remaining backup codes
        const updatedConfig = { ...twoFactor, backupCodes: backupRes.remainingCodes };
        const serialized = JSON.stringify(updatedConfig);
        localStorage.setItem(ADMIN_2FA_KEY, serialized);
        if (navigator.onLine) {
          supabase.from('settings').upsert({
            setting_key: 'app_admin_2fa',
            setting_value: serialized,
            updated_at: new Date().toISOString()
          }).catch(() => {});
        }
      }
    }

    if (isTotpValid || isBackupValid) {
      resetLoginAttempts();
      const adminCreds = getAdminCredentials();
      const sessionUser = {
        role: 'admin',
        id: 'admin_local',
        userId: 'admin_local',
        name: adminCreds.name || 'افشین زارعی',
        username: adminCreds.username || 'admin',
        companyName: 'کارگاه مرکزی',
        defaultCurrency: 'IQD',
        onboardingCompleted: true
      };
      setUser(sessionUser);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
      setPending2FALogin(null);
      // Force sync to fetch workspaces and app_users from Supabase
      if (navigator.onLine) {
        console.log('🔄 Forcing full sync after admin login...');
        await pullAllFromSupabase().catch(err => console.warn('Forced sync failed:', err));
      }
      if (db.workspaces) {
        try {
          const allWs = await db.workspaces.toArray();
          let mainWs = allWs[0] || null;
          if (mainWs) {
            if (isLegacyWorkspaceCode(mainWs.workspace_code)) {
              mainWs = { ...mainWs, workspace_code: generateWorkspaceCode() };
              await db.workspaces.put(mainWs).catch(() => {});
            }
            sessionUser.workspace_id = mainWs.id;
            sessionUser.workspaceCode = mainWs.workspace_code;
            setUser({ ...sessionUser });
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
          }
        } catch (_) {}
      }
      return { success: true, role: 'admin', user: sessionUser };
    }

    recordFailedLogin();
    return { success: false, error: 'invalid2FACode' };
  };

  const cancelTwoFactorLogin = () => {
    setPending2FALogin(null);
  };

  const resendEmailOtp = async (emailParam) => {
    const email = emailParam || pending2FALogin?.email;
    if (!email) return { success: false, error: 'missingEmail' };

    try {
      if (pending2FALogin?.otpType === 'signup') {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
        if (error) throw error;
      }
      return { success: true };
    } catch (err) {
      console.warn('Resend OTP error:', err);
      return { success: false, error: err?.message || 'resendFailed' };
    }
  };

  // Complete Onboarding Wizard
  const completeOnboarding = async ({ companyName, fullName, phone, defaultCurrency }) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      name: fullName || user.name,
      companyName: companyName || user.companyName,
      defaultCurrency: defaultCurrency || user.defaultCurrency || 'IQD',
      onboardingCompleted: true
    };

    setUser(updatedUser);
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updatedUser));

    if (navigator.onLine && user.supabaseUser) {
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          company_name: companyName,
          full_name: fullName,
          phone: phone || '',
          default_currency: defaultCurrency || 'IQD',
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        });

        if (user.workspace_id) {
          await supabase.from('workspaces').update({ name: companyName }).eq('id', user.workspace_id);
          if (db.workspaces) {
            await db.workspaces.update(user.workspace_id, { name: companyName }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Could not update profile onboarding in Supabase:', err);
      }
    }
  };

  // Tenant data isolation & local-first migration
  async function enforceDataIsolation(newUserId, newWorkspaceId) {
    try {
      if (newUserId) {
        // Adopt any local offline records created under default_user
        try {
          if (db.projects) {
            await db.projects.where('userId').equals('default_user').modify({ userId: newUserId });
          }
          if (db.workers) {
            await db.workers.where('userId').equals('default_user').modify({ userId: newUserId });
          }
        } catch (_) {}
      }

      if (newUserId) localStorage.setItem('last_active_user_id', newUserId);
      if (newWorkspaceId) localStorage.setItem('last_active_workspace_id', newWorkspaceId);
    } catch(err) {
      console.error('Isolation check warning:', err);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    
    setUser(null);
    setIsScreenLocked(false);
    
    // Clear legacy credentials
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
    localStorage.removeItem(WORKER_CREDS_KEY);
    clearStoredWorkerAccessToken();

    // Deep wipe Dexie local database and local storage to guarantee 100% zero-leakage between accounts
    try {
      await wipeAllLocalData();
    } catch(err) {
      console.error('Error clearing local data:', err);
    }

    // Redirect to login page to reset entire state
    window.location.reload();
  };

  // Password reset
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Change Admin Password (with SHA-256 Hashing & Strength Validation)
  const changeAdminPassword = async (currentPassword, newPassword) => {
    const adminCreds = getAdminCredentials();
    const isCurrentValid = await verifyPassword(currentPassword, adminCreds.password || 'admin');
    if (!isCurrentValid) {
      return { success: false, error: 'currentPasswordWrong' };
    }

    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.isAcceptable) {
      return { success: false, error: 'passwordTooWeak' };
    }

    const hashedPassword = await hashPassword(newPassword);
    const updated = {
      ...adminCreds,
      password: hashedPassword
    };
    const serialized = JSON.stringify(updated);
    localStorage.setItem(ADMIN_AUTH_KEY, serialized);

    if (navigator.onLine) {
      try {
        await supabase.from('settings').upsert({
          setting_key: 'app_admin_credentials',
          setting_value: serialized,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Admin creds cloud save warning:', err);
      }
    }

    return { success: true };
  };

  // Update User Profile (Name, Avatar, Username)
  const updateUserProfile = async ({ name, avatar, username, title }) => {
    if (!user) return { success: false, error: 'noUser' };

    const updatedUser = {
      ...user,
      name: name !== undefined ? name.trim() : user.name,
      avatar: avatar !== undefined ? avatar : user.avatar,
      username: username !== undefined ? username.trim() : user.username,
      title: title !== undefined ? title.trim() : (user.title || 'مدیر ارشد کارگاه')
    };

    setUser(updatedUser);
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updatedUser));

    if (user.role === 'admin') {
      const adminCreds = getAdminCredentials();
      const updatedAdmin = {
        ...adminCreds,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        title: updatedUser.title,
        username: updatedUser.username || adminCreds.username
      };
      const serialized = JSON.stringify(updatedAdmin);
      localStorage.setItem(ADMIN_AUTH_KEY, serialized);

      if (navigator.onLine) {
        try {
          await supabase.from('settings').upsert({
            setting_key: 'app_admin_credentials',
            setting_value: serialized,
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Admin profile cloud sync warning:', err);
        }
      }
    }

    if (navigator.onLine && user.supabaseUser) {
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: updatedUser.name,
          avatar_url: updatedUser.avatar,
          title: updatedUser.title,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Supabase profile update warning:', err);
      }
    }

    return { success: true, user: updatedUser };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoadingAuth,
        linkLogin,
        retryLinkLogin,
        dismissLinkLogin,
        isAuthenticated: !!user,
        isAdmin: (user?.role || 'admin') === 'admin',
        isWorker: user?.role === 'worker',
        setUserRole,
        onboardingCompleted: user?.onboardingCompleted ?? true,
        isScreenLocked,
        autoLockMinutes,
        setAutoLockMinutes,
        lockScreen,
        unlockScreen,
        login,
        completeTwoFactorLogin,
        cancelTwoFactorLogin,
        resendEmailOtp,
        pending2FALogin,
        getLoginLockStatus,
        getTwoFactorConfig,
        enableTwoFactor,
        disableTwoFactor,
        signUp,
        signInWithOAuthProvider,
        logout,
        resetPassword,
        completeOnboarding,
        changeAdminPassword,
        updateUserProfile,
        setWorkerCredentials,
        getWorkerCredentialsMap,
        getAdminCredentials
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// --- RBAC & Permission Management (Phase 2) ---

export const RBACContext = createContext(null);

export function RBACProvider({ children }) {
  const { user: legacyUser, setUser } = useAuth();
  const [currentUser, setCurrentUser] = useState(() => hydrateUserFromRecord(legacyUser));
  const [activeProject, setActiveProject] = useState(null);
  const [allowedProjects, setAllowedProjects] = useState([]);
  const [isRBACLoading, setIsRBACLoading] = useState(true);

  // Combine currentUser from RBAC with legacy user
  const effectiveUser = hydrateUserFromRecord(currentUser || legacyUser);

  // 1. Keep RBAC user synchronized with AuthContext user & Dexie
  useEffect(() => {
    let isMounted = true;
    async function syncRBACSession() {
      try {
        if (!legacyUser) {
          if (isMounted) setCurrentUser(null);
          return;
        }
        let merged = hydrateUserFromRecord(legacyUser);
        if (legacyUser.id && legacyUser.role !== 'worker' && db.app_users) {
          const userDoc = await db.app_users.get(legacyUser.id).catch(() => null);
          if (userDoc) {
            const hydratedDoc = hydrateUserFromRecord(userDoc);
            merged = hydrateUserFromRecord({
              ...legacyUser,
              ...hydratedDoc,
              name: hydratedDoc.full_name || legacyUser.name
            });
          }
        }
        if (isMounted) {
          setCurrentUser(merged);
        }
      } catch (err) {
        console.warn("Failed to sync RBAC session:", err);
      } finally {
        if (isMounted) setIsRBACLoading(false);
      }
    }
    syncRBACSession();
    return () => {
      isMounted = false;
    };
  }, [
    legacyUser?.id,
    legacyUser?.role,
    JSON.stringify(legacyUser?.permissions),
    legacyUser?.has_all_projects_access,
    JSON.stringify(legacyUser?.allowed_project_ids)
  ]);

  // 2. Setup Realtime Listener & Supabase Sync
  useEffect(() => {
    const targetId = effectiveUser?.id;
    if (!targetId || effectiveUser?.role === 'worker') return;

    const channel = supabase.channel(`public:app_users:id=eq.${targetId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_users',
        filter: `id=eq.${targetId}`
      }, async (payload) => {
        const newData = hydrateUserFromRecord(payload.new);
        
        // Kill session condition
        if (newData.is_active === false || newData.session_version > (effectiveUser.session_version || 1)) {
          // Invalidate session
          if (db.current_session) await db.current_session.clear();
          localStorage.removeItem('workshop_auth_session'); 
          localStorage.removeItem('workshop_admin_auth');
          
          alert("حساب کاربری شما توسط مدیر غیرفعال شد یا نشست شما منقضی گردید.");
          window.location.href = '/login';
        } else {
          // Update local state, AuthContext, and Dexie
          setCurrentUser(newData);
          if (db.app_users) await db.app_users.put(newData);
          try {
            const saved = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null');
            if (saved && saved.id === newData.id) {
              const updatedSaved = hydrateUserFromRecord({
                ...saved,
                role: newData.role,
                name: newData.full_name || saved.name,
                permissions: newData.permissions,
                can_edit_past_records: newData.can_edit_past_records,
                has_all_projects_access: newData.has_all_projects_access,
                allowed_project_ids: newData.allowed_project_ids,
                session_version: newData.session_version
              });
              localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updatedSaved));
            }
          } catch (_) {}
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUser?.id, effectiveUser?.session_version]);

  const hasPermission = (permissionKey) => {
    if (!effectiveUser) return false;
    const roleLower = String(effectiveUser?.role || '').toLowerCase();
    if (roleLower === 'admin' || roleLower === 'owner') return true;
    const perms = Array.isArray(effectiveUser.permissions) ? effectiveUser.permissions : [];
    if (perms.includes(permissionKey)) return true;
    if (permissionKey === 'attendance.read' && perms.includes('attendance.write')) return true;
    return false;
  };

  const canAccessProject = (projectId) => {
    if (!effectiveUser) return false;
    const roleLower = String(effectiveUser?.role || '').toLowerCase();
    if (roleLower === 'admin' || roleLower === 'owner') return true;
    if (effectiveUser.has_all_projects_access) return true;
    const allowedIds = Array.isArray(effectiveUser.allowed_project_ids) ? effectiveUser.allowed_project_ids : [];
    if (allowedIds.length > 0) {
      return allowedIds.includes(projectId);
    }
    if (allowedProjects.length > 0) {
      return allowedProjects.some(p => p.project_id === projectId);
    }
    return true;
  };

  const canModifyDate = (targetDate) => {
    if (!effectiveUser) return false;
    const roleLower = String(effectiveUser?.role || '').toLowerCase();
    if (roleLower === 'admin' || roleLower === 'owner') return true;
    if (!hasPermission('attendance.write')) return false;
    
    const today = new Date().toISOString().split('T')[0];
    const target = new Date(targetDate).toISOString().split('T')[0];
    
    if (target < today) {
      return !!effectiveUser.can_edit_past_records;
    }
    return true; 
  };

  return (
    <RBACContext.Provider value={{
      currentUser: effectiveUser,
      setCurrentUser,
      activeProject,
      setActiveProject,
      allowedProjects,
      setAllowedProjects,
      hasPermission,
      canAccessProject,
      canModifyDate,
      isRBACLoading
    }}>
      {children}
    </RBACContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(RBACContext);
  if (!context) {
    return {
      hasPermission: () => true,
      canAccessProject: () => true,
      canModifyDate: () => true,
      currentUser: null
    };
  }
  return context;
}
