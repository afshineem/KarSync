import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { createContract, updateContract, WORK_ITEM_UNITS } from '../../services/contractService';
import { formatAmount, numberToWords, getTodayDateString } from '../../utils/formatters';
import {
  X,
  FileSignature,
  Calendar,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Building2,
  HardHat,
  Utensils,
  Home,
  Truck,
  Check,
  Layers,
  Sparkles,
  Info,
  ShieldCheck
} from 'lucide-react';

export default function AddEditContractModal({
  isOpen,
  onClose,
  editingContract = null,
  counterparties = []
}) {
  const { t, language, direction } = useLanguage();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const [formData, setFormData] = useState({
    title: '',
    counterpartyId: '',
    type: 'subcontractor',
    startDate: getTodayDateString(),
    estimatedEndDate: '',
    delayPenaltyPerDay: '',
    items: [
      {
        id: 'item_1',
        title: '',
        unit: 'm2',
        materialProvision: 'contractor',
        estimatedQuantity: '',
        unitPrice: ''
      }
    ],
    backchargeCommitments: {
      food: 'contractor',
      lodging: 'contractor',
      transport: 'contractor',
      tools: 'workshop'
    },
    terms: '',
    notes: ''
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (editingContract) {
      setFormData({
        title: editingContract.title || '',
        counterpartyId: editingContract.counterpartyId || '',
        type: editingContract.type || 'subcontractor',
        startDate: editingContract.startDate || getTodayDateString(),
        estimatedEndDate: editingContract.estimatedEndDate || '',
        delayPenaltyPerDay: editingContract.delayPenaltyPerDay ? String(editingContract.delayPenaltyPerDay) : '',
        items: Array.isArray(editingContract.items) && editingContract.items.length > 0
          ? editingContract.items.map(it => ({
              ...it,
              estimatedQuantity: String(it.estimatedQuantity || ''),
              unitPrice: String(it.unitPrice || '')
            }))
          : [
              {
                id: 'item_1',
                title: '',
                unit: 'm2',
                materialProvision: 'contractor',
                estimatedQuantity: '',
                unitPrice: ''
              }
            ],
        backchargeCommitments: editingContract.backchargeCommitments || {
          food: 'contractor',
          lodging: 'contractor',
          transport: 'contractor',
          tools: 'workshop'
        },
        retentionPolicy: editingContract.retentionPolicy || {
          deductRetention: false,
          retentionRate: 5,
          deductInsurance: false,
          insuranceRate: 5
        },
        terms: editingContract.terms || '',
        notes: editingContract.notes || ''
      });
    } else {
      setFormData({
        title: '',
        counterpartyId: '',
        type: 'subcontractor',
        startDate: getTodayDateString(),
        estimatedEndDate: '',
        delayPenaltyPerDay: '',
        items: [
          {
            id: 'item_1',
            title: '',
            unit: 'm2',
            targetRole: 'worker', // 'master' | 'worker' | 'all'
            materialProvision: 'contractor',
            estimatedQuantity: '',
            unitPrice: ''
          }
        ],
        backchargeCommitments: {
          food: 'contractor',
          lodging: 'contractor',
          transport: 'contractor',
          tools: 'workshop'
        },
        retentionPolicy: {
          deductRetention: false,
          retentionRate: 5,
          deductInsurance: false,
          insuranceRate: 5
        },
        terms: '',
        notes: ''
      });
    }
    setFormError('');
  }, [editingContract, isOpen]);

  // Compute total estimated contract value
  const totalEstimatedAmount = useMemo(() => {
    return formData.items.reduce((sum, it) => {
      const qty = Number(String(it.estimatedQuantity).replace(/,/g, '')) || 0;
      const rate = Number(String(it.unitPrice).replace(/,/g, '')) || 0;
      return sum + (qty * rate);
    }, 0);
  }, [formData.items]);

  // Handle adding new work item row
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item_${Date.now()}`,
          title: '',
          unit: 'm2',
          targetRole: 'worker',
          materialProvision: 'contractor',
          estimatedQuantity: '',
          unitPrice: ''
        }
      ]
    }));
  };

  // Handle removing a work item row
  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Handle updating an item property
  const handleUpdateItem = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError(language === 'ku' ? 'تکایە ناونیشانی گرێبەستەکە دیاری بکە' : language === 'en' ? 'Please enter contract title' : 'لطفاً عنوان قرارداد را وارد کنید');
      return;
    }
    if (!formData.counterpartyId) {
      setFormError(language === 'ku' ? 'تکایە وەستاکار یان لایەنی گرێبەست هەڵبژێرە' : language === 'en' ? 'Please select contractor' : 'لطفاً طرف‌حساب / پیمانکار را انتخاب کنید');
      return;
    }

    // Filter valid items
    const validItems = formData.items
      .map(it => ({
        ...it,
        title: String(it.title || '').trim(),
        unit: it.unit || 'm2',
        targetRole: it.targetRole || (it.unit === 'man_day' ? (it.title?.includes('استادکار') || it.title?.includes('وەستا') ? 'master' : 'worker') : 'worker'),
        materialProvision: it.materialProvision || 'contractor',
        estimatedQuantity: Number(String(it.estimatedQuantity).replace(/,/g, '')) || 0,
        unitPrice: Number(String(it.unitPrice).replace(/,/g, '')) || 0
      }))
      .filter(it => it.title);

    if (validItems.length === 0) {
      setFormError(language === 'ku' ? 'تکایە لانیکەم بڕگەیەکی کارکردن تۆمار بکە' : language === 'en' ? 'Please add at least one work item' : 'لطفاً حداقل یک ردیف کارکرد یا شرح کار وارد کنید');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCp = counterparties.find(c => String(c.id) === String(formData.counterpartyId));
      const payload = {
        title: formData.title.trim(),
        counterpartyId: formData.counterpartyId,
        counterpartyName: selectedCp?.name || '',
        linkedGroupId: selectedCp?.linkedGroupId || editingContract?.linkedGroupId || null,
        type: formData.type,
        startDate: formData.startDate,
        estimatedEndDate: formData.estimatedEndDate,
        delayPenaltyPerDay: Number(String(formData.delayPenaltyPerDay).replace(/,/g, '')) || 0,
        items: validItems,
        backchargeCommitments: formData.backchargeCommitments,
        terms: formData.terms.trim(),
        notes: formData.notes.trim()
      };

      if (editingContract) {
        await updateContract(editingContract.id, payload);
      } else {
        await createContract(payload);
      }
      onClose();
    } catch (err) {
      console.error('Error saving contract:', err);
      setFormError(err.message || 'Error saving contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                {editingContract
                  ? (language === 'ku' ? 'دەستکاری گرێبەست' : language === 'en' ? 'Edit Contract' : 'ویرایش قرارداد پیمانکاری')
                  : (language === 'ku' ? 'عەقد و گرێبەستی نوێ' : language === 'en' ? 'New Construction Contract' : 'عقد قرارداد جدید کارگاهی')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {language === 'ku'
                  ? 'دیاریکردنی مەرجەکانی کار، قەبارەی مەترە، بەرواری تەواوبوون و بڕینەکانی خواردن و مانەوە'
                  : language === 'en'
                  ? 'Define scope of work, unit pricing, estimated completion date, delay penalties and backcharge rules'
                  : 'تعیین تعهدات کاری، احجام متره و برآورد، مواعد زمانی، جریمه دیرکرد و تعهدات اسکان/غذا'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT 7 COLS: Scope of Work & Main Details */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Primary Card: General Info */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white">
                  <HardHat className="w-4 h-4 text-amber-500" />
                  <span>{language === 'ku' ? 'زانیاری گشتی گرێبەست' : language === 'en' ? 'General Contract Specs' : 'مشخصات کلی قرارداد'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Contract Title */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'ku' ? 'ناونیشانی کار / عەقد *' : language === 'en' ? 'Contract Title *' : 'عنوان قرارداد / موضوع پیمان *'}
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder={language === 'ku' ? 'نموونە: کاشیکاری و گەچکاری باڵەخانە' : language === 'en' ? 'e.g., Plastering and Tiling Works' : 'مثال: کاشی‌کاری کف و بدنه طبقات، گچکاری دیوارها'}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      required
                    />
                  </div>

                  {/* Counterparty / Contractor */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'ku' ? 'وەستاکار / لایەنی گرێبەست *' : language === 'en' ? 'Contractor / Master Craftsman *' : 'طرف‌حساب / استادکار یا پیمانکار *'}
                    </label>
                    <select
                      value={formData.counterpartyId}
                      onChange={(e) => setFormData(prev => ({ ...prev, counterpartyId: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      required
                    >
                      <option value="">{language === 'ku' ? '-- هەڵبژاردنی کەس --' : language === 'en' ? '-- Select Party --' : '-- انتخاب طرف‌حساب --'}</option>
                      {counterparties.map(cp => (
                        <option key={cp.id} value={cp.id}>
                          {cp.name} {cp.company ? `(${cp.company})` : ''} {cp.linkedGroupId ? (language === 'ku' ? ' • [تیمی ڕۆژانە]' : language === 'en' ? ' • [Crew Active]' : ' • [اکیپ روزمزد]') : ''}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const curCp = counterparties.find(c => String(c.id) === String(formData.counterpartyId));
                      if (!curCp?.linkedGroupId) return null;
                      return (
                        <div className="mt-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>
                            {language === 'ku'
                              ? 'ئەم لایەنە تیمی ڕۆژانەی هەیە؛ کارکردی ڕۆژانەی تیمەکەی لە فاکتووری کۆتاییدا دێتە ئەژمار.'
                              : language === 'en'
                              ? 'This party has an active crew group; their attendance will be consolidated into the contract settlement.'
                              : 'این طرف‌حساب دارای اکیپ روزمزد است؛ کارکرد روزانه اکیپ در صورت‌وضعیت نهایی قابل تجمیع خواهد بود.'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Party Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'ku' ? 'جۆری لایەن' : language === 'en' ? 'Contractor Role' : 'سمت / ماهیت قرارداد'}
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    >
                      <option value="subcontractor">{language === 'ku' ? 'پەیمانکاری لاوەکی' : language === 'en' ? 'Subcontractor' : 'پیمانکار فرعی'}</option>
                      <option value="master_craftsman">{language === 'ku' ? 'وەستاکاری دەستەبژێر' : language === 'en' ? 'Master Craftsman' : 'استادکار / تیم دستمزدی'}</option>
                      <option value="employer">{language === 'ku' ? 'خاوەنکار / وەبەرهێنەر' : language === 'en' ? 'Employer / Client' : 'کارفرما / سرمایه‌گذار'}</option>
                    </select>
                  </div>

                  {/* Start Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>{language === 'ku' ? 'بەرواری دەستپێکردن' : language === 'en' ? 'Start Date' : 'تاریخ شروع به کار'}</span>
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>

                  {/* Estimated End Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{language === 'ku' ? 'مۆڵەت / بەرواری تەواوبوون' : language === 'en' ? 'Estimated Completion' : 'مهلت / موعد پایان کار'}</span>
                    </label>
                    <input
                      type="date"
                      value={formData.estimatedEndDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedEndDate: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>

                  {/* Delay Penalty per Day */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span>{language === 'ku' ? 'سزای دواکەوتن بۆ هەر ڕۆژێک' : language === 'en' ? 'Daily Delay Penalty' : 'جریمه دیرکرد به ازای هر روز تاخیر'}</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{currency}</span>
                    </label>
                    <input
                      type="text"
                      value={formData.delayPenaltyPerDay ? Number(formData.delayPenaltyPerDay).toLocaleString('en-US') : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, '');
                        if (/^\d*$/.test(raw)) setFormData(prev => ({ ...prev, delayPenaltyPerDay: raw }));
                      }}
                      placeholder={language === 'ku' ? 'بۆ نموونە: ٥٠،٠٠٠ بۆ هەر ڕۆژ' : language === 'en' ? 'e.g. 50,000 per day' : 'مثال: ۵۰,۰۰۰ به ازای هر روز دیرکرد'}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* Scope of Work Dynamic Items Builder */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                    <Layers className="w-4 h-4 text-sky-500" />
                    <span>{language === 'ku' ? 'بڕگەکانی کار و نرخی یەکە (مەترە)' : language === 'en' ? 'Scope of Work & Unit Pricing' : 'ردیف‌های کاری، احجام برآوردی و نرخ واحد'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'ku' ? 'زیادکردنی بڕگە' : language === 'en' ? 'Add Item' : 'افزودن ردیف'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, index) => {
                    const lineTotal = (Number(String(item.estimatedQuantity).replace(/,/g, '')) || 0) * (Number(String(item.unitPrice).replace(/,/g, '')) || 0);
                    return (
                      <div
                        key={item.id || index}
                        className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3 relative group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            #{index + 1}
                          </span>
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                              title={language === 'ku' ? 'سڕینەوەی ئەم بڕگەیە' : language === 'en' ? 'Remove row' : 'حذف این ردیف'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          {/* Item Title */}
                          <div className="sm:col-span-5 space-y-1">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleUpdateItem(index, 'title', e.target.value)}
                              placeholder={language === 'ku' ? 'شیکردنەوەی کار (نموونە: گەچکاری دیوار)' : language === 'en' ? 'Item description (e.g. Wall plaster)' : 'شرح ردیف کار (مثال: گچکاری دیوار، زیرسازی)'}
                              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          {/* Unit */}
                          <div className="sm:col-span-3 space-y-1">
                            <select
                              value={item.unit}
                              onChange={(e) => {
                                const newUnit = e.target.value;
                                handleUpdateItem(index, 'unit', newUnit);
                                if (newUnit === 'man_day' && !item.targetRole) {
                                  handleUpdateItem(index, 'targetRole', 'worker');
                                }
                              }}
                              className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              {WORK_ITEM_UNITS.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u[language] || u.fa}
                                </option>
                              ))}
                            </select>

                            {/* Role selector specifically for man_day */}
                            {item.unit === 'man_day' && (
                              <div className="pt-1">
                                <select
                                  value={item.targetRole || 'worker'}
                                  onChange={(e) => handleUpdateItem(index, 'targetRole', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                  <option value="worker">{language === 'ku' ? 'کرێکار (سادە)' : language === 'en' ? 'General Worker' : 'کارگر ساده / عادی'}</option>
                                  <option value="master">{language === 'ku' ? 'وەستاکار (سەرپەرشتیار)' : language === 'en' ? 'Master Craftsman' : 'استادکار / سرپرست'}</option>
                                  <option value="all">{language === 'ku' ? 'سەرجەم اکیپ (گشتی)' : language === 'en' ? 'All Crew (Combined)' : 'کل اکیپ (تجمیعی)'}</option>
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Material Provision */}
                          <div className="sm:col-span-4 space-y-1">
                            <select
                              value={item.materialProvision}
                              onChange={(e) => handleUpdateItem(index, 'materialProvision', e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="contractor">{language === 'ku' ? 'کەرەستە لەسەر پەیمانکار' : language === 'en' ? 'Materials: Contractor' : 'با مصالح پیمانکار'}</option>
                              <option value="workshop">{language === 'ku' ? 'کەرەستە لەسەر کارگە (دەستمەزد)' : language === 'en' ? 'Materials: Workshop (Labor only)' : 'با مصالح کارگاه (دست‌مزدی)'}</option>
                            </select>
                          </div>

                          {/* Estimated Quantity */}
                          <div className="sm:col-span-5 space-y-1">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.estimatedQuantity ? Number(item.estimatedQuantity).toLocaleString('en-US') : ''}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/,/g, '');
                                  if (/^\d*\.?\d*$/.test(raw)) handleUpdateItem(index, 'estimatedQuantity', raw);
                                }}
                                placeholder={language === 'ku' ? 'قەبارەی خەمڵێنراو' : language === 'en' ? 'Est. Quantity' : 'مقدار / متراژ برآوردی'}
                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </div>

                          {/* Unit Price */}
                          <div className="sm:col-span-4 space-y-1">
                            <input
                              type="text"
                              value={item.unitPrice ? Number(item.unitPrice).toLocaleString('en-US') : ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '');
                                if (/^\d*$/.test(raw)) handleUpdateItem(index, 'unitPrice', raw);
                              }}
                              placeholder={language === 'ku' ? 'نرخی یەکە' : language === 'en' ? 'Unit Price' : 'نرخ هر واحد'}
                              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          {/* Line Total Preview */}
                          <div className="sm:col-span-3 flex items-center justify-end px-2 text-xs font-mono font-black text-slate-700 dark:text-slate-300">
                            {formatAmount(lineTotal, currency)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* RIGHT 5 COLS: Cost Summary & Backcharge Commitments */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Total Estimated Value Hero Card */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 backdrop-blur-xl space-y-2">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>{language === 'ku' ? 'کۆی گشتی خەمڵێنراوی گرێبەست' : language === 'en' ? 'Total Estimated Contract Value' : 'مبلغ کل برآوردی قرارداد'}</span>
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white" dir="ltr">
                  {formatAmount(totalEstimatedAmount, currency)} <span className="text-sm font-sans font-bold">{currency}</span>
                </div>
                {totalEstimatedAmount > 0 && (
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    {numberToWords(totalEstimatedAmount, currency, language)}
                  </div>
                )}
              </div>

              {/* Backcharges & Site Expenses Commitments Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white">
                  <Utensils className="w-4 h-4 text-emerald-500" />
                  <span>{language === 'ku' ? 'بەرپرسیاریەتی خەرجییەکانی کارگە' : language === 'en' ? 'Site Expenses & Backcharges' : 'تعهدات هزینه‌های جانبی و کارگاهی'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'ku'
                    ? 'ئەو خەرجییانەی کە لەسەر ئەستۆی پەیمانکارن لە کاتی ژمێریاری کۆتایی لە شایستەکەی دەبڕدرێن:'
                    : language === 'en'
                    ? 'Expenses marked as "Contractor" will be deducted from final settlement as backcharges:'
                    : 'هزینه‌هایی که «پای پیمانکار» علامت بخورند، در صورت‌وضعیت نهایی به طور خودکار کسر خواهند شد:'}
                </p>

                <div className="space-y-2">
                  {/* Food */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs">
                    <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                      <Utensils className="w-3.5 h-3.5 text-amber-500" />
                      <span>{language === 'ku' ? 'خواردنی تیم' : language === 'en' ? 'Food & Catering' : 'غذا و پذیرایی اکیپ'}</span>
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, backchargeCommitments: { ...prev.backchargeCommitments, food: 'contractor' } }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          formData.backchargeCommitments.food === 'contractor'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {language === 'ku' ? 'پای پەیمانکار' : language === 'en' ? 'Contractor' : 'پای پیمانکار'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, backchargeCommitments: { ...prev.backchargeCommitments, food: 'workshop' } }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          formData.backchargeCommitments.food === 'workshop'
                            ? 'bg-teal-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {language === 'ku' ? 'پای کارگە' : language === 'en' ? 'Workshop' : 'پای کارگاه'}
                      </button>
                    </div>
                  </div>

                  {/* Lodging */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs">
                    <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                      <Home className="w-3.5 h-3.5 text-blue-500" />
                      <span>{language === 'ku' ? 'شوێنی مانەوە و خەوتن' : language === 'en' ? 'Lodging & Housing' : 'اسکان و خوابگاه پرسنل'}</span>
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, backchargeCommitments: { ...prev.backchargeCommitments, lodging: 'contractor' } }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          formData.backchargeCommitments.lodging === 'contractor'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {language === 'ku' ? 'پای پەیمانکار' : language === 'en' ? 'Contractor' : 'پای پیمانکار'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, backchargeCommitments: { ...prev.backchargeCommitments, lodging: 'workshop' } }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          formData.backchargeCommitments.lodging === 'workshop'
                            ? 'bg-teal-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {language === 'ku' ? 'پای کارگە' : language === 'en' ? 'Workshop' : 'پای کارگاه'}
                      </button>
                    </div>
                  </div>

                  {/* Transport */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs">
                    <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                      <Truck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{language === 'ku' ? 'هاتوچۆ و ترابەری' : language === 'en' ? 'Transportation' : 'ایاب و ذهاب و ترابری'}</span>
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, backchargeCommitments: { ...prev.backchargeCommitments, transport: 'contractor' } }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          formData.backchargeCommitments.transport === 'contractor'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {language === 'ku' ? 'پای پەیمانکار' : language === 'en' ? 'Contractor' : 'پای پیمانکار'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, backchargeCommitments: { ...prev.backchargeCommitments, transport: 'workshop' } }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          formData.backchargeCommitments.transport === 'workshop'
                            ? 'bg-teal-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {language === 'ku' ? 'پای کارگە' : language === 'en' ? 'Workshop' : 'پای کارگاه'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Guarantee & Insurance Retention Card (سپرده حسن انجام کار و بیمه) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{language === 'ku' ? 'بارمتە و بڕینە یاسایییەکانی گرێبەست (باشی ئەنجام و بیمە)' : language === 'en' ? 'Contract Retentions (Performance & Insurance)' : 'سپرده‌ها و کسورات قانونی پیمان (حسن انجام کار و بیمه)'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'ku'
                    ? 'لە کاتی هەڵبژاردندا، ئەم بڕینانە بە شێوەیەکی ئۆتۆماتیکی لە کاتی ژمێریاری و صورت‌وەزعییەتدا لە کارکردی ناخالص دەبڕدرێن:'
                    : language === 'en'
                    ? 'When enabled, these retentions will be automatically deducted during interim and final progress billings:'
                    : 'در صورت فعال‌سازی، این مبالغ در تمامی صورت‌وضعیت‌های مرحله‌ای و قطعی به طور خودکار از کارکرد ناخالص کسر می‌گردند:'}
                </p>

                <div className="space-y-3">
                  {/* 1. Performance Guarantee Retention (حسن انجام کار) */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="chk_retention"
                          checked={Boolean(formData.retentionPolicy?.deductRetention)}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            retentionPolicy: {
                              ...prev.retentionPolicy,
                              deductRetention: e.target.checked
                            }
                          }))}
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="chk_retention" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                          {language === 'ku' ? 'بڕینی بارمتەی باشی ئەنجامدانی کار (تەزمین)' : language === 'en' ? 'Deduct Performance Guarantee Retention' : 'کسر سپرده حسن انجام کار (تضمین کیفیت)'}
                        </label>
                      </div>

                      {formData.retentionPolicy?.deductRetention && (
                        <div className="flex items-center gap-1.5 font-mono">
                          {[5, 10].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                retentionPolicy: { ...prev.retentionPolicy, retentionRate: rate }
                              }))}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                Number(formData.retentionPolicy?.retentionRate) === rate
                                  ? 'bg-primary text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              %{rate}
                            </button>
                          ))}
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 ms-1">
                            <span>%</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.retentionPolicy?.retentionRate ?? 5}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                retentionPolicy: { ...prev.retentionPolicy, retentionRate: Number(e.target.value) || 0 }
                              }))}
                              className="w-12 px-1.5 py-0.5 text-center font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {formData.retentionPolicy?.deductRetention && (
                      <p className="text-[10px] text-slate-400 ms-6 leading-relaxed">
                        {language === 'ku'
                          ? `لە هەر صورت‌وەزعییەتێک ${formData.retentionPolicy.retentionRate || 5}٪ دەبڕدرێت و دەچێتە سەر حیسابی معینی ٣٤٠١ تا دوای تەواوبوون و تەسلیمکردنی کۆتایی پڕۆژە.`
                          : language === 'en'
                          ? `${formData.retentionPolicy.retentionRate || 5}% will be deducted from gross billing and credited to Account 3401 until final project delivery.`
                          : `در هر صورت‌وضعیت ${formData.retentionPolicy.retentionRate || 5}٪ از کارکرد ناخالص کسر و در حساب معین ۳۴۰۱ به عنوان بدهی سپرده کارگاه ثبت می‌گردد.`}
                      </p>
                    )}
                  </div>

                  {/* 2. Social Security Insurance Retention (بیمه ماده ۳۸) */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="chk_insurance"
                          checked={Boolean(formData.retentionPolicy?.deductInsurance)}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            retentionPolicy: {
                              ...prev.retentionPolicy,
                              deductInsurance: e.target.checked
                            }
                          }))}
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="chk_insurance" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                          {language === 'ku' ? 'بڕینی بارمتەی بیمەی دڵنیایی کۆمەڵایەتی (مادەی ٣٨)' : language === 'en' ? 'Deduct Social Security Insurance Retention' : 'کسر سپرده بیمه ماده ۳۸ تأمین اجتماعی'}
                        </label>
                      </div>

                      {formData.retentionPolicy?.deductInsurance && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <span>%</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.retentionPolicy?.insuranceRate ?? 5}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                retentionPolicy: { ...prev.retentionPolicy, insuranceRate: Number(e.target.value) || 0 }
                              }))}
                              className="w-12 px-1.5 py-0.5 text-center font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {formData.retentionPolicy?.deductInsurance && (
                      <p className="text-[10px] text-slate-400 ms-6 leading-relaxed">
                        {language === 'ku'
                          ? `لە هەر صورت‌وەزعییەتێک ${formData.retentionPolicy.insuranceRate || 5}٪ دەبڕدرێت و لە حیسابی معینی ٣٤٠٢ دەمێنێتەوە تا پێشکەشکردنی بەڵگەنامەی پاکتاوی بیمە.`
                          : language === 'en'
                          ? `${formData.retentionPolicy.insuranceRate || 5}% will be withheld in Account 3402 until official insurance clearance.`
                          : `در هر صورت‌وضعیت ${formData.retentionPolicy.insuranceRate || 5}٪ از کارکرد ناخالص کسر و در حساب معین ۳۴۰۲ تا زمان ارائه مفاصاحساب تأمین اجتماعی نگهداری می‌شود.`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'ku' ? 'مەرجە تایبەتەکان و تێبینی' : language === 'en' ? 'Special Terms & Notes' : 'شرایط و توضیحات تکمیلی قرارداد'}
                </label>
                <textarea
                  rows="3"
                  value={formData.terms}
                  onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                  placeholder={language === 'ku' ? 'نموونە: پاكکردنەوەی کارگە لە ئەستۆی وەستایە...' : language === 'en' ? 'e.g. Site cleanup is contractor responsibility...' : 'شرایط ضمانت حسن انجام کار، نظافت پس از کار و ...'}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                />
              </div>

            </div>
          </div>

          {/* Sticky Glass Bottom Dock */}
          <div className="sticky bottom-0 z-20 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {language === 'ku' ? 'کۆی کارکرد:' : language === 'en' ? 'Total Scope:' : 'مجموع برآورد:'}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-primary" dir="ltr">
                {formatAmount(totalEstimatedAmount, currency)} {currency}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {language === 'ku' ? 'پەشیمانبوونەوە' : language === 'en' ? 'Cancel' : 'انصراف'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/25 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? (language === 'ku' ? 'تۆمارکردن...' : language === 'en' ? 'Saving...' : 'در حال ثبت...')
                    : editingContract
                    ? (language === 'ku' ? 'نوێکردنەوەی گرێبەست' : language === 'en' ? 'Update Contract' : 'ذخیره تغییرات')
                    : (language === 'ku' ? 'عەقدکردن و تۆمار' : language === 'en' ? 'Sign Contract' : 'ثبت و عقد قرارداد')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
