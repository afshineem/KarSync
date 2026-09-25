import { pushWorkerLive, deleteWorkerLive } from '../services/realtimeSync';
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { formatCurrency, formatHoursAndMinutes, getCurrencySymbol } from '../utils/formatters';
import { QuickMonthAttendanceModal } from './QuickMonthAttendanceModal';
import { EditRecordModal } from './EditRecordModal';
import { WorkerFinancialProfileModal } from './WorkerFinancialProfileModal';
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
  History, Calendar, Sparkles, 
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
  RotateCcw
} from 'lucide-react';

export function WorkersView() {
  const { t, language } = useLanguage();
  const { user, setWorkerCredentials, getWorkerCredentialsMap } = useAuth();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const workerCreds = getWorkerCredentialsMap();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'
  const [filterSection, setFilterSection] = useState('all'); // 'all' | 'unassigned' | secId
  const [statusTab, setStatusTab] = useState('active'); // 'active' | 'archived' | 'trash'
  
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem('workshop_workers_view_mode') || 'grid';
  });
  const handleSetLayoutMode = (mode) => {
    setLayoutMode(mode);
    localStorage.setItem('workshop_workers_view_mode', mode);
  };
  
  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [historyWorker, setHistoryWorker] = useState(null);
  const [historyTab, setHistoryTab] = useState('logs'); // 'logs' | 'payments'
  const [quickAttendanceWorker, setQuickAttendanceWorker] = useState(null);
  const [editingLog, setEditingLog] = useState(null);

  // Form inputs
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: '',
    groupId: '',
    teamRole: 'Worker',
    dailyRate: '35000',
    overtimeHourlyRate: '5000',
    defaultSectionId: '',
    isActive: 1,
    username: '',
    password: ''
  });
  const [formError, setFormError] = useState('');

  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // Live query project sections for current project
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

  // Live query from Dexie scoped to active project with fallback for legacy records
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  // Live query groups for current project
  const groups = useLiveQuery(
    async () => {
      const list = await db.groups.toArray();
      return list.filter((g) => (g.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
    },
    [targetProjectId]
  ) || [];

  const rawWorkerHistoryLogs = useLiveQuery(
    async () => {
      if (!historyWorker?.id) return [];
      const list = await db.attendanceLogs.toArray();
      return list.filter((l) => String(l.workerId) === String(historyWorker.id));
    },
    [historyWorker?.id]
  ) || [];

  const workerPayments = useLiveQuery(
    async () => {
      if (!historyWorker?.id) return [];
      const list = await db.payments.toArray();
      const filtered = list.filter((p) => String(p.workerId) === String(historyWorker.id));
      return filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },
    [historyWorker?.id]
  ) || [];

  const workerHistoryLogs = useMemo(() => {
    if (!Array.isArray(rawWorkerHistoryLogs)) return [];
    const map = new Map();
    rawWorkerHistoryLogs.forEach((l) => {
      if (!l || !l.date) return;
      const existing = map.get(l.date);
      if (!existing) {
        map.set(l.date, l);
      } else {
        const timeL = l.updatedAt || l.createdAt || '';
        const timeEx = existing.updatedAt || existing.createdAt || '';
        if (timeL.localeCompare(timeEx) > 0) {
          map.set(l.date, l);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [rawWorkerHistoryLogs]);

  // Active, Archived, and Trash lists for accurate counts
  const activeWorkersList = useMemo(() => {
    return (workers || []).filter(w => !w.deletedAt && !w.isArchived && w.status !== 'archived');
  }, [workers]);

  const archivedWorkersList = useMemo(() => {
    return (workers || []).filter(w => !w.deletedAt && (w.isArchived || w.status === 'archived'));
  }, [workers]);

  const trashWorkersList = useMemo(() => {
    return (workers || []).filter(w => !!w.deletedAt);
  }, [workers]);

  // Filtered workers list based on statusTab, search, section, and active/inactive subfilter
  const filteredWorkers = useMemo(() => {
    return (workers || []).filter((w) => {
      if (!w) return false;

      // 1. Status Tab filter
      if (statusTab === 'active') {
        if (w.deletedAt || w.isArchived || w.status === 'archived') return false;
        if (filterActive === 'active' && w.isActive !== 1) return false;
        if (filterActive === 'inactive' && w.isActive !== 0) return false;
      } else if (statusTab === 'archived') {
        if (w.deletedAt || (!w.isArchived && w.status !== 'archived')) return false;
      } else if (statusTab === 'trash') {
        if (!w.deletedAt) return false;
      }

      // 2. Search
      const wName = (w.name || '').toLowerCase();
      const s = (searchTerm || '').toLowerCase();
      const matchSearch = 
        wName.includes(s) ||
        (w.role && w.role.toLowerCase().includes(s)) ||
        (w.phone && String(w.phone).includes(searchTerm));
      
      if (!matchSearch) return false;

      // 3. Section filter (applied in active & archived views)
      if (statusTab !== 'trash' && filterSection !== 'all') {
        if (filterSection === 'unassigned') {
          if (w.defaultSectionId) return false;
        } else {
          if (w.defaultSectionId !== filterSection) return false;
        }
      }

      return true;
    });
  }, [workers, statusTab, searchTerm, filterActive, filterSection]);

  const groupedWorkers = useMemo(() => {
    const groupsObj = { unassigned: { id: 'unassigned', name: 'پرسنل عمومی (بدون گروه)', workers: [] } };
    
    // Initialize groups from DB
    (groups || []).forEach(g => {
      groupsObj[g.id] = { ...g, workers: [] };
    });
    
    // Populate workers
    filteredWorkers.forEach(w => {
      if (w.groupId && groupsObj[w.groupId]) {
        groupsObj[w.groupId].workers.push(w);
      } else {
        groupsObj.unassigned.workers.push(w);
      }
    });

    // Sort workers inside groups (Masters first)
    Object.values(groupsObj).forEach(g => {
      if(g.workers) {
        g.workers.sort((a, b) => {
          if (a.teamRole === 'Master' && b.teamRole !== 'Master') return -1;
          if (b.teamRole === 'Master' && a.teamRole !== 'Master') return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
      }
    });

    return Object.values(groupsObj).filter(g => g.workers.length > 0);
  }, [filteredWorkers, groups]);

  // Open modal to add worker
  const handleOpenAddModal = () => {
    setEditingWorker(null);
    setFormData({
      name: '',
      phone: '',
      role: '',
      groupId: '',
      teamRole: 'Worker',
      dailyRate: '35000',
      overtimeHourlyRate: '5000',
      defaultSectionId: '',
      isActive: 1,
      username: '',
      password: ''
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Open modal to edit worker
  const handleOpenEditModal = (worker) => {
    setEditingWorker(worker);
    const creds = workerCreds[worker.id] || {};
    setFormData({
      name: worker.name,
      phone: worker.phone || '',
      role: worker.role || '',
      groupId: worker.groupId || '',
      teamRole: worker.teamRole || 'Worker',
      dailyRate: String(worker.dailyRate),
      overtimeHourlyRate: String(worker.overtimeHourlyRate),
      defaultSectionId: worker.defaultSectionId || '',
      isActive: worker.isActive,
      username: creds.username || worker.username || '',
      password: creds.password || worker.password || ''
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Save Worker (Create or Update)
  const handleSaveWorker = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError(t('validationNameRequired'));
      return;
    }

    const dailyRate = Number(formData.dailyRate);
    const overtimeRate = Number(formData.overtimeHourlyRate);

    if (isNaN(dailyRate) || dailyRate < 0 || isNaN(overtimeRate) || overtimeRate < 0) {
      setFormError(t('validationRatesPositive'));
      return;
    }

    try {
      let targetWorkerId = null;
      if (editingWorker) {
        targetWorkerId = editingWorker.id;
        // Update
        const updatedWorker = {
          ...editingWorker,
          projectId: editingWorker.projectId || currentProject?.id || 'prj_default_main',
          userId: editingWorker.userId || user?.id || 'default_user',
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          role: formData.role.trim(),
          groupId: formData.groupId ? String(formData.groupId) : null,
          teamRole: formData.teamRole || 'Worker',
          dailyRate: dailyRate,
          overtimeHourlyRate: overtimeRate,
          defaultSectionId: formData.defaultSectionId ? String(formData.defaultSectionId) : null,
          isActive: Number(formData.isActive),
          username: (formData.username || '').trim(),
          password: (formData.password || '').trim(),
          updatedAt: new Date().toISOString()
        };
        await db.workers.update(editingWorker.id, updatedWorker);
        pushWorkerLive(updatedWorker).catch(console.error);

        // Migrate past attendance records to the new section if default section was changed
        const oldSection = editingWorker.defaultSectionId;
        const newSection = updatedWorker.defaultSectionId;
        if (newSection && oldSection !== newSection) {
          const logs = await db.attendanceLogs.where('workerId').equals(editingWorker.id).toArray();
          const logsToUpdate = logs.filter(l => !l.sectionId || l.sectionId === oldSection);
          
          if (logsToUpdate.length > 0) {
            const now = new Date().toISOString();
            const bulkUpdates = logsToUpdate.map(l => ({
              ...l,
              sectionId: newSection,
              updatedAt: now
            }));
            await db.attendanceLogs.bulkPut(bulkUpdates);
            
            // To ensure the global views refresh
            window.dispatchEvent(new CustomEvent('workshop-logs-updated'));
          }
        }
      } else {
        // Create
        targetWorkerId = generateId();
        const newWorker = {
          id: targetWorkerId,
          projectId: currentProject?.id || 'prj_default_main',
          userId: user?.id || 'default_user',
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          role: formData.role.trim(),
          groupId: formData.groupId ? String(formData.groupId) : null,
          teamRole: formData.teamRole || 'Worker',
          dailyRate: dailyRate,
          overtimeHourlyRate: overtimeRate,
          defaultSectionId: formData.defaultSectionId ? String(formData.defaultSectionId) : null,
          isActive: 1,
          username: (formData.username || '').trim(),
          password: (formData.password || '').trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await db.workers.add(newWorker);
        pushWorkerLive(newWorker).catch(console.error);
      }

      // Save portal credentials
      if (targetWorkerId) {
        await setWorkerCredentials(targetWorkerId, formData.username, formData.password);
      }

      setIsFormModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Error saving worker');
    }
  };

  // Toggle worker active/inactive status
  const handleToggleActive = async (worker) => {
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

  // Archive worker
  const handleArchiveWorker = async (worker) => {
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

  // Unarchive worker
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

  // Move worker to Trash (Soft Delete)
  const handleMoveToTrash = async (worker) => {
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

  // Restore worker from Trash
  const handleRestoreWorker = async (worker) => {
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

  // Permanent Delete
  const handlePermanentDeleteWorker = async (worker) => {
    if (window.confirm(t('confirmPermanentDelete') || 'آیا از حذف دائمی این پرسنل اطمینان دارید؟ تمامی سوابق حضور و غیاب وی پاک خواهند شد.')) {
      await db.workers.delete(worker.id);
      await db.attendanceLogs.where('workerId').equals(worker.id).delete();
      deleteWorkerLive(worker.id).catch(console.error);
    }
  };

  // Empty Trash for workers
  const handleEmptyWorkersTrash = async () => {
    if (trashWorkersList.length === 0) return;
    if (window.confirm(t('confirmEmptyTrash') || 'آیا از خالی کردن سطل آشغال و حذف قطعی تمام موارد اطمینان دارید؟')) {
      for (const w of trashWorkersList) {
        await db.workers.delete(w.id);
        await db.attendanceLogs.where('workerId').equals(w.id).delete();
        deleteWorkerLive(w.id).catch(console.error);
      }
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Bar: Title, Status Tabs, and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-500" />
            <span>{t('workers')}</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {statusTab === 'active' && `${t('activeWorkersTab') || 'پرسنل فعال'}: ${activeWorkersList.length}`}
            {statusTab === 'archived' && `${t('archived') || 'بایگانی‌شده'}: ${archivedWorkersList.length}`}
            {statusTab === 'trash' && `${t('trash') || 'سطل آشغال'}: ${trashWorkersList.length}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Status Tabs: Active | Archived | Trash */}
          {/* Main Status Tabs: Active | Archived | Trash (Navbar Style) */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/60 p-1.5 sm:p-2 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
            {(() => {
              const TABS = [
                { id: 'active', icon: Users, label: t('activeWorkersTab') || 'پرسنل فعال' },
                { id: 'archived', icon: Archive, label: t('archived') || 'بایگانی' },
                { id: 'trash', icon: Trash2, label: t('trash') || 'سطل آشغال' }
              ];
              
              return TABS.map((tab) => {
                const isActive = statusTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
                    className={`relative p-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 scale-105 font-bold border border-sky-400/30'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className="w-5 h-5 transition-transform hover:scale-110" />
                    {isActive && (
                      <span className="text-xs font-semibold px-1 whitespace-nowrap animate-fade-in">
                        {tab.label}
                      </span>
                    )}
                  </button>
                );
              });
            })()}
          </div>

          {/* Action Button: Add Group */}
          <button
            type="button"
            onClick={() => setIsAddGroupModalOpen(true)}
            aria-label="افزودن گروه"
            title="افزودن گروه کاری جدید"
            className="p-2.5 sm:p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-md shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center border border-indigo-500/30 cursor-pointer group"
          >
            <Users className="w-5.5 h-5.5 transition-transform group-hover:scale-110" />
          </button>

          {/* Action Button: Add Worker (always visible) */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            aria-label={t('addNewWorker')}
            title={t('addNewWorker')}
            className="p-2.5 sm:p-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl shadow-md shadow-sky-600/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center border border-sky-500/30 cursor-pointer group"
          >
            <UserPlus className="w-5.5 h-5.5 transition-transform group-hover:scale-110" />
          </button>

          {statusTab === 'trash' && trashWorkersList.length > 0 && (
            <button
              type="button"
              onClick={handleEmptyWorkersTrash}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 rounded-2xl text-xs font-bold border border-rose-200 dark:border-rose-800 shadow-xs transition-colors"
              title={t('emptyTrash')}
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('emptyTrash') || 'خالی کردن سطل آشغال'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-5 h-5 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchWorkerPlaceholder')}
            className="w-full ps-10 pe-4 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
          />
        </div>

        {/* Section Filter Dropdown (in active & archived) */}
        {statusTab !== 'trash' && projectSections.length > 0 && (
          <div className="relative w-full sm:w-56">
            <Layers className="w-4 h-4 text-sky-500 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="w-full ps-9 pe-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="all">{t('allSections') || 'همه بخش‌ها'}</option>
              {projectSections.map((sec) => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
              <option value="unassigned">{t('noSection') || 'بدون بخش (عمومی)'}</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end flex-wrap">
          {/* Active/Inactive Subfilter (Only in Active Tab) */}
          {statusTab === 'active' && (
            <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
              {[
                { id: 'all', label: t('allWorkers') || 'همه', count: activeWorkersList.length, icon: Users },
                { id: 'active', label: t('active') || 'فعال', count: activeWorkersList.filter(w => w.isActive === 1).length, icon: UserCheck },
                { id: 'inactive', label: t('inactive') || 'غیرفعال', count: activeWorkersList.filter(w => w.isActive === 0).length, icon: UserX },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = filterActive === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterActive(tab.id)}
                    aria-label={`${tab.label} (${tab.count})`}
                    title={`${tab.label} (${tab.count})`}
                    className={`relative flex items-center gap-2 rounded-xl transition-all duration-200 ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 font-bold py-2 px-3'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60 p-2'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {isSelected && (
                      <span className="text-xs font-semibold whitespace-nowrap animate-fade-in flex items-center gap-1.5">
                        <span>{tab.label}</span>
                        <span className="text-[10px] bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded-full font-mono">
                          {tab.count}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Grid vs List View Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
            <button
              type="button"
              onClick={() => handleSetLayoutMode('grid')}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                layoutMode === 'grid'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60'
              }`}
              title={t('gridView') || 'کارت‌ها'}
              aria-label={t('gridView') || 'کارت‌ها'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetLayoutMode('list')}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                layoutMode === 'list'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60'
              }`}
              title={t('listView') || 'فهرست'}
              aria-label={t('listView') || 'فهرست'}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Workers View: Grid Mode vs List Mode */}
      {layoutMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupedWorkers.map((group) => (
            <React.Fragment key={group.id}>
              <div className="col-span-full mt-4 flex items-center gap-2">
                 <div className="font-bold text-lg text-slate-800 dark:text-slate-200">{group.name}</div>
                 <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
              </div>
              {group.workers.map((worker) => (
            <div
              key={worker.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                worker.isActive === 1
                  ? 'border-slate-200 dark:border-slate-800'
                  : 'border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10'
              }`}
            >
              <div>
                {/* Header: Name & Icon-Only Actions (No Wrapping!) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 
                      onClick={() => setQuickAttendanceWorker(worker)}
                      className="font-bold text-base sm:text-lg text-slate-900 dark:text-white cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors truncate"
                      title={t('quickMonthlyAttendance')}
                    >
                      {worker.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <span>{worker.role || t('workerRole')}</span>
                      </div>
                      {worker.defaultSectionId && sectionMap[worker.defaultSectionId] && (
                        <span 
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-lg border border-sky-200/60 dark:border-sky-800/60"
                          title={t('defaultSection')}
                        >
                          <Layers className="w-3 h-3 text-sky-500 flex-shrink-0" />
                          <span className="truncate max-w-[120px]">{sectionMap[worker.defaultSectionId]?.name}</span>
                        </span>
                      )}
                      {(workerCreds[worker.id]?.username || worker.username) && (
                        <span 
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-800/60"
                          title="مشخصات ورود پرتال کارگر فعال است"
                        >
                          <Key className="w-3 h-3" />
                          <span>{workerCreds[worker.id]?.username || worker.username}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean Icon-Only Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {statusTab === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setQuickAttendanceWorker(worker)}
                          title={t('quickMonthlyAttendance')}
                          aria-label={t('quickMonthlyAttendance')}
                          className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200/60 dark:border-sky-800/60 transition-colors"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(worker)}
                          className={`p-2 rounded-xl border transition-colors ${
                            worker.isActive === 1
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                          }`}
                          title={worker.isActive === 1 ? t('deactivate') : t('activate')}
                          aria-label={worker.isActive === 1 ? t('deactivate') : t('activate')}
                        >
                          {worker.isActive === 1 ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    )}
                    {statusTab === 'archived' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                        <Archive className="w-3 h-3" />
                        <span>{t('archived')}</span>
                      </span>
                    )}
                    {statusTab === 'trash' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                        <Trash2 className="w-3 h-3" />
                        <span>{t('trash')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Phone number */}
                {worker.phone && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-sky-500" />
                    <span dir="ltr">{worker.phone}</span>
                  </div>
                )}

                {/* Wage Rates Breakdown (Clean, Non-Redundant Currency) */}
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-sky-500" />
                      <span>{t('dailyRateLabel')}:</span>
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {formatCurrency(worker.dailyRate, currency, language)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t('overtimeRateLabel')}:</span>
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {formatCurrency(worker.overtimeHourlyRate, currency, language)} / hr
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Action Buttons */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                {statusTab === 'active' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setHistoryWorker(worker)}
                      className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 font-medium py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>{t('history')}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(worker)}
                        className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={t('edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveWorker(worker)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                        title={t('archive') || 'بایگانی پرسنل'}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveToTrash(worker)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title={t('moveToTrash') || 'انتقال به سطل آشغال'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}

                {statusTab === 'archived' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setHistoryWorker(worker)}
                      className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 font-medium py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>{t('history')}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUnarchiveWorker(worker)}
                        className="flex items-center gap-1 px-2.5 py-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg font-bold text-[11px] transition-colors"
                        title={t('unarchive') || 'خروج از بایگانی'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{t('unarchive') || 'خروج از بایگانی'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveToTrash(worker)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title={t('moveToTrash') || 'انتقال به سطل آشغال'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}

                {statusTab === 'trash' && (
                  <>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {worker.deletedAt ? String(worker.deletedAt).substring(0, 10) : ''}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRestoreWorker(worker)}
                        className="flex items-center gap-1 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg font-bold text-[11px] transition-colors"
                        title={t('restore') || 'بازیابی'}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('restore') || 'بازیابی'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDeleteWorker(worker)}
                        className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg transition-colors"
                        title={t('permanentDelete') || 'حذف دائمی'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
            </React.Fragment>
          ))}
        </div>
      ) : (
        /* List Mode: High-Density Minimal Table */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                <tr>
                  <th className="py-3 px-3 text-center w-12">{t('status')}</th>
                  <th className="py-3 px-3.5">{t('fullName')}</th>
                  <th className="py-3 px-3.5">{t('workerRole')}</th>
                  <th className="py-3 px-3.5">{t('section') || 'بخش'}</th>
                  <th className="py-3 px-3.5">{t('phoneNumber')}</th>
                  <th className="py-3 px-3.5">{t('dailyRateLabel')}</th>
                  <th className="py-3 px-3.5">{t('overtimeRateLabel')}</th>
                  <th className="py-3 px-3.5 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {groupedWorkers.map((group) => (
                  <React.Fragment key={group.id}>
                    <tr>
                      <td colSpan="8" className="bg-slate-100 dark:bg-slate-800/50 py-2 px-4 font-bold text-slate-700 dark:text-slate-300">
                        {group.name}
                      </td>
                    </tr>
                    {group.workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                    <td className="py-2.5 px-3 text-center">
                      <span 
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          worker.deletedAt
                            ? 'bg-rose-500 ring-4 ring-rose-500/20'
                            : worker.isArchived || worker.status === 'archived'
                            ? 'bg-amber-500 ring-4 ring-amber-500/20'
                            : worker.isActive === 1
                            ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        title={
                          worker.deletedAt
                            ? t('trash')
                            : worker.isArchived
                            ? t('archived')
                            : worker.isActive === 1
                            ? t('active')
                            : t('inactive')
                        }
                      />
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                      <span 
                        className="cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                        onClick={() => statusTab === 'active' && setQuickAttendanceWorker(worker)}
                      >
                        {worker.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400">
                      {worker.role || '-'}
                    </td>
                    <td className="py-2.5 px-3.5">
                      {worker.defaultSectionId && sectionMap[worker.defaultSectionId] ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-lg border border-sky-200/60 dark:border-sky-800/60">
                          <Layers className="w-3 h-3 text-sky-500 flex-shrink-0" />
                          <span>{sectionMap[worker.defaultSectionId].name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
                      {worker.phone || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold font-mono text-slate-800 dark:text-slate-200">
                      {formatCurrency(worker.dailyRate, currency, language)}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium font-mono text-slate-700 dark:text-slate-300">
                      {formatCurrency(worker.overtimeHourlyRate, currency, language)} / hr
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {statusTab === 'active' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setQuickAttendanceWorker(worker)}
                              title={t('quickMonthlyAttendance')}
                              className="p-1.5 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/60 rounded-lg transition-colors"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryWorker(worker)}
                              title={t('history')}
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(worker)}
                              title={t('edit')}
                              className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchiveWorker(worker)}
                              title={t('archive')}
                              className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveToTrash(worker)}
                              title={t('moveToTrash')}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {statusTab === 'archived' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setHistoryWorker(worker)}
                              title={t('history')}
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnarchiveWorker(worker)}
                              title={t('unarchive')}
                              className="flex items-center gap-1 px-2 py-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>{t('unarchive')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveToTrash(worker)}
                              title={t('moveToTrash')}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {statusTab === 'trash' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRestoreWorker(worker)}
                              title={t('restore')}
                              className="flex items-center gap-1 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{t('restore')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePermanentDeleteWorker(worker)}
                              title={t('permanentDelete')}
                              className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredWorkers.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
          {statusTab === 'trash' ? (
            <>
              <Trash2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-700 dark:text-slate-300 text-sm font-bold">
                {t('emptyTrashDesc') || 'سطل آشغال در حال حاضر خالی است.'}
              </p>
            </>
          ) : statusTab === 'archived' ? (
            <>
              <Archive className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-700 dark:text-slate-300 text-sm font-bold">
                هیچ پرسنل بایگانی‌شده‌ای وجود ندارد.
              </p>
            </>
          ) : (
            <>
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                {t('noWorkerSelectedError')}
              </p>
            </>
          )}
        </div>
      )}

      {/* Add / Edit Worker Modal */}
      {isFormModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 print:p-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormModalOpen(false);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 max-w-md w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-y-auto p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-500" />
                <span>{editingWorker ? t('editWorker') : t('addNewWorker')}</span>
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveWorker} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('fullName')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ئاراس ئەحمەد / علی رضایی / Worker Name"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('roleOrTitle')}
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="وەستا / جوشکار / Master Craftsman"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('phoneNumber')}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0750 123 4567"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>گروه کاری</span>
                    <span className="text-[10px] text-slate-400 font-normal">(اختیاری)</span>
                  </label>
                  <select
                    value={formData.groupId || ''}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">بدون گروه</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>نقش در گروه</span>
                  </label>
                  <select
                    value={formData.teamRole || 'Worker'}
                    onChange={(e) => setFormData({ ...formData, teamRole: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="Worker">کارگر (عادی)</option>
                    <option value="Master">استادکار (سرپرست)</option>
                  </select>
                </div>
              </div>

              {projectSections.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-500" />
                      <span>{t('defaultSection') || 'بخش پیش‌فرض کاری'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">({t('optional') || 'اختیاری'})</span>
                  </label>
                  <select
                    value={formData.defaultSectionId || ''}
                    onChange={(e) => setFormData({ ...formData, defaultSectionId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">{t('noSection') || 'بدون بخش (عمومی)'}</option>
                    {projectSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {t('defaultSectionHint') || 'این بخش در ثبت روزانه به صورت خودکار برای پرسنل لود می‌شود اما برای هر روز قابل تغییر است.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('dailyRateLabel')} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={formData.dailyRate}
                    onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('overtimeRateLabel')} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={formData.overtimeHourlyRate}
                    onChange={(e) => setFormData({ ...formData, overtimeHourlyRate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Worker Portal Login Credentials Section */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('workerLoginCredentials')}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t('username')}
                    </label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="e.g. feryad"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t('password')}
                    </label>
                    <input
                      type="text"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="e.g. 1234"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-xl shadow-md shadow-sky-600/20 transition-colors"
                >
                  {t('saveWorker')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Month Attendance Modal (Mini Calendar for fast entry) */}
      <QuickMonthAttendanceModal
        worker={quickAttendanceWorker}
        isOpen={!!quickAttendanceWorker}
        onClose={() => setQuickAttendanceWorker(null)}
      />

      {/* Worker Attendance History Modal */}
      <WorkerFinancialProfileModal
        worker={historyWorker}
        logs={workerHistoryLogs}
        payments={workerPayments}
        currency={currency}
        onClose={() => setHistoryWorker(null)}
        onEditLog={setEditingLog}
      />

      {/* Dedicated Edit Record Modal */}
      <EditRecordModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
      />

      {/* Add Group Modal */}
      {isAddGroupModalOpen && (
        <AddGroupModal 
          onClose={() => setIsAddGroupModalOpen(false)} 
          targetProjectId={targetProjectId}
        />
      )}

    </div>
  );
}

function AddGroupModal({ onClose, targetProjectId }) {
  const [name, setName] = useState('');
  const [deductFood, setDeductFood] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await db.groups.add({
      id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      projectId: targetProjectId,
      name: name.trim(),
      deductFoodExpense: deductFood,
      createdAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 max-w-sm w-full rounded-3xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">افزودن گروه کاری</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام گروه</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white" placeholder="مثلا: سنگ‌کاری"/>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="deductFood" checked={deductFood} onChange={e => setDeductFood(e.target.checked)} className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"/>
            <label htmlFor="deductFood" className="text-xs font-bold text-slate-700 dark:text-slate-300">کسر خودکار هزینه خوراک (پیش‌فرض)</label>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-colors">ثبت</button>
            <button type="button" onClick={onClose} className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-bold transition-colors">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}
