import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays,
  Settings,
  WalletCards
} from 'lucide-react';

export function Navbar({ activeTab, setActiveTab, onOpenSettings }) {
  const { t } = useLanguage();

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'workers', label: t('workers'), icon: Users },
    { id: 'calendar', label: t('calendarLogs'), icon: CalendarDays },
    { id: 'financials', label: t('financialsTab'), icon: WalletCards },
  ];

  return (
    <header className="bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60 shadow-lg sticky top-0 z-40 no-print transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          
          {/* Logo & Brand: KarSync */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 z-10">
            {/* KarSync Logo Icon */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center shadow-md p-1.5 flex-shrink-0">
              <img 
                src="/karsync-icon.png" 
                alt="KarSync" 
                className="w-full h-full object-contain brightness-0 invert" 
              />
            </div>
            
            {/* Title & Subtitle */}
            <div className="hidden sm:block">
              <h1 className="font-extrabold text-sm sm:text-base md:text-lg leading-tight tracking-tight text-white">
                KarSync
              </h1>
              <p className="hidden lg:block text-xs text-slate-400 leading-none mt-0.5">
                {t('appSubtitle')}
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Mathematically dead-centered across all screen sizes) */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center z-10 pointer-events-auto">
            <nav className="flex items-center gap-1 sm:gap-1.5 bg-slate-800/80 dark:bg-slate-900/80 backdrop-blur-md p-1 rounded-2xl border border-slate-700/60 shadow-inner">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={item.label}
                    aria-label={item.label}
                    className={`relative p-2 sm:p-2.5 rounded-xl transition-all duration-150 group ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 scale-105'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/70'
                    }`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 transition-transform group-hover:scale-110" />
                    
                    {/* Subtle active indicator dot */}
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-300 rounded-full shadow-sm"></span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Controls: Minimal Settings Button (Clean gear icon only) */}
          <div className="flex items-center gap-2 flex-shrink-0 z-10">
            <button
              type="button"
              onClick={onOpenSettings}
              title={t('settings')}
              aria-label={t('settings')}
              className="p-2 sm:p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 transition-all shadow-sm flex items-center justify-center group hover:border-sky-500/50 hover:scale-105 active:scale-95"
            >
              <Settings className="w-5 h-5 text-slate-300 group-hover:text-sky-400 group-hover:rotate-45 transition-all duration-300" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
