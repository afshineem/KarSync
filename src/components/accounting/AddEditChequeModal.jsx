import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { createCheque, updateCheque } from '../../services/chequeService';
import { formatCurrency, formatAmount, numberToWords, getTodayDateString } from '../../utils/formatters';
import {
  X,
  Receipt,
  CreditCard,
  Building,
  User,
  Calendar,
  DollarSign,
  FileText,
  Hash,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Tag,
  Landmark,
  FileCheck2,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export function AddEditChequeModal({
  isOpen,
  onClose,
  chequeToEdit = null,
  initialType = 'inward', // 'inward' | 'outward'
  currency = 'IQD',
  language: propLanguage
}) {
  const { t, language: ctxLang, direction } = useLanguage();
  const lang = propLanguage || ctxLang || 'fa';
  const { user } = useAuth();
  const { currentProject } = useProject();
  const isRtl = direction === 'rtl';

  const [type, setType] = useState(initialType);
  const [bankAccountId, setBankAccountId] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [sayadNumber, setSayadNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [drawerName, setDrawerName] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(getTodayDateString());
  const [dueDate, setDueDate] = useState(getTodayDateString());
  const [purpose, setPurpose] = useState('');
  const [bankTrackingCode, setBankTrackingCode] = useState('');
  const [bankDocumentNumber, setBankDocumentNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [selectedChequebookId, setSelectedChequebookId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live queries for bank accounts, counterparties, chequebooks
  const financialAccounts = useLiveQuery(
    async () => {
      if (!db.financialAccounts) return [];
      const list = await db.financialAccounts.toArray();
      return list.filter((a) => !a.deletedAt && a.isActive);
    },
    []
  ) || [];

  const bankAccountsOnly = useMemo(() => {
    return financialAccounts.filter((a) => a.type === 'bank');
  }, [financialAccounts]);

  const counterparties = useLiveQuery(
    async () => {
      if (!db.counterparties) return [];
      const list = await db.counterparties.toArray();
      return list.filter((cp) => !cp.deletedAt);
    },
    []
  ) || [];

  const chequebooks = useLiveQuery(
    async () => {
      if (!db.chequebooks) return [];
      const list = await db.chequebooks.toArray();
      return list.filter((b) => !b.deletedAt && b.status === 'active');
    },
    []
  ) || [];

  const quickPurposes = useMemo(() => {
    if (lang === 'ku') {
      return [
        'پێشەکی گرێبەست',
        'پاکتاوکردنی فاکتۆری کڕین',
        'کڕینی کەرەستە و چیمەنتۆ',
        'موساعەدەی کرێکاران',
        'تەواوکاری کار',
        'گرەنتی کارکردن'
      ];
    }
    if (lang === 'en') {
      return [
        'Contract Advance',
        'Invoice Settlement',
        'Materials Purchase',
        'Worker Advance',
        'Performance Guarantee',
        'Project Milestone'
      ];
    }
    return [
      'پیش‌پرداخت قرارداد',
      'تسویه فاکتور خرید',
      'خرید آهن‌آلات و مصالح',
      'مساعده پرسنل و پیمانکار',
      'حسن انجام کار و ضمانت',
      'صورت‌وضعیت پیشرفت کار'
    ];
  }, [lang]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (chequeToEdit) {
        setType(chequeToEdit.type || 'inward');
        setBankAccountId(chequeToEdit.bankAccountId || '');
        setChequeNumber(chequeToEdit.chequeNumber || '');
        setSayadNumber(chequeToEdit.sayadNumber || '');
        setNationalId(chequeToEdit.nationalId || '');
        setDrawerName(chequeToEdit.drawerName || '');
        setPayeeName(chequeToEdit.payeeName || '');
        setCounterpartyId(chequeToEdit.counterpartyId || '');
        setBankName(chequeToEdit.bankName || '');
        setBranchName(chequeToEdit.branchName || '');
        setAmount(chequeToEdit.amount ? Number(chequeToEdit.amount).toLocaleString('en-US') : '');
        setIssueDate(chequeToEdit.issueDate || getTodayDateString());
        setDueDate(chequeToEdit.dueDate || getTodayDateString());
        setPurpose(chequeToEdit.purpose || '');
        setBankTrackingCode(chequeToEdit.bankTrackingCode || '');
        setBankDocumentNumber(chequeToEdit.bankDocumentNumber || '');
        setNotes(chequeToEdit.notes || '');
        setAttachmentUrl(chequeToEdit.attachmentUrl || '');
      } else {
        setType(initialType);
        const defaultBank = bankAccountsOnly.find((a) => a.isDefault) || bankAccountsOnly[0] || null;
        setBankAccountId(defaultBank?.id || '');
        setBankName(defaultBank?.bankName || '');
        setChequeNumber('');
        setSayadNumber('');
        setNationalId('');
        setDrawerName('');
        setPayeeName('');
        setCounterpartyId('');
        setBranchName('');
        setAmount('');
        setIssueDate(getTodayDateString());
        setDueDate(getTodayDateString());
        setPurpose('');
        setBankTrackingCode('');
        setBankDocumentNumber('');
        setNotes('');
        setAttachmentUrl('');
        setSelectedChequebookId('');
      }
    }
  }, [isOpen, chequeToEdit, initialType, bankAccountsOnly]);

  if (!isOpen) return null;

  const rawNumericAmount = Number(String(amount || '').replace(/,/g, '')) || 0;

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      setAmount('');
      return;
    }
    setAmount(Number(raw).toLocaleString('en-US'));
  };

  const handleCounterpartyChange = (cpId) => {
    setCounterpartyId(cpId);
    if (!cpId) return;
    const cp = counterparties.find((c) => String(c.id) === String(cpId));
    if (cp) {
      if (type === 'inward') {
        setDrawerName(cp.name || '');
        if (cp.nationalId) setNationalId(cp.nationalId);
      } else {
        setPayeeName(cp.name || '');
        if (cp.nationalId) setNationalId(cp.nationalId);
      }
    }
  };

  const handleBankAccountChange = (accId) => {
    setBankAccountId(accId);
    const acc = bankAccountsOnly.find((a) => a.id === accId);
    if (acc) {
      setBankName(acc.bankName || acc.name || '');
    }
  };

  const handleChequebookSelect = (bookId) => {
    setSelectedChequebookId(bookId);
    const book = chequebooks.find((b) => b.id === bookId);
    if (book) {
      setBankAccountId(book.bankAccountId);
      setBankName(book.bankName || '');
      const nextSerial = (Number(book.startSerial) || 1) + (Number(book.usedLeaves) || 0);
      setChequeNumber(String(nextSerial));
      if (book.sayadSeries) {
        setSayadNumber(book.sayadSeries);
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setAttachmentUrl(uploadEvent.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (rawNumericAmount <= 0) {
      setErrorMsg(lang === 'fa' ? 'لطفاً مبلغ معتبری برای چک وارد کنید.' : lang === 'ku' ? 'تکایە بڕە پارەیەکی دروست بۆ چەک بنووسە.' : 'Please enter a valid cheque amount.');
      return;
    }

    if (!chequeNumber.trim()) {
      setErrorMsg(lang === 'fa' ? 'شماره سریال برگه چک الزامی است.' : lang === 'ku' ? 'ژمارەی چەک پێویستە.' : 'Cheque number is required.');
      return;
    }

    if (type === 'outward' && !bankAccountId) {
      setErrorMsg(lang === 'fa' ? 'لطفاً حساب بانکی کارگاه را انتخاب کنید.' : lang === 'ku' ? 'تکایە هەژماری بانکی کارگە دیاریبکە.' : 'Please select the workshop bank account.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        projectId: currentProject?.id || 'prj_central',
        type,
        bankAccountId: type === 'outward' ? bankAccountId : null,
        bankName,
        branchName,
        chequeNumber: chequeNumber.trim(),
        sayadNumber: sayadNumber.trim(),
        nationalId: nationalId.trim(),
        drawerName: drawerName.trim(),
        payeeName: payeeName.trim(),
        counterpartyId: counterpartyId || null,
        amount: rawNumericAmount,
        currency,
        issueDate,
        dueDate,
        purpose: purpose.trim(),
        bankTrackingCode: bankTrackingCode.trim(),
        bankDocumentNumber: bankDocumentNumber.trim(),
        notes: notes.trim(),
        attachmentUrl,
        chequebookId: selectedChequebookId || null
      };

      if (chequeToEdit) {
        await updateCheque(chequeToEdit.id, payload, user);
      } else {
        await createCheque(payload, user);
      }

      onClose();
    } catch (err) {
      console.error('[AddEditChequeModal] Save error:', err);
      setErrorMsg(err.message || 'خطا در ثبت اطلاعات چک');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
      dir={direction}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center flex-shrink-0 shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {chequeToEdit
                    ? (lang === 'fa' ? 'ویرایش مشخصات چک صیادی' : lang === 'ku' ? 'دەستکاریکردنی چەک' : 'Edit Cheque Record')
                    : (lang === 'fa' ? 'ثبت چک و اسناد تجاری جدید' : lang === 'ku' ? 'تۆمارکردنی چەکی نوێ' : 'Record New Commercial Cheque')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                  {type === 'inward' 
                    ? (lang === 'fa' ? 'چک دریافتی (ورودی)' : lang === 'ku' ? 'چەکی وەرگیراو' : 'Inward Cheque')
                    : (lang === 'fa' ? 'چک صادره کارگاه (خروجی)' : lang === 'ku' ? 'چەکی دەرکراو' : 'Outward Cheque')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'fa' ? 'مدیریت اسناد دریافتنی و پرداختنی، صیادی و مغایرت‌گیری بانکی' : lang === 'ku' ? 'بەڕێوەبردنی بەڵگەنامە و ووردبینی بانکی' : 'Manage bank reconciliation, Sayad tracking and commercial notes'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* 1. Type Selector (Inward vs Outward) [APP_THEME_BUTTON] */}
          {!chequeToEdit && (
            <div className="p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-2 gap-1.5 shadow-inner">
              <button
                type="button"
                onClick={() => setType('inward')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                  type === 'inward'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 font-black'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-200" />
                <span>{lang === 'fa' ? 'چک دریافتی / اسناد دریافتنی (ورودی)' : lang === 'ku' ? 'چەکی وەرگیراو (هاتوو)' : 'Inward Cheque (Receivable)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setType('outward')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                  type === 'outward'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-black'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-blue-200" />
                <span>{lang === 'fa' ? 'چک صادره کارگاه / اسناد پرداختنی (خروجی)' : lang === 'ku' ? 'چەکی دەرکراو (ڕۆشتوو)' : 'Outward Cheque (Payable)'}</span>
              </button>
            </div>
          )}

          {/* Outward Workshop Account / Chequebook Selector */}
          {type === 'outward' && (
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{lang === 'fa' ? 'حساب جاری بانکی صادرکننده کارگاه:' : lang === 'ku' ? 'هەژماری بانکی دەرکەر:' : 'Workshop Bank Account:'}</span>
                </span>
                {chequebooks.length > 0 && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{chequebooks.length} دسته‌چک فعال</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    {lang === 'fa' ? 'حساب بانکی کارگاه:' : lang === 'ku' ? 'هەژماری بانک:' : 'Bank Account:'}
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => handleBankAccountChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  >
                    <option value="">{lang === 'fa' ? '--- انتخاب حساب بانکی ---' : lang === 'ku' ? 'دیاریکردنی هەژمار' : 'Select Bank Account'}</option>
                    {bankAccountsOnly.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} {acc.bankName ? `(${acc.bankName})` : ''} {acc.accountNumber ? `- ${acc.accountNumber}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {chequebooks.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      {lang === 'fa' ? 'انتخاب از دسته‌چک ثبت‌شده:' : lang === 'ku' ? 'دیاریکردن لە دەفتەرچەک:' : 'Select Chequebook:'}
                    </label>
                    <select
                      value={selectedChequebookId}
                      onChange={(e) => handleChequebookSelect(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                    >
                      <option value="">{lang === 'fa' ? '--- بدون انتساب یا ثبت آزاد ---' : lang === 'ku' ? 'تۆماری ئازاد' : 'Free Entry / Unlinked'}</option>
                      {chequebooks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - برگ {b.usedLeaves + 1} از {b.totalLeaves} (سریال: {b.startSerial + b.usedLeaves})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. Amount & Words Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span>{lang === 'fa' ? 'مبلغ برگه چک' : lang === 'ku' ? 'بڕی چەک' : 'Cheque Amount'}</span>
                <span className="text-rose-500 font-black">*</span>
              </label>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 font-mono">
                {currency}
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="مثال: ۲۵,۰۰۰,۰۰۰"
                className="w-full px-4 py-3 rounded-xl text-lg sm:text-2xl font-black font-mono bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-100 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-center"
              />
            </div>

            {rawNumericAmount > 0 && (
              <div className="pt-1 text-center text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed">
                {numberToWords(rawNumericAmount, currency, lang)}
              </div>
            )}
          </div>

          {/* 3. Essential Banking Numbers: Cheque No, Sayad ID, National ID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>{lang === 'fa' ? 'شماره سریال برگه چک' : lang === 'ku' ? 'ژمارەی چەک' : 'Cheque Serial No'}</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="مثال: ۷۴۸۲۹۱"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{lang === 'fa' ? 'شناسه صیادی (۱۶ رقم)' : lang === 'ku' ? 'کۆدی سەروەت/سەیاد' : '16-Digit Sayad ID'}</span>
              </label>
              <input
                type="text"
                value={sayadNumber}
                maxLength={20}
                onChange={(e) => setSayadNumber(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 tracking-wider"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{type === 'inward' 
                  ? (lang === 'fa' ? 'کد ملی صادرکننده' : lang === 'ku' ? 'کۆدی نەتەوەیی دەرکەر' : 'Drawer National ID')
                  : (lang === 'fa' ? 'کد ملی گیرنده در وجه' : lang === 'ku' ? 'کۆدی نەتەوەیی وەرگر' : 'Payee National ID')}
                </span>
              </label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="۱۰ یا ۱۱ رقم"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* 4. Parties: Counterparty, Drawer, Payee, Bank Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>{lang === 'fa' ? 'انتساب به طرف‌حساب کارگاه:' : lang === 'ku' ? 'لایەنی پەیوەندیدار:' : 'Linked Counterparty:'}</span>
              </label>
              <select
                value={counterpartyId}
                onChange={(e) => handleCounterpartyChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="">{lang === 'fa' ? '--- بدون انتخاب یا متفرقه ---' : lang === 'ku' ? 'بێ دیاریکردن' : 'None / Miscellaneous'}</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name} {cp.phone ? `(${cp.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {type === 'inward' 
                  ? (lang === 'fa' ? 'نام صادرکننده / صاحب حساب چک:' : lang === 'ku' ? 'ناوی دەرکەری چەک:' : 'Drawer Name:')
                  : (lang === 'fa' ? 'در وجه / نام ذینفع:' : lang === 'ku' ? 'لە ڕووی / ناوی وەرگر:' : 'Payee Name:')}
              </label>
              <input
                type="text"
                value={type === 'inward' ? drawerName : payeeName}
                onChange={(e) => type === 'inward' ? setDrawerName(e.target.value) : setPayeeName(e.target.value)}
                placeholder={type === 'inward' ? 'نام کامل صاحب چک...' : 'نام شخص یا شرکت دریافت‌کننده...'}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Bank Name & Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-slate-400" />
                <span>{lang === 'fa' ? 'بانک صادرکننده برگه چک:' : lang === 'ku' ? 'بانکی دەرکەر:' : 'Bank Name:'}</span>
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="مثال: بانک ملت، تجارت، کشاورزی..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {lang === 'fa' ? 'شعبه بانک (اختیاری):' : lang === 'ku' ? 'لقی بانک:' : 'Branch Name:'}
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="مثال: شعبه مرکزی یا کد شعبه"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* 5. Dates: Issue Date vs Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{lang === 'fa' ? 'تاریخ صدور / تحویل برگه چک:' : lang === 'ku' ? 'بەرواری دەرکردن:' : 'Issue Date:'}</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                <span>{lang === 'fa' ? 'تاریخ سررسید چک (موعد وصول):' : lang === 'ku' ? 'بەرواری بەسەرچوون (وصول):' : 'Due Date (Maturity):'}</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-rose-50/50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* 6. Purpose (بابت) with Quick Chips */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>{lang === 'fa' ? 'بابت / شرح علت صدور یا دریافت چک:' : lang === 'ku' ? 'بۆ چییە / هۆکار:' : 'Purpose / Transaction For:'}</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="مثال: پیش‌پرداخت خرید آهن‌آلات فاز دوم..."
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {quickPurposes.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPurpose(qp)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-800 transition-all border border-slate-200/80 dark:border-slate-700"
                >
                  + {qp}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Bank Tracking Code & Bank Document Number (برای مغایرت‌گیری بانکی) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-sky-500" />
              <span>{lang === 'fa' ? 'اطلاعات تطبیق و مغایرت‌گیری بانکی (در صورت انجام تراکنش):' : lang === 'ku' ? 'زانیاری ووردبینی بانکی:' : 'Bank Reconciliation & Slip Reference:'}</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'fa' ? 'کد رهگیری بانکی (RRN / Tracking Code):' : lang === 'ku' ? 'کۆدی بەدواداچوونی بانکی:' : 'Bank Tracking Code:'}
                </label>
                <input
                  type="text"
                  value={bankTrackingCode}
                  onChange={(e) => setBankTrackingCode(e.target.value)}
                  placeholder="اختیاری (مثال: ۸۴۹۲۳۱۰)"
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'fa' ? 'شماره سند بانکی / شماره فیش صورت‌حساب:' : lang === 'ku' ? 'ژمارەی پسووڵەی بانک:' : 'Bank Slip / Document No:'}
                </label>
                <input
                  type="text"
                  value={bankDocumentNumber}
                  onChange={(e) => setBankDocumentNumber(e.target.value)}
                  placeholder="اختیاری (مثال: DOC-4921)"
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* 8. Attachment of Cheque Photo */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span>{lang === 'fa' ? 'پیوست تصویر برگه چک (اسکن یا عکس)' : lang === 'ku' ? 'وێنەی چەک' : 'Cheque Image Attachment'}</span>
              </span>
              {attachmentUrl && (
                <button
                  type="button"
                  onClick={() => setAttachmentUrl('')}
                  className="text-[11px] text-rose-500 hover:underline"
                >
                  {lang === 'fa' ? 'حذف تصویر' : lang === 'ku' ? 'سڕینەوەی وێنە' : 'Remove Image'}
                </button>
              )}
            </label>

            {attachmentUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 h-36 bg-slate-100 dark:bg-slate-800">
                <img
                  src={attachmentUrl}
                  alt="Cheque preview"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-amber-400 rounded-2xl cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-colors">
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {lang === 'fa' ? 'جهت بارگذاری تصویر چک کلیک کنید' : lang === 'ku' ? 'وێنەی چەک دابنێ' : 'Click to upload cheque image'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP (حداکثر ۵ مگابایت)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* 9. Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {lang === 'fa' ? 'توضیحات و یادداشت تکمیلی:' : lang === 'ku' ? 'تێبینی زیاتر:' : 'Additional Notes:'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="توضیحات پیرامون نحوه تحویل، ظهرنویسی یا توافقات..."
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

        </form>

        {/* Sticky Glass Bottom Dock */}
        <div className="px-6 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            {t('cancel')}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-2xl text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition-all shadow-md shadow-amber-600/25 active:scale-95 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting
                ? (lang === 'fa' ? 'در حال ثبت...' : lang === 'ku' ? 'تۆمارکردن...' : 'Saving...')
                : chequeToEdit
                ? (lang === 'fa' ? 'ذخیره تغییرات چک' : lang === 'ku' ? 'پاشەکەوتکردنی گۆڕانکاری' : 'Save Changes')
                : (lang === 'fa' ? 'ثبت نهایی برگه چک' : lang === 'ku' ? 'تۆمارکردنی کۆتایی' : 'Confirm & Save Cheque')}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
