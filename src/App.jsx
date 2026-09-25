import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { db, seedInitialDataIfEmpty, reconcileSettlementEpochs } from './db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { WorkersView } from './components/WorkersView';
import { CalendarReportsView } from './components/CalendarReportsView';
import { FinancialsView } from './components/FinancialsView';
import { ExpensesView, AddExpenseModal } from './components/ExpensesView';
import { SettlementModal } from './components/SettlementModal';
import { DailyLoggingModal, FloatingActionButton } from './components/DailyLoggingModal';
import { BackupModal } from './components/BackupModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AboutModal } from './components/AboutModal';
import { LoginView } from './components/LoginView';
import { WorkerViewPortal } from './components/WorkerViewPortal';
import { OnboardingModal } from './components/OnboardingModal';
import { NewProjectModal } from './components/NewProjectModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { WorkerProfileModal } from './components/WorkerProfileModal';
import { performSyncUnified, getSyncConfig } from './services/syncService';
import { initRealtimeSync, pushLogsLive, pushPaymentsLive } from './services/realtimeSync';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { user, isAdmin, isWorker, onboardingCompleted } = useAuth();
  const { profileWorkerId, closeWorkerProfile } = useProject();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggingModalOpen, setIsLoggingModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementWorker, setSettlementWorker] = useState(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [loggingModalDate, setLoggingModalDate] = useState(null);

  // Live queries for quick modals
  const allWorkers = useLiveQuery(() => db.workers.toArray()) || [];
  const allGroups = useLiveQuery(() => db.groups.toArray()) || [];
  const allLogs = useLiveQuery(() => db.attendanceLogs.toArray()) || [];
  const allPayments = useLiveQuery(() => db.payments.toArray()) || [];

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
    seedInitialDataIfEmpty().then(async () => {
      const res = await reconcileSettlementEpochs();
      if (res?.totalLogsUpdated?.length) {
        pushLogsLive(res.totalLogsUpdated).catch(() => {});
      }
      if (res?.totalAdvancesUpdated?.length) {
        pushPaymentsLive().catch(() => {});
      }
    });
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200 pb-16 md:pb-0">
      
      {/* SaaS First-time Onboarding Wizard */}
      {isAdmin && !onboardingCompleted && (
        <OnboardingModal />
      )}

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenChangePasswordModal={() => setIsChangePasswordModalOpen(true)}
        onOpenAboutModal={() => setIsAboutModalOpen(true)}
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

        {activeTab === 'calendar' || activeTab === 'reports' ? (
          <CalendarReportsView
            onOpenLoggingModal={handleOpenLoggingModal}
          />
        ) : null}

        {activeTab === 'financials' && (
          <FinancialsView />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView />
        )}
      </main>

      {/* Persistent Multi-Action Floating Action Button (FAB) */}
      <FloatingActionButton
        onOpenDailyLogging={() => setIsLoggingModalOpen(true)}
        onOpenSettlement={() => setIsSettlementModalOpen(true)}
        onOpenExpense={() => setIsExpenseModalOpen(true)}
        onClick={() => setIsLoggingModalOpen(true)}
      />

      {/* Quick Settlement Modal */}
      {isSettlementModalOpen && (
        <SettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => {
            setIsSettlementModalOpen(false);
            setSettlementWorker(null);
          }}
          worker={settlementWorker}
          allWorkers={allWorkers}
          allGroups={allGroups}
          allLogs={allLogs}
          allPayments={allPayments}
          onSelectWorker={(w) => setSettlementWorker(w)}
        />
      )}

      {/* Quick Add Expense Modal */}
      {isExpenseModalOpen && (
        <AddExpenseModal
          onClose={() => setIsExpenseModalOpen(false)}
        />
      )}

      {/* Daily Attendance Logging Modal */}
      <DailyLoggingModal
        isOpen={isLoggingModalOpen}
        initialDate={loggingModalDate}
        onClose={() => {
          setIsLoggingModalOpen(false);
          setLoggingModalDate(null);
        }}
      />

      {/* New Project Modal */}
      <NewProjectModal />

      {/* Project Settings Modal */}
      <ProjectSettingsModal />

      {/* Database Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />

      {/* Admin Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />

      {/* Dedicated About Modal */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      {/* Global Comprehensive Worker Profile Modal */}
      {profileWorkerId && (
        <WorkerProfileModal
          workerId={profileWorkerId}
          isOpen={Boolean(profileWorkerId)}
          onClose={closeWorkerProfile}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <ProjectProvider>
            <AppContent />
          </ProjectProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
