import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../../db/db';
import {
  getChartOfAccounts,
  addAccountNode,
  updateAccountNode,
  deleteAccountNode,
  resetChartOfAccountsToDefault,
  NATURES
} from '../../services/chartOfAccountsService';
import {
  Layers,
  FolderPlus,
  Folder,
  Tag,
  Search,
  Check,
  X,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Landmark,
  CreditCard,
  Coins,
  Users,
  HardHat,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  HelpCircle,
  Scale,
  Sparkles,
  Info,
  Filter
} from 'lucide-react';

const COPY = {
  fa: {
    headerTitle: 'درختواره کدینگ سرفصل‌های حسابداری (Chart of Accounts)',
    headerSubtitle: 'ساختار استاندارد ۴ رقمی: گروه حساب‌ها (۱ رقمی) ⬅️ حساب کل (۲ رقمی) ⬅️ حساب معین (۴ رقمی) به همراه تفصیلی‌های شناور',
    btnCreateSub: 'افزودن حساب معین جدید',
    btnResetToDefault: 'بازنشانی سرفصل‌های پیش‌فرض کارسینک',
    btnResetTitle: 'بازگرداندن درختواره استاندارد حسابداری شرکتی و پیمانکاری کارسینک',
    resetModalTitle: 'بازنشانی کدینگ حساب‌ها به استاندارد پیش‌فرض',
    resetModalDesc1: 'تمام سرفصل‌های استاندارد سازمانی (گروه‌های ۱ تا ۹، حساب‌های کل و معین ۴ رقمی) بازسازی خواهند شد.',
    resetModalDesc2: 'سرفصل‌های اختصاصی که قبلاً در اسناد مالی یا فاکتورها استفاده شده‌اند، جهت حفظ انضباط دفاتر دست‌نخورده باقی می‌مانند.',
    resetModalDesc3: 'تنها سرفصل‌های دستی فاقد گردش پاک‌سازی خواهند شد.',
    confirmResetBtn: 'بله، بازنشانی استاندارد انجام شود',
    cancel: 'انصراف',
    resetSuccess: 'سرفصل‌های استاندارد حسابداری با موفقیت بازسازی و به‌روزرسانی شدند.',
    deleteBlockedTitle: 'امکان حذف سرفصل وجود ندارد',
    deleteBlockedMsg: 'این سرفصل پایه و سیستمی است یا دارای زیرمجموعه و گردش مالی می‌باشد؛ شما می‌توانید نام و مشخصات آن را ویرایش نمایید.',
    btnUnderstand: 'متوجه شدم',
    metricGroups: 'گروه‌های اصلی:',
    metricGL: 'حساب‌های کل:',
    metricSub: 'حساب‌های معین:',
    metricFloating: 'پیوندهای تفصیلی:',
    btnExpandAll: 'باز کردن همه',
    btnCollapseAll: 'بستن همه',
    searchPh: 'جستجو در کد یا عنوان سرفصل (مثال: ۱۰۲۰، بانک، پیمانکار، مصالح)...',
    filterAll: 'همه گروه‌ها',
    filterAssets: '۱ و ۲: دارایی‌ها',
    filterLiabilities: '۳ و ۴: بدهی‌ها',
    filterEquity: '۵: حقوق صاحبان سهام',
    filterRevenue: '۶: درآمدها',
    filterWIP: '۷: بهای تمام شده و پیمان‌ها',
    filterAdmin: '۸: هزینه‌های عمومی و اداری',
    filterOffBalance: '۹: حساب‌های انتظامی',
    natureDebtor: 'بدهکار',
    natureCreditor: 'بستانکار',
    natureBoth: 'دوطرفه / خنثی',
    floatingDetailsNotice: 'تفصیلی‌های شناور متصل:',
    countSubs: (cnt) => `${cnt} حساب معین`,
    btnAddSubToGL: 'افزودن معین به این حساب کل',
    lblNewSub: 'حساب معین جدید (سطح ۳ - ۴ رقمی):',
    phNewSubCode: 'کد ۴ رقمی (مثال: ۱۰۲۵)',
    phNewSubTitle: 'عنوان حساب معین...',
    btnSave: 'ثبت',
    tipEditName: 'ویرایش نام سرفصل',
    tipDelete: 'حذف سرفصل',
    floatingBankLabel: 'کارت‌ها و حساب‌های بانکی پروژه',
    floatingCashLabel: 'صندوق‌های نقدی فعال کارگاه',
    floatingWorkerLabel: 'پرسنل و استادکاران کارگاه',
    floatingContractorLabel: 'پیمانکاران، استادکاران و تأمین‌کنندگان',
    floatingChequeLabel: 'چک‌های صیادی و دسته‌چک‌ها'
  },
  ku: {
    headerTitle: 'داری کۆدەکانی ژمێریاری (Chart of Accounts)',
    headerSubtitle: 'پێکهاتەی ستانداردی ٤ ژمارەیی: گرووپ (١) ⬅️ گشتی/کل (٢) ⬅️ دیاریکراو/معین (٤) لەگەڵ وردەکاری سەرپێیی',
    btnCreateSub: 'زیادکردنی حیسابی دیاریکراوی نوێ',
    btnResetToDefault: 'گەڕاندنەوەی کۆدە بنەڕەتییەکانی کارسینک',
    btnResetTitle: 'گەڕاندنەوەی داری ستانداردی کۆدەکانی ژمێریاری کارسینک',
    resetModalTitle: 'گەڕاندنەوەی کۆدەکانی ژمێریاری بۆ دۆخی بنەڕەتی',
    resetModalDesc1: 'سەرجەم کۆدە ستانداردەکان (گرووپەکانی ١ تا ٩، حیسابە گشتی و دیاریکراوەکان) دادەمەزرێنەوە.',
    resetModalDesc2: 'ئەو حیسابانەی کە پێشتر لە بەڵگەنامە دارایییەکاندا بەکارهاتوون پارێزراو دەبن.',
    resetModalDesc3: 'تەنها حیسابە دەستییە بێ بەکارهێنانەکان دەسڕدرێنەوە.',
    confirmResetBtn: 'بەڵێ، بیگێڕەوە',
    cancel: 'پەشیمانبوونەوە',
    resetSuccess: 'کۆدەکانی ژمێریاری بە سەرکەوتوویی نوێکرانەوە.',
    deleteBlockedTitle: 'سڕینەوەی ئەم حیسابە ڕێگەپێنەدراوە',
    deleteBlockedMsg: 'ئەم حیسابە بنەڕەتییە یان لە بەڵگەنامە دارایییەکاندا بەکارهاتووە؛ دەتوانیت ناوەکەی دەستکاری بکەیت.',
    btnUnderstand: 'تێگەیشتم',
    metricGroups: 'گرووپە سەرەکییەکان:',
    metricGL: 'حیسابە گشتییەکان:',
    metricSub: 'حیسابە دیاریکراوەکان:',
    metricFloating: 'وردەکارییە بەستراوەکان:',
    btnExpandAll: 'کردنەوەی هەموو',
    btnCollapseAll: 'داخستنی هەموو',
    searchPh: 'گەڕان لە کۆد یان ناوی حیساب (نموونە: ۱۰۲۰، بانک، کرێکار)...',
    filterAll: 'هەموو گرووپەکان',
    filterAssets: '١ و ٢: سامانەکان',
    filterLiabilities: '٣ و ٤: قەرزەکان',
    filterEquity: '٥: سەرمایە',
    filterRevenue: '٦: داهاتەکان',
    filterWIP: '٧: تێچووی پڕۆژە و بەڵێندەرایەتی',
    filterAdmin: '٨: خەرجییە گشتی و کارگێڕییەکان',
    filterOffBalance: '٩: حیسابە ئینتزامییەکان',
    natureDebtor: 'قەرزدار',
    natureCreditor: 'قەرزدەر',
    natureBoth: 'دوولایەنە',
    floatingDetailsNotice: 'وردەکارییە سەربەخۆکان:',
    countSubs: (cnt) => `${cnt} حیسابی معین`,
    btnAddSubToGL: 'زیادکردنی معین بۆ ئەم کلە',
    lblNewSub: 'حیسابی معینی نوێ (ئاستی ٣ - ٤ ژمارەیی):',
    phNewSubCode: 'کۆدی ٤ ژمارەیی (نموونە: ۱۰۲۵)',
    phNewSubTitle: 'ناوی حیسابی معین...',
    btnSave: 'تۆمارکردن',
    tipEditName: 'دەستکاری ناو',
    tipDelete: 'سڕینەوە',
    floatingBankLabel: 'کارت و حیسابە بانکییەکان',
    floatingCashLabel: 'سندووقە نەختییەکانی کارگە',
    floatingWorkerLabel: 'کارمەندان و وەستاکاران',
    floatingContractorLabel: 'پەیمانکاران و دابینکەرانی کەرەستە',
    floatingChequeLabel: 'چەکەکان'
  },
  en: {
    headerTitle: 'Chart of Accounts (COA)',
    headerSubtitle: 'Standard 4-digit hierarchy: Account Group (1-digit) ➡️ General Ledger (2-digit) ➡️ Subsidiary (4-digit) with Floating Sub-ledgers',
    btnCreateSub: 'Add Subsidiary Account',
    btnResetToDefault: 'Restore KarSync Default COA',
    btnResetTitle: 'Restore corporate and contracting standard chart of accounts',
    resetModalTitle: 'Reset Chart of Accounts to Default',
    resetModalDesc1: 'Standard chart of accounts (Groups 1-9, GL and 4-digit subsidiary accounts) will be re-established.',
    resetModalDesc2: 'Custom accounts already used in financial vouchers will be strictly preserved.',
    resetModalDesc3: 'Only unused manual accounts will be purged.',
    confirmResetBtn: 'Yes, Restore Defaults',
    cancel: 'Cancel',
    resetSuccess: 'Standard chart of accounts restored successfully.',
    deleteBlockedTitle: 'Cannot Delete Account',
    deleteBlockedMsg: 'This is a system core account or contains transactions/sub-accounts. You can edit its title instead.',
    btnUnderstand: 'Understood',
    metricGroups: 'Main Groups:',
    metricGL: 'General Ledger:',
    metricSub: 'Subsidiaries:',
    metricFloating: 'Linked Details:',
    btnExpandAll: 'Expand All',
    btnCollapseAll: 'Collapse All',
    searchPh: 'Search by code or title (e.g. 1020, Bank, Materials, Payroll)...',
    filterAll: 'All Groups',
    filterAssets: '1 & 2: Assets',
    filterLiabilities: '3 & 4: Liabilities',
    filterEquity: '5: Equity',
    filterRevenue: '6: Revenues',
    filterWIP: '7: Project Direct Costs (WIP)',
    filterAdmin: '8: Admin & General Expenses',
    filterOffBalance: '9: Off-Balance Memorandum',
    natureDebtor: 'Debtor',
    natureCreditor: 'Creditor',
    natureBoth: 'Dual',
    floatingDetailsNotice: 'Linked Floating Sub-ledgers:',
    countSubs: (cnt) => `${cnt} subsidiaries`,
    btnAddSubToGL: 'Add subsidiary under this GL',
    lblNewSub: 'New Subsidiary Account (Level 3 - 4 digits):',
    phNewSubCode: '4-digit code (e.g. 1025)',
    phNewSubTitle: 'Subsidiary account title...',
    btnSave: 'Save',
    tipEditName: 'Edit title',
    tipDelete: 'Delete account',
    floatingBankLabel: 'Bank accounts and cards',
    floatingCashLabel: 'Active site cash boxes',
    floatingWorkerLabel: 'Workers and craftsmen',
    floatingContractorLabel: 'Subcontractors & Suppliers',
    floatingChequeLabel: 'Cheques & Chequebooks'
  }
};

export default function ChartOfAccountsTab() {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const projectId = currentProject?.id || DEFAULT_PROJECT_ID;
  const t = COPY[language] || COPY.fa;

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [selectedNatureFilter, setSelectedNatureFilter] = useState('all');

  // Expanded nodes set
  const [expandedCodes, setExpandedCodes] = useState(() => new Set(['1', '10', '3', '31', '7', '70']));

  // Modal & Inline creation state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [blockedDeleteMsg, setBlockedDeleteMsg] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [addingSubUnderGL, setAddingSubUnderGL] = useState(null);
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubNature, setNewSubNature] = useState('debtor');
  const [notification, setNotification] = useState(null);

  // Live query for Chart of Accounts from Dexie
  const accounts = useLiveQuery(
    async () => {
      return await getChartOfAccounts(projectId);
    },
    [projectId]
  ) || [];

  // Live queries for floating details counts
  const bankAccounts = useLiveQuery(async () => db.financialAccounts ? await db.financialAccounts.toArray() : [], []) || [];
  const workers = useLiveQuery(async () => db.workers ? await db.workers.toArray() : [], []) || [];
  const counterparties = useLiveQuery(async () => db.counterparties ? await db.counterparties.toArray() : [], []) || [];

  // Grouping accounts into 3 levels: Groups (L1) -> GL (L2) -> Sub (L3)
  const treeData = useMemo(() => {
    const groups = [];
    const glMap = new Map();
    const subMap = new Map();

    accounts.forEach(acc => {
      if (acc.level === 1 || acc.code.length === 1) {
        groups.push({ ...acc, gls: [] });
      } else if (acc.level === 2 || acc.code.length === 2) {
        glMap.set(acc.code, { ...acc, subs: [] });
      } else {
        const parentGL = acc.parentCode || acc.code.slice(0, 2);
        if (!subMap.has(parentGL)) subMap.set(parentGL, []);
        subMap.get(parentGL).push(acc);
      }
    });

    // Attach subs to GLs
    glMap.forEach((glObj, glCode) => {
      glObj.subs = (subMap.get(glCode) || []).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    });

    // Attach GLs to Groups
    groups.forEach(gObj => {
      const gCode = gObj.code;
      const matchingGLs = [];
      glMap.forEach((glObj, glCode) => {
        if (glObj.parentCode === gCode || glCode.startsWith(gCode)) {
          matchingGLs.push(glObj);
        }
      });
      gObj.gls = matchingGLs.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    });

    return groups.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [accounts]);

  // Metrics
  const metrics = useMemo(() => {
    const l1Count = treeData.length;
    let l2Count = 0;
    let l3Count = 0;
    treeData.forEach(g => {
      l2Count += g.gls.length;
      g.gls.forEach(gl => {
        l3Count += gl.subs.length;
      });
    });
    const floatingTotal = bankAccounts.length + workers.length + counterparties.length;
    return { l1Count, l2Count, l3Count, floatingTotal };
  }, [treeData, bankAccounts.length, workers.length, counterparties.length]);

  // Filtered tree data based on search and filters
  const filteredTreeData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return treeData.filter(g => {
      // Group filter
      if (selectedGroupFilter !== 'all') {
        if (selectedGroupFilter === 'assets' && g.code !== '1' && g.code !== '2') return false;
        if (selectedGroupFilter === 'liabilities' && g.code !== '3' && g.code !== '4') return false;
        if (selectedGroupFilter === 'equity' && g.code !== '5') return false;
        if (selectedGroupFilter === 'revenue' && g.code !== '6') return false;
        if (selectedGroupFilter === 'wip' && g.code !== '7') return false;
        if (selectedGroupFilter === 'admin' && g.code !== '8') return false;
        if (selectedGroupFilter === 'offbalance' && g.code !== '9') return false;
      }

      // If no query and no nature filter, keep group
      if (!q && selectedNatureFilter === 'all') return true;

      // Check matching in children
      const matchesGroup = g.code.includes(q) || (g.title && g.title.toLowerCase().includes(q));
      const hasMatchingGL = g.gls.some(gl => {
        if (selectedNatureFilter !== 'all' && gl.nature !== selectedNatureFilter) return false;
        const matchesGL = gl.code.includes(q) || (gl.title && gl.title.toLowerCase().includes(q));
        const hasMatchingSub = gl.subs.some(sub => {
          if (selectedNatureFilter !== 'all' && sub.nature !== selectedNatureFilter) return false;
          return sub.code.includes(q) || (sub.title && sub.title.toLowerCase().includes(q));
        });
        return matchesGL || hasMatchingSub;
      });

      return matchesGroup || hasMatchingGL;
    }).map(g => {
      if (!q && selectedNatureFilter === 'all') return g;

      // Filter sub items
      const filteredGLs = g.gls.filter(gl => {
        if (selectedNatureFilter !== 'all' && gl.nature !== selectedNatureFilter && !gl.subs.some(s => s.nature === selectedNatureFilter)) {
          return false;
        }
        if (!q) return true;
        const matchesGL = gl.code.includes(q) || (gl.title && gl.title.toLowerCase().includes(q));
        const hasMatchingSub = gl.subs.some(s => s.code.includes(q) || (s.title && s.title.toLowerCase().includes(q)));
        return matchesGL || hasMatchingSub;
      }).map(gl => {
        if (!q && selectedNatureFilter === 'all') return gl;
        const filteredSubs = gl.subs.filter(s => {
          if (selectedNatureFilter !== 'all' && s.nature !== selectedNatureFilter) return false;
          if (!q) return true;
          return s.code.includes(q) || (s.title && s.title.toLowerCase().includes(q));
        });
        return { ...gl, subs: filteredSubs };
      });

      return { ...g, gls: filteredGLs };
    });
  }, [treeData, searchQuery, selectedGroupFilter, selectedNatureFilter]);

  // Toggle expand/collapse
  const toggleNode = (code) => {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleExpandAll = () => {
    const all = new Set();
    treeData.forEach(g => {
      all.add(g.code);
      g.gls.forEach(gl => all.add(gl.code));
    });
    setExpandedCodes(all);
  };

  const handleCollapseAll = () => {
    setExpandedCodes(new Set());
  };

  // Add Custom Subsidiary Account
  const handleSaveSub = async (e) => {
    e.preventDefault();
    if (!addingSubUnderGL || !newSubCode.trim() || !newSubTitle.trim()) return;

    try {
      await addAccountNode({
        projectId,
        code: newSubCode.trim(),
        parentCode: addingSubUnderGL.code,
        title: newSubTitle.trim(),
        nature: newSubNature
      });

      setAddingSubUnderGL(null);
      setNewSubCode('');
      setNewSubTitle('');
      setNotification({ type: 'success', message: 'حساب معین جدید با موفقیت اضافه شد.' });
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'خطا در افزودن حساب' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Delete node
  const handleDeleteNode = async (acc) => {
    try {
      await deleteAccountNode(acc.id);
      setNotification({ type: 'success', message: `سرفصل ${acc.code} با موفقیت حذف شد.` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setBlockedDeleteMsg(err.message);
    }
  };

  // Update node title
  const handleUpdateNode = async (id, title) => {
    if (!title.trim()) return;
    try {
      await updateAccountNode(id, { title: title.trim() });
      setEditingNode(null);
      setNotification({ type: 'success', message: 'مشخصات حساب به‌روزرسانی شد.' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'خطا در ویرایش' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Reset to default
  const handleConfirmReset = async () => {
    try {
      await resetChartOfAccountsToDefault(projectId);
      setIsResetModalOpen(false);
      setNotification({ type: 'success', message: t.resetSuccess });
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'خطا در بازنشانی' });
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const getLocalizedTitle = (acc) => {
    if (language === 'ku' && acc.title_ku) return acc.title_ku;
    if (language === 'en' && acc.title_en) return acc.title_en;
    return acc.title;
  };

  const getGroupBadgeColor = (code) => {
    switch (code) {
      case '1': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case '2': return 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30';
      case '3': return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
      case '4': return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case '5': return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      case '6': return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';
      case '7': return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case '8': return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
      default: return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6" dir={direction}>
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md animate-in fade-in duration-200 ${
          notification.type === 'error'
            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Card (Apple Liquid Glass) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shadow-xs">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {t.headerTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {t.headerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={t.btnResetTitle}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.btnResetToDefault}</span>
            </button>
          </div>
        </div>

        {/* 4 Hero Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-center">
            <span className="text-[10px] sm:text-xs text-slate-400 font-bold block">{t.metricGroups}</span>
            <span className="text-base sm:text-xl font-black font-mono text-slate-900 dark:text-white">{metrics.l1Count}</span>
          </div>
          <div className="p-3 sm:p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
            <span className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-bold block">{t.metricGL}</span>
            <span className="text-base sm:text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">{metrics.l2Count}</span>
          </div>
          <div className="p-3 sm:p-4 rounded-2xl bg-primary/10 border border-primary/20 text-center">
            <span className="text-[10px] sm:text-xs text-primary font-bold block">{t.metricSub}</span>
            <span className="text-base sm:text-xl font-black font-mono text-primary">{metrics.l3Count}</span>
          </div>
          <div className="p-3 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <span className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-bold block">{t.metricFloating}</span>
            <span className="text-base sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">{metrics.floatingTotal}</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPh}
              className="w-full ps-10 pe-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t.btnExpandAll}
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t.btnCollapseAll}
            </button>
          </div>
        </div>

        {/* Filter Chips Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'all', label: t.filterAll },
            { id: 'assets', label: t.filterAssets },
            { id: 'liabilities', label: t.filterLiabilities },
            { id: 'equity', label: t.filterEquity },
            { id: 'revenue', label: t.filterRevenue },
            { id: 'wip', label: t.filterWIP },
            { id: 'admin', label: t.filterAdmin },
            { id: 'offbalance', label: t.filterOffBalance }
          ].map(chip => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSelectedGroupFilter(chip.id)}
              className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedGroupFilter === chip.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3-Level Expandable Tree Container */}
      <div className="space-y-4">
        {filteredTreeData.map((group) => {
          const isGroupExpanded = expandedCodes.has(group.code);
          const groupBadgeClass = getGroupBadgeColor(group.code);

          return (
            <div
              key={group.id || group.code}
              className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm overflow-hidden transition-all"
            >
              {/* Level 1: Account Group Header Row */}
              <div
                onClick={() => toggleNode(group.code)}
                className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/80"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center border ${groupBadgeClass}`}>
                    {group.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        {getLocalizedTitle(group)}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                        {t.countSubs(group.gls.reduce((sum, g) => sum + g.subs.length, 0))}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {group.nature === 'debtor' ? t.natureDebtor : group.nature === 'creditor' ? t.natureCreditor : t.natureBoth}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isGroupExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Level 2: General Ledger Accounts List */}
              {isGroupExpanded && (
                <div className="p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40 animate-in fade-in duration-150">
                  {group.gls.map((gl) => {
                    const isGLExpanded = expandedCodes.has(gl.code);
                    const isAddingSub = addingSubUnderGL?.code === gl.code;

                    return (
                      <div
                        key={gl.id || gl.code}
                        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden"
                      >
                        {/* GL Row */}
                        <div
                          onClick={() => toggleNode(gl.code)}
                          className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-black text-xs flex items-center justify-center border border-indigo-500/20">
                              {gl.code}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                                  {getLocalizedTitle(gl)}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  ({gl.subs.length})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddingSubUnderGL(gl);
                                setNewSubCode(`${gl.code}`);
                                setNewSubTitle('');
                                setNewSubNature(gl.nature || 'debtor');
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1 cursor-pointer"
                              title={t.btnAddSubToGL}
                            >
                              <Plus className="w-3 h-3" />
                              <span className="hidden sm:inline">{t.btnCreateSub}</span>
                            </button>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isGLExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Inline Form to Add New Subsidiary Under this GL */}
                        {isAddingSub && (
                          <form onSubmit={handleSaveSub} className="p-3 bg-primary/5 border-t border-primary/20 space-y-2.5 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between text-xs font-bold text-primary">
                              <span>{t.lblNewSub}</span>
                              <button type="button" onClick={() => setAddingSubUnderGL(null)} className="text-slate-400 hover:text-rose-500">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                              <input
                                type="text"
                                maxLength={4}
                                value={newSubCode}
                                onChange={(e) => setNewSubCode(e.target.value.replace(/\D/g, ''))}
                                placeholder={t.phNewSubCode}
                                className="sm:col-span-3 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-center"
                                required
                              />
                              <input
                                type="text"
                                value={newSubTitle}
                                onChange={(e) => setNewSubTitle(e.target.value)}
                                placeholder={t.phNewSubTitle}
                                className="sm:col-span-6 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium"
                                required
                              />
                              <select
                                value={newSubNature}
                                onChange={(e) => setNewSubNature(e.target.value)}
                                className="sm:col-span-3 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                              >
                                <option value="debtor">{t.natureDebtor}</option>
                                <option value="creditor">{t.natureCreditor}</option>
                                <option value="both">{t.natureBoth}</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setAddingSubUnderGL(null)}
                                className="px-3 py-1 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                {t.cancel}
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1 rounded-xl text-xs font-bold bg-primary text-white shadow-xs hover:bg-primary-hover"
                              >
                                {t.btnSave}
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Level 3: Subsidiary Accounts Table / List */}
                        {isGLExpanded && gl.subs.length > 0 && (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                            {gl.subs.map((sub) => {
                              const isEditing = editingNode?.id === sub.id;

                              return (
                                <div
                                  key={sub.id || sub.code}
                                  className="p-2.5 sm:px-4 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    <span className="font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[11px]">
                                      {sub.code}
                                    </span>

                                    {isEditing ? (
                                      <div className="flex items-center gap-1.5 flex-1">
                                        <input
                                          type="text"
                                          defaultValue={sub.title}
                                          id={`edit_title_${sub.id}`}
                                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold flex-1"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = document.getElementById(`edit_title_${sub.id}`)?.value;
                                            handleUpdateNode(sub.id, val);
                                          }}
                                          className="p-1 rounded-lg bg-emerald-500 text-white"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingNode(null)}
                                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                          {getLocalizedTitle(sub)}
                                        </span>

                                        {/* Floating Detail Link Indicators */}
                                        {sub.code === '1020' && bankAccounts.length > 0 && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold border border-emerald-500/20">
                                            {bankAccounts.length} {t.floatingBankLabel}
                                          </span>
                                        )}
                                        {sub.code === '1010' && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold border border-amber-500/20">
                                            {t.floatingCashLabel}
                                          </span>
                                        )}
                                        {(sub.code === '1401' || sub.code === '3201') && workers.length > 0 && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono font-bold border border-indigo-500/20">
                                            {workers.length} {t.floatingWorkerLabel}
                                          </span>
                                        )}
                                        {sub.code === '3101' && counterparties.length > 0 && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 font-mono font-bold border border-purple-500/20">
                                            {counterparties.length} {t.floatingContractorLabel}
                                          </span>
                                        )}
                                        {sub.code === '3401' && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/20">
                                            سپرده حسن انجام کار (۵٪ / ۱۰٪)
                                          </span>
                                        )}
                                        {sub.code === '3402' && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/20">
                                            بیمه ماده ۳۸ پیمان
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {sub.nature === 'debtor' ? t.natureDebtor : sub.nature === 'creditor' ? t.natureCreditor : t.natureBoth}
                                    </span>

                                    {!isEditing && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => setEditingNode(sub)}
                                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                          title={t.tipEditName}
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        {!sub.isSystem && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteNode(sub)}
                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                            title={t.tipDelete}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {t.resetModalTitle}
              </h3>
            </div>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>• {t.resetModalDesc1}</p>
              <p>• {t.resetModalDesc2}</p>
              <p>• {t.resetModalDesc3}</p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-5 py-2 rounded-2xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25"
              >
                {t.confirmResetBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Delete Message Modal */}
      {blockedDeleteMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t.deleteBlockedTitle}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {blockedDeleteMsg || t.deleteBlockedMsg}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setBlockedDeleteMsg(null)}
                className="px-4 py-2 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white"
              >
                {t.btnUnderstand}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
