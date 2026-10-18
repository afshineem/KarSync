import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FolderPlus,
  Folder,
  Tag,
  Search,
  Check,
  X,
  Layers
} from 'lucide-react';

// Scoped dictionary for ExpenseCategoriesTab
const COPY = {
  fa: {
    headerTitle: 'سرفصل‌های هزینه‌ها و مخارج',
    headerSubtitle: 'مدیریت درختواره ۳ لایه: گروه اصلی ⬅️ زیرگروه ⬅️ هزینه خرد برای دسته‌بندی فاکتورها',
    btnCreateL1: 'ایجاد گروه اصلی جدید',
    metricL1: 'گروه‌های اصلی:',
    metricL2: 'زیرگروه‌ها:',
    metricL3: 'هزینه‌های خرد:',
    btnExpandAll: 'باز کردن همه',
    btnCollapseAll: 'بستن همه',
    searchPh: 'جستجو در نام سرفصل‌ها و مخارج...',
    lblNewL1: 'گروه اصلی جدید (سطح ۱):',
    phNewL1: 'مثال: خرید مصالح، حمل و نقل، اداری...',
    btnSaveGroup: 'ثبت گروه',
    emptySearch: 'سرفصلی با این عبارت یافت نشد.',
    emptyNoCategories: 'هنوز هیچ سرفصل هزینه‌ای تعریف نشده است.',
    btnAddFirstCat: 'افزودن اولین سرفصل',
    countSubgroups: (cnt) => `${cnt} زیرگروه`,
    btnAddL2: 'افزودن زیرگروه به این گروه',
    lblNewL2Btn: 'زیرگروه جدید',
    tipEditName: 'ویرایش نام',
    tipDeleteGroup: 'حذف گروه',
    phNewL2: 'نام زیرگروه جدید (سطح ۲)...',
    btnSave: 'ثبت',
    emptyNoL2: 'هیچ زیرگروهی در این شاخه ثبت نشده است.',
    btnAddL2Link: 'افزودن زیرگروه',
    countExpenses: (cnt) => `${cnt} هزینه`,
    btnAddL3: 'افزودن هزینه خرد',
    lblNewL3Btn: 'هزینه خرد',
    tipDeleteL2: 'حذف زیرگروه',
    phNewL3: 'نام هزینه خرد (سطح ۳)...',
    emptyNoL3: 'هیچ هزینه خردی در این زیرگروه نیست.',
    btnAddL3Link: 'افزودن هزینه خرد',
    tipDeleteL3: 'حذف'
  },
  ku: {
    headerTitle: 'سەردێڕی خەرجییەکان',
    headerSubtitle: 'بەڕێوەبردنی داری سێ لایەنی خەرجییەکان: گرووپی سەرەکی ⬅️ ژێرگرووپ ⬅️ وردە خەرجی',
    btnCreateL1: 'زیادکردنی گرووپی سەرەکی',
    metricL1: 'گرووپی سەرەکی:',
    metricL2: 'ژێرگرووپەکان:',
    metricL3: 'وردە خەرجییەکان:',
    btnExpandAll: 'کردنەوەی هەموو',
    btnCollapseAll: 'داخستنی هەموو',
    searchPh: 'گەڕان لە نێو سەردێڕ و خەرجییەکان...',
    lblNewL1: 'گرووپی سەرەکی نوێ (ئاستی ١):',
    phNewL1: 'نموونە: کەرەستە، گواستنەوە، کارگێڕی...',
    btnSaveGroup: 'تۆمارکردن',
    emptySearch: 'هیچ بابەتێک نەدۆزرایەوە.',
    emptyNoCategories: 'هیچ سەردێڕێکی خەرجی تۆمار نەکراوە.',
    btnAddFirstCat: 'زیادکردنی یەکەم سەردێڕ',
    countSubgroups: (cnt) => `${cnt} ژێرگرووپ`,
    btnAddL2: 'زیادکردنی ژێرگرووپ',
    lblNewL2Btn: 'ژێرگرووپی نوێ',
    tipEditName: 'دەستکاری',
    tipDeleteGroup: 'سڕینەوەی گرووپ',
    phNewL2: 'ناوی ژێرگرووپ (ئاستی ٢)...',
    btnSave: 'تۆمار',
    emptyNoL2: 'هیچ ژێرگرووپێک نییە.',
    btnAddL2Link: 'زیادکردنی ژێرگرووپ',
    countExpenses: (cnt) => `${cnt} خەرجی`,
    btnAddL3: 'زیادکردنی وردە خەرجی',
    lblNewL3Btn: 'وردە خەرجی',
    tipDeleteL2: 'سڕینەوەی ژێرگرووپ',
    phNewL3: 'ناوی وردە خەرجی (ئاستی ٣)...',
    emptyNoL3: 'هیچ وردە خەرجییەک نییە.',
    btnAddL3Link: 'زیادکردنی خەرجی',
    tipDeleteL3: 'سڕینەوە'
  },
  en: {
    headerTitle: 'Expense & Cost Categories',
    headerSubtitle: 'Manage 3-tier hierarchy: Main Group ⬅️ Subgroup ⬅️ Petty Expense for invoice classification',
    btnCreateL1: 'Create New Main Group',
    metricL1: 'Main Groups:',
    metricL2: 'Subgroups:',
    metricL3: 'Petty Expenses:',
    btnExpandAll: 'Expand All',
    btnCollapseAll: 'Collapse All',
    searchPh: 'Search categories & expenses...',
    lblNewL1: 'New Main Group (Level 1):',
    phNewL1: 'e.g. Materials purchase, Transportation, Admin...',
    btnSaveGroup: 'Save Group',
    emptySearch: 'No categories found matching this search.',
    emptyNoCategories: 'No expense categories defined yet.',
    btnAddFirstCat: 'Add First Category',
    countSubgroups: (cnt) => `${cnt} Subgroups`,
    btnAddL2: 'Add subgroup to this group',
    lblNewL2Btn: 'New Subgroup',
    tipEditName: 'Edit Name',
    tipDeleteGroup: 'Delete Group',
    phNewL2: 'New subgroup name (Level 2)...',
    btnSave: 'Save',
    emptyNoL2: 'No subgroups recorded in this branch.',
    btnAddL2Link: 'Add Subgroup',
    countExpenses: (cnt) => `${cnt} Expenses`,
    btnAddL3: 'Add petty expense',
    lblNewL3Btn: 'Petty Expense',
    tipDeleteL2: 'Delete Subgroup',
    phNewL3: 'New petty expense name (Level 3)...',
    emptyNoL3: 'No petty expenses in this subgroup.',
    btnAddL3Link: 'Add Expense',
    tipDeleteL3: 'Delete'
  }
};

export default function ExpenseCategoriesTab({
  categories = [],
  targetProjectId,
  user,
  language = 'fa',
  isRtl = true,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}) {
  const txt = COPY[language] || COPY.fa;
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Expanded level 1 and level 2 category IDs
  const [expandedL1Ids, setExpandedL1Ids] = useState(new Set());
  const [expandedL2Ids, setExpandedL2Ids] = useState(new Set());

  // Inline Quick-Add states
  const [newL1Name, setNewL1Name] = useState('');
  const [isAddingL1, setIsAddingL1] = useState(false);

  // adding under L1: L1 id
  const [addingUnderL1Id, setAddingUnderL1Id] = useState(null);
  const [newL2Name, setNewL2Name] = useState('');

  // adding under L2: L2 id
  const [addingUnderL2Id, setAddingUnderL2Id] = useState(null);
  const [newL3Name, setNewL3Name] = useState('');

  // Inline Edit states
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Hierarchical groupings
  const level1List = useMemo(() => {
    return categories.filter((c) => !c.parentId || c.level === 1);
  }, [categories]);

  const level2Map = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      if (c.parentId && c.level === 2) {
        if (!map.has(c.parentId)) map.set(c.parentId, []);
        map.get(c.parentId).push(c);
      }
    }
    return map;
  }, [categories]);

  const level3Map = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      if (c.parentId && c.level === 3) {
        if (!map.has(c.parentId)) map.set(c.parentId, []);
        map.get(c.parentId).push(c);
      }
    }
    return map;
  }, [categories]);

  // Toggle expansion
  const toggleL1 = (id) => {
    setExpandedL1Ids((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleL2 = (id) => {
    setExpandedL2Ids((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const l1s = new Set(level1List.map((c) => c.id));
    const l2s = new Set();
    for (const l2List of level2Map.values()) {
      for (const item of l2List) l2s.add(item.id);
    }
    setExpandedL1Ids(l1s);
    setExpandedL2Ids(l2s);
  };

  const collapseAll = () => {
    setExpandedL1Ids(new Set());
    setExpandedL2Ids(new Set());
  };

  // Submit handlers
  const handleCreateL1 = async (e) => {
    if (e) e.preventDefault();
    if (!newL1Name.trim()) return;
    await onAddCategory({
      name: newL1Name.trim(),
      parentId: null,
      level: 1
    });
    setNewL1Name('');
    setIsAddingL1(false);
  };

  const handleCreateL2 = async (parentL1Id, e) => {
    if (e) e.preventDefault();
    if (!newL2Name.trim()) return;
    await onAddCategory({
      name: newL2Name.trim(),
      parentId: parentL1Id,
      level: 2
    });
    setNewL2Name('');
    setAddingUnderL1Id(null);
    setExpandedL1Ids((prev) => new Set(prev).add(parentL1Id));
  };

  const handleCreateL3 = async (parentL2Id, e) => {
    if (e) e.preventDefault();
    if (!newL3Name.trim()) return;
    await onAddCategory({
      name: newL3Name.trim(),
      parentId: parentL2Id,
      level: 3
    });
    setNewL3Name('');
    setAddingUnderL2Id(null);
    setExpandedL2Ids((prev) => new Set(prev).add(parentL2Id));
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (cat) => {
    if (!editingName.trim()) return;
    await onUpdateCategory(cat.id, editingName.trim());
    setEditingId(null);
    setEditingName('');
  };

  // Filtered Level 1 list by search query (recursive filter check)
  const isMatch = (text) => text.toLowerCase().includes(searchQuery.toLowerCase().trim());

  const filteredL1List = useMemo(() => {
    if (!searchQuery.trim()) return level1List;
    return level1List.filter((l1) => {
      if (isMatch(l1.name)) return true;
      const l2s = level2Map.get(l1.id) || [];
      for (const l2 of l2s) {
        if (isMatch(l2.name)) return true;
        const l3s = level3Map.get(l2.id) || [];
        for (const l3 of l3s) {
          if (isMatch(l3.name)) return true;
        }
      }
      return false;
    });
  }, [level1List, level2Map, level3Map, searchQuery]);

  // Count metrics
  const totalL1 = level1List.length;
  const totalL2 = categories.filter((c) => c.level === 2).length;
  const totalL3 = categories.filter((c) => c.level === 3).length;

  return (
    <div className="space-y-5 w-full animate-in fade-in duration-150">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-sky-500" />
            <span>{txt.headerTitle}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {txt.headerSubtitle}
          </p>
        </div>

        {/* Global Action: New L1 Button (APP_THEME_BUTTON standalone) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddingL1(true)}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white shadow-md shadow-sky-500/25 flex items-center justify-center transition-all duration-300 active:scale-95 flex-shrink-0"
            title={txt.btnCreateL1}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Stats Badges & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-slate-600 dark:text-slate-300">{txt.metricL1}</span>
            <b className="font-mono text-slate-900 dark:text-white font-bold">{totalL1}</b>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-slate-600 dark:text-slate-300">{txt.metricL2}</span>
            <b className="font-mono text-slate-900 dark:text-white font-bold">{totalL2}</b>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-600 dark:text-slate-300">{txt.metricL3}</span>
            <b className="font-mono text-slate-900 dark:text-white font-bold">{totalL3}</b>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700/60 transition-colors"
          >
            {txt.btnExpandAll}
          </button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700/60 transition-colors"
          >
            {txt.btnCollapseAll}
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={txt.searchPh}
          className={`w-full py-2.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all ${
            isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
          }`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ${isRtl ? 'left-3' : 'right-3'}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Inline Create L1 Box (if active) */}
      {isAddingL1 && (
        <form
          onSubmit={handleCreateL1}
          className="p-3.5 rounded-2xl border-2 border-dashed border-sky-500/40 bg-sky-50/50 dark:bg-sky-950/20 flex flex-col sm:flex-row items-center gap-2.5 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 flex-shrink-0">
            <FolderPlus className="w-4 h-4" />
            <span>{txt.lblNewL1}</span>
          </div>
          <input
            type="text"
            autoFocus
            value={newL1Name}
            onChange={(e) => setNewL1Name(e.target.value)}
            placeholder={txt.phNewL1}
            className="flex-1 w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="submit"
              disabled={!newL1Name.trim()}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white flex items-center gap-1 shadow-xs transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{txt.btnSaveGroup}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingL1(false);
                setNewL1Name('');
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Main Hierarchy Tree View */}
      <div className="space-y-3">
        {filteredL1List.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/20">
            <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {searchQuery ? txt.emptySearch : txt.emptyNoCategories}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsAddingL1(true)}
                className="mt-3 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{txt.btnAddFirstCat}</span>
              </button>
            )}
          </div>
        ) : (
          filteredL1List.map((l1) => {
            const isL1Expanded = expandedL1Ids.has(l1.id) || Boolean(searchQuery);
            const l2List = level2Map.get(l1.id) || [];
            const isEditingThisL1 = editingId === l1.id;
            const isAddingL2Here = addingUnderL1Id === l1.id;

            return (
              <div
                key={l1.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 shadow-xs overflow-hidden transition-all duration-200"
              >
                {/* Level 1 Node Header */}
                <div
                  onClick={() => toggleL1(l1.id)}
                  className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                    isL1Expanded
                      ? 'bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/80'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors flex-shrink-0"
                    >
                      {isL1Expanded ? (
                        <ChevronDown className="w-4 h-4 text-sky-500" />
                      ) : isRtl ? (
                        <ChevronLeft className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="w-8 h-8 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 font-bold">
                      <Folder className="w-4 h-4" />
                    </div>

                    {isEditingThisL1 ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 flex-1 max-w-sm"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(l1);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 border border-sky-500 text-slate-900 dark:text-white flex-1 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => saveEdit(l1)}
                          className="p-1 rounded-lg bg-sky-600 text-white hover:bg-sky-500"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {l1.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                          {txt.countSubgroups(l2List.length)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Node Actions */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 flex-shrink-0"
                  >
                    {/* Add L2 Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setAddingUnderL1Id(l1.id);
                        setExpandedL1Ids((prev) => new Set(prev).add(l1.id));
                        setNewL2Name('');
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-500/10 dark:bg-sky-500/20 hover:bg-sky-500/20 dark:hover:bg-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center gap-1 transition-colors"
                      title={txt.btnAddL2}
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                      <span className="hidden sm:inline">{txt.lblNewL2Btn}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => startEdit(l1)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                      title={txt.tipEditName}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(l1.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title={txt.tipDeleteGroup}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Level 1 Expanded Content (Level 2 items) */}
                {isL1Expanded && (
                  <div className="p-3.5 space-y-2.5 bg-slate-50/60 dark:bg-slate-900/50">
                    {/* Inline Add L2 Form */}
                    {isAddingL2Here && (
                      <form
                        onSubmit={(e) => handleCreateL2(l1.id, e)}
                        className={`p-2.5 rounded-xl border border-sky-500/40 bg-white dark:bg-slate-800 flex items-center gap-2 ${
                          isRtl ? 'mr-4' : 'ml-4'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                        <input
                          type="text"
                          autoFocus
                          value={newL2Name}
                          onChange={(e) => setNewL2Name(e.target.value)}
                          placeholder={txt.phNewL2}
                          className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                        />
                        <button
                          type="submit"
                          disabled={!newL2Name.trim()}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>{txt.btnSave}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingUnderL1Id(null);
                            setNewL2Name('');
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    )}

                    {l2List.length === 0 && !isAddingL2Here ? (
                      <div className={`py-3 px-4 text-xs text-slate-400 dark:text-slate-500 text-center rounded-xl bg-white/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 ${
                        isRtl ? 'mr-4' : 'ml-4'
                      }`}>
                        <span>{txt.emptyNoL2}</span>
                        <button
                          type="button"
                          onClick={() => setAddingUnderL1Id(l1.id)}
                          className="font-bold text-sky-600 dark:text-sky-400 hover:underline mx-1.5"
                        >
                          {txt.btnAddL2Link}
                        </button>
                      </div>
                    ) : (
                      l2List.map((l2) => {
                        const isL2Expanded = expandedL2Ids.has(l2.id) || Boolean(searchQuery);
                        const l3List = level3Map.get(l2.id) || [];
                        const isEditingThisL2 = editingId === l2.id;
                        const isAddingL3Here = addingUnderL2Id === l2.id;

                        return (
                          <div
                            key={l2.id}
                            className={`rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs ${
                              isRtl ? 'mr-4' : 'ml-4'
                            }`}
                          >
                            {/* Level 2 Node Header */}
                            <div
                              onClick={() => toggleL2(l2.id)}
                              className={`p-2.5 flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${
                                isL2Expanded
                                  ? 'bg-slate-100/90 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <button
                                  type="button"
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
                                >
                                  {isL2Expanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                                  ) : isRtl ? (
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <div className="w-6 h-6 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center flex-shrink-0">
                                  <Layers className="w-3.5 h-3.5" />
                                </div>

                                {isEditingThisL2 ? (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1.5 flex-1 max-w-xs"
                                  >
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEdit(l2);
                                        if (e.key === 'Escape') cancelEdit();
                                      }}
                                      className="px-2 py-0.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 border border-blue-500 text-slate-900 dark:text-white flex-1 focus:outline-hidden"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => saveEdit(l2)}
                                      className="p-1 rounded-lg bg-blue-500 text-white"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEdit}
                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                      {l2.name}
                                    </span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                                      {txt.countExpenses(l3List.length)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* L2 Actions */}
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 flex-shrink-0"
                              >
                                {/* Add L3 Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddingUnderL2Id(l2.id);
                                    setExpandedL2Ids((prev) => new Set(prev).add(l2.id));
                                    setNewL3Name('');
                                  }}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center gap-1 transition-colors"
                                  title={txt.btnAddL3}
                                >
                                  <Plus className="w-3 h-3 stroke-[2.5]" />
                                  <span className="hidden sm:inline">{txt.lblNewL3Btn}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => startEdit(l2)}
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                  title={txt.tipEditName}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onDeleteCategory(l2.id)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title={txt.tipDeleteL2}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Level 2 Expanded Content (Level 3 Items) */}
                            {isL2Expanded && (
                              <div className="p-2.5 space-y-1.5 bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
                                {/* Inline Add L3 Form */}
                                {isAddingL3Here && (
                                  <form
                                    onSubmit={(e) => handleCreateL3(l2.id, e)}
                                    className={`p-2 rounded-lg border border-emerald-500/40 bg-white dark:bg-slate-800 flex items-center gap-2 ${
                                      isRtl ? 'mr-4' : 'ml-4'
                                    }`}
                                  >
                                    <Tag className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                    <input
                                      type="text"
                                      autoFocus
                                      value={newL3Name}
                                      onChange={(e) => setNewL3Name(e.target.value)}
                                      placeholder={txt.phNewL3}
                                      className="flex-1 px-2 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <button
                                      type="submit"
                                      disabled={!newL3Name.trim()}
                                      className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>{txt.btnSave}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingUnderL2Id(null);
                                        setNewL3Name('');
                                      }}
                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </form>
                                )}

                                {l3List.length === 0 && !isAddingL3Here ? (
                                  <div className={`py-2 px-3 text-[11px] text-slate-400 dark:text-slate-400 text-center rounded-lg bg-white/40 dark:bg-slate-850/60 border border-dashed border-slate-200 dark:border-slate-700 ${
                                    isRtl ? 'mr-4' : 'ml-4'
                                  }`}>
                                    <span>{txt.emptyNoL3}</span>
                                    <button
                                      type="button"
                                      onClick={() => setAddingUnderL2Id(l2.id)}
                                      className="font-bold text-sky-600 dark:text-sky-400 hover:underline mx-1"
                                    >
                                      {txt.btnAddL3Link}
                                    </button>
                                  </div>
                                ) : (
                                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-1.5 ${isRtl ? 'mr-4' : 'ml-4'}`}>
                                    {l3List.map((l3) => {
                                      const isEditingThisL3 = editingId === l3.id;

                                      return (
                                        <div
                                          key={l3.id}
                                          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 shadow-2xs"
                                        >
                                          {isEditingThisL3 ? (
                                            <div className="flex items-center gap-1 flex-1">
                                              <input
                                                type="text"
                                                autoFocus
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') saveEdit(l3);
                                                  if (e.key === 'Escape') cancelEdit();
                                                }}
                                                className="px-2 py-0.5 text-xs font-medium rounded-md bg-slate-50 dark:bg-slate-900 border border-emerald-500 text-slate-900 dark:text-white flex-1 focus:outline-hidden"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => saveEdit(l3)}
                                                className="p-1 rounded-md bg-emerald-600 text-white"
                                              >
                                                <Check className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={cancelEdit}
                                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                                <span className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate">
                                                  {l3.name}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                                <button
                                                  type="button"
                                                  onClick={() => startEdit(l3)}
                                                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                  title={txt.tipEditName}
                                                >
                                                  <Pencil className="w-3 h-3" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => onDeleteCategory(l3.id)}
                                                  className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                  title={txt.tipDeleteL3}
                                                >
                                                  <Trash2 className="w-3 h-3" />
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
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
