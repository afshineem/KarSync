import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { createWorkerAccessLink, revokeWorkerAccessLinks } from '../services/workerAccess';
import { pushLogsLive } from '../services/realtimeSync';
import { 
  formatCurrency, 
  formatAmount,
  getCurrencySymbol,
  formatHoursAndMinutes, 
  formatFullDateWithWeekday, 
  formatDateDisplay,
  roundCurrency,
  getCurrentYearMonth 
} from '../utils/formatters';
import { calculateWorkerFinancials } from '../utils/settlementCalculations';
import { 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  DollarSign, 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Edit2, 
  Plus, 
  ShieldCheck, 
  Lock, 
  Briefcase, 
  FileText, 
  Layers, 
  Check, 
  TrendingUp, 
  Trash2,
  CalendarCheck,
  CreditCard,
  History,
  PhoneCall,
  MessageSquare,
  FileSpreadsheet,
  MoreHorizontal
} from 'lucide-react';
import { EditRecordModal } from './EditRecordModal';
import { AdvancePaymentModal } from './AdvancePaymentModal';
import { SettlementModal } from './SettlementModal';
import { QuickMonthAttendanceModal } from './QuickMonthAttendanceModal';

const COPY = {
  fa: {
    phoneCallTitle: 'تماس تلفنی',
    noPhone: 'بدون شماره تماس',
    dailyRateLabel: 'نرخ روزانه:',
    overtimePrefix: 'اضافه کاری:',
    perHourSuffix: '/ساعت',
    moreToolsTitle: 'سایر ابزارها و عملیات',
    quickMonthlyLogging: 'ثبت سریع ماهانه (کارکرد)',
    defaultWorkerRole: 'پرسنل',
    viewLedger: 'مشاهده دفتر معین حسابداری',
    workerLoginLinkAndQR: 'لینک و بارکد ورود پرسنل',
    closeEsc: 'بستن (Esc)',
    financialWarning: 'هشدار مالی:',
    suspiciousLogsDesc: (count, dates, hasMore, lastDate) => `${count} روز کارکرد (${dates}${hasMore ? '، …' : ''}) «تسویه‌شده» علامت خورده، در حالی که تاریخ آن بعد از آخرین سند تسویه است${lastDate ? ` (${lastDate})` : ''}. اگر پرداخت نشده‌اند، به کارکرد جاری برگردانید تا از مانده‌ی پرسنل جا نیفتند.`,
    repairing: 'در حال اصلاح…',
    revertToCurrentLogs: 'برگرداندن به کارکرد جاری',
    accountStatusCreditor: 'وضعیت حساب: طلبکار از کارگاه',
    accountStatusDebtor: 'وضعیت حساب: بدهکار مساعده',
    unsettledDaysPending: (count) => `${count} روز کارکرد جاری در انتظار تسویه`,
    finalNetPayableBalance: 'مانده نهایی قابل پرداخت به پرسنل',
    currentWorkGross: 'کارکرد جاری (+)',
    advancesMinus: 'مساعده‌ها (-)',
    totalSettledHistory: 'مجموع تسویه‌شده',
    workTermsAndWage: 'شرایط کاری و دستمزد',
    masterRole: 'استادکار / سرتیم',
    workerRole: 'نیروی کار',
    baseDailyWageLabel: 'دستمزد پایه هر روز:',
    overtimeHourlyRateLabel: 'نرخ اضافه کاری:',
    standardHoursLabel: 'ساعت کار استاندارد:',
    hoursUnit: 'ساعت',
    startDateLabel: 'تاریخ شروع به کار:',
    notRecorded: 'ثبت نشده',
    currentWorkBreakdown: 'تفکیک کارکرد جاری',
    workDaysCount: (count) => `${count} روز کارکرد`,
    fullDay: 'روز کامل',
    halfDay: 'نیم‌روز',
    hourly: 'ساعتی',
    overtime: 'اضافه کاری',
    workerNotes: 'یادداشت پرسنل:',
    noNotes: 'بدون یادداشت',
    allTab: 'همه',
    attendanceTab: 'کارکردها',
    advancesTab: 'مساعده‌ها',
    settlementsTab: 'تسویه‌ها',
    loansTab: 'وام‌ها',
    activeLoanSummaryTitle: 'وام و تسهیلات پرسنل',
    totalLoanAmount: 'مجموع کل بازپرداخت:',
    totalRepaid: 'بازپرداخت‌شده:',
    loanRemainingBalance: 'مانده وام:',
    monthlyInstallmentLabel: 'قسط ماهانه:',
    loanRepaymentProgress: 'پیشرفت بازپرداخت:',
    loanEventTitle: (total, rem) => `تسهیلات وام پرسنلی (${total}) - ${rem} قسط باقی‌مانده`,
    allFilter: 'همه',
    currentFilter: 'جاری',
    archiveFilter: 'آرشیو',
    noRecordsInFilter: 'هیچ رکوردی در این فیلتر یافت نشد',
    canLogNewActivityTip: 'می‌توانید با داک بالای صفحه کارکرد یا مساعده جدید ثبت کنید.',
    finalSettlement: 'تسویه نهایی',
    advance: 'مساعده',
    settled: 'تسویه شده',
    unsettledCurrent: 'جاری / تسویه نشده',
    commaSeparator: '، ',
    overtimeHoursLabel: (hours) => `اضافه کاری: ${hours}`,
    settlementAmountLabel: 'مبلغ تسویه:',
    advancePaymentLabel: 'پرداخت مساعده:',
    grossWageLabel: 'دستمزد ناخالص:',
    viewLockedRecord: 'مشاهده رکورد قفل شده',
    editRecord: 'ویرایش رکورد',
    workerAccountBalance: 'مانده حساب پرسنل:',
    creditor: 'طلبکار',
    debtor: 'بدهکار',
    workerIdLabel: 'شناسه پرسنل:',
    addAdvanceBtn: 'ثبت مساعده',
    settleAccountBtn: 'صدور تسویه‌حساب',
    closeBtn: 'بستن',
    workerPortalTitle: 'لینک ورود اختصاصی پرسنل',
    workerPortalDesc: (name) => `با این لینک (یا بارکد)، ${name} مستقیم و بدون نام کاربری، رمز عبور و کد کارگاه وارد پروفایل خودش می‌شود و فقط صورت‌حساب و گزارش کارکرد خودش را می‌بیند.`,
    workerPortalWarning: 'هر فردی با این لینک می‌تواند وارد پروفایل شود؛ صرفاً برای خود پرسنل ارسال کنید. این لینک فقط یک‌بار نمایش داده می‌شود؛ در صورت مفقودی، لینک جدید بسازید.',
    linkCopiedAlert: 'لینک ورود کپی شد.',
    copyLinkBtn: 'کپی لینک ورود',
    shareBtn: 'اشتراک‌گذاری',
    shareTitle: 'لینک ورود به پروفایل',
    revokeAlert: 'دسترسی پرسنل با این لینک لغو شد.',
    pleaseWait: 'لطفاً صبر کنید…',
    generateLinkBtn: 'ساخت لینک ورود',
    generateLinkWarning: 'ساخت لینک جدید، لینک قبلی این پرسنل را نامعتبر خواهد کرد.',
    revokeAccessBtn: 'ابطال دسترسی لینک',
    pastCycleNotice: (count, month) => `${count} روز کارکرد از دوره قبلی (${month}) تسویه‌نشده باقی مانده است. در صورتی که این دوره پیش از مرخصی تسویه شده است، می‌توانید با یک کلیک آن را به عنوان «تسویه‌شده» بایگانی کنید.`,
    settlePastCycleBtn: (count) => `تسویه و بایگانی کارکردهای دوره قبل (${count} روز)`,
    settlingPastCycle: 'در حال تسویه و بایگانی…',
    pastCycleSettledSuccess: 'کارکردهای دوره قبل تسویه و بایگانی شدند.',
    revertConfirmPastCycle: (count) => `آیا از ثبت تسویه برای ${count} روز کارکرد دوره قبلی این پرسنل اطمینان دارید؟`
  },
  ku: {
    phoneCallTitle: 'پەیوەندی تەلەفۆنی',
    noPhone: 'بێ ژمارەی مۆبایل',
    dailyRateLabel: 'نرخی ڕۆژانە:',
    overtimePrefix: 'کاتی زیادە:',
    perHourSuffix: '/کاتژمێر',
    moreToolsTitle: 'ئامراز و کرداری تر',
    quickMonthlyLogging: 'تۆماری خێرای مانگانە (کارکرد)',
    defaultWorkerRole: 'کرێکار',
    viewLedger: 'بینینی دەفتەری معینی ژمێریاری',
    workerLoginLinkAndQR: 'لینک و بارکۆدی چوونەژوورەوەی کرێکار',
    closeEsc: 'داخستن (Esc)',
    financialWarning: 'ئاگاداریی دارایی:',
    suspiciousLogsDesc: (count, dates, hasMore, lastDate) => `${count} ڕۆژی کارکرد (${dates}${hasMore ? '، …' : ''}) وەک «یەکلاکراوە» دیاریکراوە، لە کاتێکدا بەروارەکەی دوای دوایین پاکتاوە${lastDate ? ` (${lastDate})` : ''}. ئەگەر نەدراون، بیگەڕێننەوە بۆ کارکردی بەردەوام تا لە شایستەکان دەرنەچێت.`,
    repairing: 'چاکدەکرێتەوە…',
    revertToCurrentLogs: 'گەڕاندنەوە بۆ کارکردی بەردەوام',
    accountStatusCreditor: 'دۆخی حیساب: داواکاری پارە لە کارگە',
    accountStatusDebtor: 'دۆخی حیساب: قەرزداری پێشەکی',
    unsettledDaysPending: (count) => `${count} ڕۆژی کارکردی بەردەوام چاوەڕوانی پاکتاوە`,
    finalNetPayableBalance: 'باڵانسی کۆتایی داواکاریی کرێکار (شایستەی پاکتاو)',
    currentWorkGross: 'کارکردی بەردەوام (+)',
    advancesMinus: 'پێشەکییەکان (-)',
    totalSettledHistory: 'کۆی گشتی پاکتاوکراو',
    workTermsAndWage: 'مەرجەکانی کار و کرێ',
    masterRole: 'وەستا / سەرپەرشتیار',
    workerRole: 'کرێکار',
    baseDailyWageLabel: 'کرێی بنەڕەتی ڕۆژانە:',
    overtimeHourlyRateLabel: 'نرخی کاتی زیادە:',
    standardHoursLabel: 'کاتژمێری ستاندارد:',
    hoursUnit: 'کاتژمێر',
    startDateLabel: 'بەرواری دەستپێکی کار:',
    notRecorded: 'تۆمار نەکراوە',
    currentWorkBreakdown: 'دابەشبوونی کارکردی بەردەوام',
    workDaysCount: (count) => `${count} ڕۆژی کارکرد`,
    fullDay: 'ڕۆژی تەواو',
    halfDay: 'نیوەڕۆژ',
    hourly: 'کاتژمێری',
    overtime: 'کاتی زیادە',
    workerNotes: 'تێبینییەکانی کرێکار:',
    noNotes: 'بێ تێبینی',
    allTab: 'هەموو',
    attendanceTab: 'کارکردەکان',
    advancesTab: 'پێشەکییەکان',
    settlementsTab: 'پاکتاوەکان',
    loansTab: 'قەرزەکان',
    activeLoanSummaryTitle: 'قەرز و ئاسانکاری کرێکار',
    totalLoanAmount: 'کۆی گشتی گەڕاندنەوە:',
    totalRepaid: 'دانراوە:',
    loanRemainingBalance: 'ماوەی قەرز:',
    monthlyInstallmentLabel: 'قیستی مانگانە:',
    loanRepaymentProgress: 'بەرەوپێشچوونی گەڕاندنەوە:',
    loanEventTitle: (total, rem) => `ئاسانکاری قەرزی کرێکار (${total}) - ${rem} قیست ماوە`,
    allFilter: 'هەموو',
    currentFilter: 'بەردەوام',
    archiveFilter: 'ئەرشیڤ',
    noRecordsInFilter: 'هیچ تۆمارێک لەم فلتەرەدا نەدۆزرایەوە',
    canLogNewActivityTip: 'دەتوانن لە ڕێگەی دوگمەکانی خوارەوە کارکرد یان پێشەکیی نوێ تۆمار بکەن.',
    finalSettlement: 'پاکتاوی کۆتایی',
    advance: 'پێشەکی',
    settled: 'پاکتاوکراو',
    unsettledCurrent: 'بەردەوام / پاکتاونەکراو',
    commaSeparator: '، ',
    overtimeHoursLabel: (hours) => `کاتی زیادە: ${hours}`,
    settlementAmountLabel: 'بڕی پاکتاو:',
    advancePaymentLabel: 'پارەدانی پێشەکی:',
    grossWageLabel: 'حەقدەستی ناخاڵس:',
    viewLockedRecord: 'بینینی تۆماری قفڵکراو',
    editRecord: 'دەستکاریکردنی تۆمار',
    workerAccountBalance: 'باڵانسی حیسابی کرێکار:',
    creditor: 'داواکار',
    debtor: 'قەرزدار',
    workerIdLabel: 'ناسنامەی کرێکار:',
    addAdvanceBtn: 'تۆمارکردنی پێشەکی',
    settleAccountBtn: 'دەرکردنی پاکتاوی حیساب',
    closeBtn: 'داخستن',
    workerPortalTitle: 'لینکی تایبەتی چوونەژوورەوەی کرێکار',
    workerPortalDesc: (name) => `بە یارمەتی ئەم لینکە (یان بارکۆدە)، ${name} بە ڕاستەوخۆ و بێ پێویستی بە ناوی بەکارهێنەر یان وشەی نهێنی دەچێتە ناو پڕۆفایلی خۆی و تەنها پسوولە و ڕاپۆرتی کارکردی خۆی دەبینێت.`,
    workerPortalWarning: 'هەر کەسێک ئەم لینکەی پێبێت دەتوانێت بچێتە ناو پڕۆفایلی ئەم کرێکارە؛ تەنها بۆ خودی خۆی بنێرن. ئەم لینکە تەنها یەکجار پیشان دەدرێت؛ لە ئەگەری ونبوون، لینکێکی نوێ دروست بکەن.',
    linkCopiedAlert: 'لینکی چوونەژوورەوە کۆپیکرا.',
    copyLinkBtn: 'کۆپیکردنی لینک',
    shareBtn: 'هاوبەشکردن',
    shareTitle: 'لینکی چوونەژوورەوە بۆ پڕۆفایل',
    revokeAlert: 'دەسەڵاتی ئەم کرێکارە بە لینک پووچەڵکرایەوە.',
    pleaseWait: 'تکایە چاوەڕوان بن…',
    generateLinkBtn: 'دروستکردنی لینکی چوونەژوورەوە',
    generateLinkWarning: 'دروستکردنی لینکی نوێ، لینکی پێشووی ئەم کرێکارە پووچەڵ دەکاتەوە.',
    revokeAccessBtn: 'پووچەڵکردنەوەی دەسەڵاتی لینک',
    qrNeedInternet: 'بۆ دروستکردنی لینک، هێڵی ئینتەرنێت پێویستە.',
    qrNotConfigured: 'تایبەتمەندی لینکی چوونەژوورەوە لەسەر سێرڤەر چالاک نەکراوە.',
    qrNeedAdmin: 'بۆ دروستکردنی لینک دەبێت بە حیسابی بەڕێوەبەر چوو بنە ژوورەوە.',
    qrWorkerNotSynced: 'ئەم کرێکارە هێشتا لەسەر سێرڤەر تۆمار نەکراوە. کەمێک بوەستن و دووبارە هەوڵ بدەن.',
    qrNotAuthorized: 'مۆڵەتی دروستکردنی لینکت بۆ ئەم کرێکارە نییە.',
    qrUnknownError: 'هەڵەی نەزانراو لە دروستکردنی لینک.',
    revokeConfirm: 'دەسەڵاتی ئەم لینکە پووچەڵ بکرێتەوە؟ کرێکار چیتر ناتوانێت بەم لینک یان بارکۆدە بچێتە ژوورەوە.',
    revertConfirm: (count) => `${count} ڕۆژی کارکرد دووبارە دەبێتەوە بە «یەکلا نەکراوە». بەردەوام دەبیت؟`,
    active: 'چالاک',
    inactive: 'ناچالاک',
    logFullDayTitle: 'تۆماری ڕۆژی تەواوی کارکرد',
    logHalfDayTitle: 'تۆماری نیوەڕۆژی کارکرد',
    logHourlyTitle: 'تۆماری کارکردی کاتژمێری',
    advancePaymentTitle: 'پارەدانی پێشەکی نەختینە / بانکی',
    settlementDocumentTitle: 'بەڵگەنامەی پاکتاوی کۆتایی',
    pastCycleNotice: (count, month) => `${count} ڕۆژی کارکرد لە خولی پێشوو (${month}) بە یەکلا نەکراوەیی ماوەتەوە. ئەگەر پێش مۆڵەت پاکتاو کراون، دەتوانیت بە یەک کلیک وەک پاکتاوکراو تۆماریان بکەیت.`,
    settlePastCycleBtn: (count) => `پاکتاو و ئەرشیڤکردنی خولی پێشوو (${count} ڕۆژ)`,
    settlingPastCycle: 'خەریکی پاکتاوکردنە…',
    pastCycleSettledSuccess: 'کارکردەکانی خولی پێشوو پاکتاوکران.',
    revertConfirmPastCycle: (count) => `دڵنیایت لە پاکتاوکردنی ${count} ڕۆژی خولی پێشووی ئەم کرێکارە؟`
  },
  en: {
    phoneCallTitle: 'Phone Call',
    noPhone: 'No phone number',
    dailyRateLabel: 'Daily Rate:',
    overtimePrefix: 'Overtime:',
    perHourSuffix: '/hour',
    moreToolsTitle: 'More actions & tools',
    quickMonthlyLogging: 'Quick Monthly Attendance',
    defaultWorkerRole: 'Worker',
    viewLedger: 'View Accounting Ledger',
    workerLoginLinkAndQR: 'Worker Access Link & QR',
    closeEsc: 'Close (Esc)',
    financialWarning: 'Financial Alert:',
    suspiciousLogsDesc: (count, dates, hasMore, lastDate) => `${count} work days (${dates}${hasMore ? ', …' : ''}) are marked as settled even though dated after the latest settlement${lastDate ? ` (${lastDate})` : ''}. If unpaid, revert to current logs so they are included in arrears.`,
    repairing: 'Repairing…',
    revertToCurrentLogs: 'Revert to Current Logs',
    accountStatusCreditor: 'Account Status: Net Creditor',
    accountStatusDebtor: 'Account Status: Net Debtor',
    unsettledDaysPending: (count) => `${count} current work days pending settlement`,
    finalNetPayableBalance: 'Final Worker Balance Due (Net Payable)',
    currentWorkGross: 'Current Wages (+)',
    advancesMinus: 'Advances (-)',
    totalSettledHistory: 'Total Settled',
    workTermsAndWage: 'Work Terms & Wage',
    masterRole: 'Master / Team Lead',
    workerRole: 'Worker',
    baseDailyWageLabel: 'Base Daily Wage:',
    overtimeHourlyRateLabel: 'Overtime Hourly Rate:',
    standardHoursLabel: 'Standard Work Hours:',
    hoursUnit: 'hours',
    startDateLabel: 'Start Date:',
    notRecorded: 'Not Recorded',
    currentWorkBreakdown: 'Current Work Breakdown',
    workDaysCount: (count) => `${count} work days`,
    fullDay: 'Full Day',
    halfDay: 'Half Day',
    hourly: 'Hourly',
    overtime: 'Overtime',
    workerNotes: 'Worker Notes:',
    noNotes: 'No notes',
    allTab: 'All',
    attendanceTab: 'Attendance',
    advancesTab: 'Advances',
    settlementsTab: 'Settlements',
    loansTab: 'Loans',
    activeLoanSummaryTitle: 'Staff Loan Facilities',
    totalLoanAmount: 'Total Repayable:',
    totalRepaid: 'Repaid Amount:',
    loanRemainingBalance: 'Remaining Balance:',
    monthlyInstallmentLabel: 'Monthly Installment:',
    loanRepaymentProgress: 'Repayment Progress:',
    loanEventTitle: (total, rem) => `Staff Loan Facility (${total}) - ${rem} installments remaining`,
    allFilter: 'All',
    currentFilter: 'Current',
    archiveFilter: 'Archived',
    noRecordsInFilter: 'No records found in this filter',
    canLogNewActivityTip: 'You can record attendance or advance from the bottom dock.',
    finalSettlement: 'Final Settlement',
    advance: 'Advance',
    settled: 'Settled',
    unsettledCurrent: 'Current / Unsettled',
    commaSeparator: ', ',
    overtimeHoursLabel: (hours) => `Overtime: ${hours}`,
    settlementAmountLabel: 'Settlement Amount:',
    advancePaymentLabel: 'Advance Payment:',
    grossWageLabel: 'Gross Wage:',
    viewLockedRecord: 'View locked record',
    editRecord: 'Edit record',
    workerAccountBalance: 'Worker Balance Due:',
    creditor: 'Creditor',
    debtor: 'Debtor',
    workerIdLabel: 'Worker ID:',
    addAdvanceBtn: 'New Advance',
    settleAccountBtn: 'Issue Settlement',
    closeBtn: 'Close',
    workerPortalTitle: 'Exclusive Worker Access Link',
    workerPortalDesc: (name) => `With this link (or QR code), ${name} can log in directly without credentials or project codes and view only their personal timesheet and ledger.`,
    workerPortalWarning: 'Anyone with this link can access this worker\'s profile. Send it only to them. This link is shown once; generate a new one if lost.',
    linkCopiedAlert: 'Access link copied to clipboard.',
    copyLinkBtn: 'Copy Access Link',
    shareBtn: 'Share',
    shareTitle: 'Profile Access Link',
    revokeAlert: 'Access via link revoked for this worker.',
    pleaseWait: 'Please wait…',
    generateLinkBtn: 'Generate Access Link',
    generateLinkWarning: 'Creating a new link will invalidate the previous link.',
    revokeAccessBtn: 'Revoke Link Access',
    qrNeedInternet: 'Internet connection required to create link.',
    qrNotConfigured: 'Login link feature is not enabled on the server.',
    qrNeedAdmin: 'You must be signed in as an administrator.',
    qrWorkerNotSynced: 'This worker is not yet synced to the server. Please try again in a moment.',
    qrNotAuthorized: 'You are not authorized to create a link for this worker.',
    qrUnknownError: 'Unknown error creating link.',
    revokeConfirm: 'Revoke access link? The worker will no longer be able to enter using the previous link or QR.',
    revertConfirm: (count) => `${count} work days will be marked as unsettled. Continue?`,
    active: 'Active',
    inactive: 'Inactive',
    logFullDayTitle: 'Full day attendance',
    logHalfDayTitle: 'Half day attendance',
    logHourlyTitle: 'Hourly attendance',
    advancePaymentTitle: 'Cash / Bank advance payment',
    settlementDocumentTitle: 'Final settlement document',
    pastCycleNotice: (count, month) => `${count} work days from prior cycle (${month}) remain open. If settled before leave, you can mark them as settled with one click.`,
    settlePastCycleBtn: (count) => `Settle & Archive Prior Cycle (${count} days)`,
    settlingPastCycle: 'Settling prior cycle…',
    pastCycleSettledSuccess: 'Prior cycle work logs marked as settled.',
    revertConfirmPastCycle: (count) => `Are you sure you want to mark ${count} prior cycle days as settled?`
  }
};

export function WorkerProfileModal({ workerId, isOpen, onClose }) {
  const { language, t, direction } = useLanguage();
  const c = COPY[language] || COPY.fa;
  const { currentProject, currency = 'IQD' } = useProject();
  const { user, setWorkerCredentials, getWorkerCredentialsMap } = useAuth();

  // UI element
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isPastCycleDismissed, setIsPastCycleDismissed] = useState(false);

  useEffect(() => {
    setIsPastCycleDismissed(false);
  }, [workerId]);

  // UI element
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  // UI element
  const [activityStatusFilter, setActivityStatusFilter] = useState('all');

  // Sub-modal states
  const [editingLog, setEditingLog] = useState(null);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isQuickAttendanceOpen, setIsQuickAttendanceOpen] = useState(false);
  const [isEditWorkerModalOpen, setIsEditWorkerModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrRevoked, setQrRevoked] = useState(false);

  const describeLinkError = (err) => {
    const msg = String(err?.message || '');
    if (!navigator.onLine) return c.qrNeedInternet;
    if (err?.code === 'PGRST202' || /Could not find the function/i.test(msg)) {
      return c.qrNotConfigured;
    }
    if (/not authenticated/i.test(msg)) {
      return c.qrNeedAdmin;
    }
    if (/worker not found/i.test(msg)) {
      return c.qrWorkerNotSynced;
    }
    if (/not allowed/i.test(msg)) {
      return c.qrNotAuthorized;
    }
    return msg || c.qrUnknownError;
  };

  // Opening the dialog does NOT create a link (creating one deactivates the previous link)
  const handleOpenQRModal = () => {
    setQrUrl('');
    setQrError('');
    setQrRevoked(false);
    setIsQRModalOpen(true);
  };

  const handleCreateLink = async () => {
    setQrBusy(true);
    setQrError('');
    setQrRevoked(false);
    try {
      const { url } = await createWorkerAccessLink(workerId);
      setQrUrl(url);
    } catch (err) {
      console.error('Error creating worker access link', err);
      setQrError(describeLinkError(err));
    } finally {
      setQrBusy(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!window.confirm(c.revokeConfirm)) return;
    setQrBusy(true);
    setQrError('');
    try {
      await revokeWorkerAccessLinks(workerId);
      setQrUrl('');
      setQrRevoked(true);
    } catch (err) {
      console.error('Error revoking worker access link', err);
      setQrError(describeLinkError(err));
    } finally {
      setQrBusy(false);
    }
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live queries for this specific worker
  const worker = useLiveQuery(async () => {
    if (!workerId) return null;
    return await db.workers.get(workerId);
  }, [workerId]);

  const group = useLiveQuery(async () => {
    if (!worker?.groupId) return null;
    return await db.groups.get(worker.groupId);
  }, [worker?.groupId]);

  const allLogs = useLiveQuery(async () => {
    if (!workerId) return [];
    const logs = await db.attendanceLogs.where('workerId').equals(workerId).toArray();
    return logs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [workerId]) || [];

  const allPayments = useLiveQuery(async () => {
    if (!workerId) return [];
    const w = await db.workers.get(workerId);
    const payments = await db.payments.toArray();
    return payments
      .filter((p) => !p.deletedAt && p.status !== 'deleted' && (
        String(p.workerId) === String(workerId) || 
        (w?.groupId && p.isGroupSettlement && p.groupId === w.groupId)
      ))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [workerId, worker?.groupId]) || [];

  // All workers & groups for settlement modal pass-through
  const allWorkers = useLiveQuery(() => db.workers.toArray()) || [];
  const allGroups = useLiveQuery(() => db.groups.toArray()) || [];

  const allLoans = useLiveQuery(async () => {
    if (!workerId || !db.loans) return [];
    const list = await db.loans.where('workerId').equals(workerId).toArray();
    return list.filter((l) => !l.deletedAt).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [workerId]) || [];

  const activeWorkerLoans = useMemo(() => {
    return allLoans.filter((l) => l.status === 'active' && (Number(l.remainingBalance) || 0) > 0);
  }, [allLoans]);

  const loanMetrics = useMemo(() => {
    let totalPrincipal = 0;
    let totalRepayable = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let totalMonthlyInstallment = 0;

    activeWorkerLoans.forEach((l) => {
      totalPrincipal += Number(l.principalAmount) || 0;
      totalRepayable += Number(l.totalRepayable) || 0;
      totalPaid += Number(l.totalPaid) || 0;
      totalRemaining += Number(l.remainingBalance) || 0;
      totalMonthlyInstallment += Number(l.monthlyInstallment) || 0;
    });

    return {
      activeCount: activeWorkerLoans.length,
      totalPrincipal,
      totalRepayable,
      totalPaid,
      totalRemaining,
      totalMonthlyInstallment
    };
  }, [activeWorkerLoans]);

  // Metrics computation using single source of truth
  const stats = useMemo(() => {
    if (!worker) {
      return {
        unsettledDaysCount: 0,
        unsettledFullDays: 0,
        unsettledHalfDays: 0,
        unsettledHourlyDays: 0,
        unsettledOvertimeHours: 0,
        unsettledGrossPay: 0,
        settledDaysCount: 0,
        settledGrossPay: 0,
        settledOvertimeHours: 0,
        unsettledAdvances: 0,
        settledAdvances: 0,
        settlementsReceived: 0,
        netBalanceDue: 0,
        totalDaysWorked: 0,
        totalGrossEarnedAllTime: 0
      };
    }

    const fin = calculateWorkerFinancials(worker, allLogs, allPayments, currency, allLoans);
    if (!fin) {
      return {
        unsettledDaysCount: 0,
        unsettledFullDays: 0,
        unsettledHalfDays: 0,
        unsettledHourlyDays: 0,
        unsettledOvertimeHours: 0,
        unsettledGrossPay: 0,
        settledDaysCount: 0,
        settledGrossPay: 0,
        settledOvertimeHours: 0,
        unsettledAdvances: 0,
        settledAdvances: 0,
        settlementsReceived: 0,
        netBalanceDue: 0,
        totalDaysWorked: 0,
        totalGrossEarnedAllTime: 0
      };
    }

    return {
      unsettledDaysCount: fin.unsettledLogs.length,
      unsettledFullDays: fin.fullDays,
      unsettledHalfDays: fin.halfDays,
      unsettledHourlyDays: fin.hourlyDays,
      unsettledOvertimeHours: fin.otHours,
      unsettledGrossPay: fin.unsettledGross,
      settledDaysCount: fin.settledLogs.length,
      settledGrossPay: fin.totalSettlementPaid,
      settledOvertimeHours: fin.settledOtHours,
      unsettledAdvances: fin.unsettledAdvances,
      settledAdvances: fin.settledAdvances,
      settlementsReceived: fin.totalSettlementPaid,
      netBalanceDue: fin.netBalanceDue,
      totalDaysWorked: allLogs.length,
      totalGrossEarnedAllTime: fin.unsettledGross + fin.settledGross,
      isMonthlyWage: fin.isMonthlyWage,
      presentDaysCount: fin.presentDaysCount,
      leaveDaysCount: fin.leaveDaysCount,
      absentDaysCount: fin.absentDaysCount,
      unusedLeaveDays: fin.unusedLeaveDays,
      absenceDeduction: fin.absenceDeduction,
      fridayExtraPay: fin.fridayExtraPay,
      encashmentPay: fin.encashmentPay
    };
  }, [worker, allLogs, allPayments, currency, allLoans]);

  // Filtered attendance logs
  const fin = useMemo(() => {
    if (!worker) return null;
    return calculateWorkerFinancials(worker, allLogs, allPayments, currency, allLoans);
  }, [worker, allLogs, allPayments, currency, allLoans]);

  const [isRepairingSettled, setIsRepairingSettled] = useState(false);
  const handleRepairSuspiciousLogs = async () => {
    const bad = fin?.suspiciousSettledLogs || [];
    if (bad.length === 0) return;
    if (!window.confirm(c.revertConfirm(bad.length))) return;
    setIsRepairingSettled(true);
    try {
      const now = new Date().toISOString();
      const fixed = bad.map((l) => {
        let cleanNotes = (l.notes || '').trim();
        if (cleanNotes.includes('__META__')) {
          const match = cleanNotes.match(/__META__([\s\S]*?)__META__/);
          if (match && match[1]) {
            try {
              const metaObj = JSON.parse(match[1]);
              delete metaObj.rid;
              delete metaObj.st;
              if (Object.keys(metaObj).length > 0) {
                cleanNotes = `__META__${JSON.stringify(metaObj)}__META__\n${cleanNotes.replace(/__META__[\s\S]*?__META__/, '').trim()}`.trim();
              } else {
                cleanNotes = cleanNotes.replace(/__META__[\s\S]*?__META__/, '').trim();
              }
            } catch (_) {}
          }
        }
        return {
          ...l,
          isSettled: false,
          settlementReceiptId: null,
          notes: cleanNotes,
          updatedAt: now
        };
      });
      await db.attendanceLogs.bulkPut(fixed);
      await pushLogsLive(fixed).catch(console.warn);
    } finally {
      setIsRepairingSettled(false);
    }
  };

  // Detect unsettled logs from previous months (prior cycle before leave / reactivation)
  const currentMonthPrefix = getCurrentYearMonth();
  const pastCycleUnsettledLogs = useMemo(() => {
    if (!fin?.unsettledLogs) return [];
    return fin.unsettledLogs.filter((l) => (l.date || '').slice(0, 7) < currentMonthPrefix);
  }, [fin?.unsettledLogs, currentMonthPrefix]);

  const [isSettlingPastCycle, setIsSettlingPastCycle] = useState(false);
  const handleSettlePastCycleLogs = async () => {
    if (pastCycleUnsettledLogs.length === 0) return;
    if (!window.confirm(c.revertConfirmPastCycle(pastCycleUnsettledLogs.length))) return;
    setIsSettlingPastCycle(true);
    try {
      const now = new Date().toISOString();
      const settlementRecordId = `settled_prior_cycle_${worker.id}_${Date.now()}`;
      const updatedLogs = pastCycleUnsettledLogs.map((l) => ({
        ...l,
        isSettled: true,
        settlementReceiptId: settlementRecordId,
        updatedAt: now
      }));
      await db.attendanceLogs.bulkPut(updatedLogs);
      await pushLogsLive(updatedLogs).catch(console.warn);
    } catch (e) {
      console.error('Error settling past cycle logs:', e);
    } finally {
      setIsSettlingPastCycle(false);
    }
  };

  // UI element
  const combinedActivityEvents = useMemo(() => {
    if (!worker) return [];

    const events = [];

    // UI element
    allLogs.forEach((l) => {
      const isSettled = fin?.isLogSettled(l);
      events.push({
        id: `log_${l.id}`,
        kind: 'attendance',
        rawDate: l.date || '',
        date: l.date || '',
        data: l,
        isSettled,
        type: l.type,
        amount: Number(l.totalDayPay) || 0,
        title: l.type === 'half' ? c.logHalfDayTitle : l.type === 'hourly' ? c.logHourlyTitle : c.logFullDayTitle,
        notes: l.notes,
        overtimeHours: l.overtimeHours
      });
    });

    // UI element
    allPayments
      .filter((p) => (p.type || '').toLowerCase() !== 'settlement' && !p.deletedAt)
      .forEach((p) => {
        const isBonus = (p.type || '').toLowerCase() === 'bonus' || (p.type || '').toLowerCase() === 'eid';
        const isSettled = isBonus ? true : fin?.isPaymentSettled(p);
        events.push({
          id: `pay_${p.id}`,
          kind: isBonus ? 'bonus' : 'advance',
          rawDate: p.date || p.createdAt || '',
          date: p.date || p.createdAt || '',
          data: p,
          isSettled,
          type: isBonus ? (c.bonusBadge || 'عیدی و پاداش') : (p.type || c.advance),
          amount: Number(p.amount) || 0,
          title: isBonus ? (c.bonusPaymentTitle || 'سند پرداخت عیدی و پاداش') : c.advancePaymentTitle,
          notes: p.notes
        });
      });

    // UI element
    allPayments
      .filter((p) => (p.type || '').toLowerCase() === 'settlement' && !p.deletedAt)
      .forEach((st) => {
        events.push({
          id: `set_${st.id}`,
          kind: 'settlement',
          rawDate: st.date || st.createdAt || '',
          date: st.date || st.createdAt || '',
          data: st,
          isSettled: true,
          type: c.finalSettlement,
          amount: Number(st.amount) || 0,
          title: c.settlementDocumentTitle,
          notes: st.notes
        });
      });

    // Staff Loans
    allLoans.forEach((ln) => {
      events.push({
        id: `loan_${ln.id}`,
        kind: 'loan',
        rawDate: ln.createdAt || ln.startDate || '',
        date: (ln.createdAt || ln.startDate || '').slice(0, 10),
        data: ln,
        isSettled: ln.status === 'settled',
        type: c.loansTab,
        amount: Number(ln.principalAmount) || 0,
        title: c.loanEventTitle(formatCurrency(ln.totalRepayable, currency, language), ln.remainingMonths),
        notes: ln.notes || `${c.monthlyInstallmentLabel} ${formatCurrency(ln.monthlyInstallment, currency, language)}`
      });
    });

    // UI element
    events.sort((a, b) => (b.rawDate || '').localeCompare(a.rawDate || ''));

    // UI element
    return events.filter((ev) => {
      if (activityTypeFilter !== 'all' && ev.kind !== activityTypeFilter) return false;
      if (activityStatusFilter === 'unsettled' && ev.isSettled) return false;
      if (activityStatusFilter === 'settled' && !ev.isSettled) return false;
      return true;
    });
  }, [worker, allLogs, allPayments, allLoans, fin, activityTypeFilter, activityStatusFilter, currency, language]);

  // UI element
  const activityCounts = useMemo(() => {
    const totalLogs = allLogs.length;
    const totalAdvances = allPayments.filter((p) => (p.type || '').toLowerCase() !== 'settlement' && !p.deletedAt).length;
    const totalSettlements = allPayments.filter((p) => (p.type || '').toLowerCase() === 'settlement' && !p.deletedAt).length;
    const totalLoans = allLoans.length;
    return {
      all: totalLogs + totalAdvances + totalSettlements + totalLoans,
      attendance: totalLogs,
      advances: totalAdvances,
      settlements: totalSettlements,
      loans: totalLoans
    };
  }, [allLogs, allPayments, allLoans]);

  if (!isOpen || !workerId) return null;

  const modalContent = (
    <div 
      dir={direction}
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-[#f3f6f4] dark:bg-slate-950 flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden select-none"
    >
      {/* Modal Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          <div className="flex items-center justify-between gap-2.5 sm:gap-4">
            {/* Left: Avatar + Worker Info */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-lg shadow-sky-500/25 border border-white/60 dark:border-slate-800">
                  {worker?.name ? worker.name.charAt(0) : <User className="w-5 h-5 sm:w-6 sm:h-6" />}
                </div>
                <span 
                  className={`absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-xs ${
                    worker?.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} 
                  title={worker?.isActive !== false ? c.active : c.inactive}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">
                    {worker?.name || '...'}
                  </h2>
                  {worker?.role && (
                    <span className="px-2 py-0.5 rounded-lg sm:rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60 text-[10px] sm:text-xs font-bold">
                      {worker.role}
                    </span>
                  )}
                  {group?.name && (
                    <span className="hidden xs:inline-flex px-2 py-0.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] sm:text-xs font-semibold items-center gap-1">
                      <Layers className="w-3 h-3 text-sky-500" />
                      <span>{group.name}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  {worker?.phone ? (
                    <a 
                      href={`tel:${worker.phone}`} 
                      className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-mono font-bold transition-colors"
                      title={c.phoneCallTitle}
                    >
                      <Phone className="w-3 h-3" />
                      <span>{worker.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 text-[10px] sm:text-xs">{c.noPhone}</span>
                  )}

                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  {worker?.wageType === 'monthly' ? (
                    <span>
                      {language === 'fa' ? 'حقوق ماهانه:' : language === 'ku' ? 'مووچەی مانگانە:' : 'Monthly Salary:'}{' '}
                      <strong className="text-slate-900 dark:text-white font-mono font-bold">
                        {formatCurrency(worker?.monthlySalary || 0, currency, language)}
                      </strong>
                    </span>
                  ) : (
                    <span>
                      {c.dailyRateLabel}{' '}
                      <strong className="text-slate-900 dark:text-white font-mono font-bold">
                        {formatCurrency(worker?.dailyRate || 0, currency, language)}
                      </strong>
                    </span>
                  )}
                  
                  {Number(worker?.overtimeHourlyRate) > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                      <span className="hidden sm:inline">{c.overtimePrefix} <strong className="text-slate-900 dark:text-white font-mono font-bold">{formatCurrency(worker.overtimeHourlyRate, currency, language)}</strong>{c.perHourSuffix}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions (More Tools & Close in same row) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* More Tools Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(prev => !prev)}
                  aria-label={c.moreToolsTitle}
                  title={c.moreToolsTitle}
                  className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 border shadow-xs cursor-pointer ${
                    isMoreMenuOpen
                      ? 'bg-primary text-white border-primary shadow-primary/20'
                      : 'bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {isMoreMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsMoreMenuOpen(false)} 
                    />
                    <div className="absolute end-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200/90 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsQuickAttendanceOpen(true);
                        }}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
                      >
                        <CalendarCheck className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>{c.quickMonthlyLogging}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('karsync-open-subsidiary-ledger', {
                              detail: {
                                id: worker.id,
                                name: worker.name,
                                type: 'worker',
                                role: worker.role || c.defaultWorkerRole
                              }
                            })
                          );
                        }}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-purple-500 shrink-0" />
                        <span>{c.viewLedger}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleOpenQRModal();
                        }}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
                      >
                        <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>{c.workerLoginLinkAndQR}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label={c.closeEsc}
                title={c.closeEsc}
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all duration-150 active:scale-95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Continuous Scroll Area (Hero + Banners + Content) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Suspicious Settled Logs Warning */}
        {fin?.suspiciousSettledLogs?.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex-1 text-amber-900 dark:text-amber-200 leading-relaxed">
                <b>{c.financialWarning}</b> {c.suspiciousLogsDesc(
                  fin.suspiciousSettledLogs.length,
                  fin.suspiciousSettledLogs.slice(0, 5).map((l) => l.date).join(c.commaSeparator),
                  fin.suspiciousSettledLogs.length > 5,
                  fin.lastSettlementDate
                )}
              </div>
              <button
                type="button"
                disabled={isRepairingSettled}
                onClick={handleRepairSuspiciousLogs}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                {isRepairingSettled ? c.repairing : c.revertToCurrentLogs}
              </button>
            </div>
          </div>
        )}

        {/* Past Cycle Unsettled Logs Banner (Dismissible) */}
        {!isPastCycleDismissed && pastCycleUnsettledLogs.length > 0 && (
          <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-300 dark:border-sky-800 relative">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 pe-12 sm:pe-12 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <div className="text-sky-900 dark:text-sky-200 leading-relaxed font-medium">
                  {c.pastCycleNotice(
                    pastCycleUnsettledLogs.length,
                    `\u2066${pastCycleUnsettledLogs[0]?.date?.slice(0, 7) || 'دوره قبل'}\u2069`
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={isSettlingPastCycle}
                onClick={handleSettlePastCycleLogs}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-bold shrink-0 cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5 text-xs whitespace-nowrap self-start sm:self-auto"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSettlingPastCycle ? c.settlingPastCycle : c.settlePastCycleBtn(pastCycleUnsettledLogs.length)}</span>
              </button>
            </div>
            {/* Dismiss Banner Button */}
            <button
              type="button"
              onClick={() => setIsPastCycleDismissed(true)}
              aria-label={c.closeBtn}
              title={c.closeBtn}
              className="absolute top-2.5 end-2.5 sm:top-3 sm:end-3 p-1 rounded-lg text-sky-700/80 dark:text-sky-300 hover:bg-sky-200/50 dark:hover:bg-sky-900/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Hero Card (Inside Scrollable Container) */}
        <div className="no-print px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4">
          <div className="max-w-7xl mx-auto w-full relative overflow-hidden rounded-3xl p-4 sm:p-6 backdrop-blur-2xl bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-white border border-white/10 shadow-2xl">
            {/* Background ambient glow */}
            <div className="absolute top-0 right-1/4 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-center">
              {/* Left: Account Status & Balance */}
              <div className="lg:col-span-7 space-y-2 sm:space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${stats.netBalanceDue >= 0 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'}`} />
                    <span className={stats.netBalanceDue >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {stats.netBalanceDue >= 0 ? c.accountStatusCreditor : c.accountStatusDebtor}
                    </span>
                  </span>
                  <span className="text-slate-500 hidden xs:inline">•</span>
                  <span className="text-slate-300 text-[11px] sm:text-xs">
                    {c.unsettledDaysPending(stats.unsettledDaysCount)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block mb-0.5 sm:mb-1">{c.finalNetPayableBalance}</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl sm:text-3xl md:text-4xl font-black font-mono tracking-tight ${
                      stats.netBalanceDue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`} dir="ltr">
                      {formatCurrency(stats.netBalanceDue, currency, language)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: 3 KPI Cards */}
              <div className="lg:col-span-5 grid grid-cols-3 gap-2 sm:gap-2.5 bg-white/5 p-2.5 sm:p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
                {/* Current Work Gross */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                  <span className="text-[10px] sm:text-xs text-slate-400 block font-medium leading-tight">{c.currentWorkGross}</span>
                  <div className="mt-1">
                    <span className="text-xs sm:text-sm font-black font-mono text-slate-100 block" dir="ltr">
                      +{formatAmount(stats.unsettledGrossPay)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-normal block">
                      {getCurrencySymbol(currency, language)}
                    </span>
                  </div>
                </div>

                {/* Advances */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
                  <span className="text-[10px] sm:text-xs text-amber-300 block font-medium leading-tight">{c.advancesMinus}</span>
                  <div className="mt-1">
                    <span className="text-xs sm:text-sm font-black font-mono text-amber-400 block" dir="ltr">
                      -{formatAmount(stats.unsettledAdvances)}
                    </span>
                    <span className="text-[9px] text-amber-300/80 font-normal block">
                      {getCurrencySymbol(currency, language)}
                    </span>
                  </div>
                </div>

                {/* Total Settled */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex flex-col justify-between">
                  <span className="text-[10px] sm:text-xs text-sky-300 block font-medium leading-tight">{c.totalSettledHistory}</span>
                  <div className="mt-1">
                    <span className="text-xs sm:text-sm font-black font-mono text-sky-400 block" dir="ltr">
                      {formatAmount(stats.settledGrossPay)}
                    </span>
                    <span className="text-[9px] text-sky-300/80 font-normal block">
                      {getCurrencySymbol(currency, language)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full p-3.5 sm:p-6 lg:p-8 pb-32">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* UI element */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* UI element */}
              <div className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-500" />
                    <span>{c.workTermsAndWage}</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">
                    {worker?.teamRole === 'master' ? c.masterRole : c.workerRole}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {worker?.wageType === 'monthly' ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-500 dark:text-slate-400">
                          {language === 'fa' ? 'حقوق ثابت ماهانه:' : language === 'ku' ? 'مووچەی مانگانە:' : 'Monthly Salary:'}
                        </span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                          {formatCurrency(worker?.monthlySalary || 0, currency, language)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-500 dark:text-slate-400">
                          {language === 'fa' ? 'مرخصی مجاز ماهانه:' : language === 'ku' ? 'مۆڵەتی ڕێگەپێدراو:' : 'Monthly Paid Leave:'}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {worker?.monthlyLeaveDays ?? 2} {language === 'fa' ? 'روز در ماه' : language === 'ku' ? 'ڕۆژ لە مانگدا' : 'days/mo'}
                          {Number(worker?.bonusLeaveDays) > 0 && (
                            <span className="text-sky-600 text-[10px] ms-1">
                              (+{worker.bonusLeaveDays} {language === 'fa' ? 'تشویقی' : 'پاداشت'})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-500 dark:text-slate-400">
                          {language === 'fa' ? 'سیاست مرخصی باقی‌مانده:' : language === 'ku' ? 'سیستەمی مۆڵەت:' : 'Unused Leave Policy:'}
                        </span>
                        <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                          {worker?.leavePolicy === 'encash'
                            ? (language === 'fa' ? 'تسویه و بازخرید در حقوق' : language === 'ku' ? 'پارەدان لەگەڵ مووچە' : 'Encash in Payroll')
                            : worker?.leavePolicy === 'expire'
                            ? (language === 'fa' ? 'سوختن در پایان ماه' : language === 'ku' ? 'بەتاڵبوونەوە' : 'Expire at Month End')
                            : (language === 'fa' ? 'انباشت و ذخیره برای ماه‌های آتی' : language === 'ku' ? 'کەڵەکەبوون بۆ مانگەکانی تر' : 'Accumulate')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-500 dark:text-slate-400">
                          {language === 'fa' ? 'ضریب کارکرد جمعه:' : language === 'ku' ? 'ڕێژەی کاری هەینی:' : 'Friday Multiplier:'}
                        </span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {worker?.fridayRateMultiplier ?? 2.0}x
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-500 dark:text-slate-400">{c.baseDailyWageLabel}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(worker?.dailyRate || 0, currency, language)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">{c.overtimeHourlyRateLabel}</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                      {formatCurrency(worker?.overtimeHourlyRate || 0, currency, language)}{c.perHourSuffix}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">{c.standardHoursLabel}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {worker?.standardHours || 8} {c.hoursUnit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 dark:text-slate-400">{c.startDateLabel}</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {worker?.startDate ? formatFullDateWithWeekday(worker.startDate, language) : c.notRecorded}
                    </span>
                  </div>
                </div>
              </div>

              {/* UI element */}
              <div className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-500" />
                    <span>{c.currentWorkBreakdown}</span>
                  </h4>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                    {c.workDaysCount(stats.unsettledDaysCount)}
                  </span>
                </div>

                {worker?.wageType === 'monthly' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-center">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-0.5">
                        {language === 'fa' ? 'حاضر' : language === 'ku' ? 'ئامادە' : 'Present'}
                      </span>
                      <span className="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono">
                        {stats.presentDaysCount || stats.unsettledFullDays || 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-center">
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 block mb-0.5">
                        {language === 'fa' ? 'مرخصی باحقوق' : language === 'ku' ? 'مۆڵەت' : 'Leave'}
                      </span>
                      <span className="text-base font-black text-sky-600 dark:text-sky-400 font-mono">
                        {stats.leaveDaysCount || 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-center">
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 block mb-0.5">
                        {language === 'fa' ? 'غایب (کسر حقوق)' : language === 'ku' ? 'غائیب' : 'Absent'}
                      </span>
                      <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
                        {stats.absentDaysCount || 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-center">
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 block mb-0.5">{c.overtime}</span>
                      <span className="text-xs font-black text-purple-600 dark:text-purple-400 font-mono">
                        {formatHoursAndMinutes(stats.unsettledOvertimeHours)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block mb-0.5">{c.fullDay}</span>
                      <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
                        {stats.unsettledFullDays}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-center">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block mb-0.5">{c.halfDay}</span>
                      <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                        {stats.unsettledHalfDays}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-center">
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 block mb-0.5">{c.hourly}</span>
                      <span className="text-base font-black text-purple-600 dark:text-purple-400 font-mono">
                        {stats.unsettledHourlyDays}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-center">
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 block mb-0.5">{c.overtime}</span>
                      <span className="text-xs font-black text-sky-600 dark:text-sky-400 font-mono">
                        {formatHoursAndMinutes(stats.unsettledOvertimeHours)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* UI element */}
              {worker?.notes && (
                <div className="p-4 rounded-3xl bg-amber-50/70 dark:bg-amber-950/30 backdrop-blur-md border border-amber-200/70 dark:border-amber-900/40 shadow-xs space-y-1">
                  <h4 className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{c.workerNotes}</span>
                  </h4>
                  <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    {worker.notes}
                  </p>
                </div>
              )}

              {/* Active Staff Loans Card (Apple Liquid Glass) */}
              {loanMetrics.activeCount > 0 && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 backdrop-blur-md border border-blue-200/80 dark:border-blue-900/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-blue-200/60 dark:border-blue-900/40">
                    <h4 className="text-xs font-black text-blue-900 dark:text-blue-200 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>{c.activeLoanSummaryTitle}</span>
                    </h4>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold font-mono">
                      {loanMetrics.activeCount} {language === 'fa' ? 'وام فعال' : language === 'ku' ? 'قەرزی چالاک' : 'Active'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-blue-100 dark:border-blue-900/30">
                      <span className="text-slate-600 dark:text-slate-400">{c.totalLoanAmount}</span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                        {formatCurrency(loanMetrics.totalRepayable, currency, language)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-blue-100 dark:border-blue-900/30">
                      <span className="text-slate-600 dark:text-slate-400">{c.totalRepaid}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(loanMetrics.totalPaid, currency, language)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-blue-100 dark:border-blue-900/30">
                      <span className="text-slate-600 dark:text-slate-400">{c.loanRemainingBalance}</span>
                      <span className="font-mono font-black text-blue-700 dark:text-blue-300">
                        {formatCurrency(loanMetrics.totalRemaining, currency, language)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400">{c.monthlyInstallmentLabel}</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(loanMetrics.totalMonthlyInstallment, currency, language)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>{c.loanRepaymentProgress}</span>
                        <span className="font-mono">
                          {loanMetrics.totalRepayable > 0 
                            ? Math.min(100, Math.round((loanMetrics.totalPaid / loanMetrics.totalRepayable) * 100))
                            : 0}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                          style={{
                            width: `${loanMetrics.totalRepayable > 0 ? Math.min(100, Math.round((loanMetrics.totalPaid / loanMetrics.totalRepayable) * 100)) : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* UI element */}
            <div className="lg:col-span-7 space-y-3.5">
              
              {/* UI element */}
              <div className="p-3 sm:px-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-2.5">
                {/* UI element */}
                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto custom-scrollbar">
                  {[
                    { id: 'all', label: c.allTab, count: activityCounts.all },
                    { id: 'attendance', label: c.attendanceTab, count: activityCounts.attendance },
                    { id: 'advance', label: c.advancesTab, count: activityCounts.advances },
                    { id: 'settlement', label: c.settlementsTab, count: activityCounts.settlements },
                    { id: 'loan', label: c.loansTab, count: activityCounts.loans }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setActivityTypeFilter(chip.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        activityTypeFilter === chip.id
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{chip.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        activityTypeFilter === chip.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {chip.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* UI element */}
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActivityStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                      activityStatusFilter === 'all'
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >{c.allFilter}</button>
                  <button
                    type="button"
                    onClick={() => setActivityStatusFilter('unsettled')}
                    className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                      activityStatusFilter === 'unsettled'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-amber-600'
                    }`}
                  >{c.currentFilter}</button>
                  <button
                    type="button"
                    onClick={() => setActivityStatusFilter('settled')}
                    className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                      activityStatusFilter === 'settled'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-emerald-600'
                    }`}
                  >{c.archiveFilter}</button>
                </div>
              </div>

              {/* UI element */}
              {combinedActivityEvents.length === 0 ? (
                <div className="py-16 text-center rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-xs">
                  <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-1">{c.noRecordsInFilter}</h4>
                  <p className="text-xs text-slate-400">{c.canLogNewActivityTip}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {combinedActivityEvents.map((ev) => {
                    const isAttendance = ev.kind === 'attendance';
                    const isAdvance = ev.kind === 'advance';
                    const isSettlement = ev.kind === 'settlement';

                    return (
                      <div
                        key={ev.id}
                        className={`p-3.5 sm:p-4 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:shadow-md ${
                          isSettlement
                            ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-800/60'
                            : ev.isSettled
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-200/60 dark:border-emerald-800/40'
                            : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-white/60 dark:border-slate-800/80'
                        }`}
                      >
                        {/* UI element */}
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${
                            isSettlement
                              ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                              : isAdvance
                              ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                              : 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300'
                          }`}>
                            {isSettlement ? (
                              <Receipt className="w-5 h-5" />
                            ) : isAdvance ? (
                              <DollarSign className="w-5 h-5" />
                            ) : (
                              <Calendar className="w-5 h-5" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {formatFullDateWithWeekday(ev.date, language)}
                              </span>

                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                isSettlement
                                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
                                  : isAdvance
                                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                                  : 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300'
                              }`}>
                                {isSettlement
                                  ? c.finalSettlement
                                  : isAdvance
                                  ? c.advance
                                  : ev.type === 'leave'
                                  ? (language === 'fa' ? 'مرخصی باحقوق' : language === 'ku' ? 'مۆڵەت' : 'Paid Leave')
                                  : ev.type === 'absent'
                                  ? (language === 'fa' ? 'غایب' : language === 'ku' ? 'غائیب' : 'Absent')
                                  : ev.type === 'present'
                                  ? (language === 'fa' ? 'حاضر' : language === 'ku' ? 'ئامادە' : 'Present')
                                  : (ev.type === 'half' ? c.halfDay : ev.type === 'hourly' ? c.hourly : c.fullDay)}
                              </span>

                              {ev.isSettled ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>{c.settled}</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200/60">
                                  {c.unsettledCurrent}
                                </span>
                              )}
                            </div>

                            {/* UI element */}
                            {isAttendance && Number(ev.overtimeHours) > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>{c.overtimeHoursLabel(formatHoursAndMinutes(ev.overtimeHours))}</span>
                              </div>
                            )}

                            {ev.notes && (
                              <p className="text-[11px] text-slate-400 italic mt-0.5 truncate max-w-sm">
                                "{ev.notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* UI element */}
                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          <div className="text-end">
                            <span className="text-[10px] text-slate-400 block">
                              {isSettlement ? c.settlementAmountLabel : isAdvance ? c.advancePaymentLabel : c.grossWageLabel}
                            </span>
                            <span className={`font-mono font-black text-sm sm:text-base ${
                              isSettlement ? 'text-purple-600 dark:text-purple-400' : isAdvance ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`} dir="ltr">
                              {isAdvance ? `-${formatCurrency(ev.amount, currency, language)}` : `+${formatCurrency(ev.amount, currency, language)}`}
                            </span>
                          </div>

                          {isAttendance && (
                            <button
                              type="button"
                              onClick={() => setEditingLog(ev.data)}
                              className="p-2 rounded-xl text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title={ev.isSettled ? c.viewLockedRecord : c.editRecord}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

          </div>

        </div>
      </div>

      {/* Responsive Footer */}
      <div className="no-print fixed bottom-0 start-0 end-0 z-30 p-2.5 sm:p-3 sm:px-6 lg:px-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
        {/* Row 1 on mobile, left side on desktop: Balance & Personnel Details */}
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{c.workerAccountBalance}</span>
            <span className={`text-sm sm:text-lg font-black font-mono tracking-tight ${
              stats.netBalanceDue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`} dir="ltr">
              {formatCurrency(stats.netBalanceDue, currency, language)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
              stats.netBalanceDue >= 0
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
            }`}>
              {stats.netBalanceDue >= 0 ? c.creditor : c.debtor}
            </span>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{c.workerIdLabel}</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
              {worker?.personnelCode || worker?.code || worker?.id?.slice(0, 12)}
            </span>
          </div>
        </div>

        {/* Row 2 on mobile, right side on desktop: Action Buttons */}
        <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2">
          {/* Add Advance Button */}
          <button
            type="button"
            onClick={() => setIsAdvanceModalOpen(true)}
            className="h-10 px-2 sm:px-4 rounded-xl sm:rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
          >
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{c.addAdvanceBtn}</span>
          </button>

          {/* Settle Account Button */}
          <button
            type="button"
            onClick={() => setIsSettlementModalOpen(true)}
            className="h-10 px-2 sm:px-4 rounded-xl sm:rounded-2xl bg-primary text-white hover:bg-primary/90 text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>{language === 'fa' ? 'تسویه‌حساب' : c.settleAccountBtn}</span>
          </button>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-2 sm:px-4 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>{c.closeBtn}</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-mono">
              ESC
            </kbd>
          </button>
        </div>
      </div>

      {/* Sub-Modal: Edit Record Modal */}
      {editingLog && (
        <EditRecordModal
          isOpen={Boolean(editingLog)}
          log={editingLog}
          worker={worker}
          currency={currency}
          onClose={() => setEditingLog(null)}
          onSuccess={() => setEditingLog(null)}
        />
      )}

      {/* Sub-Modal: Quick Advance Payment Modal */}
      {isAdvanceModalOpen && (
        <AdvancePaymentModal
          isOpen={isAdvanceModalOpen}
          targetWorkerId={worker?.id}
          workers={allWorkers}
          onClose={() => setIsAdvanceModalOpen(false)}
        />
      )}

      {/* Sub-Modal: Quick Month Attendance */}
      {isQuickAttendanceOpen && (
        <QuickMonthAttendanceModal
          worker={worker}
          isOpen={isQuickAttendanceOpen}
          onClose={() => setIsQuickAttendanceOpen(false)}
        />
      )}

      {/* Sub-Modal: Settlement Modal for this worker */}
      {isSettlementModalOpen && (
        <SettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          worker={worker}
          allWorkers={allWorkers}
          allGroups={allGroups}
          allLogs={allLogs}
          allPayments={allPayments}
          onSelectWorker={() => {}}
        />
      )}

      {/* Personal access link / QR Code Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">{c.workerPortalTitle}</h3>
              <button 
                onClick={() => setIsQRModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                {c.workerPortalDesc(worker?.name || '')}
              </p>

              {qrUrl ? (
                <>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 inline-block">
                    <QRCodeSVG value={qrUrl} size={180} level="M" includeMargin={false} />
                  </div>

                  <p className="mt-4 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                    {c.workerPortalWarning}
                  </p>

                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(qrUrl);
                      alert(c.linkCopiedAlert);
                    }}
                    className="mt-4 w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-sm transition-colors"
                  >
                    {c.copyLinkBtn}
                  </button>

                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      onClick={() => {
                        navigator.share({ title: c.shareTitle, url: qrUrl }).catch(() => {});
                      }}
                      className="mt-2 w-full py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-sm transition-colors"
                    >
                      {c.shareBtn}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {qrRevoked && (
                    <p className="mb-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {c.revokeAlert}
                    </p>
                  )}
                  <button
                    onClick={handleCreateLink}
                    disabled={qrBusy}
                    className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors"
                  >
                    {qrBusy ? c.pleaseWait : c.generateLinkBtn}
                  </button>
                  <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                    {c.generateLinkWarning}
                  </p>
                </>
              )}

              {qrError && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400 leading-relaxed">{qrError}</p>
              )}

              <button
                onClick={handleRevokeLink}
                disabled={qrBusy}
                className="mt-5 text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-60"
              >
                {c.revokeAccessBtn}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default WorkerProfileModal;
