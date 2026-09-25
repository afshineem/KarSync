import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  pushGroupLive, 
  deleteGroupLive, 
  archiveGroupLive, 
  pushWorkerMetadataLive 
} from '../services/realtimeSync';
import { 
  X, 
  Users, 
  Plus, 
  Trash2, 
  Archive, 
  Edit2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  ShieldAlert,
  Lock,
  Layers, 
  Utensils, 
  Check, 
  Sparkles,
  Search,
  CreditCard,
  CalendarCheck
} from 'lucide-react';

export function ManageGroupsModal({ onClose, targetProjectId }) {
  const { t, language, direction } = useLanguage();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'active' | 'archived'
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newDeductFood, setNewDeductFood] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editDeductFood, setEditDeductFood] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [accessDeniedGroup, setAccessDeniedGroup] = useState(null);

  // Escape key handler to close modal or sub-dialogs
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editingGroup) {
          setEditingGroup(null);
        } else if (groupToDelete) {
          setGroupToDelete(null);
        } else if (accessDeniedGroup) {
          setAccessDeniedGroup(null);
        } else if (isAddingNew) {
          setIsAddingNew(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingGroup, groupToDelete, accessDeniedGroup, isAddingNew, onClose]);

  // Live queries from Dexie
  const allDbGroups = useLiveQuery(() => db.groups.toArray()) || [];
  const allDbWorkers = useLiveQuery(() => db.workers.toArray()) || [];
  const allDbPayments = useLiveQuery(() => db.payments.toArray()) || [];
  const allDbLogs = useLiveQuery(() => db.attendanceLogs.toArray()) || [];

  // Group members count, financial records, logs count, and protection status
  const groupStats = useMemo(() => {
    const stats = {};
    allDbGroups.forEach((g) => {
      const members = allDbWorkers.filter((w) => !w.deletedAt && String(w.groupId) === String(g.id));
      const master = members.find((w) => w.teamRole === 'Master' || (w.role || '').toLowerCase().includes('سرپرست') || (w.role || '').toLowerCase().includes('استادکار'));
      
      const memberIds = new Set(allDbWorkers.filter((w) => String(w.groupId) === String(g.id)).map((w) => String(w.id)));
      
      // Payments linked to this group or its members
      const payments = allDbPayments.filter((p) => !p.deletedAt && (String(p.groupId) === String(g.id) || memberIds.has(String(p.workerId))));
      
      // Attendance logs linked to any members of this group
      const logs = allDbLogs.filter((l) => !l.deletedAt && memberIds.has(String(l.workerId)));

      const memberCount = members.length;
      const paymentCount = payments.length;
      const logCount = logs.length;
      const isProtected = memberCount > 0 || paymentCount > 0 || logCount > 0;

      stats[g.id] = {
        memberCount,
        activeCount: members.filter((w) => w.isActive === 1 && !w.isArchived).length,
        archivedCount: members.filter((w) => w.isArchived || w.status === 'archived').length,
        masterName: master ? master.name : null,
        paymentCount,
        logCount,
        isProtected
      };
    });
    return stats;
  }, [allDbGroups, allDbWorkers, allDbPayments, allDbLogs]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    let list = allDbGroups.filter((g) => !g.deletedAt && g.status !== 'deleted');

    // Tab filter
    if (activeTab === 'active') {
      list = list.filter((g) => !g.isArchived && g.status !== 'archived');
    } else if (activeTab === 'archived') {
      list = list.filter((g) => g.isArchived || g.status === 'archived');
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => (g.name || '').toLowerCase().includes(q));
    }

    // Sort: active before archived, then newest
    return list.sort((a, b) => {
      const aArchived = a.isArchived || a.status === 'archived';
      const bArchived = b.isArchived || b.status === 'archived';
      if (!aArchived && bArchived) return -1;
      if (aArchived && !bArchived) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [allDbGroups, activeTab, searchQuery]);

  // Create new group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newGroup = {
        id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        projectId: targetProjectId || DEFAULT_PROJECT_ID,
        name: newGroupName.trim(),
        description: (newGroupDescription || '').trim(),
        deductFoodExpense: newDeductFood,
        isArchived: false,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.groups.put(newGroup);
      await pushGroupLive(newGroup);

      setNewGroupName('');
      setNewGroupDescription('');
      setNewDeductFood(false);
      setIsAddingNew(false);
    } catch (err) {
      console.error('Error creating group:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal for group
  const handleStartEdit = (group) => {
    setEditingGroup(group);
    setEditGroupName(group.name || '');
    setEditGroupDescription(group.description || '');
    setEditDeductFood(!!group.deductFoodExpense);
  };

  // Save edited group
  const handleSaveEditGroup = async (e) => {
    e.preventDefault();
    if (!editingGroup || !editGroupName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const updatedGroup = {
        ...editingGroup,
        name: editGroupName.trim(),
        description: (editGroupDescription || '').trim(),
        deductFoodExpense: editDeductFood,
        updatedAt: new Date().toISOString()
      };

      await db.groups.put(updatedGroup);
      await pushGroupLive(updatedGroup);
      setEditingGroup(null);
    } catch (err) {
      console.error('Error updating group:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle archive status
  const handleToggleArchive = async (group) => {
    const isCurrentlyArchived = group.isArchived || group.status === 'archived';
    await archiveGroupLive(group.id, !isCurrentlyArchived);
  };

  // Attempt delete (verifies data protection)
  const handleAttemptDelete = (group) => {
    const stats = groupStats[group.id];
    if (stats?.isProtected) {
      setAccessDeniedGroup(group);
    } else {
      setGroupToDelete(group);
    }
  };

  // Delete group
  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    const stats = groupStats[groupToDelete.id];
    if (stats?.isProtected) {
      const g = groupToDelete;
      setGroupToDelete(null);
      setAccessDeniedGroup(g);
      return;
    }

    try {
      const targetId = groupToDelete.id;

      // Unassign any workers belonging to this group
      const assignedWorkers = allDbWorkers.filter((w) => String(w.groupId) === String(targetId));
      for (const w of assignedWorkers) {
        await db.workers.update(w.id, { groupId: null });
        pushWorkerMetadataLive(w.id, { groupId: null }).catch(() => {});
      }

      await deleteGroupLive(targetId);
      setGroupToDelete(null);
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-100 dark:bg-slate-950 flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden" 
      dir={direction}
    >
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {language === 'ku' ? 'بەڕێوەبردنی گرووپەکانی کارگە' : 'مدیریت گروه‌های کاری'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {language === 'ku' 
                  ? 'بینین، زیادکردن، ئەرشیڤکردن و سڕینەوەی گرووپەکان' 
                  : 'مشاهده لیست، ثبت گروه تازه، آرشیو و حذف گروه‌ها'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="بستن (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal Controls Bar */}
      <div className="bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 shrink-0">
        <div className="max-w-2xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Tab Filter Pills */}
          <div className="inline-flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold w-full sm:w-auto justify-center">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{language === 'ku' ? 'هەموو' : 'همه'}</span>
              <span className="ms-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800">
                {allDbGroups.filter((g) => !g.deletedAt).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{language === 'ku' ? 'چالاکەکان' : 'فعال'}</span>
              <span className="ms-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800">
                {allDbGroups.filter((g) => !g.deletedAt && !g.isArchived && g.status !== 'archived').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'archived'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{language === 'ku' ? 'ئەرشیڤ' : 'آرشیو شده'}</span>
              <span className="ms-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800">
                {allDbGroups.filter((g) => !g.deletedAt && (g.isArchived || g.status === 'archived')).length}
              </span>
            </button>
          </div>

          {/* Action: Open New Group Form */}
          <button
            type="button"
            onClick={() => setIsAddingNew((prev) => !prev)}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              isAddingNew
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
            }`}
          >
            {isAddingNew ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>
              {isAddingNew 
                ? (language === 'ku' ? 'داخستنی فۆڕم' : 'انصراف') 
                : (language === 'ku' ? 'تۆمارکردنی گرووپی نوێ' : 'ثبت گروه تازه')}
            </span>
          </button>

        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto w-full space-y-4">
          
          {/* Expandable New Group Form */}
          {isAddingNew && (
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-500" />
                <span>{language === 'ku' ? 'تۆمارکردنی گرووپی کاری نوێ' : 'ثبت گروه کاری جدید'}</span>
              </h3>

              <form onSubmit={handleCreateGroup} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ku' ? 'ناوی گرووپ' : 'نام گروه کاری'}
                  </label>
                  <input
                    required
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={language === 'ku' ? 'وەک: کونکریت، لاشه به‌رد، ئاسنگەری...' : 'مثلاً: سنگ‌کاری، کونکریت، اسکلت فلزی...'}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white shadow-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ku' ? 'پوختەی ئەرک و کاری گرووپ' : 'توضیحات / خلاصه وظایف گروه'}
                  </label>
                  <textarea
                    rows="2"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    placeholder={language === 'ku' ? 'ڕوونکردنەوە دەربارەی بەرپرسیارێتی و کاری ئەم گرووپە...' : 'خلاصه‌ای از وظایف محوله، مسئولیت‌ها یا حوزه کاری گروه...'}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white shadow-xs resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="newDeductFood"
                    checked={newDeductFood}
                    onChange={(e) => setNewDeductFood(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="newDeductFood" className="text-xs text-slate-600 dark:text-slate-400 font-semibold cursor-pointer">
                    {language === 'ku' ? 'لێبڕینی خودکاری خەرجی خواردن (پێشگریمانە)' : 'کسر خودکار هزینه خوراک برای اعضای گروه'}
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newGroupName.trim()}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                  >
                    {isSubmitting ? '...' : (language === 'ku' ? 'تۆمارکردن' : 'ثبت گروه')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    {language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ku' ? 'گەڕان لەناو گرووپەکاندا...' : 'جستجو در نام گروه‌ها...'}
              className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Groups List */}
          {filteredGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{language === 'ku' ? 'هیچ گرووپێک نەدۆزرایەوە.' : 'هیچ گروهی در این وضعیت یافت نشد.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredGroups.map((g) => {
                const stats = groupStats[g.id] || { memberCount: 0, activeCount: 0, archivedCount: 0, masterName: null };
                const isArchived = g.isArchived || g.status === 'archived';

                return (
                  <div
                    key={g.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isArchived
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40 opacity-80'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    {/* Left: Group Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          {g.name}
                        </span>
                        
                        {/* Status Badge */}
                        {isArchived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60">
                            <Archive className="w-3 h-3" />
                            <span>{language === 'ku' ? 'ئەرشیڤ' : 'آرشیو شده'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{language === 'ku' ? 'چالاک' : 'فعال'}</span>
                          </span>
                        )}

                        {g.deductFoodExpense && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            <Utensils className="w-3 h-3 text-slate-400" />
                            <span>{language === 'ku' ? 'خواردن' : 'کسر خوراک'}</span>
                          </span>
                        )}

                        {stats.isProtected && (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60"
                            title={language === 'ku' ? 'خاوەنی تۆماری دارایی یان کارکردە - ناپێکرێت بسڕدرێتەوە' : 'دارای سوابق مالی، حضور یا عضو - غیرقابل حذف'}
                          >
                            <ShieldAlert className="w-3 h-3 text-amber-500" />
                            <span>{language === 'ku' ? 'پارێزراو' : 'دارای سابقه (قفل)'}</span>
                          </span>
                        )}
                      </div>

                      {/* Sub-info: Master, Member count, and records */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-500" />
                          <span>
                            {stats.memberCount} {language === 'ku' ? 'کرێکار' : 'نیرو'}
                            {stats.archivedCount > 0 && ` (${stats.activeCount} فعال، ${stats.archivedCount} آرشیو)`}
                          </span>
                        </span>

                        {stats.paymentCount > 0 && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{stats.paymentCount} {language === 'ku' ? 'مامەڵەی دارایی' : 'تراکنش'}</span>
                          </span>
                        )}

                        {stats.logCount > 0 && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            <span>{stats.logCount} {language === 'ku' ? 'تۆماری کار' : 'ثبت کارکرد'}</span>
                          </span>
                        )}

                        {stats.masterName && (
                          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{language === 'ku' ? 'وەستا:' : 'استادکار:'} {stats.masterName}</span>
                          </span>
                        )}
                      </div>

                      {/* Description / Tasks summary */}
                      {g.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 pt-0.5 line-clamp-2">
                          {g.description}
                        </p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(g)}
                        title={language === 'ku' ? 'دەستکاریکردنی گرووپ' : 'ویرایش گروه'}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Archive / Unarchive Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(g)}
                        title={isArchived ? (language === 'ku' ? 'چالاککردنەوە' : 'خروج از آرشیو') : (language === 'ku' ? 'ئەرشیڤکردن' : 'آرشیو کردن')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          isArchived
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{isArchived ? (language === 'ku' ? 'چالاککردن' : 'فعال‌سازی') : (language === 'ku' ? 'ئەرشیڤ' : 'آرشیو')}</span>
                      </button>

                      {/* Delete Button / Lock Icon if Protected */}
                      <button
                        type="button"
                        onClick={() => handleAttemptDelete(g)}
                        title={
                          stats.isProtected
                            ? (language === 'ku' ? 'هەڵەی دەستڕاگەیشتن: گرووپەکە خاوەنی سوابقە و ناپێکرێت بسڕدرێتەوە' : 'غیرقابل حذف: گروه دارای اعضا، تراکنش‌های مالی یا سوابق کارکرد است')
                            : (language === 'ku' ? 'سڕینەوەی گرووپ' : 'حذف گروه')
                        }
                        className={`p-1.5 rounded-xl transition-colors ${
                          stats.isProtected
                            ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60'
                            : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60'
                        }`}
                      >
                        {stats.isProtected ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            {language === 'ku' ? 'کلیلی' : 'کلید'} <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono">Esc</kbd> {language === 'ku' ? 'بۆ داخستن' : 'برای بستن'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ms-auto w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            {language === 'ku' ? 'داخستن' : 'بستن'}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal Sub-dialog (Only for groups without data) */}
      {groupToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {language === 'ku' ? 'سڕینەوەی گرووپ؟' : 'آیا از حذف این گروه اطمینان دارید؟'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ku'
                  ? `گرووپی «${groupToDelete.name}» بە تەواوی لە سیستەم و هەموو ئامێرەکان دەسڕدرێتەوە.`
                  : `گروه «${groupToDelete.name}» به طور کامل از سیستم و سرور حذف خواهد شد.`}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={confirmDeleteGroup}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 transition-all"
              >
                {language === 'ku' ? 'بەڵێ، بسڕەوە' : 'بله، حذف کن'}
              </button>
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                {language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Denied Modal Sub-dialog (For groups with members, payments, or attendance logs) */}
      {accessDeniedGroup && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900/60 space-y-4">
            
            {/* Header / Error Badge */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  {language === 'ku' ? 'هەڵەی دەستڕاگەیشتن' : 'خطای عدم دسترسی'}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {language === 'ku' ? 'ئەم گرووپە ناپێکرێت بسڕدرێتەوە' : 'این گروه غیرقابل حذف است'}
                </h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {language === 'ku'
                ? `گرووپی «${accessDeniedGroup.name}» بەهۆی هەبوونی تۆماری کارکرد و دارایی لە سیستەمدا، بۆ پاراستنی حیساباتی دارایی و لەدەستنەچوونی داتاکان ناتوانرێت بسڕدرێتەوە.`
                : `گروه «${accessDeniedGroup.name}» به دلیل داشتن سوابق ثبت‌شده در سیستم، جهت حفظ یکپارچگی محاسبات مالی و کارکرد پرسنل قابل حذف نمی‌باشد.`}
            </p>

            {/* Data Stats Breakdown Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                {language === 'ku' ? 'سوابقی پەیوەست بەم گرووپە لە سیستەمدا:' : 'سوابق مرتبط با این گروه در سیستم:'}
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                  <Users className="w-4 h-4 mx-auto mb-1 text-indigo-500" />
                  <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {groupStats[accessDeniedGroup.id]?.memberCount || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {language === 'ku' ? 'ئەندام' : 'عضو (نیرو)'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                  <CreditCard className="w-4 h-4 mx-auto mb-1 text-emerald-500" />
                  <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {groupStats[accessDeniedGroup.id]?.paymentCount || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {language === 'ku' ? 'مامەڵە' : 'تراکنش مالی'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                  <CalendarCheck className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                  <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {groupStats[accessDeniedGroup.id]?.logCount || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {language === 'ku' ? 'تۆمار' : 'ثبت کارکرد'}
                  </div>
                </div>
              </div>
            </div>

            {/* Suggestion Box */}
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="leading-relaxed">
                {language === 'ku'
                  ? 'ڕێگەچارە: ئەگەر کارکردن لەگەڵ ئەم گرووپە کۆتایی پێهاتووە، دەتوانیت گرووپەکە «ئەرشیڤ» بکەیت بۆ ئەوەی لە فۆڕم و مینیۆکاندا دیار نەمێنێت بەڵام هەموو حیساباتەکەی پارێزراو بێت.'
                  : 'راهکار پیشنهادی: چنانچه فعالیت این گروه خاتمه یافته، می‌توانید آن را «آرشیو» کنید تا از لیست‌های فعال و فرم‌های ثبت حضور پنهان شود ولی کلیه اطلاعات مالی، سوابق و گزارش‌ها محفوظ بمانند.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {!(accessDeniedGroup.isArchived || accessDeniedGroup.status === 'archived') && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleArchive(accessDeniedGroup);
                    setAccessDeniedGroup(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/25 transition-all flex items-center justify-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  <span>{language === 'ku' ? 'ئەرشیڤکردنی ئەم گرووپە' : 'آرشیو کردن این گروه'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setAccessDeniedGroup(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                {language === 'ku' ? 'تێگەیشتم / داخستن' : 'متوجه شدم'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Group Modal Sub-dialog */}
      {editingGroup && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {language === 'ku' ? 'دەستکاریکردنی گرووپ' : 'ویرایش گروه کاری'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {language === 'ku' ? 'گۆڕینی ناو، پێناسە و ڕێکخستنەکانی گرووپ' : 'ویرایش نام، توضیحات وظایف و تنظیمات گروه'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'ku' ? 'ناوی گرووپ' : 'نام گروه کاری'}
                </label>
                <input
                  required
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-bold shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'ku' ? 'پوختەی ئەرک و کاری گرووپ' : 'توضیحات / خلاصه وظایف گروه'}
                </label>
                <textarea
                  rows="3"
                  value={editGroupDescription}
                  onChange={(e) => setEditGroupDescription(e.target.value)}
                  placeholder={language === 'ku' ? 'ڕوونکردنەوە دەربارەی بەرپرسیارێتی و کاری ئەم گرووپە...' : 'خلاصه‌ای از وظایف محوله، مسئولیت‌ها یا حوزه کاری گروه...'}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white resize-none shadow-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editDeductFood"
                  checked={editDeductFood}
                  onChange={(e) => setEditDeductFood(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="editDeductFood" className="text-xs text-slate-600 dark:text-slate-400 font-semibold cursor-pointer">
                  {language === 'ku' ? 'لێبڕینی خودکاری خەرجی خواردن (پێشگریمانە)' : 'کسر خودکار هزینه خوراک برای اعضای گروه'}
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={isSubmitting || !editGroupName.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                >
                  {isSubmitting ? '...' : (language === 'ku' ? 'پاشەکەوتکردنی گۆڕانکارییەکان' : 'ذخیره تغییرات')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  {language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
