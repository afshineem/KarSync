import { deleteLogLive } from '../services/realtimeSync';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { calculateWorkerFinancials } from "../utils/settlementCalculations";
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { EditRecordModal } from './EditRecordModal';
import AttendanceRecycleBinModal from './AttendanceRecycleBinModal';
import { WorkersModal } from './WorkersModal';
import { 
  formatCurrency, 
  formatAmount,
  formatNumber, 
  getCurrentYearMonth, 
  getTodayDateString, 
  formatDateDisplay, 
  formatFullDateWithWeekday, 
  formatHoursAndMinutes,
  formatHoursDigital,
  roundCurrency,
  getCurrencySymbol,
  formatMonthOnly
} from '../utils/formatters';
import { exportAttendanceToExcel, triggerPrintReport } from './ExportEngine';
import { 
  Calendar as CalendarIcon, 
  ListFilter, 
  FileSpreadsheet, 
  Printer, 
  Trash2, 
  Edit2,
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Clock, 
  Coins, 
  CalendarDays,
  LayoutGrid,
  ClipboardList,
  X, 
  PieChart, 
  TableProperties, 
  FileText, 
  CalendarCheck, 
  PlusCircle, 
  Search, 
  ArrowUpDown, 
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  ArrowDown01,
  ArrowDown10,
  CheckCircle2, 
  AlertCircle,
  Layers,
  CalendarPlus,
  RotateCcw,
  Filter,
  User,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Award,
  Sparkles
} from 'lucide-react';

const TIMELINE_SORT_KEY = 'karsync_timeline_sort_ascending';
const CALENDAR_VIEW_MODE_KEY = 'karsync_calendar_view_mode';

export function CalendarReportsView({ onOpenLoggingModal, navTarget, onNavConsumed }) {
  const { t, language, direction } = useLanguage();
  const { currentProject, openWorkerProfile } = useProject();
  const currency = currentProject?.currency || 'IQD';

  // Primary view mode: 'timeline' (لیست تفکیک روزانه) | 'calendar' (تقویم شبکه‌ای) | 'logs' (گزارش‌ها)
  const [viewMode, setViewModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(CALENDAR_VIEW_MODE_KEY);
      return saved && ['timeline', 'calendar', 'logs'].includes(saved) ? saved : 'timeline';
    } catch {
      return 'timeline';
    }
  }); 

  const setViewMode = (mode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(CALENDAR_VIEW_MODE_KEY, mode);
    } catch (_) {}
  };

  const [calendarMonth, setCalendarMonth] = useState(getCurrentYearMonth()); // 'YYYY-MM'
  const [editingLog, setEditingLog] = useState(null);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isWorkersModalOpen, setIsWorkersModalOpen] = useState(false);

  // Timeline list controls with persistent sort order
  const [filterOnlyWithLogs, setFilterOnlyWithLogs] = useState(true);
  const [sortAscending, setSortAscending] = useState(() => {
    try {
      const saved = localStorage.getItem(TIMELINE_SORT_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleSortOrder = () => {
    setSortAscending((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TIMELINE_SORT_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const [timelineSearch, setTimelineSearch] = useState('');

  // Timeline Day Cards Expansion State: Set of expanded date strings (defaults to latest days or today)
  const [expandedDayKeys, setExpandedDayKeys] = useState(() => {
    try {
      const today = getTodayDateString();
      return new Set([today]);
    } catch {
      return new Set();
    }
  });

  const toggleDayExpanded = (dateStr) => {
    setExpandedDayKeys((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const expandAllDays = (allDateStrings) => {
    setExpandedDayKeys(new Set(allDateStrings));
  };

  const collapseAllDays = () => {
    setExpandedDayKeys(new Set());
  };

  // In Reporting mode: Dynamic Adaptive Hub states
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [showDetailsInHero, setShowDetailsInHero] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [isSearchPickerOpen, setIsSearchPickerOpen] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const searchInputRef = useRef(null);

  // Keyboard shortcut: Pressing '/' or '\' focuses the search input in reports view
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (viewMode !== 'logs') return;
      // Do not trigger if user is already typing in an input, textarea, or contentEditable element
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) {
        return;
      }
      if (e.key === '/' || e.key === '\\') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select?.();
          setIsSearchPickerOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [viewMode]);

  // Filters for reporting
  const [selectedWorkerId, setSelectedWorkerId] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedSettlementStatus, setSelectedSettlementStatus] = useState('all'); // 'all' | 'current' | 'settled'
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSectionId, setSelectedSectionId] = useState('all');

  const clearAllFilters = () => {
    setSelectedWorkerId('all');
    setSelectedGroupId('all');
    setSelectedSettlementStatus('all');
    setSelectedType('all');
    setSelectedSectionId('all');
    setReportSearch('');
    setShowDetailsInHero(false);
  };
  
  // Date range defaults to current month
  const [dateFrom, setDateFrom] = useState(() => `${getCurrentYearMonth()}-01`);
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, Number(m), 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  });
  const [activeDatePreset, setActiveDatePreset] = useState('thisMonth'); // 'thisMonth' | 'lastMonth' | 'last30Days' | 'custom'

  const applyDatePreset = (presetKey) => {
    setActiveDatePreset(presetKey);
    const now = new Date();
    if (presetKey === 'thisMonth') {
      const ym = getCurrentYearMonth();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      setDateFrom(`${ym}-01`);
      setDateTo(`${ym}-${String(lastDay).padStart(2, '0')}`);
    } else if (presetKey === 'lastMonth') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, prevDate.getMonth() + 1, 0).getDate();
      setDateFrom(`${y}-${m}-01`);
      setDateTo(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    } else if (presetKey === 'last30Days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const toY = now.getFullYear();
      const toM = String(now.getMonth() + 1).padStart(2, '0');
      const toD = String(now.getDate()).padStart(2, '0');
      const fromY = past.getFullYear();
      const fromM = String(past.getMonth() + 1).padStart(2, '0');
      const fromD = String(past.getDate()).padStart(2, '0');
      setDateFrom(`${fromY}-${fromM}-${fromD}`);
      setDateTo(`${toY}-${toM}-${toD}`);
    } else if (presetKey === 'allTime') {
      setDateFrom('2020-01-01');
      const toY = now.getFullYear();
      const toM = String(now.getMonth() + 1).padStart(2, '0');
      const toD = String(now.getDate()).padStart(2, '0');
      setDateTo(`${toY}-${toM}-${toD}`);
    }
  };

  // Inspected date string for quick modal inspection from monthly calendar
  const [inspectedDateStr, setInspectedDateStr] = useState(null);
  useEffect(() => {
    const handleInspect = (e) => {
      if (e.detail?.date) {
        setDateFrom(e.detail.date);
        setDateTo(e.detail.date);
        setInspectedDateStr(e.detail.date);
      }
    };
    window.addEventListener('inspectDate', handleInspect);
    return () => window.removeEventListener('inspectDate', handleInspect);
  }, []);

  // Open a specific day requested from outside (e.g. the audit log "eye" button):
  // show the monthly calendar on that month and open the day's details.
  useEffect(() => {
    const date = navTarget?.date;
    if (!date) return;
    setViewMode('calendar');
    setCalendarMonth(String(date).slice(0, 7));
    setInspectedDateStr(date);
    if (onNavConsumed) onNavConsumed();
  }, [navTarget]);

  // Listen to external group navigation (e.g. clicking on task group in dashboard)
  useEffect(() => {
    const handleFilterGroup = async (e) => {
      let gId = e.detail?.groupId;
      const gName = e.detail?.groupName;
      if (!gId && gName) {
        try {
          const match = await db.groups.where('name').equalsIgnoreCase(gName).first();
          if (match) gId = match.id;
        } catch (_) {}
      }
      if (gId) {
        setSelectedGroupId(String(gId));
      }
      setViewMode('logs');
      setReportFormat('detailed');
    };
    window.addEventListener('karsync-filter-group', handleFilterGroup);
    return () => window.removeEventListener('karsync-filter-group', handleFilterGroup);
  }, []);

  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // Fetch project sections
  const projectSections = useLiveQuery(
    async () => {
      if (!targetProjectId) return [];
      return await db.projectSections.where('projectId').equals(targetProjectId).toArray();
    },
    [targetProjectId]
  ) || [];

  const sectionMap = useMemo(() => {
    const map = {};
    projectSections.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [projectSections]);

  // Dexie live queries (Reactive) scoped to active project with fallback for legacy records
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  const rawLogs = useLiveQuery(
    async () => {
      const [list, wList] = await Promise.all([
        db.attendanceLogs.toArray(),
        db.workers.toArray()
      ]);
      const projectWorkerIds = new Set(
        wList
          .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId)
          .map((w) => String(w.id))
      );
      return list.filter((l) => 
        (l.projectId || DEFAULT_PROJECT_ID) === targetProjectId || 
        projectWorkerIds.has(String(l.workerId))
      );
    },
    [targetProjectId]
  ) || [];

  // Deduplicate logs by workerId + date in memory to guarantee 1 log per worker per day
  const allLogs = useMemo(() => {
    const map = new Map();
    rawLogs.forEach((l) => {
      const key = `${String(l.workerId)}_${l.date}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, l);
      } else {
        const timeL = l.updatedAt || l.createdAt || '';
        const timeEx = existing.updatedAt || existing.createdAt || '';
        if (timeL.localeCompare(timeEx) > 0) {
          map.set(key, l);
        }
      }
    });
    return Array.from(map.values());
  }, [rawLogs]);

  const workerMap = useMemo(() => {
    const map = {};
    workers.forEach((w) => {
      map[w.id] = w;
      map[String(w.id)] = w;
    });
    return map;
  }, [workers]);

  // Live query groups for current project with fallback for legacy/unscoped records
  const groups = useLiveQuery(
    async () => {
      try {
        const [allDbGroups, allDbWorkers] = await Promise.all([
          db.groups.toArray(),
          db.workers.toArray()
        ]);
        const projectWorkerGroupIds = new Set(
          allDbWorkers
            .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId && w.groupId)
            .map((w) => String(w.groupId))
        );
        let list = allDbGroups.filter((g) => 
          !targetProjectId || 
          !g.projectId || 
          String(g.projectId) === String(targetProjectId) ||
          (g.projectId || DEFAULT_PROJECT_ID) === targetProjectId ||
          projectWorkerGroupIds.has(String(g.id))
        );
        if (list.length === 0 && allDbGroups.length > 0) {
          list = allDbGroups;
        }
        return list;
      } catch (err) {
        console.error('Error fetching groups in CalendarReportsView:', err);
        return [];
      }
    },
    [targetProjectId]
  ) || [];

  // Group options combining db.groups and any group referenced by workers
  const groupOptions = useMemo(() => {
    const list = [...groups];
    const existingIds = new Set(list.map((g) => String(g.id)));
    workers.forEach((w) => {
      if (w.groupId && !existingIds.has(String(w.groupId))) {
        list.push({
          id: w.groupId,
          name: w.groupName || w.groupId,
          projectId: targetProjectId
        });
        existingIds.add(String(w.groupId));
      }
    });
    return list;
  }, [groups, workers, targetProjectId]);

  const groupMap = useMemo(() => {
    const map = {};
    groupOptions.forEach((g) => {
      map[g.id] = g;
      map[String(g.id)] = g;
    });
    return map;
  }, [groupOptions]);

  // Live query payments to track settlement receipts & dates
  const allPayments = useLiveQuery(
    async () => {
      const [list, wList] = await Promise.all([
        db.payments.toArray(),
        db.workers.toArray()
      ]);
      const projectWorkerIds = new Set(
        wList
          .filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId)
          .map((w) => String(w.id))
      );
      return list.filter((p) => 
        (p.projectId || DEFAULT_PROJECT_ID) === targetProjectId || 
        projectWorkerIds.has(String(p.workerId))
      );
    },
    [targetProjectId]
  ) || [];

  const settledLogIds = useMemo(() => {
    const ids = new Set();
    workers.forEach((w) => {
      const workerLogs = allLogs.filter(l => String(l.workerId) === String(w.id));
      const workerPayments = allPayments.filter(p => String(p.workerId) === String(w.id) || (w.groupId && p.groupId === w.groupId));
      const fin = calculateWorkerFinancials(w, workerLogs, workerPayments);
      workerLogs.forEach(l => {
        if (fin.isLogSettled(l)) {
          ids.add(String(l.id));
        }
      });
    });
    return ids;
  }, [workers, allLogs, allPayments]);

  const isLogSettled = (log) => {
    return settledLogIds.has(String(log.id));
  };

  // Filter workers list for worker dropdown when a group is selected (both summary & detailed)
  const workersForSelect = useMemo(() => {
    if (selectedGroupId === 'all') return workers;
    if (selectedGroupId === 'unassigned') {
      return workers.filter((w) => !w.groupId);
    }
    return workers.filter((w) => String(w.groupId) === String(selectedGroupId));
  }, [workers, selectedGroupId]);

  // Search picker items for instant suggestion & keyboard arrow navigation
  const searchPickerItems = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    const items = [];

    // Filter groups
    const matchedGroups = groupOptions.filter((g) => !q || g.name.toLowerCase().includes(q));
    matchedGroups.forEach((g) => {
      items.push({
        type: 'group',
        id: String(g.id),
        name: g.name,
        count: workers.filter((w) => String(w.groupId) === String(g.id)).length
      });
    });

    // Filter workers
    const matchedWorkers = workers.filter(
      (w) => !q || w.name.toLowerCase().includes(q) || (w.role && w.role.toLowerCase().includes(q))
    );
    matchedWorkers.forEach((w) => {
      items.push({
        type: 'worker',
        id: String(w.id),
        name: w.name,
        role: w.role,
        groupName: w.groupId && groupMap[w.groupId] ? groupMap[w.groupId].name : null
      });
    });

    return items;
  }, [groupOptions, workers, groupMap, reportSearch]);

  // ========================================================
  // 1. MONTHLY TIMELINE DATA (Day-by-Day Detailed Breakdown)
  // ========================================================
  const monthTimelineData = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const totalDaysInMonth = new Date(y, m, 0).getDate();
    const list = [];

    let totalMonthDaysWorked = 0;
    let totalMonthOt = 0;
    let totalMonthSalary = 0;

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      const dayLogs = allLogs.filter((l) => l.date === dateStr);

      const totalWorkers = dayLogs.length;
      const fullDaysCount = dayLogs.filter((l) => l.type === 'full').length;
      const halfDaysCount = dayLogs.filter((l) => l.type === 'half').length;
      const hourlyDaysCount = dayLogs.filter((l) => l.type === 'hourly').length;
      const totalOvertime = dayLogs.reduce((acc, l) => acc + (Number(l.overtimeHours) || 0), 0);
      const totalPay = dayLogs.reduce((acc, l) => acc + (Number(l.totalDayPay) || 0), 0);

      if (totalWorkers > 0) {
        totalMonthDaysWorked += 1;
        totalMonthOt = Number((totalMonthOt + totalOvertime).toFixed(4));
        totalMonthSalary = roundCurrency(totalMonthSalary + totalPay, currency);
      }

      // Collect notes
      const notesList = [];
      dayLogs.forEach((l) => {
        if (l.notes && l.notes.trim()) {
          const workerName = workerMap[l.workerId]?.name || 'نامشخص';
          notesList.push({
            workerId: l.workerId,
            workerName,
            text: l.notes.trim(),
            log: l
          });
        }
      });

      list.push({
        dayNumber: d,
        dateStr,
        logs: dayLogs,
        totalWorkers,
        fullDaysCount,
        halfDaysCount,
        totalOvertime,
        totalPay,
        notesList
      });
    }

    return {
      days: list,
      monthStats: {
        daysWorked: totalMonthDaysWorked,
        totalOvertime: Number(totalMonthOt.toFixed(4)),
        totalSalary: totalMonthSalary,
        totalEntries: allLogs.filter((l) => l.date.startsWith(calendarMonth)).length
      }
    };
  }, [calendarMonth, allLogs, workerMap]);

  // Filter & Search on timeline days
  const displayedTimelineDays = useMemo(() => {
    let result = monthTimelineData.days;

    if (filterOnlyWithLogs) {
      result = result.filter((d) => d.totalWorkers > 0);
    }

    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase();
      result = result.filter((d) => {
        if (d.dateStr.includes(q)) return true;
        const hasWorker = d.logs.some((l) => {
          const w = workerMap[l.workerId];
          return w && w.name.toLowerCase().includes(q);
        });
        if (hasWorker) return true;
        const hasNotes = d.notesList.some((n) => n.text.toLowerCase().includes(q));
        return hasNotes;
      });
    }

    if (!sortAscending) {
      result = [...result].reverse();
    }

    return result;
  }, [monthTimelineData, filterOnlyWithLogs, timelineSearch, sortAscending, workerMap]);

  // ========================================================
  // 2. CALENDAR GRID MATRIX
  // ========================================================
  const calendarData = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const firstDayIndex = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();

    const dayLogsMap = {};
    allLogs.forEach((l) => {
      if (l.date.startsWith(calendarMonth)) {
        if (!dayLogsMap[l.date]) dayLogsMap[l.date] = [];
        dayLogsMap[l.date].push(l);
      }
    });

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      const dayLogs = dayLogsMap[dateStr] || [];
      const totalWorkers = dayLogs.length;
      const totalOvertime = dayLogs.reduce((acc, l) => acc + (Number(l.overtimeHours) || 0), 0);
      const totalPay = dayLogs.reduce((acc, l) => acc + (Number(l.totalDayPay) || 0), 0);

      days.push({
        dayNumber: d,
        dateStr,
        logs: dayLogs,
        totalWorkers,
        totalOvertime,
        totalPay
      });
    }

    return days;
  }, [calendarMonth, allLogs]);

  // Modal inspection logs
  const inspectedDateLogs = useMemo(() => {
    if (!inspectedDateStr) return [];
    return allLogs.filter((l) => l.date === inspectedDateStr);
  }, [allLogs, inspectedDateStr]);

  const inspectedTotalPay = useMemo(() => {
    return inspectedDateLogs.reduce((acc, l) => acc + (Number(l.totalDayPay) || 0), 0);
  }, [inspectedDateLogs]);

  // ========================================================
  // 3. REPORTING ENGINE DATA (Summary vs Detailed)
  // ========================================================
  const filteredLogs = useMemo(() => {
    return allLogs
      .filter((log) => {
        if (selectedWorkerId !== 'all' && String(log.workerId) !== String(selectedWorkerId)) return false;
        if (selectedType !== 'all' && log.type !== selectedType) return false;
        if (selectedSectionId !== 'all') {
          if (selectedSectionId === 'unassigned') {
            if (log.sectionId) return false;
          } else if (String(log.sectionId) !== String(selectedSectionId)) {
            return false;
          }
        }
        // Filters for Group and Settlement Status (applies to both Summary and Detailed reports)
        if (selectedGroupId !== 'all') {
          const w = workerMap[String(log.workerId)];
          if (selectedGroupId === 'unassigned') {
            if (w?.groupId) return false;
          } else {
            if (!w || String(w.groupId) !== String(selectedGroupId)) return false;
          }
        }
        if (selectedSettlementStatus === 'current') {
          if (isLogSettled(log)) return false;
        } else if (selectedSettlementStatus === 'settled') {
          if (!isLogSettled(log)) return false;
        }
        if (dateFrom && log.date < dateFrom) return false;
        if (dateTo && log.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allLogs, selectedWorkerId, selectedType, selectedSectionId, selectedGroupId, selectedSettlementStatus, dateFrom, dateTo, workerMap]);

  // Project section breakdown in reporting
  const sectionBreakdown = useMemo(() => {
    if (projectSections.length === 0) return [];
    const breakdown = {};

    projectSections.forEach((s) => {
      breakdown[s.id] = {
        id: s.id,
        name: s.name,
        days: 0,
        otHours: 0,
        totalCost: 0,
        entriesCount: 0
      };
    });

    breakdown['unassigned'] = {
      id: 'unassigned',
      name: language === 'fa' ? 'عمومی / بدون بخش' : 'General / Unassigned',
      days: 0,
      otHours: 0,
      totalCost: 0,
      entriesCount: 0
    };

    filteredLogs.forEach((l) => {
      const targetSecId = l.sectionId && breakdown[String(l.sectionId)] ? String(l.sectionId) : 'unassigned';
      const item = breakdown[targetSecId];
      item.days += l.type === 'hourly' ? 0 : l.type === 'half' ? 0.5 : 1.0;
      item.otHours += Number(l.overtimeHours) || 0;
      item.totalCost += Number(l.totalDayPay) || 0;
      item.entriesCount += 1;
    });

    return Object.values(breakdown).filter((b) => b.entriesCount > 0);
  }, [filteredLogs, projectSections, language]);

  const aggregatedStats = useMemo(() => {
    let days = 0;
    let otHours = 0;
    let basePay = 0;
    let otPay = 0;
    let totalPay = 0;
    let settledPay = 0;
    let unsettledPay = 0;
    let settledEntries = 0;
    let unsettledEntries = 0;

    filteredLogs.forEach((l) => {
      days += l.type === 'hourly' ? 0 : l.type === 'half' ? 0.5 : 1.0;
      otHours += Number(l.overtimeHours) || 0;
      basePay += Number(l.calculatedDailyWage) || 0;
      otPay += Number(l.calculatedOvertimeWage) || 0;
      const dayTotal = Number(l.totalDayPay) || 0;
      totalPay += dayTotal;

      if (isLogSettled(l)) {
        settledPay += dayTotal;
        settledEntries += 1;
      } else {
        unsettledPay += dayTotal;
        unsettledEntries += 1;
      }
    });

    const settledPercent = totalPay > 0 ? Math.round((settledPay / totalPay) * 100) : 0;
    const unsettledPercent = totalPay > 0 ? 100 - settledPercent : 0;

    return {
      entriesCount: filteredLogs.length,
      days,
      otHours,
      basePay: roundCurrency(basePay, currency),
      otPay: roundCurrency(otPay, currency),
      totalPay: roundCurrency(totalPay, currency),
      settledPay: roundCurrency(settledPay, currency),
      unsettledPay: roundCurrency(unsettledPay, currency),
      settledEntries,
      unsettledEntries,
      settledPercent,
      unsettledPercent
    };
  }, [filteredLogs, currency, isLogSettled]);

  const summaryGroupedData = useMemo(() => {
    const grouped = {};

    filteredLogs.forEach((log) => {
      if (!grouped[log.workerId]) {
        grouped[log.workerId] = {
          workerId: log.workerId,
          fullDaysCount: 0,
          fullDaysPay: 0,
          halfDaysCount: 0,
          halfDaysPay: 0,
          hourlyDaysCount: 0,
          overtimeHours: 0,
          overtimePay: 0,
          totalPay: 0
        };
      }
      const g = grouped[log.workerId];
      if (log.type === 'half') {
        g.halfDaysCount += 1;
        g.halfDaysPay += Number(log.calculatedDailyWage) || 0;
      } else if (log.type === 'hourly') {
        g.hourlyDaysCount += 1;
      } else {
        g.fullDaysCount += 1;
        g.fullDaysPay += Number(log.calculatedDailyWage) || 0;
      }
      g.overtimeHours += Number(log.overtimeHours) || 0;
      g.overtimePay += Number(log.calculatedOvertimeWage) || 0;
      g.totalPay += Number(log.totalDayPay) || 0;
    });

    return Object.values(grouped).map((g) => {
      const worker = workerMap[g.workerId] || { name: 'Unknown', role: '' };
      return {
        ...g,
        fullDaysPay: roundCurrency(g.fullDaysPay, currency),
        halfDaysPay: roundCurrency(g.halfDaysPay, currency),
        overtimePay: roundCurrency(g.overtimePay, currency),
        totalPay: roundCurrency(g.totalPay, currency),
        worker
      };
    });
  }, [filteredLogs, workerMap, currency]);

  // Search-filtered worker summaries
  const displayedWorkerSummaries = useMemo(() => {
    if (!reportSearch.trim()) return summaryGroupedData;
    const q = reportSearch.toLowerCase().trim();
    return summaryGroupedData.filter((r) => {
      const name = (r.worker.name || '').toLowerCase();
      const role = (r.worker.role || '').toLowerCase();
      const groupName = (groupMap[r.worker.groupId]?.name || '').toLowerCase();
      return name.includes(q) || role.includes(q) || groupName.includes(q);
    });
  }, [summaryGroupedData, reportSearch, groupMap]);

  // Grouped aggregation across all project workgroups
  const groupSummaries = useMemo(() => {
    const map = {};

    filteredLogs.forEach((log) => {
      const w = workerMap[log.workerId];
      const gId = w?.groupId ? String(w.groupId) : 'unassigned';
      if (!map[gId]) {
        map[gId] = {
          groupId: gId,
          groupName: gId === 'unassigned' ? (language === 'fa' ? 'پرسنل مستقل (بدون گروه)' : 'Independent Workers') : (groupMap[gId]?.name || gId),
          workerIds: new Set(),
          fullDays: 0,
          halfDays: 0,
          hourlyDays: 0,
          totalOt: 0,
          totalPay: 0,
          entriesCount: 0
        };
      }
      const item = map[gId];
      item.workerIds.add(String(log.workerId));
      if (log.type === 'half') item.halfDays += 1;
      else if (log.type === 'hourly') item.hourlyDays += 1;
      else item.fullDays += 1;
      item.totalOt += Number(log.overtimeHours) || 0;
      item.totalPay += Number(log.totalDayPay) || 0;
      item.entriesCount += 1;
    });

    const list = Object.values(map).map((g) => ({
      ...g,
      workersCount: g.workerIds.size,
      totalOt: Number(g.totalOt.toFixed(2)),
      totalPay: roundCurrency(g.totalPay, currency)
    }));

    if (!reportSearch.trim()) return list;
    const q = reportSearch.toLowerCase().trim();
    return list.filter((g) => g.groupName.toLowerCase().includes(q));
  }, [filteredLogs, workerMap, groupMap, language, currency, reportSearch]);

  // Delete an individual log
  const handleDeleteLog = async (logId) => {
    try {
      const target = await db.attendanceLogs.get(logId);
      if (target && isLogSettled(target)) {
        alert(language === 'fa' 
          ? 'این رکورد در امور مالی تسویه شده و کاملاً قفل است. امکان حذف آن وجود ندارد.' 
          : 'This record is settled and locked. It cannot be deleted.');
        return;
      }
    } catch (_) {}

    if (window.confirm(t('deleteLogConfirm'))) {
      await db.attendanceLogs.delete(logId);
      deleteLogLive(logId).catch(() => {});
    }
  };

  // Month shifting helper
  const handleMonthShift = (delta) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setCalendarMonth(`${newY}-${newM}`);
  };

  const weekDayLabels = language === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : language === 'fa'
    ? ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه']
    : ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'];

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Header: Liquid Glass Capsule with 3-Way Mode Switcher & Integrated Actions */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/30 transition-all duration-300 no-print">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-sky-500/10 dark:bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 flex-shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  {t('calendarLogs')}
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {viewMode === 'timeline' ? t('monthTimeline') : viewMode === 'calendar' ? t('calendarGridTab') : t('logsTitle')}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'fa' 
                  ? 'ثبت و پایش شیفت‌های کاری، ساعات اضافه‌کار و گزارش‌گیری تفکیکی پروژه' 
                  : 'Track daily shifts, overtime hours, and comprehensive workshop attendance'}
              </p>
            </div>
          </div>

          {/* Action Controls: Pure Segmented View Switcher & Action Capsule */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Pure 3-Mode Switcher */}
            <div className="h-[52px] sm:h-[56px] flex items-center gap-1 sm:gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner flex-shrink-0 backdrop-blur-md">
              {[
                { id: 'timeline', label: language === 'fa' ? 'تفکیک روزانه' : language === 'ku' ? 'لیستی مانگانە' : 'Timeline', icon: CalendarDays },
                { id: 'calendar', label: language === 'fa' ? 'ماه‌نما' : language === 'ku' ? 'تەقویم' : 'Month Grid', icon: LayoutGrid },
                { id: 'logs', label: language === 'fa' ? 'گزارش و بیلان جامع' : language === 'ku' ? 'ڕاپۆرت' : 'Reports & Analytics', icon: Sparkles }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = viewMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewMode(tab.id)}
                    aria-label={tab.label}
                    title={tab.label}
                    className={`relative h-full flex items-center gap-2 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 font-bold px-3.5 sm:px-4'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50 px-2.5 sm:px-3'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {isSelected && (
                      <span className="text-xs font-semibold whitespace-nowrap">
                        {tab.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Export & Utility Actions Dock */}
            <div className="h-[52px] sm:h-[56px] flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner flex-shrink-0 backdrop-blur-md">
              {/* Personnel / Workers Management Button */}
              <button
                type="button"
                onClick={() => setIsWorkersModalOpen(true)}
                className="h-full px-3 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-white hover:bg-sky-500 dark:hover:bg-sky-500 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs bg-sky-500/10 dark:bg-sky-500/10 border border-sky-500/20"
                title={language === 'fa' ? 'مدیریت و بانک پرسنل (Shift + P)' : language === 'ku' ? 'بەڕێوەبردنی کرێکاران' : 'Personnel Management'}
                aria-label={language === 'fa' ? 'مدیریت پرسنل' : 'Personnel'}
              >
                <Users className="w-4.5 h-4.5 flex-shrink-0" />
                <span className="hidden sm:inline">{language === 'fa' ? 'پرسنل' : language === 'ku' ? 'کرێکاران' : 'Workers'}</span>
              </button>

              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

              {/* Quick Export to Excel */}
              <button
                type="button"
                onClick={() => exportAttendanceToExcel({ logs: filteredLogs, workers, reportType: reportFormat, language })}
                className="h-full px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white/80 dark:hover:bg-slate-700/60 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs"
                title={t('exportExcel')}
                aria-label={t('exportExcel')}
              >
                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
                <span className="hidden md:inline">{t('exportExcel')}</span>
              </button>

              {/* Quick Print PDF */}
              <button
                type="button"
                onClick={triggerPrintReport}
                className="h-full aspect-square text-slate-500 hover:text-sky-600 hover:bg-white/80 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:bg-slate-700/60 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center cursor-pointer"
                title={t('printPdf')}
                aria-label={t('printPdf')}
              >
                <Printer className="w-4.5 h-4.5 flex-shrink-0" />
              </button>

              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

              {/* Recycle Bin Action Button */}
              <button
                type="button"
                onClick={() => setIsRecycleBinOpen(true)}
                aria-label={language === 'fa' ? 'سطل بازیافت کارکردهای حذف‌شده' : 'Recycle Bin'}
                title={language === 'fa' ? 'سطل بازیافت کارکردهای حذف‌شده' : 'Recycle Bin'}
                className="h-full aspect-square rounded-xl text-slate-400 hover:text-amber-500 hover:bg-white/80 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-slate-700/60 transition-all active:scale-95 flex items-center justify-center flex-shrink-0 cursor-pointer"
              >
                <Trash2 className="w-4.5 h-4.5 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: MONTHLY DAY-BY-DAY BREAKDOWN LIST (TIMELINE)     */}
      {/* ======================================================== */}
      {viewMode === 'timeline' && (
        <div className="space-y-4 no-print">
          
          {/* Top Month Selector & Executive Hero Command Banner (Matching Dashboard Identity) */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Main Monthly Metrics */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider">
                    <CalendarCheck className="w-4 h-4" />
                    <span>{language === 'fa' ? 'نبض کارکرد و دستمزد ماه' : 'Monthly Shift & Payroll Pulse'}</span>
                  </div>

                  {/* Compact Month Switcher Pill */}
                  <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
                    <button
                      onClick={() => handleMonthShift(direction === 'rtl' ? 1 : -1)}
                      className="p-1.5 hover:bg-white/20 rounded-xl transition-all text-white cursor-pointer"
                      title="ماه قبل"
                    >
                      {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                    <div className="relative flex items-center justify-center cursor-pointer min-w-[6.5rem]">
                      <span className="text-xs font-bold text-white px-2 py-0.5">
                        {formatMonthOnly(calendarMonth, language)}
                      </span>
                      <input
                        type="month"
                        value={calendarMonth}
                        onChange={(e) => setCalendarMonth(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={() => handleMonthShift(direction === 'rtl' ? -1 : 1)}
                      className="p-1.5 hover:bg-white/20 rounded-xl transition-all text-white cursor-pointer"
                      title="ماه بعد"
                    >
                      {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2">
                    <span>{formatAmount(monthTimelineData.monthStats.totalSalary, currency)}</span>
                    <span className="text-sm sm:text-base font-bold text-sky-400">{getCurrencySymbol(currency, language)}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    {language === 'fa' ? 'مجموع ناخالص حقوق و کارکرد ثبت‌شده در این ماه' : 'Total gross wages for the selected month'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-300">{language === 'fa' ? 'روزهای کاری:' : 'Days:'}</span>
                    <span className="font-black text-white">{monthTimelineData.monthStats.daysWorked} {language === 'fa' ? 'روز' : 'days'}</span>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-slate-300">{language === 'fa' ? 'کل اضافه‌کاری:' : 'OT:'}</span>
                    <span className="font-black font-mono text-white">+{formatHoursAndMinutes(monthTimelineData.monthStats.totalOvertime, language)}</span>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="text-slate-300">{language === 'fa' ? 'ثبت‌ها:' : 'Entries:'}</span>
                    <span className="font-black text-white">{monthTimelineData.monthStats.totalEntries}</span>
                  </div>
                </div>
              </div>

              {/* Quick Action Dock */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => onOpenLoggingModal && onOpenLoggingModal(getTodayDateString())}
                  className="col-span-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>{t('logDailyAttendance')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('karsync-open-workers-modal'))}
                  className="col-span-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>{language === 'fa' ? 'پرسنل' : 'Workers'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRecycleBinOpen(true)}
                  className="col-span-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4 text-amber-400" />
                  <span>{language === 'fa' ? 'سطل زباله' : 'Recycle'}</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Sub-Dock */}
            <div className="mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute start-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  placeholder={t('timelineSearchPlaceholder')}
                  className="w-full ps-9 pe-4 py-2 text-xs bg-white/10 border border-white/15 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
                {timelineSearch && (
                  <button
                    onClick={() => setTimelineSearch('')}
                    className="absolute end-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap sm:flex-nowrap">
                {/* Expand / Collapse All Days */}
                <div className="inline-flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15">
                  <button
                    type="button"
                    onClick={() => collapseAllDays()}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer"
                    title={language === 'fa' ? 'بستن همه روزها' : 'Collapse All'}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>{language === 'fa' ? 'بستن همه' : 'Collapse'}</span>
                  </button>
                  <div className="w-px h-3.5 bg-white/20" />
                  <button
                    type="button"
                    onClick={() => expandAllDays(displayedTimelineDays.map((d) => d.dateStr))}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer"
                    title={language === 'fa' ? 'باز کردن همه روزها' : 'Expand All'}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>{language === 'fa' ? 'باز کردن همه' : 'Expand'}</span>
                  </button>
                </div>

                {/* Filter days with logs */}
                <button
                  onClick={() => setFilterOnlyWithLogs(!filterOnlyWithLogs)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    filterOnlyWithLogs
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{filterOnlyWithLogs ? t('filterOnlyWithLogs') : t('showAllMonthDays')}</span>
                </button>

                {/* Sort order toggle */}
                <button
                  type="button"
                  onClick={toggleSortOrder}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/15 bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-95"
                  title={sortAscending 
                    ? (language === 'fa' ? 'مرتب‌سازی: صعودی' : 'Sort: Oldest to Newest')
                    : (language === 'fa' ? 'مرتب‌سازی: نزولی' : 'Sort: Newest to Oldest')}
                >
                  {sortAscending ? (
                    <ArrowUpNarrowWide className="w-4 h-4 text-sky-400 stroke-[2.2]" />
                  ) : (
                    <ArrowDownWideNarrow className="w-4 h-4 text-amber-400 stroke-[2.2]" />
                  )}
                  <span>{sortAscending ? (language === 'ku' ? 'کۆن بۆ نوێ' : 'قدیمی به جدید') : (language === 'ku' ? 'نوێ بۆ کۆن' : 'جدید به قدیمی')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Timeline Days List */}
          {displayedTimelineDays.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-sky-500" />
              <p className="text-sm font-semibold">{t('noLogsForMonth')}</p>
              <button
                onClick={() => onOpenLoggingModal && onOpenLoggingModal(`${calendarMonth}-01`)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('logDailyAttendance')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedTimelineDays.map((dayItem) => {
                const hasLogs = dayItem.totalWorkers > 0;
                const formattedDate = formatFullDateWithWeekday(dayItem.dateStr, language);
                const isFriday = new Date(dayItem.dateStr).getDay() === 5;
                const isExpanded = expandedDayKeys.has(dayItem.dateStr);

                // Compact summary worker avatars (take top 4 workers)
                const avatarWorkers = dayItem.logs.slice(0, 4).map((l) => workerMap[l.workerId] || { name: 'W' });
                const extraWorkersCount = Math.max(0, dayItem.totalWorkers - 4);

                // Shift distribution counts for this specific day
                const fullCount = dayItem.logs.filter((l) => l.type !== 'half' && l.type !== 'hourly').length;
                const halfCount = dayItem.logs.filter((l) => l.type === 'half').length;
                const hourlyCount = dayItem.logs.filter((l) => l.type === 'hourly').length;

                return (
                  <div
                    key={dayItem.dateStr}
                    className={`relative overflow-hidden rounded-3xl border transition-all duration-300 backdrop-blur-xl ${
                      hasLogs
                        ? 'bg-white/80 dark:bg-slate-900/80 border-white/70 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 hover:border-sky-400/40'
                        : isFriday
                        ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.04] border-amber-500/20'
                        : 'bg-white/40 dark:bg-slate-900/40 border-slate-200/40 dark:border-slate-800/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* Collapsible Header Row (Clickable to Toggle) */}
                    <div 
                      onClick={() => toggleDayExpanded(dayItem.dateStr)}
                      className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                        isExpanded ? 'border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/30' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Left: Day Badge & Date */}
                      <div className="flex items-center gap-3.5">
                        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex flex-col items-center justify-center font-black text-base border shadow-md transition-all flex-shrink-0 ${
                          hasLogs
                            ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white border-sky-400/30 shadow-sky-500/20'
                            : isFriday
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-400/30 shadow-amber-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                          <span>{dayItem.dayNumber}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                              {formattedDate}
                            </h3>
                            {isFriday && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                {language === 'fa' ? 'جمعه' : 'Friday'}
                              </span>
                            )}
                          </div>
                          
                          {/* Mini Shift Ratio Bar (when day has logs) */}
                          {hasLogs ? (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-slate-400 font-mono">
                                {dayItem.dateStr}
                              </span>
                              <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                {fullCount > 0 && (
                                  <div style={{ width: `${(fullCount / dayItem.totalWorkers) * 100}%` }} className="bg-emerald-500 h-full" title={`${fullCount} کامل`} />
                                )}
                                {halfCount > 0 && (
                                  <div style={{ width: `${(halfCount / dayItem.totalWorkers) * 100}%` }} className="bg-amber-500 h-full" title={`${halfCount} نیمه`} />
                                )}
                                {hourlyCount > 0 && (
                                  <div style={{ width: `${(hourlyCount / dayItem.totalWorkers) * 100}%` }} className="bg-purple-500 h-full" title={`${hourlyCount} ساعتی`} />
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                              {dayItem.dateStr}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Metrics & Collapse Trigger */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {hasLogs ? (
                          <>
                            {/* Avatar Stack for compact view */}
                            {!isExpanded && (
                              <div className="hidden md:flex items-center -space-x-1.5 rtl:space-x-reverse me-1">
                                {avatarWorkers.map((w, wIdx) => (
                                  <div
                                    key={wIdx}
                                    title={w.name}
                                    className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 border-2 border-white dark:border-slate-800 text-[10px] font-bold text-white flex items-center justify-center shadow-xs"
                                  >
                                    {w.name?.charAt(0) || 'W'}
                                  </div>
                                ))}
                                {extraWorkersCount > 0 && (
                                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-xs">
                                    +{extraWorkersCount}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Unified Day Metric Capsule (کپسول یکپارچه متریک‌های روز) */}
                            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-inner backdrop-blur-md text-xs font-bold">
                              {/* 1. Worker count */}
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200" title={`${dayItem.totalWorkers} کارگر حاضر`}>
                                <Users className="w-3.5 h-3.5 text-sky-500" />
                                <span>{dayItem.totalWorkers} <span className="font-normal text-[11px] text-slate-400">{language === 'fa' ? 'نفر' : language === 'ku' ? 'کەس' : 'workers'}</span></span>
                              </div>

                              {/* 2. Overtime in digital +H:MM format */}
                              {dayItem.totalOvertime > 0 && (
                                <>
                                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono" title="اضافه کاری روز">
                                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                                    <span>+{formatHoursDigital(dayItem.totalOvertime)}</span>
                                  </div>
                                </>
                              )}

                              {/* 3. Total day wages */}
                              <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono font-black" title="مجموع دستمزد ناخالص روز">
                                <Coins className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{formatAmount(dayItem.totalPay, currency)}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic px-2">
                            {t('noLogsThisDay')}
                          </span>
                        )}

                        {/* Quick Add Log Button [APP_THEME_BUTTON] */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenLoggingModal) onOpenLoggingModal(dayItem.dateStr);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/25 transition-all cursor-pointer active:scale-95 border border-sky-400/30"
                          title={language === 'fa' ? 'ثبت کارکرد برای این روز' : t('quickAddLogThisDate')}
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">{language === 'fa' ? 'ثبت کار' : t('quickAddLogThisDate')}</span>
                        </button>

                        {/* Collapse/Expand Chevron */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-300 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ${
                          isExpanded ? 'bg-slate-200/60 dark:bg-slate-700/60 text-sky-500' : 'bg-slate-100 dark:bg-slate-800'
                        }`}>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Content: Micro-Rows of Workers & Notes */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {hasLogs ? (
                          <>
                            {/* Workers Micro-Grid / List */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {dayItem.logs.map((log) => {
                                const worker = workerMap[log.workerId] || { name: 'Unknown', role: '' };
                                const logSettled = isLogSettled(log);

                                return (
                                  <div
                                    key={log.id}
                                    className="group relative flex items-center justify-between p-3 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 shadow-xs hover:border-sky-400 hover:shadow-md transition-all duration-200"
                                  >
                                    {/* Worker Info */}
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-xs font-black text-sky-600 dark:text-sky-400 flex-shrink-0">
                                        {worker.name?.charAt(0) || 'W'}
                                      </div>
                                      <div className="min-w-0">
                                        <h5 
                                          onClick={() => openWorkerProfile(log.workerId)}
                                          className="font-bold text-xs text-slate-900 dark:text-white truncate cursor-pointer hover:text-sky-500 transition-colors"
                                          title="مشاهده پروفایل جامع پرسنل"
                                        >
                                          {worker.name}
                                        </h5>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          {/* Shift badge */}
                                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                            log.type === 'hourly'
                                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                                              : log.type === 'half'
                                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                          }`}>
                                            {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDays') : t('normalDays')}
                                          </span>

                                          {/* Section badge if any */}
                                          {projectSections.length > 0 && log.sectionId && sectionMap[log.sectionId] && (
                                            <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                                              • {sectionMap[log.sectionId].name}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Overtime & Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {log.overtimeHours > 0 && (
                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                                          +{formatHoursDigital(log.overtimeHours)}
                                        </span>
                                      )}

                                      {/* Action buttons (Minimal on hover) */}
                                      {logSettled ? (
                                        <span className="p-1 text-emerald-500 bg-emerald-500/10 rounded-lg text-[10px] font-bold flex items-center gap-0.5" title="تسویه شده (قفل)">
                                          <Lock className="w-3 h-3" />
                                        </span>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setEditingLog(log)}
                                            className="p-1.5 hover:bg-sky-500/10 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg transition-colors cursor-pointer"
                                            title={t('edit')}
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteLog(log.id)}
                                            className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                            title={t('delete')}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Daily Notes & Descriptions */}
                            {dayItem.notesList.length > 0 && (
                              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60">
                                <div className="p-3.5 bg-sky-500/5 dark:bg-sky-500/5 rounded-2xl border border-sky-500/15 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 backdrop-blur-md">
                                  {dayItem.notesList.map((noteItem, nIdx) => (
                                    <div key={nIdx} className="flex items-start justify-between gap-2.5">
                                      <div className="flex items-start gap-2 flex-1">
                                        <FileText className="w-3.5 h-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                          {dayItem.notesList.length > 1 && (
                                            <span className="font-bold text-slate-900 dark:text-white me-1.5">
                                              {noteItem.workerName}:
                                            </span>
                                          )}
                                          <span className="font-medium text-slate-700 dark:text-slate-300">
                                            {noteItem.text}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-4 text-xs text-slate-400">
                            {t('noLogsThisDay')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: MONTHLY CALENDAR GRID (LIQUID GLASS CANVAS)       */}
      {/* ======================================================== */}
      {viewMode === 'calendar' && (
        <div className="space-y-4 sm:space-y-5 no-print">
          {/* Calendar Container */}
          <div className="relative overflow-hidden rounded-3xl p-3.5 sm:p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/20 transition-all duration-300">
            
            {/* Calendar Month Selector Header */}
            <div className="flex items-center justify-between pb-3.5 sm:pb-5 mb-3 sm:mb-5 border-b border-slate-100 dark:border-slate-800/80 gap-2 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1 sm:p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
                <button
                  onClick={() => handleMonthShift(direction === 'rtl' ? 1 : -1)}
                  className="p-1.5 sm:p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-700 dark:text-slate-300 cursor-pointer"
                  title="ماه قبل"
                >
                  {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <div className="relative flex items-center justify-center cursor-pointer min-w-[6.5rem] sm:min-w-[7.5rem]">
                  <div className="pointer-events-none text-xs sm:text-sm font-bold text-slate-800 dark:text-white px-2 sm:px-3 py-1 text-center w-full flex items-center justify-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500" />
                    <span>{formatMonthOnly(calendarMonth, language)}</span>
                  </div>
                  <input
                    type="month"
                    value={calendarMonth}
                    onChange={(e) => setCalendarMonth(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => handleMonthShift(direction === 'rtl' ? -1 : 1)}
                  className="p-1.5 sm:p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-700 dark:text-slate-300 cursor-pointer"
                  title="ماه بعد"
                >
                  {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50">
                  <span>{allLogs.filter(l => l.date.startsWith(calendarMonth)).length} {t('totalEntries')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLoggingModal && onOpenLoggingModal(getTodayDateString())}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <CalendarPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{t('logDailyAttendance')}</span>
                  <span className="xs:hidden">ثبت</span>
                </button>
              </div>
            </div>

            {/* Weekday Names Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3 text-center text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">
              {weekDayLabels.map((dayName, idx) => (
                <div key={idx} className="py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-50/60 dark:bg-slate-800/40">
                  <span className="hidden sm:inline">{dayName}</span>
                  <span className="sm:hidden">{dayName.slice(0, 2)}</span>
                </div>
              ))}
            </div>

            {/* Calendar Day Cells Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2.5">
              {calendarData.map((dayItem, index) => {
                if (!dayItem) {
                  return (
                    <div 
                      key={`blank_${index}`} 
                      className="h-12 xs:h-14 sm:min-h-[110px] bg-slate-50/20 dark:bg-slate-800/10 rounded-xl sm:rounded-2xl border border-dashed border-slate-200/20 dark:border-slate-800/20 opacity-20" 
                    />
                  );
                }

                const hasLogs = dayItem.totalWorkers > 0;
                const isFriday = new Date(dayItem.dateStr).getDay() === 5;
                const isInspected = inspectedDateStr === dayItem.dateStr;
                const isToday = dayItem.dateStr === getTodayDateString();

                return (
                  <div
                    key={dayItem.dateStr}
                    onClick={() => setInspectedDateStr(isInspected ? null : dayItem.dateStr)}
                    className={`h-12 xs:h-14 sm:min-h-[110px] p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border flex flex-col justify-between transition-all duration-200 cursor-pointer select-none relative ${
                      isInspected
                        ? 'ring-2 ring-sky-500 bg-sky-50 dark:bg-sky-950/60 border-sky-400 shadow-lg scale-[1.03] z-10'
                        : isToday
                        ? 'border-sky-500/80 bg-sky-500/[0.06] shadow-xs'
                        : hasLogs
                        ? 'bg-white/90 dark:bg-slate-800/80 border-slate-200/70 dark:border-white/10 shadow-xs hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-md'
                        : isFriday
                        ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.04] border-amber-500/20 text-slate-400 opacity-80'
                        : 'bg-white/40 dark:bg-slate-800/20 border-slate-200/40 dark:border-slate-800/40 hover:border-slate-300 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* Top Row: Day Number + Status Dots */}
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[11px] xs:text-xs sm:text-sm font-black transition-colors ${
                        isInspected
                          ? 'text-sky-600 dark:text-sky-400'
                          : isToday
                          ? 'text-sky-500 font-black'
                          : hasLogs
                          ? 'text-slate-800 dark:text-slate-100'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {dayItem.dayNumber}
                      </span>

                      {/* Mobile Compact Indicators (dots) */}
                      <div className="flex items-center gap-0.5 sm:hidden">
                        {hasLogs && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                        )}
                        {dayItem.totalOvertime > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        )}
                      </div>

                      {/* Desktop Glow indicator */}
                      {hasLogs && (
                        <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                      )}
                    </div>

                    {/* Mobile Micro Count Pill (shows worker count cleanly without clipping) */}
                    <div className="sm:hidden flex items-center justify-center mt-auto">
                      {hasLogs ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                          <span>{dayItem.totalWorkers}</span>
                          <span className="text-[8px] opacity-75">نفر</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </div>

                    {/* Desktop Rich Content */}
                    <div className="hidden sm:block mt-1 space-y-1 text-[11px]">
                      {hasLogs ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-bold">
                              <Users className="w-3 h-3 text-sky-500" />
                              <span>{dayItem.totalWorkers} نفر</span>
                            </div>
                            {dayItem.totalOvertime > 0 && (
                              <div className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold">
                                <span>+{Math.floor(dayItem.totalOvertime)}:{String(Math.round((dayItem.totalOvertime % 1) * 60)).padStart(2, '0')}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black truncate font-mono bg-emerald-500/[0.06] px-1.5 py-0.5 rounded-md">
                            {formatCurrency(dayItem.totalPay, currency, language)}
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-slate-300 dark:text-slate-600 text-center py-2">
                          -
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

          {/* Interactive Day Inspector Capsule (باز شدن مشخصات روز انتخابی) */}
          {inspectedDateStr && (
            <div className="relative overflow-hidden rounded-3xl p-4 sm:p-6 backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-sky-400/40 dark:border-sky-500/40 shadow-xl shadow-sky-500/10 space-y-3.5 sm:space-y-4 animate-in fade-in slide-in-from-top-3 duration-250">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shrink-0">
                    <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{formatFullDateWithWeekday(inspectedDateStr, language)}</span>
                      <span className="font-mono text-[10px] sm:text-xs text-slate-400">({inspectedDateStr})</span>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {inspectedDateLogs.length} {t('workers')} • {formatCurrency(inspectedTotalPay, currency, language)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenLoggingModal && onOpenLoggingModal(inspectedDateStr)}
                    className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{t('quickAddLogThisDate')}</span>
                  </button>
                  <button
                    onClick={() => setInspectedDateStr(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day logs list */}
              {inspectedDateLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {t('noLogsThisDay')}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 sm:gap-2.5">
                  {inspectedDateLogs.map((log) => {
                    const worker = workerMap[log.workerId] || { name: 'Unknown', role: '' };
                    return (
                      <div
                        key={log.id}
                        className="flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl text-xs font-medium bg-white/95 dark:bg-slate-800/95 border border-slate-200/80 dark:border-slate-700/80 shadow-xs"
                      >
                        <span 
                          onClick={() => openWorkerProfile(log.workerId)}
                          className="font-bold text-slate-900 dark:text-white cursor-pointer hover:text-sky-500 transition-colors"
                        >
                          {worker.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          log.type === 'hourly'
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                            : log.type === 'half'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDays') : t('normalDays')}
                        </span>
                        {log.overtimeHours > 0 && (
                          <span className="text-[10px] text-amber-600 font-mono font-bold">
                            +{Math.floor(log.overtimeHours)}:{String(Math.round((log.overtimeHours % 1) * 60)).padStart(2, '0')}
                          </span>
                        )}
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                          {formatAmount(log.totalDayPay, currency)}
                        </span>
                        <button
                          onClick={() => setEditingLog(log)}
                          className="p-1 text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: REPORTS & SETTLEMENT (ADAPTIVE INTELLIGENCE HUB) */}
      {/* ======================================================== */}
      {viewMode === 'logs' && (
        <div className="space-y-5">
          
          {/* Top Command Bar: Unified Search + Time Presets + Collapsible Filter Toggle */}
          <div className="relative z-30 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
            
            {/* Left/Start side: Smart Interactive Search Picker + Clear Filter */}
            <div className="relative flex-1 max-w-md">
              <div className="relative">
                <Search className="w-4 h-4 text-sky-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={reportSearch}
                  onFocus={() => {
                    setIsSearchPickerOpen(true);
                    setSearchSelectedIndex(0);
                  }}
                  onChange={(e) => {
                    setReportSearch(e.target.value);
                    setIsSearchPickerOpen(true);
                    setSearchSelectedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (!isSearchPickerOpen) {
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        setIsSearchPickerOpen(true);
                        e.preventDefault();
                      }
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSearchSelectedIndex((prev) => 
                        searchPickerItems.length > 0 ? (prev + 1) % searchPickerItems.length : 0
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSearchSelectedIndex((prev) => 
                        searchPickerItems.length > 0 ? (prev - 1 + searchPickerItems.length) % searchPickerItems.length : 0
                      );
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchPickerItems.length > 0 && searchPickerItems[searchSelectedIndex]) {
                        const target = searchPickerItems[searchSelectedIndex];
                        if (target.type === 'group') {
                          setSelectedGroupId(target.id);
                          setSelectedWorkerId('all');
                          setReportSearch(target.name);
                        } else {
                          setSelectedWorkerId(target.id);
                          setSelectedGroupId('all');
                          setReportSearch(target.name);
                        }
                        setIsSearchPickerOpen(false);
                      }
                    } else if (e.key === 'Escape') {
                      setIsSearchPickerOpen(false);
                    }
                  }}
                  placeholder={
                    selectedWorkerId !== 'all' && workerMap[selectedWorkerId]
                      ? `👤 ${workerMap[selectedWorkerId].name}`
                      : selectedGroupId !== 'all' && groupMap[selectedGroupId]
                      ? `👥 ${groupMap[selectedGroupId].name}`
                      : (language === 'fa' ? 'جستجوی پرسنل یا گروه... (کلید / یا \\)' : 'Search worker or group... (/ or \\)')
                  }
                  className="w-full pr-10 pl-9 py-2.5 text-xs bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm font-medium transition-all"
                />
                {/* Shortcut visual badge when empty */}
                {!reportSearch && selectedWorkerId === 'all' && selectedGroupId === 'all' && (
                  <div className="hidden sm:flex items-center absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                      /
                    </kbd>
                  </div>
                )}
                {(reportSearch || selectedWorkerId !== 'all' || selectedGroupId !== 'all') && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    title="پاک کردن انتخاب و فیلترها"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Instant Search Suggestions & Touch Picker Dropdown */}
              {isSearchPickerOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setIsSearchPickerOpen(false)} 
                  />
                  <div className="absolute top-full mt-2 inset-x-0 z-30 max-h-72 overflow-y-auto rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    
                    {/* When searching (user typed something): Render flat streamlined matching items without distracting headers */}
                    {reportSearch.trim() ? (
                      searchPickerItems.length === 0 ? (
                        <div className="py-4 text-center text-slate-400 text-xs">
                          {language === 'fa' ? 'موردی یافت نشد' : 'No results found'}
                        </div>
                      ) : (
                        searchPickerItems.map((item, idx) => {
                          const isSelected = idx === searchSelectedIndex;
                          return (
                            <button
                              key={`${item.type}_${item.id}`}
                              type="button"
                              onClick={() => {
                                if (item.type === 'group') {
                                  setSelectedGroupId(item.id);
                                  setSelectedWorkerId('all');
                                } else {
                                  setSelectedWorkerId(item.id);
                                  setSelectedGroupId('all');
                                }
                                setReportSearch(item.name);
                                setIsSearchPickerOpen(false);
                              }}
                              onMouseEnter={() => setSearchSelectedIndex(idx)}
                              className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? (item.type === 'group' ? 'bg-indigo-500 text-white' : 'bg-sky-500 text-white')
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {item.type === 'group' ? (
                                  <Users className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
                                ) : (
                                  <User className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-sky-500'}`} />
                                )}
                                <span>{item.name}</span>
                                {item.role && (
                                  <span className={`text-[10px] font-normal ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                    ({item.role})
                                  </span>
                                )}
                              </span>

                              <div className="flex items-center gap-1.5 text-[10px]">
                                {item.type === 'group' ? (
                                  <span className={`px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'}`}>
                                    {item.count} نفر
                                  </span>
                                ) : item.groupName ? (
                                  <span className={`px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                    {item.groupName}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })
                      )
                    ) : (
                      /* When input is empty: Clean categorized browser (Groups first, then Workers) */
                      <>
                        {/* Groups category */}
                        {groupOptions.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Users className="w-3 h-3 text-indigo-400" />
                              <span>{language === 'fa' ? 'گروه‌های کاری' : 'Work Groups'}</span>
                            </div>
                            {groupOptions.map((g, gIdx) => {
                              const isSelected = gIdx === searchSelectedIndex;
                              return (
                                <button
                                  key={g.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedGroupId(String(g.id));
                                    setSelectedWorkerId('all');
                                    setReportSearch(g.name);
                                    setIsSearchPickerOpen(false);
                                  }}
                                  onMouseEnter={() => setSearchSelectedIndex(gIdx)}
                                  className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-500 text-white'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <Users className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-indigo-400'}`} />
                                    <span>{g.name}</span>
                                  </span>
                                  <span className="text-[10px] opacity-75">
                                    {workers.filter(w => String(w.groupId) === String(g.id)).length} نفر
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Workers category */}
                        {workers.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <User className="w-3 h-3 text-sky-400" />
                              <span>{language === 'fa' ? 'پرسنل کارگاه' : 'Workers'}</span>
                            </div>
                            {workers.map((w, wIdx) => {
                              const itemIndex = groupOptions.length + wIdx;
                              const isSelected = itemIndex === searchSelectedIndex;
                              return (
                                <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedWorkerId(String(w.id));
                                    setSelectedGroupId('all');
                                    setReportSearch(w.name);
                                    setIsSearchPickerOpen(false);
                                  }}
                                  onMouseEnter={() => setSearchSelectedIndex(itemIndex)}
                                  className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-sky-500 text-white'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <User className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-sky-400'}`} />
                                    <span>{w.name}</span>
                                    {w.role && <span className={`text-[10px] font-normal ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>({w.role})</span>}
                                  </span>
                                  {w.groupId && groupMap[w.groupId] && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500'}`}>
                                      {groupMap[w.groupId].name}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                  </div>
                </>
              )}
            </div>

            {/* Right/End side: Time Presets Bar & Filter Drawer Toggle Button */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Presets */}
              <div className="inline-flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
                {[
                  { id: 'thisMonth', label: language === 'fa' ? 'این ماه' : 'This Month' },
                  { id: 'lastMonth', label: language === 'fa' ? 'ماه قبل' : 'Last Month' },
                  { id: 'last30Days', label: language === 'fa' ? '۳۰ روز' : '30 Days' },
                  { id: 'allTime', label: language === 'fa' ? 'کل دوره' : 'All Time' }
                ].map((preset) => {
                  const isActive = activeDatePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyDatePreset(preset.id)}
                      className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-sky-500 text-white shadow-xs shadow-sky-500/20'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Filter Collapsible Toggle Button */}
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(prev => !prev)}
                className={`p-2.5 rounded-2xl border transition-all duration-200 flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                  isFilterDrawerOpen || selectedSettlementStatus !== 'all' || selectedType !== 'all' || selectedSectionId !== 'all'
                    ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/25'
                    : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                title="فیلترهای پیشرفته"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'fa' ? 'فیلترها' : 'Filters'}</span>
                {(selectedSettlementStatus !== 'all' || selectedType !== 'all' || selectedSectionId !== 'all') && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
                {isFilterDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Reset / Clear All Filters Button */}
              {(selectedWorkerId !== 'all' || selectedGroupId !== 'all' || selectedSettlementStatus !== 'all' || selectedType !== 'all' || selectedSectionId !== 'all' || reportSearch) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-3 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="پاک کردن تمام فیلترها و بازگشت به آمار کل"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{language === 'fa' ? 'آمار کل' : 'Reset'}</span>
                </button>
              )}
            </div>

          </div>

          {/* Collapsible Filter Drawer (کشوی فیلترهای پیشرفته) */}
          {isFilterDrawerOpen && (
            <div className="relative overflow-hidden rounded-3xl p-4 sm:p-6 backdrop-blur-2xl bg-white/85 dark:bg-slate-900/85 border border-sky-400/30 dark:border-sky-500/30 shadow-xl shadow-slate-200/40 dark:shadow-black/20 space-y-4 no-print animate-in fade-in slide-in-from-top-3 duration-250">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-sky-500" />
                  <span>{language === 'fa' ? 'تنظیمات و فیلترهای تکمیلی گزارش' : 'Advanced Report Filters'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="text-xs font-bold text-sky-500 hover:text-sky-600 cursor-pointer"
                >
                  {language === 'fa' ? 'بستن کشو' : 'Close'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Settlement Status */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {t('settlementWorkStatus')}
                  </label>
                  <select
                    value={selectedSettlementStatus}
                    onChange={(e) => setSelectedSettlementStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    <option value="all">{t('allWorkStatus')}</option>
                    <option value="current">{t('currentUnsettledWork')}</option>
                    <option value="settled">{t('pastSettledWork')}</option>
                  </select>
                </div>

                {/* Shift Type */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {t('filterByType')}
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    <option value="all">{t('allTypes')}</option>
                    <option value="full">{t('normalDays')}</option>
                    <option value="half">{t('halfDays')}</option>
                    <option value="hourly">{t('hourlyOnlyOption')}</option>
                  </select>
                </div>

                {/* Project Section */}
                {projectSections.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {t('section') || 'بخش پروژه'}
                    </label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    >
                      <option value="all">{language === 'fa' ? 'همه بخش‌ها' : 'All Sections'}</option>
                      <option value="unassigned">{language === 'fa' ? 'عمومی / بدون بخش' : 'General'}</option>
                      {projectSections.map((sec) => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Custom Date Range: From & To */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {t('fromDate')}
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setActiveDatePreset('custom');
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {t('toDate')}
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setActiveDatePreset('custom');
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Adaptive Intelligence Hub (کارت بزرگ و تطبیق‌پذیر کارکرد و هزینه) */}
          <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/95 via-slate-900 to-indigo-950 text-white border border-white/10 shadow-2xl space-y-6">
            <div className="absolute top-0 right-1/4 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-5">
              {/* Top Row: Title Badge + Large Amount */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
                  <span>
                    {selectedWorkerId !== 'all' && workerMap[selectedWorkerId]
                      ? `👤 ${language === 'fa' ? 'کارنامه کارکرد و دستمزد:' : 'Worker Statement:'} ${workerMap[selectedWorkerId].name}`
                      : selectedGroupId !== 'all' && groupMap[selectedGroupId]
                      ? `👥 ${language === 'fa' ? 'بیلان تجمیعی گروه:' : 'Group Aggregate:'} ${groupMap[selectedGroupId].name}`
                      : (language === 'fa' ? 'بیلان جامع کارکرد و هزینه‌های کل پروژه' : 'Project Executive Intelligence')}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4 flex-wrap pt-1">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">
                      {language === 'fa' ? 'مجموع دستمزد ناخالص کارکرد در این بازه' : 'Calculated Gross Labor Cost'}
                    </span>
                    <div className="flex items-baseline gap-3 flex-wrap mt-0.5">
                      <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
                        {formatCurrency(aggregatedStats.totalPay, currency, language)}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                        {filteredLogs.length} {t('totalEntries')}
                      </span>
                    </div>
                  </div>

                  {/* Direct Action Buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowDetailsInHero(prev => !prev)}
                      className={`px-4 py-2.5 rounded-2xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                        showDetailsInHero
                          ? 'bg-white text-slate-900 shadow-white/20'
                          : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/30'
                      }`}
                    >
                      <TableProperties className="w-4 h-4" />
                      <span>{showDetailsInHero ? (language === 'fa' ? 'بستن ریز کارکرد' : 'Hide Detailed Logs') : (language === 'fa' ? 'نمایش ریز کارکرد و روزها' : 'Show Detailed Logs')}</span>
                      {showDetailsInHero ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {selectedWorkerId !== 'all' && (
                      <button
                        type="button"
                        onClick={() => openWorkerProfile(selectedWorkerId)}
                        className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-md border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <User className="w-4 h-4 text-sky-400" />
                        <span>{language === 'fa' ? 'مشاهده پرونده کامل مالی' : 'View Full Profile'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle Row: Settled/Unsettled Liquidity (Right/Col 7) + Shift Distribution (Left/Col 5) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Right: Settled vs Unsettled Box Container */}
                <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-between space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-sky-400" />
                      <span>{language === 'fa' ? 'وضعیت تسویه و تعهدات نقدینگی' : 'Settlement & Liquidity Status'}</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {aggregatedStats.settledPercent}% {language === 'fa' ? 'تسویه شده' : 'Settled'}
                    </span>
                  </div>

                  {/* Settled vs Unsettled Quick Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Settled Card */}
                    <div 
                      onClick={() => setSelectedSettlementStatus(prev => prev === 'settled' ? 'all' : 'settled')}
                      className={`p-3.5 rounded-2xl border backdrop-blur-md transition-all cursor-pointer group select-none ${
                        selectedSettlementStatus === 'settled'
                          ? 'bg-emerald-500/25 border-emerald-400/80 shadow-md shadow-emerald-500/20'
                          : 'bg-white/5 hover:bg-emerald-500/10 border-white/10 hover:border-emerald-500/30'
                      }`}
                      title={language === 'fa' ? 'کلیک جهت فیلتر رکوردهای تسویه شده' : 'Click to filter settled'}
                    >
                      <div className="flex items-center justify-between pb-1.5">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{language === 'fa' ? 'تسویه و پرداخت‌شده' : 'Settled & Paid'}</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                          {aggregatedStats.settledPercent}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-lg font-black text-white font-mono">
                          {formatAmount(aggregatedStats.settledPay, currency)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {aggregatedStats.settledEntries} رکورد
                        </span>
                      </div>
                    </div>

                    {/* Unsettled Card */}
                    <div 
                      onClick={() => setSelectedSettlementStatus(prev => prev === 'current' ? 'all' : 'current')}
                      className={`p-3.5 rounded-2xl border backdrop-blur-md transition-all cursor-pointer group select-none ${
                        selectedSettlementStatus === 'current'
                          ? 'bg-amber-500/25 border-amber-400/80 shadow-md shadow-amber-500/20'
                          : 'bg-white/5 hover:bg-amber-500/10 border-white/10 hover:border-amber-500/30'
                      }`}
                      title={language === 'fa' ? 'کلیک جهت فیلتر رکوردهای تسویه نشده' : 'Click to filter unsettled'}
                    >
                      <div className="flex items-center justify-between pb-1.5">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          <span>{language === 'fa' ? 'مانده تسویه‌نشده (تعهد)' : 'Unsettled (Due)'}</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                          {aggregatedStats.unsettledPercent}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-lg font-black text-amber-300 font-mono">
                          {formatAmount(aggregatedStats.unsettledPay, currency)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {aggregatedStats.unsettledEntries} رکورد
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Settlement Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-emerald-400 transition-all duration-500"
                        style={{ width: `${aggregatedStats.settledPercent}%` }}
                        title={`تسویه شده: ${aggregatedStats.settledPercent}%`}
                      />
                      <div 
                        className="h-full bg-amber-400/80 transition-all duration-500"
                        style={{ width: `${aggregatedStats.unsettledPercent}%` }}
                        title={`مانده: ${aggregatedStats.unsettledPercent}%`}
                      />
                    </div>
                  </div>
                </div>

                {/* Left: Shift Distribution Widget */}
                <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-between space-y-3.5">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>{language === 'fa' ? 'ترکیب و سهم شیفت‌های کاری' : 'Shift Distribution Ratio'}</span>
                    <Award className="w-4 h-4 text-amber-400" />
                  </h4>

                {/* Workload Breakdown */}
                <div className="space-y-2.5 text-xs">
                  {/* Full Days */}
                  <div>
                    <div className="flex justify-between text-[11px] pb-1">
                      <span className="text-emerald-400 font-bold">{t('normalDays')}</span>
                      <span className="font-mono text-slate-300">
                        {summaryGroupedData.reduce((acc, r) => acc + r.fullDaysCount, 0)} روز
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((summaryGroupedData.reduce((acc, r) => acc + r.fullDaysCount, 0) / Math.max(1, filteredLogs.length)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Half Days */}
                  <div>
                    <div className="flex justify-between text-[11px] pb-1">
                      <span className="text-amber-400 font-bold">{t('halfDays')}</span>
                      <span className="font-mono text-slate-300">
                        {summaryGroupedData.reduce((acc, r) => acc + r.halfDaysCount, 0)} روز
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((summaryGroupedData.reduce((acc, r) => acc + r.halfDaysCount, 0) / Math.max(1, filteredLogs.length)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Hourly Days */}
                  <div>
                    <div className="flex justify-between text-[11px] pb-1">
                      <span className="text-purple-400 font-bold">{t('hourlyOnlyOption')}</span>
                      <span className="font-mono text-slate-300">
                        {summaryGroupedData.reduce((acc, r) => acc + r.hourlyDaysCount, 0)} شیفت
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-400 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((summaryGroupedData.reduce((acc, r) => acc + r.hourlyDaysCount, 0) / Math.max(1, filteredLogs.length)) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* Bottom Row: 3 Work & Base Pay Metrics */}
              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-white/10">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <span className="text-[11px] text-slate-400 block font-bold">{t('aggregatedDays')}</span>
                  <span className="text-base sm:text-xl font-black text-white">{aggregatedStats.days}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <span className="text-[11px] text-slate-400 block font-bold">{t('aggregatedOvertime')}</span>
                  <span className="text-base sm:text-xl font-black text-amber-400 font-mono">
                    {formatHoursDigital(aggregatedStats.otHours)}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <span className="text-[11px] text-slate-400 block font-bold">{t('basePay')}</span>
                  <span className="text-xs sm:text-base font-black text-slate-200 font-mono truncate block">
                    {formatAmount(aggregatedStats.basePay, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: In-Line Detailed Audit Ledger (باز و بسته شدن با دکمه روی کارت) */}
          {showDetailsInHero ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-3 duration-250">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <TableProperties className="w-4 h-4 text-sky-500" />
                  <span>
                    {selectedWorkerId !== 'all' && workerMap[selectedWorkerId]
                      ? `${language === 'fa' ? 'ریز روزهای کارکرد:' : 'Logs for:'} ${workerMap[selectedWorkerId].name}`
                      : selectedGroupId !== 'all' && groupMap[selectedGroupId]
                      ? `${language === 'fa' ? 'ریز کارکرد گروه:' : 'Group logs for:'} ${groupMap[selectedGroupId].name}`
                      : (language === 'fa' ? 'ریز اقلام و روزهای ثبت‌شده' : 'Detailed Audit Ledger')}
                  </span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDetailsInHero(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {language === 'fa' ? 'بستن ریز کارکرد' : 'Hide Logs'}
                  </button>
                  {(selectedWorkerId !== 'all' || selectedGroupId !== 'all') && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-xs font-bold text-sky-500 hover:text-sky-600 cursor-pointer"
                    >
                      {language === 'fa' ? 'بازگشت به آمار کل' : 'Show All Workers'}
                    </button>
                  )}
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 text-xs">
                  {t('noDataForMonth')}
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-3xl border border-white/60 dark:border-white/10 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200/80 dark:border-slate-800 text-xs">
                      <tr>
                        <th className="px-4 py-3.5 text-start">{t('dateColumn')}</th>
                        <th className="px-4 py-3.5 text-start">{t('workerName')}</th>
                        <th className="px-3 py-3.5 text-center">{t('typeColumn')}</th>
                        <th className="px-3 py-3.5 text-center">{t('overtimeHours')}</th>
                        {projectSections.length > 0 && (
                          <th className="px-3 py-3.5 text-center">{t('section') || 'بخش'}</th>
                        )}
                        <th className="px-3 py-3.5 text-center">{t('settlementStatusColumn') || 'وضعیت تسویه'}</th>
                        <th className="px-4 py-3.5 text-start">{t('notesColumn')}</th>
                        <th className="px-4 py-3.5 text-end font-bold text-sky-600 dark:text-sky-400">{currency === 'IQD' ? t('netPayIQD') : `${t('totalPayLabel')} (${getCurrencySymbol(currency, language)})`}</th>
                        <th className="px-4 py-3.5 text-center no-print">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {filteredLogs.map((log) => {
                        const worker = workerMap[log.workerId] || { name: 'Unknown', role: '' };
                        const logSettled = isLogSettled(log);
                        return (
                          <tr key={log.id} className="hover:bg-sky-50/40 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap text-xs">
                              {log.date}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                                <span 
                                  onClick={() => openWorkerProfile(log.workerId)}
                                  className="cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors font-bold"
                                  title="مشاهده پروفایل جامع پرسنل"
                                >
                                  {worker.name}
                                </span>
                                {worker.groupId && groupMap[worker.groupId] && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                                    <Users className="w-2.5 h-2.5" />
                                    <span>{groupMap[worker.groupId].name}</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-medium">{worker.role}</div>
                            </td>
                            <td className="px-3 py-3.5 text-center">
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                                log.type === 'hourly'
                                  ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                  : log.type === 'half'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              }`}>
                                {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDays') : t('normalDays')}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 text-center font-bold text-amber-600 dark:text-amber-400">
                              {log.overtimeHours > 0 ? (log.type === 'hourly' ? formatHoursAndMinutes(log.overtimeHours, language) : `+${formatHoursAndMinutes(log.overtimeHours, language)}`) : '-'}
                            </td>
                            {projectSections.length > 0 && (
                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {log.sectionId && sectionMap[log.sectionId] ? sectionMap[log.sectionId].name : (language === 'fa' ? 'عمومی' : 'General')}
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-3.5 text-center whitespace-nowrap">
                              {logSettled ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  <CheckCircle2 className="w-3 h-3 text-slate-500" />
                                  <span>{t('settledStatusBadge')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                  <Clock className="w-3 h-3 text-sky-500" />
                                  <span>{t('currentStatusBadge')}</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                              {log.notes || '-'}
                            </td>
                            <td className="px-4 py-3.5 text-end font-black text-slate-900 dark:text-white whitespace-nowrap font-mono text-sm">
                              {formatAmount(log.totalDayPay, currency)}
                            </td>
                            <td className="px-4 py-3.5 text-center no-print whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {logSettled ? (
                                  <button
                                    onClick={() => setEditingLog(log)}
                                    className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                                    title={language === 'fa' ? 'مشاهده جزئیات (تسویه شده - قفل)' : 'View details (settled - locked)'}
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span className="text-[10px]">{language === 'fa' ? 'قفل' : 'Locked'}</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setEditingLog(log)}
                                      className="p-1.5 hover:bg-sky-500/10 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-xl transition-colors"
                                      title={t('edit')}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLog(log.id)}
                                      className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors"
                                      title={t('delete')}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* SECTION: Clean Overview Cards of Workers & Groups (هنگامی که شخص خاصی فیلتر نشده است) */
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {language === 'fa' ? 'کارنامه خلاصه پرسنل در این دوره (جهت فیلتر لمس کنید):' : 'Worker Summaries (tap to inspect):'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {displayedWorkerSummaries.length} {t('workers')}
                </span>
              </div>

              {displayedWorkerSummaries.length === 0 ? (
                <div className="p-12 text-center text-slate-400 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 text-xs">
                  {t('noDataForMonth')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedWorkerSummaries.map((row) => (
                    <div 
                      key={row.workerId}
                      onClick={() => {
                        setSelectedWorkerId(String(row.workerId));
                        setSelectedGroupId('all');
                        setShowDetailsInHero(true);
                      }}
                      className="group relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 hover:border-sky-400 hover:shadow-xl hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between space-y-4 cursor-pointer"
                    >
                      {/* Worker Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center font-black text-sky-600 dark:text-sky-400 text-sm shadow-xs">
                            {row.worker.name?.charAt(0) || 'W'}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 dark:text-white text-sm group-hover:text-sky-500 transition-colors">
                              {row.worker.name}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              {row.worker.role || 'پرسنل کارگاه'}
                            </p>
                          </div>
                        </div>

                        {row.worker.groupId && groupMap[row.worker.groupId] && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                            <Users className="w-2.5 h-2.5" />
                            <span>{groupMap[row.worker.groupId].name}</span>
                          </span>
                        )}
                      </div>

                      {/* Shifts Grid Capsule */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-center text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">{t('normalDays')}</span>
                          <span className="font-black text-slate-800 dark:text-slate-200">{row.fullDaysCount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">{t('halfDays')}</span>
                          <span className="font-black text-slate-800 dark:text-slate-200">{row.halfDaysCount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-500 font-bold block">{t('overtimeHours')}</span>
                          <span className="font-black text-amber-600 dark:text-amber-400 font-mono">
                            {formatHoursAndMinutes(row.overtimeHours, language)}
                          </span>
                        </div>
                      </div>

                      {/* Footer & Total Pay */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">{t('totalPayLabel')}</span>
                          <span className="text-base font-black text-sky-600 dark:text-sky-400 font-mono">
                            {formatCurrency(row.totalPay, currency, language)}
                          </span>
                        </div>

                        <div className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center gap-1 group-hover:bg-sky-500 group-hover:text-white transition-all">
                          <span>{language === 'fa' ? 'انتخاب و ریز روزها' : 'View Logs'}</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK DATE INSPECTION MODAL (From Grid click)            */}
      {/* ======================================================== */}
      {inspectedDateStr && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectedDateStr(null);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-sky-500" />
                  <span>{inspectedDateStr}</span>
                </h3>
                <span className="text-xs text-slate-400">
                  {inspectedDateLogs.length} {t('workers')} • {formatCurrency(inspectedTotalPay, currency, language)}
                </span>
              </div>
              <button
                onClick={() => setInspectedDateStr(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {inspectedDateLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  {t('noDataForMonth')}
                </div>
              ) : (
                inspectedDateLogs.map((log) => {
                  const worker = workerMap[log.workerId] || { name: 'Unknown', role: '' };
                  return (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <span 
                          onClick={() => openWorkerProfile(log.workerId)}
                          className="font-bold text-slate-900 dark:text-white block cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors"
                          title="مشاهده پروفایل جامع پرسنل"
                        >
                          {worker.name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            log.type === 'hourly'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                              : log.type === 'half'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDays') : t('normalDays')}
                          </span>
                          {log.overtimeHours > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              {log.type === 'hourly' ? '' : '+'}{formatHoursAndMinutes(log.overtimeHours, language)}
                            </span>
                          )}
                          {log.notes && <span className="italic truncate max-w-[150px]">"{log.notes}"</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {formatCurrency(log.totalDayPay, currency, language)}
                        </span>
                        {isLogSettled(log) ? (
                          <button
                            onClick={() => setEditingLog(log)}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors flex items-center gap-1 text-xs font-semibold"
                            title={language === 'fa' ? 'مشاهده جزئیات (تسویه شده - قفل)' : 'View details (settled - locked)'}
                          >
                            <Lock className="w-4 h-4" />
                            <span className="text-[10px]">{language === 'fa' ? 'قفل' : 'Locked'}</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingLog(log)}
                              className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors"
                              title={t('edit')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                              title={t('delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <button
                onClick={() => {
                  const targetDate = inspectedDateStr;
                  setInspectedDateStr(null);
                  if (onOpenLoggingModal) {
                    onOpenLoggingModal(targetDate);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('quickAddLogThisDate')}</span>
              </button>

              <button
                onClick={() => setInspectedDateStr(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Edit Record Modal */}
      <EditRecordModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
      />

      {/* Attendance Recycle Bin Modal */}
      <AttendanceRecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        workers={workers}
      />

      {/* Full Personnel & Workers Management Modal */}
      <WorkersModal
        isOpen={isWorkersModalOpen}
        onClose={() => setIsWorkersModalOpen(false)}
      />

    </div>
  );
}
