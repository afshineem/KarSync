import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { pullRemoteChangesSilently } from '../services/realtimeSync';
import { refreshWorkerPortalData } from '../services/workerAccess';
import {
  formatAmount,
  getCurrentYearMonth,
  roundCurrency,
  getCurrencySymbol,
  formatMonthOnly
} from '../utils/formatters';
import { calculateWorkerFinancials } from '../utils/settlementCalculations.js';
import {
  User,
  LogOut,
  Calendar,
  Clock,
  Coins,
  Printer,
  ChevronRight,
  ChevronLeft,
  Sun,
  Sunrise,
  Moon,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  WalletCards,
  Receipt,
  Users,
  Search,
  Layers,
  Sparkles,
  X,
  RefreshCw,
  Globe
} from 'lucide-react';

// Format decimal hours into H:MM clock format (e.g., 1.333 -> 1:20, 1.5 -> 1:30)
function formatOvertimeClock(hoursVal) {
  const num = Number(hoursVal) || 0;
  const totalMinutes = Math.round(num * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Extract day of month number (e.g. "2026-10-16" -> "16")
function getDayOfMonthNumber(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const dayNum = parseInt(parts[2], 10);
    if (!isNaN(dayNum)) return String(dayNum);
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return String(d.getDate());
  } catch {
    // fallback
  }
  return dateStr;
}

// Format YYYY-MM or YYYY-MM-DD into localized "MonthName YYYY" (e.g. "اکتبر 2026")
function formatMonthWithYear(dateOrMonthStr, lang = 'fa') {
  if (!dateOrMonthStr) return '';
  const parts = String(dateOrMonthStr).split('-');
  if (parts.length < 2) return dateOrMonthStr;
  const ym = `${parts[0]}-${parts[1]}`;
  const mName = formatMonthOnly(ym, lang);
  return mName ? `${mName} ${parts[0]}` : ym;
}

export function WorkerViewPortal({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const { language, changeLanguage, direction } = useLanguage();
  const { addToast } = useNotifications();

  // Mode for supervisors: 'personal' (حساب و کارکرد شخصی من) | 'group' (پنل سرپرستی گروه)
  const [portalMode, setPortalMode] = useState('personal');

  // Subordinate selection in group mode: 'all' or workerId
  const [selectedSubordinateId, setSelectedSubordinateId] = useState('all');

  // Period Tab: 'all' (سوابق و کل کارکرد) | 'current' (کارکرد جاری و معوقه) | 'settled' (سوابق تسویه‌شده)
  const [periodTab, setPeriodTab] = useState('all');

  // Quick Filter for attendance log types: 'all' | 'full' | 'half' | 'overtime'
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  // Refreshing state for manual sync button
  const [isRefreshing, setIsRefreshing] = useState(false);

  // User/Settings Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Month navigation for historical settled records
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());

  // Timesheet search input
  const [searchQuery, setSearchQuery] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Manual & background refresh handler
  const triggerRefresh = useCallback(
    async (showFeedback = false) => {
      if (!navigator.onLine) {
        if (showFeedback) {
          addToast({
            type: 'warning',
            title:
              language === 'ku'
                ? 'هێڵی ئینتەرنێت نییە'
                : language === 'en'
                ? 'Offline Mode'
                : 'عدم اتصال به اینترنت',
            message:
              language === 'ku'
                ? 'زانیارییە پاشەکەوتکراوەکان پیشان دەدرێن.'
                : language === 'en'
                ? 'Showing cached local records.'
                : 'اطلاعات ذخیره‌شده آفلاین نمایش داده می‌شود.'
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
            title:
              language === 'ku'
                ? 'نوێکرایەوە'
                : language === 'en'
                ? 'Synchronized'
                : 'بروزرسانی انجام شد',
            message:
              language === 'ku'
                ? 'دوایین زانیارییەکان وەرگیران.'
                : language === 'en'
                ? 'Latest attendance and financial records loaded.'
                : 'آخرین اطلاعات کارکرد و مالی با موفقیت دریافت شد.'
          });
        }
      } catch {
        // Ignore silent background errors
      } finally {
        if (showFeedback) setIsRefreshing(false);
      }
    },
    [user?.via, logout, addToast, language]
  );

  // Proactively load fresh data when the portal opens
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

  // 5. Payment Records to Display
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
      const base =
        Number(l.calculatedDailyWage) ||
        (l.type === 'half' ? effectiveRate * 0.5 : l.type === 'full' ? effectiveRate : 0);
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

  // Explicit localized labels (avoiding missing translation keys)
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
        : 'جستجو بر اساس تاریخ، نام یا توضیحات...',
    fullDayLabel: language === 'ku' ? 'ڕۆژی تەواو' : language === 'en' ? 'Full Day' : 'روز کامل',
    halfDayLabel: language === 'ku' ? 'نیو ڕۆژ' : language === 'en' ? 'Half Day' : 'نیم‌روز',
    hourlyLabel: language === 'ku' ? 'کاتژمێری' : language === 'en' ? 'Hourly' : 'ساعتی',
    overtimeLabel: language === 'ku' ? 'سەروەخت' : language === 'en' ? 'Overtime' : 'اضافه‌کاری',
    dateColTitle: language === 'ku' ? 'بەروار' : language === 'en' ? 'Date' : 'تاریخ',
    workerNameColTitle: language === 'ku' ? 'ناوی کرێکار' : language === 'en' ? 'Worker' : 'نام نیرو',
    workTypeColTitle: language === 'ku' ? 'جۆری کار' : language === 'en' ? 'Work Type' : 'نوع کار',
    totalDayColTitle: language === 'ku' ? 'کۆی ڕۆژ' : language === 'en' ? 'Total Pay' : 'مجموع کل روز',
    statusColTitle: language === 'ku' ? 'دۆخ' : language === 'en' ? 'Status' : 'وضعیت',
    notesColTitle: language === 'ku' ? 'تێبینی' : language === 'en' ? 'Notes' : 'توضیحات',
    daysUnit: language === 'ku' ? 'ڕۆژ' : language === 'en' ? 'days' : 'روز'
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

  // Active metrics to display in Hero Banner
  const activeMetrics =
    portalMode === 'personal'
      ? {
          subjectName: worker.name,
          dailyRate: Number(worker.dailyRate) || 0,
          titleDays: language === 'ku' ? 'ڕۆژانی کارکردن' : language === 'en' ? 'Worked Days' : 'کل کارکرد',
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
          } ${labels.fullDayLabel}`,
          otHours:
            periodTab === 'all'
              ? (personalFinancials?.otHours || 0) + (personalFinancials?.settledOtHours || 0)
              : periodTab === 'current'
              ? personalFinancials?.otHours || 0
              : personalFinancials?.settledOtHours || 0,
          titleEarnings:
            periodTab === 'all'
              ? language === 'ku'
                ? 'کۆی گشتی مووچەی کارکرد'
                : 'کل حقوق و کارکرد ثبت‌شده'
              : periodTab === 'current'
              ? language === 'ku'
                ? 'کارکردی ئێستا'
                : 'حقوق کارکرد جاری'
              : language === 'ku'
              ? 'کارکردی تەسویەکراو'
              : 'کل کارکرد تسویه‌شده',
          earnings:
            periodTab === 'all'
              ? (personalFinancials?.unsettledGross || 0) + (personalFinancials?.settledGross || 0)
              : periodTab === 'current'
              ? personalFinancials?.unsettledGross || 0
              : personalFinancials?.settledGross || 0,
          titleAdvances:
            periodTab === 'all'
              ? language === 'ku'
                ? 'کۆی وەرگیراو و تەسویە'
                : 'کل دریافتی و تسویه‌شده'
              : periodTab === 'current'
              ? language === 'ku'
                ? 'پێشەکی وەرگیراو'
                : 'مساعده دریافتی جاری'
              : language === 'ku'
              ? 'کۆی تەسویەکراو'
              : 'مجموع پرداختی تسویه‌شده',
          advances:
            periodTab === 'all'
              ? (personalFinancials?.unsettledAdvances || 0) +
                (personalFinancials?.totalSettlementPaid || 0) +
                (personalFinancials?.settledAdvances || 0)
              : periodTab === 'current'
              ? personalFinancials?.unsettledAdvances || 0
              : (personalFinancials?.totalSettlementPaid || 0) + (personalFinancials?.settledAdvances || 0),
          titleDue:
            language === 'ku' ? 'ماوەی شایستەی وەرگرتن' : language === 'en' ? 'Net Balance Due' : 'مانده معوق طلب',
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
          titleDays: language === 'ku' ? 'ڕۆژانی کارکردن' : 'روزهای کارکرد',
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
          } ${labels.fullDayLabel}`,
          otHours:
            periodTab === 'all'
              ? (activeSubordinateData?.otHours || 0) + (activeSubordinateData?.settledOtHours || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.otHours || 0
              : activeSubordinateData?.settledOtHours || 0,
          titleEarnings: language === 'ku' ? 'کۆی مووچەی کارکرد' : 'کل حقوق کارکرد',
          earnings:
            periodTab === 'all'
              ? (activeSubordinateData?.unsettledGross || 0) + (activeSubordinateData?.settledGross || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.unsettledGross || 0
              : activeSubordinateData?.settledGross || 0,
          titleAdvances:
            periodTab === 'all'
              ? language === 'ku'
                ? 'کۆی وەرگیراو'
                : 'کل دریافتی و تسویه'
              : periodTab === 'current'
              ? language === 'ku'
                ? 'پێشەکی'
                : 'مساعده و دریافتی'
              : language === 'ku'
              ? 'تەسویەکراو'
              : 'مجموع تسویه‌شده',
          advances:
            periodTab === 'all'
              ? (activeSubordinateData?.unsettledAdvances || 0) +
                (activeSubordinateData?.totalSettlementPaid || 0) +
                (activeSubordinateData?.settledAdvances || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.unsettledAdvances || 0
              : (activeSubordinateData?.totalSettlementPaid || 0) + (activeSubordinateData?.settledAdvances || 0),
          titleDue: language === 'ku' ? 'ماوەی قەرز' : 'مانده معوق طلب',
          due: activeSubordinateData?.netBalanceDue || 0,
          isSettled: (activeSubordinateData?.netBalanceDue || 0) <= 0
        };

  // Dynamic Hero Primary Amount & Subtitle based on active periodTab!
  const heroPrimaryDisplay =
    periodTab === 'all'
      ? {
          amount: activeMetrics.earnings,
          caption:
            language === 'ku'
              ? 'کۆی گشتی کارکرد و مووچەی تۆمارکراو (ئێستا و تەسویەکراو)'
              : language === 'en'
              ? 'Total All-Time Gross Earnings (Open & Settled)'
              : 'مجموع کل حقوق و کارکرد ثبت‌شده (جاری و تسویه‌شده)',
          rightSubLabel: activeMetrics.titleDue,
          rightSubAmount: Math.max(0, activeMetrics.due),
          rightSubColor: 'text-amber-400'
        }
      : periodTab === 'current'
      ? {
          amount: Math.max(0, activeMetrics.due),
          caption:
            language === 'ku'
              ? 'پوختەی قەرز و شایستەی ماوە (دوای لێدەرکردنی پێشەکی)'
              : language === 'en'
              ? 'Current Net Unsettled Balance Due (After Advances)'
              : 'مانده خالص طلب معوقه فعلی (پس از کسر مساعده‌های جاری)',
          rightSubLabel: activeMetrics.titleEarnings,
          rightSubAmount: activeMetrics.earnings,
          rightSubColor: 'text-sky-300'
        }
      : {
          amount: activeMetrics.advances,
          caption:
            language === 'ku'
              ? 'کۆی گشتی مووچە و پارەی تەسویەکراوی پێشوو'
              : language === 'en'
              ? 'Total Settled & Paid Historical Amount'
              : 'مجموع کل مبالغ تسویه‌شده و دریافتی در سوابق تسویه',
          rightSubLabel: activeMetrics.titleEarnings,
          rightSubAmount: activeMetrics.earnings,
          rightSubColor: 'text-sky-300'
        };

  // Calculate payout ratio for visual progress bar
  const grossEarningsVal = Number(activeMetrics.earnings) || 0;
  const paidAdvancesVal = Number(activeMetrics.advances) || 0;
  const payoutProgressPercent =
    periodTab === 'settled'
      ? 100
      : grossEarningsVal <= 0
      ? activeMetrics.isSettled
        ? 100
        : 0
      : Math.min(100, Math.max(0, Math.round((paidAdvancesVal / grossEarningsVal) * 100)));

  const currencySymbol = getCurrencySymbol(currency, language);
  const userInitials = (user?.name || worker?.name || 'K').slice(0, 2).toUpperCase();

  const periodNavItems = [
    { id: 'all', label: labels.allTab, icon: Layers },
    { id: 'current', label: labels.currentTab, icon: Clock },
    { id: 'settled', label: labels.settledTab, icon: CheckCircle2 }
  ];

  return (
    <div
      className="min-h-screen bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300"
      dir={direction}
    >
      {/* ===================================================================== */}
      {/* 1. TOP NAVBAR (With [APP_THEME_BUTTON] Dock & Avatar Dropdown)        */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 no-print transition-all duration-300">
        <div className="absolute inset-0 bg-white/55 dark:bg-slate-950/55 backdrop-blur-3xl backdrop-saturate-200 border-b border-slate-200/50 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_0_rgba(0,0,0,0.4)] -z-10 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Brand & Identity */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0">
                <img
                  src="/karsync-icon.png"
                  alt="KarSync"
                  className="w-full h-full object-contain drop-shadow-sm"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                    KarSync
                  </h1>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    {isSupervisor
                      ? language === 'ku'
                        ? 'پۆرتالی سەرپەرشتیار'
                        : 'پرتال سرپرست'
                      : language === 'ku'
                      ? 'پۆرتالی کارمەند'
                      : 'پرتال پرسنل'}
                  </span>
                </div>
                <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                  {project?.name || (language === 'fa' ? 'پروژه فعال' : 'Active Project')}
                </p>
              </div>
            </div>

            {/* Desktop Center Dock: [APP_THEME_BUTTON] Segmented Period Tabs (Hidden on Mobile) */}
            <div className="hidden md:flex items-center justify-center absolute left-1/2 -translate-x-1/2 pointer-events-auto">
              <nav className="flex items-center gap-1.5 bg-white/40 dark:bg-white/[0.05] backdrop-blur-2xl backdrop-saturate-200 p-1.5 sm:p-2 rounded-2xl border border-white/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1),0_2px_12px_0_rgba(0,0,0,0.3)]">
                {periodNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = periodTab === item.id;
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => setPeriodTab(item.id)}
                        aria-label={item.label}
                        className={`relative p-2.5 rounded-xl transition-all duration-300 ease-in-out flex items-center gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 scale-105 font-bold border border-sky-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Icon className="w-5 h-5 transition-transform group-hover:scale-110 flex-shrink-0" />

                        {/* Active tab displays BOTH icon and text label; Inactive tab displays ONLY icon */}
                        {isActive && (
                          <span className="text-xs font-bold px-1 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap">
                            {item.label}
                          </span>
                        )}

                        {isActive && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs" />
                        )}
                      </button>

                      {/* Hover Micro-Tooltip when inactive */}
                      {!isActive && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          {item.label}
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* End Controls: Sync Button + User Profile Dropdown */}
            <div className="flex items-center gap-2 relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => triggerRefresh(true)}
                disabled={isRefreshing}
                title={language === 'ku' ? 'نوێکردنەوەی زانیارییەکان' : 'بروزرسانی اطلاعات'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/50 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-white/60 dark:border-white/10 backdrop-blur-md text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
              </button>

              {/* User Avatar Dropdown Trigger */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`relative p-0.5 sm:p-1 rounded-2xl border transition-all shadow-xs flex items-center gap-2 sm:pe-2.5 group cursor-pointer ${
                  isDropdownOpen
                    ? 'ring-2 ring-sky-500 shadow-md border-transparent bg-white dark:bg-slate-900'
                    : 'bg-white/50 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border-white/60 dark:border-white/10 backdrop-blur-md'
                }`}
              >
                <div className="relative">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs">
                    {userInitials}
                  </div>
                  <span className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 hidden lg:inline max-w-[110px] truncate">
                  {user?.name || worker?.name}
                </span>
              </button>

              {/* Liquid Glass User & Settings Dropdown (Language, Dark Mode, Logout) */}
              {isDropdownOpen && (
                <div className="absolute top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white/85 dark:bg-slate-950/85 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/70 dark:border-white/15 rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.2)] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.6)] z-50 p-3 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 select-none ltr:right-0 rtl:left-0 space-y-2.5">
                  {/* User Identity Card */}
                  <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                        {userInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {user?.name || worker?.name}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {worker?.teamRole === 'Master' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20">
                              {labels.masterRole}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold border border-sky-500/20">
                              {worker?.role || labels.workerRoleLabel}
                            </span>
                          )}
                          {workerGroup && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                              {workerGroup.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Theme Switcher ([APP_THEME_BUTTON] Segmented Control) */}
                  <div className="p-2 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {language === 'ku' ? 'ڕووکاری بەرنامە' : language === 'en' ? 'Appearance' : 'حالت نمایش'}
                      </span>
                    </div>
                    <div className="flex rounded-xl bg-slate-200/70 dark:bg-slate-900 p-1 border border-slate-300/40 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => theme !== 'light' && toggleTheme()}
                        className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                          theme === 'light'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        {theme === 'light' && (
                          <span>{language === 'ku' ? 'ڕۆژ' : language === 'en' ? 'Light' : 'حالت روشن'}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => theme !== 'dark' && toggleTheme()}
                        className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        {theme === 'dark' && (
                          <span>{language === 'ku' ? 'شەو' : language === 'en' ? 'Dark' : 'حالت تاریک'}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div className="p-2 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/5 space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <Globe className="w-3.5 h-3.5 text-sky-500" />
                      <span>{language === 'ku' ? 'زمانی سیستم' : language === 'en' ? 'Language' : 'زبان برنامه'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl">
                      {[
                        { id: 'fa', label: 'فارسی' },
                        { id: 'ku', label: 'کوردی' },
                        { id: 'en', label: 'English' }
                      ].map((lang) => (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => changeLanguage(lang.id)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            language === lang.id
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Print Payslip Shortcut */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      window.print();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-sky-500" />
                    <span>{language === 'ku' ? 'چاپکردنی پسوولەی مووچە' : 'چاپ فیش حقوقی و کارکرد'}</span>
                  </button>

                  {/* Logout Action */}
                  <div className="border-t border-slate-200/60 dark:border-white/10 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        logout();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>
                        {language === 'fa' ? 'خروج از حساب کاربری' : language === 'ku' ? 'چوونەدەرەوە' : 'Sign Out'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 1B. FLOATING BOTTOM NAVIGATION BAR FOR MOBILE (Apple Liquid Glass)    */}
      {/* ===================================================================== */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 max-w-md mx-auto z-40 no-print">
        <div className="bg-white/75 dark:bg-slate-950/75 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/60 dark:border-white/15 rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.2),inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.15)] p-1.5 flex items-center justify-between gap-1.5">
          {periodNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = periodTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriodTab(item.id)}
                aria-label={item.label}
                title={item.label}
                className={`relative flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-2xl transition-all duration-300 ease-in-out active:scale-95 cursor-pointer ${
                  isActive
                    ? 'flex-[2] bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/35 border border-sky-400/30 font-bold'
                    : 'flex-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isActive && (
                  <span className="text-xs font-bold truncate animate-in fade-in zoom-in-95 duration-200">
                    {item.label}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-xs" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ===================================================================== */}
      {/* 2. MAIN CONTENT CONTAINER (Matches DashboardView Layout)              */}
      {/* ===================================================================== */}
      <main className="space-y-6 pb-28 md:pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Liquid Glass Welcome & Mode Capsule */}
        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/30 transition-all duration-300">
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-sky-500/10 dark:bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-sky-500/25 flex-shrink-0">
                {userInitials}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                    {user?.name || worker?.name}
                  </h2>
                  {worker?.teamRole === 'Master' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      <Sparkles className="w-3 h-3" />
                      <span>{labels.masterRole}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {worker?.role || labels.workerRoleLabel}
                    </span>
                  )}
                  {workerGroup && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Building2 className="w-3 h-3" />
                      <span>{workerGroup.name}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {activeMetrics.dailyRate > 0
                    ? `${language === 'ku' ? 'مووچەی ڕۆژانە:' : 'نرخ پایه روزانه:'} ${formatAmount(
                        activeMetrics.dailyRate,
                        currency
                      )} ${currencySymbol}`
                    : `${project?.name || ''} • ${labels.allGroupMembers}`}
                </p>
              </div>
            </div>

            {/* Supervisor Mode Switcher ([APP_THEME_BUTTON] Segmented Control) */}
            {isSupervisor && (
              <div className="inline-flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner self-start md:self-auto no-print">
                <button
                  type="button"
                  onClick={() => {
                    setPortalMode('personal');
                    setSelectedSubordinateId('all');
                  }}
                  title={labels.myPersonalAccount}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                    portalMode === 'personal'
                      ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  {portalMode === 'personal' && <span>{labels.myPersonalAccount}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setPortalMode('group')}
                  title={labels.groupManagement}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                    portalMode === 'group'
                      ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {portalMode === 'group' && (
                    <>
                      <span>{labels.groupManagement}</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20">
                        {groupMembers.length}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Group Subordinates Selector (When Supervisor is in Group Mode) */}
          {isSupervisor && portalMode === 'group' && (
            <div className="relative z-10 mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800 space-y-3 no-print">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-500" />
                  <span>
                    {language === 'ku'
                      ? 'دیاریکردنی کرێکار بۆ بینینی کارکرد و حسابات:'
                      : 'انتخاب پرسنل زیرمجموعه جهت مشاهده کارکرد و حساب:'}
                  </span>
                </span>
                <span className="text-slate-400">
                  {groupMembers.length} {language === 'ku' ? 'ئەندام' : 'نفر'}
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedSubordinateId('all')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    selectedSubordinateId === 'all'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{labels.allGroupMembers}</span>
                </button>

                {groupMembersFinancials.map((gf) => {
                  const isSelected = String(gf.member.id) === String(selectedSubordinateId);
                  const isArchived = gf.member.isArchived || gf.member.status === 'archived';
                  const totalDays = (gf.effectiveDays || 0) + (gf.settledEffectiveDays || 0);

                  return (
                    <button
                      key={gf.member.id}
                      type="button"
                      onClick={() => setSelectedSubordinateId(String(gf.member.id))}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border cursor-pointer ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/25'
                          : isArchived
                          ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                          : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                      }`}
                    >
                      <span>{gf.member.name}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : gf.netBalanceDue > 0
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {gf.netBalanceDue > 0
                          ? `${formatAmount(gf.netBalanceDue, currency)} ${currencySymbol}`
                          : `${totalDays} ${labels.daysUnit}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 3. EXECUTIVE HERO BANNER (Dynamic Number per Period Tab!)         */}
        {/* ================================================================= */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Main Financial Statement (Col-span 7) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider flex-wrap">
                <WalletCards className="w-4 h-4" />
                <span>
                  {periodTab === 'all'
                    ? labels.allTab
                    : periodTab === 'current'
                    ? labels.currentTab
                    : labels.settledTab}
                </span>
                <span
                  className={`ms-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    periodTab === 'settled' || activeMetrics.isSettled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {periodTab === 'settled' || activeMetrics.isSettled
                    ? language === 'ku'
                      ? 'تەسویەکراو'
                      : 'تسویه شده'
                    : language === 'ku'
                    ? 'قەرزی ماوە'
                    : 'دارای معوقه پرداخت'}
                </span>
              </div>

              {/* Dynamic Big Hero Number that updates when switching tabs */}
              <div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2">
                  <span>{formatAmount(heroPrimaryDisplay.amount, currency)}</span>
                  <span className="text-sm sm:text-base font-bold text-sky-400">{currencySymbol}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">{heroPrimaryDisplay.caption}</p>
              </div>

              {/* Progress Gauge */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs font-semibold flex-wrap gap-2">
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {activeMetrics.titleAdvances}: {formatAmount(activeMetrics.advances, currency)} {currencySymbol}
                  </span>
                  <span className={`${heroPrimaryDisplay.rightSubColor} flex items-center gap-1.5`}>
                    <Coins className="w-3.5 h-3.5" />
                    {heroPrimaryDisplay.rightSubLabel}: {formatAmount(heroPrimaryDisplay.rightSubAmount, currency)}{' '}
                    {currencySymbol}
                  </span>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-700 shadow-md"
                    style={{ width: `${payoutProgressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>
                    {payoutProgressPercent}% {language === 'fa' ? 'دریافت و تسویه شده' : 'Cleared'}
                  </span>
                  <span>
                    {displayedLogs.length} {language === 'fa' ? 'ردیف کارکرد در این نما' : 'records in view'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Metrics & Quick Action Dock (Col-span 5) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              {/* Tile 1: Working Days */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[11px] text-slate-400 block">{activeMetrics.titleDays}</span>
                <span className="text-xl font-black text-white mt-0.5 block font-mono">
                  {activeMetrics.days}{' '}
                  <span className="text-xs font-normal text-slate-400">{labels.daysUnit}</span>
                </span>
                <span className="text-[10px] text-emerald-400 mt-1 block">{activeMetrics.daysSub}</span>
              </div>

              {/* Tile 2: Overtime Hours (Formatted as H:MM) */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[11px] text-slate-400 block">{labels.overtimeLabel}</span>
                <span className="text-xl font-black text-white mt-0.5 block font-mono">
                  {activeMetrics.otHours > 0 ? formatOvertimeClock(activeMetrics.otHours) : '0:00'}
                </span>
                <span className="text-[10px] text-sky-400 mt-1 block">
                  {language === 'fa' ? 'مجموع ساعت اضافه' : 'Total OT Hours'}
                </span>
              </div>

              {/* Quick Action 1: Print Payslip */}
              <button
                type="button"
                onClick={() => window.print()}
                className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all duration-300 cursor-pointer active:scale-95 no-print"
              >
                <Printer className="w-4 h-4" />
                <span>{language === 'ku' ? 'چاپکردن' : 'چاپ فیش'}</span>
              </button>

              {/* Quick Action 2: Sync / Refresh */}
              <button
                type="button"
                onClick={() => triggerRefresh(true)}
                disabled={isRefreshing}
                className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all duration-300 cursor-pointer active:scale-95 no-print"
              >
                <RefreshCw className={`w-4 h-4 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{language === 'ku' ? 'نوێکردنەوە' : 'بروزرسانی'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. FULL-WIDTH ATTENDANCE REPORT ("گزارش کارکرد من")               */}
        {/* ================================================================= */}
        <div className="rounded-3xl backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 overflow-hidden">
          {/* Header & Filters */}
          <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {portalMode === 'personal'
                      ? language === 'ku'
                        ? 'ڕاپۆرتی کارکردی من'
                        : 'گزارش کارکرد من'
                      : selectedSubordinateId === 'all'
                      ? `${
                          language === 'ku'
                            ? 'ڕاپۆرتی گشتی کارکردی ئەندامانی گرووپ'
                            : 'گزارش کارکرد تجمیعی پرسنل گروه'
                        } (${workerGroup?.name || ''})`
                      : `${language === 'ku' ? 'ڕاپۆرتی کارکردی' : 'گزارش کارکرد'} ${
                          activeSubordinateData?.member.name
                        }`}
                  </h3>

                  {/* Active Month Name Badge */}
                  {(displayedLogs[0]?.date || selectedMonth) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300 border border-sky-500/20">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {formatMonthWithYear(
                        periodTab === 'settled' ? selectedMonth : displayedLogs[0]?.date || selectedMonth,
                        language
                      )}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                  {displayedLogs.length} {language === 'ku' ? 'تۆمار' : 'روز کاری ثبت‌شده'}
                </span>
              </div>
            </div>

            {/* Filter Chips ([APP_THEME_BUTTON]) + Month Selector + Search */}
            <div className="flex flex-wrap items-center gap-2.5 no-print">
              {/* [APP_THEME_BUTTON] Segmented Log Type Tabs (Exact Navbar Pattern) */}
              <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 backdrop-blur-2xl p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8),0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-none">
                {[
                  { id: 'all', label: language === 'ku' ? 'هەموو' : 'همه', icon: Layers },
                  { id: 'full', label: labels.fullDayLabel, icon: Sun },
                  { id: 'half', label: labels.halfDayLabel, icon: Sunrise },
                  { id: 'overtime', label: labels.overtimeLabel, icon: Clock }
                ].map((chip) => {
                  const Icon = chip.icon;
                  const isActive = logTypeFilter === chip.id;
                  return (
                    <div key={chip.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => setLogTypeFilter(chip.id)}
                        aria-label={chip.label}
                        className={`relative p-2 sm:p-2.5 rounded-xl transition-all duration-300 ease-in-out flex items-center gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 scale-105 font-bold border border-sky-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-hover:scale-110 flex-shrink-0" />

                        {/* Active tab displays BOTH icon and text label; Inactive tab displays ONLY icon */}
                        {isActive && (
                          <span className="text-xs font-bold px-1 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap">
                            {chip.label}
                          </span>
                        )}

                        {isActive && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs" />
                        )}
                      </button>

                      {/* Hover Micro-Tooltip when inactive */}
                      {!isActive && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          {chip.label}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-solid border-t-slate-900/90 border-t-4 border-x-transparent border-x-4 border-b-0" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {periodTab === 'settled' && (
                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 px-2.5 py-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleShiftMonth(-1)}
                    className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                  <span className="text-xs font-bold px-1.5 text-slate-700 dark:text-slate-200">
                    {formatMonthWithYear(selectedMonth, language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleShiftMonth(1)}
                    className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* Search Box */}
              <div className="relative flex-1 sm:flex-initial sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={labels.searchLogsPlaceholder}
                  className="w-full ps-8 pe-7 py-2 text-xs bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500/40 text-slate-900 dark:text-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Responsive Zero-Horizontal-Scroll Attendance List */}
          {displayedLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              {language === 'ku'
                ? 'هیچ تۆمارێکی کارکردن لەم بەشەدا نییە.'
                : 'هیچ رکورد کارکردی در این بخش ثبت نشده است.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-800/70">
              {/* Desktop Header Bar (Compact columns + wide Notes column with title) */}
              <div className="hidden md:grid md:grid-cols-12 gap-3 px-6 py-3 bg-slate-100/60 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 items-center">
                <div className="col-span-1 text-center">{labels.dateColTitle}</div>
                {portalMode === 'group' && selectedSubordinateId === 'all' && (
                  <div className="col-span-2">{labels.workerNameColTitle}</div>
                )}
                <div className="col-span-2">{labels.workTypeColTitle}</div>
                <div className="col-span-2">{labels.totalDayColTitle}</div>
                <div className="col-span-2 text-center">{labels.statusColTitle}</div>
                <div className={portalMode === 'group' && selectedSubordinateId === 'all' ? 'col-span-3' : 'col-span-5'}>
                  {labels.notesColTitle}
                </div>
              </div>

              {/* Attendance Rows (Grouped with Month Section Headers) */}
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
                const hasOt = Number(l.overtimeHours) > 0;

                const currentMonthKey = (l.date || '').slice(0, 7);
                const prevMonthKey = idx > 0 ? (displayedLogs[idx - 1]?.date || '').slice(0, 7) : null;
                const showMonthDivider = currentMonthKey && currentMonthKey !== prevMonthKey;

                return (
                  <React.Fragment key={l.id || `${l.workerId}_${l.date}_${idx}`}>
                    {showMonthDivider && (
                      <div className="px-4 sm:px-6 py-2.5 bg-sky-50/70 dark:bg-sky-950/25 border-y border-sky-200/50 dark:border-sky-800/40 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                          <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span className="text-xs font-extrabold text-sky-900 dark:text-sky-200">
                            {language === 'ku' ? 'مانگی' : 'ماه'}{' '}
                            {formatMonthWithYear(l.date, language)}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-sky-700/80 dark:text-sky-300/70 bg-white/70 dark:bg-slate-900/60 px-2.5 py-0.5 rounded-lg border border-sky-200/60 dark:border-sky-800/50">
                          {currentMonthKey}
                        </span>
                      </div>
                    )}

                    <div
                      className="px-4 sm:px-6 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors grid grid-cols-1 md:grid-cols-12 gap-2.5 md:gap-3 items-center text-xs"
                    >
                      {/* 1. Date: Day of Month in Large Bold Font + Weekday in Small Font Underneath */}
                      <div
                        className="md:col-span-1 flex items-center justify-between md:justify-center"
                        title={l.date}
                      >
                        <div className="flex flex-col items-center justify-center min-w-[44px] py-1 px-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-base sm:text-lg font-black font-mono leading-none text-slate-900 dark:text-white">
                          {getDayOfMonthNumber(l.date)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-none">
                          {getDayName(l.date)}
                        </span>
                      </div>

                      {/* Mobile Total Pay (Pure Amount without Currency Unit) */}
                      <div className="md:hidden text-end">
                        <span className="text-sm font-black font-mono text-sky-600 dark:text-sky-400">
                          {formatAmount(l.totalDayPay, currency)}
                        </span>
                      </div>
                    </div>

                    {/* 2. Worker Name (Group All mode only) */}
                    {portalMode === 'group' && selectedSubordinateId === 'all' && (
                      <div className="md:col-span-2 font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{l.workerName}</span>
                        {l.workerTeamRole === 'Master' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                            {labels.masterRole}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 3. Work Type (Persian) + Overtime formatted as 1:20 */}
                    <div className="md:col-span-2 flex items-center gap-1.5 flex-wrap">
                      {l.type === 'full' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {labels.fullDayLabel}
                        </span>
                      )}
                      {l.type === 'half' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {labels.halfDayLabel}
                        </span>
                      )}
                      {l.type === 'hourly' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {labels.hourlyLabel}
                        </span>
                      )}
                      {hasOt && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          <Clock className="w-3 h-3" />
                          <span>{formatOvertimeClock(l.overtimeHours)}</span>
                        </span>
                      )}
                    </div>

                    {/* 4. Total Day Pay (Desktop - Pure Amount without Currency Unit) */}
                    <div className="hidden md:block md:col-span-2 font-black text-sm text-sky-600 dark:text-sky-400 font-mono">
                      {formatAmount(l.totalDayPay, currency)}
                    </div>

                    {/* 5. Status Badge */}
                    <div className="md:col-span-2 flex items-center md:justify-center">
                      {periodTab === 'settled' || isSettled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{labels.settledBadge}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>{labels.unsettledBadge}</span>
                        </span>
                      )}
                    </div>

                    {/* 6. Notes (Wide Column) */}
                    <div
                      className={`${
                        portalMode === 'group' && selectedSubordinateId === 'all' ? 'md:col-span-3' : 'md:col-span-5'
                      } text-slate-600 dark:text-slate-300 leading-relaxed break-words`}
                    >
                      {l.notes || <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </div>
                  </div>
                </React.Fragment>
                );
              })}

              {/* Summary Footer Bar */}
              <div className="px-6 py-4 bg-slate-100/80 dark:bg-slate-800/70 flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-200">
                  {language === 'ku' ? 'کۆی گشتی ئەم خشتەیە:' : 'جمع کل کارکردهای لیست بالا:'} ({displayedLogs.length}{' '}
                  {language === 'ku' ? 'تۆمار' : 'ردیف'})
                </span>
                <div className="flex flex-wrap items-center gap-4 font-mono">
                  {filteredLogsTotals.totalOtHours > 0 && (
                    <span className="text-purple-600 dark:text-purple-400">
                      {labels.overtimeLabel}: {formatOvertimeClock(filteredLogsTotals.totalOtHours)}
                    </span>
                  )}
                  <span className="text-sm font-black text-sky-600 dark:text-sky-400">
                    {language === 'ku' ? 'کۆی گشتی:' : 'مجموع کل:'} {formatAmount(filteredLogsTotals.totalNet, currency)}{' '}
                    {currencySymbol}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 5. PAYMENTS & ADVANCES LEDGER CAPSULE                             */}
        {/* ================================================================= */}
        <div className="rounded-3xl p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  {portalMode === 'personal'
                    ? language === 'ku'
                      ? 'دەفتەری پارەدان و پێشەکییەکان'
                      : 'دفتر پرداخت‌ها و مساعده‌ها'
                    : `${language === 'ku' ? 'تۆماری پارەدان و مساعدەی گرووپ' : 'دفتر پرداخت‌ها و مساعده‌های گروه'}`}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {displayedPayments.length} {language === 'ku' ? 'تۆمار' : 'تراکنش ثبت‌شده'}
                </span>
              </div>
            </div>
          </div>

          {displayedPayments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              {language === 'ku'
                ? 'هیچ پارەدان یان پێشەکییەک لەم ماوەیەدا تۆمار نەکراوە.'
                : 'هیچ پرداخت یا مساعده‌ای در این دوره ثبت نشده است.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {displayedPayments.map((p) => {
                const isSettlement =
                  p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled';

                return (
                  <div
                    key={p.id || `${p.date}_${p.amount}`}
                    className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between gap-3 hover:border-sky-500/30 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSettlement
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {isSettlement ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>
                            {isSettlement
                              ? language === 'ku'
                                ? 'تەسویەی حیساب'
                                : 'تسویه حساب'
                              : language === 'ku'
                              ? 'پێشەکی (مساعدە)'
                              : 'مساعده'}
                          </span>
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                          {p.date}
                        </span>
                      </div>

                      {portalMode === 'group' && (
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                          {p.workerName}
                        </div>
                      )}

                      {(p.notes || p.referenceNumber) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {p.referenceNumber ? `#${p.referenceNumber} ` : ''}
                          {p.notes || ''}
                        </div>
                      )}
                    </div>

                    <div className="text-end shrink-0">
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                        {formatAmount(p.amount, currency)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{currencySymbol}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dual Signature Blocks (Visible when printing Payslip) */}
        <div className="hidden print:flex justify-around items-end pt-16 pb-6 mt-8 border-t border-slate-300 text-xs font-bold text-slate-800">
          <div className="text-center">
            <p className="mb-14">
              {language === 'ku' ? 'واژۆی کارمەند / سەرپەرشتیار' : 'امضای پرسنل / سرپرست'}
            </p>
            <div className="w-44 border-b border-slate-600" />
          </div>
          <div className="text-center">
            <p className="mb-14">
              {language === 'ku' ? 'واژۆی بەڕێوەبەری کارگە' : 'امضای مدیریت کارگاه'}
            </p>
            <div className="w-44 border-b border-slate-600" />
          </div>
        </div>
      </main>
    </div>
  );
}
