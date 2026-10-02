import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth, usePermissions } from '../context/AuthContext';
import { ProjectSwitcher } from './ProjectSwitcher';
import { SettingsDropdown } from './SettingsDropdown';
import { useProject } from '../context/ProjectContext';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Settings, 
  WalletCards,
  Receipt,
  Landmark
} from 'lucide-react';

export function Navbar({ 
  activeTab, 
  setActiveTab, 
  theme, 
  toggleTheme, 
  onOpenBackupModal, 
  onOpenChangePasswordModal, 
  onOpenAboutModal,
  onOpenInstallModal,
  onOpenUsersModal
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { openProjectSettings, openGlobalSettings } = useProject();
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);

  // Global keyboard shortcut: Ctrl + , or Cmd + , to open settings
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        if (openGlobalSettings) openGlobalSettings('general');
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [openGlobalSettings]);

  const { hasPermission } = usePermissions();

  const navItems = [
    { id: 'dashboard', label: t('dashboard') || 'دەشبۆرد', icon: LayoutDashboard },
    { id: 'workers', label: t('workers') || 'کرێکاران', icon: Users },
    { id: 'calendar', label: t('calendarLogs') || 'تەقویم', icon: CalendarDays },
    { id: 'financials', label: t('financialsTab') || 'حیسابات و دارایی', icon: WalletCards, hidden: !hasPermission('settlement.manage') },
    { id: 'expenses', label: t('expensesTab') || 'هزینه‌ها', icon: Receipt, hidden: !hasPermission('expenses.manage') },
    { id: 'accounting', label: t('accountingTab') || 'حسابداری و خزانه‌داری', icon: Landmark, hidden: !hasPermission('settlement.manage') },
  ].filter(item => !item.hidden);

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 no-print transition-all duration-300">
        {/* Apple Liquid Glass Background Layer */}
        <div className="absolute inset-0 bg-white/55 dark:bg-slate-950/55 backdrop-blur-3xl backdrop-saturate-200 border-b border-slate-200/50 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_24px_0_rgba(0,0,0,0.4)] -z-10 pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            
            {/* Logo & Brand */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0">
                <img 
                  src="/karsync-icon.png" 
                  alt="KarSync" 
                  className="w-full h-full object-contain drop-shadow-sm transition-transform duration-200 hover:scale-105" 
                />
              </div>
              
              <div>
                <h1 className="font-black text-sm sm:text-base md:text-lg leading-tight tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  KarSync
                </h1>
                <p className="hidden xl:block text-[11px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                  {t('appSubtitle')}
                </p>
              </div>
            </div>

            {/* Desktop Navigation Tabs (Apple Liquid Glass Dock) */}
            <div className="hidden md:flex items-center justify-center pointer-events-auto">
              <nav className="flex items-center gap-1.5 bg-white/40 dark:bg-white/[0.05] backdrop-blur-2xl backdrop-saturate-200 p-1.5 sm:p-2 rounded-2xl border border-white/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1),0_2px_12px_0_rgba(0,0,0,0.3)]">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => setActiveTab(item.id)}
                        aria-label={item.label}
                        className={`relative p-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 ${
                          isActive
                            ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 scale-105 font-bold border border-sky-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                        
                        {/* Subtle text label on active tab */}
                        {isActive && (
                          <span className="text-xs font-semibold px-1">
                            {item.label}
                          </span>
                        )}

                        {/* Active dot indicator */}
                        {isActive && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs"></span>
                        )}
                      </button>

                      {/* Micro-Tooltip (Hover when not active) */}
                      {!isActive && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          {item.label}
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Right Controls: ProjectSwitcher + Settings Gear */}
            <div className="flex items-center gap-2 flex-shrink-0 relative">
              {/* SaaS Multi-Project Switcher */}
              <ProjectSwitcher />

              {/* User Avatar & Settings Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                  title={user?.name || t('settings')}
                  aria-label={user?.name || t('settings')}
                  className={`relative p-0.5 sm:p-1 rounded-2xl border transition-all shadow-xs flex items-center justify-center group hover:scale-105 active:scale-95 ${
                    isSettingsDropdownOpen
                      ? 'ring-2 ring-sky-500 shadow-md border-transparent'
                      : 'bg-white/50 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border-white/60 dark:border-white/10 backdrop-blur-md'
                  }`}
                >
                  {user?.avatar || user?.photo || user?.supabaseUser?.user_metadata?.avatar_url ? (
                    <img 
                      src={user.avatar || user.photo || user.supabaseUser?.user_metadata?.avatar_url} 
                      alt={user?.name || 'User'} 
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shadow-xs border border-white/40 dark:border-white/10" 
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs">
                      {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AZ'}
                    </div>
                  )}
                  {/* Active Online / Synced indicator badge */}
                  <span className="absolute -bottom-0.5 -end-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-2xs" />
                </button>

                {/* Sleek Minimal Settings Dropdown */}
                <SettingsDropdown
                  isOpen={isSettingsDropdownOpen}
                  onClose={() => setIsSettingsDropdownOpen(false)}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  onOpenGlobalSettings={openGlobalSettings}
                  onOpenBackupModal={onOpenBackupModal}
                  onOpenChangePasswordModal={onOpenChangePasswordModal}
                  onOpenAboutModal={onOpenAboutModal}
                  onOpenProjectSettings={openProjectSettings}
                  onOpenInstallModal={onOpenInstallModal}
                  onOpenUsersModal={onOpenUsersModal}
                />
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Floating Bottom Navigation Bar for Mobile (Apple Liquid Glass Dock) */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 max-w-md mx-auto z-40 no-print">
        <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/60 dark:border-white/15 rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.2),inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.15)] p-1.5 sm:p-2 flex items-center justify-between gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-label={item.label}
                title={item.label}
                className={`relative flex-1 flex items-center justify-center py-2.5 rounded-2xl transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/35 border border-sky-400/30 scale-105'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-6 h-6 sm:w-6.5 sm:h-6.5 flex-shrink-0" />
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 bg-white rounded-full shadow-xs" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
