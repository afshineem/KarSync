import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { db, DEFAULT_PROJECT_ID } from '../../db/db';
import { useProject } from '../../context/ProjectContext';
import { formatCurrency, formatAmount } from '../../utils/formatters';
import { useAccounting } from '../../hooks/useAccounting';
import { 
  CreditCard, 
  Coins, 
  Star, 
  ArrowUpRight, 
  ArrowDownLeft, 
  X,
  Search,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  User,
  UserX,
  Briefcase,
  Calendar,
  Layers
} from 'lucide-react';

/**
 * AccountSubsidiaryLedgerModal
 * مودال فول‌اسکرین، اختصاصی و بدون حاشیه برای مشاهده معین مالی حساب‌ها و پرسنل
 * - پوشش ۱۰۰٪ تمام‌صفحه بدون کادر و پدینگ بیرونی
 * - پشتیبانی همزمان از معین حساب‌های بانکی/صندوق‌ها و معین مالی پرسنل (ورودی‌ها و خروجی‌ها)
 * - بدون دکمه‌های عملیاتی مزاحم (شارژ، واریز، ثبت لاگ)؛ صرفاً نمایش خالص گردش حساب
 * - بسته شدن سریع با کلید Escape یا دکمه ضربدر
 * - دارای جدول فیلترپذیر ریزتراکنش‌ها با محاسبه لحظه‌ای مانده (Running Balance)
 * - امکان خروجی فایل اکسل
 */
export function AccountSubsidiaryLedgerModal({
  isOpen,
  entity, // { type: 'account', data: account } | { type: 'worker', data: worker }
  accountData, // داده‌های مانده حساب (در صورت ارسال از بیرون)
  currency = 'IQD',
  language = 'fa',
  allAccounts = [],
  allWorkers = [],
  onSelectEntity,
  onClose
}) {
  const { currentProject } = useProject();
  const targetProjectId = currentProject?.id || DEFAULT_PROJECT_ID;

  // هوک مالی حسابداری برای تأمین مستقل داده‌های حساب‌ها در صورت فراخوانی از تب‌های غیرحسابداری
  const accounting = useAccounting();
  const effectiveCurrency = currency || accounting?.currency || 'IQD';
  const effectiveAccounts = (allAccounts && allAccounts.length > 0) ? allAccounts : (accounting?.financialAccounts || []);
  const effectiveWorkers = (allWorkers && allWorkers.length > 0) ? allWorkers : (accounting?.workers || []);

  const isRtl = language === 'fa' || language === 'ku';
  const entityType = entity?.type || 'account'; // 'account' | 'worker'
  const entityData = entity?.data || entity;

  const effectiveAccountData = accountData || (entityType === 'account' && entityData?.id ? accounting?.accountBalances?.get(String(entityData.id)) : null);

  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // بستن مودال با کلید Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ۱. بارگذاری اطلاعات تکمیلی پرسنل در صورت انتخاب پرسنل
  const workerId = entityType === 'worker' ? String(entityData?.id) : null;

  const workerLogs = useLiveQuery(
    async () => {
      if (!workerId) return [];
      try {
        const list = await db.attendanceLogs.where('workerId').equals(entityData.id).toArray();
        return list.filter((l) => !l.deletedAt);
      } catch (_) {
        return [];
      }
    },
    [workerId]
  ) || [];

  const workerPayments = useLiveQuery(
    async () => {
      if (!workerId) return [];
      try {
        const list = await db.payments.where('workerId').equals(entityData.id).toArray();
        return list.filter((p) => !p.deletedAt && p.status !== 'deleted');
      } catch (_) {
        return [];
      }
    },
    [workerId]
  ) || [];

  const groups = useLiveQuery(
    async () => {
      try {
        const list = await db.groups.toArray();
        return list.filter((g) => !g.deletedAt);
      } catch (_) {
        return [];
      }
    },
    []
  ) || [];

  const groupMap = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => map.set(String(g.id), g.name));
    return map;
  }, [groups]);

  // محاسبه تراکنش‌های معین برای پرسنل (طلب کارکرد = ورودی، مساعده و تسویه = خروجی)
  const workerTransactionsData = useMemo(() => {
    if (entityType !== 'worker' || !entityData) {
      return { rawTransactions: [], initialBalance: 0, totalInflow: 0, totalOutflow: 0, currentBalance: 0 };
    }

    const wDaily = Number(String(entityData.dailyRate || 0).replace(/,/g, '')) || 0;
    const wOtRate = Number(String(entityData.overtimeHourlyRate || 0).replace(/,/g, '')) || 0;

    const getLogPay = (l) => {
      let val = Number(l.totalDayPay);
      if (!isNaN(val) && val > 0) return val;
      const otH = Math.max(0, Number(l.overtimeHours) || 0);
      if (l.type === 'half') return (wDaily * 0.5) + (otH * wOtRate);
      if (l.type === 'hourly') return otH * (wOtRate || (wDaily / 8));
      return wDaily + (otH * wOtRate);
    };

    // ترکیب و مرتب‌سازی رویدادها بر اساس تاریخ
    const combinedEvents = [];

    // الف) کارکردها و دستمزدها (طلب کارگر - ورودی به حساب کارگر)
    workerLogs.forEach((l) => {
      const pay = getLogPay(l);
      const catLabel = l.type === 'half'
        ? (language === 'fa' ? 'نیم‌روز کارکرد' : 'نیوەڕۆژ')
        : l.type === 'hourly'
        ? (language === 'fa' ? 'ساعتی' : 'کاتژمێری')
        : (language === 'fa' ? 'کارکرد روزانه' : 'ئامادەبوونی ڕۆژانە');

      const desc = l.note || (
        language === 'fa'
          ? `ثبت کارکرد: ${l.hours || 8} ساعت${l.overtimeHours ? ` + ${l.overtimeHours} ساعت اضافه` : ''}`
          : `ئامادەبوون: ${l.hours || 8} کاتژمێر`
      );

      combinedEvents.push({
        id: `log_${l.id}`,
        rawDate: l.date || '',
        date: l.date || '',
        time: '',
        category: 'attendance_wage',
        categoryLabel: catLabel,
        description: desc,
        counterparty: entityData.name,
        type: 'inflow',
        amount: pay,
        sourceLabel: language === 'fa' ? 'حضور و غیاب' : 'ئامادەبوون'
      });
    });

    // ب) پرداخت‌ها: مساعده‌ها و تسویه‌حساب‌ها (پرداختی به کارگر - خروجی از حساب کارگر)
    workerPayments.forEach((p) => {
      const isAdvance = p.type === 'advance' || p.type === 'Advance_Payment';
      const cat = isAdvance ? 'advance_payment' : 'worker_settlement';
      const catLabel = isAdvance
        ? (language === 'fa' ? 'پرداخت مساعده' : 'تەنخوا/مساعدە')
        : (language === 'fa' ? 'تسویه حساب دستمزد' : 'تەسویەی حیساب');

      const desc = p.note || p.description || (
        isAdvance 
          ? (language === 'fa' ? 'پرداخت مساعده نقدی/بانکی' : 'پێدانی مساعدە')
          : (language === 'fa' ? 'پرداخت تسویه حساب کارکرد' : 'تەسویەی پارەی کارکردن')
      );

      combinedEvents.push({
        id: `pay_${p.id}`,
        rawDate: (p.date || p.createdAt || '').slice(0, 10),
        date: (p.date || p.createdAt || '').slice(0, 10),
        time: (p.createdAt || '').slice(11, 16),
        category: cat,
        categoryLabel: catLabel,
        description: desc,
        counterparty: entityData.name,
        type: 'outflow',
        amount: Number(p.amount) || 0,
        sourceLabel: language === 'fa' ? 'پرداخت مالی' : 'پارەدان'
      });
    });

    // مرتب‌سازی زمانی از قدیم به جدید برای محاسبه Running Balance دقیق
    combinedEvents.sort((a, b) => (a.rawDate || '').localeCompare(b.rawDate || ''));

    let running = 0;
    let totalIn = 0;
    let totalOut = 0;

    combinedEvents.forEach((ev) => {
      if (ev.type === 'inflow') {
        running += ev.amount;
        totalIn += ev.amount;
      } else {
        running -= ev.amount;
        totalOut += ev.amount;
      }
      ev.runningBalance = running;
    });

    // معکوس کردن برای نمایش از جدیدترین به قدیمی‌ترین
    const rawTransactions = [...combinedEvents].reverse();

    return {
      rawTransactions,
      initialBalance: 0,
      totalInflow: totalIn,
      totalOutflow: totalOut,
      currentBalance: running // مانده طلب فعلی کارگر
    };
  }, [entityType, entityData, workerLogs, workerPayments, language]);

  // تشخیص مقادیر حساب یا پرسنل
  const isBank = entityType === 'account' && entityData?.type === 'bank';
  const isCash = entityType === 'account' && entityData?.type === 'cash';
  const isWorker = entityType === 'worker';
  const initialBalance = isWorker ? 0 : (Number(effectiveAccountData?.initialBalance) || 0);
  const currentBalance = isWorker ? workerTransactionsData.currentBalance : (Number(effectiveAccountData?.currentBalance) || 0);
  const totalInflow = isWorker ? workerTransactionsData.totalInflow : (Number(effectiveAccountData?.totalInflow) || 0);
  const totalOutflow = isWorker ? workerTransactionsData.totalOutflow : (Number(effectiveAccountData?.totalOutflow) || 0);
  const isPositive = currentBalance >= 0;

  const rawTransactions = isWorker ? workerTransactionsData.rawTransactions : (effectiveAccountData?.transactions || []);

  // فیلتر تراکنش‌ها
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
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const partyMatch = (tx.counterparty || '').toLowerCase().includes(q);
        const refMatch = (tx.reference || '').toLowerCase().includes(q);
        const catMatch = (tx.categoryLabel || '').toLowerCase().includes(q);
        if (!descMatch && !partyMatch && !refMatch && !catMatch) return false;
      }

      return true;
    });
  }, [rawTransactions, dateFilter, customStart, customEnd, categoryFilter, searchQuery]);

  // خروجی اکسل
  const handleExportExcel = useCallback(() => {
    const rows = [
      ...(isWorker ? [] : [{
        'ردیف': 'افتتاحیه',
        'تاریخ': '-',
        'ساعت': '-',
        'بابت / سرفصل': 'موجودی اولیه حساب',
        'شرح تراکنش': 'موجودی اولیه ثبت شده هنگام افتتاح حساب در سیستم',
        'طرف حساب': entityData?.keeperName || entityData?.holderName || 'سرپرست',
        'وارده (ورودی +)': initialBalance,
        'صادره (خروجی -)': 0,
        'مانده لحظه‌ای': initialBalance,
        'واحد پول': currency
      }]),
      ...filteredTransactions.map((tx, idx) => ({
        'ردیف': idx + 1,
        'تاریخ': tx.rawDate || tx.date,
        'ساعت': tx.time || '-',
        'بابت / سرفصل': tx.categoryLabel || tx.category,
        'شرح تراکنش': tx.description || '-',
        'طرف حساب': tx.counterparty || '-',
        'وارده (ورودی +)': tx.type === 'inflow' ? tx.amount : 0,
        'صادره (خروجی -)': tx.type === 'outflow' ? tx.amount : 0,
        'مانده لحظه‌ای': tx.runningBalance,
        'واحد پول': currency
      }))
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SubsidiaryLedger');
    const safeName = (entityData?.name || 'Ledger').replace(/\s+/g, '_');
    const fileName = `KarSync_Ledger_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [filteredTransactions, initialBalance, entityData, currency, isWorker]);

  if (!isOpen || !entityData) return null;

  const groupName = isWorker && entityData.groupId ? groupMap.get(String(entityData.groupId)) : null;

  const modalContent = (
    <div
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !p-0 z-[100] w-screen h-[100dvh] max-h-[100dvh] bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      {/* هدر بالایی تمام‌صفحه */}
      <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          {/* آیکون هویت */}
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
            isWorker
              ? (entityData?.isActive !== 0 && entityData?.isActive !== false
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-emerald-500/25'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400')
              : isBank 
              ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-sky-500/25'
              : 'bg-gradient-to-tr from-amber-500 to-amber-700 text-white shadow-amber-500/25'
          }`}>
            {isWorker ? (
              entityData?.isActive !== 0 && entityData?.isActive !== false ? <User className="w-6 h-6 stroke-[2.2]" /> : <UserX className="w-6 h-6 stroke-[2.2]" />
            ) : isBank ? (
              <CreditCard className="w-6 h-6 stroke-[2.2]" />
            ) : (
              <Wallet className="w-6 h-6 stroke-[2.2]" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {language === 'fa' 
                  ? `معین گردش مالی: ${entityData?.name}` 
                  : `دەفتەری دارایی: ${entityData?.name}`}
              </h2>

              {/* برچسب‌ها */}
              {isWorker ? (
                entityData?.isActive !== 0 && entityData?.isActive !== false ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                    {language === 'fa' ? 'پرسنل فعال' : 'چالاک'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {language === 'fa' ? 'پرسنل غیرفعال' : 'ناچالاک'}
                  </span>
                )
              ) : (
                <>
                  {entityData?.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950">
                      <Star className="w-3 h-3 fill-amber-950" />
                      <span>پیش‌فرض</span>
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isBank 
                      ? 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300'
                      : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                  }`}>
                    {isBank ? 'کارت بانکی' : 'صندوق نقدی'}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isWorker ? (
                <>
                  {groupName && <span>گروه: <strong className="text-slate-700 dark:text-slate-300">{groupName}</strong></span>}
                  {entityData?.role && <span>سمت: <strong className="text-slate-700 dark:text-slate-300">{entityData.role}</strong></span>}
                  {entityData?.phone && <span dir="ltr" className="font-mono text-slate-600 dark:text-slate-400">{entityData.phone}</span>}
                </>
              ) : isBank ? (
                <>
                  <span>بانک: <strong className="text-slate-700 dark:text-slate-300">{entityData?.bankName || '-'}</strong></span>
                  {entityData?.cardNumber && (
                    <span dir="ltr" className="font-mono text-slate-700 dark:text-slate-300">
                      کارت: {entityData.cardNumber}
                    </span>
                  )}
                </>
              ) : (
                <span>مسئول صندوق: <strong className="text-slate-700 dark:text-slate-300">{entityData?.keeperName || 'سرپرست کارگاه'}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* دکمه‌های کنترل هدر */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* سوییچ سریع حساب / پرسنل */}
          {entityType === 'account' && effectiveAccounts.length > 1 && (
            <select
              value={entityData?.id || ''}
              onChange={(e) => {
                const target = effectiveAccounts.find((a) => a.id === e.target.value);
                if (target && onSelectEntity) onSelectEntity({ type: 'account', data: target });
              }}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              {effectiveAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.type === 'bank' ? '💳 ' : '🪙 '}
                  {acc.name}
                  {acc.isDefault ? ' (پیش‌فرض)' : ''}
                </option>
              ))}
            </select>
          )}

          {entityType === 'worker' && effectiveWorkers.length > 1 && (
            <select
              value={entityData?.id || ''}
              onChange={(e) => {
                const target = effectiveWorkers.find((w) => String(w.id) === e.target.value);
                if (target && onSelectEntity) onSelectEntity({ type: 'worker', data: target });
              }}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[160px] truncate"
            >
              {effectiveWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  👤 {w.name} {w.isActive === 0 ? '(غیرفعال)' : ''}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="h-9 px-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all shadow-xs"
            title="خروجی فایل اکسل"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === 'fa' ? 'خروجی اکسل' : 'ئێکسڵ'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* نوار فشرده خلاصه وضعیت مالی و مانده زنده (صرفاً داده‌ها بدون دکمه شارژ و واریز) */}
      <div className="px-4 py-3 sm:px-6 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* ۱. افتتاحیه / مبنا */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
              {isWorker 
                ? (language === 'fa' ? 'کل رکوردهای مالی' : 'کۆی تۆمارەکان')
                : (language === 'fa' ? 'موجودی اولیه حساب' : 'باڵانسی سەرەتایی')}
            </span>
            <div className="text-sm sm:text-base font-black font-mono text-slate-800 dark:text-slate-100 truncate" dir="ltr">
              {isWorker 
                ? `${rawTransactions.length} ردیف سند`
                : formatCurrency(initialBalance, currency, language)}
            </div>
          </div>

          {/* ۲. کل وارده (ورودی +) */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
              {isWorker 
                ? (language === 'fa' ? 'کل مطالبات کارکرد (بستانکار +)' : 'کۆی حەقدەست (+)')
                : (language === 'fa' ? 'کل وارده (ورودی +)' : 'کۆی داهات (+) ')}
            </span>
            <div className="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-emerald-400 truncate" dir="ltr">
              +{formatCurrency(totalInflow, currency, language)}
            </div>
          </div>

          {/* ۳. کل صادره (خروجی -) */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block mb-0.5">
              {isWorker 
                ? (language === 'fa' ? 'کل پرداختی‌ها و تسویه‌ها (بدهکار -)' : 'کۆی پارەدراوەکان (-)')
                : (language === 'fa' ? 'کل صادره (خروجی -)' : 'کۆی خەرجی (-)')}
            </span>
            <div className="text-sm sm:text-base font-black font-mono text-rose-600 dark:text-rose-400 truncate" dir="ltr">
              -{formatCurrency(totalOutflow, currency, language)}
            </div>
          </div>

          {/* ۴. مانده زنده */}
          <div className={`p-2.5 sm:p-3 rounded-2xl border shadow-xs ${
            isPositive
              ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 dark:border-emerald-500/30'
              : 'bg-rose-500/15 dark:bg-rose-500/20 border-rose-500/40 dark:border-rose-500/30'
          }`}>
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-0.5">
              {isWorker 
                ? (language === 'fa' ? 'مانده طلب نهایی پرسنل' : 'شایستەی کۆتایی کارمەند')
                : (language === 'fa' ? 'مانده زنده فعلی' : 'باڵانسی کۆتایی')}
            </span>
            <div className={`text-sm sm:text-base font-black font-mono truncate ${
              isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`} dir="ltr">
              {formatCurrency(currentBalance, currency, language)}
            </div>
          </div>
        </div>
      </div>

      {/* نوار فیلتر و جستجو */}
      <div className="p-3 sm:px-6 border-b border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {filteredTransactions.length} {language === 'fa' ? 'سند و گردش مالی' : 'تۆماری دارایی'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* فیلتر تاریخ */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
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
            className="h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">همه سرفصل‌ها</option>
            {isWorker ? (
              <>
                <option value="attendance_wage">کارکرد و دستمزد</option>
                <option value="advance_payment">مساعده</option>
                <option value="worker_settlement">تسویه حساب دستمزد</option>
              </>
            ) : (
              <>
                <option value="petty_cash">شارژ تنخواه و واریزی</option>
                <option value="worker_settlement">تسویه حساب دستمزد</option>
                <option value="advance_payment">مساعده پرسنل</option>
                <option value="workshop_expense">فاکتور و هزینه کارگاه</option>
              </>
            )}
          </select>

          {/* جستجو */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در شرح سند..."
              className="w-40 sm:w-52 h-8 ps-7 pe-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* فیلتر تاریخ سفارشی */}
      {dateFilter === 'custom' && (
        <div className="p-2.5 px-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs shrink-0 text-slate-700 dark:text-slate-300">
          <span className="font-bold text-slate-600 dark:text-slate-400">بازه سفارشی:</span>
          <div className="flex items-center gap-1.5">
            <span>از:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-7 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span>تا:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-7 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      )}

      {/* جدول معین ورودی و خروجی با سرستون‌های چسبان (Sticky) و اسکرول مستقل */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-950">
        <table className="w-full text-right text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 shadow-xs border-b border-slate-200 dark:border-slate-800">
            <tr className="text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <th className="py-3 px-3.5 text-center w-12">#</th>
              <th className="py-3 px-3.5 whitespace-nowrap">تاریخ و زمان</th>
              <th className="py-3 px-3.5 whitespace-nowrap">بابت / سرفصل</th>
              <th className="py-3 px-3.5 min-w-[200px]">شرح و توضیحات تراکنش</th>
              <th className="py-3 px-3.5 whitespace-nowrap">طرف‌حساب</th>
              <th className="py-3 px-3.5 whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                {isWorker ? 'طلب / بستانکار (+)' : 'وارده (ورودی +)'}
              </th>
              <th className="py-3 px-3.5 whitespace-nowrap text-rose-600 dark:text-rose-400">
                {isWorker ? 'پرداختی / بدهکار (-)' : 'صادره (خروجی -)'}
              </th>
              <th className="py-3 px-3.5 whitespace-nowrap">مانده لحظه‌ای</th>
              <th className="py-3 px-3.5 text-center whitespace-nowrap">منبع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-normal">
            {/* ردیف افتتاحیه برای حساب‌ها */}
            {!isWorker && initialBalance > 0 && (
              <tr className="bg-amber-50/50 dark:bg-amber-950/25 font-semibold text-slate-700 dark:text-slate-200 border-b border-amber-200/50 dark:border-amber-900/30">
                <td className="py-3 px-3.5 text-center text-amber-600 dark:text-amber-400 font-bold">
                  ★
                </td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-400 dark:text-slate-400">
                  افتتاحیه
                </td>
                <td className="py-3 px-3.5">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    موجودی اولیه
                  </span>
                </td>
                <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200">
                  ثبت موجودی اولیه هنگام افتتاح حساب در سیستم
                </td>
                <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">
                  {entityData?.keeperName || entityData?.holderName || 'سرپرست'}
                </td>
                <td className="py-3 px-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                  +{formatAmount(initialBalance, currency)}
                </td>
                <td className="py-3 px-3.5 font-mono text-slate-400 dark:text-slate-500" dir="ltr">
                  -
                </td>
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                  {formatCurrency(initialBalance, currency, language)}
                </td>
                <td className="py-3 px-3.5 text-center">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                    پایه
                  </span>
                </td>
              </tr>
            )}

            {/* ردیف‌های تراکنش‌ها */}
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  {language === 'fa' 
                    ? 'هیچ گردش مالی یا تراکنشی منطبق با فیلتر انتخابی یافت نشد.' 
                    : 'هیچ مامەڵەیەک نەدۆزرایەوە.'}
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, idx) => {
                return (
                  <tr 
                    key={tx.id + '_' + idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <td className="py-3 px-3.5 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                      <div>{tx.rawDate}</div>
                      {tx.time && <div className="text-[10px] text-slate-400 dark:text-slate-500">{tx.time}</div>}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.category === 'attendance_wage'
                          ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                          : tx.category === 'petty_cash'
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

                    <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200">
                      <div>{tx.description}</div>
                      {tx.reference && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          شماره ارجاع: {tx.reference}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                      {tx.counterparty || '-'}
                    </td>

                    {/* وارده / طلب */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                      {tx.type === 'inflow' ? `+${formatAmount(tx.amount, currency)}` : '-'}
                    </td>

                    {/* صادره / پرداختی */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                      {tx.type === 'outflow' ? `-${formatAmount(tx.amount, currency)}` : '-'}
                    </td>

                    {/* مانده لحظه‌ای */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold" dir="ltr">
                      <span className={tx.runningBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}>
                        {formatCurrency(tx.runningBalance, currency, language)}
                      </span>
                    </td>

                    {/* منبع سند */}
                    <td className="py-3 px-3.5 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                        {tx.sourceLabel || 'سند'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* فوتر ساده تمام‌صفحه */}
      <div className="px-4 py-2.5 sm:px-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
        <span>{language === 'fa' ? 'برای بستن پنجره معین، کلید Esc را بفشارید.' : 'بۆ داخستن، دوگمەی Esc بکە.'}</span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-700 transition-all"
        >
          {language === 'fa' ? 'بستن پنجره معین' : 'داخستن'}
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default AccountSubsidiaryLedgerModal;
