import { logAuditAction } from "../services/auditLogger";
import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useProject } from '../context/ProjectContext';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  softDeleteExpenseLive, 
  restoreExpenseLive, 
  archiveExpenseLive, 
  permanentDeleteExpenseLive, 
  emptyExpensesTrashLive, 
  restoreAllExpensesLive, 
  deleteExpenseLive, 
  pullExpensesLive 
} from '../services/realtimeSync';
import { AddExpenseModal } from './AddExpenseModal';
import ExpenseRecycleBinModal from './ExpenseRecycleBinModal';
import ExpenseAnalyticsModal from './ExpenseAnalyticsModal';
import * as XLSX from 'xlsx';
import {
  Receipt,
  PlusCircle,
  Plus,
  BarChart3,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  User,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  X,
  TrendingUp,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Tag,
  Archive,
  RotateCcw,
  Lock,
  CheckCheck,
  ShieldCheck
} from 'lucide-react';
import { VerificationBadge } from './common/VerificationBadge';
import { useTwoStageApproval } from '../hooks/useTwoStageApproval';

export { AddExpenseModal, ExpenseRecycleBinModal, ExpenseAnalyticsModal };

export function ExpensesView() {
  const { currentProject } = useProject();
  const { t, language, direction, numberFormat } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  // Comprehensive Trilingual Dictionary for Expenses (Zero Cross-Language Leakage)
  const copy = {
    fa: {
            tabActiveExpenses: 'هزینه‌های جاری',
      tabArchivedExpenses: 'بایگانی و آرشیو',
      tabTrashExpenses: 'سطل زباله',
      noSpecificSection: 'بدون بخش مشخص',
      generalProjectExpense: 'هزینه عمومی پروژه',
      alertAdminOnlyApprove: 'فقط مدیر ارشد (Admin) مجاز به تایید نهایی اسناد است.',
      toastExpenseApproved: 'سند هزینه با موفقیت تایید نهایی و قفل گردید.',
      errorApproval: 'خطا در تایید سند',
      alertApprovedCannotEdit: 'این سند تایید نهایی شده و غیرقابل تغییر است.',
      toastRestoredSingle: 'هزینه با موفقیت بازیابی شد.',
      pageTitle: 'مدیریت هزینه‌ها و مخارج',
      pageSubtitle: 'ثبت هزینه‌های مصالح، ماشین‌آلات، خدمات و تنخواه کارگاه',
      unitInvoices: 'فاکتور',
      archiveAndTrashTooltip: 'سطل زباله و آرشیو',
      analyticsAndExportTooltip: 'آمار و تحلیل مخارج',
      newExpense: 'هزینه جدید',
      newExpenseTooltip: 'ثبت هزینه جدید',
      pulseTitle: 'نبض هزینه‌ها و مخارج پروژه',
      totalExpensesDesc: 'مجموع فاکتورها و هزینه‌های ثبت‌شده پروژه',
      clearedPaid: 'تسویه‌شده:',
      pendingCredit: 'معوق (نسیه):',
      clearedPercent: 'پرداخت شده',
      thisMonthExpenses: 'هزینه این ماه:',
      topSpendingSection: 'بخش پرهزینه پروژه',
      shareOfTotal: 'سهم از کل',
      recordInvoice: 'ثبت فاکتور',
      excelExport: 'خروجی اکسل',
      tabActive: 'هزینه‌های جاری',
      tabArchived: 'بایگانی‌شده',
      tabTrash: 'سطل زباله',
      restoreAll: 'بازیابی همه',
      emptyTrash: 'خالی کردن سطل زباله',
      trashBanner: 'شما در حال مشاهده سطل زباله هستید. هزینه‌های این بخش در داشبورد و آمار جاری محاسبه نمی‌شوند و تا پیش از حذف قطعی قابل بازیابی هستند.',
      archiveBanner: 'شما در حال مشاهده هزینه‌های بایگانی‌شده هستید. این هزینه‌ها در سوابق و گزارشات مالی حفظ شده‌اند اما در لیست فعال نمایش داده نمی‌شوند.',
      searchPlaceholder: 'جستجو در عنوان، طرف‌حساب، توضیحات...',
      filterAll: 'همه',
      filterThisMonth: 'این ماه',
      filterLastMonth: 'ماه قبل',
      filtersButton: 'فیلترها',
      sectionLabel: 'بخش پروژه',
      allSections: 'همه بخش‌ها',
      unassignedSection: 'هزینه عمومی (بدون بخش)',
      categoryLabel: 'سرفصل هزینه',
      allCategories: 'همه سرفصل‌ها',
      counterpartyLabel: 'طرف‌حساب (شخص)',
      allCounterparties: 'همه اشخاص',
      settlementStatusLabel: 'وضعیت تسویه',
      allStatuses: 'همه وضعیت‌ها',
      statusPaid: 'تسویه شده',
      statusPending: 'پرداخت نشده (نسیه)',
      approvalStatusLabel: 'وضعیت تایید و قفل',
      allApprovals: 'همه اسناد',
      statusApproved: 'تایید شده (قفل)',
      statusDraft: 'پیش‌نویس',
      colDate: 'تاریخ',
      colTitle: 'عنوان هزینه',
      colCategory: 'سرفصل (۳ سطحی)',
      colCounterparty: 'طرف‌حساب',
      colSection: 'بخش پروژه',
      colAmount: 'مبلغ',
      colSettlementStatus: 'وضعیت تسویه',
      colApprovalStatus: 'وضعیت تایید',
      colReceipt: 'رسید',
      colActions: 'عملیات',
      restoreAction: 'بازیابی',
      restoreTooltip: 'بازیابی به هزینه‌های جاری',
      permanentDeleteTooltip: 'حذف دائمی',
      unarchiveAction: 'خروج از آرشیو',
      unarchiveTooltip: 'خروج از بایگانی',
      moveToTrashTooltip: 'انتقال به سطل زباله',
      finalApproveAction: 'تایید نهایی',
      finalApproveTooltip: 'تایید نهایی سند و قفل‌سازی',
      documentLockedTitle: 'این سند تایید شده و غیرقابل تغییر یا حذف است.',
      lockedDocument: 'سند قفل',
      archiveTooltip: 'بایگانی کردن هزینه',
      edit: 'ویرایش',
      viewReceiptTooltip: 'مشاهده تصویر فاکتور',
      paidBadge: 'تسویه شده',
      pendingBadge: 'معوق (نسیه)',
      paidShort: 'تسویه',
      pendingShort: 'معوق',
      toPayee: 'به:',
      general: 'عمومی',
      generalExpense: 'هزینه عمومی',
      unknownCategory: 'سرفصل نامشخص',
      mainGroup: 'گروه اصلی',
      projectSectionDefault: 'بخش پروژه',
      noExpensesFound: 'هیچ فاکتور هزینه‌ای یافت نشد',
      emptyHintActive: 'برای شروع اولین هزینه یا فاکتور پروژه را از دکمه بالا ثبت کنید.',
      emptyHintFilters: 'با تغییر فیلترهای جستجو نتایج بیشتری مشاهده خواهید کرد.',
      clearFilters: 'پاک کردن فیلترها',
      receiptAttachedImage: 'تصویر فاکتور / رسید ضمیمه شده',
      openInNewTab: 'باز کردن در تب جدید',
      moveToTrashDialogTitle: 'انتقال هزینه به سطل زباله',
      moveToTrashDialogDesc: (title) => `آیا از انتقال هزینه «${title}» به سطل زباله اطمینان دارید؟ این هزینه از لیست جاری خارج شده اما تا پاکسازی قطعی قابل بازیابی خواهد بود.`,
      permanentDeleteDialogTitle: 'حذف قطعی و دائمی هزینه',
      permanentDeleteDialogDesc: (title) => `آیا از حذف دائمی هزینه «${title}» اطمینان دارید؟ این عملیات کاملاً غیرقابل بازگشت است.`,
      cancel: 'انصراف',
      moveToTrashConfirm: 'انتقال به سطل زباله',
      permanentDeleteConfirm: 'حذف قطعی',
      alertApprovedCannotChange: 'این سند تایید نهایی شده و وضعیت آن غیرقابل تغییر است.',
      toastArchived: 'هزینه به بخش بایگانی منتقل گردید.',
      toastUnarchived: 'هزینه از بایگانی خارج و به لیست فعال بازگشت.',
      alertApprovedCannotDelete: 'این سند هزینه تایید نهایی شده است و به جهت الزامات مالیاتی غیرقابل حذف قطعی می‌باشد.',
      toastPermanentlyDeleted: 'هزینه برای همیشه حذف گردید.',
      alertNoExpensesToExport: 'هیچ هزینه‌ای برای خروجی وجود ندارد.',
      toastAllRestored: 'تمام هزینه‌ها بازیابی شدند.',
      confirmEmptyTrash: 'آیا از خالی کردن سطل زباله و حذف قطعی تمام هزینه‌ها اطمینان دارید؟',
      toastTrashEmptied: 'سطل زباله خالی شد.',
      toastMovedToTrash: 'هزینه به سطل زباله منتقل شد.',
      auditPermanentDelete: (title) => `حذف فاکتور/هزینه: ${title}`,
      methodCashBox: 'صندوق نقدی',
      methodBank: 'حساب بانکی',
      methodPettyCash: 'تنخواه سرپرست',
      yes: 'بله',
      no: 'خیر',
      excelDate: 'تاریخ فاکتور',
      excelTitle: 'عنوان هزینه',
      excelMainGroup: 'گروه اصلی',
      excelSubGroup: 'زیرگروه',
      excelItem: 'هزینه خرد',
      excelAmount: 'مبلغ',
      excelCurrency: 'واحد پول',
      excelCounterparty: 'طرف‌حساب',
      excelSection: 'بخش پروژه',
      excelStatus: 'وضعیت تسویه',
      excelMethod: 'روش پرداخت',
      excelHasReceipt: 'رسید پیوست دارد؟',
      excelNotes: 'یادداشت و توضیحات'
    },
    ku: {
            tabActiveExpenses: 'خەرجییە چالاکەکان',
      tabArchivedExpenses: 'ئەرشیفکراوەکان',
      tabTrashExpenses: 'سەبەتەی سڕینەوە',
      noSpecificSection: 'بێ بەشی دیاریکراو',
      generalProjectExpense: 'خەرجی گشتیی پڕۆژە',
      alertAdminOnlyApprove: 'تەنها بەڕێوەبەری سەرەکی (Admin) دەسەڵاتی پەسەندکردنی کۆتایی هەیە.',
      toastExpenseApproved: 'بەڵگەنامەی خەرجی بە سەرکەوتوویی پەسەندکرا و قفڵ کرا.',
      errorApproval: 'هەڵە لە پەسەندکردنی بەڵگەنامە',
      alertApprovedCannotEdit: 'ئەم بەڵگەنامەیە پەسەندکراوە و دەستکاری ناکرێت.',
      toastRestoredSingle: 'خەرجییەکە بە سەرکەوتوویی گەڕێنرایەوە.',
      pageTitle: 'بەڕێوەبردنی خەرجییەکان',
      pageSubtitle: 'تۆمارکردنی خەرجییەکانی کەرەستە، ئامێر، خزمەتگوزاری و تەنخوای کارگە',
      unitInvoices: 'فاکتۆر',
      archiveAndTrashTooltip: 'سەبەتەی سڕینەوە و ئەرشیف',
      analyticsAndExportTooltip: 'ئامار و شیکاریی خەرجی',
      newExpense: 'خەرجی نوێ',
      newExpenseTooltip: 'تۆمارکردنی خەرجی نوێ',
      pulseTitle: 'کۆی گشتیی خەرجییەکانی پڕۆژە',
      totalExpensesDesc: 'کۆی گشتیی فاکتۆر و خەرجییە تۆمارکراوەکانی پڕۆژە',
      clearedPaid: 'پارەدراو:',
      pendingCredit: 'قەرز (نسیە):',
      clearedPercent: 'دراوە',
      thisMonthExpenses: 'خەرجی ئەم مانگە:',
      topSpendingSection: 'پڕخەرجیترین بەشی پڕۆژە',
      shareOfTotal: 'بەش لە کۆی گشتی',
      recordInvoice: 'تۆمارکردنی فاکتۆر',
      excelExport: 'دەرکردنی ئەکسڵ',
      tabActive: 'خەرجییە چالاکەکان',
      tabArchived: 'ئەرشیفکراو',
      tabTrash: 'سەبەتەی سڕینەوە',
      restoreAll: 'گەڕاندنەوەی هەمووان',
      emptyTrash: 'بەتاڵکردنی سەبەتە',
      trashBanner: 'ئێستا لە سەبەتەی سڕینەوەیت. تۆمارەکان لە دەشبۆرد ناژمێردرێن و دەتوانیت پێش سڕینەوەی یەکجارەکی بیانگەڕێنیتەوە.',
      archiveBanner: 'ئێستا لە بەشی ئەرشیفیت. ئەم خەرجییانە لە تۆمارە داراییەکاندا پارێزراون بەڵام لە لیستی سەرەکیدا نین.',
      searchPlaceholder: 'گەڕان لە ناونیشان، لایەنی بەرامبەر، تێبینی...',
      filterAll: 'هەموو',
      filterThisMonth: 'ئەم مانگە',
      filterLastMonth: 'مانگی پێشوو',
      filtersButton: 'فلتەرەکان',
      sectionLabel: 'بەشی پڕۆژە',
      allSections: 'هەموو بەشەکان',
      unassignedSection: 'خەرجی گشتی (بێ بەش)',
      categoryLabel: 'پۆلێنکردنی خەرجی',
      allCategories: 'هەموو پۆلەکان',
      counterpartyLabel: 'لایەنی بەرامبەر (کەس)',
      allCounterparties: 'هەموو کەسەکان',
      settlementStatusLabel: 'دۆخی پارەدان',
      allStatuses: 'هەموو دۆخەکان',
      statusPaid: 'پارەدراو',
      statusPending: 'قەرز (نسیە)',
      approvalStatusLabel: 'دۆخی پەسەندکردن و قفڵ',
      allApprovals: 'هەموو بەڵگەنامەکان',
      statusApproved: 'پەسەندکراو (قفڵ)',
      statusDraft: 'ڕەشنووس',
      colDate: 'بەروار',
      colTitle: 'بابەت',
      colCategory: 'پۆلێنکردن',
      colCounterparty: 'لایەنی بەرامبەر',
      colSection: 'بەش',
      colAmount: 'بڕە پارە',
      colSettlementStatus: 'دۆخ',
      colApprovalStatus: 'دۆخی پەسەندکردن',
      colReceipt: 'پسوولە',
      colActions: 'کردار',
      restoreAction: 'گێڕانەوە',
      restoreTooltip: 'گێڕانەوە بۆ خەرجییە چالاکەکان',
      permanentDeleteTooltip: 'سڕینەوەی یەکجاری',
      unarchiveAction: 'دەرهێنان لە ئەرشیف',
      unarchiveTooltip: 'دەرهێنان لە ئەرشیف',
      moveToTrashTooltip: 'بردن بۆ سەبەتەی سڕینەوە',
      finalApproveAction: 'پەسەندکردن',
      finalApproveTooltip: 'پەسەندکردنی کۆتایی بەڵگەنامە و قفڵکردن',
      documentLockedTitle: 'ئەم بەڵگەنامەیە پەسەندکراوە و ناگۆڕدرێت.',
      lockedDocument: 'قفڵکراو',
      archiveTooltip: 'ئەرشیفکردنی خەرجی',
      edit: 'دەستکاری',
      viewReceiptTooltip: 'بینینی وێنەی فاکتۆر',
      paidBadge: 'پارەدراو',
      pendingBadge: 'قەرز (نسیە)',
      paidShort: 'دراو',
      pendingShort: 'قەرز',
      toPayee: 'بۆ:',
      general: 'گشتی',
      generalExpense: 'خەرجی گشتی',
      unknownCategory: 'پۆلی نادیار',
      mainGroup: 'گرووپی سەرەکی',
      projectSectionDefault: 'بەشی پڕۆژە',
      noExpensesFound: 'هیچ خەرجییەک نەدۆزرایەوە',
      emptyHintActive: 'یەکەمین خەرجی پڕۆژە لە ڕێگەی دوگمەی سەرەوە تۆمار بکە.',
      emptyHintFilters: 'فلتەرەکان پاک بکەرەوە بۆ بینینی هەموو تۆمارەکان.',
      clearFilters: 'سڕینەوەی فلتەرەکان',
      receiptAttachedImage: 'وێنەی فاکتۆری هاوپێچکراو',
      openInNewTab: 'کردنەوە لە پەڕەی نوێ',
      moveToTrashDialogTitle: 'بردن بۆ سەبەتەی سڕینەوە',
      moveToTrashDialogDesc: (title) => `ئایا دڵنیایت لە بردن بۆ سەبەتەی سڕینەوە؟ دەتوانیت دواتر بیگەڕێنیتەوە.`,
      permanentDeleteDialogTitle: 'سڕینەوەی یەکجاری خەرجی',
      permanentDeleteDialogDesc: (title) => `ئایا دڵنیایت لە سڕینەوەی یەکجاری؟ ئەم کردارە ناگەڕێتەوە.`,
      cancel: 'پاشگەزبوونەوە',
      moveToTrashConfirm: 'بردن بۆ سەبەتە',
      permanentDeleteConfirm: 'سڕینەوەی یەکجاری',
      alertApprovedCannotChange: 'ئەم بەڵگەنامەیە پەسەندکراوە و ناگۆڕدرێت.',
      toastArchived: 'خەرجییەکە ئەرشیفکرا.',
      toastUnarchived: 'خەرجی لە ئەرشیف دەرهێندرا.',
      alertApprovedCannotDelete: 'بەڵگەنامەی پەسەندکراو بەهۆی ڕێساکانی دارایی ناسڕدرێتەوە.',
      toastPermanentlyDeleted: 'خەرجییەکە بە یەکجاری سڕایەوە.',
      alertNoExpensesToExport: 'هیچ خەرجییەک نییە بۆ هەناردەکردن.',
      toastAllRestored: 'هەموو خەرجییەکان گەڕێندرانەوە.',
      confirmEmptyTrash: 'ئایا دڵنیایت لە بەتاڵکردنی سەبەتە و سڕینەوەی یەکجاری؟',
      toastTrashEmptied: 'سەبەتە بەتاڵکرا.',
      toastMovedToTrash: 'خەرجی گوازرایەوە بۆ سەبەتە.',
      auditPermanentDelete: (title) => `سڕینەوەی فاکتۆر/خەرجی: ${title}`,
      methodCashBox: 'کاش',
      methodBank: 'بانک',
      methodPettyCash: 'تەنخوا',
      yes: 'بەڵێ',
      no: 'نەخێر',
      excelDate: 'بەروار',
      excelTitle: 'بابەت',
      excelMainGroup: 'گرووپی سەرەکی',
      excelSubGroup: 'ژێرگرووپ',
      excelItem: 'وردەکاری',
      excelAmount: 'بڕە پارە',
      excelCurrency: 'دراو',
      excelCounterparty: 'لایەنی بەرامبەر',
      excelSection: 'بەشی پڕۆژە',
      excelStatus: 'دۆخی پارەدان',
      excelMethod: 'شێوازی پارەدان',
      excelHasReceipt: 'پسوولە هەیە؟',
      excelNotes: 'تێبینی'
    },
    en: {
            tabActiveExpenses: 'Active Expenses',
      tabArchivedExpenses: 'Archived Expenses',
      tabTrashExpenses: 'Recycle Bin',
      noSpecificSection: 'Unassigned Section',
      generalProjectExpense: 'General Project Expense',
      alertAdminOnlyApprove: 'Only an Admin is authorized to grant final approval.',
      toastExpenseApproved: 'Expense document approved and locked.',
      errorApproval: 'Error approving document',
      alertApprovedCannotEdit: 'This document is approved and locked from editing.',
      toastRestoredSingle: 'Expense restored successfully.',
      pageTitle: 'Expense & Cost Management',
      pageSubtitle: 'Record materials, machinery, subcontractor services, and petty cash',
      unitInvoices: 'invoices',
      archiveAndTrashTooltip: 'Recycle Bin & Archive',
      analyticsAndExportTooltip: 'Expense Analytics & Reports',
      newExpense: 'New Expense',
      newExpenseTooltip: 'Record New Expense',
      pulseTitle: 'Project Expenses Pulse',
      totalExpensesDesc: 'Total all-time expenses recorded for this project',
      clearedPaid: 'Paid:',
      pendingCredit: 'Pending (Credit):',
      clearedPercent: 'Cleared',
      thisMonthExpenses: 'This Month:',
      topSpendingSection: 'Top Spending Section',
      shareOfTotal: 'share of total',
      recordInvoice: 'Add Expense',
      excelExport: 'Excel Export',
      tabActive: 'Active Expenses',
      tabArchived: 'Archived',
      tabTrash: 'Recycle Bin',
      restoreAll: 'Restore All',
      emptyTrash: 'Empty Recycle Bin',
      trashBanner: 'You are viewing the recycle bin. Deleted expenses are excluded from dashboards and can be restored before permanent deletion.',
      archiveBanner: 'You are viewing archived expenses. They remain preserved in financial records and ledger audits but are hidden from active views.',
      searchPlaceholder: 'Search title, counterparty, description...',
      filterAll: 'All Time',
      filterThisMonth: 'This Month',
      filterLastMonth: 'Last Month',
      filtersButton: 'Filters',
      sectionLabel: 'Project Section',
      allSections: 'All Sections',
      unassignedSection: 'General / Unassigned',
      categoryLabel: 'Expense Category',
      allCategories: 'All Categories',
      counterpartyLabel: 'Counterparty (Person)',
      allCounterparties: 'All Persons',
      settlementStatusLabel: 'Payment Status',
      allStatuses: 'All Statuses',
      statusPaid: 'Paid',
      statusPending: 'Pending (Credit)',
      approvalStatusLabel: 'Approval & Lock Status',
      allApprovals: 'All Documents',
      statusApproved: 'Approved (Locked)',
      statusDraft: 'Draft',
      colDate: 'Date',
      colTitle: 'Expense Title',
      colCategory: 'Category',
      colCounterparty: 'Counterparty',
      colSection: 'Project Section',
      colAmount: 'Amount',
      colSettlementStatus: 'Payment Status',
      colApprovalStatus: 'Verification',
      colReceipt: 'Receipt',
      colActions: 'Actions',
      restoreAction: 'Restore',
      restoreTooltip: 'Restore to Active Expenses',
      permanentDeleteTooltip: 'Delete Permanently',
      unarchiveAction: 'Unarchive',
      unarchiveTooltip: 'Move out of Archive',
      moveToTrashTooltip: 'Move to Recycle Bin',
      finalApproveAction: 'Final Approve',
      finalApproveTooltip: 'Final Approve & Lock Document',
      documentLockedTitle: 'This document is approved and locked from modification.',
      lockedDocument: 'Locked',
      archiveTooltip: 'Archive Expense',
      edit: 'Edit',
      viewReceiptTooltip: 'View Receipt Image',
      paidBadge: 'Paid',
      pendingBadge: 'Pending (Credit)',
      paidShort: 'Paid',
      pendingShort: 'Due',
      toPayee: 'To:',
      general: 'General',
      generalExpense: 'General Expense',
      unknownCategory: 'Unknown Category',
      mainGroup: 'Main Group',
      projectSectionDefault: 'Project Section',
      noExpensesFound: 'No expense invoices found',
      emptyHintActive: 'Click the button above to record the first project expense.',
      emptyHintFilters: 'Try clearing or modifying your search filters.',
      clearFilters: 'Clear Filters',
      receiptAttachedImage: 'Attached invoice / receipt image',
      openInNewTab: 'Open in new tab',
      moveToTrashDialogTitle: 'Move Expense to Recycle Bin',
      moveToTrashDialogDesc: (title) => `Are you sure you want to move "${title}" to the recycle bin? It can be restored later.`,
      permanentDeleteDialogTitle: 'Permanently Delete Expense',
      permanentDeleteDialogDesc: (title) => `Are you sure you want to permanently delete "${title}"? This action cannot be undone.`,
      cancel: 'Cancel',
      moveToTrashConfirm: 'Move to Trash',
      permanentDeleteConfirm: 'Delete Permanently',
      alertApprovedCannotChange: 'This document has final approval and cannot be modified.',
      toastArchived: 'Expense moved to archive.',
      toastUnarchived: 'Expense restored to active list.',
      alertApprovedCannotDelete: 'This document is approved and cannot be deleted due to accounting rules.',
      toastPermanentlyDeleted: 'Expense permanently deleted.',
      alertNoExpensesToExport: 'No expenses available to export.',
      toastAllRestored: 'All expenses restored.',
      confirmEmptyTrash: 'Are you sure you want to empty the recycle bin and permanently delete all records?',
      toastTrashEmptied: 'Recycle bin emptied.',
      toastMovedToTrash: 'Expense moved to recycle bin.',
      auditPermanentDelete: (title) => `Permanent delete expense invoice: ${title}`,
      methodCashBox: 'Cash Box',
      methodBank: 'Bank Account',
      methodPettyCash: 'Petty Cash',
      yes: 'Yes',
      no: 'No',
      excelDate: 'Invoice Date',
      excelTitle: 'Expense Title',
      excelMainGroup: 'Main Category',
      excelSubGroup: 'Subcategory',
      excelItem: 'Cost Item',
      excelAmount: 'Amount',
      excelCurrency: 'Currency',
      excelCounterparty: 'Counterparty',
      excelSection: 'Project Section',
      excelStatus: 'Payment Status',
      excelMethod: 'Payment Method',
      excelHasReceipt: 'Has Receipt?',
      excelNotes: 'Notes & Description'
    }
  }[langKey];
  const isRtl = direction === 'rtl';
  const { canApprove, canModifyRecord, approveRecord } = useTwoStageApproval();
  const [approvingExpenseId, setApprovingExpenseId] = useState(null);

  const projectId = currentProject?.id || 'prj_default_main';
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  // Currency Formatter
  const formatCurrency = (amount, customCurr = null) => {
    const curr = customCurr || currency;
    const num = Number(amount) || 0;
    try {
      const numLocale = language === 'fa' ? 'fa-IR' : language === 'ku' ? 'ckb-IQ' : 'en-US';
      const formattedNum = new Intl.NumberFormat(numLocale, { maximumFractionDigits: 2 }).format(num);
      if (curr === 'IRT') {
        const symbol = language === 'fa' ? 'تومان' : language === 'ku' ? 'تۆمەن' : 'IRT';
        return `${formattedNum} ${symbol}`;
      }
      if (curr === 'USD') {
        return `${formattedNum}`;
      }
      const symbol = language === 'fa' ? 'دینار' : language === 'ku' ? 'دینار' : 'IQD';
      return `${formattedNum} ${symbol}`;
    } catch {
      return `${num.toLocaleString()} ${curr}`;
    }
  };

  // Instant Realtime sync on mount, tab focus, or WebSocket broadcast event
  useEffect(() => {
    pullExpensesLive(true).catch(() => {});
    const onSync = () => {
      pullExpensesLive(true).catch(() => {});
    };
    window.addEventListener('workshop-expenses-sync', onSync);
    window.addEventListener('focus', onSync);
    return () => {
      window.removeEventListener('workshop-expenses-sync', onSync);
      window.removeEventListener('focus', onSync);
    };
  }, [projectId]);

  // Live Queries
  const expenses = useLiveQuery(
    async () => {
      const list = await db.expenses.toArray();
      const filtered = list.filter(e => !e.projectId || e.projectId === projectId || (projectId === 'prj_default_main'));
      return filtered.sort((a, b) => new Date(b.expenseDate || b.createdAt) - new Date(a.expenseDate || a.createdAt));
    },
    [projectId]
  ) || [];

  const categories = useLiveQuery(
    async () => {
      const list = await db.expenseCategories.toArray();
      return list.filter(c => !c.projectId || c.projectId === projectId || (projectId === 'prj_default_main'));
    },
    [projectId]
  ) || [];

  const sections = useLiveQuery(
    () => db.projectSections.where('projectId').equals(projectId).toArray(),
    [projectId]
  ) || [];

  const workers = useLiveQuery(
    () => db.workers.where('projectId').equals(projectId).toArray(),
    [projectId]
  ) || [];

  // Lookup Maps
  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const sectionMap = useMemo(() => {
    const map = new Map();
    sections.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sections]);

  const workerMap = useMemo(() => {
    const map = new Map();
    workers.forEach((w) => map.set(w.id, w.name));
    return map;
  }, [workers]);

  // Modal & Tab States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState(null);
  const [isRecycleBinModalOpen, setIsRecycleBinModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [currentViewTab, setCurrentViewTab] = useState('active'); // 'active' | 'archived' | 'trash'
  const [toastMsg, setToastMsg] = useState('');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'custom'
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'paid' | 'pending'
  const [selectedMethod, setSelectedMethod] = useState('all'); // 'all' | 'cash' | 'bank' | 'petty_cash'
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState('all'); // 'all' | 'approved' | 'draft'
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);

  // Quick helper to resolve full category hierarchy breadcrumbs
  const getCategoryHierarchy = (catId) => {
    if (!catId) return { main: copy.general, sub: '', item: '' };
    const target = categoryMap.get(catId);
    if (!target) return { main: copy.unknownCategory, sub: '', item: '' };

    if (target.level === 3) {
      const parentSub = categoryMap.get(target.parentId);
      const parentMain = parentSub ? categoryMap.get(parentSub.parentId) : null;
      return {
        main: parentMain?.name || copy.mainGroup,
        sub: parentSub?.name || '',
        item: target.name
      };
    } else if (target.level === 2) {
      const parentMain = categoryMap.get(target.parentId);
      return {
        main: parentMain?.name || copy.mainGroup,
        sub: target.name,
        item: ''
      };
    } else {
      return {
        main: target.name,
        sub: '',
        item: ''
      };
    }
  };

  // Partition expenses into Active, Archived, and Trash
  const activeExpenses = useMemo(() => {
    return expenses.filter(e => !e.deletedAt && !e.isArchived);
  }, [expenses]);

  const archivedExpenses = useMemo(() => {
    return expenses.filter(e => !e.deletedAt && Boolean(e.isArchived));
  }, [expenses]);

  const trashExpenses = useMemo(() => {
    return expenses.filter(e => Boolean(e.deletedAt));
  }, [expenses]);

  const currentTabExpenses = useMemo(() => {
    if (currentViewTab === 'trash') return trashExpenses;
    if (currentViewTab === 'archived') return archivedExpenses;
    return activeExpenses;
  }, [currentViewTab, activeExpenses, archivedExpenses, trashExpenses]);

  // Tab items config matching project Liquid Glass Dock design system
  const viewTabs = useMemo(() => [
    {
      id: 'active',
      label: copy.tabActiveExpenses,
      icon: Receipt,
      count: activeExpenses.length,
      activeGradient: 'bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 text-white shadow-lg shadow-rose-500/30 border border-rose-400/40',
      activeColor: 'text-rose-500'
    },
    {
      id: 'archived',
      label: copy.tabArchivedExpenses,
      icon: Archive,
      count: archivedExpenses.length,
      activeGradient: 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/30 border border-amber-400/40',
      activeColor: 'text-amber-500'
    },
    {
      id: 'trash',
      label: copy.tabTrashExpenses,
      icon: Trash2,
      count: trashExpenses.length,
      activeGradient: 'bg-gradient-to-r from-rose-600 via-red-600 to-red-700 text-white shadow-lg shadow-rose-600/30 border border-rose-400/40',
      activeColor: 'text-rose-500'
    }
  ], [t, language, activeExpenses.length, archivedExpenses.length, trashExpenses.length]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const currentYearMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);

    return currentTabExpenses.filter((exp) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (exp.title || '').toLowerCase().includes(query);
        const descMatch = (exp.description || '').toLowerCase().includes(query);
        const personMatch = (exp.personName || workerMap.get(exp.personId) || '').toLowerCase().includes(query);
        const catInfo = getCategoryHierarchy(exp.categoryId);
        const catMatch = (catInfo.main + ' ' + catInfo.sub + ' ' + catInfo.item).toLowerCase().includes(query);

        if (!titleMatch && !descMatch && !personMatch && !catMatch) return false;
      }

      // 2. Date Range
      if (dateRangeFilter === 'this_month') {
        if (!exp.expenseDate?.startsWith(currentYearMonth)) return false;
      } else if (dateRangeFilter === 'last_month') {
        if (!exp.expenseDate?.startsWith(lastMonthStr)) return false;
      }

      // 3. Section
      if (selectedSection !== 'all') {
        if (selectedSection === 'unassigned') {
          if (exp.sectionId) return false;
        } else if (exp.sectionId !== selectedSection) {
          return false;
        }
      }

      // 4. Category
      if (selectedCategory !== 'all') {
        const cat = categoryMap.get(exp.categoryId);
        if (!cat) return false;
        if (cat.id !== selectedCategory && cat.parentId !== selectedCategory) {
          const parentSub = categoryMap.get(cat.parentId);
          if (!parentSub || parentSub.parentId !== selectedCategory) return false;
        }
      }

      // 5. Person
      if (selectedPerson !== 'all') {
        if (exp.personId !== selectedPerson) return false;
      }

      // 6. Payment Status
      if (selectedStatus !== 'all' && exp.paymentStatus !== selectedStatus) {
        return false;
      }

      // 7. Payment Method
      if (selectedMethod !== 'all' && exp.paymentMethod !== selectedMethod) {
        return false;
      }

      // 8. Approval Status (Two-Stage Verification)
      if (selectedApprovalStatus !== 'all') {
        const itemStatus = exp.status || 'draft';
        if (itemStatus !== selectedApprovalStatus) return false;
      }

      return true;
    });
  }, [
    currentTabExpenses,
    searchQuery,
    dateRangeFilter,
    selectedSection,
    selectedCategory,
    selectedPerson,
    selectedStatus,
    selectedMethod,
    selectedApprovalStatus,
    categoryMap,
    workerMap
  ]);

  // KPI Calculations (based on active expenses)
  const stats = useMemo(() => {
    let totalAll = 0;
    let totalThisMonth = 0;
    let totalPaid = 0;
    let totalPending = 0;
    const sectionExpensesMap = {};

    const currentYearMonth = new Date().toISOString().slice(0, 7);

    activeExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalAll += amt;

      if (exp.expenseDate?.startsWith(currentYearMonth)) {
        totalThisMonth += amt;
      }

      if (exp.paymentStatus === 'paid') {
        totalPaid += amt;
      } else {
        totalPending += amt;
      }

      // Section accumulation
      const secKey = exp.sectionId || 'unassigned';
      sectionExpensesMap[secKey] = (sectionExpensesMap[secKey] || 0) + amt;
    });

    // Determine top spending section
    let topSectionName = copy.noSpecificSection;
    let topSectionAmount = 0;

    Object.entries(sectionExpensesMap).forEach(([secId, amt]) => {
      if (amt > topSectionAmount) {
        topSectionAmount = amt;
        topSectionName = secId === 'unassigned' 
          ? copy.generalProjectExpense 
          : (sectionMap.get(secId) || copy.projectSectionDefault);
      }
    });

    const topSectionPercent = totalAll > 0 ? Math.round((topSectionAmount / totalAll) * 100) : 0;

    return {
      totalAll,
      totalThisMonth,
      totalPaid,
      totalPending,
      count: activeExpenses.length,
      topSectionName,
      topSectionAmount,
      topSectionPercent
    };
  }, [activeExpenses, sectionMap, language]);

  // Actions
  const handleApproveExpense = async (exp) => {
    if (!canApprove) {
      alert(copy.alertAdminOnlyApprove);
      return;
    }
    try {
      setApprovingExpenseId(exp.id);
      await approveRecord('expenses', exp.id);
      setToastMsg(copy.toastExpenseApproved);
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error('Approve expense error:', err);
      alert(err.message || copy.errorApproval);
    } finally {
      setApprovingExpenseId(null);
    }
  };

  const handleEdit = (exp) => {
    if (!canModifyRecord(exp)) {
      alert(copy.alertApprovedCannotEdit);
      return;
    }
    setEditingExpense(exp);
    setIsAddModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    if (!canModifyRecord(expenseToDelete)) {
      alert(copy.alertApprovedCannotDelete);
      setExpenseToDelete(null);
      return;
    }
    try {
      await softDeleteExpenseLive(expenseToDelete.id);
      setToastMsg(copy.toastMovedToTrash);
      setTimeout(() => setToastMsg(''), 3000);
      setExpenseToDelete(null);
    } catch (err) {
      console.error('Delete expense error:', err);
    }
  };

  const handleRestore = async (expId) => {
    try {
      await restoreExpenseLive(expId);
      setToastMsg(copy.toastRestoredSingle);
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error('Restore expense error:', err);
    }
  };

  const handleArchive = async (expId, isArchived = true) => {
    const targetExp = expenses.find(e => e.id === expId);
    if (targetExp && !canModifyRecord(targetExp)) {
      alert(copy.alertApprovedCannotChange);
      return;
    }
    try {
      await archiveExpenseLive(expId, isArchived);
      setToastMsg(isArchived ? copy.toastArchived : copy.toastUnarchived);
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error('Archive expense error:', err);
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToPermanentDelete) return;
    if (itemToPermanentDelete.status === 'approved' || itemToPermanentDelete.approval_status === 'approved') {
      alert(copy.alertApprovedCannotDelete);
      setItemToPermanentDelete(null);
      return;
    }
    try {
      await permanentDeleteExpenseLive(itemToPermanentDelete.id);

      logAuditAction({
        actionType: 'DELETE_EXPENSE',
        entityType: 'expenses',
        entityId: itemToPermanentDelete.id,
        projectId: itemToPermanentDelete.projectId || currentProject?.id,
        details: {
          description: copy.auditPermanentDelete(itemToPermanentDelete.title),
          amount: itemToPermanentDelete.amount
        }
      });

      setItemToPermanentDelete(null);
      setToastMsg(copy.toastPermanentlyDeleted);
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error('Permanent delete error:', err);
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      alert(copy.alertNoExpensesToExport);
      return;
    }

    const rows = filteredExpenses.map((exp, idx) => {
      const catInfo = getCategoryHierarchy(exp.categoryId);
      const person = exp.personName || workerMap.get(exp.personId) || '-';
      const section = sectionMap.get(exp.sectionId) || copy.generalExpense;
      const statusLabel = exp.paymentStatus === 'paid' ? copy.statusPaid : copy.statusPending;
      const methodLabel = exp.paymentMethod === 'cash' ? copy.methodCashBox : exp.paymentMethod === 'bank' ? copy.methodBank : copy.methodPettyCash;

      return {
        '#': idx + 1,
        [copy.excelDate]: exp.expenseDate || '',
        [copy.excelTitle]: exp.title || '',
        [copy.excelMainGroup]: catInfo.main,
        [copy.excelSubGroup]: catInfo.sub,
        [copy.excelItem]: catInfo.item,
        [copy.excelAmount]: Number(exp.amount) || 0,
        [copy.excelCurrency]: exp.currency || currency,
        [copy.excelCounterparty]: person,
        [copy.excelSection]: section,
        [copy.excelStatus]: statusLabel,
        [copy.excelMethod]: methodLabel,
        [copy.excelHasReceipt]: exp.receiptUrl ? copy.yes : copy.no,
        [copy.excelNotes]: exp.description || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
    const fileName = `KarSync_Expenses_${currentProject?.name || 'Project'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div dir={direction} className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Top Header Card (Liquid Glass Capsule) */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/30 transition-all duration-300">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-rose-500/10 dark:bg-rose-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 flex-shrink-0">
              <Receipt className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  {copy.pageTitle}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  {stats.count} {copy.unitInvoices}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {currentProject?.name} • {copy.pageSubtitle}
              </p>
            </div>
          </div>

          {/* Actions Dock: Archive & Trash | Analytics & Export | Add New Expense */}
          <div className="h-[52px] sm:h-[56px] flex items-center gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner self-start sm:self-center">
            {/* Button 1: Trash & Archive */}
            <button
              type="button"
              onClick={() => setIsRecycleBinModalOpen(true)}
              className="relative h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 group flex items-center justify-center cursor-pointer"
              title={copy.archiveAndTrashTooltip}
            >
              <Archive className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {(trashExpenses.length > 0 || archivedExpenses.length > 0) && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono bg-rose-500 text-white font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 leading-none shadow-xs">
                  {trashExpenses.length + archivedExpenses.length}
                </span>
              )}
            </button>

            {/* Button 2: Analytics & Export */}
            <button
              type="button"
              onClick={() => setIsAnalyticsModalOpen(true)}
              className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 group flex items-center justify-center cursor-pointer"
              title={copy.analyticsAndExportTooltip}
            >
              <BarChart3 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>

            {/* Button 3: Add New Expense */}
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setIsAddModalOpen(true);
              }}
              className="h-full px-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/25 active:scale-95 transition-all cursor-pointer"
              title={copy.newExpenseTooltip}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">{copy.newExpense}</span>
            </button>
          </div>
        </div>
      </div>

      {/* EXECUTIVE HERO BANNER: EXPENSES COMMAND CENTER */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Main Total Expense Metric */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider">
              <Wallet className="w-4 h-4" />
              <span>{copy.pulseTitle}</span>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2">
                <span>{formatCurrency(stats.totalAll)}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {copy.totalExpensesDesc}
              </p>
            </div>

            {/* Settled vs Pending Progress Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {copy.clearedPaid} {formatCurrency(stats.totalPaid)}
                </span>
                <span className="text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {copy.pendingCredit} {formatCurrency(stats.totalPending)}
                </span>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-rose-400 transition-all duration-700 shadow-md"
                  style={{ width: `${stats.totalAll > 0 ? (stats.totalPaid / stats.totalAll) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>
                  {stats.totalAll > 0 ? Math.round((stats.totalPaid / stats.totalAll) * 100) : 0}% {copy.clearedPercent}
                </span>
                <span>
                  {copy.thisMonthExpenses} {formatCurrency(stats.totalThisMonth)}
                </span>
              </div>
            </div>
          </div>

          {/* Top Section & Quick Action Dock */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            
            {/* Tile 1: Top Spending Section */}
            <div className="col-span-2 p-3.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[11px] text-slate-400 block">{copy.topSpendingSection}</span>
              <div className="text-base font-black text-white mt-1 truncate">
                {stats.topSectionName}
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="font-mono text-rose-400 font-bold">{formatCurrency(stats.topSectionAmount)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono">
                  {stats.topSectionPercent}% {copy.shareOfTotal}
                </span>
              </div>
            </div>

            {/* Quick Action 1: Add Expense */}
            <button
              onClick={() => {
                setEditingExpense(null);
                setIsAddModalOpen(true);
              }}
              className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all duration-300 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{copy.recordInvoice}</span>
            </button>

            {/* Quick Action 2: Export Excel */}
            <button
              onClick={handleExportExcel}
              className="col-span-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all duration-300 cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{copy.excelExport}</span>
            </button>

          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* View Segmented Tabs: Active | Archived | Trash (Apple Liquid Glass Dock with dynamic label expand & large icons) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav 
          aria-label="Expense views"
          className="flex items-center gap-1.5 sm:gap-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl backdrop-saturate-200 p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-white/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_4px_20px_rgba(0,0,0,0.4)] w-fit"
        >
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentViewTab === tab.id;
            return (
              <div key={tab.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setCurrentViewTab(tab.id)}
                  aria-label={tab.label}
                  className={`relative rounded-xl sm:rounded-2xl transition-all duration-300 ease-out flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                    isActive
                      ? `${tab.activeGradient} px-4 py-2.5 sm:px-5 sm:py-2.5 gap-2.5 scale-[1.02]`
                      : 'p-2.5 sm:p-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className={`w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2] transition-transform duration-200 ${
                    isActive ? 'scale-105' : 'group-hover:scale-110'
                  }`} />

                  {/* Smooth text label & badge visible ONLY on active tab */}
                  {isActive && (
                    <div className="flex items-center gap-2 overflow-hidden animate-in fade-in slide-in-from-start-2 duration-200">
                      <span className="text-xs sm:text-sm font-black whitespace-nowrap tracking-tight">
                        {tab.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-black bg-white/25 dark:bg-black/20 text-white backdrop-blur-xs shadow-xs leading-none">
                        {tab.count}
                      </span>
                    </div>
                  )}

                  {/* Inactive count badge pill on top corner */}
                  {!isActive && tab.count > 0 && (
                    <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold bg-slate-200/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-300 flex items-center justify-center leading-none shadow-xs border border-white dark:border-slate-800">
                      {tab.count}
                    </span>
                  )}

                  {/* Active dot indicator */}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-xs"></span>
                  )}
                </button>

                {/* Micro-Tooltip (Hover when not active) */}
                {!isActive && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-md text-white text-[11px] font-bold rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    <span>{tab.label}</span>
                    <span className="ms-1.5 font-mono opacity-80 font-normal">({tab.count})</span>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-solid border-t-slate-900/90 dark:border-t-slate-800/95 border-t-4 border-x-transparent border-x-4 border-b-0" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Batch Actions when viewing Trash */}
        {currentViewTab === 'trash' && trashExpenses.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await restoreAllExpensesLive(trashExpenses.map(e => e.id));
                setToastMsg(copy.toastAllRestored);
                setTimeout(() => setToastMsg(''), 3000);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
              <span>{copy.restoreAll}</span>
            </button>
            <button
              onClick={async () => {
                if (confirm(copy.confirmEmptyTrash)) {
                  await emptyExpensesTrashLive(projectId);
                  setToastMsg(copy.toastTrashEmptied);
                  setTimeout(() => setToastMsg(''), 3000);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{copy.emptyTrash}</span>
            </button>
          </div>
        )}
      </div>

      {/* Contextual Notice Banner for Trash or Archive */}
      {currentViewTab === 'trash' && (
        <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-2xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
            <span>
              {copy.trashBanner}
            </span>
          </div>
        </div>
      )}

      {currentViewTab === 'archived' && (
        <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {copy.archiveBanner}
            </span>
          </div>
        </div>
      )}

      {/* Advanced Filter & Search Bar (Liquid Glass Dock) */}
      <div className="relative overflow-hidden rounded-3xl p-4 sm:p-5 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/20 space-y-3.5 transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              className={`w-full py-2.5 text-xs sm:text-sm bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all ${
                isRtl ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${isRtl ? 'left-3' : 'right-3'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Range Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shrink-0">
            <button
              onClick={() => setDateRangeFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                dateRangeFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {copy.filterAll}
            </button>
            <button
              onClick={() => setDateRangeFilter('this_month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                dateRangeFilter === 'this_month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {copy.filterThisMonth}
            </button>
            <button
              onClick={() => setDateRangeFilter('last_month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                dateRangeFilter === 'last_month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {copy.filterLastMonth}
            </button>
          </div>

          {/* Toggle More Filters */}
          <button
            onClick={() => setIsFilterPanelExpanded(!isFilterPanelExpanded)}
            className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              isFilterPanelExpanded || selectedSection !== 'all' || selectedCategory !== 'all' || selectedPerson !== 'all' || selectedStatus !== 'all' || selectedApprovalStatus !== 'all'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{copy.filtersButton}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterPanelExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded Filters Drawer */}
        {isFilterPanelExpanded && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-in fade-in duration-150">
            {/* Filter by Section */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {copy.sectionLabel}
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{copy.allSections}</option>
                <option value="unassigned">{copy.unassignedSection}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {copy.categoryLabel}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{copy.allCategories}</option>
                {categories.filter((c) => c.level === 1 || !c.parentId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Payee */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {copy.counterpartyLabel}
              </label>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{copy.allCounterparties}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Settlement Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {copy.settlementStatusLabel}
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{copy.allStatuses}</option>
                <option value="paid">{copy.statusPaid}</option>
                <option value="pending">{copy.statusPending}</option>
              </select>
            </div>

            {/* Filter by Approval Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {copy.approvalStatusLabel}
              </label>
              <select
                value={selectedApprovalStatus}
                onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{copy.allApprovals}</option>
                <option value="approved">{copy.statusApproved}</option>
                <option value="draft">{copy.statusDraft}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Expenses List View */}
      {filteredExpenses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Receipt className="w-8 h-8 opacity-40" />
          </div>
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            {copy.noExpensesFound}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {expenses.length === 0 ? copy.emptyHintActive : copy.emptyHintFilters}
          </p>
          {expenses.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDateRangeFilter('all');
                setSelectedSection('all');
                setSelectedCategory('all');
                setSelectedPerson('all');
                setSelectedStatus('all');
                setSelectedApprovalStatus('all');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200"
            >
              {copy.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (Liquid Glass Canvas) */}
          <div className="hidden md:block relative overflow-hidden rounded-3xl border border-white/60 dark:border-white/10 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden transition-all duration-300">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold">
                    <th className="py-3.5 px-4 text-start">{copy.colDate}</th>
                    <th className="py-3.5 px-4 text-start">{copy.colTitle}</th>
                    <th className="py-3.5 px-4 text-start">{copy.colCategory}</th>
                    <th className="py-3.5 px-4 text-start">{copy.colCounterparty}</th>
                    <th className="py-3.5 px-4 text-start">{copy.colSection}</th>
                    <th className="py-3.5 px-4 text-start">{copy.colAmount}</th>
                    <th className="py-3.5 px-4 text-start">{copy.colSettlementStatus}</th>
                    <th className="py-3.5 px-4 text-start">{copy.colApprovalStatus}</th>
                    <th className="py-3.5 px-4 text-center">{copy.colReceipt}</th>
                    <th className="py-3.5 px-4 text-end">{copy.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredExpenses.map((exp) => {
                    const catInfo = getCategoryHierarchy(exp.categoryId);
                    const payee = exp.personName || workerMap.get(exp.personId) || '—';
                    const sectionName = sectionMap.get(exp.sectionId) || copy.general;
                    const isPaid = exp.paymentStatus === 'paid';

                    return (
                      <tr 
                        key={exp.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Date */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {exp.expenseDate}
                        </td>

                        {/* Title & Notes */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                            {exp.title}
                          </p>
                          {exp.description && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-xs mt-0.5">
                              {exp.description}
                            </p>
                          )}
                        </td>

                        {/* Hierarchical Category Badge */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {catInfo.item || catInfo.sub || catInfo.main}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {catInfo.main} {catInfo.sub ? `› ${catInfo.sub}` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Payee / Person */}
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {payee}
                        </td>

                        {/* Section */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {sectionName}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4">
                          <span className="font-black font-mono text-sm tracking-tight text-slate-900 dark:text-white">
                            {formatCurrency(exp.amount, exp.currency)}
                          </span>
                        </td>

                        {/* Settlement Status */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50'
                          }`}>
                            {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            <span>{isPaid ? copy.paidBadge : copy.pendingBadge}</span>
                          </span>
                        </td>

                        {/* Verification Status (Draft vs Approved) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <VerificationBadge
                            status={exp.status}
                            approvedBy={exp.approvedBy}
                            approvedAt={exp.approvedAt}
                            showDetails={true}
                          />
                        </td>

                        {/* Receipt Thumbnail / Eye */}
                        <td className="py-3.5 px-4 text-center">
                          {exp.receiptUrl ? (
                            <button
                              onClick={() => setPreviewReceiptUrl(exp.receiptUrl)}
                              className="relative group p-1 inline-flex rounded-lg hover:ring-2 hover:ring-rose-400 transition-all"
                              title={copy.viewReceiptTooltip}
                            >
                              <img
                                src={exp.receiptUrl}
                                alt="Receipt"
                                className="w-8 h-8 object-cover rounded-md border border-slate-200 dark:border-slate-700 shadow-xs"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            {currentViewTab === 'trash' ? (
                              <>
                                <button
                                  onClick={() => handleRestore(exp.id)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs"
                                  title={copy.restoreTooltip}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  <span className="hidden xl:inline">{copy.restoreAction}</span>
                                </button>
                                {exp.status !== 'approved' && exp.approval_status !== 'approved' && (
                                  <button
                                    onClick={() => setItemToPermanentDelete(exp)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                    title={copy.permanentDeleteTooltip}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            ) : currentViewTab === 'archived' ? (
                              <>
                                <button
                                  onClick={() => handleArchive(exp.id, false)}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs"
                                  title={copy.unarchiveTooltip}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  <span className="hidden xl:inline">{copy.unarchiveAction}</span>
                                </button>
                                {exp.status !== 'approved' && exp.approval_status !== 'approved' && (
                                  <button
                                    onClick={() => setExpenseToDelete(exp)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                    title={copy.moveToTrashTooltip}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Two-Stage Approval: Approve button for Admin on drafts */}
                                {exp.status !== 'approved' && canApprove && (
                                  <button
                                    onClick={() => handleApproveExpense(exp)}
                                    disabled={approvingExpenseId === exp.id}
                                    className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all flex items-center gap-1 font-bold text-xs shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                                    title={copy.finalApproveTooltip}
                                  >
                                    {approvingExpenseId === exp.id ? (
                                      <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    )}
                                    <span className="hidden xl:inline">{copy.finalApproveAction}</span>
                                  </button>
                                )}

                                {/* If Approved: Document is Locked */}
                                {exp.status === 'approved' ? (
                                  <div 
                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl flex items-center gap-1.5 text-xs font-semibold border border-slate-200/60 dark:border-slate-700/60"
                                    title={copy.documentLockedTitle}
                                  >
                                    <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                      {copy.lockedDocument}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleArchive(exp.id, true)}
                                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors"
                                      title={copy.archiveTooltip}
                                    >
                                      <Archive className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleEdit(exp)}
                                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-xl transition-colors"
                                      title={copy.edit}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setExpenseToDelete(exp)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                      title={copy.moveToTrashTooltip}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden space-y-3">
            {filteredExpenses.map((exp) => {
              const catInfo = getCategoryHierarchy(exp.categoryId);
              const payee = exp.personName || workerMap.get(exp.personId);
              const sectionName = sectionMap.get(exp.sectionId) || copy.general;
              const isPaid = exp.paymentStatus === 'paid';

              return (
                <div
                  key={exp.id}
                  className="p-4.5 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 rounded-3xl border border-white/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-black/20 space-y-3 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                          {exp.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span>{exp.expenseDate}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {catInfo.item || catInfo.sub || catInfo.main}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-end flex flex-col items-end gap-1">
                      <div className="font-black font-mono text-base text-slate-900 dark:text-white">
                        {formatCurrency(exp.amount, exp.currency)}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          isPaid 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                        }`}>
                          {isPaid ? copy.paidShort : copy.pendingShort}
                        </span>
                        <VerificationBadge status={exp.status} approvedBy={exp.approvedBy} approvedAt={exp.approvedAt} />
                      </div>
                    </div>
                  </div>

                  {exp.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                      {exp.description}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg font-medium">
                        {sectionName}
                      </span>
                      {payee && (
                        <span>{copy.toPayee} {payee}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {exp.receiptUrl && (
                        <button
                          onClick={() => setPreviewReceiptUrl(exp.receiptUrl)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg"
                          title={copy.viewReceiptTooltip}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {currentViewTab === 'trash' ? (
                        <>
                          <button
                            onClick={() => handleRestore(exp.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg flex items-center gap-1 font-bold text-xs"
                            title={copy.restoreTooltip}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>{copy.restoreAction}</span>
                          </button>
                          {exp.status !== 'approved' && exp.approval_status !== 'approved' && (
                            <button
                              onClick={() => setItemToPermanentDelete(exp)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                              title={copy.permanentDeleteTooltip}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : currentViewTab === 'archived' ? (
                        <>
                          <button
                            onClick={() => handleArchive(exp.id, false)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg flex items-center gap-1 font-bold text-xs"
                            title={copy.unarchiveTooltip}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>{copy.unarchiveAction}</span>
                          </button>
                          {exp.status !== 'approved' && exp.approval_status !== 'approved' && (
                            <button
                              onClick={() => setExpenseToDelete(exp)}
                              className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg"
                              title={copy.moveToTrashTooltip}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Final Approval for Admin */}
                          {exp.status !== 'approved' && canApprove && (
                            <button
                              onClick={() => handleApproveExpense(exp)}
                              disabled={approvingExpenseId === exp.id}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-1 font-bold text-[11px] shadow-xs cursor-pointer disabled:opacity-50"
                              title={copy.finalApproveTooltip}
                            >
                              {approvingExpenseId === exp.id ? (
                                <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>{copy.finalApproveAction}</span>
                            </button>
                          )}

                          {/* Locked Badge if approved */}
                          {exp.status === 'approved' ? (
                            <div 
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg flex items-center gap-1 text-[11px] font-medium"
                              title={copy.documentLockedTitle}
                            >
                              <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                {copy.lockedDocument}
                              </span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleArchive(exp.id, true)}
                                className="p-1.5 text-slate-500 hover:text-amber-500 rounded-lg"
                                title={copy.archiveTooltip}
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(exp)}
                                className="p-1.5 text-slate-500 hover:text-sky-500 rounded-lg"
                                title={copy.edit}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setExpenseToDelete(exp)}
                                className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg"
                                title={copy.moveToTrashTooltip}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Expense Modal */}
      {isAddModalOpen && (
        <AddExpenseModal
          isOpen={isAddModalOpen}
          expenseToEdit={editingExpense}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Receipt Image Preview Lightbox */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-3xl w-full max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center p-3 border border-slate-800">
            <button
              onClick={() => setPreviewReceiptUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewReceiptUrl}
              alt="Receipt preview"
              className="max-h-[80vh] w-auto object-contain rounded-2xl"
            />
            <div className="w-full pt-3 px-3 flex items-center justify-between text-xs text-slate-400">
              <span>{copy.receiptAttachedImage}</span>
              <a
                href={previewReceiptUrl}
                target="_blank"
                rel="noreferrer"
                download="invoice_receipt.jpg"
                className="text-rose-400 hover:underline flex items-center gap-1 font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{copy.openInNewTab}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            dir={direction}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {copy.moveToTrashDialogTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {copy.moveToTrashDialogDesc(expenseToDelete.title)}
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-md shadow-rose-600/30"
              >
                {copy.moveToTrashConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Dialog */}
      {itemToPermanentDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            dir={direction}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {copy.permanentDeleteDialogTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {copy.permanentDeleteDialogDesc(itemToPermanentDelete.title)}
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToPermanentDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-md shadow-rose-600/30"
              >
                {copy.permanentDeleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Expense Recycle Bin & Archive Modal */}
      {isRecycleBinModalOpen && (
        <ExpenseRecycleBinModal
          isOpen={isRecycleBinModalOpen}
          onClose={() => setIsRecycleBinModalOpen(false)}
        />
      )}

      {/* Fullscreen Expense Analytics & Custom Reporting Modal */}
      {isAnalyticsModalOpen && (
        <ExpenseAnalyticsModal
          isOpen={isAnalyticsModalOpen}
          onClose={() => setIsAnalyticsModalOpen(false)}
        />
      )}

    </div>
  );
}
