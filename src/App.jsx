import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { seedInitialDataIfEmpty } from './db/db';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { WorkersView } from './components/WorkersView';
import { CalendarReportsView } from './components/CalendarReportsView';
import { FinancialsView } from './components/FinancialsView';
import { DailyLoggingModal, FloatingActionButton } from './components/DailyLoggingModal';
import { BackupModal } from './components/BackupModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginView } from './components/LoginView';
import { WorkerViewPortal } from './components/WorkerViewPortal';
import { performSyncUnified, getSyncConfig } from './services/syncService';
import { initRealtimeSync } from './services/realtimeSync';

function AppContent() {
  const { user, isAdmin, isWorker } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggingModalOpen, setIsLoggingModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [loggingModalDate, setLoggingModalDate] = useState(null);

  const handleOpenLoggingModal = (dateStr) => {
    setLoggingModalDate(dateStr || null);
    setIsLoggingModalOpen(true);
  };

  // Theme Management: 'light' or 'dark'
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('workshop_theme');
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('workshop_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Auto-sync listener when device reconnects to internet
  useEffect(() => {
    const handleOnline = () => {
      const cfg = getSyncConfig();
      if (cfg.serverUrl && cfg.autoSync) {
        performSyncUnified().catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    // Seed initial demo data if database is newly initialized
    seedInitialDataIfEmpty();
    // Start automatic Real-Time Supabase Sync
    initRealtimeSync();
  }, []);

  // 1. If not authenticated, render Login Screen
  if (!user) {
    return <LoginView theme={theme} toggleTheme={toggleTheme} />;
  }

  // 2. If logged in as Worker, render Dedicated Read-Only Worker Portal
  if (isWorker) {
    return <WorkerViewPortal theme={theme} toggleTheme={toggleTheme} />;
  }

  // 3. If Admin, render Full Workshop Management Application
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenLoggingModal={handleOpenLoggingModal}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'workers' && (
          <WorkersView />
        )}

        {(activeTab === 'calendar' || activeTab === 'reports') && (
          <CalendarReportsView
            onOpenLoggingModal={handleOpenLoggingModal}
          />
        )}

        {activeTab === 'financials' && (
          <FinancialsView />
        )}
      </main>

      {/* Persistent Floating Action Button (FAB) */}
      <FloatingActionButton
        onClick={() => setIsLoggingModalOpen(true)}
      />

      {/* Daily Attendance Logging Modal */}
      <DailyLoggingModal
        isOpen={isLoggingModalOpen}
        initialDate={loggingModalDate}
        onClose={() => {
          setIsLoggingModalOpen(false);
          setLoggingModalDate(null);
        }}
      />

      {/* Database Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />

      {/* System Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
