import React, { useState } from 'react';
import { WorkersView } from './WorkersView';
import { CalendarReportsView } from './CalendarReportsView';
import { useLanguage } from '../i18n/LanguageContext';
import { Users, CalendarDays } from 'lucide-react';

export function PersonnelHubView({ onOpenLoggingModal }) {
  const { language } = useLanguage();
  const [subTab, setSubTab] = useState('list'); // 'list' | 'calendar'

  return (
    <div className="space-y-4">
      {/* Sub-Navigation */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full max-w-sm mx-auto shadow-inner border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setSubTab('list')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-all ${
            subTab === 'list' 
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          {language === 'fa' ? 'لیست افراد' : 'لیستی کرێکاران'}
        </button>
        <button
          onClick={() => setSubTab('calendar')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-all ${
            subTab === 'calendar' 
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          {language === 'fa' ? 'گزارش کارکرد' : 'ڕاپۆرتی کارکردن'}
        </button>
      </div>

      {/* Render View */}
      <div className="mt-4">
        {subTab === 'list' && <WorkersView />}
        {subTab === 'calendar' && <CalendarReportsView onOpenLoggingModal={onOpenLoggingModal} />}
      </div>
    </div>
  );
}
