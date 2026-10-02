import { runEmergencyCleanup } from "./db/migration_fix.js";
import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { db, seedInitialDataIfEmpty, reconcileSettlementEpochs, migrateClosedTransactionsToCashBox } from './db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { WorkersView } from './components/WorkersView';
import { CalendarReportsView } from './components/CalendarReportsView';
import { FinancialsView } from './components/FinancialsView';
import { ExpensesView, AddExpenseModal } from './components/ExpensesView';
import { AccountingView } from './components/AccountingView';
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
import GlobalSettingsModal from './components/GlobalSettingsModal';
import { performSyncUnified, getSyncConfig } from './services/syncService';
import { initRealtimeSync, pushLogsLive, pushPaymentsLive, pushAllExpensesToCloud } from './services/realtimeSync';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LockScreenModal } from './components/LockScreenModal';
import { InstallPwaModal } from './components/InstallPwaModal';

function AppContent() {
  const { user, isAdmin, isWorker, onboardingCompleted } = useAuth();
  const { numberFormat } = useLanguage();
  const { 
    profileWorkerId, 
    closeWorkerProfile,
    isGlobalSettingsOpen,
    globalSettingsTab,
    openGlobalSettings,
    closeGlobalSettings
  } = useProject();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggingModalOpen, setIsLoggingModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementWorker, setSettlementWorker] = useState(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [loggingModalDate, setLoggingModalDate] = useState(null);

  // Catch PWA beforeinstallprompt event globally
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.karsyncDeferredInstallPrompt = e;
      window.dispatchEvent(new CustomEvent('karsync-install-ready'));
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

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
      // Migrate all closed past transactions (settlements, advances, paid expenses) to the cash box
      const migRes = await migrateClosedTransactionsToCashBox();
      if (migRes?.updatedPaymentsCount > 0) {
        pushPaymentsLive().catch(() => {});
      }
      if (migRes?.updatedExpensesCount > 0) {
        pushAllExpensesToCloud().catch(() => {});
      }

      const res = await reconcileSettlementEpochs();
      if (res?.totalLogsUpdated?.length) {
        pushLogsLive(res.totalLogsUpdated).catch(() => {});
      }
      if (res?.totalAdvancesUpdated?.length) {
        pushPaymentsLive().catch(() => {});
      }
    });
    // Start automatic Real-Time Supabase Sync
    runEmergencyCleanup();
    initRealtimeSync();
  }, []);

  // Desktop Global Keyboard Shortcuts
  useEffect(() => {
    if (!user || isWorker) return;

    const handleKeyDown = (e) => {
      // 1. Settings shortcut (Ctrl+, or Cmd+,) can work even when typing
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        openGlobalSettings('general');
        return;
      }

      // Check if user is typing in an input/textarea
      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      // 2. Shortcuts help (? or Shift+/)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        if (!isInput) {
          e.preventDefault();
          openGlobalSettings('shortcuts');
          return;
        }
      }

      if (isInput) return;

      // Ignore if other control modifiers are active (like Alt or Ctrl/Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Tab navigation numbers: 1 to 5 (without Shift)
      if (!e.shiftKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('dashboard');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          setActiveTab('workers');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          setActiveTab('calendar');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          setActiveTab('financials');
          return;
        }
        if (e.key === '5') {
          e.preventDefault();
          setActiveTab('expenses');
          return;
        }
        if (e.key === '6') {
          e.preventDefault();
          setActiveTab('accounting');
          return;
        }
      }

      const keyUpper = e.key.toUpperCase();

      // Quick Actions (supports both 'L' and 'Shift+L', 'E' and 'Shift+E', etc.)
      if (keyUpper === 'L' || (e.shiftKey && (keyUpper === 'L' || e.code === 'KeyL'))) {
        e.preventDefault();
        handleOpenLoggingModal();
        return;
      }

      if (keyUpper === 'E' || (e.shiftKey && (keyUpper === 'E' || e.code === 'KeyE'))) {
        e.preventDefault();
        setIsExpenseModalOpen(true);
        return;
      }

      if (keyUpper === 'S' || (e.shiftKey && (keyUpper === 'S' || e.code === 'KeyS'))) {
        e.preventDefault();
        setIsSettlementModalOpen(true);
        return;
      }

      if (keyUpper === 'W' || (e.shiftKey && (keyUpper === 'W' || e.code === 'KeyW'))) {
        e.preventDefault();
        setActiveTab('workers');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('karsync-open-new-worker'));
        }, 60);
        return;
      }

      if (keyUpper === 'P' || (e.shiftKey && (keyUpper === 'P' || e.code === 'KeyP'))) {
        e.preventDefault();
        openGlobalSettings('projects');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, isWorker, openGlobalSettings]);

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
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
      />

      {/* Main Content View */}
      <main key={numberFormat} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
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

        {activeTab === 'accounting' && (
          <AccountingView />
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

      {/* Legacy Project Settings Modal (Fallback) */}
      <ProjectSettingsModal />

      {/* Master Global Settings Hub Modal */}
      {isGlobalSettingsOpen && (
        <GlobalSettingsModal
          isOpen={isGlobalSettingsOpen}
          initialTab={globalSettingsTab}
          onClose={closeGlobalSettings}
        />
      )}

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

      {/* Auto-Lock Screen Inactivity Protection Modal */}
      <LockScreenModal />

      {/* PWA Direct Installation & Guidance Modal */}
      <InstallPwaModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
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
