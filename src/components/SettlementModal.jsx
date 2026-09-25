import React, { useState, useEffect, useMemo } from 'react';
import { db, generatePaymentId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { pushPaymentsLive, pushLogsLive } from '../services/realtimeSync';
import { getTodayDateString, getCurrentYearMonth, formatAmount, roundCurrency, getCurrencySymbol, formatHoursAndMinutes } from '../utils/formatters';
import { 
  CheckCircle2, 
  X, 
  User, 
  Users,
  Calendar, 
  Coins, 
  FileText, 
  Hash, 
  Printer, 
  Check, 
  AlertCircle,
  Calculator,
  ArrowDownRight,
  Shield,
  Layers,
  Crown
} from 'lucide-react';

export function SettlementModal({ 
  isOpen, 
  onClose, 
  worker, 
  month = getCurrentYearMonth(),
  workerLogs = [],
  workerPayments = [],
  allWorkers = [],
  allGroups = [],
  allLogs = [],
  allPayments = [],
  initialMode = 'individual',
  initialGroupId = null,
  onSettlementComplete,
  arrearsList = [],
  onSelectWorker
}) {
  const { t, language } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';

  // Determine initial mode based on props or worker's role
  const [settlementMode, setSettlementMode] = useState(() => {
    if (initialMode === 'group') return 'group';
    if (worker?.groupId && worker?.teamRole === 'Master') return 'group';
    return 'individual';
  });

  const [selectedGroupId, setSelectedGroupId] = useState(() => {
    if (initialGroupId) return initialGroupId;
    if (worker?.groupId) return worker.groupId;
    if (allGroups.length > 0) return allGroups[0].id;
    return '';
  });

  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  // -------------------------------------------------------------
  // 1. INDIVIDUAL SETTLEMENT CALCULATIONS (with Double-Barrier Guard)
  // -------------------------------------------------------------
  const workerSettlements = useMemo(() => {
    return (workerPayments || []).filter((p) => 
      !p.deletedAt && (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled')
    );
  }, [workerPayments]);

  const lastSettlementDate = useMemo(() => {
    const sorted = [...workerSettlements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return sorted[0]?.date || sorted[0]?.createdAt?.slice(0, 10) || null;
  }, [workerSettlements]);

  // Double-Barrier Guard: A log is settled if explicitly marked or dated on/before lastSettlementDate
  const isLogSettled = (l) => {
    if (l.isSettled) return true;
    if (l.settlementReceiptId) return true;
    if (lastSettlementDate && l.date && l.date <= lastSettlementDate) return true;
    return false;
  };

  const isPaymentSettled = (p) => {
    if (p.isSettled) return true;
    if (p.settlementReceiptId) return true;
    if (p.type === 'settlement' || p.type === 'Settlement') return true;
    if (lastSettlementDate && p.date && p.date <= lastSettlementDate) return true;
    return false;
  };

  const unsettledLogs = useMemo(() => {
    return (workerLogs || [])
      .filter((l) => !isLogSettled(l))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [workerLogs, lastSettlementDate]);

  const unsettledPayments = useMemo(() => {
    return (workerPayments || [])
      .filter((p) => !isPaymentSettled(p) && (p.type === 'advance' || p.type === 'Advance_Payment'))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [workerPayments, lastSettlementDate]);

  const individualCalculations = useMemo(() => {
    const grossEarnings = roundCurrency(
      unsettledLogs.reduce((sum, l) => sum + (Number(l.totalDayPay) || 0), 0),
      currency
    );

    const advancesDeducted = roundCurrency(
      unsettledPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      currency
    );

    const totalCumulativeDebt = roundCurrency(Math.max(0, grossEarnings - advancesDeducted), currency);

    const effectiveDays = unsettledLogs.reduce(
      (sum, l) => sum + (l.type === 'half' ? 0.5 : l.type === 'hourly' ? 0 : 1),
      0
    );

    const otHours = unsettledLogs.reduce((sum, l) => sum + (Number(l.overtimeHours) || 0), 0);

    return {
      unsettledLogs,
      unsettledPayments,
      grossEarnings,
      advancesDeducted,
      totalCumulativeDebt,
      effectiveDays,
      otHours
    };
  }, [unsettledLogs, unsettledPayments, currency]);

  // -------------------------------------------------------------
  // 2. GROUP SETTLEMENT CALCULATIONS (with Supervisor & All Members)
  // -------------------------------------------------------------
  const activeGroup = useMemo(() => {
    return (allGroups || []).find((g) => g.id === selectedGroupId) || null;
  }, [allGroups, selectedGroupId]);

  const groupMembers = useMemo(() => {
    if (!selectedGroupId) return [];
    return (allWorkers || []).filter((w) => w.groupId === selectedGroupId && !w.deletedAt);
  }, [allWorkers, selectedGroupId]);

  // Automatically find or set the supervisor (Master/استادکار)
  useEffect(() => {
    if (groupMembers.length > 0) {
      const masterWorker = groupMembers.find((w) => w.teamRole === 'Master');
      if (masterWorker) {
        setSelectedSupervisorId(masterWorker.id);
      } else if (!selectedSupervisorId || !groupMembers.some((w) => w.id === selectedSupervisorId)) {
        setSelectedSupervisorId(groupMembers[0].id);
      }
    }
  }, [groupMembers, selectedSupervisorId]);

  const supervisorWorker = useMemo(() => {
    return groupMembers.find((w) => w.id === selectedSupervisorId) || groupMembers[0] || null;
  }, [groupMembers, selectedSupervisorId]);

  // Compute breakdown for every member in the group
  const groupCalculations = useMemo(() => {
    if (!selectedGroupId || groupMembers.length === 0) {
      return {
        memberBreakdowns: [],
        totalGroupGross: 0,
        totalGroupAdvances: 0,
        totalGroupNetDue: 0,
        totalGroupDays: 0,
        totalGroupOtHours: 0,
        allGroupUnsettledLogs: [],
        allGroupUnsettledPayments: []
      };
    }

    const memberBreakdowns = [];
    let totalGroupGross = 0;
    let totalGroupAdvances = 0;
    let totalGroupNetDue = 0;
    let totalGroupDays = 0;
    let totalGroupOtHours = 0;
    const allGroupUnsettledLogs = [];
    const allGroupUnsettledPayments = [];

    groupMembers.forEach((m) => {
      const mLogs = (allLogs || []).filter((l) => String(l.workerId) === String(m.id));
      const mPayments = (allPayments || []).filter((p) => String(p.workerId) === String(m.id) && !p.deletedAt);

      // Find this member's latest settlement date
      const mSettlements = mPayments.filter((p) => 
        p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled'
      );
      const mSortedSettlements = [...mSettlements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const mLastSettlementDate = mSortedSettlements[0]?.date || mSortedSettlements[0]?.createdAt?.slice(0, 10) || null;

      const isMemberLogSettled = (l) => {
        if (l.isSettled) return true;
        if (l.settlementReceiptId) return true;
        if (mLastSettlementDate && l.date && l.date <= mLastSettlementDate) return true;
        return false;
      };

      const isMemberPaymentSettled = (p) => {
        if (p.isSettled) return true;
        if (p.settlementReceiptId) return true;
        if (p.type === 'settlement' || p.type === 'Settlement') return true;
        if (mLastSettlementDate && p.date && p.date <= mLastSettlementDate) return true;
        return false;
      };

      const mUnsettledLogs = mLogs.filter((l) => !isMemberLogSettled(l));
      const mUnsettledPayments = mPayments.filter((p) => !isMemberPaymentSettled(p) && (p.type === 'advance' || p.type === 'Advance_Payment'));

      let mFullDays = 0;
      let mHalfDays = 0;
      let mOtHours = 0;
      let mGross = 0;

      const wDaily = Number(String(m.dailyRate).replace(/,/g, '')) || 0;
      const wOtRate = Number(String(m.overtimeHourlyRate).replace(/,/g, '')) || 0;

      mUnsettledLogs.forEach((l) => {
        if (l.type === 'full') mFullDays++;
        else if (l.type === 'half') mHalfDays++;

        const otH = Math.max(0, Number(l.overtimeHours) || 0);
        mOtHours += otH;

        let dayPay = Number(l.totalDayPay);
        if (isNaN(dayPay) || dayPay <= 0) {
          if (l.type === 'half') dayPay = (wDaily * 0.5) + (otH * wOtRate);
          else if (l.type === 'hourly') dayPay = otH * (wOtRate || (wDaily / 8));
          else dayPay = wDaily + (otH * wOtRate);
        }
        mGross += dayPay;
      });

      const mEffectiveDays = mFullDays + mHalfDays * 0.5;
      const mGrossRounded = roundCurrency(mGross, currency);

      const mAdvances = roundCurrency(
        mUnsettledPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
        currency
      );

      const mNetDue = roundCurrency(Math.max(0, mGrossRounded - mAdvances), currency);

      memberBreakdowns.push({
        worker: m,
        isMaster: m.teamRole === 'Master',
        unsettledLogs: mUnsettledLogs,
        unsettledPayments: mUnsettledPayments,
        effectiveDays: mEffectiveDays,
        otHours: mOtHours,
        gross: mGrossRounded,
        advances: mAdvances,
        netDue: mNetDue
      });

      totalGroupGross += mGrossRounded;
      totalGroupAdvances += mAdvances;
      totalGroupNetDue += mNetDue;
      totalGroupDays += mEffectiveDays;
      totalGroupOtHours += mOtHours;
      allGroupUnsettledLogs.push(...mUnsettledLogs);
      allGroupUnsettledPayments.push(...mUnsettledPayments);
    });

    // Sort breakdowns: Master first, then by netDue descending
    memberBreakdowns.sort((a, b) => {
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;
      return b.netDue - a.netDue;
    });

    return {
      memberBreakdowns,
      totalGroupGross: roundCurrency(totalGroupGross, currency),
      totalGroupAdvances: roundCurrency(totalGroupAdvances, currency),
      totalGroupNetDue: roundCurrency(totalGroupNetDue, currency),
      totalGroupDays,
      totalGroupOtHours,
      allGroupUnsettledLogs,
      allGroupUnsettledPayments
    };
  }, [selectedGroupId, groupMembers, allLogs, allPayments, currency]);

  // Active calculations based on chosen mode
  const activeCalculations = settlementMode === 'group' ? groupCalculations : individualCalculations;
  const targetPayableAmount = settlementMode === 'group' ? groupCalculations.totalGroupNetDue : individualCalculations.totalCumulativeDebt;

  // Form State
  const [finalPaymentAmount, setFinalPaymentAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState(getTodayDateString());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [markAsSettled, setMarkAsSettled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [completedPayment, setCompletedPayment] = useState(null);

  // Sync form defaults whenever mode or calculations change
  useEffect(() => {
    if (isOpen) {
      setFinalPaymentAmount(targetPayableAmount > 0 ? String(targetPayableAmount) : '0');
      setSettlementDate(getTodayDateString());
      setReferenceNumber('');

      if (settlementMode === 'group') {
        const groupName = activeGroup?.name || 'گروه';
        const supName = supervisorWorker?.name || 'سرپرست';
        setNotes(`تسویه حساب گروه ${groupName} با سرپرست (${supName}) - شامل ${groupMembers.length} نفر`);
      } else {
        const defaultNote = language === 'en' 
          ? `Payroll settlement (${individualCalculations.unsettledLogs.length} unsettled days)` 
          : language === 'ku' 
            ? `تەسویەی حیساب (${individualCalculations.unsettledLogs.length} ڕۆژی کارکرد)` 
            : `تسویه حساب کارکرد (${individualCalculations.unsettledLogs.length} روز کارکرد باز)`;
        setNotes(defaultNote);
      }

      setMarkAsSettled(true);
      setFeedback({ type: '', message: '' });
      setCompletedPayment(null);
    }
  }, [isOpen, settlementMode, targetPayableAmount, selectedGroupId, selectedSupervisorId, activeGroup, supervisorWorker, groupMembers.length, individualCalculations.unsettledLogs.length, language]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // SUBMISSION HANDLER (Handles Individual AND Group Settlement)
  // -------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const payAmount = roundCurrency(Number(finalPaymentAmount), currency);
    if (isNaN(payAmount) || payAmount < 0) {
      setFeedback({ type: 'error', message: t('pleaseEnterValidAmount') || 'لطفاً مبلغ معتبری وارد کنید.' });
      return;
    }

    if (settlementMode === 'group' && !supervisorWorker) {
      setFeedback({ type: 'error', message: 'لطفاً سرپرست گروه را جهت دریافت و تسویه مشخص کنید.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const targetWorkerObj = settlementMode === 'group' ? supervisorWorker : worker;

      if (!targetWorkerObj) {
        throw new Error('نیروی هدف جهت تسویه حساب مشخص نیست.');
      }

      const settlementRecordId = generatePaymentId();

      const settlementRecord = {
        id: settlementRecordId,
        projectId: currentProject?.id || DEFAULT_PROJECT_ID,
        userId: user?.id || null,
        workerId: targetWorkerObj.id,
        workerName: targetWorkerObj.name,
        groupId: settlementMode === 'group' ? selectedGroupId : (worker?.groupId || null),
        month: month,
        date: settlementDate,
        time: currentTime,
        amount: payAmount,
        currency: currency,
        type: 'settlement',
        status: markAsSettled ? 'settled' : 'partial',
        isSettled: true,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        remainingBalanceAfter: roundCurrency(Math.max(0, targetPayableAmount - payAmount), currency),
        grossEarningsCalculated: settlementMode === 'group' ? groupCalculations.totalGroupGross : individualCalculations.grossEarnings,
        priorBalanceDeducted: 0,
        advancesDeducted: settlementMode === 'group' ? groupCalculations.totalGroupAdvances : individualCalculations.advancesDeducted,
        isGroupSettlement: settlementMode === 'group',
        groupMemberCount: settlementMode === 'group' ? groupMembers.length : 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      await db.payments.put(settlementRecord);

      // Settle all related attendance logs and advances
      if (markAsSettled) {
        const logsToSettle = settlementMode === 'group'
          ? groupCalculations.allGroupUnsettledLogs
          : individualCalculations.unsettledLogs;

        if (logsToSettle.length > 0) {
          const updatedLogs = logsToSettle.map((l) => ({
            ...l,
            isSettled: true,
            settlementReceiptId: settlementRecordId,
            updatedAt: now.toISOString()
          }));
          await db.attendanceLogs.bulkPut(updatedLogs);
          pushLogsLive(updatedLogs).catch(console.warn);
        }

        const advancesToSettle = settlementMode === 'group'
          ? groupCalculations.allGroupUnsettledPayments
          : individualCalculations.unsettledPayments;

        if (advancesToSettle.length > 0) {
          const updatedAdv = advancesToSettle.map((p) => ({
            ...p,
            isSettled: true,
            settlementReceiptId: settlementRecordId,
            updatedAt: now.toISOString()
          }));
          await db.payments.bulkPut(updatedAdv);
        }
      }

      pushPaymentsLive().catch(console.warn);

      if (onSettlementComplete) {
        onSettlementComplete(settlementRecord);
      }

      onClose();
    } catch (err) {
      console.error('Settlement save error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'خطا در ثبت تسویه حساب'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex no-print animate-in fade-in duration-150 items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header with Mode Toggle */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              settlementMode === 'group'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              {settlementMode === 'group' ? <Users className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {settlementMode === 'group' ? 'تسویه حساب گروهی با سرپرست' : t('settlementModalTitle')}
              </h3>
              <p className="text-xs text-slate-400">
                {settlementMode === 'group' 
                  ? `${activeGroup?.name || 'گروه کاری'} • سرپرست: ${supervisorWorker?.name || 'تعریف‌نشده'}`
                  : `${worker?.name || 'نیرو'} • روزهای تسویه نشده`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        {allGroups.length > 0 && (
          <div className="mt-3.5 flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSettlementMode('individual')}
              className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                settlementMode === 'individual'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>تسویه فردی (نیرو)</span>
            </button>

            <button
              type="button"
              onClick={() => setSettlementMode('group')}
              className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                settlementMode === 'group'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>تسویه با سرپرست گروه</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">
                {allGroups.length}
              </span>
            </button>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback.message && (
          <div className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
          }`}>
            {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* GROUP SETTLEMENT SPECIFIC SELECTORS & BREAKDOWN */}
        {/* ----------------------------------------------------------------- */}
        {settlementMode === 'group' ? (
          <div className="mt-3.5 space-y-3">
            
            {/* Group & Supervisor Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  انتخاب گروه کاری:
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" />
                  <span>سرپرست دریافت‌کننده وجه:</span>
                </label>
                <select
                  value={selectedSupervisorId}
                  onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {groupMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.teamRole === 'Master' ? '(استادکار / سرپرست)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Group Summary Box */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                <span>تعداد افراد گروه:</span>
                <span className="font-mono">{groupMembers.length} نفر</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">مجموع ناخالص کارکرد کل اعضا:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {formatAmount(groupCalculations.totalGroupGross, currency)} {getCurrencySymbol(currency, language)}
                </span>
              </div>

              {groupCalculations.totalGroupAdvances > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                  <span>(-) مجموع مساعده‌های اعضای گروه:</span>
                  <span className="font-bold font-mono">
                    {formatAmount(groupCalculations.totalGroupAdvances, currency)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between text-sm">
                <span className="font-black text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>مجموع کارکرد خالص قابل پرداخت به سرپرست:</span>
                </span>
                <span className="font-black text-amber-700 dark:text-amber-300 font-mono text-base sm:text-lg">
                  {formatAmount(groupCalculations.totalGroupNetDue, currency)} {getCurrencySymbol(currency, language)}
                </span>
              </div>
            </div>

            {/* Individual Breakdown Table of Group Members */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-500" />
                  <span>ریز کارکرد و سهم هر یک از افراد گروه:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (پس از ثبت، همه تسویه خواهند شد)
                </span>
              </div>

              {groupCalculations.memberBreakdowns.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">هیچ نیرویی در این گروه یافت نشد.</div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1 hide-scrollbar">
                  {groupCalculations.memberBreakdowns.map((mb) => (
                    <div 
                      key={mb.worker.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        mb.worker.id === selectedSupervisorId
                          ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {mb.isMaster ? (
                          <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" title="استادکار / سرپرست" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white">{mb.worker.name}</span>
                            {mb.worker.id === selectedSupervisorId && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[9px] font-bold">
                                دریافت‌کننده
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {mb.effectiveDays} روز {mb.otHours > 0 ? `(+${formatHoursAndMinutes(mb.otHours, language)})` : ''} 
                            {mb.advances > 0 && ` • مساعده: ${formatAmount(mb.advances, currency)}`}
                          </span>
                        </div>
                      </div>

                      <div className="text-end">
                        <span className="font-bold font-mono text-slate-900 dark:text-white block">
                          {formatAmount(mb.netDue, currency)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {getCurrencySymbol(currency, language)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ----------------------------------------------------------------- */
          /* INDIVIDUAL SETTLEMENT SPECIFIC BREAKDOWN */
          /* ----------------------------------------------------------------- */
          <div className="space-y-3">
            
            {/* Workers With Arrears Selector */}
            {arrearsList.length > 0 && onSelectWorker && (
              <div className="mt-3.5 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('workersWithArrears') || 'پرسنل دارای معوقه / مانده:'}</label>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
                  {arrearsList.map((arrWorker) => (
                    <button
                      key={arrWorker.worker.id}
                      type="button"
                      onClick={() => onSelectWorker(arrWorker.worker)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                        worker?.id === arrWorker.worker.id
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        <span>{arrWorker.worker.name}</span>
                        <span className="font-mono bg-white/50 dark:bg-black/20 px-1.5 rounded text-[10px]">
                          {arrWorker.netBalanceDue < 0 
                            ? `${formatAmount(Math.abs(arrWorker.netBalanceDue), currency)} (بدهکار)`
                            : `${formatAmount(arrWorker.netBalanceDue, currency)} (بستانکار)`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calculation Breakdown Card */}
            <div className="mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  <span>کارکرد جدید در انتظار تسویه:</span>
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {individualCalculations.unsettledLogs.length} روز ({individualCalculations.effectiveDays} روز کاری)
                  {individualCalculations.otHours > 0 && ` + ${formatHoursAndMinutes(individualCalculations.otHours, language)}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">ناخالص کارکرد تسویه نشده:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {formatAmount(individualCalculations.grossEarnings, currency)} {getCurrencySymbol(currency, language)}
                </span>
              </div>

              {individualCalculations.advancesDeducted > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span>(-) مساعده‌های تسویه نشده:</span>
                  <span className="font-bold font-mono">
                    {formatAmount(individualCalculations.advancesDeducted, currency)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-sm">
                <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-500" />
                  <span>مبلغ قابل پرداخت این تسویه:</span>
                </span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-base sm:text-lg">
                  {formatAmount(individualCalculations.totalCumulativeDebt, currency)} {getCurrencySymbol(currency, language)}
                </span>
              </div>
            </div>

            {/* Detailed List of Unsettled Days */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-500" />
                  <span>ریز روزهای کارکرد در انتظار تسویه:</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {individualCalculations.unsettledLogs.length} روز باز
                </span>
              </div>

              {individualCalculations.unsettledLogs.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 font-medium">
                  تمامی روزهای کارکرد قبلی تسویه شده‌اند و روز تسویه‌نشده‌ای وجود ندارد.
                </div>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pe-1 hide-scrollbar">
                  {individualCalculations.unsettledLogs.map((l) => (
                    <div key={l.id || l.date} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{l.date}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          l.type === 'hourly' 
                            ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300' 
                            : l.type === 'half'
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {l.type === 'half' ? 'نیم‌روز' : l.type === 'hourly' ? 'ساعتی' : 'کامل'}
                        </span>
                        {l.overtimeHours > 0 && (
                          <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-bold">
                            +{formatHoursAndMinutes(l.overtimeHours, language)}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatAmount(l.totalDayPay, currency)} {getCurrencySymbol(currency, language)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* PAYMENT SUBMISSION FORM */}
        {/* ----------------------------------------------------------------- */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          
          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {settlementMode === 'group' ? 'مبلغ نهایی پرداختی به سرپرست' : t('finalPaymentAmount')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step={currency === 'IQD' ? '250' : '1'}
                  value={finalPaymentAmount}
                  onChange={(e) => setFinalPaymentAmount(e.target.value)}
                  onBlur={() => {
                    if (finalPaymentAmount !== '') {
                      setFinalPaymentAmount(String(roundCurrency(finalPaymentAmount, currency)));
                    }
                  }}
                  required
                  className={`w-full px-3 py-2 text-sm font-black bg-white dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-2 font-mono pe-14 ${
                    settlementMode === 'group'
                      ? 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 focus:ring-amber-500'
                      : 'border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500'
                  }`}
                />
                <span className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-xs font-bold text-slate-400">
                  {getCurrencySymbol(currency, language)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('settlementDate')}
              </label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Reference / Document Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('referenceNumber')}
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={t('referencePlaceholder') || 'شماره چک، رسید بانکی یا سند تسویه'}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="2"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Mark as Settled Checkbox */}
          <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer ${
            settlementMode === 'group'
              ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60'
              : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60'
          }`}>
            <input
              type="checkbox"
              checked={markAsSettled}
              onChange={(e) => setMarkAsSettled(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {settlementMode === 'group'
                ? `تسویه قطعی و بستن کارکرد باز تمام ${groupMembers.length} نفر اعضای گروه`
                : t('markAsSettledCheckbox') || 'علامت‌گذاری این روزها به عنوان تسویه‌شده قطعی'}
            </span>
          </label>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-2/3 py-2.5 px-3 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 ${
                settlementMode === 'group'
                  ? 'bg-amber-600 hover:bg-amber-500 disabled:bg-amber-400 text-white shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white shadow-emerald-600/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'در حال ثبت...'
                  : settlementMode === 'group'
                  ? `ثبت تسویه گروهی با سرپرست (${groupMembers.length} نفر)`
                  : t('settleBtn')}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
