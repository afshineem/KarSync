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
import { 
  Users, 
  UserPlus, 
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
  List
} from 'lucide-react';

export function WorkersView() {
  const { t, language } = useLanguage();
  const { user, setWorkerCredentials, getWorkerCredentialsMap } = useAuth();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const workerCreds = getWorkerCredentialsMap();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'
  
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('workshop_workers_view_mode') || 'grid';
  });
  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('workshop_workers_view_mode', mode);
  };
  
  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
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
    dailyRate: '',
    overtimeHourlyRate: '',
    isActive: 1
  });
  const [formError, setFormError] = useState('');

  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // Live query from Dexie scoped to active project with fallback for legacy records
  const workers = useLiveQuery(
    async () => {
      const list = await db.workers.toArray();
      return list.filter((w) => (w.projectId || DEFAULT_PROJECT_ID) === targetProjectId);
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

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return (workers || []).filter((w) => {
      if (!w) return false;
      const wName = (w.name || '').toLowerCase();
      const s = (searchTerm || '').toLowerCase();
      const matchSearch = 
        wName.includes(s) ||
        (w.role && w.role.toLowerCase().includes(s)) ||
        (w.phone && String(w.phone).includes(searchTerm));
      
      if (!matchSearch) return false;

      if (filterActive === 'active') return w.isActive === 1;
      if (filterActive === 'inactive') return w.isActive === 0;
      return true;
    });
  }, [workers, searchTerm, filterActive]);

  // Open modal to add worker
  const handleOpenAddModal = () => {
    setEditingWorker(null);
    setFormData({
      name: '',
      phone: '',
      role: '',
      dailyRate: '35000',
      overtimeHourlyRate: '5000',
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
      dailyRate: String(worker.dailyRate),
      overtimeHourlyRate: String(worker.overtimeHourlyRate),
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
          dailyRate: dailyRate,
          overtimeHourlyRate: overtimeRate,
          isActive: Number(formData.isActive),
          username: (formData.username || '').trim(),
          password: (formData.password || '').trim(),
          updatedAt: new Date().toISOString()
        };
        await db.workers.update(editingWorker.id, updatedWorker);
        pushWorkerLive(updatedWorker).catch(console.error);
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
          dailyRate: dailyRate,
          overtimeHourlyRate: overtimeRate,
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

  // Delete worker permanently
  const handleDeleteWorker = async (worker) => {
    if (window.confirm(t('confirmDelete'))) {
      await db.workers.delete(worker.id);
      await db.attendanceLogs.where('workerId').equals(worker.id).delete();
      deleteWorkerLive(worker.id).catch(console.error);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Bar: Title, Search, and Add Worker Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-500" />
            <span>{t('workers')}</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('workerList')} ({workers.length})
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm rounded-xl shadow-md shadow-sky-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t('addNewWorker')}</span>
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchWorkerPlaceholder')}
            className="w-full ps-10 pe-4 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end flex-wrap">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setFilterActive('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterActive === 'all'
                  ? 'bg-slate-800 text-white dark:bg-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {t('allWorkers')} ({workers.length})
            </button>
            <button
              onClick={() => setFilterActive('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterActive === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {t('active')} ({workers.filter(w => w.isActive === 1).length})
            </button>
            <button
              onClick={() => setFilterActive('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterActive === 'inactive'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {t('inactive')} ({workers.filter(w => w.isActive === 0).length})
            </button>
          </div>

          {/* Grid vs List View Switcher */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title={t('gridView') || 'کارت‌ها'}
              aria-label={t('gridView') || 'کارت‌ها'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
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
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map((worker) => (
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
                    onClick={() => handleDeleteWorker(worker)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title={t('delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
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
                  <th className="py-3 px-3.5">{t('phoneNumber')}</th>
                  <th className="py-3 px-3.5">{t('dailyRateLabel')}</th>
                  <th className="py-3 px-3.5">{t('overtimeRateLabel')}</th>
                  <th className="py-3 px-3.5 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                    <td className="py-2.5 px-3 text-center">
                      <span 
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          worker.isActive === 1 ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        title={worker.isActive === 1 ? t('active') : t('inactive')}
                      />
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                      <span 
                        className="cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                        onClick={() => setQuickAttendanceWorker(worker)}
                      >
                        {worker.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400">
                      {worker.role || '-'}
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
                          onClick={() => handleToggleActive(worker)}
                          title={worker.isActive === 1 ? t('deactivate') : t('activate')}
                          className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                        >
                          {worker.isActive === 1 ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWorker(worker)}
                          title={t('delete')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredWorkers.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            {t('noWorkerSelectedError')}
          </p>
        </div>
      )}

      {/* Add / Edit Worker Modal */}
      {isFormModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormModalOpen(false);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
      {historyWorker && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryWorker(null);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-500" />
                  <span>{t('history')} - {historyWorker.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {historyWorker.role} • {formatCurrency(historyWorker.dailyRate, currency, language)} / day
                </p>
              </div>
              <button
                onClick={() => setHistoryWorker(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs: Attendance Logs vs Payments History */}
            <div className="flex items-center gap-2 mt-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setHistoryTab('logs')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  historyTab === 'logs'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{t('calendarLogs')} ({workerHistoryLogs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('payments')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  historyTab === 'payments'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{t('paymentHistory')} ({workerPayments.length})</span>
              </button>
            </div>

            {/* Scrollable history logs list */}
            <div className="overflow-y-auto flex-1 mt-3 space-y-2 pe-1">
              {historyTab === 'logs' ? (
                workerHistoryLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    {t('noDataForMonth')}
                  </div>
                ) : (
                  workerHistoryLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{log.date}</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            log.type === 'hourly'
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400'
                              : log.type === 'half'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400'
                              : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {log.type === 'hourly' ? t('hourlyOnlyOption') : log.type === 'half' ? t('halfDayOption') : t('fullDayOption')}
                          </span>
                          {log.overtimeHours > 0 && (
                            <span className="bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded text-[11px] font-medium">
                              {log.type === 'hourly' ? '' : '+'}{formatHoursAndMinutes(log.overtimeHours, language)}
                            </span>
                          )}
                        </div>
                        {log.notes && (
                          <p className="text-slate-500 dark:text-slate-400 mt-1">
                            {log.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-end font-bold text-sky-600 dark:text-sky-400 text-sm">
                          {formatCurrency(log.totalDayPay, currency, language)}
                        </div>
                        <button
                          onClick={() => setEditingLog(log)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors"
                          title={t('edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : (
                workerPayments.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    {t('noPaymentsRecorded')}
                  </div>
                ) : (
                  workerPayments.map((p) => {
                    const paymentTime = p.time || (p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
                    return (
                      <div
                        key={p.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="font-mono">{p.date}</span>
                            {paymentTime && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                {paymentTime}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.type === 'settlement'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400'
                            }`}>
                              {p.type === 'settlement' ? t('settlementType') : t('advanceType')}
                            </span>
                          </div>
                          {(p.notes || p.referenceNumber) && (
                            <p className="text-slate-500 dark:text-slate-400 mt-1">
                              {p.notes} {p.referenceNumber ? `(#${p.referenceNumber})` : ''}
                            </p>
                          )}
                        </div>
                        <div className="text-end font-extrabold text-slate-900 dark:text-white text-sm font-mono">
                          {formatCurrency(p.amount, currency, language)}
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setHistoryWorker(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
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

    </div>
  );
}
