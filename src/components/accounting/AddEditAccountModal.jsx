import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { 
  X, 
  CreditCard, 
  Coins, 
  Star, 
  User, 
  Building2, 
  CheckCircle2, 
  AlertCircle,
  Palette,
  FileText,
  Landmark
} from 'lucide-react';

/**
 * AddEditAccountModal
 * مودال تعریف و ویرایش کارت‌های بانکی و صندوق‌های نقدی کارگاه
 */
export function AddEditAccountModal({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  currency = 'IQD',
  language = 'fa'
}) {
  const [type, setType] = useState('bank'); // 'bank' | 'cash'
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [keeperName, setKeeperName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [color, setColor] = useState('sky');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // بانک‌های پرکاربرد جهت انتخاب سریع
  const popularBanks = [
    'بانک ملت',
    'بانک ملی',
    'بانک صادرات',
    'بانک تجارت',
    'بانک سپه',
    'بانک سامان',
    'بانک پاسارگاد',
    'بلوبانک',
    'بانک TBI',
    'RT Bank'
  ];

  // پالت رنگ کارت‌ها
  const colorOptions = [
    { id: 'sky', label: 'آبی', bg: 'bg-sky-500' },
    { id: 'indigo', label: 'نیلی', bg: 'bg-indigo-600' },
    { id: 'emerald', label: 'زمردی', bg: 'bg-emerald-600' },
    { id: 'amber', label: 'طلایی', bg: 'bg-amber-500' },
    { id: 'rose', label: 'یاقوتی', bg: 'bg-rose-500' },
    { id: 'purple', label: 'بنفش', bg: 'bg-purple-600' },
    { id: 'slate', label: 'دودی', bg: 'bg-slate-700' }
  ];

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'bank');
      setName(initialData.name || '');
      setBankName(initialData.bankName || '');
      setCardNumber(initialData.cardNumber || '');
      setAccountNumber(initialData.accountNumber || '');
      setHolderName(initialData.holderName || '');
      setKeeperName(initialData.keeperName || '');
      setInitialBalance(initialData.initialBalance ? String(initialData.initialBalance) : '');
      setIsDefault(Boolean(initialData.isDefault));
      setColor(initialData.color || (initialData.type === 'bank' ? 'sky' : 'amber'));
      setNotes(initialData.notes || '');
    } else {
      setType('bank');
      setName('');
      setBankName('');
      setCardNumber('');
      setAccountNumber('');
      setHolderName('');
      setKeeperName('');
      setInitialBalance('');
      setIsDefault(false);
      setColor('sky');
      setNotes('');
    }
    setErrorMsg('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // فرمت ۴ رقمی شماره کارت
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 16);
    const parts = raw.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join('-') : raw);
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInitialBalance(raw ? Number(raw).toLocaleString('en-US') : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg(language === 'fa' ? 'لطفاً عنوان حساب را مشخص کنید.' : 'تکایە ناوی حیساب بنووسە.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        type,
        name: name.trim(),
        bankName: bankName.trim(),
        cardNumber: cardNumber.trim(),
        accountNumber: accountNumber.trim(),
        holderName: holderName.trim(),
        keeperName: keeperName.trim(),
        initialBalance: initialBalance ? Number(initialBalance.replace(/,/g, '')) : 0,
        isDefault,
        color,
        notes: notes.trim()
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'خطا در ثبت حساب');
    } finally {
      setIsSubmitting(false);
    }
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
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs ${
              type === 'bank' ? 'bg-sky-500' : 'bg-amber-500'
            }`}>
              {type === 'bank' ? <CreditCard className="w-5 h-5 stroke-[2.2]" /> : <Coins className="w-5 h-5 stroke-[2.2]" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {initialData 
                  ? (language === 'fa' ? 'ویرایش حساب مالی' : 'دەستکاریکردنی حیساب')
                  : (language === 'fa' ? 'تعریف حساب مالی جدید' : 'زیادکردنی حیسابی نوێ')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {type === 'bank' 
                  ? (language === 'fa' ? 'ثبت مشخصات کارت و حساب بانکی' : 'زانیاری کارتی بانکی')
                  : (language === 'fa' ? 'ثبت صندوق نقدی و تنخواه گردان' : 'زانیاری سندوقی کاش')}
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* نوع حساب: کارت بانکی یا صندوق نقدی */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <span>{language === 'fa' ? 'نوع حساب مالی' : 'جۆری حیساب'}</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setType('bank');
                  if (!initialData) setColor('sky');
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  type === 'bank'
                    ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-700 dark:text-sky-300 shadow-xs ring-2 ring-sky-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{language === 'fa' ? 'کارت / حساب بانکی' : 'کارتی بانکی'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType('cash');
                  if (!initialData) setColor('amber');
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  type === 'cash'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-700 dark:text-amber-300 shadow-xs ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>{language === 'fa' ? 'صندوق نقدی کارگاه' : 'سندوقی کاش'}</span>
              </button>
            </div>
          </div>

          {/* عنوان حساب */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <span>{language === 'fa' ? 'عنوان حساب / نام نمایشی' : 'ناوی حیساب'}</span>
              <span className="text-rose-500 mx-1">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'bank' ? 'مثلاً: کارت بانک ملت تنخواه کارفرما' : 'مثلاً: صندوق نقدی اصلی کارگاه'}
              className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          {/* فیلدهای اختصاصی کارت بانکی */}
          {type === 'bank' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* نام بانک */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <Building2 className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                    <span>{language === 'fa' ? 'نام بانک' : 'ناوی بانک'}</span>
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="مثلاً: ملت، صادرات، ملی..."
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                  {/* چیپ‌های بانک‌ها */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {popularBanks.slice(0, 4).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBankName(b)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-950/50"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* نام صاحب حساب */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <User className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                    <span>{language === 'fa' ? 'صاحب کارت / حساب' : 'خاوەنی حیساب'}</span>
                  </label>
                  <input
                    type="text"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="مثلاً: مهندس احمدی"
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* شماره کارت ۱۶ رقمی */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <CreditCard className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                  <span>{language === 'fa' ? 'شماره کارت ۱۶ رقمی (اختیاری)' : 'ژمارەی کارت'}</span>
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="xxxx - xxxx - xxxx - xxxx"
                  dir="ltr"
                  className="w-full h-11 px-3.5 font-mono text-center tracking-widest text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              {/* شماره حساب یا شبا */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <span>{language === 'fa' ? 'شماره حساب / شبا (IBAN) (اختیاری)' : 'ژمارەی حیساب'}</span>
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="IR..."
                  dir="ltr"
                  className="w-full h-11 px-3.5 font-mono text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              {/* رنگ کارت */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Palette className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                  <span>{language === 'fa' ? 'رنگ تم کارت' : 'ڕەنگ'}</span>
                </label>
                <div className="flex items-center gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all flex items-center justify-center ${
                        color === c.id ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* فیلدهای اختصاصی صندوق نقدی */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <User className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                  <span>{language === 'fa' ? 'نام مسئول / تحویل‌گیرنده صندوق' : 'بەرپرسی سندوق'}</span>
                </label>
                <input
                  type="text"
                  value={keeperName}
                  onChange={(e) => setKeeperName(e.target.value)}
                  placeholder="مثلاً: سرپرست کارگاه / مسئول مالی"
                  className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* موجودی اولیه */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <span>{language === 'fa' ? 'موجودی اولیه حساب' : 'باڵانسی سەرەتایی'}</span>
              <span className="text-slate-400 font-normal">({currency})</span>
            </label>
            <input
              type="text"
              value={initialBalance}
              onChange={handleAmountChange}
              placeholder="0"
              dir="ltr"
              className="w-full h-11 px-3.5 text-left font-mono font-bold text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          {/* چک‌باکس: حساب پیش‌فرض */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Star className={`w-5 h-5 ${isDefault ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {language === 'fa' ? 'تنظیم به عنوان حساب پیش‌فرض' : 'دانان وەک حیسابی سەرەکی'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'fa' 
                    ? 'در تمام فرم‌های پرداخت دستمزد، فاکتورها و واریزی‌ها به صورت خودکار انتخاب می‌شود.'
                    : 'بەشێوەی خۆکار لە فۆرمەکان هەڵدەبژێردرێت.'}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              id="isDefaultAccountCheck"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-5 h-5 rounded-lg text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-600 cursor-pointer"
            />
          </div>

          {/* یادداشت / توضیحات */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <FileText className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              <span>{language === 'fa' ? 'یادداشت یا توضیحات تکمیلی (اختیاری)' : 'تێبینی'}</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="توضیحات تکمیلی در مورد نحوه استفاده از این حساب یا محل قرارگیری..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
            />
          </div>

          {/* دکمه‌های اقدام */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {language === 'fa' ? 'انصراف' : 'پاشگەزبوونەوە'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{initialData ? (language === 'fa' ? 'ثبت تغییرات' : 'پاشەکەوتکردن') : (language === 'fa' ? 'ذخیره حساب' : 'تۆمارکردن')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
