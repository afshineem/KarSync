import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { db, DEFAULT_PROJECT_ID, generateSectionId } from '../db/db';
import { pushProjectSectionLive, deleteProjectSectionLive } from '../services/realtimeSync';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Settings2, 
  X, 
  Clock, 
  TrendingUp, 
  Check, 
  Archive, 
  Trash2, 
  Users, 
  CalendarCheck, 
  Layers, 
  Plus,
  Pencil,
  FolderKanban,
  RotateCcw
} from 'lucide-react';

const PROJECT_SETTINGS_COPY = {
  fa: {
    modalTitle: 'مدیریت و ویرایش پروژه',
    selectedProject: 'انتخاب پروژه:',
    newProject: 'ایجاد پروژه جدید',
    tabs: {
      general: 'پروژه‌ها',
      sections: 'بخش‌ها',
      archived: 'بایگانی‌شده',
      trash: 'حذف‌شده'
    },
    totalPersonnel: 'کل پرسنل اختصاص‌یافته',
    totalLogsRecorded: 'کل رکوردهای حضور',
    personUnit: 'نفر',
    recordUnit: 'رکورد',
    projectName: 'نام پروژه',
    projectNamePlaceholder: 'مثال: پروژه ورامین، سد ایذه...',
    projectCurrency: 'واحد پول پروژه',
    currencies: {
      IQD: { label: 'دینار عراق', symbol: 'د.ع' },
      IRT: { label: 'تومان ایران', symbol: 'تومان' },
      USD: { label: 'دلار آمریکا', symbol: '$' }
    },
    standardWorkHours: 'ساعت کار استاندارد روزانه',
    overtimeMultiplier: 'ضریب اضافه کاری',
    notes: 'توضیحات و یادداشت',
    notesPlaceholder: 'ملاحظات خاص این پروژه...',
    unarchiveProject: 'خروج از بایگانی',
    archiveProject: 'بایگانی کردن پروژه',
    moveToTrash: 'انتقال به سطل آشغال',
    cancel: 'انصراف',
    saveChanges: 'ذخیره تغییرات',
    save: 'ذخیره',
    projectNameRequired: 'نام پروژه الزامی است',
    projectSavedSuccess: 'تنظیمات پروژه با موفقیت ذخیره و همگام‌سازی شد',
    cannotArchiveDefaultProject: 'پروژه پیش‌فرض سیستم قابل بایگانی نیست',
    confirmArchiveProject: 'آیا از بایگانی کردن این پروژه اطمینان دارید؟',
    cannotDeleteDefaultProject: 'پروژه پیش‌فرض سیستم قابل حذف نیست',
    confirmDeleteProject: (name) => `آیا از حذف پروژه «${name}» اطمینان دارید؟ تمامی رکوردهای مرتبط با این پروژه حذف خواهند شد.`,
    moveToTrashConfirm: (name) => `انتقال به سطل آشغال: «${name}»؟`,
    permanentDeleteSectionConfirm: 'آیا از حذف دائمی این بخش اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
    permanentDeleteProjectConfirm: (name) => `آیا از حذف دائمی پروژه «${name}» اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`,
    projectSections: 'بخش‌های پروژه (ساب‌پروژه‌ها)',
    projectSectionsDesc: 'تعریف، ویرایش نام و مدیریت زیرپروژه‌ها جهت تفکیک دقیق هزینه‌ها و کارکرد پرسنل',
    newSectionPlaceholder: 'نام بخش جدید (مثال: زراعت، تاسیسات...)',
    addSection: 'افزودن',
    noSectionsYet: 'هنوز بخشی برای این پروژه تعریف نشده است.',
    editSectionName: 'ویرایش نام بخش',
    archiveSection: 'بایگانی بخش',
    archivedTitle: 'بایگانی‌شده',
    archivedDesc: 'پروژه‌ها و بخش‌های غیرفعال در اینجا قرار می‌گیرند تا فضای کاری شما خلوت بماند.',
    archivedSectionsTitle: 'بخش‌های بایگانی‌شده این پروژه',
    noArchivedSections: 'هیچ بخش بایگانی‌شده‌ای وجود ندارد.',
    unarchive: 'خروج از بایگانی',
    archivedProjectsTitle: 'پروژه‌های بایگانی‌شده',
    noArchivedProjects: 'هیچ پروژه‌ای بایگانی نشده است.',
    trashTitle: 'سطل آشغال و بازیابی اطلاعات',
    trashDesc: 'موارد حذف‌شده در اینجا نگهداری می‌شوند تا در صورت نیاز بازیابی شوند یا به صورت دائمی حذف گردند.',
    deletedSectionsTitle: 'بخش‌های حذف‌شده این پروژه',
    noDeletedSections: 'هیچ بخش حذف‌شده‌ای وجود ندارد.',
    restore: 'بازیابی',
    permanentDelete: 'حذف دائمی',
    deletedProjectsTitle: 'پروژه‌های حذف‌شده',
    noDeletedProjects: 'هیچ پروژه حذف‌شده‌ای در سطل آشغال نیست.'
  },
  ku: {
    modalTitle: 'بەڕێوەبردن و دەستکاریکردنی پڕۆژە',
    selectedProject: 'پڕۆژەی هەڵبژێردراو:',
    newProject: 'دروستکردنی پڕۆژەی نوێ',
    tabs: {
      general: 'پڕۆژەکان',
      sections: 'بەشەکان',
      archived: 'ئەرشیڤکراو',
      trash: 'سڕاوەکان'
    },
    totalPersonnel: 'تەواوی کارمەندانی دیاریکراو',
    totalLogsRecorded: 'تەواوی تۆمارەکانی ئامادەبوون',
    personUnit: 'کەس',
    recordUnit: 'تۆمار',
    projectName: 'ناوی پڕۆژە',
    projectNamePlaceholder: 'نموونە: پڕۆژەی گەنم، بەنداوی دووکان...',
    projectCurrency: 'دراوی پڕۆژە',
    currencies: {
      IQD: { label: 'دیناری عێراقی', symbol: 'د.ع' },
      IRT: { label: 'تمەنی ئێرانی', symbol: 'تمەن' },
      USD: { label: 'دۆلاری ئەمریکی', symbol: '$' }
    },
    standardWorkHours: 'کاتژمێری کاری پێوانەیی ڕۆژانە',
    overtimeMultiplier: 'هاوکۆلکەی زیادەکاری',
    notes: 'تێبینی و ڕوونکردنەوە',
    notesPlaceholder: 'تێبینییە تایبەتەکانی ئەم پڕۆژەیە...',
    unarchiveProject: 'دەرکردن لە ئەرشیڤ',
    archiveProject: 'ئەرشیڤکردنی پڕۆژە',
    moveToTrash: 'گواستنەوە بۆ تەنەکەی خۆڵ',
    cancel: 'پاشگەزبوونەوە',
    saveChanges: 'پاشەکەوتکردنی گۆڕانکارییەکان',
    save: 'پاشەکەوتکردن',
    projectNameRequired: 'ناوی پڕۆژە پێویستە',
    projectSavedSuccess: 'ڕێکخستنەکانی پڕۆژە بە سەرکەوتوویی پاشەکەوت و هاوکات کران',
    cannotArchiveDefaultProject: 'پڕۆژەی بنەڕەتی سیستەم ناتوانرێت ئەرشیڤ بکرێت',
    confirmArchiveProject: 'ئایا دڵنیایت لە ئەرشیڤکردنی ئەم پڕۆژەیە؟',
    cannotDeleteDefaultProject: 'پڕۆژەی بنەڕەتی سیستەم ناتوانرێت بسڕدرێتەوە',
    confirmDeleteProject: (name) => `ئایا دڵنیایت لە سڕینەوەی پڕۆژەی «${name}»؟ هەموو تۆمارە پەیوەندیدارەکان دەسڕدرێنەوە.`,
    moveToTrashConfirm: (name) => `گواستنەوە بۆ تەنەکەی خۆڵ: «${name}»؟`,
    permanentDeleteSectionConfirm: 'ئایا دڵنیایت لە سڕینەوەی یەکجارەکی ئەم بەشە؟ ئەم کردارە ناگەڕێتەوە.',
    permanentDeleteProjectConfirm: (name) => `ئایا دڵنیایت لە سڕینەوەی یەکجارەکی پڕۆژەی «${name}»؟ ئەم کردارە ناگەڕێتەوە.`,
    projectSections: 'بەشەکانی پڕۆژە (ژێرپڕۆژەکان)',
    projectSectionsDesc: 'دیاریکردن، دەستکاریکردنی ناو و بەڕێوەبردنی ژێرپڕۆژەکان بۆ جیاکردنەوەی وردی تێچوو و کارکردن',
    newSectionPlaceholder: 'ناوی بەشی نوێ (نموونە: چاندن، دامەزراندن...)',
    addSection: 'زیادکردن',
    noSectionsYet: 'هێشتا هیچ بەشێک بۆ ئەم پڕۆژەیە پێناسە نەکراوە.',
    editSectionName: 'دەستکاریکردنی ناوی بەش',
    archiveSection: 'ئەرشیڤکردنی بەش',
    archivedTitle: 'ئەرشیڤکراو',
    archivedDesc: 'پڕۆژە و بەشە ناچالاکەکان لێرە دەپارێزرێن بۆ ئەوەی شوێنی کارەکەت ڕێک و خاوێن بێت.',
    archivedSectionsTitle: 'بەشە ئەرشیڤکراوەکانی ئەم پڕۆژەیە',
    noArchivedSections: 'هیچ بەشێکی ئەرشیڤکراو نییە.',
    unarchive: 'دەرکردن لە ئەرشیڤ',
    archivedProjectsTitle: 'پڕۆژە ئەرشیڤکراوەکان',
    noArchivedProjects: 'هیچ پڕۆژەیەک ئەرشیڤ نەکراوە.',
    trashTitle: 'تەنەکەی خۆڵ و گەڕاندنەوەی زانیاری',
    trashDesc: 'بڕگە سڕاوەکان لێرە دەمێننەوە بۆ ئەوەی لە کاتی پێویستدا بگەڕێندرێنەوە یان بەیەکجاری بسڕدرێنەوە.',
    deletedSectionsTitle: 'بەشە سڕاوەکانی ئەم پڕۆژەیە',
    noDeletedSections: 'هیچ بەشێکی سڕاوە نییە.',
    restore: 'گەڕاندنەوە',
    permanentDelete: 'سڕینەوەی یەکجارەکی',
    deletedProjectsTitle: 'پڕۆژە سڕاوەکان',
    noDeletedProjects: 'هیچ پڕۆژەیەکی سڕاوە لە تەنەکەی خۆڵدا نییە.'
  },
  en: {
    modalTitle: 'Project Management & Settings',
    selectedProject: 'Selected Project:',
    newProject: 'New Project',
    tabs: {
      general: 'Projects',
      sections: 'Sections',
      archived: 'Archived',
      trash: 'Deleted'
    },
    totalPersonnel: 'Total Assigned Personnel',
    totalLogsRecorded: 'Total Attendance Logs',
    personUnit: 'People',
    recordUnit: 'Records',
    projectName: 'Project Name',
    projectNamePlaceholder: 'e.g., Downtown Site, Facility B...',
    projectCurrency: 'Project Currency',
    currencies: {
      IQD: { label: 'Iraqi Dinar', symbol: 'IQD' },
      IRT: { label: 'Iranian Toman', symbol: 'IRT' },
      USD: { label: 'US Dollar', symbol: '$' }
    },
    standardWorkHours: 'Standard Daily Work Hours',
    overtimeMultiplier: 'Overtime Multiplier',
    notes: 'Notes & Description',
    notesPlaceholder: 'Specific considerations for this project...',
    unarchiveProject: 'Unarchive Project',
    archiveProject: 'Archive Project',
    moveToTrash: 'Move to Trash',
    cancel: 'Cancel',
    saveChanges: 'Save Changes',
    save: 'Save',
    projectNameRequired: 'Project name is required',
    projectSavedSuccess: 'Project settings successfully saved and synchronized',
    cannotArchiveDefaultProject: 'System default project cannot be archived',
    confirmArchiveProject: 'Are you sure you want to archive this project?',
    cannotDeleteDefaultProject: 'System default project cannot be deleted',
    confirmDeleteProject: (name) => `Are you sure you want to delete project "${name}"? All associated records will be removed.`,
    moveToTrashConfirm: (name) => `Move to trash: "${name}"?`,
    permanentDeleteSectionConfirm: 'Are you sure you want to permanently delete this section? This action cannot be undone.',
    permanentDeleteProjectConfirm: (name) => `Are you sure you want to permanently delete project "${name}"? This action cannot be undone.`,
    projectSections: 'Project Sections (Sub-Projects)',
    projectSectionsDesc: 'Define, rename, and manage sub-sections for accurate cost and attendance allocation.',
    newSectionPlaceholder: 'New section name (e.g., Electrical, Planting...)',
    addSection: 'Add',
    noSectionsYet: 'No sub-sections defined for this project yet.',
    editSectionName: 'Edit Section Name',
    archiveSection: 'Archive Section',
    archivedTitle: 'Archived',
    archivedDesc: 'Inactive projects and sections are stored here to keep your workspace clutter-free.',
    archivedSectionsTitle: 'Archived Sections in This Project',
    noArchivedSections: 'No archived sections found.',
    unarchive: 'Unarchive',
    archivedProjectsTitle: 'Archived Projects',
    noArchivedProjects: 'No archived projects found.',
    trashTitle: 'Trash & Data Recovery',
    trashDesc: 'Deleted items are kept here so they can be restored or permanently removed if needed.',
    deletedSectionsTitle: 'Deleted Sections in This Project',
    noDeletedSections: 'No deleted sections found.',
    restore: 'Restore',
    permanentDelete: 'Delete Permanently',
    deletedProjectsTitle: 'Deleted Projects',
    noDeletedProjects: 'No deleted projects in trash.'
  }
};

export function ProjectSettingsModal() {
  const { language } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = PROJECT_SETTINGS_COPY[langKey] || PROJECT_SETTINGS_COPY.fa;

  const { 
    projects,
    activeProjects,
    archivedProjects,
    trashProjects,
    currentProject, 
    updateProject, 
    archiveProject, 
    unarchiveProject,
    softDeleteProject,
    restoreProject,
    deleteProject, 
    isProjectSettingsModalOpen, 
    setIsProjectSettingsModalOpen,
    setIsNewProjectModalOpen,
    editingProjectId,
    setEditingProjectId
  } = useProject();

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'sections' | 'archived' | 'trash'
  const [sectionsFilter, setSectionsFilter] = useState('active'); // 'active' | 'archived'
  
  // Target project to edit (defaults to editingProjectId or currentProject)
  const targetProjectId = editingProjectId || currentProject?.id || DEFAULT_PROJECT_ID;
  const targetProject = (projects || []).find(p => p.id === targetProjectId) || currentProject;

  // Form states for general tab
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('IQD');
  const [standardWorkHours, setStandardWorkHours] = useState(8);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sub-sections states for sections tab
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  // Synchronize form when target project changes or modal opens
  useEffect(() => {
    if (targetProject) {
      setName(targetProject.name || '');
      setCurrency(targetProject.currency || 'IQD');
      setStandardWorkHours(targetProject.standardWorkHours || 8);
      setOvertimeMultiplier(targetProject.overtimeMultiplier || 1.0);
      setNotes(targetProject.notes || '');
      setSuccessMsg('');
      setErrorMsg('');
      setEditingSectionId(null);
      setEditingSectionName('');
    }
  }, [targetProject?.id, isProjectSettingsModalOpen]);

  // Project statistics for targeted project
  const stats = useLiveQuery(async () => {
    if (!targetProject?.id) return { workers: 0, logs: 0 };
    const [workersCount, logsCount] = await Promise.all([
      db.workers.where('projectId').equals(targetProject.id).count(),
      db.attendanceLogs.where('projectId').equals(targetProject.id).count()
    ]);
    return { workers: workersCount, logs: logsCount };
  }, [targetProject?.id], { workers: 0, logs: 0 });

  // Project sections for targeted project
  const allProjectSections = useLiveQuery(async () => {
    if (!targetProject?.id) return [];
    return await db.projectSections.where('projectId').equals(targetProject.id).toArray();
  }, [targetProject?.id]) || [];

  const activeSections = useMemo(() => {
    return allProjectSections.filter(s => !s.deletedAt && s.status !== 'archived');
  }, [allProjectSections]);

  const archivedSections = useMemo(() => {
    return allProjectSections.filter(s => !s.deletedAt && s.status === 'archived');
  }, [allProjectSections]);

  const deletedSections = useMemo(() => {
    return allProjectSections.filter(s => !!s.deletedAt);
  }, [allProjectSections]);

  const totalTrashCount = (deletedSections.length || 0) + (trashProjects?.length || 0);

  // Add section handler
  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    try {
      const newSec = {
        id: generateSectionId(),
        projectId: targetProject.id,
        userId: targetProject.userId || 'default_user',
        name: newSectionName.trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.projectSections.put(newSec);
      pushProjectSectionLive(newSec).catch(() => {});
      setNewSectionName('');
    } catch (err) {
      console.error('Error adding section:', err);
    }
  };

  // Start editing a section
  const handleStartEditSection = (sec) => {
    setEditingSectionId(sec.id);
    setEditingSectionName(sec.name);
  };

  // Save edited section
  const handleSaveEditSection = async (sec) => {
    if (!editingSectionName.trim()) return;
    try {
      const updatedSec = {
        ...sec,
        name: editingSectionName.trim(),
        updatedAt: new Date().toISOString()
      };
      await db.projectSections.put(updatedSec);
      pushProjectSectionLive(updatedSec).catch(() => {});
      setEditingSectionId(null);
      setEditingSectionName('');
    } catch (err) {
      console.error('Error saving edited section:', err);
    }
  };

  // Archive section handler
  const handleArchiveSection = async (sec) => {
    try {
      const updatedSec = {
        ...sec,
        status: 'archived',
        updatedAt: new Date().toISOString()
      };
      await db.projectSections.put(updatedSec);
      pushProjectSectionLive(updatedSec).catch(() => {});
    } catch (err) {
      console.error('Error archiving section:', err);
    }
  };

  // Unarchive section handler
  const handleUnarchiveSection = async (sec) => {
    try {
      const updatedSec = {
        ...sec,
        status: 'active',
        updatedAt: new Date().toISOString()
      };
      await db.projectSections.put(updatedSec);
      pushProjectSectionLive(updatedSec).catch(() => {});
    } catch (err) {
      console.error('Error unarchiving section:', err);
    }
  };

  // Move section to trash (soft delete)
  const handleMoveSectionToTrash = async (sec) => {
    const confirmText = c.moveToTrashConfirm(sec.name);
    if (window.confirm(confirmText)) {
      try {
        const updatedSec = {
          ...sec,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await db.projectSections.put(updatedSec);
        pushProjectSectionLive(updatedSec).catch(() => {});
      } catch (err) {
        console.error('Error moving section to trash:', err);
      }
    }
  };

  // Restore section from trash
  const handleRestoreSection = async (sec) => {
    try {
      const updatedSec = {
        ...sec,
        deletedAt: null,
        updatedAt: new Date().toISOString()
      };
      await db.projectSections.put(updatedSec);
      pushProjectSectionLive(updatedSec).catch(() => {});
    } catch (err) {
      console.error('Error restoring section:', err);
    }
  };

  // Permanent delete section handler
  const handlePermanentDeleteSection = async (sec) => {
    const confirmText = c.permanentDeleteSectionConfirm;
    if (window.confirm(confirmText)) {
      try {
        await db.projectSections.delete(sec.id);
        deleteProjectSectionLive(sec.id).catch(() => {});
      } catch (err) {
        console.error('Error permanently deleting section:', err);
      }
    }
  };

  if (!isProjectSettingsModalOpen || !targetProject) return null;

  const isDefaultProject = targetProject.id === DEFAULT_PROJECT_ID;

  // Save general project settings
  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(c.projectNameRequired);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await updateProject(targetProject.id, {
        name: name.trim(),
        currency,
        standardWorkHours: Number(standardWorkHours) || 8,
        overtimeMultiplier: Number(overtimeMultiplier) || 1.0,
        notes: notes.trim()
      });

      setSuccessMsg(c.projectSavedSuccess);
      setTimeout(() => {
        setIsProjectSettingsModalOpen(false);
      }, 1000);
    } catch (err) {
      console.error('Update project error:', err);
      setErrorMsg(err.message || 'Error updating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (isDefaultProject) {
      alert(c.cannotArchiveDefaultProject);
      return;
    }
    if (confirm(c.confirmArchiveProject)) {
      try {
        await archiveProject(targetProject.id);
        setIsProjectSettingsModalOpen(false);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleUnarchive = async () => {
    try {
      await unarchiveProject(targetProject.id);
      setIsProjectSettingsModalOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSoftDelete = async () => {
    if (isDefaultProject) {
      alert(c.cannotDeleteDefaultProject);
      return;
    }
    const confirmMsg = c.moveToTrashConfirm(targetProject.name);
    if (confirm(confirmMsg)) {
      try {
        await softDeleteProject(targetProject.id);
        setIsProjectSettingsModalOpen(false);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleDelete = async () => {
    if (isDefaultProject) {
      alert(c.cannotDeleteDefaultProject);
      return;
    }
    const confirmMsg = c.confirmDeleteProject(targetProject.name);
    if (confirm(confirmMsg)) {
      try {
        await deleteProject(targetProject.id);
        setIsProjectSettingsModalOpen(false);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const currencies = [
    { code: 'IQD', label: c.currencies.IQD.label, symbol: c.currencies.IQD.symbol },
    { code: 'IRT', label: c.currencies.IRT.label, symbol: c.currencies.IRT.symbol },
    { code: 'USD', label: c.currencies.USD.label, symbol: c.currencies.USD.symbol }
  ];

  const TABS = [
    { id: 'general', icon: FolderKanban, label: c.tabs.general },
    { id: 'sections', icon: Layers, label: c.tabs.sections },
    { id: 'archived', icon: Archive, label: c.tabs.archived },
    { id: 'trash', icon: Trash2, label: c.tabs.trash }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-xs animate-fade-in flex items-center justify-center p-0 sm:p-4 print:p-0"
      onClick={() => setIsProjectSettingsModalOpen(false)}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-3xl shadow-2xl max-w-xl w-full sm:h-[520px] max-h-none sm:max-h-[700px] overflow-hidden transition-all h-[100dvh] sm:h-auto sm:max-h-[85vh] flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {c.modalTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {targetProject.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsProjectSettingsModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Project Selector Bar: Switch between all projects inside the modal */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
            <FolderKanban className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <span>{c.selectedProject}</span>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <select
              value={targetProject.id}
              onChange={(e) => {
                if (setEditingProjectId) setEditingProjectId(e.target.value);
              }}
              className="flex-1 max-w-[200px] sm:max-w-[260px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            >
              {(activeProjects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency})
                </option>
              ))}
            </select>
            
            {/* New Project Button */}
            <button
              type="button"
              onClick={() => {
                setIsProjectSettingsModalOpen(false);
                setIsNewProjectModalOpen(true);
              }}
              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 rounded-xl transition-colors border border-emerald-200/50 dark:border-emerald-800/50"
              title={c.newProject}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Navbar Style */}
        <div className="px-6 pt-4 pb-2 shrink-0 flex justify-center">
          <div className="inline-flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/60 p-1.5 sm:p-2 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative justify-center p-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 ${
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
            })}
          </div>
        </div>

        {/* Modal Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">

        {/* Tab 1: General Settings Form */}
        {activeTab === 'general' ? (
          <>
            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 gap-3 px-6 pt-4 pb-2">
              <div className="p-3 rounded-2xl bg-sky-50/50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {c.totalPersonnel}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                    {stats.workers} {c.personUnit}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {c.totalLogsRecorded}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                    {stats.logs} {c.recordUnit}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification messages */}
            {successMsg && (
              <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-fade-in">
                {errorMsg}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {c.projectName} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={c.projectNamePlaceholder}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {c.projectCurrency}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {currencies.map((curr) => (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => setCurrency(curr.code)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                        currency === curr.code
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span>{curr.label}</span>
                      <span className="text-[10px] opacity-60">({curr.symbol})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.standardWorkHours}</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={standardWorkHours}
                    onChange={(e) => setStandardWorkHours(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.overtimeMultiplier}</span>
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={overtimeMultiplier}
                    onChange={(e) => setOvertimeMultiplier(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {c.notes}
                </label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={c.notesPlaceholder}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Danger Zone: Archive / Trash */}
              {!isDefaultProject && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-start gap-2">
                  {targetProject.status === 'archived' || targetProject.isArchived ? (
                    <button
                      type="button"
                      onClick={handleUnarchive}
                      className="p-2 text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 dark:bg-slate-800/50 dark:hover:bg-amber-950/50 rounded-xl transition-colors border border-transparent hover:border-amber-200/50 dark:hover:border-amber-800/50 shadow-xs"
                      title={c.unarchiveProject}
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleArchive}
                      className="p-2 text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 dark:bg-slate-800/50 dark:hover:bg-amber-950/50 rounded-xl transition-colors border border-transparent hover:border-amber-200/50 dark:hover:border-amber-800/50 shadow-xs"
                      title={c.archiveProject}
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSoftDelete}
                    className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800/50 dark:hover:bg-rose-950/50 rounded-xl transition-colors border border-transparent hover:border-rose-200/50 dark:hover:border-rose-800/50 shadow-xs"
                    title={c.moveToTrash}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProjectSettingsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                >
                  {c.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/25 flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{c.saveChanges}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : activeTab === 'sections' ? (
          /* Tab 2: Project Sub-Sections Manager (Active only) */
          <div className="p-6 space-y-4">
            <div className="flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {c.projectSections}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {c.projectSectionsDesc}
                </p>
              </div>
            </div>

            {/* Add section form */}
            <form onSubmit={handleAddSection} className="flex gap-2">
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder={c.newSectionPlaceholder}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={!newSectionName.trim()}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{c.addSection}</span>
              </button>
            </form>

            {/* List of active sections */}
            <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
              {activeSections.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                  <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <span>{c.noSectionsYet}</span>
                </div>
              ) : (
                activeSections.map((sec) => (
                  <div 
                    key={sec.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs transition-all"
                  >
                    {editingSectionId === sec.id ? (
                      /* Inline Edit Mode */
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editingSectionName}
                          onChange={(e) => setEditingSectionName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditSection(sec);
                            if (e.key === 'Escape') setEditingSectionId(null);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-sky-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditSection(sec)}
                          disabled={!editingSectionName.trim()}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                          title={c.save}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSectionId(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title={c.cancel}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      /* Normal Display Mode */
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{sec.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditSection(sec)}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title={c.editSectionName}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveSection(sec)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
                            title={c.archiveSection}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSectionToTrash(sec)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title={c.moveToTrash}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'archived' ? (
          /* Tab 3: Archived */
          <div className="p-6 space-y-5">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Archive className="w-4 h-4 text-amber-500" />
                <span>{c.archivedTitle}</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                {c.archivedDesc}
              </p>
            </div>

            {/* 1. Archived Sections for this project */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{c.archivedSectionsTitle}</span>
                <span className="text-[11px] text-slate-400 font-mono">({archivedSections.length})</span>
              </div>

              {archivedSections.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <span>{c.noArchivedSections}</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pe-1">
                  {archivedSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-2.5 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">{sec.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUnarchiveSection(sec)}
                          className="flex items-center gap-1 px-2.5 py-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                          title={c.unarchive}
                        >
                          <Archive className="w-3 h-3" />
                          <span>{c.unarchive}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSectionToTrash(sec)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 bg-rose-50/50 dark:bg-rose-950/30 rounded-lg transition-colors"
                          title={c.moveToTrash}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Archived Projects */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{c.archivedProjectsTitle}</span>
                <span className="text-[11px] text-slate-400 font-mono">({archivedProjects?.length || 0})</span>
              </div>

              {(!archivedProjects || archivedProjects.length === 0) ? (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <span>{c.noArchivedProjects}</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pe-1">
                  {archivedProjects.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ms-1.5">({p.currency})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await unarchiveProject(p.id);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                          title={c.unarchive}
                        >
                          <Archive className="w-3 h-3" />
                          <span>{c.unarchive}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(c.moveToTrashConfirm(p.name))) {
                              try {
                                await softDeleteProject(p.id);
                              } catch (err) {
                                alert(err.message);
                              }
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 bg-rose-50/50 dark:bg-rose-950/30 rounded-lg transition-colors"
                          title={c.moveToTrash}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Tab 4: Trash & Recovery (Deleted Sections & Deleted Projects) */
          <div className="p-6 space-y-5">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>{c.trashTitle}</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                {c.trashDesc}
              </p>
            </div>

            {/* 1. Deleted Sections for this project */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{c.deletedSectionsTitle}</span>
                <span className="text-[11px] text-slate-400 font-mono">({deletedSections.length})</span>
              </div>

              {deletedSections.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <span>{c.noDeletedSections}</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pe-1">
                  {deletedSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-2.5 bg-rose-50/40 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{sec.name}</span>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {sec.deletedAt ? String(sec.deletedAt).substring(0, 10) : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRestoreSection(sec)}
                          className="flex items-center gap-1 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                          title={c.restore}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{c.restore}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDeleteSection(sec)}
                          className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-100/70 dark:bg-rose-950/60 rounded-lg transition-colors"
                          title={c.permanentDelete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Deleted Projects */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{c.deletedProjectsTitle}</span>
                <span className="text-[11px] text-slate-400 font-mono">({trashProjects?.length || 0})</span>
              </div>

              {(!trashProjects || trashProjects.length === 0) ? (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <span>{c.noDeletedProjects}</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pe-1">
                  {trashProjects.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 bg-rose-50/40 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ms-1.5">({p.currency})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await restoreProject(p.id);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                          title={c.restore}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{c.restore}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(c.permanentDeleteProjectConfirm(p.name))) {
                              try {
                                await deleteProject(p.id);
                              } catch (err) {
                                alert(err.message);
                              }
                            }
                          }}
                          className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-100/70 dark:bg-rose-950/60 rounded-lg transition-colors"
                          title={c.permanentDelete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
