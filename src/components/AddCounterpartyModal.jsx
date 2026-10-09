import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { db, generateCounterpartyId, DEFAULT_PROJECT_ID } from '../db/db';
import { X, User, Briefcase, Phone, Tag } from 'lucide-react';

export function AddCounterpartyModal({ isOpen, onClose, editingCounterparty = null }) {
  const { language } = useLanguage();
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'employer',
    phone: '',
    company: '',
    contractValue: '',
    status: 'active'
  });
  
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
  }, [editingCounterparty, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const parsedContractValue = Number(String(formData.contractValue).replace(/,/g, '')) || 0;

    try {
      if (editingCounterparty) {
        await db.counterparties.update(editingCounterparty.id, {
          name: formData.name,
          type: formData.type,
          phone: formData.phone,
          company: formData.company,
          contractValue: parsedContractValue,
          status: formData.status,
          updatedAt: new Date().toISOString()
        });
      } else {
        await db.counterparties.add({
          id: generateCounterpartyId(),
          projectId: DEFAULT_PROJECT_ID,
          name: formData.name,
          type: formData.type,
          phone: formData.phone,
          company: formData.company,
          contractValue: parsedContractValue,
          status: formData.status,
          createdAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (err) {
      console.error('Error saving counterparty:', err);
      alert('Error saving counterparty');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800" dir={language === 'fa' || language === 'ku' ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">
            {editingCounterparty 
              ? (language === 'fa' ? 'ویرایش طرف‌حساب' : 'دەستکاریکردنی لایەنی حیساب') 
              : (language === 'fa' ? 'طرف‌حساب جدید' : 'لایەنی حیسابی نوێ')}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <User className="w-4 h-4" />
              {language === 'fa' ? 'نام / عنوان' : 'ناو / ناونیشان'}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
              placeholder={language === 'fa' ? 'مثال: مهندس احمدی (کارفرما)' : 'بۆ نموونە: ئەندازیار ئەحمەدی'}
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Tag className="w-4 h-4" />
              {language === 'fa' ? 'نوع طرف‌حساب' : 'جۆری لایەنی حیساب'}
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
            >
              <option value="employer">{language === 'fa' ? 'کارفرما / سرمایه‌گذار' : 'خاوەن کار / وەبەرهێنەر'}</option>
              <option value="supplier">{language === 'fa' ? 'تامین‌کننده / فروشنده' : 'دابینکەر / فرۆشیار'}</option>
              <option value="subcontractor">{language === 'fa' ? 'پیمانکار فرعی' : 'بەڵێندەری لاوەکی'}</option>
              <option value="other">{language === 'fa' ? 'سایر' : 'تر'}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Briefcase className="w-4 h-4" />
              {language === 'fa' ? 'شرکت / مجموعه (اختیاری)' : 'کۆمپانیا (ئارەزوومەندانە)'}
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
            />
          </div>

          {formData.type === 'employer' && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <span className="text-emerald-500 font-bold">$</span>
                {language === 'fa' ? 'مبلغ کل قرارداد (اختیاری)' : 'بڕی گرێبەست (ئارەزوومەندانە)'}
              </label>
              <input
                type="text"
                value={formData.contractValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setFormData(prev => ({ ...prev, contractValue: val ? Number(val).toLocaleString('en-US') : '' }));
                }}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all font-mono"
                placeholder="0"
                dir="ltr"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Phone className="w-4 h-4" />
              {language === 'fa' ? 'شماره تماس (اختیاری)' : 'ژمارەی تەلەفۆن (ئارەزوومەندانە)'}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all text-left"
              dir="ltr"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-colors"
            >
              {language === 'fa' ? 'ذخیره اطلاعات' : 'پاشەکەوتکردن'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
