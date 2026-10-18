import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { supabase, pullRemoteChangesSilently } from '../services/realtimeSync';
import { refreshWorkerPortalData, getStoredWorkerAccessToken } from '../services/workerAccess';
import {
  formatAmount,
  getCurrentYearMonth,
  roundCurrency,
  getCurrencySymbol,
  formatMonthOnly
} from '../utils/formatters';
import { calculateWorkerFinancials } from '../utils/settlementCalculations.js';
import {
  User,
  LogOut,
  Calendar,
  Clock,
  Coins,
  Printer,
  ChevronRight,
  ChevronLeft,
  Sun,
  Sunrise,
  Moon,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  WalletCards,
  Receipt,
  Users,
  Search,
  Layers,
  Sparkles,
  X,
  RefreshCw,
  Globe,
  Bell,
  BellRing,
  Check,
  Smartphone
} from 'lucide-react';

// Format decimal hours into H:MM clock format (e.g., 1.333 -> 1:20, 1.5 -> 1:30)
function formatOvertimeClock(hoursVal) {
  const num = Number(hoursVal) || 0;
  const totalMinutes = Math.round(num * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Extract day of month number (e.g. "2026-10-16" -> "16")
function getDayOfMonthNumber(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const dayNum = parseInt(parts[2], 10);
    if (!isNaN(dayNum)) return String(dayNum);
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return String(d.getDate());
  } catch {
    // fallback
  }
  return dateStr;
}

// Format YYYY-MM or YYYY-MM-DD into localized "MonthName YYYY" (e.g. "اکتبر 2026")
function formatMonthWithYear(dateOrMonthStr, lang = 'fa') {
  if (!dateOrMonthStr) return '';
  const parts = String(dateOrMonthStr).split('-');
  if (parts.length < 2) return dateOrMonthStr;
  const ym = `${parts[0]}-${parts[1]}`;
  const mName = formatMonthOnly(ym, lang);
  return mName ? `${mName} ${parts[0]}` : ym;
}


const PORTAL_COPY = {
  fa: {
    // Navigation & Dropdown
    myPersonalAccount: 'حساب و کارکرد شخصی من',
    groupManagement: 'پنل سرپرستی گروه',
    allTab: 'سوابق و کل کارکرد',
    currentTab: 'کارکرد جاری و معوقه',
    settledTab: 'سوابق تسویه‌شده',
    allGroupMembers: 'همه اعضای گروه (نمای تجمیعی)',
    totalGroupMembers: 'کل پرسنل گروه',
    totalGroupDue: 'مجموع مطالبات معوقه گروه',
    totalGroupDays: 'مجموع روزهای کاری گروه',
    totalGroupOt: 'مجموع اضافه‌کاری گروه',
    archivedMemberNotice: 'این پرسنل توسط مدیریت بایگانی شده، اما کلیه سوابق مالی و کارکرد وی در دسترس است.',
    archivedBadge: 'بایگانی‌شده',
    masterRole: 'استادکار (سرپرست)',
    workerRoleLabel: 'کارگر',
    unsettledBadge: 'جاری / معوقه',
    settledBadge: 'تسویه‌شده',
    searchLogsPlaceholder: 'جستجو بر اساس تاریخ، نام یا توضیحات...',
    fullDayLabel: 'روز کامل',
    halfDayLabel: 'نیم‌روز',
    hourlyLabel: 'ساعتی',
    overtimeLabel: 'اضافه‌کاری',
    dateColTitle: 'تاریخ',
    workerNameColTitle: 'نام نیرو',
    workTypeColTitle: 'نوع کار',
    totalDayColTitle: 'مجموع کل روز',
    statusColTitle: 'وضعیت',
    notesColTitle: 'توضیحات',
    daysUnit: 'روز',
    loadingPersonnel: 'در حال بارگذاری پرونده پرسنلی...',
    activeProjectFallback: 'پروژه فعال',
    allGroupMembersFallback: 'کل اعضای گروه',
    groupFallback: 'گروه',

    // Browser & Push Notifications
    browserNotSupportedTitle: 'عدم پشتیبانی مرورگر',
    browserNotSupportedMsg: 'مرورگر دستگاه شما از اعلان خارجی سیستم‌عامل پشتیبانی نمی‌کند.',
    notifEnabledTitle: 'اعلان موبایل فعال شد',
    notifEnabledMsg: 'هنگام ثبت کارکرد یا تسویه‌حساب جدید، حتی اگر برنامه بسته باشد به شما پیام داده می‌شود.',
    notifEnabledOsTitle: 'نوتیفیکیشن موبایل فعال شد • KarSync',
    notifEnabledOsBody: 'هر زمان کارکرد یا تسویه‌حسابی برای شما ثبت شود، بلافاصله روی موبایل مطلع خواهید شد.',
    notifPermissionDeniedTitle: 'مجوز نوتیفیکیشن رد شد',
    notifPermissionDeniedMsg: 'لطفاً از تنظیمات مرورگر موبایل، مجوز ارسال اعلان (Notifications) را فعال کنید.',
    osNotifActive: 'اعلان خارجی موبایل فعال شد',
    osNotifInactive: 'اعلان خارجی موبایل غیرفعال شد',
    osNotifActiveDesc: 'اعلان‌های ثبت کارکرد و تسویه‌حساب در پس‌زمینه موبایل ارسال خواهند شد.',
    osNotifInactiveDesc: 'اعلان‌ها فقط در داخل پرتال نمایش داده می‌شوند.',
    offlineTitle: 'عدم اتصال به اینترنت',
    offlineMsg: 'اطلاعات ذخیره‌شده آفلاین نمایش داده می‌شود.',
    refreshSuccessTitle: 'بروزرسانی انجام شد',
    refreshSuccessMsg: 'آخرین اطلاعات کارکرد و مالی با موفقیت دریافت شد.',
    overtimeSuffix: 'اضافه‌کاری',

    // Realtime Notifications Callback
    rtSettlementTitle: 'ثبت تسویه‌حساب',
    rtAdvanceTitle: 'ثبت پرداختی / مساعده',
    rtSettlementBody: (amt, d) => `مبلغ ${amt} بابت تسویه‌حساب در تاریخ ${d} برای شما ثبت شد.`,
    rtAdvanceBody: (amt, d) => `مبلغ ${amt} بابت مساعده در تاریخ ${d} برای شما ثبت شد.`,
    rtWorklogTitle: 'ثبت کارکرد روزانه',
    rtWorklogBody: (d, w, ot, p) => `کارکرد تاریخ ${d} (${w}${ot}) به مبلغ ${p} ثبت شد.`,
    rtNewWorklogTitle: 'ثبت کارکرد جدید',
    rtNewWorklogBody: (d, w, ot, p) => `کارکرد تاریخ ${d} (${w}${ot}) به مبلغ ${p} برای شما ثبت شد.`,
    rtSettleWorklogTitle: 'تسویه‌حساب کارکرد',
    rtSettleWorklogBody: (d) => `کارکرد تاریخ ${d} شما تسویه‌حساب شد.`,
    rtUpdateWorklogTitle: 'بروزرسانی کارکرد روزانه',
    rtUpdateWorklogBody: (d, w, p) => `کارکرد تاریخ ${d} (${w}) به مبلغ ${p} بروزرسانی شد.`,
    rtNewSettlementTitle: 'ثبت تسویه‌حساب جدید',
    rtNewAdvanceTitle: 'ثبت پرداختی / مساعده جدید',

    // Summary Cards
    workedDaysTitle: 'کل کارکرد',
    daysCountSub: (n) => `${n} روز کاری ثبت‌شده`,
    groupMembersCount: (n) => `${n} نفر عضو گروه`,
    titleEarningsTotal: 'کل حقوق و کارکرد ثبت‌شده',
    titleEarningsCurrent: 'حقوق کارکرد جاری',
    titleEarningsSettled: 'کل کارکرد تسویه‌شده',
    titleAdvancesTotal: 'کل دریافتی و تسویه‌شده',
    titleAdvancesCurrent: 'مساعده دریافتی جاری',
    titleAdvancesSettled: 'مجموع پرداختی تسویه‌شده',
    titleNetDue: 'مانده معوق طلب',
    titleGroupGrossWages: 'کل کارکرد ناخالص گروه',
    titleGroupGrossWagesCurrent: 'کارکرد جاری ناخالص گروه',
    titleGroupGrossWagesSettled: 'کارکرد تسویه‌شده گروه',
    titleGroupPaidAll: 'کل پرداختی و تسویه‌ها',
    titleGroupPaidCurrent: 'مساعده‌های جاری گروه',
    titleGroupPaidSettled: 'تسویه‌های پرداخت‌شده',
    titleSubordinateWages: 'کل حقوق کارکرد',
    titleSubordinateAdvancesAll: 'کل دریافتی و تسویه',
    titleSubordinateAdvancesCurrent: 'مساعده و دریافتی',
    titleSubordinateAdvancesSettled: 'مجموع تسویه‌شده',
    titleSubordinateNetDue: 'مانده معوق طلب',
    footerDescAll: 'مجموع کل حقوق و کارکرد ثبت‌شده (جاری و تسویه‌شده)',
    footerDescCurrent: 'مانده خالص طلب معوقه فعلی (پس از کسر مساعده‌های جاری)',
    footerDescSettled: 'مجموع کل مبالغ تسویه‌شده و دریافتی در سوابق تسویه',

    // Header & Popover
    portalSupervisor: 'پرتال سرپرست',
    portalWorker: 'پرتال پرسنل',
    refreshTooltip: 'بروزرسانی اطلاعات',
    notifsTooltip: 'اعلان‌های کارکرد و تسویه‌حساب',
    myNotifsHeader: 'اعلان‌های کارکرد و تسویه من',
    myNotifsSub: 'فقط اعلان‌های ثبت کارکرد و تسویه‌حساب اختصاصی شما',
    readAll: 'خواندن همه',
    osNotifHeader: 'نوتیفیکیشن خارجی موبایل',
    osNotifActiveSub: 'فعال (ارسال پیام حتی در زمان بسته بودن برنامه)',
    osNotifInactiveSub: 'دریافت پیام روی موبایل حتی وقتی برنامه باز نیست',
    activeCheck: 'فعال ✓',
    activateAction: 'فعالسازی',
    noNotifsEmpty: 'هنوز اعلانی برای ثبت کارکرد یا تسویه‌حساب ثبت نشده است.',
    mobileNotifMenu: 'اعلان کارکرد و تسویه در موبایل',
    statusActive: 'فعال',
    statusInactive: 'فعالسازی',
    appearanceTitle: 'حالت نمایش',
    themeLight: 'حالت روشن',
    themeDark: 'حالت تاریک',
    languageTitle: 'زبان برنامه',
    printPayslipMenu: 'چاپ فیش حقوقی و کارکرد',
    signOut: 'خروج از حساب کاربری',

    // Info Banner & Group Selection
    baseDailyRateLabel: 'نرخ پایه روزانه:',
    selectSubordinateLabel: 'انتخاب پرسنل زیرمجموعه جهت مشاهده کارکرد و حساب:',
    membersSuffix: 'نفر',
    badgeSettled: 'تسویه شده',
    badgeUnsettled: 'دارای معوقه پرداخت',
    clearedStatus: 'دریافت و تسویه شده',
    recordsInView: 'ردیف کارکرد در این نما',
    totalOtHours: 'مجموع ساعت اضافه',
    printAction: 'چاپ فیش',
    refreshAction: 'بروزرسانی',

    // Attendance Table & Reports
    reportMyAttendance: 'گزارش کارکرد من',
    reportGroupAttendance: 'گزارش کارکرد تجمیعی پرسنل گروه',
    reportAttendanceOf: (name) => `گزارش کارکرد ${name}`,
    filterAll: 'همه',
    filterFull: 'تمام‌وقت',
    filterHalf: 'نیمه‌وقت',
    filterOvertime: 'دارای اضافه‌کاری',
    noLogsEmpty: 'هیچ رکورد کارکردی در این بخش ثبت نشده است.',
    monthLabel: 'ماه',
    totalsTable: 'جمع کل کارکردهای لیست بالا:',
    recordsSuffix: 'ردیف',
    grandTotalLabel: 'مجموع کل:',

    // Payments & Advances Ledger & Signatures
    paymentsAndAdvancesPersonal: 'دفتر پرداخت‌ها و مساعده‌ها',
    paymentsAndAdvancesGroup: 'دفتر پرداخت‌ها و مساعده‌های گروه',
    transactionsCount: (n) => `${n} تراکنش ثبت‌شده`,
    noPaymentsEmpty: 'هیچ پرداخت یا مساعده‌ای در این دوره ثبت نشده است.',
    typeSettlement: 'تسویه حساب',
    typeAdvance: 'مساعده',
    sigWorkerOrSupervisor: 'امضای پرسنل / سرپرست',
    sigWorkshopManager: 'امضای مدیریت کارگاه'
  },

  ku: {
    // Navigation & Dropdown
    myPersonalAccount: 'حیساب و کارکردی کەسی من',
    groupManagement: 'بەڕێوەبردنی گرووپ',
    allTab: 'سەرجەم کارکرد و سوابق',
    currentTab: 'کارکردی ئێستا و قەرزی تەسویەنەکراو',
    settledTab: 'مێژووی تەسویەکراو',
    allGroupMembers: 'سەرجەم ئەندامانی گرووپ (کۆی گشتی)',
    totalGroupMembers: 'کۆی کرێکارانی گرووپ',
    totalGroupDue: 'کۆی شایستەی ماوەی گرووپ',
    totalGroupDays: 'کۆی ڕۆژەکانی گرووپ',
    totalGroupOt: 'کۆی کاتژمێری سەروەختی گرووپ',
    archivedMemberNotice: 'ئەم کرێکارە ئەرشیڤ کراوە بەڵام مێژووەکەی پارێزراوە.',
    archivedBadge: 'ئەرشیڤ کراو',
    masterRole: 'وەستا (سەرپەرشتیار)',
    workerRoleLabel: 'کرێکار',
    unsettledBadge: 'جاری / تەسویەنەکراو',
    settledBadge: 'تەسویەکراو',
    searchLogsPlaceholder: 'گەڕان بەپێی بەروار، ناو یان تێبینی...',
    fullDayLabel: 'ڕۆژی تەواو',
    halfDayLabel: 'نیو ڕۆژ',
    hourlyLabel: 'کاتژمێری',
    overtimeLabel: 'سەروەخت',
    dateColTitle: 'بەروار',
    workerNameColTitle: 'ناوی کرێکار',
    workTypeColTitle: 'جۆری کار',
    totalDayColTitle: 'کۆی ڕۆژ',
    statusColTitle: 'دۆخ',
    notesColTitle: 'تێبینی',
    daysUnit: 'ڕۆژ',
    loadingPersonnel: 'زانیارییەکان لە دیتابەیس دەخوێندرێنەوە...',
    activeProjectFallback: 'پڕۆژەی چالاک',
    allGroupMembersFallback: 'سەرجەم ئەندامانی گرووپ',
    groupFallback: 'گرووپ',

    // Browser & Push Notifications
    browserNotSupportedTitle: 'پشتگیری ناکرێت',
    browserNotSupportedMsg: 'ئەم وێبگەڕە پشتگیری ئاگادارکردنەوەی دەرەکی ناکات.',
    notifEnabledTitle: 'ئاگادارکردنەوە چالاک کرا',
    notifEnabledMsg: 'لە کاتی تۆمارکردنی کارکرد یان تەسویەحیساب، پەیامت بۆ دێت.',
    notifEnabledOsTitle: 'ئاگادارکردنەوەی مۆبایل چالاک کرا • KarSync',
    notifEnabledOsBody: 'هەر کاتێک کارکرد یان تەسویەحیسابت بۆ تۆمار بکرێت ئاگادار دەکرێیتەوە.',
    notifPermissionDeniedTitle: 'دەستڕاگەیشتن ڕەتکرایەوە',
    notifPermissionDeniedMsg: 'تکایە لە ڕێکخستنەکانی مۆبایل مۆڵەتی ئاگادارکردنەوە بدە.',
    osNotifActive: 'ئاگادارکردنەوەی دەرەکی چالاک کرا',
    osNotifInactive: 'ئاگادارکردنەوەی دەرەکی ڕاگیرا',
    osNotifActiveDesc: 'پەیامەکانی کارکرد و تەسویە لەسەر مۆبایل پیشان دەدرێن.',
    osNotifInactiveDesc: 'تەنها لە ناو بەرنامەکەدا ئاگادارکردنەوەکان دەبینیت.',
    offlineTitle: 'هێڵی ئینتەرنێت نییە',
    offlineMsg: 'زانیارییە پاشەکەوتکراوەکان پیشان دەدرێن.',
    refreshSuccessTitle: 'نوێکرایەوە',
    refreshSuccessMsg: 'دوایین زانیارییەکان بە سەرکەوتوویی وەرگیران.',
    overtimeSuffix: 'سەروەخت',

    // Realtime Notifications Callback
    rtSettlementTitle: 'تۆمارکردنی تەسویەحیساب',
    rtAdvanceTitle: 'تۆمارکردنی پێشەکی (مساعده)',
    rtSettlementBody: (amt, d) => `بڕی ${amt} وەک تەسویەحیساب لە بەرواری ${d} بۆ تۆ تۆمار کرا.`,
    rtAdvanceBody: (amt, d) => `بڕی ${amt} وەک پێشەکی لە بەرواری ${d} بۆ تۆ تۆمار کرا.`,
    rtWorklogTitle: 'تۆمارکردنی کارکرد',
    rtWorklogBody: (d, w, ot, p) => `کارکردی ڕۆژی ${d} (${w}${ot}) بە بڕی ${p} تۆمار کرا.`,
    rtNewWorklogTitle: 'تۆمارکردنی کارکردی نوێ',
    rtNewWorklogBody: (d, w, ot, p) => `کارکردی ڕۆژی ${d} (${w}${ot}) بە بڕی ${p} بۆ تۆ تۆمار کرا.`,
    rtSettleWorklogTitle: 'تەسویەکردنی کارکرد',
    rtSettleWorklogBody: (d) => `کارکردی ڕۆژی ${d} تەسویە کرا.`,
    rtUpdateWorklogTitle: 'نوێکردنەوەی کارکرد',
    rtUpdateWorklogBody: (d, w, p) => `کارکردی ڕۆژی ${d} (${w}) بە بڕی ${p} نوێکرایەوە.`,
    rtNewSettlementTitle: 'تۆمارکردنی تەسویەحیسابی نوێ',
    rtNewAdvanceTitle: 'تۆمارکردنی پێشەکی (مساعده) نوێ',

    // Summary Cards
    workedDaysTitle: 'ڕۆژانی کارکردن',
    daysCountSub: (n) => `${n} ڕۆژی کاری تۆمارکراو`,
    groupMembersCount: (n) => `${n} ئەندام`,
    titleEarningsTotal: 'کۆی گشتی مووچەی کارکرد',
    titleEarningsCurrent: 'کارکردی ئێستا',
    titleEarningsSettled: 'کارکردی تەسویەکراو',
    titleAdvancesTotal: 'کۆی وەرگیراو و تەسویە',
    titleAdvancesCurrent: 'پێشەکی وەرگیراو',
    titleAdvancesSettled: 'کۆی تەسویەکراو',
    titleNetDue: 'ماوەی شایستەی وەرگرتن',
    titleGroupGrossWages: 'کۆی گشتی کارکردی گرووپ',
    titleGroupGrossWagesCurrent: 'کارکردی ئێستای گرووپ',
    titleGroupGrossWagesSettled: 'کارکردی تەسویەکراوی گرووپ',
    titleGroupPaidAll: 'کۆی پارەی دراو',
    titleGroupPaidCurrent: 'کۆی پێشەکییەکان',
    titleGroupPaidSettled: 'کۆی تەسویەی دراو',
    titleSubordinateWages: 'کۆی مووچەی کارکرد',
    titleSubordinateAdvancesAll: 'کۆی وەرگیراو',
    titleSubordinateAdvancesCurrent: 'پێشەکی',
    titleSubordinateAdvancesSettled: 'تەسویەکراو',
    titleSubordinateNetDue: 'ماوەی قەرز',
    footerDescAll: 'کۆی گشتی کارکرد و مووچەی تۆمارکراو (ئێستا و تەسویەکراو)',
    footerDescCurrent: 'پوختەی قەرز و شایستەی ماوە (دوای لێدەرکردنی پێشەکی)',
    footerDescSettled: 'کۆی گشتی مووچە و پارەی تەسویەکراوی پێشوو',

    // Header & Popover
    portalSupervisor: 'پۆرتالی سەرپەرشتیار',
    portalWorker: 'پۆرتالی کارمەند',
    refreshTooltip: 'نوێکردنەوەی زانیارییەکان',
    notifsTooltip: 'ئاگادارکردنەوەکانی کارکرد و تەسویە',
    myNotifsHeader: 'ئاگادارکردنەوەکانی من',
    myNotifsSub: 'تەنها کارکرد و تەسویەحیسابی تایبەت بە خۆت',
    readAll: 'خوێندنەوەی هەموو',
    osNotifHeader: 'ئاگادارکردنەوەی دەرەکی مۆبایل',
    osNotifActiveSub: 'چالاکە (تەنانەت کاتێک بەرنامەکە داخراوە)',
    osNotifInactiveSub: 'بۆ وەرگرتنی پەیام لەسەر مۆبایل چالاکی بکە',
    activeCheck: 'چالاکە ✓',
    activateAction: 'چالاککردن',
    noNotifsEmpty: 'هیچ ئاگادارکردنەوەیەکی نوێ نییە.',
    mobileNotifMenu: 'ئاگادارکردنەوەی دەرەکی مۆبایل',
    statusActive: 'چالاک',
    statusInactive: 'ناچالاک',
    appearanceTitle: 'ڕووکاری بەرنامە',
    themeLight: 'ڕۆژ',
    themeDark: 'شەو',
    languageTitle: 'زمانی سیستم',
    printPayslipMenu: 'چاپکردنی پسوولەی مووچە',
    signOut: 'چوونەدەرەوە',

    // Info Banner & Group Selection
    baseDailyRateLabel: 'مووچەی ڕۆژانە:',
    selectSubordinateLabel: 'دیاریکردنی کرێکار بۆ بینینی کارکرد و حسابات:',
    membersSuffix: 'ئەندام',
    badgeSettled: 'تەسویەکراو',
    badgeUnsettled: 'قەرزی ماوە',
    clearedStatus: 'وەرگیراو و تەسویەکراو',
    recordsInView: 'تۆماری کارکرد لەم بەشەدا',
    totalOtHours: 'کۆی کاتژمێری سەروەخت',
    printAction: 'چاپکردن',
    refreshAction: 'نوێکردنەوە',

    // Attendance Table & Reports
    reportMyAttendance: 'ڕاپۆرتی کارکردی من',
    reportGroupAttendance: 'ڕاپۆرتی گشتی کارکردی ئەندامانی گرووپ',
    reportAttendanceOf: (name) => `ڕاپۆرتی کارکردی ${name}`,
    filterAll: 'هەموو',
    filterFull: 'ڕۆژی تەواو',
    filterHalf: 'نیو ڕۆژ',
    filterOvertime: 'سەروەختدار',
    noLogsEmpty: 'هیچ تۆمارێکی کارکردن لەم بەشەدا نییە.',
    monthLabel: 'مانگی',
    totalsTable: 'کۆی گشتی ئەم خشتەیە:',
    recordsSuffix: 'تۆمار',
    grandTotalLabel: 'کۆی گشتی:',

    // Payments & Advances Ledger & Signatures
    paymentsAndAdvancesPersonal: 'دەفتەری پارەدان و پێشەکییەکان',
    paymentsAndAdvancesGroup: 'تۆماری پارەدان و مساعدەی گرووپ',
    transactionsCount: (n) => `${n} تۆمار`,
    noPaymentsEmpty: 'هیچ پارەدان یان پێشەکییەک لەم ماوەیەدا تۆمار نەکراوە.',
    typeSettlement: 'تەسویەی حیساب',
    typeAdvance: 'پێشەکی (مساعدە)',
    sigWorkerOrSupervisor: 'واژۆی کارمەند / سەرپەرشتیار',
    sigWorkshopManager: 'واژۆی بەڕێوەبەری کارگە'
  },

  en: {
    // Navigation & Dropdown
    myPersonalAccount: 'My Personal Account',
    groupManagement: 'Group Supervision',
    allTab: 'All Records',
    currentTab: 'Current Open',
    settledTab: 'Settled History',
    allGroupMembers: 'All Group Members',
    totalGroupMembers: 'Total Group Members',
    totalGroupDue: 'Total Group Net Due',
    totalGroupDays: 'Group Total Days',
    totalGroupOt: 'Group Overtime Hours',
    archivedMemberNotice: 'This worker is archived, but history is preserved.',
    archivedBadge: 'Archived',
    masterRole: 'Master (Supervisor)',
    workerRoleLabel: 'Worker',
    unsettledBadge: 'Open',
    settledBadge: 'Settled',
    searchLogsPlaceholder: 'Search by date, name or notes...',
    fullDayLabel: 'Full Day',
    halfDayLabel: 'Half Day',
    hourlyLabel: 'Hourly',
    overtimeLabel: 'Overtime',
    dateColTitle: 'Date',
    workerNameColTitle: 'Worker',
    workTypeColTitle: 'Work Type',
    totalDayColTitle: 'Total Pay',
    statusColTitle: 'Status',
    notesColTitle: 'Notes',
    daysUnit: 'days',
    loadingPersonnel: 'Loading personnel file...',
    activeProjectFallback: 'Active Project',
    allGroupMembersFallback: 'All Group Members',
    groupFallback: 'Group',

    // Browser & Push Notifications
    browserNotSupportedTitle: 'Browser Unsupported',
    browserNotSupportedMsg: 'Your browser does not support system push notifications.',
    notifEnabledTitle: 'Mobile Notifications Enabled',
    notifEnabledMsg: 'You will receive notifications for new worklogs or settlements even when the app is closed.',
    notifEnabledOsTitle: 'Mobile Notifications Enabled • KarSync',
    notifEnabledOsBody: 'You will be notified immediately when worklogs or settlements are recorded for you.',
    notifPermissionDeniedTitle: 'Notification Permission Denied',
    notifPermissionDeniedMsg: 'Please enable notifications permission in your mobile browser settings.',
    osNotifActive: 'Mobile Push Notifications Activated',
    osNotifInactive: 'Mobile Push Notifications Deactivated',
    osNotifActiveDesc: 'Work and settlement notifications will be sent in the mobile background.',
    osNotifInactiveDesc: 'Notifications will only appear inside the portal.',
    offlineTitle: 'No Internet Connection',
    offlineMsg: 'Showing cached local records.',
    refreshSuccessTitle: 'Synchronized',
    refreshSuccessMsg: 'Latest attendance and financial records loaded.',
    overtimeSuffix: 'Overtime',

    // Realtime Notifications Callback
    rtSettlementTitle: 'Settlement Recorded',
    rtAdvanceTitle: 'Payment / Advance Recorded',
    rtSettlementBody: (amt, d) => `Settlement of ${amt} recorded on ${d} for you.`,
    rtAdvanceBody: (amt, d) => `Advance payment of ${amt} recorded on ${d} for you.`,
    rtWorklogTitle: 'Daily Worklog Recorded',
    rtWorklogBody: (d, w, ot, p) => `Worklog for ${d} (${w}${ot}) recorded with amount ${p}.`,
    rtNewWorklogTitle: 'New Worklog Recorded',
    rtNewWorklogBody: (d, w, ot, p) => `Worklog for ${d} (${w}${ot}) recorded for you with amount ${p}.`,
    rtSettleWorklogTitle: 'Worklog Settled',
    rtSettleWorklogBody: (d) => `Your worklog for ${d} has been settled.`,
    rtUpdateWorklogTitle: 'Worklog Updated',
    rtUpdateWorklogBody: (d, w, p) => `Worklog for ${d} (${w}) updated to amount ${p}.`,
    rtNewSettlementTitle: 'New Settlement Recorded',
    rtNewAdvanceTitle: 'New Payment / Advance Recorded',

    // Summary Cards
    workedDaysTitle: 'Worked Days',
    daysCountSub: (n) => `${n} work days recorded`,
    groupMembersCount: (n) => `${n} group members`,
    titleEarningsTotal: 'Total Gross Wages',
    titleEarningsCurrent: 'Current Period Wages',
    titleEarningsSettled: 'Total Settled Wages',
    titleAdvancesTotal: 'Total Received & Settled',
    titleAdvancesCurrent: 'Current Advances',
    titleAdvancesSettled: 'Settled Payouts',
    titleNetDue: 'Net Balance Due',
    titleGroupGrossWages: 'Group Total Gross Wages',
    titleGroupGrossWagesCurrent: 'Group Current Gross Wages',
    titleGroupGrossWagesSettled: 'Group Settled Gross Wages',
    titleGroupPaidAll: 'Group Total Payouts & Advances',
    titleGroupPaidCurrent: 'Group Current Advances',
    titleGroupPaidSettled: 'Group Settled Payouts',
    titleSubordinateWages: 'Total Gross Wages',
    titleSubordinateAdvancesAll: 'Total Received & Settled',
    titleSubordinateAdvancesCurrent: 'Advances',
    titleSubordinateAdvancesSettled: 'Total Settled',
    titleSubordinateNetDue: 'Net Balance Due',
    footerDescAll: 'Grand total of all recorded wages and worklogs (open and settled)',
    footerDescCurrent: 'Current net unsettled balance due (after deducting advances)',
    footerDescSettled: 'Total sum of previously settled and paid compensation',

    // Header & Popover
    portalSupervisor: 'Supervisor Portal',
    portalWorker: 'Worker Portal',
    refreshTooltip: 'Refresh Data',
    notifsTooltip: 'Attendance & Settlement Notifications',
    myNotifsHeader: 'My Notifications',
    myNotifsSub: 'Only your personal worklog and settlement notifications',
    readAll: 'Mark all as read',
    osNotifHeader: 'Mobile OS Push Notifications',
    osNotifActiveSub: 'Active (alerts sent even when app is closed)',
    osNotifInactiveSub: 'Receive alerts on mobile even when app is not open',
    activeCheck: 'Active ✓',
    activateAction: 'Activate',
    noNotifsEmpty: 'No worklog or settlement notifications yet.',
    mobileNotifMenu: 'Mobile OS Notifications',
    statusActive: 'Active',
    statusInactive: 'Inactive',
    appearanceTitle: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    languageTitle: 'Language',
    printPayslipMenu: 'Print Payslip & Timesheet',
    signOut: 'Sign Out',

    // Info Banner & Group Selection
    baseDailyRateLabel: 'Base Daily Rate:',
    selectSubordinateLabel: 'Select group member to inspect work and account:',
    membersSuffix: 'members',
    badgeSettled: 'Settled',
    badgeUnsettled: 'Balance Due',
    clearedStatus: 'Cleared',
    recordsInView: 'records in view',
    totalOtHours: 'Total OT Hours',
    printAction: 'Print Payslip',
    refreshAction: 'Refresh',

    // Attendance Table & Reports
    reportMyAttendance: 'My Attendance Report',
    reportGroupAttendance: 'Group Cumulative Attendance Report',
    reportAttendanceOf: (name) => `Attendance Report: ${name}`,
    filterAll: 'All',
    filterFull: 'Full Day',
    filterHalf: 'Half Day',
    filterOvertime: 'With Overtime',
    noLogsEmpty: 'No work records found in this section.',
    monthLabel: 'Month',
    totalsTable: 'Summary totals for above list:',
    recordsSuffix: 'records',
    grandTotalLabel: 'Grand Total:',

    // Payments & Advances Ledger & Signatures
    paymentsAndAdvancesPersonal: 'Payments & Advances Ledger',
    paymentsAndAdvancesGroup: 'Group Payments & Advances Ledger',
    transactionsCount: (n) => `${n} transactions`,
    noPaymentsEmpty: 'No payments or advances recorded in this period.',
    typeSettlement: 'Settlement',
    typeAdvance: 'Advance',
    sigWorkerOrSupervisor: 'Worker / Supervisor Signature',
    sigWorkshopManager: 'Workshop Management Signature'
  }
};

export function WorkerViewPortal({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const { language, changeLanguage, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const pc = PORTAL_COPY[langKey] || PORTAL_COPY.fa;
  const { addToast } = useNotifications();

  // Mode for supervisors: 'personal' (حساب و کارکرد شخصی من) | 'group' (پنل سرپرستی گروه)
  const [portalMode, setPortalMode] = useState('personal');

  // Subordinate selection in group mode: 'all' or workerId
  const [selectedSubordinateId, setSelectedSubordinateId] = useState('all');

  // Period Tab: 'all' (سوابق و کل کارکرد) | 'current' (کارکرد جاری و معوقه) | 'settled' (سوابق تسویه‌شده)
  const [periodTab, setPeriodTab] = useState('all');

  // Quick Filter for attendance log types: 'all' | 'full' | 'half' | 'overtime'
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  // Refreshing state for manual sync button
  const [isRefreshing, setIsRefreshing] = useState(false);

  // User/Settings Dropdown & Worker Notification Bell Popover states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Worker-scoped notification state (STRICTLY only this worker's attendance & settlements)
  const workerNotifStorageKey = `karsync_worker_notifs_v1_${user?.workerId || 'anon'}`;
  const workerSnapshotStorageKey = `karsync_worker_snapshot_v1_${user?.workerId || 'anon'}`;
  const workerPushStorageKey = `karsync_worker_push_enabled_${user?.workerId || 'anon'}`;

  const [workerNotifications, setWorkerNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(`karsync_worker_notifs_v1_${user?.workerId || 'anon'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const [workerPushEnabled, setWorkerPushEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(`karsync_worker_push_enabled_${user?.workerId || 'anon'}`);
      if (saved !== null) return JSON.parse(saved);
      return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
    } catch {
      return false;
    }
  });

  // Persist worker notifications per workerId
  useEffect(() => {
    if (!user?.workerId) return;
    try {
      localStorage.setItem(workerNotifStorageKey, JSON.stringify(workerNotifications.slice(0, 40)));
    } catch {
      // ignore storage quota errors
    }
  }, [workerNotifications, workerNotifStorageKey, user?.workerId]);

  useEffect(() => {
    if (!user?.workerId) return;
    try {
      localStorage.setItem(workerPushStorageKey, JSON.stringify(workerPushEnabled));
    } catch {
      // ignore
    }
  }, [workerPushEnabled, workerPushStorageKey, user?.workerId]);

  // Month navigation for historical settled records
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());

  // Timesheet search input
  const [searchQuery, setSearchQuery] = useState('');

  // Close dropdown & notification popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    }
    if (isDropdownOpen || isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isDropdownOpen, isNotifOpen]);

  // Helper: Send Mobile / OS Native Notification via Service Worker (works even when app is in background on mobile)
  const sendMobileOsNotification = useCallback(async ({ title, body, tag }) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            icon: '/karsync-icon-192.png',
            badge: '/karsync-icon.png',
            tag: tag || `karsync_worker_${Date.now()}`,
            renotify: true,
            vibrate: [200, 100, 200],
            data: { url: '/#portal', workerOnly: true }
          });
          return;
        }
      }
    } catch {
      // Fallback to window Notification below
    }

    try {
      new Notification(title, {
        body,
        icon: '/karsync-icon.png',
        tag: tag || `karsync_worker_${Date.now()}`
      });
    } catch {
      // Ignore if mobile browser requires SW showNotification
    }
  }, []);

  // Helper: Sync worker state to Service Worker IndexedDB & register background sync for closed-app notifications
  const syncWorkerStateToServiceWorker = useCallback(
    async ({ logSigs, paymentIds, enabled, currSymbol }) => {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !user?.workerId) return;
      try {
        const token = getStoredWorkerAccessToken();
        const payload = {
          enabled: Boolean(enabled && Notification.permission === 'granted'),
          token: token || null,
          workerId: user.workerId,
          supabaseUrl: 'https://akeferuiyijsmgmjqnqc.supabase.co',
          supabaseKey: 'sb_publishable_mDz14UqQ3Qukv5RmWPlsVg_uxQg0XQk',
          language,
          currencySymbol: currSymbol || (language === 'fa' ? 'د.ع' : language === 'ku' ? 'د.ع' : 'IQD'),
          initialized: true,
          knownLogSigs: logSigs || {},
          knownPaymentIds: paymentIds || [],
          updatedAt: Date.now()
        };

        const reg = await navigator.serviceWorker.ready;
        if (reg?.active) {
          reg.active.postMessage({ type: 'SYNC_WORKER_SW_STATE', payload });
        }

        if (payload.enabled && reg) {
          if ('periodicSync' in reg) {
            try {
              await reg.periodicSync.register('karsync-worker-bg-check', {
                minInterval: 15 * 60 * 1000
              });
            } catch {
              // Periodic sync optional on browsers without permission
            }
          }
          if ('sync' in reg) {
            try {
              await reg.sync.register('karsync-worker-sync');
            } catch {
              // Background sync optional
            }
          }
        }
      } catch {
        // Ignore SW messaging errors
      }
    },
    [user?.workerId, language]
  );

  // Request or toggle external mobile notification permission for the worker
  const handleToggleWorkerPush = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      addToast({
        type: 'warning',
        workerPortal: true,
        force: true,
        title: pc.browserNotSupportedTitle,
        message: pc.browserNotSupportedMsg
      });
      return;
    }

    if (Notification.permission !== 'granted') {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === 'granted') {
          setWorkerPushEnabled(true);
          addToast({
            type: 'success',
            workerPortal: true,
            force: true,
            title: pc.notifEnabledTitle,
            message: pc.notifEnabledMsg
          });
          await sendMobileOsNotification({
            title: pc.notifEnabledOsTitle,
            body: pc.notifEnabledOsBody,
            tag: 'karsync_worker_push_enabled'
          });
        } else {
          setWorkerPushEnabled(false);
          addToast({
            type: 'error',
            workerPortal: true,
            force: true,
            title: pc.notifPermissionDeniedTitle,
            message: pc.notifPermissionDeniedMsg
          });
        }
      } catch {
        // ignore
      }
      return;
    }

    const nextState = !workerPushEnabled;
    setWorkerPushEnabled(nextState);
    addToast({
      type: nextState ? 'success' : 'info',
      workerPortal: true,
      force: true,
      title: nextState ? pc.osNotifActive : pc.osNotifInactive,
      message: nextState ? pc.osNotifActiveDesc : pc.osNotifInactiveDesc
    });
  }, [workerPushEnabled, language, addToast, sendMobileOsNotification]);

  // Manual & background refresh handler
  const triggerRefresh = useCallback(
    async (showFeedback = false) => {
      if (!navigator.onLine) {
        if (showFeedback) {
          addToast({
            type: 'warning',
            workerPortal: true,
            title: pc.offlineTitle,
            message: pc.offlineMsg
          });
        }
        return;
      }

      if (showFeedback) setIsRefreshing(true);
      const isLinkSession = user?.via === 'access-link';

      try {
        if (!isLinkSession) {
          await pullRemoteChangesSilently(true);
        } else {
          const res = await refreshWorkerPortalData();
          if (!res.success && (res.error === 'invalid_token' || res.error === 'account_blocked')) {
            logout();
            return;
          }
        }
        if (showFeedback) {
          addToast({
            type: 'success',
            workerPortal: true,
            title: pc.refreshSuccessTitle,
            message: pc.refreshSuccessMsg
          });
        }
      } catch {
        // Ignore silent background errors
      } finally {
        if (showFeedback) setIsRefreshing(false);
      }
    },
    [user?.via, logout, addToast, language]
  );

  // Continuous background polling (every 25s) + visibilitychange + online + Realtime subscription
  useEffect(() => {
    let lastRun = 0;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRun < 15000) return;
      lastRun = now;
      triggerRefresh(false);
    };

    refresh();

    const intervalId = setInterval(() => {
      refresh();
    }, 25000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onOnline = () => refresh();

    const onSwMessage = (event) => {
      if (event.data?.type === 'WORKER_NOTIFICATION_CLICKED') {
        triggerRefresh(false);
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }

    // Also subscribe to Supabase Realtime changes for this worker's attendance_logs and payments
    let channel = null;
    if (user?.workerId && supabase) {
      try {
        channel = supabase
          .channel(`worker_portal_live_${user.workerId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'attendance_logs', filter: `worker_id=eq.${user.workerId}` },
            () => triggerRefresh(false)
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'payments', filter: `worker_id=eq.${user.workerId}` },
            () => triggerRefresh(false)
          )
          .subscribe();
      } catch {
        // Ignore realtime subscription errors
      }
    }

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
      if (channel && supabase) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [triggerRefresh, user?.workerId]);

  // 1. Live Queries from Dexie
  const worker = useLiveQuery(
    () => (user?.workerId ? db.workers.get(user.workerId) : null),
    [user?.workerId]
  );

  const project = useLiveQuery(
    () => db.projects.get(worker?.projectId || DEFAULT_PROJECT_ID),
    [worker?.projectId]
  );
  const currency = project?.currency || 'IQD';

  const allWorkers = useLiveQuery(() => db.workers.toArray()) || [];
  const allGroups = useLiveQuery(() => db.groups.toArray()) || [];
  const allLogs = useLiveQuery(() => db.attendanceLogs.toArray()) || [];
  const allPayments = useLiveQuery(() => db.payments.toArray()) || [];

  // Strict Worker-Only Attendance & Settlement Notification Detector
  useEffect(() => {
    if (!user?.workerId || !worker) return;
    const workerIdStr = String(user.workerId);

    // Strictly filter ONLY this worker's own attendance logs and payments
    const myLogs = allLogs.filter((l) => !l.deletedAt && String(l.workerId) === workerIdStr);
    const myPayments = allPayments.filter((p) => !p.deletedAt && String(p.workerId) === workerIdStr);

    if (myLogs.length === 0 && myPayments.length === 0) return;

    const currSym = getCurrencySymbol(currency, language);
    const getWorkTypeText = (t) => {
      if (t === 'full') return pc.fullDayLabel;
      if (t === 'half') return pc.halfDayLabel;
      return pc.hourlyLabel;
    };

    const nextLogSigs = {};
    myLogs.forEach((l) => {
      nextLogSigs[l.id] = `${l.type || 'full'}|${Number(l.overtimeHours) || 0}|${Number(l.totalDayPay) || 0}|${l.isSettled ? 1 : 0}`;
    });
    const nextPayIds = myPayments.map((p) => p.id);

    let prevSnapshot = null;
    try {
      const raw = localStorage.getItem(workerSnapshotStorageKey);
      if (raw) prevSnapshot = JSON.parse(raw);
    } catch {
      prevSnapshot = null;
    }

    // First time on this device: initialize baseline snapshot and seed recent history (marked as read)
    if (!prevSnapshot) {
      try {
        localStorage.setItem(
          workerSnapshotStorageKey,
          JSON.stringify({ logSigs: nextLogSigs, paymentIds: nextPayIds, updatedAt: Date.now() })
        );
      } catch {
        // ignore
      }

      setWorkerNotifications((existing) => {
        if (existing && existing.length > 0) return existing;
        const seeded = [];

        const recentPayments = [...myPayments]
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .slice(0, 3);
        recentPayments.forEach((p) => {
          const isSettle = p.type === 'settlement';
          seeded.push({
            id: `seed_pay_${p.id}`,
            category: isSettle ? 'settlement' : 'advance',
            date: p.date,
            title: isSettle ? pc.rtSettlementTitle : pc.rtAdvanceTitle,
            message: isSettle
              ? pc.rtSettlementBody(`${formatAmount(p.amount, currency)} ${currSym}`, p.date)
              : pc.rtAdvanceBody(`${formatAmount(p.amount, currency)} ${currSym}`, p.date),
            createdAt: p.createdAt || new Date().toISOString(),
            isRead: true,
            targetTab: isSettle ? 'settled' : 'current'
          });
        });

        const recentLogs = [...myLogs]
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .slice(0, 4);
        recentLogs.forEach((l) => {
          const wType = getWorkTypeText(l.type);
          const ot = Number(l.overtimeHours) || 0;
          seeded.push({
            id: `seed_log_${l.id}`,
            category: 'attendance',
            date: l.date,
            title: pc.rtWorklogTitle,
            message: pc.rtWorklogBody(l.date, wType, ot > 0 ? ` + ${formatOvertimeClock(ot)} ${pc.overtimeSuffix}` : '', `${formatAmount(l.totalDayPay, currency)} ${currSym}`),
            createdAt: l.createdAt || new Date().toISOString(),
            isRead: true,
            targetTab: l.isSettled ? 'settled' : 'current'
          });
        });

        return seeded.slice(0, 15);
      });

      syncWorkerStateToServiceWorker({
        logSigs: nextLogSigs,
        paymentIds: nextPayIds,
        enabled: workerPushEnabled,
        currSymbol: currSym
      });
      return;
    }

    // Compare current records against previous snapshot to detect NEW attendance logs or settlements
    const prevLogSigs = prevSnapshot.logSigs || {};
    const prevPayIds = new Set(prevSnapshot.paymentIds || []);
    const newlyDetected = [];

    myLogs.forEach((l) => {
      const sig = nextLogSigs[l.id];
      const prevSig = prevLogSigs[l.id];
      const wType = getWorkTypeText(l.type);
      const ot = Number(l.overtimeHours) || 0;

      if (!prevSig) {
        newlyDetected.push({
          id: `ntf_log_${l.id}_${Date.now()}`,
          category: 'attendance',
          date: l.date,
          title: pc.rtNewWorklogTitle,
          message: pc.rtNewWorklogBody(l.date, wType, ot > 0 ? ` + ${formatOvertimeClock(ot)} ${pc.overtimeSuffix}` : '', `${formatAmount(l.totalDayPay, currency)} ${currSym}`),
          createdAt: new Date().toISOString(),
          isRead: false,
          targetTab: 'current'
        });
      } else if (prevSig !== sig) {
        const wasSettled = prevSig.endsWith('|1');
        const isNowSettled = sig.endsWith('|1');
        if (!wasSettled && isNowSettled) {
          newlyDetected.push({
            id: `ntf_log_settled_${l.id}_${Date.now()}`,
            category: 'settlement',
            date: l.date,
            title: pc.rtSettleWorklogTitle,
            message: pc.rtSettleWorklogBody(l.date),
            createdAt: new Date().toISOString(),
            isRead: false,
            targetTab: 'settled'
          });
        } else {
          newlyDetected.push({
            id: `ntf_log_upd_${l.id}_${Date.now()}`,
            category: 'attendance',
            date: l.date,
            title: pc.rtUpdateWorklogTitle,
            message: pc.rtUpdateWorklogBody(l.date, wType, `${formatAmount(l.totalDayPay, currency)} ${currSym}`),
            createdAt: new Date().toISOString(),
            isRead: false,
            targetTab: isNowSettled ? 'settled' : 'current'
          });
        }
      }
    });

    myPayments.forEach((p) => {
      if (!prevPayIds.has(p.id)) {
        const isSettle = p.type === 'settlement';
        newlyDetected.push({
          id: `ntf_pay_${p.id}_${Date.now()}`,
          category: isSettle ? 'settlement' : 'advance',
          date: p.date,
          title: isSettle ? pc.rtNewSettlementTitle : pc.rtNewAdvanceTitle,
          message: isSettle
            ? pc.rtSettlementBody(`${formatAmount(p.amount, currency)} ${currSym}`, p.date)
            : pc.rtAdvanceBody(`${formatAmount(p.amount, currency)} ${currSym}`, p.date),
          createdAt: new Date().toISOString(),
          isRead: false,
          targetTab: isSettle ? 'settled' : 'current'
        });
      }
    });

    // Save updated snapshot
    try {
      localStorage.setItem(
        workerSnapshotStorageKey,
        JSON.stringify({ logSigs: nextLogSigs, paymentIds: nextPayIds, updatedAt: Date.now() })
      );
    } catch {
      // ignore
    }

    syncWorkerStateToServiceWorker({
      logSigs: nextLogSigs,
      paymentIds: nextPayIds,
      enabled: workerPushEnabled,
      currSymbol: currSym
    });

    if (newlyDetected.length > 0) {
      setWorkerNotifications((prev) => [...newlyDetected, ...prev].slice(0, 40));

      newlyDetected.slice(0, 2).forEach((notif) => {
        addToast({
          type: 'success',
          workerPortal: true,
          force: true,
          title: notif.title,
          message: notif.message,
          duration: 5500
        });

        if (workerPushEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          sendMobileOsNotification({
            title: `${notif.title} • KarSync`,
            body: notif.message,
            tag: notif.id
          });
        }
      });
    }
  }, [
    allLogs,
    allPayments,
    user?.workerId,
    worker,
    currency,
    language,
    workerSnapshotStorageKey,
    workerPushEnabled,
    addToast,
    sendMobileOsNotification,
    syncWorkerStateToServiceWorker
  ]);

  const unreadWorkerNotifCount = useMemo(
    () => workerNotifications.filter((n) => !n.isRead).length,
    [workerNotifications]
  );

  const markAllWorkerNotifsRead = useCallback(() => {
    setWorkerNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const markSingleWorkerNotifRead = useCallback((id, targetTab) => {
    setWorkerNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    if (targetTab) {
      setPeriodTab(targetTab);
    }
    setIsNotifOpen(false);
  }, []);

  // 2. Identify Worker Group & Supervisor Status
  const workerGroup = useMemo(() => {
    if (!worker?.groupId) return null;
    return allGroups.find((g) => String(g.id) === String(worker.groupId)) || null;
  }, [allGroups, worker?.groupId]);

  const isSupervisor = useMemo(() => {
    if (!worker) return false;
    const roleLower = (worker?.role || '').toLowerCase();
    const isMasterRole =
      worker?.teamRole === 'Master' ||
      roleLower.includes('سرپرست') ||
      roleLower.includes('استادکار') ||
      roleLower.includes('master') ||
      roleLower.includes('supervisor') ||
      roleLower.includes('سەرپەرشتیار') ||
      roleLower.includes('وەستا');
    return isMasterRole && !!worker?.groupId;
  }, [worker]);

  // Group members including active and archived workers
  const groupMembers = useMemo(() => {
    if (!worker?.groupId) return [];
    return allWorkers
      .filter((w) => w && !w.deletedAt && String(w.groupId) === String(worker.groupId))
      .sort((a, b) => {
        if (a?.teamRole === 'Master' && b?.teamRole !== 'Master') return -1;
        if (b?.teamRole === 'Master' && a?.teamRole !== 'Master') return 1;
        const aArchived = a.isArchived || a.status === 'archived';
        const bArchived = b.isArchived || b.status === 'archived';
        if (!aArchived && bArchived) return -1;
        if (aArchived && !bArchived) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [allWorkers, worker?.groupId]);

  // 3. Robust Financial Calculations
  const personalFinancials = useMemo(() => {
    if (!worker) return null;
    return calculateWorkerFinancials(worker, allLogs, allPayments, currency);
  }, [worker, allLogs, allPayments, currency]);

  const groupMembersFinancials = useMemo(() => {
    if (!isSupervisor || groupMembers.length === 0) return [];
    return groupMembers.map((m) => {
      const fin = calculateWorkerFinancials(m, allLogs, allPayments, currency);
      return {
        member: m,
        ...fin
      };
    });
  }, [isSupervisor, groupMembers, allLogs, allPayments, currency]);

  // Aggregated group totals across all dimensions
  const groupAggregates = useMemo(() => {
    let totalUnsettledGross = 0;
    let totalUnsettledAdvances = 0;
    let totalNetBalanceDue = 0;
    let totalEffectiveDays = 0;
    let totalOtHours = 0;

    let totalSettledGross = 0;
    let totalSettledAdvances = 0;
    let totalSettledPaid = 0;
    let totalSettledEffectiveDays = 0;
    let totalSettledOtHours = 0;

    let totalAllTimeGross = 0;
    let totalAllTimeEffectiveDays = 0;
    let totalAllTimeOtHours = 0;

    let activeCount = 0;
    let archivedCount = 0;

    groupMembersFinancials.forEach((item) => {
      const isArchived = item.member.isArchived || item.member.status === 'archived';
      if (isArchived) archivedCount++;
      else activeCount++;

      totalUnsettledGross += item.unsettledGross;
      totalUnsettledAdvances += item.unsettledAdvances;
      totalNetBalanceDue += item.netBalanceDue;
      totalEffectiveDays += item.effectiveDays;
      totalOtHours += item.otHours;

      totalSettledGross += item.settledGross;
      totalSettledAdvances += item.settledAdvances;
      totalSettledPaid += (item.totalSettlementPaid || 0) + (item.settledAdvances || 0);
      totalSettledEffectiveDays += item.settledEffectiveDays;
      totalSettledOtHours += item.settledOtHours;

      totalAllTimeGross += item.unsettledGross + item.settledGross;
      totalAllTimeEffectiveDays += item.effectiveDays + item.settledEffectiveDays;
      totalAllTimeOtHours += item.otHours + item.settledOtHours;
    });

    return {
      totalMembers: groupMembers.length,
      activeCount,
      archivedCount,
      totalUnsettledGross: roundCurrency(totalUnsettledGross, currency),
      totalUnsettledAdvances: roundCurrency(totalUnsettledAdvances, currency),
      totalNetBalanceDue: roundCurrency(totalNetBalanceDue, currency),
      totalEffectiveDays,
      totalOtHours,
      totalSettledGross: roundCurrency(totalSettledGross, currency),
      totalSettledAdvances: roundCurrency(totalSettledAdvances, currency),
      totalSettledPaid: roundCurrency(totalSettledPaid, currency),
      totalSettledEffectiveDays,
      totalSettledOtHours,
      totalAllTimeGross: roundCurrency(totalAllTimeGross, currency),
      totalAllTimeEffectiveDays,
      totalAllTimeOtHours
    };
  }, [groupMembersFinancials, groupMembers.length, currency]);

  const activeSubordinateData = useMemo(() => {
    if (selectedSubordinateId === 'all') return null;
    return groupMembersFinancials.find((gf) => String(gf.member.id) === String(selectedSubordinateId)) || null;
  }, [groupMembersFinancials, selectedSubordinateId]);

  // 4. Timesheet Logs to Display
  const displayedLogs = useMemo(() => {
    let list = [];
    if (portalMode === 'personal') {
      if (!personalFinancials) return [];
      if (periodTab === 'all') {
        list = [...personalFinancials.unsettledLogs, ...personalFinancials.settledLogs];
      } else if (periodTab === 'current') {
        list = personalFinancials.unsettledLogs;
      } else {
        list = personalFinancials.settledLogs;
      }
    } else {
      if (selectedSubordinateId === 'all') {
        groupMembersFinancials.forEach((gf) => {
          let logs = [];
          if (periodTab === 'all') {
            logs = [...gf.unsettledLogs, ...gf.settledLogs];
          } else if (periodTab === 'current') {
            logs = gf.unsettledLogs;
          } else {
            logs = gf.settledLogs;
          }
          logs.forEach((l) => {
            list.push({
              ...l,
              workerName: gf.member.name,
              workerRole: gf.member.role,
              workerDailyRate: gf.member.dailyRate,
              workerTeamRole: gf.member.teamRole,
              isWorkerArchived: gf.member.isArchived || gf.member.status === 'archived'
            });
          });
        });
      } else if (activeSubordinateData) {
        let logs = [];
        if (periodTab === 'all') {
          logs = [...activeSubordinateData.unsettledLogs, ...activeSubordinateData.settledLogs];
        } else if (periodTab === 'current') {
          logs = activeSubordinateData.unsettledLogs;
        } else {
          logs = activeSubordinateData.settledLogs;
        }
        logs.forEach((l) => {
          list.push({
            ...l,
            workerName: activeSubordinateData.member.name,
            workerRole: activeSubordinateData.member.role,
            workerDailyRate: activeSubordinateData.member.dailyRate,
            workerTeamRole: activeSubordinateData.member.teamRole,
            isWorkerArchived: activeSubordinateData.member.isArchived || activeSubordinateData.member.status === 'archived'
          });
        });
      }
    }

    // Deduplicate by log ID or composite key
    const seenKeys = new Set();
    list = list.filter((l) => {
      const key = l.id || `${l.workerId}_${l.date}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    // Sort by date descending (newest first)
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Apply logTypeFilter
    if (logTypeFilter === 'full') {
      list = list.filter((l) => l.type === 'full');
    } else if (logTypeFilter === 'half') {
      list = list.filter((l) => l.type === 'half');
    } else if (logTypeFilter === 'overtime') {
      list = list.filter((l) => Number(l.overtimeHours) > 0);
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.date || '').includes(q) ||
          (l.workerName || '').toLowerCase().includes(q) ||
          (l.notes || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [
    portalMode,
    periodTab,
    selectedSubordinateId,
    personalFinancials,
    groupMembersFinancials,
    activeSubordinateData,
    logTypeFilter,
    searchQuery
  ]);

  // 5. Payment Records to Display
  const displayedPayments = useMemo(() => {
    let list = [];
    if (portalMode === 'personal') {
      if (!personalFinancials) return [];
      if (periodTab === 'all') {
        list = [
          ...personalFinancials.unsettledPayments,
          ...personalFinancials.settledPayments,
          ...personalFinancials.settlementReceipts
        ];
      } else if (periodTab === 'current') {
        list = personalFinancials.unsettledPayments;
      } else {
        list = [...personalFinancials.settledPayments, ...personalFinancials.settlementReceipts];
      }
    } else {
      const targetWorkerIds =
        selectedSubordinateId === 'all'
          ? new Set(groupMembers.map((m) => String(m.id)))
          : new Set([String(selectedSubordinateId)]);

      const workerMap = {};
      groupMembers.forEach((m) => {
        workerMap[String(m.id)] = m;
      });

      list = allPayments
        .filter((p) => {
          if (p.deletedAt) return false;
          const matchesWorker = targetWorkerIds.has(String(p.workerId));
          const matchesGroup = worker?.groupId && p.groupId === worker.groupId;
          if (!matchesWorker && !matchesGroup) return false;

          const pSettled = p.isSettled || p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled';
          if (periodTab === 'all') return true;
          if (periodTab === 'current') return !pSettled;
          return pSettled;
        })
        .map((p) => ({
          ...p,
          workerName: workerMap[String(p.workerId)]?.name || (p.groupId ? workerGroup?.name || pc.groupFallback : '—')
        }));
    }

    const seenIds = new Set();
    list = list.filter((p) => {
      if (!p.id) return true;
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [
    portalMode,
    periodTab,
    selectedSubordinateId,
    personalFinancials,
    groupMembers,
    allPayments,
    worker?.groupId,
    workerGroup
  ]);

  // Filtered logs summary for table footer
  const filteredLogsTotals = useMemo(() => {
    let totalBase = 0;
    let totalOtHours = 0;
    let totalOtPay = 0;
    let totalNet = 0;
    displayedLogs.forEach((l) => {
      const effectiveRate = Number(l.workerDailyRate) || Number(worker?.dailyRate) || 0;
      const base =
        Number(l.calculatedDailyWage) ||
        (l.type === 'half' ? effectiveRate * 0.5 : l.type === 'full' ? effectiveRate : 0);
      const ot = Number(l.calculatedOvertimeWage) || 0;
      const net = Number(l.totalDayPay) || base + ot;
      totalBase += base;
      totalOtHours += Number(l.overtimeHours) || 0;
      totalOtPay += ot;
      totalNet += net;
    });
    return {
      totalBase: roundCurrency(totalBase, currency),
      totalOtHours,
      totalOtPay: roundCurrency(totalOtPay, currency),
      totalNet: roundCurrency(totalNet, currency)
    };
  }, [displayedLogs, worker?.dailyRate, currency]);

  // Shift month helper for historical records
  const handleShiftMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const getDayName = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'en' ? 'en-US' : 'fa-IR', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  // Localized labels alias
  const labels = pc;

  if (!worker) {
    return (
      <div className="min-h-screen bg-[#f3f6f4] dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
          <p className="font-black text-sm text-slate-800 dark:text-slate-200">
            {pc.loadingPersonnel}
          </p>
        </div>
      </div>
    );
  }

  // Active metrics to display in Hero Banner
  const activeMetrics =
    portalMode === 'personal'
      ? {
          subjectName: worker.name,
          dailyRate: Number(worker.dailyRate) || 0,
          titleDays: pc.workedDaysTitle,
          days:
            periodTab === 'all'
              ? (personalFinancials?.effectiveDays || 0) + (personalFinancials?.settledEffectiveDays || 0)
              : periodTab === 'current'
              ? personalFinancials?.effectiveDays || 0
              : personalFinancials?.settledEffectiveDays || 0,
          daysSub: `${
            periodTab === 'all'
              ? (personalFinancials?.fullDays || 0) + (personalFinancials?.settledFullDays || 0)
              : periodTab === 'current'
              ? personalFinancials?.fullDays || 0
              : personalFinancials?.settledFullDays || 0
          } ${labels.fullDayLabel}`,
          otHours:
            periodTab === 'all'
              ? (personalFinancials?.otHours || 0) + (personalFinancials?.settledOtHours || 0)
              : periodTab === 'current'
              ? personalFinancials?.otHours || 0
              : personalFinancials?.settledOtHours || 0,
          titleEarnings:
            periodTab === 'all'
              ? pc.titleEarningsTotal
              : periodTab === 'current'
              ? pc.titleEarningsCurrent
              : pc.titleEarningsSettled,
          earnings:
            periodTab === 'all'
              ? (personalFinancials?.unsettledGross || 0) + (personalFinancials?.settledGross || 0)
              : periodTab === 'current'
              ? personalFinancials?.unsettledGross || 0
              : personalFinancials?.settledGross || 0,
          titleAdvances:
            periodTab === 'all'
              ? pc.titleAdvancesTotal
              : periodTab === 'current'
              ? pc.titleAdvancesCurrent
              : pc.titleAdvancesSettled,
          advances:
            periodTab === 'all'
              ? (personalFinancials?.unsettledAdvances || 0) +
                (personalFinancials?.totalSettlementPaid || 0) +
                (personalFinancials?.settledAdvances || 0)
              : periodTab === 'current'
              ? personalFinancials?.unsettledAdvances || 0
              : (personalFinancials?.totalSettlementPaid || 0) + (personalFinancials?.settledAdvances || 0),
          titleDue: pc.titleNetDue,
          due: personalFinancials?.netBalanceDue || 0,
          isSettled: (personalFinancials?.netBalanceDue || 0) <= 0
        }
      : selectedSubordinateId === 'all'
      ? {
          subjectName: workerGroup?.name || pc.allGroupMembersFallback,
          dailyRate: null,
          titleDays: labels.totalGroupDays,
          days:
            periodTab === 'all'
              ? groupAggregates.totalAllTimeEffectiveDays
              : periodTab === 'current'
              ? groupAggregates.totalEffectiveDays
              : groupAggregates.totalSettledEffectiveDays,
          daysSub: pc.groupMembersCount(groupMembers.length),
          otHours:
            periodTab === 'all'
              ? groupAggregates.totalAllTimeOtHours
              : periodTab === 'current'
              ? groupAggregates.totalOtHours
              : groupAggregates.totalSettledOtHours,
          titleEarnings:
            periodTab === 'all'
              ? pc.titleGroupGrossWages
              : periodTab === 'current'
              ? pc.titleGroupGrossWagesCurrent
              : pc.titleGroupGrossWagesSettled,
          earnings:
            periodTab === 'all'
              ? groupAggregates.totalAllTimeGross
              : periodTab === 'current'
              ? groupAggregates.totalUnsettledGross
              : groupAggregates.totalSettledGross,
          titleAdvances:
            periodTab === 'all'
              ? pc.titleGroupPaidAll
              : periodTab === 'current'
              ? pc.titleGroupPaidCurrent
              : pc.titleGroupPaidSettled,
          advances:
            periodTab === 'all'
              ? groupAggregates.totalUnsettledAdvances + groupAggregates.totalSettledPaid
              : periodTab === 'current'
              ? groupAggregates.totalUnsettledAdvances
              : groupAggregates.totalSettledPaid,
          titleDue: labels.totalGroupDue,
          due: groupAggregates.totalNetBalanceDue,
          isSettled: groupAggregates.totalNetBalanceDue <= 0
        }
      : {
          subjectName: activeSubordinateData?.member.name || '',
          dailyRate: Number(activeSubordinateData?.member.dailyRate) || 0,
          titleDays: pc.workedDaysTitle,
          days:
            periodTab === 'all'
              ? (activeSubordinateData?.effectiveDays || 0) + (activeSubordinateData?.settledEffectiveDays || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.effectiveDays || 0
              : activeSubordinateData?.settledEffectiveDays || 0,
          daysSub: `${
            periodTab === 'all'
              ? (activeSubordinateData?.fullDays || 0) + (activeSubordinateData?.settledFullDays || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.fullDays || 0
              : activeSubordinateData?.settledFullDays || 0
          } ${labels.fullDayLabel}`,
          otHours:
            periodTab === 'all'
              ? (activeSubordinateData?.otHours || 0) + (activeSubordinateData?.settledOtHours || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.otHours || 0
              : activeSubordinateData?.settledOtHours || 0,
          titleEarnings: pc.titleSubordinateWages,
          earnings:
            periodTab === 'all'
              ? (activeSubordinateData?.unsettledGross || 0) + (activeSubordinateData?.settledGross || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.unsettledGross || 0
              : activeSubordinateData?.settledGross || 0,
          titleAdvances:
            periodTab === 'all'
              ? pc.titleSubordinateAdvancesAll
              : periodTab === 'current'
              ? pc.titleSubordinateAdvancesCurrent
              : pc.titleSubordinateAdvancesSettled,
          advances:
            periodTab === 'all'
              ? (activeSubordinateData?.unsettledAdvances || 0) +
                (activeSubordinateData?.totalSettlementPaid || 0) +
                (activeSubordinateData?.settledAdvances || 0)
              : periodTab === 'current'
              ? activeSubordinateData?.unsettledAdvances || 0
              : (activeSubordinateData?.totalSettlementPaid || 0) + (activeSubordinateData?.settledAdvances || 0),
          titleDue: pc.titleSubordinateNetDue,
          due: activeSubordinateData?.netBalanceDue || 0,
          isSettled: (activeSubordinateData?.netBalanceDue || 0) <= 0
        };

  // Dynamic Hero Primary Amount & Subtitle based on active periodTab!
  const heroPrimaryDisplay =
    periodTab === 'all'
      ? {
          amount: activeMetrics.earnings,
          caption: pc.footerDescAll,
          rightSubLabel: activeMetrics.titleDue,
          rightSubAmount: Math.max(0, activeMetrics.due),
          rightSubColor: 'text-amber-400'
        }
      : periodTab === 'current'
      ? {
          amount: Math.max(0, activeMetrics.due),
          caption: pc.footerDescCurrent,
          rightSubLabel: activeMetrics.titleEarnings,
          rightSubAmount: activeMetrics.earnings,
          rightSubColor: 'text-sky-300'
        }
      : {
          amount: activeMetrics.advances,
          caption: pc.footerDescSettled,
          rightSubLabel: activeMetrics.titleEarnings,
          rightSubAmount: activeMetrics.earnings,
          rightSubColor: 'text-sky-300'
        };

  // Calculate payout ratio for visual progress bar
  const grossEarningsVal = Number(activeMetrics.earnings) || 0;
  const paidAdvancesVal = Number(activeMetrics.advances) || 0;
  const payoutProgressPercent =
    periodTab === 'settled'
      ? 100
      : grossEarningsVal <= 0
      ? activeMetrics.isSettled
        ? 100
        : 0
      : Math.min(100, Math.max(0, Math.round((paidAdvancesVal / grossEarningsVal) * 100)));

  const currencySymbol = getCurrencySymbol(currency, language);
  const userInitials = (user?.name || worker?.name || 'K').slice(0, 2).toUpperCase();

  const periodNavItems = [
    { id: 'all', label: labels.allTab, icon: Layers },
    { id: 'current', label: labels.currentTab, icon: Clock },
    { id: 'settled', label: labels.settledTab, icon: CheckCircle2 }
  ];

  return (
    <div
      className="min-h-screen bg-[#f3f6f4] dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300"
      dir={direction}
    >
      {/* ===================================================================== */}
      {/* 1. TOP NAVBAR (With [APP_THEME_BUTTON] Dock & Avatar Dropdown)        */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 no-print transition-all duration-300">
        <div className="absolute inset-0 bg-white/55 dark:bg-slate-950/55 backdrop-blur-3xl backdrop-saturate-200 border-b border-slate-200/50 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_0_rgba(0,0,0,0.4)] -z-10 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Brand & Identity */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0">
                <img
                  src="/karsync-icon.png"
                  alt="KarSync"
                  className="w-full h-full object-contain drop-shadow-sm"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                    KarSync
                  </h1>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    {isSupervisor ? pc.portalSupervisor : pc.portalWorker}
                  </span>
                </div>
                <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                  {project?.name || pc.activeProjectFallback}
                </p>
              </div>
            </div>

            {/* Desktop Center Dock: [APP_THEME_BUTTON] Segmented Period Tabs (Hidden on Mobile) */}
            <div className="hidden md:flex items-center justify-center absolute left-1/2 -translate-x-1/2 pointer-events-auto">
              <nav className="flex items-center gap-1.5 bg-white/40 dark:bg-white/[0.05] backdrop-blur-2xl backdrop-saturate-200 p-1.5 sm:p-2 rounded-2xl border border-white/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1),0_2px_12px_0_rgba(0,0,0,0.3)]">
                {periodNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = periodTab === item.id;
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => setPeriodTab(item.id)}
                        aria-label={item.label}
                        className={`relative p-2.5 rounded-xl transition-all duration-300 ease-in-out flex items-center gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 scale-105 font-bold border border-sky-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Icon className="w-5 h-5 transition-transform group-hover:scale-110 flex-shrink-0" />

                        {/* Active tab displays BOTH icon and text label; Inactive tab displays ONLY icon */}
                        {isActive && (
                          <span className="text-xs font-bold px-1 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap">
                            {item.label}
                          </span>
                        )}

                        {isActive && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs" />
                        )}
                      </button>

                      {/* Hover Micro-Tooltip when inactive */}
                      {!isActive && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          {item.label}
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* End Controls: Sync Button + Worker Notification Bell + User Profile Dropdown */}
            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => triggerRefresh(true)}
                disabled={isRefreshing}
                title={pc.refreshTooltip}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/50 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-white/60 dark:border-white/10 backdrop-blur-md text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
              </button>

              {/* Dedicated Worker Notification Bell (Strictly Attendance & Settlements Only) */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsNotifOpen((prev) => !prev);
                    setIsDropdownOpen(false);
                  }}
                  title={pc.notifsTooltip}
                  className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border backdrop-blur-md flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 ${
                    isNotifOpen
                      ? 'ring-2 ring-sky-500 border-transparent bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400'
                      : 'bg-white/50 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border-white/60 dark:border-white/10 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {unreadWorkerNotifCount > 0 ? (
                    <BellRing className="w-4 h-4 text-sky-600 dark:text-sky-400 animate-pulse" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {unreadWorkerNotifCount > 0 && (
                    <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-xs">
                      {unreadWorkerNotifCount > 9 ? '9+' : unreadWorkerNotifCount}
                    </span>
                  )}
                </button>

                {/* Worker Notification Popover */}
                {isNotifOpen && (
                  <div className="absolute top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white/90 dark:bg-slate-950/90 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/70 dark:border-white/15 rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.22)] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.65)] z-50 overflow-hidden text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 select-none ltr:right-0 rtl:left-0">
                    {/* Popover Header */}
                    <div className="p-3.5 sm:p-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                          <BellRing className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            {pc.myNotifsHeader}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {pc.myNotifsSub}
                          </p>
                        </div>
                      </div>

                      {unreadWorkerNotifCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllWorkerNotifsRead}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer shrink-0"
                        >
                          {pc.readAll}
                        </button>
                      )}
                    </div>

                    {/* External Mobile Push Notification Banner / Toggle */}
                    <div className="p-3 bg-slate-100/80 dark:bg-slate-900/70 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            workerPushEnabled && notifPermission === 'granted'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                            {pc.osNotifHeader}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                            {workerPushEnabled && notifPermission === 'granted'
                              ? pc.osNotifActiveSub
                              : pc.osNotifInactiveSub}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleWorkerPush}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all shrink-0 cursor-pointer ${
                          workerPushEnabled && notifPermission === 'granted'
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                            : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                        }`}
                      >
                        {workerPushEnabled && notifPermission === 'granted'
                          ? pc.activeCheck
                          : pc.activateAction}
                      </button>
                    </div>

                    {/* Notification Feed List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-200/50 dark:divide-slate-800/70">
                      {workerNotifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                          {pc.noNotifsEmpty}
                        </div>
                      ) : (
                        workerNotifications.map((n) => {
                          const isSettle = n.category === 'settlement' || n.category === 'advance';
                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => markSingleWorkerNotifRead(n.id, n.targetTab)}
                              className={`w-full text-start p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                                !n.isRead
                                  ? 'bg-sky-50/70 dark:bg-sky-950/30 hover:bg-sky-100/70 dark:hover:bg-sky-900/30'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                  isSettle
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                                }`}
                              >
                                {isSettle ? <CheckCircle2 className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                    {n.title}
                                  </span>
                                  {n.date && (
                                    <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                                      {n.date}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
                                  {n.message}
                                </p>
                              </div>

                              {!n.isRead && (
                                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 mt-2" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Avatar Dropdown Trigger */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen((prev) => !prev);
                    setIsNotifOpen(false);
                  }}
                  className={`relative p-0.5 sm:p-1 rounded-2xl border transition-all shadow-xs flex items-center gap-2 sm:pe-2.5 group cursor-pointer ${
                    isDropdownOpen
                      ? 'ring-2 ring-sky-500 shadow-md border-transparent bg-white dark:bg-slate-900'
                      : 'bg-white/50 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border-white/60 dark:border-white/10 backdrop-blur-md'
                  }`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs">
                      {userInitials}
                    </div>
                    <span className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 hidden lg:inline max-w-[110px] truncate">
                    {user?.name || worker?.name}
                  </span>
                </button>

                {/* Liquid Glass User & Settings Dropdown (Language, Dark Mode, Mobile Push, Logout) */}
                {isDropdownOpen && (
                  <div className="absolute top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white/85 dark:bg-slate-950/85 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/70 dark:border-white/15 rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.2)] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.6)] z-50 p-3 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 select-none ltr:right-0 rtl:left-0 space-y-2.5">
                    {/* User Identity Card */}
                    <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                          {userInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {user?.name || worker?.name}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {worker?.teamRole === 'Master' ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20">
                                {labels.masterRole}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold border border-sky-500/20">
                                {worker?.role || labels.workerRoleLabel}
                              </span>
                            )}
                            {workerGroup && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                {workerGroup.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* External Mobile Notification Toggle inside Dropdown */}
                    <button
                      type="button"
                      onClick={handleToggleWorkerPush}
                      className="w-full p-2.5 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] hover:bg-slate-200/70 dark:hover:bg-white/[0.08] border border-slate-200/50 dark:border-white/5 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BellRing className="w-4 h-4 text-sky-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                          {pc.mobileNotifMenu}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold shrink-0 ${
                          workerPushEnabled && notifPermission === 'granted'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {workerPushEnabled && notifPermission === 'granted'
                          ? pc.statusActive
                          : pc.statusInactive}
                      </span>
                    </button>

                    {/* Theme Switcher ([APP_THEME_BUTTON] Segmented Control) */}
                    <div className="p-2 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {pc.appearanceTitle}
                        </span>
                      </div>
                      <div className="flex rounded-xl bg-slate-200/70 dark:bg-slate-900 p-1 border border-slate-300/40 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => theme !== 'light' && toggleTheme()}
                          className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                            theme === 'light'
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          {theme === 'light' && (
                            <span>{pc.themeLight}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => theme !== 'dark' && toggleTheme()}
                          className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          {theme === 'dark' && (
                            <span>{pc.themeDark}</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Language Selector */}
                    <div className="p-2 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/5 space-y-1.5">
                      <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <Globe className="w-3.5 h-3.5 text-sky-500" />
                        <span>{pc.languageTitle}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl">
                        {[
                          { id: 'fa', label: 'فارسی' },
                          { id: 'ku', label: 'کوردی' },
                          { id: 'en', label: 'English' }
                        ].map((lang) => (
                          <button
                            key={lang.id}
                            type="button"
                            onClick={() => changeLanguage(lang.id)}
                            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              language === lang.id
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Print Payslip Shortcut */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        window.print();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-sky-500" />
                      <span>{pc.printPayslipMenu}</span>
                    </button>

                    {/* Logout Action */}
                    <div className="border-t border-slate-200/60 dark:border-white/10 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.ready
                              .then((reg) => reg?.active?.postMessage({ type: 'CLEAR_WORKER_SW_STATE' }))
                              .catch(() => {});
                          }
                          logout();
                        }}
                        className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>
                          {pc.signOut}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 1B. FLOATING BOTTOM NAVIGATION BAR FOR MOBILE (Apple Liquid Glass)    */}
      {/* ===================================================================== */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 max-w-md mx-auto z-40 no-print">
        <div className="bg-white/75 dark:bg-slate-950/75 backdrop-blur-3xl backdrop-saturate-200 border border-slate-200/60 dark:border-white/15 rounded-3xl shadow-[0_12px_40px_0_rgba(0,0,0,0.2),inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.15)] p-1.5 flex items-center justify-between gap-1.5">
          {periodNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = periodTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriodTab(item.id)}
                aria-label={item.label}
                title={item.label}
                className={`relative flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-2xl transition-all duration-300 ease-in-out active:scale-95 cursor-pointer ${
                  isActive
                    ? 'flex-[2] bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/35 border border-sky-400/30 font-bold'
                    : 'flex-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isActive && (
                  <span className="text-xs font-bold truncate animate-in fade-in zoom-in-95 duration-200">
                    {item.label}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-xs" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ===================================================================== */}
      {/* 2. MAIN CONTENT CONTAINER (Matches DashboardView Layout)              */}
      {/* ===================================================================== */}
      <main className="space-y-6 pb-28 md:pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Liquid Glass Welcome & Mode Capsule */}
        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/30 transition-all duration-300">
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-sky-500/10 dark:bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-sky-500/25 flex-shrink-0">
                {userInitials}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                    {user?.name || worker?.name}
                  </h2>
                  {worker?.teamRole === 'Master' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      <Sparkles className="w-3 h-3" />
                      <span>{labels.masterRole}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {worker?.role || labels.workerRoleLabel}
                    </span>
                  )}
                  {workerGroup && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Building2 className="w-3 h-3" />
                      <span>{workerGroup.name}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {activeMetrics.dailyRate > 0
                    ? `${pc.baseDailyRateLabel} ${formatAmount(
                        activeMetrics.dailyRate,
                        currency
                      )} ${currencySymbol}`
                    : `${project?.name || ''} • ${labels.allGroupMembers}`}
                </p>
              </div>
            </div>

            {/* Supervisor Mode Switcher ([APP_THEME_BUTTON] Segmented Control) */}
            {isSupervisor && (
              <div className="inline-flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner self-start md:self-auto no-print">
                <button
                  type="button"
                  onClick={() => {
                    setPortalMode('personal');
                    setSelectedSubordinateId('all');
                  }}
                  title={labels.myPersonalAccount}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                    portalMode === 'personal'
                      ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  {portalMode === 'personal' && <span>{labels.myPersonalAccount}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setPortalMode('group')}
                  title={labels.groupManagement}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                    portalMode === 'group'
                      ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {portalMode === 'group' && (
                    <>
                      <span>{labels.groupManagement}</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20">
                        {groupMembers.length}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Group Subordinates Selector (When Supervisor is in Group Mode) */}
          {isSupervisor && portalMode === 'group' && (
            <div className="relative z-10 mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800 space-y-3 no-print">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-500" />
                  <span>
                    {pc.selectSubordinateLabel}
                  </span>
                </span>
                <span className="text-slate-400">
                  {groupMembers.length} {pc.membersSuffix}
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedSubordinateId('all')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    selectedSubordinateId === 'all'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{labels.allGroupMembers}</span>
                </button>

                {groupMembersFinancials.map((gf) => {
                  const isSelected = String(gf.member.id) === String(selectedSubordinateId);
                  const isArchived = gf.member.isArchived || gf.member.status === 'archived';
                  const totalDays = (gf.effectiveDays || 0) + (gf.settledEffectiveDays || 0);

                  return (
                    <button
                      key={gf.member.id}
                      type="button"
                      onClick={() => setSelectedSubordinateId(String(gf.member.id))}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border cursor-pointer ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/25'
                          : isArchived
                          ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                          : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                      }`}
                    >
                      <span>{gf.member.name}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : gf.netBalanceDue > 0
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {gf.netBalanceDue > 0
                          ? `${formatAmount(gf.netBalanceDue, currency)} ${currencySymbol}`
                          : `${totalDays} ${labels.daysUnit}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 3. EXECUTIVE HERO BANNER (Dynamic Number per Period Tab!)         */}
        {/* ================================================================= */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Main Financial Statement (Col-span 7) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider flex-wrap">
                <WalletCards className="w-4 h-4" />
                <span>
                  {periodTab === 'all'
                    ? labels.allTab
                    : periodTab === 'current'
                    ? labels.currentTab
                    : labels.settledTab}
                </span>
                <span
                  className={`ms-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    periodTab === 'settled' || activeMetrics.isSettled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {periodTab === 'settled' || activeMetrics.isSettled
                    ? pc.badgeSettled
                    : pc.badgeUnsettled}
                </span>
              </div>

              {/* Dynamic Big Hero Number that updates when switching tabs */}
              <div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2">
                  <span>{formatAmount(heroPrimaryDisplay.amount, currency)}</span>
                  <span className="text-sm sm:text-base font-bold text-sky-400">{currencySymbol}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">{heroPrimaryDisplay.caption}</p>
              </div>

              {/* Progress Gauge */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs font-semibold flex-wrap gap-2">
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {activeMetrics.titleAdvances}: {formatAmount(activeMetrics.advances, currency)} {currencySymbol}
                  </span>
                  <span className={`${heroPrimaryDisplay.rightSubColor} flex items-center gap-1.5`}>
                    <Coins className="w-3.5 h-3.5" />
                    {heroPrimaryDisplay.rightSubLabel}: {formatAmount(heroPrimaryDisplay.rightSubAmount, currency)}{' '}
                    {currencySymbol}
                  </span>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-700 shadow-md"
                    style={{ width: `${payoutProgressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>
                    {payoutProgressPercent}% {pc.clearedStatus}
                  </span>
                  <span>
                    {displayedLogs.length} {pc.recordsInView}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Metrics & Quick Action Dock (Col-span 5) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              {/* Tile 1: Working Days */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[11px] text-slate-400 block">{activeMetrics.titleDays}</span>
                <span className="text-xl font-black text-white mt-0.5 block font-mono">
                  {activeMetrics.days}{' '}
                  <span className="text-xs font-normal text-slate-400">{labels.daysUnit}</span>
                </span>
                <span className="text-[10px] text-emerald-400 mt-1 block">{activeMetrics.daysSub}</span>
              </div>

              {/* Tile 2: Overtime Hours (Formatted as H:MM) */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[11px] text-slate-400 block">{labels.overtimeLabel}</span>
                <span className="text-xl font-black text-white mt-0.5 block font-mono">
                  {activeMetrics.otHours > 0 ? formatOvertimeClock(activeMetrics.otHours) : '0:00'}
                </span>
                <span className="text-[10px] text-sky-400 mt-1 block">
                  {pc.totalOtHours}
                </span>
              </div>

              {/* Quick Action 1: Print Payslip */}
              <button
                type="button"
                onClick={() => window.print()}
                className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all duration-300 cursor-pointer active:scale-95 no-print"
              >
                <Printer className="w-4 h-4" />
                <span>{pc.printAction}</span>
              </button>

              {/* Quick Action 2: Sync / Refresh */}
              <button
                type="button"
                onClick={() => triggerRefresh(true)}
                disabled={isRefreshing}
                className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all duration-300 cursor-pointer active:scale-95 no-print"
              >
                <RefreshCw className={`w-4 h-4 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{pc.refreshAction}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. FULL-WIDTH ATTENDANCE REPORT ("گزارش کارکرد من")               */}
        {/* ================================================================= */}
        <div className="rounded-3xl backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 overflow-hidden">
          {/* Header & Filters */}
          <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {portalMode === 'personal'
                      ? pc.reportMyAttendance
                      : selectedSubordinateId === 'all'
                      ? `${pc.reportGroupAttendance} (${workerGroup?.name || ''})`
                      : pc.reportAttendanceOf(activeSubordinateData?.member.name)}
                  </h3>

                  {/* Active Month Name Badge */}
                  {(displayedLogs[0]?.date || selectedMonth) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300 border border-sky-500/20">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {formatMonthWithYear(
                        periodTab === 'settled' ? selectedMonth : displayedLogs[0]?.date || selectedMonth,
                        language
                      )}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                  {displayedLogs.length} {pc.daysCountSub(displayedLogs.length)}
                </span>
              </div>
            </div>

            {/* Filter Chips ([APP_THEME_BUTTON]) + Month Selector + Search */}
            <div className="flex flex-wrap items-center gap-2.5 no-print">
              {/* [APP_THEME_BUTTON] Segmented Log Type Tabs (Exact Navbar Pattern) */}
              <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 backdrop-blur-2xl p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8),0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-none">
                {[
                  { id: 'all', label: pc.filterAll, icon: Layers },
                  { id: 'full', label: labels.fullDayLabel, icon: Sun },
                  { id: 'half', label: labels.halfDayLabel, icon: Sunrise },
                  { id: 'overtime', label: labels.overtimeLabel, icon: Clock }
                ].map((chip) => {
                  const Icon = chip.icon;
                  const isActive = logTypeFilter === chip.id;
                  return (
                    <div key={chip.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => setLogTypeFilter(chip.id)}
                        aria-label={chip.label}
                        className={`relative p-2 sm:p-2.5 rounded-xl transition-all duration-300 ease-in-out flex items-center gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 scale-105 font-bold border border-sky-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-hover:scale-110 flex-shrink-0" />

                        {/* Active tab displays BOTH icon and text label; Inactive tab displays ONLY icon */}
                        {isActive && (
                          <span className="text-xs font-bold px-1 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap">
                            {chip.label}
                          </span>
                        )}

                        {isActive && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs" />
                        )}
                      </button>

                      {/* Hover Micro-Tooltip when inactive */}
                      {!isActive && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          {chip.label}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-solid border-t-slate-900/90 border-t-4 border-x-transparent border-x-4 border-b-0" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {periodTab === 'settled' && (
                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 px-2.5 py-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleShiftMonth(-1)}
                    className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                  <span className="text-xs font-bold px-1.5 text-slate-700 dark:text-slate-200">
                    {formatMonthWithYear(selectedMonth, language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleShiftMonth(1)}
                    className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* Search Box */}
              <div className="relative flex-1 sm:flex-initial sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={labels.searchLogsPlaceholder}
                  className="w-full ps-8 pe-7 py-2 text-xs bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500/40 text-slate-900 dark:text-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Responsive Zero-Horizontal-Scroll Attendance List */}
          {displayedLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              {pc.noLogsEmpty}
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-800/70">
              {/* Desktop Header Bar (Compact columns + wide Notes column with title) */}
              <div className="hidden md:grid md:grid-cols-12 gap-3 px-6 py-3 bg-slate-100/60 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 items-center">
                <div className="col-span-1 text-center">{labels.dateColTitle}</div>
                {portalMode === 'group' && selectedSubordinateId === 'all' && (
                  <div className="col-span-2">{labels.workerNameColTitle}</div>
                )}
                <div className="col-span-2">{labels.workTypeColTitle}</div>
                <div className="col-span-2">{labels.totalDayColTitle}</div>
                <div className="col-span-2 text-center">{labels.statusColTitle}</div>
                <div className={portalMode === 'group' && selectedSubordinateId === 'all' ? 'col-span-3' : 'col-span-5'}>
                  {labels.notesColTitle}
                </div>
              </div>

              {/* Attendance Rows (Grouped with Month Section Headers) */}
              {displayedLogs.map((l, idx) => {
                let isSettled = false;
                if (portalMode === 'personal') {
                  isSettled = personalFinancials?.isLogSettled?.(l) || false;
                } else {
                  const workerFin = groupMembersFinancials.find(
                    (gf) => String(gf.member.id) === String(l.workerId)
                  );
                  isSettled = workerFin?.isLogSettled?.(l) || false;
                }
                const hasOt = Number(l.overtimeHours) > 0;

                const currentMonthKey = (l.date || '').slice(0, 7);
                const prevMonthKey = idx > 0 ? (displayedLogs[idx - 1]?.date || '').slice(0, 7) : null;
                const showMonthDivider = currentMonthKey && currentMonthKey !== prevMonthKey;

                return (
                  <React.Fragment key={l.id || `${l.workerId}_${l.date}_${idx}`}>
                    {showMonthDivider && (
                      <div className="px-4 sm:px-6 py-2.5 bg-sky-50/70 dark:bg-sky-950/25 border-y border-sky-200/50 dark:border-sky-800/40 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                          <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span className="text-xs font-extrabold text-sky-900 dark:text-sky-200">
                            {pc.monthLabel}{' '}
                            {formatMonthWithYear(l.date, language)}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-sky-700/80 dark:text-sky-300/70 bg-white/70 dark:bg-slate-900/60 px-2.5 py-0.5 rounded-lg border border-sky-200/60 dark:border-sky-800/50">
                          {currentMonthKey}
                        </span>
                      </div>
                    )}

                    <div
                      className="px-4 sm:px-6 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors grid grid-cols-1 md:grid-cols-12 gap-2.5 md:gap-3 items-center text-xs"
                    >
                      {/* 1. Date: Day of Month in Large Bold Font + Weekday in Small Font Underneath */}
                      <div
                        className="md:col-span-1 flex items-center justify-between md:justify-center"
                        title={l.date}
                      >
                        <div className="flex flex-col items-center justify-center min-w-[44px] py-1 px-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-base sm:text-lg font-black font-mono leading-none text-slate-900 dark:text-white">
                          {getDayOfMonthNumber(l.date)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-none">
                          {getDayName(l.date)}
                        </span>
                      </div>

                      {/* Mobile Total Pay (Pure Amount without Currency Unit) */}
                      <div className="md:hidden text-end">
                        <span className="text-sm font-black font-mono text-sky-600 dark:text-sky-400">
                          {formatAmount(l.totalDayPay, currency)}
                        </span>
                      </div>
                    </div>

                    {/* 2. Worker Name (Group All mode only) */}
                    {portalMode === 'group' && selectedSubordinateId === 'all' && (
                      <div className="md:col-span-2 font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{l.workerName}</span>
                        {l.workerTeamRole === 'Master' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                            {labels.masterRole}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 3. Work Type (Persian) + Overtime formatted as 1:20 */}
                    <div className="md:col-span-2 flex items-center gap-1.5 flex-wrap">
                      {l.type === 'full' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {labels.fullDayLabel}
                        </span>
                      )}
                      {l.type === 'half' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {labels.halfDayLabel}
                        </span>
                      )}
                      {l.type === 'hourly' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {labels.hourlyLabel}
                        </span>
                      )}
                      {hasOt && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          <Clock className="w-3 h-3" />
                          <span>{formatOvertimeClock(l.overtimeHours)}</span>
                        </span>
                      )}
                    </div>

                    {/* 4. Total Day Pay (Desktop - Pure Amount without Currency Unit) */}
                    <div className="hidden md:block md:col-span-2 font-black text-sm text-sky-600 dark:text-sky-400 font-mono">
                      {formatAmount(l.totalDayPay, currency)}
                    </div>

                    {/* 5. Status Badge */}
                    <div className="md:col-span-2 flex items-center md:justify-center">
                      {periodTab === 'settled' || isSettled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{labels.settledBadge}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>{labels.unsettledBadge}</span>
                        </span>
                      )}
                    </div>

                    {/* 6. Notes (Wide Column) */}
                    <div
                      className={`${
                        portalMode === 'group' && selectedSubordinateId === 'all' ? 'md:col-span-3' : 'md:col-span-5'
                      } text-slate-600 dark:text-slate-300 leading-relaxed break-words`}
                    >
                      {l.notes || <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </div>
                  </div>
                </React.Fragment>
                );
              })}

              {/* Summary Footer Bar */}
              <div className="px-6 py-4 bg-slate-100/80 dark:bg-slate-800/70 flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-200">
                  {pc.totalsTable} ({displayedLogs.length}{' '}
                  {pc.recordsSuffix})
                </span>
                <div className="flex flex-wrap items-center gap-4 font-mono">
                  {filteredLogsTotals.totalOtHours > 0 && (
                    <span className="text-purple-600 dark:text-purple-400">
                      {labels.overtimeLabel}: {formatOvertimeClock(filteredLogsTotals.totalOtHours)}
                    </span>
                  )}
                  <span className="text-sm font-black text-sky-600 dark:text-sky-400">
                    {pc.grandTotalLabel} {formatAmount(filteredLogsTotals.totalNet, currency)}{' '}
                    {currencySymbol}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 5. PAYMENTS & ADVANCES LEDGER CAPSULE                             */}
        {/* ================================================================= */}
        <div className="rounded-3xl p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  {portalMode === 'personal'
                    ? pc.paymentsAndAdvancesPersonal
                    : pc.paymentsAndAdvancesGroup}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {displayedPayments.length} {pc.transactionsCount(displayedPayments.length)}
                </span>
              </div>
            </div>
          </div>

          {displayedPayments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              {pc.noPaymentsEmpty}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {displayedPayments.map((p) => {
                const isSettlement =
                  p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled';

                return (
                  <div
                    key={p.id || `${p.date}_${p.amount}`}
                    className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between gap-3 hover:border-sky-500/30 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSettlement
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {isSettlement ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>
                            {isSettlement ? pc.typeSettlement : pc.typeAdvance}
                          </span>
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                          {p.date}
                        </span>
                      </div>

                      {portalMode === 'group' && (
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                          {p.workerName}
                        </div>
                      )}

                      {(p.notes || p.referenceNumber) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {p.referenceNumber ? `#${p.referenceNumber} ` : ''}
                          {p.notes || ''}
                        </div>
                      )}
                    </div>

                    <div className="text-end shrink-0">
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                        {formatAmount(p.amount, currency)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{currencySymbol}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dual Signature Blocks (Visible when printing Payslip) */}
        <div className="hidden print:flex justify-around items-end pt-16 pb-6 mt-8 border-t border-slate-300 text-xs font-bold text-slate-800">
          <div className="text-center">
            <p className="mb-14">
              {pc.sigWorkerOrSupervisor}
            </p>
            <div className="w-44 border-b border-slate-600" />
          </div>
          <div className="text-center">
            <p className="mb-14">
              {pc.sigWorkshopManager}
            </p>
            <div className="w-44 border-b border-slate-600" />
          </div>
        </div>
      </main>
    </div>
  );
}
