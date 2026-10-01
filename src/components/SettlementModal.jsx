import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generatePaymentId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { pushPaymentsLive, pushLogsLive } from '../services/realtimeSync';
import { getTodayDateString, getCurrentYearMonth, formatAmount, roundCurrency, getCurrencySymbol, formatHoursAndMinutes, formatCurrency, normalizeDigits, convertDigits } from '../utils/formatters';
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
  AlertTriangle,
  ShieldAlert,
  Ban,
  HelpCircle, 
  Calculator, 
  ArrowDownRight, 
  Shield, 
  Layers, 
  Crown, 
  Landmark, 
  Star, 
  CreditCard 
} from 'lucide-react';
import { useAccounting } from '../hooks/useAccounting';
import { OverdraftConfirmModal } from './accounting/OverdraftConfirmModal';

export function SettlementModal({ 
  isOpen, 
  onClose, 
  worker: propWorker, 
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
  const { t, language, numberFormat } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';

  const [localWorker, setLocalWorker] = useState(null);
  const worker = localWorker || propWorker || (allWorkers.length > 0 ? (allWorkers.find(w => !w.deletedAt && !w.isArchived) || allWorkers[0]) : null);

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

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // -------------------------------------------------------------
  // 1. INDIVIDUAL SETTLEMENT CALCULATIONS (with Double-Barrier Guard)
  // -------------------------------------------------------------
  const effectiveWorkerLogs = useMemo(() => {
    if (worker && allLogs.length > 0) {
      return allLogs.filter((l) => String(l.workerId) === String(worker.id));
    }
    return workerLogs || [];
  }, [worker, allLogs, workerLogs]);

  const effectiveWorkerPayments = useMemo(() => {
    if (worker && allPayments.length > 0) {
      return allPayments.filter((p) => String(p.workerId) === String(worker.id));
    }
    return workerPayments || [];
  }, [worker, allPayments, workerPayments]);

  const workerSettlements = useMemo(() => {
    return (allPayments || effectiveWorkerPayments || []).filter((p) => 
      !p.deletedAt && 
      (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled') &&
      (String(p.workerId) === String(worker?.id) || (worker?.groupId && p.groupId === worker.groupId))
    );
  }, [allPayments, effectiveWorkerPayments, worker]);

  const lastSettlementDate = useMemo(() => {
    const sorted = [...workerSettlements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    let d = sorted[0]?.date || sorted[0]?.createdAt?.slice(0, 10) || null;
    if (sorted[0]?.createdAt && sorted[0].createdAt.startsWith('2026-09') && sorted[0].createdAt <= '2026-09-22') {
      if (!d || d < '2026-09-20') d = '2026-09-20';
    }
    return d;
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
    return (effectiveWorkerLogs || [])
      .filter((l) => !isLogSettled(l))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [effectiveWorkerLogs, lastSettlementDate]);

  const unsettledPayments = useMemo(() => {
    return (effectiveWorkerPayments || [])
      .filter((p) => !isPaymentSettled(p) && (p.type === 'advance' || p.type === 'Advance_Payment'))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [effectiveWorkerPayments, lastSettlementDate]);

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
      const mSettlements = (allPayments || []).filter((p) => 
        !p.deletedAt && 
        (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled') &&
        (String(p.workerId) === String(m.id) || (m.groupId && p.groupId === m.groupId))
      );
      const mSortedSettlements = [...mSettlements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      let mLastSettlementDate = mSortedSettlements[0]?.date || mSortedSettlements[0]?.createdAt?.slice(0, 10) || null;
      if (mSortedSettlements[0]?.createdAt && mSortedSettlements[0].createdAt.startsWith('2026-09') && mSortedSettlements[0].createdAt <= '2026-09-22') {
        if (!mLastSettlementDate || mLastSettlementDate < '2026-09-20') mLastSettlementDate = '2026-09-20';
      }

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
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);
  const [settlementDate, setSettlementDate] = useState(getTodayDateString());
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [markAsSettled, setMarkAsSettled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [completedPayment, setCompletedPayment] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const prevWorkerIdRef = React.useRef(worker?.id);
  const prevModeRef = React.useRef(settlementMode);
  const prevGroupIdRef = React.useRef(selectedGroupId);
  const prevIsOpenRef = React.useRef(false);

  const { checkAccountOverdraft, accountBalances } = useAccounting();
  const [overdraftPromptData, setOverdraftPromptData] = useState(null);

  // Financial accounts live query
  const financialAccounts = useLiveQuery(
    async () => {
      if (!db.financialAccounts) return [];
      const list = await db.financialAccounts.toArray();
      return list.filter((a) => !a.deletedAt && a.isActive);
    },
    []
  ) || [];

  const defaultAccount = useMemo(() => {
    return financialAccounts.find((a) => a.isDefault) || financialAccounts[0] || null;
  }, [financialAccounts]);

  const effectiveAccountId = selectedAccountId || defaultAccount?.id || (financialAccounts[0]?.id ? String(financialAccounts[0].id) : '');

  const currentOverdraft = useMemo(() => {
    const payAmount = roundCurrency(Number(normalizeDigits(finalPaymentAmount)), currency);
    if (isNaN(payAmount) || payAmount <= 0 || !effectiveAccountId) return null;
    return checkAccountOverdraft(effectiveAccountId, payAmount);
  }, [finalPaymentAmount, effectiveAccountId, currency, checkAccountOverdraft]);

  // Sync form defaults whenever modal opens or worker/group/mode changes
  useEffect(() => {
    if (isOpen) {
      const justOpened = !prevIsOpenRef.current;
      const workerChanged = prevWorkerIdRef.current !== worker?.id;
      const modeChanged = prevModeRef.current !== settlementMode;
      const groupChanged = prevGroupIdRef.current !== selectedGroupId;

      if (justOpened || workerChanged || modeChanged || groupChanged) {
        setIsAmountManuallyEdited(false);
        setFinalPaymentAmount(targetPayableAmount > 0 ? String(targetPayableAmount) : '0');
        setSettlementDate(getTodayDateString());
        setSelectedAccountId(effectiveAccountId);
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
      } else if (!isAmountManuallyEdited) {
        setFinalPaymentAmount(targetPayableAmount > 0 ? String(targetPayableAmount) : '0');
      }

      prevIsOpenRef.current = true;
      prevWorkerIdRef.current = worker?.id;
      prevModeRef.current = settlementMode;
      prevGroupIdRef.current = selectedGroupId;
    } else {
      prevIsOpenRef.current = false;
    }
  }, [isOpen, worker?.id, settlementMode, selectedGroupId, targetPayableAmount, isAmountManuallyEdited, effectiveAccountId, activeGroup?.name, supervisorWorker?.name, groupMembers.length, individualCalculations.unsettledLogs.length, language]);

  if (!isOpen) return null;

  const handleSubmit = async (e, bypassOverdraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback({ type: '', message: '' });

    const payAmount = roundCurrency(Number(normalizeDigits(finalPaymentAmount)), currency);
    if (isNaN(payAmount) || payAmount < 0) {
      setFeedback({ type: 'error', message: t('pleaseEnterValidAmount') || 'لطفاً مبلغ معتبری وارد کنید.' });
      return;
    }

    if (settlementMode === 'group' && !supervisorWorker) {
      setFeedback({ type: 'error', message: 'لطفاً سرپرست گروه را جهت دریافت و تسویه مشخص کنید.' });
      return;
    }

    if (payAmount > 0 && !bypassOverdraft) {
      const overdraftCheck = checkAccountOverdraft(selectedAccountId, payAmount);
      if (!overdraftCheck.hasSufficientFunds) {
        if (overdraftCheck.effectivePolicy === 'never_allow') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || 'حساب انتخابی',
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: payAmount,
            shortfall: overdraftCheck.shortfall,
            isBlocked: true
          });
          setFeedback({
            type: 'error',
            message: language === 'fa'
              ? `موجودی حساب انتخابی (${overdraftCheck.account?.name || 'صندوق/بانک'}) برای پرداخت این تسویه‌حساب کافی نیست و بر اساس سیاست تعیین شده، برداشت بیش از موجودی غیرمجاز است.`
              : 'باڵانسی حیساب بەش ناکات و کەمبوون قەدەغەیە.'
          });
          return;
        } else if (overdraftCheck.effectivePolicy === 'ask_each_time') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || 'حساب انتخابی',
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: payAmount,
            shortfall: overdraftCheck.shortfall,
            isBlocked: false
          });
          return;
        }
      }
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
        accountId: selectedAccountId || null,
        accountName: financialAccounts.find((a) => a.id === selectedAccountId)?.name || '',
        accountType: financialAccounts.find((a) => a.id === selectedAccountId)?.type || 'cash',
        type: 'settlement',
        status: 'draft',
        approval_status: 'draft',
        settlement_status: markAsSettled ? 'settled' : 'partial',
        created_by: user?.id || 'admin',
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

      const finalCheck = checkAccountOverdraft(selectedAccountId, payAmount);
      if (payAmount > 0 && !finalCheck.hasSufficientFunds) {
        const resultingNeg = Math.abs(finalCheck.currentBalance - payAmount);
        setToastMessage({
          type: 'warning',
          text: language === 'fa'
            ? `تسویه حساب ثبت شد. توجه: موجودی حساب «${finalCheck.account?.name || 'صندوق'}» به منفی ${formatCurrency(resultingNeg, currency, language)} رسید.`
            : `مامەڵە تۆمارکرا. باڵانسی حیساب بووە بە نێگەتیڤ.`
        });
        setTimeout(() => {
          if (onSettlementComplete) onSettlementComplete(settlementRecord);
          onClose();
        }, 2000);
      } else {
        if (onSettlementComplete) onSettlementComplete(settlementRecord);
        onClose();
      }
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

  const modalContent = (
    <div 
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-100 dark:bg-slate-950 flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[260] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200 ${
          toastMessage.type === 'warning'
            ? 'bg-amber-600 text-white shadow-amber-600/30'
            : 'bg-emerald-600 text-white shadow-emerald-600/30'
        }`}>
          {toastMessage.type === 'warning' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}
      {/* Header with Mode Toggle */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between pb-3">
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
              title="بستن (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          {allGroups.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs font-bold">
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
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-4">

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
                <span>{convertDigits(groupMembers.length, numberFormat)} نفر</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">مجموع ناخالص کارکرد کل اعضا:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatAmount(groupCalculations.totalGroupGross, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                </span>
              </div>

              {groupCalculations.totalGroupAdvances > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                  <span>(-) مجموع مساعده‌های اعضای گروه:</span>
                  <span className="font-bold">
                    {formatAmount(groupCalculations.totalGroupAdvances, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between text-sm">
                <span className="font-black text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>مجموع کارکرد خالص قابل پرداخت به سرپرست:</span>
                </span>
                <span className="font-black text-amber-700 dark:text-amber-300 text-base sm:text-lg">
                  {formatAmount(groupCalculations.totalGroupNetDue, currency, numberFormat)} {getCurrencySymbol(currency, language)}
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
                            {convertDigits(mb.effectiveDays, numberFormat)} روز {mb.otHours > 0 ? `(+${formatHoursAndMinutes(mb.otHours, language)})` : ''} 
                            {mb.advances > 0 && ` • مساعده: ${formatAmount(mb.advances, currency, numberFormat)}`}
                          </span>
                        </div>
                      </div>

                      <div className="text-end">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {formatAmount(mb.netDue, currency, numberFormat)}
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
            
            {/* Worker Selector Dropdown */}
            {allWorkers.length > 1 && (
              <div className="mt-2 space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {language === 'ku' ? 'هەڵبژاردنی کرێکار بۆ پاکتاو:' : 'انتخاب پرسنل جهت تسویه حساب:'}
                </label>
                <select
                  value={worker?.id || ''}
                  onChange={(e) => {
                    const found = allWorkers.find((w) => String(w.id) === String(e.target.value));
                    if (found) {
                      setLocalWorker(found);
                      if (onSelectWorker) onSelectWorker(found);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
                >
                  {allWorkers.filter(w => !w.deletedAt && !w.isArchived).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.role ? `(${w.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Workers With Arrears Selector */}
            {arrearsList.length > 0 && onSelectWorker && (
              <div className="mt-2 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('workersWithArrears') || 'پرسنل دارای معوقه / مانده:'}</label>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
                  {arrearsList.map((arrWorker) => (
                    <button
                      key={arrWorker.worker.id}
                      type="button"
                      onClick={() => {
                        setLocalWorker(arrWorker.worker);
                        onSelectWorker(arrWorker.worker);
                      }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                        worker?.id === arrWorker.worker.id
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        <span>{arrWorker.worker.name}</span>
                        <span className="bg-white/50 dark:bg-black/20 px-1.5 rounded text-[10px] font-semibold">
                          {arrWorker.netBalanceDue < 0 
                            ? `${formatAmount(Math.abs(arrWorker.netBalanceDue), currency, numberFormat)} (بدهکار)`
                            : `${formatAmount(arrWorker.netBalanceDue, currency, numberFormat)} (بستانکار)`}
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
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {convertDigits(individualCalculations.unsettledLogs.length, numberFormat)} روز ({convertDigits(individualCalculations.effectiveDays, numberFormat)} روز کاری)
                  {individualCalculations.otHours > 0 && ` + ${formatHoursAndMinutes(individualCalculations.otHours, language)}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">ناخالص کارکرد تسویه نشده:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formatAmount(individualCalculations.grossEarnings, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                </span>
              </div>

              {individualCalculations.advancesDeducted > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span>(-) مساعده‌های تسویه نشده:</span>
                  <span className="font-bold">
                    {formatAmount(individualCalculations.advancesDeducted, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-sm">
                <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-500" />
                  <span>مبلغ قابل پرداخت این تسویه:</span>
                </span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-base sm:text-lg">
                  {formatAmount(individualCalculations.totalCumulativeDebt, currency, numberFormat)} {getCurrencySymbol(currency, language)}
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
                  {convertDigits(individualCalculations.unsettledLogs.length, numberFormat)} روز باز
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
                        <span className="font-bold text-slate-800 dark:text-slate-200">{convertDigits(l.date, numberFormat)}</span>
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
                          <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                            +{formatHoursAndMinutes(l.overtimeHours, language)}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatAmount(l.totalDayPay, currency, numberFormat)} {getCurrencySymbol(currency, language)}
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {settlementMode === 'group' ? 'مبلغ نهایی پرداختی به سرپرست' : t('finalPaymentAmount')}
                </label>
                {isAmountManuallyEdited && Number(normalizeDigits(finalPaymentAmount)) !== Number(targetPayableAmount) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFinalPaymentAmount(targetPayableAmount > 0 ? String(targetPayableAmount) : '0');
                      setIsAmountManuallyEdited(false);
                    }}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-1"
                  >
                    بازنشانی به کل مبلغ ({formatAmount(targetPayableAmount, currency, numberFormat)})
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={finalPaymentAmount}
                  onChange={(e) => {
                    const normalized = normalizeDigits(e.target.value);
                    setFinalPaymentAmount(normalized);
                    setIsAmountManuallyEdited(true);
                  }}
                  onBlur={() => {
                    if (finalPaymentAmount !== '') {
                      const num = Number(normalizeDigits(finalPaymentAmount));
                      if (!isNaN(num)) {
                        setFinalPaymentAmount(String(roundCurrency(num, currency)));
                      }
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

          {/* Payment Account (Bank Card / Cash Box) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Landmark className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                <span>حساب یا صندوق پرداختی تسویه</span>
              </label>
              {defaultAccount && (
                <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-amber-500" />
                  <span>پیش‌فرض: {defaultAccount.name}</span>
                </span>
              )}
            </div>
            {financialAccounts.length > 0 ? (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white cursor-pointer font-medium"
              >
                {financialAccounts.map((acc) => {
                  const b = accountBalances?.get(String(acc.id))?.currentBalance ?? (Number(acc.initialBalance) || 0);
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.type === 'bank' ? '💳 کارت بانکی: ' : '🪙 صندوق نقدی: '}
                      {acc.name} {acc.bankName ? `(${acc.bankName})` : ''} - موجودی: {formatCurrency(b, currency, language)} {acc.isDefault ? '⭐ [پیش‌فرض]' : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="text-[11px] text-slate-400 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                صندوق نقدی کارگاه
              </div>
            )}

            {/* هشدار زنده اضافه برداشت در فرم */}
            {currentOverdraft && !currentOverdraft.hasSufficientFunds && (
              <div className={`mt-2 p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                currentOverdraft.effectivePolicy === 'never_allow'
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                  : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300'
              }`}>
                {currentOverdraft.effectivePolicy === 'never_allow' ? (
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold">
                    {currentOverdraft.effectivePolicy === 'never_allow'
                      ? 'کسری موجودی - ثبت غیرمجاز'
                      : currentOverdraft.effectivePolicy === 'always_allow'
                        ? 'هشدار کسری موجودی (مجاز در تنظیمات سیستم)'
                        : 'هشدار کسری موجودی حساب'}
                  </div>
                  <div className="text-[11px] leading-relaxed opacity-90">
                    {currentOverdraft.effectivePolicy === 'never_allow'
                      ? `موجودی حساب انتخابی (${formatCurrency(currentOverdraft.currentBalance, currency, language)}) کافی نیست (کسری: ${formatCurrency(currentOverdraft.shortfall, currency, language)}). بر اساس تنظیمات سیستم، ثبت با موجودی منفی «غیرمجاز» است.`
                      : currentOverdraft.effectivePolicy === 'always_allow'
                        ? `مبلغ تسویه از موجودی فعلی حساب (${formatCurrency(currentOverdraft.currentBalance, currency, language)}) بیشتر است (کسری: ${formatCurrency(currentOverdraft.shortfall, currency, language)}). با توجه به تنظیم بودن بر روی «همیشه مجاز»، این تراکنش با مانده منفی ثبت خواهد شد.`
                        : `مبلغ تسویه از موجودی حساب (${formatCurrency(currentOverdraft.currentBalance, currency, language)}) بیشتر است (کسری: ${formatCurrency(currentOverdraft.shortfall, currency, language)}). هنگام کلیک بر روی ثبت، پنجره تأیید کسر موجودی نمایش داده می‌شود.`}
                  </div>
                </div>
              </div>
            )}
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

          {/* بازخورد خطا یا هشدار نزدیک دکمه ثبت */}
          {feedback.message && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
            }`}>
              {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

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
                currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === 'never_allow'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25'
                  : settlementMode === 'group'
                  ? 'bg-amber-600 hover:bg-amber-500 disabled:bg-amber-400 text-white shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white shadow-emerald-600/20'
              }`}
            >
              {currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === 'never_allow' ? (
                <>
                  <Ban className="w-4 h-4" />
                  <span>کسری موجودی (غیرمجاز)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'در حال ثبت...'
                      : settlementMode === 'group'
                      ? `ثبت تسویه گروهی با سرپرست (${groupMembers.length} نفر)`
                      : t('settleBtn')}
                  </span>
                </>
              )}
            </button>
          </div>

        </form>

        </div>
      </div>

      {/* مودال تایید اضافه برداشت برای تسویه حساب */}
      {overdraftPromptData && (
        <OverdraftConfirmModal
          isOpen={Boolean(overdraftPromptData)}
          onClose={() => setOverdraftPromptData(null)}
          onConfirm={() => handleSubmit(null, true)}
          accountName={overdraftPromptData.accountName}
          currentBalance={overdraftPromptData.currentBalance}
          requestedAmount={overdraftPromptData.requestedAmount}
          currency={currency}
          language={language}
          isBlocked={Boolean(overdraftPromptData.isBlocked)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
