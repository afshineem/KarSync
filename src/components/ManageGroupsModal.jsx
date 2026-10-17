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
  Utensils, 
  Search,
  CreditCard,
  CalendarCheck,
  FolderTree
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

  // بستن مدال با دکمه Escape
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

  // کوئری‌های زنده از دیتابیس
  const allDbGroups = useLiveQuery(() => db.groups.toArray()) || [];
  const allDbWorkers = useLiveQuery(() => db.workers.toArray()) || [];
  const allDbPayments = useLiveQuery(() => db.payments.toArray()) || [];
  const allDbLogs = useLiveQuery(() => db.attendanceLogs.toArray()) || [];

  // محاسبه آمار هر گروه، وضعیت مالی و حفاظت داده
  const groupStats = useMemo(() => {
    const stats = {};
    allDbGroups.forEach((g) => {
      const members = allDbWorkers.filter((w) => !w.deletedAt && String(w.groupId) === String(g.id));
      const master = members.find((w) => w.teamRole === 'Master' || (w.role || '').toLowerCase().includes('سرپرست') || (w.role || '').toLowerCase().includes('استادکار'));
      
      const memberIds = new Set(allDbWorkers.filter((w) => String(w.groupId) === String(g.id)).map((w) => String(w.id)));
      
      const payments = allDbPayments.filter((p) => !p.deletedAt && (String(p.groupId) === String(g.id) || memberIds.has(String(p.workerId))));
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

  // فیلتر و مرتب‌سازی گروه‌ها
  const filteredGroups = useMemo(() => {
    let list = allDbGroups.filter((g) => !g.deletedAt && g.status !== 'deleted');

    if (activeTab === 'active') {
      list = list.filter((g) => !g.isArchived && g.status !== 'archived');
    } else if (activeTab === 'archived') {
      list = list.filter((g) => g.isArchived || g.status === 'archived');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => (g.name || '').toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      const aArchived = a.isArchived || a.status === 'archived';
      const bArchived = b.isArchived || b.status === 'archived';
      if (!aArchived && bArchived) return -1;
      if (aArchived && !bArchived) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [allDbGroups, activeTab, searchQuery]);

  // ثبت گروه جدید
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

  // ویرایش گروه
  const handleStartEdit = (group) => {
    setEditingGroup(group);
    setEditGroupName(group.name || '');
    setEditGroupDescription(group.description || '');
    setEditDeductFood(!!group.deductFoodExpense);
  };

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

  // تغییر وضعیت آرشیو
  const handleToggleArchive = async (group) => {
    const isCurrentlyArchived = group.isArchived || group.status === 'archived';
    await archiveGroupLive(group.id, !isCurrentlyArchived);
  };

  // حذف گروه با رعایت امنیت اطلاعات
  const handleAttemptDelete = (group) => {
    const stats = groupStats[group.id];
    if (stats?.isProtected) {
      setAccessDeniedGroup(group);
    } else {
      setGroupToDelete(group);
    }
  };

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
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200" 
      dir={direction}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* دیالوگ شیشه‌ای پاپ‌آپ وسط صفحه */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#f3f6f4]/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ۱. هدر شیشه‌ای مدال */}
        <div className="px-5 sm:px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
              <FolderTree className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {language === 'ku' ? 'بەڕێوەبردنی گرووپەکانی کارگە' : 'مدیریت گروه‌های کاری'}
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {language === 'ku' 
                  ? 'سازماندانی تیمەکان، پیشەییبوون و ئەندامان' 
                  : 'سازماندهی تیم‌های تخصصی، سرپرست‌ها و سوابق اعضا'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            title="بستن (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ۲. نوار ابزار دستورات (فیلترهای تب و دکمه ثبت گروه) */}
        <div className="px-5 sm:px-6 py-3 bg-white/50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* تب‌های وضعیت با تم برنامه [APP_THEME_BUTTON] */}
          <div className="inline-flex items-center p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{language === 'ku' ? 'هەموو' : 'همه'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {allDbGroups.filter((g) => !g.deletedAt).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{language === 'ku' ? 'چالاکەکان' : 'فعال'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {allDbGroups.filter((g) => !g.deletedAt && !g.isArchived && g.status !== 'archived').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'archived'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{language === 'ku' ? 'ئەرشیڤ' : 'آرشیو شده'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeTab === 'archived' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {allDbGroups.filter((g) => !g.deletedAt && (g.isArchived || g.status === 'archived')).length}
              </span>
            </button>
          </div>

          {/* دکمه باز و بسته کردن فرم افزودن گروه جدید */}
          <button
            type="button"
            onClick={() => setIsAddingNew((prev) => !prev)}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
              isAddingNew
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                : 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20 hover:from-sky-600 hover:to-indigo-700'
            }`}
          >
            {isAddingNew ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>
              {isAddingNew 
                ? (language === 'ku' ? 'داخستنی فۆڕم' : 'انصراف') 
                : (language === 'ku' ? 'تۆمارکردنی گرووپی نوێ' : '+ ثبت گروه تازه')}
            </span>
          </button>

        </div>

        {/* ۳. محتوای اسکرول‌پذیر اصلی مدال */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* فرم شیشه‌ای بازشونده برای تعریف گروه جدید */}
          {isAddingNew && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-sky-300/60 dark:border-sky-800/60 shadow-lg shadow-sky-500/5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-black text-sm mb-3">
                <Plus className="w-4 h-4" />
                <span>{language === 'ku' ? 'تۆمارکردنی گرووپی کاری نوێ' : 'تعریف گروه کاری جدید'}</span>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ku' ? 'ناوی گرووپ' : 'نام گروه کاری'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={language === 'ku' ? 'وەک: کونکریت، لاشه به‌رد، ئاسنگەری...' : 'مثلاً: سنگ‌کاری، بتن‌ریزی، اسکلت فلزی، تاسیسات...'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ku' ? 'پوختەی ئەرک و کاری گرووپ' : 'شرح وظایف و حوزه مسئولیت'}
                  </label>
                  <textarea
                    rows="2"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    placeholder={language === 'ku' ? 'ڕوونکردنەوە دەربارەی بەرپرسیارێتی و کاری ئەم گرووپە...' : 'توضیحات و حوزه کاری این تیم در پروژه...'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all resize-none shadow-inner"
                  />
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                  <input
                    type="checkbox"
                    id="newDeductFood"
                    checked={newDeductFood}
                    onChange={(e) => setNewDeductFood(e.target.checked)}
                    className="w-4 h-4 rounded-lg text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
                  />
                  <label htmlFor="newDeductFood" className="text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                    {language === 'ku' ? 'لێبڕینی خودکاری خەرجی خواردن بۆ ئەندامان' : 'کسر خودکار هزینه خوراک برای اعضای این گروه'}
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newGroupName.trim()}
                    className="px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-500/20 cursor-pointer active:scale-95"
                  >
                    {isSubmitting ? '...' : (language === 'ku' ? 'تۆمارکردن' : 'ثبت گروه کاری')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* فیلد سرچ شیشه‌ای */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ku' ? 'گەڕان لەناو گرووپەکاندا...' : 'جستجو در نام گروه‌ها...'}
              className="w-full ps-9 pe-3.5 py-2.5 text-xs bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-slate-900 dark:text-white font-medium"
            />
          </div>

          {/* لیست کارت‌های گروه‌های کاری */}
          {filteredGroups.length === 0 ? (
            <div className="py-12 text-center rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {language === 'ku' ? 'هیچ گرووپێک نەدۆزرایەوە.' : 'هیچ گروهی در این وضعیت یافت نشد.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'ku' ? 'دەتوانیت گرووپی نوێ زیاد بکەیت.' : 'می‌توانید با دکمه «+ ثبت گروه تازه» گروه جدید ایجاد کنید.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((g) => {
                const stats = groupStats[g.id] || { memberCount: 0, activeCount: 0, archivedCount: 0, masterName: null };
                const isArchived = g.isArchived || g.status === 'archived';

                return (
                  <div
                    key={g.id}
                    className={`p-4 sm:p-5 rounded-3xl backdrop-blur-md border transition-all duration-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isArchived
                        ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40 opacity-80'
                        : 'bg-white/80 dark:bg-slate-900/80 border-white/80 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-800'
                    }`}
                  >
                    {/* اطلاعات گروه */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                          {g.name}
                        </span>
                        
                        {/* برچسب وضعیت */}
                        {isArchived ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                            <Archive className="w-3 h-3" />
                            <span>{language === 'ku' ? 'ئەرشیڤ' : 'بایگانی'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{language === 'ku' ? 'چالاک' : 'فعال'}</span>
                          </span>
                        )}

                        {g.deductFoodExpense && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                            <Utensils className="w-3 h-3 text-slate-400" />
                            <span>{language === 'ku' ? 'خواردن' : 'کسر خوراک'}</span>
                          </span>
                        )}

                        {stats.isProtected && (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60"
                            title={language === 'ku' ? 'خاوەنی تۆماری دارایی یان کارکردە - پارێزراوە' : 'دارای سوابق مالی، کارکرد یا عضو - حفاظت‌شده'}
                          >
                            <ShieldCheck className="w-3 h-3 text-sky-500" />
                            <span>{language === 'ku' ? 'پارێزراو' : 'دارای سابقه'}</span>
                          </span>
                        )}
                      </div>

                      {/* اطلاعات اعضا، استادکار و تراکنش‌ها */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-sky-500" />
                          <span className="font-bold">
                            {stats.memberCount} {language === 'ku' ? 'کرێکار' : 'نفر پرسنل'}
                            {stats.archivedCount > 0 ? ` (${stats.activeCount} فعال، ${stats.archivedCount} بایگانی)` : ''}
                          </span>
                        </span>

                        {stats.paymentCount > 0 && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{stats.paymentCount} تراکنش مالی</span>
                          </span>
                        )}

                        {stats.logCount > 0 && (
                          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            <span>{stats.logCount} ثبت کارکرد</span>
                          </span>
                        )}

                        {stats.masterName && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{language === 'ku' ? 'وەستا:' : 'استادکار:'} {stats.masterName}</span>
                          </span>
                        )}
                      </div>

                      {/* توضیحات گروه */}
                      {g.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 pt-0.5">
                          {g.description}
                        </p>
                      )}
                    </div>

                    {/* دکمه‌های عملیات */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* ویرایش */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(g)}
                        title={language === 'ku' ? 'دەستکاریکردنی گرووپ' : 'ویرایش گروه'}
                        className="p-2 rounded-xl text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* آرشیو / خروج از آرشیو */}
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(g)}
                        title={isArchived ? (language === 'ku' ? 'چالاککردنەوە' : 'خروج از آرشیو') : (language === 'ku' ? 'ئەرشیڤکردن' : 'آرشیو کردن')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                          isArchived
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{isArchived ? (language === 'ku' ? 'چالاککردن' : 'فعال‌سازی') : (language === 'ku' ? 'ئەرشیڤ' : 'آرشیو')}</span>
                      </button>

                      {/* حذف یا قفل حفاظت داده */}
                      <button
                        type="button"
                        onClick={() => handleAttemptDelete(g)}
                        title={
                          stats.isProtected
                            ? (language === 'ku' ? 'پارێزراوە: خاوەنی سوابقی کارکرد یان داراییە' : 'دارای سوابق فعال - قفل محافظت از داده')
                            : (language === 'ku' ? 'سڕینەوەی گرووپ' : 'حذف گروه')
                        }
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          stats.isProtected
                            ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60'
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

        {/* ۴. فوتر شیشه‌ای مدال */}
        <div className="px-5 sm:px-6 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 hidden sm:inline">
            {language === 'ku' ? 'کلیلی' : 'کلید'} <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-mono">Esc</kbd> {language === 'ku' ? 'بۆ داخستن' : 'برای بستن پنجره'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ms-auto w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer active:scale-95"
          >
            {language === 'ku' ? 'داخستن' : 'بستن پنجره'}
          </button>
        </div>

      </div>

      {/* مودال فرعی تایید حذف */}
      {groupToDelete && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/60 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800/80">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {language === 'ku' ? 'سڕینەوەی گرووپ؟' : 'آیا از حذف این گروه مطمئن هستید؟'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ku'
                  ? `گرووپی «${groupToDelete.name}» بە تەواوی لە سیستەم و هەموو ئامێرەکان دەسڕدرێتەوە.`
                  : `گروه «${groupToDelete.name}» به طور کامل از سیستم حذف خواهد شد.`}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={confirmDeleteGroup}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 transition-all cursor-pointer"
              >
                {language === 'ku' ? 'بەڵێ، بسڕەوە' : 'بله، حذف کن'}
              </button>
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'ku' ? 'پاشگەزبوونەوە' : 'انصراف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال فرعی خطای عدم دسترسی و حفاظت از داده */}
      {accessDeniedGroup && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-rose-200/80 dark:border-rose-900/60 space-y-4 animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  {language === 'ku' ? 'هەڵەی دەستڕاگەیشتن' : 'حفاظت از یکپارچگی داده'}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {language === 'ku' ? 'ئەم گرووپە ناپێکرێت بسڕدرێتەوە' : 'این گروه غیرقابل حذف است'}
                </h3>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {language === 'ku'
                ? `گرووپی «${accessDeniedGroup.name}» بەهۆی هەبوونی تۆماری کارکرد و دارایی، بۆ پاراستنی داتاکان ناتوانرێت بسڕدرێتەوە.`
                : `گروه «${accessDeniedGroup.name}» به دلیل داشتن سوابق ثبت‌شده در سیستم، جهت حفظ یکپارچگی محاسبات مالی و کارکرد پرسنل قابل حذف قطعی نیست.`}
            </p>

            {/* کارت تفکیک سوابق */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                {language === 'ku' ? 'سوابقی پەیوەست بەم گرووپە:' : 'سوابق ثبت‌شده این گروه در سیستم:'}
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                  <Users className="w-4 h-4 mx-auto mb-1 text-sky-500" />
                  <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {groupStats[accessDeniedGroup.id]?.memberCount || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {language === 'ku' ? 'ئەندام' : 'عضو (نیرو)'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                  <CreditCard className="w-4 h-4 mx-auto mb-1 text-emerald-500" />
                  <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {groupStats[accessDeniedGroup.id]?.paymentCount || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {language === 'ku' ? 'مامەڵە' : 'تراکنش مالی'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                  <CalendarCheck className="w-4 h-4 mx-auto mb-1 text-indigo-500" />
                  <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {groupStats[accessDeniedGroup.id]?.logCount || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {language === 'ku' ? 'تۆمار' : 'ثبت کارکرد'}
                  </div>
                </div>
              </div>
            </div>

            {/* باکس راهنمای بایگانی */}
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="leading-relaxed">
                {language === 'ku'
                  ? 'دەتوانیت گرووپەکە «ئەرشیڤ» بکەیت بۆ ئەوەی لە فۆڕم و مینیۆکاندا دیار نەمێنێت بەڵام حیساباتەکەی پارێزراو بێت.'
                  : 'می‌توانید به جای حذف، گروه را «آرشیو» نمایید تا از لیست‌های فعال پنهان شود ولی کلیه سوابق مالی و گزارش‌ها به طور کامل حفظ شوند.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {!(accessDeniedGroup.isArchived || accessDeniedGroup.status === 'archived') && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleArchive(accessDeniedGroup);
                    setAccessDeniedGroup(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>{language === 'ku' ? 'ئەرشیڤکردنی ئەم گرووپە' : 'آرشیو کردن این گروه'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setAccessDeniedGroup(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'ku' ? 'تێگەیشتم / داخستن' : 'متوجه شدم'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* مودال فرعی ویرایش گروه */}
      {editingGroup && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-white/60 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {language === 'ku' ? 'دەستکاریکردنی گرووپ' : 'ویرایش مشخصات گروه کاری'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {language === 'ku' ? 'گۆڕینی ناو، پێناسە و ڕێکخستنەکان' : 'تغییر نام، شرح وظایف و تنظیمات کسر خوراک'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'ku' ? 'ناوی گرووپ' : 'نام گروه کاری'} <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white font-bold shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'ku' ? 'پوختەی ئەرک و کاری گرووپ' : 'شرح وظایف و حوزه مسئولیت'}
                </label>
                <textarea
                  rows="3"
                  value={editGroupDescription}
                  onChange={(e) => setEditGroupDescription(e.target.value)}
                  placeholder={language === 'ku' ? 'ڕوونکردنەوە دەربارەی بەرپرسیارێتی و کاری ئەم گرووپە...' : 'توضیحات و شرح وظایف این تیم...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white resize-none shadow-inner"
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <input
                  type="checkbox"
                  id="editDeductFood"
                  checked={editDeductFood}
                  onChange={(e) => setEditDeductFood(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
                />
                <label htmlFor="editDeductFood" className="text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                  {language === 'ku' ? 'لێبڕینی خودکاری خەرجی خواردن بۆ ئەندامان' : 'کسر خودکار هزینه خوراک برای اعضای این گروه'}
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={isSubmitting || !editGroupName.trim()}
                  className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-500/20 cursor-pointer active:scale-95"
                >
                  {isSubmitting ? '...' : (language === 'ku' ? 'پاشەکەوتکردنی گۆڕانکارییەکان' : 'ذخیره تغییرات')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
