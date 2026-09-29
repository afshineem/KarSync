import React from 'react';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { 
  CreditCard, 
  Coins, 
  Star, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronLeft, 
  ChevronRight,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Plus,
  ArrowLeftRight
} from 'lucide-react';

/**
 * AccountBalanceTiles
 * کاشی‌های اعلام موجودی کارت‌ها و صندوق‌های وجه نقد در داشبورد تب حسابداری
 * 
 * ویژگی‌ها:
 * - نمایش تفکیکی و زنده موجودی فعلی تمام کارت‌های بانکی و صندوق‌ها
 * - نمایش موجودی اولیه، مجموع ورودی‌ها و مجموع خروجی‌ها
 * - دکمه‌های سریع واریز (افزایش موجودی) و انتقال وجه روی هر کارت
 * - با کلیک روی هر کاشی، به بخش مخصوص و دفتر معین آن حساب هدایت می‌شود
 */
export function AccountBalanceTiles({
  accounts = [],
  accountBalances = new Map(),
  currency = 'IQD',
  language = 'fa',
  selectedAccountId = null,
  onSelectAccount,
  onQuickDeposit = null,
  onQuickTransfer = null
}) {
  const isRtl = language === 'fa' || language === 'ku';

  if (!accounts || accounts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* عنوان بخش کاشی‌ها */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
            {language === 'fa' 
              ? 'موجودی کارت‌های بانکی و صندوق‌های نقدینگی' 
              : 'باڵانسی کارتی بانکی و سندوقەکان'}
          </h3>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            {accounts.length} {language === 'fa' ? 'حساب' : 'حیساب'}
          </span>
        </div>

        <span className="text-[11px] text-slate-400 hidden sm:inline">
          {language === 'fa' ? 'جهت مشاهده دفتر معین و ریز تراکنش‌ها کلیک کنید' : 'بۆ بینینی دەفتەری معین کرتە بکە'}
        </span>
      </div>

      {/* شبکه کاشی‌ها */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {accounts.map((account) => {
          const isBank = account.type === 'bank';
          const isDefault = Boolean(account.isDefault);
          const isSelected = selectedAccountId === account.id;

          const balanceData = accountBalances.get(String(account.id)) || {
            initialBalance: Number(account.initialBalance) || 0,
            totalInflow: 0,
            totalOutflow: 0,
            currentBalance: Number(account.initialBalance) || 0,
            inflowsCount: 0,
            outflowsCount: 0
          };

          const currentBalance = balanceData.currentBalance;
          const isPositive = currentBalance >= 0;

          return (
            <div
              key={account.id}
              onClick={() => onSelectAccount && onSelectAccount(account)}
              className={`group relative p-4 rounded-3xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'ring-2 ring-emerald-500 bg-white dark:bg-slate-900 shadow-md border-emerald-500/40'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
              }`}
            >
              {/* پس‌زمینه رنگی خیلی ملایم در بالای کارت */}
              <div 
                className={`absolute top-0 inset-x-0 h-1.5 ${
                  isBank ? 'bg-gradient-to-r from-sky-400 to-indigo-500' : 'bg-gradient-to-r from-amber-400 to-amber-600'
                }`} 
              />

              <div>
                {/* ردیف بالا: آیکون، نام حساب و نشان پیش‌فرض */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                      isBank 
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                    }`}>
                      {isBank ? <CreditCard className="w-4 h-4 stroke-[2.2]" /> : <Coins className="w-4 h-4 stroke-[2.2]" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                          {account.name}
                        </h4>
                        {isDefault && (
                          <span title="حساب پیش‌فرض">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {isBank 
                          ? (account.bankName || 'کارت بانکی') 
                          : (account.keeperName ? `مسئول: ${account.keeperName}` : 'صندوق نقدی')}
                      </span>
                    </div>
                  </div>

                  {/* وضعیت مانده */}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    isPositive 
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                  }`}>
                    {isPositive ? 'مثبت' : 'کسری'}
                  </span>
                </div>

                {/* اعلام موجودی زنده و فعلی */}
                <div className="my-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {language === 'fa' ? 'موجودی فعلی:' : 'باڵانسی ئێستا:'}
                  </div>
                  <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
                    isPositive ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                  }`} dir="ltr">
                    {formatCurrency(currentBalance, currency, language)}
                  </div>
                </div>

                {/* ریز گردش: اولیه + ورودی - خروجی */}
                <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]">موجودی اولیه:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {formatAmount(balanceData.initialBalance, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span className="text-[10px] flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      <span>ورودی‌ها:</span>
                    </span>
                    <span className="font-mono font-bold">
                      +{formatAmount(balanceData.totalInflow, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                    <span className="text-[10px] flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>خروجی‌ها:</span>
                    </span>
                    <span className="font-mono font-bold">
                      -{formatAmount(balanceData.totalOutflow, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* پاورقی کارت با دکمه‌های عملیات سریع و دسترسی به معین */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{language === 'fa' ? 'دفتر معین' : 'دەفتەری معین'}</span>
                  {isRtl ? (
                    <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                  ) : (
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  )}
                </span>

                {/* دکمه‌های آیکونی اقدام سریع روی همین کارت */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {onQuickTransfer && (
                    <button
                      type="button"
                      onClick={() => onQuickTransfer(account)}
                      title={language === 'fa' ? `انتقال وجه از ${account.name}` : `گواستنەوەی پارە لە ${account.name}`}
                      className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-400 transition-all active:scale-90"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onQuickDeposit && (
                    <button
                      type="button"
                      onClick={() => onQuickDeposit(account)}
                      title={language === 'fa' ? `افزایش موجودی ${account.name}` : `زیادکردنی باڵانسی ${account.name}`}
                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-400 transition-all active:scale-90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default AccountBalanceTiles;
