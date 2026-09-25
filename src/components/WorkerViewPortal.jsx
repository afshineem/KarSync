import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { pullRemoteChangesSilently } from '../services/realtimeSync';
import { 
  formatAmount, 
  formatHoursAndMinutes, 
  getCurrentYearMonth, 
  roundCurrency, 
  getCurrencySymbol 
} from '../utils/formatters';
import { calculateWorkerFinancials } from '../utils/settlementCalculations.js';
import { 
  User, 
  LogOut, 
  Calendar, 
  Clock, 
  Coins, 
  Briefcase, 
  Printer, 
  ChevronRight, 
  ChevronLeft, 
  Sun, 
  Moon, 
  FileText,
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  WalletCards, 
  Banknote, 
  Receipt, 
  ArrowDownLeft, 
  ArrowUpRight,
  Users,
  Archive,
  Search,
  Layers,
  Sparkles,
  X,
  BadgeAlert
} from 'lucide-react';

export function WorkerViewPortal({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const { t, language, changeLanguage, direction } = useLanguage();

  // Mode for supervisors: 'personal' (حساب و کارکرد شخصی من) | 'group' (پنل سرپرستی گروه)
  const [portalMode, setPortalMode] = useState('personal');

  // Subordinate selection in group mode: 'all' or workerId
  const [selectedSubordinateId, setSelectedSubordinateId] = useState('all');

  // Period Tab: 'all' (سوابق و کل کارکرد) | 'current' (کارکرد جاری و مطالبات معوقه) | 'settled' (سوابق تسویه شده)
  const [periodTab, setPeriodTab] = useState('all');

  // Proactively pull fresh cloud attendance logs and workers when portal opens
  useEffect(() => {
    if (navigator.onLine) {
      pullRemoteChangesSilently(true).catch(() => {});
    }
  }, []);

  // Month navigation for historical settled records
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());

  // Timesheet search input
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Live Queries from Dexie
  const worker = useLiveQuery(
    () => (user?.workerId ? db.workers.get(user.workerId) : null),
    [user?.workerId]
  );

  const project = useLiveQuery(
    () => db.projects.get(worker?.projectId || DEFAULT_PROJECT_ID),
    [worker?.projectId]
  );
  const currency = project?.currency || 'IQD';

  const allWorkers = useLiveQuery(() => db.workers.toArray()) || [];
  const allGroups = useLiveQuery(() => db.groups.toArray()) || [];
  const allLogs = useLiveQuery(() => db.attendanceLogs.toArray()) || [];
  const allPayments = useLiveQuery(() => db.payments.toArray()) || [];

  // 2. Identify Worker Group & Supervisor Status
  const workerGroup = useMemo(() => {
    if (!worker?.groupId) return null;
    return allGroups.find((g) => String(g.id) === String(worker.groupId)) || null;
  }, [allGroups, worker?.groupId]);

  const isSupervisor = useMemo(() => {
    if (!worker) return false;
    const roleLower = (worker.role || '').toLowerCase();
    const isMasterRole = worker.teamRole === 'Master' || 
                         roleLower.includes('سرپرست') || 
                         roleLower.includes('استادکار') || 
                         roleLower.includes('master');
    return isMasterRole && !!worker.groupId;
  }, [worker]);

  // Group members including active and archived workers (Requirements 2 & 2.1)
  const groupMembers = useMemo(() => {
    if (!worker?.groupId) return [];
    return allWorkers
      .filter((w) => !w.deletedAt && String(w.groupId) === String(worker.groupId))
      .sort((a, b) => {
        // Master / Supervisor first
        if (a.teamRole === 'Master' && b.teamRole !== 'Master') return -1;
        if (b.teamRole === 'Master' && a.teamRole !== 'Master') return 1;
        // Active before archived
        const aArchived = a.isArchived || a.status === 'archived';
        const bArchived = b.isArchived || b.status === 'archived';
        if (!aArchived && bArchived) return -1;
        if (aArchived && !bArchived) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [allWorkers, worker?.groupId]);

  // 3. Robust Financial Calculations (Aligned with FinancialsView logic)
  const personalFinancials = useMemo(() => {
    if (!worker) return null;
    return calculateWorkerFinancials(worker, allLogs, allPayments, currency);
  }, [worker, allLogs, allPayments, currency]);

  // Calculate financials for each subordinate in supervisor's group
  const groupMembersFinancials = useMemo(() => {
    if (!isSupervisor || groupMembers.length === 0) return [];
    return groupMembers.map((m) => {
      const fin = calculateWorkerFinancials(m, allLogs, allPayments, currency);
      return {
        member: m,
        ...fin
      };
    });
  }, [isSupervisor, groupMembers, allLogs, allPayments, currency]);

  // Aggregated group totals across all dimensions (All-Time, Current Open, and Settled)
  const groupAggregates = useMemo(() => {
    let totalUnsettledGross = 0;
    let totalUnsettledAdvances = 0;
    let totalNetBalanceDue = 0;
    let totalEffectiveDays = 0;
    let totalOtHours = 0;

    let totalSettledGross = 0;
    let totalSettledAdvances = 0;
    let totalSettledPaid = 0;
    let totalSettledEffectiveDays = 0;
    let totalSettledOtHours = 0;

    let totalAllTimeGross = 0;
    let totalAllTimeEffectiveDays = 0;
    let totalAllTimeOtHours = 0;

    let activeCount = 0;
    let archivedCount = 0;

    groupMembersFinancials.forEach((item) => {
      const isArchived = item.member.isArchived || item.member.status === 'archived';
      if (isArchived) archivedCount++;
      else activeCount++;

      // Unsettled / Open Period
      totalUnsettledGross += item.unsettledGross;
      totalUnsettledAdvances += item.unsettledAdvances;
      totalNetBalanceDue += item.netBalanceDue;
      totalEffectiveDays += item.effectiveDays;
      totalOtHours += item.otHours;

      // Settled Historical Period
      totalSettledGross += item.settledGross;
      totalSettledAdvances += item.settledAdvances;
      totalSettledPaid += (item.totalSettlementPaid || 0) + (item.settledAdvances || 0);
      totalSettledEffectiveDays += item.settledEffectiveDays;
      totalSettledOtHours += item.settledOtHours;

      // Combined All-Time
      totalAllTimeGross += (item.unsettledGross + item.settledGross);
      totalAllTimeEffectiveDays += (item.effectiveDays + item.settledEffectiveDays);
      totalAllTimeOtHours += (item.otHours + item.settledOtHours);
    });

    return {
      totalMembers: groupMembers.length,
      activeCount,
      archivedCount,
      // Open / Current
      totalUnsettledGross: roundCurrency(totalUnsettledGross, currency),
      totalUnsettledAdvances: roundCurrency(totalUnsettledAdvances, currency),
      totalNetBalanceDue: roundCurrency(totalNetBalanceDue, currency),
      totalEffectiveDays,
      totalOtHours,
      // Settled
      totalSettledGross: roundCurrency(totalSettledGross, currency),
      totalSettledAdvances: roundCurrency(totalSettledAdvances, currency),
      totalSettledPaid: roundCurrency(totalSettledPaid, currency),
      totalSettledEffectiveDays,
      totalSettledOtHours,
      // Combined All-Time
      totalAllTimeGross: roundCurrency(totalAllTimeGross, currency),
      totalAllTimeEffectiveDays,
      totalAllTimeOtHours
    };
  }, [groupMembersFinancials, groupMembers.length, currency]);

  // Currently focused subordinate (when specific worker is selected in group mode)
  const activeSubordinateData = useMemo(() => {
    if (selectedSubordinateId === 'all') return null;
    return groupMembersFinancials.find((gf) => String(gf.member.id) === String(selectedSubordinateId)) || null;
  }, [groupMembersFinancials, selectedSubordinateId]);

  // 4. Timesheet Logs to Display
  const displayedLogs = useMemo(() => {
    let list = [];
    if (portalMode === 'personal') {
      if (!personalFinancials) return [];
      if (periodTab === 'all') {
        list = [...personalFinancials.unsettledLogs, ...personalFinancials.settledLogs];
      } else if (periodTab === 'current') {
        list = personalFinancials.unsettledLogs;
      } else {
        list = personalFinancials.settledLogs;
      }
    } else {
      // Group Mode
      if (selectedSubordinateId === 'all') {
        groupMembersFinancials.forEach((gf) => {
          let logs = [];
          if (periodTab === 'all') {
            logs = [...gf.unsettledLogs, ...gf.settledLogs];
          } else if (periodTab === 'current') {
            logs = gf.unsettledLogs;
          } else {
            logs = gf.settledLogs;
          }
          logs.forEach((l) => {
            list.push({
              ...l,
              workerName: gf.member.name,
              workerRole: gf.member.role,
              workerDailyRate: gf.member.dailyRate,
              workerTeamRole: gf.member.teamRole,
              isWorkerArchived: gf.member.isArchived || gf.member.status === 'archived'
            });
          });
        });
      } else if (activeSubordinateData) {
        let logs = [];
        if (periodTab === 'all') {
          logs = [...activeSubordinateData.unsettledLogs, ...activeSubordinateData.settledLogs];
        } else if (periodTab === 'current') {
          logs = activeSubordinateData.unsettledLogs;
        } else {
          logs = activeSubordinateData.settledLogs;
        }
        logs.forEach((l) => {
          list.push({
            ...l,
            workerName: activeSubordinateData.member.name,
            workerRole: activeSubordinateData.member.role,
            workerDailyRate: activeSubordinateData.member.dailyRate,
            workerTeamRole: activeSubordinateData.member.teamRole,
            isWorkerArchived: activeSubordinateData.member.isArchived || activeSubordinateData.member.status === 'archived'
          });
        });
      }
    }

    // Deduplicate by log ID or composite key
    const seenKeys = new Set();
    list = list.filter((l) => {
      const key = l.id || `${l.workerId}_${l.date}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    // Sort by date descending (newest first)
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Apply search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((l) =>
        (l.date || '').includes(q) ||
        (l.workerName || '').toLowerCase().includes(q) ||
        (l.notes || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [portalMode, periodTab, selectedSubordinateId, personalFinancials, groupMembersFinancials, activeSubordinateData, searchQuery]);

  // 5. Payment Records to Display
  const displayedPayments = useMemo(() => {
    let list = [];
    if (portalMode === 'personal') {
      if (!personalFinancials) return [];
      if (periodTab === 'current') {
        list = personalFinancials.unsettledPayments;
      } else {
        list = [...personalFinancials.settledPayments, ...personalFinancials.settlementReceipts];
      }
    } else {
      // Group Mode
      const targetWorkerIds = selectedSubordinateId === 'all'
        ? new Set(groupMembers.map((m) => String(m.id)))
        : new Set([String(selectedSubordinateId)]);

      const workerMap = {};
      groupMembers.forEach((m) => { workerMap[String(m.id)] = m; });

      list = allPayments
        .filter((p) => {
          if (p.deletedAt) return false;
          const matchesWorker = targetWorkerIds.has(String(p.workerId));
          const matchesGroup = worker?.groupId && p.groupId === worker.groupId;
          if (!matchesWorker && !matchesGroup) return false;

          const pSettled = p.isSettled || p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled';
          if (periodTab === 'current') {
            return !pSettled;
          } else {
            return pSettled;
          }
        })
        .map((p) => ({
          ...p,
          workerName: workerMap[String(p.workerId)]?.name || (p.groupId ? (workerGroup?.name || 'گروه') : '—')
        }));
    }

    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [portalMode, periodTab, selectedSubordinateId, personalFinancials, groupMembers, allPayments, worker?.groupId, workerGroup]);

  // Shift month helper for historical records
  const handleShiftMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const getDayName = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'en' ? 'en-US' : 'fa-IR', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  // Helper labels in multiple languages
  const labels = {
    myPersonalAccount: language === 'ku' ? 'حیساب و کارکردی کەسی من' : language === 'en' ? 'My Personal Account' : 'حساب و کارکرد شخصی من',
    groupManagement: language === 'ku' ? 'بەڕێوەبردنی گرووپ' : language === 'en' ? 'Group Management' : 'مدیریت و زیرمجموعه گروه',
    allTab: language === 'ku' ? 'سەرجەم کارکرد و سوابق' : language === 'en' ? 'All Work & History' : 'سوابق و کل کارکرد',
    currentTab: language === 'ku' ? 'کارکردی ئێستا و قەرزی تەسویەنەکراو' : language === 'en' ? 'Current Unsettled' : 'کارکرد جاری و مطالبات معوقه',
    settledTab: language === 'ku' ? 'مێژووی تەسویەکراو' : language === 'en' ? 'Settled History' : 'سوابق تسویه شده',
    allGroupMembers: language === 'ku' ? 'سەرجەم ئەندامانی گرووپ (کۆی گشتی)' : language === 'en' ? 'All Group Members (Aggregated)' : 'همه اعضای گروه (نمای تجمیعی)',
    totalGroupMembers: language === 'ku' ? 'کۆی کرێکارانی گرووپ' : language === 'en' ? 'Total Group Members' : 'کل پرسنل گروه',
    totalGroupDue: language === 'ku' ? 'کۆی شایستەی ماوەی گرووپ' : language === 'en' ? 'Total Group Net Due' : 'مجموع مطالبات معوقه گروه',
    totalGroupDays: language === 'ku' ? 'کۆی ڕۆژەکانی گرووپ' : language === 'en' ? 'Group Total Days' : 'مجموع روزهای کاری گروه',
    totalGroupOt: language === 'ku' ? 'کۆی کاتژمێری سەروەختی گرووپ' : language === 'en' ? 'Group Overtime Hours' : 'مجموع اضافه‌کاری گروه',
    archivedMemberNotice: language === 'ku' ? 'ئەم کرێکارە ئەرشیڤ کراوە بەڵام مێژووەکەی پارێزراوە' : language === 'en' ? 'This worker is archived, but history is preserved.' : 'این شخص توسط مدیریت بایگانی شده، اما سوابق آن در دسترس است.',
    archivedBadge: language === 'ku' ? 'ئەرشیڤ کراو' : language === 'en' ? 'Archived' : 'بایگانی‌شده',
    masterRole: language === 'ku' ? 'وەستا (سەرپەرشتیار)' : language === 'en' ? 'Master (Supervisor)' : 'استادکار (سرپرست)',
    workerRoleLabel: language === 'ku' ? 'کرێکار' : language === 'en' ? 'Worker' : 'کارگر',
    unsettledBadge: language === 'ku' ? 'جاری / تەسویەنەکراو' : language === 'en' ? 'Unsettled' : 'جاری / معوقه',
    settledBadge: language === 'ku' ? 'تەسویەکراو' : language === 'en' ? 'Settled' : 'تسویه‌شده',
    searchLogsPlaceholder: language === 'ku' ? 'گەڕان بەپێی بەروار، ناو یان تێبینی...' : language === 'en' ? 'Search by date, name or notes...' : 'جستجو بر اساس تاریخ، نام یا یادداشت...',
  };

  if (!worker) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-lg max-w-sm w-full">
          <div className="w-12 h-12 rounded-full border-4 border-sky-500 border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
            {language === 'ku' ? 'زانیارییەکان لە دیتابەیس دەخوێندرێنەوە...' : 'در حال بارگذاری اطلاعات پرسنل...'}
          </p>
        </div>
      </div>
    );
  }

  // Active metrics to display in 4-Card Grid
  const activeMetrics = portalMode === 'personal'
    ? {
        titleDays: t('totalMonthWorkedDays') || 'روزهای کارکرد',
        days: periodTab === 'all'
          ? ((personalFinancials?.effectiveDays || 0) + (personalFinancials?.settledEffectiveDays || 0))
          : periodTab === 'current'
          ? (personalFinancials?.effectiveDays || 0)
          : (personalFinancials?.settledEffectiveDays || 0),
        daysSub: `(${
          periodTab === 'all'
            ? ((personalFinancials?.fullDays || 0) + (personalFinancials?.settledFullDays || 0))
            : periodTab === 'current'
            ? (personalFinancials?.fullDays || 0)
            : (personalFinancials?.settledFullDays || 0)
        } ${t('fullDayWork') || 'روز کامل'})`,
        titleEarnings: t('totalCalculatedPayroll') || 'کل حقوق کارکرد',
        earnings: periodTab === 'all'
          ? ((personalFinancials?.unsettledGross || 0) + (personalFinancials?.settledGross || 0))
          : periodTab === 'current'
          ? (personalFinancials?.unsettledGross || 0)
          : (personalFinancials?.settledGross || 0),
        titleAdvances: periodTab === 'all'
          ? (t('totalPaid') || 'کل دریافتی و تسویه')
          : periodTab === 'current'
          ? (t('totalPaidAdvances') || 'مساعده و دریافتی')
          : (t('totalPaid') || 'مجموع تسویه شده'),
        advances: periodTab === 'all'
          ? ((personalFinancials?.unsettledAdvances || 0) + (personalFinancials?.totalSettlementPaid || 0) + (personalFinancials?.settledAdvances || 0))
          : periodTab === 'current'
          ? (personalFinancials?.unsettledAdvances || 0)
          : ((personalFinancials?.totalSettlementPaid || 0) + (personalFinancials?.settledAdvances || 0)),
        titleDue: t('netBalanceDue') || 'مانده معوقه طلب',
        due: (personalFinancials?.netBalanceDue || 0),
        isSettled: (personalFinancials?.netBalanceDue || 0) <= 0
      }
    : selectedSubordinateId === 'all'
    ? {
        titleDays: labels.totalGroupDays,
        days: periodTab === 'all'
          ? groupAggregates.totalAllTimeEffectiveDays
          : periodTab === 'current'
          ? groupAggregates.totalEffectiveDays
          : groupAggregates.totalSettledEffectiveDays,
        daysSub: `${
          periodTab === 'all'
            ? groupAggregates.totalAllTimeOtHours
            : periodTab === 'current'
            ? groupAggregates.totalOtHours
            : groupAggregates.totalSettledOtHours
        } ${t('hoursLabel') || 'ساعت'} اضافه‌کاری`,
        titleEarnings: periodTab === 'all'
          ? (language === 'ku' ? 'کۆی گشتی کارکردی گرووپ' : 'مجموع کل کارکرد ناخالص گروه')
          : periodTab === 'current'
          ? (language === 'ku' ? 'کارکردی ئێستای گرووپ' : 'کارکرد جاری ناخالص گروه')
          : (language === 'ku' ? 'کارکردی تەسویەکراوی گرووپ' : 'کارکرد تسویه شده گروه'),
        earnings: periodTab === 'all'
          ? groupAggregates.totalAllTimeGross
          : periodTab === 'current'
          ? groupAggregates.totalUnsettledGross
          : groupAggregates.totalSettledGross,
        titleAdvances: periodTab === 'all'
          ? (language === 'ku' ? 'کۆی پارەی دراو' : 'مجموع کل پرداختی و تسویه‌ها')
          : periodTab === 'current'
          ? (language === 'ku' ? 'کۆی پێشەکییەکان' : 'مساعده‌های جاری گروه')
          : (language === 'ku' ? 'کۆی تەسویەی دراو' : 'مجموع تسویه‌های پرداخت‌شده'),
        advances: periodTab === 'all'
          ? (groupAggregates.totalUnsettledAdvances + groupAggregates.totalSettledPaid)
          : periodTab === 'current'
          ? groupAggregates.totalUnsettledAdvances
          : groupAggregates.totalSettledPaid,
        titleDue: labels.totalGroupDue,
        due: groupAggregates.totalNetBalanceDue,
        isSettled: groupAggregates.totalNetBalanceDue <= 0
      }
    : {
        titleDays: `${activeSubordinateData?.member.name}: ${t('totalMonthWorkedDays') || 'روزها'}`,
        days: periodTab === 'all'
          ? ((activeSubordinateData?.effectiveDays || 0) + (activeSubordinateData?.settledEffectiveDays || 0))
          : periodTab === 'current'
          ? (activeSubordinateData?.effectiveDays || 0)
          : (activeSubordinateData?.settledEffectiveDays || 0),
        daysSub: `(${
          periodTab === 'all'
            ? ((activeSubordinateData?.fullDays || 0) + (activeSubordinateData?.settledFullDays || 0))
            : periodTab === 'current'
            ? (activeSubordinateData?.fullDays || 0)
            : (activeSubordinateData?.settledFullDays || 0)
        } ${t('fullDayWork') || 'روز کامل'})`,
        titleEarnings: t('totalCalculatedPayroll') || 'حقوق کارکرد',
        earnings: periodTab === 'all'
          ? ((activeSubordinateData?.unsettledGross || 0) + (activeSubordinateData?.settledGross || 0))
          : periodTab === 'current'
          ? (activeSubordinateData?.unsettledGross || 0)
          : (activeSubordinateData?.settledGross || 0),
        titleAdvances: periodTab === 'all'
          ? (t('totalPaid') || 'کل دریافتی و تسویه')
          : periodTab === 'current'
          ? (t('totalPaidAdvances') || 'مساعده و دریافتی')
          : (t('totalPaid') || 'تسویه شده'),
        advances: periodTab === 'all'
          ? ((activeSubordinateData?.unsettledAdvances || 0) + (activeSubordinateData?.totalSettlementPaid || 0) + (activeSubordinateData?.settledAdvances || 0))
          : periodTab === 'current'
          ? (activeSubordinateData?.unsettledAdvances || 0)
          : ((activeSubordinateData?.totalSettlementPaid || 0) + (activeSubordinateData?.settledAdvances || 0)),
        titleDue: t('netBalanceDue') || 'مانده طلب',
        due: (activeSubordinateData?.netBalanceDue || 0),
        isSettled: (activeSubordinateData?.netBalanceDue || 0) <= 0
      };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200" dir={direction}>
      
      {/* Top Navigation Bar */}
      <header className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-3 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          
          {/* Logo & Worker Identity */}
          <div className="flex items-center gap-3">
            <img 
              src="/karsync-icon.png" 
              alt="KarSync" 
              className="w-10 h-10 object-contain dark:brightness-0 dark:invert transition-all" 
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  {user?.name || worker?.name}
                </span>
                {worker?.teamRole === 'Master' ? (
                  <span className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-[11px] font-bold border border-purple-200 dark:border-purple-800/60">
                    {labels.masterRole}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 text-[11px] font-bold">
                    {worker?.role || t('workerRole')}
                  </span>
                )}
                {workerGroup && (
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                    <Building2 className="w-3 h-3 text-sky-500" />
                    <span>{workerGroup.name}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                KarSync • {isSupervisor ? (language === 'ku' ? 'پۆرتالی سەرپەرشتیاری کارگە' : 'پورتال سرپرستی و پرسنل کارگاه') : t('readOnlyNotice')}
              </p>
            </div>
          </div>

          {/* Controls: Dark Mode, Language, Logout */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold gap-0.5">
              <button
                type="button"
                onClick={() => changeLanguage('ku')}
                className={`px-2 py-1 rounded-lg transition-all ${language === 'ku' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
              >
                کو
              </button>
              <button
                type="button"
                onClick={() => changeLanguage('fa')}
                className={`px-2 py-1 rounded-lg transition-all ${language === 'fa' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
              >
                فا
              </button>
              <button
                type="button"
                onClick={() => changeLanguage('en')}
                className={`px-2 py-1 rounded-lg transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
              >
                EN
              </button>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-bold text-xs border border-red-200 dark:border-red-800/60 transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
        
        {/* Supervisor Portal Switcher Dock (Requirement #2) */}
        {isSupervisor && (
          <div className="flex justify-center w-full no-print">
            <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setPortalMode('personal');
                  setSelectedSubordinateId('all');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                  portalMode === 'personal'
                    ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/30 scale-102'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{labels.myPersonalAccount}</span>
              </button>

              <button
                type="button"
                onClick={() => setPortalMode('group')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                  portalMode === 'group'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30 scale-102'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{labels.groupManagement} ({workerGroup?.name || 'گروه'})</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/20 text-white font-bold">
                  {groupMembers.length}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Group Subordinates Dock (Only visible in Group Mode - Requirements 2 & 2.1) */}
        {isSupervisor && portalMode === 'group' && (
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {language === 'ku' ? 'دیاریکردنی کرێکار بۆ بینینی کارکرد و حسابات:' : 'انتخاب پرسنل جهت مشاهده کارکرد و حساب:'}
                </h3>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>{groupMembers.length} {language === 'ku' ? 'ئەندام لە گرووپ' : 'نفر در این گروه'}</span>
                {groupAggregates.archivedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800/50">
                    {groupAggregates.archivedCount} {labels.archivedBadge}
                  </span>
                )}
              </div>
            </div>

            {/* Subordinate Pills Dock */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
              {/* All Subordinates Option */}
              <button
                type="button"
                onClick={() => setSelectedSubordinateId('all')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 ${
                  selectedSubordinateId === 'all'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{labels.allGroupMembers}</span>
              </button>

              {/* Individual Worker Pills */}
              {groupMembersFinancials.map((gf) => {
                const isSelected = String(gf.member.id) === String(selectedSubordinateId);
                const isArchived = gf.member.isArchived || gf.member.status === 'archived';
                const isMaster = gf.member.teamRole === 'Master';
                const totalDays = (gf.effectiveDays || 0) + (gf.settledEffectiveDays || 0);

                return (
                  <button
                    key={gf.member.id}
                    type="button"
                    onClick={() => setSelectedSubordinateId(String(gf.member.id))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white border-sky-400/40 shadow-md shadow-sky-500/25 scale-102'
                        : isArchived
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100/70'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                    }`}
                  >
                    <span>{gf.member.name}</span>
                    {isMaster && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                      }`}>
                        {labels.masterRole}
                      </span>
                    )}
                    {isArchived && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5 ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200'
                      }`}>
                        <Archive className="w-2.5 h-2.5" />
                        <span>{labels.archivedBadge}</span>
                      </span>
                    )}
                    {/* Informative worked days & balance badge */}
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isSelected 
                        ? 'bg-white/25 text-white' 
                        : gf.netBalanceDue > 0
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/40'
                        : totalDays > 0
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {gf.netBalanceDue > 0 
                        ? `${formatAmount(gf.netBalanceDue, currency)} ${getCurrencySymbol(currency, language)}`
                        : `${totalDays} ${t('daysShort') || 'روز'}`
                      }
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Archived Member Notice */}
            {activeSubordinateData && (activeSubordinateData.member.isArchived || activeSubordinateData.member.status === 'archived') && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>{labels.archivedMemberNotice}</span>
              </div>
            )}
          </div>
        )}

        {/* Period Selector Tabs: All vs Current Unsettled vs Settled History */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 no-print">
          
          {/* Main View Tabs (Navbar style dock) */}
          <div className="inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
            <button
              type="button"
              onClick={() => setPeriodTab('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                periodTab === 'all'
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-102'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{labels.allTab}</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodTab('current')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                periodTab === 'current'
                  ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/30 scale-102'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{labels.currentTab}</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodTab('settled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                periodTab === 'settled'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30 scale-102'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{labels.settledTab}</span>
            </button>
          </div>

          {/* Right Controls: Month Selector & Print Button */}
          <div className="flex items-center gap-2 flex-wrap justify-center w-full md:w-auto">
            {periodTab === 'settled' && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(-1)}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <div className="flex items-center gap-1.5 font-bold text-xs font-mono text-slate-700 dark:text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  <span>{selectedMonth}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleShiftMonth(1)}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('printMyPayslip') || 'چاپ فیش'}</span>
            </button>
          </div>

        </div>

        {/* 1. Settlement Status Banner */}
        <div className={`p-5 rounded-3xl border transition-all ${
          activeMetrics.isSettled
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
            : activeMetrics.due > 0
            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
            : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                activeMetrics.isSettled
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : activeMetrics.due > 0
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
              }`}>
                {activeMetrics.isSettled ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>{t('settlementStatus')}:</span>
                  <span className={
                    activeMetrics.isSettled 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : activeMetrics.due > 0 
                      ? 'text-amber-600 dark:text-amber-400' 
                      : 'text-rose-600 dark:text-rose-400'
                  }>
                    {activeMetrics.isSettled ? (t('workerSettledStatus') || 'تسویه شده') : (t('workerPendingStatus') || 'دارای معوقه پرداخت')}
                  </span>
                  {portalMode === 'group' && selectedSubordinateId === 'all' && (
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-normal">
                      ({labels.allGroupMembers})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {periodTab === 'settled'
                    ? (language === 'ku' ? 'سەرجەم کارکرد و مووچەکانی ئەم بەشە پێشتر تەسویەی دارایی کراون.' : 'کلیه کارکردها و مبالغ این بخش، قبلاً در اسناد مالی به طور قطعی تسویه شده‌اند.')
                    : activeMetrics.due > 0
                    ? (language === 'ku' 
                        ? `کۆی شایستەی ماوە و قەرز بەپێی ڕۆژەکانی کارکرد: ${formatAmount(activeMetrics.due, currency)} ${getCurrencySymbol(currency, language)}.`
                        : `مجموع مطالبات خالص معوقه طبق روزهای کاری جاری: ${formatAmount(activeMetrics.due, currency)} ${getCurrencySymbol(currency, language)}.`)
                    : (language === 'ku' ? 'هیچ بڕە پارەیەکی معوقه لەسەر ئەم کارکردە نەماوە.' : 'هیچ مبلغ معوقه‌ای برای این دوره باز باقی نمانده است.')
                  }
                </p>
              </div>
            </div>

            {/* Transparent Balance Display */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-start sm:text-end">
              <span className="text-[11px] font-bold text-slate-400 block">
                {activeMetrics.titleDue} ({getCurrencySymbol(currency, language)})
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5 justify-start sm:justify-end">
                <span className={`text-xl sm:text-2xl font-black font-mono ${
                  activeMetrics.due <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {formatAmount(Math.max(0, activeMetrics.due), currency)}
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {getCurrencySymbol(currency, language)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Financial & Work Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Worked Days */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{activeMetrics.titleDays}</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {activeMetrics.days}
              </span>
              {activeMetrics.daysSub && (
                <span className="text-[11px] text-slate-400 ms-1 font-bold">
                  {activeMetrics.daysSub}
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Total Gross Earnings */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{activeMetrics.titleEarnings}</span>
              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                {formatAmount(activeMetrics.earnings, currency)}
              </span>
              <span className="text-[11px] text-slate-400 ms-1 font-bold">{getCurrencySymbol(currency, language)}</span>
            </div>
          </div>

          {/* Card 3: Advances / Paid */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{activeMetrics.titleAdvances}</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {formatAmount(activeMetrics.advances, currency)}
              </span>
              <span className="text-[11px] text-slate-400 ms-1 font-bold">{getCurrencySymbol(currency, language)}</span>
            </div>
          </div>

          {/* Card 4: Net Balance Due */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{activeMetrics.titleDue}</span>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <WalletCards className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-xl sm:text-2xl font-black font-mono ${
                activeMetrics.due <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
              }`}>
                {formatAmount(Math.max(0, activeMetrics.due), currency)}
              </span>
              <span className="text-[11px] text-slate-400 ms-1 font-bold">{getCurrencySymbol(currency, language)}</span>
            </div>
          </div>

        </div>

        {/* 2. Detailed Attendance Timesheet Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-sky-500" />
              <div>
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  {portalMode === 'personal'
                    ? (t('myMonthlyReport') || 'ریز کارکرد و حضور و غیاب')
                    : selectedSubordinateId === 'all'
                    ? `${language === 'ku' ? 'ڕاپۆرتی گشتی کارکردی ئەندامانی گرووپ' : 'ریز کارکرد تجمیعی پرسنل گروه'} (${workerGroup?.name || ''})`
                    : `${language === 'ku' ? 'ڕاپۆرتی کارکردی' : 'ریز کارکرد'} ${activeSubordinateData?.member.name}`
                  }
                </h3>
                <p className="text-[11px] text-slate-400">
                  {periodTab === 'all' ? labels.allTab : periodTab === 'current' ? labels.currentTab : labels.settledTab} • {displayedLogs.length} {language === 'ku' ? 'تۆمار' : 'رکورد'}
                </p>
              </div>
            </div>

            {/* Timesheet Search Filter */}
            <div className="relative w-full sm:w-60 no-print">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={labels.searchLogsPlaceholder}
                className="w-full ps-8 pe-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {displayedLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              {t('noLogsForMonth') || 'هیچ رکوردی برای نمایش در این بخش ثبت نشده است.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4 text-start font-bold">#</th>
                    {portalMode === 'group' && selectedSubordinateId === 'all' && (
                      <th className="py-3 px-4 text-start font-bold">{t('workerName') || 'نام نیرو'}</th>
                    )}
                    <th className="py-3 px-4 text-start font-bold">{t('date')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('workType')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('overtimeHours')}</th>
                    <th className="py-3 px-4 text-start font-bold">
                      {currency === 'IQD' ? t('baseWageIQD') : `${language === 'ku' ? 'مووچەی بنەڕەت' : 'حقوق پایه'} (${getCurrencySymbol(currency, language)})`}
                    </th>
                    <th className="py-3 px-4 text-start font-bold">
                      {currency === 'IQD' ? t('overtimeWageIQD') : `${language === 'ku' ? 'سەروەخت' : 'اضافه کاری'} (${getCurrencySymbol(currency, language)})`}
                    </th>
                    <th className="py-3 px-4 text-start font-bold">
                      {currency === 'IQD' ? t('netPayIQD') : `${language === 'ku' ? 'کۆی ڕۆژ' : 'مجموع روز'} (${getCurrencySymbol(currency, language)})`}
                    </th>
                    <th className="py-3 px-4 text-center font-bold">{t('status')}</th>
                    <th className="py-3 px-4 text-start font-bold">{t('taskNotesTitle')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedLogs.map((l, idx) => {
                    const isSettled = l.isSettled || l.settlementReceiptId;
                    const effectiveRate = Number(l.workerDailyRate) || Number(worker.dailyRate);

                    return (
                      <tr key={l.id || `${l.workerId}_${l.date}_${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                        {portalMode === 'group' && selectedSubordinateId === 'all' && (
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{l.workerName}</span>
                              {l.workerTeamRole === 'Master' && (
                                <span className="text-[9px] px-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                                  {labels.masterRole}
                                </span>
                              )}
                              {l.isWorkerArchived && (
                                <span className="text-[9px] px-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                                  {labels.archivedBadge}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          <div>{l.date}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{getDayName(l.date)}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {l.type === 'full' && (
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                              {t('fullDay') || 'روز کامل'}
                            </span>
                          )}
                          {l.type === 'half' && (
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                              {t('halfDay') || 'نیم روز'}
                            </span>
                          )}
                          {l.type === 'hourly' && (
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                              {t('hourlyOnly') || 'ساعتی'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
                          {Number(l.overtimeHours) > 0 ? formatHoursAndMinutes(l.overtimeHours) : '—'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                          {formatAmount(l.calculatedDailyWage || (l.type === 'half' ? (effectiveRate * 0.5) : effectiveRate), currency)}
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">
                          {Number(l.calculatedOvertimeWage) > 0 ? formatAmount(l.calculatedOvertimeWage, currency) : '—'}
                        </td>
                        <td className="py-3 px-4 font-black text-sky-600 dark:text-sky-400 font-mono whitespace-nowrap">
                          {formatAmount(l.totalDayPay, currency)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {periodTab === 'settled' || isSettled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{labels.settledBadge}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-300/50">
                              <Clock className="w-3 h-3" />
                              <span>{labels.unsettledBadge}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                          {l.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* 3. Payments and Advances Ledger */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-500" />
              <span>
                {portalMode === 'personal'
                  ? (t('myPaymentsLedger') || 'دفتر پرداخت‌ها و مساعده‌ها')
                  : `${language === 'ku' ? 'تۆماری پارەدان و مساعدەی گرووپ' : 'دفتر پرداخت‌ها و مساعده‌های گروه'} (${workerGroup?.name || ''})`
                }
              </span>
            </h3>
            <span className="text-xs text-slate-400">
              {displayedPayments.length} {t('paymentRecordsCount') || 'رکورد'}
            </span>
          </div>

          {displayedPayments.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              {t('noPaymentsRecorded') || 'هیچ پرداخت یا مساعده‌ای در این بخش ثبت نشده است.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 text-start">{t('dateTimeColumn') || 'تاریخ'}</th>
                    {portalMode === 'group' && (
                      <th className="py-3 px-4 text-start">{t('workerName') || 'پرسنل'}</th>
                    )}
                    <th className="py-3 px-4 text-center">{t('typeColumn') || 'نوع'}</th>
                    <th className="py-3 px-4 text-end">{t('paymentAmount') || 'مبلغ'}</th>
                    <th className="py-3 px-4 text-start">{t('referenceNumber') || 'شماره ارجاع'}</th>
                    <th className="py-3 px-4 text-start">{t('notesColumn') || 'توضیحات'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedPayments.map((p) => {
                    const isSettlement = p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                          {p.date}
                        </td>
                        {portalMode === 'group' && (
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {p.workerName}
                          </td>
                        )}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isSettlement
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          }`}>
                            {isSettlement ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {isSettlement ? (t('settlementType') || 'تسویه حساب') : (t('advanceType') || 'مساعده')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-end font-black font-mono text-slate-900 dark:text-white whitespace-nowrap">
                          {formatAmount(p.amount, currency)} <span className="text-[10px] text-slate-400 font-normal">{getCurrencySymbol(currency, language)}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                          {p.referenceNumber || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                          {p.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dual Signature Blocks (For Printing Payslip) */}
        <div className="hidden print:flex justify-around items-end pt-16 pb-6 mt-8 border-t border-slate-300 text-xs font-bold text-slate-800">
          <div className="text-center">
            <p className="mb-14">{t('receiptWorkerSign') || 'امضای پرسنل / سرپرست'}</p>
            <div className="w-44 border-b border-slate-600"></div>
          </div>
          <div className="text-center">
            <p className="mb-14">{t('receiptManagerSign') || 'امضای مدیریت کارگاه'}</p>
            <div className="w-44 border-b border-slate-600"></div>
          </div>
        </div>

      </main>
    </div>
  );
}
