import React, { useState } from 'react';
import { History, X, Clock, Archive, Calendar, Receipt, Edit2 } from 'lucide-react';
import { formatCurrency, formatHoursAndMinutes } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

export function WorkerFinancialProfileModal({ worker, logs, payments, currency, onClose, onEditLog }) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('unsettled'); // 'unsettled' | 'archive'

  if (!worker) return null;

  const unsettledLogs = logs.filter(l => !l.isSettled);
  const settledLogs = logs.filter(l => l.isSettled);

  const unsettledPayments = payments.filter(p => !p.isSettled);
  const settledPayments = payments.filter(p => p.isSettled);

  const displayedLogs = activeTab === 'unsettled' ? unsettledLogs : settledLogs;
  const displayedPayments = activeTab === 'unsettled' ? unsettledPayments : settledPayments;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 max-w-2xl w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-y-auto p-4 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-sky-500" />
              <span>پروفایل مالی - {worker.name}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {worker.role} • {formatCurrency(worker.dailyRate, currency, language)} / روز
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('unsettled')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'unsettled'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>وضعیت فعلی (تسویه نشده)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'archive'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>آرشیو (تسویه شده)</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 mt-3 space-y-4 pe-1 pb-10">
          
          <div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
               <Calendar className="w-4 h-4 text-sky-500"/>
               کارکردها
            </h4>
            {displayedLogs.length === 0 ? (
              <p className="text-xs text-slate-400">موردی یافت نشد.</p>
            ) : (
              <div className="space-y-2">
                {displayedLogs.map(log => (
                  <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{log.date}</span>
                        <span className="bg-sky-100 text-sky-700 px-2 rounded">{log.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-end font-bold text-sky-600 text-sm">
                        {formatCurrency(log.totalDayPay, currency, language)}
                      </div>
                      <button onClick={() => onEditLog(log)} className="p-1.5 text-slate-400 hover:text-sky-600"><Edit2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
               <Receipt className="w-4 h-4 text-amber-500"/>
               پرداختی‌ها
            </h4>
            {displayedPayments.length === 0 ? (
              <p className="text-xs text-slate-400">موردی یافت نشد.</p>
            ) : (
              <div className="space-y-2">
                {displayedPayments.map(p => (
                  <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="font-mono">{p.date}</span>
                        <span className="bg-amber-100 text-amber-700 px-2 rounded">{p.type}</span>
                      </div>
                    </div>
                    <div className="text-end font-extrabold text-slate-900 dark:text-white text-sm font-mono">
                      {formatCurrency(p.amount, currency, language)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
