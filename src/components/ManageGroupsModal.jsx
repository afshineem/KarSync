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

const GROUPS_COPY = {
  fa: {
    modalTitle: 'مدیریت گروه‌های کاری',
    modalSubtitle: 'ساماندهی تیم‌های تخصصی، سرپرست‌ها و سوابق اعضا',
    tabAll: 'همه',
    tabActive: 'فعال',
    tabArchived: 'آرشیو شده',
    closeFormBtn: 'انصراف',
    openNewGroupBtn: '+ ثبت گروه تازه',
    newGroupCardTitle: 'تعریف گروه کاری جدید',
    groupNameLabel: 'نام گروه کاری',
    groupNamePlaceholder: 'مثلاً: سنگ‌کاری، بتن‌ریزی، اسکلت فلزی، تاسیسات...',
    groupDescLabel: 'شرح وظایف و حوزه مسئولیت',
    groupDescPlaceholder: 'توضیحات و حوزه کاری این تیم در پروژه...',
    autoFoodDeductLabel: 'کسر خودکار هزینه خوراک برای اعضای این گروه',
    cancelBtn: 'انصراف',
    createGroupBtn: 'ثبت گروه کاری',
    searchPlaceholder: 'جستجو در نام گروه‌ها...',
    emptyStateTitle: 'هیچ گروهی در این وضعیت یافت نشد.',
    emptyStateDesc: 'می‌توانید با دکمه «+ ثبت گروه تازه» گروه جدید ایجاد کنید.',
    badgeArchived: 'بایگانی',
    badgeActive: 'فعال',
    badgeFoodDeduct: 'کسر خوراک',
    badgeProtectedTooltip: 'دارای سوابق مالی، کارکرد یا عضو - حفاظت‌شده',
    badgeProtected: 'دارای سابقه',
    membersCount: (n) => `${n} نفر پرسنل`,
    archivedMembersBreakdown: (active, archived) => ` (${active} فعال، ${archived} بایگانی)`,
    financialTransactions: (n) => `${n} تراکنش مالی`,
    worklogsRecorded: (n) => `${n} ثبت کارکرد`,
    masterLabel: 'استادکار:',
    noMasterAssigned: 'تعیین نشده',
    editGroupTooltip: 'ویرایش گروه',
    unarchiveTooltip: 'خروج از آرشیو',
    archiveTooltip: 'آرشیو کردن',
    activateAction: 'فعال‌سازی',
    archiveAction: 'آرشیو',
    deleteProtectedTooltip: 'دارای سوابق فعال - قفل محافظت از داده',
    deleteGroupTooltip: 'حذف گروه',
    escToClose: 'کلید Esc برای بستن پنجره',
    closeWindowBtn: 'بستن پنجره',
    deleteConfirmTitle: 'آیا از حذف این گروه مطمئن هستید؟',
    deleteConfirmDesc: (name) => `گروه «${name}» به طور کامل از سیستم حذف خواهد شد.`,
    confirmDeleteBtn: 'بله، حذف کن',
    dataIntegrityTitle: 'حفاظت از یکپارچگی داده',
    nonDeletableTitle: 'این گروه غیرقابل حذف است',
    nonDeletableDesc: (name) => `گروه «${name}» به دلیل داشتن سوابق ثبت‌شده در سیستم، جهت حفظ یکپارچگی محاسبات مالی و کارکرد پرسنل قابل حذف قطعی نیست.`,
    associatedRecordsHeader: 'سوابق ثبت‌شده این گروه در سیستم:',
    membersUnit: 'عضو (نیرو)',
    transactionsUnit: 'تراکنش مالی',
    logsUnit: 'ثبت کارکرد',
    archiveAlternativeGuide: 'می‌توانید به جای حذف، گروه را «آرشیو» نمایید تا از لیست‌های فعال پنهان شود ولی کلیه سوابق مالی و گزارش‌ها به طور کامل حفظ شوند.',
    archiveThisGroupBtn: 'آرشیو کردن این گروه',
    understoodBtn: 'متوجه شدم',
    editModalTitle: 'ویرایش مشخصات گروه کاری',
    editModalSubtitle: 'تغییر نام، شرح وظایف و تنظیمات کسر خوراک',
    saveChangesBtn: 'ذخیره تغییرات'
  },
  ku: {
    modalTitle: 'بەڕێوەبردنی گرووپەکانی کارگە',
    modalSubtitle: 'سازماندانی تیمەکان، پیشەییبوون و ئەندامان',
    tabAll: 'هەموو',
    tabActive: 'چالاکەکان',
    tabArchived: 'ئەرشیڤ',
    closeFormBtn: 'داخستنی فۆڕم',
    openNewGroupBtn: 'تۆمارکردنی گرووپی نوێ',
    newGroupCardTitle: 'تۆمارکردنی گرووپی کاری نوێ',
    groupNameLabel: 'ناوی گرووپ',
    groupNamePlaceholder: 'وەک: کونکریت، لاشه به‌رد، ئاسنگەری...',
    groupDescLabel: 'پوختەی ئەرک و کاری گرووپ',
    groupDescPlaceholder: 'ڕوونکردنەوە دەربارەی بەرپرسیارێتی و کاری ئەم گرووپە...',
    autoFoodDeductLabel: 'لێبڕینی خودکاری خەرجی خواردن بۆ ئەندامان',
    cancelBtn: 'پاشگەزبوونەوە',
    createGroupBtn: 'تۆمارکردن',
    searchPlaceholder: 'گەڕان لەناو گرووپەکاندا...',
    emptyStateTitle: 'هیچ گرووپێک نەدۆزرایەوە.',
    emptyStateDesc: 'دەتوانیت بە دوگمەی «تۆمارکردنی گرووپی نوێ» گرووپی نوێ دروست بکەیت.',
    badgeArchived: 'ئەرشیڤ',
    badgeActive: 'چالاک',
    badgeFoodDeduct: 'خواردن',
    badgeProtectedTooltip: 'خاوەنی تۆماری دارایی یان کارکردە - پارێزراوە',
    badgeProtected: 'پارێزراو',
    membersCount: (n) => `${n} کرێکار`,
    archivedMembersBreakdown: (active, archived) => ` (${active} چالاک، ${archived} ئەرشیڤ)`,
    financialTransactions: (n) => `${n} مامەڵەی دارایی`,
    worklogsRecorded: (n) => `${n} تۆماری کارکرد`,
    masterLabel: 'وەستا:',
    noMasterAssigned: 'دیاری نەکراوە',
    editGroupTooltip: 'دەستکاریکردنی گرووپ',
    unarchiveTooltip: 'چالاککردنەوە',
    archiveTooltip: 'ئەرشیڤکردن',
    activateAction: 'چالاککردن',
    archiveAction: 'ئەرشیڤ',
    deleteProtectedTooltip: 'پارێزراوە: خاوەنی سوابقی کارکرد یان داراییە',
    deleteGroupTooltip: 'سڕینەوەی گرووپ',
    escToClose: 'کلیلی Esc بۆ داخستن',
    closeWindowBtn: 'داخستنی پەنجەرە',
    deleteConfirmTitle: 'سڕینەوەی گرووپ؟',
    deleteConfirmDesc: (name) => `گرووپی «${name}» بە تەواوی لە سیستەم و هەموو ئامێرەکان دەسڕدرێتەوە.`,
    confirmDeleteBtn: 'بەڵێ، بسڕەوە',
    dataIntegrityTitle: 'هەڵەی دەستڕاگەیشتن و پاراستنی داتا',
    nonDeletableTitle: 'ئەم گرووپە ناپێکرێت بسڕدرێتەوە',
    nonDeletableDesc: (name) => `گرووپی «${name}» بەهۆی هەبوونی تۆماری کارکرد و دارایی، بۆ پاراستنی داتاکان ناتوانرێت بسڕدرێتەوە.`,
    associatedRecordsHeader: 'سوابقی پەیوەست بەم گرووپە لە سیستەمدا:',
    membersUnit: 'ئەندام (کرێکار)',
    transactionsUnit: 'مامەڵەی دارایی',
    logsUnit: 'تۆماری کارکرد',
    archiveAlternativeGuide: 'دەتوانیت گرووپەکە «ئەرشیڤ» بکەیت بۆ ئەوەی لە فۆڕم و مینیۆکاندا دیار نەمێنێت بەڵام حیساباتەکەی پارێزراو بێت.',
    archiveThisGroupBtn: 'ئەرشیڤکردنی ئەم گرووپە',
    understoodBtn: 'تێگەیشتم',
    editModalTitle: 'دەستکاریکردنی گرووپ',
    editModalSubtitle: 'گۆڕینی ناو، پێناسە و ڕێکخستنەکان',
    saveChangesBtn: 'پاشەکەوتکردنی گۆڕانکارییەکان'
  },
  en: {
    modalTitle: 'Work Groups Management',
    modalSubtitle: 'Organize work crews, assign master supervisors, and manage food allowance deductions',
    tabAll: 'All',
    tabActive: 'Active',
    tabArchived: 'Archived',
    closeFormBtn: 'Cancel',
    openNewGroupBtn: '+ New Work Group',
    newGroupCardTitle: 'Define New Work Group',
    groupNameLabel: 'Group Name',
    groupNamePlaceholder: 'e.g., Masonry, Concrete Pouring, Steel Structure, Plumbing...',
    groupDescLabel: 'Scope & Responsibilities',
    groupDescPlaceholder: 'Team scope and responsibilities in the project...',
    autoFoodDeductLabel: 'Automatic food allowance deduction for group members',
    cancelBtn: 'Cancel',
    createGroupBtn: 'Register Work Group',
    searchPlaceholder: 'Search group names...',
    emptyStateTitle: 'No work groups found in this status.',
    emptyStateDesc: 'You can create a new work group using the button above.',
    badgeArchived: 'Archived',
    badgeActive: 'Active',
    badgeFoodDeduct: 'Food Deduction',
    badgeProtectedTooltip: 'Contains financial records, attendance logs, or members - Protected',
    badgeProtected: 'Has Records',
    membersCount: (n) => `${n} Members`,
    archivedMembersBreakdown: (active, archived) => ` (${active} active, ${archived} archived)`,
    financialTransactions: (n) => `${n} Financial Transactions`,
    worklogsRecorded: (n) => `${n} Worklogs Recorded`,
    masterLabel: 'Master Supervisor:',
    noMasterAssigned: 'Not Assigned',
    editGroupTooltip: 'Edit Group',
    unarchiveTooltip: 'Unarchive / Reactivate',
    archiveTooltip: 'Archive Group',
    activateAction: 'Activate',
    archiveAction: 'Archive',
    deleteProtectedTooltip: 'Active records present - Data integrity lock',
    deleteGroupTooltip: 'Delete Group',
    escToClose: 'Press Esc to close window',
    closeWindowBtn: 'Close Window',
    deleteConfirmTitle: 'Are you sure you want to delete this group?',
    deleteConfirmDesc: (name) => `Group "${name}" will be permanently deleted from the system.`,
    confirmDeleteBtn: 'Yes, Delete',
    dataIntegrityTitle: 'Data Integrity Protection',
    nonDeletableTitle: 'This group cannot be deleted',
    nonDeletableDesc: (name) => `Group "${name}" has recorded attendance and financial history. To preserve financial ledger accuracy, it cannot be permanently deleted.`,
    associatedRecordsHeader: 'Associated records in the system:',
    membersUnit: 'Members',
    transactionsUnit: 'Transactions',
    logsUnit: 'Attendance Logs',
    archiveAlternativeGuide: 'You can archive this group instead. It will be hidden from active dropdowns while all financial records and reports remain intact.',
    archiveThisGroupBtn: 'Archive This Group',
    understoodBtn: 'Understood',
    editModalTitle: 'Edit Work Group',
    editModalSubtitle: 'Change group name, description, and food deduction settings',
    saveChangesBtn: 'Save Changes'
  }
};

export function ManageGroupsModal({ onClose, targetProjectId }) {
  const { language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = GROUPS_COPY[langKey] || GROUPS_COPY.fa;

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
      const master = members.find((w) => {
        const rLower = (w.role || '').toLowerCase();
        return w.teamRole === 'Master' || 
          rLower.includes('سرپرست') || 
          rLower.includes('استادکار') ||
          rLower.includes('master') ||
          rLower.includes('supervisor') ||
          rLower.includes('وەستا');
      });
      
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
                {c.modalTitle}
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {c.modalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ۲. نوار ابزار بالا: تب‌های فیلتر و دکمه افزودن */}
        <div className="px-5 sm:px-6 py-3 bg-white/50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* سگمنت تب‌های فیلتر */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>{c.tabAll}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {allDbGroups.filter((g) => !g.deletedAt && g.status !== 'deleted').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>{c.tabActive}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                {allDbGroups.filter((g) => !g.deletedAt && g.status !== 'deleted' && !g.isArchived && g.status !== 'archived').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'archived'
                  ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>{c.tabArchived}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {allDbGroups.filter((g) => !g.deletedAt && (g.isArchived || g.status === 'archived')).length}
              </span>
            </button>
          </div>

          {/* دکمه ثبت گروه جدید */}
          <button
            type="button"
            onClick={() => setIsAddingNew(!isAddingNew)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isAddingNew
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-sky-500/20 active:scale-95'
            }`}
          >
            <Plus className={`w-4 h-4 transition-transform duration-200 ${isAddingNew ? 'rotate-45' : ''}`} />
            <span>
              {isAddingNew ? c.closeFormBtn : c.openNewGroupBtn}
            </span>
          </button>
        </div>

        {/* ۳. محتوای اسکرول‌پذیر اصلی مدال */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
          
          {/* فرم شیشه‌ای بازشونده برای تعریف گروه جدید */}
          {isAddingNew && (
            <form 
              onSubmit={handleCreateGroup}
              className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-sky-300 dark:border-sky-800/60 shadow-lg shadow-sky-500/5 space-y-3.5 animate-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60 text-xs font-black text-sky-600 dark:text-sky-400">
                <Plus className="w-4 h-4" />
                <span>{c.newGroupCardTitle}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {c.groupNameLabel} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={c.groupNamePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {c.groupDescLabel}
                </label>
                <textarea
                  rows="2"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder={c.groupDescPlaceholder}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none"
                />
              </div>

              {/* چک‌باکس کسر خودکار هزینه خوراک */}
              <div className="pt-1 flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                <label 
                  htmlFor="new-deduct-food" 
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                >
                  <Utensils className="w-4 h-4 text-amber-500" />
                  <span>{c.autoFoodDeductLabel}</span>
                </label>
                <input
                  id="new-deduct-food"
                  type="checkbox"
                  checked={newDeductFood}
                  onChange={(e) => setNewDeductFood(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded-lg border-slate-300 focus:ring-sky-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {c.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newGroupName.trim()}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-black shadow-md shadow-sky-500/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? '...' : c.createGroupBtn}
                </button>
              </div>
            </form>
          )}

          {/* فیلد سرچ شیشه‌ای */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={c.searchPlaceholder}
              className="w-full h-10 ps-10 pe-4 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs transition-all"
            />
          </div>

          {/* لیست کارت‌های گروه‌های کاری */}
          {filteredGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 bg-white/60 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
              <FolderTree className="w-10 h-10 mx-auto mb-2 opacity-50 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {c.emptyStateTitle}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {c.emptyStateDesc}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredGroups.map((group) => {
                const stats = groupStats[group.id] || { memberCount: 0, activeCount: 0, archivedCount: 0, paymentCount: 0, logCount: 0, isProtected: false };
                const isArchived = group.isArchived || group.status === 'archived';

                return (
                  <div
                    key={group.id}
                    className={`p-4 rounded-3xl border backdrop-blur-md transition-all flex flex-col justify-between gap-3 ${
                      isArchived
                        ? 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-75'
                        : 'bg-white/80 dark:bg-slate-800/70 border-white/80 dark:border-slate-700/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-sky-300 dark:hover:border-sky-700'
                    }`}
                  >
                    {/* اطلاعات گروه */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black shadow-xs ${
                          isArchived
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                        }`}>
                          {group.name ? group.name.charAt(0) : '#'}
                        </div>
                        
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                              {group.name}
                            </h3>

                            {/* برچسب وضعیت */}
                            {isArchived ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                <Archive className="w-3 h-3" />
                                <span>{c.badgeArchived}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>{c.badgeActive}</span>
                              </span>
                            )}

                            {/* برچسب کسر خوراک */}
                            {group.deductFoodExpense && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <Utensils className="w-3 h-3" />
                                <span>{c.badgeFoodDeduct}</span>
                              </span>
                            )}

                            {/* برچسب قفل حفاظت داده */}
                            {stats.isProtected && (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                                title={c.badgeProtectedTooltip}
                              >
                                <Lock className="w-3 h-3" />
                                <span>{c.badgeProtected}</span>
                              </span>
                            )}
                          </div>

                          {/* اطلاعات اعضا، استادکار و تراکنش‌ها */}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap font-medium">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {c.membersCount(stats.memberCount)}
                                {stats.archivedCount > 0 ? c.archivedMembersBreakdown(stats.activeCount, stats.archivedCount) : ''}
                              </span>
                            </span>

                            {stats.paymentCount > 0 && (
                              <span className="flex items-center gap-1">
                                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                <span>{c.financialTransactions(stats.paymentCount)}</span>
                              </span>
                            )}

                            {stats.logCount > 0 && (
                              <span className="flex items-center gap-1">
                                <CalendarCheck className="w-3.5 h-3.5 text-slate-400" />
                                <span>{c.worklogsRecorded(stats.logCount)}</span>
                              </span>
                            )}

                            {stats.masterName && (
                              <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold">
                                <span>{c.masterLabel} {stats.masterName}</span>
                              </span>
                            )}
                          </div>

                          {/* توضیحات گروه */}
                          {group.description && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-1">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* دکمه‌های عملیات */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* ویرایش */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(group)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                          title={c.editGroupTooltip}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* آرشیو / خروج از آرشیو */}
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(group)}
                          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                            isArchived
                              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700'
                          }`}
                          title={isArchived ? c.unarchiveTooltip : c.archiveTooltip}
                        >
                          <Archive className="w-4 h-4" />
                          <span className="sr-only">
                            {isArchived ? c.activateAction : c.archiveAction}
                          </span>
                        </button>

                        {/* حذف یا قفل حفاظت داده */}
                        <button
                          type="button"
                          onClick={() => handleAttemptDelete(group)}
                          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                            stats.isProtected
                              ? 'text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                              : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700'
                          }`}
                          title={stats?.isProtected ? c.deleteProtectedTooltip : c.deleteGroupTooltip}
                        >
                          {stats.isProtected ? (
                            <Lock className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ۴. فوتر شیشه‌ای مدال */}
        <div className="px-5 sm:px-6 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {c.escToClose}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            {c.closeWindowBtn}
          </button>
        </div>

      </div>

      {/* مودال فرعی تایید حذف */}
      {groupToDelete && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGroupToDelete(null);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {c.deleteConfirmTitle}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {c.deleteConfirmDesc(groupToDelete.name)}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={confirmDeleteGroup}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black shadow-md shadow-rose-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {c.confirmDeleteBtn}
              </button>
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                {c.cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال فرعی خطای عدم دسترسی و حفاظت از داده */}
      {accessDeniedGroup && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAccessDeniedGroup(null);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-start">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                  {c.dataIntegrityTitle}
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {c.nonDeletableTitle}
                </h4>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {c.nonDeletableDesc(accessDeniedGroup.name)}
            </p>

            {/* کارت تفکیک سوابق */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 block">
                {c.associatedRecordsHeader}
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 font-bold">
                  <span className="block text-indigo-600 dark:text-indigo-400 font-black text-sm font-mono">
                    {groupStats[accessDeniedGroup.id]?.memberCount || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">{c.membersUnit}</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 font-bold">
                  <span className="block text-emerald-600 dark:text-emerald-400 font-black text-sm font-mono">
                    {groupStats[accessDeniedGroup.id]?.paymentCount || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">{c.transactionsUnit}</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 font-bold">
                  <span className="block text-sky-600 dark:text-sky-400 font-black text-sm font-mono">
                    {groupStats[accessDeniedGroup.id]?.logCount || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">{c.logsUnit}</span>
                </div>
              </div>
            </div>

            {/* باکس راهنمای بایگانی */}
            <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                {c.archiveAlternativeGuide}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const g = accessDeniedGroup;
                  setAccessDeniedGroup(null);
                  await handleToggleArchive(g);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Archive className="w-4 h-4" />
                <span>{c.archiveThisGroupBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => setAccessDeniedGroup(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                {c.understoodBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال فرعی ویرایش گروه */}
      {editingGroup && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingGroup(null);
          }}
        >
          <form 
            onSubmit={handleSaveEditGroup}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-start"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {c.editModalTitle}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {c.editModalSubtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {c.groupNameLabel} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {c.groupDescLabel}
              </label>
              <textarea
                rows="2"
                value={editGroupDescription}
                onChange={(e) => setEditGroupDescription(e.target.value)}
                placeholder={c.groupDescPlaceholder}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none"
              />
            </div>

            {/* چک‌باکس کسر خودکار هزینه خوراک */}
            <div className="pt-1 flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <label 
                htmlFor="edit-deduct-food" 
                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
              >
                <Utensils className="w-4 h-4 text-amber-500" />
                <span>{c.autoFoodDeductLabel}</span>
              </label>
              <input
                id="edit-deduct-food"
                type="checkbox"
                checked={editDeductFood}
                onChange={(e) => setEditDeductFood(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded-lg border-slate-300 focus:ring-sky-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !editGroupName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-md shadow-sky-500/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmitting ? '...' : c.saveChangesBtn}
              </button>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                {c.cancelBtn}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
