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
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden text-slate-900 dark:text-white select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      {/* هدر شیشه‌ای اختصاصی (Apple Liquid Glass Header) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 shadow-xs z-20">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
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
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-900/60">
                  {currentProject?.name || 'پروژه جاری'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {language === 'fa' ? 'ثبت و ساماندهی اطلاعات کارفرما، تامین‌کنندگان مصالح و پیمانکاران فرعی' : 'تۆمارکردنی زانیاری لایەنەکانی حیساب'}
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

      {/* بدنه اصلی اسکرول‌پذیر با پس‌زمینه #f3f6f4 و گرید ۱۲ ستونه دسکتاپ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#f3f6f4] dark:bg-slate-950 py-5 px-3 sm:px-6 pb-28">
        <div className="max-w-6xl mx-auto w-full space-y-4">

          {/* پیام خطای اعتبارسنجی فرم */}
          {formError && (
            <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 shadow-xs animate-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form id="counterparty-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* ستون راست (۷ ستون دسکتاپ): نقش رابطه و اطلاعات هویتی */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* کارت ۱: انتخاب نقش و رابطه با پروژه */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-sky-500" />
                      <span>نقش و جایگاه در پروژه</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">نوع همکاری را انتخاب کنید</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {counterpartyTypes.map((t) => {
                      const Icon = t.icon;
                      const isSelected = formData.type === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, type: t.id }))}
                          className={`p-3 rounded-2xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white border-transparent shadow-md shadow-sky-500/25 scale-[1.02]'
                              : 'bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:border-sky-400 hover:bg-white dark:hover:bg-slate-800'
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

                {/* کارت ۲: مشخصات فردی، نام تجاری و اطلاعات ارتباطی */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-800 dark:text-slate-200">
                    <User className="w-4 h-4 text-sky-500" />
                    <span>مشخصات هویتی و راه‌های ارتباطی</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* نام طرف حساب */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        {language === 'fa' ? 'نام و نام خانوادگی / عنوان طرف‌حساب' : 'ناو / ناونیشان'} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all shadow-2xs"
                        placeholder={language === 'fa' ? 'مثال: مهندس حسینی / مصالح‌فروشی البرز' : 'بۆ نموونە: ئەندازیار حوسەینی'}
                      />
                    </div>

                    {/* نام شرکت یا مجموعه */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{language === 'fa' ? 'شرکت / برند تجاری (اختیاری)' : 'کۆمپانیا (ئارەزوومەندانە)'}</span>
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all shadow-2xs"
                        placeholder="مثال: بتن‌سازان غرب"
                      />
                    </div>

                    {/* شماره تماس */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{language === 'fa' ? 'شماره تماس مستقیم' : 'ژمارەی تەلەفۆن'}</span>
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all shadow-2xs text-left"
                        placeholder="0750 000 0000"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* ستون چپ (۵ ستون دسکتاپ): مبالغ مالی، وضعیت و پیش‌نمایش زنده */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* کارت ۳: مبالغ مالی و قرارداد توافق‌شده */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-800 dark:text-slate-200">
                    <Coins className="w-4 h-4 text-emerald-500" />
                    <span>مبلغ توافق‌شده و قرارداد</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {language === 'fa' ? 'مبلغ کل توافق یا قرارداد (اختیاری)' : 'بڕی گرێبەست (ئارەزوومەندانە)'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.contractValue}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFormData(prev => ({ ...prev, contractValue: val ? Number(val).toLocaleString('en-US') : '' }));
                        }}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left pe-16 shadow-inner transition-all"
                        placeholder="0"
                        dir="ltr"
                      />
                      <span className="absolute inset-y-0 end-0 pe-4 flex items-center text-xs font-black text-slate-400 pointer-events-none">
                        {getCurrencySymbol(currency, language)}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                      این مبلغ در صورت‌حساب معین و تراز طرف‌حساب به عنوان سقف توافق منظور خواهد شد.
                    </p>
                  </div>
                </div>

                {/* کارت ۴: وضعیت همکاری پروژه */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    وضعیت حساب در پروژه:
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, status: 'active' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        formData.status === 'active'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-300" />
                      <span>فعال و جاری</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, status: 'inactive' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        formData.status === 'inactive'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>مختومه / راکد</span>
                    </button>
                  </div>
                </div>

                {/* کارت ۵: پیش‌نمایش هویت زنده (Live Visual Preview) */}
                <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-950 text-white border border-white/10 shadow-lg space-y-3">
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                    پیش‌نمایش کارت طرف‌حساب
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center font-black text-sm text-white shrink-0">
                      {formData.name.trim() ? formData.name.trim().charAt(0) : '؟'}
                    </div>
                    <div className="truncate">
                      <div className="font-black text-sm text-white truncate">
                        {formData.name.trim() || 'نام طرف‌حساب...'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {formData.company.trim() || 'بدون شرکت'} • {formData.phone || 'بدون تماس'}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </form>

        </div>
      </div>

      {/* داک چسبان شیشه‌ای پایین (Sticky Apple Liquid Glass Bottom Dock) */}
      <div className="fixed bottom-0 start-0 end-0 z-30 p-3 sm:px-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>نوع رابطه:</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {counterpartyTypes.find(t => t.id === formData.type)?.label}
            </span>
          </div>
          {formData.contractValue && (
            <>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400">مبلغ قرارداد:</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                  {formData.contractValue} {getCurrencySymbol(currency, language)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 sm:px-5 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95"
          >
            <span>{language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}</span>
            <kbd className="hidden sm:inline-block ms-1.5 px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded font-mono">
              ESC
            </kbd>
          </button>

          <button
            type="submit"
            form="counterparty-form"
            disabled={isSubmitting || !formData.name.trim()}
            className="px-5 sm:px-7 h-10 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black text-xs rounded-2xl shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
