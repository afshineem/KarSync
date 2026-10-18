import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Users, 
  Receipt, 
  Wallet, 
  Scale, 
  Building2, 
  CreditCard, 
  Coins, 
  AlertTriangle, 
  CheckCircle2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

/**
 * FinancialBalanceCards
 * ۴ کارت خلاصه وضعیت تراز مالی و خزانه‌داری کارگاه
 * 
 * ۱. کل بودجه دریافتی (ورودی‌ها): تنخواه و بودجه‌های واریز شده
 * ۲. کل پرداختی‌ها به پرسنل: سرجمع تسویه‌حساب و مساعده
 * ۳. کل هزینه‌های کارگاه: سرجمع فاکتورها و ماشین‌آلات پرداخت شده
 * ۴. موجودی فعلی صندوق (تراز جاری): کل ورودی‌ها - (پرداختی پرسنل + هزینه‌های کارگاه)
 */
// Scoped dictionary for FinancialBalanceCards
const COPY = {
  fa: {
    titleInflow: 'کل نقدینگی و بودجه (ورودی‌ها)',
    lblInitial: 'اولیه:',
    lblPettyCash: 'تنخواه:',
    titlePersonnel: 'کل پرداختی‌ها به پرسنل',
    lblSettlement: 'تسویه:',
    lblAdvance: 'مساعده:',
    titleExpenses: 'کل هزینه‌های کارگاه (فاکتورها)',
    invoicesCount: (cnt) => `${cnt} فاکتور ثبت شده`,
    ofBudget: 'از بودجه',
    titleTreasury: 'موجودی فعلی صندوق (تراز جاری)',
    surplus: 'مازاد نقدینگی و تراز مثبت',
    shortfall: 'کسری صندوق و تراز منفی',
    burn: 'مصرف:'
  },
  ku: {
    titleInflow: 'کۆی گشتی بودجە و داهات (هاتوو)',
    lblInitial: 'سەرەتایی:',
    lblPettyCash: 'تنخواه:',
    titlePersonnel: 'کۆی پارەدراو بە کرێکاران',
    lblSettlement: 'تەسویە:',
    lblAdvance: 'مساعدە:',
    titleExpenses: 'کۆی خەرجییەکانی کارگە (فاکتەرەکان)',
    invoicesCount: (cnt) => `${cnt} فاکتەری تۆمارکراو`,
    ofBudget: 'لە بودجە',
    titleTreasury: 'باڵانسی ئێستای سندوق (ترازی بەردەست)',
    surplus: 'زیادەی نەختینە و باڵانسی ئەرێنی',
    shortfall: 'کەمیی باڵانس و ترازی نەرێنی',
    burn: 'بەکارهاتوو:'
  },
  en: {
    titleInflow: 'Total Liquidity & Budget (Inflow)',
    lblInitial: 'Opening:',
    lblPettyCash: 'Petty Cash:',
    titlePersonnel: 'Total Staff Disbursements',
    lblSettlement: 'Settlement:',
    lblAdvance: 'Advance:',
    titleExpenses: 'Total Workshop Expenses (Invoices)',
    invoicesCount: (cnt) => `${cnt} Recorded Invoices`,
    ofBudget: 'of budget',
    titleTreasury: 'Current Treasury Balance (Net)',
    surplus: 'Positive Net Liquidity Surplus',
    shortfall: 'Treasury Deficit & Negative Balance',
    burn: 'Utilization:'
  }
};

export function FinancialBalanceCards({ stats, currency, language = 'fa' }) {
  const txt = COPY[language] || COPY.fa;
  const isPositive = stats.isPositiveBalance;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* کارت ۱: کل بودجه دریافتی (ورودی‌ها) */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              {txt.titleInflow}
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCurrency(stats.totalFundsAvailable || stats.totalInflow, currency, language)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs">
            <ArrowDownLeft className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* جزییات تفکیکی ورودی */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-slate-400" />
            <span>{txt.lblInitial} {formatCurrency(stats.totalInitialBalances || 0, currency, language)}</span>
          </span>
          <span className="flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
            <span>{txt.lblPettyCash} {formatCurrency(stats.totalInflow, currency, language)}</span>
          </span>
        </div>
      </div>

      {/* کارت ۲: کل پرداختی‌ها به پرسنل */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              {txt.titlePersonnel}
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {formatCurrency(stats.totalPersonnel, currency, language)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 border border-sky-200/60 dark:border-sky-800/60 shadow-xs">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* جزییات تفکیکی پرداختی پرسنل */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
            <span>{txt.lblSettlement} {formatCurrency(stats.totalSettlements, currency, language)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-slate-400" />
            <span>{txt.lblAdvance} {formatCurrency(stats.totalAdvances, currency, language)}</span>
          </span>
        </div>
      </div>

      {/* کارت ۳: کل هزینه‌های کارگاه */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              {txt.titleExpenses}
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {formatCurrency(stats.totalExpenses, currency, language)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs">
            <Receipt className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* زیرنویس وضعیت فاکتورها */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{txt.invoicesCount(stats.expensesCount)}</span>
          <span className="text-slate-600 dark:text-slate-300 font-bold font-mono">
            {stats.expenseRatio}% {txt.ofBudget}
          </span>
        </div>
      </div>

      {/* کارت ۴: موجودی فعلی صندوق (تراز جاری) - رنگ متمایز سبز/قرمز */}
      <div className={`relative overflow-hidden rounded-3xl p-5 border shadow-sm hover:shadow-md transition-all duration-200 ${
        isPositive 
          ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/20' 
          : 'bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent border-rose-500/40 dark:border-rose-500/30'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
              {txt.titleTreasury}
            </span>
            <div className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
              isPositive 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {formatCurrency(stats.currentTreasuryBalance, currency, language)}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border ${
            isPositive
              ? 'bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-500/25'
              : 'bg-rose-500 text-white border-rose-400/40 shadow-rose-500/25 animate-pulse'
          }`}>
            {isPositive ? (
              <TrendingUp className="w-6 h-6 stroke-[2.4]" />
            ) : (
              <TrendingDown className="w-6 h-6 stroke-[2.4]" />
            )}
          </div>
        </div>

        {/* وضعیت تراز جاری */}
        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className={`inline-flex items-center gap-1 font-bold ${
            isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
          }`}>
            {isPositive ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{txt.surplus}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{txt.shortfall}</span>
              </>
            )}
          </span>
          <span className="font-mono text-slate-500 dark:text-slate-400">
            {txt.burn} {stats.burnRatio}%
          </span>
        </div>
      </div>
    </div>
  );
}
