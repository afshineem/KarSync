import React, { useState } from 'react';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { pushPaymentsLive, recordPendingPaymentDeletion } from '../services/realtimeSync';
import { formatAmount, roundIQD } from '../utils/formatters';
import { 
  Receipt, 
  X, 
  User, 
  Calendar, 
  Trash2, 
  Printer, 
  Coins, 
  Banknote, 
  CheckCircle2, 
  FileText,
  Clock
} from 'lucide-react';

export function PaymentHistoryModal({ 
  isOpen, 
  onClose, 
  worker, 
  payments = [],
  month = null
}) {
  const { t, language } = useLanguage();
  const [filterMonthOnly, setFilterMonthOnly] = useState(false);

  if (!isOpen || !worker) return null;

  // Filter payments
  const displayedPayments = filterMonthOnly && month
    ? payments.filter((p) => p.workerId === worker.id && p.month === month)
    : payments.filter((p) => p.workerId === worker.id);

  // Sort descending by date
  displayedPayments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Calculate totals
  const totalAdvances = roundIQD(displayedPayments
    .filter((p) => p.type === 'advance')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0));

  const totalSettlements = roundIQD(displayedPayments
    .filter((p) => p.type === 'settlement')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0));

  const totalAllPaid = roundIQD(totalAdvances + totalSettlements);

  const handleDelete = async (paymentId) => {
    if (window.confirm(t('paymentDeleteConfirm'))) {
      recordPendingPaymentDeletion(paymentId);
      await db.payments.delete(paymentId);
      pushPaymentsLive().catch(() => {});
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 sm:p-6 shadow-2xl my-auto animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white print:border-none print:shadow-none print:p-4 print:text-black">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 print:pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 print:hidden">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {t('paymentHistory')}
              </h3>
              <p className="text-xs text-slate-400 print:text-slate-600">
                {worker.name} • {worker.role}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-xs"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('printSettlementReceipt')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Header (Shown when printing) */}
        <div className="hidden print:block text-center py-4 border-b border-slate-300 mb-4">
          <h1 className="text-xl font-black">{t('appName')}</h1>
          <h2 className="text-sm font-bold text-slate-700 mt-1">{t('receiptTitle')}</h2>
          <div className="flex justify-between items-center text-xs text-slate-600 mt-3 px-4 font-mono">
            <span>{t('workerName')}: <strong>{worker.name}</strong> ({worker.role})</span>
            <span>{t('monthSelector')}: <strong>{month || t('allTime')}</strong></span>
            <span>{t('reportGeneratedAt')}: <strong>{new Date().toISOString().split('T')[0]}</strong></span>
          </div>
        </div>

        {/* Filter Toggle on Screen */}
        {month && (
          <div className="flex items-center justify-between mt-3 text-xs no-print">
            <span className="text-slate-400">
              {displayedPayments.length} {t('paymentRecordsCount')}
            </span>
            <button
              type="button"
              onClick={() => setFilterMonthOnly(!filterMonthOnly)}
              className="text-sky-600 dark:text-sky-400 hover:underline font-bold"
            >
              {filterMonthOnly ? `${t('showingAllHistory')} (${payments.filter(p => p.workerId === worker.id).length})` : `${t('showingOnlyMonth')} (${month})`}
            </button>
          </div>
        )}

        {/* Summary Metric Chips */}
        <div className="grid grid-cols-3 gap-2.5 my-3.5">
          <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 print:border print:border-slate-300">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
              {t('totalPaidAdvances')}
            </span>
            <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300 font-mono mt-1 block">
              {formatAmount(totalAdvances)} <span className="text-[10px] font-normal">{t('currencySymbol')}</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 print:border print:border-slate-300">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
              {t('workerFinalSettlementTotal')}
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 font-mono mt-1 block">
              {formatAmount(totalSettlements)} <span className="text-[10px] font-normal">{t('currencySymbol')}</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 print:border print:border-slate-300">
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 block">
              {t('totalPaidAll')}
            </span>
            <span className="text-sm sm:text-base font-black text-sky-700 dark:text-sky-300 font-mono mt-1 block">
              {formatAmount(totalAllPaid)} <span className="text-[10px] font-normal">{t('currencySymbol')}</span>
            </span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl max-h-[50vh] overflow-y-auto print:max-h-none print:border-slate-300">
          {displayedPayments.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              {t('noPaymentsRecorded')}
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-start">{t('dateTimeColumn')}</th>
                  <th className="px-3 py-2.5 text-center">{t('typeColumn')}</th>
                  <th className="px-3 py-2.5 text-end">{t('paymentAmount')}</th>
                  <th className="px-3 py-2.5 text-start">{t('referenceNumber')}</th>
                  <th className="px-3 py-2.5 text-start">{t('notesColumn')}</th>
                  <th className="px-3 py-2.5 text-center no-print">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300">
                {displayedPayments.map((p) => {
                  const paymentTime = p.time || (p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span>{p.date}</span>
                          {paymentTime && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              {paymentTime}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.type === 'settlement'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          {p.type === 'settlement' ? t('settlementType') : t('advanceType')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-end font-extrabold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {formatAmount(p.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-mono">
                        {p.referenceNumber || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {p.notes || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center no-print whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Dual Signature Blocks (Printed Receipt) */}
        <div className="hidden print:flex justify-around items-end pt-16 pb-6 mt-8 border-t border-slate-300 text-xs font-bold text-slate-800">
          <div className="text-center">
            <p className="mb-14">{t('receiptWorkerSign')}</p>
            <div className="w-44 border-b border-slate-600"></div>
          </div>
          <div className="text-center">
            <p className="mb-14">{t('receiptManagerSign')}</p>
            <div className="w-44 border-b border-slate-600"></div>
          </div>
        </div>

      </div>
    </div>
  );
}
