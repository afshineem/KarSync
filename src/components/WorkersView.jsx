import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, DEFAULT_PROJECT_ID } from '../db/db';
import { pushWorkerLive, deleteWorkerLive } from '../services/realtimeSync';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { formatCurrency } from '../utils/formatters';
import { calculateWorkerFinancials } from '../utils/settlementCalculations';
import { QuickMonthAttendanceModal } from './QuickMonthAttendanceModal';
import { EditRecordModal } from './EditRecordModal';
import { WorkerFinancialProfileModal } from './WorkerFinancialProfileModal';
import { ManageGroupsModal } from './ManageGroupsModal';
import { AddWorkerModal } from './AddWorkerModal';
import { 
  Users, 
  UserPlus, 
  UserCheck,
  UserX,
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  Briefcase, 
  Coins, 
  Clock, 
  History, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  X, 
  AlertCircle, 
  Key, 
  Receipt,
  LayoutGrid,
  List,
  Layers,
  Archive,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  WalletCards,
  MoreHorizontal,
  FolderTree,
  Building2,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Check
} from 'lucide-react';

export function WorkersView() {
  const { t, language, direction } = useLanguage();
  const { user, setWorkerCredentials, getWorkerCredentialsMap } = useAuth();
  const { currentProject, openWorkerProfile } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const workerCreds = getWorkerCredentialsMap();
  const searchInputRef = useRef(null);

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'
  const [filterSection, setFilterSection] = useState('all'); // 'all' | 'unassigned' | secId
  const [filterGroup, setFilterGroup] = useState('all'); // 'all' | 'unassigned' | groupId
  const [statusTab, setStatusTab] = useState('active'); // 'active' | 'archived' | 'recycle'
  
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem('workshop_workers_view_mode') || 'grid';
  });
  const handleSetLayoutMode = (mode) => {
    setLayoutMode(mode);
    localStorage.setItem('workshop_workers_view_mode', mode);
  };

  // Group accordion collapse state
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(new Set());
  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Sort state
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'balance' | 'dailyRate' | 'role' | 'createdAt'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };
  
  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isManageGroupsModalOpen, setIsManageGroupsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [historyWorker, setHistoryWorker] = useState(null);
  const [quickAttendanceWorker, setQuickAttendanceWorker] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [activeMenuWorkerId, setActiveMenuWorkerId] = useState(null);

  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // ─────────────────────────────────────────────────────────────
  // کلید میانبر کیبورد: زدن "/" یا "\" برای فوکوس آنی روی سرچ
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // اگر داخل یک اینپوت یا تکست‌اریا نیستیم
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;
      
      if (!isInputFocused && (e.key === '/' || e.key === '\\')) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // بستن منوی سه‌نقطه با کلیک خارج از آن
  useEffect(() => {
    if (!activeMenuWorkerId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-worker-menu]')) {
        setActiveMenuWorkerId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeMenuWorkerId]);

  // Live queries
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

  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  const groups = useLiveQuery(
    async () => {
      try {
        const list = await db.groups.toArray();
        return list.filter((g) => !g.deletedAt && (!g.projectId || g.projectId === targetProjectId));
      } catch (_) {
        return [];
      }
    },
    [targetProjectId]
  ) || [];

  // پرسنلی که دارای سابقه کارکرد یا اسناد مالی هستند تحت هیچ شرایطی نباید حذف قطعی شوند
  const undeletableWorkerIds = useLiveQuery(
    async () => {
      const logs = await db.attendanceLogs.toArray();
      const payments = await db.payments.toArray();
      const expenses = await db.expenses.toArray();
      const set = new Set();
      logs.forEach((l) => {
        if (l.workerId) set.add(String(l.workerId));
      });
      payments.forEach((p) => {
        if (p.workerId) set.add(String(p.workerId));
      });
      expenses.forEach((e) => {
        if (e.workerId) set.add(String(e.workerId));
      });
      return set;
    },
    []
  ) || new Set();

  const allLogs = useLiveQuery(() => db.attendanceLogs.toArray(), []) || [];
  const allPayments = useLiveQuery(() => db.payments.toArray(), []) || [];

  const workerFinancialsMap = useMemo(() => {
    const map = new Map();
    workers.forEach((w) => {
      const fin = calculateWorkerFinancials(w, allLogs, allPayments, currency);
      if (fin) map.set(w.id, fin);
    });
    return map;
  }, [workers, allLogs, allPayments, currency]);

  // لیست‌های وضعیت سه‌گانه
  const activeWorkersList = useMemo(() => {
    return (workers || []).filter(w => !w.deletedAt && !w.isArchived && w.status !== 'archived');
  }, [workers]);

  const archivedWorkersList = useMemo(() => {
    return (workers || []).filter(w => !w.deletedAt && (w.isArchived || w.status === 'archived'));
  }, [workers]);

  const recycleWorkersList = useMemo(() => {
    return (workers || []).filter(w => !!w.deletedAt);
  }, [workers]);

  // محاسبات شاخص‌های هیرو مدیریتی
  const heroMetrics = useMemo(() => {
    let totalUnsettledDue = 0;
    let activeTodayCount = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    const todayWorkerIds = new Set();
    allLogs.forEach(l => {
      if (l.date === todayStr && l.workerId && (l.status === 'present' || l.hours > 0)) {
        todayWorkerIds.add(String(l.workerId));
      }
    });
    activeTodayCount = todayWorkerIds.size;

    activeWorkersList.forEach(w => {
      const fin = workerFinancialsMap.get(w.id);
      if (fin && fin.netBalanceDue > 0) {
        totalUnsettledDue += fin.netBalanceDue;
      }
    });

    return {
      activeCount: activeWorkersList.length,
      activeTodayCount,
      totalUnsettledDue,
      groupsCount: groups.length
    };
  }, [activeWorkersList, allLogs, workerFinancialsMap, groups]);

  // فیلتر اصلی پرسنل
  const filteredWorkers = useMemo(() => {
    return (workers || []).filter((w) => {
      if (!w) return false;

      // ۱. تب وضعیت اصلی
      if (statusTab === 'active') {
        if (w.deletedAt || w.isArchived || w.status === 'archived') return false;
        if (filterActive === 'active' && w.isActive !== 1) return false;
        if (filterActive === 'inactive' && w.isActive !== 0) return false;
      } else if (statusTab === 'archived') {
        if (w.deletedAt || (!w.isArchived && w.status !== 'archived')) return false;
      } else if (statusTab === 'recycle') {
        if (!w.deletedAt) return false;
      }

      // ۲. فیلتر سرچ متن
      const wName = (w.name || '').toLowerCase();
      const s = (searchTerm || '').trim().toLowerCase();
      if (s) {
        const match = 
          wName.includes(s) ||
          (w.role && w.role.toLowerCase().includes(s)) ||
          (w.phone && String(w.phone).includes(s));
        if (!match) return false;
      }

      // ۳. فیلتر بخش پروژه
      if (statusTab !== 'recycle' && filterSection !== 'all') {
        if (filterSection === 'unassigned') {
          if (w.defaultSectionId) return false;
        } else {
          if (w.defaultSectionId !== filterSection) return false;
        }
      }

      // ۴. فیلتر گروه
      if (statusTab !== 'recycle' && filterGroup !== 'all') {
        if (filterGroup === 'unassigned') {
          if (w.groupId) return false;
        } else {
          if (String(w.groupId) !== String(filterGroup)) return false;
        }
      }

      return true;
    });
  }, [workers, statusTab, searchTerm, filterActive, filterSection, filterGroup]);

  // گروه‌بندی و مرتب‌سازی پرسنل
  const groupedWorkers = useMemo(() => {
    const groupsObj = { 
      unassigned: { 
        id: 'unassigned', 
        name: language === 'ku' ? 'پرسنلی گشتی (بێ گرووپ)' : 'پرسنل عمومی (بدون گروه)', 
        description: language === 'ku' ? 'کرێکارانی ئازاد و بێ بەشین' : 'نیروهای انفرادی و عمومی کارگاه',
        workers: [] 
      } 
    };
    
    (groups || []).forEach(g => {
      groupsObj[g.id] = { ...g, workers: [] };
    });
    
    filteredWorkers.forEach(w => {
      if (w.groupId && groupsObj[w.groupId]) {
        groupsObj[w.groupId].workers.push(w);
      } else {
        groupsObj.unassigned.workers.push(w);
      }
    });

    // مرتب‌سازی اعضای هر گروه
    Object.values(groupsObj).forEach(g => {
      if (g.workers) {
        g.workers.sort((a, b) => {
          let compare = 0;
          if (sortBy === 'name') {
            compare = (a.name || '').localeCompare(b.name || '', language === 'fa' ? 'fa' : 'ckb');
          } else if (sortBy === 'balance') {
            const finA = workerFinancialsMap.get(a.id)?.netBalanceDue || 0;
            const finB = workerFinancialsMap.get(b.id)?.netBalanceDue || 0;
            compare = finB - finA;
          } else if (sortBy === 'dailyRate') {
            compare = (Number(a.dailyRate) || 0) - (Number(b.dailyRate) || 0);
          } else if (sortBy === 'role') {
            compare = (a.role || '').localeCompare(b.role || '');
          } else if (sortBy === 'createdAt') {
            compare = (a.createdAt || '').localeCompare(b.createdAt || '');
          }

          if (compare !== 0) {
            return sortOrder === 'asc' ? compare : -compare;
          }

          if (a?.teamRole === 'Master' && b?.teamRole !== 'Master') return -1;
          if (b?.teamRole === 'Master' && a?.teamRole !== 'Master') return 1;
          return (a?.name || '').localeCompare(b?.name || '');
        });
      }
    });

    return Object.values(groupsObj).filter(g => g.workers.length > 0);
  }, [filteredWorkers, groups, sortBy, sortOrder, language, workerFinancialsMap]);

  // اکشن‌ها
  const handleOpenAddModal = () => {
    setEditingWorker(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (worker) => {
    setActiveMenuWorkerId(null);
    setEditingWorker(worker);
    setIsFormModalOpen(true);
  };

  const handleToggleActive = async (worker) => {
    setActiveMenuWorkerId(null);
    const newStatus = worker.isActive === 1 ? 0 : 1;
    const updated = {
      ...worker,
      isActive: newStatus,
      updatedAt: new Date().toISOString()
    };
    await db.workers.update(worker.id, {
      isActive: newStatus,
      updatedAt: updated.updatedAt
    });
    pushWorkerLive(updated).catch(console.error);
  };

  const handleArchiveWorker = async (worker) => {
    setActiveMenuWorkerId(null);
    const updated = {
      ...worker,
      isArchived: true,
      status: 'archived',
      updatedAt: new Date().toISOString()
    };
    await db.workers.update(worker.id, {
      isArchived: true,
      status: 'archived',
      updatedAt: updated.updatedAt
    });
    pushWorkerLive(updated).catch(console.error);
  };

  const handleUnarchiveWorker = async (worker) => {
    const updated = {
      ...worker,
      isArchived: false,
      status: 'active',
      updatedAt: new Date().toISOString()
    };
    await db.workers.update(worker.id, {
      isArchived: false,
      status: 'active',
      updatedAt: updated.updatedAt
    });
    pushWorkerLive(updated).catch(console.error);
  };

  const handleMoveToRecycle = async (worker) => {
    setActiveMenuWorkerId(null);
    if (undeletableWorkerIds.has(String(worker.id))) {
      alert(language === 'fa' 
        ? 'این پرسنل به دلیل داشتن سابقه کارکرد یا اسناد مالی در سیستم، به جهت حفظ یکپارچگی حسابداری تحت هیچ شرایطی قابل حذف نیست. شما می‌توانید وضعیت ایشان را به "بایگانی" تغییر دهید.' 
        : 'ئەم کارمەندە بەهۆی هەبوونی تۆماری کار یان بەڵگەنامەی دارایی ناتوانرێت بسڕدرێتەوە.');
      return;
    }
    const updated = {
      ...worker,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.workers.update(worker.id, {
      deletedAt: updated.deletedAt,
      updatedAt: updated.updatedAt
    });
    pushWorkerLive(updated).catch(console.error);
  };

  const handleRestoreFromRecycle = async (worker) => {
    const updated = {
      ...worker,
      deletedAt: null,
      updatedAt: new Date().toISOString()
    };
    await db.workers.update(worker.id, {
      deletedAt: null,
      updatedAt: updated.updatedAt
    });
    pushWorkerLive(updated).catch(console.error);
  };

  const handlePermanentDelete = async (worker) => {
    if (undeletableWorkerIds.has(String(worker.id))) {
      alert(language === 'fa' 
        ? 'این پرسنل دارای سوابق رسمی کارکرد یا اسناد مالی است و حذف دائمی آن غیرقانونی است. لطفاً پرسنل را بازیابی و بایگانی نمایید.' 
        : 'ئەم کارمەندە ناتوانرێت بسڕدرێتەوە.');
      return;
    }
    if (window.confirm(language === 'fa' ? 'آیا از حذف دائمی این پرسنل مطمئن هستید؟ این عملیات غیرقابل بازگشت است.' : 'دڵنیایت لە سڕینەوەی یەکجاری؟')) {
      await db.workers.delete(worker.id);
      deleteWorkerLive(worker.id).catch(console.error);
    }
  };

  const handleEmptyRecycleBin = async () => {
    if (recycleWorkersList.length === 0) return;
    const deletableList = recycleWorkersList.filter(w => !undeletableWorkerIds.has(String(w.id)));
    if (deletableList.length === 0) {
      alert(language === 'fa' 
        ? 'پرسنل موجود در بخش بازیافت دارای سوابق کارکرد یا اسناد مالی هستند و امکان حذف قطعی آن‌ها وجود ندارد.' 
        : 'کارمەندەکان ناتوانرێن بسڕدرێنەوە.');
      return;
    }
    if (window.confirm(language === 'fa' ? `آیا از حذف دائمی ${deletableList.length} پرسنل قابل حذف در بازیافت مطمئن هستید؟` : 'دڵنیایت؟')) {
      for (const w of deletableList) {
        await db.workers.delete(w.id);
        deleteWorkerLive(w.id).catch(console.error);
      }
    }
  };

  return (
    <div className="space-y-6 pb-24" dir={direction}>
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. هیرو بنر مدیریتی دارک و شاخص (Executive Personnel Hero)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white shadow-xl border border-slate-800 p-5 sm:p-7">
        {/* اورب‌های نوری بلورین */}
        <div className="absolute -top-16 -end-16 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -start-16 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* ستون راست: عنوان و شاخص‌های آماری پرسنل */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
                <Users className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {language === 'fa' ? 'مدیریت پرسنل و کارکنان' : 'بەڕێوەبردنی کرێکاران و پرسنل'}
                  </h1>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-sky-300 border border-white/10">
                    {currentProject?.name || 'کارگاه فعال'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {language === 'fa' 
                    ? 'سازماندهی تیم‌های کاری، دستمزدها، کارنامه و وضعیت مالی پرسنل' 
                    : 'ڕێکخستنی تیمەکانی کار، حەقدەست و دۆخی دارایی'}
                </p>
              </div>
            </div>

            {/* کارت‌های شیشه‌ای شاخص‌های کلیدی (KPIs) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <span className="text-[11px] text-slate-400 block truncate">کل پرسنل فعال:</span>
                <span className="text-lg font-black font-mono text-white mt-0.5 block">
                  {heroMetrics.activeCount} <span className="text-xs font-normal text-slate-400">نفر</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
                <span className="text-[11px] text-emerald-300 block truncate">مشغول به کار امروز:</span>
                <span className="text-lg font-black font-mono text-emerald-400 mt-0.5 block">
                  {heroMetrics.activeTodayCount} <span className="text-xs font-normal text-emerald-300">حاضر</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md">
                <span className="text-[11px] text-amber-300 block truncate">مجموع مانده طلب معوق:</span>
                <span className="text-sm sm:text-base font-black font-mono text-amber-400 mt-1 block truncate" dir="ltr">
                  {formatCurrency(heroMetrics.totalUnsettledDue, currency, language)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
                <span className="text-[11px] text-indigo-300 block truncate">گروه‌های تخصصی:</span>
                <span className="text-lg font-black font-mono text-indigo-300 mt-0.5 block">
                  {heroMetrics.groupsCount} <span className="text-xs font-normal text-indigo-400">تیم</span>
                </span>
              </div>
            </div>
          </div>

          {/* ستون چپ: تب‌های وضعیت شاغلین / بازیافت و دکمه‌های اکشن اصلی */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-3 shrink-0">
            
            {/* سگمنت شکیل وضعیت: فعال | بایگانی | بازیافت */}
            <div className="flex items-center p-1.5 bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-2xl border border-white/15">
              {[
                { id: 'active', label: 'شاغلین (فعال)', count: activeWorkersList.length, icon: Users },
                { id: 'archived', label: 'بایگانی', count: archivedWorkersList.length, icon: Archive },
                { id: 'recycle', label: 'بازیافت', count: recycleWorkersList.length, icon: RefreshCw }
              ].map(tab => {
                const isSelected = statusTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* دکمه‌های اکشن اصلی */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsManageGroupsModalOpen(true)}
                className="px-4 h-11 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                title="مدیریت گروه‌ها و دسته‌بندی‌های کارگاه"
              >
                <FolderTree className="w-4 h-4 text-indigo-400" />
                <span>مدیریت گروه‌ها</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-5 h-11 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-sky-500/25 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4.5 h-4.5" />
                <span>+ ثبت پرسنل جدید</span>
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. نوار کنترل و فیلتر شیشه‌ای یکپارچه (Single-Row Command Bar)  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
        
        {/* اینپوت سرچ با کلید میانبر کیبورد */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4.5 h-4.5 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی پرسنل با نام، سمت یا موبایل..."
            className="w-full ps-10 pe-16 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:outline-none transition-all"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="absolute end-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md font-mono pointer-events-none hidden sm:inline-block">
              /
            </kbd>
          )}
        </div>

        {/* فیلترهای گروهی، بخش و وضعیت کارکرد */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* فیلتر گروه */}
          {statusTab !== 'recycle' && groups.length > 0 && (
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="px-3 py-2 bg-slate-50/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-sky-500/30 focus:outline-none cursor-pointer"
            >
              <option value="all">همه گروه‌ها</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
              <option value="unassigned">پرسنل انفرادی (بدون گروه)</option>
            </select>
          )}

          {/* فیلتر بخش پروژه */}
          {statusTab !== 'recycle' && projectSections.length > 0 && (
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="px-3 py-2 bg-slate-50/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-sky-500/30 focus:outline-none cursor-pointer"
            >
              <option value="all">همه بخش‌ها</option>
              {projectSections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="unassigned">عمومی (بدون بخش)</option>
            </select>
          )}

          {/* فیلتر فعال / غیرفعال (در تب شاغلین) */}
          {statusTab === 'active' && (
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setFilterActive('all')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterActive === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                همه
              </button>
              <button
                type="button"
                onClick={() => setFilterActive('active')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterActive === 'active'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                فعال
              </button>
              <button
                type="button"
                onClick={() => setFilterActive('inactive')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterActive === 'inactive'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                غیرفعال
              </button>
            </div>
          )}

          {/* مرتب‌سازی */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1 bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="name">نام (الفبایی)</option>
              <option value="balance">مانده حساب (بیشترین طلب)</option>
              <option value="dailyRate">دستمزد روزانه</option>
              <option value="role">تخصص / سمت</option>
              <option value="createdAt">تاریخ ثبت</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title={sortOrder === 'asc' ? 'صعودی' : 'نزولی'}
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-500" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-500" />}
            </button>
          </div>

          {/* سوییچ چیدمان: گرید کارت / لیست */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => handleSetLayoutMode('grid')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                layoutMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمایش کارتی"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetLayoutMode('list')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                layoutMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمایش جدولی و فشرده"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* دکمه خالی کردن بازیافت در تب بازیافت */}
          {statusTab === 'recycle' && recycleWorkersList.length > 0 && (
            <button
              type="button"
              onClick={handleEmptyRecycleBin}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-2xl text-xs font-bold border border-rose-200 dark:border-rose-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>تخلیه جعبه بازیافت</span>
            </button>
          )}

        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. لیست پرسنل و دسته‌ها: چیدمان کارتی یا سطری                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {groupedWorkers.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {searchTerm ? 'هیچ پرسنلی با این مشخصات یافت نشد' : 'هنوز پرسنلی در این بخش ثبت نشده است'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {statusTab === 'active' 
              ? 'می‌توانید با زدن دکمه «+ ثبت پرسنل جدید»، اولین کارگر یا استادکار را تعریف کنید.' 
              : 'آیتمی در این بخش وجود ندارد.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedWorkers.map(group => {
            const isCollapsed = collapsedGroupIds.has(group.id);
            return (
              <div key={group.id} className="space-y-3.5">
                
                {/* بنر سرگروه تاشو (Collapsible Group Header) */}
                <div 
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="flex items-center justify-between p-3.5 sm:px-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-xs cursor-pointer select-none transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-transform duration-200 ${
                      isCollapsed ? (direction === 'rtl' ? 'rotate-90' : '-rotate-90') : ''
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                          {group.name}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60 font-bold font-mono">
                          {group.workers.length} نفر
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors font-medium">
                    {isCollapsed ? 'نمایش اعضا' : 'بستن گروه'}
                  </span>
                </div>

                {/* اعضای گروه در حالت باز */}
                {!isCollapsed && (
                  layoutMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.workers.map(worker => {
                        const fin = workerFinancialsMap.get(worker.id);
                        const isMenuOpen = activeMenuWorkerId === worker.id;

                        return (
                          <div 
                            key={worker.id}
                            className={`rounded-3xl p-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border transition-all duration-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-md flex flex-col justify-between ${
                              worker.isActive !== 0
                                ? 'border-white/80 dark:border-slate-800/80'
                                : 'border-rose-200/80 dark:border-rose-950/80 bg-rose-50/10'
                            }`}
                          >
                            <div className="space-y-4">
                              {/* هدر کارت: آواتار، نام و منوی عملیات */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div 
                                    onClick={() => openWorkerProfile(worker.id)}
                                    className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-lg font-black shrink-0 shadow-md shadow-sky-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                                  >
                                    {worker.name ? worker.name.charAt(0) : <Users className="w-5 h-5" />}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4 
                                        onClick={() => openWorkerProfile(worker.id)}
                                        className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                                        title="مشاهده پروفایل جامع پرسنل"
                                      >
                                        {worker.name}
                                      </h4>
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                                        worker.isActive !== 0 ? 'bg-emerald-500' : 'bg-rose-500'
                                      }`} title={worker.isActive !== 0 ? 'شاغل' : 'غیرفعال'} />
                                    </div>

                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className="text-xs text-sky-600 dark:text-sky-400 font-bold">
                                        {worker.role || 'پرسنل کارگاه'}
                                      </span>
                                      {worker.teamRole === 'Master' && (
                                        <span className="text-[10px] px-2 py-0.2 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 font-bold">
                                          استادکار
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* منوی عملیات سه‌نقطه */}
                                <div className="relative" data-worker-menu>
                                  <button
                                    type="button"
                                    onClick={() => setActiveMenuWorkerId(prev => prev === worker.id ? null : worker.id)}
                                    className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <MoreHorizontal className="w-5 h-5" />
                                  </button>

                                  {isMenuOpen && (
                                    <div className="absolute end-0 top-full mt-1 w-48 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                                      {statusTab === 'active' && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuWorkerId(null);
                                              setQuickAttendanceWorker(worker);
                                            }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 flex items-center gap-2 cursor-pointer text-start"
                                          >
                                            <Calendar className="w-4 h-4 text-sky-500" />
                                            <span>ثبت تقویم ماهانه</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditModal(worker)}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer text-start"
                                          >
                                            <Edit2 className="w-4 h-4 text-slate-500" />
                                            <span>ویرایش پرونده</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleToggleActive(worker)}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer text-start"
                                          >
                                            {worker.isActive === 1 ? (
                                              <>
                                                <XCircle className="w-4 h-4 text-rose-500" />
                                                <span>مرخص / غیرفعال‌سازی</span>
                                              </>
                                            ) : (
                                              <>
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                <span>فعال‌سازی مجدد</span>
                                              </>
                                            )}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleArchiveWorker(worker)}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer text-start"
                                          >
                                            <Archive className="w-4 h-4" />
                                            <span>بایگانی پرسنل</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleMoveToRecycle(worker)}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer text-start"
                                          >
                                            <RotateCcw className="w-4 h-4" />
                                            <span>انتقال به بازیافت</span>
                                          </button>
                                        </>
                                      )}

                                      {statusTab === 'archived' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMenuWorkerId(null);
                                            handleUnarchiveWorker(worker);
                                          }}
                                          className="w-full px-3.5 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-2 cursor-pointer text-start"
                                        >
                                          <Check className="w-4 h-4" />
                                          <span>خروج از بایگانی</span>
                                        </button>
                                      )}

                                      {statusTab === 'recycle' && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuWorkerId(null);
                                              handleRestoreFromRecycle(worker);
                                            }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-2 cursor-pointer text-start"
                                          >
                                            <RotateCcw className="w-4 h-4" />
                                            <span>بازیابی مجدد به شاغلین</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuWorkerId(null);
                                              handlePermanentDelete(worker);
                                            }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer text-start"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                            <span>حذف دائمی از حافظه</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* اطلاعات تماس و بخش کاری */}
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                {worker.phone ? (
                                  <a 
                                    href={`tel:${worker.phone}`}
                                    className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-sky-600 font-mono"
                                    title="تماس مستقیم"
                                  >
                                    <Phone className="w-3.5 h-3.5 text-sky-500" />
                                    <span>{worker.phone}</span>
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-slate-400">بدون تلفن</span>
                                )}

                                {worker.defaultSectionId && sectionMap[worker.defaultSectionId] && (
                                  <>
                                    <span>•</span>
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                      <Layers className="w-3 h-3 text-slate-400" />
                                      <span className="truncate max-w-[110px]">{sectionMap[worker.defaultSectionId]?.name}</span>
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* باکس شیشه‌ای دستمزد و مانده حساب */}
                              <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400">نرخ روزانه:</span>
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                                    {worker.wageType === 'contract' ? 'کنتراکت' : formatCurrency(worker.dailyRate, currency, language)}
                                  </span>
                                </div>

                                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                    مانده حساب جاری:
                                  </span>
                                  {fin ? (
                                    <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-lg ${
                                      fin.netBalanceDue > 0
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60'
                                        : fin.netBalanceDue < 0
                                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`} dir="ltr">
                                      {formatCurrency(Math.abs(fin.netBalanceDue), currency, language)}
                                      <span className="text-[9px] ms-1 font-normal font-sans">
                                        {fin.netBalanceDue > 0 ? 'طلبکار' : fin.netBalanceDue < 0 ? 'بدهکار' : 'تسویه'}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* فوتر کارت: دکمه اقدام مستقیم کارنامه */}
                            <div className="pt-4 mt-2">
                              <button
                                type="button"
                                onClick={() => openWorkerProfile(worker.id)}
                                className="w-full py-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold text-xs border border-sky-200/60 dark:border-sky-800/60 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                              >
                                <History className="w-4 h-4" />
                                <span>مشاهده کارنامه و پروفایل پرسنل</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* نمایش جدولی و فشرده (List Mode - Responsive 2 Columns on Tablet/Desktop) */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.workers.map(worker => {
                        const fin = workerFinancialsMap.get(worker.id);
                        return (
                          <div 
                            key={worker.id}
                            className="p-3.5 sm:px-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 flex items-center justify-between gap-3 shadow-xs hover:shadow-md hover:border-sky-300 dark:hover:border-sky-800 transition-all group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div 
                                onClick={() => openWorkerProfile(worker.id)}
                                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 cursor-pointer shadow-xs hover:scale-105 active:scale-95 transition-transform"
                              >
                                {worker.name ? worker.name.charAt(0) : <Users className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 
                                    onClick={() => openWorkerProfile(worker.id)}
                                    className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate cursor-pointer hover:text-sky-600 transition-colors"
                                    title="مشاهده پروفایل جامع پرسنل"
                                  >
                                    {worker.name}
                                  </h4>
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${worker.isActive !== 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                </div>
                                <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                                  {worker.role || 'پرسنل'} {worker.phone ? `• ${worker.phone}` : ''}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                              <div className="text-end hidden sm:block">
                                <span className="text-[9px] text-slate-400 block">روزانه:</span>
                                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300" dir="ltr">
                                  {worker.wageType === 'contract' ? 'توافقی' : formatCurrency(worker.dailyRate, currency, language)}
                                </span>
                              </div>

                              <div className="text-end">
                                <span className="text-[9px] text-slate-400 block">مانده:</span>
                                {fin ? (
                                  <span className={`text-xs font-mono font-black ${
                                    fin.netBalanceDue > 0 ? 'text-emerald-600 dark:text-emerald-400' : fin.netBalanceDue < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                                  }`} dir="ltr">
                                    {formatCurrency(Math.abs(fin.netBalanceDue), currency, language)}
                                  </span>
                                ) : '—'}
                              </div>

                              <button
                                type="button"
                                onClick={() => openWorkerProfile(worker.id)}
                                className="p-2 rounded-xl text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="مشاهده پروفایل"
                              >
                                <History className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. مودال‌های زیرسیستم پرسنل                                    */}
      {/* ───────────────────────────────────────────────────────────── */}

      {/* مودال پرچمدار و جدید تعریف و ویرایش پرسنل */}
      <AddWorkerModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingWorker(null);
        }}
        workerToEdit={editingWorker}
        onSuccess={() => {
          setIsFormModalOpen(false);
          setEditingWorker(null);
        }}
      />

      {/* ثبت تقویم ماهانه سریع */}
      <QuickMonthAttendanceModal
        worker={quickAttendanceWorker}
        isOpen={!!quickAttendanceWorker}
        onClose={() => setQuickAttendanceWorker(null)}
      />

      {/* کارنامه مالی پرسنل */}
      <WorkerFinancialProfileModal
        worker={historyWorker}
        currency={currency}
        onClose={() => setHistoryWorker(null)}
        onEditLog={setEditingLog}
      />

      {/* ویرایش رکورد کارکرد */}
      <EditRecordModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
      />

      {/* مدیریت گروه‌های تخصصی */}
      {isManageGroupsModalOpen && (
        <ManageGroupsModal 
          onClose={() => setIsManageGroupsModalOpen(false)} 
          targetProjectId={targetProjectId}
        />
      )}

    </div>
  );
}
