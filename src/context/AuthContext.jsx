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
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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

  // Unified Login Handler with Brute-Force Rate Limiting & 2FA
  const login = async (usernameOrEmailInput, passwordInput) => {
    const lockStatus = getLoginLockStatus();
    if (lockStatus.isLocked) {
      return {
        success: false,
        error: 'rateLimited',
        remainingSeconds: lockStatus.remainingSeconds
      };
    }

    const rawInput = (usernameOrEmailInput || '').trim();
    const cleanUser = normalizeUsername(rawInput);
    const cleanPass = normalizeDigits(passwordInput).trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, error: 'invalidCredentials' };
    }

    // 1. Supabase Auth if email
    if (rawInput.includes('@')) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: rawInput.toLowerCase(),
          password: (passwordInput || '').trim()
        });

        if (error) {
          recordFailedLogin();
          return { success: false, error: error.message };
        }

        if (data?.user) {
          resetLoginAttempts();
          const sessionUser = await fetchUserProfile(data.user);
          return { success: true, role: 'admin', user: sessionUser };
        }
      } catch (err) {
        console.warn('Supabase Auth error:', err);
      }
    }

    // 2. Check local Admin credentials
    const adminCreds = getAdminCredentials();
    const adminUser = normalizeUsername(adminCreds.username || 'admin');

    const isUserMatch = cleanUser === adminUser || cleanUser === 'afshin' || cleanUser === 'admin';
    if (isUserMatch) {
      const isPassValid = await verifyPassword(cleanPass, adminCreds.password || 'admin');
      if (isPassValid) {
        const twoFactor = getTwoFactorConfig();

        if (twoFactor?.enabled) {
          // Requires second factor verification!
          return {
            success: true,
            requires2FA: true,
            role: 'admin',
            tempUser: {
              username: adminCreds.username || 'admin',
              name: adminCreds.name || 'افشین زارعی'
            }
          };
        }

        // Direct login success
        resetLoginAttempts();
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
    }

    // 3. Check Workers credentials
    let workers = await db.workers.toArray();
    let workerCredsMap = getWorkerCredentialsMap();

    const findMatchingWorker = (workersList, creds) => {
      for (const w of workersList) {
        if (w.deletedAt) continue;

        const customCreds = creds[w.id] || {};
        const expectedUser = normalizeUsername(customCreds.username || w.username || w.phone || '');
        const expectedPass = normalizeDigits(customCreds.password || w.password || '').trim();

        if (expectedUser && expectedPass && cleanUser === expectedUser && cleanPass === expectedPass) {
          return w;
        }
      }
      return null;
    };

    let matchedWorker = findMatchingWorker(workers, workerCredsMap);

    // 4. Cloud Fallback for Workers
    if (!matchedWorker && navigator.onLine) {
      try {
        const [credsRes, metaRes, wRes] = await Promise.all([
          supabase.from('settings').select('setting_value').eq('setting_key', 'app_worker_credentials').maybeSingle(),
          supabase.from('settings').select('setting_value').eq('setting_key', 'app_worker_metadata').maybeSingle(),
          supabase.from('workers').select('*').is('deleted_at', null)
        ]);

        let cloudCreds = {};
        if (credsRes?.data?.setting_value) {
          try { cloudCreds = JSON.parse(credsRes.data.setting_value) || {}; } catch (_) {}
        }
        let cloudMeta = {};
        if (metaRes?.data?.setting_value) {
          try { cloudMeta = JSON.parse(metaRes.data.setting_value) || {}; } catch (_) {}
        }

        const mergedCreds = { ...cloudCreds };
        Object.entries(cloudMeta).forEach(([wId, m]) => {
          if (m.username || m.password) {
            mergedCreds[wId] = {
              username: m.username || mergedCreds[wId]?.username || '',
              password: m.password || mergedCreds[wId]?.password || ''
            };
          }
        });

        const cloudWorkersList = (wRes?.data || []).map((cw) => {
          const meta = cloudMeta[cw.id] || {};
          const cred = mergedCreds[cw.id] || {};
          return {
            id: cw.id,
            name: cw.name,
            phone: cw.phone,
            role: cw.role,
            dailyRate: Number(cw.daily_rate) || 0,
            overtimeHourlyRate: Number(cw.overtime_hourly_rate) || 0,
            isActive: Number(cw.is_active) === 0 ? 0 : 1,
            groupId: meta.groupId || null,
            teamRole: meta.teamRole || 'Worker',
            defaultSectionId: meta.defaultSectionId || null,
            isArchived: !!meta.isArchived,
            status: meta.status || 'active',
            username: cred.username || meta.username || '',
            password: cred.password || meta.password || '',
            projectId: 'prj_default_main'
          };
        });

        matchedWorker = findMatchingWorker(cloudWorkersList, mergedCreds);

        if (matchedWorker) {
          await db.workers.put(matchedWorker);
          localStorage.setItem(WORKER_CREDS_KEY, JSON.stringify(mergedCreds));
        }
      } catch (cloudErr) {
        console.warn('Cloud worker login check error:', cloudErr);
      }
    }

    if (matchedWorker) {
      resetLoginAttempts();
      const sessionUser = {
        role: 'worker',
        id: matchedWorker.id,
        workerId: matchedWorker.id,
        name: matchedWorker.name,
        username: cleanUser,
        roleTitle: matchedWorker.role
      };
      setUser(sessionUser);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
      return { success: true, role: 'worker', user: sessionUser };
    }

    // Record failure
    const rec = recordFailedLogin();
    return {
      success: false,
      error: rec.isLocked ? 'rateLimited' : 'invalidCredentials',
      remainingSeconds: rec.remainingSeconds
    };
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
    localStorage.removeItem(AUTH_SESSION_KEY);
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
        isAdmin: user?.role === 'admin',
        isWorker: user?.role === 'worker',
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
