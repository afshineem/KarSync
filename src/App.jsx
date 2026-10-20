import { runEmergencyCleanup } from "./db/migration_fix.js";
import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { AuthProvider, useAuth, RBACProvider } from './context/AuthContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { db, seedInitialDataIfEmpty, reconcileSettlementEpochs, migrateClosedTransactionsToCashBox } from './db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { PersonnelHubView } from './components/PersonnelHubView';
import { CounterpartiesView } from './components/CounterpartiesView';
import { CalendarReportsView } from './components/CalendarReportsView';
import { FinancialsView } from './components/FinancialsView';
import { ExpensesView, AddExpenseModal } from './components/ExpensesView';
import { AccountingView } from './components/AccountingView';
import { FinanceAndAccountingView } from './components/FinanceAndAccountingView';
import { SettlementModal } from './components/SettlementModal';
import { DailyLoggingModal, FloatingActionButton } from './components/DailyLoggingModal';
import { BackupModal } from './components/BackupModal';
import { checkAndRunAutoBackup } from './db/backup';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AboutModal } from './components/AboutModal';
import { WorkersModal } from './components/WorkersModal';
import { AddWorkerModal } from './components/AddWorkerModal';
import { CounterpartiesModal } from './components/CounterpartiesModal';
import { LoginView } from './components/LoginView';
import { WorkerViewPortal } from './components/WorkerViewPortal';
import { WorkerLinkLoginScreen } from './components/WorkerLinkLoginScreen';
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
import { ProductTour } from './components/ProductTour';
import { FloatingSetupChecklist } from './components/FloatingSetupChecklist';
import { SubsidiarySearchModal } from './components/accounting/SubsidiarySearchModal';
import { AccountSubsidiaryLedgerModal } from './components/accounting/AccountSubsidiaryLedgerModal';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/ToastContainer';

function AppContent() {
  const { user, isAdmin, isWorker, onboardingCompleted, linkLogin, retryLinkLogin, dismissLinkLogin } = useAuth();
  const { language, numberFormat } = useLanguage();
  const { 
    profileWorkerId, 
    closeWorkerProfile,
    isGlobalSettingsOpen,
    globalSettingsTab,
    openGlobalSettings,
    closeGlobalSettings
  } = useProject();
  const [activeTab, setActiveTab] = useState('dashboard');
  useEffect(() => {
    const handleNavigate = (e) => {
      if (e.detail?.tab) setActiveTab(e.detail.tab);
    };
    window.addEventListener('navigateApp', handleNavigate);
    return () => window.removeEventListener('navigateApp', handleNavigate);
  }, []);

  // Open a specific attendance day (e.g. from the audit log "eye" button):
  // Personnel hub > "گزارش کارکرد" > calendar, with that day's modal open.
  // Passed down as a prop (not a second event) so it can't be lost before the views mount.
  const [personnelNav, setPersonnelNav] = useState(null);
  useEffect(() => {
    const handleOpenAttendanceDay = (e) => {
      const date = e.detail?.date;
      if (!date) return;
      setActiveTab('workers');
      setPersonnelNav({ subTab: 'calendar', date, nonce: Date.now() });
    };
    window.addEventListener('karsync-open-attendance-day', handleOpenAttendanceDay);
    return () => window.removeEventListener('karsync-open-attendance-day', handleOpenAttendanceDay);
  }, []);
  const [isLoggingModalOpen, setIsLoggingModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementWorker, setSettlementWorker] = useState(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isWorkersModalOpen, setIsWorkersModalOpen] = useState(false);
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [isCounterpartiesModalOpen, setIsCounterpartiesModalOpen] = useState(false);
  const [loggingModalDate, setLoggingModalDate] = useState(null);
  const [isSubsidiarySearchOpen, setIsSubsidiarySearchOpen] = useState(false);
  const [selectedLedgerEntity, setSelectedLedgerEntity] = useState(null);

  // Global listeners for Workers, Counterparties & Daily Logging modals
  useEffect(() => {
    const handleOpenWorkers = () => setIsWorkersModalOpen(true);
    const handleOpenAddWorker = () => setIsAddWorkerModalOpen(true);
    const handleOpenCounterparties = () => setIsCounterpartiesModalOpen(true);
    const handleOpenDailyLoggingEvent = (e) => {
      setLoggingModalDate(e.detail?.date || null);
      setIsLoggingModalOpen(true);
    };
    window.addEventListener('karsync-open-workers-modal', handleOpenWorkers);
    window.addEventListener('karsync-open-new-worker', handleOpenAddWorker);
    window.addEventListener('karsync-open-counterparties-modal', handleOpenCounterparties);
    window.addEventListener('karsync-open-daily-logging', handleOpenDailyLoggingEvent);
    return () => {
      window.removeEventListener('karsync-open-workers-modal', handleOpenWorkers);
      window.removeEventListener('karsync-open-new-worker', handleOpenAddWorker);
      window.removeEventListener('karsync-open-counterparties-modal', handleOpenCounterparties);
      window.removeEventListener('karsync-open-daily-logging', handleOpenDailyLoggingEvent);
    };
  }, []);

  // Global listeners for Subsidiary Search and Ledger
  useEffect(() => {
    const handleOpenSearch = () => setIsSubsidiarySearchOpen(true);
    const handleOpenLedger = (e) => {
      if (e.detail) {
        setSelectedLedgerEntity(e.detail);
      }
    };
    window.addEventListener('karsync-open-subsidiary-search', handleOpenSearch);
    window.addEventListener('karsync-open-subsidiary-ledger', handleOpenLedger);
    return () => {
      window.removeEventListener('karsync-open-subsidiary-search', handleOpenSearch);
      window.removeEventListener('karsync-open-subsidiary-ledger', handleOpenLedger);
    };
  }, []);

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

  // Product Tour State & Global Listeners
  const [isProductTourOpen, setIsProductTourOpen] = useState(false);
  useEffect(() => {
    const handleStartTour = () => setIsProductTourOpen(true);
    window.addEventListener('karsync-start-tour', handleStartTour);

    // Auto-trigger only on initial first-time onboarding for this user
    const userTourKey = "karsync_product_tour_seen_" + (user?.id || user?.userId || "default");
    const tourSeen = localStorage.getItem(userTourKey) || localStorage.getItem("karsync_product_tour_seen");
    if (!tourSeen && onboardingCompleted && user?.role === "admin") {
      try {
        localStorage.setItem(userTourKey, "true");
        localStorage.setItem("karsync_product_tour_seen", "true");
      } catch (_) {}
      const timer = setTimeout(() => {
        setIsProductTourOpen(true);
      }, 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("karsync-start-tour", handleStartTour);
      };
    }

    return () => window.removeEventListener('karsync-start-tour', handleStartTour);
  }, [onboardingCompleted, user?.role]);

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

  // Cloud sync / seeding is for signed-in admins only. A worker opened through a personal
  // link must NEVER run it: that device is read-only and must not push anything to the cloud.
  const syncEnabled = !!user && !isWorker;
  useEffect(() => {
    if (!syncEnabled) return;
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

    // Check and trigger scheduled auto-backup in background
    const backupTimer = setTimeout(() => {
      checkAndRunAutoBackup().catch((e) => console.warn('Auto-backup check error:', e));
    }, 6000);

    return () => clearTimeout(backupTimer);
  }, [syncEnabled]);

  // Desktop Global Keyboard Shortcuts
  useEffect(() => {
    if (!user || isWorker) return;

    const handleKeyDown = (e) => {
      // 1. Settings shortcut (Shift+,)
      if (e.shiftKey && (e.key === ',' || e.key === '<' || e.code === 'Comma')) {
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

      // Tab navigation numbers: 1 to 4 (without Shift)
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
          setActiveTab('expenses');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          setActiveTab('accounting');
          return;
        }
      }

      const keyUpper = e.key.toUpperCase();

      // Quick Actions
      if (keyUpper === 'D' || (e.shiftKey && (keyUpper === 'D' || e.code === 'KeyD'))) {
        e.preventDefault();
        handleOpenLoggingModal();
        return;
      }

      if (keyUpper === 'L' || (e.shiftKey && (keyUpper === 'L' || e.code === 'KeyL'))) {
        e.preventDefault();
        openGlobalSettings('users');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('karsync-open-audit-logs'));
        }, 50);
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
        setIsAddWorkerModalOpen(true);
        return;
      }

      if (e.shiftKey && (keyUpper === 'P' || e.code === 'KeyP')) {
        e.preventDefault();
        setIsWorkersModalOpen(true);
        return;
      }

      // Shift + O: Directly open Projects & Sections Settings
      if (e.shiftKey && (keyUpper === 'O' || e.code === 'KeyO')) {
        e.preventDefault();
        openGlobalSettings('projects');
        return;
      }

      if (keyUpper === 'P') {
        e.preventDefault();
        openGlobalSettings('projects');
        return;
      }

      if (e.shiftKey && (keyUpper === 'T' || e.code === 'KeyT')) {
        e.preventDefault();
        setActiveTab('dashboard');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('karsync-open-tasks'));
        }, 50);
        return;
      }

      if (e.shiftKey && (keyUpper === 'M' || e.code === 'KeyM')) {
        e.preventDefault();
        setIsSubsidiarySearchOpen((prev) => !prev);
        return;
      }

      if (e.shiftKey && (keyUpper === 'C' || e.code === 'KeyC')) {
        e.preventDefault();
        setIsCounterpartiesModalOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, isWorker, openGlobalSettings]);

  // 0. Personal link / QR code in progress (or failed): never flash the login page
  if (linkLogin && linkLogin.status !== 'idle') {
    return (
      <WorkerLinkLoginScreen
        status={linkLogin.status}
        error={linkLogin.error}
        detail={linkLogin.detail}
        onRetry={retryLinkLogin}
        onDismiss={dismissLinkLogin}
      />
    );
  }

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

        {(activeTab === 'workers' || activeTab === 'reports' || activeTab === 'calendar') && (
          <CalendarReportsView
            onOpenLoggingModal={handleOpenLoggingModal}
            navTarget={personnelNav}
            onNavConsumed={() => setPersonnelNav(null)}
          />
        )}

        {activeTab === 'counterparties' && (
          <CounterpartiesView />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView />
        )}

        {(activeTab === 'accounting' || activeTab === 'financials' || activeTab === 'settlements') && (
          <FinanceAndAccountingView initialSubTab="payroll" />
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

      {/* Interactive 5-Step Product Tour */}
      <ProductTour
        isOpen={isProductTourOpen}
        onClose={() => setIsProductTourOpen(false)}
      />

      {/* Global Subsidiary Search Modal (Shift+M) */}
      <SubsidiarySearchModal
        isOpen={isSubsidiarySearchOpen}
        onClose={() => setIsSubsidiarySearchOpen(false)}
        onSelectAccount={(account) => {
          setSelectedLedgerEntity({ type: 'account', data: account });
        }}
        onSelectWorker={(worker) => {
          setSelectedLedgerEntity({ type: 'worker', data: worker });
        }}
        language={language}
      />

      {/* Global Dedicated Account / Worker Subsidiary Ledger Fullscreen Modal */}
      {selectedLedgerEntity && (
        <AccountSubsidiaryLedgerModal
          isOpen={Boolean(selectedLedgerEntity)}
          entity={selectedLedgerEntity}
          onSelectEntity={(newEntity) => setSelectedLedgerEntity(newEntity)}
          onClose={() => setSelectedLedgerEntity(null)}
          language={language}
        />
      )}

      {/* Global Fullscreen Workers & Personnel Modal (Shift+P) */}
      <WorkersModal
        isOpen={isWorkersModalOpen}
        onClose={() => setIsWorkersModalOpen(false)}
      />

      {/* Global Add/Create Worker Modal (Shift+W) */}
      <AddWorkerModal
        isOpen={isAddWorkerModalOpen}
        onClose={() => setIsAddWorkerModalOpen(false)}
      />

      {/* Global Fullscreen Counterparties Modal (Shift+C) */}
      <CounterpartiesModal
        isOpen={isCounterpartiesModalOpen}
        onClose={() => setIsCounterpartiesModalOpen(false)}
      />

      {/* Floating Setup Checklist Widget */}
      {isAdmin && (
        <FloatingSetupChecklist />
      )}

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <RBACProvider>
            <ProjectProvider>
              <NotificationProvider>
                <AppContent />
                <ToastContainer />
              </NotificationProvider>
            </ProjectProvider>
          </RBACProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
