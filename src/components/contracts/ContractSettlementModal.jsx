import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  calculateDelayDays,
  calculateContractSettlement,
  getContractSettlementProgress,
  finalizeAndSubmitContractSettlement,
  getContractCrewAttendanceSummary,
  BACKCHARGE_CATEGORIES
} from '../../services/contractService';
import { formatAmount, numberToWords, getTodayDateString } from '../../utils/formatters';
import {
  X,
  FileCheck2,
  Calendar,
  Clock,
  AlertTriangle,
  Receipt,
  Utensils,
  Home,
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  DollarSign,
  ChevronDown,
  Layers,
  Sparkles,
  Users,
  ChevronUp,
  CalendarDays,
  Info
} from 'lucide-react';

export default function ContractSettlementModal({
  isOpen,
  onClose,
  contract,
  onSettlementSuccess
}) {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';

  const [settlementType, setSettlementType] = useState('interim'); // 'interim' | 'final'
  const [actualEndDate, setActualEndDate] = useState(getTodayDateString());
  const [stageNotes, setStageNotes] = useState('');
  const [completedItems, setCompletedItems] = useState([]);
  const [selectedAdvanceIds, setSelectedAdvanceIds] = useState(new Set());
  const [selectedBackchargeIds, setSelectedBackchargeIds] = useState(new Set());
  const [customBackcharges, setCustomBackcharges] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Mode for applying crew day-labor: 'man_day_item' | 'extra_gross_wage' | 'none'
  const [crewAttendanceMode, setCrewAttendanceMode] = useState('man_day_item');
  const [showCrewBreakdown, setShowCrewBreakdown] = useState(false);

  // Settlement progress summary across all prior interim settlements
  const contractProgress = useMemo(() => {
    return getContractSettlementProgress(contract);
  }, [contract]);

  const stageNumber = (contract?.settlements?.length || 0) + 1;

  // Live query for crew daily attendance logs for this contract/counterparty
  const crewAttendance = useLiveQuery(
    async () => {
      if (!contract) return null;
      return await getContractCrewAttendanceSummary({
        contract,
        startDate: contract.startDate,
        endDate: actualEndDate || getTodayDateString()
      });
    },
    [contract?.id, contract?.counterpartyId, contract?.linkedGroupId, contract?.startDate, actualEndDate]
  );

  // 1. Fetch historical advances/payments for this counterparty
  const rawPreviousPayments = useLiveQuery(
    async () => {
      if (!contract?.counterpartyId || !db.payments) return [];
      const list = await db.payments.toArray();
      return list.filter((p) => {
        if (p.deletedAt) return false;
        const matchesCp = String(p.counterpartyId || p.workerId) === String(contract.counterpartyId);
        return matchesCp;
      });
    },
    [contract?.counterpartyId]
  ) || [];

  // Filter out advances that were ALREADY deducted in prior settlements
  const previousPayments = useMemo(() => {
    const deductedIds = contractProgress?.previouslyDeductedAdvanceIds || new Set();
    return rawPreviousPayments.filter(p => !deductedIds.has(String(p.id)));
  }, [rawPreviousPayments, contractProgress]);

  // 2. Fetch site expenses tagged to this contractor or contract
  const rawBackchargeExpenses = useLiveQuery(
    async () => {
      if (!contract?.id || !db.expenses) return [];
      const list = await db.expenses.toArray();
      return list.filter((e) => {
        if (e.deletedAt) return false;
        const matchesContract = String(e.contractId) === String(contract.id);
        const matchesBackcharge = e.isContractorBackcharge && String(e.personId) === String(contract.counterpartyId);
        return matchesContract || matchesBackcharge;
      });
    },
    [contract?.id, contract?.counterpartyId]
  ) || [];

  // Filter out backcharges that were ALREADY deducted in prior settlements
  const backchargeExpenses = useMemo(() => {
    const deductedIds = contractProgress?.previouslyDeductedBackchargeIds || new Set();
    return rawBackchargeExpenses.filter(b => !deductedIds.has(String(b.id)));
  }, [rawBackchargeExpenses, contractProgress]);

  // Initialize completed items & selections
  useEffect(() => {
    if (contract && isOpen) {
      setActualEndDate(getTodayDateString());
      setErrorMessage('');
      setStageNotes('');
      setSettlementType(contract.status === 'completed' ? 'final' : 'interim');

      const itemSettledMap = contractProgress?.itemSettledMap || new Map();

      // Pre-fill items with remaining quantity for this stage
      const items = Array.isArray(contract.items)
        ? contract.items.map(it => {
            const key = it.id || it.title;
            const settledBefore = itemSettledMap.get(key) || 0;
            const contracted = Number(it.estimatedQuantity) || 0;
            const remaining = Math.max(0, contracted - settledBefore);
            return {
              ...it,
              settledQuantityBefore: settledBefore,
              incrementalQuantity: String(remaining),
              finalQuantity: String(contracted)
            };
          })
        : [];
      setCompletedItems(items);

      // By default, select available advances for this stage
      const advIds = new Set(previousPayments.map(p => p.id));
      setSelectedAdvanceIds(advIds);

      // By default, select available backcharge expenses
      const bkgIds = new Set(backchargeExpenses.map(b => b.id));
      setSelectedBackchargeIds(bkgIds);

      setCustomBackcharges([]);
    }
  }, [contract, isOpen, previousPayments.length, backchargeExpenses.length, contractProgress]);

  // When crewAttendance changes, auto-populate man_day items according to their targetRole
  useEffect(() => {
    if (crewAttendance && (crewAttendance.totalDays > 0 || crewAttendance.crewWorkers?.length > 0)) {
      if (crewAttendance.matchingManDayIndex !== -1) {
        setCrewAttendanceMode('man_day_item');
        setCompletedItems(prev => {
          return prev.map(it => {
            if (it.unit !== 'man_day') return it;
            const role = it.targetRole || (
              it.title?.includes('استادکار') || it.title?.includes('وەستا') ? 'master' :
              it.title?.includes('کارگر') || it.title?.includes('کرێکار') ? 'worker' : 'all'
            );
            let targetDays = crewAttendance.totalDays;
            if (role === 'master') targetDays = crewAttendance.masterDays;
            else if (role === 'worker') targetDays = crewAttendance.workerDays;
            const prevSettled = it.settledQuantityBefore || 0;
            return {
              ...it,
              incrementalQuantity: String(targetDays),
              finalQuantity: String(prevSettled + targetDays)
            };
          });
        });
      } else if (crewAttendance.totalGrossWage > 0) {
        setCrewAttendanceMode('extra_gross_wage');
      }
    }
  }, [crewAttendance?.totalDays, crewAttendance?.masterDays, crewAttendance?.workerDays, crewAttendance?.matchingManDayIndex]);

  // Handle item incremental quantity change
  const handleItemIncrementalChange = (index, value) => {
    setCompletedItems(prev => {
      const updated = [...prev];
      const it = updated[index];
      const prevQty = Number(it.settledQuantityBefore) || 0;
      const numVal = Number(value.replace(/,/g, '')) || 0;
      updated[index] = {
        ...it,
        incrementalQuantity: value,
        finalQuantity: String(prevQty + numVal)
      };
      return updated;
    });
  };

  // Toggle advance selection
  const toggleAdvanceSelection = (id) => {
    setSelectedAdvanceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle backcharge expense selection
  const toggleBackchargeSelection = (id) => {
    setSelectedBackchargeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Add custom backcharge deduction
  const handleAddCustomBackcharge = () => {
    setCustomBackcharges(prev => [
      ...prev,
      {
        id: `bkg_${Date.now()}`,
        category: 'food',
        title: '',
        amount: ''
      }
    ]);
  };

  const handleUpdateCustomBackcharge = (index, field, value) => {
    setCustomBackcharges(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveCustomBackcharge = (index) => {
    setCustomBackcharges(prev => prev.filter((_, i) => i !== index));
  };

  // 3. Live Settlement Calculations
  const settlement = useMemo(() => {
    if (!contract) return null;

    const selectedAdvancesList = previousPayments.filter(p => selectedAdvanceIds.has(p.id));
    const selectedBackchargesList = backchargeExpenses.filter(b => selectedBackchargeIds.has(b.id));

    const extraDeductionsList = customBackcharges
      .map(c => ({
        title: c.title || c.category,
        amount: Number(String(c.amount).replace(/,/g, '')) || 0
      }))
      .filter(c => c.amount > 0);

    return calculateContractSettlement({
      contract,
      completedItems,
      actualEndDate,
      selectedAdvances: selectedAdvancesList,
      selectedBackcharges: selectedBackchargesList,
      extraDeductions: extraDeductionsList,
      crewAttendanceSummary: crewAttendance,
      crewAttendanceMode,
      settlementType,
      applyDelayPenalty: settlementType === 'final'
    });
  }, [contract, completedItems, actualEndDate, previousPayments, selectedAdvanceIds, backchargeExpenses, selectedBackchargeIds, customBackcharges, crewAttendance, crewAttendanceMode, settlementType]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !contract) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!settlement) return;

    setIsSubmitting(true);
    try {
      const result = await finalizeAndSubmitContractSettlement({
        contractId: contract.id,
        actualEndDate,
        settlementCalculation: settlement,
        settlementType,
        stageNotes: stageNotes.trim(),
        userId: user?.id,
        currency
      });

      if (onSettlementSuccess) {
        onSettlementSuccess(result);
      }
      onClose();
    } catch (err) {
      console.error('Error finalizing settlement:', err);
      setErrorMessage(err.message || 'Error finalizing settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs border ${
              settlementType === 'interim'
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'bg-teal-500/15 border-teal-500/30 text-teal-600 dark:text-teal-400'
            }`}>
              {settlementType === 'interim' ? <FileText className="w-5 h-5" /> : <FileCheck2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {settlementType === 'interim'
                    ? (language === 'ku' ? `صورت‌وەزعییەتی قۆناغی (مەرحەلەی #${stageNumber})` : language === 'en' ? `Interim Settlement (Stage #${stageNumber})` : `صورت‌وضعیت موقت / مرحله‌ای (مرحله ${stageNumber})`)
                    : (language === 'ku' ? 'ژمێریاری کۆتایی و پەسەندکردنی کار' : language === 'en' ? 'Final Settlement & Measurement' : 'صورت‌وضعیت قطعی و تسویه پایان کار')
                  }
                </h3>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {contract.contractNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {contract.title} • {contract.counterpartyName || (language === 'ku' ? 'پەیمانکار' : language === 'en' ? 'Contractor' : 'پیمانکار')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Selector Segmented Control */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setSettlementType('interim')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                settlementType === 'interim'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{language === 'ku' ? `صورت‌وەزعییەتی قۆناغی (مەرحەلەی #${stageNumber})` : language === 'en' ? `Interim Stage Settlement (#${stageNumber})` : `صورت‌وضعیت موقت / مرحله‌ای (مرحله ${stageNumber})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setSettlementType('final')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                settlementType === 'final'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{language === 'ku' ? 'تەواوکردنی کار و پاکتاوی کۆتایی' : language === 'en' ? 'Final Settlement & Closing' : 'پایان کار و صورت‌وضعیت قطعی'}</span>
            </button>
          </div>

          {/* Interim Notice Banner */}
          {settlementType === 'interim' ? (
            <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300 text-xs flex items-center gap-2.5">
              <Info className="w-4 h-4 shrink-0 text-sky-500" />
              <span>
                {language === 'ku'
                  ? 'ئەم صورت‌وەزعییەتە بەبێ داخستنی گرێبەست تۆمار دەکرێت؛ بەهای کارکردی ئەم قۆناغە بەڵگەنامەی بۆ دەردەچێت و گرێبەستەکە بۆ قۆناغەکانی داهاتوو بە چالاکی دەمێنێتەوە.'
                  : language === 'en'
                  ? 'This interim settlement is issued without closing the contract. Incremental work is paid and the contract remains active for subsequent stages.'
                  : 'این صورت‌وضعیت به صورت مرحله‌ای و بدون بستن قرارداد صادر می‌شود؛ مبلغ کارکرد این مرحله پرداخت شده و قرارداد برای مراحل بعدی در وضعیت «در حال اجرا» باقی می‌ماند.'}
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />
              <span>
                {language === 'ku'
                  ? 'بە پەسەندکردنی ئەم فۆڕمە، گرێبەستەکە بە تەواوەتی دادەخرێت و کۆتایی پێدێت.'
                  : language === 'en'
                  ? 'Finalizing this settlement will officially complete and close the contract.'
                  : 'با تایید این صورت‌وضعیت، پرونده قرارداد با صدور سند قطعی پایان یافته و وضعیت آن به «تسویه‌شده» تغییر می‌یابد.'}
              </span>
            </div>
          )}

          {/* Timeline & Cutoff Date Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {settlementType === 'interim'
                      ? (language === 'ku' ? 'بەرواری کارکردی ئەم قۆناغە (تا بەرواری)' : language === 'en' ? 'Progress Cutoff Date' : 'تاریخ کارکرد / صورت‌وضعیت تا تاریخ:')
                      : (language === 'ku' ? 'بەرواری تەواوبوونی کرداری کار' : language === 'en' ? 'Actual Completion Date' : 'تاریخ واقعی اتمام و تحویل کار')
                    }
                  </span>
                  <div className="text-[11px] text-slate-400">
                    {language === 'ku' ? 'مۆڵەتی سەرەتا:' : language === 'en' ? 'Agreed Deadline:' : 'مهلت در قرارداد:'} {contract.estimatedEndDate || (language === 'ku' ? 'دیاری نەکراو' : language === 'en' ? 'Not set' : 'ثبت نشده')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="date"
                  value={actualEndDate}
                  onChange={(e) => setActualEndDate(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                />

                {settlementType === 'final' && (
                  settlement?.delayDays > 0 ? (
                    <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{settlement.delayDays} {language === 'ku' ? 'ڕۆژ دواکەوتن' : language === 'en' ? 'Days Delayed' : 'روز تاخیر در تحویل'}</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'ku' ? 'بێ دواکەوتن (لە کاتی خۆیدا)' : language === 'en' ? 'On Time (No delay)' : 'تکمیل به موقع (بدون تاخیر)'}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Delay Penalty Breakdown if final settlement */}
            {settlementType === 'final' && settlement?.totalDelayPenalty > 0 && (
              <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/15 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {language === 'ku'
                    ? `سزای ${settlement.delayDays} ڕۆژ دواکەوتن (ڕۆژانە ${formatAmount(contract.delayPenaltyPerDay, currency)} ${currency}):`
                    : language === 'en'
                    ? `Penalty for ${settlement.delayDays} days delay (${formatAmount(contract.delayPenaltyPerDay, currency)}/day):`
                    : `جریمه ${settlement.delayDays} روز تاخیر بر مبنای روزانه ${formatAmount(contract.delayPenaltyPerDay, currency)} ${currency}:`}
                </span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400" dir="ltr">
                  - {formatAmount(settlement.totalDelayPenalty, currency)} {currency}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT 7 COLS: Actual Measurement Table */}
            <div className="lg:col-span-7 space-y-4">
              
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>{language === 'ku' ? 'مەترەکردنی کارکرد و قەبارەی ئەم قۆناغە' : language === 'en' ? 'Work Measurement & Incremental Progress' : 'متره‌کشی و ثبت کارکرد این مرحله'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {completedItems.length} {language === 'ku' ? 'بڕگە' : language === 'en' ? 'items' : 'ردیف کاری'}
                  </span>
                </div>

                <div className="space-y-3">
                  {completedItems.map((item, index) => {
                    const incrementalQty = Number(String(item.incrementalQuantity).replace(/,/g, '')) || 0;
                    const prevSettled = Number(item.settledQuantityBefore) || 0;
                    const cumulative = prevSettled + incrementalQty;
                    const contracted = Number(item.estimatedQuantity) || 0;
                    const unitPrice = Number(item.unitPrice) || 0;
                    const lineTotal = incrementalQty * unitPrice;

                    return (
                      <div
                        key={item.id || index}
                        className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            #{index + 1} {item.title}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {item.unit} • {item.materialProvision === 'contractor' ? (language === 'ku' ? 'با کەرەستە' : language === 'en' ? 'With materials' : 'با مصالح پیمانکار') : (language === 'ku' ? 'دەستمەزد' : language === 'en' ? 'Labor only' : 'با مصالح کارگاه')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                          {/* Unit Price & Previous Settled */}
                          <div className="sm:col-span-4 text-xs font-mono space-y-0.5">
                            <div className="text-slate-600 dark:text-slate-300 font-bold">
                              {language === 'ku' ? 'نرخ:' : language === 'en' ? 'Rate:' : 'نرخ واحد:'} <span>{formatAmount(unitPrice, currency)}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {language === 'ku' ? 'پێشوو:' : language === 'en' ? 'Settled:' : 'تسویه‌شده قبلی:'} <span className="font-bold text-slate-700 dark:text-slate-300">{prevSettled}</span> / {contracted}
                            </div>
                          </div>

                          {/* Incremental Quantity Input */}
                          <div className="sm:col-span-4 space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold block">
                              {settlementType === 'interim'
                                ? (language === 'ku' ? 'کارکردی ئەم قۆناغە:' : language === 'en' ? 'This Stage Qty:' : 'کارکرد این مرحله:')
                                : (language === 'ku' ? 'کارکردی باقیمانده:' : language === 'en' ? 'Remaining Qty:' : 'کارکرد باقیمانده/نهایی:')
                              }
                            </span>
                            <input
                              type="text"
                              value={item.incrementalQuantity !== undefined ? item.incrementalQuantity : ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '');
                                if (/^\d*\.?\d*$/.test(raw)) handleItemIncrementalChange(index, raw);
                              }}
                              placeholder="0"
                              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-center"
                            />
                            <div className="text-[10px] text-slate-400 font-mono text-center">
                              {language === 'ku' ? 'کۆی گشتی:' : language === 'en' ? 'Cumulative:' : 'مجموع تجمعی:'}{' '}
                              <span className="font-bold text-primary">{cumulative}</span>
                            </div>
                          </div>

                          {/* Line Total for this stage */}
                          <div className="sm:col-span-4 flex flex-col items-end justify-center font-mono" dir="ltr">
                            <span className="text-[10px] text-slate-400">
                              {language === 'ku' ? 'بەهای ئەم قۆناغە:' : language === 'en' ? 'Stage Value:' : 'ارزش این مرحله:'}
                            </span>
                            <span className="font-black text-xs text-primary">
                              {formatAmount(lineTotal, currency)} {currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Crew Daily Attendance Integration Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <span>{language === 'ku' ? 'پشکنین و کارکردی ڕۆژانەی تیمی وەستاکار' : language === 'en' ? 'Crew Daily Attendance (Calendar)' : 'کارکرد روزمزدی اکیپ در تقویم کارگاه'}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
                    {crewAttendance?.totalDays || 0} {language === 'ku' ? 'ڕۆژ-کرێکار' : language === 'en' ? 'man-days' : 'نفر-روز'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {language === 'ku'
                    ? 'کۆی شیفت و کارکردی تۆمارکراو لە ڕۆژژمێری ئامادەبوون بۆ کارمەندانی ئەم اکیپە لە ماوەی ئەم گرێبەستەدا.'
                    : language === 'en'
                    ? 'Total shifts and daily attendance logged in the workshop calendar for this crew during the contract period.'
                    : 'مجموع شیفت‌ها و ساعات ثبت‌شده در تقویم حضور و غیاب برای اکیپ این استادکار در طول مدت این قرارداد.'}
                </p>

                {crewAttendance && (crewAttendance.totalDays > 0 || crewAttendance.crewWorkers?.length > 0) ? (
                  <div className="space-y-3 pt-1">
                    {/* Metric Pills with Master and Worker Separation */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                        <span className="block text-[10px] text-slate-400 font-medium">
                          {language === 'ku' ? 'کۆی گشتی' : language === 'en' ? 'Total Days' : 'کل نفر-روز'}
                        </span>
                        <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                          {crewAttendance.totalDays}
                        </span>
                      </div>
                      <div className="p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                        <span className="block text-[10px] text-indigo-500 font-bold">
                          {language === 'ku' ? 'وەستاکار' : language === 'en' ? 'Master' : 'استادکار'}
                        </span>
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                          {crewAttendance.masterDays}
                        </span>
                      </div>
                      <div className="p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <span className="block text-[10px] text-emerald-500 font-bold">
                          {language === 'ku' ? 'کرێکار' : language === 'en' ? 'Worker' : 'کارگر'}
                        </span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {crewAttendance.workerDays}
                        </span>
                      </div>
                      <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-center">
                        <span className="block text-[10px] text-slate-400 font-medium">
                          {language === 'ku' ? 'ارزشی دەستحەق' : language === 'en' ? 'Gross Wages' : 'ارزش دستمزد'}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono" dir="ltr">
                          {formatAmount(crewAttendance.totalGrossWage, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Application Mode Segmented Control */}
                    <div className="space-y-1.5 pt-1">
                      <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {language === 'ku' ? 'شێوازی دانانی کارکرد لەم فاکتوورەدا:' : language === 'en' ? 'Method of Applying to Settlement:' : 'نحوه اعمال در این صورت‌وضعیت:'}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                        <button
                          type="button"
                          onClick={() => {
                            setCrewAttendanceMode('man_day_item');
                            setCompletedItems(prev => {
                              return prev.map(it => {
                                if (it.unit !== 'man_day') return it;
                                const role = it.targetRole || (
                                  it.title?.includes('استادکار') || it.title?.includes('وەستا') ? 'master' :
                                  it.title?.includes('کارگر') || it.title?.includes('کرێکار') ? 'worker' : 'all'
                                );
                                let targetDays = crewAttendance.totalDays;
                                if (role === 'master') targetDays = crewAttendance.masterDays;
                                else if (role === 'worker') targetDays = crewAttendance.workerDays;
                                const prevSettled = it.settledQuantityBefore || 0;
                                return {
                                  ...it,
                                  incrementalQuantity: String(targetDays),
                                  finalQuantity: String(prevSettled + targetDays)
                                };
                              });
                            });
                          }}
                          className={'py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center ' + (
                            crewAttendanceMode === 'man_day_item'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          )}
                        >
                          {language === 'ku' ? 'دانان لە ڕیزی ڕۆژ-کرێکار' : language === 'en' ? 'In Man-Day Item' : 'ردیف نفر-روز قرارداد'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCrewAttendanceMode('extra_gross_wage')}
                          className={'py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center ' + (
                            crewAttendanceMode === 'extra_gross_wage'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          )}
                        >
                          {language === 'ku' ? 'زیادکردنی دەستحەق' : language === 'en' ? 'Add as Gross Wage' : 'افزودن دستمزد ناخالص'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCrewAttendanceMode('none')}
                          className={'py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center ' + (
                            crewAttendanceMode === 'none'
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                          )}
                        >
                          {language === 'ku' ? 'جێبەجێ نەکرێت' : language === 'en' ? 'Do not apply' : 'عدم اعمال'}
                        </button>
                      </div>
                    </div>

                    {/* Toggle Accordion for Worker Breakdown */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCrewBreakdown(prev => !prev)}
                        className="w-full flex items-center justify-between py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                          <span>
                            {language === 'ku'
                              ? `وردەکاری کارکردی کارمەندان (${crewAttendance.workerBreakdown?.length || 0} کەس)`
                              : language === 'en'
                              ? `View Crew Breakdown (${crewAttendance.workerBreakdown?.length || 0} workers)`
                              : `مشاهده ریز کارکرد کارگران اکیپ (${crewAttendance.workerBreakdown?.length || 0} نفر)`}
                          </span>
                        </span>
                        <ChevronDown className={'w-3.5 h-3.5 transition-transform duration-200 ' + (showCrewBreakdown ? 'rotate-180' : '')} />
                      </button>

                      {showCrewBreakdown && (
                        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1 animate-in fade-in duration-150">
                          {crewAttendance.workerBreakdown?.map(b => (
                            <div
                              key={b.worker.id}
                              className="p-2 rounded-xl bg-white/60 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]"
                            >
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{b.worker.name}</span>
                                <span className="text-[10px] text-slate-400 ms-1.5">({b.worker.role || (language === 'ku' ? 'کرێکار' : language === 'en' ? 'Worker' : 'کارگر')})</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-slate-600 dark:text-slate-300">{b.daysCount} {language === 'ku' ? 'ڕۆژ' : language === 'en' ? 'days' : 'روز'}</span>
                                <span className="text-amber-600 dark:text-amber-400 font-bold" dir="ltr">
                                  {formatAmount(b.grossWage, currency)} {currency}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-400 italic">
                    {language === 'ku'
                      ? 'هیچ کارکردێکی ڕۆژانە لە ڕۆژژمێردا بۆ کارمەندانی ئەم اکیپە تۆمار نەکراوە.'
                      : language === 'en'
                      ? 'No crew daily attendance records found in calendar for this contractor period.'
                      : 'هیچ کارکرد روزمزدی در تقویم برای اعضای این اکیپ در این بازه تاریخی یافت نشد.'}
                  </div>
                )}
              </div>

              {/* Advances & Prepayments Deductions Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white">
                  <span className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-500" />
                    <span>{language === 'ku' ? 'بڕینی پێشەکی و پارەدانەکانی پێشوو' : language === 'en' ? 'Previous Advances & Payments' : 'کسورات پیش‌پرداخت‌ها و علی‌الحساب قبلی'}</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {selectedAdvanceIds.size} / {previousPayments.length}
                  </span>
                </div>

                {previousPayments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    {language === 'ku' ? 'هیچ پێشەکییەکی تسویەنەکراو تۆمار نەکراوە بۆ ئەم لایەنە' : language === 'en' ? 'No unsettled advances recorded for this contractor' : 'هیچ پرداختی یا مساعده تسویه‌نشده‌ای برای این طرف‌حساب یافت نشد.'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {previousPayments.map(p => {
                      const isSelected = selectedAdvanceIds.has(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleAdvanceSelection(p.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/5'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {p.description || p.type || (language === 'ku' ? 'پێشەکی' : language === 'en' ? 'Advance' : 'مساعده / پیش‌پرداخت')}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {p.date || p.createdAt?.slice(0, 10)} {p.receiptNumber ? `• فیش: ${p.receiptNumber}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                            - {formatAmount(p.amount, currency)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT 5 COLS: Backcharges & Final Statement Card */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Contractor Site Backcharges (Food, Lodging, Transport) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                    <Utensils className="w-4 h-4 text-emerald-500" />
                    <span>{language === 'ku' ? 'خەرجییە لاوەکییەکان (خواردن/مانەوە)' : language === 'en' ? 'Backcharges (Food/Lodging)' : 'هزینه‌های جانبی کارگاه پای پیمانکار'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCustomBackcharge}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{language === 'ku' ? 'زیادکردنی خەرجی' : language === 'en' ? 'Add Item' : 'افزودن کسور'}</span>
                  </button>
                </div>

                {/* Tagged Site Expenses */}
                {backchargeExpenses.length > 0 && (
                  <div className="space-y-1.5 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {language === 'ku' ? 'خەرجییە تۆمارکراوەکان لە سیستەم:' : language === 'en' ? 'Recorded Expenses Tagged to Contractor:' : 'هزینه‌های ثبت‌شده در کارگاه به نام این پیمانکار:'}
                    </span>
                    {backchargeExpenses.map(b => {
                      const isSelected = selectedBackchargeIds.has(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => toggleBackchargeSelection(b.id)}
                          className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-500"
                            />
                            <span className="font-medium text-slate-700 dark:text-slate-300">{b.title || b.description}</span>
                          </div>
                          <span className="font-mono font-bold text-rose-500" dir="ltr">
                            - {formatAmount(b.amount, currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Custom Dynamic Backcharge Rows */}
                <div className="space-y-2">
                  {customBackcharges.map((c, index) => (
                    <div key={c.id || index} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <select
                          value={c.category}
                          onChange={(e) => handleUpdateCustomBackcharge(index, 'category', e.target.value)}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300"
                        >
                          {BACKCHARGE_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat[language] || cat.fa}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomBackcharge(index)}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={c.title}
                          onChange={(e) => handleUpdateCustomBackcharge(index, 'title', e.target.value)}
                          placeholder={language === 'ku' ? 'شیکردنەوە' : language === 'en' ? 'Description' : 'شرح کسور (مثلا غذای ۱۵ روز)'}
                          className="col-span-7 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                        />
                        <input
                          type="text"
                          value={c.amount ? Number(c.amount).toLocaleString('en-US') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            if (/^\d*$/.test(raw)) handleUpdateCustomBackcharge(index, 'amount', raw);
                          }}
                          placeholder={language === 'ku' ? 'بڕ' : language === 'en' ? 'Amount' : 'مبلغ'}
                          className="col-span-5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-rose-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stage Notes / Justification Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>{language === 'ku' ? 'تێبینی و ڕوونکردنەوەی ئەم قۆناغە:' : language === 'en' ? 'Stage Notes & Justification:' : 'توضیحات و دستورکار این مرحله:'}</span>
                </span>
                <textarea
                  rows={2}
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  placeholder={language === 'ku' ? 'تێبینی یان مەرجی تایبەتی ئەم قۆناغە...' : language === 'en' ? 'Enter notes for this stage...' : 'توضیحات مربوط به متراژ، دستورکارهای انجام شده در این مرحله...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Live Statement Summary Card */}
              {settlement && (
                <div className="p-5 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-md space-y-3.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>
                      {settlementType === 'interim'
                        ? (language === 'ku' ? `پوختەی صورت‌وەزعییەتی قۆناغی #${stageNumber}` : language === 'en' ? `Interim Stage #${stageNumber} Summary` : `تراز صورت‌وضعیت مرحله ${stageNumber}`)
                        : (language === 'ku' ? 'پوختەی ژمێریاری کۆتایی' : language === 'en' ? 'Final Statement Breakdown' : 'خلاصه تراز صورت‌وضعیت قطعی')}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Gross Work */}
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>{language === 'ku' ? 'کارکردی ناخالصی ئەم قۆناغە:' : language === 'en' ? 'Stage Gross Work:' : 'مجموع کارکرد ناخالص این مرحله:'}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                        + {formatAmount(settlement.grossWorkAmount, currency)}
                      </span>
                    </div>

                    {/* Crew Daily Wage Addition */}
                    {settlement.crewGrossWageAddition > 0 && (
                      <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                        <span>{language === 'ku' ? 'کارکردی ڕۆژانەی تیمی اکیپ:' : language === 'en' ? 'Crew Daily Wages Added:' : 'کارکرد روزمزد اکیپ (تقویم):'}</span>
                        <span className="font-mono font-bold" dir="ltr">
                          + {formatAmount(settlement.crewGrossWageAddition, currency)}
                        </span>
                      </div>
                    )}

                    {/* Delay Penalty (only if applied) */}
                    {settlement.totalDelayPenalty > 0 && (
                      <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                        <span>{language === 'ku' ? 'سزای دواکەوتن:' : language === 'en' ? 'Delay Penalty:' : 'جریمه دیرکرد تحویل:'}</span>
                        <span className="font-mono font-bold" dir="ltr">
                          - {formatAmount(settlement.totalDelayPenalty, currency)}
                        </span>
                      </div>
                    )}

                    {/* Performance Guarantee Retention (حسن انجام کار - معین ۳۴۰۱) */}
                    {settlement.retentionAmount > 0 && (
                      <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                        <span className="flex items-center gap-1">
                          <span>{language === 'ku' ? `بارمتەی باشی ئەنجام (${settlement.retentionRate}٪):` : language === 'en' ? `Performance Retention (${settlement.retentionRate}%):` : `کسر سپرده حسن انجام کار (${settlement.retentionRate}٪):`}</span>
                          <span className="text-[10px] opacity-75 font-mono">[۳۴۰۱]</span>
                        </span>
                        <span className="font-mono font-bold" dir="ltr">
                          - {formatAmount(settlement.retentionAmount, currency)}
                        </span>
                      </div>
                    )}

                    {/* Social Security Insurance Retention (بیمه ماده ۳۸ - معین ۳۴۰۲) */}
                    {settlement.insuranceAmount > 0 && (
                      <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                        <span className="flex items-center gap-1">
                          <span>{language === 'ku' ? `بارمتەی بیمە (${settlement.insuranceRate}٪):` : language === 'en' ? `Insurance Retention (${settlement.insuranceRate}%):` : `کسر سپرده بیمه ماده ۳۸ (${settlement.insuranceRate}٪):`}</span>
                          <span className="text-[10px] opacity-75 font-mono">[۳۴۰۲]</span>
                        </span>
                        <span className="font-mono font-bold" dir="ltr">
                          - {formatAmount(settlement.insuranceAmount, currency)}
                        </span>
                      </div>
                    )}

                    {/* Advances */}
                    {settlement.totalAdvances > 0 && (
                      <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                        <span>{language === 'ku' ? 'پێشەکی و پارەی دراو:' : language === 'en' ? 'Advances Deducted:' : 'کسر پیش‌پرداخت‌ها:'}</span>
                        <span className="font-mono font-bold" dir="ltr">
                          - {formatAmount(settlement.totalAdvances, currency)}
                        </span>
                      </div>
                    )}

                    {/* Backcharges */}
                    {settlement.totalBackcharges > 0 && (
                      <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                        <span>{language === 'ku' ? 'خەرجی پای پەیمانکار:' : language === 'en' ? 'Backcharges Deducted:' : 'کسر هزینه‌های اسکان/غذا:'}</span>
                        <span className="font-mono font-bold" dir="ltr">
                          - {formatAmount(settlement.totalBackcharges, currency)}
                        </span>
                      </div>
                    )}

                    {/* Extra Deductions */}
                    {settlement.totalExtraDeductions > 0 && (
                      <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                        <span>{language === 'ku' ? 'بڕینەکانی تر:' : language === 'en' ? 'Extra Deductions:' : 'سایر کسورات:'}</span>
                        <span className="font-mono font-bold" dir="ltr">
                          - {formatAmount(settlement.totalExtraDeductions, currency)}
                        </span>
                      </div>
                    )}

                    {/* Net Payable Highlight */}
                    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-black text-slate-900 dark:text-white">
                        {settlementType === 'interim'
                          ? (language === 'ku' ? 'شایستەی ئەم قۆناغە (خاڵس):' : language === 'en' ? 'Net Payable (This Stage):' : 'خالص قابل پرداخت این مرحله:')
                          : (language === 'ku' ? 'شایستەی کۆتایی (خاڵس):' : language === 'en' ? 'Net Final Payable:' : 'خالص قابل پرداخت نهایی:')
                        }
                      </span>
                      <span className={`text-base sm:text-lg font-black font-mono ${settlementType === 'interim' ? 'text-primary' : 'text-teal-600 dark:text-teal-400'}`} dir="ltr">
                        {formatAmount(settlement.netPayableAmount, currency)} {currency}
                      </span>
                    </div>

                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 pt-1">
                      {numberToWords(settlement.netPayableAmount, currency, language)}
                    </div>
                  </div>

                  {/* Accounting Bridge Notice */}
                  <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-[11px] leading-relaxed flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
                    <span>
                      {language === 'ku'
                        ? 'بە پەسەندکردنی ئەم فۆڕمە، بەڵگەنامەیەکی ژمێریاری کاتی (Draft Voucher) دروست دەکرێت بۆ دەفتەری ڕۆژنامە و ژمێریاری گشتی تاکو بەڕێوەبەر پێداچوونەوەی بۆ بکات.'
                        : language === 'en'
                        ? 'Submitting this form creates a Draft Voucher in Accounting under Subcontractor Expenses for final approval and disbursement.'
                        : 'با تایید این فرم، یک سند موقت (پیش‌نویس) در دفتر روزنامه و هزینه‌ها برای بررسی و تسویه مدیر مالی ثبت می‌شود.'}
                    </span>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Sticky Dock */}
          <div className="sticky bottom-0 z-20 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {settlementType === 'interim'
                  ? (language === 'ku' ? 'شایستەی ئەم قۆناغە:' : language === 'en' ? 'Stage Net:' : 'خالص این مرحله:')
                  : (language === 'ku' ? 'بڕی خاڵس:' : language === 'en' ? 'Net Payable:' : 'خالص تسویه:')
                }
              </span>
              <span className={`text-base font-black font-mono ${settlementType === 'interim' ? 'text-primary' : 'text-teal-600 dark:text-teal-400'}`} dir="ltr">
                {formatAmount(settlement?.netPayableAmount || 0, currency)} {currency}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === 'ku' ? 'پەشیمانبوونەوە' : language === 'en' ? 'Cancel' : 'انصراف'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold text-white shadow-lg disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                  settlementType === 'interim'
                    ? 'bg-primary hover:bg-primary-hover shadow-primary/25'
                    : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/25'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? (language === 'ku' ? 'تۆمارکردن...' : language === 'en' ? 'Submitting...' : 'در حال صدور سند...')
                    : settlementType === 'interim'
                    ? (language === 'ku' ? `پەسەندکردنی صورت‌وەزعییەتی قۆناغی #${stageNumber}` : language === 'en' ? `Issue Interim Stage #${stageNumber} Voucher` : `ثبت صورت‌وضعیت مرحله ${stageNumber} (موقت)`)
                    : (language === 'ku' ? 'پەسەندکردنی کۆتایی و داخستنی گرێبەست' : language === 'en' ? 'Finalize & Close Contract' : 'ثبت پایان کار و صورت‌وضعیت قطعی')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
