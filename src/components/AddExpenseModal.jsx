import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateExpenseId, generateCategoryId, DEFAULT_PROJECT_ID } from '../db/db';
import { useProject } from '../context/ProjectContext';
import { useLanguage } from '../i18n/LanguageContext';
import { pushExpenseLive, uploadExpenseReceipt } from '../services/realtimeSync';
import { 
  PlusCircle, 
  X, 
  Receipt, 
  UploadCloud, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  User, 
  Layers, 
  FolderTree, 
  CreditCard, 
  FileText,
  DollarSign,
  Wallet,
  Building2,
  Clock,
  ChevronDown,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';

export function AddExpenseModal({ isOpen = true, onClose, expenseToEdit = null, onSuccess }) {
  const { currentProject } = useProject();
  const { t, language, direction } = useLanguage();
  const isRtl = direction === 'rtl';
  const fileInputRef = useRef(null);

  const activeProjectId = currentProject?.id || DEFAULT_PROJECT_ID;
  const projectCurrency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  // Live queries for dropdowns
  const projectSections = useLiveQuery(
    () => db.projectSections.where('projectId').equals(activeProjectId).toArray(),
    [activeProjectId]
  ) || [];

  const workers = useLiveQuery(
    () => db.workers.where('projectId').equals(activeProjectId).toArray(),
    [activeProjectId]
  ) || [];

  const allCategories = useLiveQuery(
    () => db.expenseCategories.where('projectId').equals(activeProjectId).toArray(),
    [activeProjectId]
  ) || [];

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    currency: projectCurrency,
    mainCategoryId: '',
    subCategoryId: '',
    categoryId: '', // Level 3 final category
    personId: '',
    personName: '',
    sectionId: '',
    paymentStatus: 'paid', // 'paid' | 'pending'
    paymentMethod: 'cash', // 'cash' | 'bank' | 'petty_cash'
    receiptUrl: '',
    receiptFile: null,
    expenseDate: new Date().toISOString().slice(0, 10),
    description: ''
  });

  const [receiptPreview, setReceiptPreview] = useState('');
  const [customPayeeActive, setCustomPayeeActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // New Category inline creation state
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // 1. Separate categories by Level
  const mainCategories = useMemo(() => {
    return allCategories.filter((c) => c.level === 1 || !c.parentId);
  }, [allCategories]);

  const subCategories = useMemo(() => {
    if (!formData.mainCategoryId) return [];
    return allCategories.filter((c) => c.parentId === formData.mainCategoryId);
  }, [allCategories, formData.mainCategoryId]);

  const microCategories = useMemo(() => {
    if (!formData.subCategoryId) return [];
    return allCategories.filter((c) => c.parentId === formData.subCategoryId);
  }, [allCategories, formData.subCategoryId]);

  // Load existing expense if editing
  useEffect(() => {
    if (expenseToEdit) {
      // Find category hierarchy for this expense
      let mainId = '';
      let subId = '';
      let microId = expenseToEdit.categoryId || '';

      if (microId && allCategories.length > 0) {
        const itemCat = allCategories.find((c) => c.id === microId);
        if (itemCat) {
          if (itemCat.level === 3) {
            subId = itemCat.parentId || '';
            const parentSub = allCategories.find((c) => c.id === subId);
            if (parentSub) mainId = parentSub.parentId || '';
          } else if (itemCat.level === 2) {
            subId = itemCat.id;
            mainId = itemCat.parentId || '';
          } else if (itemCat.level === 1) {
            mainId = itemCat.id;
          }
        }
      }

      setFormData({
        title: expenseToEdit.title || '',
        amount: expenseToEdit.amount || '',
        currency: expenseToEdit.currency || projectCurrency,
        mainCategoryId: mainId,
        subCategoryId: subId,
        categoryId: microId,
        personId: expenseToEdit.personId || '',
        personName: expenseToEdit.personName || '',
        sectionId: expenseToEdit.sectionId || '',
        paymentStatus: expenseToEdit.paymentStatus || 'paid',
        paymentMethod: expenseToEdit.paymentMethod || 'cash',
        receiptUrl: expenseToEdit.receiptUrl || '',
        receiptFile: null,
        expenseDate: expenseToEdit.expenseDate || new Date().toISOString().slice(0, 10),
        description: expenseToEdit.description || ''
      });

      if (expenseToEdit.receiptUrl) {
        setReceiptPreview(expenseToEdit.receiptUrl);
      }

      if (expenseToEdit.personName && !expenseToEdit.personId) {
        setCustomPayeeActive(true);
      }
    } else {
      // Default to first main category if available
      if (mainCategories.length > 0 && !formData.mainCategoryId) {
        setFormData((prev) => ({ ...prev, currency: projectCurrency }));
      }
    }
  }, [expenseToEdit, allCategories, projectCurrency]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle receipt image selection
  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage(language === 'fa' ? 'حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد.' : 'قەبارەی وێنە نابێت لە ١٠ مێگابایت زیاتر بێت.');
        return;
      }
      setFormData((prev) => ({ ...prev, receiptFile: file }));
      const objectUrl = URL.createObjectURL(file);
      setReceiptPreview(objectUrl);
    }
  };

  const removeReceipt = () => {
    setFormData((prev) => ({ ...prev, receiptFile: null, receiptUrl: '' }));
    setReceiptPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add a quick new micro or main category
  const handleCreateNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newId = generateCategoryId();
      const parentId = formData.subCategoryId || formData.mainCategoryId || null;
      let level = 1;
      if (formData.subCategoryId) level = 3;
      else if (formData.mainCategoryId) level = 2;

      await db.expenseCategories.add({
        id: newId,
        projectId: activeProjectId,
        userId: 'default_user',
        name: newCategoryName.trim(),
        parentId: parentId,
        level: level,
        createdAt: new Date().toISOString()
      });

      if (level === 3) {
        setFormData((prev) => ({ ...prev, categoryId: newId }));
      } else if (level === 2) {
        setFormData((prev) => ({ ...prev, subCategoryId: newId }));
      } else {
        setFormData((prev) => ({ ...prev, mainCategoryId: newId }));
      }

      setNewCategoryName('');
      setIsAddingNewCategory(false);
    } catch (err) {
      console.warn('Error adding custom category:', err);
    }
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.title.trim()) {
      setErrorMessage(language === 'fa' ? 'لطفاً عنوان هزینه را وارد کنید.' : 'تکایە ناونیشانی خەرجی بنووسە.');
      return;
    }

    const numericAmount = Number(String(formData.amount).replace(/,/g, ''));
    if (!numericAmount || numericAmount <= 0) {
      setErrorMessage(language === 'fa' ? 'لطفاً مبلغ معتبری وارد کنید.' : 'تکایە بڕە پارەیەکی دروست بنووسە.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Process receipt image if a new file was chosen
      let finalReceiptUrl = formData.receiptUrl;
      if (formData.receiptFile) {
        try {
          const uploadedUrl = await uploadExpenseReceipt(formData.receiptFile);
          if (uploadedUrl) finalReceiptUrl = uploadedUrl;
        } catch (uploadErr) {
          console.warn('Receipt upload notice:', uploadErr);
        }
      }

      // 2. Identify person name
      let personName = formData.personName;
      if (formData.personId && !customPayeeActive) {
        const foundWorker = workers.find((w) => w.id === formData.personId);
        if (foundWorker) personName = foundWorker.name;
      }

      // 3. Fallback category id if level 3 wasn't chosen (use sub or main)
      const finalCategoryId = formData.categoryId || formData.subCategoryId || formData.mainCategoryId || null;

      const expenseRecord = {
        id: expenseToEdit?.id || generateExpenseId(),
        projectId: activeProjectId,
        userId: 'default_user',
        sectionId: formData.sectionId || null,
        categoryId: finalCategoryId,
        personId: customPayeeActive ? null : (formData.personId || null),
        personName: personName || '',
        title: formData.title.trim(),
        amount: numericAmount,
        currency: formData.currency || projectCurrency,
        paymentStatus: formData.paymentStatus,
        paymentMethod: formData.paymentMethod,
        receiptUrl: finalReceiptUrl || null,
        description: formData.description?.trim() || '',
        expenseDate: formData.expenseDate || new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString()
      };

      if (expenseToEdit) {
        await db.expenses.put(expenseRecord);
      } else {
        expenseRecord.createdAt = new Date().toISOString();
        await db.expenses.add(expenseRecord);
      }

      // 4. Push to cloud Supabase asynchronously
      pushExpenseLive(expenseRecord).catch(console.warn);

      // Show success feedback
      setToastMessage(
        expenseToEdit 
          ? (language === 'fa' ? 'هزینه با موفقیت ویرایش شد.' : 'خەرجی بە سەرکەوتوویی دەستکاری کرا.') 
          : (language === 'fa' ? 'هزینه جدید با موفقیت ثبت شد.' : 'خەرجی نوێ بە سەرکەوتوویی تۆمارکرا.')
      );

      if (onSuccess) onSuccess(expenseRecord);

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 700);

    } catch (err) {
      console.error('Error saving expense:', err);
      setErrorMessage(err.message || 'خطا در ذخیره هزینه');
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div 
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-100 dark:bg-slate-950 flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                {expenseToEdit 
                  ? (language === 'fa' ? 'ویرایش فاکتور / هزینه' : 'دەستکاریکردنی خەرجی') 
                  : (language === 'fa' ? 'ثبت هزینه جدید پروژه' : 'تۆمارکردنی خەرجی نوێ')}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {currentProject?.name || 'KarSync'} • {language === 'fa' ? 'مدیریت هزینه‌ها' : 'بەڕێوەبردنی خەرجییەکان'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="بستن (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-6">
          <form id="expense-form" onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Title & Amount with Auto Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'عنوان هزینه / شرح فاکتور' : 'ناونیشانی خەرجی / بابەت'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={language === 'fa' ? 'مثال: خرید سیمان تیپ ۲، کرایه خاور، پذیرایی' : 'نموونە: کڕینی چیمەنتۆ، کرێی سەیارە'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'مبلغ عددی' : 'بڕی پارە'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus-within:ring-2 focus-within:ring-rose-500 overflow-hidden">
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  value={formData.amount ? Number(String(formData.amount).replace(/,/g, '')).toLocaleString() : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                    setFormData({ ...formData, amount: raw });
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2.5 bg-transparent text-sm font-black font-mono text-slate-900 dark:text-white focus:outline-none"
                />
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="bg-slate-200/70 dark:bg-slate-700/70 px-2 py-2 text-xs font-bold font-mono text-slate-700 dark:text-slate-200 border-s border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="IQD">د.ع (IQD)</option>
                  <option value="IRT">تومان (IRT)</option>
                  <option value="USD">دلار ($)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: 3-Stage Cascading Category Selector */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {language === 'fa' ? 'سرفصل هزینه (انتخاب ۳ مرحله‌ای آبشاری)' : 'پۆلێنکردنی خەرجی (٣ قۆناغی)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{language === 'fa' ? '+ سرفصل سفارشی' : '+ پۆلی نوێ'}</span>
              </button>
            </div>

            {/* Quick Category Adder */}
            {isAddingNewCategory && (
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-900/40 flex items-center gap-2 animate-in fade-in duration-150">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={language === 'fa' ? 'نام سرفصل جدید...' : 'ناوی پۆلی نوێ...'}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateNewCategory}
                  className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold"
                >
                  {language === 'fa' ? 'افزودن' : 'زیادکردن'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Step 1: Main Group */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  ۱. {language === 'fa' ? 'گروه اصلی' : 'گرووپی سەرەکی'}
                </label>
                <select
                  value={formData.mainCategoryId}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      mainCategoryId: e.target.value,
                      subCategoryId: '',
                      categoryId: ''
                    });
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                >
                  <option value="">{language === 'fa' ? '— انتخاب گروه اصلی —' : '— دیاریکردنی گرووپ —'}</option>
                  {mainCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Sub Group */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  ۲. {language === 'fa' ? 'زیرگروه' : 'ژێرگرووپ'}
                </label>
                <select
                  disabled={!formData.mainCategoryId || subCategories.length === 0}
                  value={formData.subCategoryId}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      subCategoryId: e.target.value,
                      categoryId: ''
                    });
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:opacity-50 cursor-pointer"
                >
                  <option value="">
                    {formData.mainCategoryId ? (language === 'fa' ? '— انتخاب زیرگروه —' : '— دیاریکردنی ژێرگرووپ —') : '—'}
                  </option>
                  {subCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Step 3: Micro Category */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  ۳. {language === 'fa' ? 'هزینه خرد / آیتم نهایی' : 'وردەکاری خەرجی'}
                </label>
                <select
                  disabled={!formData.subCategoryId || microCategories.length === 0}
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:opacity-50 cursor-pointer"
                >
                  <option value="">
                    {formData.subCategoryId ? (language === 'fa' ? '— انتخاب هزینه خرد —' : '— دیاریکردنی وردەکاری —') : '—'}
                  </option>
                  {microCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Person (Payee) & Project Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payee / Person */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'fa' ? 'طرف‌حساب / دریافت‌کننده وجه' : 'لایەنی بەرامبەر / کەسی وەرگر'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomPayeeActive(!customPayeeActive);
                    setFormData((prev) => ({ ...prev, personId: '', personName: '' }));
                  }}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-bold"
                >
                  {customPayeeActive 
                    ? (language === 'fa' ? 'انتخاب از پرسنل' : 'هەڵبژاردن لە کرێکاران') 
                    : (language === 'fa' ? '+ شخص متفرقه/فروشنده' : '+ کەسی دەرەکی')}
                </button>
              </div>

              {customPayeeActive ? (
                <input
                  type="text"
                  value={formData.personName}
                  onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                  placeholder={language === 'fa' ? 'نام فروشنده، راننده، یا شخص متفرقه...' : 'ناوی فرۆشیار یان کەسی دەرەکی...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              ) : (
                <select
                  value={formData.personId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const w = workers.find((item) => item.id === selId);
                    setFormData({
                      ...formData,
                      personId: selId,
                      personName: w?.name || ''
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="">{language === 'fa' ? '— بدون انتساب به شخص —' : '— بێ کەسی پەیوەندیدار —'}</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.role ? `(${w.role})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Project Section */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'بخش پروژه (Section)' : 'بەشی پڕۆژە'}
              </label>
              <select
                value={formData.sectionId}
                onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">{language === 'fa' ? 'عمومی (کل پروژه)' : 'گشتی (هەموو پڕۆژە)'}</option>
                {projectSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 4: Payment Status & Method Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Status Segmented Control */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'وضعیت تسویه فاکتور' : 'دۆخی پارەدان'}
              </label>
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, paymentStatus: 'paid' })}
                  className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    formData.paymentStatus === 'paid'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'fa' ? 'تسویه شده' : 'پارەدراو (پاکتاو)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, paymentStatus: 'pending' })}
                  className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    formData.paymentStatus === 'pending'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{language === 'fa' ? 'پرداخت نشده (نسیه)' : 'قەرز / نەدراو'}</span>
                </button>
              </div>
            </div>

            {/* Payment Method / Account */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'محل / روش پرداخت' : 'شێوازی پارەدان'}
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="cash">{language === 'fa' ? 'صندوق اصلی کارگاه (نقدی)' : 'سندوقی سەرەکی (کاش)'}</option>
                <option value="bank">{language === 'fa' ? 'حساب بانکی / کارت به کارت' : 'حسابی بانکی / کارت'}</option>
                <option value="petty_cash">{language === 'fa' ? 'تنخواه سرپرست / مدیر کارگاه' : 'تەنخوای سەرپەرشتیار'}</option>
              </select>
            </div>
          </div>

          {/* Section 5: Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'تاریخ ثبت فاکتور' : 'بەرواری فاکتۆر'}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'fa' ? 'توضیحات تکمیلی و یادداشت' : 'تێبینی و وردەکاری'}
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={language === 'fa' ? 'شماره فاکتور، نام فروشگاه یا توضیحات...' : 'ژمارەی فاکتۆر، فرۆشگا...'}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Section 6: Receipt / Invoice Image Upload with Live Preview */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {language === 'fa' ? 'تصویر فاکتور یا رسید پرداختی' : 'وێنەی فاکتۆر یان پسوولە'}
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleReceiptChange}
              className="hidden"
            />

            {receiptPreview ? (
              <div className="relative p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {formData.receiptFile?.name || 'تصویر رسید ضمیمه شده'}
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> {language === 'fa' ? 'تصویر بارگذاری شد' : 'وێنە ئامادەیە'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                  >
                    {language === 'fa' ? 'تغییر' : 'گۆڕین'}
                  </button>
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors"
                    title="حذف تصویر"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-600 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {language === 'fa' ? 'برای آپلود فاکتور کلیک کنید یا عکس بگیرید' : 'کلیک بکە بۆ بارکردنی وێنەی فاکتۆر'}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WebP (حداکثر ۱۰ مگابایت)</p>
                </div>
              </button>
            )}
          </div>

          </form>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 shrink-0 shadow-xs">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {language === 'fa' ? 'انصراف (ESC)' : 'پاشگەزبوونەوە'}
          </button>
          <button
            type="submit"
            form="expense-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-500/25 transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{language === 'fa' ? 'در حال ثبت...' : 'تۆماردەکرێت...'}</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>
                  {expenseToEdit 
                    ? (language === 'fa' ? 'ذخیره تغییرات' : 'پاشەکەوتکردنی گۆڕانکاری') 
                    : (language === 'fa' ? 'ثبت فاکتور هزینه' : 'تۆمارکردنی خەرجی')}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
