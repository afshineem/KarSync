import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { useAuth, usePermissions } from '../../context/AuthContext';
import { db } from '../../db/db';
import { formatAmount, formatCurrency, getCurrencySymbol, getTodayDateString } from '../../utils/formatters';
import { numberToWords } from '../../utils/numberToWords';
import { promoteVoucherToPermanent } from '../../services/voucherNumberService';
import { pushPaymentsLive, pushLoansLive, pushTreasuryIncomeLive, pushAllExpensesToCloud } from '../../services/realtimeSync';
import { 
  FileText, 
  X, 
  Printer, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Landmark, 
  Wallet, 
  User, 
  Calendar, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Receipt, 
  Coins, 
  Building2, 
  Hash, 
  Check, 
  AlertCircle,
  Eye,
  Download
} from 'lucide-react';

const COPY = {
  fa: {
    modalTitle: 'برگه رسمی سند مالی',
    modalSubtitle: 'سند معتبر حسابداری و خزانه‌داری کارگاه طبق اساسنامه',
    voucherNoLabel: 'شماره سند:',
    draftBadge: 'سند موقت (پیش‌نویس)',
    approvedBadge: 'سند دائم و قطعی',
    dateLabel: 'تاریخ ثبت سند:',
    timeLabel: 'ساعت:',
    amountCardTitle: 'مبلغ کل سند مالی',
    amountInWordsLabel: 'مبلغ به حروف:',
    debitTitle: 'طرف بدهکار (مصارف / گیرنده وجه):',
    creditTitle: 'طرف بستانکار (منبع پرداخت / صندوق):',
    txDetailsTitle: 'مشخصات و شرح سند',
    txTitleLabel: 'عنوان سند:',
    descriptionLabel: 'شرح و بابت:',
    sourceAccountTitle: 'منبع مالی / حساب بانکی و صندوق',
    accountNameLabel: 'نام حساب / کارت:',
    accountTypeLabel: 'نوع حساب:',
    cashType: 'صندوق نقدی',
    bankType: 'کارت / حساب بانکی',
    counterpartyTitle: 'طرف‌حساب / پرسنل',
    partyNameLabel: 'نام شخص یا شرکت:',
    partyRoleLabel: 'سمت یا ارتباط:',
    staffRole: 'پرسنل کارگاه',
    vendorRole: 'فروشنده / پیمانکار',
    funderRole: 'کارفرما / سرمایه‌گذار',
    approvalAuditTitle: 'وضعیت تایید و چرخه سند',
    registeredByLabel: 'ثبت‌کننده اولیه:',
    approvedByLabel: 'تاییدکننده نهایی:',
    pendingApprovalMsg: 'این سند در وضعیت پیش‌نویس (موقت) است و منتظر بررسی و تایید نهایی مدیر می‌باشد.',
    approveBtn: 'تایید نهایی و تبدیل به سند دائم',
    approving: 'در حال ثبت تایید...',
    printBtn: 'چاپ فیش سند (A5/A4)',
    closeBtn: 'بستن (ESC)',
    receiptImageTitle: 'پیوست تصویر فاکتور / رسید پرداخت',
    preparedBySign: 'امضای تنظیم‌کننده / حسابدار',
    receiverSign: 'امضای دریافت‌کننده وجه',
    managerSign: 'امضای تاییدکننده / مدیر کارگاه',
    workshopOfficialSeal: 'محل مهر و تایید کارگاه',
    loadingVoucher: 'در حال بارگذاری اطلاعات سند مالی...',
    voucherNotFound: 'سند مالی با این مشخصات یافت نشد.',
    categoryLabel: 'سرفصل هزینه / نوع سند:',
    outflowType: 'برداشت از صندوق / کارت (-)',
    inflowType: 'واریز به صندوق / کارت (+)',
    transferType: 'انتقال بین حساب‌ها'
  },
  ku: {
    modalTitle: 'فۆڕمی فەرمی بەڵگەنامەی دارایی',
    modalSubtitle: 'بەڵگەنامەی باوەڕپێکراوی حیسابداری و خەزێنەی کارگە',
    voucherNoLabel: 'ژمارەی بەڵگەنامە:',
    draftBadge: 'بەڵگەنامەی کاتی (ڕەشنووس)',
    approvedBadge: 'بەڵگەنامەی هەمیشەیی و کۆتایی',
    dateLabel: 'بەرواری تۆمار:',
    timeLabel: 'کاتژمێر:',
    amountCardTitle: 'کۆی گشتی بڕی دارایی',
    amountInWordsLabel: 'بڕ بە پیت:',
    debitTitle: 'لایەنی قەرزدار (خەرجی / وەرگر):',
    creditTitle: 'لایەنی خاوەن قەرز (سەرچاوەی پارە):',
    txDetailsTitle: 'وردەکاری و ڕوونکردنەوەی بەڵگەنامە',
    txTitleLabel: 'بابەتی بەڵگەنامە:',
    descriptionLabel: 'تێبینی و هۆکار:',
    sourceAccountTitle: 'سەرچاوەی دارایی / سندوق و کارت',
    accountNameLabel: 'ناوی حیساب / کارت:',
    accountTypeLabel: 'جۆری حیساب:',
    cashType: 'سندوقی نەختینە',
    bankType: 'کارتی بانکی',
    counterpartyTitle: 'لایەنی بەرامبەر / کارمەند',
    partyNameLabel: 'ناوی کەس یان کۆمپانیا:',
    partyRoleLabel: 'پێگە:',
    staffRole: 'کارمەندی کارگە',
    vendorRole: 'فرۆشیار / بەڵێندەر',
    funderRole: 'خاوەنکار / وەبەرهێنەر',
    approvalAuditTitle: 'دۆخی پەسەندکردن',
    registeredByLabel: 'تۆمارکەر:',
    approvedByLabel: 'پەسەندکەری کۆتایی:',
    pendingApprovalMsg: 'ئەم بەڵگەنامەیە لە دۆخی ڕەشنووسدایە و چاوەڕوانی پەسەندکردنی بەڕێوەبەرە.',
    approveBtn: 'پەسەندکردنی کۆتایی و گۆڕین بۆ هەمیشەیی',
    approving: 'لە پەسەندکردندایە...',
    printBtn: 'چاپکردنی بەڵگەنامە',
    closeBtn: 'داخستن (ESC)',
    receiptImageTitle: 'وێنەی فاکتۆر یان پسوولەی پارەدان',
    preparedBySign: 'واژۆی ڕێکخەر / حیسابدار',
    receiverSign: 'واژۆی وەرگری پارە',
    managerSign: 'واژۆی بەڕێوەبەری پڕۆژە',
    workshopOfficialSeal: 'شوێنی مۆری فەرمی',
    loadingVoucher: 'بارکردنی زانیاری بەڵگەنامە...',
    voucherNotFound: 'هیچ بەڵگەنامەیەک نەدۆزرایەوە.',
    categoryLabel: 'جۆری بەڵگەنامە:',
    outflowType: 'پارەدەرچوون لە سندوق (-)',
    inflowType: 'پارەهاتنەناو بۆ سندوق (+)',
    transferType: 'گواستنەوەی نێوان حیسابەکان'
  },
  en: {
    modalTitle: 'Official Financial Voucher Slip',
    modalSubtitle: 'Verified Treasury & Accounting Voucher per Workshop Charter',
    voucherNoLabel: 'Voucher No:',
    draftBadge: 'Temporary Draft Voucher',
    approvedBadge: 'Permanent Official Voucher',
    dateLabel: 'Voucher Date:',
    timeLabel: 'Time:',
    amountCardTitle: 'Total Voucher Amount',
    amountInWordsLabel: 'Amount in Words:',
    debitTitle: 'Debit Account (Beneficiary / Purpose):',
    creditTitle: 'Credit Account (Source / Cashbox / Bank):',
    txDetailsTitle: 'Voucher Specifications & Notes',
    txTitleLabel: 'Title / Subject:',
    descriptionLabel: 'Description & Reason:',
    sourceAccountTitle: 'Source Account / Cashbox & Bank Card',
    accountNameLabel: 'Account Name:',
    accountTypeLabel: 'Account Type:',
    cashType: 'Cash Desk',
    bankType: 'Bank Card / Account',
    counterpartyTitle: 'Counterparty / Beneficiary',
    partyNameLabel: 'Person or Entity:',
    partyRoleLabel: 'Role / Designation:',
    staffRole: 'Workshop Staff',
    vendorRole: 'Vendor / Contractor',
    funderRole: 'Employer / Investor',
    approvalAuditTitle: 'Audit Trail & Approval Status',
    registeredByLabel: 'Prepared By:',
    approvedByLabel: 'Final Approved By:',
    pendingApprovalMsg: 'This voucher is currently in draft status and pending final managerial approval.',
    approveBtn: 'Approve & Promote to Permanent',
    approving: 'Approving...',
    printBtn: 'Print Voucher (A5/A4)',
    closeBtn: 'Close (ESC)',
    receiptImageTitle: 'Attached Receipt / Invoice Photo',
    preparedBySign: 'Prepared By (Accountant)',
    receiverSign: 'Received By (Payee)',
    managerSign: 'Approved By (Manager)',
    workshopOfficialSeal: 'Official Seal',
    loadingVoucher: 'Loading financial voucher details...',
    voucherNotFound: 'Voucher not found.',
    categoryLabel: 'Category / Type:',
    outflowType: 'Outflow from Cashbox/Card (-)',
    inflowType: 'Inflow to Cashbox/Card (+)',
    transferType: 'Account-to-Account Transfer'
  }
};

export function VoucherDetailModal({
  isOpen,
  onClose,
  voucher = null,
  voucherNumber = null
}) {
  const { language, direction } = useLanguage();
  const c = COPY[language] || COPY.fa;
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const [activeItem, setActiveItem] = useState(voucher);
  const [loading, setLoading] = useState(!voucher && Boolean(voucherNumber));
  const [approving, setApproving] = useState(false);
  const printRef = useRef(null);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // If passed directly via prop
  useEffect(() => {
    if (voucher) {
      setActiveItem(voucher);
      setLoading(false);
    }
  }, [voucher]);

  // Resolve voucher by voucherNumber from Dexie if not passed as an object
  useEffect(() => {
    if (!voucher && voucherNumber && isOpen) {
      setLoading(true);
      (async () => {
        try {
          const findInTable = async (table, tableName) => {
            if (!table) return null;
            const res = await table.where('voucherNumber').equals(voucherNumber).first();
            if (res) return { ...res, tableName };
            return null;
          };

          let found = await findInTable(db.payments, 'payments');
          if (!found) found = await findInTable(db.expenses, 'expenses');
          if (!found) found = await findInTable(db.loans, 'loans');
          if (!found) found = await findInTable(db.treasuryIncomes, 'treasuryIncomes');
          if (!found) found = await findInTable(db.accountTransfers, 'accountTransfers');

          setActiveItem(found);
        } catch (err) {
          console.warn('[VoucherDetailModal] Error finding voucher:', err);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [voucher, voucherNumber, isOpen]);

  // Normalized Voucher Attributes
  const itemData = useMemo(() => {
    if (!activeItem) return null;

    const raw = activeItem.rawItem || activeItem;
    const vNo = activeItem.voucherNumber || raw.voucherNumber || '—';
    const isDraft = vNo.startsWith('T-') || vNo.startsWith('t-') || (activeItem.status !== 'approved' && activeItem.approval_status !== 'approved');

    const date = activeItem.rawDate || activeItem.date || raw.date || raw.expenseDate || (raw.createdAt ? raw.createdAt.slice(0, 10) : getTodayDateString());
    const time = activeItem.time || raw.time || (raw.createdAt ? raw.createdAt.slice(11, 16) : '');
    const amount = Number(activeItem.amount ?? raw.amount ?? raw.principalAmount) || 0;

    let type = activeItem.type || (activeItem.inflowAmount ? 'inflow' : 'outflow');
    if (raw.type === 'loan_disbursement') type = 'outflow';

    const title = activeItem.title || raw.title || raw.notes || 'سند مالی';
    const description = activeItem.description || raw.description || raw.notes || '';
    const counterpartyName = activeItem.personName || raw.personName || raw.workerName || raw.payeeName || raw.payer || '—';
    const accountName = activeItem.accountName || raw.accountName || raw.sourceAccountName || 'صندوق کارگاه';
    const accountType = activeItem.accountType || raw.accountType || 'cash';
    const categoryLabel = activeItem.categoryLabel || raw.categoryLabel || (type === 'inflow' ? c.inflowType : c.outflowType);

    const receiptPhoto = raw.receiptPhoto || raw.receiptImage || raw.photo || null;

    const registeredBy = raw.created_by || raw.userId || 'کاربر سیستم';
    const approvedBy = activeItem.approvedBy || raw.approved_by || raw.approvedBy || null;
    const approvedAt = activeItem.approvedAt || raw.approved_at || raw.approvedAt || null;

    return {
      raw,
      voucherNumber: vNo,
      isDraft,
      date,
      time,
      amount,
      type,
      title,
      description,
      counterpartyName,
      accountName,
      accountType,
      categoryLabel,
      receiptPhoto,
      registeredBy,
      approvedBy,
      approvedAt
    };
  }, [activeItem, c]);

  // Handle final approval / promotion to permanent voucher
  const handleApproveVoucher = async () => {
    if (!itemData || approving) return;
    setApproving(true);
    try {
      const nextVoucher = await promoteVoucherToPermanent(itemData.voucherNumber, itemData.date);
      const nowIso = new Date().toISOString();
      const approverName = user?.username || user?.name || 'مدیر مالی کارگاه';

      const updatePayload = {
        voucherNumber: nextVoucher,
        status: 'approved',
        approval_status: 'approved',
        approved_by: approverName,
        approved_by_id: user?.id || null,
        approved_at: nowIso,
        approvedAt: nowIso,
        updatedAt: nowIso
      };

      const tableName = activeItem.tableName || (
        activeItem.type === 'inflow' ? 'treasuryIncomes' : 
        activeItem.category === 'workshop_expense' ? 'expenses' : 'payments'
      );

      const targetTable = db[tableName];
      if (targetTable && activeItem.id) {
        const idToUpdate = activeItem.id.replace('_out', '').replace('_in', '');
        await targetTable.update(idToUpdate, updatePayload);
      }

      // Live push
      if (tableName === 'payments') pushPaymentsLive().catch(() => {});
      else if (tableName === 'expenses') pushAllExpensesToCloud().catch(() => {});
      else if (tableName === 'treasuryIncomes') pushTreasuryIncomeLive().catch(() => {});
      else if (tableName === 'loans') pushLoansLive().catch(() => {});

      setActiveItem((prev) => ({
        ...prev,
        ...updatePayload,
        voucherNumber: nextVoucher,
        status: 'approved',
        approvedBy: approverName,
        approvedAt: nowIso
      }));
    } catch (err) {
      console.error('[VoucherDetailModal] Approval error:', err);
    } finally {
      setApproving(false);
    }
  };

  // Trigger standard browser print with print-only styled container
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200">
      
      {/* Printable Wrapper */}
      <div 
        ref={printRef}
        className="w-full max-w-4xl bg-[#f3f6f4] dark:bg-slate-950 rounded-3xl sm:rounded-4xl shadow-2xl border border-white/60 dark:border-slate-800/80 overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300"
      >
        
        {/* ======================================================== */}
        {/* 1. APPLE LIQUID GLASS HEADER                            */}
        {/* ======================================================== */}
        <div className="p-5 sm:p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              itemData?.isDraft 
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-300/40' 
                : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-300/40'
            }`}>
              {itemData?.isDraft ? <Clock className="w-6 h-6 animate-pulse" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  {c.modalTitle}
                </h3>
                {itemData && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                    itemData.isDraft
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                  }`}>
                    {itemData.isDraft ? c.draftBadge : c.approvedBadge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {c.modalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {itemData && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs font-black">
                <span className="text-slate-400 text-[10px]">{c.voucherNoLabel}</span>
                <span className="text-sky-600 dark:text-sky-400 dir-ltr font-black text-sm">{itemData.voucherNumber}</span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer"
              title={c.closeBtn}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. BODY CONTENT (12-Column Responsive Grid)             */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Clock className="w-8 h-8 animate-spin text-sky-500" />
              <p className="text-sm font-bold">{c.loadingVoucher}</p>
            </div>
          ) : !itemData ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-sm font-bold">{c.voucherNotFound}</p>
            </div>
          ) : (
            <>
              {/* Draft Alert Banner */}
              {itemData.isDraft && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-300/80 dark:border-amber-700/60 flex items-start sm:items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 font-medium">
                    {c.pendingApprovalMsg}
                  </p>
                </div>
              )}

              {/* Main 12-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                
                {/* LEFT 7 COLUMNS: Primary Financial Figures & Purpose */}
                <div className="lg:col-span-7 space-y-4 sm:space-y-5">
                  
                  {/* Big Hero Amount Card */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-emerald-500" />
                        <span>{c.amountCardTitle}</span>
                      </span>
                      <span className="font-mono px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {itemData.categoryLabel}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                        {formatAmount(itemData.amount, currency)}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-sky-600 dark:text-sky-400">
                        {getCurrencySymbol(currency, language)}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-2">
                      <span className="text-xs text-slate-400 font-bold shrink-0">{c.amountInWordsLabel}</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                        {numberToWords(itemData.amount, currency, language)}
                      </span>
                    </div>
                  </div>

                  {/* Accounting Debit/Credit Breakdown */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3.5">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
                      <span>تراز دوبل حسابداری (طرفین سند)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Debit (بدهکار) */}
                      <div className="p-3.5 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-800/40">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>{c.debitTitle}</span>
                        </div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">
                          {itemData.type === 'inflow' ? itemData.accountName : itemData.counterpartyName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {itemData.title}
                        </p>
                      </div>

                      {/* Credit (بستانکار) */}
                      <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-800/40">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>{c.creditTitle}</span>
                        </div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">
                          {itemData.type === 'inflow' ? itemData.counterpartyName : itemData.accountName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {itemData.accountType === 'bank' ? c.bankType : c.cashType}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Title & Notes */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span>{c.txDetailsTitle}</span>
                      <span className="font-mono">{itemData.date} {itemData.time && `• ${itemData.time}`}</span>
                    </div>
                    <div>
                      <h5 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                        {itemData.title}
                      </h5>
                      {itemData.description && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                          {itemData.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Receipt Photo Preview if exists */}
                  {itemData.receiptPhoto && (
                    <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-sky-500" />
                        <span>{c.receiptImageTitle}</span>
                      </span>
                      <div className="max-h-60 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <img 
                          src={itemData.receiptPhoto} 
                          alt="Receipt Preview" 
                          className="max-h-60 w-auto object-contain"
                        />
                      </div>
                    </div>
                  )}

                </div>

                {/* RIGHT 5 COLUMNS: Counterparty, Source Account, Audit Trail */}
                <div className="lg:col-span-5 space-y-4 sm:space-y-5">
                  
                  {/* Voucher Card Header Info */}
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        {c.voucherNoLabel}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white/10 border border-white/10">
                        {itemData.isDraft ? 'DRAFT' : 'PERMANENT'}
                      </span>
                    </div>
                    <div className="text-2xl font-black font-mono tracking-wider dir-ltr text-left text-sky-300">
                      {itemData.voucherNumber}
                    </div>
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{itemData.date}</span>
                      </span>
                      {itemData.time && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{itemData.time}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Counterparty / Person Card */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-sky-500" />
                      <span>{c.counterpartyTitle}</span>
                    </span>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {itemData.counterpartyName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {itemData.categoryLabel}
                    </p>
                  </div>

                  {/* Source Financial Account Card */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{c.sourceAccountTitle}</span>
                    </span>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {itemData.accountName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>{c.accountTypeLabel}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {itemData.accountType === 'bank' ? c.bankType : c.cashType}
                      </span>
                    </div>
                  </div>

                  {/* Audit Trail & Approval */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800 shadow-sm space-y-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{c.approvalAuditTitle}</span>
                    </span>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-400">{c.registeredByLabel}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{itemData.registeredBy}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">{c.approvedByLabel}</span>
                        {itemData.approvedBy ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{itemData.approvedBy}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {c.draftBadge}
                          </span>
                        )}
                      </div>
                      {itemData.approvedAt && (
                        <div className="text-[10px] text-slate-400 text-left dir-ltr">
                          {itemData.approvedAt.slice(0, 16).replace('T', ' ')}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

              {/* Printable Official Slip Layout (Visible in print) */}
              <div className="hidden print:block p-8 border-2 border-slate-900 rounded-2xl bg-white text-slate-900 space-y-6 mt-8">
                <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black">کارگاه {currentProject?.name || 'کارگاه'}</h2>
                    <p className="text-sm font-bold mt-1">برگه رسمی سند حسابداری و خزانه‌داری</p>
                  </div>
                  <div className="text-left font-mono">
                    <p className="text-base font-black">شماره سند: {itemData.voucherNumber}</p>
                    <p className="text-xs">تاریخ: {itemData.date}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm font-medium">
                  <div><strong>طرف حساب:</strong> {itemData.counterpartyName}</div>
                  <div><strong>محل پرداخت / صندوق:</strong> {itemData.accountName}</div>
                  <div className="col-span-2"><strong>مبلغ سند:</strong> {formatCurrency(itemData.amount, currency, 'fa')} ({numberToWords(itemData.amount, currency, 'fa')})</div>
                  <div className="col-span-2"><strong>شرح سند:</strong> {itemData.title} {itemData.description ? ` - ${itemData.description}` : ''}</div>
                </div>

                <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs border-t border-slate-300">
                  <div className="border-t border-slate-400 pt-2 font-bold">{c.preparedBySign}</div>
                  <div className="border-t border-slate-400 pt-2 font-bold">{c.receiverSign}</div>
                  <div className="border-t border-slate-400 pt-2 font-bold">{c.managerSign}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ======================================================== */}
        {/* 3. STICKY GLASS BOTTOM DOCK                             */}
        {/* ======================================================== */}
        <div className="p-4 sm:p-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-20">
          
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 self-start sm:self-center">
            {itemData && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{itemData.voucherNumber}</span>
                <span>•</span>
                <span className="text-slate-700 dark:text-slate-200">{formatAmount(itemData.amount, currency)} {getCurrencySymbol(currency, language)}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Print Slip Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={!itemData}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-sky-500" />
              <span>{c.printBtn}</span>
            </button>

            {/* Approve Button (if draft and authorized) */}
            {itemData?.isDraft && (hasPermission('accounting.manage') || hasPermission('settlement.manage')) && (
              <button
                type="button"
                onClick={handleApproveVoucher}
                disabled={approving}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{approving ? c.approving : c.approveBtn}</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              {c.closeBtn}
            </button>
          </div>

        </div>

      </div>

    </div>,
    document.body
  );
}
