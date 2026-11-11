import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { WORK_ITEM_UNITS, addContractAmendment } from '../../services/contractService';
import { formatAmount, getTodayDateString } from '../../utils/formatters';
import {
  X,
  FilePlus2,
  Calendar,
  Layers,
  Plus,
  Trash2,
  DollarSign,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  FileText
} from 'lucide-react';

export default function AddContractAmendmentModal({
  isOpen,
  onClose,
  contract,
  onSuccess
}) {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';

  const defaultAmendmentNumber = (contract?.amendments?.length || 0) + 1;
  const defaultTitle = language === 'ku'
    ? `پاشکۆی ژمارە ${defaultAmendmentNumber} - زیادکردنی قەبارەی کار`
    : language === 'en'
    ? `Addendum #${defaultAmendmentNumber} - Scope & Term Amendment`
    : `الحاقیه شماره ${defaultAmendmentNumber} - افزایش حجم و تغییر شرایط`;

  const [amendmentNumber] = useState(defaultAmendmentNumber);
  const [title, setTitle] = useState(defaultTitle);
  const [date, setDate] = useState(getTodayDateString());
  const [estimatedEndDate, setEstimatedEndDate] = useState(contract?.estimatedEndDate || '');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Initialize items from contract when opened
  useEffect(() => {
    if (contract && isOpen) {
      setTitle(defaultTitle);
      setDate(getTodayDateString());
      setEstimatedEndDate(contract.estimatedEndDate || '');
      setNotes('');
      setErrorMessage('');

      // Deep copy contract items
      const initialItems = (contract.items || []).map((it, idx) => ({
        id: it.id || `item_${idx}_${Date.now()}`,
        title: it.title || '',
        unit: it.unit || 'm2',
        estimatedQuantity: it.estimatedQuantity !== undefined ? String(it.estimatedQuantity) : '',
        unitPrice: it.unitPrice !== undefined ? String(it.unitPrice) : '',
        materialProvision: it.materialProvision || 'contractor',
        targetRole: it.targetRole || 'all',
        isExisting: true
      }));

      setItems(initialItems);
    }
  }, [contract, isOpen, defaultTitle]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !contract) return null;

  // Handle adding a new work item
  const handleAddItem = () => {
    const newItem = {
      id: `item_${Date.now()}`,
      title: '',
      unit: 'm2',
      estimatedQuantity: '',
      unitPrice: '',
      materialProvision: 'contractor',
      targetRole: 'all',
      isExisting: false
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Handle updating an item
  const handleUpdateItem = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Handle removing an item
  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate totals
  const previousTotalAmount = Number(contract.totalEstimatedAmount) || 0;
  const newTotalAmount = items.reduce((sum, it) => {
    const qty = Number(String(it.estimatedQuantity).replace(/,/g, '')) || 0;
    const rate = Number(String(it.unitPrice).replace(/,/g, '')) || 0;
    return sum + (qty * rate);
  }, 0);

  const differenceAmount = newTotalAmount - previousTotalAmount;

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage(
        language === 'ku'
          ? 'تکایە ناونیشانی پاشکۆ دیاری بکە.'
          : language === 'en'
          ? 'Please enter an addendum title.'
          : 'لطفاً عنوان الحاقیه را وارد کنید.'
      );
      return;
    }

    // Validate items
    const cleanedItems = items.map((it) => ({
      id: it.id,
      title: String(it.title || '').trim(),
      unit: it.unit || 'm2',
      estimatedQuantity: Number(String(it.estimatedQuantity).replace(/,/g, '')) || 0,
      unitPrice: Number(String(it.unitPrice).replace(/,/g, '')) || 0,
      materialProvision: it.materialProvision || 'contractor',
      targetRole: it.targetRole || 'all'
    }));

    if (cleanedItems.some((it) => !it.title)) {
      setErrorMessage(
        language === 'ku'
          ? 'تکایە ناوی هەموو بڕگەکانی کار پڕبکەرەوە.'
          : language === 'en'
          ? 'Please provide a title for all work items.'
          : 'لطفاً شرح تمامی ردیف‌های کاری را تکمیل نمایید.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addContractAmendment({
        contractId: contract.id,
        amendmentData: {
          title: title.trim(),
          date,
          estimatedEndDate,
          notes: notes.trim(),
          items: cleanedItems
        },
        userId: user?.id
      });

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      console.error('Error adding contract amendment:', err);
      setErrorMessage(err.message || 'Failed to save amendment');
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
        className="w-full max-w-4xl rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-[0_25px_60px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {language === 'ku' ? 'تۆمارکردنی پاشکۆ و متممی گرێبەست' : language === 'en' ? 'Contract Addendum & Scope Amendment' : 'ثبت الحاقیه و متمم قرارداد'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {language === 'ku' ? `پاشکۆی #${amendmentNumber}` : language === 'en' ? `Addendum #${amendmentNumber}` : `الحاقیه شماره ${amendmentNumber}`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {contract.title} • {contract.contractNumber} ({contract.counterpartyName || (language === 'ku' ? 'پەیمانکار' : language === 'en' ? 'Contractor' : 'پیمانکار')})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Addendum Metadata Card */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-white/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  {language === 'ku' ? 'ناونیشانی پاشکۆ / متمم:' : language === 'en' ? 'Addendum Title / Subject:' : 'عنوان الحاقیه / متمم قرارداد:'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'ku' ? 'شرحی پاشکۆ بنووسە...' : language === 'en' ? 'Addendum title...' : 'مثلاً: الحاقیه شماره ۱ - افزایش متراژ و کارهای اضافی'}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  <span>{language === 'ku' ? 'بەرواری پاشکۆ:' : language === 'en' ? 'Addendum Date:' : 'تاریخ ثبت الحاقیه:'}</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-hidden focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                <span>{language === 'ku' ? 'مۆڵەتی نوێی تەواوبوون (ئەگەر درێژکراوەتەوە):' : language === 'en' ? 'New Estimated Completion Date (Extension):' : 'مهلت تحویل جدید پیمان (در صورت تمدید زمان):'}</span>
              </label>
              <input
                type="date"
                value={estimatedEndDate}
                onChange={(e) => setEstimatedEndDate(e.target.value)}
                className="w-full sm:w-1/2 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-hidden focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          {/* Scope & Items Management Card */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-white/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-500" />
                <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                  {language === 'ku' ? 'ڕێکخستن و زیادکردنی بڕگەکانی کار و متراژ' : language === 'en' ? 'Scope of Work & Quantities Adjustment' : 'تنظیم مقادیر پیمان و افزودن ردیف‌های کاری جدید'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'ku' ? 'زیادکردنی بڕگەی نوێ' : language === 'en' ? 'Add Item' : 'افزودن ردیف کاری جدید'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => {
                const qty = Number(String(it.estimatedQuantity).replace(/,/g, '')) || 0;
                const rate = Number(String(it.unitPrice).replace(/,/g, '')) || 0;
                const total = qty * rate;

                return (
                  <div
                    key={it.id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={it.title}
                          onChange={(e) => handleUpdateItem(idx, 'title', e.target.value)}
                          placeholder={language === 'ku' ? 'شرحی بڕگەی کار...' : language === 'en' ? 'Item description...' : 'شرح ردیف کاری...'}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:outline-hidden focus:border-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="w-8 h-8 rounded-xl text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer transition-colors"
                        title={language === 'ku' ? 'سڕینەوە' : language === 'en' ? 'Remove' : 'حذف ردیف'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold">
                          {language === 'ku' ? 'یەکە:' : language === 'en' ? 'Unit:' : 'واحد:'}
                        </span>
                        <select
                          value={it.unit}
                          onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold focus:outline-hidden"
                        >
                          {WORK_ITEM_UNITS.map((u) => (
                            <option key={u.id} value={u.id}>
                              {language === 'ku' ? u.ku : language === 'en' ? u.en : u.fa}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold">
                          {language === 'ku' ? 'قەبارە / متراژ نوێ:' : language === 'en' ? 'New Quantity:' : 'مقدار / حجم جدید:'}
                        </span>
                        <input
                          type="number"
                          step="any"
                          value={it.estimatedQuantity}
                          onChange={(e) => handleUpdateItem(idx, 'estimatedQuantity', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-center focus:outline-hidden focus:border-purple-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold">
                          {language === 'ku' ? 'نرخی یەکە:' : language === 'en' ? 'Unit Price:' : 'نرخ واحد:'}
                        </span>
                        <input
                          type="number"
                          step="any"
                          value={it.unitPrice}
                          onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-center focus:outline-hidden focus:border-purple-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold">
                          {language === 'ku' ? 'کۆی ئەم بڕگەیە:' : language === 'en' ? 'Item Total:' : 'مبلغ کل ردیف:'}
                        </span>
                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-center truncate">
                          {formatAmount(total, currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Financial Comparison Summary */}
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {language === 'ku' ? 'کۆی پێشووی گرێبەست:' : language === 'en' ? 'Previous Contract Total:' : 'مبلغ برآورد اولیه قرارداد:'}
                </span>
                <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                  {formatAmount(previousTotalAmount, currency)} {currency}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-700 dark:text-purple-300">
                  {language === 'ku' ? 'کۆی نوێ دوای پاشکۆ:' : language === 'en' ? 'New Contract Total (After Addendum):' : 'مبلغ جدید پیمان پس از الحاقیه:'}
                </span>
                <span className="font-mono font-black text-purple-700 dark:text-purple-300 text-sm">
                  {formatAmount(newTotalAmount, currency)} {currency}
                </span>
              </div>

              <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <span>{language === 'ku' ? 'جیاوازی بەهای پەیمان:' : language === 'en' ? 'Net Scope Difference (Delta):' : 'تغییر ارزش پیمان (اختلاف):'}</span>
                </span>
                <span className={`font-mono font-black text-sm px-2.5 py-0.5 rounded-lg ${
                  differenceAmount >= 0
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                }`}>
                  {differenceAmount >= 0 ? `+${formatAmount(differenceAmount, currency)}` : formatAmount(differenceAmount, currency)} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Notes Card */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-white/80 dark:border-slate-800 shadow-xs space-y-2">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-purple-500" />
              <span>{language === 'ku' ? 'مەرجەکان و هۆکاری پاشکۆ:' : language === 'en' ? 'Addendum Clauses & Justification:' : 'شروط الحاقیه و توضیحات تغییرات:'}</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'ku' ? 'مەرجە نوێیەکان یان هۆکاری زیادکردنی کار لێرە بنووسە...' : language === 'en' ? 'Enter amendment terms, justifications...' : 'توضیحات، مصوبات کارگاهی، دستورکارها یا بندهای تکمیلی الحاقیه...'}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500 transition-colors"
            />
          </div>
        </form>

        {/* Sticky Glass Bottom Dock */}
        <div className="px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between sticky bottom-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'ku' ? 'سەرجەمی نوێ:' : language === 'en' ? 'New Total:' : 'مبلغ جدید پیمان:'}
            </span>
            <span className="text-sm font-black font-mono text-purple-600 dark:text-purple-400" dir="ltr">
              {formatAmount(newTotalAmount, currency)} {currency}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {language === 'ku' ? 'پاشگەزبوونەوە' : language === 'en' ? 'Cancel' : 'انصراف'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? (language === 'ku' ? 'تۆمارکردن...' : language === 'en' ? 'Saving...' : 'در حال ثبت...') : (language === 'ku' ? 'تۆمارکردنی پاشکۆ' : language === 'en' ? 'Save Addendum' : 'ثبت و اعمال الحاقیه')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
