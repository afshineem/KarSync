import { logAuditAction, getSafeAuthContext } from "../services/auditLogger";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateExpenseId, generateCategoryId, DEFAULT_PROJECT_ID } from '../db/db';
import { useProject } from '../context/ProjectContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth, usePermissions } from '../context/AuthContext';
import { pushExpenseLive, uploadExpenseReceipt } from '../services/realtimeSync';
import { formatCurrency } from '../utils/formatters';
import { 
  PlusCircle, 
  X, 
  Receipt, 
  UploadCloud, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  ShieldAlert,
  Ban,
  HelpCircle,
  Calendar, 
  User, 
  Layers, 
  FolderTree, 
  CreditCard, 
  Lock, 
  FileText,
  DollarSign,
  Wallet,
  Building2,
  Clock,
  ChevronDown,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { useAccounting } from '../hooks/useAccounting';
import { OverdraftConfirmModal } from './accounting/OverdraftConfirmModal';

export function AddExpenseModal({ isOpen = true, onClose, expenseToEdit = null, onSuccess }) {
  const { currentProject } = useProject();
  const { t, language, direction } = useLanguage();
  const { user } = useAuth();
  const { currentUser } = usePermissions();
  const isApprovedAndLocked = expenseToEdit?.status === 'approved';
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
    accountId: '',
    accountName: '',
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

  const { checkAccountOverdraft, accountBalances } = useAccounting();
  const [overdraftPromptData, setOverdraftPromptData] = useState(null);

  // Financial Accounts live query
  const financialAccounts = useLiveQuery(
    async () => {
      if (!db.financialAccounts) return [];
      const list = await db.financialAccounts.toArray();
      return list.filter((a) => !a.deletedAt && a.isActive);
    },
    []
  ) || [];

  const defaultAccount = useMemo(() => {
    return financialAccounts.find((a) => a.isDefault) || financialAccounts[0] || null;
  }, [financialAccounts]);

  const currentOverdraft = useMemo(() => {
    if (formData.paymentStatus !== 'paid' || !formData.accountId) return null;
    const numericAmount = Number(String(formData.amount || 0).replace(/,/g, '')) || 0;
    if (numericAmount <= 0) return null;
    return checkAccountOverdraft(formData.accountId, numericAmount);
  }, [formData.paymentStatus, formData.accountId, formData.amount, checkAccountOverdraft]);

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
        accountId: expenseToEdit.accountId || '',
        accountName: expenseToEdit.accountName || '',
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
      // Default to first main category if available and default account
      setFormData((prev) => ({
        ...prev,
        currency: projectCurrency,
        accountId: prev.accountId || defaultAccount?.id || '',
        accountName: prev.accountName || defaultAccount?.name || '',
        paymentMethod: prev.paymentMethod || (defaultAccount?.type === 'bank' ? 'bank' : 'cash')
      }));
    }
  }, [expenseToEdit, allCategories, projectCurrency, defaultAccount]);

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
  const handleSubmit = async (e, bypassOverdraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage('');

    if (isApprovedAndLocked) {
      setErrorMessage(language === 'fa' ? 'این هزینه قبلاً تایید نهایی شده است و غیرقابل ویرایش می‌باشد.' : 'Approved documents cannot be edited.');
      return;
    }

    if (!formData.title.trim()) {
      setErrorMessage(language === 'fa' ? 'لطفاً عنوان هزینه را وارد کنید.' : 'تکایە ناونیشانی خەرجی بنووسە.');
      return;
    }

    const numericAmount = Number(String(formData.amount).replace(/,/g, ''));
    if (!numericAmount || numericAmount <= 0) {
      setErrorMessage(language === 'fa' ? 'لطفاً مبلغ معتبری وارد کنید.' : 'تکایە بڕە پارەیەکی دروست بنووسە.');
      return;
    }

    // بررسی اضافه برداشت از حساب در صورتی که پرداخت شده باشد
    if (formData.paymentStatus === 'paid' && !bypassOverdraft) {
      const overdraftCheck = checkAccountOverdraft(formData.accountId, numericAmount);
      if (!overdraftCheck.hasSufficientFunds) {
        if (overdraftCheck.effectivePolicy === 'never_allow') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || 'حساب انتخابی',
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: numericAmount,
            shortfall: overdraftCheck.shortfall,
            isBlocked: true
          });
          setErrorMessage(
            language === 'fa'
              ? `موجودی حساب انتخابی (${overdraftCheck.account?.name || 'صندوق/بانک'}) کافی نیست و بر اساس سیاست تعیین شده، برداشت بیش از موجودی غیرمجاز است.`
              : 'باڵانسی حیساب بەش ناکات و کەمبوون ڕێگەپێدراو نییە.'
          );
          return;
        } else if (overdraftCheck.effectivePolicy === 'ask_each_time') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || 'حساب انتخابی',
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: numericAmount,
            shortfall: overdraftCheck.shortfall,
            isBlocked: false
          });
          return;
        }
      }
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
        accountId: formData.accountId || null,
        accountName: formData.accountName || '',
        receiptUrl: finalReceiptUrl || null,
        description: formData.description?.trim() || '',
        expenseDate: formData.expenseDate || new Date().toISOString().slice(0, 10),
        status: expenseToEdit?.status || 'draft',
        created_by: expenseToEdit?.created_by || user?.id || user?.userId || 'admin',
        createdBy: expenseToEdit?.createdBy || user?.name || user?.title || user?.email || '',
        approved_by: expenseToEdit?.approved_by || null,
        approvedBy: expenseToEdit?.approvedBy || null,
        approved_at: expenseToEdit?.approved_at || null,
        approvedAt: expenseToEdit?.approvedAt || null,
        updatedAt: new Date().toISOString(),
        created_by_user_id: expenseToEdit?.created_by_user_id || user?.id,
        updated_by_user_id: user?.id
      };

      if (expenseToEdit) {
        await db.expenses.put(expenseRecord);
      } else {
        expenseRecord.createdAt = new Date().toISOString();
        await db.expenses.add(expenseRecord);
      }

      
        const safeAuth = await getSafeAuthContext();
        await logAuditAction({
            workspaceId: safeAuth.workspaceId,
            userId: safeAuth.userId,
            userName: safeAuth.userName,
        actionType: expenseToEdit ? 'EDIT_EXPENSE' : 'CREATE_EXPENSE',
        entityType: 'expenses',
        entityId: expenseRecord.id,
        projectId: expenseRecord.projectId,
        
        
        
        details: {
          description: expenseToEdit ? `ویرایش هزینه: ${expenseRecord.title}` : `ثبت هزینه جدید: ${expenseRecord.title}`,
          amount: expenseRecord.amount
        }
      });

      // 4. Push to cloud Supabase asynchronously
      pushExpenseLive(expenseRecord).catch(console.warn);

      // Show success feedback
      const finalCheck = (formData.paymentStatus === 'paid')
        ? checkAccountOverdraft(formData.accountId, numericAmount)
        : null;

      if (finalCheck && !finalCheck.hasSufficientFunds) {
        const resultingNeg = Math.abs(finalCheck.currentBalance - numericAmount);
        setToastMessage({
          type: 'warning',
          text: language === 'fa'
            ? `هزینه ثبت شد. توجه: موجودی حساب «${finalCheck.account?.name || 'صندوق'}» به منفی ${formatCurrency(resultingNeg, formData.currency || projectCurrency, language)} رسید.`
            : 'خەرجی تۆمارکرا. باڵانسی حیساب بووە بە نێگەتیڤ.'
        });
      } else {
        setToastMessage({
          type: 'success',
          text: expenseToEdit 
            ? (language === 'fa' ? 'هزینه با موفقیت ویرایش شد.' : 'خەرجی بە سەرکەوتوویی دەستکاری کرا.') 
            : (language === 'fa' ? 'هزینه جدید با موفقیت ثبت شد.' : 'خەرجی نوێ بە سەرکەوتوویی تۆمارکرا.')
        });
      }

      if (onSuccess) onSuccess(expenseRecord);

      const delay = (finalCheck && !finalCheck.hasSufficientFunds) ? 2000 : 700;
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, delay);

    } catch (err) {
      console.error('Error saving expense:', err);
      setErrorMessage(err.message || 'خطا در ذخیره هزینه');
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div 
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white select-none"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[260] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200 ${
          typeof toastMessage === 'object' && toastMessage.type === 'warning'
            ? 'bg-amber-600 text-white shadow-amber-600/30'
            : 'bg-emerald-600 text-white shadow-emerald-600/30'
        }`}>
          {typeof toastMessage === 'object' && toastMessage.type === 'warning' ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          <span>{typeof toastMessage === 'object' ? toastMessage.text : toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs z-20">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-500/25 shrink-0">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {expenseToEdit 
                    ? (language === 'fa' ? 'ویرایش سند هزینه' : 'دەستکاریکردنی خەرجی') 
                    : (language === 'fa' ? 'ثبت هزینه جدید پروژه' : 'تۆمارکردنی خەرجی نوێ')}
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                  {currentProject?.name || 'پروژه کارگاه'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {language === 'fa' ? 'ثبت فاکتور، خرید مصالح، خدمات، کرایه و هزینه‌های عمومی کارگاه' : 'تۆمارکردنی خەرجی و پسوولەکانی کارگە'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            title="بستن (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto bg-[#f3f6f4] dark:bg-slate-950">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6">
          <form id="expense-form" onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isApprovedAndLocked && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-bold flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <div>{language === 'fa' ? 'سند تایید نهایی شده (قفل و غیرقابل تغییر)' : 'بەڵگەنامەی پەسەندکراو (داخراو)'}</div>
                <div className="text-[11px] font-normal text-amber-700 dark:text-amber-300 mt-0.5">
                  {language === 'fa' 
                    ? `این هزینه توسط «${expenseToEdit.approvedBy || 'مدیر ارشد'}» ${expenseToEdit.approvedAt ? `در تاریخ ${expenseToEdit.approvedAt.slice(0, 10)}` : ''} تایید نهایی گردیده و طبق اصول حسابداری غیرقابل ویرایش یا حذف است.`
                    : 'ئەم بەڵگەنامەیە پەسەندکراوە و دەستکاری ناکرێت.'}
                </div>
              </div>
            </div>
          )}

          {/* Responsive 2-Column Desktop Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ───────────────────────────────────────────────────────────── */}
            {/* RIGHT COLUMN (7 Cols): Basic Info, Amount, Categories, Payee  */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="lg:col-span-7 space-y-4.5">
              
              {/* Card 1: Title & Numeric Amount */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <DollarSign className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {language === "fa" ? "مشخصات و مبلغ فاکتور" : "زانیاری و بڕی پارە"}
                  </span>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "fa" ? "عنوان هزینه / شرح فاکتور" : "ناونیشانی خەرجی / بابەت"} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder={language === "fa" ? "مثال: خرید سیمان تیپ ۲، کرایه خاور، ابزار و پذیرایی..." : "نموونە: کڕینی چیمەنتۆ، کرێی سەیارە..."}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "fa" ? "مبلغ پرداختی فاکتور" : "بڕی پارە"} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus-within:ring-2 focus-within:ring-rose-500 overflow-hidden shadow-xs">
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        value={formData.amount ? Number(String(formData.amount).replace(/,/g, "")).toLocaleString() : ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, "").replace(/[^0-9.]/g, "");
                          setFormData({ ...formData, amount: raw });
                        }}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-transparent text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white focus:outline-none"
                      />
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="bg-slate-200/80 dark:bg-slate-700 px-3 py-2 text-xs font-black font-mono text-slate-700 dark:text-slate-200 border-s border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="IQD">د.ع (IQD)</option>
                        <option value="IRT">تومان (IRT)</option>
                        <option value="USD">دلار ($)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: 3-Stage Cascading Category Selector */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {language === "fa" ? "سرفصل هزینه (انتخاب ۳ مرحله‌ای آبشاری)" : "پۆلێنکردنی خەرجی (٣ قۆناغی)"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{language === "fa" ? "+ سرفصل سفارشی" : "+ پۆلی نوێ"}</span>
                  </button>
                </div>

                {/* Quick Category Adder */}
                {isAddingNewCategory && (
                  <div className="p-3 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/40 flex items-center gap-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder={language === "fa" ? "نام سرفصل جدید..." : "ناوی پۆلی نوێ..."}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateNewCategory}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      {language === "fa" ? "افزودن" : "زیادکردن"}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Step 1: Main Group */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      ۱. {language === "fa" ? "گروه اصلی" : "گرووپی سەرەکی"}
                    </label>
                    <select
                      value={formData.mainCategoryId}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          mainCategoryId: e.target.value,
                          subCategoryId: "",
                          categoryId: ""
                        });
                      }}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer shadow-xs"
                    >
                      <option value="">{language === "fa" ? "— انتخاب گروه —" : "— دیاریکردن —"}</option>
                      {mainCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Sub Group */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      ۲. {language === "fa" ? "زیرگروه" : "ژێرگرووپ"}
                    </label>
                    <select
                      disabled={!formData.mainCategoryId || subCategories.length === 0}
                      value={formData.subCategoryId}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          subCategoryId: e.target.value,
                          categoryId: ""
                        });
                      }}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <option value="">
                        {formData.mainCategoryId ? (language === "fa" ? "— انتخاب زیرگروه —" : "— ژێرگرووپ —") : "—"}
                      </option>
                      {subCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Step 3: Micro Category */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      ۳. {language === "fa" ? "هزینه خرد / آیتم" : "وردەکاری"}
                    </label>
                    <select
                      disabled={!formData.subCategoryId || microCategories.length === 0}
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <option value="">
                        {formData.subCategoryId ? (language === "fa" ? "— انتخاب آیتم —" : "— وردەکاری —") : "—"}
                      </option>
                      {microCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 3: Payee & Project Section */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <User className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {language === "fa" ? "طرف‌حساب و بخش کارگاه" : "لایەنی پەیوەندیدار"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Payee / Person */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === "fa" ? "طرف‌حساب / دریافت‌کننده وجه" : "وەرگر"}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomPayeeActive(!customPayeeActive);
                          setFormData((prev) => ({ ...prev, personId: "", personName: "" }));
                        }}
                        className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-bold cursor-pointer"
                      >
                        {customPayeeActive 
                          ? (language === "fa" ? "انتخاب از پرسنل" : "لە کرێکاران") 
                          : (language === "fa" ? "+ شخص متفرقه/فروشنده" : "+ کەسی دەرەکی")}
                      </button>
                    </div>

                    {customPayeeActive ? (
                      <input
                        type="text"
                        value={formData.personName}
                        onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                        placeholder={language === "fa" ? "نام فروشنده، راننده، یا شخص متفرقه..." : "ناوی فرۆشیار..."}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
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
                            personName: w?.name || ""
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-xs"
                      >
                        <option value="">{language === "fa" ? "— بدون انتساب به شخص —" : "— بێ کەسی پەیوەندیدار —"}</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.role ? `(${w.role})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Project Section */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "fa" ? "بخش پروژه (Section)" : "بەشی پڕۆژە"}
                    </label>
                    <select
                      value={formData.sectionId}
                      onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-xs"
                    >
                      <option value="">{language === "fa" ? "عمومی (کل پروژه)" : "گشتی (هەموو پڕۆژە)"}</option>
                      {projectSections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* LEFT COLUMN (5 Cols): Payment State, Account, Date & Receipt  */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="lg:col-span-5 space-y-4.5">
              
              {/* Card 4: Financial Payment Account & [APP_THEME_BUTTON] Status */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <CreditCard className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {language === "fa" ? "وضعیت و محل پرداخت" : "پارەدان و دۆخ"}
                  </span>
                </div>

                {/* [APP_THEME_BUTTON] Payment Status Switcher */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === "fa" ? "وضعیت تسویه فاکتور:" : "دۆخی پارەدان:"}
                  </label>
                  <div className="h-11 inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner w-full">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentStatus: "paid" })}
                      className={`relative flex-1 h-full flex items-center justify-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer text-xs ${
                        formData.paymentStatus === "paid"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === "fa" ? "تسویه شده" : "پارەدراو (کاش)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentStatus: "pending" })}
                      className={`relative flex-1 h-full flex items-center justify-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer text-xs ${
                        formData.paymentStatus === "pending"
                          ? "bg-amber-600 text-white shadow-md shadow-amber-600/30 font-black"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium"
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>{language === "fa" ? "پرداخت نشده (نسیه)" : "قەرز / نەدراو"}</span>
                    </button>
                  </div>
                </div>

                {/* Payment Account Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>{language === "fa" ? "محل / حساب پرداخت:" : "شێوازی پارەدان:"}</span>
                    {defaultAccount && (
                      <span className="text-[10px] text-amber-500 font-bold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                        ⭐ پیش‌فرض: {defaultAccount.name}
                      </span>
                    )}
                  </label>
                  <select
                    value={formData.accountId || formData.paymentMethod}
                    onChange={(e) => {
                      const val = e.target.value;
                      const acc = financialAccounts.find((a) => a.id === val);
                      if (acc) {
                        setFormData({
                          ...formData,
                          accountId: acc.id,
                          accountName: acc.name,
                          paymentMethod: acc.type === "bank" ? "bank" : "cash"
                        });
                      } else {
                        setFormData({
                          ...formData,
                          accountId: "",
                          accountName: "",
                          paymentMethod: val
                        });
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-xs"
                  >
                    {financialAccounts.length > 0 ? (
                      financialAccounts.map((acc) => {
                        const b = accountBalances?.get(String(acc.id))?.currentBalance ?? (Number(acc.initialBalance) || 0);
                        return (
                          <option key={acc.id} value={acc.id}>
                            {acc.type === "bank" ? "💳 کارت بانکی: " : "🪙 صندوق نقدی: "}
                            {acc.name} {acc.bankName ? `(${acc.bankName})` : ""} - موجودی: {formatCurrency(b, formData.currency || projectCurrency, language)} {acc.isDefault ? "⭐ [پیش‌فرض]" : ""}
                          </option>
                        );
                      })
                    ) : (
                      <>
                        <option value="cash">{language === "fa" ? "صندوق اصلی کارگاه (نقدی)" : "سندوقی سەرەکی (کاش)"}</option>
                        <option value="bank">{language === "fa" ? "حساب بانکی / کارت به کارت" : "حسابی بانکی / کارت"}</option>
                        <option value="petty_cash">{language === "fa" ? "تنخواه سرپرست / مدیر کارگاه" : "تەنخوای سەرپەرشتیار"}</option>
                      </>
                    )}
                  </select>

                  {/* Overdraft live alert */}
                  {currentOverdraft && !currentOverdraft.hasSufficientFunds && (
                    <div className={`mt-2 p-3 rounded-2xl border text-xs flex items-start gap-2.5 transition-all ${
                      currentOverdraft.effectivePolicy === "never_allow"
                        ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300"
                        : "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300"
                    }`}>
                      {currentOverdraft.effectivePolicy === "never_allow" ? (
                        <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="font-bold">
                          {currentOverdraft.effectivePolicy === "never_allow"
                            ? "کسری موجودی - ثبت غیرمجاز"
                            : currentOverdraft.effectivePolicy === "always_allow"
                              ? "هشدار کسری موجودی (مجاز در تنظیمات)"
                              : "هشدار کسری موجودی حساب"}
                        </div>
                        <div className="text-[11px] leading-relaxed opacity-90">
                          {currentOverdraft.effectivePolicy === "never_allow"
                            ? `موجودی حساب انتخابی (${formatCurrency(currentOverdraft.currentBalance, formData.currency || projectCurrency, language)}) کافی نیست (کسری: ${formatCurrency(currentOverdraft.shortfall, formData.currency || projectCurrency, language)}).`
                            : `مبلغ هزینه از موجودی حساب (${formatCurrency(currentOverdraft.currentBalance, formData.currency || projectCurrency, language)}) بیشتر است (کسری: ${formatCurrency(currentOverdraft.shortfall, formData.currency || projectCurrency, language)}).`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Date & Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "fa" ? "تاریخ ثبت فاکتور" : "بەرواری فاکتۆر"}
                    </label>
                    <input
                      type="date"
                      value={formData.expenseDate}
                      onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === "fa" ? "توضیح یا شماره فاکتور" : "ژمارەی فاکتۆر"}
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={language === "fa" ? "شماره فاکتور، فروشگاه..." : "تێبینی..."}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Card 5: Receipt Image Upload */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <ImageIcon className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {language === "fa" ? "تصویر فاکتور یا رسید پرداختی" : "وێنەی فاکتۆر"}
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptChange}
                  className="hidden"
                />

                {receiptPreview ? (
                  <div className="relative p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={receiptPreview}
                        alt="Receipt preview"
                        className="w-16 h-16 object-cover rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs"
                      />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {formData.receiptFile?.name || (language === "fa" ? "تصویر فاکتور ضمیمه شد" : "وێنە زیادکرا")}
                        </p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {language === "fa" ? "آماده ذخیره" : "ئامادەیە"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        {language === "fa" ? "تغییر" : "گۆڕین"}
                      </button>
                      <button
                        type="button"
                        onClick={removeReceipt}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
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
                    className="w-full p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-600 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-rose-500 group-hover:scale-105 transition-all shadow-xs">
                      <UploadCloud className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                        {language === "fa" ? "کلیک جهت انتخاب یا عکاسی از فاکتور" : "کلیک بکە بۆ بارکردنی وێنە"}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP (حداکثر ۱۰ مگابایت)</p>
                    </div>
                  </button>
                )}
              </div>

            </div>

          </div>

          </form>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 shrink-0 shadow-lg z-20">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {errorMessage ? (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-400">
                    {language === "fa" ? "مبلغ نهایی:" : "بڕی کۆتایی:"}
                  </span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                    {formData.amount ? Number(formData.amount).toLocaleString() : "۰"}
                  </span>
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    {currencies.find((c) => c.code === formData.currency)?.symbol || formData.currency}
                  </span>
                </div>

                <div
                  className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border ${
                    formData.paymentStatus === "paid"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {formData.paymentStatus === "paid"
                    ? (language === "fa" ? "پرداخت نقدی" : "نەقد")
                    : (language === "fa" ? "ثبت به عنوان بدهی (نسیه)" : "قەرز")}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {language === 'fa' ? 'انصراف (ESC)' : 'پاشگەزبوونەوە'}
            </button>
            <button
              type="submit"
              form="expense-form"
              disabled={isSubmitting || isApprovedAndLocked}
              className={`px-6 py-2.5 rounded-2xl text-xs font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md ${
                currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === 'never_allow'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25'
                  : 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-rose-500/25'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === 'fa' ? 'در حال ثبت...' : 'تۆماردەکرێت...'}</span>
                </>
              ) : currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === 'never_allow' ? (
                <>
                  <Ban className="w-4 h-4" />
                  <span>کسری موجودی (غیرمجاز)</span>
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

      {/* مودال تایید کسری موجودی حساب (در صورت انتخاب سیاست پرسش در هر بار) */}
      {overdraftPromptData && (
        <OverdraftConfirmModal
          isOpen={Boolean(overdraftPromptData)}
          onClose={() => setOverdraftPromptData(null)}
          onConfirm={() => handleSubmit(null, true)}
          accountName={overdraftPromptData.accountName}
          currentBalance={overdraftPromptData.currentBalance}
          requestedAmount={overdraftPromptData.requestedAmount}
          currency={formData.currency || projectCurrency}
          language={language}
          isBlocked={Boolean(overdraftPromptData.isBlocked)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
