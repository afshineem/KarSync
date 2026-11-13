import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { formatAmount, numberToWords, formatCurrency, getTodayDateString } from '../../utils/formatters';
import {
  deleteContract,
  getContractCrewAttendanceSummary,
  getContractTimelineProgress,
  getContractSettlementProgress,
  getContractSettlementPaymentSummary
} from '../../services/contractService';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import AddContractAmendmentModal from './AddContractAmendmentModal';
import ContractSettlementPaymentModal from './ContractSettlementPaymentModal';
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
  ExternalLink,
  Users,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FilePlus2,
  FileText,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Info,
  CreditCard,
  Wallet,
  Scale,
  ShieldCheck
} from 'lucide-react';

export default function ContractDetailModal({
  isOpen,
  onClose,
  contract: initialContract,
  onEdit,
  onOpenSettlement
}) {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';
  const printRef = useRef(null);

  const [isAmendmentModalOpen, setIsAmendmentModalOpen] = useState(false);
  const [payingSettlement, setPayingSettlement] = useState(null);
  const [expandedHistorySettlementId, setExpandedHistorySettlementId] = useState(null);

  // Live contract query so amendments and settlements update seamlessly
  const liveContract = useLiveQuery(
    async () => {
      if (!initialContract?.id || !db.contracts) return initialContract;
      const c = await db.contracts.get(initialContract.id);
      return c || initialContract;
    },
    [initialContract?.id]
  ) || initialContract;

  const contract = liveContract || initialContract;

  // Settlement progress summary across all prior interim settlements
  const progress = useMemo(() => {
    return getContractSettlementProgress(contract);
  }, [contract]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isAmendmentModalOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isAmendmentModalOpen]);

  // Live query for crew day-labor attendance
  const crewAttendance = useLiveQuery(
    async () => {
      if (!contract?.id) return null;
      return await getContractCrewAttendanceSummary({
        contract,
        startDate: contract.startDate
      });
    },
    [contract?.id, contract?.counterpartyId, contract?.linkedGroupId, contract?.startDate]
  );

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

  const formatItemUnit = (unit) => {
    if (unit === 'man_day') {
      return language === 'ku' ? 'ڕۆژ-کرێکار' : language === 'en' ? 'Man-Day' : 'نفر-روز';
    }
    if (unit === 'm2') return language === 'ku' ? 'م²' : language === 'en' ? 'm²' : 'متر مربع';
    if (unit === 'm1') return language === 'ku' ? 'م.درێژی' : language === 'en' ? 'Linear m' : 'متر طول';
    if (unit === 'm3') return language === 'ku' ? 'م³' : language === 'en' ? 'm³' : 'متر مکعب';
    if (unit === 'item') return language === 'ku' ? 'دانە' : language === 'en' ? 'Item' : 'عدد';
    if (unit === 'lump_sum') return language === 'ku' ? 'سەرجەم' : language === 'en' ? 'Lump sum' : 'مقطوع';
    return unit;
  };

  const settlementsList = Array.isArray(contract.settlements) ? contract.settlements : [];
  const amendmentsList = Array.isArray(contract.amendments) ? contract.amendments : [];

  return (
    <div 
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !p-0 z-[100] w-screen h-[100dvh] max-h-[100dvh] bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 z-20 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs border ${
            isCompleted
              ? 'bg-teal-500/15 border-teal-500/30 text-teal-600 dark:text-teal-400'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
          }`}>
            <FileSignature className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                {contract.title}
              </h2>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {contract.contractNumber}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                isCompleted
                  ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{language === 'ku' ? 'تەواوبوو (تسویەکراو)' : language === 'en' ? 'Completed & Settled' : 'پایان یافته و تسویه‌شده'}</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3" />
                    <span>{language === 'ku' ? 'لە جێبەجێکردن' : language === 'en' ? 'Active' : 'در حال اجرا'}</span>
                  </>
                )}
              </span>

              {/* Settlements Count Pill */}
              {settlementsList.length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-mono">
                  {settlementsList.length} {language === 'ku' ? 'قۆناغ' : language === 'en' ? 'stages' : 'صورت‌وضعیت'}
                </span>
              )}

              {/* Amendments Count Pill */}
              {amendmentsList.length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-mono">
                  {amendmentsList.length} {language === 'ku' ? 'پاشکۆ' : language === 'en' ? 'addenda' : 'الحاقیه'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <HardHat className="w-3.5 h-3.5 text-amber-500" />
              <span>{contract.counterpartyName || (language === 'ku' ? 'پەیمانکار' : language === 'en' ? 'Contractor' : 'پیمانکار')}</span>
              {contract.type && (
                <span className="text-[10px] text-slate-400">
                  • {contract.type === 'master_craftsman' ? (language === 'ku' ? 'وەستاکار' : language === 'en' ? 'Master Craftsman' : 'استادکار') : (language === 'ku' ? 'پەیمانکاری دەست دوو' : language === 'en' ? 'Subcontractor' : 'پیمانکار جز')}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 rounded-2xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={language === 'ku' ? 'چاپکردن' : language === 'en' ? 'Print' : 'چاپ قرارداد'}
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6" ref={printRef}>
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Quick Metrics Bar: 4 Hero Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Total Estimated / Contract Value */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">
                {language === 'ku' ? 'بەهای گشتی گرێبەست:' : language === 'en' ? 'Total Contract Value:' : 'مبلغ کل برآورد پیمان:'}
              </span>
              <div className="text-base sm:text-xl font-black font-mono text-slate-900 dark:text-white" dir="ltr">
                {formatAmount(contract.totalEstimatedAmount, currency)} {currency}
              </div>
              <div className="text-[10px] text-slate-400">
                {contract.items?.length || 0} {language === 'ku' ? 'بڕگەی کاری' : language === 'en' ? 'work items' : 'ردیف کاری'}
              </div>
            </div>

            {/* 2. Cumulative Settled Amount to date */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">
                {language === 'ku' ? 'کۆی تسویەکراوی تجمعی:' : language === 'en' ? 'Cumulative Settled to Date:' : 'کارکرد تسویه‌شده تجمعی:'}
              </span>
              <div className="text-base sm:text-xl font-black font-mono text-primary" dir="ltr">
                {formatAmount(progress?.totalSettledGross || 0, currency)} {currency}
              </div>
              <div className="text-[10px] text-primary font-bold">
                {progress?.financialPercent || 0}% {language === 'ku' ? 'پێشکەوتنی دارایی' : language === 'en' ? 'financial progress' : 'پیشرفت مالی کل'}
              </div>
            </div>

            {/* 3. Delay Penalty */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">
                {language === 'ku' ? 'سزای دواکەوتن (ڕۆژانە):' : language === 'en' ? 'Daily Delay Penalty:' : 'جریمه تاخیر روزانه:'}
              </span>
              <div className="text-base sm:text-xl font-black font-mono text-rose-500" dir="ltr">
                {formatAmount(contract.delayPenaltyPerDay || 0, currency)} {currency}
              </div>
              <div className="text-[10px] text-slate-400">
                {language === 'ku' ? 'بۆ هەر ڕۆژێکی زیادە' : language === 'en' ? 'per calendar day' : 'به ازای هر روز تاخیر'}
              </div>
            </div>

            {/* 4. Live Day-Labor Crew Logs */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">
                {language === 'ku' ? 'کارکردی ڕۆژانەی تیم (زیندوو):' : language === 'en' ? 'Live Crew Days (Calendar):' : 'کارکرد روزمزد تقویم (زنده):'}
              </span>
              <div className="text-base sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                {crewAttendance?.totalDays || 0} {language === 'ku' ? 'ڕۆژ' : language === 'en' ? 'days' : 'نفر-روز'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                ≈ {formatAmount(crewAttendance?.totalGrossWage || 0, currency)} {currency}
              </div>
            </div>
          </div>

          {/* Timeline Progress Bar Card */}
          {(() => {
            const todayStr = getTodayDateString();
            const timeline = getContractTimelineProgress(contract, todayStr, language);
            if (!timeline) return null;
            return (
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className={`w-4 h-4 shrink-0 ${timeline.isOverdue ? 'text-rose-500 animate-pulse' : isCompleted ? 'text-teal-500' : 'text-primary'}`} />
                    <span className="font-black text-slate-800 dark:text-slate-200 truncate">
                      {timeline.label}
                    </span>
                    {timeline.sublabel && (
                      <span className="text-[11px] text-slate-400 font-mono truncate">
                        {timeline.sublabel}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-lg shrink-0 ${timeline.badgeClass}`}>
                    {timeline.percent}%
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${timeline.colorClass}`}
                    style={{ width: `${timeline.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <div>
                    <span className="font-sans">{language === 'ku' ? 'دەستپێک:' : language === 'en' ? 'Start:' : 'شروع قرارداد:'}</span>{' '}
                    <span className="font-bold text-slate-700 dark:text-slate-300">{contract.startDate || '---'}</span>
                  </div>
                  <div>
                    <span className="font-sans">{language === 'ku' ? 'مۆڵەت:' : language === 'en' ? 'Deadline:' : 'مهلت تحویل:'}</span>{' '}
                    <span className={`font-bold ${timeline.isOverdue ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                      {contract.estimatedEndDate || '---'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Scope of Work & Measurement Table Card */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                <Layers className="w-4 h-4 text-sky-500" />
                <span>{language === 'ku' ? 'خشتەی بڕگەکانی کار و ئەندازەگیری' : language === 'en' ? 'Scope of Work & Unit Rates' : 'جدول اقلام کاری و احجام متره‌کشی شده'}</span>
              </div>
              {isActive && (
                <button
                  type="button"
                  onClick={() => setIsAmendmentModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ku' ? 'پاشکۆ و زیادکردنی کار' : language === 'en' ? 'Addendum / Increase Scope' : 'الحاقیه و افزایش حجم'}</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold">
                    <th className="py-2.5 px-3 text-start">#</th>
                    <th className="py-2.5 px-3 text-start">{language === 'ku' ? 'شرحی کار' : language === 'en' ? 'Item' : 'شرح ردیف'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'یەکە' : language === 'en' ? 'Unit' : 'واحد'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'کەرەستە' : language === 'en' ? 'Materials' : 'وضعیت مصالح'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'قەبارەی پەیمان' : language === 'en' ? 'Contracted Qty' : 'حجم پیمان'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'تسویەکراو تا ئێستا' : language === 'en' ? 'Settled to Date' : 'تسویه‌شده تا امروز'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'باقیمانده' : language === 'en' ? 'Remaining' : 'باقیمانده'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ku' ? 'نرخی یەکە' : language === 'en' ? 'Unit Price' : 'نرخ واحد'}</th>
                    <th className="py-2.5 px-3 text-end">{language === 'ku' ? 'کۆی گشتی' : language === 'en' ? 'Total' : 'مبلغ کل'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(contract.items || []).map((it, idx) => {
                    const isManDay = it.unit === 'man_day';
                    const estimatedQty = Number(it.estimatedQuantity) || 0;
                    const rate = Number(it.unitPrice) || 0;
                    const key = it.id || it.title;
                    const settledQty = progress?.itemSettledMap?.get(key) || 0;
                    const remainingQty = Math.max(0, estimatedQty - settledQty);
                    const percent = estimatedQty > 0 ? Math.min(100, Math.round((settledQty / estimatedQty) * 100)) : 0;

                    const itemRole = it.targetRole || (
                      it.title?.includes('استادکار') || it.title?.includes('وەستا') ? 'master' :
                      it.title?.includes('کارگر') || it.title?.includes('کرێکار') ? 'worker' : 'all'
                    );

                    let liveDays = 0;
                    if (isManDay && crewAttendance) {
                      if (itemRole === 'master') liveDays = crewAttendance.masterDays || 0;
                      else if (itemRole === 'worker') liveDays = crewAttendance.workerDays || 0;
                      else liveDays = crewAttendance.totalDays || 0;
                    }

                    const displayQty = isCompleted
                      ? (Number(it.finalQuantity !== undefined ? it.finalQuantity : estimatedQty) || 0)
                      : (isManDay ? liveDays : estimatedQty);

                    const displayTotal = isManDay && !isCompleted
                      ? (liveDays * rate)
                      : (displayQty * rate);

                    return (
                      <tr key={it.id || idx} className={`transition-colors ${isManDay ? 'bg-amber-500/5 dark:bg-amber-500/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}>
                        <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isManDay && <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            <span>{it.title}</span>
                            {isManDay && (
                              <span className="ms-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                {itemRole === 'master' ? (language === 'ku' ? 'وەستاکار' : language === 'en' ? 'Master' : 'استادکار') :
                                 itemRole === 'worker' ? (language === 'ku' ? 'کرێکار' : language === 'en' ? 'Worker' : 'کارگر') :
                                 (language === 'ku' ? 'گشتی' : language === 'en' ? 'Crew' : 'اکیپ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${isManDay ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            {formatItemUnit(it.unit)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
                          {it.materialProvision === 'contractor' ? (language === 'ku' ? 'پەیمانکار' : language === 'en' ? 'Contractor' : 'با مصالح پیمانکار') : (language === 'ku' ? 'کارگە' : language === 'en' ? 'Workshop' : 'با مصالح کارگاه')}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {estimatedQty}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span className="font-bold text-primary">{settledQty}</span>
                          {estimatedQty > 0 && (
                            <span className="text-[10px] text-slate-400 ms-1">({percent}%)</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                          {remainingQty}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {formatAmount(rate, currency)}
                        </td>
                        <td className="py-3 px-3 text-end font-mono" dir="ltr">
                          <div className="text-sm font-black text-slate-900 dark:text-white">
                            {formatAmount(displayTotal, currency)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contract Addenda Card («الحاقیه‌ها و متمم‌های قرارداد») */}
          {amendmentsList.length > 0 && (
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400">
                  <FilePlus2 className="w-4 h-4" />
                  <span>{language === 'ku' ? 'پاشکۆکان و متممەکانی گرێبەست' : language === 'en' ? 'Contract Addenda & Amendments History' : 'الحاقیه‌ها و متمم‌های قرارداد (افزایش حجم کار)'}</span>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {amendmentsList.length} {language === 'ku' ? 'پاشکۆ' : language === 'en' ? 'addenda' : 'الحاقیه'}
                </span>
              </div>

              <div className="space-y-3">
                {amendmentsList.map((amd, i) => (
                  <div
                    key={amd.id || i}
                    className="p-3.5 sm:p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px]">
                          #{amd.amendmentNumber || i + 1}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {amd.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {amd.date}
                      </span>
                    </div>

                    {amd.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {amd.notes}
                      </p>
                    )}

                    <div className="pt-2 border-t border-purple-500/10 flex items-center justify-between gap-3 flex-wrap text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{language === 'ku' ? 'مۆڵەتی نوێ:' : language === 'en' ? 'New deadline:' : 'مهلت جدید:'}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{amd.newEstimatedEndDate || contract.estimatedEndDate || '---'}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{language === 'ku' ? 'جیاوازی بەها:' : language === 'en' ? 'Scope Delta:' : 'اختلاف ارزش:'}</span>
                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400" dir="ltr">
                          {amd.differenceAmount >= 0 ? `+${formatAmount(amd.differenceAmount, currency)}` : formatAmount(amd.differenceAmount, currency)} {currency}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{language === 'ku' ? 'بەهای نوێ:' : language === 'en' ? 'New Total:' : 'مبلغ کل پس از الحاقیه:'}</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white" dir="ltr">
                          {formatAmount(amd.newTotalEstimatedAmount, currency)} {currency}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settlements History Card («تاریخچه صورت‌وضعیت‌ها و تسویه‌های مرحله‌ای») */}
          {settlementsList.length > 0 && (
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-sky-600 dark:text-sky-400">
                  <Receipt className="w-4 h-4" />
                  <span>{language === 'ku' ? 'مێژووی صورت‌وەزعییەتە قۆناغییەکان و تسویە' : language === 'en' ? 'Interim Settlements & Progress Billings History' : 'تاریخچه صورت‌وضعیت‌های مرحله‌ای و اسناد تسویه'}</span>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {settlementsList.length} {language === 'ku' ? 'صورت‌وەزعییەت' : language === 'en' ? 'vouchers' : 'سند'}
                </span>
              </div>

              <div className="space-y-3">
                {settlementsList.map((stl, i) => {
                  const isFinalStl = stl.settlementType === 'final';
                  const pSummary = getContractSettlementPaymentSummary(stl);
                  const isHistoryExpanded = expandedHistorySettlementId === (stl.id || i);

                  return (
                    <div
                      key={stl.id || i}
                      className={`p-3.5 sm:p-4 rounded-2xl border space-y-3 text-xs transition-all ${
                        isFinalStl
                          ? 'bg-teal-500/5 border-teal-500/25'
                          : 'bg-sky-500/5 border-sky-500/20'
                      }`}
                    >
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] ${
                            isFinalStl
                              ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                              : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                          }`}>
                            #{stl.settlementNumber || i + 1}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {stl.title || (isFinalStl 
                              ? (language === 'ku' ? 'صورت‌وەزعییەتی کۆتایی' : language === 'en' ? 'Final Settlement' : 'صورت‌وضعیت قطعی') 
                              : (language === 'ku' ? `قۆناغی #${stl.settlementNumber || i + 1}` : language === 'en' ? `Stage #${stl.settlementNumber || i + 1}` : `صورت‌وضعیت مرحله ${stl.settlementNumber || i + 1}`)
                            )}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isFinalStl
                              ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                              : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          }`}>
                            {isFinalStl ? (language === 'ku' ? 'کۆتایی' : language === 'en' ? 'Final' : 'قطعی') : (language === 'ku' ? 'قۆناغی' : language === 'en' ? 'Interim' : 'موقت')}
                          </span>

                          {/* Payment status badge */}
                          {pSummary.status === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{language === 'ku' ? 'تسویەی تەواو' : language === 'en' ? 'Fully Paid' : 'تسویه کامل'}</span>
                            </span>
                          ) : pSummary.status === 'partial' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{language === 'ku' ? `پارەدانی بەشەکی (${pSummary.percent}٪)` : language === 'en' ? `Partial (${pSummary.percent}%)` : `پرداخت مرحله‌ای (${pSummary.percent}٪)`}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>{language === 'ku' ? 'چاوەڕوانی فەرمانی پارەدان' : language === 'en' ? 'Pending Payment Order' : 'در انتظار دستور پرداخت'}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400">
                            {stl.date}
                          </span>
                          {stl.voucherNumber && (
                            <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700">
                              {stl.voucherNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {stl.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {stl.notes}
                        </p>
                      )}

                      {/* Financial figures grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[11px]">
                        <div>
                          <span className="text-slate-400 text-[10px]">{language === 'ku' ? 'کارکردی ناخالص:' : language === 'en' ? 'Gross:' : 'کارکرد ناخالص:'}</span>
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatAmount(stl.grossWorkAmount, currency)}</div>
                        </div>

                        <div>
                          <span className="text-slate-400 text-[10px]">{language === 'ku' ? 'کسورات:' : language === 'en' ? 'Deductions:' : 'کسورات مرحله:'}</span>
                          <div className="font-mono font-bold text-rose-500">
                            -{formatAmount((stl.totalAdvances || 0) + (stl.totalBackcharges || 0) + (stl.totalExtraDeductions || 0) + (stl.totalDelayPenalty || 0) + (stl.retentionAmount || 0) + (stl.insuranceAmount || 0), currency)}
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400 text-[10px]">{language === 'ku' ? 'خاڵسی پەسەندکراو:' : language === 'en' ? 'Approved Net:' : 'خالص تاییدشده:'}</span>
                          <div className="font-mono font-bold text-sky-600 dark:text-sky-400">{formatAmount(pSummary.netPayable, currency)} {currency}</div>
                        </div>

                        <div>
                          <span className="text-slate-400 text-[10px]">{language === 'ku' ? 'باڵانسی ماوە:' : language === 'en' ? 'Remaining Balance:' : 'مانده قابل پرداخت:'}</span>
                          <div className={`font-mono font-black ${pSummary.remaining > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`}>
                            {formatAmount(pSummary.remaining, currency)} {currency}
                          </div>
                        </div>
                      </div>

                      {/* Delay Penalty Banner (درآمد حاصل از خسارت کارگاه) */}
                      {stl.totalDelayPenalty > 0 && (
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] flex items-center justify-between text-amber-800 dark:text-amber-200">
                          <span className="flex items-center gap-1 font-bold">
                            <Scale className="w-3.5 h-3.5 text-amber-600" />
                            <span>{language === 'ku' ? `سزای ${stl.delayDays || 0} ڕۆژ دواکەوتن (داهاتی پڕۆژە):` : language === 'en' ? `Delay penalty for ${stl.delayDays || 0} days (Workshop damage revenue):` : `کسر جریمه ${stl.delayDays || 0} روز تاخیر (درآمد ناشی از خسارات کارگاه):`}</span>
                          </span>
                          <span className="font-mono font-black">
                            -{formatAmount(stl.totalDelayPenalty, currency)} {currency}
                          </span>
                        </div>
                      )}

                      {/* Payment Action Bar & History Toggle */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex-wrap">
                        <div className="flex items-center gap-2">
                          {pSummary.transactions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedHistorySettlementId(isHistoryExpanded ? null : (stl.id || i))}
                              className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                            >
                              <span>{language === 'ku' ? `مێژووی پارەدانەکان (${pSummary.transactions.length})` : language === 'en' ? `Payment History (${pSummary.transactions.length})` : `ریز واریزی‌ها (${pSummary.transactions.length} قسط)`}</span>
                              {isHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {pSummary.remaining > 0 ? (
                            <button
                              type="button"
                              onClick={() => setPayingSettlement(stl)}
                              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-teal-600 hover:bg-teal-500 text-white shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>{language === 'ku' ? 'تۆمارکردنی پارەدانی دارایی' : language === 'en' ? 'Disburse Payment' : 'ثبت پرداخت مالی'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 border border-emerald-500/20">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{language === 'ku' ? 'تەواوی پارە دراوە' : language === 'en' ? '100% Settled' : '۱۰۰٪ تسویه شده'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expandable Payment History Sub-Panel */}
                      {isHistoryExpanded && pSummary.transactions.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 space-y-1.5 mt-2 animate-in fade-in duration-150">
                          {pSummary.transactions.map((tx, txIdx) => (
                            <div
                              key={tx.paymentId || txIdx}
                              className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-teal-500/10 text-teal-600 font-mono font-bold text-[10px] flex items-center justify-center">
                                  #{txIdx + 1}
                                </span>
                                <div>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {tx.accountName || 'خزانه‌داری'} ({tx.paymentMethod === 'bank' ? 'بانک' : tx.paymentMethod === 'cheque' ? 'چک' : 'صندوق'})
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono ltr:ml-2 rtl:mr-2">
                                    {tx.date}
                                  </span>
                                  {tx.trackingCode && (
                                    <span className="text-[10px] text-slate-500 ltr:ml-2 rtl:mr-2">
                                      کد پیگیری: {tx.trackingCode}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {formatAmount(tx.amount, currency)} {currency}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Crew Day-Labor Attendance Card */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <span>{language === 'ku' ? 'پوختەی کارکردی زیندوی تیمی ڕۆژموزد' : language === 'en' ? 'Live Crew Day-Labor Attendance (Calendar)' : 'کارکرد زنده اکیپ روزمزد در تقویم کارگاه'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-mono">
                  {crewAttendance?.totalDays || 0} {language === 'ku' ? 'ڕۆژ-کرێکار' : language === 'en' ? 'man-days' : 'نفر-روز'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                  {language === 'ku' ? 'زیندوو' : language === 'en' ? 'Live' : 'زنده و برخط'}
                </span>
              </div>
            </div>

            {crewAttendance && (crewAttendance.totalDays > 0 || crewAttendance.crewWorkers?.length > 0) ? (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-0.5">
                    <span className="block text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {language === 'ku' ? 'کۆی ڕۆژ-کرێکار (گشتی)' : language === 'en' ? 'Total Man-Days' : 'مجموع نفر-روز (تسویه‌نشده)'}
                    </span>
                    <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                      {crewAttendance.totalDays}
                    </span>
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center space-y-0.5">
                    <span className="block text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                      {language === 'ku' ? 'ڕۆژەکانی وەستاکاران' : language === 'en' ? 'Master Days' : 'کارکرد استادکاران'}
                    </span>
                    <span className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {crewAttendance.masterDays} {language === 'ku' ? 'ڕۆژ' : language === 'en' ? 'days' : 'روز'}
                    </span>
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-0.5">
                    <span className="block text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      {language === 'ku' ? 'ڕۆژەکانی کرێکاران' : language === 'en' ? 'Worker Days' : 'کارکرد کارگران'}
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {crewAttendance.workerDays} {language === 'ku' ? 'ڕۆژ' : language === 'en' ? 'days' : 'روز'}
                    </span>
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-0.5">
                    <span className="block text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {language === 'ku' ? 'ارزشی دەستحەق' : language === 'en' ? 'Gross Wages Value' : 'ارزش دستمزد پرسنل'}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono" dir="ltr">
                      {formatAmount(crewAttendance.totalGrossWage, currency)} {currency}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-400 italic">
                {language === 'ku'
                  ? 'هیچ کارکردێکی ڕۆژانە لە ڕۆژژمێردا بۆ کارمەندانی ئەم اکیپە نەدۆزرایەوە.'
                  : language === 'en'
                  ? 'No attendance records logged for this crew in the calendar yet.'
                  : 'هیچ کارکرد روزمزدی در تقویم برای اعضای این اکیپ در این بازه تاریخی یافت نشد.'}
              </div>
            )}
          </div>

          {/* Backcharges Commitments & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-emerald-500" />
                <span>{language === 'ku' ? 'بەرپرسیاریەتی خەرجییەکانی لاوەکی' : language === 'en' ? 'Site Expenses Responsibility' : 'تعهدات هزینه‌های جانبی کارگاه'}</span>
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span>{language === 'ku' ? 'خواردنی تیم:' : language === 'en' ? 'Food & Catering:' : 'غذا و پذیرایی اکیپ:'}</span>
                  <span className="font-bold">{contract.backchargeCommitments?.food === 'contractor' ? (language === 'ku' ? 'پای پەیمانکار' : language === 'en' ? 'Contractor' : 'پای پیمانکار') : (language === 'ku' ? 'پای کارگە' : language === 'en' ? 'Workshop' : 'پای کارگاه')}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span>{language === 'ku' ? 'شوێنی مانەوە:' : language === 'en' ? 'Lodging & Housing:' : 'اسکان و خوابگاه پرسنل:'}</span>
                  <span className="font-bold">{contract.backchargeCommitments?.lodging === 'contractor' ? (language === 'ku' ? 'پای پەیمانکار' : language === 'en' ? 'Contractor' : 'پای پیمانکار') : (language === 'ku' ? 'پای کارگە' : language === 'en' ? 'Workshop' : 'پای کارگاه')}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1.5">
                  <span>{language === 'ku' ? 'هاتوچۆ و ترابەری:' : language === 'en' ? 'Transportation:' : 'ایاب و ذهاب و ترابری:'}</span>
                  <span className="font-bold">{contract.backchargeCommitments?.transport === 'contractor' ? (language === 'ku' ? 'پای پەیمانکار' : language === 'en' ? 'Contractor' : 'پای پیمانکار') : (language === 'ku' ? 'پای کارگە' : language === 'en' ? 'Workshop' : 'پای کارگاه')}</span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {language === 'ku' ? 'مەرج و تێبینییەکان' : language === 'en' ? 'Terms & Notes' : 'شرایط و توضیحات تکمیلی'}
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                {contract.terms || (language === 'ku' ? 'هیچ مەرجێکی تایبەت تۆمار نەکراوە.' : language === 'en' ? 'No specific terms recorded.' : 'شرایط اختصاصی خاصی ثبت نشده است.')}
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Sticky Bottom Footer Actions Dock */}
      <footer className="px-4 sm:px-6 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-20 shadow-xs no-print">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
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
                className="px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>{language === 'ku' ? 'دەستکاری' : language === 'en' ? 'Edit' : 'ویرایش'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isActive && (
              <>
                {/* 1. Add Addendum / Increase Scope Button */}
                <button
                  type="button"
                  onClick={() => setIsAmendmentModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs"
                >
                  <FilePlus2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>{language === 'ku' ? 'تۆمارکردنی پاشکۆ / زیادکردنی کار' : language === 'en' ? 'Add Addendum / Scope' : 'ثبت الحاقیه / افزایش حجم'}</span>
                </button>

                {/* 2. Interim Progress Settlement Button */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettlement(contract);
                  }}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <FileText className="w-4 h-4" />
                  <span>{language === 'ku' ? 'صورت‌وەزعییەتی قۆناغی (موقت)' : language === 'en' ? 'Interim Settlement' : 'ثبت صورت‌وضعیت مرحله‌ای'}</span>
                </button>

                {/* 3. Final Settlement Button */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettlement(contract);
                  }}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{language === 'ku' ? 'پایانی کار و تسویەی کۆتایی' : language === 'en' ? 'Final Settlement' : 'پایان کار و صورت‌وضعیت قطعی'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Add Contract Amendment Modal */}
      {isAmendmentModalOpen && (
        <AddContractAmendmentModal
          isOpen={isAmendmentModalOpen}
          onClose={() => setIsAmendmentModalOpen(false)}
          contract={contract}
          onSuccess={(result) => {
            // Live Dexie query will automatically update contract details
          }}
        />
      )}

      {/* Contract Settlement Payment Modal */}
      {payingSettlement && (
        <ContractSettlementPaymentModal
          isOpen={Boolean(payingSettlement)}
          onClose={() => setPayingSettlement(null)}
          contract={contract}
          settlement={payingSettlement}
          onPaymentSuccess={() => {
            setPayingSettlement(null);
          }}
        />
      )}
    </div>
  );
}
