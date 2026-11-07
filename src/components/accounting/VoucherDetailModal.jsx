import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useProject } from '../../context/ProjectContext';
import { useAuth, usePermissions } from '../../context/AuthContext';
import { db } from '../../db/db';
import { formatAmount, formatCurrency, getCurrencySymbol, getTodayDateString } from '../../utils/formatters';
import { numberToWords } from '../../utils/numberToWords';
import { promoteVoucherToPermanent } from '../../services/voucherNumberService';
import { 
  pushPaymentsLive, 
  pushLoansLive, 
  pushTreasuryIncomeLive, 
  pushAllExpensesToCloud, 
  deleteAccountTransferLive, 
  deleteTreasuryIncomeLive, 
  softDeleteExpenseLive 
} from '../../services/realtimeSync';
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
  Download,
  ChevronRight,
  ChevronLeft,
  Copy,
  FileEdit,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Share2,
  ExternalLink,
  Lock,
  Layers,
  Tag,
  Sparkles,
  AlertTriangle,
  History,
  Info,
  Users,
  CreditCard,
  UserCheck,
  UserX,
  FileSpreadsheet
} from 'lucide-react';

const COPY = {
  fa: {
    modalTitle: 'برگه رسمی سند مالی',
    modalSubtitle: 'سند معتبر حسابداری، خزانه‌داری و ممیزی کارگاه طبق اساسنامه',
    voucherNoLabel: 'شماره سند:',
    draftBadge: 'سند موقت (پیش‌نویس)',
    approvedBadge: 'سند دائم و قطعی',
    dateLabel: 'تاریخ ثبت:',
    timeLabel: 'ساعت:',
    amountCardTitle: 'مبلغ کل سند مالی',
    amountInWordsLabel: 'مبلغ به حروف:',
    debitTitle: 'طرف بدهکار (مصارف / گیرنده وجه)',
    creditTitle: 'طرف بستانکار (منبع پرداخت / خزانه‌داری)',
    doubleEntryBalanced: 'تراز دوبل متوازن (بدهکار = بستانکار)',
    txDetailsTitle: 'مشخصات و شرح سند',
    descriptionLabel: 'شرح و بابت عمومی:',
    auditorNoteTitle: 'یادداشت محرمانه حسابرسی داخلی',
    auditorNoteHint: 'این یادداشت صرفاً جهت ممیزی داخلی سیستم است و در برگه چاپی رسمی ظاهر نخواهد شد.',
    sourceAccountTitle: 'منبع مالی و خزانه‌داری',
    accountNameLabel: 'نام حساب / کارت:',
    accountTypeLabel: 'نوع حساب:',
    cashType: 'صندوق نقدی کارگاه',
    bankType: 'کارت / حساب بانکی',
    counterpartyTitle: 'طرف‌حساب / ذینفع سند',
    partyNameLabel: 'نام شخص یا شرکت:',
    partyRoleLabel: 'سمت یا ارتباط:',
    costCenterTitle: 'مرکز هزینه / فاز عملیاتی:',
    costCenterDefault: 'کارگاه مرکزی / پروژه جاری',
    accountCodingTitle: 'کدینگ حسابداری:',
    viewSubsidiaryHint: 'مشاهده معین اختصاصی',
    approvalAuditTitle: 'ره‌گیری و چرخه حیات سند (Audit Trail)',
    registeredByLabel: 'ثبت‌کننده اولیه:',
    lastEditedLabel: 'آخرین اصلاح:',
    approvedByLabel: 'تاییدکننده نهایی:',
    cloudStatusLabel: 'وضعیت سرور ابری:',
    cloudSynced: 'همگام‌شده با سرور ابری',
    cloudLocalOnly: 'محلی (آفلاین)',
    pendingApprovalMsg: 'این سند در وضعیت پیش‌نویس (موقت) است و منتظر بررسی و تایید نهایی مدیر می‌باشد.',
    approveBtn: 'تایید نهایی و تبدیل به سند دائم',
    approving: 'در حال ثبت تایید...',
    editDraftBtn: 'ویرایش سند',
    deleteDraftBtn: 'ابطال و حذف سند',
    confirmDeleteTitle: 'آیا از ابطال و حذف قطعی این سند موقت اطمینان دارید؟',
    confirmDeleteDesc: 'این اقدام سند موقت را از دیتابیس حذف کرده و برگشت‌ناپذیر است.',
    cancelDelete: 'انصراف',
    confirmDelete: 'بله، حذف کن',
    deleting: 'در حال حذف...',
    printBtn: 'چاپ فیش سند (A5/A4)',
    shareBtn: 'کپی متن سند',
    copiedMsg: 'کپی شد!',
    closeBtn: 'بستن (ESC)',
    receiptImageTitle: 'پیوست‌ها و فاکتورهای ضمیمه',
    noAttachments: 'پیوست تصویری برای این سند ثبت نشده است.',
    preparedBySign: 'امضای تنظیم‌کننده / حسابدار',
    receiverSign: 'امضای دریافت‌کننده وجه',
    managerSign: 'امضای تاییدکننده / مدیر کارگاه',
    workshopOfficialSeal: 'محل مهر و تایید کارگاه',
    loadingVoucher: 'در حال بارگذاری اطلاعات سند مالی...',
    voucherNotFound: 'سند مالی با این مشخصات یافت نشد.',
    categoryLabel: 'سرفصل سند:',
    outflowType: 'برداشت از صندوق / کارت (-)',
    inflowType: 'واریز به صندوق / کارت (+)',
    transferType: 'انتقال بین حساب‌ها',
    prevVoucher: 'سند قبلی (جهت راست)',
    nextVoucher: 'سند بعدی (جهت چپ)',
    voucherPosition: (cur, tot) => `سند ${cur} از ${tot}`,
    qrVerificationTitle: 'اصالت‌سنجی دیجیتال سند',
    lightboxTitle: 'پیش‌نمایش تصویر پیوست',
    zoomIn: 'بزرگ‌نمایی',
    zoomOut: 'کوچک‌نمایی',
    rotate: 'چرخش',
    downloadPhoto: 'دانلود فایل پیوست',
    // تفکیک جامع تسویه گروهی
    groupSettlementSectionTitle: 'ریز تسهیم و تسویه حساب گروهی',
    groupMembersCount: (cnt) => `شامل ${cnt} نفر عضو گروه کاری`,
    thWorkerName: 'نام پرسنل',
    thWorkerRole: 'سمت',
    thWorkerStatus: 'وضعیت عضویت',
    statusActive: 'فعال در کارگاه',
    statusInactive: 'غیرفعال / مرخص',
    thDaysWorked: 'کارکرد دوره',
    daysUnit: 'روز',
    thGrossWages: 'ناخالص کارکرد',
    thDeductions: 'کسر مساعده',
    thNetShare: 'خالص سهم پرداختی',
    thSettlementState: 'وضعیت تسویه',
    settledInSlip: 'پرداخت شده در این سند',
    groupSummaryCard: 'خلاصه تراز تسویه گروهی',
    lblTotalGross: 'مجموع ناخالص کارکرد گروه:',
    lblTotalAdvances: 'مجموع مساعده‌های مستهلک شده:',
    lblTotalLoanDeductions: 'مجموع کسر اقساط وام:',
    lblNetSettlementPaid: 'خالص کل چک / وجه پرداختی:',
    // تفکیک وام
    loanFacilityCardTitle: 'مشخصات کامل پرونده وام پرسنلی',
    lblPrincipal: 'مبلغ اصل وام:',
    lblInstallment: 'مبلغ هر قسط ماهانه:',
    lblInstallmentsCount: 'تعداد کل اقساط:',
    lblRemainingLoan: 'مانده تسویه‌نشده وام:',
    lblLoanStatus: 'وضعیت بازپرداخت:',
    loanStatusActive: 'فعال (در حال کسر از دستمزد در تسویه‌های ماهانه)',
    loanStatusPaid: 'تسویه کامل شده',
    loanInstallmentsUnit: 'قسط',
    // تفکیک مساعده و هزینه
    advanceCardTitle: 'مشخصات مساعده پرداختی',
    lblPaymentMethod: 'روش پرداخت وجه:',
    lblRefNumber: 'کد پیگیری / شماره ارجاع:',
    methodCash: 'نقدی از صندوق کارگاه',
    methodBank: 'کارت به کارت / حواله بانکی',
    expenseCardTitle: 'مشخصات هزینه و فاکتور خرید',
    lblVendor: 'فروشنده / پیمانکار:',
    lblCategory: 'سرفصل هزینه:'
  },
  ku: {
    modalTitle: 'فۆڕمی فەرمی بەڵگەنامەی دارایی',
    modalSubtitle: 'بەڵگەنامەی باوەڕپێکراوی حیسابداری، خەزێنە و ووردبینی کارگە',
    voucherNoLabel: 'ژمارەی بەڵگەنامە:',
    draftBadge: 'بەڵگەنامەی کاتی (ڕەشنووس)',
    approvedBadge: 'بەڵگەنامەی هەمیشەیی و کۆتایی',
    dateLabel: 'بەرواری تۆمار:',
    timeLabel: 'کاتژمێر:',
    amountCardTitle: 'کۆی گشتی بڕی دارایی',
    amountInWordsLabel: 'بڕ بە پیت:',
    debitTitle: 'لایەنی قەرزدار (خەرجی / وەرگر)',
    creditTitle: 'لایەنی خاوەن قەرز (سەرچاوەی پارە)',
    doubleEntryBalanced: 'تەرازووی هاوسەنگ (قەرزدار = خاوەن قەرز)',
    txDetailsTitle: 'وردەکاری و ڕوونکردنەوەی بەڵگەنامە',
    descriptionLabel: 'تێبینی و هۆکاری گشتی:',
    auditorNoteTitle: 'تێبینی تایبەتی ووردبینی ناوخۆیی',
    auditorNoteHint: 'ئەم تێبینییە تەنیا بۆ بەڕێوەبەرایەتییە و لە فۆڕمی چاپکراودا پیشان نادرێت.',
    sourceAccountTitle: 'سەرچاوەی دارایی و خەزێنە',
    accountNameLabel: 'ناوی حیساب / کارت:',
    accountTypeLabel: 'جۆری حیساب:',
    cashType: 'سندوقی نەختینەی کارگە',
    bankType: 'کارتی بانکی / حیساب',
    counterpartyTitle: 'لایەنی بەرامبەر / سوودمەند',
    partyNameLabel: 'ناوی کەس یان کۆمپانیا:',
    partyRoleLabel: 'پێگە:',
    costCenterTitle: 'ناوەندی خەرجی / بەشی کار:',
    costCenterDefault: 'کارگەی ناوەندی / پڕۆژەی ئێستا',
    accountCodingTitle: 'کۆدینگی حیسابداری:',
    viewSubsidiaryHint: 'بینینی معینی تایبەت',
    approvalAuditTitle: 'مێژووی ووردبینی و دۆخی بەڵگەنامە (Audit Trail)',
    registeredByLabel: 'تۆمارکەر:',
    lastEditedLabel: 'دوا دەستکاری:',
    approvedByLabel: 'پەسەندکەری کۆتایی:',
    cloudStatusLabel: 'دۆخی سێرڤەری هەور:',
    cloudSynced: 'هاوکاتکراو لەگەڵ هەور',
    cloudLocalOnly: 'ناوخۆیی (ئۆفلاین)',
    pendingApprovalMsg: 'ئەم بەڵگەنامەیە لە دۆخی ڕەشنووسدایە و چاوەڕوانی پەسەندکردنی بەڕێوەبەرە.',
    approveBtn: 'پەسەندکردنی کۆتایی و گۆڕین بۆ هەمیشەیی',
    approving: 'لە پەسەندکردندایە...',
    editDraftBtn: 'دەستکاریکردنی بەڵگەنامە',
    deleteDraftBtn: 'سڕینەوەی بەڵگەنامەی کاتی',
    confirmDeleteTitle: 'ئایا دڵنیایت لە سڕینەوەی ئەم بەڵگەنامە کاتییە؟',
    confirmDeleteDesc: 'ئەم کردارە بەڵگەنامەکە لە داتابەیس دەسڕێتەوە و ناگەڕێتەوە.',
    cancelDelete: 'پاشگەزبوونەوە',
    confirmDelete: 'بەڵێ، بسڕەوە',
    deleting: 'لە سڕینەوەدایە...',
    printBtn: 'چاپکردنی بەڵگەنامە (A5/A4)',
    shareBtn: 'کۆپیکردنی دەقی بەڵگەنامە',
    copiedMsg: 'کۆپی کرا!',
    closeBtn: 'داخستن (ESC)',
    receiptImageTitle: 'وێنەی فاکتۆر و بەڵگەنامە هاوپێچەکان',
    noAttachments: 'هیچ وێنەیەک هاوپێچ نەکراوە.',
    preparedBySign: 'واژۆی ڕێکخەر / حیسابدار',
    receiverSign: 'واژۆی وەرگری پارە',
    managerSign: 'واژۆی بەڕێوەبەری پڕۆژە',
    workshopOfficialSeal: 'شوێنی مۆری فەرمی',
    loadingVoucher: 'بارکردنی زانیاری بەڵگەنامە...',
    voucherNotFound: 'هیچ بەڵگەنامەیەک نەدۆزرایەوە.',
    categoryLabel: 'جۆری بەڵگەنامە:',
    outflowType: 'پارەدەرچوون لە سندوق (-)',
    inflowType: 'پارەهاتنەناو بۆ سندوق (+)',
    transferType: 'گواستنەوەی نێوان حیسابەکان',
    prevVoucher: 'بەڵگەنامەی پێشوو',
    nextVoucher: 'بەڵگەنامەی داهاتوو',
    voucherPosition: (cur, tot) => `بەڵگەنامەی ${cur} لە ${tot}`,
    qrVerificationTitle: 'پشتڕاستکردنەوەی دیجیتاڵی بەڵگەنامە',
    lightboxTitle: 'پیشاندانی وێنەی هاوپێچ',
    zoomIn: 'گەورەکردن',
    zoomOut: 'بچووککردن',
    rotate: 'سوڕاندنەوە',
    downloadPhoto: 'دابەزاندنی فایل',
    groupSettlementSectionTitle: 'وردەکاری دابەشکاری و پاکتاوی دەستەجەمعی',
    groupMembersCount: (cnt) => `پێکهاتوو لە ${cnt} ئەندامی گرووپ`,
    thWorkerName: 'ناوی کرێکار',
    thWorkerRole: 'پیشە',
    thWorkerStatus: 'دۆخی ئەندامێتی',
    statusActive: 'چالاک لە کارگە',
    statusInactive: 'ناچالاک / مۆڵەت',
    thDaysWorked: 'ڕۆژانی کارکردن',
    daysUnit: 'ڕۆژ',
    thGrossWages: 'کۆی گشتی شایستە',
    thDeductions: 'بڕینی موساعەدە',
    thNetShare: 'بەشی کۆتایی وەرگیراو',
    thSettlementState: 'دۆخی پاکتاو',
    settledInSlip: 'دراوە لەم بەڵگەنامەدا',
    groupSummaryCard: 'پوختەی تەرازووی دەستەجەمعی',
    lblTotalGross: 'کۆی گشتی شایستەی گرووپ:',
    lblTotalAdvances: 'کۆی موساعەدەی کەمکراوە:',
    lblTotalLoanDeductions: 'کۆی قیستی قەرزی بڕاو:',
    lblNetSettlementPaid: 'کۆی تەواوی دراو بە نەختینە:',
    loanFacilityCardTitle: 'تایبەتمەندییەکانی قەرزی کارمەند',
    lblPrincipal: 'بڕی سەرەکی قەرز:',
    lblInstallment: 'قیستی مانگانە:',
    lblInstallmentsCount: 'ژمارەی قیستەکان:',
    lblRemainingLoan: 'ماوەی قەرز:',
    lblLoanStatus: 'دۆخی دانەوە:',
    loanStatusActive: 'چالاک (لە کەمکردنەوەدایە لە مووچە)',
    loanStatusPaid: 'تەواو پاکتاوکراوە',
    loanInstallmentsUnit: 'قیست',
    advanceCardTitle: 'وردەکاری موساعەدەی دراو',
    lblPaymentMethod: 'شێوازی پارەدان:',
    lblRefNumber: 'ژمارەی بەدواداچوون:',
    methodCash: 'نەختینە لە سندوقی کارگە',
    methodBank: 'کارت بە کارت / حەواڵە',
    expenseCardTitle: 'وردەکاری خەرجی کارگە',
    lblVendor: 'فرۆشیار / بەڵێندەر:',
    lblCategory: 'سەردێڕی خەرجی:'
  },
  en: {
    modalTitle: 'Official Financial Voucher Slip',
    modalSubtitle: 'Audited Treasury, Accounting & Workshop Slip per Charter',
    voucherNoLabel: 'Voucher No:',
    draftBadge: 'Draft Voucher (Temporary)',
    approvedBadge: 'Permanent Official Voucher',
    dateLabel: 'Voucher Date:',
    timeLabel: 'Time:',
    amountCardTitle: 'Total Voucher Amount',
    amountInWordsLabel: 'Amount in Words:',
    debitTitle: 'Debit Account (Beneficiary / Purpose)',
    creditTitle: 'Credit Account (Source / Treasury)',
    doubleEntryBalanced: 'Double-Entry Balanced (Debit = Credit)',
    txDetailsTitle: 'Voucher Specifications & Notes',
    descriptionLabel: 'General Description & Notes:',
    auditorNoteTitle: 'Confidential Internal Audit Notes',
    auditorNoteHint: 'Internal management note only; omitted from printed official vouchers.',
    sourceAccountTitle: 'Treasury & Source Account',
    accountNameLabel: 'Account Name:',
    accountTypeLabel: 'Account Type:',
    cashType: 'Workshop Cashbox',
    bankType: 'Bank Card / Account',
    counterpartyTitle: 'Counterparty / Beneficiary',
    partyNameLabel: 'Person or Entity:',
    partyRoleLabel: 'Role / Designation:',
    costCenterTitle: 'Cost Center / Phase:',
    costCenterDefault: 'Central Workshop / Active Project',
    accountCodingTitle: 'Account Coding:',
    viewSubsidiaryHint: 'Open dedicated ledger',
    approvalAuditTitle: 'Audit Trail & Document Lifecycle',
    registeredByLabel: 'Registered By:',
    lastEditedLabel: 'Last Modified:',
    approvedByLabel: 'Final Approved By:',
    cloudStatusLabel: 'Cloud Server State:',
    cloudSynced: 'Synced with Cloud Server',
    cloudLocalOnly: 'Local Cache (Offline)',
    pendingApprovalMsg: 'This voucher is currently in draft status and pending final managerial approval.',
    approveBtn: 'Approve & Promote to Permanent',
    approving: 'Approving...',
    editDraftBtn: 'Edit Voucher',
    deleteDraftBtn: 'Void & Delete Draft',
    confirmDeleteTitle: 'Are you sure you want to void and delete this draft voucher?',
    confirmDeleteDesc: 'This will permanently remove the draft record from local storage.',
    cancelDelete: 'Cancel',
    confirmDelete: 'Yes, Delete',
    deleting: 'Deleting...',
    printBtn: 'Print Voucher Slip (A5/A4)',
    shareBtn: 'Copy Voucher Text',
    copiedMsg: 'Copied!',
    closeBtn: 'Close (ESC)',
    receiptImageTitle: 'Attached Invoices & Receipts',
    noAttachments: 'No attachments recorded for this voucher.',
    preparedBySign: 'Prepared By (Accountant)',
    receiverSign: 'Received By (Payee)',
    managerSign: 'Approved By (Manager)',
    workshopOfficialSeal: 'Official Seal',
    loadingVoucher: 'Loading financial voucher details...',
    voucherNotFound: 'Voucher not found.',
    categoryLabel: 'Category:',
    outflowType: 'Outflow from Cashbox/Card (-)',
    inflowType: 'Inflow to Cashbox/Card (+)',
    transferType: 'Account-to-Account Transfer',
    prevVoucher: 'Previous Voucher',
    nextVoucher: 'Next Voucher',
    voucherPosition: (cur, tot) => `Voucher ${cur} of ${tot}`,
    qrVerificationTitle: 'Digital Verification QR',
    lightboxTitle: 'Attachment Preview',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    rotate: 'Rotate',
    downloadPhoto: 'Download Attachment',
    groupSettlementSectionTitle: 'Group Settlement & Apportionment Breakdown',
    groupMembersCount: (cnt) => `Including ${cnt} Group Members`,
    thWorkerName: 'Staff Name',
    thWorkerRole: 'Role',
    thWorkerStatus: 'Status',
    statusActive: 'Active',
    statusInactive: 'Inactive / On Leave',
    thDaysWorked: 'Days Worked',
    daysUnit: 'days',
    thGrossWages: 'Gross Wage',
    thDeductions: 'Advances Deducted',
    thNetShare: 'Net Payable Share',
    thSettlementState: 'Settlement State',
    settledInSlip: 'Paid in this voucher',
    groupSummaryCard: 'Group Settlement Balance Summary',
    lblTotalGross: 'Total Group Gross Wages:',
    lblTotalAdvances: 'Total Advances Offset:',
    lblTotalLoanDeductions: 'Total Loan Deductions:',
    lblNetSettlementPaid: 'Net Total Cash/Transfer Paid:',
    loanFacilityCardTitle: 'Staff Loan Facility Specifications',
    lblPrincipal: 'Loan Principal:',
    lblInstallment: 'Monthly Installment:',
    lblInstallmentsCount: 'Installments Count:',
    lblRemainingLoan: 'Remaining Balance:',
    lblLoanStatus: 'Repayment Status:',
    loanStatusActive: 'Active (Deducting from payroll)',
    loanStatusPaid: 'Fully Repaid',
    loanInstallmentsUnit: 'installments',
    advanceCardTitle: 'Advance Payment Specifications',
    lblPaymentMethod: 'Payment Method:',
    lblRefNumber: 'Reference Number:',
    methodCash: 'Cash from Workshop Drawer',
    methodBank: 'Card Transfer / Bank Slip',
    expenseCardTitle: 'Workshop Expense Specifications',
    lblVendor: 'Vendor / Contractor:',
    lblCategory: 'Expense Category:'
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
  const [activeVoucherNumber, setActiveVoucherNumber] = useState(voucherNumber || voucher?.voucherNumber || null);
  const [loading, setLoading] = useState(!voucher && Boolean(voucherNumber));
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  // Stepper / Sibling Navigation state
  const [allProjectVouchers, setAllProjectVouchers] = useState([]);
  const [siblingIndex, setSiblingIndex] = useState(-1);

  // Deep Enriched Breakdown State (Group settlements, Loans, Advances)
  const [enrichedBreakdown, setEnrichedBreakdown] = useState({
    groupSettlement: null,
    loanFacility: null,
    advanceInfo: null,
    expenseInfo: null
  });

  // Lightbox State
  const [activePhotoUrl, setActivePhotoUrl] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const printRef = useRef(null);

  // Keyboard Navigation: ESC to close, ArrowLeft / ArrowRight to navigate siblings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (activePhotoUrl) {
          setActivePhotoUrl(null);
          return;
        }
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
          return;
        }
        onClose();
        return;
      }
      
      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (isInput || e.ctrlKey || e.metaKey || e.altKey) return;

      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && allProjectVouchers.length > 1) {
        const isNext = direction === 'rtl' ? e.key === 'ArrowLeft' : e.key === 'ArrowRight';
        const isPrev = direction === 'rtl' ? e.key === 'ArrowRight' : e.key === 'ArrowLeft';

        if (isNext && siblingIndex < allProjectVouchers.length - 1) {
          e.preventDefault();
          navigateToVoucher(allProjectVouchers[siblingIndex + 1]);
        } else if (isPrev && siblingIndex > 0) {
          e.preventDefault();
          navigateToVoucher(allProjectVouchers[siblingIndex - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activePhotoUrl, showDeleteConfirm, onClose, allProjectVouchers, siblingIndex, direction]);

  // Sync prop changes
  useEffect(() => {
    if (voucher) {
      setActiveItem(voucher);
      setActiveVoucherNumber(voucher.voucherNumber || null);
      setLoading(false);
    } else if (voucherNumber) {
      setActiveVoucherNumber(voucherNumber);
    }
  }, [voucher, voucherNumber]);

  // Load All Project Vouchers for Continuous Navigation
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    (async () => {
      try {
        const projectId = currentProject?.id || 'default';
        const [payments, expenses, incomes, loans, transfers] = await Promise.all([
          db.payments ? db.payments.toArray() : [],
          db.expenses ? db.expenses.toArray() : [],
          db.treasuryIncomes ? db.treasuryIncomes.toArray() : [],
          db.loans ? db.loans.toArray() : [],
          db.accountTransfers ? db.accountTransfers.toArray() : []
        ]);

        const combined = [];
        const addItems = (list, tbl) => {
          list.forEach((item) => {
            if (item.deletedAt || !item.voucherNumber) return;
            const pId = item.projectId || 'default';
            if (pId !== projectId && pId !== 'default' && projectId !== 'default') return;
            combined.push({
              id: item.id,
              voucherNumber: item.voucherNumber,
              date: item.date || item.expenseDate || (item.createdAt ? item.createdAt.slice(0, 10) : ''),
              createdAt: item.createdAt || '',
              tableName: tbl,
              item
            });
          });
        };

        addItems(payments, 'payments');
        addItems(expenses, 'expenses');
        addItems(incomes, 'treasuryIncomes');
        addItems(loans, 'loans');
        addItems(transfers, 'accountTransfers');

        // Sort chronologically (oldest to newest)
        combined.sort((a, b) => {
          if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
          return (a.voucherNumber || '').localeCompare(b.voucherNumber || '');
        });

        if (isMounted) {
          setAllProjectVouchers(combined);
        }
      } catch (err) {
        console.warn('[VoucherDetailModal] Error loading project vouchers list:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [isOpen, currentProject]);

  // Resolve voucher by activeVoucherNumber from Dexie if not passed as an object
  useEffect(() => {
    if (!activeVoucherNumber || !isOpen) return;

    const idx = allProjectVouchers.findIndex((v) => v.voucherNumber === activeVoucherNumber);
    setSiblingIndex(idx);

    if (activeItem && activeItem.voucherNumber === activeVoucherNumber) {
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const findInTable = async (table, tableName) => {
          if (!table) return null;
          const res = await table.where('voucherNumber').equals(activeVoucherNumber).first();
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
  }, [activeVoucherNumber, isOpen, allProjectVouchers]);

  // Navigate to a sibling voucher
  const navigateToVoucher = useCallback((targetVoucher) => {
    if (!targetVoucher) return;
    setActiveVoucherNumber(targetVoucher.voucherNumber);
    setActiveItem(targetVoucher.item || null);
    setShowDeleteConfirm(false);
  }, []);

  // Deep Audit Resolution: Queries Group Settlements, Loans, Advances & Expenses
  useEffect(() => {
    if (!activeItem || !isOpen) return;
    const raw = activeItem.rawItem || activeItem;
    let isMounted = true;

    (async () => {
      try {
        const result = {
          groupSettlement: null,
          loanFacility: null,
          advanceInfo: null,
          expenseInfo: null
        };

        const isGroupSettlement = raw.isGroupSettlement || Boolean(raw.groupId) || (raw.type === 'settlement' && Number(raw.groupMemberCount || 0) > 1);

        // ۱. تحلیل عمیق تسویه حساب گروهی
        if (isGroupSettlement) {
          const groupId = raw.groupId;
          let group = null;
          if (groupId && db.groups) {
            group = await db.groups.get(groupId);
          }

          // یافتن لاگ‌های کارکرد تسویه شده در این سند
          const receiptId = String(raw.id || activeItem.id || '').replace(/_(in|out)$/, '');
          let settledLogs = [];
          if (db.attendanceLogs) {
            settledLogs = await db.attendanceLogs.where('settlementReceiptId').equals(receiptId).toArray();
          }

          // یافتن مساعده‌های تسویه شده در این سند
          let settledAdvances = [];
          if (db.payments) {
            settledAdvances = await db.payments.where('settlementReceiptId').equals(receiptId).toArray();
          }

          // یافتن پرسنل عضو گروه
          let groupWorkers = [];
          if (groupId && db.workers) {
            groupWorkers = await db.workers.where('groupId').equals(groupId).toArray();
          }

          // فیلتر اعضایی که در این سند کارکرد یا سهمی دریافت کرده‌اند (حذف اعضای غیرفعال/صفر)
          const membersBreakdown = groupWorkers
            .map((w) => {
              const wLogs = settledLogs.filter((l) => String(l.workerId) === String(w.id));
              const wAdvances = settledAdvances.filter((p) => String(p.workerId) === String(w.id));
              const daysCount = wLogs.length;
              const gross = wLogs.reduce((acc, l) => acc + (Number(l.totalDayPay) || Number(l.calculatedDailyWage) || 0), 0);
              const advTotal = wAdvances.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              const netShare = gross - advTotal;

              return {
                id: w.id,
                name: w.name,
                role: w.role || 'عضو گروه',
                isActive: w.isActive !== 0 && w.isActive !== false,
                daysCount,
                gross,
                advances: advTotal,
                netShare: netShare > 0 ? netShare : 0
              };
            })
            // حذف اعضایی که در این سند پولی دریافت نکرده‌اند (netShare = 0)
            .filter((m) => Number(m.netShare) > 0);

          result.groupSettlement = {
            groupName: group?.name || raw.groupName || 'گروه کاری',
            supervisorName: group?.supervisorName || raw.workerName || raw.personName || 'سرپرست گروه',
            memberCount: membersBreakdown.length || raw.groupMemberCount || 1,
            members: membersBreakdown,
            totalGross: raw.grossEarningsCalculated || membersBreakdown.reduce((s, m) => s + m.gross, 0),
            totalAdvances: raw.advancesDeducted || membersBreakdown.reduce((s, m) => s + m.advances, 0),
            totalLoanDeductions: raw.loanDeductions || raw.loanDeduction || 0,
            netPaid: Number(raw.amount) || 0
          };
        }

        // ۲. تحلیل عمیق پرونده وام پرسنلی
        const isLoan = raw.type === 'loan' || raw.type === 'loan_disbursement' || activeItem.tableName === 'loans';
        if (isLoan && db.loans) {
          let loan = null;
          if (raw.loanId) {
            loan = await db.loans.get(raw.loanId);
          }
          if (!loan && raw.voucherNumber) {
            loan = await db.loans.where('voucherNumber').equals(raw.voucherNumber).first();
          }
          if (!loan && raw.workerId) {
            loan = await db.loans.where('workerId').equals(String(raw.workerId)).first();
          }

          if (loan || isLoan) {
            const principal = Number(loan?.principalAmount || raw.principalAmount || raw.amount || 0);
            const installment = Number(loan?.installmentAmount || raw.installmentAmount || 0);
            const remaining = Number(loan?.remainingBalance ?? raw.remainingBalance ?? principal);
            const totalInst = loan?.totalInstallments || (installment > 0 ? Math.round(principal / installment) : 0);

            result.loanFacility = {
              principal,
              installment,
              remaining,
              totalInstallments: totalInst,
              status: loan?.status || 'active',
              notes: loan?.notes || raw.notes || ''
            };
          }
        }

        // ۳. تحلیل مساعده پرداختی
        const isAdvance = raw.type === 'advance' || raw.type === 'Advance_Payment';
        if (isAdvance) {
          result.advanceInfo = {
            method: raw.paymentMethod || 'cash',
            referenceNumber: raw.referenceNumber || raw.refNumber || null
          };
        }

        // ۴. تحلیل هزینه کارگاهی
        if (activeItem.tableName === 'expenses' || raw.type === 'expense') {
          result.expenseInfo = {
            vendor: raw.counterpartyName || raw.vendorName || raw.personName || 'فروشنده / پیمانکار',
            category: raw.categoryName || raw.category || 'هزینه کارگاه'
          };
        }

        if (isMounted) {
          setEnrichedBreakdown(result);
        }
      } catch (err) {
        console.warn('[VoucherDetailModal] Error enriching voucher breakdown:', err);
      }
    })();

    return () => { isMounted = false; };
  }, [activeItem, isOpen]);

  // Normalized Voucher Attributes & Enterprise Calculations
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

    const title = activeItem.title || raw.title || raw.notes || 'سند مالی کارگاه';
    const description = activeItem.description || raw.description || raw.notes || '';
    const internalNote = raw.auditorNotes || raw.internalNote || raw.auditNote || '';
    const counterpartyName = activeItem.personName || raw.personName || raw.workerName || raw.payeeName || raw.payer || raw.counterpartyName || '—';
    const accountName = activeItem.accountName || raw.accountName || raw.sourceAccountName || 'صندوق نقدی کارگاه';
    const accountType = activeItem.accountType || raw.accountType || 'cash';
    const categoryLabel = activeItem.categoryLabel || raw.categoryLabel || (type === 'inflow' ? c.inflowType : c.outflowType);
    const costCenter = raw.costCenter || raw.sectionName || raw.section || c.costCenterDefault;

    // Multi-attachment normalization
    const attachments = [];
    if (raw.receiptPhoto) attachments.push(raw.receiptPhoto);
    if (raw.receiptUrl && raw.receiptUrl !== raw.receiptPhoto) attachments.push(raw.receiptUrl);
    if (raw.receiptImage && !attachments.includes(raw.receiptImage)) attachments.push(raw.receiptImage);
    if (Array.isArray(raw.attachments)) {
      raw.attachments.forEach((att) => {
        const u = typeof att === 'string' ? att : att.url;
        if (u && !attachments.includes(u)) attachments.push(u);
      });
    }
    if (Array.isArray(raw.receiptPhotos)) {
      raw.receiptPhotos.forEach((u) => {
        if (u && !attachments.includes(u)) attachments.push(u);
      });
    }

    // Audit info with smart Human-Friendly Name Resolver (no raw UUIDs)
    const resolveUserDisplayName = (idOrName) => {
      if (!idOrName) return user?.name || (language === 'ku' ? 'ئەفشین زارعی (بەڕێوەبەر)' : language === 'en' ? 'Afshin Zarei (Admin)' : 'افشین زارعی (مدیر سیستم)');
      const val = String(idOrName).trim();
      // If not a raw UUID, return as-is
      if (!/^[0-9a-f-]{20,}$/i.test(val)) {
        return val;
      }
      // Check legacy owner UUID
      if (val === '867f5819-e911-45f2-9d4f-d4a7f955ef5f' || val.toLowerCase().includes('867f5819')) {
        return user?.name || (language === 'ku' ? 'ئەفشین زارعی' : language === 'en' ? 'Afshin Zarei' : 'افشین زارعی');
      }
      // If it is a UUID, check logged in user
      if (user && (user.id === val || user.userId === val)) {
        return user.name || user.username || user.full_name || 'افشین زارعی';
      }
      // Check session
      try {
        const sessStr = localStorage.getItem('workshop_auth_session');
        if (sessStr) {
          const sess = JSON.parse(sessStr);
          if (sess.id === val && (sess.name || sess.username)) {
            return sess.name || sess.username;
          }
        }
      } catch (_) {}
      if (raw.approved_by && !/^[0-9a-f-]{20,}$/i.test(raw.approved_by)) {
        return raw.approved_by;
      }
      return user?.name || (language === 'ku' ? 'ئەفشین زارعی (بەڕێوەبەر)' : language === 'en' ? 'Afshin Zarei (Admin)' : 'افشین زارعی (مدیر سیستم)');
    };

    const registeredBy = resolveUserDisplayName(raw.created_by_name || raw.created_by || raw.userId);
    const registeredAt = raw.createdAt || raw.date || date;
    const lastEditedBy = resolveUserDisplayName(raw.updated_by || raw.updatedBy);
    const lastEditedAt = raw.updatedAt || null;
    const approvedBy = activeItem.approvedBy || raw.approved_by || raw.approvedBy || null;
    const approvedAt = activeItem.approvedAt || raw.approved_at || raw.approvedAt || null;
    const isCloudSynced = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;

    // Chart of accounts coding label
    const accountCode = raw.accountCode || (accountType === 'bank' ? '۱۰۱۰۲' : '۱۰۱۰۱');
    const categoryCode = raw.categoryCode || (type === 'inflow' ? '۴۰۱۰۱' : '۵۰۱۰۱');

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
      internalNote,
      counterpartyName,
      accountName,
      accountType,
      categoryLabel,
      costCenter,
      attachments,
      registeredBy,
      registeredAt,
      lastEditedBy,
      lastEditedAt,
      approvedBy,
      approvedAt,
      isCloudSynced,
      accountCode,
      categoryCode
    };
  }, [activeItem, c]);

  // Digital verification QR data
  const qrVerificationPayload = useMemo(() => {
    if (!itemData) return '';
    return JSON.stringify({
      v: itemData.voucherNumber,
      amt: itemData.amount,
      curr: currency,
      dt: itemData.date,
      prj: currentProject?.name || 'KarSync',
      st: itemData.isDraft ? 'draft' : 'approved',
      sig: `KS-${itemData.voucherNumber.replace(/[^0-9]/g, '')}`
    });
  }, [itemData, currency, currentProject]);

  // Copy full voucher summary to clipboard
  const handleCopyVoucher = useCallback(() => {
    if (!itemData) return;
    const text = `📋 ${c.modalTitle} [${itemData.voucherNumber}]
📅 ${c.dateLabel} ${itemData.date} ${itemData.time || ''}
💰 ${c.amountCardTitle}: ${formatAmount(itemData.amount, currency)} ${getCurrencySymbol(currency, language)} (${numberToWords(itemData.amount, currency, language)})
👤 ${c.counterpartyTitle}: ${itemData.counterpartyName}
🏦 ${c.sourceAccountTitle}: ${itemData.accountName}
📝 ${itemData.title}${itemData.description ? ` - ${itemData.description}` : ''}
🏢 ${currentProject?.name || 'KarSync'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [itemData, currency, language, currentProject, c]);

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
        const idToUpdate = String(activeItem.id).replace('_out', '').replace('_in', '');
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
      setActiveVoucherNumber(nextVoucher);
      window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
    } catch (err) {
      console.error('[VoucherDetailModal] Approval error:', err);
    } finally {
      setApproving(false);
    }
  };

  // Handle deleting/voiding draft voucher
  const handleDeleteDraftVoucher = async () => {
    if (!itemData || !itemData.isDraft || deleting) return;
    setDeleting(true);
    try {
      const tbl = activeItem.tableName || (itemData.type === 'inflow' ? 'treasuryIncomes' : 'payments');
      const cleanId = String(activeItem.id || itemData.raw.id).replace(/_(in|out)$/, '');

      if (tbl === 'accountTransfers') {
        await deleteAccountTransferLive(cleanId);
      } else if (tbl === 'treasuryIncomes') {
        await deleteTreasuryIncomeLive(cleanId);
      } else if (tbl === 'expenses') {
        await softDeleteExpenseLive(cleanId);
      } else if (tbl === 'payments') {
        await db.payments.delete(cleanId);
        pushPaymentsLive().catch(() => {});
      } else if (tbl === 'loans') {
        await db.loans.update(cleanId, { deletedAt: new Date().toISOString(), status: 'deleted' });
        pushLoansLive().catch(() => {});
      }

      window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
      onClose();
    } catch (err) {
      console.error('[VoucherDetailModal] Deletion error:', err);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Handle Editing Draft Voucher
  const handleEditDraftVoucher = useCallback(() => {
    if (!itemData || !itemData.isDraft) return;
    const raw = itemData.raw;
    const tbl = activeItem.tableName || (itemData.type === 'inflow' ? 'treasuryIncomes' : 'payments');

    onClose();

    if (tbl === 'expenses') {
      window.dispatchEvent(new CustomEvent('karsync-open-expense-modal', { detail: { expense: raw } }));
    } else if (tbl === 'payments') {
      window.dispatchEvent(new CustomEvent('karsync-open-payment-modal', { detail: { payment: raw } }));
    } else if (tbl === 'accountTransfers') {
      window.dispatchEvent(new CustomEvent('karsync-open-transfer-modal', { detail: { transfer: raw } }));
    } else if (tbl === 'treasuryIncomes') {
      window.dispatchEvent(new CustomEvent('karsync-open-income-modal', { detail: { income: raw } }));
    }
  }, [itemData, activeItem, onClose]);

  // Deep Navigation: Open counterparty subsidiary ledger or profile
  const handleOpenCounterpartyLedger = useCallback(() => {
    if (!itemData) return;
    const raw = itemData.raw;
    const wId = raw.workerId || activeItem.workerId;
    if (wId) {
      window.dispatchEvent(new CustomEvent('karsync-open-subsidiary-ledger', {
        detail: { type: 'worker', data: { id: wId, name: itemData.counterpartyName } }
      }));
      onClose();
      return;
    }

    const cpId = raw.counterpartyId || activeItem.counterpartyId;
    if (cpId) {
      window.dispatchEvent(new CustomEvent('karsync-open-subsidiary-ledger', {
        detail: { type: 'counterparty', data: { id: cpId, name: itemData.counterpartyName } }
      }));
      onClose();
      return;
    }

    window.dispatchEvent(new CustomEvent('karsync-open-subsidiary-search'));
    onClose();
  }, [itemData, activeItem, onClose]);

  // Deep Navigation: Open treasury account subsidiary ledger
  const handleOpenAccountLedger = useCallback(() => {
    if (!itemData) return;
    const accId = itemData.raw.accountId || itemData.raw.sourceAccountId || activeItem.accountId;
    if (accId) {
      window.dispatchEvent(new CustomEvent('karsync-open-subsidiary-ledger', {
        detail: { type: 'account', data: { id: accId, name: itemData.accountName } }
      }));
      onClose();
    }
  }, [itemData, activeItem, onClose]);

  // Trigger standard print
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const prevVoucher = siblingIndex > 0 ? allProjectVouchers[siblingIndex - 1] : null;
  const nextVoucher = siblingIndex < allProjectVouchers.length - 1 ? allProjectVouchers[siblingIndex + 1] : null;

  return createPortal(
    /* Outer Backdrop with Light Subtle Blur (Background kept crisp) & Backdrop-Click-To-Close */
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-5 md:p-8 animate-in fade-in duration-200"
    >
      
      {/* Lightbox Modal (For attached photos) */}
      {activePhotoUrl && (
        <div 
          onClick={() => setActivePhotoUrl(null)}
          className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl flex items-center justify-between text-white pb-3 border-b border-white/10 mb-4"
          >
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-400" />
              <span>{c.lightboxTitle}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title={c.zoomIn}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title={c.zoomOut}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title={c.rotate}
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <a
                href={activePhotoUrl}
                download={`Voucher_${itemData?.voucherNumber || 'Photo'}.jpg`}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title={c.downloadPhoto}
              >
                <Download className="w-4 h-4 text-emerald-400" />
              </a>
              <button
                type="button"
                onClick={() => {
                  setActivePhotoUrl(null);
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="p-2 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white transition-all cursor-pointer ms-2"
                title={c.closeBtn}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div 
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center overflow-hidden max-h-[80vh] w-full"
          >
            <img
              src={activePhotoUrl}
              alt="Receipt Preview"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease-out'
              }}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Main Apple Liquid Glass Modal Container */}
      <div 
        ref={printRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/70 dark:border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.25)] rounded-3xl sm:rounded-4xl overflow-hidden flex flex-col max-h-[94vh] transition-all duration-300"
      >
        
        {/* ======================================================== */}
        {/* 1. APPLE LIQUID GLASS HEADER WITH VOUCHER STEPPER       */}
        {/* ======================================================== */}
        <div className="no-print p-4 sm:p-5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-b border-white/60 dark:border-white/10 flex items-center justify-between gap-3 sticky top-0 z-20">
          
          {/* Identity & Status */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              itemData?.isDraft 
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-300/40' 
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-300/40'
            }`}>
              {itemData?.isDraft ? <Clock className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" /> : <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {c.modalTitle}
                </h3>
                {itemData && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border ${
                    itemData.isDraft
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                  }`}>
                    {itemData.isDraft ? c.draftBadge : c.approvedBadge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                {c.modalSubtitle}
              </p>
            </div>
          </div>

          {/* Stepper (Previous / Next) & Single Authority Voucher Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Voucher Number Chip with 1-Click Copy (Single prominent authority place) */}
            {itemData && (
              <button
                type="button"
                onClick={handleCopyVoucher}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-800/90 dark:hover:bg-slate-700 rounded-xl border border-slate-200/80 dark:border-slate-700/80 font-mono text-xs font-black transition-all cursor-pointer group shadow-2xs"
                title={copied ? c.copiedMsg : c.shareBtn}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 transition-colors" />
                )}
                <span className="text-sky-600 dark:text-sky-400 dir-ltr font-black text-sm">{itemData.voucherNumber}</span>
              </button>
            )}

            {/* Stepper Navigation: Prev / Next */}
            {allProjectVouchers.length > 1 && (
              <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => navigateToVoucher(prevVoucher)}
                  disabled={!prevVoucher}
                  className="h-7 w-7 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title={c.prevVoucher}
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                </button>
                <span className="text-[10px] font-mono font-bold text-slate-500 px-1.5 hidden md:inline">
                  {c.voucherPosition(siblingIndex + 1, allProjectVouchers.length)}
                </span>
                <button
                  type="button"
                  onClick={() => navigateToVoucher(nextVoucher)}
                  disabled={!nextVoucher}
                  className="h-7 w-7 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title={c.nextVoucher}
                >
                  <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                </button>
              </div>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100/90 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800/90 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 transition-all cursor-pointer shadow-2xs active:scale-95"
              title={c.closeBtn}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. BODY CONTENT (Liquid Glass Scrollable View)          */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5 custom-scrollbar">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Clock className="w-8 h-8 animate-spin text-sky-500" />
              <p className="text-xs sm:text-sm font-bold">{c.loadingVoucher}</p>
            </div>
          ) : !itemData ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-xs sm:text-sm font-bold">{c.voucherNotFound}</p>
            </div>
          ) : (
            <>
              {/* Draft Status Banner */}
              {itemData.isDraft && (
                <div className="no-print p-3.5 sm:p-4 rounded-3xl bg-amber-500/10 border border-amber-300/70 dark:border-amber-700/60 flex items-center gap-3 backdrop-blur-md shadow-2xs">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 font-medium">
                    {c.pendingApprovalMsg}
                  </p>
                </div>
              )}

              {/* Delete Draft Confirmation Card */}
              {showDeleteConfirm && (
                <div className="no-print p-4 sm:p-5 rounded-3xl bg-rose-500/10 backdrop-blur-xl border border-rose-500/30 text-slate-900 dark:text-white space-y-3 animate-in zoom-in-95 duration-150 shadow-md">
                  <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-black text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{c.confirmDeleteTitle}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {c.confirmDeleteDesc}
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-all cursor-pointer"
                    >
                      {c.cancelDelete}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteDraftVoucher}
                      disabled={deleting}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-md shadow-rose-500/25 transition-all cursor-pointer"
                    >
                      {deleting ? c.deleting : c.confirmDelete}
                    </button>
                  </div>
                </div>
              )}

              {/* Main 12-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                
                {/* ======================================================== */}
                {/* PRIMARY COLUMN (8 COLUMNS)                              */}
                {/* ======================================================== */}
                <div className="lg:col-span-8 space-y-4 sm:space-y-5">
                  
                  {/* 1. Big Hero Financial Amount Card (Apple Glass) */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2 flex-wrap gap-2">
                      <span className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-emerald-500" />
                        <span>{c.amountCardTitle}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                          {c.accountCodingTitle} {itemData.categoryCode}
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {itemData.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white font-mono" dir="ltr">
                        {formatAmount(itemData.amount, currency)}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-sky-600 dark:text-sky-400 font-sans">
                        {getCurrencySymbol(currency, language)}
                      </span>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-200/50 dark:border-slate-800/80 flex items-start gap-2">
                      <span className="text-xs text-slate-400 font-bold shrink-0">{c.amountInWordsLabel}</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                        {numberToWords(itemData.amount, currency, language)}
                      </span>
                    </div>
                  </div>

                  {/* 2. Double-Entry Breakdown (Apple Glass) */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
                        <span>تراز دوبل حسابداری (طرفین سند)</span>
                      </h4>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{c.doubleEntryBalanced}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Debit (بدهکار) */}
                      <div className="p-3.5 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-800/40 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
                          <span className="flex items-center gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>{c.debitTitle}</span>
                          </span>
                          <span className="font-mono text-[11px] font-black" dir="ltr">
                            +{formatAmount(itemData.amount, currency)}
                          </span>
                        </div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">
                          {itemData.type === 'inflow' ? itemData.accountName : itemData.counterpartyName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {itemData.title}
                        </p>
                      </div>

                      {/* Credit (بستانکار) */}
                      <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-800/40 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                          <span className="flex items-center gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>{c.creditTitle}</span>
                          </span>
                          <span className="font-mono text-[11px] font-black" dir="ltr">
                            -{formatAmount(itemData.amount, currency)}
                          </span>
                        </div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">
                          {itemData.type === 'inflow' ? itemData.counterpartyName : itemData.accountName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {itemData.accountType === 'bank' ? c.bankType : c.cashType} ({itemData.accountCode})
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Deep Architectural Breakdown: GROUP SETTLEMENT (ریز تسهیم اعضای گروه) */}
                  {enrichedBreakdown.groupSettlement && (
                    <div className="p-5 sm:p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
                              {c.groupSettlementSectionTitle}: {enrichedBreakdown.groupSettlement.groupName}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              سرپرست دریافت‌کننده: <strong>{enrichedBreakdown.groupSettlement.supervisorName}</strong> • {c.groupMembersCount(enrichedBreakdown.groupSettlement.memberCount)}
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                          {c.groupMembersCount(enrichedBreakdown.groupSettlement.memberCount)}
                        </span>
                      </div>

                      {/* جدول شفاف سهم هر عضو */}
                      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold">
                            <tr>
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">{c.thWorkerName}</th>
                              <th className="py-2.5 px-3">{c.thWorkerRole}</th>
                              <th className="py-2.5 px-3 text-center">{c.thWorkerStatus}</th>
                              <th className="py-2.5 px-3 text-center">{c.thDaysWorked}</th>
                              <th className="py-2.5 px-3 text-left">{c.thGrossWages}</th>
                              <th className="py-2.5 px-3 text-left">{c.thDeductions}</th>
                              <th className="py-2.5 px-3 text-left">{c.thNetShare}</th>
                              <th className="py-2.5 px-3 text-center">{c.thSettlementState}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-normal">
                            {enrichedBreakdown.groupSettlement.members.map((m, idx) => (
                              <tr key={m.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{m.name}</td>
                                <td className="py-2.5 px-3 text-slate-500 text-[11px]">{m.role}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    m.isActive 
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' 
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                  }`}>
                                    {m.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                    <span>{m.isActive ? c.statusActive : c.statusInactive}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {m.daysCount} {c.daysUnit}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 text-left" dir="ltr">
                                  +{formatAmount(m.gross, currency)}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-rose-600 dark:text-rose-400 text-left" dir="ltr">
                                  {m.advances > 0 ? `-${formatAmount(m.advances, currency)}` : '-'}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-black text-emerald-600 dark:text-emerald-400 text-left" dir="ltr">
                                  {formatAmount(m.netShare, currency)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                    {c.settledInSlip}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* خلاصه محاسباتی تسویه گروهی */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">{c.lblTotalGross}</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                            +{formatAmount(enrichedBreakdown.groupSettlement.totalGross, currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">{c.lblTotalAdvances}</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                            -{formatAmount(enrichedBreakdown.groupSettlement.totalAdvances, currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">{c.lblTotalLoanDeductions}</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400" dir="ltr">
                            -{formatAmount(enrichedBreakdown.groupSettlement.totalLoanDeductions, currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{c.lblNetSettlementPaid}</span>
                          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                            {formatAmount(enrichedBreakdown.groupSettlement.netPaid, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Deep Architectural Breakdown: LOAN FACILITY (مشخصات پرونده تسهیلات وام) */}
                  {enrichedBreakdown.loanFacility && (
                    <div className="p-5 sm:p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-xs sm:text-sm">
                        <Coins className="w-4 h-4" />
                        <span>{c.loanFacilityCardTitle}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-200/60 dark:border-amber-800/40">
                          <span className="text-[10px] text-slate-400 block">{c.lblPrincipal}</span>
                          <span className="font-mono font-black text-slate-900 dark:text-white text-sm" dir="ltr">
                            {formatAmount(enrichedBreakdown.loanFacility.principal, currency)}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-200/60 dark:border-amber-800/40">
                          <span className="text-[10px] text-slate-400 block">{c.lblInstallment}</span>
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm" dir="ltr">
                            {formatAmount(enrichedBreakdown.loanFacility.installment, currency)}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-200/60 dark:border-amber-800/40">
                          <span className="text-[10px] text-slate-400 block">{c.lblRemainingLoan}</span>
                          <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm" dir="ltr">
                            {formatAmount(enrichedBreakdown.loanFacility.remaining, currency)}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-200/60 dark:border-amber-800/40">
                          <span className="text-[10px] text-slate-400 block">{c.lblLoanStatus}</span>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            {enrichedBreakdown.loanFacility.remaining > 0 ? c.loanStatusActive : c.loanStatusPaid}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. Title, Public Description & Internal Auditor Note */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span>{c.txDetailsTitle}</span>
                      <span className="font-mono text-slate-500">{itemData.date} {itemData.time && `• ${itemData.time}`}</span>
                    </div>
                    
                    <div>
                      <h5 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                        {itemData.title}
                      </h5>
                      {itemData.description && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed bg-slate-50/80 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                          {itemData.description}
                        </p>
                      )}
                    </div>

                    {/* Internal Auditor Note (Visible in UI, strictly hidden in print) */}
                    {itemData.internalNote && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold">
                          <Lock className="w-3.5 h-3.5" />
                          <span>{c.auditorNoteTitle}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                          {itemData.internalNote}
                        </p>
                        <span className="text-[10px] text-slate-400 block pt-0.5">
                          {c.auditorNoteHint}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 6. Multi-Attachment Gallery & Lightbox Trigger */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-sky-500" />
                        <span>{c.receiptImageTitle}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {itemData.attachments.length > 0 ? `${itemData.attachments.length} فایل` : ''}
                      </span>
                    </div>

                    {itemData.attachments.length === 0 ? (
                      <div className="py-6 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 text-xs">
                        {c.noAttachments}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {itemData.attachments.map((photoUrl, idx) => (
                          <div 
                            key={idx}
                            onClick={() => {
                              setActivePhotoUrl(photoUrl);
                              setZoomLevel(1);
                              setRotation(0);
                            }}
                            className="relative group h-32 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                          >
                            <img
                              src={photoUrl}
                              alt={`Attachment ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5">
                              <Eye className="w-4 h-4" />
                              <span className="text-xs font-bold">بزرگنمایی</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* ======================================================== */}
                {/* SIDEBAR COLUMN (4 COLUMNS - CLEAN & DE-CLUTTERED)       */}
                {/* ======================================================== */}
                <div className="lg:col-span-4 space-y-4 sm:space-y-5">
                  
                  {/* Counterparty / Person Card with Deep Link to Subsidiary Ledger */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-sky-500" />
                        <span>{c.counterpartyTitle}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenCounterpartyLedger}
                        className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                        title={c.viewSubsidiaryHint}
                      >
                        <span className="text-[10px]">معین</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    <p 
                      onClick={handleOpenCounterpartyLedger}
                      className="text-base font-black text-slate-800 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors truncate"
                      title={itemData.counterpartyName}
                    >
                      {itemData.counterpartyName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {itemData.categoryLabel}
                    </p>
                  </div>

                  {/* Source Financial Account Card with Deep Link to Subsidiary Ledger */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{c.sourceAccountTitle}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenAccountLedger}
                        className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                        title={c.viewSubsidiaryHint}
                      >
                        <span className="text-[10px]">معین</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    <p 
                      onClick={handleOpenAccountLedger}
                      className="text-base font-black text-slate-800 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors truncate"
                    >
                      {itemData.accountName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>{c.accountTypeLabel}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {itemData.accountType === 'bank' ? c.bankType : c.cashType}
                      </span>
                    </div>
                  </div>

                  {/* Cost Center / Phase Card */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-500" />
                      <span>{c.costCenterTitle}</span>
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                      {itemData.costCenter}
                    </p>
                  </div>

                  {/* Enterprise Audit Trail & Lifecycle Timeline */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{c.approvalAuditTitle}</span>
                    </span>

                    <div className="space-y-2.5 text-xs">
                      {/* Created */}
                      <div className="flex items-start justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-400">{c.registeredByLabel}</span>
                        <div className="text-left font-bold text-slate-700 dark:text-slate-300">
                          <div>{itemData.registeredBy}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{itemData.registeredAt ? itemData.registeredAt.slice(0, 10) : ''}</div>
                        </div>
                      </div>

                      {/* Last Edited */}
                      {itemData.lastEditedBy && (
                        <div className="flex items-start justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                          <span className="text-slate-400">{c.lastEditedLabel}</span>
                          <div className="text-left font-bold text-slate-700 dark:text-slate-300">
                            <div>{itemData.lastEditedBy}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{itemData.lastEditedAt ? itemData.lastEditedAt.slice(0, 16).replace('T', ' ') : ''}</div>
                          </div>
                        </div>
                      )}

                      {/* Approved */}
                      <div className="flex items-start justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-400">{c.approvedByLabel}</span>
                        <div className="text-left font-bold">
                          {itemData.approvedBy ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{itemData.approvedBy}</span>
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              {c.draftBadge}
                            </span>
                          )}
                          {itemData.approvedAt && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {itemData.approvedAt.slice(0, 16).replace('T', ' ')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cloud Sync State */}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">{c.cloudStatusLabel}</span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          itemData.isCloudSynced 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/50' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {itemData.isCloudSynced ? c.cloudSynced : c.cloudLocalOnly}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* ======================================================== */}
              {/* PRINTABLE OFFICIAL SLIP WITH DIGITAL QR & SIGNATURES    */}
              {/* ======================================================== */}
              <div className="hidden print:block p-8 border-2 border-slate-900 rounded-3xl bg-white text-slate-900 space-y-6 mt-6">
                
                {/* Print Header */}
                <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black">{currentProject?.name || 'کارگاه پروژه مرکزی'}</h2>
                    <p className="text-xs font-bold text-slate-600 mt-1">{c.modalSubtitle}</p>
                  </div>
                  <div className="text-left font-mono">
                    <p className="text-base font-black">شماره سند: {itemData.voucherNumber}</p>
                    <p className="text-xs text-slate-600">تاریخ: {itemData.date} {itemData.time || ''}</p>
                  </div>
                </div>

                {/* Print Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs font-medium border-b border-slate-300 pb-4">
                  <div><strong>طرف حساب:</strong> {itemData.counterpartyName}</div>
                  <div><strong>محل پرداخت / صندوق:</strong> {itemData.accountName}</div>
                  <div><strong>مرکز هزینه:</strong> {itemData.costCenter}</div>
                  <div><strong>نوع سند:</strong> {itemData.categoryLabel}</div>
                  <div className="col-span-2 text-sm pt-2">
                    <strong>مبلغ سند:</strong> {formatCurrency(itemData.amount, currency, 'fa')} ({numberToWords(itemData.amount, currency, 'fa')})
                  </div>
                  <div className="col-span-2 pt-1">
                    <strong>شرح و بابت سند:</strong> {itemData.title} {itemData.description ? ` - ${itemData.description}` : ''}
                  </div>
                </div>

                {/* Print Signatures & Official QR Code */}
                <div className="pt-8 flex items-center justify-between gap-6">
                  <div className="grid grid-cols-3 gap-6 flex-1 text-center text-xs">
                    <div className="border-t border-slate-400 pt-2 font-bold">{c.preparedBySign}</div>
                    <div className="border-t border-slate-400 pt-2 font-bold">{c.receiverSign}</div>
                    <div className="border-t border-slate-400 pt-2 font-bold">{c.managerSign}</div>
                  </div>

                  {/* QR Code */}
                  <div className="border border-slate-300 p-2 rounded-xl flex flex-col items-center gap-1 shrink-0">
                    <QRCodeSVG value={qrVerificationPayload} size={80} level="M" />
                    <span className="text-[9px] font-mono text-slate-500">{itemData.voucherNumber}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ======================================================== */}
        {/* 3. STICKY GLASS BOTTOM DOCK                             */}
        {/* ======================================================== */}
        <div className="no-print p-3.5 sm:p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-t border-white/60 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-20">
          
          {/* Live Balance / Amount Indicator (No redundant voucher number repetition) */}
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 self-start sm:self-center">
            {itemData && (
              <>
                <span className={`w-2.5 h-2.5 rounded-full ${itemData.isDraft ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span className="text-slate-500">{c.amountCardTitle}:</span>
                <span className="text-slate-900 dark:text-white font-mono font-black text-sm" dir="ltr">
                  {formatAmount(itemData.amount, currency)} {getCurrencySymbol(currency, language)}
                </span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            
            {/* Delete / Void Draft Button (Visible only for drafts) */}
            {itemData?.isDraft && (hasPermission('accounting.manage') || hasPermission('settlement.manage')) && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || approving}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-800 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                title={c.deleteDraftBtn}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{c.deleteDraftBtn}</span>
              </button>
            )}

            {/* Edit Draft Button (Visible only for drafts) */}
            {itemData?.isDraft && (hasPermission('accounting.manage') || hasPermission('settlement.manage')) && (
              <button
                type="button"
                onClick={handleEditDraftVoucher}
                disabled={deleting || approving}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                title={c.editDraftBtn}
              >
                <FileEdit className="w-3.5 h-3.5 text-sky-500" />
                <span className="hidden sm:inline">{c.editDraftBtn}</span>
              </button>
            )}

            {/* Print Slip Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={!itemData}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-sky-500" />
              <span>{c.printBtn}</span>
            </button>

            {/* Final Approve Button (Promote to Permanent) */}
            {itemData?.isDraft && (hasPermission('accounting.manage') || hasPermission('settlement.manage')) && (
              <button
                type="button"
                onClick={handleApproveVoucher}
                disabled={approving || deleting}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{approving ? c.approving : c.approveBtn}</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
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

export default VoucherDetailModal;
