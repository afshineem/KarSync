import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAccounting } from '../hooks/useAccounting';
import { FinancialBalanceCards } from './accounting/FinancialBalanceCards';
import { CashFlowChart } from './accounting/CashFlowChart';
import { IncomeManagementSection } from './accounting/IncomeManagementSection';
import { GeneralLedgerTable } from './accounting/GeneralLedgerTable';
import { AddEditIncomeModal } from './accounting/AddEditIncomeModal';
import { AccountsSettingsTab } from './accounting/AccountsSettingsTab';
import { AccountBalanceTiles } from './accounting/AccountBalanceTiles';
import { AccountSubsidiaryLedgerSection } from './accounting/AccountSubsidiaryLedgerSection';
import { AccountTransferModal } from './accounting/AccountTransferModal';
import { 
  Landmark, 
  Plus, 
  CreditCard, 
  X, 
  Clock, 
  ChevronLeft, 
  ArrowLeftRight, 
  RefreshCw, 
  Check,
  BookOpen,
  LayoutDashboard,
  ArrowDownLeft
} from 'lucide-react';

/**
 * AccountingView
 * نمای اصلی تب «حسابداری و خزانه‌داری» (Accounting & Treasury)
 * 
 * سازمان‌دهی شده با زبان طراحی متریال گوگل، داک ناوبری مایع اپل و رنگ سازمانی پرایمری KarSync:
 * ۱. تراز و حساب‌ها (داشبورد تراز مالی، کارت‌های بانکی، صندوق‌ها، نمودار روند نقدینگی)
 * ۲. دفتر کل تراکنش‌ها (فیلترها، تایید نهایی اسناد موقت، اصلاحیه، خروجی اکسل)
 * ۳. ورودی‌ها و تنخواه (مدیریت شارژ تنخواه، تزریق نقدینگی)
 * ۴. مدیریت حساب‌ها و کارت‌ها (تعریف، ویرایش، حساب پیش‌فرض و سقف اعتبار)
 */
export function AccountingView() {
  const { t, language } = useLanguage();
  const { currentProject } = useProject();

  const [activeViewTab, setActiveViewTab] = useState('overview'); // 'overview' | 'ledger' | 'income' | 'accounts'
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [initialTransferSourceId, setInitialTransferSourceId] = useState(null);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState(null);
  const [quickDepositAccount, setQuickDepositAccount] = useState(null);
  const [isSyncingAccounts, setIsSyncingAccounts] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  // فراخوانی هوک اختصاصی حسابداری جهت مدیریت State و محاسبات زنده
  const {
    currency,
    dashboardStats,
    treasuryIncomes,
    financialAccounts,
    accountBalances,
    accountBalancesList,
    globalOverdraftPolicy,
    updateGlobalOverdraftPolicy,
    addAccount,
    updateAccount,
    setDefaultAccount,
    deleteAccount,
    ledgerItems,
    filteredLedgerItems,
    ledgerStats,
    approvalStatusFilter,
    setApprovalStatusFilter,
    dateFilterMode,
    setDateFilterMode,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    categoryFilter,
    setCategoryFilter,
    accountTypeFilter,
    setAccountTypeFilter,
    searchQuery,
    setSearchQuery,
    selectedMonth,
    setSelectedMonth,
    cashFlowChartData,
    addIncome,
    updateIncome,
    deleteIncome,
    deleteDraftLedgerItem,
    batchDeleteDraftLedgerItems,
    accountTransfers,
    transferBetweenAccounts,
    syncFinancialAccounts
  } = useAccounting();

  const handleSyncAccounts = async () => {
    try {
      setIsSyncingAccounts(true);
      await syncFinancialAccounts();
      setSyncFeedback({
        type: 'success',
        message: language === 'fa' ? 'حساب‌ها و مانده‌ها با موفقیت همگام شدند.' : 'حیسابەکان هاوکات کران.'
      });
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        message: err.message || (language === 'fa' ? 'خطا در همگام‌سازی حساب‌ها' : 'هەڵە لە هاوکاتکردن')
      });
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncingAccounts(false);
    }
  };

  const viewTabs = [
    {
      id: 'overview',
      label: language === 'fa' ? 'تراز و حساب‌ها' : 'هاوسەنگی و باڵانس',
      icon: LayoutDashboard,
      count: financialAccounts.length
    },
    {
      id: 'ledger',
      label: language === 'fa' ? 'دفتر کل' : 'دەفتەری گشتی',
      icon: BookOpen,
      count: ledgerStats?.total || 0,
      badge: ledgerStats?.draft > 0 ? ledgerStats.draft : null
    },
    {
      id: 'income',
      label: language === 'fa' ? 'ورودی‌ها و تنخواه' : 'داهات و تەنخوا',
      icon: ArrowDownLeft,
      count: treasuryIncomes.length
    },
    {
      id: 'accounts',
      label: language === 'fa' ? 'کارت‌ها و صندوق‌ها' : 'کارت و سندووق',
      icon: CreditCard,
      count: financialAccounts.length
    }
  ];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* هدر اصلی ماژول حسابداری */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 flex-shrink-0">
            <Landmark className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {language === 'fa' ? 'حسابداری و خزانه‌داری' : 'ژمێریاری و خەزێنەداری'}
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                {currentProject?.name || (language === 'fa' ? 'پروژه کارگاه' : 'پڕۆژە')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'fa' 
                ? 'مدیریت یکپارچه تنخواه، تراز لحظه‌ای صندوق، کنترل هزینه‌ها و دفتر کل تراکنش‌ها' 
                : 'بەڕێوەبردنی تەنخوا، هاوسەنگی سندووق و دەفتەری گشتی مامەڵەکان'}
            </p>
          </div>
        </div>

        {/* داک دکمه‌های اقدام سریع با زبان طراحی هماهنگ با ناوبار */}
        <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
          {/* Segmented Dock Pill */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner flex-shrink-0">
            {/* دکمه انتقال بین حساب‌ها */}
            <button
              type="button"
              onClick={() => {
                setInitialTransferSourceId(null);
                setIsTransferModalOpen(true);
              }}
              aria-label={language === 'fa' ? 'انتقال بین حساب‌ها' : 'گواستنەوەی پارە'}
              title={language === 'fa' ? 'انتقال وجه بین حساب‌ها (کارت به کارت / صندوق به بانک)' : 'گواستنەوەی پارە'}
              className="px-3 py-2 text-slate-700 hover:text-sky-600 hover:bg-white dark:text-slate-200 dark:hover:text-sky-400 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 flex items-center gap-1.5 text-xs font-bold active:scale-95"
            >
              <ArrowLeftRight className="w-4 h-4 text-sky-500 flex-shrink-0" />
              <span className="hidden sm:inline">{language === 'fa' ? 'انتقال وجه' : 'گواستنەوەی پارە'}</span>
            </button>

            {/* دکمه همگام‌سازی فوری حساب‌ها */}
            <button
              type="button"
              onClick={handleSyncAccounts}
              disabled={isSyncingAccounts}
              aria-label={language === 'fa' ? 'همگام‌سازی حساب‌ها' : 'هاوکاتکردنی حیسابەکان'}
              title={language === 'fa' ? 'همگام‌سازی ابری و زنده حساب‌ها و موجودی' : 'هاوکاتکردنی حیسابەکان'}
              className="p-2 text-slate-500 hover:text-sky-600 hover:bg-white dark:text-slate-400 dark:hover:text-sky-400 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isSyncingAccounts ? 'animate-spin text-sky-500' : ''}`} />
            </button>
          </div>

          {/* دکمه برجسته افزایش موجودی / واریز جدید با رنگ پرایمری برنامه */}
          <button
            type="button"
            onClick={() => {
              setQuickDepositAccount(null);
              setIsQuickAddModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center gap-1.5 transition-all active:scale-95 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'fa' ? 'افزایش موجودی' : 'زیادکردنی باڵانس'}</span>
          </button>
        </div>
      </div>

      {/* پیام اعلان همگام‌سازی فوری */}
      {syncFeedback && (
        <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top duration-200 ${
          syncFeedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        }`}>
          {syncFeedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : <X className="w-4 h-4 text-rose-500 shrink-0" />}
          <span>{syncFeedback.message}</span>
        </div>
      )}

      {/* نوار ناوبری زیرمنوها (طراحی داک مایع شبیه ناوبار و هزینه‌ها) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <nav
          aria-label="Accounting views"
          className="flex items-center gap-1.5 sm:gap-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl backdrop-saturate-200 p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-white/80 dark:border-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_4px_20px_rgba(0,0,0,0.4)] w-fit flex-wrap"
        >
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeViewTab === tab.id && !selectedAccountForLedger;
            return (
              <div key={tab.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountForLedger(null);
                    setActiveViewTab(tab.id);
                  }}
                  aria-label={tab.label}
                  className={`relative rounded-xl sm:rounded-2xl transition-all duration-300 ease-out flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25 px-4 py-2 sm:px-5 sm:py-2.5 gap-2 scale-[1.02] font-bold border border-sky-400/30'
                      : 'p-2 sm:px-3.5 sm:py-2.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2] transition-transform duration-200 ${
                    isActive ? 'scale-105' : 'group-hover:scale-110'
                  }`} />

                  {/* نام تب */}
                  <span className={`text-xs sm:text-sm font-black whitespace-nowrap tracking-tight ${isActive ? 'inline' : 'hidden sm:inline ms-1'}`}>
                    {tab.label}
                  </span>

                  {/* نشانگر تعداد */}
                  {tab.badge ? (
                    <span className="ms-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-amber-500 text-white shadow-xs">
                      {tab.badge}
                    </span>
                  ) : tab.count > 0 ? (
                    <span className={`ms-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-none ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>
                      {tab.count}
                    </span>
                  ) : null}

                  {/* نقطه نشانگر فعال */}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs"></span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      {/* بدنه محتوا بر اساس تب انتخابی */}
      {selectedAccountForLedger ? (
        /* بخش مخصوص دفتر معین حساب انتخاب شده */
        <section aria-label="Dedicated Account Subsidiary Ledger">
          <AccountSubsidiaryLedgerSection
            account={selectedAccountForLedger}
            accountData={accountBalances.get(String(selectedAccountForLedger.id))}
            currency={currency}
            language={language}
            allAccounts={financialAccounts}
            onSelectAccount={(acc) => setSelectedAccountForLedger(acc)}
            onBack={() => setSelectedAccountForLedger(null)}
            onQuickDeposit={(acc) => {
              setQuickDepositAccount(acc);
              setIsQuickAddModalOpen(true);
            }}
          />
        </section>
      ) : activeViewTab === 'overview' ? (
        /* تب ۱: نمای کلی و تراز نقدینگی */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* اعلان اسناد نیازمند تایید مدیر با دکمه هدایت سریع به دفتر کل */}
          {ledgerStats?.draft > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 dark:from-amber-950/40 dark:via-amber-900/40 dark:to-amber-950/40 border border-amber-300/80 dark:border-amber-700/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                    {language === 'fa' 
                      ? `تعداد ${ledgerStats.draft} سند مالی موقت (پیش‌نویس) در انتظار تایید نهایی هستند.` 
                      : `${ledgerStats.draft} بەڵگەنامەی ڕەشنووس چاوەڕوانی پەسەندکردنن.`}
                  </h4>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    {language === 'fa' 
                      ? 'تسویه‌حساب‌ها و هزینه‌های ثبت شده تا زمان تایید نهایی مدیر، وضعیت پیش‌نویس دارند.' 
                      : 'بەڵگەنامەکان تا پەسەندکردنی کۆتایی ڕەشنووسن.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveViewTab('ledger');
                  setApprovalStatusFilter?.('draft');
                }}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center gap-1.5 self-start sm:self-center transition-all active:scale-95"
              >
                <span>{language === 'fa' ? 'مشاهده و تایید اسناد' : 'بینین و پەسەندکردن'}</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ۱. کارت‌های خلاصه وضعیت تراز مالی */}
          <section aria-label="Financial Balance Dashboard">
            <FinancialBalanceCards
              stats={dashboardStats}
              currency={currency}
              language={language}
            />
          </section>

          {/* ۲. کاشی‌های اعلام موجودی کارت‌ها و صندوق‌ها */}
          <section aria-label="Accounts and Cash Boxes Balance Tiles">
            <AccountBalanceTiles
              accounts={financialAccounts}
              accountBalances={accountBalances}
              currency={currency}
              language={language}
              selectedAccountId={selectedAccountForLedger?.id}
              onSelectAccount={(acc) => setSelectedAccountForLedger(acc)}
              onQuickDeposit={(acc) => {
                setQuickDepositAccount(acc);
                setIsQuickAddModalOpen(true);
              }}
              onQuickTransfer={(acc) => {
                setInitialTransferSourceId(acc?.id || null);
                setIsTransferModalOpen(true);
              }}
            />
          </section>

          {/* ۳. نمودار جریان نقدینگی */}
          <section aria-label="Cash Flow Chart">
            <CashFlowChart
              chartData={cashFlowChartData}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              currency={currency}
              language={language}
            />
          </section>
        </div>
      ) : activeViewTab === 'ledger' ? (
        /* تب ۲: دفتر کل تراکنش‌ها */
        <section id="general-ledger-section" aria-label="General Ledger Table" className="animate-in fade-in duration-200">
          <GeneralLedgerTable
            ledgerItems={filteredLedgerItems}
            financialAccounts={financialAccounts}
            ledgerStats={ledgerStats}
            approvalStatusFilter={approvalStatusFilter}
            setApprovalStatusFilter={setApprovalStatusFilter}
            dateFilterMode={dateFilterMode}
            setDateFilterMode={setDateFilterMode}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            accountTypeFilter={accountTypeFilter}
            setAccountTypeFilter={setAccountTypeFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            currency={currency}
            language={language}
            projectName={currentProject?.name || 'KarSync'}
            onDeleteDraftItem={deleteDraftLedgerItem}
            onBatchDeleteDraftItems={batchDeleteDraftLedgerItems}
          />
        </section>
      ) : activeViewTab === 'income' ? (
        /* تب ۳: ورودی‌ها و تنخواه دریافتی */
        <section aria-label="Income and Petty Cash Management" className="animate-in fade-in duration-200">
          <IncomeManagementSection
            incomes={treasuryIncomes}
            onAddIncome={addIncome}
            onUpdateIncome={updateIncome}
            onDeleteIncome={deleteIncome}
            currency={currency}
            language={language}
          />
        </section>
      ) : activeViewTab === 'accounts' ? (
        /* تب ۴: تنظیمات حساب‌ها و کارت‌های بانکی */
        <section aria-label="Accounts and Cards Management" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm animate-in fade-in duration-200">
          <AccountsSettingsTab
            accounts={financialAccounts}
            accountBalances={accountBalances}
            globalOverdraftPolicy={globalOverdraftPolicy}
            onUpdateGlobalOverdraftPolicy={updateGlobalOverdraftPolicy}
            onAddAccount={addAccount}
            onUpdateAccount={updateAccount}
            onSetDefaultAccount={setDefaultAccount}
            onDeleteAccount={deleteAccount}
            onQuickDeposit={(acc) => {
              setQuickDepositAccount(acc);
              setIsQuickAddModalOpen(true);
            }}
            onQuickTransfer={(acc) => {
              setInitialTransferSourceId(acc?.id || null);
              setIsTransferModalOpen(true);
            }}
            currency={currency}
            language={language}
          />
        </section>
      ) : null}

      {/* مودال سریع ثبت واریزی */}
      {isQuickAddModalOpen && (
        <AddEditIncomeModal
          isOpen={isQuickAddModalOpen}
          onClose={() => {
            setIsQuickAddModalOpen(false);
            setQuickDepositAccount(null);
          }}
          onSave={addIncome}
          initialData={quickDepositAccount ? { accountId: quickDepositAccount.id, accountType: quickDepositAccount.type } : null}
          currency={currency}
          language={language}
        />
      )}

      {/* مودال انتقال وجه بین حساب‌ها (کارت به کارت / صندوق به بانک) */}
      {isTransferModalOpen && (
        <AccountTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setInitialTransferSourceId(null);
          }}
          onTransfer={transferBetweenAccounts}
          accounts={financialAccounts}
          accountBalances={accountBalances}
          globalOverdraftPolicy={globalOverdraftPolicy}
          initialFromAccountId={initialTransferSourceId}
          currency={currency}
          language={language}
        />
      )}

      {/* مودال مدیریت حساب‌ها (جهت پشتیبانی از باز شدن در صورت نیاز) */}
      {isAccountsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {language === 'fa' ? 'مدیریت کارت‌های بانکی و صندوق‌ها' : 'بەڕێوەبردنی کارت و سندووقەکان'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'fa' ? 'تعریف حساب‌ها و تعیین حساب پیش‌فرض برای واریز و پرداخت‌ها' : 'حیسابەکان و دیاریکردنی بنەڕەتی'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <AccountsSettingsTab
                accounts={financialAccounts}
                accountBalances={accountBalances}
                globalOverdraftPolicy={globalOverdraftPolicy}
                onUpdateGlobalOverdraftPolicy={updateGlobalOverdraftPolicy}
                onAddAccount={addAccount}
                onUpdateAccount={updateAccount}
                onSetDefaultAccount={setDefaultAccount}
                onDeleteAccount={deleteAccount}
                onQuickDeposit={(acc) => {
                  setIsAccountsModalOpen(false);
                  setQuickDepositAccount(acc);
                  setIsQuickAddModalOpen(true);
                }}
                onQuickTransfer={(acc) => {
                  setIsAccountsModalOpen(false);
                  setInitialTransferSourceId(acc?.id || null);
                  setIsTransferModalOpen(true);
                }}
                currency={currency}
                language={language}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AccountingView;
