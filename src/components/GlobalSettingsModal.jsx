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
  Landmark
} from 'lucide-react';
import { TwoFactorModal } from './TwoFactorModal';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { evaluatePasswordStrength } from '../utils/passwordSecurity';
import { AccountsSettingsTab } from './accounting/AccountsSettingsTab';
import UsersSettingsTab from "./UsersSettingsTab";
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

  const [activeTab, setActiveTab] = useState(initialTab || 'general');
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
      setProfileTitle(user.title || (language === 'fa' ? 'مدیر ارشد کارگاه' : 'بەڕێوەبەری پڕۆژە'));
      setProfileAvatar(user.avatar || user.photo || user.supabaseUser?.user_metadata?.avatar_url || '');
    }
  }, [user, isOpen]);

  // Sync initial tab when modal opens or initialTab prop changes
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  // Keyboard shortcut listener (ESC to close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const handleSaveGeneralSettings = () => {
    if (draftLanguage !== language) changeLanguage(draftLanguage);
    if (draftTheme !== themeMode) {
      setThemeMode(draftTheme);
      if (draftTheme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
    if (draftTimeFormat !== timeFormat) setTimeFormat(draftTimeFormat);
    if (draftTimeZone !== timeZone) setTimeZone(draftTimeZone);
    if (draftCalendarType !== calendarType) setCalendarType(draftCalendarType);
    if (draftNumberFormat !== numberFormat) setNumberFormat(draftNumberFormat);

    setGeneralSaveSuccess(true);
    setTimeout(() => setGeneralSaveSuccess(false), 2500);
  };

  const handleCancelGeneralSettings = () => {
    setDraftLanguage(language);
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    setDraftTheme(isDark ? 'dark' : 'light');
    setDraftTimeFormat(timeFormat);
    setDraftTimeZone(timeZone);
    setDraftCalendarType(calendarType);
    setDraftNumberFormat(numberFormat);
  };

  // ----------------------------------------------------
  // Tab 1: General & Appearance States
  // ----------------------------------------------------
  const languagesList = [
    { code: 'fa', label: 'فارسی', sub: 'Persian' },
    { code: 'ku', label: 'کوردی (سۆرانی)', sub: 'Kurdish' },
    { code: 'en', label: 'English', sub: 'English' }
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

  const handleDeleteSection = async (secId) => {
    if (!window.confirm(language === 'fa' ? 'آیا از حذف این بخش اطمینان دارید؟' : 'ئایا لە سڕینەوەی ئەم بەشە دڵنیایت؟')) return;
    await deleteProjectSectionLive(secId);
  };

  // Groups of targeted project
  const projectGroups = useLiveQuery(
    () => db.groups.where('projectId').equals(targetProjectId).toArray(),
    [targetProjectId]
  ) || [];

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDeductFood, setNewGroupDeductFood] = useState(false);
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
    if (!window.confirm(language === 'fa' ? 'آیا از حذف این گروه کاری اطمینان دارید؟' : 'ئایا لە سڕینەوەی ئەم تیمە دڵنیایت؟')) return;
    await db.groups.delete(gId);
  };

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

  const level1Cats = useMemo(() => allCategories.filter((c) => !c.parentId || c.level === 1), [allCategories]);
  const [selectedL1Id, setSelectedL1Id] = useState(null);
  const [selectedL2Id, setSelectedL2Id] = useState(null);

  const level2Cats = useMemo(() => {
    if (!selectedL1Id) return [];
    return allCategories.filter((c) => c.parentId === selectedL1Id);
  }, [allCategories, selectedL1Id]);

  const level3Cats = useMemo(() => {
    if (!selectedL2Id) return [];
    return allCategories.filter((c) => c.parentId === selectedL2Id);
  }, [allCategories, selectedL2Id]);

  const [newCatName, setNewCatName] = useState('');
  const [catLevelToAdd, setCatLevelToAdd] = useState(1); // 1, 2, 3

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const cId = 'cat_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    let parentId = null;
    let level = 1;

    if (catLevelToAdd === 2 && selectedL1Id) {
      parentId = selectedL1Id;
      level = 2;
    } else if (catLevelToAdd === 3 && selectedL2Id) {
      parentId = selectedL2Id;
      level = 3;
    }

    const newCat = {
      id: cId,
      projectId: targetProjectId,
      userId: user?.id || 'admin',
      name: newCatName.trim(),
      parentId: parentId,
      level: level,
      createdAt: new Date().toISOString()
    };

    await pushExpenseCategoryLive(newCat);
    setNewCatName('');
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm(language === 'fa' ? 'آیا از حذف این سرفصل اطمینان دارید؟' : 'ئایا لە سڕینەوەی ئەم بابەتە دڵنیایت؟')) return;
    await deleteExpenseCategoryLive(catId);
    if (selectedL1Id === catId) setSelectedL1Id(null);
    if (selectedL2Id === catId) setSelectedL2Id(null);
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
      setSyncStatusMsg(language === 'fa' ? 'همگام‌سازی کامل با موفقیت انجام شد' : 'هاوکاتکردنی تەواو ئەنجامدرا');
      setTimeout(() => setSyncStatusMsg(''), 3000);
    } catch (err) {
      setSyncStatusMsg(language === 'fa' ? 'خطا در برقراری ارتباط با سرور ابری' : 'هەڵە لە هاوکاتکردن');
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
        text: language === 'fa' ? 'فایل پشتیبان با موفقیت دانلود شد' : 'فایلی یەدەگ بە سەرکەوتوویی داگیرا'
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
        text: language === 'fa' ? 'لطفاً ابتدا یک فایل JSON معتبر انتخاب کنید' : 'تکایە فایلی یەدەگ دیاریبکە'
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
            text: language === 'fa' ? 'اطلاعات با موفقیت بازیابی شد' : 'زانیارییەکان بە سەرکەوتوویی هێنرانەوە'
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
      alert(language === 'fa' ? 'حجم تصویر نباید بیشتر از ۵ مگابایت باشد' : 'قەبارەی وێنە نابێت لە ٥ مێگابایت زیاتر بێت');
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
        text: language === 'fa' ? 'رمز عبور جدید و تکرار آن یکسان نیستند' : 'وشەی نهێنی نوێ و دووبارەکردنەوەی وەک یەک نین'
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
          text: language === 'fa' ? 'رمز عبور با موفقیت به‌روزرسانی شد' : 'وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە'
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

  // Sidebar navigation tabs
  const tabs = [
    {
      id: 'general',
      label: language === 'fa' ? 'عمومی و ظاهر' : language === 'ku' ? 'گشتی و ڕووکار' : 'General & Theme',
      icon: Settings,
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
      id: 'account',
      label: language === 'fa' ? 'حساب کاربری و امنیت' : language === 'ku' ? 'هەژمار و ئاسایش' : 'Account & Security',
      icon: User,
      color: 'text-sky-500'
    },
    {
      id: 'about',
      label: language === 'fa' ? 'درباره و نسخه' : language === 'ku' ? 'دەربارە و وەشان' : 'About & Version',
      icon: Info,
      color: 'text-sky-500'
    }
  ];

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
                KarSync v1.2.0
              </span>
              {/* On mobile: display active tab title */}
              <span className="sm:hidden text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                {tabs.find((t) => t.id === activeTab)?.label}
              </span>
            </h2>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
              {language === 'fa' ? 'مدیریت یکپارچه ظاهر، پروژه‌ها، سرفصل‌ها و همگام‌سازی ابری' : 'بەڕێوەبردنی گشتی پڕۆژە، ڕووکار و بنکەدراوە'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title={language === 'fa' ? 'بستن (Esc)' : 'Close'}
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
                {language === 'fa' ? 'بخش‌های تنظیمات' : 'بەشەکانی ڕێکخستن'}
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
              <div className="space-y-6 max-w-3xl animate-in fade-in duration-150">
                
                {/* Header card with Live Clock & Date */}
                <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20 flex-shrink-0">
                      <Clock className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
                        {language === 'fa' ? 'پیش‌نمایش زنده ساعت و تاریخ برنامه' : 'پێشبینینی کات و بەروار'}
                      </div>
                      <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight mt-0.5">
                        {formatTime(modalClock, { timeFormat: draftTimeFormat, timeZone: draftTimeZone, numberFormat: draftNumberFormat, includeSeconds: true })}
                      </div>
                    </div>
                  </div>

                  <div className="self-start sm:self-center flex flex-col sm:items-end text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {TIMEZONE_OPTIONS.find(tz => tz.id === draftTimeZone)?.name[language] || draftTimeZone}
                      </span>
                    </div>
                    <span className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-1">
                      {formatDate(modalClock, { calendarType: draftCalendarType, numberFormat: draftNumberFormat })}
                    </span>
                  </div>
                </div>

                {/* Unified Dropdown Form Settings Grid */}
                <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-5">
                  <div className="border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-sky-500" />
                      <span>{language === 'fa' ? 'تنظیمات زبان، ظاهر و ارقام' : 'ڕێکخستنی زمان، ڕووکار و ژمارەکان'}</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {language === 'fa'
                        ? 'تمام تنظیمات ظاهری، زبان، تم و تقویم از طریق منوهای آبشاری زیر قابل انتخاب هستند.'
                        : 'هەموو ڕێکخستنەکان لەم لیستە داگرتووانەی خوارەوە بەردەستن.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. Language Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5 text-sky-500" />
                        <span>{language === 'fa' ? 'زبان برنامه (Language)' : 'زمانی بەرنامە'}</span>
                      </label>
                      <select
                        value={draftLanguage}
                        onChange={(e) => setDraftLanguage(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                      >
                        {languagesList.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.label} ({lang.sub})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Theme Mode Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        {draftTheme === 'dark' ? <Moon className="w-3.5 h-3.5 text-sky-500" /> : <Sun className="w-3.5 h-3.5 text-sky-500" />}
                        <span>{language === 'fa' ? 'پوسته و تم (Theme)' : 'ڕووکار و دۆخ'}</span>
                      </label>
                      <select
                        value={draftTheme}
                        onChange={(e) => setDraftTheme(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                      >
                        <option value="light">☀️ {language === 'fa' ? 'حالت روز (روشن) - Light Mode' : 'دۆخی ڕۆژ (ڕووناک)'}</option>
                        <option value="dark">🌙 {language === 'fa' ? 'حالت شب (تاریک) - Dark Mode' : 'دۆخی شەو (تاریک)'}</option>
                      </select>
                    </div>

                    {/* 3. Time Format Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        <span>{language === 'fa' ? 'فرمت نمایش ساعت (Time Format)' : 'شێوازی کاتژمێر'}</span>
                      </label>
                      <select
                        value={draftTimeFormat}
                        onChange={(e) => setDraftTimeFormat(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                      >
                        <option value="24h">
                          {language === 'fa' ? '۲۴ ساعته (استاندارد / نظامی - ۱۴:۳۰)' : '٢٤ کاتژمێری (ستاندارد)'}
                        </option>
                        <option value="12h">
                          {language === 'fa' ? '۱۲ ساعته (با ق.ظ / ب.ظ - ۰۲:۳۰ ب.ظ)' : '١٢ کاتژمێری (بەیانی / ئێوارە)'}
                        </option>
                      </select>
                    </div>

                    {/* 4. Time Zone Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        <span>{language === 'fa' ? 'منطقه زمانی (Time Zone)' : 'ناوچەی کاتی'}</span>
                      </label>
                      <select
                        value={draftTimeZone}
                        onChange={(e) => setDraftTimeZone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                      >
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <option key={tz.id} value={tz.id}>
                            {tz.name[language] || tz.name.en} ({tz.sub})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 5. Calendar System Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-sky-500" />
                        <span>{language === 'fa' ? 'سیستم تقویم کاری (Calendar System)' : 'سیستەمی ڕۆژمێر'}</span>
                      </label>
                      <select
                        value={draftCalendarType}
                        onChange={(e) => setDraftCalendarType(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                      >
                        {CALENDAR_OPTIONS.map((cal) => (
                          <option key={cal.id} value={cal.id}>
                            {cal.name[language] || cal.name.en} ({cal.sub})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 6. Number Format Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span className="text-sky-500 font-mono font-black text-xs">#</span>
                        <span>{language === 'fa' ? 'فرمت نمایش ارقام و اعداد (Number Digits)' : 'شێوازی پیشاندانی ژمارەکان'}</span>
                      </label>
                      <select
                        value={draftNumberFormat}
                        onChange={(e) => setDraftNumberFormat(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                      >
                        {NUMBER_FORMAT_OPTIONS.map((num) => (
                          <option key={num.id} value={num.id}>
                            {num.name[language] || num.name.en} — ({num.sub})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Save / Cancel Action Bar for General Settings */}
                  <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {generalSaveSuccess && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                          <Check className="w-4 h-4" />
                          <span>{language === 'fa' ? 'تنظیمات با موفقیت ذخیره شد' : 'ڕێکخستنەکان پاشەکەوت کران'}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={handleCancelGeneralSettings}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                      >
                        {language === 'fa' ? 'انصراف / بازنشانی' : 'پاشگەزبوونەوە'}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveGeneralSettings}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
                      >
                        <Check className="w-4 h-4" />
                        <span>{language === 'fa' ? 'ذخیره تنظیمات' : 'پاشەکەوتکردن'}</span>
                      </button>
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
              <div className="space-y-6 max-w-3xl animate-in fade-in duration-150">
                {/* Project Selector & Actions Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {language === 'fa' ? 'پروژه در حال ویرایش:' : 'پڕۆژەی دەستکاریکراو:'}
                      </div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        {targetProject?.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={targetProjectId}
                      onChange={(e) => {
                        setEditingProjectId(e.target.value);
                        switchProject(e.target.value);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    >
                      {activeProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.currency || 'IQD'})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsNewProjectModalOpen(true)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{language === 'fa' ? 'پروژه جدید' : 'پڕۆژەی نوێ'}</span>
                    </button>
                  </div>
                </div>

                {/* Edit Project Details Form */}
                <form onSubmit={handleSaveProjectInfo} className="space-y-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-sky-500" />
                    <span>{language === 'fa' ? 'مشخصات و قوانین عمومی این پروژه' : 'تایبەتمەندی و ڕێساکانی ئەم پڕۆژەیە'}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fa' ? 'نام پروژه یا کارگاه' : 'ناوی پڕۆژە یان کارگە'}
                      </label>
                      <input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fa' ? 'ارز مبنای پروژه' : 'دراوی پڕۆژە'}
                      </label>
                      <select
                        value={projectCurrency}
                        onChange={(e) => setProjectCurrency(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      >
                        <option value="IQD">دینار عراق (IQD)</option>
                        <option value="USD">دلار آمریکا (USD)</option>
                        <option value="IRR">تومان ایران (IRR)</option>
                        <option value="EUR">یورو (EUR)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fa' ? 'ساعت کار استاندارد روزانه' : 'کاتژمێری ئاسایی ڕۆژانە'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={projectHours}
                        onChange={(e) => setProjectHours(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fa' ? 'ضریب محاسبه اضافه‌کاری' : 'زەریبی ئۆڤەرتایم'}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="3"
                        value={projectOvertime}
                        onChange={(e) => setProjectOvertime(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {projectSaveSuccess ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        <span>{language === 'fa' ? 'تغییرات با موفقیت ذخیره شد' : 'گۆڕانکارییەکان پاشەکەوتکران'}</span>
                      </span>
                    ) : <span />}

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors shadow-sm"
                    >
                      {language === 'fa' ? 'ذخیره تغییرات پروژه' : 'پاشەکەوتکردنی پڕۆژە'}
                    </button>
                  </div>
                </form>

                {/* Sub-sections Management for this Project */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <span>{language === 'fa' ? 'بخش‌های پروژه (Sections)' : 'بەشەکانی پڕۆژە'}</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {language === 'fa' ? 'تقسیم‌بندی کارگاه به بخش‌های مختلف (مثل فونداسیون، سوله ۱، نما)' : 'دابەشکردنی کارگە بۆ بەشە جیاوازەکان'}
                      </p>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      {projectSections.length} {language === 'fa' ? 'بخش' : 'بەش'}
                    </span>
                  </div>

                  {/* Add section inline */}
                  <form onSubmit={handleAddSection} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={language === 'fa' ? 'نام بخش جدید (مثلاً: سوله شرقی)...' : 'ناوی بەشی نوێ...'}
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!newSectionName.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{language === 'fa' ? 'افزودن' : 'زیادکردن'}</span>
                    </button>
                  </form>

                  {/* Sections List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {projectSections.map((sec) => (
                      <div
                        key={sec.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{sec.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(sec.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          title={language === 'fa' ? 'حذف بخش' : 'سڕینەوە'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Groups / Work Teams for this Project */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users2 className="w-4 h-4 text-emerald-500" />
                        <span>{language === 'fa' ? 'تیم‌ها و گروه‌های کاری (Work Teams)' : 'تیمەکان و گروپەکانی کار'}</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {language === 'fa' ? 'دسته‌بندی پرسنل با قوانین کسر هزینه غذای کارگاهی' : 'پۆلێنکردنی کرێکاران بەپێی تیم و تێچووی نانخواردن'}
                      </p>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      {projectGroups.length} {language === 'fa' ? 'تیم' : 'تیم'}
                    </span>
                  </div>

                  {/* Add group inline */}
                  <form onSubmit={handleAddGroup} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder={language === 'fa' ? 'نام تیم جدید (مثلاً: تیم قالب‌بندی)...' : 'ناوی تیمی نوێ...'}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newGroupDeductFood}
                        onChange={(e) => setNewGroupDeductFood(e.target.checked)}
                        className="rounded-sm text-emerald-600 focus:ring-0"
                      />
                      <span>{language === 'fa' ? 'کسر هزینه غذا' : 'لێبڕینی نانخواردن'}</span>
                    </label>
                    <button
                      type="submit"
                      disabled={!newGroupName.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{language === 'fa' ? 'افزودن تیم' : 'زیادکردنی تیم'}</span>
                    </button>
                  </form>

                  {/* Groups List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {projectGroups.map((grp) => (
                      <div
                        key={grp.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{grp.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {grp.deductFoodExpense 
                              ? (language === 'fa' ? 'با کسر هزینه غذا' : 'بە لێبڕینی نانخواردن')
                              : (language === 'fa' ? 'بدون کسر غذا' : 'بێ لێبڕینی نانخواردن')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(grp.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 3: EXPENSE CATEGORIES (3-TIER HIERARCHY) */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'categories' && (
              <div className="space-y-5 max-w-4xl animate-in fade-in duration-150">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-rose-500" />
                    <span>{language === 'fa' ? 'سرفصل‌های هزینه‌ها و مخارج (۳ لایه)' : 'سەردێڕی خەرجییەکان (٣ لایەن)'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {language === 'fa' 
                      ? 'مدیریت ساختار سلسله‌مراتبی: گروه اصلی ⬅️ زیرگروه ⬅️ هزینه خرد برای دسته‌بندی فاکتورها' 
                      : 'بەڕێوەبردنی زنجیرەیی سێ بەشی خەرجییەکان'}
                  </p>
                </div>

                {/* 3-Column Interactive Tier Explorer */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* Column 1: Level 1 (Main Groups) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col h-80">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === 'fa' ? '۱. گروه‌های اصلی' : '١. گرووپی سەرەکی'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                        {level1Cats.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 pe-1">
                      {level1Cats.map((cat) => {
                        const isSelected = selectedL1Id === cat.id;
                        return (
                          <div
                            key={cat.id}
                            onClick={() => {
                              setSelectedL1Id(cat.id);
                              setSelectedL2Id(null);
                            }}
                            className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-rose-500 text-white font-bold shadow-xs'
                                : 'hover:bg-white dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <span className="truncate">{cat.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCategory(cat.id);
                                }}
                                className={`p-1 rounded-lg transition-colors ${isSelected ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-500'}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {isRtl ? <ChevronLeft className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 2: Level 2 (Sub-groups) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col h-80">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === 'fa' ? '۲. زیرگروه‌ها' : '٢. ژێرگرووپەکان'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                        {level2Cats.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 pe-1">
                      {!selectedL1Id ? (
                        <div className="text-center text-xs text-slate-400 py-10">
                          {language === 'fa' ? 'ابتدا یک گروه اصلی را انتخاب کنید' : 'گرووپی سەرەکی دیاریبکە'}
                        </div>
                      ) : level2Cats.length === 0 ? (
                        <div className="text-center text-xs text-slate-400 py-10">
                          {language === 'fa' ? 'بدون زیرگروه' : 'بێ ژێرگرووپ'}
                        </div>
                      ) : (
                        level2Cats.map((cat) => {
                          const isSelected = selectedL2Id === cat.id;
                          return (
                            <div
                              key={cat.id}
                              onClick={() => setSelectedL2Id(cat.id)}
                              className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-rose-500 text-white font-bold shadow-xs'
                                  : 'hover:bg-white dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <span className="truncate">{cat.name}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCategory(cat.id);
                                  }}
                                  className={`p-1 rounded-lg transition-colors ${isSelected ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-500'}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                {isRtl ? <ChevronLeft className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Column 3: Level 3 (Micro-expenses) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col h-80">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === 'fa' ? '۳. هزینه‌های خرد' : '٣. وردە خەرجییەکان'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                        {level3Cats.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 pe-1">
                      {!selectedL2Id ? (
                        <div className="text-center text-xs text-slate-400 py-10">
                          {language === 'fa' ? 'ابتدا یک زیرگروه را انتخاب کنید' : 'ژێرگرووپ دیاریبکە'}
                        </div>
                      ) : level3Cats.length === 0 ? (
                        <div className="text-center text-xs text-slate-400 py-10">
                          {language === 'fa' ? 'بدون هزینه خرد' : 'بێ وردە خەرجی'}
                        </div>
                      ) : (
                        level3Cats.map((cat) => (
                          <div
                            key={cat.id}
                            className="p-2 rounded-xl text-xs flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200"
                          >
                            <span className="truncate">{cat.name}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* Add Category Form */}
                <form onSubmit={handleAddCategory} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row gap-3 items-center">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {language === 'fa' ? 'افزودن به سطح:' : 'زیادکردن بۆ ئاستی:'}
                    </span>
                    <select
                      value={catLevelToAdd}
                      onChange={(e) => setCatLevelToAdd(Number(e.target.value))}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    >
                      <option value={1}>{language === 'fa' ? 'سطح ۱ (گروه اصلی)' : 'ئاستی ١ (گرووپی سەرەکی)'}</option>
                      <option value={2} disabled={!selectedL1Id}>
                        {language === 'fa' ? 'سطح ۲ (زیرگروه انتخابی)' : 'ئاستی ٢ (ژێرگرووپ)'}
                      </option>
                      <option value={3} disabled={!selectedL2Id}>
                        {language === 'fa' ? 'سطح ۳ (هزینه خرد انتخابی)' : 'ئاستی ٣ (وردە خەرجی)'}
                      </option>
                    </select>
                  </div>

                  <input
                    type="text"
                    placeholder={language === 'fa' ? 'نام سرفصل جدید...' : 'ناوی بابەت یان سەردێڕی نوێ...'}
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                  />

                  <button
                    type="submit"
                    disabled={!newCatName.trim()}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{language === 'fa' ? 'افزودن سرفصل' : 'زیادکردنی بابەت'}</span>
                  </button>
                </form>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB: FINANCIAL ACCOUNTS & CASH BOXES */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'accounting_accounts' && (
              <div className="max-w-4xl animate-in fade-in duration-150">
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
              <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                {/* Supabase Realtime Card */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <Cloud className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'همگام‌سازی ابری سوپابیس (Supabase Sync)' : 'هاوکاتکردنی هەوری سوپابەیس'}
                        </h4>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {navigator.onLine 
                            ? (language === 'fa' ? 'متصل به سرور و فعال (Online)' : 'پەیوەستکراوە (Online)')
                            : (language === 'fa' ? 'آفلاین - حالت حافظه محلی' : 'ئۆفلاین')}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{language === 'fa' ? 'همگام‌سازی دستی' : 'هاوکاتکردنی خێرا'}</span>
                    </button>
                  </div>

                  {syncStatusMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
                      <Check className="w-4 h-4" />
                      <span>{syncStatusMsg}</span>
                    </div>
                  )}
                </div>

                {/* Local DB Statistics */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-500" />
                    <span>{language === 'fa' ? 'آمار داده‌های محلی (IndexedDB Cache)' : 'ئاماری داتاکانی ئامێر'}</span>
                  </h4>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 1. Workers */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-sky-500/40">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{language === 'fa' ? 'پرسنل فعال' : 'کرێکارانی چالاک'}</span>
                        <Users2 className="w-3.5 h-3.5 text-sky-500" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{dbCounts.workers}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'fa' ? `از کل ${dbCounts.totalWorkers} پرسنل` : `لە کۆی ${dbCounts.totalWorkers}`}
                      </div>
                    </div>

                    {/* 2. Attendance Logs */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-emerald-500/40">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{language === 'fa' ? 'لاگ‌های تردد' : 'تۆماری ئامادەبوون'}</span>
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{dbCounts.logs}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'fa' ? 'ثبت‌های حضور و غیاب' : 'تۆمارە ڕۆژانەکان'}
                      </div>
                    </div>

                    {/* 3. Payments */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-amber-500/40">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{language === 'fa' ? 'پرداخت و مساعده' : 'پێشەکی و پارەدان'}</span>
                        <Wallet className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{dbCounts.payments}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'fa' ? 'رسید و تسویه‌ها' : 'پسووڵەی پارەدان'}
                      </div>
                    </div>

                    {/* 4. Expenses */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-rose-500/40">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{language === 'fa' ? 'فاکتورهای هزینه' : 'خەرجییەکان'}</span>
                        <Receipt className="w-3.5 h-3.5 text-rose-500" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{dbCounts.expenses}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'fa' ? 'فاکتورهای جاری' : 'پسووڵەی خەرجی'}
                      </div>
                    </div>

                    {/* 5. Expense Categories */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-purple-500/40">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{language === 'fa' ? 'سرفصل‌های هزینه‌ها' : 'سەردێڕەکان'}</span>
                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{dbCounts.categories}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'fa' ? 'طبقه‌بندی ۳ سطحی' : 'سەردێڕی خەرجی'}
                      </div>
                    </div>

                    {/* 6. Project Sections */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-indigo-500/40">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{language === 'fa' ? 'بخش‌های پروژه' : 'بەشەکانی پڕۆژە'}</span>
                        <Building className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{dbCounts.sections}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'fa' ? 'فازها و زون‌های کاری' : 'زۆن و بەشەکان'}
                      </div>
                    </div>

                    {/* 7. Working Groups */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-cyan-500/40">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{language === 'fa' ? 'گروه‌های کاری' : 'گرووپەکان'}</span>
                        <Users2 className="w-3.5 h-3.5 text-cyan-500" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{dbCounts.groups}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'fa' ? 'دسته‌های استادکار/کارگر' : 'گرووپی کارمەندان'}
                      </div>
                    </div>

                    {/* 8. Projects */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-blue-500/40">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{language === 'fa' ? 'پروژه‌ها' : 'پڕۆژەکان'}</span>
                        <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{dbCounts.projects}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'fa' ? 'محیط‌های کاری فعال' : 'پڕۆژەی چالاک'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Backup & Restore System */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-500" />
                    <span>{language === 'fa' ? 'پشتیبان‌گیری و بازیابی داده‌ها (Backup & Restore)' : 'پاشەکەوت و گەڕاندنەوەی داتا'}</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'fa' 
                      ? 'دانلود یک نسخه کامل و آفلاین از تمامی داده‌ها در قالب فایل استاندارد JSON جهت نگهداری یا انتقال به دستگاه دیگر:'
                      : 'داگرتنی فایلی یەدەگی داتاکان لە شێوازی JSON:'}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      disabled={backupLoading}
                      className="flex-1 py-3 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>{language === 'fa' ? 'دانلود فایل پشتیبان (Export JSON)' : 'داگرتنی فایلی یەدەگ'}</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'fa' ? 'بازیابی از فایل پشتیبان (Restore):' : 'گەڕاندنەوە لە فایلی یەدەگ:'}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          {language === 'fa' ? 'حالت بازیابی:' : 'دۆخی گەڕاندنەوە:'}
                        </label>
                        <select
                          value={restoreMode}
                          onChange={(e) => setRestoreMode(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                        >
                          <option value="replace">{language === 'fa' ? 'جایگزینی کامل (Clean Replace)' : 'جێگرتنەوەی تەواو'}</option>
                          <option value="merge">{language === 'fa' ? 'ادغام با داده‌های موجود (Merge)' : 'تێکەڵکردنی داتا'}</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 items-end">
                        <div className="w-full flex-1">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            {language === 'fa' ? 'انتخاب فایل پشتیبان JSON:' : 'فایلی JSON:'}
                          </label>
                          <input
                            type="file"
                            accept=".json"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setBackupFile(e.target.files[0]);
                              }
                            }}
                            className="w-full text-xs text-slate-500 file:me-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleImportBackup}
                          disabled={!backupFile || backupLoading}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm flex-shrink-0"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{language === 'fa' ? 'شروع بازیابی' : 'هێنانەوەی داتا'}</span>
                        </button>
                      </div>
                    </div>

                    {backupMsg.text && (
                      <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        backupMsg.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                      }`}>
                        {backupMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span>{backupMsg.text}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB: KEYBOARD SHORTCUTS */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-6 max-w-3xl animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Keyboard className="w-5 h-5 text-sky-500" />
                      <span>{language === 'fa' ? 'راهنمای کلیدهای میانبر کیبورد' : language === 'ku' ? 'ڕێبەری شۆرتکاتەکانی کیبۆرد' : 'Keyboard Shortcuts Guide'}</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {language === 'fa'
                        ? 'برای افزایش چشمگیر سرعت عمل و ثبت داده‌ها بدون نیاز به ماوس در کامپیوتر یا لپ‌تاپ:'
                        : 'بۆ زیادکردنی خێرایی کارکردن و داخڵکردنی داتا بەبێ بەکارهێنانی ماوس لە کۆمپیوتەر:'}
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
                    <span>{language === 'fa' ? 'ثبت و عملیات سریع' : 'تۆمارکردن و کردارە خێراکان'}</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'ثبت کارکرد و حضور روزانه' : 'تۆماری ئامادەبوونی ڕۆژانە'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'باز کردن مودال سریع ثبت لاگ' : 'کردنەوەی مۆداڵی تۆماری ڕۆژ'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 shadow-xs">L</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : 'یان'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 shadow-xs">L</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'ثبت هزینه و فاکتور جدید' : 'تۆمارکردنی خەرجی نوێ'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'فرم سریع افزودن فاکتور هزینه' : 'فۆرمی خێرای خەرجی کارگە'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-600 shadow-xs">E</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : 'یان'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-600 shadow-xs">E</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'تسویه حساب و پرداخت مالی' : 'حیساباتی شایستە و پارەدان'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'مودال تسویه طلب کارگران' : 'مۆداڵی تەسویەی پارەی کرێکار'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600 shadow-xs">S</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : 'یان'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600 shadow-xs">S</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'افزودن پرسنل / کارگر جدید' : 'زیادکردنی کرێکاری نوێ'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'باز کردن فرم ثبت کارگر جدید' : 'فۆرمی تۆمارکردنی کرێکار'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-600 shadow-xs">W</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : 'یان'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-600 shadow-xs">W</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 md:col-span-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'پروژه‌ها و ساختار کارگاه' : 'پڕۆژەکان و پەیکەری کارگە'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'تنظیمات و مدیریت بخش‌ها و پروژه‌ها' : 'بەڕێوەبردنی پڕۆژە و بەشەکان'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Shift</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600 shadow-xs">P</kbd>
                        <span className="text-[10px] text-slate-400 mx-1">{language === 'fa' ? 'یا' : 'یان'}</span>
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600 shadow-xs">P</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Tab Navigation */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                    <span>{language === 'fa' ? 'ناوبری و جابه‌جایی بین تب‌ها' : 'گۆڕینی پەڕە و بەشەکان'}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'داشبورد مدیریتی' : 'داشبۆرد'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">1</kbd>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'مدیریت پرسنل' : 'کرێکاران'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">2</kbd>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'تقویم هوشمند تردد' : 'ڕۆژمێری ئامادەبوون'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">3</kbd>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'گزارشات و تسویه مالی' : 'ڕاپۆرتی دارایی'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">4</kbd>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'مدیریت هزینه‌ها' : 'خەرجییەکان'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">5</kbd>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'fa' ? 'حسابداری و خزانه‌داری' : 'ژمێریاری و خەزێنەداری'}
                      </div>
                      <kbd className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-600 shadow-xs">6</kbd>
                    </div>
                  </div>
                </div>

                {/* Section 3: System & Modals */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                    <span>{language === 'fa' ? 'سیستم و کنترل پنجره‌ها' : 'سیستەم و کۆنترۆڵەکان'}</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'تنظیمات سراسری' : 'ڕێکخستنی سیستەم'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'باز کردن پنجره تنظیمات' : 'کردنەوەی ڕێکخستن'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">Ctrl</kbd>
                        <span className="text-xs font-bold text-slate-400">+</span>
                        <kbd className="inline-flex items-center justify-center min-w-[24px] h-7 px-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">,</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'راهنمای شورتکات‌ها' : 'ڕێبەری میانبڕەکان'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'مشاهده همین صفحه' : 'پیشاندانی ئەم پەڕەیە'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <kbd className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 shadow-xs">?</kbd>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'بستن پنجره‌ها' : 'داخستنی پەنجەرەکان'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'fa' ? 'خروج از مودال و فرم‌ها' : 'داخستنی فۆرمەکان'}
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
                    <span className="font-bold">{language === 'fa' ? 'نکته هوشمند: ' : 'تێبینی: '}</span>
                    <span>
                      {language === 'fa'
                        ? 'برای جلوگیری از بروز هرگونه خطا حین ورود اطلاعات مبالغ، نام‌ها یا جستجو، کلیدهای میانبر تک‌کاراکتری (مانند اعداد ۱ تا ۵ یا کلیدهای L و E) زمانی که در حال نوشتن داخل یک فیلد یا کادر جستجو هستید، موقتاً غیرفعال می‌شوند.'
                        : 'کلیدە تاکەکان لە کاتی نووسین لە ناو فۆرمەکاندا کار ناکەن تاکو بە هەڵە فەرمان نەدرێت.'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB 5: ACCOUNT & SECURITY */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'account' && (
              <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
                {/* User Identity & Profile Edit Form */}
                <form onSubmit={handleSaveProfile} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                            title={language === 'fa' ? 'حذف تصویر' : 'سڕینەوەی وێنە'}
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
                        title={language === 'fa' ? 'تغییر عکس پروفایل' : 'گۆڕینی وێنە'}
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
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {language === 'fa' ? 'حساب کاربری مدیریت' : 'هەژماری بەڕێوەبەر'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                          Admin
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{user?.email || 'admin@karsync.com'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user?.companyName || 'کارگاه من'}</p>
                    </div>
                  </div>

                  {/* Name and Title Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fa' ? 'نام و نام خانوادگی' : 'ناوی تەواو'}
                      </label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fa' ? 'عنوان و نقش در مجموعه' : 'پلە یان ناونیشان لە کارگە'}
                      </label>
                      <input
                        type="text"
                        value={profileTitle}
                        onChange={(e) => setProfileTitle(e.target.value)}
                        placeholder={language === 'fa' ? 'مثلاً: مدیر پروژه، سرپرست کارگاه، مدیر فنی...' : 'وەک: بەڕێوەبەری پڕۆژە...'}
                        className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {profileSaveSuccess ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        <span>{language === 'fa' ? 'مشخصات با موفقیت ذخیره شد' : 'زانیارییەکان پاشەکەوتکران'}</span>
                      </span>
                    ) : <span />}

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors shadow-sm"
                    >
                      {language === 'fa' ? 'ذخیره مشخصات کاربری' : 'پاشەکەوتکردنی پرۆفایل'}
                    </button>
                  </div>
                </form>

                {/* RBAC & Two-Stage Verification Role Switcher */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {language === 'fa' ? 'نقش کاربری و سطح دسترسی (RBAC)' : 'ڕۆڵی بەکارهێنەر'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {language === 'fa' 
                            ? 'کنترل سطح دسترسی جهت تایید دو مرحله‌ای اسناد مالی و فاکتورها' 
                            : 'کۆنترۆڵی دەسەڵاتەکانی پەسەندکردنی بەڵگەنامەکان'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      (user?.role || 'admin') === 'admin' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}>
                      {(user?.role || 'admin') === 'admin' 
                        ? (language === 'fa' ? '👑 مدیر ارشد' : '👑 بەڕێوەبەر') 
                        : (language === 'fa' ? '✍️ اپراتور ثبت داده' : '✍️ تۆمارکار')}
                    </span>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
                      <span>{language === 'fa' ? 'انتخاب نقش کاربری (User Role)' : 'دیاریکردنی ڕۆڵ'}</span>
                    </label>
                    <select
                      value={user?.role || 'admin'}
                      onChange={(e) => setUserRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                    >
                      <option value="admin">
                        {language === 'fa' ? '👑 مدیر سیستم (Admin) — دسترسی کامل و تایید نهایی اسناد' : '👑 بەڕێوەبەر (Admin)'}
                      </option>
                      <option value="operator">
                        {language === 'fa' ? '✍️ اپراتور ثبت داده (Operator) — فقط ثبت پیش‌نویس بدون تایید' : '✍️ تۆمارکار (Operator)'}
                      </option>
                    </select>
                  </div>
                </div>

                {/* Change Password Form */}
                <form onSubmit={handleChangePassword} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <span>{language === 'fa' ? 'تغییر رمز عبور ورود به برنامه' : 'گۆڕینی وشەی نهێنی'}</span>
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fa' ? 'رمز عبور فعلی' : 'وشەی نهێنی ئێستا'}
                    </label>
                    <input
                      type="password"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fa' ? 'رمز عبور جدید' : 'وشەی نهێنی نوێ'}
                      </label>
                      <input
                        type="password"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fa' ? 'تکرار رمز عبور جدید' : 'دووبارەکردنەوەی وشەی نهێنی نوێ'}
                      </label>
                      <input
                        type="password"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {newPass && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
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

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={passLoading}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm"
                    >
                      {language === 'fa' ? 'به‌روزرسانی رمز عبور' : 'نوێکردنەوەی تێپەڕەوشە'}
                    </button>
                  </div>
                </form>

                {/* Two-Factor Authentication (2FA) & High Security Hardening */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{language === 'fa' ? 'تایید هویت دو مرحله‌ای (2FA)' : 'پشتڕاستکردنەوەی دوو قۆناغی'}</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {language === 'fa' ? 'اتصال به Google Authenticator یا Microsoft Authenticator' : 'Google / Microsoft Authenticator'}
                        </p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                      twoFactorConfig?.enabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      {twoFactorConfig?.enabled
                        ? (language === 'fa' ? 'فعال و محافظت‌شده' : 'چالاکە')
                        : (language === 'fa' ? 'غیرفعال' : 'ناچالاکە')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {language === 'fa'
                      ? 'با فعال‌سازی ۲FA، در هر بار ورود به برنامه علاوه‌بر رمز عبور، کد ۶ رقمی تولیدشده در گوشی همراه شما درخواست خواهد شد که امنیت داده‌های مالی را به حداکثر می‌رساند.'
                      : 'With 2FA enabled, a 6-digit code from your authenticator app is required upon login.'}
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIs2FAModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20 flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      <span>
                        {twoFactorConfig?.enabled
                          ? (language === 'fa' ? 'مدیریت و مشاهده کدهای بازیابی ۲FA' : 'Manage 2FA & Backup Codes')
                          : (language === 'fa' ? 'راه‌اندازی و فعال‌سازی ۲FA' : 'Setup Two-Factor Authentication')}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Auto-Lock Screen on Inactivity */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {language === 'fa' ? 'قفل خودکار صفحه بر اثر بی‌حرکتی' : 'قفڵکردنی خۆکاری شاشە'}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {language === 'fa'
                      ? 'جهت جلوگیری از دسترسی افراد غیرمجاز در محیط کارگاه، برنامه پس از مدت زمان مشخصی بی‌حرکتی قفل می‌شود.'
                      : 'Automatically locks the app after inactivity to prevent unauthorized access in the workshop.'}
                  </p>
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-500" />
                      <span>{language === 'fa' ? 'مدت زمان بی‌حرکتی پیش از قفل شدن:' : 'ماوەی ناچالاکی بۆ قفڵکردن:'}</span>
                    </label>
                    <select
                      value={autoLockMinutes}
                      onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                    >
                      <option value={0}>{language === 'fa' ? 'غیرفعال (عدم قفل خودکار)' : 'ناچالاک'}</option>
                      <option value={15}>{language === 'fa' ? '۱۵ دقیقه بی‌حرکتی' : '١٥ خولەک'}</option>
                      <option value={30}>{language === 'fa' ? '۳۰ دقیقه بی‌حرکتی' : '٣٠ خولەک'}</option>
                      <option value={60}>{language === 'fa' ? '۱ ساعت بی‌حرکتی' : '١ کاتژمێر'}</option>
                    </select>
                  </div>
                </div>

                {/* Security Audit & Status Badges */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>{language === 'fa' ? 'وضعیت سپرهای امنیتی فعال KarSync' : 'Active Security Layers'}</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                      <Check className="w-3.5 h-3.5" />
                      <span>HTTPS Enforced</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                      <Check className="w-3.5 h-3.5" />
                      <span>SHA-256 + Salt</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Brute-Force Guard</span>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="border-t border-slate-200/80 dark:border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(language === 'fa' ? 'آیا از خروج از حساب کاربری اطمینان دارید؟' : 'ئایا لە چوونەدەرەوە دڵنیایت؟')) {
                        logout();
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition-colors"
                  >
                    {language === 'fa' ? 'خروج امن از حساب کاربری' : 'چوونەدەرەوە لە هەژمار'}
                  </button>
                </div>
              </div>
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
                    <span>v1.2.0 • SaaS & Local-First PWA</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                  {language === 'fa'
                    ? 'سیستم جامع و پیشرفته مدیریت هوشمند کارگاه، ثبت حضور و غیاب، تسویه حساب‌های مالی، مدیریت سلسله‌مراتبی هزینه‌ها و همگام‌سازی ابری زنده.'
                    : 'سیستەمی پێشکەوتووی بەڕێوەبردنی کارگە، ئامادەبوون و حیساباتی شایستەی کرێکاران و خەرجییەکان.'}
                </p>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>{language === 'fa' ? 'طراحی و توسعه اختصاصی: افشین زارعی' : 'دیزاین و پرۆگرامسازی: ئەفشین زارعی'}</span>
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
                : 'ڕێکخستنەکان: ' + (tabs.find((t) => t.id === activeTab)?.label || '')}
            </span>
            {generalSaveSuccess && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4" />
                <span>{language === 'fa' ? 'ذخیره شد' : 'پاشەکەوتکرا'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'general') {
                  handleCancelGeneralSettings();
                }
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              {language === 'fa' ? 'انصراف و بستن' : 'پاشگەزبوونەوە و داخستن'}
            </button>

            {activeTab === 'general' ? (
              <button
                type="button"
                onClick={handleSaveGeneralSettings}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{language === 'fa' ? 'ذخیره تنظیمات' : 'پاشەکەوتکردن'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{language === 'fa' ? 'تایید و بستن' : 'پەسەندکردن و داخستن'}</span>
              </button>
            )}
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
