import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generatePaymentId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { pushPaymentsLive } from '../services/realtimeSync';
import { 
  getTodayDateString, 
  getCurrentYearMonth, 
  formatAmount, 
  roundCurrency, 
  getCurrencySymbol, 
  formatCurrency 
} from '../utils/formatters';
import { 
  Banknote,
  Gift, 
  X, 
  User, 
  Calendar, 
  Coins, 
  FileText, 
  Hash, 
  Check, 
  AlertCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Ban, 
  HelpCircle, 
  CheckCircle2, 
  Landmark, 
  Star, 
  CreditCard,
  Wallet,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Receipt,
  Layers,
  Clock,
  Briefcase
} from 'lucide-react';
import { useAccounting } from '../hooks/useAccounting';
import { OverdraftConfirmModal } from './accounting/OverdraftConfirmModal';

const COPY = {
  fa: {
    paymentTypeLabel: 'نوع پرداخت:',
    paymentTypeAdvance: 'مساعده و پیش‌پرداخت',
    paymentTypeBonus: 'عیدی و پاداش تشویقی',
    bonusCategoryLabel: 'مناسبت یا عنوان پاداش:',
    bonusPresetNowruz: 'عیدی مناسبتی (نوروز / اعیاد)',
    bonusPresetGoodJob: 'پاداش حسن انجام کار و انگیزه',
    bonusPresetManagement: 'پاداش صلاحدید مدیریت',
    bonusPresetOther: 'سایر پاداش‌ها',
    bonusCustomTitlePlaceholder: 'عنوان یا مناسبت پاداش را وارد کنید...',
    bonusNonDeductibleNotice: 'این مبلغ به عنوان هدیه و پاداش پرداخت می‌شود، از حساب/صندوق کسر می‌گردد ولی در تسویه حساب کسر نخواهد شد و پرسنل را بدهکار نمی‌کند.',
    bonusSuccessMsg: 'عیدی و پاداش با موفقیت ثبت شد',
    submitBonus: 'ثبت سند عیدی و پاداش',
    totalBonusesReceivedLabel: 'مجموع پاداش‌های دریافت‌شده:',
    bonusModalTitle: 'ثبت سند عیدی و پاداش تشویقی پرسنل',
    bonusModalSubtitle: 'پرداخت پاداش، عیدی‌های مناسبتی یا هدیه به پرسنل کارگاه با ثبت در دفاتر مالی',
    selectedAccountDefault: 'حساب انتخابی',
    cashAccountDefault: 'صندوق',
    workshopCashDesk: '{c.workshopCashDesk}',
    workshopProject: 'پروژه کارگاه',
    unknownWorker: 'پرسنل نامشخص',
    defaultWorkerRole: 'پرسنل',
    overdraftBlockedPolicyError: (accName) => `موجودی حساب انتخابی (${accName}) برای پرداخت این مساعده کافی نیست و سیاست کارگاه بر روی «همیشه نامجاز» تنظیم شده است.`,
    negativeBalanceWarningToast: (accName, formattedNeg) => `مساعده ثبت شد. توجه: موجودی حساب «${accName}» به منفی ${formattedNeg} رسید.`,
    advanceSuccessMsg: 'مساعده با موفقیت ثبت شد',
    errorSavingAdvance: 'خطا در ثبت مساعده',
    advanceModalTitle: 'ثبت سند مساعده و پیش‌پرداخت پرسنل',
    advanceModalSubtitle: 'پرداخت علی‌الحساب، مساعده هفتگی یا وام پرسنل کارگاه با ثبت سند مالی در دفتر معین',
    closeTooltip: 'بستن (ESC)',
    workerRecipientDetails: '{c.workerRecipientDetails}',
    roleLabel: 'سمت:',
    contractType: 'کنتراتی',
    dailyType: 'روزمزد',
    contractFormal: 'کنتراتی / توافقی',
    dailyFormal: 'روزمزد رسمی',
    baseDailyRateLabel: '{c.baseDailyRateLabel}',
    wageTypeLabel: '{c.wageTypeLabel}',
    totalAdvancesReceivedLabel: '{c.totalAdvancesReceivedLabel}',
    advanceDeductionNote: '{c.advanceDeductionNote}',
    amountAndQuickSuggestions: '{c.amountAndQuickSuggestions}',
    quickPresetsLabel: '{c.quickPresetsLabel}',
    equivalentLabel: 'معادل:',
    paymentAccountTitle: '{c.paymentAccountTitle}',
    accountTypeFilterLabel: '{c.accountTypeFilterLabel}',
    allAccountsTab: 'همه حساب‌ها',
    bankCardTab: 'کارت بانکی',
    cashDeskTab: 'صندوق نقدی',
    chooseSourceAccountLabel: '{c.chooseSourceAccountLabel}',
    cardPrefix: '💳 کارت: ',
    cashPrefix: '🪙 صندوق: ',
    balanceLabel: 'موجودی:',
    defaultBadge: '⭐ [پیش‌فرض]',
    overdraftDeficitBlockedTitle: 'کسری موجودی - ثبت غیرمجاز',
    overdraftDeficitAllowedTitle: 'هشدار کسری موجودی (مجاز در تنظیمات)',
    overdraftDeficitWarningTitle: 'هشدار کسری موجودی حساب',
    overdraftBlockedDesc: (accBalance, shortfall) => `موجودی حساب انتخابی (${accBalance}) کافی نیست (کسری: ${shortfall}). طبق تنظیمات، ثبت منفی غیرمجاز است.`,
    overdraftWarningDesc: (accBalance, shortfall) => `مبلغ پرداختی از موجودی فعلی حساب (${accBalance}) بیشتر است (کسری: ${shortfall}).`,
    referenceAndNotesTitle: '{c.referenceAndNotesTitle}',
    referenceNumberLabel: 'شماره پیگیری / شماره فیش بانکی',
    refPlaceholder: 'مثال: پیگیری ۹۸۲۳۴۱ یا فیش دستی',
    notesLabel: 'توضیحات و شرح پرداخت',
    notesPlaceholder: 'شرح علت درخواست مساعده، واریزی به کارت یا نقد...',
    finalAdvanceAmountLabel: '{c.finalAdvanceAmountLabel}',
    recipientPrefix: 'دریافت‌کننده:',
    cancelEsc: '{c.cancelEsc}',
    submitting: 'در حال ثبت...',
    insufficientFundsBlocked: 'کسری موجودی (غیرمجاز)',
    submitAdvance: 'ثبت سند مساعده',
    zeroAmount: '۰'
  },
  ku: {
    paymentTypeLabel: 'جۆری پارەدان:',
    paymentTypeAdvance: 'پێشەکی و مووچەی پێشوەختە',
    paymentTypeBonus: 'جەژنانە و پاداشتی هاندەر',
    bonusCategoryLabel: 'بۆنە یان ناونیشانی پاداشت:',
    bonusPresetNowruz: 'جەژنانەی بۆنەکان (نەورۆز / جەژنەکان)',
    bonusPresetGoodJob: 'پاداشتی شایستەیی و ئەنجامدانی چاکی کار',
    bonusPresetManagement: 'پاداشتی دەسەڵاتی بەڕێوەبەرایەتی',
    bonusPresetOther: 'پاداشتەکانی تر',
    bonusCustomTitlePlaceholder: 'ناونیشان یان هۆکاری پاداشت بنووسە...',
    bonusNonDeductibleNotice: 'ئەم بڕە پارەیە وەک دیاری و پاداشت دەدرێت، لە حیساب/سندوق کەم دەبێتەوە بەڵام لە پاکتاودا داشکاندنی بۆ ناکرێت و کرێکار قەرزدار ناکات.',
    bonusSuccessMsg: 'جەژنانە و پاداشت بە سەرکەوتوویی تۆمارکرا',
    submitBonus: 'تۆمارکردنی بەڵگەنامەی پاداشت',
    totalBonusesReceivedLabel: 'کۆی پاداشتە وەرگیراوەکان:',
    bonusModalTitle: 'تۆمارکردنی بەڵگەنامەی جەژنانە و پاداشت',
    bonusModalSubtitle: 'پارەدانی پاداشت، جەژنانەی بۆنەکان یان دیاری بۆ کرێکاران لەگەڵ تۆماری دارایی',
    selectedAccountDefault: 'حیسابی هەڵبژێردراو',
    cashAccountDefault: 'سندوق',
    workshopCashDesk: 'سندوقی نەختی کارگە',
    workshopProject: 'پڕۆژەی کارگە',
    unknownWorker: 'کرێکاری نادیار',
    defaultWorkerRole: 'کرێکار',
    overdraftBlockedPolicyError: (accName) => `باڵانسی حیسابی هەڵبژێردراو (${accName}) بەش ناکات بۆ ئەم پێشەکییە و سیاسەتی کارگە لەسەر «هەرگیز ڕێگەپێنەدراو» دانراوە.`,
    negativeBalanceWarningToast: (accName, formattedNeg) => `پێشەکی تۆمارکرا. ئاگاداری: باڵانسی حیسابی «${accName}» بوو بە نێگەتیڤ ${formattedNeg}.`,
    advanceSuccessMsg: 'پێشەکی بە سەرکەوتوویی تۆمارکرا',
    errorSavingAdvance: 'هەڵە لە تۆمارکردنی پێشەکی',
    advanceModalTitle: 'تۆمارکردنی بەڵگەنامەی پێشەکی و مووچەی پێشوەختە',
    advanceModalSubtitle: 'پارەدانی پێشوەختە، پێشەکی هەفتانە یان قەرزی کرێکارانی کارگە لەگەڵ تۆماری دارایی لە دەفتەری معین',
    closeTooltip: 'داخستن (ESC)',
    workerRecipientDetails: 'زانیاریی کرێکاری وەرگری پارە',
    roleLabel: 'پلە:',
    contractType: 'کۆنتڕات',
    dailyType: 'ڕۆژانە',
    contractFormal: 'کۆنتڕات / ڕێککەوتن',
    dailyFormal: 'ڕۆژانەی فەرمی',
    baseDailyRateLabel: 'نرخی بنەڕەتیی ڕۆژانە:',
    wageTypeLabel: 'جۆری کرێ:',
    totalAdvancesReceivedLabel: 'کۆی گشتی پێشەکییە وەرگیراوەکان:',
    advanceDeductionNote: 'پێشەکی پاش پەسەندکردن، بە شێوەیەکی خۆکار لە وەسڵی پاکتاوی مانگانەی ئەم کەسە دادەشکێنرێت.',
    amountAndQuickSuggestions: 'بڕی پێشەکی و پێشنیارە خێراکان',
    quickPresetsLabel: 'بڕە باوەکانی پێشەکی (هەڵبژاردنی خێرا بە یەک کلیک):',
    equivalentLabel: 'هاوتایە لەگەڵ:',
    paymentAccountTitle: 'حیساب یان سندوقی پارەدان',
    accountTypeFilterLabel: 'فلتەری جۆری حیسابی پارەدان:',
    allAccountsTab: 'هەموو حیسابەکان',
    bankCardTab: 'کارتی بانکی',
    cashDeskTab: 'سندوقی نەختینە',
    chooseSourceAccountLabel: 'هەڵبژاردنی حیسابی سەرچاوەی پارەدان:',
    cardPrefix: '💳 کارت: ',
    cashPrefix: '🪙 سندوق: ',
    balanceLabel: 'باڵانس:',
    defaultBadge: '⭐ [بنەڕەتی]',
    overdraftDeficitBlockedTitle: 'کەمیی باڵانس - تۆمارکردن قەدەغەیە',
    overdraftDeficitAllowedTitle: 'ئاگاداری کەمی باڵانس (ڕێگەپێدراوە لە ڕێکخستنەکان)',
    overdraftDeficitWarningTitle: 'ئاگاداری کەمیی باڵانسی حیساب',
    overdraftBlockedDesc: (accBalance, shortfall) => `باڵانسی حیسابی هەڵبژێردراو (${accBalance}) بەش ناکات (کەمی: ${shortfall}). بەپێی ڕێکخستنەکان، باڵانسی نێگەتیڤ قەدەغەیە.`,
    overdraftWarningDesc: (accBalance, shortfall) => `بڕی پارەدان لە باڵانسی ئێستای حیساب (${accBalance}) زیاترە (کەمی: ${shortfall}).`,
    referenceAndNotesTitle: 'ژمارەی ئاماژە، وەسڵ و ڕوونکردنەوەکان',
    referenceNumberLabel: 'ژمارەی بەدواداچوون / فیشی بانکی',
    refPlaceholder: 'نموونە: بەدواداچوونی ٩٨٢٣٤١ یان وەسڵی دەستی',
    notesLabel: 'ڕوونکردنەوە و هۆکاری پارەدان',
    notesPlaceholder: 'هۆکاری داواکردنی پێشەکی، حەواڵە بۆ کارت یان نەختینە...',
    finalAdvanceAmountLabel: 'بڕی کۆتایی پێشەکی:',
    recipientPrefix: 'وەرگر:',
    cancelEsc: 'پاشگەزبوونەوە (ESC)',
    submitting: 'تۆماردەکرێت...',
    insufficientFundsBlocked: 'کەمیی باڵانس (ڕێگاپێنەدراو)',
    submitAdvance: 'تۆمارکردنی بەڵگەنامەی پێشەکی',
    zeroAmount: '٠'
  },
  en: {
    paymentTypeLabel: 'Payment Type:',
    paymentTypeAdvance: 'Advance Payment',
    paymentTypeBonus: 'Bonus & Festive Gift',
    bonusCategoryLabel: 'Bonus Reason / Title:',
    bonusPresetNowruz: 'Festive Gift (Nowruz / Eid)',
    bonusPresetGoodJob: 'Performance & Merit Bonus',
    bonusPresetManagement: 'Management Discretionary Bonus',
    bonusPresetOther: 'Other Bonuses',
    bonusCustomTitlePlaceholder: 'Enter bonus reason or title...',
    bonusNonDeductibleNotice: 'This amount is granted as a gift/bonus. It reduces bank/cash balance but will NOT be deducted from settlements and never makes the worker indebted.',
    bonusSuccessMsg: 'Bonus & Gift recorded successfully',
    submitBonus: 'Record Bonus & Gift',
    totalBonusesReceivedLabel: 'Total Bonuses Received:',
    bonusModalTitle: 'Record Personnel Bonus & Festive Gift',
    bonusModalSubtitle: 'Grant performance bonus or festive gifts with complete ledger tracking',
    selectedAccountDefault: 'Selected Account',
    cashAccountDefault: 'Cash Drawer',
    workshopCashDesk: 'Workshop Cash Drawer',
    workshopProject: 'Workshop Project',
    unknownWorker: 'Unknown Worker',
    defaultWorkerRole: 'Worker',
    overdraftBlockedPolicyError: (accName) => `Insufficient balance in selected account (${accName}) for this advance and policy is set to "Never Allow".`,
    negativeBalanceWarningToast: (accName, formattedNeg) => `Advance recorded. Note: Account balance for "${accName}" is now negative ${formattedNeg}.`,
    advanceSuccessMsg: 'Advance payment recorded successfully',
    errorSavingAdvance: 'Error saving advance payment',
    advanceModalTitle: 'Personnel Advance Payment & Loan Entry',
    advanceModalSubtitle: 'Record advance wages, weekly allowances, or staff loans with ledger entries',
    closeTooltip: 'Close (ESC)',
    workerRecipientDetails: 'Recipient Worker Details',
    roleLabel: 'Role:',
    contractType: 'Contract',
    dailyType: 'Daily',
    contractFormal: 'Contract / Fixed',
    dailyFormal: 'Daily Wage',
    baseDailyRateLabel: 'Base Daily Rate:',
    wageTypeLabel: 'Wage Type:',
    totalAdvancesReceivedLabel: 'Total Advances Received:',
    advanceDeductionNote: 'Once approved, this advance will be automatically deducted from monthly settlements.',
    amountAndQuickSuggestions: 'Advance Amount & Quick Presets',
    quickPresetsLabel: 'Common advance amounts (One-click quick select):',
    equivalentLabel: 'Equivalent:',
    paymentAccountTitle: 'Payment Source & Account',
    accountTypeFilterLabel: 'Account Type Filter:',
    allAccountsTab: 'All Accounts',
    bankCardTab: 'Bank Card',
    cashDeskTab: 'Cash Drawer',
    chooseSourceAccountLabel: 'Select Payment Account:',
    cardPrefix: '💳 Card: ',
    cashPrefix: '🪙 Cash: ',
    balanceLabel: 'Balance:',
    defaultBadge: '⭐ [Default]',
    overdraftDeficitBlockedTitle: 'Insufficient Balance - Transaction Blocked',
    overdraftDeficitAllowedTitle: 'Deficit Warning (Allowed by settings)',
    overdraftDeficitWarningTitle: 'Account Deficit Warning',
    overdraftBlockedDesc: (accBalance, shortfall) => `Account balance (${accBalance}) is insufficient (Shortfall: ${shortfall}). Policy strictly prohibits negative balance.`,
    overdraftWarningDesc: (accBalance, shortfall) => `Payment exceeds current balance (${accBalance}) by ${shortfall}.`,
    referenceAndNotesTitle: 'Reference, Receipt & Description',
    referenceNumberLabel: 'Tracking / Bank Receipt No.',
    refPlaceholder: 'e.g. Ref #982341 or manual voucher',
    notesLabel: 'Notes & Payment Purpose',
    notesPlaceholder: 'Purpose of advance, cash or card transfer...',
    finalAdvanceAmountLabel: 'Final Advance Amount:',
    recipientPrefix: 'Recipient:',
    cancelEsc: 'Cancel (ESC)',
    submitting: 'Saving...',
    insufficientFundsBlocked: 'Insufficient Funds (Blocked)',
    submitAdvance: 'Record Advance Payment',
    zeroAmount: '0'
  }
};

export function AdvancePaymentModal({ 
  isOpen, 
  onClose, 
  workers = [], 
  targetWorkerId = null, 
  targetMonth = null,
  initialPaymentType = "advance" // "advance" | "bonus"
}) {
  const { t, language, direction } = useLanguage();
  const c = COPY[language] || COPY.fa;
  const { currentProject } = useProject();
  const { user } = useAuth();
  const currency = currentProject?.currency || 'IQD';
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  const [paymentType, setPaymentType] = useState(initialPaymentType || "advance"); // "advance" | "bonus"
  const [bonusPreset, setBonusPreset] = useState("nowruz");
  const [customBonusTitle, setCustomBonusTitle] = useState("");
  const [workerId, setWorkerId] = useState(targetWorkerId || "");
  const [month, setMonth] = useState(targetMonth || getCurrentYearMonth());
  const [date, setDate] = useState(getTodayDateString());
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentMethodTab, setPaymentMethodTab] = useState('all'); // 'all' | 'cash' | 'bank'
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [toastMessage, setToastMessage] = useState(null);
  const { checkAccountOverdraft, accountBalances } = useAccounting();
  const [overdraftPromptData, setOverdraftPromptData] = useState(null);

  // Financial accounts live query
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

  const effectiveAccountId = selectedAccountId || defaultAccount?.id || (financialAccounts[0]?.id ? String(financialAccounts[0].id) : '');

  // Filter financial accounts based on method tab
  const filteredFinancialAccounts = useMemo(() => {
    if (paymentMethodTab === 'all') return financialAccounts;
    return financialAccounts.filter((a) => a.type === paymentMethodTab);
  }, [financialAccounts, paymentMethodTab]);

  const currentOverdraft = useMemo(() => {
    const numAmount = roundCurrency(Number(amount), currency);
    if (isNaN(numAmount) || numAmount <= 0 || !effectiveAccountId) return null;
    return checkAccountOverdraft(effectiveAccountId, numAmount);
  }, [amount, effectiveAccountId, currency, checkAccountOverdraft]);

  // Selected worker details & calculations
  const selectedWorker = useMemo(() => {
    return workers.find((w) => String(w.id) === String(workerId)) || null;
  }, [workers, workerId]);

  // Query past unsettled logs & advances for this worker to show instant context
  const pastAdvances = useLiveQuery(
    async () => {
      if (!workerId || !db.payments) return [];
      const all = await db.payments.where('workerId').equals(workerId).toArray();
      return all.filter((p) => !p.deletedAt && p.type === 'advance' && p.status !== 'deleted');
    },
    [workerId]
  ) || [];

  const totalWorkerAdvances = useMemo(() => {
    return pastAdvances.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [pastAdvances]);

  useEffect(() => {
    if (isOpen) {
      const initialWorkerId = targetWorkerId || (workers[0]?.id || '');
      setWorkerId(initialWorkerId);
      setMonth(targetMonth || getCurrentYearMonth());
      setDate(getTodayDateString());
      setAmount('');
      setSelectedAccountId(effectiveAccountId);
      setPaymentMethodTab('all');
      setReferenceNumber('');
      setNotes('');
      setFeedback({ type: '', message: '' });
      setToastMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultAccount]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Quick amount presets based on currency
  const quickAmounts = useMemo(() => {
    if (currency === 'IQD') {
      return [25000, 50000, 100000, 250000, 500000];
    }
    if (currency === 'IRR' || currency === 'IRT') {
      return [500000, 1000000, 2000000, 5000000];
    }
    return [50, 100, 200, 500];
  }, [currency]);

  if (!isOpen) return null;

  const handleSubmit = async (e, bypassOverdraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback({ type: '', message: '' });

    const numAmount = roundCurrency(Number(amount), currency);
    if (!workerId) {
      setFeedback({ type: 'error', message: t('pleaseSelectWorker') });
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: 'error', message: t('pleaseEnterValidAmount') });
      return;
    }

    if (!bypassOverdraft) {
      const overdraftCheck = checkAccountOverdraft(selectedAccountId, numAmount);
      if (!overdraftCheck.hasSufficientFunds) {
        if (overdraftCheck.effectivePolicy === 'never_allow') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || c.selectedAccountDefault,
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: numAmount,
            shortfall: overdraftCheck.shortfall,
            isBlocked: true
          });
          setFeedback({
            type: 'error',
            message: c.overdraftBlockedPolicyError(overdraftCheck.account?.name || c.cashAccountDefault)
          });
          return;
        } else if (overdraftCheck.effectivePolicy === 'ask_each_time') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || c.selectedAccountDefault,
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: numAmount,
            shortfall: overdraftCheck.shortfall,
            isBlocked: false
          });
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const derivedMonth = date ? date.slice(0, 7) : month;

      const workerName = selectedWorker?.name || 'Unknown';
      const chosenAccount = financialAccounts.find((a) => String(a.id) === String(selectedAccountId)) || defaultAccount;

      const derivedBonusTitle = paymentType === "bonus"
        ? (customBonusTitle.trim() || (bonusPreset === "nowruz" ? c.bonusPresetNowruz : bonusPreset === "good_job" ? c.bonusPresetGoodJob : bonusPreset === "management" ? c.bonusPresetManagement : c.bonusPresetOther))
        : null;

      const newPayment = {
        id: generatePaymentId(),
        projectId: targetProjectId,
        userId: user?.id || null,
        workerId,
        workerName,
        month: derivedMonth,
        date,
        time: currentTime,
        type: paymentType, // "advance" or "bonus"
        bonusTitle: derivedBonusTitle,
        amount: numAmount,
        currency,
        accountId: chosenAccount?.id ? String(chosenAccount.id) : null,
        accountName: chosenAccount?.name || "",
        accountType: chosenAccount?.type || "cash",
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        status: "draft",
        approval_status: "draft",
        settlement_status: paymentType === "bonus" ? "not_applicable" : "partial",
        created_by: user?.id || "admin",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      await db.payments.add(newPayment);
      pushPaymentsLive().catch(() => {});

      const finalCheck = checkAccountOverdraft(selectedAccountId, numAmount);
      if (numAmount > 0 && !finalCheck.hasSufficientFunds) {
        const resultingNeg = Math.abs(finalCheck.currentBalance - numAmount);
        setToastMessage({
          type: 'warning',
          text: c.negativeBalanceWarningToast(finalCheck.account?.name || c.cashAccountDefault, formatCurrency(resultingNeg, currency, language))
        });
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setFeedback({ type: 'success', message: paymentType === 'bonus' ? c.bonusSuccessMsg : c.advanceSuccessMsg });
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || c.errorSavingAdvance });
    } finally {
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
          toastMessage.type === 'warning'
            ? 'bg-amber-600 text-white shadow-amber-600/30'
            : 'bg-emerald-600 text-white shadow-emerald-600/30'
        }`}>
          {toastMessage.type === 'warning' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs z-20">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md shrink-0 transition-all duration-300 ${
              paymentType === "bonus"
                ? "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-purple-500/25"
                : "bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-amber-500/25"
            }`}>
              {paymentType === "bonus" ? <Gift className="w-5 h-5 stroke-[2.2]" /> : <Banknote className="w-5 h-5 stroke-[2.2]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {paymentType === "bonus" ? c.bonusModalTitle : c.advanceModalTitle}
                </h2>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs transition-colors duration-300 ${
                  paymentType === "bonus"
                    ? "bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-900/60"
                    : "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/60"
                }`}>
                  {currentProject?.name || c.workshopProject}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {paymentType === "bonus" ? c.bonusModalSubtitle : c.advanceModalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            title={c.closeTooltip}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Body - #f3f6f4 container with 12-Column Responsive Desktop Grid */}
      <div className="flex-1 overflow-y-auto bg-[#f3f6f4] dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto w-full">
          
          <form id="advance-form" onSubmit={handleSubmit} className="space-y-5">
            {feedback.message && (
              <div className={`p-4 rounded-3xl text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm border ${
                feedback.type === 'error'
                  ? 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
              }`}>
                {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Check className="w-5 h-5 shrink-0" />}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* [APP_THEME_BUTTON] Mode Switcher: Advance vs Bonus */}
            <div className="p-1 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 px-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{c.paymentTypeLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentType("advance")}
                  className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                    paymentType === "advance"
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Banknote className="w-4 h-4 shrink-0" />
                  <span>{c.paymentTypeAdvance}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType("bonus")}
                  className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                    paymentType === "bonus"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Gift className="w-4 h-4 shrink-0" />
                  <span>{c.paymentTypeBonus}</span>
                </button>
              </div>
            </div>

            {/* Desktop 12-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* ───────────────────────────────────────────────────────────── */}
              {/* RIGHT COLUMN (7 Cols): Worker, Numeric Amount, Quick Badges   */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-7 space-y-5">
                
                {/* Card 1: Worker Selection & Realtime Context (Apple Liquid Glass) */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {c.workerRecipientDetails}
                      </span>
                    </div>

                    {selectedWorker && (
                      <span className="text-[11px] font-bold text-slate-400">
                        {c.roleLabel} <strong className="text-slate-700 dark:text-slate-300">{selectedWorker.role || c.defaultWorkerRole}</strong>
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Worker Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        {t('workerName')} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={workerId}
                          onChange={(e) => setWorkerId(e.target.value)}
                          required
                          className="w-full px-4 py-3 text-xs sm:text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white cursor-pointer shadow-xs transition-all"
                        >
                          {workers.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} {w.role ? `(${w.role})` : ''} - {w.wageType === 'contract' ? c.contractType : c.dailyType}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Info Badges Bar for Selected Worker */}
                    {selectedWorker && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                        <div>
                          <span className="block text-[10px] text-amber-800/70 dark:text-amber-300/70 font-bold mb-0.5">
                            {c.baseDailyRateLabel}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white font-mono text-xs">
                            {formatCurrency(selectedWorker.dailyRate || 0, currency, language)}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-amber-800/70 dark:text-amber-300/70 font-bold mb-0.5">
                            {c.wageTypeLabel}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white text-xs">
                            {selectedWorker.wageType === 'contract' ? c.contractFormal : c.dailyFormal}
                          </span>
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <span className="block text-[10px] text-amber-800/70 dark:text-amber-300/70 font-bold mb-0.5">
                            {paymentType === "bonus" ? c.totalBonusesReceivedLabel : c.totalAdvancesReceivedLabel}
                          </span>
                          <span className={`font-black font-mono text-xs ${paymentType === "bonus" ? "text-purple-600 dark:text-purple-400" : "text-amber-600 dark:text-amber-400"}`}>
                            {formatCurrency(paymentType === "bonus" ? totalWorkerBonuses : totalWorkerAdvances, currency, language)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bonus Reason / Title Selector (If Bonus mode) */}
                    {paymentType === "bonus" && (
                      <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-3">
                        <label className="block text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                          <Gift className="w-4 h-4 text-purple-500" />
                          <span>{c.bonusCategoryLabel}</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: "nowruz", label: c.bonusPresetNowruz },
                            { id: "good_job", label: c.bonusPresetGoodJob },
                            { id: "management", label: c.bonusPresetManagement },
                            { id: "other", label: c.bonusPresetOther }
                          ].map((bp) => (
                            <button
                              key={bp.id}
                              type="button"
                              onClick={() => setBonusPreset(bp.id)}
                              className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                bonusPreset === bp.id
                                  ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                  : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300"
                              }`}
                            >
                              {bp.label}
                            </button>
                          ))}
                        </div>

                        {bonusPreset === "other" && (
                          <input
                            type="text"
                            value={customBonusTitle}
                            onChange={(e) => setCustomBonusTitle(e.target.value)}
                            placeholder={c.bonusCustomTitlePlaceholder}
                            className="w-full px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
                          />
                        )}
                      </div>
                    )}

                    {/* Date Input */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <Calendar className={`w-3.5 h-3.5 ${paymentType === "bonus" ? "text-purple-500" : "text-amber-500"}`} />
                          <span>{t("paymentDate")}</span> <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                          className={`w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 ${
                            paymentType === "bonus" ? "focus:ring-purple-500" : "focus:ring-amber-500"
                          } text-slate-900 dark:text-white font-mono cursor-pointer shadow-xs`}
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <div className={`text-[11px] p-2.5 rounded-2xl border ${
                          paymentType === "bonus"
                            ? "bg-purple-50/70 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-900/60 font-medium"
                            : "bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-slate-200/60 dark:border-slate-700/60"
                        }`}>
                          {paymentType === "bonus" ? c.bonusNonDeductibleNotice : c.advanceDeductionNote}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Advance Payment Amount & Apple Glass Quick Presets */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <Coins className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {c.amountAndQuickSuggestions}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('paymentAmount')} <span className="text-rose-500">*</span>
                    </label>

                    {/* Big Amount Typography Input */}
                    <div className="relative flex rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 focus-within:ring-2 focus-within:ring-amber-500 overflow-hidden shadow-xs transition-all">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amount ? Number(String(amount).replace(/,/g, '')).toLocaleString() : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                          setAmount(raw);
                        }}
                        onBlur={() => {
                          if (amount !== '') {
                            setAmount(String(roundCurrency(amount, currency)));
                          }
                        }}
                        placeholder="0"
                        required
                        className="w-full px-4 py-3.5 bg-transparent text-lg sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400 focus:outline-none"
                      />
                      <div className="bg-slate-200/70 dark:bg-slate-700 px-4 py-3 text-xs font-black font-mono text-slate-700 dark:text-slate-200 border-s border-slate-200 dark:border-slate-700 flex items-center justify-center">
                        {getCurrencySymbol(currency, language)}
                      </div>
                    </div>

                    {/* Quick Apple Liquid Glass Chips */}
                    <div className="mt-3.5 space-y-2">
                      <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {c.quickPresetsLabel}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {quickAmounts.map((qAmount) => {
                          const isSelected = String(amount) === String(qAmount);
                          return (
                            <button
                              key={qAmount}
                              type="button"
                              onClick={() => setAmount(String(qAmount))}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all duration-200 active:scale-95 cursor-pointer border ${
                                isSelected
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/25 scale-105'
                                  : 'bg-white/80 dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 shadow-2xs'
                              }`}
                            >
                              {formatAmount(qAmount, currency)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {Number(amount) > 0 && (
                      <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-black font-mono flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{c.equivalentLabel} {formatAmount(Number(amount), currency)} {getCurrencySymbol(currency, language)}</span>
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* LEFT COLUMN (5 Cols): Payment Source, Overdraft & Notes       */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* Card 3: Payment Account & Segment Switcher */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {c.paymentAccountTitle}
                      </span>
                    </div>

                    {defaultAccount && (
                      <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span>{defaultAccount.name}</span>
                      </span>
                    )}
                  </div>

                  {/* Payment Method Segment Toggle [APP_THEME_BUTTON] */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {c.accountTypeFilterLabel}
                    </label>
                    <div className="h-10 inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner w-full">
                      <button
                        type="button"
                        onClick={() => setPaymentMethodTab('all')}
                        className={`flex-1 h-full flex items-center justify-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer text-xs ${
                          paymentMethodTab === 'all'
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-black'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
                        }`}
                      >
                        <span>{c.allAccountsTab}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethodTab('bank')}
                        className={`flex-1 h-full flex items-center justify-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer text-xs ${
                          paymentMethodTab === 'bank'
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-black'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{c.bankCardTab}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethodTab('cash')}
                        className={`flex-1 h-full flex items-center justify-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer text-xs ${
                          paymentMethodTab === 'cash'
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-black'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
                        }`}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{c.cashDeskTab}</span>
                      </button>
                    </div>
                  </div>

                  {/* Financial Account Dropdown */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {c.chooseSourceAccountLabel}
                    </label>

                    {filteredFinancialAccounts.length > 0 ? (
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-3.5 py-3 text-xs bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white cursor-pointer font-bold shadow-xs transition-all"
                      >
                        {filteredFinancialAccounts.map((acc) => {
                          const b = accountBalances?.get(String(acc.id))?.currentBalance ?? (Number(acc.initialBalance) || 0);
                          return (
                            <option key={acc.id} value={acc.id}>
                              {acc.type === 'bank' ? c.cardPrefix : c.cashPrefix}
                              {acc.name} {acc.bankName ? `(${acc.bankName})` : ''} - {c.balanceLabel} {formatCurrency(b, currency, language)} {acc.isDefault ? c.defaultBadge : ''}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <div className="text-xs text-slate-400 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 font-medium">
                        {c.workshopCashDesk}
                      </div>
                    )}
                  </div>

                  {/* Overdraft Warning Banner */}
                  {currentOverdraft && !currentOverdraft.hasSufficientFunds && (
                    <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 transition-all shadow-xs ${
                      currentOverdraft.effectivePolicy === 'never_allow'
                        ? 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                        : 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300'
                    }`}>
                      {currentOverdraft.effectivePolicy === 'never_allow' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="font-bold">
                          {currentOverdraft.effectivePolicy === 'never_allow'
                            ? c.overdraftDeficitBlockedTitle
                            : currentOverdraft.effectivePolicy === 'always_allow'
                              ? c.overdraftDeficitAllowedTitle
                              : c.overdraftDeficitWarningTitle}
                        </div>
                        <div className="text-[11px] leading-relaxed opacity-90 font-medium">
                          {currentOverdraft.effectivePolicy === 'never_allow'
                            ? c.overdraftBlockedDesc(formatCurrency(currentOverdraft.currentBalance, currency, language), formatCurrency(currentOverdraft.shortfall, currency, language))
                            : c.overdraftWarningDesc(formatCurrency(currentOverdraft.currentBalance, currency, language), formatCurrency(currentOverdraft.shortfall, currency, language))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card 4: Reference Number & Notes */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {c.referenceAndNotesTitle}
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.referenceNumberLabel}</span>
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder={c.refPlaceholder}
                        className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.notesLabel}</span>
                      </label>
                      <textarea
                        rows="2"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={c.notesPlaceholder}
                        className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white resize-none shadow-xs leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </form>

        </div>
      </div>

      {/* Sticky Bottom Actions Bar (Apple Liquid Glass Dock) */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 shrink-0 shadow-lg z-20">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Summary Pill on Start Side */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400">
                {c.finalAdvanceAmountLabel}
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {amount ? Number(amount).toLocaleString() : c.zeroAmount}
              </span>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                {getCurrencySymbol(currency, language)}
              </span>
            </div>

            {selectedWorker && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                <User className="w-3.5 h-3.5 text-amber-500" />
                <span>{c.recipientPrefix} {selectedWorker.name}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {c.cancelEsc}
            </button>

            <button
              type="submit"
              form="advance-form"
              disabled={isSubmitting || !amount}
              className={`px-7 py-2.5 rounded-2xl text-xs font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md ${
                currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === 'never_allow'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25'
                  : paymentType === 'bonus'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/25'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/25'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{c.submitting}</span>
                </>
              ) : currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === 'never_allow' ? (
                <>
                  <Ban className="w-4 h-4" />
                  <span>{c.insufficientFundsBlocked}</span>
                </>
              ) : (
                <>
                  {paymentType === 'bonus' ? <Gift className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                  <span>{paymentType === 'bonus' ? c.submitBonus : c.submitAdvance}</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Overdraft confirmation modal */}
      {overdraftPromptData && (
        <OverdraftConfirmModal
          isOpen={Boolean(overdraftPromptData)}
          onClose={() => setOverdraftPromptData(null)}
          onConfirm={() => handleSubmit(null, true)}
          accountName={overdraftPromptData.accountName}
          currentBalance={overdraftPromptData.currentBalance}
          requestedAmount={overdraftPromptData.requestedAmount}
          currency={currency}
          language={language}
          isBlocked={Boolean(overdraftPromptData.isBlocked)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
