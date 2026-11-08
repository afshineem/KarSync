import React, { useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { formatAmount, numberToWords, formatCurrency } from '../../utils/formatters';
import { deleteContract } from '../../services/contractService';
import {
  X,
  FileSignature,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Utensils,
  Home,
  Truck,
  Printer,
  Trash2,
  Edit2,
  HardHat,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function ContractDetailModal({
  isOpen,
  onClose,
  contract,
  onEdit,
  onOpenSettlement
}) {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';
  const printRef = useRef(null);

  if (!isOpen || !contract) return null;

  const isCompleted = contract.status === 'completed';
  const isActive = contract.status === 'active';

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    const confirmMsg = language === 'ku'
      ? `ئایا دڵنیایت لە سڕینەوەی گرێبەستی "${contract.title}"؟`
      : language === 'en'
      ? `Are you sure you want to delete contract "${contract.title}"?`
      : `آیا از حذف قرارداد "${contract.title}" اطمینان دارید؟`;

    if (window.confirm(confirmMsg)) {
      await deleteContract(contract.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl rounded-3xl bg-[#f3f6f4] dark:bg-slate-950 border border-white/60 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col my-auto max-h-[92vh]"
        dir={direction}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs border ${
              isCompleted
                ? 'bg-teal-500/15 border-teal-500/30 text-teal-600 dark:text-teal-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
            }`}>
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {contract.title}
                </h3>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {contract.contractNumber}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isCompleted
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                }`}>
                  {isCompleted
                    ? (language === 'ku' ? 'تەواوبوو / پەسەندکراو' : language === 'en' ? 'Completed' : 'پایان‌یافته و تسویه‌شده')
                    : (language === 'ku' ? 'لە جێبەجێکردندایە' : language === 'en' ? 'In Progress' : 'در حال اجرا')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {contract.counterpartyName || 'پیمانکار'} {contract.counterpartyPhone ? `• ${contract.counterpartyPhone}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={language === 'ku' ? 'چاپکردن' : language === 'en' ? 'Print' : 'چاپ قرارداد'}
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Content */}
        <div ref={printRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Key Specs Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {language === 'ku' ? 'بەرواری دەستپێکردن' : language === 'en' ? 'Start Date' : 'تاریخ شروع'}
              </span>
              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                {contract.startDate || '---'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {language === 'ku' ? 'مۆڵەت / کۆتایی' : language === 'en' ? 'Agreed Deadline' : 'مهلت تحویل'}
              </span>
              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                {contract.estimatedEndDate || '---'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {language === 'ku' ? 'سزای دواکەوتن (ڕۆژانە)' : language === 'en' ? 'Daily Delay Penalty' : 'جریمه دیرکرد روزانه'}
              </span>
              <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                {formatAmount(contract.delayPenaltyPerDay || 0, currency)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {language === 'ku' ? 'کۆی گشتی برآورد' : language === 'en' ? 'Total Est. Value' : 'مبلغ کل برآوردی'}
              </span>
              <div className="text-xs font-mono font-black text-primary" dir="ltr">
                {formatAmount(contract.totalEstimatedAmount, currency)} {currency}
              </div>
            </div>
          </div>

          {/* Work Items Table */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white">
              <Layers className="w-4 h-4 text-sky-500" />
              <span>{language === 'ku' ? 'خشتەی بڕگەکانی کار و ئەندازەگیری' : language === 'en' ? 'Scope of Work & Unit Rates' : 'جدول اقلام کاری و احجام متره‌کشی شده'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold">
                    <th className="py-2.5 px-3 text-start">#</th>
                    <th className="py-2.5 px-3 text-start">{language === 'ku' ? 'شرحی کار' : language === 'en' ? 'Item' : 'شرح ردیف'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'یەکە' : language === 'en' ? 'Unit' : 'واحد'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'کەرەستە' : language === 'en' ? 'Materials' : 'وضعیت مصالح'}</th>
                    <th className="py-2.5 px-3 text-center">
                      {isCompleted ? (language === 'ku' ? 'قەبارەی کرداری' : language === 'en' ? 'Final Qty' : 'مقدار قطعی') : (language === 'ku' ? 'قەبارەی خەمڵێنراو' : language === 'en' ? 'Est. Qty' : 'مقدار برآوردی')}
                    </th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'نرخی یەکە' : language === 'en' ? 'Unit Price' : 'نرخ واحد'}</th>
                    <th className="py-2.5 px-3 text-end">{language === 'ku' ? 'کۆی گشتی' : language === 'en' ? 'Total' : 'مبلغ کل'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(contract.items || []).map((it, idx) => {
                    const qty = Number(isCompleted && it.finalQuantity !== undefined ? it.finalQuantity : it.estimatedQuantity) || 0;
                    const rate = Number(it.unitPrice) || 0;
                    const total = qty * rate;

                    return (
                      <tr key={it.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{it.title}</td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-bold">{it.unit}</td>
                        <td className="py-2.5 px-3 text-center text-[11px] text-slate-500">
                          {it.materialProvision === 'contractor' ? (language === 'ku' ? 'پەیمانکار' : language === 'en' ? 'Contractor' : 'با مصالح پیمانکار') : (language === 'ku' ? 'کارگە' : language === 'en' ? 'Workshop' : 'با مصالح کارگاه')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{qty}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">{formatAmount(rate, currency)}</td>
                        <td className="py-2.5 px-3 text-end font-mono font-black text-slate-900 dark:text-white" dir="ltr">{formatAmount(total, currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Backcharges Commitments & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-slate-800 shadow-sm space-y-2.5">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-emerald-500" />
                <span>{language === 'ku' ? 'بەرپرسیاریەتی خەرجییەکانی لاوەکی' : language === 'en' ? 'Site Expenses Responsibility' : 'تعهدات هزینه‌های جانبی کارگاه'}</span>
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>{language === 'ku' ? 'خواردنی تیم:' : language === 'en' ? 'Food & Catering:' : 'غذا و پذیرایی اکیپ:'}</span>
                  <span className="font-bold">{contract.backchargeCommitments?.food === 'contractor' ? 'پای پیمانکار' : 'پای کارگاه'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>{language === 'ku' ? 'شوێنی مانەوە:' : language === 'en' ? 'Lodging & Housing:' : 'اسکان و خوابگاه پرسنل:'}</span>
                  <span className="font-bold">{contract.backchargeCommitments?.lodging === 'contractor' ? 'پای پیمانکار' : 'پای کارگاه'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1">
                  <span>{language === 'ku' ? 'هاتوچۆ و ترابەری:' : language === 'en' ? 'Transportation:' : 'ایاب و ذهاب و ترابری:'}</span>
                  <span className="font-bold">{contract.backchargeCommitments?.transport === 'contractor' ? 'پای پیمانکار' : 'پای کارگاه'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {language === 'ku' ? 'مەرج و تێبینییەکان' : language === 'en' ? 'Terms & Notes' : 'شرایط و توضیحات تکمیلی'}
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                {contract.terms || (language === 'ku' ? 'هیچ مەرجێکی تایبەت تۆمار نەکراوە.' : language === 'en' ? 'No specific terms recorded.' : 'شرایط اختصاصی خاصی ثبت نشده است.')}
              </p>
            </div>
          </div>

          {/* Settlement Result if Completed */}
          {isCompleted && contract.settlementDetails && (
            <div className="p-4 sm:p-5 rounded-3xl bg-teal-500/10 border border-teal-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{language === 'ku' ? 'ئەنجامی ژمێریاری کۆتایی' : language === 'en' ? 'Final Settlement Statement' : 'نتیجه تسویه و صورت‌وضعیت قطعی'}</span>
                </span>
                <span className="text-xs font-mono font-bold text-teal-600">
                  {contract.actualEndDate}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px]">{language === 'ku' ? 'کۆی کارکرد:' : language === 'en' ? 'Gross:' : 'کارکرد ناخالص:'}</span>
                  <div className="font-mono font-bold">{formatAmount(contract.settlementDetails.grossWorkAmount, currency)}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">{language === 'ku' ? 'سزای تاخیر:' : language === 'en' ? 'Delay:' : 'جریمه تاخیر:'}</span>
                  <div className="font-mono font-bold text-rose-500">{formatAmount(contract.settlementDetails.totalDelayPenalty, currency)}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">{language === 'ku' ? 'پێشەکی و خەرجی:' : language === 'en' ? 'Advances/Backcharges:' : 'کسورات:'}</span>
                  <div className="font-mono font-bold text-rose-500">{formatAmount((contract.settlementDetails.totalAdvances || 0) + (contract.settlementDetails.totalBackcharges || 0), currency)}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">{language === 'ku' ? 'خاڵس دراو:' : language === 'en' ? 'Net Paid:' : 'خالص پرداخت:'}</span>
                  <div className="font-mono font-black text-teal-600 dark:text-teal-400">{formatAmount(contract.finalPayableAmount, currency)} {currency}</div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky bottom-0 z-20 no-print">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3.5 py-2 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{language === 'ku' ? 'سڕینەوە' : language === 'en' ? 'Delete' : 'حذف قرارداد'}</span>
            </button>
            {isActive && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(contract);
                }}
                className="px-3.5 py-2 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Edit2 className="w-4 h-4" />
                <span>{language === 'ku' ? 'دەستکاری' : language === 'en' ? 'Edit' : 'ویرایش'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isActive && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettlement(contract);
                }}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/25 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{language === 'ku' ? 'تەواوکردن و ژمێریاری کۆتایی' : language === 'en' ? 'Final Settlement' : 'پایان کار و صورت‌وضعیت قطعی'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
