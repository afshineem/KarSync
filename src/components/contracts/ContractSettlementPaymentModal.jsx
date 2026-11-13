import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../../db/db';
import {
  recordContractSettlementPayment,
  getContractSettlementPaymentSummary
} from '../../services/contractService';
import { formatAmount, getTodayDateString, numberToWords } from '../../utils/formatters';
import {
  X,
  CreditCard,
  Wallet,
  Receipt,
  FileCheck2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Building2,
  Hash,
  FileText,
  DollarSign,
  ChevronDown,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Scale
} from 'lucide-react';

const COPY = {
  fa: {
    modalTitle: 'ثبت و صدور دستور پرداخت مالی صورت‌وضعیت',
    modalSubtitle: 'کسر مستقیم از حساب بانکی یا صندوق و ثبت در اسناد رسمی خزانه‌داری',
    contractLabel: 'قرارداد:',
    contractorLabel: 'پیمانکار / طرف‌حساب:',
    stageLabel: 'مرحله / سند:',
    summaryTitle: 'تراز تعهد و مانده قابل پرداخت',
    grossAmount: 'کارکرد ناخالص:',
    deductionsTotal: 'مجموع کسورات قانونی و کارگاهی:',
    delayPenaltyNotice: 'جریمه دیرکرد (درآمد حاصل از خسارات کارگاه):',
    retentionNotice: 'سپرده حسن انجام کار:',
    insuranceNotice: 'سپرده بیمه ماده ۳۸:',
    advancesNotice: 'پیش‌پرداخت و علی‌الحساب:',
    backchargesNotice: 'کسورات متفرقه کارگاه:',
    netInitialPayable: 'خالص تاییدشده صورت‌وضعیت:',
    previouslyPaid: 'پرداخت‌های قبلی:',
    currentRemaining: 'مانده تعهد قابل پرداخت:',
    fullySettledNotice: 'این صورت‌وضعیت قبلاً به طور کامل تسویه شده است.',
    paymentAmountLabel: 'مبلغ این قسط / پرداختی فعلی',
    quickAll: 'کل مانده (۱۰۰٪)',
    quickHalf: 'نیمی از مانده (۵۰٪)',
    quickQuarter: 'یک چهارم (۲۵٪)',
    methodLabel: 'روش پرداخت وجه',
    methodBank: 'کارت به کارت / حواله بانکی',
    methodCash: 'صندوق نقدی کارگاه',
    methodCheque: 'صدور چک بانکی / صیادی',
    selectAccountLabel: 'حساب مالی مبدأ (خروج وجه)',
    balanceLabel: 'موجودی فعلی:',
    noAccountAlert: 'هیچ حساب یا صندوق فعالی یافت نشد.',
    trackingCodeLabel: 'شماره پیگیری / کد رهگیری بانکی',
    trackingCodePlaceholder: 'مثال: ۹۸۷۶۵۴۳۲۱',
    chequeNumberLabel: 'شماره سریال چک',
    chequeDueDateLabel: 'تاریخ سررسید چک',
    chequeBankLabel: 'نام بانک صادرکننده',
    paymentDateLabel: 'تاریخ پرداخت',
    notesLabel: 'شرح و مصوبات دستور پرداخت (اختیاری)',
    notesPlaceholder: 'مثال: پرداخت قسط اول طبق دستور کتبی مدیرعامل...',
    btnSubmit: 'ثبت قطعی پرداخت و کسر از خزانه',
    btnSubmitting: 'در حال ثبت سند و کسر از حساب...',
    cancel: 'انصراف',
    toastSuccess: 'دستور پرداخت با موفقیت ثبت و از موجودی حساب کسر گردید.',
    historyTitle: 'ریز پرداخت‌های قبلی این صورت‌وضعیت'
  },
  ku: {
    modalTitle: 'تۆمارکردن و جێبەجێکردنی پارەدانی صورت‌وەزعییەت',
    modalSubtitle: 'بڕینی ڕاستەوخۆ لە حیسابی بانکی یان سندوق و تۆمارکردن لە خەزێنە',
    contractLabel: 'گرێبەست:',
    contractorLabel: 'پەیمانکار / لایەن:',
    stageLabel: 'قۆناغ / بەڵگەنامە:',
    summaryTitle: 'تەرازووی ئەرک و باڵانسی ماوە',
    grossAmount: 'کارکردی ناخاڵس:',
    deductionsTotal: 'کۆی گشتی بڕینە یاسایی و کارگەییەکان:',
    delayPenaltyNotice: 'سزای دواکەوتن (داهاتی زیانی کارگە):',
    retentionNotice: 'ئەمانەتی باش بەڕێوەچوونی کار:',
    insuranceNotice: 'ئەمانەتی بیمەی کۆمەڵایەتی:',
    advancesNotice: 'پێشەکی و عەلی‌الحساب:',
    backchargesNotice: 'خەرجییەکانی تری سەر پەیمانکار:',
    netInitialPayable: 'خاڵسی پەسەندکراوی قۆناغ:',
    previouslyPaid: 'پارەدانی پێشوو:',
    currentRemaining: 'باڵانسی ماوە بۆ پارەدان:',
    fullySettledNotice: 'ئەم قۆناغە پێشتر بە تەواوی پاکتاو کراوە.',
    paymentAmountLabel: 'بڕی ئەم بەشە / پارەدانی ئێستا',
    quickAll: 'هەموو باڵانس (١٠٠٪)',
    quickHalf: 'نیوەی باڵانس (٥٠٪)',
    quickQuarter: 'چوارەکی باڵانس (٢٥٪)',
    methodLabel: 'شێوازی پارەدان',
    methodBank: 'کارت یان حەواڵەی بانکی',
    methodCash: 'سندوقی کاشی کارگە',
    methodCheque: 'دەرکردنی چەکی بانکی',
    selectAccountLabel: 'سەرچاوەی دەرچوونی پارە (سندوق/بانک)',
    balanceLabel: 'مەوجودی ئێستا:',
    noAccountAlert: 'هیچ حیسابێکی چالاک نەدۆزرایەوە.',
    trackingCodeLabel: 'ژمارەی بەدواداچوونی بانکی',
    trackingCodePlaceholder: 'نموونە: ٩٨٧٦٥٤٣٢١',
    chequeNumberLabel: 'ژمارەی چەک',
    chequeDueDateLabel: 'بەرواری چەک',
    chequeBankLabel: 'ناوی بانک',
    paymentDateLabel: 'بەرواری پارەدان',
    notesLabel: 'تێبینی و ڕێنمایی پارەدان (ئارەزوومەندانە)',
    notesPlaceholder: 'تێبینی فەرمانی بەڕێوەبەر...',
    btnSubmit: 'تۆمارکردنی یەکجاری و بڕین لە خەزێنە',
    btnSubmitting: 'تۆمارکردن لە دەفتەر...',
    cancel: 'پاشگەزبوونەوە',
    toastSuccess: 'پارەدان بە سەرکەوتوویی تۆمارکرا و لە حیساب بڕدرا.',
    historyTitle: 'مێژووی پارەدانەکانی ئەم قۆناغە'
  },
  en: {
    modalTitle: 'Disburse & Record Contract Settlement Payment',
    modalSubtitle: 'Direct treasury outflow from bank or cashbox with accounting voucher creation',
    contractLabel: 'Contract:',
    contractorLabel: 'Contractor:',
    stageLabel: 'Billing Stage:',
    summaryTitle: 'Obligation & Outstanding Balance',
    grossAmount: 'Gross Progress Amount:',
    deductionsTotal: 'Total Contractual Deductions:',
    delayPenaltyNotice: 'Delay Penalty (Workshop Damage Revenue):',
    retentionNotice: 'Performance Retention Bond:',
    insuranceNotice: 'Statutory Insurance Retention:',
    advancesNotice: 'Prior Advances Deducted:',
    backchargesNotice: 'Workshop Backcharges:',
    netInitialPayable: 'Approved Net Billing Amount:',
    previouslyPaid: 'Previously Paid:',
    currentRemaining: 'Outstanding Payable Balance:',
    fullySettledNotice: 'This settlement has already been fully paid.',
    paymentAmountLabel: 'Payment Amount for This Installment',
    quickAll: 'Full Balance (100%)',
    quickHalf: 'Half Balance (50%)',
    quickQuarter: 'Quarter (25%)',
    methodLabel: 'Payment Method',
    methodBank: 'Bank Card / Wire Transfer',
    methodCash: 'Workshop Cash Box',
    methodCheque: 'Issuance of Cheque',
    selectAccountLabel: 'Source Treasury Account',
    balanceLabel: 'Current Balance:',
    noAccountAlert: 'No active accounts found.',
    trackingCodeLabel: 'Bank Reference / Tracking Code',
    trackingCodePlaceholder: 'e.g. 987654321',
    chequeNumberLabel: 'Cheque Serial Number',
    chequeDueDateLabel: 'Cheque Due Date',
    chequeBankLabel: 'Issuing Bank Name',
    paymentDateLabel: 'Payment Date',
    notesLabel: 'Payment Directives & Notes (Optional)',
    notesPlaceholder: 'e.g. Approved partial payment as per MD instructions...',
    btnSubmit: 'Confirm & Deduct from Treasury',
    btnSubmitting: 'Recording voucher...',
    cancel: 'Cancel',
    toastSuccess: 'Payment successfully recorded and deducted from treasury.',
    historyTitle: 'Payment Installments History for This Stage'
  }
};

export default function ContractSettlementPaymentModal({
  isOpen,
  onClose,
  contract,
  settlement,
  onPaymentSuccess
}) {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const t = COPY[language] || COPY.fa;
  const currency = contract?.currency || currentProject?.currency || 'IQD';
  const projectId = contract?.projectId || currentProject?.id || DEFAULT_PROJECT_ID;

  // Settlement payment calculations
  const paymentSummary = useMemo(() => {
    return getContractSettlementPaymentSummary(settlement);
  }, [settlement]);

  // Form states
  const [paymentAmount, setPaymentAmount] = useState(
    paymentSummary.remaining > 0 ? String(paymentSummary.remaining) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState('bank'); // 'bank' | 'cash' | 'cheque'
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [trackingCode, setTrackingCode] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDueDate, setChequeDueDate] = useState(getTodayDateString());
  const [chequeBank, setChequeBank] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Live Query Financial Accounts
  const financialAccounts = useLiveQuery(
    async () => {
      if (!db.financialAccounts) return [];
      const list = await db.financialAccounts.toArray();
      return list.filter(a => !a.deletedAt && a.status !== 'deleted' && (a.isGlobal || !a.projectId || a.projectId === projectId));
    },
    [projectId]
  ) || [];

  // Filter accounts according to payment method
  const filteredAccounts = useMemo(() => {
    if (paymentMethod === 'cash') {
      const cashes = financialAccounts.filter(a => a.type === 'cash');
      return cashes.length > 0 ? cashes : financialAccounts;
    }
    if (paymentMethod === 'bank' || paymentMethod === 'cheque') {
      const banks = financialAccounts.filter(a => a.type === 'bank');
      return banks.length > 0 ? banks : financialAccounts;
    }
    return financialAccounts;
  }, [financialAccounts, paymentMethod]);

  // Set default selected account when method or list changes
  React.useEffect(() => {
    if (filteredAccounts.length > 0 && (!selectedAccountId || !filteredAccounts.some(a => a.id === selectedAccountId))) {
      const def = filteredAccounts.find(a => a.isDefault) || filteredAccounts[0];
      setSelectedAccountId(def ? def.id : '');
    }
  }, [filteredAccounts, selectedAccountId]);

  // Quick Amount chips
  const handleSetQuickAmount = (ratio) => {
    const rawVal = Math.round(paymentSummary.remaining * ratio);
    setPaymentAmount(String(rawVal));
  };

  const parsedAmount = Number(String(paymentAmount).replace(/,/g, '')) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (parsedAmount <= 0) {
      setErrorMessage(language === 'ku' ? 'تکایە بڕێکی دروست بنووسە.' : language === 'en' ? 'Please enter a valid amount.' : 'لطفاً مبلغ پرداختی معتبری وارد نمایید.');
      return;
    }

    if (parsedAmount > paymentSummary.remaining + 0.01) {
      setErrorMessage(
        language === 'ku'
          ? `بڕی پارەدان (${formatAmount(parsedAmount, currency)}) لە باڵانسی ماوە (${formatAmount(paymentSummary.remaining, currency)}) زیاترە.`
          : language === 'en'
          ? `Payment amount exceeds outstanding balance (${formatAmount(paymentSummary.remaining, currency)}).`
          : `مبلغ پرداختی (${formatAmount(parsedAmount, currency)}) نمی‌تواند از مانده تعهد (${formatAmount(paymentSummary.remaining, currency)}) بیشتر باشد.`
      );
      return;
    }

    if (paymentMethod !== 'cheque' && !selectedAccountId) {
      setErrorMessage(language === 'ku' ? 'تکایە سەرچاوەی پارەدان (سندوق یان بانک) دیاریبکە.' : language === 'en' ? 'Please select a treasury account.' : 'لطفاً حساب مالی یا صندوق مبدأ را انتخاب کنید.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await recordContractSettlementPayment({
        contractId: contract.id,
        settlementId: settlement.id,
        amount: parsedAmount,
        paymentMethod,
        accountId: selectedAccountId || null,
        date: paymentDate,
        trackingCode,
        chequeNumber,
        chequeDueDate,
        chequeBank,
        notes,
        user
      });

      if (onPaymentSuccess) {
        onPaymentSuccess(res);
      }
      onClose();
    } catch (err) {
      console.error('Settlement payment error:', err);
      setErrorMessage(err.message || 'خطا در ثبت پرداخت مالی');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !contract || !settlement) return null;

  return (
    <div
      dir={direction}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="w-full max-w-3xl my-auto rounded-3xl bg-white/95 dark:bg-slate-950/90 backdrop-blur-2xl border border-white/80 dark:border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER DOCK */}
        <div className="p-4 sm:p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-transparent">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0 border border-teal-500/20 shadow-sm">
              <Scale className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {t.modalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {contract.title} • {settlement.title || `#${settlement.settlementNumber}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* 1. CONTRACT OBLIGATION SUMMARY CARD */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-teal-500" />
                <span>{t.summaryTitle}</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">
                {contract.contractNumber || ''} • {contract.counterpartyName || ''}
              </span>
            </div>

            {/* Financial figures row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 block">{t.grossAmount}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {formatAmount(settlement.grossWorkAmount, currency)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 block">{t.netInitialPayable}</span>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">
                  {formatAmount(paymentSummary.netPayable, currency)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 block">{t.previouslyPaid}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatAmount(paymentSummary.paid, currency)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500/10 to-sky-500/10 border border-teal-500/30">
                <span className="text-[11px] text-teal-700 dark:text-teal-300 font-bold block">{t.currentRemaining}</span>
                <span className="font-mono font-black text-teal-600 dark:text-teal-400 text-base">
                  {formatAmount(paymentSummary.remaining, currency)} {currency}
                </span>
              </div>
            </div>

            {/* Delay Penalty & Deductions Transparency Banner */}
            {settlement.totalDelayPenalty > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-bold">{t.delayPenaltyNotice}</span>
                  <span className="text-[11px] text-amber-600/80">({settlement.delayDays || 0} روز تاخیر غیرمجاز)</span>
                </div>
                <span className="font-mono font-black text-amber-800 dark:text-amber-200">
                  -{formatAmount(settlement.totalDelayPenalty, currency)} {currency}
                </span>
              </div>
            )}
          </div>

          {/* If already fully settled */}
          {paymentSummary.remaining <= 0 ? (
            <div className="p-6 text-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {t.fullySettledNotice}
              </p>
            </div>
          ) : (
            <form id="settlement-payment-form" onSubmit={handleSubmit} className="space-y-4">
              
              {/* 2. PAYMENT AMOUNT INPUT WITH QUICK CHIPS */}
              <div className="space-y-2 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-teal-500" />
                    <span>{t.paymentAmountLabel} ({currency})</span>
                  </label>
                  
                  {/* Quick percentage chips [APP_THEME_BUTTON] */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetQuickAmount(1)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300 hover:bg-teal-500/25 transition-all"
                    >
                      {t.quickAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetQuickAmount(0.5)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
                    >
                      {t.quickHalf}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetQuickAmount(0.25)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
                    >
                      {t.quickQuarter}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={paymentAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setPaymentAmount(raw ? Number(raw).toLocaleString() : '');
                    }}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-xl font-mono text-lg font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="absolute ltr:right-4 rtl:left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {currency}
                  </span>
                </div>

                {parsedAmount > 0 && (
                  <p className="text-[11px] text-teal-600 dark:text-teal-400 font-bold px-1">
                    {numberToWords(parsedAmount)} {currency}
                  </p>
                )}
              </div>

              {/* 3. PAYMENT METHOD SELECTOR [APP_THEME_BUTTON] */}
              <div className="space-y-2 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t.methodLabel}
                </label>

                <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'bank'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{t.methodBank}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'cash'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{t.methodCash}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cheque')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'cheque'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'
                    }`}
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>{t.methodCheque}</span>
                  </button>
                </div>
              </div>

              {/* 4. ACCOUNT SELECTION OR CHEQUE DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {paymentMethod !== 'cheque' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-teal-500" />
                      <span>{t.selectAccountLabel}</span>
                    </label>

                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {filteredAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type === 'bank' ? 'بانک' : 'صندوق'})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.chequeNumberLabel}
                      </label>
                      <input
                        type="text"
                        required
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="۱۲۳۴۵۶"
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t.chequeDueDateLabel}
                      </label>
                      <input
                        type="date"
                        required
                        value={chequeDueDate}
                        onChange={(e) => setChequeDueDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </>
                )}

                {/* Tracking Code (for bank wire/card) */}
                {paymentMethod === 'bank' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.trackingCodeLabel}
                    </label>
                    <input
                      type="text"
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      placeholder={t.trackingCodePlaceholder}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}

                {/* Payment Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-teal-500" />
                    <span>{t.paymentDateLabel}</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* 5. NOTES */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.notesLabel}
                </label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              {/* ERROR ALERT */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </form>
          )}

          {/* 6. HISTORICAL PAYMENTS LIST FOR THIS STAGE */}
          {paymentSummary.transactions.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-sky-500" />
                <span>{t.historyTitle} ({paymentSummary.transactions.length})</span>
              </span>

              <div className="space-y-2">
                {paymentSummary.transactions.map((tx, idx) => (
                  <div
                    key={tx.paymentId || idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center font-mono font-bold text-[10px]">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {tx.accountName || 'حساب خزانه‌داری'} ({tx.paymentMethod === 'bank' ? 'بانک' : tx.paymentMethod === 'cheque' ? 'چک' : 'صندوق'})
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {tx.date} {tx.trackingCode ? `• رهگیری: ${tx.trackingCode}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatAmount(tx.amount, currency)} {currency}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STICKY GLASS BOTTOM DOCK */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs">
            <span className="text-slate-400 block text-[11px]">{t.currentRemaining}</span>
            <span className="font-mono font-black text-slate-800 dark:text-white text-sm">
              {formatAmount(paymentSummary.remaining, currency)} {currency}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              {t.cancel}
            </button>

            {paymentSummary.remaining > 0 && (
              <button
                type="submit"
                form="settlement-payment-form"
                disabled={isSubmitting || parsedAmount <= 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white transition-all shadow-md shadow-teal-600/20 active:scale-95 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSubmitting ? t.btnSubmitting : t.btnSubmit}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
