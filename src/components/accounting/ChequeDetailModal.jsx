import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { clearCheque, bounceCheque, endorseCheque, voidCheque, deleteCheque } from '../../services/chequeService';
import { formatCurrency, formatAmount, numberToWords, getTodayDateString } from '../../utils/formatters';
import {
  X,
  Receipt,
  CreditCard,
  Building,
  User,
  Calendar,
  DollarSign,
  Hash,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Trash2,
  Clock,
  Landmark,
  FileCheck2,
  ExternalLink,
  ShieldCheck,
  Ban,
  Share2
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export function ChequeDetailModal({
  isOpen,
  onClose,
  cheque = null,
  currency = 'IQD',
  language: propLanguage,
  onEdit = null
}) {
  const { t, language: ctxLang, direction } = useLanguage();
  const lang = propLanguage || ctxLang || 'fa';
  const { user } = useAuth();
  const isRtl = direction === 'rtl';

  const [activeAction, setActiveAction] = useState(null); // 'clear' | 'bounce' | 'endorse' | 'void' | null
  const [clearedAccountId, setClearedAccountId] = useState('');
  const [clearedDate, setClearedDate] = useState(getTodayDateString());
  const [bankTrackingCode, setBankTrackingCode] = useState('');
  const [bankDocumentNumber, setBankDocumentNumber] = useState('');
  const [bouncedReason, setBouncedReason] = useState('عدم موجودی کافی در حساب');
  const [bouncedDate, setBouncedDate] = useState(getTodayDateString());
  const [endorsedToCounterpartyId, setEndorsedToCounterpartyId] = useState('');
  const [endorsedDate, setEndorsedDate] = useState(getTodayDateString());
  const [endorsedNotes, setEndorsedNotes] = useState('');
  const [voidReason, setVoidReason] = useState('اشتباه در صدور یا ابطال توافقی');

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch accounts and counterparties
  const financialAccounts = useLiveQuery(
    async () => {
      if (!db.financialAccounts) return [];
      const list = await db.financialAccounts.toArray();
      return list.filter((a) => !a.deletedAt && a.isActive);
    },
    []
  ) || [];

  const counterparties = useLiveQuery(
    async () => {
      if (!db.counterparties) return [];
      const list = await db.counterparties.toArray();
      return list.filter((cp) => !cp.deletedAt);
    },
    []
  ) || [];

  if (!isOpen || !cheque) return null;

  const isOutward = cheque.type === 'outward';
  const isPending = cheque.status === 'in_hand' || cheque.status === 'issued' || cheque.status === 'in_clearing';
  const isCleared = cheque.status === 'cleared';
  const isBounced = cheque.status === 'bounced';
  const isEndorsed = cheque.status === 'endorsed';
  const isVoid = cheque.status === 'void';

  const getStatusBadge = () => {
    if (isCleared) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{lang === 'fa' ? 'وصول‌شده (پاس‌شده در بانک)' : lang === 'ku' ? 'پاکتاوکراو (وصول)' : 'Cleared / Paid'}</span>
        </span>
      );
    }
    if (isBounced) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{lang === 'fa' ? 'برگشت‌خورده (عدم پرداخت)' : lang === 'ku' ? 'گەڕاوە (برگشتی)' : 'Bounced / Dishonored'}</span>
        </span>
      );
    }
    if (isEndorsed) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" />
          <span>{lang === 'fa' ? 'واگذارشده به غیر (خرج‌شده)' : lang === 'ku' ? 'دراو بە کەسی تر' : 'Endorsed'}</span>
        </span>
      );
    }
    if (isVoid) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 flex items-center gap-1.5">
          <Ban className="w-3.5 h-3.5" />
          <span>{lang === 'fa' ? 'باطل‌شده' : lang === 'ku' ? 'هەڵوەشاوە' : 'Void / Cancelled'}</span>
        </span>
      );
    }
    // Pending
    return (
      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
        <Clock className="w-3.5 h-3.5" />
        <span>{isOutward 
          ? (lang === 'fa' ? 'صادرشده (در انتظار پاس شدن)' : lang === 'ku' ? 'دەرکراو (چاوەڕوان)' : 'Issued (Awaiting Clearance)')
          : (lang === 'fa' ? 'نزد صندوق (در جریان وصول)' : lang === 'ku' ? 'لە سندوقدا' : 'In Hand (Pending)')}
        </span>
      </span>
    );
  };

  const handleExecuteAction = async () => {
    setIsProcessing(true);
    setErrorMsg('');

    try {
      if (activeAction === 'clear') {
        const accId = clearedAccountId || cheque.bankAccountId || (financialAccounts[0]?.id || '');
        await clearCheque(cheque.id, {
          clearedDate,
          clearedAccountId: accId,
          bankTrackingCode,
          bankDocumentNumber
        }, user);
      } else if (activeAction === 'bounce') {
        await bounceCheque(cheque.id, {
          bouncedDate,
          bouncedReason
        }, user);
      } else if (activeAction === 'endorse') {
        const cp = counterparties.find((c) => String(c.id) === String(endorsedToCounterpartyId));
        await endorseCheque(cheque.id, {
          endorsedToCounterpartyId,
          endorsedToName: cp?.name || '',
          endorsedDate,
          notes: endorsedNotes
        }, user);
      } else if (activeAction === 'void') {
        await voidCheque(cheque.id, {
          voidDate: getTodayDateString(),
          voidReason
        }, user);
      }

      setActiveAction(null);
      onClose();
    } catch (err) {
      console.error('[ChequeDetailModal] Action failed:', err);
      setErrorMsg(err.message || 'خطا در ثبت تغییر وضعیت چک');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(lang === 'fa' ? 'آیا از حذف این برگه چک اطمینان دارید؟' : lang === 'ku' ? 'دڵنیایت لە سڕینەوە؟' : 'Are you sure you want to delete this cheque?')) {
      await deleteCheque(cheque.id);
      onClose();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-md animate-in fade-in duration-200"
      dir={direction}
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center flex-shrink-0 shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {lang === 'fa' ? 'شناسنامه برگه چک' : lang === 'ku' ? 'وردەکاری چەک' : 'Cheque Voucher Slip'}
                </h3>
                {cheque.voucherNumber && (
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/20">
                    {cheque.voucherNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                {isOutward ? 'OUTWARD PAYABLE' : 'INWARD RECEIVABLE'} • {cheque.issueDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="چاپ رسید"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Status & Amount Hero Banner */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 dark:from-slate-800/80 dark:via-slate-900 dark:to-slate-800/40 border border-amber-200/80 dark:border-amber-900/40 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isOutward ? (lang === 'fa' ? 'مبلغ چک صادره کارگاه' : lang === 'ku' ? 'بڕی چەکی دەرکراو' : 'Payable Amount') : (lang === 'fa' ? 'مبلغ چک دریافتی' : lang === 'ku' ? 'بڕی چەکی وەرگیراو' : 'Receivable Amount')}
              </span>
              {getStatusBadge()}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black font-mono text-slate-900 dark:text-white" dir="ltr">
                {formatAmount(cheque.amount, currency)}
              </span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400 font-sans">
                {currency}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
              {numberToWords(cheque.amount, currency, lang)}
            </div>
          </div>

          {/* Visual Sayad Cheque Layout Graphic */}
          <div className="p-5 rounded-3xl bg-slate-50/90 dark:bg-slate-800/60 border-2 border-dashed border-amber-300 dark:border-amber-800/70 space-y-3.5 relative">
            <div className="flex items-center justify-between text-xs border-b border-slate-200 dark:border-slate-700/80 pb-2">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-600" />
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {cheque.bankName || 'بانک مرکزی / صیاد'} {cheque.branchName ? `(${cheque.branchName})` : ''}
                </span>
              </div>
              <div className="font-mono font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                {lang === 'fa' ? 'سریال:' : lang === 'ku' ? 'زنجیرە:' : 'Serial:'} <strong className="text-amber-600 dark:text-amber-400">{cheque.chequeNumber}</strong>
              </div>
            </div>

            {/* Sayad ID Bar */}
            {cheque.sayadNumber && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs font-mono">
                <span className="text-[11px] text-slate-400 font-sans font-bold">شناسه ۱۶ رقمی صیاد:</span>
                <span className="font-black text-slate-900 dark:text-white tracking-widest text-xs">
                  {cheque.sayadNumber}
                </span>
              </div>
            )}

            {/* Due Date & Payee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-bold mb-0.5">
                  {lang === 'fa' ? 'تاریخ سررسید چک:' : lang === 'ku' ? 'بەرواری بەسەرچوون:' : 'Due Date:'}
                </span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                  {cheque.dueDate}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-bold mb-0.5">
                  {isOutward ? 'در وجه (ذینفع):' : 'صادرکننده برگه چک:'}
                </span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">
                  {isOutward ? (cheque.payeeName || 'در وجه حامل / ذینفع') : (cheque.drawerName || 'نامشخص')}
                </span>
              </div>
            </div>

            {/* National ID & Purpose */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {cheque.nationalId && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 font-mono">
                  <span className="text-[10px] text-slate-400 block font-sans font-bold mb-0.5">
                    کد ملی / شناسه ملی:
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {cheque.nationalId}
                  </span>
                </div>
              )}

              {cheque.purpose && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-bold mb-0.5">
                    بابت / شرح:
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {cheque.purpose}
                  </span>
                </div>
              )}
            </div>

            {/* Bank Tracking Code & Document Number */}
            {(cheque.bankTrackingCode || cheque.bankDocumentNumber) && (
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 text-xs flex items-center justify-between gap-3 flex-wrap">
                {cheque.bankTrackingCode && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">کد رهگیری بانکی:</span>
                    <span className="font-mono font-bold text-sky-700 dark:text-sky-300">{cheque.bankTrackingCode}</span>
                  </div>
                )}
                {cheque.bankDocumentNumber && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">شماره سند بانکی:</span>
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">{cheque.bankDocumentNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cheque Photo Attachment */}
          {cheque.attachmentUrl && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                تصویر اسکن‌شده یا عکس برگه چک:
              </span>
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 h-44 bg-slate-100 dark:bg-slate-800">
                <img
                  src={cheque.attachmentUrl}
                  alt="Cheque photo"
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={() => window.open(cheque.attachmentUrl, '_blank')}
                />
              </div>
            </div>
          )}

          {/* Action Trigger Forms */}
          {activeAction === 'clear' && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>ثبت وصول قطعی برگه چک در بانک</span>
                </span>
                <button type="button" onClick={() => setActiveAction(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    حساب بانکی یا صندوق مقصد واریز:
                  </label>
                  <select
                    value={clearedAccountId}
                    onChange={(e) => setClearedAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    {financialAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type === 'bank' ? 'بانک' : 'صندوق'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاریخ وصول در بانک:
                  </label>
                  <input
                    type="date"
                    value={clearedDate}
                    onChange={(e) => setClearedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    کد رهگیری تراکنش بانکی (اختیاری):
                  </label>
                  <input
                    type="text"
                    value={bankTrackingCode}
                    onChange={(e) => setBankTrackingCode(e.target.value)}
                    placeholder="کد پیگیری شتاب / پایا..."
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    شماره سند بانکی / شماره فیش (اختیاری):
                  </label>
                  <input
                    type="text"
                    value={bankDocumentNumber}
                    onChange={(e) => setBankDocumentNumber(e.target.value)}
                    placeholder="شماره سند درج‌شده در پرینت بانک..."
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تایید وصول و نشست پول به حساب</span>
                </button>
              </div>
            </div>
          )}

          {activeAction === 'bounce' && (
            <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-200">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>ثبت برگشت برگه چک</span>
                </span>
                <button type="button" onClick={() => setActiveAction(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاریخ برگشت چک:
                  </label>
                  <input
                    type="date"
                    value={bouncedDate}
                    onChange={(e) => setBouncedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    علت برگشت:
                  </label>
                  <input
                    type="text"
                    value={bouncedReason}
                    onChange={(e) => setBouncedReason(e.target.value)}
                    placeholder="عدم موجودی کافی، نقص امضا..."
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/25 active:scale-95 flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>ثبت قطعی برگشت چک</span>
                </button>
              </div>
            </div>
          )}

          {activeAction === 'endorse' && (
            <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-purple-900 dark:text-purple-200">
                <span className="flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-purple-600" />
                  <span>واگذاری یا خرج کردن چک به طرف‌حساب دیگر</span>
                </span>
                <button type="button" onClick={() => setActiveAction(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    طرف‌حساب دریافت‌کننده (خرج‌شده برای):
                  </label>
                  <select
                    value={endorsedToCounterpartyId}
                    onChange={(e) => setEndorsedToCounterpartyId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="">--- انتخاب طرف‌حساب ---</option>
                    {counterparties.map((cp) => (
                      <option key={cp.id} value={cp.id}>{cp.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاریخ واگذاری:
                  </label>
                  <input
                    type="date"
                    value={endorsedDate}
                    onChange={(e) => setEndorsedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  یادداشت واگذاری (بابت):
                </label>
                <input
                  type="text"
                  value={endorsedNotes}
                  onChange={(e) => setEndorsedNotes(e.target.value)}
                  placeholder="مثال: تسویه فاکتور خرید سیمان..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 active:scale-95 flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>ثبت واگذاری چک</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Sticky Glass Bottom Dock */}
        <div className="px-6 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="p-2.5 rounded-2xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all text-xs flex items-center gap-1.5"
              title="حذف چک"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">حذف چک</span>
            </button>

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(cheque);
                }}
                className="px-3 py-2 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all"
              >
                ویرایش
              </button>
            )}
          </div>

          {/* Status Action Buttons Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {isPending && (
              <>
                {!isOutward && (
                  <button
                    type="button"
                    onClick={() => setActiveAction(activeAction === 'endorse' ? null : 'endorse')}
                    className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>خرج به غیر</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'bounce' ? null : 'bounce')}
                  className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>ثبت برگشت</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'clear' ? null : 'clear')}
                  className="px-4 py-2 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isOutward ? 'پاس شد (بانک)' : 'وصول شد'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              {t('close')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
