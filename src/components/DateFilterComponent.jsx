import React from 'react';
import { Calendar, Filter, Clock } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useLanguage } from '../i18n/LanguageContext';

export function DateFilterComponent() {
  const { dateFilter, setDateFilter } = useProject();
  const { t } = useLanguage();

  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 shadow-inner border border-slate-200 dark:border-slate-700 w-full sm:w-auto overflow-x-auto snap-x">
      {/* Monthly Toggle */}
      <button 
        onClick={() => setDateFilter({ ...dateFilter, mode: 'monthly' })}
        className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 snap-center flex items-center justify-center ${
          dateFilter.mode === 'monthly' 
            ? 'bg-white dark:bg-slate-700 shadow-md text-sky-600 dark:text-sky-400' 
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        <Calendar className="w-4 h-4 inline me-2"/> 
        {t('monthlyView') || 'ماهانه'}
      </button>

      {/* Since Last Settlement (Quick Pick) */}
      <button 
        onClick={() => setDateFilter({ ...dateFilter, mode: 'unsettled_only' })}
        className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 snap-center flex items-center justify-center ${
          dateFilter.mode === 'unsettled_only' 
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-md text-white' 
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        <Clock className="w-4 h-4 inline me-2"/> 
        {t('unsettledOnly') || 'از آخرین تسویه (باز)'}
      </button>
    </div>
  );
}
