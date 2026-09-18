import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays,
  Settings,
  LogOut,
  WalletCards
} from 'lucide-react';

export function Navbar({ activeTab, setActiveTab, onOpenSettings }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'workers', label: t('workers'), icon: Users },
    { id: 'calendar', label: t('calendarLogs'), icon: CalendarDays },
    { id: 'financials', label: t('financialsTab'), icon: WalletCards },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40 border-b border-slate-800 no-print transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand: On mobile ONLY the sleek logo is visible; Title/Subtitle hidden */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0">
            {/* Minimalist Vector Logo */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-800 flex items-center justify-center shadow-md shadow-sky-500/20 ring-2 ring-sky-400/20 flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 100 100" fill="none">
                <path d="M26 32 L38 32 L50 56 L62 32 L74 32 L58 68 L42 68 Z" fill="#ffffff" />
                <circle cx="50" cy="38" r="5" fill="#f59e0b" />
              </svg>
            </div>
            
            {/* Title & Subtitle: On tablet show compact title and hide long subtitle */}
            <div className="hidden sm:block min-w-0">
              <h1 className="font-bold text-xs sm:text-sm md:text-base leading-tight tracking-tight text-white truncate max-w-[150px] md:max-w-[210px] lg:max-w-none">
                {t('appName')}
              </h1>
              <p className="hidden lg:block text-xs text-slate-400 leading-none mt-0.5 truncate">
                {t('appSubtitle')}
              </p>
            </div>
          </div>

          {/* Navigation Tabs (3 Main Icons with Tooltips) */}
          <nav className="flex items-center gap-1 sm:gap-1.5 bg-slate-800/90 p-1 rounded-2xl border border-slate-700/60 shadow-inner flex-shrink-0">
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

          {/* Right Controls: Settings Button + Admin Badge + Logout Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            
            {/* Settings Button */}
            <button
              type="button"
              onClick={onOpenSettings}
              title={t('settings') || 'تنظیمات'}
              aria-label="Settings"
              className="relative p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 transition-all shadow-sm flex items-center gap-2 group hover:border-sky-500/50"
            >
              <Settings className="w-5 h-5 text-slate-300 group-hover:text-sky-400 group-hover:rotate-45 transition-all duration-300" />
              <span className="hidden sm:inline text-xs font-bold text-slate-200 group-hover:text-white">
                {t('settings')}
              </span>
              {/* Subtle green indicator showing Supabase cloud is active */}
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 end-1.5 ring-2 ring-slate-900 animate-pulse"></span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              title={t('logout')}
              aria-label="Logout"
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-800/60 transition-all shadow-sm flex items-center gap-1.5 group"
            >
              <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden md:inline text-xs font-bold">
                {t('logout')}
              </span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}
