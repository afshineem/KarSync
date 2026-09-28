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
import { 
  Landmark, 
  Plus, 
  FileSpreadsheet, 
  HelpCircle,
  Sparkles,
  Layers,
  ArrowDownLeft,
  Building2,
  Calendar,
  CreditCard,
  X,
  Clock,
  ChevronLeft
} from 'lucide-react';

/**
 * AccountingView
 * نمای اصلی تب «حسابداری و خزانه‌داری» (Accounting & Treasury)
 * 
 * شامل ۴ بخش اصلی معین شده در تسک:
 * ۱. ماژول داشبورد تراز مالی (Financial Balance Dashboard)
 * ۲. ماژول مدیریت ورودی‌ها و تنخواه (Income & Petty Cash)
 * ۳. ماژول دفتر کل تراکنش‌ها (General Ledger)
 * ۴. نمودار جریان نقدینگی (Cash Flow Chart)
 */
export function AccountingView() {
  const { t, language } = useLanguage();
  const { currentProject } = useProject();

  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState(null);
  const [quickDepositAccount, setQuickDepositAccount] = useState(null);

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
    deleteIncome
  } = useAccounting();

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* هدر اصلی صفحه */}
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

        {/* عملیات‌های سریع */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            type="button"
            onClick={() => setIsAccountsModalOpen(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <CreditCard className="w-4 h-4 text-emerald-500" />
            <span>{language === 'fa' ? 'حساب‌ها و کارت‌ها' : 'حیساب و کارتەکان'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsQuickAddModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/25 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'fa' ? 'ثبت واریزی جدید' : 'تۆماری داهاتی نوێ'}</span>
          </button>
        </div>
      </div>

      {/* پیام اعلان اسناد نیازمند تایید مدیر */}
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
                  ? 'تسویه‌حساب‌ها و هزینه‌های ثبت شده تا زمان تایید نهایی مدیر، وضعیت پیش‌نویس دارند و از بخش دفتر کل قابل تایید تکی یا گروهی هستند.' 
                  : 'بەڵگەنامەکان تا پەسەندکردنی کۆتایی ڕەشنووسن.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setApprovalStatusFilter?.('draft');
              const el = document.getElementById('general-ledger-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 self-start sm:self-center transition-all active:scale-95"
          >
            <span>{language === 'fa' ? 'مشاهده و تایید اسناد' : 'بینین و پەسەندکردن'}</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {selectedAccountForLedger ? (
        /* بخش مخصوص و دفتر معین حساب انتخاب شده */
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
      ) : (
        <>
          {/* ۱. ماژول داشبورد تراز مالی (۴ کارت خلاصه وضعیت) */}
          <section aria-label="Financial Balance Dashboard">
            <FinancialBalanceCards
              stats={dashboardStats}
              currency={currency}
              language={language}
            />
          </section>

          {/* ۲. کاشی‌های اعلام موجودی کارت‌ها و صندوق‌های وجه نقد */}
          <section aria-label="Accounts and Cash Boxes Balance Tiles">
            <AccountBalanceTiles
              accounts={financialAccounts}
              accountBalances={accountBalances}
              currency={currency}
              language={language}
              selectedAccountId={selectedAccountForLedger?.id}
              onSelectAccount={(acc) => setSelectedAccountForLedger(acc)}
            />
          </section>

          {/* ۳. نمودار جریان نقدینگی (Cash Flow Chart) */}
          <section aria-label="Cash Flow Chart">
            <CashFlowChart
              chartData={cashFlowChartData}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              currency={currency}
              language={language}
            />
          </section>

          {/* ۴. ماژول مدیریت ورودی‌ها و تنخواه (Income & Petty Cash) */}
          <section aria-label="Income and Petty Cash Management">
            <IncomeManagementSection
              incomes={treasuryIncomes}
              onAddIncome={addIncome}
              onUpdateIncome={updateIncome}
              onDeleteIncome={deleteIncome}
              currency={currency}
              language={language}
            />
          </section>

          {/* ۵. ماژول دفتر کل تراکنش‌ها (General Ledger) */}
          <section id="general-ledger-section" aria-label="General Ledger Table">
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
            />
          </section>
        </>
      )}

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

      {/* مودال مدیریت حساب‌ها و کارت‌های بانکی */}
      {isAccountsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
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
