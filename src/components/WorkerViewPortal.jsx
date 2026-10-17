import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { pullRemoteChangesSilently } from '../services/realtimeSync';
import { refreshWorkerPortalData } from '../services/workerAccess';
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
  RefreshCw,
  Filter
} from 'lucide-react';

export function WorkerViewPortal({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const { t, language, changeLanguage, direction } = useLanguage();
  const { addToast } = useNotifications();

  // Mode for supervisors: 'personal' (حساب و کارکرد شخصی من) | 'group' (پنل سرپرستی گروه)
  const [portalMode, setPortalMode] = useState('personal');

  // Subordinate selection in group mode: 'all' or workerId
  const [selectedSubordinateId, setSelectedSubordinateId] = useState('all');

  // Period Tab: 'all' (سوابق و کل کارکرد) | 'current' (کارکرد جاری و مطالبات معوقه) | 'settled' (سوابق تسویه شده)
  const [periodTab, setPeriodTab] = useState('all');

  // Quick Filter for attendance log types: 'all' | 'full' | 'half' | 'overtime'
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  // Refreshing state for manual sync button
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Month navigation for historical settled records
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());

  // Timesheet search input
  const [searchQuery, setSearchQuery] = useState('');

  // Manual & background refresh handler
  const triggerRefresh = useCallback(async (showFeedback = false) => {
    if (!navigator.onLine) {
      if (showFeedback) {
        addToast({
          type: 'warning',
          title: language === 'ku' ? 'هێڵی ئینتەرنێت نییە' : language === 'en' ? 'Offline Mode' : 'عدم اتصال به اینترنت',
          message: language === 'ku' ? 'زانیارییە پاشەکەوتکراوەکان پیشان دەدرێن.' : language === 'en' ? 'Showing cached local records.' : 'اطلاعات ذخیره‌شده آفلاین نمایش داده می‌شود.'
        });
      }
      return;
    }

    if (showFeedback) setIsRefreshing(true);
    const isLinkSession = user?.via === 'access-link';

    try {
      if (!isLinkSession) {
        await pullRemoteChangesSilently(true);
      } else {
        const res = await refreshWorkerPortalData();
        if (!res.success && (res.error === 'invalid_token' || res.error === 'account_blocked')) {
          logout();
          return;
        }
      }
      if (showFeedback) {
        addToast({
          type: 'success',
          title: language === 'ku' ? 'نوێکرایەوە' : language === 'en' ? 'Synchronized' : 'بروزرسانی انجام شد',
          message: language === 'ku' ? 'دوایین زانیارییەکان وەرگیران.' : language === 'en' ? 'Latest attendance and financial records loaded.' : 'آخرین اطلاعات کارکرد و مالی با موفقیت دریافت شد.'
        });
      }
    } catch {
      // Ignore silent background errors
    } finally {
      if (showFeedback) setIsRefreshing(false);
    }
  }, [user?.via, logout, addToast, language]);

  // Proactively load fresh data when the portal opens (and when the app returns to the foreground).
  useEffect(() => {
    let lastRun = 0;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRun < 20000) return;
      lastRun = now;
      triggerRefresh(false);
    };

    refresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [triggerRefresh]);

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
    const roleLower = (worker?.role || '').toLowerCase();
    const isMasterRole =
      worker?.teamRole === 'Master' ||
      roleLower.includes('سرپرست') ||
      roleLower.includes('استادکار') ||
      roleLower.includes('master');
    return isMasterRole && !!worker?.groupId;
  }, [worker]);

  // Group members including active and archived workers
  const groupMembers = useMemo(() => {
    if (!worker?.groupId) return [];
    return allWorkers
      .filter((w) => w && !w.deletedAt && String(w.groupId) === String(worker.groupId))
      .sort((a, b) => {
        if (a?.teamRole === 'Master' && b?.teamRole !== 'Master') return -1;
        if (b?.teamRole === 'Master' && a?.teamRole !== 'Master') return 1;
        const aArchived = a.isArchived || a.status === 'archived';
        const bArchived = b.isArchived || b.status === 'archived';
        if (!aArchived && bArchived) return -1;
        if (aArchived && !bArchived) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [allWorkers, worker?.groupId]);

  // 3. Robust Financial Calculations
  const personalFinancials = useMemo(() => {
    if (!worker) return null;
    return calculateWorkerFinancials(worker, allLogs, allPayments, currency);
  }, [worker, allLogs, allPayments, currency]);

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

  // Aggregated group totals across all dimensions
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

      totalUnsettledGross += item.unsettledGross;
      totalUnsettledAdvances += item.unsettledAdvances;
      totalNetBalanceDue += item.netBalanceDue;
      totalEffectiveDays += item.effectiveDays;
      totalOtHours += item.otHours;

      totalSettledGross += item.settledGross;
      totalSettledAdvances += item.settledAdvances;
      totalSettledPaid += (item.totalSettlementPaid || 0) + (item.settledAdvances || 0);
      totalSettledEffectiveDays += item.settledEffectiveDays;
      totalSettledOtHours += item.settledOtHours;

      totalAllTimeGross += item.unsettledGross + item.settledGross;
      totalAllTimeEffectiveDays += item.effectiveDays + item.settledEffectiveDays;
      totalAllTimeOtHours += item.otHours + item.settledOtHours;
    });

    return {
      totalMembers: groupMembers.length,
      activeCount,
      archivedCount,
      totalUnsettledGross: roundCurrency(totalUnsettledGross, currency),
      totalUnsettledAdvances: roundCurrency(totalUnsettledAdvances, currency),
      totalNetBalanceDue: roundCurrency(totalNetBalanceDue, currency),
      totalEffectiveDays,
      totalOtHours,
      totalSettledGross: roundCurrency(totalSettledGross, currency),
      totalSettledAdvances: roundCurrency(totalSettledAdvances, currency),
      totalSettledPaid: roundCurrency(totalSettledPaid, currency),
      totalSettledEffectiveDays,
      totalSettledOtHours,
      totalAllTimeGross: roundCurrency(totalAllTimeGross, currency),
      totalAllTimeEffectiveDays,
      totalAllTimeOtHours
    };
  }, [groupMembersFinancials, groupMembers.length, currency]);

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

    // Apply logTypeFilter
    if (logTypeFilter === 'full') {
      list = list.filter((l) => l.type === 'full');
    } else if (logTypeFilter === 'half') {
      list = list.filter((l) => l.type === 'half');
    } else if (logTypeFilter === 'overtime') {
      list = list.filter((l) => Number(l.overtimeHours) > 0);
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.date || '').includes(q) ||
          (l.workerName || '').toLowerCase().includes(q) ||
          (l.notes || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [
    portalMode,
    periodTab,
    selectedSubordinateId,
    personalFinancials,
    groupMembersFinancials,
    activeSubordinateData,
    logTypeFilter,
    searchQuery
  ]);

  // 5. Payment Records to Display (Fixed 'all' tab to include both unsettled & settled payments)
  const displayedPayments = useMemo(() => {
    let list = [];
    if (portalMode === 'personal') {
      if (!personalFinancials) return [];
      if (periodTab === 'all') {
        list = [
          ...personalFinancials.unsettledPayments,
          ...personalFinancials.settledPayments,
          ...personalFinancials.settlementReceipts
        ];
      } else if (periodTab === 'current') {
        list = personalFinancials.unsettledPayments;
      } else {
        list = [...personalFinancials.settledPayments, ...personalFinancials.settlementReceipts];
      }
    } else {
      const targetWorkerIds =
        selectedSubordinateId === 'all'
          ? new Set(groupMembers.map((m) => String(m.id)))
          : new Set([String(selectedSubordinateId)]);

      const workerMap = {};
      groupMembers.forEach((m) => {
        workerMap[String(m.id)] = m;
      });

      list = allPayments
        .filter((p) => {
          if (p.deletedAt) return false;
          const matchesWorker = targetWorkerIds.has(String(p.workerId));
          const matchesGroup = worker?.groupId && p.groupId === worker.groupId;
          if (!matchesWorker && !matchesGroup) return false;

          const pSettled = p.isSettled || p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled';
          if (periodTab === 'all') return true;
          if (periodTab === 'current') return !pSettled;
          return pSettled;
        })
        .map((p) => ({
          ...p,
          workerName: workerMap[String(p.workerId)]?.name || (p.groupId ? workerGroup?.name || 'گروه' : '—')
        }));
    }

    // Deduplicate payments by id
    const seenIds = new Set();
    list = list.filter((p) => {
      if (!p.id) return true;
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [
    portalMode,
    periodTab,
    selectedSubordinateId,
    personalFinancials,
    groupMembers,
    allPayments,
    worker?.groupId,
    workerGroup
  ]);

  // Filtered logs summary for table footer
  const filteredLogsTotals = useMemo(() => {
    let totalBase = 0;
    let totalOtHours = 0;
    let totalOtPay = 0;
    let totalNet = 0;
    displayedLogs.forEach((l) => {
      const effectiveRate = Number(l.workerDailyRate) || Number(worker?.dailyRate) || 0;
      const base = Number(l.calculatedDailyWage) || (l.type === 'half' ? effectiveRate * 0.5 : l.type === 'full' ? effectiveRate : 0);
      const ot = Number(l.calculatedOvertimeWage) || 0;
      const net = Number(l.totalDayPay) || base + ot;
      totalBase += base;
      totalOtHours += Number(l.overtimeHours) || 0;
      totalOtPay += ot;
      totalNet += net;
    });
    return {
      totalBase: roundCurrency(totalBase, currency),
      totalOtHours,
      totalOtPay: roundCurrency(totalOtPay, currency),
      totalNet: roundCurrency(totalNet, currency)
    };
  }, [displayedLogs, worker?.dailyRate, currency]);

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

  const labels = {
    myPersonalAccount:
      language === 'ku' ? 'حیساب و کارکردی کەسی من' : language === 'en' ? 'My Personal Account' : 'حساب و کارکرد شخصی من',
    groupManagement:
      language === 'ku' ? 'بەڕێوەبردنی گرووپ' : language === 'en' ? 'Group Supervision' : 'پنل سرپرستی گروه',
    allTab: language === 'ku' ? 'سەرجەم کارکرد و سوابق' : language === 'en' ? 'All Records' : 'سوابق و کل کارکرد',
    currentTab:
      language === 'ku' ? 'کارکردی ئێستا و قەرزی تەسویەنەکراو' : language === 'en' ? 'Current Open' : 'کارکرد جاری و معوقه',
    settledTab: language === 'ku' ? 'مێژووی تەسویەکراو' : language === 'en' ? 'Settled History' : 'سوابق تسویه‌شده',
    allGroupMembers:
      language === 'ku'
        ? 'سەرجەم ئەندامانی گرووپ (کۆی گشتی)'
        : language === 'en'
        ? 'All Group Members'
        : 'همه اعضای گروه (نمای تجمیعی)',
    totalGroupMembers: language === 'ku' ? 'کۆی کرێکارانی گرووپ' : language === 'en' ? 'Total Group Members' : 'کل پرسنل گروه',
    totalGroupDue:
      language === 'ku' ? 'کۆی شایستەی ماوەی گرووپ' : language === 'en' ? 'Total Group Net Due' : 'مجموع مطالبات معوقه گروه',
    totalGroupDays: language === 'ku' ? 'کۆی ڕۆژەکانی گرووپ' : language === 'en' ? 'Group Total Days' : 'مجموع روزهای کاری گروه',
    totalGroupOt:
      language === 'ku' ? 'کۆی کاتژمێری سەروەختی گرووپ' : language === 'en' ? 'Group Overtime Hours' : 'مجموع اضافه‌کاری گروه',
    archivedMemberNotice:
      language === 'ku'
        ? 'ئەم کرێکارە ئەرشیڤ کراوە بەڵام مێژووەکەی پارێزراوە'
        : language === 'en'
        ? 'This worker is archived, but history is preserved.'
        : 'این پرسنل توسط مدیریت بایگانی شده، اما کلیه سوابق مالی و کارکرد وی در دسترس است.',
    archivedBadge: language === 'ku' ? 'ئەرشیڤ کراو' : language === 'en' ? 'Archived' : 'بایگانی‌شده',
    masterRole: language === 'ku' ? 'وەستا (سەرپەرشتیار)' : language === 'en' ? 'Master (Supervisor)' : 'استادکار (سرپرست)',
    workerRoleLabel: language === 'ku' ? 'کرێکار' : language === 'en' ? 'Worker' : 'کارگر',
    unsettledBadge: language === 'ku' ? 'جاری / تەسویەنەکراو' : language === 'en' ? 'Open' : 'جاری / معوقه',
    settledBadge: language === 'ku' ? 'تەسویەکراو' : language === 'en' ? 'Settled' : 'تسویه‌شده',
    searchLogsPlaceholder:
      language === 'ku'
        ? 'گەڕان بەپێی بەروار، ناو یان تێبینی...'
        : language === 'en'
        ? 'Search by date, name or notes...'
        : 'جستجو بر اساس تاریخ، نام یا یادداشت...'
  };

  if (!worker) {
    return (
      <div className="min-h-screen bg-[#f3f6f4] dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
          <p className="font-black text-sm text-slate-800 dark:text-slate-200">
            {language === 'ku' ? 'زانیارییەکان لە دیتابەیس دەخوێندرێنەوە...' : 'در حال بارگذاری پرونده پرسنلی...'}
          </p>
        </div>
      </div>
    );
  }

  // Active metrics to display in Hero & KPI Bento Cards
  const activeMetrics =
    portalMode === 'personal'
      ? {
          subjectName: worker.name,
          dailyRate: Number(worker.dailyRate) || 0,
          titleDays: t('totalMonthWorkedDays') || 'روزهای کارکرد',
          days:
            periodTab === 'all'
              ? (personalFinancials?.effectiveDays || 0) + (personalFinancials?.settledEffectiveDays || 0)
              : periodTab === 'current'
              ? personalFinancials?.effectiveDays || 0
              : personalFinancials?.settledEffectiveDays || 0,
          daysSub: `${
            periodTab === 'all'
              ? (personalFinancials?.fullDays || 0) + (personalFinancials?.settledFullDays || 0)
              : periodTab === 'current'
              ? personalFinancials?.fullDays || 0
              : personalFinancials?.settledFullDays || 0
          } ${t('fullDayWork') || 'روز کامل'}`,
          otHours:
            periodTab === 'all'
              ? (personalFinancials?.otHours || 0) + (personalFinancials?.settledOtHours || 0)
              : periodTab === 'current'
              ? personalFinancials?.otHours || 0
              : personalFinancials?.settledOtHours || 0,
          titleEarnings: t('totalCalculatedPayroll') || 'کل حقوق کارکرد',
          earnings:
            periodTab === 'all'
              ? (personalFinancials?.unsettledGross || 0) + (personalFinancials?.settledGross || 0)
              : periodTab === 'current'
              ? personalFinancials?.unsettledGross || 0
              : personalFinancials?.settledGross || 0,
          titleAdvances:
            periodTab === 'all'
              ? t('totalPaid') || 'کل دریافتی و تسویه'
              : periodTab === 'current'
              ? t('totalPaidAdvances') || 'مساعده و دریافتی'
              : t('totalPaid') || 'مجموع تسویه شده',
          advances:
            periodTab === 'all'
              ? (personalFinancials?.unsettledAdvances || 0) +
                (personalFinancials?.totalSettlementPaid || 0) +
                (personalFinancials?.settledAdvances || 0)
              : periodTab === 'current'
              ? personalFinancials?.unsettledAdvances || 0
              : (personalFinancials?.totalSettlementPaid || 0) + (personalFinancials?.settledAdvances || 0),
          titleDue: t('netBalanceDue') || 'مانده خالص قابل دریافت',
          due: personalFinancials?.netBalanceDue || 0,
          isSettled: (personalFinancials?.netBalanceDue || 0) <= 0
        }
      : selectedSubordinateId === 'all'
      ? {
          subjectName: workerGroup?.name || 'کل اعضای گروه',
          dailyRate: null,
          titleDays: labels.totalGroupDays,
          days:
            periodTab === 'all'
              ? groupAggregates.totalAllTimeEffectiveDays
              : periodTab === 'current'
              ? groupAggregates.totalEffectiveDays
              : groupAggregates.totalSettledEffectiveDays,
          daysSub: `${groupMembers.length} ${language === 'ku' ? 'ئەندام' : 'نفر عضو گروه'}`,
          otHours:
            periodTab === 'all'
              ? groupAggregates.totalAllTimeOtHours
              : periodTab === 'current'
              ? groupAggregates.totalOtHours
              : groupAggregates.totalSettledOtHours,
          titleEarnings:
            periodTab === 'all'
              ? language === 'ku'
                ? 'کۆی گشتی کارکردی گرووپ'
                : 'کل کارکرد ناخالص گروه'
              : periodTab === 'current'
              ? language === 'ku'
                ? 'کارکردی ئێستای گرووپ'
                : 'کارکرد جاری ناخالص گروه'
              : language === 'ku'
              ? 'کارکردی تەسویەکراوی گرووپ'
              : 'کارکرد تسویه‌شده گروه',
          earnings:
            periodTab === 'all'
              ? groupAggregates.totalAllTimeGross
              : periodTab === 'current'
              ? groupAggregates.totalUnsettledGross
              : groupAggregates.totalSettledGross,
          titleAdvances:
            periodTab === 'all'
              ? language === 'ku'
                ? 'کۆی پارەی دراو'
                : 'کل پرداختی و تسویه‌ها'
              : periodTab === 'current'
              ? language === 'ku'
                ? 'کۆی پێشەکییەکان'
                : 'مساعده‌های جاری گروه'
              : language === 'ku'
              ? 'کۆی تەسویەی دراو'
              : 'تسویه‌های پرداخت‌شده',
          advances:
            periodTab === 'all'
              ? groupAggregates.totalUnsettledAdvances + groupAggregates.totalSettledPaid
              : periodTab === 'current'
              ? groupAggregates.totalUnsettledAdvances
              : groupAggregates.totalSettledPaid,
          titleDue: labels.totalGroupDue,
          due: groupAggregates.totalNetBalanceDue,
          isSettled: groupAggregates.totalNetBalanceDue <= 0
        }
      : {
          subjectName: activeSubordinateData?.member.name || '',
          dailyRate: Number(activeSubordinateData?.member.dailyRate) || 0,
          titleDays: `${t('totalMonthWorkedDays') || 'روزهای کارکرد'}`,
          days:
            periodTab === 'all'
              ? (activeSubordinateData?.effectiveDays || 0) + (activeSubordinateData?.settledEffectiveDays || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.effectiveDays || 0
              : activeSubordinateData?.settledEffectiveDays || 0,
          daysSub: `${
            periodTab === 'all'
              ? (activeSubordinateData?.fullDays || 0) + (activeSubordinateData?.settledFullDays || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.fullDays || 0
              : activeSubordinateData?.settledFullDays || 0
          } ${t('fullDayWork') || 'روز کامل'}`,
          otHours:
            periodTab === 'all'
              ? (activeSubordinateData?.otHours || 0) + (activeSubordinateData?.settledOtHours || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.otHours || 0
              : activeSubordinateData?.settledOtHours || 0,
          titleEarnings: t('totalCalculatedPayroll') || 'حقوق کارکرد',
          earnings:
            periodTab === 'all'
              ? (activeSubordinateData?.unsettledGross || 0) + (activeSubordinateData?.settledGross || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.unsettledGross || 0
              : activeSubordinateData?.settledGross || 0,
          titleAdvances:
            periodTab === 'all'
              ? t('totalPaid') || 'کل دریافتی و تسویه'
              : periodTab === 'current'
              ? t('totalPaidAdvances') || 'مساعده و دریافتی'
              : t('totalPaid') || 'تسویه شده',
          advances:
            periodTab === 'all'
              ? (activeSubordinateData?.unsettledAdvances || 0) +
                (activeSubordinateData?.totalSettlementPaid || 0) +
                (activeSubordinateData?.settledAdvances || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.unsettledAdvances || 0
              : (activeSubordinateData?.totalSettlementPaid || 0) + (activeSubordinateData?.settledAdvances || 0),
          titleDue: t('netBalanceDue') || 'مانده خالص طلب',
          due: activeSubordinateData?.netBalanceDue || 0,
          isSettled: (activeSubordinateData?.netBalanceDue || 0) <= 0
        };

  // Calculate payout ratio for visual progress bar
  const grossEarningsVal = Number(activeMetrics.earnings) || 0;
  const paidAdvancesVal = Number(activeMetrics.advances) || 0;
  const payoutProgressPercent =
    grossEarningsVal <= 0
      ? activeMetrics.isSettled
        ? 100
        : 0
      : Math.min(100, Math.max(0, Math.round((paidAdvancesVal / grossEarningsVal) * 100)));

  const currencySymbol = getCurrencySymbol(currency, language);

  return (
    <div
      className="min-h-screen bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300 relative overflow-x-hidden"
      dir={direction}
    >
      {/* Subtle Ambient Apple Liquid Glass Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 no-print">
        <div className="absolute -top-32 -end-32 w-96 h-96 rounded-full bg-sky-400/10 dark:bg-sky-500/5 blur-3xl" />
        <div className="absolute top-1/3 -start-32 w-96 h-96 rounded-full bg-emerald-400/10 dark:bg-emerald-500/5 blur-3xl" />
      </div>

      {/* ===================================================================== */}
      {/* 1. FLOATING APPLE LIQUID GLASS HEADER                                 */}
      {/* ===================================================================== */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/60 dark:border-slate-800/80 sticky top-0 z-40 px-4 sm:px-6 py-3 shadow-[0_4px_24px_rgb(0,0,0,0.03)] no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          {/* Identity & Role Capsule */}
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 dark:from-sky-500/20 dark:to-indigo-500/20 border border-sky-500/20 flex items-center justify-center p-1.5 shadow-inner">
                <img
                  src="/karsync-icon.png"
                  alt="KarSync"
                  className="w-full h-full object-contain drop-shadow-sm"
                />
              </div>
              <span
                className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 absolute -bottom-0.5 -end-0.5"
                title="Online"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                  {user?.name || worker?.name}
                </h1>

                {worker?.teamRole === 'Master' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-bold border border-purple-500/20 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span>{labels.masterRole}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[11px] font-bold border border-sky-500/20">
                    {worker?.role || t('workerRole')}
                  </span>
                )}

                {workerGroup && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 border border-slate-200/80 dark:border-slate-700/80">
                    <Building2 className="w-3 h-3 text-sky-500" />
                    <span>{workerGroup.name}</span>
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>
                  {project?.name ? `${project.name} • ` : ''}
                  {isSupervisor
                    ? language === 'ku'
                      ? 'پۆرتالی سەرپەرشتیاری و کارمەندان'
                      : 'پرتال هوشمند سرپرستی و پرسنل'
                    : t('readOnlyNotice') || 'پرتال اختصاصی مشاهده کارکرد و صورت‌حساب'}
                </span>
              </p>
            </div>
          </div>

          {/* Center Supervisor Switcher (Desktop inline, mobile full width below) */}
          {isSupervisor && (
            <div className="hidden xl:flex items-center p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => {
                  setPortalMode('personal');
                  setSelectedSubordinateId('all');
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  portalMode === 'personal'
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{labels.myPersonalAccount}</span>
              </button>

              <button
                type="button"
                onClick={() => setPortalMode('group')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  portalMode === 'group'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{labels.groupManagement}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    portalMode === 'group'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {groupMembers.length}
                </span>
              </button>
            </div>
          )}

          {/* Action Controls: Sync, Theme, Language, Logout */}
          <div className="flex items-center gap-2">
            {/* Manual Sync Button */}
            <button
              type="button"
              onClick={() => triggerRefresh(true)}
              disabled={isRefreshing}
              className="p-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={language === 'ku' ? 'نوێکردنەوەی زانیارییەکان' : 'بروزرسانی اطلاعات'}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
            </button>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Language Pill Switcher */}
            <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 text-xs font-bold gap-0.5">
              {['ku', 'fa', 'en'].map((langKey) => (
                <button
                  key={langKey}
                  type="button"
                  onClick={() => changeLanguage(langKey)}
                  className={`px-2.5 py-1 rounded-xl transition-all duration-200 cursor-pointer ${
                    language === langKey
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {langKey === 'ku' ? 'کو' : langKey === 'fa' ? 'فا' : 'EN'}
                </button>
              ))}
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. MAIN APPLE LIQUID GLASS CONTENT CONTAINER                          */}
      {/* ===================================================================== */}
      <main className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-28">
        {/* Supervisor Switcher on Tablet/Mobile (< xl) */}
        {isSupervisor && (
          <div className="flex xl:hidden justify-center w-full no-print">
            <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setPortalMode('personal');
                  setSelectedSubordinateId('all');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  portalMode === 'personal'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{labels.myPersonalAccount}</span>
              </button>

              <button
                type="button"
                onClick={() => setPortalMode('group')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  portalMode === 'group'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>
                  {labels.groupManagement} ({workerGroup?.name || 'گروه'})
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/20 text-white font-bold">
                  {groupMembers.length}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Group Subordinates Pill Dock (Only visible in Group Mode) */}
        {isSupervisor && portalMode === 'group' && (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {language === 'ku'
                      ? 'دیاریکردنی کرێکار بۆ بینینی کارکرد و حسابات'
                      : 'انتخاب پرسنل زیرمجموعه جهت مشاهده کارکرد و حساب'}
                  </h3>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="font-bold">
                  {groupMembers.length} {language === 'ku' ? 'ئەندام لە گرووپ' : 'نفر عضو گروه'}
                </span>
                {groupAggregates.archivedCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/20">
                    {groupAggregates.archivedCount} {labels.archivedBadge}
                  </span>
                )}
              </div>
            </div>

            {/* Horizontal Scrollable Worker Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedSubordinateId('all')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-300 shrink-0 cursor-pointer border ${
                  selectedSubordinateId === 'all'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25'
                    : 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/70 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{labels.allGroupMembers}</span>
              </button>

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
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-300 shrink-0 border cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/25'
                        : isArchived
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/15'
                        : 'bg-white/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80 hover:border-sky-500/40'
                    }`}
                  >
                    <span>{gf.member.name}</span>
                    {isMaster && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {labels.masterRole}
                      </span>
                    )}
                    {isArchived && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-500/20 text-amber-900 dark:text-amber-200'
                        }`}
                      >
                        <Archive className="w-2.5 h-2.5" />
                        <span>{labels.archivedBadge}</span>
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : gf.netBalanceDue > 0
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : totalDays > 0
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {gf.netBalanceDue > 0
                        ? `${formatAmount(gf.netBalanceDue, currency)} ${currencySymbol}`
                        : `${totalDays} ${t('daysShort') || 'روز'}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeSubordinateData &&
              (activeSubordinateData.member.isArchived || activeSubordinateData.member.status === 'archived') && (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>{labels.archivedMemberNotice}</span>
                </div>
              )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. PERIOD SELECTOR BAR & MONTH NAVIGATION                         */}
        {/* ================================================================= */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3 sm:p-4 rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col md:flex-row items-center justify-between gap-3 no-print">
          {/* Segmented Period Control */}
          <div className="inline-flex items-center gap-1.5 bg-slate-200/60 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 w-full md:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setPeriodTab('all')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                periodTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>{labels.allTab}</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodTab('current')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                periodTab === 'current'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{labels.currentTab}</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodTab('settled')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                periodTab === 'settled'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{labels.settledTab}</span>
            </button>
          </div>

          {/* Month Selector & Quick Print Button */}
          <div className="flex items-center gap-2.5 flex-wrap justify-between md:justify-end w-full md:w-auto">
            {periodTab === 'settled' && (
              <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-3 py-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(-1)}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <div className="flex items-center gap-1.5 font-bold text-xs font-mono text-slate-700 dark:text-slate-200 px-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  <span>{selectedMonth}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleShiftMonth(1)}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium px-2">
              <span>
                {displayedLogs.length} {language === 'ku' ? 'ڕۆژی کار' : 'رکورد کارکرد'}
              </span>
              <span>•</span>
              <span>
                {displayedPayments.length} {language === 'ku' ? 'پارەدان' : 'تراکنش مالی'}
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. DESKTOP 12-COLUMN BENTO GRID                                   */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ─────────────────────────────────────────────────────────────── */}
          {/* START COLUMN (lg:col-span-5): Financial Hero, KPIs & Payments   */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-6">
            {/* A. Hero Settlement & Net Balance Card */}
            <div
              className={`rounded-3xl p-6 backdrop-blur-xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all relative overflow-hidden ${
                activeMetrics.isSettled
                  ? 'bg-gradient-to-br from-emerald-500/10 via-white/85 to-emerald-500/5 dark:from-emerald-950/40 dark:via-slate-900/85 dark:to-emerald-950/20 border-emerald-500/30 dark:border-emerald-500/20'
                  : 'bg-gradient-to-br from-amber-500/10 via-white/85 to-sky-500/5 dark:from-amber-950/35 dark:via-slate-900/85 dark:to-sky-950/20 border-amber-500/30 dark:border-amber-500/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                      activeMetrics.isSettled
                        ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                        : 'bg-amber-500 text-white shadow-amber-500/25'
                    }`}
                  >
                    {activeMetrics.isSettled ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <WalletCards className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                      {t('settlementStatus') || 'وضعیت حساب پرسنل'}
                    </span>
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap mt-0.5">
                      <span
                        className={
                          activeMetrics.isSettled
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {activeMetrics.isSettled
                          ? t('workerSettledStatus') || 'تسویه کامل'
                          : t('workerPendingStatus') || 'دارای معوقه پرداخت'}
                      </span>
                    </h2>
                  </div>
                </div>

                {activeMetrics.dailyRate > 0 && (
                  <div className="px-3 py-1.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 text-end">
                    <span className="text-[10px] font-bold text-slate-400 block">
                      {language === 'ku' ? 'مووچەی ڕۆژانە' : 'نرخ پایه روزانه'}
                    </span>
                    <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200">
                      {formatAmount(activeMetrics.dailyRate, currency)} {currencySymbol}
                    </span>
                  </div>
                )}
              </div>

              {/* Main Net Balance Display Box */}
              <div className="mt-5 p-4 rounded-2xl bg-white/90 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                    {activeMetrics.titleDue}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                    {activeMetrics.subjectName}
                  </span>
                </div>
                <div className="text-end">
                  <div className="flex items-baseline gap-1.5 justify-end">
                    <span
                      className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                        activeMetrics.due <= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {formatAmount(Math.max(0, activeMetrics.due), currency)}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{currencySymbol}</span>
                  </div>
                </div>
              </div>

              {/* Settlement Progress Indicator */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-500 dark:text-slate-400">
                    {language === 'ku' ? 'ڕێژەی وەرگیراو لە کۆی کارکرد' : 'نسبت دریافتی و تسویه به کل کارکرد'}
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{payoutProgressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeMetrics.isSettled ? 'bg-emerald-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${payoutProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* B. 4-Card KPI Bento Grid (2x2) */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* KPI 1: Worked Days */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {activeMetrics.titleDays}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                      {activeMetrics.days}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{t('daysShort') || 'روز'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                    {activeMetrics.daysSub}
                  </span>
                </div>
              </div>

              {/* KPI 2: Overtime Hours */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {t('overtimeHours') || 'ساعات اضافه‌کاری'}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
                      {activeMetrics.otHours > 0 ? formatHoursAndMinutes(activeMetrics.otHours) : '0'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                    {language === 'ku' ? 'کۆی سەروەخت' : 'مجموع اضافه‌کاری ثبت‌شده'}
                  </span>
                </div>
              </div>

              {/* KPI 3: Gross Earnings */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {activeMetrics.titleEarnings}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-lg sm:text-xl font-black text-sky-600 dark:text-sky-400 font-mono block">
                    {formatAmount(activeMetrics.earnings, currency)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold">{currencySymbol}</span>
                </div>
              </div>

              {/* KPI 4: Total Advances / Paid */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {activeMetrics.titleAdvances}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono block">
                    {formatAmount(activeMetrics.advances, currency)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold">{currencySymbol}</span>
                </div>
              </div>
            </div>

            {/* C. Payments & Advances Ledger Card */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      {portalMode === 'personal'
                        ? t('myPaymentsLedger') || 'دفتر پرداخت‌ها و مساعده‌ها'
                        : `${language === 'ku' ? 'تۆماری پارەدان و مساعدەی گرووپ' : 'دفتر پرداخت‌ها و مساعده‌های گروه'}`}
                    </h3>
                    <span className="text-[11px] text-slate-400 block">
                      {displayedPayments.length} {t('paymentRecordsCount') || 'تراکنش ثبت‌شده'}
                    </span>
                  </div>
                </div>
              </div>

              {displayedPayments.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-400 text-xs">
                  {t('noPaymentsRecorded') || 'هیچ پرداخت یا مساعده‌ای در این دوره ثبت نشده است.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-200/50 dark:divide-slate-800/70 max-h-[460px] overflow-y-auto">
                  {displayedPayments.map((p) => {
                    const isSettlement =
                      p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled';

                    return (
                      <div
                        key={p.id || `${p.date}_${p.amount}`}
                        className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isSettlement
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                              }`}
                            >
                              {isSettlement ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              <span>
                                {isSettlement
                                  ? t('settlementType') || 'تسویه حساب'
                                  : t('advanceType') || 'مساعده'}
                              </span>
                            </span>

                            <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                              {p.date}
                            </span>

                            {portalMode === 'group' && (
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                • {p.workerName}
                              </span>
                            )}
                          </div>

                          {(p.notes || p.referenceNumber) && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-2 flex-wrap">
                              {p.referenceNumber && (
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                                  #{p.referenceNumber}
                                </span>
                              )}
                              {p.notes && <span className="truncate">{p.notes}</span>}
                            </div>
                          )}
                        </div>

                        <div className="text-end shrink-0">
                          <span className="text-sm font-black font-mono text-slate-900 dark:text-white block">
                            {formatAmount(p.amount, currency)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{currencySymbol}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* END COLUMN (lg:col-span-7): Detailed Attendance Timesheet       */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              {/* Timesheet Card Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200/60 dark:border-slate-800/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                        {portalMode === 'personal'
                          ? t('myMonthlyReport') || 'ریز کارکرد و حضور و غیاب'
                          : selectedSubordinateId === 'all'
                          ? `${
                              language === 'ku'
                                ? 'ڕاپۆرتی گشتی کارکردی ئەندامانی گرووپ'
                                : 'ریز کارکرد تجمیعی پرسنل گروه'
                            } (${workerGroup?.name || ''})`
                          : `${language === 'ku' ? 'ڕاپۆرتی کارکردی' : 'ریز کارکرد'} ${
                              activeSubordinateData?.member.name
                            }`}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {periodTab === 'all'
                          ? labels.allTab
                          : periodTab === 'current'
                          ? labels.currentTab
                          : labels.settledTab}{' '}
                        • {displayedLogs.length} {language === 'ku' ? 'تۆمار' : 'ردیف کارکرد'}
                      </p>
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-64 no-print">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={labels.searchLogsPlaceholder}
                      className="w-full ps-9 pe-8 py-2 text-xs bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500/40 text-slate-900 dark:text-white transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Filter Chips for Log Type */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-print">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 me-1 shrink-0">
                    <Filter className="w-3 h-3" />
                    <span>{language === 'ku' ? 'فلتەر:' : 'فیلتر نوع:'}</span>
                  </span>
                  {[
                    { id: 'all', label: language === 'ku' ? 'هەموو' : 'همه روزها' },
                    { id: 'full', label: t('fullDay') || 'روز کامل' },
                    { id: 'half', label: t('halfDay') || 'نیم‌روز' },
                    { id: 'overtime', label: language === 'ku' ? 'سەروەخت' : 'دارای اضافه‌کاری' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setLogTypeFilter(chip.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                        logTypeFilter === chip.id
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timesheet Content */}
              {displayedLogs.length === 0 ? (
                <div className="p-14 text-center text-slate-400 text-xs">
                  {t('noLogsForMonth') || 'هیچ رکورد کارکردی مطابق با فیلترهای انتخابی یافت نشد.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800">
                        <th className="py-3.5 px-4 text-start font-bold">#</th>
                        {portalMode === 'group' && selectedSubordinateId === 'all' && (
                          <th className="py-3.5 px-4 text-start font-bold">{t('workerName') || 'نام نیرو'}</th>
                        )}
                        <th className="py-3.5 px-4 text-start font-bold">{t('date')}</th>
                        <th className="py-3.5 px-4 text-start font-bold">{t('workType')}</th>
                        <th className="py-3.5 px-4 text-start font-bold">{t('overtimeHours')}</th>
                        <th className="py-3.5 px-4 text-start font-bold">
                          {language === 'ku' ? 'مووچەی بنەڕەت' : 'مزد پایه'}
                        </th>
                        <th className="py-3.5 px-4 text-start font-bold">
                          {language === 'ku' ? 'سەروەخت' : 'اضافه‌کاری'}
                        </th>
                        <th className="py-3.5 px-4 text-start font-bold">
                          {language === 'ku' ? 'کۆی ڕۆژ' : 'مجموع روز'}
                        </th>
                        <th className="py-3.5 px-4 text-center font-bold">{t('status')}</th>
                        <th className="py-3.5 px-4 text-start font-bold">{t('taskNotesTitle')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/70">
                      {displayedLogs.map((l, idx) => {
                        let isSettled = false;
                        if (portalMode === 'personal') {
                          isSettled = personalFinancials?.isLogSettled?.(l) || false;
                        } else {
                          const workerFin = groupMembersFinancials.find(
                            (gf) => String(gf.member.id) === String(l.workerId)
                          );
                          isSettled = workerFin?.isLogSettled?.(l) || false;
                        }
                        const effectiveRate = Number(l.workerDailyRate) || Number(worker.dailyRate);

                        return (
                          <tr
                            key={l.id || `${l.workerId}_${l.date}_${idx}`}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                            {portalMode === 'group' && selectedSubordinateId === 'all' && (
                              <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span>{l.workerName}</span>
                                  {l.workerTeamRole === 'Master' && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold">
                                      {labels.masterRole}
                                    </span>
                                  )}
                                  {l.isWorkerArchived && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold">
                                      {labels.archivedBadge}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              <div className="font-mono">{l.date}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{getDayName(l.date)}</div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {l.type === 'full' && (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  {t('fullDay') || 'روز کامل'}
                                </span>
                              )}
                              {l.type === 'half' && (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  {t('halfDay') || 'نیم‌روز'}
                                </span>
                              )}
                              {l.type === 'hourly' && (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                  {t('hourlyOnly') || 'ساعتی'}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
                              {Number(l.overtimeHours) > 0 ? formatHoursAndMinutes(l.overtimeHours) : '—'}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                              {formatAmount(
                                l.calculatedDailyWage || (l.type === 'half' ? effectiveRate * 0.5 : effectiveRate),
                                currency
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">
                              {Number(l.calculatedOvertimeWage) > 0
                                ? formatAmount(l.calculatedOvertimeWage, currency)
                                : '—'}
                            </td>
                            <td className="py-3.5 px-4 font-black text-sky-600 dark:text-sky-400 font-mono whitespace-nowrap">
                              {formatAmount(l.totalDayPay, currency)}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {periodTab === 'settled' || isSettled ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{labels.settledBadge}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                                  <Clock className="w-3 h-3" />
                                  <span>{labels.unsettledBadge}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                              {l.notes || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Summary Footer Row */}
                    <tfoot>
                      <tr className="bg-slate-100/90 dark:bg-slate-800/80 font-black text-xs border-t-2 border-slate-200 dark:border-slate-700">
                        <td
                          colSpan={portalMode === 'group' && selectedSubordinateId === 'all' ? 4 : 3}
                          className="py-3.5 px-4 text-start text-slate-700 dark:text-slate-200"
                        >
                          {language === 'ku' ? 'کۆی گشتی ئەم خشتەیە:' : 'جمع کل ردیف‌های جدول:'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-purple-600 dark:text-purple-400 whitespace-nowrap">
                          {filteredLogsTotals.totalOtHours > 0
                            ? formatHoursAndMinutes(filteredLogsTotals.totalOtHours)
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {formatAmount(filteredLogsTotals.totalBase, currency)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {filteredLogsTotals.totalOtPay > 0
                            ? formatAmount(filteredLogsTotals.totalOtPay, currency)
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-sky-600 dark:text-sky-400 whitespace-nowrap">
                          {formatAmount(filteredLogsTotals.totalNet, currency)} {currencySymbol}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dual Signature Blocks (Visible when printing Payslip) */}
        <div className="hidden print:flex justify-around items-end pt-16 pb-6 mt-8 border-t border-slate-300 text-xs font-bold text-slate-800">
          <div className="text-center">
            <p className="mb-14">{t('receiptWorkerSign') || 'امضای پرسنل / سرپرست'}</p>
            <div className="w-44 border-b border-slate-600" />
          </div>
          <div className="text-center">
            <p className="mb-14">{t('receiptManagerSign') || 'امضای مدیریت کارگاه'}</p>
            <div className="w-44 border-b border-slate-600" />
          </div>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* 5. STICKY APPLE LIQUID GLASS BOTTOM ACTION & SUMMARY DOCK             */}
      {/* ===================================================================== */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Live Calculation Summary on Start Side */}
          <div className="flex items-center gap-3 sm:gap-6 overflow-x-auto">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">
                {activeMetrics.titleDue}
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-base sm:text-lg font-black font-mono ${
                    activeMetrics.due <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {formatAmount(Math.max(0, activeMetrics.due), currency)}
                </span>
                <span className="text-[11px] font-bold text-slate-500">{currencySymbol}</span>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400 block">
                {activeMetrics.titleDays}
              </span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono">
                {activeMetrics.days} <span className="text-xs font-normal text-slate-400">{t('daysShort') || 'روز'}</span>
              </span>
            </div>

            <div className="h-7 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

            <div className="hidden md:block">
              <span className="text-[10px] font-bold text-slate-400 block">
                {activeMetrics.titleEarnings}
              </span>
              <span className="text-sm font-black text-sky-600 dark:text-sky-400 font-mono">
                {formatAmount(activeMetrics.earnings, currency)} <span className="text-xs font-normal text-slate-400">{currencySymbol}</span>
              </span>
            </div>
          </div>

          {/* Actions on End Side */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => triggerRefresh(true)}
              disabled={isRefreshing}
              className="px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
              <span className="hidden sm:inline">
                {language === 'ku' ? 'نوێکردنەوە' : language === 'en' ? 'Refresh' : 'بروزرسانی'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printMyPayslip') || 'چاپ فیش حقوقی'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
