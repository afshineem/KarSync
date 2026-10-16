import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { db, generateCounterpartyId, DEFAULT_PROJECT_ID } from '../db/db';
import { 
  X, 
  User, 
  Briefcase, 
  Phone, 
  Building2, 
  Coins, 
  Check, 
  AlertCircle,
  Truck,
  HardHat,
  Sparkles
} from 'lucide-react';
import { pushCounterpartyLive } from '../services/realtimeSync';
import { formatAmount, getCurrencySymbol } from '../utils/formatters';

export function AddCounterpartyModal({ isOpen, onClose, editingCounterparty = null }) {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'employer',
    phone: '',
    company: '',
    contractValue: '',
    status: 'active'
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (editingCounterparty) {
      setFormData({
        name: editingCounterparty.name || '',
        type: editingCounterparty.type || 'employer',
        phone: editingCounterparty.phone || '',
        company: editingCounterparty.company || '',
        contractValue: editingCounterparty.contractValue ? Number(editingCounterparty.contractValue).toLocaleString('en-US') : '',
        status: editingCounterparty.status || 'active'
      });
    } else {
      setFormData({ name: '', type: 'employer', phone: '', company: '', contractValue: '', status: 'active' });
    }
    setFormError('');
  }, [editingCounterparty, isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError(language === 'fa' ? 'لطفاً نام یا عنوان طرف‌حساب را وارد کنید.' : 'تکایە ناو بنووسە.');
      return;
    }

    setIsSubmitting(true);
    const parsedContractValue = Number(String(formData.contractValue).replace(/,/g, '')) || 0;

    try {
      if (editingCounterparty) {
        const updated = {
          ...editingCounterparty,
          projectId: editingCounterparty.projectId || targetProjectId,
          name: formData.name.trim(),
          type: formData.type,
          phone: formData.phone.trim(),
          company: formData.company.trim(),
          contractValue: parsedContractValue,
          status: formData.status,
          updatedAt: new Date().toISOString()
        };
        await db.counterparties.update(editingCounterparty.id, updated);
        pushCounterpartyLive(updated).catch(console.warn);
      } else {
        const record = {
          id: generateCounterpartyId(),
          projectId: targetProjectId,
          name: formData.name.trim(),
          type: formData.type,
          phone: formData.phone.trim(),
          company: formData.company.trim(),
          contractValue: parsedContractValue,
          status: formData.status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await db.counterparties.add(record);
        pushCounterpartyLive(record).catch(console.warn);
      }
      onClose();
    } catch (err) {
      console.error('Error saving counterparty:', err);
      setFormError(err.message || 'خطا در ذخیره اطلاعات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const counterpartyTypes = [
    { id: 'employer', label: language === 'fa' ? 'کارفرما / سرمایه‌گذار' : 'خاوەن کار', icon: Building2, desc: 'تزریق سرمایه و مالک' },
    { id: 'supplier', label: language === 'fa' ? 'تامین‌کننده مصالح' : 'دابینکەر', icon: Truck, desc: 'فروشنده متریال و خدمات' },
    { id: 'subcontractor', label: language === 'fa' ? 'پیمانکار فرعی' : 'بەڵێندەری لاوەکی', icon: HardHat, desc: 'اجراکار دستمزدی' },
    { id: 'other', label: language === 'fa' ? 'سایر اشخاص' : 'هیتر', icon: User, desc: 'طرف‌حساب‌های متفرقه' }
  ];

  const modalContent = (
    <div 
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white select-none"
    >
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs z-20">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <Briefcase className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {editingCounterparty 
                    ? (language === 'fa' ? 'ویرایش مشخصات طرف‌حساب' : 'دەستکاریکردنی لایەنی حیساب') 
                    : (language === 'fa' ? 'تعریف طرف‌حساب جدید' : 'لایەنی حیسابی نوێ')}
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-900/60">
                  {currentProject?.name || 'پروژه جاری'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {language === 'fa' ? 'ثبت اطلاعات کارفرما، تامین‌کنندگان مصالح و پیمانکاران فرعی' : 'تۆمارکردنی زانیاری لایەنەکانی حیساب'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            title="بستن (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Body - #f3f6f4 container */}
      <div className="flex-1 overflow-y-auto bg-[#f3f6f4] dark:bg-slate-950 py-5 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto w-full space-y-4">

          {/* Form Error Alert */}
          {formError && (
            <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Card 1: Counterparty Type Selection */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-3">
                نقش و نوع رابطه با پروژه:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {counterpartyTypes.map((t) => {
                  const Icon = t.icon;
                  const isSelected = formData.type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: t.id }))}
                      className={`p-3 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white border-transparent shadow-md shadow-sky-500/25 scale-[1.02]'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <div className="font-bold text-xs">{t.label}</div>
                      <div className={`text-[10px] truncate max-w-full ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                        {t.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Identity & Contact Info */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300">
                <User className="w-4 h-4 text-sky-500" />
                <span>مشخصات فردی و ارتباطی</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'fa' ? 'نام و نام خانوادگی / عنوان' : 'ناو / ناونیشان'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder={language === 'fa' ? 'مثال: مهندس حسینی' : 'بۆ نموونە: ئەندازیار حوسەینی'}
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'fa' ? 'نام شرکت یا مجموعه (اختیاری)' : 'کۆمپانیا (ئارەزوومەندانە)'}
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="مثال: بتن‌سازان غرب"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'fa' ? 'شماره تماس مستقیم' : 'ژمارەی تەلەفۆن'}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-left"
                    placeholder="0750 000 0000"
                    dir="ltr"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    وضعیت همکاری
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="active">فعال و در جریان</option>
                    <option value="inactive">غیرفعال / تسویه شده</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 3: Financial & Contract Value */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300">
                <Coins className="w-4 h-4 text-emerald-500" />
                <span>قرارداد مالی و توافقات اولیه</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'fa' ? 'مبلغ کل قرارداد توافق‌شده (اختیاری)' : 'بڕی گرێبەست (ئارەزوومەندانە)'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.contractValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFormData(prev => ({ ...prev, contractValue: val ? Number(val).toLocaleString('en-US') : '' }));
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black font-mono text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-left pe-16"
                    placeholder="0"
                    dir="ltr"
                  />
                  <span className="absolute inset-y-0 end-0 pe-4 flex items-center text-xs font-black text-slate-400 pointer-events-none">
                    {getCurrencySymbol(currency, language)}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  برای کارفرمایان یا پیمانکاران، این مبلغ مبنای درصد پیشرفت مالی و صورت‌حساب در دفتر معین قرار خواهد گرفت.
                </p>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
              >
                انصراف (ESC)
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="px-8 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span>در حال ذخیره...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{editingCounterparty ? 'ثبت ویرایش طرف‌حساب' : 'ذخیره طرف‌حساب جدید'}</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
