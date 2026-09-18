import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/db';
import { supabase } from '../services/realtimeSync';

const AUTH_SESSION_KEY = 'workshop_auth_session';
const ADMIN_AUTH_KEY = 'workshop_admin_auth';
const WORKER_CREDS_KEY = 'workshop_worker_credentials';

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

  // Sync auth credentials from Supabase on startup
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
      } finally {
        setIsLoadingAuth(false);
      }
    }

    syncAuthFromCloud();
  }, []);

  // Get current admin credentials
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

    // Also update Dexie worker record
    try {
      await db.workers.update(workerId, {
        username: username ? username.trim() : '',
        password: password ? password.trim() : ''
      });
    } catch (_) {}

    // Push to Supabase settings for multi-device sync
    if (navigator.onLine) {
      try {
        await supabase
          .from('settings')
          .upsert({
            setting_key: 'app_worker_credentials',
            setting_value: serialized,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        console.warn('Worker creds cloud save warning:', err);
      }
    }
  };

  // Login handler
  const login = async (usernameInput, passwordInput) => {
    const trimmedUser = (usernameInput || '').trim().toLowerCase();
    const rawPass = (passwordInput || '').trim();

    if (!trimmedUser || !rawPass) {
      return { success: false, error: 'invalidCredentials' };
    }

    // 1. Check Admin credentials
    const adminCreds = getAdminCredentials();
    const adminUser = (adminCreds.username || 'admin').toLowerCase();
    const adminPass = adminCreds.password || 'admin';

    // Also allow 'afshin' as alternative admin username
    if (
      (trimmedUser === adminUser || trimmedUser === 'afshin' || trimmedUser === 'admin') &&
      rawPass === adminPass
    ) {
      const sessionUser = {
        role: 'admin',
        name: adminCreds.name || 'افشین زارعی',
        username: adminCreds.username || 'admin'
      };
      setUser(sessionUser);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
      return { success: true, role: 'admin', user: sessionUser };
    }

    // 2. Check Workers credentials
    const workers = await db.workers.toArray();
    const workerCredsMap = getWorkerCredentialsMap();

    for (const w of workers) {
      if (w.isActive === 0) continue; // Inactive workers cannot log in

      const customCreds = workerCredsMap[w.id] || {};
      const expectedUser = (customCreds.username || w.username || w.phone || '').trim().toLowerCase();
      const expectedPass = (customCreds.password || w.password || '').trim();

      if (expectedUser && expectedPass && trimmedUser === expectedUser && rawPass === expectedPass) {
        const sessionUser = {
          role: 'worker',
          workerId: w.id,
          name: w.name,
          username: expectedUser,
          roleTitle: w.role
        };
        setUser(sessionUser);
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
        return { success: true, role: 'worker', user: sessionUser };
      }
    }

    return { success: false, error: 'invalidCredentials' };
  };

  // Logout handler
  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_SESSION_KEY);
  };

  // Change Admin Password
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

    // Push to Supabase settings for cross-device admin sync
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
        login,
        logout,
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
