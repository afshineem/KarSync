import React, { useState, useCallback } from 'react';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import { 
  Table as TableIcon, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Lock, 
  Filter, 
  Search, 
  Download, 
  Calendar, 
  Tag, 
  CreditCard, 
  Coins, 
  CheckCircle2, 
  Info,
  Clock
} from 'lucide-react';

/**
 * GeneralLedgerTable
 * دفتر کل جامع تراکنش‌های سیستم (ورودی‌ها و خروجی‌ها)
 * 
 * ویژگی‌ها:
 * - ستون‌های کامل: ردیف، تاریخ، نوع تراکنش، دسته‌بندی، مبلغ، موجودی پس از تراکنش، توضیحات
 * - یکپارچگی سیستمی: Read-Only بودن تراکنش‌های ثبت شده در مالی و هزینه‌ها همراه با برچسب سیستمی
 * - فیلترهای پیشرفته زمانی و دسته‌بندی
 * - خروجی حرفه‌ای به اکسل (Excel Export)
 */
export function GeneralLedgerTable({
  ledgerItems = [],
  financialAccounts = [],
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
  currency = 'IQD',
  language = 'fa',
  projectName = 'KarSync'
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // خروجی اکسل از دفتر کل
  const handleExportExcel = useCallback(() => {
    if (ledgerItems.length === 0) {
      alert(language === 'fa' ? 'هیچ تراکنشی برای صدور فایل اکسل یافت نشد.' : 'هیچ مامەڵەیەک نییە.');
      return;
    }

    const rows = ledgerItems.map((item, idx) => ({
      'ردیف': idx + 1,
      'تاریخ': item.rawDate,
      'نوع تراکنش': item.type === 'inflow' ? 'ورودی (+)' : 'خروجی (-)',
      'دسته‌بندی': item.categoryLabel,
      'مبلغ تراکنش': item.amount,
      'واحد پول': currency,
      'موجودی پس از تراکنش': item.runningBalance,
      'حساب': item.accountName || (item.accountType === 'bank' ? 'کارت بانکی' : 'صندوق نقدی'),
      'عنوان و طرف‌حساب': item.title,
      'توضیحات': item.description || '',
      'منبع تراکنش': item.isSystem ? 'سیستمی (خودکار)' : 'دستی (تنخواه)'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'GeneralLedger');
    const fileName = `KarSync_General_Ledger_${projectName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [ledgerItems, currency, language, projectName]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* هدر دفتر کل */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60">
            <TableIcon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {language === 'fa' ? 'دفتر کل تراکنش‌های مالی (General Ledger)' : 'دەفتەری گشتی مامەڵە دارایییەکان'}
              </h2>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                {ledgerItems.length} {language === 'fa' ? 'تراکنش' : 'مامەڵە'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'fa' 
                ? 'نمای یکپارچه و به ترتیب زمان از تمام ورودی‌های تنخواه، تسویه‌ها، مساعده‌ها و فاکتورهای کارگاه' 
                : 'ڕیزبەندی هەموو مامەڵەکانی سندوق بەپێی بەروار'}
            </p>
          </div>
        </div>

        {/* دکمه‌های کنترل و خروجی */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isFilterOpen || dateFilterMode !== 'all' || categoryFilter !== 'all' || accountTypeFilter !== 'all'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'فیلترها' : 'فلتەرەکان'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'خروجی اکسل' : 'هەناردەی ئێکسڵ'}</span>
          </button>
        </div>
      </div>

      {/* پنل فیلترها و جستجو */}
      {(isFilterOpen || dateFilterMode !== 'all' || categoryFilter !== 'all' || accountTypeFilter !== 'all') && (
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs animate-in slide-in-from-top-2 duration-150">
          {/* فیلتر زمانی */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              <Calendar className="w-3 h-3 inline ml-1" />
              <span>{language === 'fa' ? 'بازه زمانی' : 'ماوەی کات'}</span>
            </label>
            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value)}
              className="w-full h-9 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">{language === 'fa' ? 'همه زمان‌ها (از ابتدا)' : 'هەموو کاتێک'}</option>
              <option value="this_month">{language === 'fa' ? 'این ماه (جاری)' : 'ئەم مانگە'}</option>
              <option value="last_month">{language === 'fa' ? 'ماه گذشته' : 'مانگی پێشوو'}</option>
              <option value="custom">{language === 'fa' ? 'بازه سفارشی...' : 'دیاریکراو...'}</option>
            </select>
          </div>

          {/* فیلتر دسته‌بندی */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              <Tag className="w-3 h-3 inline ml-1" />
              <span>{language === 'fa' ? 'دسته‌بندی تراکنش' : 'جۆری مامەڵە'}</span>
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">{language === 'fa' ? 'همه دسته‌بندی‌ها' : 'هەموو جۆرەکان'}</option>
              <option value="petty_cash">{language === 'fa' ? 'شارژ تنخواه و واریزی‌ها' : 'داهات و تەنخوا'}</option>
              <option value="worker_settlement">{language === 'fa' ? 'تسویه دستمزد پرسنل' : 'تەسویەی کرێکاران'}</option>
              <option value="advance_payment">{language === 'fa' ? 'مساعده پرداختی' : 'مساعدە'}</option>
              <option value="workshop_expense">{language === 'fa' ? 'هزینه کارگاه (فاکتورها)' : 'خەرجی کارگە'}</option>
            </select>
          </div>

          {/* فیلتر نوع حساب */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              <CreditCard className="w-3 h-3 inline ml-1" />
              <span>{language === 'fa' ? 'حساب مبدا/مقصد' : 'حیساب'}</span>
            </label>
            <select
              value={accountTypeFilter}
              onChange={(e) => setAccountTypeFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">{language === 'fa' ? 'همه حساب‌ها (نقد و بانک)' : 'هەموو حیسابەکان'}</option>
              <option value="cash">{language === 'fa' ? 'تمام صندوق‌های نقدی' : 'سندوقی کاش'}</option>
              <option value="bank">{language === 'fa' ? 'تمام کارت‌ها و بانک‌ها' : 'حیسابی بانک'}</option>
              {financialAccounts.length > 0 && (
                <optgroup label={language === 'fa' ? 'حساب‌های اختصاصی کارگاه' : 'حیسابە تایبەتەکان'}>
                  {financialAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.type === 'bank' ? '💳 ' : '🪙 '}
                      {acc.name}
                      {acc.isDefault ? ' ★' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* فیلتر جستجو متنی */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              <Search className="w-3 h-3 inline ml-1" />
              <span>{language === 'fa' ? 'جستجو در تراکنش‌ها' : 'گەڕان'}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="عنوان، طرف‌حساب، مبلغ..."
                className="w-full h-9 ps-8 pe-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* بازه سفارشی در صورت انتخاب */}
          {dateFilterMode === 'custom' && (
            <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-slate-200/60 dark:border-slate-700 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">از تاریخ:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">تا تاریخ:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* جدول داده‌های دفتر کل */}
      <div className="overflow-x-auto">
        {ledgerItems.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 flex items-center justify-center mb-3">
              <TableIcon className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {language === 'fa' ? 'هیچ تراکنشی مطابق با فیلترهای جاری یافت نشد' : 'هیچ مامەڵەیەک نەدۆزرایەوە'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {language === 'fa' 
                ? 'فیلترهای زمانی یا دسته‌بندی را تغییر دهید، یا تراکنش‌های مالی و هزینه‌ها را ثبت نمایید.' 
                : 'فلتەرەکان پاک بکەرەوە.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                <th className="py-3 px-3.5 w-12 text-center">{language === 'fa' ? 'ردیف' : '#'}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{language === 'fa' ? 'تاریخ' : 'بەروار'}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{language === 'fa' ? 'نوع تراکنش' : 'جۆر'}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{language === 'fa' ? 'دسته‌بندی' : 'پۆلێن'}</th>
                <th className="py-3 px-3.5 font-mono whitespace-nowrap">{language === 'fa' ? 'مبلغ تراکنش' : 'بڕە پارە'}</th>
                <th className="py-3 px-3.5 font-mono whitespace-nowrap">{language === 'fa' ? 'موجودی پس از تراکنش' : 'باڵانسی دواتر'}</th>
                <th className="py-3 px-3.5">{language === 'fa' ? 'عنوان و توضیحات' : 'تێبینی'}</th>
                <th className="py-3 px-3.5 w-24 text-center whitespace-nowrap">{language === 'fa' ? 'منبع داده' : 'سەرچاوە'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {ledgerItems.map((tx, idx) => {
                const isInflow = tx.type === 'inflow';
                const isPositiveBalance = tx.runningBalance >= 0;

                // استایل دسته‌بندی
                let categoryBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                if (tx.category === 'petty_cash') {
                  categoryBadgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
                } else if (tx.category === 'worker_settlement') {
                  categoryBadgeClass = 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
                } else if (tx.category === 'advance_payment') {
                  categoryBadgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
                } else if (tx.category === 'workshop_expense') {
                  categoryBadgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
                }

                return (
                  <tr 
                    key={tx.id + '_' + idx}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* ردیف */}
                    <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* تاریخ */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                      {tx.rawDate}
                    </td>

                    {/* نوع تراکنش: ورودی یا خروجی */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {isInflow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                          <span>{language === 'fa' ? 'ورودی (+)' : 'داهات (+)'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          <ArrowUpRight className="w-3 h-3 text-rose-500" />
                          <span>{language === 'fa' ? 'خروجی (-)' : 'خەرجی (-)'}</span>
                        </span>
                      )}
                    </td>

                    {/* دسته‌بندی */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${categoryBadgeClass}`}>
                        {tx.categoryLabel}
                      </span>
                    </td>

                    {/* مبلغ تراکنش */}
                    <td className={`py-3 px-3.5 whitespace-nowrap font-mono font-bold ${
                      isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isInflow ? '+' : '-'}{formatCurrency(tx.amount, currency, language)}
                    </td>

                    {/* موجودی پس از تراکنش (Running Balance) */}
                    <td className={`py-3 px-3.5 whitespace-nowrap font-mono font-bold ${
                      isPositiveBalance ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatCurrency(tx.runningBalance, currency, language)}
                    </td>

                    {/* عنوان و توضیحات */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2 max-w-md">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {tx.title}
                        </span>
                        {tx.accountName && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                            {tx.accountType === 'bank' ? (
                              <CreditCard className="w-2.5 h-2.5 text-sky-500" />
                            ) : (
                              <Coins className="w-2.5 h-2.5 text-amber-500" />
                            )}
                            <span className="truncate max-w-[110px]">{tx.accountName}</span>
                          </span>
                        )}
                      </div>
                      {tx.description && (
                        <div className="text-[11px] text-slate-400 max-w-sm truncate mt-0.5">
                          {tx.description}
                        </div>
                      )}
                    </td>

                    {/* منبع داده: سیستمی یا دستی */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      {tx.isSystem ? (
                        <span 
                          title={language === 'fa' ? 'تراکنش سیستمی غیرقابل ویرایش مستقیم (ثبت شده از ماژول مالی یا فاکتورها)' : 'مامەڵەی سیستەمی'}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        >
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>سیستمی</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[10px] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>تنخواه</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
