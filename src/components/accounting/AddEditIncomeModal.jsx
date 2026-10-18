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
  Landmark,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * AddEditIncomeModal
 * مودال ثبت و ویرایش پول‌های ورودی به کارگاه (تنخواه و بودجه)
 * امکان انتخاب از میان حساب‌های بانکی و صندوق‌های ثبت‌شده سیستم به همراه پیش‌انتخاب حساب پیش‌فرض
 */

const COPY = {
  fa: {
    lockedError: 'این سند واریزی تایید شده و قفل است و امکان تغییر آن وجود ندارد.',
    amountError: 'لطفاً مبلغ واریزی معتبری وارد کنید.',
    titleFallbackAcc: (accName) => 'افزایش موجودی ' + accName,
    titleFallback: 'واریز وجه / افزایش موجودی',
    editTitle: 'ویرایش واریزی تنخواه',
    createTitle: 'ثبت واریزی جدید (شارژ تنخواه)',
    subtitle: 'ثبت ورود وجه نقد یا واریز بانکی به سیستم',
    lockedNotice: 'این سند واریزی تایید نهایی شده و قفل است. امکان ویرایش اطلاعات آن وجود ندارد.',
    amountLabel: 'مبلغ واریزی',
    dateLabel: 'تاریخ واریز',
    accountLabel: 'حساب یا صندوق مقصد واریز',
    defaultPrefix: 'پیش‌فرض: ',
    cardPrefix: '💳 کارت بانکی: ',
    cashPrefix: '🪙 صندوق نقدی: ',
    defaultTag: ' ⭐ [حساب پیش‌فرض]',
    bankCard: 'کارت بانکی',
    cashbox: 'صندوق نقدی',
    titleLabel: 'بابت / عنوان واریزی (اختیاری)',
    titlePlaceholder: 'مثلاً: شارژ تنخواه یا افزایش موجودی',
    payerLabel: 'واریزکننده / طرف‌حساب',
    noSelection: '--- بدون انتخاب ---',
    otherManual: 'سایر (ثبت دستی)',
    payerPlaceholder: 'نام واریزکننده به صورت دستی...',
    notesLabel: 'توضیحات تکمیلی (اختیاری)',
    cancelBtn: 'انصراف',
    saveChangesBtn: 'ثبت تغییرات',
    createBtn: 'ثبت واریزی تنخواه',
    saveError: 'خطا در ذخیره اطلاعات',
    notesPlaceholder: 'توضیحات بابت شماره فیش بانکی، هدف تنخواه یا پیگیری...',
    quickTitles: [
      'شارژ تنخواه توسط کارفرما',
      'تزریق نقدینگی به صندوق کارگاه',
      'پیش‌پرداخت قرارداد پروژه',
      'واریز علی‌الحساب کارفرما',
      'سایر واریزی‌ها'
    ]
  },
  ku: {
    lockedError: 'ئەم بەڵگەنامەیە پەسەندکراوە و قفڵ کراوە و گۆڕانکاری ناکرێت.',
    amountError: 'تکایە بڕە پارەیەکی دروست بۆ واریزکردن بنووسە.',
    titleFallbackAcc: (accName) => 'زیادکردنی باڵانسی ' + accName,
    titleFallback: 'واریزکردنی پارە / زیادکردنی باڵانس',
    editTitle: 'دەستکاریکردنی تەنخوا',
    createTitle: 'تۆمارکردنی داهاتی نوێ (بارکردنی تەنخوا)',
    subtitle: 'تۆمارکردنی هاتنی پارەی کاش یان حەواڵەی بانکی بۆ سیستەم',
    lockedNotice: 'ئەم بەڵگەنامەیە پەسەندکراوە و قفڵ کراوە. دەستکاریکردنی زانیارییەکان ڕێگەپێدراو نییە.',
    amountLabel: 'بڕی واریزکراو',
    dateLabel: 'بەرواری واریز',
    accountLabel: 'حیساب یان سندووقی وەرگرتن',
    defaultPrefix: 'بنەڕەتی: ',
    cardPrefix: '💳 کارتی بانکی: ',
    cashPrefix: '🪙 سندوقی کاش: ',
    defaultTag: ' ⭐ [حیسابی بنەڕەتی]',
    bankCard: 'کارتی بانکی',
    cashbox: 'سندوقی کاش',
    titleLabel: 'بابەت / ناونیشانی واریز (ئارەزوومەندانە)',
    titlePlaceholder: 'بۆ نموونە: تەنخوا یان زیادکردنی باڵانس',
    payerLabel: 'پارەدەر / لایەنی بەرامبەر',
    noSelection: '--- بێ هەڵبژاردن ---',
    otherManual: 'کەسانی تر (دەستی)',
    payerPlaceholder: 'ناوی پارەدەر بە دەستی...',
    notesLabel: 'تێبینی زیاتر (ئارەزوومەندانە)',
    cancelBtn: 'پاشگەزبوونەوە',
    saveChangesBtn: 'پاشەکەوتکردنی گۆڕانکارییەکان',
    createBtn: 'تۆمارکردنی تەنخوا',
    saveError: 'هەڵە لە پاشەکەوتکردنی زانیارییەکان',
    notesPlaceholder: 'تێبینی لەسەر ژمارەی پسوولەی بانکی، مەبەست یان بەدواداچوون...',
    quickTitles: [
      'بارکردنی تەنخوا لەلایەن خاوەنکارەوە',
      'خستنەسەری نەختینە بۆ سندوقی کارگە',
      'پێشەکی گرێبەستی پڕۆژە',
      'واریزی کاتیی خاوەنکار',
      'واریزەکانی تر'
    ]
  },
  en: {
    lockedError: 'This deposit document is approved and locked, and cannot be changed.',
    amountError: 'Please enter a valid deposit amount.',
    titleFallbackAcc: (accName) => 'Balance top-up ' + accName,
    titleFallback: 'Cash Deposit / Top-up',
    editTitle: 'Edit Petty Cash / Deposit',
    createTitle: 'Record New Deposit (Petty Cash Top-up)',
    subtitle: 'Record cash inflow or bank deposit into accounts',
    lockedNotice: 'This deposit document is approved and locked. Its details cannot be edited.',
    amountLabel: 'Deposit Amount',
    dateLabel: 'Deposit Date',
    accountLabel: 'Destination Account / Register',
    defaultPrefix: 'Default: ',
    cardPrefix: '💳 Bank Card: ',
    cashPrefix: '🪙 Cash Register: ',
    defaultTag: ' ⭐ [Default Account]',
    bankCard: 'Bank Card',
    cashbox: 'Cash Register',
    titleLabel: 'Purpose / Title (Optional)',
    titlePlaceholder: 'e.g., Petty cash replenishment or capital addition',
    payerLabel: 'Depositor / Counterparty',
    noSelection: '--- None Selected ---',
    otherManual: 'Other (Manual entry)',
    payerPlaceholder: 'Enter depositor name manually...',
    notesLabel: 'Additional Notes (Optional)',
    cancelBtn: 'Cancel',
    saveChangesBtn: 'Save Changes',
    createBtn: 'Record Deposit',
    saveError: 'Error saving data',
    notesPlaceholder: 'Notes on bank slip number, purpose or follow-up...',
    quickTitles: [
      'Petty cash replenishment by client',
      'Cash injection into workshop register',
      'Contract advance payment',
      'On-account payment by client',
      'Other cash deposits'
    ]
  }
};

export function AddEditIncomeModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData = null, 
  currency = 'IQD',
  language
}) {
  const langContext = useLanguage();
  const activeLang = language || langContext?.language || 'fa';
  const langKey = activeLang === 'fa' ? 'fa' : activeLang === 'ku' ? 'ku' : 'en';
  const c = COPY[langKey];
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [title, setTitle] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountType, setAccountType] = useState('bank'); // fallback: 'cash' | 'bank'
  const [payer, setPayer] = useState('');
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const isApprovedAndLocked = Boolean(initialData && initialData.status === 'approved');

  // واکشی طرف‌حساب‌ها
  const counterparties = useLiveQuery(() => db.counterparties ? db.counterparties.toArray() : []) || [];

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
  const quickTitles = c.quickTitles;

  const prevIsOpenRef = React.useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const defaultAccId = defaultAccount?.id || (financialAccounts[0]?.id || '');
      if (initialData) {
        setAmount(initialData.amount ? Number(initialData.amount).toLocaleString('en-US') : '');
        setDate(initialData.date ? initialData.date.slice(0, 10) : getTodayDateString());
        setTitle(initialData.title || '');
        const initialAccId = initialData.accountId || defaultAccId;
        setSelectedAccountId(initialAccId);
        const matched = financialAccounts.find(a => String(a.id) === String(initialAccId));
        setAccountType(initialData.accountType || matched?.type || defaultAccount?.type || 'bank');
        setPayer(initialData.payer || '');
        setSelectedCounterpartyId(initialData.counterpartyId || '');
        setDescription(initialData.description || '');
      } else {
        setAmount('');
        setDate(getTodayDateString());
        setTitle('');
        setSelectedAccountId(defaultAccId);
        const matched = financialAccounts.find(a => String(a.id) === String(defaultAccId));
        setAccountType(matched?.type || defaultAccount?.type || 'bank');
        setPayer('');
        setSelectedCounterpartyId('');
        setDescription('');
      }
      setErrorMsg('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialData]);

  // فقط در صورت خالی بودن انتخاب حساب پس از لود شدن حساب‌ها، حساب پیش‌فرض را برگزین (بدون دستکاری مبلغ)
  useEffect(() => {
    if (isOpen && !selectedAccountId && financialAccounts.length > 0) {
      const defId = defaultAccount?.id || financialAccounts[0].id;
      setSelectedAccountId(defId);
      const matched = financialAccounts.find(a => String(a.id) === String(defId));
      if (matched) setAccountType(matched.type);
    }
  }, [isOpen, selectedAccountId, financialAccounts, defaultAccount]);

  if (!isOpen) return null;

  const handleAccountChange = (accId) => {
    setSelectedAccountId(accId);
    const target = financialAccounts.find((a) => String(a.id) === String(accId));
    if (target) {
      setAccountType(target.type);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isApprovedAndLocked) {
      setErrorMsg(c.lockedError);
      return;
    }

    const numAmount = Number(String(amount).replace(/,/g, ''));
    if (!numAmount || numAmount <= 0) {
      setErrorMsg(c.amountError);
      return;
    }

    const matchedAcc = financialAccounts.find((a) => String(a.id) === String(selectedAccountId)) || defaultAccount;
    const finalTitle = title.trim() || (matchedAcc?.name ? c.titleFallbackAcc(matchedAcc.name) : c.titleFallback);

    try {
      setIsSubmitting(true);
      await onSave({
        amount: numAmount,
        date,
        title: finalTitle,
        accountId: matchedAcc?.id || selectedAccountId || null,
        accountName: matchedAcc?.name || (accountType === 'bank' ? c.bankCard : c.cashbox),
        accountType: matchedAcc?.type || accountType,
        payer: payer.trim(),
        counterpartyId: (selectedCounterpartyId && selectedCounterpartyId !== 'other') ? selectedCounterpartyId : null,
        description: description.trim(),
        ...(initialData ? {} : { status: 'draft', created_by: user?.id || 'admin' })
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || c.saveError);
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
                {initialData ? c.editTitle : c.createTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {c.subtitle}
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
          {isApprovedAndLocked && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>{c.lockedNotice}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* فیلد مبلغ با پیش‌نمایش واحد پول */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <span>{c.amountLabel}</span>
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
              <span>{c.dateLabel}</span>
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
                <span>{c.accountLabel}</span>
                <span className="text-rose-500 mx-1">*</span>
              </label>
              {defaultAccount && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500" />
                  <span>{c.defaultPrefix}{defaultAccount.name}</span>
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
                    {acc.type === 'bank' ? c.cardPrefix : c.cashPrefix}{acc.name}{acc.bankName ? ' (' + acc.bankName + ')' : ''}{acc.isDefault ? c.defaultTag : ''}
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
                  <span>{c.bankCard}</span>
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
                  <span>{c.cashbox}</span>
                </button>
              </div>
            )}
          </div>

          {/* فیلد عنوان با پیشنهادات سریع */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <span>{c.titleLabel}</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={c.titlePlaceholder}
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
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              <User className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              <span>{c.payerLabel}</span>
            </label>
            <select
              value={selectedCounterpartyId}
              onChange={(e) => {
                setSelectedCounterpartyId(e.target.value);
                if (e.target.value !== 'other' && e.target.value !== '') {
                  const cp = counterparties.find(c => String(c.id) === e.target.value);
                  if (cp) setPayer(cp.name);
                } else if (e.target.value === '') {
                  setPayer('');
                }
              }}
              className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
            >
              <option value="">{c.noSelection}</option>
              {counterparties.map(cp => (
                <option key={cp.id} value={cp.id}>{cp.name} {cp.company ? `(${cp.company})` : ''}</option>
              ))}
              <option value="other">{c.otherManual}</option>
            </select>
            
            {(selectedCounterpartyId === 'other' || (!selectedCounterpartyId && payer)) && (
              <input
                type="text"
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                placeholder={c.payerPlaceholder}
                className="w-full h-11 mt-2 px-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            )}
          </div>

          {/* فیلد توضیحات */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <FileText className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              <span>{c.notesLabel}</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={c.notesPlaceholder}
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
              {c.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isApprovedAndLocked}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{initialData ? c.saveChangesBtn : c.createBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
