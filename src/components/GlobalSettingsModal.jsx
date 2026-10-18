import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db, DEFAULT_PROJECT_ID, generateSectionId } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  fullSyncBothDirections,
  pushProjectLive,
  pushProjectSectionLive,
  deleteProjectSectionLive,
  pushExpenseCategoryLive,
  deleteExpenseCategoryLive
} from '../services/realtimeSync';
import { exportDatabaseToJSON, importDatabaseFromJSON, resetDatabaseWithSeed } from '../db/backup';
import { TIMEZONE_OPTIONS, CALENDAR_OPTIONS, NUMBER_FORMAT_OPTIONS } from '../utils/formatters';
import {
  Settings,
  X,
  Menu,
  Camera,
  Languages,
  Moon,
  Sun,
  FolderKanban,
  Layers,
  Users2,
  Receipt,
  Cloud,
  RefreshCw,
  Database,
  Download,
  Upload,
  User,
  KeyRound,
  ShieldCheck,
  Info,
  Check,
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Building,
  Calendar,
  Wallet,
  Clock,
  ExternalLink,
  Keyboard,
  Command,
  Smartphone,
  Shield,
  ShieldAlert,
  Landmark,
  RotateCcw,
  BellRing
} from 'lucide-react';
import { TwoFactorModal } from './TwoFactorModal';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { evaluatePasswordStrength } from '../utils/passwordSecurity';
import { AccountsSettingsTab } from './accounting/AccountsSettingsTab';
import ExpenseCategoriesTab from './accounting/ExpenseCategoriesTab';
import DataSyncSettingsTab from './accounting/DataSyncSettingsTab';
import UsersSettingsTab from "./UsersSettingsTab";
import NotificationsSettingsTab from './NotificationsSettingsTab';
import { useAccounting } from '../hooks/useAccounting';

export default function GlobalSettingsModal({ isOpen, onClose, initialTab = 'general' }) {
  const { 
    language, 
    changeLanguage, 
    t, 
    direction, 
    timeFormat, 
    setTimeFormat, 
    timeZone, 
    setTimeZone, 
    calendarType,
    setCalendarType,
    numberFormat,
    setNumberFormat,
    formatTime,
    formatDate
  } = useLanguage();
  const isRtl = direction === 'rtl';

  // Live ticking clock for settings preview
  const [modalClock, setModalClock] = useState(() => new Date());
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setModalClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);
  const { 
    user, 
    logout, 
    changeAdminPassword, 
    updateUserProfile, 
    getTwoFactorConfig, 
    autoLockMinutes, 
    setAutoLockMinutes,
    setUserRole,
    isAdmin
  } = useAuth();
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const twoFactorConfig = getTwoFactorConfig();
  const {
    projects,
    activeProjects,
    currentProject,
    switchProject,
    updateProject,
    deleteProject,
    softDeleteProject,
    archiveProject,
    editingProjectId,
    setEditingProjectId,
    setIsNewProjectModalOpen
  } = useProject();

  const {
    financialAccounts,
    accountBalances,
    globalOverdraftPolicy,
    updateGlobalOverdraftPolicy,
    addAccount,
    updateAccount,
    setDefaultAccount,
    deleteAccount
  } = useAccounting();

  const normalizeSettingsTab = (tab) => (tab === 'project_sections' ? 'projects' : (tab || 'general'));
  const [activeTab, setActiveTab] = useState(() => normalizeSettingsTab(initialTab));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // User Profile tab states
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileTitle, setProfileTitle] = useState(user?.title || 'مدیر ارشد کارگاه');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || user?.photo || user?.supabaseUser?.user_metadata?.avatar_url || '');
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileTitle(user.title || (language === 'fa' ? 'مدیر ارشد کارگاه' : language === 'ku' ? 'بەڕێوەبەری پڕۆژە' : 'Senior Workshop Manager'));
      setProfileAvatar(user.avatar || user.photo || user.supabaseUser?.user_metadata?.avatar_url || '');
    }
  }, [user, isOpen]);

  // Sync initial tab when modal opens or initialTab prop changes
  useEffect(() => {
    if (initialTab) setActiveTab(normalizeSettingsTab(initialTab));
  }, [initialTab, isOpen]);

  // Sidebar navigation tabs ordered logically by priority & scope:
  // 1. Core Profile & Appearance: General -> Account & Security -> Users & Access
  // 2. Workshop & Financials: Projects -> Expense Categories -> Accounts & Banking
  // 3. System & Tools: Data & Sync -> Shortcuts -> About
  const tabs = useMemo(() => [
    {
      id: 'general',
      label: language === 'fa' ? 'عمومی و ظاهر' : language === 'ku' ? 'گشتی و ڕووکار' : 'General & Theme',
      icon: Settings,
      color: 'text-sky-500'
    },
    {
      id: 'notifications',
      label: language === 'fa' ? 'اعلان‌ها و یادآورها' : language === 'ku' ? 'ئاگادارکردنەوەکان' : 'Notifications & Alerts',
      icon: BellRing,
      color: 'text-sky-500'
    },
    {
      id: 'account',
      label: language === 'fa' ? 'حساب کاربری و امنیت' : language === 'ku' ? 'هەژمار و ئاسایش' : 'Account & Security',
      icon: User,
      color: 'text-sky-500'
    },
    {
      id: 'users',
      label: language === 'fa' ? 'کاربران و دسترسی‌ها' : language === 'ku' ? 'بەکارهێنەران' : 'Users & Access',
      icon: Users2,
      color: 'text-indigo-500'
    },
    {
      id: 'projects',
      label: language === 'fa' ? 'پروژه‌ها و بخش‌ها' : language === 'ku' ? 'پڕۆژەکان و بەشەکان' : 'Projects & Structure',
      icon: FolderKanban,
      color: 'text-sky-500'
    },
    {
      id: 'categories',
      label: language === 'fa' ? 'سرفصل‌های هزینه‌ها' : language === 'ku' ? 'سەردێڕی خەرجییەکان' : 'Expense Categories',
      icon: Receipt,
      color: 'text-sky-500'
    },
    {
      id: 'accounting_accounts',
      label: language === 'fa' ? 'حساب‌ها و کارت‌های بانکی' : language === 'ku' ? 'حیساب و کارتەکان' : 'Financial Accounts',
      icon: Landmark,
      color: 'text-sky-500'
    },
    {
      id: 'sync_data',
      label: language === 'fa' ? 'داده‌ها و همگام‌سازی' : language === 'ku' ? 'داتاکان و هاوکاتکردن' : 'Data & Cloud Sync',
      icon: Cloud,
      color: 'text-sky-500'
    },
    {
      id: 'shortcuts',
      label: language === 'fa' ? 'کلیدهای میانبر کیبورد' : language === 'ku' ? 'شۆرتکاتەکانی کیبۆرد' : 'Keyboard Shortcuts',
      icon: Keyboard,
      color: 'text-sky-500'
    },
    {
      id: 'about',
      label: language === 'fa' ? 'درباره و نسخه' : language === 'ku' ? 'دەربارە و وەشان' : 'About & Version',
      icon: Info,
      color: 'text-sky-500'
    }
  ], [language]);

  // Keyboard shortcut listener (ESC to close, ArrowUp/ArrowDown to switch tabs)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Check if user is currently typing in an input, textarea or select
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable
      );

      if (isInputFocused) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTab);
        if (currentIndex === -1) return;

        if (e.key === 'ArrowDown') {
          const nextIndex = (currentIndex + 1) % tabs.length;
          setActiveTab(tabs[nextIndex].id);
        } else if (e.key === 'ArrowUp') {
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          setActiveTab(tabs[prevIndex].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, activeTab, tabs]);

  // Theme state
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [themeMode, setThemeMode] = useState(isDarkMode ? 'dark' : 'light');

  // Draft state for General Tab (allows Save / Cancel workflow)
  const [draftLanguage, setDraftLanguage] = useState(language);
  const [draftTheme, setDraftTheme] = useState(isDarkMode ? 'dark' : 'light');
  const [draftTimeFormat, setDraftTimeFormat] = useState(timeFormat);
  const [draftTimeZone, setDraftTimeZone] = useState(timeZone);
  const [draftCalendarType, setDraftCalendarType] = useState(calendarType);
  const [draftNumberFormat, setDraftNumberFormat] = useState(numberFormat);
  const [generalSaveSuccess, setGeneralSaveSuccess] = useState(false);

  // Initialize draft when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftLanguage(language);
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      setDraftTheme(isDark ? 'dark' : 'light');
      setDraftTimeFormat(timeFormat);
      setDraftTimeZone(timeZone);
      setDraftCalendarType(calendarType);
      setDraftNumberFormat(numberFormat);
      setGeneralSaveSuccess(false);
    }
  }, [isOpen, language, timeFormat, timeZone, calendarType, numberFormat]);

  // Instant Auto-Apply Handlers for General Tab
  const updateAppLanguage = (newLang) => {
    setDraftLanguage(newLang);
    changeLanguage(newLang);
  };

  const updateAppTheme = (newTheme) => {
    setDraftTheme(newTheme);
    setThemeMode(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const updateAppCalendar = (newCal) => {
    setDraftCalendarType(newCal);
    setCalendarType(newCal);
  };

  const updateAppTimeZone = (newTz) => {
    setDraftTimeZone(newTz);
    setTimeZone(newTz);
  };

  const updateAppTimeFormat = (newFmt) => {
    setDraftTimeFormat(newFmt);
    setTimeFormat(newFmt);
  };

  const updateAppNumberFormat = (newNumFmt) => {
    setDraftNumberFormat(newNumFmt);
    setNumberFormat(newNumFmt);
  };

  // Reset to default factory settings
  const handleResetToDefaultSettings = () => {
    if (window.confirm(language === 'fa' ? 'آیا مایلید تمام تنظیمات ظاهر و زمان به حالت پیش‌فرض برگردانده شوند؟' : language === 'ku' ? 'ئایا دەتەوێت ڕێکخستنەکان بگۆڕدرێن بۆ باری بنەڕەتی؟' : 'Do you want to reset all visual and time settings to default?')) {
      updateAppLanguage('fa');
      updateAppTheme('light');
      updateAppCalendar('jalali');
      updateAppTimeZone('Asia/Tehran');
      updateAppTimeFormat('24h');
      updateAppNumberFormat('fa');
    }
  };

  // ----------------------------------------------------
  // Tab 1: General & Appearance States
  // ----------------------------------------------------
  const languagesList = [
    { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
    { code: 'ku', label: 'کوردی', flag: '☀️' },
    { code: 'en', label: 'English', flag: '🌐' }
  ];

  // ----------------------------------------------------
  // Tab 2: Project Management & Sections States
  // ----------------------------------------------------
  const targetProjectId = editingProjectId || currentProject?.id || DEFAULT_PROJECT_ID;
  const targetProject = (projects || []).find((p) => p.id === targetProjectId) || currentProject;

  const [projectName, setProjectName] = useState('');
  const [projectCurrency, setProjectCurrency] = useState('IQD');
  const [projectHours, setProjectHours] = useState(8);
  const [projectOvertime, setProjectOvertime] = useState(1.0);
  const [projectNotes, setProjectNotes] = useState('');
  const [projectSaveSuccess, setProjectSaveSuccess] = useState(false);

  useEffect(() => {
    if (targetProject) {
      setProjectName(targetProject.name || '');
      setProjectCurrency(targetProject.currency || targetProject.base_currency || 'IQD');
      setProjectHours(targetProject.standardWorkHours || 8);
      setProjectOvertime(targetProject.overtimeMultiplier || 1.0);
      setProjectNotes(targetProject.notes || '');
      setProjectSaveSuccess(false);
    }
  }, [targetProject?.id, isOpen]);

  const handleSaveProjectInfo = async (e) => {
    e.preventDefault();
    if (!targetProject?.id) return;
    try {
      await updateProject(targetProject.id, {
        name: projectName.trim(),
        currency: projectCurrency,
        standardWorkHours: Number(projectHours) || 8,
        overtimeMultiplier: Number(projectOvertime) || 1.0,
        notes: projectNotes.trim()
      });
      setProjectSaveSuccess(true);
      setTimeout(() => setProjectSaveSuccess(false), 2500);
    } catch (err) {
      console.warn('Update project failed:', err);
    }
  };

  // Sections of targeted project
  const projectSections = useLiveQuery(
    () => db.projectSections.where('projectId').equals(targetProjectId).toArray(),
    [targetProjectId]
  ) || [];

  const [newSectionName, setNewSectionName] = useState('');
  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    const sId = generateSectionId();
    const newSec = {
      id: sId,
      projectId: targetProjectId,
      userId: user?.id || 'admin',
      name: newSectionName.trim(),
      status: 'active',
      createdAt: new Date().toISOString()
    };
    await pushProjectSectionLive(newSec);
    setNewSectionName('');
  };

  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  const handleStartEditSection = (sec) => {
    setEditingSectionId(sec.id);
    setEditingSectionName(sec.name);
  };

  const handleSaveEditSection = async (secId) => {
    if (!editingSectionName.trim()) return;
    const sec = projectSections.find((s) => s.id === secId);
    if (!sec) return;
    const updatedSec = { ...sec, name: editingSectionName.trim() };
    await pushProjectSectionLive(updatedSec);
    setEditingSectionId(null);
    setEditingSectionName('');
  };

  const handleDeleteSection = async (secId) => {
    if (!window.confirm(language === 'fa' ? 'آیا از حذف این بخش اطمینان دارید؟' : language === 'ku' ? 'ئایا لە سڕینەوەی ئەم بەشە دڵنیایت؟' : 'Are you sure you want to delete this section?')) return;
    await deleteProjectSectionLive(secId);
    if (editingSectionId === secId) setEditingSectionId(null);
  };

  // Groups of targeted project
  const projectGroups = useLiveQuery(
    () => db.groups.where('projectId').equals(targetProjectId).toArray(),
    [targetProjectId]
  ) || [];

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDeductFood, setNewGroupDeductFood] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupDeductFood, setEditingGroupDeductFood] = useState(false);

  const handleStartEditGroup = (grp) => {
    setEditingGroupId(grp.id);
    setEditingGroupName(grp.name);
    setEditingGroupDeductFood(!!grp.deductFoodExpense);
  };

  const handleSaveEditGroup = async (gId) => {
    if (!editingGroupName.trim()) return;
    const grp = projectGroups.find((g) => g.id === gId);
    if (!grp) return;
    const updatedGrp = {
      ...grp,
      name: editingGroupName.trim(),
      deductFoodExpense: editingGroupDeductFood
    };
    await db.groups.put(updatedGrp);
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const gId = 'grp_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const newGrp = {
      id: gId,
      projectId: targetProjectId,
      name: newGroupName.trim(),
      deductFoodExpense: newGroupDeductFood,
      createdAt: new Date().toISOString()
    };
    await db.groups.put(newGrp);
    setNewGroupName('');
    setNewGroupDeductFood(false);
  };

  const handleDeleteGroup = async (gId) => {
    if (!window.confirm(language === 'fa' ? 'آیا از حذف این گروه کاری اطمینان دارید؟' : language === 'ku' ? 'ئایا لە سڕینەوەی ئەم تیمە دڵنیایت؟' : 'Are you sure you want to delete this work team?')) return;
    await db.groups.delete(gId);
    if (editingGroupId === gId) setEditingGroupId(null);
  };

  const handleDeleteTargetProject = async (pId) => {
    if (pId === DEFAULT_PROJECT_ID) {
      alert(language === 'fa' ? 'پروژه پیش‌فرض سیستم قابل حذف نیست.' : language === 'ku' ? 'پڕۆژەی بنەڕەتی سیستەم ناکرێت بسڕدرێتەوە.' : 'Default system project cannot be deleted.');
      return;
    }
    const p = (projects || []).find((x) => x.id === pId);
    const confirmMsg = language === 'fa'
      ? `آیا از حذف کامل پروژه «${p?.name || ''}» اطمینان دارید؟`
      : `ئایا لە سڕینەوەی تەواوی پڕۆژەی «${p?.name || ''}» دڵنیایت؟`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteProject(pId);
        setEditingProjectId(DEFAULT_PROJECT_ID);
        switchProject(DEFAULT_PROJECT_ID);
      } catch (err) {
        alert(err.message || 'خطا در حذف پروژه');
      }
    }
  };

  // Sub-view tab inside Projects Tab: 'details' | 'sections' | 'groups'
  const [projectSubTab, setProjectSubTab] = useState('details');

  // ----------------------------------------------------
  // Tab 3: Expense Categories (3-Tier Hierarchy)
  // ----------------------------------------------------
  const allCategories = useLiveQuery(
    async () => {
      const list = await db.expenseCategories.toArray();
      return list.filter((c) => !c.projectId || c.projectId === targetProjectId || targetProjectId === DEFAULT_PROJECT_ID);
    },
    [targetProjectId]
  ) || [];

  const handleAddCategory = async ({ name, parentId, level }) => {
    if (!name || !name.trim()) return;
    const cId = 'cat_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const newCat = {
      id: cId,
      projectId: targetProjectId,
      userId: user?.id || 'admin',
      name: name.trim(),
      parentId: parentId || null,
      level: Number(level) || 1,
      createdAt: new Date().toISOString()
    };
    await pushExpenseCategoryLive(newCat);
  };

  const handleUpdateCategory = async (catId, newName) => {
    if (!catId || !newName || !newName.trim()) return;
    const existing = await db.expenseCategories.get(catId);
    if (!existing) return;
    const updated = {
      ...existing,
      name: newName.trim(),
      updatedAt: new Date().toISOString()
    };
    await pushExpenseCategoryLive(updated);
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm(language === 'fa' ? 'آیا از حذف این سرفصل و تمام زیرمجموعه‌های آن اطمینان دارید؟' : language === 'ku' ? 'ئایا لە سڕینەوەی ئەم بابەتە و هەموو ژێرگرووپەکانی دڵنیایت؟' : 'Are you sure you want to delete this category and all its subcategories?')) return;
    // Find all children recursively
    const all = await db.expenseCategories.toArray();
    const idsToDelete = new Set([catId]);
    
    // Pass 1: find children whose parentId is in idsToDelete
    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      for (const item of all) {
        if (item.parentId && idsToDelete.has(item.parentId) && !idsToDelete.has(item.id)) {
          idsToDelete.add(item.id);
          addedMore = true;
        }
      }
    }

    for (const id of idsToDelete) {
      await deleteExpenseCategoryLive(id);
    }
  };

  // ----------------------------------------------------
  // Tab 4: Sync & Database Backup States
  // ----------------------------------------------------
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [restoreMode, setRestoreMode] = useState('replace');
  const [backupFile, setBackupFile] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState({ type: '', text: '' });

  // DB Record Counts with precise filtering (active, archived, trash)
  const dbCounts = useLiveQuery(async () => {
    try {
      const [
        allWorkers,
        allLogs,
        allPayments,
        allExpenses,
        allCategories,
        allSections,
        allGroups,
        allProjects
      ] = await Promise.all([
        db.workers.toArray(),
        db.attendanceLogs.toArray(),
        db.payments.toArray(),
        db.expenses.toArray(),
        db.expenseCategories.toArray(),
        db.projectSections.toArray(),
        db.groups.toArray(),
        db.projects.toArray()
      ]);

      const activeWorkers = (allWorkers || []).filter(w => !w.deletedAt && !w.isArchived && w.status !== 'archived').length;
      const totalWorkers = (allWorkers || []).filter(w => !w.deletedAt).length;
      const logsCount = (allLogs || []).filter(l => !l.deletedAt).length;
      const paymentsCount = (allPayments || []).filter(p => !p.deletedAt).length;
      const activeExpenses = (allExpenses || []).filter(e => !e.deletedAt).length;
      const categoriesCount = (allCategories || []).length;
      const sectionsCount = (allSections || []).filter(s => !s.deletedAt && s.status !== 'deleted').length;
      const groupsCount = (allGroups || []).filter(g => !g.deletedAt && g.status !== 'deleted').length;
      const projectsCount = (allProjects || []).filter(p => p.status !== 'deleted').length;

      return {
        workers: activeWorkers,
        totalWorkers,
        logs: logsCount,
        payments: paymentsCount,
        expenses: activeExpenses,
        categories: categoriesCount,
        sections: sectionsCount,
        groups: groupsCount,
        projects: projectsCount
      };
    } catch (e) {
      console.warn('Error computing db counts:', e);
      return { workers: 0, totalWorkers: 0, logs: 0, payments: 0, expenses: 0, categories: 0, sections: 0, groups: 0, projects: 0 };
    }
  }, [], { workers: 0, totalWorkers: 0, logs: 0, payments: 0, expenses: 0, categories: 0, sections: 0, groups: 0, projects: 0 });

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('');
    try {
      await fullSyncBothDirections();
      setSyncStatusMsg(language === 'fa' ? 'همگام‌سازی کامل با موفقیت انجام شد' : language === 'ku' ? 'هاوکاتکردنی تەواو ئەنجامدرا' : 'Full sync completed successfully');
      setTimeout(() => setSyncStatusMsg(''), 3000);
    } catch (err) {
      setSyncStatusMsg(language === 'fa' ? 'خطا در برقراری ارتباط با سرور ابری' : language === 'ku' ? 'هەڵە لە هاوکاتکردن' : 'Cloud sync connection error');
      setTimeout(() => setSyncStatusMsg(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      await exportDatabaseToJSON();
      setBackupMsg({
        type: 'success',
        text: language === 'fa' ? 'فایل پشتیبان با موفقیت دانلود شد' : language === 'ku' ? 'فایلی یەدەگ بە سەرکەوتوویی داگیرا' : 'Backup file downloaded successfully'
      });
      setTimeout(() => setBackupMsg({ type: '', text: '' }), 3000);
    } catch (err) {
      setBackupMsg({ type: 'error', text: err.message });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportBackup = async () => {
    if (!backupFile) {
      setBackupMsg({
        type: 'error',
        text: language === 'fa' ? 'لطفاً ابتدا یک فایل JSON معتبر انتخاب کنید' : language === 'ku' ? 'تکایە فایلی یەدەگ دیاریبکە' : 'Please select a valid JSON backup file'
      });
      return;
    }
    try {
      setBackupLoading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          await importDatabaseFromJSON(content, restoreMode);
          setBackupMsg({
            type: 'success',
            text: language === 'fa' ? 'اطلاعات با موفقیت بازیابی شد' : language === 'ku' ? 'زانیارییەکان بە سەرکەوتوویی هێنرانەوە' : 'Data restored successfully'
          });
          setBackupFile(null);
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        } catch (err) {
          setBackupMsg({ type: 'error', text: err.message });
        } finally {
          setBackupLoading(false);
        }
      };
      reader.readAsText(backupFile);
    } catch (err) {
      setBackupMsg({ type: 'error', text: err.message });
      setBackupLoading(false);
    }
  };

  // ----------------------------------------------------
  // Tab 5: Account & Password States & Handlers
  // ----------------------------------------------------
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    try {
      await updateUserProfile({
        name: profileName.trim(),
        title: profileTitle.trim(),
        avatar: profileAvatar || ''
      });
      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 2500);
    } catch (err) {
      console.warn('Update profile failed:', err);
    }
  };

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(language === 'fa' ? 'حجم تصویر نباید بیشتر از ۵ مگابایت باشد' : language === 'ku' ? 'قەبارەی وێنە نابێت لە ٥ مێگابایت زیاتر بێت' : 'Image size cannot exceed 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (re) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setProfileAvatar(dataUrl);
      };
      img.src = re.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setProfileAvatar('');
  };

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  const [passLoading, setPassLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg({ type: '', text: '' });
    if (!currentPass || !newPass) return;
    if (newPass !== confirmPass) {
      setPassMsg({
        type: 'error',
        text: language === 'fa' ? 'رمز عبور جدید و تکرار آن یکسان نیستند' : language === 'ku' ? 'وشەی نهێنی نوێ و دووبارەکردنەوەی وەک یەک نین' : 'New password and confirmation do not match'
      });
      return;
    }
    const strength = evaluatePasswordStrength(newPass);
    if (!strength.isAcceptable) {
      setPassMsg({
        type: 'error',
        text: language === 'fa' 
          ? 'رمز عبور جدید بسیار ضعیف است. لطفاً حداقل ۸ کاراکتر شامل حروف و اعداد انتخاب کنید.' 
          : 'Password is too weak. Please use a stronger password with letters, digits or symbols.'
      });
      return;
    }

    setPassLoading(true);
    try {
      const res = await changeAdminPassword(currentPass, newPass);
      if (res?.success) {
        setPassMsg({
          type: 'success',
          text: language === 'fa' ? 'رمز عبور با موفقیت به‌روزرسانی شد' : language === 'ku' ? 'وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە' : 'Password updated successfully'
        });
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        setTimeout(() => setPassMsg({ type: '', text: '' }), 3000);
      } else {
        setPassMsg({
          type: 'error',
          text: res?.error === 'currentPasswordWrong'
            ? (language === 'fa' ? 'رمز عبور فعلی اشتباه است' : 'وشەی نهێنی ئێستا هەڵەیە')
            : (res?.error || 'Error')
        });
      }
    } catch (err) {
      setPassMsg({ type: 'error', text: err.message });
    } finally {
      setPassLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      dir={direction}
      className="fixed inset-0 z-50 w-screen h-[100dvh] max-h-[100dvh] bg-white dark:bg-slate-900 flex flex-col overflow-hidden animate-in fade-in duration-200"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="sm:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 flex-shrink-0">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{language === 'fa' ? 'تنظیمات' : language === 'ku' ? 'ڕێکخستنەکان' : 'Settings'}</span>
              <span className="hidden md:inline-flex text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-bold border border-sky-200/60 dark:border-sky-800/60">
                KarSync v0.9.0
              </span>
              {/* On mobile: display active tab title */}
              <span className="sm:hidden text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                {tabs.find((t) => t.id === activeTab)?.label}
              </span>
            </h2>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
              {language === 'fa' ? 'مدیریت یکپارچه ظاهر، پروژه‌ها، سرفصل‌ها و همگام‌سازی ابری' : language === 'ku' ? 'بەڕێوەبردنی گشتی پڕۆژە، ڕووکار و بنکەدراوە' : 'Unified management of UI, projects, categories and cloud sync'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title={language === 'fa' ? 'بستن (Esc)' : language === 'ku' ? 'داخستن (Esc)' : 'Close (Esc)'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Sliding Sidebar Drawer */}
      {isMobileSidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          
          {/* Drawer */}
          <div className={`relative w-72 max-w-[80vw] h-full bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 shadow-2xl p-4 flex flex-col z-10 animate-in ${isRtl ? 'slide-in-from-right' : 'slide-in-from-left'} duration-200`}>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {language === 'fa' ? 'بخش‌های تنظیمات' : language === 'ku' ? 'بەشەکانی ڕێکخستن' : 'Settings Categories'}
              </span>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-start ${
                      isActive
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </div>
                    {isRtl ? <ChevronLeft className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

        {/* Modal Body: Master-Detail Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Sidebar Tabs */}
          <aside className="hidden sm:flex flex-col w-64 border-e border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 space-y-1 overflow-y-auto flex-shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-start ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80 translate-x-1 rtl:-translate-x-1'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{tab.label}</span>
                  </div>
                  {isRtl ? <ChevronLeft className={`w-4 h-4 transition-transform ${isActive ? 'text-sky-500' : 'opacity-40'}`} /> : <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'text-sky-500' : 'opacity-40'}`} />}
                </button>
              );
            })}
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-white dark:bg-slate-900">
            
            {/* ---------------------------------------------------- */}
            {/* TAB 1: GENERAL & THEME */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'general' && (
              <div className="space-y-6 w-full animate-in fade-in duration-150">
                
                {/* 1. Header card with Live Clock, Date & Quick Reset Button */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent dark:from-sky-950/40 dark:via-sky-900/20 border border-sky-200/80 dark:border-sky-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 flex-shrink-0">
                      <Clock className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-sky-700 dark:text-sky-300">
                        {language === 'fa' ? 'پیش‌نمایش زنده ساعت و تاریخ سیستم' : language === 'ku' ? 'پێشبینینی ڕاستەوخۆی کات و بەروار' : 'Live Clock & Date Preview'}
                      </div>
                      <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight mt-0.5">
                        {formatTime(modalClock, { timeFormat: timeFormat, timeZone: timeZone, numberFormat: numberFormat, includeSeconds: true })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex flex-col sm:items-end text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                        <span className="font-bold text-sky-600 dark:text-sky-400">
                          {timeZone === 'Asia/Tehran' ? (language === 'fa' ? 'تهران' : language === 'ku' ? 'تاران' : 'Tehran') :
                           timeZone === 'Asia/Baghdad' ? (language === 'fa' ? 'بغداد' : language === 'ku' ? 'بەغدا' : 'Baghdad') :
                           timeZone === 'Asia/Erbil' ? (language === 'fa' ? 'اربیل / هه‌ولێر' : language === 'ku' ? 'هەولێر' : 'Erbil') :
                           timeZone}
                        </span>
                      </div>
                      <span className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-1">
                        {formatDate(modalClock, { calendarType: calendarType, numberFormat: numberFormat })}
                      </span>
                    </div>

                    {/* Reset to Factory Defaults Button */}
                    <button
                      type="button"
                      onClick={handleResetToDefaultSettings}
                      title={language === 'fa' ? 'بازنشانی تمام تنظیمات ظاهر و زمان به حالت اولیه' : language === 'ku' ? 'گەڕانەوە بۆ باری بنەڕەتی' : 'Reset all visual and time settings to default'}
                      className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 shadow-xs transition-all flex items-center gap-1.5 text-xs font-bold flex-shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{language === 'fa' ? 'بازنشانی تنظیمات' : language === 'ku' ? 'باری بنەڕەتی' : 'Reset Defaults'}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Responsive 2-Column Controls Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                  {/* === COLUMN 1: Visual Theme & Language === */}
                  <div className="space-y-6">
                    
                    {/* Card: Language Selection */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <Languages className="w-4 h-4 text-sky-500" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'زبان برنامه' : language === 'ku' ? 'زمانی بەرنامە' : 'Application Language'}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {language === 'fa' 
                          ? 'زبان رابط کاربری، پیام‌ها و گزارش‌های سیستم را انتخاب کنید:' 
                          : language === 'ku'
                          ? 'زمانی سیستەم و ڕاپۆرتەکان هەڵبژێرە:'
                          : 'Select UI language for interfaces, dialogs and reports:'}
                      </p>

                      {/* [APP_THEME_BUTTON] Segmented Control for Language */}
                      <div className="p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex gap-1">
                        {languagesList.map((lang) => {
                          const isActive = language === lang.code;
                          return (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => updateAppLanguage(lang.code)}
                              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out flex items-center justify-center gap-2 ${
                                isActive
                                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <span>{lang.flag}</span>
                              <span>{lang.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card: Theme (Day / Night) */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'پوسته و تم بصری' : language === 'ku' ? 'ڕووکار و شێواز' : 'Theme & Appearance'}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {language === 'fa' 
                          ? 'حالت نمایش محیط نرم‌افزار برای راحتی چشم در نور روز یا تاریکی شب:' 
                          : language === 'ku'
                          ? 'شێوازی پیشاندانی بەرنامە لە ڕۆژ یاخود شەودا:'
                          : 'Switch between light daylight and dark night modes:'}
                      </p>

                      {/* [APP_THEME_BUTTON] Segmented Control for Theme */}
                      <div className="p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateAppTheme('light')}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out flex items-center justify-center gap-2 ${
                            themeMode === 'light'
                              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <Sun className="w-4 h-4 text-amber-300" />
                          <span>{language === 'fa' ? 'روز (روشن)' : language === 'ku' ? 'ڕۆژ (ڕووناک)' : 'Light'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAppTheme('dark')}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out flex items-center justify-center gap-2 ${
                            themeMode === 'dark'
                              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <Moon className="w-4 h-4 text-indigo-300" />
                          <span>{language === 'fa' ? 'شب (تاریک)' : language === 'ku' ? 'شەو (تاریک)' : 'Dark'}</span>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* === COLUMN 2: Calendar, Clock & Digits === */}
                  <div className="space-y-6">

                    {/* Card: Calendar & Timezone */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'سیستم گاه‌شماری و تقویم' : language === 'ku' ? 'سیستەمی ڕۆژمێر' : 'Calendar & Timezone'}
                        </h4>
                      </div>

                      {/* Calendar System Segmented */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                          {language === 'fa' ? 'نوع تقویم کاری:' : language === 'ku' ? 'جۆری ڕۆژمێر:' : 'Calendar Type:'}
                        </label>
                        <div className="p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex gap-1">
                          <button
                            type="button"
                            onClick={() => updateAppCalendar('jalali')}
                            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out text-center ${
                              calendarType === 'jalali'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {language === 'fa' ? 'شمسی (خورشیدی)' : language === 'ku' ? 'کۆچی هەتاوی' : 'Solar Hijri'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAppCalendar('gregorian')}
                            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out text-center ${
                              calendarType === 'gregorian'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {language === 'fa' ? 'میلادی' : language === 'ku' ? 'زاینی' : 'Gregorian'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAppCalendar('auto')}
                            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out text-center ${
                              calendarType === 'auto'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {language === 'fa' ? 'خودکار' : language === 'ku' ? 'خۆکار' : 'Auto'}
                          </button>
                        </div>
                      </div>

                      {/* Timezone Select */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                          {language === 'fa' ? 'منطقه زمانی شهر و کارگاه:' : language === 'ku' ? 'ناوچەی کاتی:' : 'Time Zone:'}
                        </label>
                        <select
                          value={timeZone}
                          onChange={(e) => updateAppTimeZone(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                        >
                          <option value="Asia/Tehran">
                            {language === 'fa' ? 'تهران (ایران - ۳:۳۰+)' : language === 'ku' ? 'تاران (ئێران)' : 'Tehran (UTC+3:30)'}
                          </option>
                          <option value="Asia/Baghdad">
                            {language === 'fa' ? 'بغداد (عراق - ۳:۰۰+)' : language === 'ku' ? 'بەغدا (عێراق)' : 'Baghdad (UTC+3:00)'}
                          </option>
                          <option value="Asia/Erbil">
                            {language === 'fa' ? 'اربیل / هه‌ولێر (اقلیم کردستان - ۳:۰۰+)' : language === 'ku' ? 'هەولێر (کوردستان)' : 'Erbil (UTC+3:00)'}
                          </option>
                          <option value="Asia/Dubai">
                            {language === 'fa' ? 'دبی (امارات - ۴:۰۰+)' : language === 'ku' ? 'دوبەی (ئیمارات)' : 'Dubai (UTC+4:00)'}
                          </option>
                          <option value="Asia/Istanbul">
                            {language === 'fa' ? 'استانبول (ترکیه - ۳:۰۰+)' : language === 'ku' ? 'ئیستەنبوڵ (تورکیا)' : 'Istanbul (UTC+3:00)'}
                          </option>
                          <option value="UTC">
                            {language === 'fa' ? 'ساعت هماهنگ جهانی (UTC)' : language === 'ku' ? 'کاتی گەردوونی (UTC)' : 'UTC (Coordinated Universal Time)'}
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Card: Time & Numbers Format */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'فرمت زمان و ارقام' : language === 'ku' ? 'شێوازی کات و ژمارە' : 'Time & Digits Format'}
                        </h4>
                      </div>

                      {/* Time format (24h / 12h) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                          {language === 'fa' ? 'نحوه نمایش ساعت:' : language === 'ku' ? 'شێوازی کاتژمێر:' : 'Time Display:'}
                        </label>
                        <div className="p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex gap-1">
                          <button
                            type="button"
                            onClick={() => updateAppTimeFormat('24h')}
                            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out text-center ${
                              timeFormat === '24h'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {language === 'fa' ? '۲۴ ساعته (۱۴:۳۰)' : language === 'ku' ? '٢٤ کاتژمێری' : '24-hour'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAppTimeFormat('12h')}
                            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out text-center ${
                              timeFormat === '12h'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {language === 'fa' ? '۱۲ ساعته (۲:۳۰ بعدازظهر)' : language === 'ku' ? '١٢ کاتژمێری' : '12-hour'}
                          </button>
                        </div>
                      </div>

                      {/* Number Digits Format */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                          {language === 'fa' ? 'رسم‌الخط اعداد و مبالغ:' : language === 'ku' ? 'شێوازی ژمارەکان:' : 'Digits Format:'}
                        </label>
                        <div className="p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex gap-1">
                          <button
                            type="button"
                            onClick={() => updateAppNumberFormat('fa')}
                            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out text-center ${
                              numberFormat === 'fa'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="font-mono text-sm block">۱۲۳,۴۵۶</span>
                            <span className="text-[10px] opacity-80">{language === 'fa' ? 'فارسی' : language === 'ku' ? 'فارسی' : 'Persian'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAppNumberFormat('latin')}
                            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out text-center ${
                              numberFormat === 'latin'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="font-mono text-sm block">123,456</span>
                            <span className="text-[10px] opacity-80">{language === 'fa' ? 'انگلیسی' : language === 'ku' ? 'ئینگلیزی' : 'Latin'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAppNumberFormat('ar')}
                            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out text-center ${
                              numberFormat === 'ar'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="font-mono text-sm block">١٢٣,٤٥٦</span>
                            <span className="text-[10px] opacity-80">{language === 'fa' ? 'عربی شرقی' : language === 'ku' ? 'عەرەبی' : 'Arabic'}</span>
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 2: PROJECTS & WORKSHOP STRUCTURE */}
            {/* ---------------------------------------------------- */}
            {/* ---------------------------------------------------- */}
            {/* TAB: USERS & ACCESS */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'users' && (
              <div className="h-full">
                <UsersSettingsTab />
              </div>
            )}
            {activeTab === 'projects' && (
              <div className="space-y-6 w-full animate-in fade-in duration-150">
                {/* 1. Projects Carousel / Cards Bar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-sky-500" />
                        <span>{language === 'fa' ? 'پروژه‌ها و کارگاه‌های فعال' : language === 'ku' ? 'پڕۆژە و کارگە چالاکەکان' : 'Active Projects & Workshops'}</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {language === 'fa' ? 'برای ویرایش مشخصات یا مدیریت بخش‌ها، پروژه مورد نظر را انتخاب کنید' : language === 'ku' ? 'پڕۆژەیەک هەڵبژێرە بۆ بەڕێوەبردن' : 'Select a project to edit details or manage sections'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNewProjectModalOpen(true)}
                      className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white transition-all duration-300 ease-in-out shadow-md shadow-sky-500/25 active:scale-95 hover:scale-105 group flex items-center gap-2 font-bold text-xs focus:outline-hidden"
                      title={language === 'fa' ? 'ایجاد پروژه جدید' : language === 'ku' ? 'پڕۆژەی نوێ' : 'New Project'}
                      aria-label={language === 'fa' ? 'ایجاد پروژه جدید' : language === 'ku' ? 'پڕۆژەی نوێ' : 'New Project'}
                    >
                      <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
                      <span>{language === 'fa' ? 'پروژه جدید' : language === 'ku' ? 'پڕۆژەی نوێ' : 'New Project'}</span>
                    </button>
                  </div>

                  {/* Project Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeProjects.map((p) => {
                      const isSelected = p.id === targetProjectId;
                      const isDefault = p.id === DEFAULT_PROJECT_ID;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setEditingProjectId(p.id);
                            switchProject(p.id);
                          }}
                          className={`p-3.5 rounded-2xl border text-start cursor-pointer transition-all relative group flex flex-col justify-between ${
                            isSelected
                              ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 shadow-md shadow-sky-500/10 ring-2 ring-sky-500/20'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? 'bg-sky-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}>
                                {p.currency || p.base_currency || 'IQD'}
                              </span>

                              <div className="flex items-center gap-1">
                                {isDefault && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    {language === 'fa' ? 'پیش‌فرض' : language === 'ku' ? 'بنەڕەتی' : 'Default'}
                                  </span>
                                )}
                                {!isDefault && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTargetProject(p.id);
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors opacity-0 group-hover:opacity-100"
                                    title={language === 'fa' ? 'حذف پروژه' : language === 'ku' ? 'سڕینەوەی پڕۆژە' : 'Delete Project'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                              <span>⏰ {p.standardWorkHours || 8} {language === 'fa' ? 'ساعت' : language === 'ku' ? 'کاتژمێر' : 'hours'}</span>
                              <span>⚡ ×{p.overtimeMultiplier || 1.0}</span>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                            <span className={`font-medium ${isSelected ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-400'}`}>
                              {isSelected 
                                ? (language === 'fa' ? '✓ در حال مدیریت' : language === 'ku' ? '✓ چالاکە' : '✓ Managing') 
                                : (language === 'fa' ? 'انتخاب پروژه' : language === 'ku' ? 'دیاریکردن' : 'Select Project')}
                            </span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Management Workspace for Target Project */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                  {/* Sub-Tabs Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700/80">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs">
                        {targetProject?.name ? targetProject.name.slice(0, 1) : 'P'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {targetProject?.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {language === 'fa' ? 'تنظیمات، بخش‌ها و تیم‌های کاری' : language === 'ku' ? 'ڕێکخستن و بەشەکان' : 'Settings, sections & teams'}
                        </div>
                      </div>
                    </div>

                    {/* Grouped/Tabbed Buttons [APP_THEME_BUTTON] */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                      {/* Sub-tab 1: Details */}
                      <button
                        type="button"
                        onClick={() => setProjectSubTab('details')}
                        title={language === 'fa' ? 'مشخصات و قوانین عمومی پروژه' : language === 'ku' ? 'تایبەتمەندییەکان' : 'General Details & Rules'}
                        className={`relative flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all duration-300 ease-in-out ${
                          projectSubTab === 'details'
                            ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/25 font-bold border border-sky-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Building className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />
                        {projectSubTab === 'details' && (
                          <span className="text-xs font-bold px-1.5 whitespace-nowrap animate-in fade-in duration-200">
                            {language === 'fa' ? 'مشخصات و قوانین' : language === 'ku' ? 'تایبەتمەندییەکان' : 'Details & Rules'}
                          </span>
                        )}
                      </button>

                      {/* Sub-tab 2: Sections */}
                      <button
                        type="button"
                        onClick={() => setProjectSubTab('sections')}
                        title={language === 'fa' ? 'بخش‌های پروژه (Sections)' : language === 'ku' ? 'بەشەکانی پڕۆژە' : 'Project Sections'}
                        className={`relative flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all duration-300 ease-in-out ${
                          projectSubTab === 'sections'
                            ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/25 font-bold border border-sky-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Layers className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />
                        {projectSubTab === 'sections' && (
                          <span className="text-xs font-bold px-1.5 whitespace-nowrap flex items-center gap-1.5 animate-in fade-in duration-200">
                            <span>{language === 'fa' ? 'بخش‌های پروژه' : language === 'ku' ? 'بەشەکان' : 'Project Sections'}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                              {projectSections.length}
                            </span>
                          </span>
                        )}
                      </button>

                      {/* Sub-tab 3: Groups */}
                      <button
                        type="button"
                        onClick={() => setProjectSubTab('groups')}
                        title={language === 'fa' ? 'تیم‌ها و گروه‌های کاری (Work Teams)' : language === 'ku' ? 'تیمەکان و گروپەکانی کار' : 'Work Teams & Groups'}
                        className={`relative flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all duration-300 ease-in-out ${
                          projectSubTab === 'groups'
                            ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/25 font-bold border border-sky-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Users2 className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />
                        {projectSubTab === 'groups' && (
                          <span className="text-xs font-bold px-1.5 whitespace-nowrap flex items-center gap-1.5 animate-in fade-in duration-200">
                            <span>{language === 'fa' ? 'تیم‌ها و گروه‌ها' : language === 'ku' ? 'تیمەکان' : 'Teams & Groups'}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                              {projectGroups.length}
                            </span>
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Sub-Tab 1: General Details & Financial Rules */}
                  {projectSubTab === 'details' && (
                    <form onSubmit={handleSaveProjectInfo} className="space-y-4 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'نام پروژه یا کارگاه' : language === 'ku' ? 'ناوی پڕۆژە یان کارگە' : 'Project / Workshop Name'}
                          </label>
                          <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'ارز مبنای پروژه' : language === 'ku' ? 'دراوی پڕۆژە' : 'Base Currency'}
                          </label>
                          <select
                            value={projectCurrency}
                            onChange={(e) => setProjectCurrency(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                          >
                            <option value="IQD">{language === 'fa' ? 'دینار عراق (IQD)' : language === 'ku' ? 'دیناری عێراقی (IQD)' : 'Iraqi Dinar (IQD)'}</option>
                            <option value="USD">{language === 'fa' ? 'دلار آمریکا (USD)' : language === 'ku' ? 'دۆلاری ئەمریکی (USD)' : 'US Dollar (USD)'}</option>
                            <option value="IRR">{language === 'fa' ? 'تومان ایران (IRR)' : language === 'ku' ? 'تومەنی ئێران (IRR)' : 'Iranian Toman (IRR)'}</option>
                            <option value="EUR">{language === 'fa' ? 'یورو (EUR)' : language === 'ku' ? 'یۆرۆ (EUR)' : 'Euro (EUR)'}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'ساعت کار استاندارد روزانه' : language === 'ku' ? 'کاتژمێری ئاسایی ڕۆژانە' : 'Standard Daily Work Hours'}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={projectHours}
                            onChange={(e) => setProjectHours(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'ضریب محاسبه اضافه‌کاری' : language === 'ku' ? 'زەریبی ئۆڤەرتایم' : 'Overtime Multiplier'}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="3"
                            value={projectOvertime}
                            onChange={(e) => setProjectOvertime(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-800">
                        {projectSaveSuccess ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            <span>{language === 'fa' ? 'تغییرات با موفقیت ذخیره شد' : language === 'ku' ? 'گۆڕانکارییەکان پاشەکەوتکران' : 'Changes saved successfully'}</span>
                          </span>
                        ) : <span />}

                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20"
                        >
                          {language === 'fa' ? 'ذخیره تغییرات پروژه' : language === 'ku' ? 'پاشەکەوتکردنی پڕۆژە' : 'Save Project Changes'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Sub-Tab 2: Sections with Inline Edit & Delete */}
                  {projectSubTab === 'sections' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <form onSubmit={handleAddSection} className="flex gap-2">
                        <input
                          type="text"
                          placeholder={language === 'fa' ? 'نام بخش جدید (مثلاً: سوله شرقی، فونداسیون، نما)...' : language === 'ku' ? 'ناوی بەشی نوێ...' : 'New section name (e.g. Foundation, Facade)...'}
                          value={newSectionName}
                          onChange={(e) => setNewSectionName(e.target.value)}
                          className="flex-1 px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          type="submit"
                          disabled={!newSectionName.trim()}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/20"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{language === 'fa' ? 'افزودن بخش' : language === 'ku' ? 'زیادکردن' : 'Add Section'}</span>
                        </button>
                      </form>

                      {projectSections.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                          {language === 'fa' ? 'هنوز بخشی برای این پروژه ثبت نشده است.' : language === 'ku' ? 'هیچ بەشێک تۆمار نەکراوە.' : 'No sections registered for this project yet.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
                          {projectSections.map((sec) => {
                            const isEditing = editingSectionId === sec.id;
                            return (
                              <div
                                key={sec.id}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 group transition-all"
                              >
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <input
                                      type="text"
                                      value={editingSectionName}
                                      onChange={(e) => setEditingSectionName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSaveEditSection(sec.id);
                                        } else if (e.key === 'Escape') {
                                          setEditingSectionId(null);
                                        }
                                      }}
                                      autoFocus
                                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-sky-400 text-slate-900 dark:text-white focus:outline-hidden"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditSection(sec.id)}
                                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                                      title={language === 'fa' ? 'ذخیره' : language === 'ku' ? 'پاشەکەوت' : 'Save'}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSectionId(null)}
                                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                      title={language === 'fa' ? 'انصراف' : language === 'ku' ? 'پاشگەزبوونەوە' : 'Cancel'}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2 truncate">
                                      <Layers className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                        {sec.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditSection(sec)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                        title={language === 'fa' ? 'ویرایش نام بخش' : language === 'ku' ? 'دەستکاریکردن' : 'Edit Section'}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSection(sec.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                        title={language === 'fa' ? 'حذف بخش' : language === 'ku' ? 'سڕینەوە' : 'Delete Section'}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-Tab 3: Work Teams with Inline Edit & Deduct Food Toggle */}
                  {projectSubTab === 'groups' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <form onSubmit={handleAddGroup} className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder={language === 'fa' ? 'نام تیم جدید (مثلاً: تیم قالب‌بندی، آرماتور، جوشکاری)...' : language === 'ku' ? 'ناوی تیمی نوێ...' : 'New team name (e.g. Carpentry, Welding)...'}
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="flex-1 px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        />
                        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newGroupDeductFood}
                            onChange={(e) => setNewGroupDeductFood(e.target.checked)}
                            className="rounded-sm text-emerald-600 focus:ring-0 w-4 h-4"
                          />
                          <span>{language === 'fa' ? 'کسر هزینه غذا' : language === 'ku' ? 'لێبڕینی نانخواردن' : 'Deduct Food Cost'}</span>
                        </label>
                        <button
                          type="submit"
                          disabled={!newGroupName.trim()}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-emerald-600/20"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{language === 'fa' ? 'افزودن تیم' : language === 'ku' ? 'زیادکردنی تیم' : 'Add Team'}</span>
                        </button>
                      </form>

                      {projectGroups.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                          {language === 'fa' ? 'هنوز گروه کاری برای این پروژه ثبت نشده است.' : language === 'ku' ? 'هیچ تیمێک تۆمار نەکراوە.' : 'No work teams registered for this project yet.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
                          {projectGroups.map((grp) => {
                            const isEditing = editingGroupId === grp.id;
                            return (
                              <div
                                key={grp.id}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 transition-all"
                              >
                                {isEditing ? (
                                  <div className="flex flex-col gap-2 flex-1">
                                    <input
                                      type="text"
                                      value={editingGroupName}
                                      onChange={(e) => setEditingGroupName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSaveEditGroup(grp.id);
                                        } else if (e.key === 'Escape') {
                                          setEditingGroupId(null);
                                        }
                                      }}
                                      autoFocus
                                      className="w-full px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-sky-400 text-slate-900 dark:text-white focus:outline-hidden"
                                    />
                                    <div className="flex items-center justify-between">
                                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={editingGroupDeductFood}
                                          onChange={(e) => setEditingGroupDeductFood(e.target.checked)}
                                          className="rounded-sm text-emerald-600 focus:ring-0"
                                        />
                                        <span>{language === 'fa' ? 'کسر هزینه غذا' : language === 'ku' ? 'لێبڕینی نان' : 'Deduct Food'}</span>
                                      </label>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveEditGroup(grp.id)}
                                          className="p-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>{language === 'fa' ? 'ذخیره' : language === 'ku' ? 'پاشەکەوت' : 'Save'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingGroupId(null)}
                                          className="p-1 px-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <Users2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                          {grp.name}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${grp.deductFoodExpense ? 'bg-amber-500' : 'bg-slate-400'}`} />
                                        <span>
                                          {grp.deductFoodExpense 
                                            ? (language === 'fa' ? 'با کسر هزینه غذای کارگاهی' : language === 'ku' ? 'بە لێبڕینی نانخواردن' : 'With Food Cost Deduction')
                                            : (language === 'fa' ? 'بدون کسر غذا' : language === 'ku' ? 'بێ لێبڕینی نانخواردن' : 'No Food Deduction')}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditGroup(grp)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                        title={language === 'fa' ? 'ویرایش مشخصات تیم' : language === 'ku' ? 'دەستکاریکردن' : 'Edit Team'}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteGroup(grp.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                        title={language === 'fa' ? 'حذف تیم' : language === 'ku' ? 'سڕینەوە' : 'Delete Team'}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 3: EXPENSE CATEGORIES (3-TIER HIERARCHY) */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'categories' && (
              <ExpenseCategoriesTab
                categories={allCategories}
                targetProjectId={targetProjectId}
                user={user}
                language={language}
                isRtl={isRtl}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
              />
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB: FINANCIAL ACCOUNTS & CASH BOXES */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'accounting_accounts' && (
              <div className="w-full animate-in fade-in duration-150">
                <AccountsSettingsTab
                  accounts={financialAccounts}
                  accountBalances={accountBalances}
                  globalOverdraftPolicy={globalOverdraftPolicy}
                  onUpdateGlobalOverdraftPolicy={updateGlobalOverdraftPolicy}
                  onAddAccount={addAccount}
                  onUpdateAccount={updateAccount}
                  onSetDefaultAccount={setDefaultAccount}
                  onDeleteAccount={deleteAccount}
                  currency={currentProject?.currency || 'IQD'}
                  language={language}
                />
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 4: DATA, CLOUD SYNC & BACKUP */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'sync_data' && (
              <DataSyncSettingsTab
                language={language}
                isRtl={isRtl}
                dbCounts={dbCounts}
                isSyncing={isSyncing}
                syncStatusMsg={syncStatusMsg}
                handleManualSync={handleManualSync}
                handleDownloadBackup={handleDownloadBackup}
                handleImportBackup={handleImportBackup}
                restoreMode={restoreMode}
                setRestoreMode={setRestoreMode}
                backupFile={backupFile}
                setBackupFile={setBackupFile}
                backupLoading={backupLoading}
                backupMsg={backupMsg}
              />
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB: KEYBOARD SHORTCUTS */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-6 w-full animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Keyboard className="w-5 h-5 text-sky-500" />
                      <span>{language === 'fa' ? 'راهنمای کلیدهای میانبر کیبورد' : language === 'ku' ? 'ڕێبەری شۆرتکاتەکانی کیبۆرد' : 'Keyboard Shortcuts Guide'}</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {language === 'fa'
                        ? 'برای افزایش چشمگیر سرعت عمل و ثبت داده‌ها بدون نیاز به ماوس در کامپیوتر یا لپ‌تاپ:'
                        : language === 'ku'
                        ? 'بۆ زیادکردنی خێرایی کارکردن و داخڵکردنی داتا بەبێ بەکارهێنانی ماوس لە کۆمپیوتەر:'
                        : 'Significantly speed up workflow and data entry without using a mouse on desktop:'}
                    </p>
                  </div>
                  <span className="self-start sm:self-center px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-mono font-bold border border-sky-500/20">
                    Desktop Power-User
                  </span>
                </div>

                {/* Section 1: Quick Actions & Forms */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>{language === 'fa' ? 'ثبت و عملیات سریع' : language === 'ku' ? 'تۆمارکردن و کردارە خێراکان' : 'Quick Actions & Log'}</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'ثبت کارکرد و حضور روزانه' : language === 'ku' ? 'تۆماری ئامادەبوونی ڕۆژانە' : 'Log Daily Attendance'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'باز کردن مودال سریع ثبت لاگ' : language === 'ku' ? 'کردنەوەی مۆداڵی تۆماری ڕۆژ' : 'Open quick daily log modal'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 shadow-xs">D</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : language === 'ku' ? 'یان' : 'or'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 shadow-xs">D</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'تاریخچه فعالیت‌ها (لاگ)' : language === 'ku' ? 'مێژووی چالاکییەکان' : 'Activity History (Logs)'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'مشاهده تاریخچه سیستم و کاربران' : language === 'ku' ? 'بینینی مێژووی سیستەم' : 'View system and user history'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 shadow-xs">L</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : language === 'ku' ? 'یان' : 'or'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 shadow-xs">L</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'ثبت هزینه و فاکتور جدید' : language === 'ku' ? 'تۆمارکردنی خەرجی نوێ' : 'Record New Expense'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'فرم سریع افزودن فاکتور هزینه' : language === 'ku' ? 'فۆرمی خێرای خەرجی کارگە' : 'Quick add expense invoice modal'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-600 shadow-xs">E</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : language === 'ku' ? 'یان' : 'or'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-600 shadow-xs">E</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'تسویه حساب و پرداخت مالی' : language === 'ku' ? 'حیساباتی شایستە و پارەدان' : 'Settlement & Payment'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'مودال تسویه طلب کارگران' : language === 'ku' ? 'مۆداڵی تەسویەی پارەی کرێکار' : 'Worker wage settlement modal'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600 shadow-xs">S</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : language === 'ku' ? 'یان' : 'or'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600 shadow-xs">S</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'افزودن پرسنل / کارگر جدید' : language === 'ku' ? 'زیادکردنی کرێکاری نوێ' : 'Add Worker / Staff'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'باز کردن فرم ثبت کارگر جدید' : language === 'ku' ? 'فۆرمی تۆمارکردنی کرێکار' : 'Open new worker registration form'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-600 shadow-xs">W</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : language === 'ku' ? 'یان' : 'or'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-600 shadow-xs">W</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'مدیریت وظایف و تسک‌ها' : language === 'ku' ? 'بەڕێوەبردنی ئەرکەکان و کارەکان' : 'Task Management'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'مشاهده و ثبت تسک‌های پروژه' : language === 'ku' ? 'بینین و تۆمارکردنی ئەرکەکان' : 'View and create project tasks'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 shadow-xs">T</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'معین افراد و حساب‌ها' : language === 'ku' ? 'دەفتەری حیسابی کەسەکان و حیسابەکان' : 'Account & Person Ledger'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'سرچ‌باکس سریع گردش مالی و اسناد معین' : language === 'ku' ? 'گەڕانی خێرای دەفتەری حیسابات' : 'Quick search for ledgers & transactions'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600 shadow-xs">M</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'طرف‌حساب‌ها و اشخاص' : language === 'ku' ? 'لایەنەکان و کەسایەتییەکان' : 'Counterparties & Contacts'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'مدیریت تامین‌کنندگان، کارفرمایان و پیمانکاران' : language === 'ku' ? 'بەڕێوەبردنی لایەنەکانی ژمێریاری' : 'Manage suppliers, clients & contractors'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 shadow-xs">C</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'مدیریت پروژه‌ها و بخش‌ها' : language === 'ku' ? 'بەڕێوەبردنی پڕۆژە و بەشەکان' : 'Projects & Structure'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'تنظیمات قوانین کارگاه، بخش‌ها و تیم‌های کاری' : language === 'ku' ? 'ڕێکخستنی پڕۆژە، بەشەکان و تیمەکان' : 'Workshop rules, sections & work teams'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600 shadow-xs">O</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'مودال مدیریت پرسنل و کارگران' : language === 'ku' ? 'مۆداڵی بەڕێوەبردنی کرێکاران و پرسنل' : 'Personnel & Workers Modal'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'مشاهده و مدیریت لیست جامع پرسنل (تمام‌صفحه)' : language === 'ku' ? 'بینین و بەڕێوەبردنی تەواوی کرێکاران' : 'Full-screen personnel directory'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 shadow-xs">P</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Tab Navigation */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                    <span>{language === 'fa' ? 'ناوبری و جابه‌جایی بین تب‌ها' : language === 'ku' ? 'گۆڕینی پەڕە و بەشەکان' : 'Tab Navigation'}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'داشبورد مدیریتی' : language === 'ku' ? 'داشبۆردی بەڕێوەبردن' : 'Management Dashboard'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">1</kbd>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'تقویم و گزارش کارکرد' : language === 'ku' ? 'ڕۆژمێر و ڕاپۆرتی کار' : 'Calendar & Attendance'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">2</kbd>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'مدیریت هزینه‌ها' : language === 'ku' ? 'خەرجییەکان' : 'Expense Management'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">3</kbd>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'حسابداری و امور مالی' : language === 'ku' ? 'ژمێریاری و دارایی' : 'Accounting & Finance'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">4</kbd>
                    </div>
                  </div>
                </div>

                {/* Section 3: System & Modals */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                    <span>{language === 'fa' ? 'سیستم و کنترل پنجره‌ها' : language === 'ku' ? 'سیستەم و کۆنترۆڵەکان' : 'System & Windows'}</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'تنظیمات سراسری' : language === 'ku' ? 'ڕێکخستنی سیستەم' : 'Global Settings'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'باز کردن پنجره تنظیمات' : language === 'ku' ? 'کردنەوەی ڕێکخستن' : 'Open settings window'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[24px] h-7 px-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">,</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'راهنمای شورتکات‌ها' : language === 'ku' ? 'ڕێبەری میانبڕەکان' : 'Shortcuts Guide'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'مشاهده همین صفحه' : language === 'ku' ? 'پیشاندانی ئەم پەڕەیە' : 'View this guide'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 shadow-xs">?</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'بستن پنجره‌ها' : language === 'ku' ? 'داخستنی پەنجەرەکان' : 'Close Windows'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'خروج از مودال و فرم‌ها' : language === 'ku' ? 'داخستنی فۆرمەکان' : 'Exit modal and forms'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[36px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-600 shadow-xs">Esc</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Helpful Safety Tip */}
                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 flex items-start gap-3 text-xs leading-relaxed text-sky-900 dark:text-sky-300">
                  <Info className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">{language === 'fa' ? 'نکته هوشمند: ' : language === 'ku' ? 'تێبینی: ' : 'Smart Tip: '}</span>
                    <span>
                      {language === 'fa'
                        ? 'برای جلوگیری از بروز هرگونه خطا حین ورود اطلاعات مبالغ، نام‌ها یا جستجو، کلیدهای میانبر تک‌کاراکتری (مانند اعداد ۱ تا ۵ یا کلیدهای L و E) زمانی که در حال نوشتن داخل یک فیلد یا کادر جستجو هستید، موقتاً غیرفعال می‌شوند.'
                        : language === 'ku'
                        ? 'کلیدە تاکەکان لە کاتی نووسین لە ناو فۆرمەکاندا کار ناکەن تاکو بە هەڵە فەرمان نەدرێت.'
                        : 'Single-key shortcuts (like 1-5 or L and E) are temporarily disabled while typing inside inputs or search boxes to prevent unintended triggers.'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 5: ACCOUNT & SECURITY */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'account' && (
              <div className="space-y-6 w-full animate-in fade-in duration-150">
                {/* 2-Column Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  
                  {/* === COLUMN 1: User Identity, Profile & Role === */}
                  <div className="space-y-6">
                    {/* User Identity & Profile Edit Form */}
                    <form onSubmit={handleSaveProfile} className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <User className="w-4 h-4 text-sky-500" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'اطلاعات و پروفایل کاربری' : language === 'ku' ? 'پرۆفایل و زانیاری بەکارهێنەر' : 'User Profile & Identity'}
                        </h4>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                        {/* Avatar with Camera upload button */}
                        <div className="relative flex-shrink-0 self-start sm:self-center">
                          {profileAvatar ? (
                            <div className="relative group">
                              <img
                                src={profileAvatar}
                                alt={profileName || 'User'}
                                className="w-16 h-16 rounded-2xl object-cover border-2 border-sky-500/30 shadow-md"
                              />
                              <button
                                type="button"
                                onClick={handleRemoveAvatar}
                                className="absolute -top-1.5 -start-1.5 p-1 rounded-lg bg-rose-500 text-white shadow-md hover:bg-rose-600 transition-colors"
                                title={language === 'fa' ? 'حذف تصویر' : language === 'ku' ? 'سڕینەوەی وێنە' : 'Remove Photo'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white text-xl font-black flex items-center justify-center shadow-lg shadow-sky-500/20">
                              {profileName ? profileName.slice(0, 2).toUpperCase() : 'AZ'}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            className="absolute -bottom-1 -end-1 p-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md hover:scale-105 active:scale-95 transition-all"
                            title={language === 'fa' ? 'تغییر عکس پروفایل' : language === 'ku' ? 'گۆڕینی وێنە' : 'Change Profile Photo'}
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFile}
                            className="hidden"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {language === 'fa' ? 'حساب کاربری مدیریت' : language === 'ku' ? 'هەژماری بەڕێوەبەر' : 'Administrator Account'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                              Admin
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{user?.email || 'admin@karsync.com'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user?.companyName || (language === 'fa' ? 'کارگاه من' : language === 'ku' ? 'کارگەی من' : 'My Workshop')}</p>
                        </div>
                      </div>

                      {/* Name and Title Inputs */}
                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'نام و نام خانوادگی' : language === 'ku' ? 'ناوی تەواو' : 'Full Name'}
                          </label>
                          <input
                            type="text"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'عنوان و نقش در مجموعه' : language === 'ku' ? 'پلە یان ناونیشان لە کارگە' : 'Job Title & Role'}
                          </label>
                          <input
                            type="text"
                            value={profileTitle}
                            onChange={(e) => setProfileTitle(e.target.value)}
                            placeholder={language === 'fa' ? 'مثلاً: مدیر پروژه، سرپرست کارگاه، مدیر فنی...' : language === 'ku' ? 'وەک: بەڕێوەبەری پڕۆژە...' : 'e.g. Project Manager, Site Supervisor...'}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        {profileSaveSuccess ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            <span>{language === 'fa' ? 'مشخصات با موفقیت ذخیره شد' : language === 'ku' ? 'زانیارییەکان پاشەکەوتکران' : 'Profile updated successfully'}</span>
                          </span>
                        ) : <span />}

                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors shadow-sm"
                        >
                          {language === 'fa' ? 'ذخیره مشخصات کاربری' : language === 'ku' ? 'پاشەکەوتکردنی پرۆفایل' : 'Save Profile'}
                        </button>
                      </div>
                    </form>

                    {/* RBAC & Role Switcher */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-indigo-500" />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {language === 'fa' ? 'نقش کاربری و سطح دسترسی (RBAC)' : language === 'ku' ? 'ڕۆڵی بەکارهێنەر' : 'User Role & Permissions (RBAC)'}
                          </h4>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          (user?.role || 'admin') === 'admin' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}>
                          {(user?.role || 'admin') === 'admin' 
                            ? (language === 'fa' ? '👑 مدیر ارشد' : language === 'ku' ? '👑 بەڕێوەبەر' : '👑 Senior Admin') 
                            : (language === 'fa' ? '✍️ اپراتور ثبت داده' : language === 'ku' ? '✍️ تۆمارکار' : '✍️ Data Operator')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {language === 'fa' 
                          ? 'کنترل سطح دسترسی جهت تایید دو مرحله‌ای اسناد مالی، پرداخت‌ها و فاکتورها:' 
                          : language === 'ku'
                          ? 'کۆنترۆڵی دەسەڵاتەکانی پەسەندکردنی بەڵگەنامەکان:'
                          : 'Access control permissions for verifying transactions, payments and invoices:'}
                      </p>

                      <div>
                        <select
                          value={user?.role || 'admin'}
                          onChange={(e) => setUserRole(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                        >
                          <option value="admin">
                            {language === 'fa' ? '👑 مدیر سیستم (Admin) — دسترسی کامل و تایید نهایی اسناد' : language === 'ku' ? '👑 بەڕێوەبەر (Admin)' : '👑 System Admin — Full access & approval'}
                          </option>
                          <option value="operator">
                            {language === 'fa' ? '✍️ اپراتور ثبت داده (Operator) — فقط ثبت پیش‌نویس بدون تایید' : language === 'ku' ? '✍️ تۆمارکار (Operator)' : '✍️ Data Operator — Draft registration only'}
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Logout Card */}
                    <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
                          {language === 'fa' ? 'خروج امن از سیستم' : language === 'ku' ? 'چوونەدەرەوە لە سیستم' : 'Secure Logout'}
                        </div>
                        <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                          {language === 'fa' ? 'پایان دادن به نشست فعلی کاربری در این دستگاه' : language === 'ku' ? 'کۆتاییهێنان بە چوونەژوورەوەی ئێستا' : 'End current user session on this device'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(language === 'fa' ? 'آیا از خروج از حساب کاربری اطمینان دارید؟' : language === 'ku' ? 'ئایا لە چوونەدەرەوە دڵنیایت؟' : 'Are you sure you want to log out of your account?')) {
                            logout();
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-xs flex-shrink-0"
                      >
                        {language === 'fa' ? 'خروج از حساب' : language === 'ku' ? 'چوونەدەرەوە' : 'Log Out'}
                      </button>
                    </div>
                  </div>

                  {/* === COLUMN 2: Security Hardening, 2FA & Password === */}
                  <div className="space-y-6">
                    {/* Two-Factor Authentication (2FA) Card */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-sky-500" />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {language === 'fa' ? 'تایید هویت دو مرحله‌ای (2FA)' : language === 'ku' ? 'پشتڕاستکردنەوەی دوو قۆناغی' : 'Two-Factor Authentication (2FA)'}
                          </h4>
                        </div>

                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                          twoFactorConfig?.enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                          {twoFactorConfig?.enabled
                            ? (language === 'fa' ? 'فعال و امن' : language === 'ku' ? 'چالاکە' : 'Active & Secured')
                            : (language === 'fa' ? 'غیرفعال' : language === 'ku' ? 'ناچالاکە' : 'Disabled')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {language === 'fa'
                          ? 'با اتصال به Google Authenticator یا اپلیکیشن‌های سازگار، امنیت حساب و اطلاعات مالی شما در برابر نفوذ تضمین می‌شود.'
                          : language === 'ku'
                          ? 'بە بەستنەوە بە Google Authenticator، ئاسایشی هەژمار و زانیارییەکانت دەپارێزرێت.'
                          : 'With 2FA enabled, a 6-digit code from your authenticator app is required upon login.'}
                      </p>

                      <button
                        type="button"
                        onClick={() => setIs2FAModalOpen(true)}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        <span>
                          {twoFactorConfig?.enabled
                            ? (language === 'fa' ? 'مدیریت و مشاهده کدهای بازیابی ۲FA' : language === 'ku' ? 'بەڕێوەبردنی کۆدەکانی فریاگوزاری ٢FA' : 'Manage 2FA & Backup Codes')
                            : (language === 'fa' ? 'راه‌اندازی و فعال‌سازی ۲FA' : language === 'ku' ? 'چالاککردنی تایید دوو قۆناغی ٢FA' : 'Setup Two-Factor Authentication')}
                        </span>
                      </button>
                    </div>

                    {/* Change Password Form */}
                    <form onSubmit={handleChangePassword} className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <KeyRound className="w-4 h-4 text-amber-500" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'تغییر رمز عبور ورود به برنامه' : language === 'ku' ? 'گۆڕینی وشەی نهێنی' : 'Change Login Password'}
                        </h4>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          {language === 'fa' ? 'رمز عبور فعلی' : language === 'ku' ? 'وشەی نهێنی ئێستا' : 'Current Password'}
                        </label>
                        <input
                          type="password"
                          value={currentPass}
                          onChange={(e) => setCurrentPass(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'رمز عبور جدید' : language === 'ku' ? 'وشەی نهێنی نوێ' : 'New Password'}
                          </label>
                          <input
                            type="password"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'تکرار رمز عبور جدید' : language === 'ku' ? 'دووبارەکردنەوەی وشەی نهێنی نوێ' : 'Confirm New Password'}
                          </label>
                          <input
                            type="password"
                            value={confirmPass}
                            onChange={(e) => setConfirmPass(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                          />
                        </div>
                      </div>

                      {newPass && (
                        <div className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700">
                          <PasswordStrengthMeter password={newPass} showChecks={true} />
                        </div>
                      )}

                      {passMsg.text && (
                        <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                          passMsg.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                        }`}>
                          {passMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          <span>{passMsg.text}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end pt-1">
                        <button
                          type="submit"
                          disabled={passLoading}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm disabled:opacity-50"
                        >
                          {language === 'fa' ? 'به‌روزرسانی رمز عبور' : language === 'ku' ? 'نوێکردنەوەی تێپەڕەوشە' : 'Update Password'}
                        </button>
                      </div>
                    </form>

                    {/* Auto-Lock Screen & Security Badges */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'قفل خودکار صفحه و سپرهای امنیتی' : language === 'ku' ? 'قفڵکردنی خۆکار و پارێزبەندییەکان' : 'Auto-Lock & Security Shields'}
                        </h4>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                          {language === 'fa' ? 'مدت زمان بی‌حرکتی پیش از قفل شدن برنامه:' : language === 'ku' ? 'ماوەی ناچالاکی بۆ قفڵکردن:' : 'Inactivity timeout before auto-lock:'}
                        </label>
                        <select
                          value={autoLockMinutes}
                          onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                        >
                          <option value={0}>{language === 'fa' ? 'غیرفعال (عدم قفل خودکار)' : language === 'ku' ? 'ناچالاک' : 'Disabled (Never auto-lock)'}</option>
                          <option value={15}>{language === 'fa' ? '۱۵ دقیقه بی‌حرکتی' : language === 'ku' ? '١٥ خولەک' : '15 minutes inactivity'}</option>
                          <option value={30}>{language === 'fa' ? '۳۰ دقیقه بی‌حرکتی' : language === 'ku' ? '٣٠ خولەک' : '30 minutes inactivity'}</option>
                          <option value={60}>{language === 'fa' ? '۱ ساعت بی‌حرکتی' : language === 'ku' ? '١ کاتژمێر' : '1 hour inactivity'}</option>
                        </select>
                      </div>

                      {/* Security Status Badges */}
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                          {language === 'fa' ? 'سپرهای فعال پایگاه داده و اتصال KarSync:' : language === 'ku' ? 'قەڵغانە چالاکەکانی KarSync:' : 'Active Protection Layers:'}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                            <Check className="w-3.5 h-3.5" />
                            <span>HTTPS</span>
                          </div>
                          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                            <Check className="w-3.5 h-3.5" />
                            <span>SHA-256</span>
                          </div>
                          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                            <Check className="w-3.5 h-3.5" />
                            <span>Anti-Brute</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB: NOTIFICATIONS & SMART ALERTS */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'notifications' && (
              <NotificationsSettingsTab />
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 6: ABOUT & SYSTEM INFO */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'about' && (
              <div className="space-y-6 max-w-xl text-center mx-auto py-4 animate-in fade-in duration-150">
                <div className="w-16 h-16 mx-auto flex items-center justify-center flex-shrink-0">
                  <img
                    src="/karsync-icon.png"
                    alt="KarSync"
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">KarSync</h3>
                  <div className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-bold font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    <span>v0.9.0 • SaaS & Local-First PWA</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                  {language === 'fa'
                    ? 'سیستم جامع و پیشرفته مدیریت هوشمند کارگاه، ثبت حضور و غیاب، تسویه حساب‌های مالی، مدیریت سلسله‌مراتبی هزینه‌ها و همگام‌سازی ابری زنده.'
                    : language === 'ku'
                    ? 'سیستەمی پێشکەوتووی بەڕێوەبردنی کارگە، ئامادەبوون و حیساباتی شایستەی کرێکاران و خەرجییەکان.'
                    : 'Comprehensive smart workshop management system, attendance tracking, financial settlements, hierarchical expenses and live cloud sync.'}
                </p>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>{language === 'fa' ? 'طراحی و توسعه اختصاصی: افشین زارعی' : language === 'ku' ? 'دیزاین و پرۆگرامسازی: ئەفشین زارعی' : 'Designed & Developed by: Afshin Zarei'}</span>
                </div>

                <div className="text-[11px] text-slate-400">
                  © 2026 KarSync System. All rights reserved.
                </div>
              </div>
            )}

          </main>
        </div>

        {/* Global Modal Footer Bar (Save / Cancel / Close) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              {language === 'fa' 
                ? 'تنظیمات فعال: ' + (tabs.find((t) => t.id === activeTab)?.label || '')
                : language === 'ku'
                ? 'ڕێکخستنەکان: ' + (tabs.find((t) => t.id === activeTab)?.label || '')
                : 'Active Settings: ' + (tabs.find((t) => t.id === activeTab)?.label || '')}
            </span>
            {generalSaveSuccess && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4" />
                <span>{language === 'fa' ? 'ذخیره شد' : language === 'ku' ? 'پاشەکەوتکرا' : 'Saved'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{language === 'fa' ? 'بستن' : language === 'ku' ? 'داخستن' : 'Close'}</span>
            </button>
          </div>
        </div>

        {/* 2FA Security Modal */}
        <TwoFactorModal
          isOpen={is2FAModalOpen}
          onClose={() => setIs2FAModalOpen(false)}
        />
      </div>,
      document.body
    );
  }
