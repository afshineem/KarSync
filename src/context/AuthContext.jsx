import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/db';
import { supabase, pushWorkerMetadataLive } from '../services/realtimeSync';

const AUTH_SESSION_KEY = 'workshop_auth_session';
const ADMIN_AUTH_KEY = 'workshop_admin_auth';
const WORKER_CREDS_KEY = 'workshop_worker_credentials';

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

      const sessionUser = {
        role: 'admin',
        id: supabaseUser.id,
        userId: supabaseUser.id,
        email: supabaseUser.email,
        name: profile?.full_name || supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
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
      console.log('🔔 Supabase Auth Event:', event);

      if (session?.user) {
        await fetchUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        // If logged in as supabase user and signed out, reset
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

  // Sync legacy worker/admin settings for offline/local credentials
  useEffect(() => {
    async function syncAuthFromCloud() {
      try {
        if (!navigator.onLine) return;
        const { data } = await supabase
          .from('settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['app_admin_credentials', 'app_worker_credentials']);

        if (data && data.length > 0) {
          for (const item of data) {
            if (item.setting_key === 'app_admin_credentials' && item.setting_value) {
              localStorage.setItem(ADMIN_AUTH_KEY, item.setting_value);
            }
            if (item.setting_key === 'app_worker_credentials' && item.setting_value) {
              localStorage.setItem(WORKER_CREDS_KEY, item.setting_value);
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

  // Official Supabase Sign Up (Commercial Multi-Tenant SaaS)
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
        // Attempt creating profile record immediately
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

  // Unified Login Handler (Supabase Auth for Admins + Access PIN for Workers + Offline Admin fallback)
  const login = async (usernameOrEmailInput, passwordInput) => {
    const rawInput = (usernameOrEmailInput || '').trim();
    const cleanUser = normalizeUsername(rawInput);
    const cleanPass = normalizeDigits(passwordInput).trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, error: 'invalidCredentials' };
    }

    // 1. If it's an email address, prioritize official Supabase Auth
    if (rawInput.includes('@')) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: rawInput.toLowerCase(),
          password: (passwordInput || '').trim()
        });

        if (error) {
          console.warn('Supabase Auth signIn failed:', error.message);
          return { success: false, error: error.message };
        }

        if (data?.user) {
          const sessionUser = await fetchUserProfile(data.user);
          return { success: true, role: 'admin', user: sessionUser };
        }
      } catch (err) {
        console.warn('Supabase Auth error:', err);
      }
    }

    // 2. Check local/offline Admin credentials
    const adminCreds = getAdminCredentials();
    const adminUser = normalizeUsername(adminCreds.username || 'admin');
    const adminPass = normalizeDigits(adminCreds.password || 'admin').trim();

    if (
      (cleanUser === adminUser || cleanUser === 'afshin' || cleanUser === 'admin') &&
      cleanPass === adminPass
    ) {
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

    // 3. Check Workers credentials locally
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

    // 4. Cloud Fallback for Workers (Critical for mobile/fresh browser when local Dexie is empty!)
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

        const cloudWorkersList = (wRes?.data || []).map(cw => {
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

    return { success: false, error: 'invalidCredentials' };
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

  // Change Admin Password (local)
  const changeAdminPassword = async (currentPassword, newPassword) => {
    const adminCreds = getAdminCredentials();
    if (currentPassword !== adminCreds.password) {
      return { success: false, error: 'currentPasswordWrong' };
    }
    const updated = {
      ...adminCreds,
      password: newPassword
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoadingAuth,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isWorker: user?.role === 'worker',
        onboardingCompleted: user?.onboardingCompleted ?? true,
        login,
        signUp,
        logout,
        resetPassword,
        completeOnboarding,
        changeAdminPassword,
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
