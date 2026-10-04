import { logAuditAction, getSafeAuthContext } from "../services/auditLogger";
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generatePaymentId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth, usePermissions } from '../context/AuthContext';
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
  CreditCard,
  Clock,
  Zap,
  Sliders,
  Sparkles,
  ArrowLeftRight,
  Filter,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Percent,
  CalendarRange,
  CheckCheck,
  Square,
  Search,
  UserCheck
} from 'lucide-react';
import { useAccounting } from '../hooks/useAccounting';
import { OverdraftConfirmModal } from './accounting/OverdraftConfirmModal';
import { calculateWorkerFinancials } from '../utils/settlementCalculations';

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
  const { currentUser } = usePermissions();
  const currency = currentProject?.currency || 'IQD';

  const [localWorker, setLocalWorker] = useState(null);
  const [workerSearchQuery, setWorkerSearchQuery] = useState('');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('with_arrears'); // 'with_arrears' | 'all' | 'settled'
  const worker = localWorker || propWorker || null;

  // Fallback Dexie live queries if caller did not pass all datasets
  const dbLogs = useLiveQuery(() => db.attendanceLogs.toArray(), []);
  const dbPayments = useLiveQuery(() => db.payments.toArray(), []);
  const dbWorkers = useLiveQuery(() => db.workers.toArray(), []);
  const dbGroups = useLiveQuery(() => db.groups.toArray(), []);

  const effectiveAllLogs = (allLogs && allLogs.length > 0) ? allLogs : (dbLogs || []);
  const effectiveAllPayments = (allPayments && allPayments.length > 0) ? allPayments : (dbPayments || []);
  const effectiveAllWorkers = (allWorkers && allWorkers.length > 0) ? allWorkers : (dbWorkers || []);
  const effectiveAllGroups = (allGroups && allGroups.length > 0) ? allGroups : (dbGroups || []);

  // Reset worker selection when modal opens or propWorker changes
  useEffect(() => {
    if (isOpen) {
      if (propWorker) {
        setLocalWorker(propWorker);
      } else {
        setLocalWorker(null);
      }
      setWorkerSearchQuery('');
      setWorkerStatusFilter('with_arrears');
    } else {
      setLocalWorker(null);
      setWorkerSearchQuery('');
      setWorkerStatusFilter('with_arrears');
    }
  }, [isOpen, propWorker]);

  // Determine initial mode based on props or worker's role
  const [settlementMode, setSettlementMode] = useState(() => {
    if (initialMode === 'group') return 'group';
    if (worker?.groupId && worker?.teamRole === 'Master') return 'group';
    return 'individual';
  });

  // Dual Settlement Architecture: 'auto' (Quick / Automatic FIFO) vs 'custom' (Detailed / Filter-Based)
  const [settlementTypeTab, setSettlementTypeTab] = useState('auto'); // 'auto' | 'custom'
  const [settleOption, setSettleOption] = useState('full'); // 'full' | 'partial'

  const [selectedGroupId, setSelectedGroupId] = useState(() => {
    if (initialGroupId) return initialGroupId;
    if (worker?.groupId) return worker.groupId;
    if (effectiveAllGroups.length > 0) return effectiveAllGroups[0].id;
    return '';
  });

  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  const handleCloseModal = () => {
    setLocalWorker(null);
    if (onSelectWorker) onSelectWorker(null);
    onClose();
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleCloseModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Active workers list for selection screen
  const activeWorkersList = useMemo(() => {
    return (effectiveAllWorkers || []).filter((w) => !w.deletedAt && !w.isArchived);
  }, [effectiveAllWorkers]);

  // Pre-calculated financials map for high UI performance and accurate sorting
  const workerFinancialsMap = useMemo(() => {
    const map = new Map();
    for (const w of activeWorkersList) {
      const fin = calculateWorkerFinancials(w, effectiveAllLogs, effectiveAllPayments, currency);
      map.set(String(w.id), fin);
    }
    return map;
  }, [activeWorkersList, effectiveAllLogs, effectiveAllPayments, currency]);

  const countWithArrears = useMemo(() => {
    return activeWorkersList.filter((w) => {
      const fin = workerFinancialsMap.get(String(w.id));
      return (fin?.netBalanceDue || 0) > 0;
    }).length;
  }, [activeWorkersList, workerFinancialsMap]);

  const countSettled = useMemo(() => {
    return activeWorkersList.filter((w) => {
      const fin = workerFinancialsMap.get(String(w.id));
      return (fin?.netBalanceDue || 0) <= 0;
    }).length;
  }, [activeWorkersList, workerFinancialsMap]);

  const filteredActiveWorkers = useMemo(() => {
    let list = activeWorkersList;

    if (workerStatusFilter === 'with_arrears') {
      list = list.filter((w) => {
        const fin = workerFinancialsMap.get(String(w.id));
        return (fin?.netBalanceDue || 0) > 0;
      });
    } else if (workerStatusFilter === 'settled') {
      list = list.filter((w) => {
        const fin = workerFinancialsMap.get(String(w.id));
        return (fin?.netBalanceDue || 0) <= 0;
      });
    }

    if (workerSearchQuery.trim()) {
      const q = workerSearchQuery.trim().toLowerCase();
      list = list.filter(
        (w) =>
          w.name?.toLowerCase().includes(q) ||
          w.role?.toLowerCase().includes(q) ||
          w.phone?.includes(q)
      );
    }

    // Sort: highest balance due first, then alphabetically by name
    return [...list].sort((a, b) => {
      const finA = workerFinancialsMap.get(String(a.id))?.netBalanceDue || 0;
      const finB = workerFinancialsMap.get(String(b.id))?.netBalanceDue || 0;
      if (finB !== finA) return finB - finA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeWorkersList, workerStatusFilter, workerSearchQuery, workerFinancialsMap]);

  // -------------------------------------------------------------
  // 1. INDIVIDUAL SETTLEMENT CALCULATIONS (Unified Single Source of Truth)
  // -------------------------------------------------------------
  const effectiveWorkerLogs = useMemo(() => {
    if (worker && effectiveAllLogs.length > 0) {
      return effectiveAllLogs.filter((l) => String(l.workerId) === String(worker.id) && !l.deletedAt);
    }
    return workerLogs || [];
  }, [worker, effectiveAllLogs, workerLogs]);

  const effectiveWorkerPayments = useMemo(() => {
    if (worker && effectiveAllPayments.length > 0) {
      return effectiveAllPayments.filter((p) => String(p.workerId) === String(worker.id) && !p.deletedAt && p.status !== 'deleted');
    }
    return (workerPayments || []).filter((p) => !p.deletedAt && p.status !== 'deleted');
  }, [worker, effectiveAllPayments, workerPayments]);

  const individualCalculations = useMemo(() => {
    if (!worker) {
      return {
        unsettledLogs: [],
        unsettledPayments: [],
        grossEarnings: 0,
        advancesDeducted: 0,
        totalCumulativeDebt: 0,
        effectiveDays: 0,
        otHours: 0,
        isLogSettled: () => false,
        getLogPay: () => 0
      };
    }
    const fin = calculateWorkerFinancials(worker, effectiveAllLogs, effectiveAllPayments, currency);
    return {
      ...fin,
      grossEarnings: fin.unsettledGross,
      advancesDeducted: fin.unsettledAdvances,
      totalCumulativeDebt: fin.netBalanceDue
    };
  }, [worker, effectiveAllLogs, effectiveAllPayments, currency]);

  const isLogSettled = individualCalculations.isLogSettled;
  const unsettledLogs = individualCalculations.unsettledLogs;
  const unsettledPayments = individualCalculations.unsettledPayments;

  // -------------------------------------------------------------
  // 2. GROUP SETTLEMENT CALCULATIONS (with Supervisor & All Members)
  // -------------------------------------------------------------
  const activeGroup = useMemo(() => {
    return (effectiveAllGroups || []).find((g) => g.id === selectedGroupId) || null;
  }, [effectiveAllGroups, selectedGroupId]);

  const groupMembers = useMemo(() => {
    if (!selectedGroupId) return [];
    return (effectiveAllWorkers || []).filter(
      (w) => w.groupId === selectedGroupId && !w.deletedAt && !w.isArchived
    );
  }, [effectiveAllWorkers, selectedGroupId]);

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
      const mFin = calculateWorkerFinancials(m, effectiveAllLogs, effectiveAllPayments, currency);

      memberBreakdowns.push({
        worker: m,
        isMaster: m.teamRole === 'Master',
        unsettledLogs: mFin.unsettledLogs,
        unsettledPayments: mFin.unsettledPayments,
        effectiveDays: mFin.effectiveDays,
        otHours: mFin.otHours,
        gross: mFin.unsettledGross,
        advances: mFin.unsettledAdvances,
        netDue: mFin.netBalanceDue
      });

      totalGroupGross += mFin.unsettledGross;
      totalGroupAdvances += mFin.unsettledAdvances;
      totalGroupNetDue += mFin.netBalanceDue;
      totalGroupDays += mFin.effectiveDays;
      totalGroupOtHours += mFin.otHours;
      allGroupUnsettledLogs.push(...mFin.unsettledLogs);
      allGroupUnsettledPayments.push(...mFin.unsettledPayments);
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
  }, [selectedGroupId, groupMembers, effectiveAllLogs, effectiveAllPayments, currency]);

  // Active calculations based on chosen mode
  const activeCalculations = settlementMode === 'group' ? groupCalculations : individualCalculations;
  const targetPayableAmount = settlementMode === 'group' ? groupCalculations.totalGroupNetDue : individualCalculations.totalCumulativeDebt;

  // Custom / Detailed Settlement Filter State
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customSelectedSection, setCustomSelectedSection] = useState('all');
  const [financialComponent, setFinancialComponent] = useState('all'); // 'all' | 'wage_only' | 'ot_only'
  const [deductAdvances, setDeductAdvances] = useState(true);
  const [selectedLogIds, setSelectedLogIds] = useState(new Set());
  const [isLogsAccordionOpen, setIsLogsAccordionOpen] = useState(false);

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

  // Distinct sections from unsettled logs
  const distinctSections = useMemo(() => {
    const sections = new Set();
    effectiveWorkerLogs.forEach((l) => {
      if (l.section && l.section.trim()) sections.add(l.section.trim());
    });
    return Array.from(sections);
  }, [effectiveWorkerLogs]);

  // Helper to compute specific financial component pay per log
  const computeLogPayForComponent = (log, component) => {
    const rawPay = Number(log.totalDayPay) || 0;
    const otRate = Number(worker?.overtimeHourlyRate) || ((Number(worker?.dailyWage) || 0) / 8);
    const otHours = Number(log.overtimeHours) || 0;
    const otPay = Number(log.overtimePay) || (otHours * otRate);

    if (component === 'wage_only') {
      return Math.max(0, rawPay - otPay);
    } else if (component === 'ot_only') {
      return otPay;
    }
    return rawPay;
  };

  // Filtered logs for Custom / Detailed Tab
  const customFilteredLogs = useMemo(() => {
    return (effectiveWorkerLogs || []).filter((l) => {
      if (isLogSettled(l)) return false;
      if (customStartDate && (l.date || '') < customStartDate) return false;
      if (customEndDate && (l.date || '') > customEndDate) return false;
      if (customSelectedSection !== 'all' && l.section !== customSelectedSection) return false;

      if (financialComponent === 'ot_only') {
        const otH = Number(l.overtimeHours) || 0;
        const otP = computeLogPayForComponent(l, 'ot_only');
        if (otH <= 0 && otP <= 0) return false;
      }
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [effectiveWorkerLogs, customStartDate, customEndDate, customSelectedSection, financialComponent, worker]);

  // Synchronize default selection: select all matching logs whenever filter criteria change
  useEffect(() => {
    const allIds = new Set(customFilteredLogs.map((l) => String(l.id || l.date)));
    setSelectedLogIds(allIds);
  }, [customFilteredLogs]);

  const toggleLogSelection = (id) => {
    const key = String(id);
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllFilteredLogs = () => {
    setSelectedLogIds(new Set(customFilteredLogs.map((l) => String(l.id || l.date))));
  };

  const deselectAllFilteredLogs = () => {
    setSelectedLogIds(new Set());
  };

  // Selected custom logs
  const selectedCustomLogs = useMemo(() => {
    return customFilteredLogs.filter((l) => selectedLogIds.has(String(l.id || l.date)));
  }, [customFilteredLogs, selectedLogIds]);

  // Selected gross calculation
  const customSelectedGross = useMemo(() => {
    return roundCurrency(
      selectedCustomLogs.reduce((sum, l) => sum + computeLogPayForComponent(l, financialComponent), 0),
      currency
    );
  }, [selectedCustomLogs, financialComponent, worker, currency]);

  // Custom advances to deduct
  const customAdvancesToDeduct = useMemo(() => {
    if (!deductAdvances) return 0;
    const maxAdvances = individualCalculations.advancesDeducted;
    return roundCurrency(Math.min(maxAdvances, customSelectedGross), currency);
  }, [deductAdvances, individualCalculations.advancesDeducted, customSelectedGross, currency]);

  // Net payable for custom settlement
  const customNetPayable = useMemo(() => {
    return roundCurrency(Math.max(0, customSelectedGross - customAdvancesToDeduct), currency);
  }, [customSelectedGross, customAdvancesToDeduct, currency]);

  // Effective target payable for current tab
  const activeTabTargetPayable = settlementTypeTab === 'custom' 
    ? customNetPayable 
    : targetPayableAmount;

  // Sync final payment amount when switching or changing custom filters
  useEffect(() => {
    if (isOpen && settlementTypeTab === 'custom') {
      setFinalPaymentAmount(String(customNetPayable));
      setIsAmountManuallyEdited(false);
    }
  }, [isOpen, settlementTypeTab, customNetPayable]);

  // Quick Date Range Presets Handlers
  const handleDatePresetPrevMonth = () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prevMonth.getFullYear();
    const m = prevMonth.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    setCustomStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
    setCustomEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleDatePresetCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    setCustomStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
    setCustomEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleDatePresetFirst15 = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    setCustomStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
    setCustomEndDate(`${y}-${String(m).padStart(2, '0')}-15`);
  };

  const handleDatePresetSecond15 = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    setCustomStartDate(`${y}-${String(m).padStart(2, '0')}-16`);
    setCustomEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleDatePresetClear = () => {
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Chronological FIFO coverage tracker for current typed payment in Auto Tab
  const coveredLogIds = useMemo(() => {
    const payNum = Number(normalizeDigits(finalPaymentAmount)) || 0;
    let budget = payNum + (settlementMode === 'group' ? groupCalculations.totalGroupAdvances : individualCalculations.advancesDeducted);
    const covered = new Set();
    const sorted = [...(settlementMode === 'group' ? groupCalculations.allGroupUnsettledLogs : individualCalculations.unsettledLogs)]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (const l of sorted) {
      const cost = Number(l.totalDayPay) || 0;
      if (budget >= cost - 0.001) {
        covered.add(l.id || l.date);
        budget -= cost;
      }
    }
    return covered;
  }, [finalPaymentAmount, settlementMode, groupCalculations, individualCalculations]);

  // Quick Preset Handlers for Auto Tab
  const handleSelectFullSettlement = () => {
    setSettleOption('full');
    setIsAmountManuallyEdited(false);
    setFinalPaymentAmount(targetPayableAmount > 0 ? String(targetPayableAmount) : '0');
  };

  const handleSelectPartialSettlement = () => {
    setSettleOption('partial');
    setIsAmountManuallyEdited(true);
  };

  const handleApplyPreset = (presetType) => {
    setSettleOption('partial');
    setIsAmountManuallyEdited(true);
    if (presetType === 'full') {
      handleSelectFullSettlement();
    } else if (presetType === 'half') {
      const half = roundCurrency(Math.floor(targetPayableAmount / 2), currency);
      setFinalPaymentAmount(String(half));
    } else if (presetType === 'round50k') {
      const step = 50000;
      const rounded = Math.floor(targetPayableAmount / step) * step;
      setFinalPaymentAmount(String(rounded > 0 ? rounded : targetPayableAmount));
    } else if (presetType === 'round10k') {
      const step = 10000;
      const rounded = Math.floor(targetPayableAmount / step) * step;
      setFinalPaymentAmount(String(rounded > 0 ? rounded : targetPayableAmount));
    }
  };

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

    const currentTargetPayable = settlementTypeTab === 'custom'
      ? customNetPayable
      : (settlementMode === 'group' ? groupCalculations.totalGroupNetDue : individualCalculations.totalCumulativeDebt);
    const isFullSettlement = payAmount >= (currentTargetPayable - 0.001) && currentTargetPayable > 0;
    const remainingBalance = roundCurrency(Math.max(0, currentTargetPayable - payAmount), currency);

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
      const settlementRecordId = generatePaymentId();
      const targetWorkerObj = settlementMode === 'group' ? supervisorWorker : worker;

      if (!targetWorkerObj) {
        throw new Error('نیروی هدف جهت تسویه حساب مشخص نیست.');
      }

      if (settlementTypeTab === 'custom') {
        if (selectedCustomLogs.length === 0) {
          setFeedback({ type: 'error', message: 'هیچ رکوردی برای تسویه سفارشی انتخاب نشده است.' });
          setIsSubmitting(false);
          return;
        }

        const customSettlementRecord = {
          id: settlementRecordId,
          projectId: currentProject?.id || DEFAULT_PROJECT_ID,
          userId: user?.id || null,
          workerId: targetWorkerObj.id,
          workerName: targetWorkerObj.name,
          groupId: worker?.groupId || null,
          month: month,
          date: settlementDate,
          time: currentTime,
          amount: payAmount,
          currency: currency,
          accountId: selectedAccountId || null,
          accountName: financialAccounts.find((a) => a.id === selectedAccountId)?.name || '',
          accountType: financialAccounts.find((a) => a.id === selectedAccountId)?.type || 'cash',
          type: 'settlement',
          settlement_subtype: 'custom',
          status: 'draft',
          approval_status: 'draft',
          settlement_status: 'settled',
          created_by: user?.id || 'admin',
          isSettled: true,
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
          remainingBalanceAfter: roundCurrency(Math.max(0, targetPayableAmount - payAmount), currency),
          grossEarningsCalculated: customSelectedGross,
          priorBalanceDeducted: 0,
          advancesDeducted: customAdvancesToDeduct,
          isGroupSettlement: false,
          groupMemberCount: 1,
          filterCriteria: {
            startDate: customStartDate || null,
            endDate: customEndDate || null,
            section: customSelectedSection !== 'all' ? customSelectedSection : null,
            financialComponent: financialComponent,
            deductAdvances: deductAdvances,
            selectedCount: selectedCustomLogs.length
          },
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          created_by_user_id: user?.id,
          updated_by_user_id: user?.id
        };

        await db.payments.put(customSettlementRecord);

        
        const safeAuth = await getSafeAuthContext();
        await logAuditAction({
            workspaceId: safeAuth.workspaceId,
            userId: safeAuth.userId,
            userName: safeAuth.userName,
          actionType: 'SUBMIT_SETTLEMENT',
          entityType: 'payments',
          entityId: settlementRecordId,
          projectId: currentProject?.id || DEFAULT_PROJECT_ID,
          
          
          
          details: {
            description: `ثبت تسویه حساب / مساعده سفارشی برای ${worker.name}`,
            amount: finalAmountNum,
            worker_name: worker.name
          }
        });

        if (markAsSettled) {
          // Strictly settle only the selected logs
          const logsToSettle = selectedCustomLogs.map((l) => ({
            ...l,
            isSettled: true,
            settlementReceiptId: settlementRecordId,
            updatedAt: now.toISOString()
          }));
          await db.attendanceLogs.bulkPut(logsToSettle);
          pushLogsLive(logsToSettle).catch(console.warn);

          // Settle advances if deducted
          if (customAdvancesToDeduct > 0) {
            let advBudget = customAdvancesToDeduct;
            const advancesToSettle = [];
            for (const p of individualCalculations.unsettledPayments) {
              const pAmount = Number(p.amount) || 0;
              if (advBudget >= pAmount - 0.001) {
                advancesToSettle.push({
                  ...p,
                  isSettled: true,
                  settlementReceiptId: settlementRecordId,
                  updatedAt: now.toISOString()
                });
                advBudget -= pAmount;
              }
            }
            if (advancesToSettle.length > 0) {
              await db.payments.bulkPut(advancesToSettle);
            }
          }
        }
      } else {
        // Auto / FIFO Settlement Mode
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
          settlement_subtype: 'auto',
          status: 'draft',
          approval_status: 'draft',
          settlement_status: isFullSettlement ? (markAsSettled ? 'settled' : 'partial') : 'partial',
          created_by: user?.id || 'admin',
          isSettled: true,
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
          remainingBalanceAfter: remainingBalance,
          grossEarningsCalculated: settlementMode === 'group' ? groupCalculations.totalGroupGross : individualCalculations.grossEarnings,
          priorBalanceDeducted: 0,
          advancesDeducted: settlementMode === 'group' ? groupCalculations.totalGroupAdvances : individualCalculations.advancesDeducted,
          isGroupSettlement: settlementMode === 'group',
          groupMemberCount: settlementMode === 'group' ? groupMembers.length : 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          created_by_user_id: user?.id,
          updated_by_user_id: user?.id
        };

        await db.payments.put(settlementRecord);

        
        let finalWorkspaceId = currentUser?.workspace_id || currentUser?.workspaceId || user?.workspace_id || null;
        let finalUserId = currentUser?.id || currentUser?.userId || user?.id || null;
        let finalUserName = currentUser?.full_name || currentUser?.name || user?.full_name || user?.name || 'کاربر سیستم';

        if (!finalWorkspaceId || !finalUserId) {
          try {
            const sessionStr = localStorage.getItem('workshop_auth_session');
            if (sessionStr) {
              const sessionData = JSON.parse(sessionStr);
              finalWorkspaceId = finalWorkspaceId || sessionData.workspace_id || sessionData.workspaceId || null;
              finalUserId = finalUserId || sessionData.id || sessionData.userId || null;
              finalUserName = finalUserName === 'کاربر سیستم' ? (sessionData.full_name || sessionData.name || 'کاربر سیستم') : finalUserName;
            }
          } catch(e) {
            console.error("Error reading session from localStorage", e);
          }
        }

        const safeAuth = await getSafeAuthContext();
        await logAuditAction({
            workspaceId: safeAuth.workspaceId,
            userId: safeAuth.userId,
            userName: safeAuth.userName,
          actionType: 'SUBMIT_SETTLEMENT',
          entityType: 'payments',
          entityId: settlementRecordId,
          projectId: currentProject?.id || DEFAULT_PROJECT_ID,
          
          
          
          details: {
            description: settlementMode === 'group' 
              ? `ثبت تسویه حساب گروهی برای ${groupMembers.length} نفر (گروه ${worker.groupName})`
              : `ثبت تسویه حساب / مساعده برای ${worker.name}`,
            amount: amountNum,
            worker_name: settlementMode === 'group' ? `گروه ${worker.groupName}` : worker.name
          }
        });

        // Settle covered attendance logs and advances
        if (markAsSettled) {
          if (settlementMode === 'group') {
            // Group settlement
            const advancesToSettle = groupCalculations.allGroupUnsettledPayments;
            if (advancesToSettle.length > 0) {
              const updatedAdv = advancesToSettle.map((p) => ({
                ...p,
                isSettled: true,
                settlementReceiptId: settlementRecordId,
                updatedAt: now.toISOString()
              }));
              await db.payments.bulkPut(updatedAdv);
            }

            if (isFullSettlement) {
              const logsToSettle = groupCalculations.allGroupUnsettledLogs.map((l) => ({
                ...l,
                isSettled: true,
                settlementReceiptId: settlementRecordId,
                updatedAt: now.toISOString()
              }));
              if (logsToSettle.length > 0) {
                await db.attendanceLogs.bulkPut(logsToSettle);
                pushLogsLive(logsToSettle).catch(console.warn);
              }
            } else {
              // Partial group settlement: chronologically settle logs up to payAmount + totalGroupAdvances
              let remainingBudget = payAmount + groupCalculations.totalGroupAdvances;
              const sortedGroupLogs = [...groupCalculations.allGroupUnsettledLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
              const logsToSettle = [];
              for (const l of sortedGroupLogs) {
                const cost = Number(l.totalDayPay) || 0;
                if (remainingBudget >= cost - 0.001) {
                  logsToSettle.push({
                    ...l,
                    isSettled: true,
                    settlementReceiptId: settlementRecordId,
                    updatedAt: now.toISOString()
                  });
                  remainingBudget -= cost;
                }
              }
              if (logsToSettle.length > 0) {
                await db.attendanceLogs.bulkPut(logsToSettle);
                pushLogsLive(logsToSettle).catch(console.warn);
              }
            }
          } else {
            // Individual worker settlement
            // Settle advances
            const advancesToSettle = individualCalculations.unsettledPayments;
            if (advancesToSettle.length > 0) {
              const updatedAdv = advancesToSettle.map((p) => ({
                ...p,
                isSettled: true,
                settlementReceiptId: settlementRecordId,
                updatedAt: now.toISOString()
              }));
              await db.payments.bulkPut(updatedAdv);
            }

            if (isFullSettlement) {
              // Full settlement: settle all open logs
              const logsToSettle = individualCalculations.unsettledLogs.map((l) => ({
                ...l,
                isSettled: true,
                settlementReceiptId: settlementRecordId,
                updatedAt: now.toISOString()
              }));
              if (logsToSettle.length > 0) {
                await db.attendanceLogs.bulkPut(logsToSettle);
                pushLogsLive(logsToSettle).catch(console.warn);
              }
            } else {
              // Partial settlement (FIFO chronological coverage)
              let coveredGrossBudget = payAmount + individualCalculations.advancesDeducted;
              const sortedLogs = [...individualCalculations.unsettledLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
              const logsToSettle = [];
              for (const l of sortedLogs) {
                const pay = Number(l.totalDayPay) || 0;
                if (coveredGrossBudget >= pay - 0.001) {
                  logsToSettle.push({
                    ...l,
                    isSettled: true,
                    settlementReceiptId: settlementRecordId,
                    updatedAt: now.toISOString()
                  });
                  coveredGrossBudget -= pay;
                }
              }
              if (logsToSettle.length > 0) {
                await db.attendanceLogs.bulkPut(logsToSettle);
                pushLogsLive(logsToSettle).catch(console.warn);
              }
            }
          }
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
      {/* Header with Mode & Strategy Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 space-y-3">
          
          {/* Top Bar: Icon, Titles & Close Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs ${
                settlementMode === 'group'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20'
              }`}>
                {settlementMode === 'group' ? <Users className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {settlementMode === 'group' ? 'تسویه حساب گروهی با سرپرست' : (t('settlementModalTitle') || 'تسویه حساب و پرداخت')}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    settlementTypeTab === 'auto'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300'
                  }`}>
                    {settlementTypeTab === 'auto' ? 'تسویه اتوماتیک' : 'تسویه با جزئیات'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-slate-400">
                    {settlementMode === 'group' 
                      ? `${activeGroup?.name || 'گروه کاری'} • سرپرست: ${supervisorWorker?.name || 'تعریف‌نشده'}`
                      : worker 
                        ? `${worker.name} • مانده کل مطالبات باز`
                        : 'انتخاب پرسنل جهت تسویه حساب'}
                  </p>
                  {settlementMode === 'individual' && worker && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalWorker(null);
                        if (onSelectWorker) onSelectWorker(null);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors flex items-center gap-1 shadow-xs"
                      title="انتخاب پرسنل دیگر"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>تغییر پرسنل</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="بستن (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Architecture Tab Switcher: Auto (Quick) vs Detailed (Custom) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSettlementTypeTab('auto')}
              className={`py-2.5 px-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                settlementTypeTab === 'auto'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Zap className={`w-4 h-4 ${settlementTypeTab === 'auto' ? 'text-emerald-500 fill-emerald-500' : 'text-slate-400'}`} />
              <div className="text-start">
                <span className="block font-black text-xs leading-none">تسویه اتوماتیک (سریع)</span>
                <span className="block text-[10px] font-normal text-slate-400 mt-0.5">تسویه کامل یا پرداخت مبلغ دلخواه بر اساس مانده کل طلب</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSettlementTypeTab('custom')}
              className={`py-2.5 px-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                settlementTypeTab === 'custom'
                  ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className={`w-4 h-4 ${settlementTypeTab === 'custom' ? 'text-sky-500' : 'text-slate-400'}`} />
              <div className="text-start">
                <span className="block font-black text-xs leading-none">تسویه با جزئیات (سفارشی)</span>
                <span className="block text-[10px] font-normal text-slate-400 mt-0.5">تسویه بر اساس بازه زمانی، بخش‌های پروژه یا آیتم‌های انتخابی</span>
              </div>
            </button>
          </div>

          {/* Group vs Individual Mode Switcher (Secondary Scope) */}
          {allGroups.length > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-xs">
              <span className="text-[11px] text-slate-400 font-semibold shrink-0">دامنه تسویه:</span>
              <div className="flex-1 flex items-center gap-1.5 p-0.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setSettlementMode('individual')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                    settlementMode === 'individual'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>تسویه فردی ({worker?.name || 'پرسنل'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettlementMode('group')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                    settlementMode === 'group'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 text-amber-300" />
                  <span>تسویه گروهی با سرپرست</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">
                    {allGroups.length}
                  </span>
                </button>
              </div>
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

        {/* If Individual Mode and No Worker Selected: Dedicated Personnel Selector */}
        {settlementMode === 'individual' && !worker ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-500" />
                    <span>انتخاب پرسنل برای تسویه حساب</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    پرسنل مورد نظر را انتخاب کنید تا مانده حساب و جزئیات تسویه بارگذاری شود:
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                  {convertDigits(filteredActiveWorkers.length, numberFormat)} نفر
                </span>
              </div>

              {/* Status Filter Buttons (Arrears vs All vs Settled) */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('with_arrears')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer ${
                    workerStatusFilter === 'with_arrears'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>فقط دارای معوقه</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    workerStatusFilter === 'with_arrears' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                  }`}>
                    {convertDigits(countWithArrears, numberFormat)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('all')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer ${
                    workerStatusFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>همه پرسنل</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                    {convertDigits(activeWorkersList.length, numberFormat)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('settled')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer ${
                    workerStatusFilter === 'settled'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تسویه شده</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    workerStatusFilter === 'settled' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                  }`}>
                    {convertDigits(countSettled, numberFormat)}
                  </span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی نام پرسنل، سمت، شماره تماس..."
                  value={workerSearchQuery}
                  onChange={(e) => setWorkerSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  autoFocus
                />
                {workerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setWorkerSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Workers Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredActiveWorkers.map((w) => {
                const fin = workerFinancialsMap.get(String(w.id)) || calculateWorkerFinancials(w, effectiveAllLogs, effectiveAllPayments, currency);
                const hasDue = (fin?.netBalanceDue || 0) > 0;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setLocalWorker(w);
                      if (onSelectWorker) onSelectWorker(w);
                    }}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all text-start group flex flex-col justify-between gap-3 relative overflow-hidden cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs ring-1 ring-emerald-500/20 group-hover:scale-105 transition-transform">
                          {w.name?.charAt(0) || 'ک'}
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {w.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {w.role || 'کارگر'} {w.phone ? `• ${w.phone}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        hasDue
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40'
                      }`}>
                        {hasDue ? 'دارای معوقه' : 'تسویه شده'}
                      </span>
                    </div>

                    {/* Financial Summary */}
                    <div className="w-full pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">مانده قابل تسویه:</span>
                      <span className={`font-black font-mono ${hasDue ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatCurrency(fin?.netBalanceDue || 0, currency, numberFormat)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredActiveWorkers.length === 0 && (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-slate-900 dark:text-white">
                    {workerStatusFilter === 'with_arrears'
                      ? 'هیچ پرسنلی دارای معوقه باز نیست'
                      : 'پرسنلی با این مشخصات یافت نشد'}
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {workerStatusFilter === 'with_arrears'
                      ? 'تمامی حساب‌های پرسنل تسویه شده‌اند و مانده بدهی بازی وجود ندارد.'
                      : 'لطفاً عبارت جستجو یا فیلتر وضعیت را تغییر دهید.'}
                  </p>
                </div>
                {workerStatusFilter === 'with_arrears' && (
                  <button
                    type="button"
                    onClick={() => setWorkerStatusFilter('all')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    مشاهده همه پرسنل
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ----------------------------------------------------------------- */}
            {/* CUSTOM / DETAILED TAB CONTENT */}
            {/* ----------------------------------------------------------------- */}
            {settlementTypeTab === 'custom' ? (
          <div className="mt-2 space-y-4">
            
            {/* Worker Selector (if individual mode) */}
            {settlementMode === 'individual' && allWorkers.length > 1 && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {language === 'ku' ? 'هەڵبژاردنی کرێکار بۆ پاکتاو:' : 'انتخاب پرسنل جهت تسویه سفارشی:'}
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-xs"
                >
                  {allWorkers.filter(w => !w.deletedAt && !w.isArchived).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.role ? `(${w.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 1. Filter Control Box */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-xs">
              
              {/* Date Range Inputs & Shortcuts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CalendarRange className="w-4 h-4 text-sky-500" />
                    <span>فیلتر بازه زمانی دلخواه:</span>
                  </label>
                  {(customStartDate || customEndDate) && (
                    <button
                      type="button"
                      onClick={handleDatePresetClear}
                      className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>پاک کردن بازه</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      از تاریخ (شروع بازه):
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      تا تاریخ (پایان بازه):
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-slate-400">میانبرهای بازه:</span>
                  <button
                    type="button"
                    onClick={handleDatePresetPrevMonth}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    کل ماه قبل
                  </button>
                  <button
                    type="button"
                    onClick={handleDatePresetCurrentMonth}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    ماه جاری
                  </button>
                  <button
                    type="button"
                    onClick={handleDatePresetFirst15}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    ۱۵ روز اول ماه
                  </button>
                  <button
                    type="button"
                    onClick={handleDatePresetSecond15}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    ۱۵ روز دوم ماه
                  </button>
                </div>
              </div>

              {/* Financial Component Selector & Section Filter */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Financial Component Mode (All vs Base Wage vs Overtime Only) */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    نوع مؤلفه مالی جهت تسویه:
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setFinancialComponent('all')}
                      className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                        financialComponent === 'all'
                          ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      همه آیتم‌ها
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancialComponent('wage_only')}
                      className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                        financialComponent === 'wage_only'
                          ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      فقط روزمزد
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancialComponent('ot_only')}
                      className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                        financialComponent === 'ot_only'
                          ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      فقط اضافه کاری
                    </button>
                  </div>
                </div>

                {/* Project Section Filter */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    فیلتر بر اساس بخش پروژه:
                  </label>
                  <select
                    value={customSelectedSection}
                    onChange={(e) => setCustomSelectedSection(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="all">همه بخش‌های کارگاه</option>
                    {distinctSections.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Deduct Advances Checkbox */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductAdvances}
                    onChange={(e) => setDeductAdvances(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      کسر مساعده‌های باز پرسنل ({formatAmount(individualCalculations.advancesDeducted, currency, numberFormat)} {getCurrencySymbol(currency, language)})
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {deductAdvances
                        ? 'مساعده‌های باز به نسبت این تسویه کسر خواهند شد.'
                        : 'با غیرفعال کردن، کل کارکرد بدون کسر مساعده پرداخت می‌شود.'}
                    </span>
                  </div>
                </label>
              </div>

            </div>

            {/* 2. Selectable Items List / Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              
              {/* Table Header with Batch Actions */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCustomLogs.length === customFilteredLogs.length) {
                        deselectAllFilteredLogs();
                      } else {
                        selectAllFilteredLogs();
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600"
                  >
                    {selectedCustomLogs.length === customFilteredLogs.length && customFilteredLogs.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-sky-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>
                      {selectedCustomLogs.length === customFilteredLogs.length && customFilteredLogs.length > 0
                        ? 'لغو انتخاب همه'
                        : 'انتخاب همه روزها'}
                    </span>
                  </button>
                  <span className="text-[11px] text-slate-400 font-medium">
                    ({convertDigits(selectedCustomLogs.length, numberFormat)} از {convertDigits(customFilteredLogs.length, numberFormat)} روز انتخاب شده)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllFilteredLogs}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 border border-slate-200 dark:border-slate-600 hover:bg-sky-50"
                  >
                    انتخاب همه
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllFilteredLogs}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                  >
                    لغو همه
                  </button>
                </div>
              </div>

              {/* Item Rows */}
              {customFilteredLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  هیچ رکوردی منطبق با فیلترهای انتخابی یافت نشد.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 hide-scrollbar">
                  {customFilteredLogs.map((l) => {
                    const isSelected = selectedLogIds.has(String(l.id || l.date));
                    const logPay = computeLogPayForComponent(l, financialComponent);
                    return (
                      <div
                        key={l.id || l.date}
                        onClick={() => toggleLogSelection(l.id || l.date)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-sky-50/40 dark:bg-sky-950/20 hover:bg-sky-50/70 dark:hover:bg-sky-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div onClick
                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                {convertDigits(l.date, numberFormat)}
                              </span>
                              {l.section && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {l.section}
                                </span>
                              )}
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                l.type === 'hourly' 
                                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300' 
                                  : l.type === 'half'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {l.type === 'half' ? 'نیم‌روز' : l.type === 'hourly' ? 'ساعتی' : 'کامل'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {l.overtimeHours > 0 && `اضافه کاری: +${formatHoursAndMinutes(l.overtimeHours, language)}`}
                            </span>
                          </div>
                        </div>

                        <div className="text-end">
                          <span className="font-black text-slate-900 dark:text-white font-mono block">
                            {formatAmount(logPay, currency, numberFormat)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {getCurrencySymbol(currency, language)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* 3. Live Dynamic Summary Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/30 border border-sky-200 dark:border-sky-800/60 space-y-2.5 shadow-xs">
              
              <div className="flex items-center justify-between text-xs font-bold text-sky-900 dark:text-sky-200">
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>تراز مالی اقلام منتخب ({convertDigits(selectedCustomLogs.length, numberFormat)} روز کاری):</span>
                </span>
                <span className="text-[11px] text-sky-700 dark:text-sky-300 font-mono">
                  جمع ناخالص: {formatAmount(customSelectedGross, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                </span>
              </div>

              {customAdvancesToDeduct > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 font-semibold">
                  <span>(-) مساعده‌های کسرشده در این تسویه:</span>
                  <span className="font-mono">
                    {formatAmount(customAdvancesToDeduct, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-sky-200/80 dark:border-sky-800/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    مبلغ خالص قابل پرداخت این تسویه سفارشی:
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    این مبلغ خودکار در فیلد پرداختی زیر تنظیم شده است.
                  </span>
                </div>
                <div className="text-end">
                  <span className="text-lg sm:text-xl font-black text-sky-700 dark:text-sky-300 font-mono block">
                    {formatAmount(customNetPayable, currency, numberFormat)}
                  </span>
                  <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                    {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* ----------------------------------------------------------------- */
          /* AUTO / QUICK TAB CONTENT */
          /* ----------------------------------------------------------------- */
          <div className="space-y-3.5">
            
            {/* GROUP SETTLEMENT SPECIFIC */}
            {settlementMode === 'group' ? (
              <div className="space-y-3">
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
              /* INDIVIDUAL SETTLEMENT SPECIFIC */
              <div className="space-y-3.5">
                
                {/* Worker Selector Dropdown */}
                {allWorkers.length > 1 && (
                  <div className="space-y-1">
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

                {/* Workers With Arrears Horizontal Picker */}
                {arrearsList.length > 0 && onSelectWorker && (
                  <div className="space-y-1.5">
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

                {/* 1. Transparent Financial Balance KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Gross Earnings Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span className="text-[11px] font-bold">کل کارکرد ناخالص باز</span>
                      <FileText className="w-4 h-4 text-sky-500" />
                    </div>
                    <div className="mt-2">
                      <span className="text-base font-black text-slate-900 dark:text-white block font-mono">
                        {formatAmount(individualCalculations.grossEarnings, currency, numberFormat)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                        {convertDigits(individualCalculations.effectiveDays, numberFormat)} روز کاری
                        {individualCalculations.otHours > 0 && ` + ${formatHoursAndMinutes(individualCalculations.otHours, language)}`}
                      </span>
                    </div>
                  </div>

                  {/* Deducted Advances Card */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                      <span className="text-[11px] font-bold">مساعده‌های باز کسرشده</span>
                      <Coins className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="mt-2">
                      <span className="text-base font-black text-amber-700 dark:text-amber-300 block font-mono">
                        {formatAmount(individualCalculations.advancesDeducted, currency, numberFormat)}
                      </span>
                      <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium block mt-0.5">
                        {convertDigits(individualCalculations.unsettledPayments.length, numberFormat)} فقره مساعده جاری
                      </span>
                    </div>
                  </div>

                  {/* Net Due Final Cumulative Balance Card */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 flex flex-col justify-between sm:col-span-1">
                    <div className="flex items-center justify-between text-emerald-100">
                      <span className="text-[11px] font-bold">مانده نهایی سررسید (طلب خالص)</span>
                      <Calculator className="w-4 h-4 text-white" />
                    </div>
                    <div className="mt-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-white font-mono">
                          {formatAmount(individualCalculations.totalCumulativeDebt, currency, numberFormat)}
                        </span>
                        <span className="text-xs font-semibold text-emerald-100">
                          {getCurrencySymbol(currency, language)}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-100 block mt-0.5">
                        مجموع مطالبات تا تاریخ امروز
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Settlement Mode / Options Selector in Auto Tab */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    گزینه‌های پرداخت در تسویه اتوماتیک:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option A: Full Settlement */}
                    <button
                      type="button"
                      onClick={handleSelectFullSettlement}
                      className={`p-3 rounded-xl border text-start transition-all flex items-start gap-2.5 ${
                        settleOption === 'full' && Number(normalizeDigits(finalPaymentAmount)) >= (targetPayableAmount - 0.001)
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        settleOption === 'full' && Number(normalizeDigits(finalPaymentAmount)) >= (targetPayableAmount - 0.001)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          حالت ۱: تسویه کامل کل طلب (۱۰۰٪)
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          تسویه تمامی روزهای باز و رساندن مانده کل طلب پرسنل به ۰
                        </span>
                      </div>
                    </button>

                    {/* Option B: Partial Custom Settlement */}
                    <button
                      type="button"
                      onClick={handleSelectPartialSettlement}
                      className={`p-3 rounded-xl border text-start transition-all flex items-start gap-2.5 ${
                        settleOption === 'partial' || Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001)
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-700 ring-2 ring-sky-500/20 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        settleOption === 'partial' || Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001)
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}>
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          حالت ۲: پرداخت مبلغ دلخواه (تسویه جزئی)
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          ورود رقم دلخواه، پوشش ترتیبی روزها (FIFO) و باقی‌ماندن مابقی در معوقه
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-slate-400">میانبرهای سریع مبلغ:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('full')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      تسویه کامل (۱۰۰٪)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('half')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      ۵۰٪ مبلغ طلب
                    </button>
                    {targetPayableAmount >= 50000 && (
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('round50k')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        رند کردن به ۵۰ هزار
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Live Remaining Balance Due Display (کادر محاسباتی زنده) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  {Number(normalizeDigits(finalPaymentAmount)) >= (targetPayableAmount - 0.001) ? (
                    <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      <div>
                        <span>تسویه کامل: مانده طلب پرسنل پس از ثبت این پرداخت صفر (۰) خواهد شد.</span>
                        <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                          تمام روزهای کارکرد باز تسویه و بسته می‌شوند.
                        </span>
                      </div>
                    </div>
                  ) : Number(normalizeDigits(finalPaymentAmount)) > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-500" />
                          <span>مانده طلب پرسنل پس از این پرداخت:</span>
                        </span>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-300 font-mono">
                          {formatAmount(Math.max(0, targetPayableAmount - Number(normalizeDigits(finalPaymentAmount))), currency, numberFormat)} {getCurrencySymbol(currency, language)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        فرمول محاسبه: مانده کل ({formatAmount(targetPayableAmount, currency, numberFormat)}) - پرداختی ({formatAmount(Number(normalizeDigits(finalPaymentAmount)), currency, numberFormat)}) = مانده معوقه جدید
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 font-medium">
                      مبلغ مورد نظر برای پرداخت را در کادر زیر وارد کنید.
                    </div>
                  )}
                </div>

                {/* 4. Collapsible Unsettled Days List (FIFO Order) */}
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsLogsAccordionOpen((prev) => !prev)}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-start"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <FileText className="w-4 h-4 text-sky-500" />
                      <span>ریز روزهای کارکرد تسویه‌نشده ({convertDigits(individualCalculations.unsettledLogs.length, numberFormat)} روز)</span>
                      {Number(normalizeDigits(finalPaymentAmount)) > 0 && Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001) && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-bold">
                          تسویه ترتیبی (FIFO)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <span>{isLogsAccordionOpen ? 'بستن لیست' : 'مشاهده لیست'}</span>
                      {isLogsAccordionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isLogsAccordionOpen && (
                    <div className="p-3.5 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      {individualCalculations.unsettledLogs.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 font-medium">
                          تمامی روزهای کارکرد قبلی تسویه شده‌اند و روز تسویه‌نشده‌ای وجود ندارد.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1 hide-scrollbar mt-2">
                          {individualCalculations.unsettledLogs.map((l) => {
                            const isCovered = coveredLogIds.has(l.id || l.date);
                            return (
                              <div 
                                key={l.id || l.date} 
                                className={`flex items-center justify-between p-2.5 rounded-xl border text-[11px] transition-colors ${
                                  isCovered
                                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50'
                                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 opacity-80'
                                }`}
                              >
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
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    isCovered
                                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                                  }`}>
                                    {isCovered ? 'پوشش داده شده' : 'معوقه باز'}
                                  </span>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white font-mono">
                                  {formatAmount(l.totalDayPay, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

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
                  {settlementMode === 'group' 
                    ? 'مبلغ نهایی پرداختی به سرپرست' 
                    : settlementTypeTab === 'custom'
                    ? 'مبلغ پرداختی این تسویه سفارشی'
                    : t('finalPaymentAmount')}
                </label>
                {isAmountManuallyEdited && Number(normalizeDigits(finalPaymentAmount)) !== Number(activeTabTargetPayable) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFinalPaymentAmount(activeTabTargetPayable > 0 ? String(activeTabTargetPayable) : '0');
                      setIsAmountManuallyEdited(false);
                    }}
                    className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-bold flex items-center gap-1"
                  >
                    بازنشانی به کل مبلغ ({formatAmount(activeTabTargetPayable, currency, numberFormat)})
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
                    settlementTypeTab === 'custom'
                      ? 'border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 focus:ring-sky-500'
                      : settlementMode === 'group'
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
            settlementTypeTab === 'custom'
              ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-800/60'
              : settlementMode === 'group'
              ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60'
              : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60'
          }`}>
            <input
              type="checkbox"
              checked={markAsSettled}
              onChange={(e) => setMarkAsSettled(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {settlementTypeTab === 'custom'
                ? `بستن و علامت‌گذاری قطعی فقط برای ${convertDigits(selectedCustomLogs.length, numberFormat)} روز انتخاب‌شده (سایر روزها باز می‌مانند)`
                : settlementMode === 'group'
                ? (Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001)
                    ? `بستن کارکردهای پوشش‌داده‌شده با این مبلغ (مانده کارکردها به عنوان معوقه ثبت خواهند شد)`
                    : `تسویه قطعی و بستن کارکرد باز تمام ${groupMembers.length} نفر اعضای گروه`)
                : (Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001)
                    ? `بستن روزهای پوشش‌داده‌شده با این مبلغ (مانده ${formatAmount(Math.max(0, targetPayableAmount - Number(normalizeDigits(finalPaymentAmount))), currency, numberFormat)} ${getCurrencySymbol(currency, language)} به عنوان معوقه باقی می‌ماند)`
                    : (t('markAsSettledCheckbox') || 'علامت‌گذاری این روزها به عنوان تسویه‌شده قطعی'))}
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
              onClick={handleCloseModal}
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
                  : settlementTypeTab === 'custom'
                  ? 'bg-sky-600 hover:bg-sky-500 disabled:bg-sky-400 text-white shadow-sky-600/20'
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
                      : settlementTypeTab === 'custom'
                      ? `ثبت تسویه با جزئیات (${convertDigits(selectedCustomLogs.length, numberFormat)} روز)`
                      : t('settleBtn')}
                  </span>
                </>
              )}
            </button>
          </div>

        </form>
        </>
        )}

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
