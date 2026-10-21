import { logAuditAction, getSafeAuthContext } from "../services/auditLogger";
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generatePaymentId, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth, usePermissions } from '../context/AuthContext';
import { pushPaymentsLive, pushLogsLive } from '../services/realtimeSync';
import { getTodayDateString, getCurrentYearMonth, formatAmount, roundCurrency, getCurrencySymbol, formatHoursAndMinutes, formatCurrency, normalizeDigits, convertDigits } from '../utils/formatters';
import { 
  CheckCircle2, 
  X, 
  User, 
  Users, 
  Calendar, 
  Coins, 
  FileText, 
  Hash, 
  Printer, 
  Check, 
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Ban,
  HelpCircle, 
  Calculator, 
  ArrowDownRight, 
  Shield, 
  Layers, 
  Crown, 
  Landmark, 
  Star, 
  CreditCard,
  Clock,
  Zap,
  Sliders,
  Sparkles,
  ArrowLeftRight,
  Filter,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Percent,
  CalendarRange,
  CheckCheck,
  Square,
  Search,
  UserCheck
} from 'lucide-react';
import { useAccounting } from '../hooks/useAccounting';
import { OverdraftConfirmModal } from './accounting/OverdraftConfirmModal';
import { calculateWorkerFinancials, getReceiptPeriodEnd } from '../utils/settlementCalculations';

const COPY = {
  fa: {
    groupNameDefault: 'گروه',
    supNameDefault: 'سرپرست',
    groupSettlementNotes: (groupName, supName, count) => `تسویه حساب گروه ${groupName} با سرپرست (${supName}) - شامل ${count} نفر`,
    individualSettlementNotes: (daysCount) => `تسویه حساب کارکرد (${daysCount} روز کارکرد دوره)`,
    validAmountError: 'لطفاً مبلغ معتبری وارد کنید.',
    selectSupervisorError: 'لطفاً سرپرست گروه را جهت دریافت و تسویه مشخص کنید.',
    selectedAccountDefault: 'حساب انتخابی',
    cashAccountDefault: 'صندوق/بانک',
    overdraftBlockedPolicyError: (accName) => `موجودی حساب انتخابی (${accName}) برای پرداخت این تسویه‌حساب کافی نیست و بر اساس سیاست تعیین شده، برداشت بیش از موجودی غیرمجاز است.`,
    targetWorkerNotSpecifiedError: 'نیروی هدف جهت تسویه حساب مشخص نیست.',
    noCustomRecordSelectedError: 'هیچ رکوردی برای تسویه سفارشی انتخاب نشده است.',
    customSettlementAuditDesc: (name) => `ثبت تسویه حساب / مساعده سفارشی برای ${name}`,
    systemUser: 'کاربر سیستم',
    groupSettlementAuditDesc: (count, groupName) => `ثبت تسویه حساب گروهی برای ${count} نفر (گروه ${groupName})`,
    individualSettlementAuditDesc: (name) => `ثبت تسویه حساب / مساعده برای ${name}`,
    groupPrefix: 'گروه ',
    negativeBalanceWarningToast: (accName, formattedNeg) => `تسویه حساب ثبت شد. توجه: موجودی حساب «${accName}» به منفی ${formattedNeg} رسید.`,
    errorSavingSettlement: 'خطا در ثبت تسویه حساب',
    groupSettlementModalTitle: 'تسویه حساب گروهی با سرپرست',
    individualSettlementModalTitle: 'تسویه حساب و پرداخت',
    autoSettlementTab: 'تسویه اتوماتیک',
    customSettlementTab: 'تسویه با جزئیات',
    workGroup: 'گروه کاری',
    supervisor: 'سرپرست:',
    undefinedSupervisor: 'تعریف‌نشده',
    allOpenArrears: 'مانده کل مطالبات باز',
    selectWorkerForSettlement: 'انتخاب پرسنل جهت تسویه حساب',
    changeWorkerTooltip: 'انتخاب پرسنل دیگر',
    changeWorkerBtn: 'تغییر پرسنل',
    closeTooltip: 'بستن (ESC)',
    quickAutoTooltip: 'تسویه اتوماتیک و سریع',
    quickSettlement: 'تسویه سریع',
    customDetailedTooltip: 'تسویه با جزئیات و سفارشی',
    detailedSettlement: 'تسویه با جزئیات',
    individualTooltip: 'تسویه انفرادی پرسنل',
    individualLabel: 'فردی',
    groupTooltip: 'تسویه گروهی با سرپرست',
    groupLabel: 'گروهی',
    selectWorkerScreenTitle: 'انتخاب پرسنل برای تسویه حساب',
    selectWorkerScreenSubtitle: '{c.selectWorkerScreenSubtitle}',
    activeWorkersCount: (count) => `${count} نفر فعال`,
    withArrearsTab: 'دارای معوقه',
    allWorkersTab: 'همه پرسنل',
    settledTab: 'تسویه شده',
    searchWorkersPlaceholder: 'جستجوی نام پرسنل، سمت، شماره تماس...',
    defaultInitialChar: 'ک',
    defaultWorkerRole: 'کارگر',
    hasDueBadge: 'دارای معوقه',
    settledBadge: 'تسویه شده',
    totalDueForSettlementLabel: '{c.totalDueForSettlementLabel}',
    noWorkersWithArrears: 'هیچ پرسنلی دارای معوقه باز نیست',
    noWorkersFound: 'پرسنلی با این مشخصات یافت نشد',
    allSettledDesc: 'تمامی حساب‌های پرسنل تسویه شده‌اند و مانده بدهی بازی وجود ندارد.',
    changeSearchDesc: 'لطفاً عبارت جستجو یا فیلتر وضعیت را تغییر دهید.',
    viewAllWorkersBtn: '{c.viewAllWorkersBtn}',
    selectWorkerCustomTitle: 'انتخاب پرسنل جهت تسویه سفارشی:',
    customDateFilterTitle: 'فیلتر بازه زمانی دلخواه:',
    clearRangeBtn: 'پاک کردن بازه',
    fromDateLabel: '{c.fromDateLabel}',
    toDateLabel: '{c.toDateLabel}',
    rangeShortcutsLabel: '{c.rangeShortcutsLabel}',
    entirePrevMonth: '{c.entirePrevMonth}',
    currentMonth: '{c.currentMonth}',
    first15Days: '{c.first15Days}',
    second15Days: '{c.second15Days}',
    financialComponentType: '{c.financialComponentType}',
    allItems: '{c.allItems}',
    onlyDaily: '{c.onlyDaily}',
    onlyOvertime: '{c.onlyOvertime}',
    filterByProjectSection: '{c.filterByProjectSection}',
    allWorkshopSections: 'همه بخش‌های کارگاه',
    deductOpenAdvancesLabel: (amount, symbol) => `کسر مساعده‌های باز پرسنل (${amount} ${symbol})`,
    deductAdvancesActiveTip: 'مساعده‌های باز به نسبت این تسویه کسر خواهند شد.',
    deductAdvancesInactiveTip: 'با غیرفعال کردن، کل کارکرد بدون کسر مساعده پرداخت می‌شود.',
    deselectAllDays: 'لغو {c.selectAll}',
    selectAllDays: 'انتخاب {c.allDays}',
    daysSelectedSummary: (sel, total) => `(${sel} از ${total} روز انتخاب شده)`,
    selectAll: 'انتخاب همه',
    deselectAll: '{c.deselectAll}',
    noRecordsMatchFilters: '{c.noRecordsMatchFilters}',
    halfDay: 'نیم‌روز',
    hourly: 'ساعتی',
    fullDay: 'کامل',
    overtimePrefix: 'اضافه کاری: +',
    financialBalanceSelectedItems: (days) => `تراز مالی اقلام منتخب (${days} روز کاری):`,
    grossTotalLabel: 'جمع ناخالص:',
    advancesDeductedInSettlement: '(-) مساعده‌های کسرشده در این تسویه:',
    netPayableCustomSettlement: '{c.netPayableCustomSettlement}',
    amountAutoConfiguredNotice: '{c.amountAutoConfiguredNotice}',
    periodCutoffLabel: 'پایان دوره کارکرد جهت تسویه (تا تاریخ):',
    daysInSelectedPeriod: (count) => `${count} روز کاری در دوره انتخابی`,
    upToPrevMonthEnd: (date) => `تا پایان ماه قبل (${date})`,
    upToToday: '{c.upToToday}',
    allDays: 'همه روزها',
    selectWorkGroup: '{c.selectWorkGroup}',
    supervisorRecipientLabel: 'سرپرست {c.recipientBadge} وجه:',
    masterSupervisorTag: '(استادکار / سرپرست)',
    groupMembersCountLabel: 'تعداد افراد گروه:',
    membersCount: (count) => `${count} نفر`,
    totalGrossWorkAllMembers: '{c.totalGrossWorkAllMembers}',
    minusTotalAdvancesMembers: '(-) مجموع مساعده‌های اعضای گروه:',
    totalNetPayableToSupervisor: '{c.totalNetPayableToSupervisor}',
    workBreakdownEachMember: '{c.workBreakdownEachMember}',
    afterSubmitAllSettledNote: '{c.afterSubmitAllSettledNote}',
    noWorkersInGroup: '{c.noWorkersInGroup}',
    masterSupervisorTitle: 'استادکار / سرپرست',
    recipientBadge: 'دریافت‌کننده',
    dayUnit: 'روز',
    advanceLabel: 'مساعده:',
    workersWithArrearsLabel: 'پرسنل دارای معوقه / مانده:',
    debtorSuffix: '(بدهکار)',
    creditorSuffix: '(بستانکار)',
    totalPeriodGross: '{c.totalPeriodGross}',
    workDaysUnit: 'روز کاری',
    openAdvancesDeducted: '{c.openAdvancesDeducted}',
    currentAdvancesCountUnit: 'فقره مساعده جاری',
    finalBalanceDue: '{c.finalBalanceDue}',
    claimsUpToDate: (date) => `مجموع مطالبات تا تاریخ ${date}`,
    claimsUpToToday: 'مجموع مطالبات تا تاریخ امروز',
    paymentStrategyTitle: 'استراتژی پرداخت در تسویه خودکار:',
    state1FullTitle: '{c.state1FullTitle}',
    state1FullDesc: '{c.state1FullDesc}',
    state2PartialTitle: '{c.state2PartialTitle}',
    state2PartialDesc: '{c.state2PartialDesc}',
    amountShortcutsLabel: '{c.amountShortcutsLabel}',
    settleFull100: '{c.settleFull100}',
    fiftyPercentClaim: '{c.fiftyPercentClaim}',
    roundTo50K: '{c.roundTo50K}',
    fullSettlementNotice: '{c.fullSettlementNotice}',
    allDaysClosedNotice: '{c.allDaysClosedNotice}',
    balanceAfterPaymentLabel: 'مانده طلب پرسنل پس از این پرداخت:',
    formulaExplainer: (target, paid) => `فرمول محاسبه: مانده کل (${target}) - پرداختی (${paid}) = مانده معوقه جدید`,
    enterAmountPrompt: 'مبلغ مورد نظر برای پرداخت را در فرم زیر وارد کنید تا مانده جدید محاسبه گردد.',
    unsettledDaysBreakdownTitle: (count) => `ریز روزهای کارکرد تسویه‌نشده (${count} روز)`,
    fifoTag: '{c.fifoTag}',
    hideList: 'بستن لیست',
    viewList: 'مشاهده لیست',
    allPreviousDaysSettled: '{c.allPreviousDaysSettled}',
    coveredStatus: 'پوشش داده شده',
    openArrearsStatus: 'معوقه باز',
    finalPaymentToSupervisorLabel: 'مبلغ نهایی پرداختی به سرپرست',
    paymentCustomSettlementLabel: 'مبلغ پرداختی این تسویه سفارشی',
    resetToTotalAmount: (amount) => `بازنشانی به کل مبلغ (${amount})`,
    settlementPaymentAccount: 'حساب یا صندوق پرداختی تسویه:',
    defaultPrefix: 'پیش‌فرض: ',
    bankCardPrefix: '💳 کارت بانکی: ',
    cashDeskPrefix: '🪙 صندوق نقدی: ',
    balancePrefix: 'موجودی: ',
    defaultStar: '⭐ [پیش‌فرض]',
    workshopCashDesk: '{c.workshopCashDesk}',
    overdraftDeficitBlocked: 'کسری موجودی - ثبت غیرمجاز',
    overdraftDeficitAllowed: 'هشدار کسری موجودی (مجاز در تنظیمات سیستم)',
    overdraftDeficitPrompt: 'هشدار کسری موجودی حساب',
    overdraftBlockedDesc: (bal, short) => `موجودی حساب انتخابی (${bal}) کافی نیست (کسری: ${short}). بر اساس تنظیمات سیستم، ثبت با موجودی منفی «غیرمجاز» است.`,
    overdraftAllowedDesc: (bal, short) => `مبلغ تسویه از موجودی فعلی حساب (${bal}) بیشتر است (کسری: ${short}). با توجه به تنظیم بودن بر روی «همیشه مجاز»، این تراکنش با مانده منفی ثبت خواهد شد.`,
    overdraftPromptDesc: (bal, short) => `مبلغ تسویه از موجودی حساب (${bal}) بیشتر است (کسری: ${short}). هنگام کلیک بر روی ثبت، پنجره تأیید کسر موجودی نمایش داده می‌شود.`,
    referencePlaceholder: 'شماره چک، رسید بانکی یا سند تسویه',
    closeSelectedDaysOnly: (days) => `بستن و علامت‌گذاری قطعی فقط برای ${days} روز انتخاب‌شده (سایر روزها باز می‌مانند)`,
    closeCoveredDaysOnly: 'بستن کارکردهای پوشش‌داده‌شده با این مبلغ (مانده کارکردها به عنوان معوقه ثبت خواهند شد)',
    settleAllGroupMembers: (count) => `تسویه قطعی و بستن کارکرد باز تمام ${count} نفر اعضای گروه`,
    closeCoveredDaysWithRemainder: (rem, sym) => `بستن روزهای پوشش‌داده‌شده با این مبلغ (مانده ${rem} ${sym} به عنوان معوقه باقی می‌ماند)`,
    paidAmountLabel: '{c.paidAmountLabel}',
    zeroAmount: '۰',
    arrearsBalanceLabel: 'مانده معوقه:',
    workerPrefix: 'پرسنل: ',
    supervisorPrefix: 'سرپرست: ',
    undefinedSupervisorShort: 'تعریف‌نشده',
    cancelEsc: '{c.cancelEsc}',
    submitting: 'در حال ثبت...',
    insufficientFundsBlockedBtn: 'کسری موجودی (غیرمجاز)',
    submitGroupSettlementBtn: (count) => `ثبت تسویه گروهی با سرپرست (${count} نفر)`,
    submitDetailedSettlementBtn: (days) => `ثبت تسویه با جزئیات (${days} روز)`,
    inSelectedPeriodSuffix: 'در دوره انتخابی'
  },
  ku: {
    groupNameDefault: 'گرووپ',
    supNameDefault: 'سەرپەرشتیار',
    groupSettlementNotes: (groupName, supName, count) => `پاکتاوی حیسابی گرووپی ${groupName} لەگەڵ سەرپەرشتیار (${supName}) - بە بەشداری ${count} کەس`,
    individualSettlementNotes: (daysCount) => `تەسویەی حیساب (${daysCount} ڕۆژی کارکرد)`,
    validAmountError: 'تکایە بڕێکی دروست بنووسە.',
    selectSupervisorError: 'تکایە سەرپەرشتیاری گرووپ بۆ وەرگرتن و پاکتاو دیاری بکە.',
    selectedAccountDefault: 'حیسابی هەڵبژێردراو',
    cashAccountDefault: 'سندوق/بانک',
    overdraftBlockedPolicyError: (accName) => `باڵانسی حیسابی هەڵبژێردراو (${accName}) بەش ناکات بۆ ئەم پاکتاوە و بەپێی سیاسەتی کارگە، کەمیی باڵانس قەدەغەیە.`,
    targetWorkerNotSpecifiedError: 'کرێکاری مەبەست بۆ پاکتاوی حیساب دیاری نەکراوە.',
    noCustomRecordSelectedError: 'هیچ تۆمارێک بۆ پاکتاوی تایبەت هەڵنەبژێردراوە.',
    customSettlementAuditDesc: (name) => `تۆمارکردنی پاکتاوی حیساب / پێشەکی تایبەت بۆ ${name}`,
    systemUser: 'بەکارهێنەری سیستەم',
    groupSettlementAuditDesc: (count, groupName) => `تۆمارکردنی پاکتاوی گرووپی بۆ ${count} کەس (گرووپی ${groupName})`,
    individualSettlementAuditDesc: (name) => `تۆمارکردنی پاکتاوی حیساب / پێشەکی بۆ ${name}`,
    groupPrefix: 'گرووپی ',
    negativeBalanceWarningToast: (accName, formattedNeg) => `پاکتاو تۆمارکرا. ئاگاداری: باڵانسی حیسابی «${accName}» بوو بە نێگەتیڤ ${formattedNeg}.`,
    errorSavingSettlement: 'هەڵە لە تۆمارکردنی پاکتاوی حیساب',
    groupSettlementModalTitle: 'پاکتاوی حیسابی گرووپی لەگەڵ سەرپەرشتیار',
    individualSettlementModalTitle: 'پاکتاوی حیساب و پارەدان',
    autoSettlementTab: 'پاکتاوی خۆکار',
    customSettlementTab: 'پاکتاو بە وردەکاری',
    workGroup: 'گرووپی کار',
    supervisor: 'سەرپەرشتیار:',
    undefinedSupervisor: 'دیارینەکراو',
    allOpenArrears: 'کۆی گشتی داواکارییە کراوەکان',
    selectWorkerForSettlement: 'هەڵبژاردنی کرێکار بۆ پاکتاوی حیساب',
    changeWorkerTooltip: 'هەڵبژاردنی کرێکارێکی تر',
    changeWorkerBtn: 'گۆڕینی کرێکار',
    closeTooltip: 'داخستن (ESC)',
    quickAutoTooltip: 'پاکتاوی خۆکار و خێرا',
    quickSettlement: 'پاکتاوی خێرا',
    customDetailedTooltip: 'پاکتاو بە وردەکاری و تایبەت',
    detailedSettlement: 'پاکتاو بە وردەکاری',
    individualTooltip: 'پاکتاوی تاکەکەسی کرێکار',
    individualLabel: 'تاکەکەسی',
    groupTooltip: 'پاکتاوی گرووپی لەگەڵ سەرپەرشتیار',
    groupLabel: 'گرووپی',
    selectWorkerScreenTitle: 'هەڵبژاردنی کرێکار بۆ پاکتاوی حیساب',
    selectWorkerScreenSubtitle: 'کرێکاری مەبەست هەڵبژێرە بۆ بارکردنی باڵانس و وردەکارییەکانی پاکتاو:',
    activeWorkersCount: (count) => `${count} کەسی چالاک`,
    withArrearsTab: 'خاوەن ماوە',
    allWorkersTab: 'هەموو کرێکاران',
    settledTab: 'پاکتاوکراو',
    searchWorkersPlaceholder: 'گەڕان بەدوای ناوی کرێکار، پلە، ژمارەی پەیوەندی...',
    defaultInitialChar: 'ک',
    defaultWorkerRole: 'کرێکار',
    hasDueBadge: 'خاوەن ماوە',
    settledBadge: 'پاکتاوکراو',
    totalDueForSettlementLabel: 'کۆی گشتی باڵانس بۆ پاکتاو:',
    noWorkersWithArrears: 'هیچ کرێکارێک باڵانسی کراوەی نییە',
    noWorkersFound: 'هیچ کرێکارێک بەم زانیارییانە نەدۆزرایەوە',
    allSettledDesc: 'هەموو حیساباتی کرێکاران پاکتاو کراون و قەرزی کراوە نییە.',
    changeSearchDesc: 'تکایە دەستەواژەی گەڕان یان فلتەری دۆخەکە بگۆڕە.',
    viewAllWorkersBtn: 'بینینی هەموو کرێکاران',
    selectWorkerCustomTitle: 'هەڵبژاردنی کرێکار بۆ پاکتاوی تایبەت:',
    customDateFilterTitle: 'فلتەری مەودای کاتی دڵخواز:',
    clearRangeBtn: 'سڕینەوەی مەودا',
    fromDateLabel: 'لە بەرواری (دەستپێکی مەودا):',
    toDateLabel: 'تا بەرواری (کۆتایی مەودا):',
    rangeShortcutsLabel: 'کورتەبڕەکانی مەودا:',
    entirePrevMonth: 'تەواوی مانگی پێشوو',
    currentMonth: 'مانگی ئێستا',
    first15Days: '١٥ ڕۆژی یەکەمی مانگ',
    second15Days: '١٥ ڕۆژی دووەمی مانگ',
    financialComponentType: 'جۆری بڕگەی دارایی بۆ پاکتاو:',
    allItems: 'هەموو بڕگەکان',
    onlyDaily: 'تەنها ڕۆژانە',
    onlyOvertime: 'تەنها کاتی زیادە',
    filterByProjectSection: 'فلتەرکردن بەپێی بەشی پڕۆژە:',
    allWorkshopSections: 'هەموو بەشەکانی کارگە',
    deductOpenAdvancesLabel: (amount, symbol) => `داشکاندنی پێشەکییە کراوەکانی کرێکار (${amount} ${symbol})`,
    deductAdvancesActiveTip: 'پێشەکییە کراوەکان بەپێی ئەم پاکتاوە دادەشکێنرێن.',
    deductAdvancesInactiveTip: 'بە ناچالاککردن، تەواوی کارکرد بێ داشکاندنی پێشەکی دەدرێت.',
    deselectAllDays: 'پوچەڵکردنەوەی هەڵبژاردنی هەموو',
    selectAllDays: 'هەڵبژاردنی هەموو ڕۆژەکان',
    daysSelectedSummary: (sel, total) => `(${sel} لە ${total} ڕۆژ هەڵبژێردراوە)`,
    selectAll: 'هەڵبژاردنی هەموو',
    deselectAll: 'لابردنی هەموو',
    noRecordsMatchFilters: 'هیچ تۆمارێک هاوتای فلتەرە دیاریکراوەکان نەدۆزرایەوە.',
    halfDay: 'نیوەڕۆژ',
    hourly: 'کاتژمێری',
    fullDay: 'تەواو',
    overtimePrefix: 'کاتی زیادە: +',
    financialBalanceSelectedItems: (days) => `باڵانسی دارایی بڕگە هەڵبژێردراوەکان (${days} ڕۆژی کار):`,
    grossTotalLabel: 'کۆی گشتی ناخاڵس:',
    advancesDeductedInSettlement: '(-) پێشەکییە داشکێنراوەکان لەم پاکتاوەدا:',
    netPayableCustomSettlement: 'بڕی خاڵسی شایستەی پارەدان بۆ ئەم پاکتاوە تایبەتە:',
    amountAutoConfiguredNotice: 'ئەم بڕە بە شێوەیەکی خۆکار لە خانەی پارەدانی خوارەوە ڕێکخراوە.',
    periodCutoffLabel: 'پایانی ماوەی کارکرد بۆ پاکتاو (تا بەرواری):',
    daysInSelectedPeriod: (count) => `${count} ڕۆژی کار لە ماوەی هەڵبژێردراو`,
    upToPrevMonthEnd: (date) => `تا کۆتایی مانگی پێشوو (${date})`,
    upToToday: 'تا ئەمڕۆ',
    allDays: 'هەموو ڕۆژەکان',
    selectWorkGroup: 'هەڵبژاردنی گرووپی کار:',
    supervisorRecipientLabel: 'سەرپەرشتیاری وەرگری پارە:',
    masterSupervisorTag: '(وەستا / سەرپەرشتیار)',
    groupMembersCountLabel: 'ژمارەی ئەندامانی گرووپ:',
    membersCount: (count) => `${count} کەس`,
    totalGrossWorkAllMembers: 'کۆی گشتی ناخاڵسی کارکردی هەموو ئەندامان:',
    minusTotalAdvancesMembers: '(-) کۆی گشتی پێشەکی ئەندامانی گرووپ:',
    totalNetPayableToSupervisor: 'کۆی گشتی کارکردی خاڵسی شایستەی پارەدان بە سەرپەرشتیار:',
    workBreakdownEachMember: 'وردەکاری کارکرد و پشکی هەر یەک لە ئەندامانی گرووپ:',
    afterSubmitAllSettledNote: '(پاش تۆمارکردن، هەموویان پاکتاو دەکرێن)',
    noWorkersInGroup: 'هیچ کەسێک لەم گرووپەدا نەدۆزرایەوە.',
    masterSupervisorTitle: 'وەستا / سەرپەرشتیار',
    recipientBadge: 'وەرگر',
    dayUnit: 'ڕۆژ',
    advanceLabel: 'پێشەکی:',
    workersWithArrearsLabel: 'کرێکارانی خاوەن ماوە / باڵانس:',
    debtorSuffix: '(قەرزدار)',
    creditorSuffix: '(شایستەی پارە)',
    totalPeriodGross: 'کۆی گشتی کارکردی ناخاڵسی ماوە',
    workDaysUnit: 'ڕۆژی کار',
    openAdvancesDeducted: 'پێشەکییە کراوە داشکێنراوەکان',
    currentAdvancesCountUnit: 'پێشەکییە بەردەوامەکان',
    finalBalanceDue: 'باڵانسی کۆتایی وادە (داواکاری خاڵس)',
    claimsUpToDate: (date) => `کۆی گشتی داواکارییەکان تا بەرواری ${date}`,
    claimsUpToToday: 'کۆی گشتی داواکارییەکان تا بەرواری ئەمڕۆ',
    paymentStrategyTitle: 'شێوازی پارەدان لە پاکتاوی خۆکاردا:',
    state1FullTitle: 'دۆخی ١: پاکتاوی تەواوی داواکاری (١٠٠٪)',
    state1FullDesc: 'پاکتاوکردنی تەواوی ڕۆژە کراوەکان و گەیاندنی باڵانسی کرێکار بۆ ٠',
    state2PartialTitle: 'دۆخی ٢: پێدانی بڕی دڵخواز (پاکتاوی بەشەکی)',
    state2PartialDesc: 'نووسینی بڕی دڵخواز، داپۆشینی ترتیبی ڕۆژەکان (FIFO) و مانەوەی ئەوی تر وەک قەرز',
    amountShortcutsLabel: 'کورتەبڕە خێراکانی بڕ:',
    settleFull100: 'پاکتاوی تەواو (١٠٠٪)',
    fiftyPercentClaim: '٥٠٪ی بڕی داواکراو',
    roundTo50K: 'ڕەوندکردن بۆ ٥٠ هەزار',
    fullSettlementNotice: 'پاکتاوی تەواو: باڵانسی داواکاری کرێکار پاش ئەم تۆمارە دەبێتە سفر (٠).',
    allDaysClosedNotice: 'تەواوی ڕۆژە کراوەکانی کارکرد پاکتاو و دادەخرێن.',
    balanceAfterPaymentLabel: 'باڵانسی داواکاری کرێکار پاش ئەم پارەدانە:',
    formulaExplainer: (target, paid) => `فۆرمولەی هەژمارکردن: باڵانسی گشتی (${target}) - پارەدراو (${paid}) = باڵانسی نوێی قەرز`,
    enterAmountPrompt: 'بڕی دڵخواز بۆ پارەدان لە خوارەوە بنووسە تا باڵانسی نوێ هەژمار بکرێت.',
    unsettledDaysBreakdownTitle: (count) => `وردەکاری ڕۆژە پاکتاونەکراوەکان (${count} ڕۆژ)`,
    fifoTag: 'پاکتاوی ترتیبی (FIFO)',
    hideList: 'داخستنی لیست',
    viewList: 'بینینی لیست',
    allPreviousDaysSettled: 'تەواوی ڕۆژەکانی کارکردی پێشوو پاکتاو کراون و ڕۆژی پاکتاونەکراو نییە.',
    coveredStatus: 'داپۆشراو',
    openArrearsStatus: 'ماوەی کراوە',
    finalPaymentToSupervisorLabel: 'بڕی کۆتایی شایستەی پارەدان بە سەرپەرشتیار',
    paymentCustomSettlementLabel: 'بڕی پارەدانی ئەم پاکتاوە تایبەتە',
    resetToTotalAmount: (amount) => `گێڕانەوە بۆ تەواوی بڕ (${amount})`,
    settlementPaymentAccount: 'حیساب یان سندوقی پارەدانی پاکتاو:',
    defaultPrefix: 'بنەڕەتی: ',
    bankCardPrefix: '💳 کارتی بانکی: ',
    cashDeskPrefix: '🪙 سندوقی نەختینە: ',
    balancePrefix: 'باڵانس: ',
    defaultStar: '⭐ [بنەڕەتی]',
    workshopCashDesk: 'سندوقی نەختی کارگە',
    overdraftDeficitBlocked: 'کەمیی باڵانس - تۆمارکردن قەدەغەیە',
    overdraftDeficitAllowed: 'ئاگاداری کەمی باڵانس (ڕێگەپێدراوە لە ڕێکخستنەکان)',
    overdraftDeficitPrompt: 'ئاگاداری کەمیی باڵانسی حیساب',
    overdraftBlockedDesc: (bal, short) => `باڵانسی حیسابی هەڵبژێردراو (${bal}) بەش ناکات (کەمی: ${short}). بەپێی ڕێکخستنەکان، تۆمارکردن بە باڵانسی نێگەتیڤ قەدەغەیە.`,
    overdraftAllowedDesc: (bal, short) => `بڕی پاکتاو لە باڵانسی ئێستای حیساب (${bal}) زیاترە (کەمی: ${short}). بەهۆی ڕێکخستنی «هەمیشە ڕێگەپێدراو»، ئەم مامەڵەیە بە باڵانسی نێگەتیڤ تۆماردەکرێت.`,
    overdraftPromptDesc: (bal, short) => `بڕی پاکتاو لە باڵانسی حیساب (${bal}) زیاترە (کەمی: ${short}). لە کاتی کلیک لەسەر تۆمارکردن، پەنجەرەی دڵنیابوونەوەی کەمی باڵانس نیشان دەدرێت.`,
    referencePlaceholder: 'ژمارەی چەک، وەسڵی بانکی یان بەڵگەنامەی پاکتاو',
    closeSelectedDaysOnly: (days) => `داخستن و دیاریکردنی یەکلاکەرەوە تەنها بۆ ${days} ڕۆژی هەڵبژێردراو (ڕۆژەکانی تر بە کراوەیی دەمێننەوە)`,
    closeCoveredDaysOnly: 'داخستنی کارکردە داپۆشراوەکان بەم بڕە (ماوەی کارکردەکان وەک قەرز دەمێننەوە)',
    settleAllGroupMembers: (count) => `پاکتاوی کۆتایی و داخستنی کارکردی کراوەی هەموو ${count} ئەندامانی گرووپ`,
    closeCoveredDaysWithRemainder: (rem, sym) => `داخستنی ڕۆژە داپۆشراوەکان بەم بڕە (ماوەی ${rem} ${sym} وەک قەرز دەمێنێتەوە)`,
    paidAmountLabel: 'بڕی پارەدراو:',
    zeroAmount: '٠',
    arrearsBalanceLabel: 'باڵانسی ماوە:',
    workerPrefix: 'کرێکار: ',
    supervisorPrefix: 'سەرپەرشتیار: ',
    undefinedSupervisorShort: 'دیارینەکراو',
    cancelEsc: 'پاشگەزبوونەوە (ESC)',
    submitting: 'تۆماردەکرێت...',
    insufficientFundsBlockedBtn: 'کەمیی باڵانس (ڕێگاپێنەدراو)',
    submitGroupSettlementBtn: (count) => `تۆمارکردنی پاکتاوی گرووپی لەگەڵ سەرپەرشتیار (${count} کەس)`,
    submitDetailedSettlementBtn: (days) => `تۆمارکردنی پاکتاو بە وردەکاری (${days} ڕۆژ)`,
    inSelectedPeriodSuffix: 'لە ماوەی هەڵبژێردراو'
  },
  en: {
    groupNameDefault: 'Group',
    supNameDefault: 'Supervisor',
    groupSettlementNotes: (groupName, supName, count) => `Group settlement for ${groupName} with supervisor (${supName}) - includes ${count} members`,
    individualSettlementNotes: (daysCount) => `Settlement payment (${daysCount} work days)`,
    validAmountError: 'Please enter a valid amount.',
    selectSupervisorError: 'Please specify the group supervisor for receipt and settlement.',
    selectedAccountDefault: 'Selected Account',
    cashAccountDefault: 'Cash/Bank',
    overdraftBlockedPolicyError: (accName) => `Insufficient balance in selected account (${accName}) and overdraft policy is set to blocked.`,
    targetWorkerNotSpecifiedError: 'Target worker for settlement is not specified.',
    noCustomRecordSelectedError: 'No record selected for custom settlement.',
    customSettlementAuditDesc: (name) => `Recorded custom settlement / advance for ${name}`,
    systemUser: 'System User',
    groupSettlementAuditDesc: (count, groupName) => `Recorded group settlement for ${count} workers (Group ${groupName})`,
    individualSettlementAuditDesc: (name) => `Recorded settlement / advance for ${name}`,
    groupPrefix: 'Group ',
    negativeBalanceWarningToast: (accName, formattedNeg) => `Settlement recorded. Note: Account balance for "${accName}" is now negative ${formattedNeg}.`,
    errorSavingSettlement: 'Error saving settlement',
    groupSettlementModalTitle: 'Group Settlement with Supervisor',
    individualSettlementModalTitle: 'Settlement & Payment',
    autoSettlementTab: 'Auto Settlement',
    customSettlementTab: 'Detailed Settlement',
    workGroup: 'Work Group',
    supervisor: 'Supervisor:',
    undefinedSupervisor: 'Not Defined',
    allOpenArrears: 'Total Open Claims',
    selectWorkerForSettlement: 'Select Worker for Settlement',
    changeWorkerTooltip: 'Select another worker',
    changeWorkerBtn: 'Change Worker',
    closeTooltip: 'Close (ESC)',
    quickAutoTooltip: 'Quick & Auto Settlement',
    quickSettlement: 'Quick Settlement',
    customDetailedTooltip: 'Detailed & Custom Settlement',
    detailedSettlement: 'Detailed Settlement',
    individualTooltip: 'Individual Worker Settlement',
    individualLabel: 'Individual',
    groupTooltip: 'Group Settlement with Supervisor',
    groupLabel: 'Group',
    selectWorkerScreenTitle: 'Select Worker for Settlement',
    selectWorkerScreenSubtitle: 'Select a worker to load their balance and settlement details:',
    activeWorkersCount: (count) => `${count} Active Workers`,
    withArrearsTab: 'With Arrears',
    allWorkersTab: 'All Workers',
    settledTab: 'Settled',
    searchWorkersPlaceholder: 'Search worker name, role, phone...',
    defaultInitialChar: 'W',
    defaultWorkerRole: 'Worker',
    hasDueBadge: 'With Arrears',
    settledBadge: 'Settled',
    totalDueForSettlementLabel: 'Total Balance Due for Settlement:',
    noWorkersWithArrears: 'No workers have outstanding arrears',
    noWorkersFound: 'No workers found matching criteria',
    allSettledDesc: 'All worker accounts are settled with zero outstanding balance.',
    changeSearchDesc: 'Please change the search query or status filter.',
    viewAllWorkersBtn: 'View All Workers',
    selectWorkerCustomTitle: 'Select worker for custom settlement:',
    customDateFilterTitle: 'Custom Date Range Filter:',
    clearRangeBtn: 'Clear Range',
    fromDateLabel: 'From Date (Start):',
    toDateLabel: 'To Date (End):',
    rangeShortcutsLabel: 'Range Shortcuts:',
    entirePrevMonth: 'Entire Last Month',
    currentMonth: 'Current Month',
    first15Days: 'First 15 Days of Month',
    second15Days: 'Second 15 Days of Month',
    financialComponentType: 'Financial Component for Settlement:',
    allItems: 'All Items',
    onlyDaily: 'Daily Wage Only',
    onlyOvertime: 'Overtime Only',
    filterByProjectSection: 'Filter by Project Section:',
    allWorkshopSections: 'All Workshop Sections',
    deductOpenAdvancesLabel: (amount, symbol) => `Deduct worker open advances (${amount} ${symbol})`,
    deductAdvancesActiveTip: 'Open advances will be deducted proportionally from this settlement.',
    deductAdvancesInactiveTip: 'When disabled, full wages are paid without advance deduction.',
    deselectAllDays: 'Deselect All',
    selectAllDays: 'Select All Days',
    daysSelectedSummary: (sel, total) => `(${sel} of ${total} days selected)`,
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    noRecordsMatchFilters: 'No records matched the selected filters.',
    halfDay: 'Half Day',
    hourly: 'Hourly',
    fullDay: 'Full Day',
    overtimePrefix: 'Overtime: +',
    financialBalanceSelectedItems: (days) => `Financial balance of selected items (${days} work days):`,
    grossTotalLabel: 'Gross Total:',
    advancesDeductedInSettlement: '(-) Advances deducted in this settlement:',
    netPayableCustomSettlement: 'Net payable for this custom settlement:',
    amountAutoConfiguredNotice: 'This amount is automatically configured in the payment field below.',
    periodCutoffLabel: 'Work period end for settlement (Up to date):',
    daysInSelectedPeriod: (count) => `${count} work days in selected period`,
    upToPrevMonthEnd: (date) => `Up to last month end (${date})`,
    upToToday: 'Up to Today',
    allDays: 'All Days',
    selectWorkGroup: 'Select Work Group:',
    supervisorRecipientLabel: 'Supervisor Recipient:',
    masterSupervisorTag: '(Master / Supervisor)',
    groupMembersCountLabel: 'Group Members Count:',
    membersCount: (count) => `${count} members`,
    totalGrossWorkAllMembers: 'Total Gross Wages of All Members:',
    minusTotalAdvancesMembers: '(-) Total Advances of Group Members:',
    totalNetPayableToSupervisor: 'Total Net Payable to Supervisor:',
    workBreakdownEachMember: 'Work Breakdown & Share of Each Group Member:',
    afterSubmitAllSettledNote: '(After submission, all will be settled)',
    noWorkersInGroup: 'No workers found in this group.',
    masterSupervisorTitle: 'Master / Supervisor',
    recipientBadge: 'Recipient',
    dayUnit: 'Days',
    advanceLabel: 'Advance:',
    workersWithArrearsLabel: 'Workers with Arrears / Balance:',
    debtorSuffix: '(Debtor)',
    creditorSuffix: '(Creditor)',
    totalPeriodGross: 'Total Period Gross Wages',
    workDaysUnit: 'Work Days',
    openAdvancesDeducted: 'Open Advances Deducted',
    currentAdvancesCountUnit: 'Active Advances',
    finalBalanceDue: 'Final Balance Due (Net Claim)',
    claimsUpToDate: (date) => `Total claims up to ${date}`,
    claimsUpToToday: 'Total claims up to today',
    paymentStrategyTitle: 'Payment Strategy in Auto Settlement:',
    state1FullTitle: 'Mode 1: Full Settlement of Total Claim (100%)',
    state1FullDesc: 'Settle all open days and reduce worker balance to 0',
    state2PartialTitle: 'Mode 2: Pay Custom Amount (Partial Settlement)',
    state2PartialDesc: 'Enter custom amount, FIFO sequential log coverage, remainder kept in arrears',
    amountShortcutsLabel: 'Quick Amount Shortcuts:',
    settleFull100: 'Full Settlement (100%)',
    fiftyPercentClaim: '50% of Due Amount',
    roundTo50K: 'Round to nearest 50K',
    fullSettlementNotice: 'Full settlement: Worker due balance will become zero (0) after this payment.',
    allDaysClosedNotice: 'All open work days will be settled and closed.',
    balanceAfterPaymentLabel: 'Worker balance due after this payment:',
    formulaExplainer: (target, paid) => `Formula: Total Due (${target}) - Paid (${paid}) = New Arrears Balance`,
    enterAmountPrompt: 'Enter desired payment amount below to calculate new balance.',
    unsettledDaysBreakdownTitle: (count) => `Breakdown of unsettled work days (${count} days)`,
    fifoTag: 'Sequential Settlement (FIFO)',
    hideList: 'Hide List',
    viewList: 'View List',
    allPreviousDaysSettled: 'All previous work days have been settled; no unsettled days exist.',
    coveredStatus: 'Covered',
    openArrearsStatus: 'Open Arrears',
    finalPaymentToSupervisorLabel: 'Final payment amount to supervisor',
    paymentCustomSettlementLabel: 'Payment amount for this custom settlement',
    resetToTotalAmount: (amount) => `Reset to full amount (${amount})`,
    settlementPaymentAccount: 'Settlement Payment Account:',
    defaultPrefix: 'Default: ',
    bankCardPrefix: '💳 Bank Card: ',
    cashDeskPrefix: '🪙 Cash Drawer: ',
    balancePrefix: 'Balance: ',
    defaultStar: '⭐ [Default]',
    workshopCashDesk: 'Workshop Cash Drawer',
    overdraftDeficitBlocked: 'Insufficient Balance - Transaction Blocked',
    overdraftDeficitAllowed: 'Deficit Warning (Allowed in system settings)',
    overdraftDeficitPrompt: 'Account Deficit Warning',
    overdraftBlockedDesc: (bal, short) => `Account balance (${bal}) is insufficient (Shortfall: ${short}). Policy strictly prohibits negative balance.`,
    overdraftAllowedDesc: (bal, short) => `Settlement amount exceeds current balance (${bal}) by ${short}. With "Always Allow" policy, this will be recorded with negative balance.`,
    overdraftPromptDesc: (bal, short) => `Settlement amount exceeds balance (${bal}) by ${short}. A confirmation modal will appear upon submission.`,
    referencePlaceholder: 'Cheque number, bank receipt or voucher',
    closeSelectedDaysOnly: (days) => `Close and finalize only for ${days} selected days (other days remain open)`,
    closeCoveredDaysOnly: 'Close logs covered by this amount (remainder recorded as arrears)',
    settleAllGroupMembers: (count) => `Final settlement and closing open logs for all ${count} group members`,
    closeCoveredDaysWithRemainder: (rem, sym) => `Close logs covered by this amount (${rem} ${sym} remains in arrears)`,
    paidAmountLabel: 'Paid Amount:',
    zeroAmount: '0',
    arrearsBalanceLabel: 'Arrears Balance:',
    workerPrefix: 'Worker: ',
    supervisorPrefix: 'Supervisor: ',
    undefinedSupervisorShort: 'Not Defined',
    cancelEsc: 'Cancel (ESC)',
    submitting: 'Saving...',
    insufficientFundsBlockedBtn: 'Insufficient Funds (Blocked)',
    submitGroupSettlementBtn: (count) => `Submit Group Settlement with Supervisor (${count} members)`,
    submitDetailedSettlementBtn: (days) => `Submit Detailed Settlement (${days} days)`,
    inSelectedPeriodSuffix: 'in selected period'
  }
};

export function SettlementModal({ 
  isOpen, 
  onClose, 
  worker: propWorker, 
  month = getCurrentYearMonth(),
  workerLogs = [],
  workerPayments = [],
  allWorkers = [],
  allGroups = [],
  allLogs = [],
  allPayments = [],
  initialMode = 'individual',
  initialGroupId = null,
  onSettlementComplete,
  arrearsList = [],
  onSelectWorker
}) {
  const { t, language, numberFormat } = useLanguage();
  const c = COPY[language] || COPY.fa;
  const { currentProject } = useProject();
  const { user } = useAuth();
  const { currentUser } = usePermissions();
  const currency = currentProject?.currency || 'IQD';

  const [localWorker, setLocalWorker] = useState(null);
  const [workerSearchQuery, setWorkerSearchQuery] = useState('');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('with_arrears'); // 'with_arrears' | 'all' | 'settled'
  const worker = localWorker || propWorker || null;

  // Fallback Dexie live queries if caller did not pass all datasets
  const dbLogs = useLiveQuery(() => db.attendanceLogs.toArray(), []);
  const dbPayments = useLiveQuery(() => db.payments.toArray(), []);
  const dbWorkers = useLiveQuery(() => db.workers.toArray(), []);
  const dbGroups = useLiveQuery(() => db.groups.toArray(), []);

  const effectiveAllLogs = (allLogs && allLogs.length > 0) ? allLogs : (dbLogs || []);
  const effectiveAllPayments = (allPayments && allPayments.length > 0) ? allPayments : (dbPayments || []);
  const effectiveAllWorkers = (allWorkers && allWorkers.length > 0) ? allWorkers : (dbWorkers || []);
  const effectiveAllGroups = (allGroups && allGroups.length > 0) ? allGroups : (dbGroups || []);

  // Reset worker selection when modal opens or propWorker changes
  useEffect(() => {
    if (isOpen) {
      if (propWorker) {
        setLocalWorker(propWorker);
      } else {
        setLocalWorker(null);
      }
      setWorkerSearchQuery('');
      setWorkerStatusFilter('with_arrears');
    } else {
      setLocalWorker(null);
      setWorkerSearchQuery('');
      setWorkerStatusFilter('with_arrears');
    }
  }, [isOpen, propWorker]);

  // Determine initial mode based on props or worker's role
  const [settlementMode, setSettlementMode] = useState(() => {
    if (initialMode === 'group') return 'group';
    if (worker?.groupId && worker?.teamRole === 'Master') return 'group';
    return 'individual';
  });

  // Dual Settlement Architecture: 'auto' (Quick / Automatic FIFO) vs 'custom' (Detailed / Filter-Based)
  const [settlementTypeTab, setSettlementTypeTab] = useState('auto'); // 'auto' | 'custom'
  const [settleOption, setSettleOption] = useState('full'); // 'full' | 'partial'

  const [selectedGroupId, setSelectedGroupId] = useState(() => {
    if (initialGroupId) return initialGroupId;
    if (worker?.groupId) return worker.groupId;
    if (effectiveAllGroups.length > 0) return effectiveAllGroups[0].id;
    return '';
  });

  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  const handleCloseModal = () => {
    setLocalWorker(null);
    if (onSelectWorker) onSelectWorker(null);
    onClose();
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleCloseModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Active workers list for selection screen
  const activeWorkersList = useMemo(() => {
    return (effectiveAllWorkers || []).filter((w) => !w.deletedAt && !w.isArchived);
  }, [effectiveAllWorkers]);

  // Pre-calculated financials map for high UI performance and accurate sorting
  const workerFinancialsMap = useMemo(() => {
    const map = new Map();
    for (const w of activeWorkersList) {
      const fin = calculateWorkerFinancials(w, effectiveAllLogs, effectiveAllPayments, currency);
      map.set(String(w.id), fin);
    }
    return map;
  }, [activeWorkersList, effectiveAllLogs, effectiveAllPayments, currency]);

  const countWithArrears = useMemo(() => {
    return activeWorkersList.filter((w) => {
      const fin = workerFinancialsMap.get(String(w.id));
      return (fin?.netBalanceDue || 0) > 0;
    }).length;
  }, [activeWorkersList, workerFinancialsMap]);

  const countSettled = useMemo(() => {
    return activeWorkersList.filter((w) => {
      const fin = workerFinancialsMap.get(String(w.id));
      return (fin?.netBalanceDue || 0) <= 0;
    }).length;
  }, [activeWorkersList, workerFinancialsMap]);

  const filteredActiveWorkers = useMemo(() => {
    let list = activeWorkersList;

    if (workerStatusFilter === 'with_arrears') {
      list = list.filter((w) => {
        const fin = workerFinancialsMap.get(String(w.id));
        return (fin?.netBalanceDue || 0) > 0;
      });
    } else if (workerStatusFilter === 'settled') {
      list = list.filter((w) => {
        const fin = workerFinancialsMap.get(String(w.id));
        return (fin?.netBalanceDue || 0) <= 0;
      });
    }

    if (workerSearchQuery.trim()) {
      const q = workerSearchQuery.trim().toLowerCase();
      list = list.filter(
        (w) =>
          w.name?.toLowerCase().includes(q) ||
          w.role?.toLowerCase().includes(q) ||
          w.phone?.includes(q)
      );
    }

    // Sort: highest balance due first, then alphabetically by name
    return [...list].sort((a, b) => {
      const finA = workerFinancialsMap.get(String(a.id))?.netBalanceDue || 0;
      const finB = workerFinancialsMap.get(String(b.id))?.netBalanceDue || 0;
      if (finB !== finA) return finB - finA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeWorkersList, workerStatusFilter, workerSearchQuery, workerFinancialsMap]);

  // -------------------------------------------------------------
  // 1. INDIVIDUAL SETTLEMENT CALCULATIONS (Unified Single Source of Truth)
  // -------------------------------------------------------------
  const effectiveWorkerLogs = useMemo(() => {
    if (worker && effectiveAllLogs.length > 0) {
      return effectiveAllLogs.filter((l) => String(l.workerId) === String(worker.id) && !l.deletedAt);
    }
    return workerLogs || [];
  }, [worker, effectiveAllLogs, workerLogs]);

  const effectiveWorkerPayments = useMemo(() => {
    if (worker && effectiveAllPayments.length > 0) {
      return effectiveAllPayments.filter((p) => String(p.workerId) === String(worker.id) && !p.deletedAt && p.status !== 'deleted');
    }
    return (workerPayments || []).filter((p) => !p.deletedAt && p.status !== 'deleted');
  }, [worker, effectiveAllPayments, workerPayments]);

  const individualCalculations = useMemo(() => {
    if (!worker) {
      return {
        unsettledLogs: [],
        unsettledPayments: [],
        grossEarnings: 0,
        advancesDeducted: 0,
        totalCumulativeDebt: 0,
        effectiveDays: 0,
        otHours: 0,
        isLogSettled: () => false,
        getLogPay: () => 0
      };
    }
    const fin = calculateWorkerFinancials(worker, effectiveAllLogs, effectiveAllPayments, currency);
    return {
      ...fin,
      grossEarnings: fin.unsettledGross,
      advancesDeducted: fin.unsettledAdvances,
      totalCumulativeDebt: fin.netBalanceDue
    };
  }, [worker, effectiveAllLogs, effectiveAllPayments, currency]);

  const isLogSettled = individualCalculations.isLogSettled;
  const unsettledLogs = individualCalculations.unsettledLogs;
  const unsettledPayments = individualCalculations.unsettledPayments;

  // -------------------------------------------------------------
  // 2. GROUP SETTLEMENT CALCULATIONS (with Supervisor & All Members)
  // -------------------------------------------------------------
  const activeGroup = useMemo(() => {
    return (effectiveAllGroups || []).find((g) => g.id === selectedGroupId) || null;
  }, [effectiveAllGroups, selectedGroupId]);

  const groupMembers = useMemo(() => {
    if (!selectedGroupId) return [];
    return (effectiveAllWorkers || []).filter(
      (w) => w.groupId === selectedGroupId && !w.deletedAt && !w.isArchived
    );
  }, [effectiveAllWorkers, selectedGroupId]);

  // Automatically find or set the supervisor (Master)
  // IMPORTANT: Do NOT include selectedSupervisorId in deps — it would cause an
  // infinite loop: setSelectedSupervisorId → re-render → effect re-runs → repeat.
  // We read selectedSupervisorId via a ref so the effect only re-runs when
  // groupMembers actually changes (i.e., group selection changes).
  useEffect(() => {
    if (groupMembers.length > 0) {
      const masterWorker = groupMembers.find((w) => w?.teamRole === 'Master');
      if (masterWorker) {
        // Only update if the value is actually different to avoid infinite loops
        setSelectedSupervisorId((prev) => (prev === masterWorker.id ? prev : masterWorker.id));
      } else {
        setSelectedSupervisorId((prev) => {
          const validInGroup = groupMembers.some((w) => w.id === prev);
          if (!prev || !validInGroup) return groupMembers[0].id;
          return prev;
        });
      }
    }
  }, [groupMembers]);

  const supervisorWorker = useMemo(() => {
    return groupMembers.find((w) => w.id === selectedSupervisorId) || groupMembers[0] || null;
  }, [groupMembers, selectedSupervisorId]);

  // Compute breakdown for every member in the group
  const groupCalculations = useMemo(() => {
    if (!selectedGroupId || groupMembers.length === 0) {
      return {
        memberBreakdowns: [],
        totalGroupGross: 0,
        totalGroupAdvances: 0,
        totalGroupNetDue: 0,
        totalGroupDays: 0,
        totalGroupOtHours: 0,
        allGroupUnsettledLogs: [],
        allGroupUnsettledPayments: []
      };
    }

    const memberBreakdowns = [];
    let totalGroupGross = 0;
    let totalGroupAdvances = 0;
    let totalGroupNetDue = 0;
    let totalGroupDays = 0;
    let totalGroupOtHours = 0;
    const allGroupUnsettledLogs = [];
    const allGroupUnsettledPayments = [];

    groupMembers.forEach((m) => {
      const mFin = calculateWorkerFinancials(m, effectiveAllLogs, effectiveAllPayments, currency);

      memberBreakdowns.push({
        worker: m,
        isMaster: m?.teamRole === 'Master',
        unsettledLogs: mFin.unsettledLogs,
        unsettledPayments: mFin.unsettledPayments,
        effectiveDays: mFin.effectiveDays,
        otHours: mFin.otHours,
        gross: mFin.unsettledGross,
        advances: mFin.unsettledAdvances,
        netDue: mFin.netBalanceDue
      });

      totalGroupGross += mFin.unsettledGross;
      totalGroupAdvances += mFin.unsettledAdvances;
      totalGroupNetDue += mFin.netBalanceDue;
      totalGroupDays += mFin.effectiveDays;
      totalGroupOtHours += mFin.otHours;
      allGroupUnsettledLogs.push(...mFin.unsettledLogs);
      allGroupUnsettledPayments.push(...mFin.unsettledPayments);
    });

    // Sort breakdowns: Master first, then by netDue descending
    memberBreakdowns.sort((a, b) => {
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;
      return b.netDue - a.netDue;
    });

    return {
      memberBreakdowns,
      totalGroupGross: roundCurrency(totalGroupGross, currency),
      totalGroupAdvances: roundCurrency(totalGroupAdvances, currency),
      totalGroupNetDue: roundCurrency(totalGroupNetDue, currency),
      totalGroupDays,
      totalGroupOtHours,
      allGroupUnsettledLogs,
      allGroupUnsettledPayments
    };
  }, [selectedGroupId, groupMembers, effectiveAllLogs, effectiveAllPayments, currency]);

  // Previous month end date helper (e.g. 2026-09-30 if today is in October 2026)
  const prevMonthEndDate = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = new Date(y, m, 0);
    const py = d.getFullYear();
    const pm = d.getMonth() + 1;
    const pday = d.getDate();
    return `${py}-${String(pm).padStart(2, '0')}-${String(pday).padStart(2, '0')}`;
  }, []);

  // Settlement Period Cutoff Date for Auto Mode
  const [autoCutoffDate, setAutoCutoffDate] = useState(() => {
    const today = new Date();
    // If today is early in month (day <= 7), default to end of previous month
    if (today.getDate() <= 7) {
      const y = today.getFullYear();
      const m = today.getMonth();
      const d = new Date(y, m, 0);
      const py = d.getFullYear();
      const pm = d.getMonth() + 1;
      const pday = d.getDate();
      return `${py}-${String(pm).padStart(2, '0')}-${String(pday).padStart(2, '0')}`;
    }
    return getTodayDateString();
  });

  // Filtered Auto Mode calculations respecting the period cutoff date (autoCutoffDate)
  const autoPeriodIndividualCalculations = useMemo(() => {
    if (!worker) return individualCalculations;
    if (!autoCutoffDate) return individualCalculations;

    const periodLogs = individualCalculations.unsettledLogs.filter(
      (l) => (l.date || '') <= autoCutoffDate
    );
    const periodPayments = individualCalculations.unsettledPayments.filter(
      (p) => (p.date || '') <= autoCutoffDate
    );

    const wDaily = Number(String(worker.dailyRate).replace(/,/g, '')) || 0;
    const wOtRate = Number(String(worker.overtimeHourlyRate).replace(/,/g, '')) || 0;

    let fullDays = 0;
    let halfDays = 0;
    let hourlyDays = 0;
    let otHours = 0;
    let basePay = 0;
    let otPay = 0;
    let grossEarnings = 0;

    periodLogs.forEach((l) => {
      const pay = individualCalculations.getLogPay(l);
      const ot = Number(l.overtimeHours) || 0;
      const base = Number(l.calculatedDailyWage) || (l.type === 'half' ? wDaily * 0.5 : l.type === 'full' ? wDaily : 0);
      const otAmount = Number(l.calculatedOvertimeWage) || (ot * wOtRate);

      if (l.type === 'full') fullDays++;
      else if (l.type === 'half') halfDays++;
      else if (l.type === 'hourly') hourlyDays++;

      otHours += ot;
      basePay += base;
      otPay += otAmount;
      grossEarnings += pay;
    });

    const advancesDeducted = roundCurrency(
      periodPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      currency
    );

    const totalCumulativeDebt = roundCurrency(Math.max(0, grossEarnings - advancesDeducted), currency);
    const effectiveDays = fullDays + halfDays * 0.5;

    return {
      ...individualCalculations,
      unsettledLogs: periodLogs,
      unsettledPayments: periodPayments,
      fullDays,
      halfDays,
      hourlyDays,
      effectiveDays,
      otHours,
      basePay: roundCurrency(basePay, currency),
      otPay: roundCurrency(otPay, currency),
      grossEarnings: roundCurrency(grossEarnings, currency),
      unsettledGross: roundCurrency(grossEarnings, currency),
      advancesDeducted,
      unsettledAdvances: advancesDeducted,
      totalCumulativeDebt,
      netBalanceDue: totalCumulativeDebt
    };
  }, [worker, individualCalculations, autoCutoffDate, currency]);

  const autoPeriodGroupCalculations = useMemo(() => {
    if (!selectedGroupId || groupMembers.length === 0) return groupCalculations;
    if (!autoCutoffDate) return groupCalculations;

    const memberBreakdowns = [];
    let totalGroupGross = 0;
    let totalGroupAdvances = 0;
    let totalGroupNetDue = 0;
    let totalGroupDays = 0;
    let totalGroupOtHours = 0;
    const allGroupUnsettledLogs = [];
    const allGroupUnsettledPayments = [];

    groupCalculations.memberBreakdowns.forEach((mb) => {
      const mWorker = mb.worker;
      const mDaily = Number(String(mWorker.dailyRate).replace(/,/g, '')) || 0;
      const mOtRate = Number(String(mWorker.overtimeHourlyRate).replace(/,/g, '')) || 0;

      const pLogs = mb.unsettledLogs.filter((l) => (l.date || '') <= autoCutoffDate);
      const pPayments = mb.unsettledPayments.filter((p) => (p.date || '') <= autoCutoffDate);

      let mGross = 0;
      let mDays = 0;
      let mOtH = 0;

      pLogs.forEach((l) => {
        let val = Number(l.totalDayPay);
        const otH = Math.max(0, Number(l.overtimeHours) || 0);
        if (isNaN(val) || val <= 0) {
          if (l.type === 'half') val = (mDaily * 0.5) + (otH * mOtRate);
          else if (l.type === 'hourly') val = otH * (mOtRate || (mDaily / 8));
          else val = mDaily + (otH * mOtRate);
        }
        if (l.type === 'full') mDays += 1;
        else if (l.type === 'half') mDays += 0.5;
        mOtH += otH;
        mGross += val;
      });

      const mAdv = roundCurrency(pPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0), currency);
      const mNet = roundCurrency(Math.max(0, mGross - mAdv), currency);

      memberBreakdowns.push({
        ...mb,
        unsettledLogs: pLogs,
        unsettledPayments: pPayments,
        effectiveDays: mDays,
        otHours: mOtH,
        gross: roundCurrency(mGross, currency),
        advances: mAdv,
        netDue: mNet
      });

      totalGroupGross += mGross;
      totalGroupAdvances += mAdv;
      totalGroupNetDue += mNet;
      totalGroupDays += mDays;
      totalGroupOtHours += mOtH;
      allGroupUnsettledLogs.push(...pLogs);
      allGroupUnsettledPayments.push(...pPayments);
    });

    memberBreakdowns.sort((a, b) => {
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;
      return b.netDue - a.netDue;
    });

    return {
      memberBreakdowns,
      totalGroupGross: roundCurrency(totalGroupGross, currency),
      totalGroupAdvances: roundCurrency(totalGroupAdvances, currency),
      totalGroupNetDue: roundCurrency(totalGroupNetDue, currency),
      totalGroupDays,
      totalGroupOtHours,
      allGroupUnsettledLogs,
      allGroupUnsettledPayments
    };
  }, [selectedGroupId, groupMembers, groupCalculations, autoCutoffDate, currency]);

  // Active calculations based on chosen mode and period cutoff
  const activeAutoCalculations = settlementMode === 'group' ? autoPeriodGroupCalculations : autoPeriodIndividualCalculations;
  const activeCalculations = activeAutoCalculations;
  const targetPayableAmount = settlementMode === 'group' ? autoPeriodGroupCalculations.totalGroupNetDue : autoPeriodIndividualCalculations.totalCumulativeDebt;

  // Custom / Detailed Settlement Filter State
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customSelectedSection, setCustomSelectedSection] = useState('all');
  const [financialComponent, setFinancialComponent] = useState('all'); // 'all' | 'wage_only' | 'ot_only'
  const [deductAdvances, setDeductAdvances] = useState(true);
  const [selectedLogIds, setSelectedLogIds] = useState(new Set());
  const [isLogsAccordionOpen, setIsLogsAccordionOpen] = useState(false);

  // Form State
  const [finalPaymentAmount, setFinalPaymentAmount] = useState('');
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);
  const [settlementDate, setSettlementDate] = useState(getTodayDateString());
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [markAsSettled, setMarkAsSettled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [completedPayment, setCompletedPayment] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Distinct sections from unsettled logs
  const distinctSections = useMemo(() => {
    const sections = new Set();
    effectiveWorkerLogs.forEach((l) => {
      if (l.section && l.section.trim()) sections.add(l.section.trim());
    });
    return Array.from(sections);
  }, [effectiveWorkerLogs]);

  // Helper to compute specific financial component pay per log
  const computeLogPayForComponent = (log, component) => {
    const rawPay = Number(log.totalDayPay) || 0;
    const otRate = Number(worker?.overtimeHourlyRate) || ((Number(worker?.dailyWage) || 0) / 8);
    const otHours = Number(log.overtimeHours) || 0;
    const otPay = Number(log.overtimePay) || (otHours * otRate);

    if (component === 'wage_only') {
      return Math.max(0, rawPay - otPay);
    } else if (component === 'ot_only') {
      return otPay;
    }
    return rawPay;
  };

  // Filtered logs for Custom / Detailed Tab
  const customFilteredLogs = useMemo(() => {
    return (effectiveWorkerLogs || []).filter((l) => {
      if (isLogSettled(l)) return false;
      if (customStartDate && (l.date || '') < customStartDate) return false;
      if (customEndDate && (l.date || '') > customEndDate) return false;
      if (customSelectedSection !== 'all' && l.section !== customSelectedSection) return false;

      if (financialComponent === 'ot_only') {
        const otH = Number(l.overtimeHours) || 0;
        const otP = computeLogPayForComponent(l, 'ot_only');
        if (otH <= 0 && otP <= 0) return false;
      }
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [effectiveWorkerLogs, customStartDate, customEndDate, customSelectedSection, financialComponent, worker]);

  // Synchronize default selection: select all matching logs whenever filter criteria change
  useEffect(() => {
    const allIds = new Set(customFilteredLogs.map((l) => String(l.id || l.date)));
    setSelectedLogIds(allIds);
  }, [customFilteredLogs]);

  const toggleLogSelection = (id) => {
    const key = String(id);
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllFilteredLogs = () => {
    setSelectedLogIds(new Set(customFilteredLogs.map((l) => String(l.id || l.date))));
  };

  const deselectAllFilteredLogs = () => {
    setSelectedLogIds(new Set());
  };

  // Selected custom logs
  const selectedCustomLogs = useMemo(() => {
    return customFilteredLogs.filter((l) => selectedLogIds.has(String(l.id || l.date)));
  }, [customFilteredLogs, selectedLogIds]);

  // Selected gross calculation
  const customSelectedGross = useMemo(() => {
    return roundCurrency(
      selectedCustomLogs.reduce((sum, l) => sum + computeLogPayForComponent(l, financialComponent), 0),
      currency
    );
  }, [selectedCustomLogs, financialComponent, worker, currency]);

  // Custom advances to deduct
  const customAdvancesToDeduct = useMemo(() => {
    if (!deductAdvances) return 0;
    const maxAdvances = individualCalculations.advancesDeducted;
    return roundCurrency(Math.min(maxAdvances, customSelectedGross), currency);
  }, [deductAdvances, individualCalculations.advancesDeducted, customSelectedGross, currency]);

  // Net payable for custom settlement
  const customNetPayable = useMemo(() => {
    return roundCurrency(Math.max(0, customSelectedGross - customAdvancesToDeduct), currency);
  }, [customSelectedGross, customAdvancesToDeduct, currency]);

  // Effective target payable for current tab
  const activeTabTargetPayable = settlementTypeTab === 'custom' 
    ? customNetPayable 
    : targetPayableAmount;

  // Sync final payment amount when switching or changing custom filters
  useEffect(() => {
    if (isOpen && settlementTypeTab === 'custom') {
      setFinalPaymentAmount(String(customNetPayable));
      setIsAmountManuallyEdited(false);
    }
  }, [isOpen, settlementTypeTab, customNetPayable]);

  // Quick Date Range Presets Handlers
  const handleDatePresetPrevMonth = () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prevMonth.getFullYear();
    const m = prevMonth.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    setCustomStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
    setCustomEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleDatePresetCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    setCustomStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
    setCustomEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleDatePresetFirst15 = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    setCustomStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
    setCustomEndDate(`${y}-${String(m).padStart(2, '0')}-15`);
  };

  const handleDatePresetSecond15 = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    setCustomStartDate(`${y}-${String(m).padStart(2, '0')}-16`);
    setCustomEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleDatePresetClear = () => {
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Chronological FIFO coverage tracker for current typed payment in Auto Tab
  const coveredLogIds = useMemo(() => {
    const payNum = Number(normalizeDigits(finalPaymentAmount)) || 0;
    const currentAdvances = settlementMode === 'group' ? activeAutoCalculations.totalGroupAdvances : activeAutoCalculations.advancesDeducted;
    let budget = payNum + (currentAdvances || 0);
    const covered = new Set();
    const sorted = [...(settlementMode === 'group' ? activeAutoCalculations.allGroupUnsettledLogs : activeAutoCalculations.unsettledLogs)]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (const l of sorted) {
      const cost = Number(l.totalDayPay) || 0;
      if (budget >= cost - 0.001) {
        covered.add(l.id || l.date);
        budget -= cost;
      }
    }
    return covered;
  }, [finalPaymentAmount, settlementMode, activeAutoCalculations]);

  // Quick Preset Handlers for Auto Tab
  const handleSelectFullSettlement = () => {
    setSettleOption('full');
    setIsAmountManuallyEdited(false);
    setFinalPaymentAmount(targetPayableAmount > 0 ? String(targetPayableAmount) : '0');
  };

  const handleSelectPartialSettlement = () => {
    setSettleOption('partial');
    setIsAmountManuallyEdited(true);
  };

  const handleApplyPreset = (presetType) => {
    setSettleOption('partial');
    setIsAmountManuallyEdited(true);
    if (presetType === 'full') {
      handleSelectFullSettlement();
    } else if (presetType === 'half') {
      const half = roundCurrency(Math.floor(targetPayableAmount / 2), currency);
      setFinalPaymentAmount(String(half));
    } else if (presetType === 'round50k') {
      const step = 50000;
      const rounded = Math.floor(targetPayableAmount / step) * step;
      setFinalPaymentAmount(String(rounded > 0 ? rounded : targetPayableAmount));
    } else if (presetType === 'round10k') {
      const step = 10000;
      const rounded = Math.floor(targetPayableAmount / step) * step;
      setFinalPaymentAmount(String(rounded > 0 ? rounded : targetPayableAmount));
    }
  };

  const prevWorkerIdRef = React.useRef(worker?.id);
  const prevModeRef = React.useRef(settlementMode);
  const prevGroupIdRef = React.useRef(selectedGroupId);
  const prevIsOpenRef = React.useRef(false);

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

  const currentOverdraft = useMemo(() => {
    const payAmount = roundCurrency(Number(normalizeDigits(finalPaymentAmount)), currency);
    if (isNaN(payAmount) || payAmount <= 0 || !effectiveAccountId) return null;
    return checkAccountOverdraft(effectiveAccountId, payAmount);
  }, [finalPaymentAmount, effectiveAccountId, currency, checkAccountOverdraft]);

  // Sync form defaults whenever modal opens or worker/group/mode changes
  useEffect(() => {
    if (isOpen) {
      const justOpened = !prevIsOpenRef.current;
      const workerChanged = prevWorkerIdRef.current !== worker?.id;
      const modeChanged = prevModeRef.current !== settlementMode;
      const groupChanged = prevGroupIdRef.current !== selectedGroupId;

      if (justOpened || workerChanged || modeChanged || groupChanged) {
        if (justOpened) {
          const today = new Date();
          if (today.getDate() <= 7 && prevMonthEndDate) {
            setAutoCutoffDate(prevMonthEndDate);
          } else {
            setAutoCutoffDate(getTodayDateString());
          }
        }
        setIsAmountManuallyEdited(false);
        setFinalPaymentAmount(targetPayableAmount > 0 ? String(targetPayableAmount) : '0');
        setSettlementDate(getTodayDateString());
        setSelectedAccountId(effectiveAccountId);
        setReferenceNumber('');

        if (settlementMode === 'group') {
          const groupName = activeGroup?.name || c.groupNameDefault;
          const supName = supervisorWorker?.name || c.supNameDefault;
          setNotes(c.groupSettlementNotes(groupName, supName, groupMembers.length));
        } else {
          const defaultNote = c.individualSettlementNotes(activeAutoCalculations.unsettledLogs.length);
          setNotes(defaultNote);
        }

        setMarkAsSettled(true);
        setFeedback({ type: '', message: '' });
        setCompletedPayment(null);
      } else if (!isAmountManuallyEdited) {
        setFinalPaymentAmount(targetPayableAmount > 0 ? String(targetPayableAmount) : '0');
      }

      prevIsOpenRef.current = true;
      prevWorkerIdRef.current = worker?.id;
      prevModeRef.current = settlementMode;
      prevGroupIdRef.current = selectedGroupId;
    } else {
      prevIsOpenRef.current = false;
    }
  }, [isOpen, worker?.id, settlementMode, selectedGroupId, targetPayableAmount, isAmountManuallyEdited, effectiveAccountId, activeGroup?.name, supervisorWorker?.name, groupMembers.length, individualCalculations.unsettledLogs.length, language]);

  if (!isOpen) return null;

  const handleSubmit = async (e, bypassOverdraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback({ type: '', message: '' });

    const payAmount = roundCurrency(Number(normalizeDigits(finalPaymentAmount)), currency);
    if (isNaN(payAmount) || payAmount < 0) {
      setFeedback({ type: 'error', message: c.validAmountError });
      return;
    }

    const currentTargetPayable = settlementTypeTab === 'custom'
      ? customNetPayable
      : (settlementMode === 'group' ? autoPeriodGroupCalculations.totalGroupNetDue : autoPeriodIndividualCalculations.totalCumulativeDebt);
    const isFullSettlement = payAmount >= (currentTargetPayable - 0.001) && currentTargetPayable > 0;
    const remainingBalance = roundCurrency(Math.max(0, currentTargetPayable - payAmount), currency);

    if (settlementMode === 'group' && !supervisorWorker) {
      setFeedback({ type: 'error', message: c.selectSupervisorError });
      return;
    }

    if (payAmount > 0 && !bypassOverdraft) {
      const overdraftCheck = checkAccountOverdraft(selectedAccountId, payAmount);
      if (!overdraftCheck.hasSufficientFunds) {
        if (overdraftCheck.effectivePolicy === 'never_allow') {
          setOverdraftPromptData({
            accountName: overdraftCheck.account?.name || c.selectedAccountDefault,
            currentBalance: overdraftCheck.currentBalance,
            requestedAmount: payAmount,
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
            requestedAmount: payAmount,
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
      const settlementRecordId = generatePaymentId();
      const targetWorkerObj = settlementMode === 'group' ? supervisorWorker : worker;

      if (!targetWorkerObj) {
        throw new Error(c.targetWorkerNotSpecifiedError);
      }

      if (settlementTypeTab === 'custom') {
        if (selectedCustomLogs.length === 0) {
          setFeedback({ type: 'error', message: c.noCustomRecordSelectedError });
          setIsSubmitting(false);
          return;
        }

        const sortedCustomLogs = [...selectedCustomLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const customPeriodStart = customStartDate || sortedCustomLogs[0]?.date || null;
        const customPeriodEnd = customEndDate || sortedCustomLogs[sortedCustomLogs.length - 1]?.date || settlementDate;
        const customMonth = (customPeriodEnd || settlementDate).slice(0, 7);

        const customSettlementRecord = {
          id: settlementRecordId,
          projectId: currentProject?.id || DEFAULT_PROJECT_ID,
          userId: user?.id || null,
          workerId: targetWorkerObj.id,
          workerName: targetWorkerObj.name,
          groupId: worker?.groupId || null,
          month: customMonth,
          periodStartDate: customPeriodStart,
          periodEndDate: customPeriodEnd,
          date: settlementDate,
          time: currentTime,
          amount: payAmount,
          currency: currency,
          accountId: selectedAccountId || null,
          accountName: financialAccounts.find((a) => a.id === selectedAccountId)?.name || '',
          accountType: financialAccounts.find((a) => a.id === selectedAccountId)?.type || 'cash',
          type: 'settlement',
          settlement_subtype: 'custom',
          status: 'draft',
          approval_status: 'draft',
          settlement_status: 'settled',
          created_by: user?.id || 'admin',
          isSettled: true,
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
          remainingBalanceAfter: roundCurrency(Math.max(0, targetPayableAmount - payAmount), currency),
          grossEarningsCalculated: customSelectedGross,
          priorBalanceDeducted: 0,
          advancesDeducted: customAdvancesToDeduct,
          isGroupSettlement: false,
          groupMemberCount: 1,
          filterCriteria: {
            startDate: customStartDate || null,
            endDate: customEndDate || null,
            section: customSelectedSection !== 'all' ? customSelectedSection : null,
            financialComponent: financialComponent,
            deductAdvances: deductAdvances,
            selectedCount: selectedCustomLogs.length
          },
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          created_by_user_id: user?.id,
          updated_by_user_id: user?.id
        };

        await db.payments.put(customSettlementRecord);

        
        const safeAuth = await getSafeAuthContext();
        await logAuditAction({
            workspaceId: safeAuth.workspaceId,
            userId: safeAuth.userId,
            userName: safeAuth.userName,
          actionType: 'SUBMIT_SETTLEMENT',
          entityType: 'payments',
          entityId: settlementRecordId,
          projectId: currentProject?.id || DEFAULT_PROJECT_ID,
          
          
          
          details: {
            description: c.customSettlementAuditDesc(worker.name),
            amount: finalAmountNum,
            worker_name: worker.name
          }
        });

        if (markAsSettled) {
          // Strictly settle only the selected logs
          const logsToSettle = selectedCustomLogs.map((l) => ({
            ...l,
            isSettled: true,
            settlementReceiptId: settlementRecordId,
            updatedAt: now.toISOString()
          }));
          await db.attendanceLogs.bulkPut(logsToSettle);
          pushLogsLive(logsToSettle).catch(console.warn);

          // Settle advances if deducted
          if (customAdvancesToDeduct > 0) {
            let advBudget = customAdvancesToDeduct;
            const advancesToSettle = [];
            for (const p of individualCalculations.unsettledPayments) {
              const pAmount = Number(p.amount) || 0;
              if (advBudget >= pAmount - 0.001) {
                advancesToSettle.push({
                  ...p,
                  isSettled: true,
                  settlementReceiptId: settlementRecordId,
                  updatedAt: now.toISOString()
                });
                advBudget -= pAmount;
              }
            }
            if (advancesToSettle.length > 0) {
              await db.payments.bulkPut(advancesToSettle);
            }
          }
        }
      } else {
        // Auto / FIFO Settlement Mode (with period cutoff)
        const autoLogs = (settlementMode === 'group' ? autoPeriodGroupCalculations.allGroupUnsettledLogs : autoPeriodIndividualCalculations.unsettledLogs) || [];
        const sortedPeriodLogs = [...autoLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const periodStart = sortedPeriodLogs[0]?.date || null;
        const periodEnd = autoCutoffDate || sortedPeriodLogs[sortedPeriodLogs.length - 1]?.date || settlementDate;
        const derivedMonth = (periodEnd || settlementDate).slice(0, 7);

        const settlementRecord = {
          id: settlementRecordId,
          projectId: currentProject?.id || DEFAULT_PROJECT_ID,
          userId: user?.id || null,
          workerId: targetWorkerObj.id,
          workerName: targetWorkerObj.name,
          groupId: settlementMode === 'group' ? selectedGroupId : (worker?.groupId || null),
          month: derivedMonth,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
          date: settlementDate,
          time: currentTime,
          amount: payAmount,
          currency: currency,
          accountId: selectedAccountId || null,
          accountName: financialAccounts.find((a) => a.id === selectedAccountId)?.name || '',
          accountType: financialAccounts.find((a) => a.id === selectedAccountId)?.type || 'cash',
          type: 'settlement',
          settlement_subtype: 'auto',
          status: 'draft',
          approval_status: 'draft',
          settlement_status: isFullSettlement ? (markAsSettled ? 'settled' : 'partial') : 'partial',
          created_by: user?.id || 'admin',
          isSettled: true,
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
          remainingBalanceAfter: remainingBalance,
          grossEarningsCalculated: settlementMode === 'group' ? autoPeriodGroupCalculations.totalGroupGross : autoPeriodIndividualCalculations.grossEarnings,
          priorBalanceDeducted: 0,
          advancesDeducted: settlementMode === 'group' ? autoPeriodGroupCalculations.totalGroupAdvances : autoPeriodIndividualCalculations.advancesDeducted,
          isGroupSettlement: settlementMode === 'group',
          groupMemberCount: settlementMode === 'group' ? groupMembers.length : 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          created_by_user_id: user?.id,
          updated_by_user_id: user?.id
        };

        await db.payments.put(settlementRecord);

        
        let finalWorkspaceId = currentUser?.workspace_id || currentUser?.workspaceId || user?.workspace_id || null;
        let finalUserId = currentUser?.id || currentUser?.userId || user?.id || null;
        let finalUserName = currentUser?.full_name || currentUser?.name || user?.full_name || user?.name || c.systemUser;

        if (!finalWorkspaceId || !finalUserId) {
          try {
            const sessionStr = localStorage.getItem('workshop_auth_session');
            if (sessionStr) {
              const sessionData = JSON.parse(sessionStr);
              finalWorkspaceId = finalWorkspaceId || sessionData.workspace_id || sessionData.workspaceId || null;
              finalUserId = finalUserId || sessionData.id || sessionData.userId || null;
              finalUserName = (finalUserName === c.systemUser) ? (sessionData.full_name || sessionData.name || c.systemUser) : finalUserName;
            }
          } catch(e) {
            console.error("Error reading session from localStorage", e);
          }
        }

        const safeAuth = await getSafeAuthContext();
        await logAuditAction({
            workspaceId: safeAuth.workspaceId,
            userId: safeAuth.userId,
            userName: safeAuth.userName,
          actionType: 'SUBMIT_SETTLEMENT',
          entityType: 'payments',
          entityId: settlementRecordId,
          projectId: currentProject?.id || DEFAULT_PROJECT_ID,
          
          
          
          details: {
            description: settlementMode === 'group' 
              ? c.groupSettlementAuditDesc(groupMembers.length, worker.groupName)
              : c.individualSettlementAuditDesc(worker.name),
            amount: payAmount,
            worker_name: settlementMode === 'group' ? `${c.groupPrefix}${worker.groupName}` : worker.name
          }
        });

        // Settle covered attendance logs and advances
        if (markAsSettled) {
          if (settlementMode === 'group') {
            // Group settlement
            const advancesToSettle = autoPeriodGroupCalculations.allGroupUnsettledPayments;
            if (advancesToSettle.length > 0) {
              const updatedAdv = advancesToSettle.map((p) => ({
                ...p,
                isSettled: true,
                settlementReceiptId: settlementRecordId,
                updatedAt: now.toISOString()
              }));
              await db.payments.bulkPut(updatedAdv);
            }

            if (isFullSettlement) {
              const logsToSettle = autoPeriodGroupCalculations.allGroupUnsettledLogs.map((l) => ({
                ...l,
                isSettled: true,
                settlementReceiptId: settlementRecordId,
                updatedAt: now.toISOString()
              }));
              if (logsToSettle.length > 0) {
                await db.attendanceLogs.bulkPut(logsToSettle);
                pushLogsLive(logsToSettle).catch(console.warn);
              }
            } else {
              // Partial group settlement: chronologically settle logs up to payAmount + totalGroupAdvances
              let remainingBudget = payAmount + autoPeriodGroupCalculations.totalGroupAdvances;
              const sortedGroupLogs = [...autoPeriodGroupCalculations.allGroupUnsettledLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
              const logsToSettle = [];
              for (const l of sortedGroupLogs) {
                const cost = Number(l.totalDayPay) || 0;
                if (remainingBudget >= cost - 0.001) {
                  logsToSettle.push({
                    ...l,
                    isSettled: true,
                    settlementReceiptId: settlementRecordId,
                    updatedAt: now.toISOString()
                  });
                  remainingBudget -= cost;
                }
              }
              if (logsToSettle.length > 0) {
                await db.attendanceLogs.bulkPut(logsToSettle);
                pushLogsLive(logsToSettle).catch(console.warn);
              }
            }
          } else {
            // Individual worker settlement
            // Settle advances
            const advancesToSettle = autoPeriodIndividualCalculations.unsettledPayments;
            if (advancesToSettle.length > 0) {
              const updatedAdv = advancesToSettle.map((p) => ({
                ...p,
                isSettled: true,
                settlementReceiptId: settlementRecordId,
                updatedAt: now.toISOString()
              }));
              await db.payments.bulkPut(updatedAdv);
            }

            if (isFullSettlement) {
              // Full settlement: settle all open logs within the period
              const logsToSettle = autoPeriodIndividualCalculations.unsettledLogs.map((l) => ({
                ...l,
                isSettled: true,
                settlementReceiptId: settlementRecordId,
                updatedAt: now.toISOString()
              }));
              if (logsToSettle.length > 0) {
                await db.attendanceLogs.bulkPut(logsToSettle);
                pushLogsLive(logsToSettle).catch(console.warn);
              }
            } else {
              // Partial settlement (FIFO chronological coverage within the period)
              let coveredGrossBudget = payAmount + autoPeriodIndividualCalculations.advancesDeducted;
              const sortedLogs = [...autoPeriodIndividualCalculations.unsettledLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
              const logsToSettle = [];
              for (const l of sortedLogs) {
                const pay = Number(l.totalDayPay) || 0;
                if (coveredGrossBudget >= pay - 0.001) {
                  logsToSettle.push({
                    ...l,
                    isSettled: true,
                    settlementReceiptId: settlementRecordId,
                    updatedAt: now.toISOString()
                  });
                  coveredGrossBudget -= pay;
                }
              }
              if (logsToSettle.length > 0) {
                await db.attendanceLogs.bulkPut(logsToSettle);
                pushLogsLive(logsToSettle).catch(console.warn);
              }
            }
          }
        }
      }

      pushPaymentsLive().catch(console.warn);

      const finalCheck = checkAccountOverdraft(selectedAccountId, payAmount);
      if (payAmount > 0 && !finalCheck.hasSufficientFunds) {
        const resultingNeg = Math.abs(finalCheck.currentBalance - payAmount);
        setToastMessage({
          type: 'warning',
          text: c.negativeBalanceWarningToast(finalCheck.account?.name || c.cashAccountDefault, formatCurrency(resultingNeg, currency, language))
        });
        setTimeout(() => {
          if (onSettlementComplete) onSettlementComplete(settlementRecord);
          onClose();
        }, 2000);
      } else {
        if (onSettlementComplete) onSettlementComplete(settlementRecord);
        onClose();
      }
    } catch (err) {
      console.error('Settlement save error:', err);
      setFeedback({
        type: 'error',
        message: err.message || c.errorSavingSettlement
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div 
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

      {/* 1. TOP EXECUTIVE HEADER (Apple Liquid Glass Header) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shrink-0 z-20">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3.5 space-y-3">
          
          {/* Top Bar: Icon, Titles & Close Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
                  settlementMode === 'group'
                    ? 'bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-amber-500/25'
                    : 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-emerald-500/25'
                }`}>
                  {settlementMode === 'group' ? <Users className="w-5 h-5 stroke-[2.2]" /> : <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      {settlementMode === 'group' ? c.groupSettlementModalTitle : (t('settlementModalTitle') || c.individualSettlementModalTitle)}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      settlementTypeTab === 'auto'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                    }`}>
                      {settlementTypeTab === 'auto' ? c.autoSettlementTab : c.customSettlementTab}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-slate-400 font-medium">
                      {settlementMode === 'group' 
                        ? `${activeGroup?.name || c.workGroup} • ${c.supervisor} ${supervisorWorker?.name || c.undefinedSupervisor}`
                        : worker 
                          ? `${worker.name} • ${c.allOpenArrears}`
                          : c.selectWorkerForSettlement}
                    </p>
                    {settlementMode === 'individual' && worker && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalWorker(null);
                          if (onSelectWorker) onSelectWorker(null);
                        }}
                        className="px-2.5 py-0.5 rounded-xl bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                        title={c.changeWorkerTooltip}
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        <span>{c.changeWorkerBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="sm:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={c.closeTooltip}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controls Right Dock: Dual Controllers (APP_THEME_BUTTON Style) */}
            <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-auto">
              
              {/* [APP_THEME_BUTTON] Strategy Switcher (Auto vs Detailed) */}
              <div className="h-10 inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
                <button
                  type="button"
                  onClick={() => setSettlementTypeTab('auto')}
                  className={`relative h-full flex items-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer px-3 text-xs ${
                    settlementTypeTab === 'auto'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 font-black'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white font-medium'
                  }`}
                  title={c.quickAutoTooltip}
                >
                  <Zap className={`w-3.5 h-3.5 ${settlementTypeTab === 'auto' ? 'fill-white' : ''}`} />
                  <span className="whitespace-nowrap">{c.quickSettlement}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettlementTypeTab('custom')}
                  className={`relative h-full flex items-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer px-3 text-xs ${
                    settlementTypeTab === 'custom'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 font-black'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white font-medium'
                  }`}
                  title={c.customDetailedTooltip}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{c.detailedSettlement}</span>
                </button>
              </div>

              {/* [APP_THEME_BUTTON] Scope Switcher (Individual vs Group) */}
              {allGroups.length > 0 && (
                <div className="h-10 inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setSettlementMode('individual')}
                    className={`relative h-full flex items-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer px-3 text-xs ${
                      settlementMode === 'individual'
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 font-black'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white font-medium'
                    }`}
                    title={c.individualTooltip}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span className="whitespace-nowrap">{c.individualLabel}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettlementMode('group')}
                    className={`relative h-full flex items-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer px-3 text-xs ${
                      settlementMode === 'group'
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 font-black'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white font-medium'
                    }`}
                    title={c.groupTooltip}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span className="whitespace-nowrap">{c.groupLabel}</span>
                  </button>
                </div>
              )}

              {/* Desktop Close Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="hidden sm:flex p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
                title={c.closeTooltip}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-[#f3f6f4] dark:bg-slate-950 pb-28">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-4">

        {/* Feedback Alert */}
        {feedback.message && (
          <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-sm ${
            feedback.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
          }`}>
            {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* If Individual Mode and No Worker Selected: Dedicated Personnel Selector */}
        {settlementMode === 'individual' && !worker ? (
          <div className="space-y-4 py-2">
            <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-500" />
                    <span>{c.selectWorkerScreenTitle}</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {c.selectWorkerScreenSubtitle}
                  </p>
                </div>
                <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-300 font-mono border border-slate-200/60 dark:border-slate-700/60">
                  {c.activeWorkersCount(convertDigits(filteredActiveWorkers.length, numberFormat))}
                </span>
              </div>

              {/* Status Filter Buttons (Arrears vs All vs Settled) - APP_THEME_BUTTON style */}
              <div className="h-10 inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('with_arrears')}
                  className={`flex-1 sm:flex-initial h-full px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer ${
                    workerStatusFilter === 'with_arrears'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{c.withArrearsTab}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    workerStatusFilter === 'with_arrears' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                  }`}>
                    {convertDigits(countWithArrears, numberFormat)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('all')}
                  className={`flex-1 sm:flex-initial h-full px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer ${
                    workerStatusFilter === 'all'
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{c.allWorkersTab}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    workerStatusFilter === 'all' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    {convertDigits(activeWorkersList.length, numberFormat)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStatusFilter('settled')}
                  className={`flex-1 sm:flex-initial h-full px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer ${
                    workerStatusFilter === 'settled'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{c.settledTab}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    workerStatusFilter === 'settled' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                  }`}>
                    {convertDigits(countSettled, numberFormat)}
                  </span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={c.searchWorkersPlaceholder}
                  value={workerSearchQuery}
                  onChange={(e) => setWorkerSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  autoFocus
                />
                {workerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setWorkerSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Workers Cards Grid (2-Column on Desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredActiveWorkers.map((w) => {
                const fin = workerFinancialsMap.get(String(w.id)) || calculateWorkerFinancials(w, effectiveAllLogs, effectiveAllPayments, currency);
                const hasDue = (fin?.netBalanceDue || 0) > 0;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setLocalWorker(w);
                      if (onSelectWorker) onSelectWorker(w);
                    }}
                    className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all text-start group flex flex-col justify-between gap-3 relative overflow-hidden cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm ring-1 ring-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                          {w.name?.charAt(0) || c.defaultInitialChar}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                            {w.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                            {w.role || c.defaultWorkerRole} {w.phone ? `• ${w.phone}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        hasDue
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40'
                      }`}>
                        {hasDue ? c.hasDueBadge : c.settledBadge}
                      </span>
                    </div>

                    {/* Financial Summary */}
                    <div className="w-full pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">{c.totalDueForSettlementLabel}</span>
                      <span className={`font-black font-mono text-sm ${hasDue ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatCurrency(fin?.netBalanceDue || 0, currency, numberFormat)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredActiveWorkers.length === 0 && (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-slate-900 dark:text-white">
                    {workerStatusFilter === 'with_arrears'
                      ? c.noWorkersWithArrears
                      : c.noWorkersFound}
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {workerStatusFilter === 'with_arrears'
                      ? c.allSettledDesc
                      : c.changeSearchDesc}
                  </p>
                </div>
                {workerStatusFilter === 'with_arrears' && (
                  <button
                    type="button"
                    onClick={() => setWorkerStatusFilter('all')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {c.viewAllWorkersBtn}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ------------------------------------------------------------- */}
            {/* RIGHT COLUMN: 7 COLUMNS (FINANCIAL DETAILS & AUDIT LOGS) */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-7 space-y-4">

              {/* ----------------------------------------------------------- */}
              {/* CUSTOM / DETAILED TAB CONTENT */}
              {/* ----------------------------------------------------------- */}
              {settlementTypeTab === 'custom' ? (
                <div className="space-y-4">
            
            {/* Worker Selector (if individual mode) */}
            {settlementMode === 'individual' && allWorkers.length > 1 && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {c.selectWorkerCustomTitle}
                </label>
                <select
                  value={worker?.id || ''}
                  onChange={(e) => {
                    const found = allWorkers.find((w) => String(w.id) === String(e.target.value));
                    if (found) {
                      setLocalWorker(found);
                      if (onSelectWorker) onSelectWorker(found);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-xs"
                >
                  {allWorkers.filter(w => !w.deletedAt && !w.isArchived).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.role ? `(${w.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 1. Filter Control Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
              
              {/* Date Range Inputs & Shortcuts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CalendarRange className="w-4 h-4 text-sky-500" />
                    <span>{c.customDateFilterTitle}</span>
                  </label>
                  {(customStartDate || customEndDate) && (
                    <button
                      type="button"
                      onClick={handleDatePresetClear}
                      className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{c.clearRangeBtn}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      {c.fromDateLabel}
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      {c.toDateLabel}
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-slate-400">{c.rangeShortcutsLabel}</span>
                  <button
                    type="button"
                    onClick={handleDatePresetPrevMonth}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {c.entirePrevMonth}
                  </button>
                  <button
                    type="button"
                    onClick={handleDatePresetCurrentMonth}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {c.currentMonth}
                  </button>
                  <button
                    type="button"
                    onClick={handleDatePresetFirst15}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {c.first15Days}
                  </button>
                  <button
                    type="button"
                    onClick={handleDatePresetSecond15}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {c.second15Days}
                  </button>
                </div>
              </div>

              {/* Financial Component Selector & Section Filter */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Financial Component Mode (All vs Base Wage vs Overtime Only) */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    {c.financialComponentType}
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setFinancialComponent('all')}
                      className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                        financialComponent === 'all'
                          ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {c.allItems}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancialComponent('wage_only')}
                      className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                        financialComponent === 'wage_only'
                          ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {c.onlyDaily}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancialComponent('ot_only')}
                      className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                        financialComponent === 'ot_only'
                          ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {c.onlyOvertime}
                    </button>
                  </div>
                </div>

                {/* Project Section Filter */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    {c.filterByProjectSection}
                  </label>
                  <select
                    value={customSelectedSection}
                    onChange={(e) => setCustomSelectedSection(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="all">{c.allWorkshopSections}</option>
                    {distinctSections.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Deduct Advances Checkbox */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductAdvances}
                    onChange={(e) => setDeductAdvances(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {c.deductOpenAdvancesLabel(formatAmount(individualCalculations.advancesDeducted, currency, numberFormat), getCurrencySymbol(currency, language))}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {deductAdvances
                        ? c.deductAdvancesActiveTip
                        : c.deductAdvancesInactiveTip}
                    </span>
                  </div>
                </label>
              </div>

            </div>

            {/* 2. Selectable Items List / Table */}
            <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              
              {/* Table Header with Batch Actions */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCustomLogs.length === customFilteredLogs.length) {
                        deselectAllFilteredLogs();
                      } else {
                        selectAllFilteredLogs();
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600"
                  >
                    {selectedCustomLogs.length === customFilteredLogs.length && customFilteredLogs.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-sky-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>
                      {selectedCustomLogs.length === customFilteredLogs.length && customFilteredLogs.length > 0
                        ? c.deselectAllDays
                        : c.selectAllDays}
                    </span>
                  </button>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {c.daysSelectedSummary(convertDigits(selectedCustomLogs.length, numberFormat), convertDigits(customFilteredLogs.length, numberFormat))}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllFilteredLogs}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 border border-slate-200 dark:border-slate-600 hover:bg-sky-50"
                  >{c.selectAll}</button>
                  <button
                    type="button"
                    onClick={deselectAllFilteredLogs}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                  >{c.deselectAll}</button>
                </div>
              </div>

              {/* Item Rows */}
              {customFilteredLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  {c.noRecordsMatchFilters}
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 hide-scrollbar">
                  {customFilteredLogs.map((l) => {
                    const isSelected = selectedLogIds.has(String(l.id || l.date));
                    const logPay = computeLogPayForComponent(l, financialComponent);
                    return (
                      <div
                        key={l.id || l.date}
                        onClick={() => toggleLogSelection(l.id || l.date)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-sky-50/40 dark:bg-sky-950/20 hover:bg-sky-50/70 dark:hover:bg-sky-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div onClick
                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                {convertDigits(l.date, numberFormat)}
                              </span>
                              {l.section && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {l.section}
                                </span>
                              )}
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                l.type === 'hourly' 
                                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300' 
                                  : l.type === 'half'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {l.type === 'half' ? c.halfDay : l.type === 'hourly' ? c.hourly : c.fullDay}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {l.overtimeHours > 0 && `${c.overtimePrefix}${formatHoursAndMinutes(l.overtimeHours, language)}`}
                            </span>
                          </div>
                        </div>

                        <div className="text-end">
                          <span className="font-black text-slate-900 dark:text-white font-mono block">
                            {formatAmount(logPay, currency, numberFormat)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {getCurrencySymbol(currency, language)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* 3. Live Dynamic Summary Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/30 border border-sky-200 dark:border-sky-800/60 space-y-2.5 shadow-xs">
              
              <div className="flex items-center justify-between text-xs font-bold text-sky-900 dark:text-sky-200">
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>{c.financialBalanceSelectedItems(convertDigits(selectedCustomLogs.length, numberFormat))}</span>
                </span>
                <span className="text-[11px] text-sky-700 dark:text-sky-300 font-mono">
                  {c.grossTotalLabel} {formatAmount(customSelectedGross, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                </span>
              </div>

              {customAdvancesToDeduct > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 font-semibold">
                  <span>{c.advancesDeductedInSettlement}</span>
                  <span className="font-mono">
                    {formatAmount(customAdvancesToDeduct, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-sky-200/80 dark:border-sky-800/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    {c.netPayableCustomSettlement}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {c.amountAutoConfiguredNotice}
                  </span>
                </div>
                <div className="text-end">
                  <span className="text-lg sm:text-xl font-black text-sky-700 dark:text-sky-300 font-mono block">
                    {formatAmount(customNetPayable, currency, numberFormat)}
                  </span>
                  <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                    {getCurrencySymbol(currency, language)}
                  </span>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* ----------------------------------------------------------------- */
          /* AUTO / QUICK TAB CONTENT */
          /* ----------------------------------------------------------------- */
          <div className="space-y-3.5">
            
            {/* Auto Period Cutoff Bar */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {c.periodCutoffLabel}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {convertDigits(
                    (settlementMode === 'group' ? autoPeriodGroupCalculations.allGroupUnsettledLogs : autoPeriodIndividualCalculations.unsettledLogs).length,
                    numberFormat
                  )} {c.workDaysUnit} {c.inSelectedPeriodSuffix}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                <div>
                  <input
                    type="date"
                    value={autoCutoffDate}
                    onChange={(e) => {
                      setAutoCutoffDate(e.target.value);
                      setIsAmountManuallyEdited(false);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {prevMonthEndDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setAutoCutoffDate(prevMonthEndDate);
                        setIsAmountManuallyEdited(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-colors ${
                        autoCutoffDate === prevMonthEndDate
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-emerald-50'
                      }`}
                    >
                      {c.upToPrevMonthEnd(prevMonthEndDate.slice(5))}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAutoCutoffDate(getTodayDateString());
                      setIsAmountManuallyEdited(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-colors ${
                      autoCutoffDate === getTodayDateString()
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-emerald-50'
                    }`}
                  >{c.upToToday}</button>
                  {autoCutoffDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setAutoCutoffDate('');
                        setIsAmountManuallyEdited(false);
                      }}
                      className="px-2 py-1.5 rounded-xl text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                    >{c.allDays}</button>
                  )}
                </div>
              </div>
            </div>

            {/* GROUP SETTLEMENT SPECIFIC */}
            {settlementMode === 'group' ? (
              <div className="space-y-3">
                {/* Group & Supervisor Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      {c.selectWorkGroup}
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      {allGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span>{c.supervisorRecipientLabel}</span>
                    </label>
                    <select
                      value={selectedSupervisorId}
                      onChange={(e) => setSelectedSupervisorId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      {groupMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.teamRole === 'Master' ? c.masterSupervisorTag : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Group Summary Box */}
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                    <span>{c.groupMembersCountLabel}</span>
                    <span>{c.membersCount(convertDigits(groupMembers.length, numberFormat))}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">{c.totalGrossWorkAllMembers}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatAmount(autoPeriodGroupCalculations.totalGroupGross, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                    </span>
                  </div>

                  {autoPeriodGroupCalculations.totalGroupAdvances > 0 && (
                    <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                      <span>{c.minusTotalAdvancesMembers}</span>
                      <span className="font-bold">
                        {formatAmount(autoPeriodGroupCalculations.totalGroupAdvances, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between text-sm">
                    <span className="font-black text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>{c.totalNetPayableToSupervisor}</span>
                    </span>
                    <span className="font-black text-amber-700 dark:text-amber-300 text-base sm:text-lg">
                      {formatAmount(autoPeriodGroupCalculations.totalGroupNetDue, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                    </span>
                  </div>
                </div>

                {/* Individual Breakdown Table of Group Members */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-500" />
                      <span>{c.workBreakdownEachMember}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {c.afterSubmitAllSettledNote}
                    </span>
                  </div>

                  {autoPeriodGroupCalculations.memberBreakdowns.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">{c.noWorkersInGroup}</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1 hide-scrollbar">
                      {autoPeriodGroupCalculations.memberBreakdowns.map((mb) => (
                        <div 
                          key={mb.worker.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                            mb.worker.id === selectedSupervisorId
                              ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {mb.isMaster ? (
                              <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" title={c.masterSupervisorTitle} />
                            ) : (
                              <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white">{mb.worker.name}</span>
                                {mb.worker.id === selectedSupervisorId && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[9px] font-bold">{c.recipientBadge}</span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {convertDigits(mb.effectiveDays, numberFormat)} {c.dayUnit} {mb.otHours > 0 ? `(+${formatHoursAndMinutes(mb.otHours, language)})` : ''} 
                                {mb.advances > 0 && ` • ${c.advanceLabel} ${formatAmount(mb.advances, currency, numberFormat)}`}
                              </span>
                            </div>
                          </div>

                          <div className="text-end">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {formatAmount(mb.netDue, currency, numberFormat)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {getCurrencySymbol(currency, language)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* INDIVIDUAL SETTLEMENT SPECIFIC */
              <div className="space-y-3.5">
                
                {/* Worker Selector Dropdown */}
                {allWorkers.length > 1 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {c.selectWorkerForSettlement}
                    </label>
                    <select
                      value={worker?.id || ''}
                      onChange={(e) => {
                        const found = allWorkers.find((w) => String(w.id) === String(e.target.value));
                        if (found) {
                          setLocalWorker(found);
                          if (onSelectWorker) onSelectWorker(found);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
                    >
                      {allWorkers.filter(w => !w.deletedAt && !w.isArchived).map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.role ? `(${w.role})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Workers With Arrears Horizontal Picker */}
                {arrearsList.length > 0 && onSelectWorker && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">{c.workersWithArrearsLabel}</label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
                      {arrearsList.map((arrWorker) => (
                        <button
                          key={arrWorker.worker.id}
                          type="button"
                          onClick={() => {
                            setLocalWorker(arrWorker.worker);
                            onSelectWorker(arrWorker.worker);
                          }}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                            worker?.id === arrWorker.worker.id
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            <span>{arrWorker.worker.name}</span>
                            <span className="bg-white/50 dark:bg-black/20 px-1.5 rounded text-[10px] font-semibold">
                              {arrWorker.netBalanceDue < 0 
                                ? `${formatAmount(Math.abs(arrWorker.netBalanceDue), currency, numberFormat)} (${c.debtorSuffix})`
                                : `${formatAmount(arrWorker.netBalanceDue, currency, numberFormat)} (${c.creditorSuffix})`}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1. Transparent Financial Balance KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Gross Earnings Card */}
                  <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-sky-300 dark:hover:border-sky-700 transition-all">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span className="text-xs font-bold">{c.totalPeriodGross}</span>
                      <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white block font-mono">
                          {formatAmount(autoPeriodIndividualCalculations.grossEarnings, currency, numberFormat)}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{getCurrencySymbol(currency, language)}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium block mt-1">
                        {convertDigits(autoPeriodIndividualCalculations.effectiveDays, numberFormat)} {c.workDaysUnit}
                        {autoPeriodIndividualCalculations.otHours > 0 && ` + ${formatHoursAndMinutes(autoPeriodIndividualCalculations.otHours, language)}`}
                      </span>
                    </div>
                  </div>

                  {/* Deducted Advances Card */}
                  <div className="p-4 rounded-3xl bg-amber-50/60 dark:bg-amber-950/30 backdrop-blur-xl border border-amber-200/80 dark:border-amber-800/50 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-all">
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                      <span className="text-xs font-bold">{c.openAdvancesDeducted}</span>
                      <div className="w-8 h-8 rounded-xl bg-amber-100/80 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300 block font-mono">
                          {formatAmount(autoPeriodIndividualCalculations.advancesDeducted, currency, numberFormat)}
                        </span>
                        <span className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70">{getCurrencySymbol(currency, language)}</span>
                      </div>
                      <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-medium block mt-1">
                        {convertDigits(autoPeriodIndividualCalculations.unsettledPayments.length, numberFormat)} {c.currentAdvancesCountUnit}
                      </span>
                    </div>
                  </div>

                  {/* Net Due Final Cumulative Balance Card */}
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/20 flex flex-col justify-between sm:col-span-1">
                    <div className="flex items-center justify-between text-emerald-100">
                      <span className="text-xs font-black">{c.finalBalanceDue}</span>
                      <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                        <Calculator className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-black text-white font-mono">
                          {formatAmount(autoPeriodIndividualCalculations.totalCumulativeDebt, currency, numberFormat)}
                        </span>
                        <span className="text-xs font-bold text-emerald-100">
                          {getCurrencySymbol(currency, language)}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-100/90 block mt-1 font-medium">
                        {autoCutoffDate ? c.claimsUpToDate(autoCutoffDate) : c.claimsUpToToday}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Settlement Mode / Options Selector in Auto Tab */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-500" />
                      <span>{c.paymentStrategyTitle}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option A: Full Settlement */}
                    <button
                      type="button"
                      onClick={handleSelectFullSettlement}
                      className={`p-3.5 rounded-2xl border text-start transition-all flex items-start gap-3 cursor-pointer ${
                        settleOption === "full" && Number(normalizeDigits(finalPaymentAmount)) >= (targetPayableAmount - 0.001)
                          ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                          : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-emerald-300"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        settleOption === "full" && Number(normalizeDigits(finalPaymentAmount)) >= (targetPayableAmount - 0.001)
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          {c.state1FullTitle}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                          {c.state1FullDesc}
                        </span>
                      </div>
                    </button>

                    {/* Option B: Partial Custom Settlement */}
                    <button
                      type="button"
                      onClick={handleSelectPartialSettlement}
                      className={`p-3.5 rounded-2xl border text-start transition-all flex items-start gap-3 cursor-pointer ${
                        settleOption === "partial" || Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001)
                          ? "bg-sky-50/80 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/20 shadow-sm"
                          : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-sky-300"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        settleOption === "partial" || Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001)
                          ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      }`}>
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          {c.state2PartialTitle}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                          {c.state2PartialDesc}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[11px] font-bold text-slate-400">{c.amountShortcutsLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("full")}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      {c.settleFull100}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("half")}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 hover:text-sky-600 dark:hover:text-sky-300 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      {c.fiftyPercentClaim}
                    </button>
                    {targetPayableAmount >= 50000 && (
                      <button
                        type="button"
                        onClick={() => handleApplyPreset("round50k")}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 dark:hover:text-amber-300 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        {c.roundTo50K}
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Live Remaining Balance Due Display */}
                <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  {Number(normalizeDigits(finalPaymentAmount)) >= (targetPayableAmount - 0.001) ? (
                    <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-emerald-800 dark:text-emerald-200">{c.fullSettlementNotice}</span>
                        <span className="block text-[11px] text-slate-400 font-normal mt-0.5">
                          {c.allDaysClosedNotice}
                        </span>
                      </div>
                    </div>
                  ) : Number(normalizeDigits(finalPaymentAmount)) > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <span>{c.balanceAfterPaymentLabel}</span>
                        </span>
                        <span className="text-base font-black text-amber-700 dark:text-amber-300 font-mono">
                          {formatAmount(Math.max(0, targetPayableAmount - Number(normalizeDigits(finalPaymentAmount))), currency, numberFormat)} {getCurrencySymbol(currency, language)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        {c.formulaExplainer(formatAmount(targetPayableAmount, currency, numberFormat), formatAmount(Number(normalizeDigits(finalPaymentAmount)), currency, numberFormat))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span>{c.enterAmountPrompt}</span>
                    </div>
                  )}
                </div>

                {/* 4. Collapsible Unsettled Days List (FIFO Order) */}
                <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsLogsAccordionOpen((prev) => !prev)}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-start"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <FileText className="w-4 h-4 text-sky-500" />
                      <span>{c.unsettledDaysBreakdownTitle(convertDigits(individualCalculations.unsettledLogs.length, numberFormat))}</span>
                      {Number(normalizeDigits(finalPaymentAmount)) > 0 && Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001) && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-bold">
                          {c.fifoTag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <span>{isLogsAccordionOpen ? c.hideList : c.viewList}</span>
                      {isLogsAccordionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isLogsAccordionOpen && (
                    <div className="p-3.5 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      {individualCalculations.unsettledLogs.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 font-medium">
                          {c.allPreviousDaysSettled}
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1 hide-scrollbar mt-2">
                          {individualCalculations.unsettledLogs.map((l) => {
                            const isCovered = coveredLogIds.has(l.id || l.date);
                            return (
                              <div 
                                key={l.id || l.date} 
                                className={`flex items-center justify-between p-2.5 rounded-xl border text-[11px] transition-colors ${
                                  isCovered
                                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50'
                                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 opacity-80'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{convertDigits(l.date, numberFormat)}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    l.type === 'hourly' 
                                      ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300' 
                                      : l.type === 'half'
                                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                  }`}>
                                    {l.type === 'half' ? c.halfDay : l.type === 'hourly' ? c.hourly : c.fullDay}
                                  </span>
                                  {l.overtimeHours > 0 && (
                                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                                      +{formatHoursAndMinutes(l.overtimeHours, language)}
                                    </span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    isCovered
                                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                                  }`}>
                                    {isCovered ? c.coveredStatus : c.openArrearsStatus}
                                  </span>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white font-mono">
                                  {formatAmount(l.totalDayPay, currency, numberFormat)} {getCurrencySymbol(currency, language)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

            </div>

            {/* ------------------------------------------------------------- */}
            {/* LEFT COLUMN: 5 COLUMNS (PAYMENT SUBMISSION FORM) */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-5 space-y-4">

              <form id="settlement-form" onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. Payment Amount & Date Card */}
          <div className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {settlementMode === 'group' 
                    ? c.finalPaymentToSupervisorLabel 
                    : settlementTypeTab === 'custom'
                    ? c.paymentCustomSettlementLabel
                    : t('finalPaymentAmount')}
                </label>
                {isAmountManuallyEdited && Number(normalizeDigits(finalPaymentAmount)) !== Number(activeTabTargetPayable) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFinalPaymentAmount(activeTabTargetPayable > 0 ? String(activeTabTargetPayable) : '0');
                      setIsAmountManuallyEdited(false);
                    }}
                    className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-bold flex items-center gap-1"
                  >
                    {c.resetToTotalAmount(formatAmount(activeTabTargetPayable, currency, numberFormat))}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={finalPaymentAmount}
                  onChange={(e) => {
                    const normalized = normalizeDigits(e.target.value);
                    setFinalPaymentAmount(normalized);
                    setIsAmountManuallyEdited(true);
                  }}
                  onBlur={() => {
                    if (finalPaymentAmount !== '') {
                      const num = Number(normalizeDigits(finalPaymentAmount));
                      if (!isNaN(num)) {
                        setFinalPaymentAmount(String(roundCurrency(num, currency)));
                      }
                    }
                  }}
                  required
                  className={`w-full px-3 py-2 text-sm font-black bg-white dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-2 font-mono pe-14 ${
                    settlementTypeTab === 'custom'
                      ? 'border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 focus:ring-sky-500'
                      : settlementMode === 'group'
                      ? 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 focus:ring-amber-500'
                      : 'border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500'
                  }`}
                />
                <span className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-xs font-bold text-slate-400">
                  {getCurrencySymbol(currency, language)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('settlementDate')}
              </label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>
          </div>

          {/* Payment Account (Bank Card / Cash Box) */}
          <div className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-500" />
                <span>{c.settlementPaymentAccount}</span>
              </label>
              {defaultAccount && (
                <span className="text-[11px] text-amber-500 font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                  <Star className="w-3 h-3 fill-amber-500" />
                  <span>{c.defaultPrefix}{defaultAccount.name}</span>
                </span>
              )}
            </div>
            {financialAccounts.length > 0 ? (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white cursor-pointer font-bold shadow-xs transition-all"
              >
                {financialAccounts.map((acc) => {
                  const b = accountBalances?.get(String(acc.id))?.currentBalance ?? (Number(acc.initialBalance) || 0);
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.type === "bank" ? c.bankCardPrefix : c.cashDeskPrefix}
                      {acc.name} {acc.bankName ? `(${acc.bankName})` : ""} - {c.balancePrefix}{formatCurrency(b, currency, language)} {acc.isDefault ? c.defaultStar : ""}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="text-xs text-slate-400 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                {c.workshopCashDesk}
              </div>
            )}

            {/* Overdraft live alert in form */}
            {currentOverdraft && !currentOverdraft.hasSufficientFunds && (
              <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 transition-all ${
                currentOverdraft.effectivePolicy === "never_allow"
                  ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300"
                  : "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300"
              }`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  currentOverdraft.effectivePolicy === "never_allow"
                    ? "bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400"
                    : "bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400"
                }`}>
                  {currentOverdraft.effectivePolicy === "never_allow" ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-black text-xs">
                    {currentOverdraft.effectivePolicy === "never_allow"
                      ? c.overdraftDeficitBlocked
                      : currentOverdraft.effectivePolicy === "always_allow"
                        ? c.overdraftDeficitAllowed
                        : c.overdraftDeficitPrompt}
                  </div>
                  <div className="text-[11px] leading-relaxed opacity-90">
                    {currentOverdraft.effectivePolicy === "never_allow"
                      ? c.overdraftBlockedDesc(formatCurrency(currentOverdraft.currentBalance, currency, language), formatCurrency(currentOverdraft.shortfall, currency, language))
                      : currentOverdraft.effectivePolicy === "always_allow"
                        ? c.overdraftAllowedDesc(formatCurrency(currentOverdraft.currentBalance, currency, language), formatCurrency(currentOverdraft.shortfall, currency, language))
                        : c.overdraftPromptDesc(formatCurrency(currentOverdraft.currentBalance, currency, language), formatCurrency(currentOverdraft.shortfall, currency, language))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reference / Document Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('referenceNumber')}
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={c.referencePlaceholder}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="2"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Mark as Settled Checkbox */}
          <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer ${
            settlementTypeTab === 'custom'
              ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-800/60'
              : settlementMode === 'group'
              ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60'
              : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60'
          }`}>
            <input
              type="checkbox"
              checked={markAsSettled}
              onChange={(e) => setMarkAsSettled(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {settlementTypeTab === 'custom'
                ? c.closeSelectedDaysOnly(convertDigits(selectedCustomLogs.length, numberFormat))
                : settlementMode === 'group'
                ? (Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001)
                    ? c.closeCoveredDaysOnly
                    : c.settleAllGroupMembers(groupMembers.length))
                : (Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001)
                    ? c.closeCoveredDaysWithRemainder(formatAmount(Math.max(0, targetPayableAmount - Number(normalizeDigits(finalPaymentAmount))), currency, numberFormat), getCurrencySymbol(currency, language))
                    : (t('markAsSettledCheckbox') || c.closeCoveredDaysOnly))}
            </span>
          </label>

          {/* Feedback error or alert near submit button */}
          {feedback.message && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
            }`}>
              {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          </form>
            </div>

          </div>
        )}

        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. STICKY APPLE LIQUID GLASS BOTTOM ACTION DOCK */}
      {/* ------------------------------------------------------------- */}
      {(settlementMode === 'group' || worker) && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 z-40 shadow-lg">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Live Summary on Start Side */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400">
                  {c.paidAmountLabel}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  {finalPaymentAmount ? Number(normalizeDigits(finalPaymentAmount)).toLocaleString() : c.zeroAmount}
                </span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {getCurrencySymbol(currency, language)}
                </span>
              </div>

              {Number(normalizeDigits(finalPaymentAmount)) < (targetPayableAmount - 0.001) && Number(normalizeDigits(finalPaymentAmount)) > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-mono">
                  <span>{c.arrearsBalanceLabel}</span>
                  <span>{formatAmount(Math.max(0, targetPayableAmount - Number(normalizeDigits(finalPaymentAmount))), currency, numberFormat)} {getCurrencySymbol(currency, language)}</span>
                </div>
              )}

              {settlementMode === 'individual' && worker && (
                <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{c.workerPrefix}{worker.name}</span>
                </div>
              )}

              {settlementMode === 'group' && (
                <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>{c.supervisorPrefix}{supervisorWorker?.name || c.undefinedSupervisorShort} ({c.membersCount(groupMembers.length)})</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-1/3 sm:w-auto px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {c.cancelEsc}
              </button>

              <button
                type="submit"
                form="settlement-form"
                disabled={isSubmitting}
                className={`w-2/3 sm:w-auto px-7 py-2.5 rounded-2xl text-xs font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === "never_allow"
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30"
                    : settlementTypeTab === "custom"
                    ? "bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-sky-500/25"
                    : settlementMode === "group"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/25"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{c.submitting}</span>
                  </>
                ) : currentOverdraft && !currentOverdraft.hasSufficientFunds && currentOverdraft.effectivePolicy === "never_allow" ? (
                  <>
                    <Ban className="w-4 h-4 stroke-[2.5]" />
                    <span>{c.insufficientFundsBlockedBtn}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {settlementMode === "group"
                        ? c.submitGroupSettlementBtn(groupMembers.length)
                        : settlementTypeTab === "custom"
                        ? c.submitDetailedSettlementBtn(convertDigits(selectedCustomLogs.length, numberFormat))
                        : t("settleBtn")}
                    </span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

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
