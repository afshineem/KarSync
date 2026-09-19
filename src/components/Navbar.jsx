import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ProjectSwitcher } from './ProjectSwitcher';
import { SettingsDropdown } from './SettingsDropdown';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Settings, 
  WalletCards 
} from 'lucide-react';

export function Navbar({ 
  activeTab, 
  setActiveTab, 
  theme, 
  toggleTheme, 
  onOpenBackupModal, 
  onOpenChangePasswordModal, 
  onOpenAboutModal 
}) {
  const { t } = useLanguage();
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: t('dashboard') || 'دەشبۆرد', icon: LayoutDashboard },
    { id: 'workers', label: t('workers') || 'کرێکاران', icon: Users },
    { id: 'calendar', label: t('calendarLogs') || 'تەقویم', icon: CalendarDays },
    { id: 'financials', label: t('financialsTab') || 'حیسابات و دارایی', icon: WalletCards },
  ];

  return (
    <>
      {/* Top Navbar */}
      <header className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-700/60 shadow-xs dark:shadow-md sticky top-0 z-40 no-print transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            
            {/* Logo & Brand */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-100 dark:bg-slate-700/70 border border-slate-200/90 dark:border-slate-600/60 flex items-center justify-center shadow-xs p-1.5 flex-shrink-0">
                <img 
                  src="/karsync-icon.png" 
                  alt="KarSync" 
                  className="w-full h-full object-contain dark:brightness-0 dark:invert" 
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

            {/* Desktop Navigation Tabs (Dead-Centered, Icon-driven with subtle micro-tooltips) */}
            <div className="hidden md:flex items-center justify-center pointer-events-auto">
              <nav className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-700/60 backdrop-blur-md p-1 rounded-2xl border border-slate-200/90 dark:border-slate-600/60 shadow-inner">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => setActiveTab(item.id)}
                        aria-label={item.label}
                        className={`relative p-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 ${
                          isActive
                            ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 scale-105 font-bold'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-white/90 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-600/60'
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
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-300 rounded-full shadow-xs"></span>
                        )}
                      </button>

                      {/* Micro-Tooltip (Hover when not active) */}
                      {!isActive && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          {item.label}
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900 border-b-4 border-x-transparent border-x-4 border-t-0" />
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

              {/* Minimal Settings Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                  title={t('settings')}
                  aria-label={t('settings')}
                  className={`p-2 sm:p-2.5 rounded-2xl border transition-all shadow-xs flex items-center justify-center group hover:scale-105 active:scale-95 ${
                    isSettingsDropdownOpen
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md'
                      : 'bg-slate-100/90 hover:bg-white dark:bg-slate-700/60 dark:hover:bg-slate-600/60 text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white border-slate-200/90 dark:border-slate-600/60'
                  }`}
                >
                  <Settings className={`w-5 h-5 transition-all duration-300 ${isSettingsDropdownOpen ? 'rotate-90' : 'group-hover:rotate-45'}`} />
                </button>

                {/* Sleek Minimal Settings Dropdown */}
                <SettingsDropdown
                  isOpen={isSettingsDropdownOpen}
                  onClose={() => setIsSettingsDropdownOpen(false)}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  onOpenBackupModal={onOpenBackupModal}
                  onOpenChangePasswordModal={onOpenChangePasswordModal}
                  onOpenAboutModal={onOpenAboutModal}
                />
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Floating Bottom Navigation Bar for Mobile (Mobile-first PWA Style) */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 z-40 no-print">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl p-1.5 flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 font-bold scale-105'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-sky-50 dark:bg-sky-950/60 shadow-xs' : ''
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                  {item.label}
                </span>

                {/* Micro dot */}
                {isActive && (
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-0.5 shadow-xs" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
