import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../db/db';
import { supabase, pushWorkerMetadataLive } from '../services/realtimeSync';
import { hashPassword, verifyPassword, evaluatePasswordStrength } from '../utils/passwordSecurity';
import { verifyTOTPCode, verifyAndConsumeBackupCode, generateBackupCodes } from '../utils/totpSecurity';

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

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.role) parsed.role = 'admin';
        return parsed;
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
    if (user) {
      setIsScreenLocked(true);
    }
  };

  const unlockScreen = async (passwordInput) => {
    if (!user) return { success: false, error: 'noUser' };
    const cleanPass = normalizeDigits(passwordInput).trim();

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
    if (!user || autoLockMinutes <= 0 || isScreenLocked) return;

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

      const adminCreds = getAdminCredentials();
      const sessionUser = {
        role: 'admin',
        id: supabaseUser.id,
        userId: supabaseUser.id,
        email: supabaseUser.email,
        name: profile?.full_name || supabaseUser.user_metadata?.full_name || adminCreds.name || supabaseUser.email.split('@')[0],
        avatar: profile?.avatar || adminCreds.avatar || supabaseUser.user_metadata?.avatar_url || '',
        title: profile?.title || adminCreds.title || 'مدیر ارشد کارگاه',
        companyName: profile?.company_name || 'کارگاه من',
        defaultCurrency: profile?.default_currency || 'IQD',
        onboardingCompleted: profile?.onboarding_completed ?? false,
        supabaseUser
      };

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
        if (navigator.onLine) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            await fetchUserProfile(session.user);
          }
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

        setUser(sessionUser);
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
        return { success: true, user: sessionUser };
      }

      return { success: true, message: 'checkEmailConfirmation' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Unified Login Handler with Multi-tenant & Brute-Force Rate Limiting
  const login = async (workspaceCodeInput, usernameOrEmailInput, passwordInput) => {
    const lockStatus = getLoginLockStatus();
    if (lockStatus.isLocked) {
      return {
        success: false,
        error: 'rateLimited',
        remainingSeconds: lockStatus.remainingSeconds
      };
    }

    const rawCode = (workspaceCodeInput || '').trim().toUpperCase();
    const rawInput = (usernameOrEmailInput || '').trim();
    const cleanUser = normalizeUsername(rawInput);
    const cleanPass = normalizeDigits(passwordInput).trim();

    if (!rawCode || !cleanUser || !cleanPass) {
      return { success: false, error: 'invalidCredentials' };
    }

    // MULTI-TENANT LOGIN FLOW
    // 0. Supabase Auth if it's an email (Admin/Owner login)
    if (rawInput.includes('@')) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: rawInput.toLowerCase(),
          password: passwordInput
        });

        if (error) {
          recordFailedLogin();
          return { success: false, error: error.message };
        }

        if (data?.user) {
          resetLoginAttempts();
          let sessionUser = await fetchUserProfile(data.user);
          
          // Seed admin into app_users & workspace if missing
          try {
            let wsData = null;
            if (rawCode) {
               const { data: existingWs } = await supabase.from('workspaces').select('*').eq('workspace_code', rawCode).maybeSingle();
               wsData = existingWs;
            }
            if (!wsData) {
               const { data: ownerWs } = await supabase.from('workspaces').select('*').eq('owner_id', data.user.id).limit(1).maybeSingle();
               wsData = ownerWs;
            }
            if (wsData) {
               sessionUser.workspace_id = wsData.id;
               const { data: existingAdmin } = await supabase.from('app_users').select('*').eq('id', data.user.id).maybeSingle();
               if (!existingAdmin) {
                 const newAdmin = {
                   id: data.user.id,
                   workspace_id: wsData.id,
                   username: 'admin',
                   full_name: sessionUser.name || 'مدیر سیستم',
                   role: 'admin',
                   is_active: true,
                   session_version: 1,
                   can_edit_past_records: true
                 };
                 await supabase.from('app_users').insert(newAdmin);
               }
            }
          } catch(e) { console.warn(e); }

          return { success: true, role: 'admin', user: sessionUser };
        }
      } catch (err) {
        console.error('Supabase Auth Error:', err);
        return { success: false, error: 'networkError' };
      }
    }
    try {
      // 1. Check workspace
      let workspace = null;
      if (db.workspaces) {
        const wsArr = await db.workspaces.where('workspace_code').equals(rawCode).toArray();
        if (wsArr.length > 0) workspace = wsArr[0];
      }
      
      if (!workspace && navigator.onLine) {
        // Fallback to Supabase
        const { data, error } = await supabase.from('workspaces').select('*').eq('workspace_code', rawCode).maybeSingle();
        if (data) {
          workspace = data;
          if (db.workspaces) await db.workspaces.put(data);
        }
      }

      if (!workspace) {
        recordFailedLogin();
        return { success: false, error: 'invalidWorkspaceCode' };
      }

      // 2. Check user in app_users
      let appUser = null;
      if (db.app_users) {
        const userArr = await db.app_users.where({ workspace_id: workspace.id, username: cleanUser }).toArray();
        if (userArr.length > 0) appUser = userArr[0];
      }

      if (!appUser && navigator.onLine) {
        const { data } = await supabase.from('app_users').select('*').match({ workspace_id: workspace.id, username: cleanUser }).maybeSingle();
        if (data) {
          appUser = data;
          if (db.app_users) await db.app_users.put(data);
        }
      }

      // 2.5 Check legacy admin credentials fallback (for prototype/local development)
      const adminCreds = getAdminCredentials();
      if ((cleanUser === 'admin' && cleanPass === 'admin') || (cleanUser === adminCreds.username && cleanPass === adminCreds.password)) {
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
           // Fix missing hash for existing admin
           appUser.password_hash = cleanPass;
           if (db.app_users) await db.app_users.put(appUser);
           if (navigator.onLine) supabase.from('app_users').update({ password_hash: cleanPass }).eq('id', appUser.id).then();
        }
      } else if (!appUser || appUser.password_hash !== cleanPass) { // Very simple password check for prototype
        const rec = recordFailedLogin();
        return {
          success: false,
          error: rec.isLocked ? 'rateLimited' : 'invalidCredentials',
          remainingSeconds: rec.remainingSeconds
        };
      }

      if (!appUser.is_active) {
        return { success: false, error: 'accountBlocked' };
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

      const sessionUser = {
        id: appUser.id,
        userId: appUser.id,
        role: appUser.role,
        name: appUser.full_name,
        username: appUser.username,
        workspace_id: workspace.id,
        permissions: appUser.permissions || [],
        can_edit_past_records: appUser.can_edit_past_records,
        session_version: appUser.session_version,
        is_active: true
      };

      setUser(sessionUser);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
      
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
  // Complete 2FA login verification
  const completeTwoFactorLogin = async (codeOrBackup) => {
    const twoFactor = getTwoFactorConfig();
    if (!twoFactor?.enabled) return { success: false, error: '2faNotActive' };

    const cleanInput = String(codeOrBackup || '').trim();

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
      return { success: true, role: 'admin', user: sessionUser };
    }

    recordFailedLogin();
    return { success: false, error: 'invalid2FACode' };
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
      } catch (err) {
        console.warn('Could not update profile onboarding in Supabase:', err);
      }
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    
    setUser(null);
    setIsScreenLocked(false);
    
    // Clear legacy
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
    localStorage.removeItem(WORKER_CREDS_KEY);

    // Clear Dexie local database to ensure data isolation between different accounts
    try {
      const tablesToClear = [
        'current_session', 'projects', 'workers', 'attendanceLogs', 
        'payments', 'expenseCategories', 'expenses', 'treasuryIncomes', 
        'financialAccounts', 'accountTransfers', 'groups', 'audit_logs'
      ];
      for (const t of tablesToClear) {
        if (db[t]) await db[t].clear();
      }
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
        getLoginLockStatus,
        getTwoFactorConfig,
        enableTwoFactor,
        disableTwoFactor,
        signUp,
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
  const { user: legacyUser } = useAuth();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [allowedProjects, setAllowedProjects] = useState([]);
  const [isRBACLoading, setIsRBACLoading] = useState(true);

  // Combine currentUser from RBAC with legacy user
  const effectiveUser = currentUser || legacyUser;

  // 1. Load from Dexie first (Offline First)
  useEffect(() => {
    async function loadOfflineSession() {
      try {
        const sessions = await db.current_session?.toArray() || [];
        if (sessions.length > 0) {
          const session = sessions[0];
          const userDoc = await db.app_users?.get(session.user_id);
          if (userDoc) {
            setCurrentUser(userDoc);
          }
        }
      } catch (err) {
        console.warn("Failed to load offline RBAC session:", err);
      } finally {
        setIsRBACLoading(false);
      }
    }
    loadOfflineSession();
  }, []);

  // 2. Setup Realtime Listener & Supabase Sync
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase.channel(`public:app_users:id=eq.${currentUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_users',
        filter: `id=eq.${currentUser.id}`
      }, async (payload) => {
        const newData = payload.new;
        
        // Kill session condition
        if (newData.is_active === false || newData.session_version > (currentUser.session_version || 1)) {
          // Invalidate session
          if (db.current_session) await db.current_session.clear();
          localStorage.removeItem('workshop_auth_session'); 
          localStorage.removeItem('workshop_admin_auth');
          
          alert("حساب کاربری شما توسط مدیر غیرفعال شد یا نشست شما منقضی گردید.");
          window.location.href = '/login';
        } else {
          // Update local state and Dexie
          setCurrentUser(newData);
          if (db.app_users) await db.app_users.put(newData);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.session_version]);

  const hasPermission = (permissionKey) => {
    if (!effectiveUser) return false;
    const roleLower = String(effectiveUser?.role || '').toLowerCase();
    if (roleLower === 'admin' || roleLower === 'owner') return true;
    return effectiveUser.permissions?.includes(permissionKey);
  };

  const canAccessProject = (projectId) => {
    if (!effectiveUser) return false;
    const roleLower = String(effectiveUser?.role || '').toLowerCase();
    if (roleLower === 'admin' || roleLower === 'owner') return true;
    if (effectiveUser.has_all_projects_access) return true;
    return allowedProjects.some(p => p.project_id === projectId);
  };

  const canModifyDate = (targetDate) => {
    if (!effectiveUser) return false;
    const roleLower = String(effectiveUser?.role || '').toLowerCase();
    if (roleLower === 'admin' || roleLower === 'owner') return true;
    
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
