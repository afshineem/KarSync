import React, { useState, useMemo } from 'react';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { AddEditAccountModal } from './AddEditAccountModal';
import { 
  CreditCard, 
  Coins, 
  Plus, 
  Star, 
  Edit2, 
  Trash2, 
  Check, 
  Building2, 
  User, 
  Landmark, 
  AlertTriangle,
  Layers,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Ban,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight
} from 'lucide-react';
import { migrateClosedTransactionsToCashBox } from '../../db/db';
import { pushPaymentsLive, pushAllExpensesToCloud } from '../../services/realtimeSync';

/**
 * AccountsSettingsTab
 * تب مدیریت حساب‌های بانکی و صندوق‌های نقدی
 * قابل استفاده هم در پنجره تنظیمات سراسری (GlobalSettingsModal) و هم در تب حسابداری
 */
// Scoped dictionary for AccountsSettingsTab
const COPY = {
  fa: {
    blockedCoreTitle: 'صندوق نقدی اصلی سیستم غیرقابل حذف است',
    blockedCoreMsg: 'این صندوق یا کارت بانکی، حساب اصلی و پایه‌ای سیستم KarSync است و برای ثبت تمامی تسویه‌ها، تنخواه‌ها و مخارج نقدی کارگاه مورد نیاز است.',
    blockedDefaultTitle: 'حساب پیش‌فرض سیستم غیرقابل حذف است',
    blockedDefaultMsg: 'این حساب در حال حاضر به عنوان حساب پیش‌فرض سیستم تعیین شده است. برای حذف آن، ابتدا باید حساب دیگری را از لیست به عنوان پیش‌فرض فعال فرمایید (و این حساب باید فاقد گردش مالی باشد).',
    blockedLastTitle: (type) => `امکان حذف تنها ${type === 'cash' ? 'صندوق نقدی' : 'حساب بانکی'} وجود ندارد`,
    blockedLastMsg: (type) => `سیستم همواره به حداقل یک ${type === 'cash' ? 'صندوق نقدی' : 'حساب بانکی'} فعال برای ثبت اسناد مالی نیاز دارد.`,
    blockedTxTitle: 'امکان حذف حساب دارای گردش مالی و سند وجود ندارد',
    blockedTxMsg: (cnt) => `این حساب در حال حاضر دارای ${cnt} تراکنش و سند مالی ثبت‌شده (تسویه حساب پرسنل، مساعده، فاکتور هزینه، واریزی یا انتقال وجه) می‌باشد و برای حفظ تعادل دفاتر کل و سوابق مالی، غیرقابل حذف است.`,
    blockedBalanceMsg: 'این حساب دارای مانده موجودی غیرصفر می‌باشد. پیش از حذف، باید مانده حساب از طریق انتقال وجه تسویه و صفر گردد.',
    sectionTitle: 'مدیریت کارت‌های بانکی و صندوق‌های نقدی',
    sectionSubtitle: 'تعریف، سرفصل‌بندی و کنترل مانده حساب‌های مالی پروژه کارگاه',
    btnAddAccount: 'افزودن حساب جدید',
    tipAddAccount: 'افزودن حساب / کارت جدید',
    tabAll: 'همه حساب‌ها',
    tabBank: 'کارت‌های بانکی',
    tabCash: 'صندوق‌های نقدی',
    lblOverdraftPolicy: 'سیاست کسری:',
    optAskEachTime: '⚠️ هر بار پرسش (پیش‌فرض)',
    optAlwaysAllow: '✅ همیشه مجاز (تراز منفی)',
    optBlockOverdraft: '⛔ ممانعت از کسری',
    emptyTitle: 'هیچ حسابی در این دسته یافت نشد',
    emptySubtitle: 'جهت تسریع در ثبت مخارج و تفکیک جریان نقدینگی، کارت یا صندوق جدیدی اضافه کنید.',
    btnDefineAccount: 'تعریف حساب جدید',
    fallbackBank: 'کارت بانکی',
    fallbackCash: 'صندوق نقدی',
    badgeMainDefault: 'پیش‌فرض اصلی',
    btnSetDefault: 'تنظیم پیش‌فرض',
    tipSetDefault: 'کلیک جهت انتخاب به عنوان حساب پیش‌فرض',
    lblLiveBalance: 'موجودی زنده',
    lblInflow: 'ورودی',
    lblOutflow: 'خروجی',
    badgeDefaultShort: 'پیش‌فرض',
    tipDeposit: 'افزایش موجودی این حساب',
    tipTransfer: 'انتقال وجه از این حساب',
    tipEdit: 'ویرایش مشخصات حساب',
    tipCoreSystem: 'صندوق نقدی اصلی سیستم (غیرقابل حذف)',
    tipDefaultSystem: 'حساب پیش‌فرض سیستم (غیرقابل حذف)',
    tipHasTx: (tx) => `حساب دارای ${tx} گردش مالی و سند (غیرقابل حذف)`,
    tipDelete: 'حذف حساب',
    legacySyncTitle: 'ابزار همگام‌سازی تراکنش‌های قدیمی',
    legacySyncDesc: 'ثبت تسویه‌ها و فاکتورهای فاقد حساب از محل صندوق کارگاه',
    applying: 'در حال اعمال...',
    applyCashMigration: 'بروزرسانی از محل صندوق',
    confirmDeleteTitle: 'آیا از حذف این حساب مطمئن هستید؟',
    cancel: 'انصراف',
    confirmDeleteBtn: 'حذف قطعی',
    blockedDefaultModalTitle: 'امکان حذف این حساب وجود ندارد',
    blockedDefaultModalMsg: 'این حساب به دلیل وابستگی‌های پایگاه داده یا گردش مالی فعال، امکان حذف ندارد.',
    lblCurrentBalance: 'موجودی فعلی حساب:',
    understood: 'متوجه شدم',
    migrationSuccess: (p, e) => `عملیات با موفقیت انجام شد: ${p} پرداختی پرسنل و ${e} هزینه فاکتور از محل صندوق نقدی کارگاه ثبت و پرداخت شدند.`,
    errMigration: 'خطا در اعمال عملیات',
    errDeleteAccount: 'خطا در حذف حساب',
    subHeaderDesc: 'تعریف حساب‌های بانکی، صندوق‌ها و تعیین حساب پیش‌فرض برای پرداخت‌ها و واریزی‌ها',
    lblKeeper: (name) => `مسئول: ${name}`,
    lblHolder: (name) => `دارنده: ${name}`,
    lblActiveAccount: 'حساب فعال کارگاه',
    badgeActiveDefault: 'پیش‌فرض فعال',
    blockedTxStandardsMsg: 'طبق استانداردهای مالی و برای حفظ تعادل دفاتر کل، حسابی که سند خورده است و در تسویه‌ها مورد استفاده قرار گرفته، غیرقابل حذف می‌باشد. در صورت نیاز می‌توانید اطلاعات آن را ویرایش نمایید.',
  },
  ku: {
    blockedCoreTitle: 'سڕینەوەی سندووقی سەرەکی ڕێگەپێنەدراوە',
    blockedCoreMsg: 'ئەم حیسابە بنەڕەتییە و بۆ تۆمارکردنی تەسویە، تەنخوا و خەرجییەکان پێویستە.',
    blockedDefaultTitle: 'حیسابی سەرەکی ناسڕدرێتەوە',
    blockedDefaultMsg: 'ئەم حیسابە وەک بنەڕەتی دیاریکراوە. سەرەتا حیسابێکی تر بکە بە بنەڕەتی.',
    blockedLastTitle: (type) => `سڕینەوەی تەنها ${type === 'cash' ? 'سندوقی کاش' : 'حیسابی بانک'} ڕێگەپێنەدراوە`,
    blockedLastMsg: (type) => `سیستەم پێویستی بە لانیکەم یەک ${type === 'cash' ? 'سندوقی کاش' : 'حیسابی بانک'}ی چالاکە بۆ تۆمارکردن.`,
    blockedTxTitle: 'حیسابی خاوەن دارایی و مامەڵە ناسڕدرێتەوە',
    blockedTxMsg: (cnt) => `ئەم حیسابە خاوەنی ${cnt} مامەڵە و بەڵگەنامەی تۆمارکراوە و بۆ پاراستنی هاوسەنگی دارایی ناسڕدرێتەوە.`,
    blockedBalanceMsg: 'باڵانسی ئەم حیسابە سفر نییە. پێش سڕینەوە، دەبێت باڵانسەکەی بگوازرێتەوە و سفر بکرێتەوە.',
    sectionTitle: 'بەڕێوەبردنی کارتی بانکی و سندوقەکان',
    sectionSubtitle: 'پێناسەکردن و کۆنترۆڵی باڵانسی حیسابە دارایییەکان',
    btnAddAccount: 'حیسابی نوێ',
    tipAddAccount: 'زیادکردنی حیسابی نوێ',
    tabAll: 'هەموو',
    tabBank: 'کارتەکان',
    tabCash: 'سندوقەکان',
    lblOverdraftPolicy: 'سیاسەت:',
    optAskEachTime: '⚠️ پرسیار لە هەر جار (بنەڕەتی)',
    optAlwaysAllow: '✅ هەمیشە ڕێگەپێدراو (ترازی نێگەتیڤ)',
    optBlockOverdraft: '⛔ هەمیشە قەدەغە',
    emptyTitle: 'هیچ حیسابێک نەدۆزرایەوە',
    emptySubtitle: 'بۆ خێراکردنی تۆمارکردنی خەرجییەکان، حیسابێکی نوێ زیاد بکە.',
    btnDefineAccount: 'زیادکردنی حیساب',
    fallbackBank: 'کارتی بانکی',
    fallbackCash: 'سندوقی کاش',
    badgeMainDefault: 'سەرەکی',
    btnSetDefault: 'سەرەکی',
    tipSetDefault: 'کلیک بکە بۆ دیاریکردن وەک بنەڕەتی',
    lblLiveBalance: 'باڵانسی ڕاستەوخۆ',
    lblInflow: 'هاتوو',
    lblOutflow: 'ڕۆیشتوو',
    badgeDefaultShort: 'سەرەکی',
    tipDeposit: 'زیادکردنی بودجەی ئەم حیسابە',
    tipTransfer: 'گواستنەوەی پارە لەم حیسابە',
    tipEdit: 'دەستکاریکردنی حیساب',
    tipCoreSystem: 'سندووقی سەرەکی سیستم (ناسڕدرێتەوە)',
    tipDefaultSystem: 'حیسابی سەرەکی سیستم (ناسڕدرێتەوە)',
    tipHasTx: (tx) => `خاوەن ${tx} تۆماری دارایی (ناسڕدرێتەوە)`,
    tipDelete: 'سڕینەوەی حیساب',
    legacySyncTitle: 'هاوکاتکردنی مامەڵە کۆنەکان',
    legacySyncDesc: 'تۆماری تەسویەکانی پێشوو لە سندوق',
    applying: 'جێبەجێکردن...',
    applyCashMigration: 'هاوکاتکردن',
    confirmDeleteTitle: 'دڵنیایت لە سڕینەوەی ئەم حیسابە؟',
    cancel: 'پاشگەزبوونەوە',
    confirmDeleteBtn: 'سڕینەوەی تەواو',
    blockedDefaultModalTitle: 'سڕینەوەی ئەم حیسابە ڕێگەپێنەدراوە',
    blockedDefaultModalMsg: 'ئەم حیسابە بەهۆی پەیوەندییە دارایییەکانەوە ناسڕدرێتەوە.',
    lblCurrentBalance: 'باڵانسی ئێستای حیساب:',
    understood: 'تێگەیشتم',
    migrationSuccess: (p, e) => `کردارەکە سەرکەوتوو بوو: ${p} پارەدانی کرێکاران و ${e} فاکتەری خەرجی لە سندوقی کاش جێبەجێکران.`,
    errMigration: 'هەڵە لە جێبەجێکردن',
    errDeleteAccount: 'هەڵە لە سڕینەوەی حیساب',
    subHeaderDesc: 'دیاریکردنی کارتی بانکی و سندوقی تەنخوا و حیسابی سەرەکی',
    lblKeeper: (name) => `بەرپرسیار: ${name}`,
    lblHolder: (name) => `خاوەن: ${name}`,
    lblActiveAccount: 'حیسابی چالاکی کارگە',
    badgeActiveDefault: 'سەرەکی چالاک',
    blockedTxStandardsMsg: 'بۆ پاراستنی هاوسەنگی دەفتەری دارایی ناتوانرێت بسڕدرێتەوە. لە کاتی پێویست دەتوانیت دەستکاری بکەیت.',
  },
  en: {
    blockedCoreTitle: 'System core cash drawer cannot be deleted',
    blockedCoreMsg: 'This drawer or card is a foundational KarSync account required for recording settlements, petty cash, and workshop cash expenses.',
    blockedDefaultTitle: 'Default system account cannot be deleted',
    blockedDefaultMsg: 'This account is currently set as the default account. To delete it, first designate another account as default (and ensure this account has no turnover).',
    blockedLastTitle: (type) => `Cannot delete the only ${type === 'cash' ? 'cash drawer' : 'bank account'}`,
    blockedLastMsg: (type) => `The system always requires at least one active ${type === 'cash' ? 'cash drawer' : 'bank account'} to record financial documents.`,
    blockedTxTitle: 'Cannot delete account with recorded transactions and financial documents',
    blockedTxMsg: (cnt) => `This account currently contains ${cnt} recorded transactions (settlements, advances, invoices, deposits, transfers) and cannot be deleted to preserve ledger balance.`,
    blockedBalanceMsg: 'This account has a non-zero balance. Before deletion, the balance must be transferred and zeroed out.',
    sectionTitle: 'Bank Cards & Cash Drawers Management',
    sectionSubtitle: 'Definition, classification, and live balance control of project accounts',
    btnAddAccount: 'Add New Account',
    tipAddAccount: 'Add new account / card',
    tabAll: 'All Accounts',
    tabBank: 'Bank Cards',
    tabCash: 'Cash Drawers',
    lblOverdraftPolicy: 'Overdraft Policy:',
    optAskEachTime: '⚠️ Ask Each Time (Default)',
    optAlwaysAllow: '✅ Always Allow (Negative Balance)',
    optBlockOverdraft: '⛔ Block Overdraft',
    emptyTitle: 'No accounts found in this category',
    emptySubtitle: 'Add a new card or drawer to streamline expense recording and separate cash flows.',
    btnDefineAccount: 'Define New Account',
    fallbackBank: 'Bank Card',
    fallbackCash: 'Cash Drawer',
    badgeMainDefault: 'Main Default',
    btnSetDefault: 'Set Default',
    tipSetDefault: 'Click to set as default account',
    lblLiveBalance: 'Live Balance',
    lblInflow: 'Inflow',
    lblOutflow: 'Outflow',
    badgeDefaultShort: 'Default',
    tipDeposit: 'Recharge this account balance',
    tipTransfer: 'Transfer funds from this account',
    tipEdit: 'Edit account details',
    tipCoreSystem: 'System core cash box (Cannot be deleted)',
    tipDefaultSystem: 'System default account (Cannot be deleted)',
    tipHasTx: (tx) => `Account has ${tx} financial records (Cannot be deleted)`,
    tipDelete: 'Delete account',
    legacySyncTitle: 'Legacy Transactions Sync Tool',
    legacySyncDesc: 'Assign past unlinked settlements and expenses to workshop cash box',
    applying: 'Applying...',
    applyCashMigration: 'Sync from Cash Box',
    confirmDeleteTitle: 'Are you sure you want to delete this account?',
    cancel: 'Cancel',
    confirmDeleteBtn: 'Delete Permanently',
    blockedDefaultModalTitle: 'Cannot delete this account',
    blockedDefaultModalMsg: 'This account cannot be deleted due to database dependencies or active financial turnover.',
    lblCurrentBalance: 'Current Account Balance:',
    understood: 'Understood',
    migrationSuccess: (p, e) => `Migration successful: ${p} wage payments and ${e} invoice expenses were processed via the workshop cash drawer.`,
    errMigration: 'Error executing migration',
    errDeleteAccount: 'Error deleting account',
    subHeaderDesc: 'Define bank accounts, cash boxes, and set default accounts for deposits and payments',
    lblKeeper: (name) => `Keeper: ${name}`,
    lblHolder: (name) => `Holder: ${name}`,
    lblActiveAccount: 'Active Workshop Account',
    badgeActiveDefault: 'Active Default',
    blockedTxStandardsMsg: 'According to financial standards and to maintain ledger balance, an account with recorded transactions used in settlements cannot be deleted. You can edit its details if needed.',
  }
};

export function AccountsSettingsTab({
  accounts = [],
  accountBalances = null,
  globalOverdraftPolicy = 'ask_each_time',
  onUpdateGlobalOverdraftPolicy,
  onAddAccount,
  onUpdateAccount,
  onSetDefaultAccount,
  onDeleteAccount,
  onQuickDeposit = null,
  onQuickTransfer = null,
  currency = 'IQD',
  language = 'fa'
}) {
  const txt = COPY[language] || COPY.fa;
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'bank' | 'cash'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [accountBlockedFromDelete, setAccountBlockedFromDelete] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);

  const handleInitiateDelete = (account) => {
    const balData = accountBalances?.get(String(account.id));
    const txCount = balData?.transactions?.length || 0;

    // ۱. بررسی حساب‌های سیستمی اصلی
    if (account.id === 'acc_default_cash' || account.id === 'acc_default_bank') {
      setAccountBlockedFromDelete({
        account,
        reason: 'system_core',
        title: txt.blockedCoreTitle,
        message: txt.blockedCoreMsg,
        txCount,
        currentBalance: balData?.currentBalance ?? 0
      });
      return;
    }

    // ۲. بررسی حساب پیش‌فرض
    if (account.isDefault) {
      setAccountBlockedFromDelete({
        account,
        reason: 'is_default',
        title: txt.blockedDefaultTitle,
        message: txt.blockedDefaultMsg,
        txCount,
        currentBalance: balData?.currentBalance ?? 0
      });
      return;
    }

    // ۳. بررسی حداقل یک حساب از هر نوع
    const activeSameType = accounts.filter(a => a.type === account.type && !a.deletedAt && a.status !== 'deleted');
    if (activeSameType.length <= 1) {
      setAccountBlockedFromDelete({
        account,
        reason: 'last_account',
        title: txt.blockedLastTitle(account.type),
        message: txt.blockedLastMsg(account.type),
        txCount,
        currentBalance: balData?.currentBalance ?? 0
      });
      return;
    }

    // ۴. بررسی وجود هرگونه تراکنش و سند مالی
    if (txCount > 0) {
      setAccountBlockedFromDelete({
        account,
        reason: 'has_transactions',
        title: txt.blockedTxTitle,
        message: txt.blockedTxMsg(txCount),
        txCount,
        currentBalance: balData?.currentBalance ?? 0
      });
      return;
    }

    setAccountToDelete(account);
  };

  const handleMigratePastTransactions = async () => {
    try {
      setIsMigrating(true);
      const res = await migrateClosedTransactionsToCashBox(undefined, true);
      pushPaymentsLive().catch(() => {});
      pushAllExpensesToCloud().catch(() => {});
      setMigrationStatus({
        type: 'success',
        message: txt.migrationSuccess(res.updatedPaymentsCount, res.updatedExpensesCount)
      });
      setTimeout(() => setMigrationStatus(null), 6000);
    } catch (err) {
      setMigrationStatus({
        type: 'error',
        message: err.message || txt.errMigration
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    if (activeFilter === 'all') return accounts;
    return accounts.filter((a) => a.type === activeFilter);
  }, [accounts, activeFilter]);

  const bankAccountsCount = useMemo(() => accounts.filter((a) => a.type === 'bank').length, [accounts]);
  const cashAccountsCount = useMemo(() => accounts.filter((a) => a.type === 'cash').length, [accounts]);

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    try {
      await onDeleteAccount(accountToDelete.id);
      setAccountToDelete(null);
    } catch (err) {
      alert(err.message || txt.errDeleteAccount);
    }
  };

  // رنگ پس‌زمینه گرادیان کارت‌ها
  const getCardGradient = (color, type) => {
    if (type === 'cash') {
      return 'from-amber-500 to-amber-700 text-white';
    }
    switch (color) {
      case 'sky':
        return 'from-sky-500 to-sky-700 text-white';
      case 'indigo':
        return 'from-indigo-500 to-indigo-700 text-white';
      case 'emerald':
        return 'from-emerald-500 to-emerald-700 text-white';
      case 'rose':
        return 'from-rose-500 to-rose-700 text-white';
      case 'purple':
        return 'from-purple-500 to-purple-700 text-white';
      case 'slate':
      default:
        return 'from-slate-700 to-slate-900 text-white';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* هدر بخش و دکمه افزودن حساب با تم برنامه */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-sky-500" />
            <span>{txt.sectionTitle}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {txt.subHeaderDesc}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="h-10 sm:h-11 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center gap-2 transition-all duration-300 ease-in-out active:scale-95 hover:scale-105 group self-start sm:self-center focus:outline-hidden"
          title={txt.tipAddAccount}
          aria-label={txt.tipAddAccount}
        >
          <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          <span>{txt.btnAddAccount}</span>
        </button>
      </div>

      {/* پیام بازخورد عملیات انتساب */}
      {migrationStatus && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
          migrationStatus.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        }`}>
          {migrationStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <span>{migrationStatus.message}</span>
        </div>
      )}

      {/* نوار کنترل هوشمند: فیلتر حساب‌ها با تم برنامه + سیاست سراسری کسری */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
        
        {/* فیلتر تب‌ها [APP_THEME_BUTTON] */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            title={`${txt.tabAll} (${accounts.length})`}
            className={`relative flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all duration-300 ease-in-out ${
              activeFilter === 'all'
                ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/25 font-bold border border-sky-400/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />
            {activeFilter === 'all' && (
              <span className="text-xs font-bold px-1.5 whitespace-nowrap flex items-center gap-1.5 animate-in fade-in duration-200">
                <span>{txt.tabAll}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                  {accounts.length}
                </span>
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('bank')}
            title={`${txt.tabBank} (${bankAccountsCount})`}
            className={`relative flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all duration-300 ease-in-out ${
              activeFilter === 'bank'
                ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/25 font-bold border border-sky-400/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />
            {activeFilter === 'bank' && (
              <span className="text-xs font-bold px-1.5 whitespace-nowrap flex items-center gap-1.5 animate-in fade-in duration-200">
                <span>{txt.tabBank}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                  {bankAccountsCount}
                </span>
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('cash')}
            title={`${txt.tabCash} (${cashAccountsCount})`}
            className={`relative flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all duration-300 ease-in-out ${
              activeFilter === 'cash'
                ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/25 font-bold border border-sky-400/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <Coins className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />
            {activeFilter === 'cash' && (
              <span className="text-xs font-bold px-1.5 whitespace-nowrap flex items-center gap-1.5 animate-in fade-in duration-200">
                <span>{txt.tabCash}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                  {cashAccountsCount}
                </span>
              </span>
            )}
          </button>
        </div>

        {/* کنترل فشرده سیاست کسری موجودی */}
        <div className="flex items-center gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-sky-500 shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap hidden sm:inline">
            {txt.lblOverdraftPolicy}
          </span>
          <select
            value={globalOverdraftPolicy}
            onChange={(e) => onUpdateGlobalOverdraftPolicy && onUpdateGlobalOverdraftPolicy(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-xs"
          >
            <option value="ask_each_time">
              {txt.optAskEachTime}
            </option>
            <option value="always_allow">
              {txt.optAlwaysAllow}
            </option>
            <option value="never_allow">
              {txt.optBlockOverdraft}
            </option>
          </select>
        </div>
      </div>

      {/* لیست کارت‌ها و صندوق‌ها با استایل مینیمال لوکس */}
      {filteredAccounts.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center mb-3">
            <Landmark className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {txt.emptyTitle}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {txt.emptySubtitle}
          </p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{txt.btnDefineAccount}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => {
            const isBank = account.type === 'bank';
            const isDefault = Boolean(account.isDefault);
            const bal = accountBalances?.get(String(account.id));
            const currentBalance = bal ? bal.currentBalance : (Number(account.initialBalance) || 0);
            const totalInflow = bal ? bal.totalInflow : 0;
            const totalOutflow = bal ? bal.totalOutflow : 0;
            const isNegative = currentBalance < 0;

            return (
              <div
                key={account.id}
                className={`rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden relative group ${
                  isDefault
                    ? 'bg-white dark:bg-slate-900 border-sky-400/80 dark:border-sky-500/80 shadow-md shadow-sky-500/10 ring-1 ring-sky-500/30'
                    : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md'
                }`}
              >
                {/* نمای بالایی کارت (الهام از کارت‌های لوکس مینیمال تیره/روشن) */}
                <div className={`p-5 relative overflow-hidden ${
                  isBank
                    ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white'
                    : 'bg-gradient-to-br from-slate-800 via-slate-800/90 to-slate-900 text-white'
                }`}>
                  {/* خطوط ژئومتریک مینیمال پس‌زمینه */}
                  <div className="absolute top-0 right-0 w-36 h-36 bg-white/[0.03] rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />

                  {/* ردیف بالا: نوع حساب و نشان پیش‌فرض */}
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white/10 backdrop-blur-md border border-white/10">
                      {isBank ? (
                        <>
                          <CreditCard className="w-3 h-3 text-sky-400" />
                          <span>{account.bankName || txt.fallbackBank}</span>
                        </>
                      ) : (
                        <>
                          <Coins className="w-3 h-3 text-amber-400" />
                          <span>{txt.fallbackCash}</span>
                        </>
                      )}
                    </span>

                    {isDefault ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-400 text-amber-950 shadow-sm cursor-default">
                        <Star className="w-3 h-3 fill-amber-950" />
                        <span>{txt.badgeMainDefault}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetDefaultAccount(account.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 hover:bg-amber-400/20 text-slate-300 hover:text-amber-300 border border-white/10 hover:border-amber-400/40 transition-all cursor-pointer"
                        title={txt.tipSetDefault}
                      >
                        <Star className="w-3 h-3" />
                        <span>{txt.btnSetDefault}</span>
                      </button>
                    )}
                  </div>

                  {/* نام حساب و شماره کارت */}
                  <div className="mt-4 relative z-10">
                    <h4 className="font-bold text-sm sm:text-base text-white tracking-tight truncate drop-shadow-xs">
                      {account.name}
                    </h4>
                    {isBank && account.cardNumber ? (
                      <div className="font-mono text-xs tracking-widest mt-1.5 text-slate-300" dir="ltr">
                        {account.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 mt-1">
                        {account.keeperName ? txt.lblKeeper(account.keeperName) : (account.holderName ? txt.lblHolder(account.holderName) : txt.lblActiveAccount)}
                      </div>
                    )}
                  </div>

                  {/* موجودی شاخص در کارت */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between relative z-10">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {txt.lblLiveBalance}
                    </span>
                    <span className={`font-mono text-sm font-black ${
                      isNegative ? 'text-rose-400' : 'text-emerald-400'
                    }`} dir="ltr">
                      {formatAmount(currentBalance, currency)}
                    </span>
                  </div>
                </div>

                {/* پنل میانی: گردش نقدینگی حساب */}
                <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border-t border-b border-slate-100 dark:border-slate-800/80">
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                        <span>{txt.lblInflow}</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                        {formatAmount(totalInflow, currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3 text-rose-500" />
                        <span>{txt.lblOutflow}</span>
                      </span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                        {formatAmount(totalOutflow, currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* نوار اکشن‌های پایین کارت */}
                <div className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 text-xs">
                  {/* دکمه تعیین حساب به عنوان پیش‌فرض */}
                  {!isDefault ? (
                    <button
                      type="button"
                      onClick={() => onSetDefaultAccount(account.id)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>{txt.badgeDefaultShort}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1 bg-sky-50 dark:bg-sky-950/60 px-2 py-1 rounded-xl">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{txt.badgeActiveDefault}</span>
                    </span>
                  )}

                  {/* دکمه‌های ویرایش و حذف با ترنزیشن نرم */}
                  <div className="flex items-center gap-1">
                    {onQuickDeposit && (
                      <button
                        type="button"
                        onClick={() => onQuickDeposit(account)}
                        title={txt.tipDeposit}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-emerald-500" />
                      </button>
                    )}
                    {onQuickTransfer && (
                      <button
                        type="button"
                        onClick={() => onQuickTransfer(account)}
                        title={txt.tipTransfer}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                      >
                        <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingAccount(account)}
                      title={txt.tipEdit}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {(() => {
                      const isCore = account.id === 'acc_default_cash' || account.id === 'acc_default_bank';
                      const isDef = Boolean(account.isDefault);
                      const tx = accountBalances?.get(String(account.id))?.transactions?.length || 0;
                      const isBlocked = isCore || isDef || tx > 0;
                      const blockTooltip = isCore
                        ? txt.tipCoreSystem
                        : isDef
                          ? txt.tipDefaultSystem
                          : tx > 0
                            ? txt.tipHasTx(tx)
                            : txt.tipDelete;

                      return (
                        <button
                          type="button"
                          onClick={() => handleInitiateDelete(account)}
                          title={blockTooltip}
                          className={`p-1.5 rounded-xl transition-all ${
                            isBlocked
                              ? 'text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/30'
                              : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* بخش ابزارهای پیشرفته: انتقال تراکنش‌های قدیمی به صندوق نقدی (انتقال‌یافته به پایین صفحه) */}
      <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Coins className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <div className="font-bold text-slate-700 dark:text-slate-300">
              {txt.legacySyncTitle}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {txt.legacySyncDesc}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={isMigrating}
          onClick={handleMigratePastTransactions}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
        >
          {isMigrating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
              <span>{txt.applying}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
              <span>{txt.applyCashMigration}</span>
            </>
          )}
        </button>
      </div>

      {/* مودال افزودن حساب */}
      {isAddModalOpen && (
        <AddEditAccountModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={onAddAccount}
          currency={currency}
          language={language}
        />
      )}

      {/* مودال ویرایش حساب */}
      {editingAccount && (
        <AddEditAccountModal
          isOpen={Boolean(editingAccount)}
          onClose={() => setEditingAccount(null)}
          onSave={(data) => onUpdateAccount(editingAccount.id, data)}
          initialData={editingAccount}
          currency={currency}
          language={language}
        />
      )}

      {/* دیالوگ تأیید حذف حساب */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {txt.confirmDeleteTitle}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              {accountToDelete.name}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {txt.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
              >
                {txt.confirmDeleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* دیالوگ اخطار عدم امکان حذف حساب دارای گردش مالی */}
      {accountBlockedFromDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-200 dark:border-rose-900 shadow-sm">
              <Ban className="w-7 h-7" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {accountBlockedFromDelete.title || txt.blockedDefaultModalTitle}
              </h4>
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                {accountBlockedFromDelete.account?.name}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 text-start space-y-2">
              <p className="leading-relaxed font-medium">
                {accountBlockedFromDelete.message || txt.blockedTxMsg(accountBlockedFromDelete.txCount)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {txt.blockedTxStandardsMsg}
              </p>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-bold">
                <span>{txt.lblCurrentBalance}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                  {formatCurrency(accountBlockedFromDelete.currentBalance, currency, language)}
                </span>
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setAccountBlockedFromDelete(null)}
                className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-md transition-all active:scale-95"
              >
                {txt.understood}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
