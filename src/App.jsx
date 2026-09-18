import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { seedInitialDataIfEmpty } from './db/db';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { WorkersView } from './components/WorkersView';
import { CalendarReportsView } from './components/CalendarReportsView';
import { DailyLoggingModal, FloatingActionButton } from './components/DailyLoggingModal';
import { BackupModal } from './components/BackupModal';
import { SyncModal } from './components/SyncModal';
import { performSyncUnified, getSyncConfig } from './services/syncService';
import { initRealtimeSync } from './services/realtimeSync';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggingModalOpen, setIsLoggingModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    // Seed initial demo data if database is newly initialized
    seedInitialDataIfEmpty();
    // Start automatic Real-Time Supabase Sync
    initRealtimeSync();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        theme={theme}
        toggleTheme={toggleTheme}
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

      {/* Cloud Database Sync Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
