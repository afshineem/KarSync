import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { 
  CreditCard, 
  Coins, 
  Star, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronRight, 
  ChevronLeft,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  User,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Lock,
  Plus,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

/**
 * AccountSubsidiaryLedgerSection
 * بخش مخصوص و دفتر معین اختصاصی یک صندوق یا کارت بانکی
 * 
 * ویژگی‌ها:
 * - کاشی‌های آماری تفکیکی همین حساب (موجودی اولیه، ورودی‌ها، خروجی‌ها، موجودی فعلی)
 * - دکمه شاخص «معین {نام حساب}» برای نمایش دفتر معین در جدولی ساده و شفاف
 * - محاسبه دقیق مانده پس از هر تراکنش (Running Balance) از محل موجودی اولیه
 * - خروجی اکسل اختصاصی برای دفتر معین همین حساب
 * - امکان سوییچ سریع بین سایر صندوق‌ها و حساب‌ها
 */
export function AccountSubsidiaryLedgerSection({
  account,
  accountData,
  currency = 'IQD',
  language = 'fa',
  allAccounts = [],
  onSelectAccount,
  onBack,
  onQuickDeposit
}) {
  const isRtl = language === 'fa' || language === 'ku';

  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const isBank = account?.type === 'bank';
  const initialBalance = Number(accountData?.initialBalance) || 0;
  const currentBalance = Number(accountData?.currentBalance) || 0;
  const totalInflow = Number(accountData?.totalInflow) || 0;
  const totalOutflow = Number(accountData?.totalOutflow) || 0;
  const isPositive = currentBalance >= 0;

  // تمام تراکنش‌های ثبت شده برای این حساب
  const rawTransactions = accountData?.transactions || [];

  // اعمال فیلترها روی تراکنش‌ها
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonthPrefix = `${curYear}-${curMonth}`;

    const prevDate = new Date(curYear, now.getMonth() - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    const lastMonthPrefix = `${prevYear}-${prevMonth}`;

    const q = searchQuery.trim().toLowerCase();

    return rawTransactions.filter((tx) => {
      // فیلتر تاریخ
      if (dateFilter === 'this_month') {
        if (!tx.rawDate?.startsWith(thisMonthPrefix)) return false;
      } else if (dateFilter === 'last_month') {
        if (!tx.rawDate?.startsWith(lastMonthPrefix)) return false;
      } else if (dateFilter === 'custom') {
        if (customStart && tx.rawDate < customStart) return false;
        if (customEnd && tx.rawDate > customEnd) return false;
      }

      // فیلتر دسته
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) {
        return false;
      }

      // فیلتر متنی
      if (q) {
        const inTitle = (tx.title || '').toLowerCase().includes(q);
        const inDesc = (tx.description || '').toLowerCase().includes(q);
        const inPerson = (tx.personName || '').toLowerCase().includes(q);
        const inAmt = String(tx.amount || '').includes(q);
        if (!inTitle && !inDesc && !inPerson && !inAmt) return false;
      }

      return true;
    });
  }, [rawTransactions, dateFilter, customStart, customEnd, categoryFilter, searchQuery]);

  // خروجی اکسل معین
  const handleExportExcel = useCallback(() => {
    if (rawTransactions.length === 0 && initialBalance === 0) {
      alert(language === 'fa' ? 'هیچ تراکنشی در این حساب یافت نشد.' : 'هیچ مامەڵەیەک نییە.');
      return;
    }

    const rows = [
      {
        'ردیف': 'افتتاحیه',
        'تاریخ': '-',
        'نوع عملیات': 'موجودی اولیه حساب',
        'شرح و بابت': 'ثبت اولیه حساب / صندوق',
        'طرف‌حساب': account?.keeperName || account?.holderName || '-',
        'وارده (ورودی)': initialBalance,
        'صادره (خروجی)': 0,
        'مانده لحظه‌ای': initialBalance,
        'واحد پول': currency
      },
      ...filteredTransactions.map((tx, idx) => ({
        'ردیف': idx + 1,
        'تاریخ': `${tx.rawDate || ''} ${tx.time || ''}`.trim(),
        'نوع عملیات': tx.categoryLabel || tx.type,
        'شرح و بابت': tx.title || '',
        'طرف‌حساب': tx.personName || '',
        'وارده (ورودی)': tx.type === 'inflow' ? tx.amount : 0,
        'صادره (خروجی)': tx.type === 'outflow' ? tx.amount : 0,
        'مانده لحظه‌ای': tx.runningBalance,
        'واحد پول': currency
      }))
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SubsidiaryLedger');
    const safeName = (account?.name || 'Account').replace(/\s+/g, '_');
    const fileName = `KarSync_Ledger_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [rawTransactions, filteredTransactions, initialBalance, account, currency, language]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* نوار ناوبری بالا */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
          >
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span>{language === 'fa' ? 'بازگشت به نمای کلی حسابداری' : 'گەڕانەوە'}</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700">/</span>

          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {language === 'fa' ? 'دفتر معین اختصاصی' : 'دەفتەری تایبەتی معین'}
          </span>
        </div>

        {/* سوییچ سریع بین سایر حساب‌ها و صندوق‌ها */}
        {allAccounts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden md:inline">
              {language === 'fa' ? 'تغییر حساب:' : 'گۆڕینی حیساب:'}
            </span>
            <select
              value={account?.id || ''}
              onChange={(e) => {
                const target = allAccounts.find((a) => a.id === e.target.value);
                if (target && onSelectAccount) onSelectAccount(target);
              }}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              {allAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.type === 'bank' ? '💳 ' : '🪙 '}
                  {acc.name}
                  {acc.isDefault ? ' (پیش‌فرض)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* بنر مشخصات حساب انتخاب شده */}
      <div className={`p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden ${
        isBank 
          ? 'bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-transparent border-sky-500/30 dark:border-sky-500/20'
          : 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 dark:border-amber-500/20'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
              isBank 
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-sky-500/25'
                : 'bg-gradient-to-tr from-amber-500 to-amber-700 text-white shadow-amber-500/25'
            }`}>
              {isBank ? <CreditCard className="w-7 h-7 stroke-[2.2]" /> : <Coins className="w-7 h-7 stroke-[2.2]" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {account?.name}
                </h2>
                {account?.isDefault && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950">
                    <Star className="w-3 h-3 fill-amber-950" />
                    <span>حساب پیش‌فرض</span>
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isBank 
                    ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                }`}>
                  {isBank ? 'کارت بانکی' : 'صندوق وجه نقد'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {isBank ? (
                  <>
                    <span>بانک: <strong className="text-slate-700 dark:text-slate-300">{account?.bankName || '-'}</strong></span>
                    {account?.cardNumber && (
                      <span dir="ltr" className="font-mono text-slate-700 dark:text-slate-300">
                        کارت: {account.cardNumber}
                      </span>
                    )}
                    {account?.holderName && (
                      <span>صاحب کارت: <strong className="text-slate-700 dark:text-slate-300">{account.holderName}</strong></span>
                    )}
                  </>
                ) : (
                  <>
                    <span>مسئول صندوق: <strong className="text-slate-700 dark:text-slate-300">{account?.keeperName || 'سرپرست کارگاه'}</strong></span>
                    {account?.notes && <span className="truncate max-w-xs">{account.notes}</span>}
                  </>
                )}

                {/* سیاست اضافه برداشت */}
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <ShieldAlert className="w-3 h-3 text-amber-500" />
                  <span>
                    برداشت مازاد: {
                      account?.overdraftPolicy === 'always_allow' ? 'همیشه مجاز' :
                      account?.overdraftPolicy === 'never_allow' ? 'همیشه نامجاز' :
                      account?.overdraftPolicy === 'ask_each_time' ? 'پرسش در هر بار' : 'پیروی از تنظیمات سراسری'
                    }
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* دکمه‌های سریع برای همین حساب */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {onQuickDeposit && (
              <button
                type="button"
                onClick={() => onQuickDeposit(account)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'fa' ? 'شارژ این حساب' : 'زیادکردنی بودجە'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'fa' ? 'خروجی اکسل معین' : 'ئێکسڵ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ۴ کارت خلاصه وضعیت مالی این حساب */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* ۱. موجودی اولیه */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {language === 'fa' ? 'موجودی اولیه حساب' : 'باڵانسی سەرەتایی'}
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-800 dark:text-slate-200" dir="ltr">
            {formatCurrency(initialBalance, currency, language)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            افتتاحیه ثبت شده
          </div>
        </div>

        {/* ۲. کل ورودی‌ها */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {language === 'fa' ? 'کل ورودی‌ها به این حساب' : 'کۆی داهاتەکان'}
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
            +{formatCurrency(totalInflow, currency, language)}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3" />
            <span>{accountData?.inflowsCount || 0} تراکنش واریزی</span>
          </div>
        </div>

        {/* ۳. کل خروجی‌ها */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {language === 'fa' ? 'کل پرداختی‌ها و مخارج' : 'کۆی خەرجییەکان'}
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-rose-600 dark:text-rose-400" dir="ltr">
            -{formatCurrency(totalOutflow, currency, language)}
          </div>
          <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>{accountData?.outflowsCount || 0} تراکنش پرداختی</span>
          </div>
        </div>

        {/* ۴. موجودی زنده و نهایی */}
        <div className={`p-4 rounded-3xl border shadow-xs ${
          isPositive
            ? 'bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/20'
            : 'bg-rose-500/15 border-rose-500/40 dark:border-rose-500/30'
        }`}>
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
            {language === 'fa' ? 'موجودی فعلی (مانده زنده)' : 'باڵانسی کۆتایی ئێستا'}
          </span>
          <div className={`text-lg sm:text-xl font-black font-mono ${
            isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`} dir="ltr">
            {formatCurrency(currentBalance, currency, language)}
          </div>
          <div className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${
            isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
          }`}>
            {isPositive ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>موجودی مثبت و پایدار</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3" />
                <span>کسری صندوق / اضافه برداشت</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* بخش دفتر معین: دکمه شاخص + جدول ساده و روان */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* هدر دفتر معین */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
              <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  معین {account?.name}
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                  {filteredTransactions.length} تراکنش
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'fa' 
                  ? 'گردش حساب و دفتر معین با محاسبه لحظه‌ای مانده پس از هر دریافت و پرداخت' 
                  : 'دەفتەری معینی تەنخوا و خەرجی بەپێی بەروار'}
              </p>
            </div>
          </div>

          {/* فیلترها و جستجو */}
          <div className="flex flex-wrap items-center gap-2">
            {/* فیلتر تاریخ */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">همه تاریخ‌ها</option>
              <option value="this_month">این ماه</option>
              <option value="last_month">ماه گذشته</option>
              <option value="custom">بازه سفارشی</option>
            </select>

            {/* فیلتر دسته */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">همه بابت‌ها</option>
              <option value="petty_cash">شارژ تنخواه و واریزی</option>
              <option value="worker_settlement">تسویه حساب دستمزد</option>
              <option value="advance_payment">مساعده پرسنل</option>
              <option value="workshop_expense">فاکتور و هزینه کارگاه</option>
            </select>

            {/* جستجو */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در معین..."
                className="w-36 sm:w-44 h-9 ps-7 pe-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* فیلتر تاریخ سفارشی در صورت انتخاب */}
        {dateFilter === 'custom' && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400">بازه سفارشی:</span>
            <div className="flex items-center gap-1.5">
              <span>از:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span>تا:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>
        )}

        {/* جدول معین ساده و شفاف */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-3.5 text-center w-12">#</th>
                <th className="py-3 px-3.5 whitespace-nowrap">تاریخ و زمان</th>
                <th className="py-3 px-3.5 whitespace-nowrap">بابت / سرفصل</th>
                <th className="py-3 px-3.5 min-w-[200px]">شرح و توضیحات تراکنش</th>
                <th className="py-3 px-3.5 whitespace-nowrap">طرف‌حساب</th>
                <th className="py-3 px-3.5 whitespace-nowrap text-emerald-600 dark:text-emerald-400">وارده (ورودی +)</th>
                <th className="py-3 px-3.5 whitespace-nowrap text-rose-600 dark:text-rose-400">صادره (خروجی -)</th>
                <th className="py-3 px-3.5 whitespace-nowrap">مانده لحظه‌ای</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">منبع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal">
              {/* ردیف افتتاحیه / موجودی اولیه */}
              <tr className="bg-amber-50/30 dark:bg-amber-950/15 font-semibold text-slate-700 dark:text-slate-300">
                <td className="py-3 px-3.5 text-center text-amber-600 dark:text-amber-400 font-bold">
                  ★
                </td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-400">
                  افتتاحیه
                </td>
                <td className="py-3 px-3.5">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    موجودی اولیه
                  </span>
                </td>
                <td className="py-3 px-3.5">
                  ثبت موجودی اولیه هنگام افتتاح حساب در سیستم
                </td>
                <td className="py-3 px-3.5 text-slate-500">
                  {account?.keeperName || account?.holderName || 'سرپرست'}
                </td>
                <td className="py-3 px-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                  {initialBalance > 0 ? `+${formatAmount(initialBalance, currency)}` : '-'}
                </td>
                <td className="py-3 px-3.5 font-mono text-slate-400" dir="ltr">
                  -
                </td>
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                  {formatCurrency(initialBalance, currency, language)}
                </td>
                <td className="py-3 px-3.5 text-center">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500">
                    پایه
                  </span>
                </td>
              </tr>

              {/* ردیف‌های تراکنش‌ها */}
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {language === 'fa' 
                      ? 'هیچ تراکنشی منطبق با فیلتر انتخابی برای این حساب ثبت نشده است.' 
                      : 'هیچ مامەڵەیەک نەدۆزرایەوە.'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, idx) => {
                  const isInflow = tx.type === 'inflow';
                  const isPosBalance = tx.runningBalance >= 0;

                  return (
                    <tr 
                      key={tx.id + '_' + idx}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                        <div>{tx.rawDate}</div>
                        {tx.time && <div className="text-[10px] text-slate-400">{tx.time}</div>}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.category === 'petty_cash'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : tx.category === 'worker_settlement'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : tx.category === 'advance_payment'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {tx.categoryLabel}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 dark:text-white max-w-sm truncate">
                          {tx.title}
                        </div>
                        {tx.description && (
                          <div className="text-[11px] text-slate-400 max-w-sm truncate mt-0.5">
                            {tx.description}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {tx.personName || '-'}
                      </td>

                      {/* وارده */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                        {isInflow ? `+${formatAmount(tx.amount, currency)}` : '-'}
                      </td>

                      {/* صادره */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                        {!isInflow ? `-${formatAmount(tx.amount, currency)}` : '-'}
                      </td>

                      {/* مانده لحظه‌ای */}
                      <td className={`py-3 px-3.5 whitespace-nowrap font-mono font-bold ${
                        isPosBalance ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                      }`} dir="ltr">
                        {formatCurrency(tx.runningBalance, currency, language)}
                      </td>

                      {/* منبع */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {tx.isSystem ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500">
                            <Lock className="w-2.5 h-2.5 text-slate-400" />
                            <span>سیستمی</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            <span>دستی</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* سطر پایانی: سرجمع معین */}
            <tfoot className="bg-slate-50/90 dark:bg-slate-800/80 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
              <tr>
                <td colSpan={5} className="py-3 px-3.5 text-start">
                  سرجمع و مانده نهایی معین:
                </td>
                <td className="py-3 px-3.5 font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                  +{formatAmount(totalInflow, currency)}
                </td>
                <td className="py-3 px-3.5 font-mono text-rose-600 dark:text-rose-400" dir="ltr">
                  -{formatAmount(totalOutflow, currency)}
                </td>
                <td className={`py-3 px-3.5 font-mono text-sm ${
                  isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`} dir="ltr">
                  {formatCurrency(currentBalance, currency, language)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
export default AccountSubsidiaryLedgerSection;
