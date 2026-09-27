import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../../db/db';
import { formatCurrency, formatAmount, getTodayDateString } from '../../utils/formatters';
import { 
  X, 
  ArrowDownLeft, 
  Wallet, 
  CreditCard, 
  Coins, 
  Calendar, 
  User, 
  FileText, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Star,
  Landmark
} from 'lucide-react';

/**
 * AddEditIncomeModal
 * مودال ثبت و ویرایش پول‌های ورودی به کارگاه (تنخواه و بودجه)
 * امکان انتخاب از میان حساب‌های بانکی و صندوق‌های ثبت‌شده سیستم به همراه پیش‌انتخاب حساب پیش‌فرض
 */
export function AddEditIncomeModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData = null, 
  currency = 'IQD',
  language = 'fa' 
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [title, setTitle] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountType, setAccountType] = useState('bank'); // fallback: 'cash' | 'bank'
  const [payer, setPayer] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // واکشی حساب‌های مالی ثبت شده (کارت‌ها و صندوق‌ها)
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

  // عناوین پیشنهادی سریع
  const quickTitles = [
    'شارژ تنخواه توسط کارفرما',
    'تزریق نقدینگی به صندوق کارگاه',
    'پیش‌پرداخت قرارداد پروژه',
    'واریز علی‌الحساب کارفرما',
    'سایر واریزی‌ها'
  ];

  useEffect(() => {
    if (initialData) {
      setAmount(initialData.amount ? String(initialData.amount) : '');
      setDate(initialData.date ? initialData.date.slice(0, 10) : getTodayDateString());
      setTitle(initialData.title || '');
      setSelectedAccountId(initialData.accountId || '');
      setAccountType(initialData.accountType || 'bank');
      setPayer(initialData.payer || '');
      setDescription(initialData.description || '');
    } else {
      setAmount('');
      setDate(getTodayDateString());
      setTitle('');
      setSelectedAccountId(defaultAccount?.id || '');
      setAccountType(defaultAccount?.type || 'bank');
      setPayer('');
      setDescription('');
    }
    setErrorMsg('');
  }, [initialData, isOpen, defaultAccount]);

  if (!isOpen) return null;

  const handleAccountChange = (accId) => {
    setSelectedAccountId(accId);
    const target = financialAccounts.find((a) => a.id === accId);
    if (target) {
      setAccountType(target.type);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const numAmount = Number(String(amount).replace(/,/g, ''));
    if (!numAmount || numAmount <= 0) {
      setErrorMsg(language === 'fa' ? 'لطفاً مبلغ واریزی معتبری وارد کنید.' : 'تکایە بڕە پارەیەکی دروست بنووسە.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg(language === 'fa' ? 'لطفاً عنوان واریزی را وارد کنید.' : 'تکایە ناونیشانی پارەکە بنووسە.');
      return;
    }

    const matchedAcc = financialAccounts.find((a) => a.id === selectedAccountId);

    try {
      setIsSubmitting(true);
      await onSave({
        amount: numAmount,
        date,
        title: title.trim(),
        accountId: selectedAccountId || null,
        accountName: matchedAcc?.name || (accountType === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
        accountType: matchedAcc?.type || accountType,
        payer: payer.trim(),
        description: description.trim()
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'خطا در ذخیره اطلاعات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(raw ? Number(raw).toLocaleString('en-US') : '');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
              <ArrowDownLeft className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {initialData 
                  ? (language === 'fa' ? 'ویرایش واریزی تنخواه' : 'دەستکاریکردنی تەنخوا')
                  : (language === 'fa' ? 'ثبت واریزی جدید (شارژ تنخواه)' : 'تۆمارکردنی داهاتی نوێ')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'fa' ? 'ثبت ورود وجه نقد یا واریز بانکی به سیستم' : 'تۆمارکردنی داهات بۆ سندووق'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* فیلد مبلغ با پیش‌نمایش واحد پول */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <span>{language === 'fa' ? 'مبلغ واریزی' : 'بڕە پارە'}</span>
              <span className="text-rose-500 mx-1">*</span>
              <span className="text-slate-400 font-normal">({currency})</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={amount}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full h-12 px-4 text-left font-mono font-bold text-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 dark:text-white"
                dir="ltr"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                {currency}
              </span>
            </div>
          </div>

          {/* فیلد تاریخ واریز */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              <span>{language === 'fa' ? 'تاریخ واریز' : 'بەروار'}</span>
              <span className="text-rose-500 mx-1">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* انتخاب حساب واریزی (کارت‌ها و صندوق‌ها) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                <Landmark className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                <span>{language === 'fa' ? 'حساب یا صندوق مقصد واریز' : 'حیسابی داهات'}</span>
                <span className="text-rose-500 mx-1">*</span>
              </label>
              {defaultAccount && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500" />
                  <span>پیش‌فرض: {defaultAccount.name}</span>
                </span>
              )}
            </div>

            {financialAccounts.length > 0 ? (
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
              >
                {financialAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.type === 'bank' ? '💳 کارت بانکی: ' : '🪙 صندوق نقدی: '}
                    {acc.name} {acc.bankName ? `(${acc.bankName})` : ''} {acc.isDefault ? '⭐ [حساب پیش‌فرض]' : ''}
                  </option>
                ))}
              </select>
            ) : (
              /* حالت جایگزین در صورتی که حسابی ثبت نشده باشد */
              <div className="grid grid-cols-2 gap-2 h-11">
                <button
                  type="button"
                  onClick={() => setAccountType('bank')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold border transition-all ${
                    accountType === 'bank'
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-700 dark:text-sky-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>کارت بانکی</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('cash')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold border transition-all ${
                    accountType === 'cash'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-700 dark:text-amber-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>صندوق نقدی</span>
                </button>
              </div>
            )}
          </div>

          {/* فیلد عنوان با پیشنهادات سریع */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <span>{language === 'fa' ? 'عنوان واریزی' : 'ناونیشانی واریز'}</span>
              <span className="text-rose-500 mx-1">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: شارژ تنخواه توسط کارفرما"
              className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {/* چیپ‌های انتخاب سریع */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickTitles.map((qt) => (
                <button
                  key={qt}
                  type="button"
                  onClick={() => setTitle(qt)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                >
                  {qt}
                </button>
              ))}
            </div>
          </div>

          {/* واریزکننده / منبع */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <User className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              <span>{language === 'fa' ? 'واریزکننده / طرف‌حساب (اختیاری)' : 'پارەدەر'}</span>
            </label>
            <input
              type="text"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              placeholder="مثلاً: مهندس کارفرما / حاج احمد"
              className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* فیلد توضیحات */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <FileText className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              <span>{language === 'fa' ? 'توضیحات تکمیلی (اختیاری)' : 'تێبینی'}</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات بابت شماره فیش بانکی، هدف تنخواه یا پیگیری..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* دکمه‌های اقدام */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{initialData ? (language === 'fa' ? 'ثبت تغییرات' : 'پاشەکەوتکردن') : (language === 'fa' ? 'ثبت واریزی تنخواه' : 'تۆمارکردن')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
