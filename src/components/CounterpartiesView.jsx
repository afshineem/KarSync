import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { AddCounterpartyModal } from './AddCounterpartyModal';
import { 
  Briefcase, 
  Plus, 
  Search, 
  User, 
  Phone, 
  Building2, 
  Trash2, 
  Edit2, 
  FileSpreadsheet, 
  Filter, 
  ExternalLink,
  Coins,
  Receipt,
  Users
} from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../utils/formatters';
import { deleteCounterpartyLive, pullCounterpartiesLive } from '../services/realtimeSync';

const VIEW_COPY = {
  fa: {
    heroTitle: 'مدیریت و حسابداری طرف‌حساب‌ها',
    countBadge: (n) => `${n} شخص`,
    heroSubtitle: 'پیگیری قراردادها، سرمایه‌گذاری کارفرمایان، مطالبات تامین‌کنندگان و صورت‌حساب معین',
    totalContractsLabel: 'مجموع ارزش قراردادهای فعال:',
    incomesFromEmployers: 'دریافتی از کارفرمایان (+)',
    expensesAndInvoices: 'فاکتورها و هزینه‌ها (-)',
    addCounterpartyBtn: 'تعریف طرف‌حساب جدید',
    searchPlaceholder: 'جستجو در نام، شرکت، شماره تماس...',
    tabAll: 'همه',
    tabEmployer: 'کارفرمایان',
    tabSupplier: 'تامین‌کنندگان',
    tabSubcontractor: 'پیمانکاران',
    roleEmployer: 'کارفرما / سرمایه‌گذار',
    roleSupplier: 'تامین‌کننده مصالح',
    roleSubcontractor: 'پیمانکار فرعی',
    roleOther: 'سایر اشخاص',
    inactiveBadge: 'راکد',
    editTooltip: 'ویرایش',
    deleteTooltip: 'حذف',
    deleteConfirm: (name) => `آیا از حذف طرف‌حساب "${name}" اطمینان دارید؟`,
    individualEntity: 'شخص حقیقی (بدون شرکت)',
    noPhone: 'شماره تماس ثبت نشده',
    injectedOrInvoices: (type) => type === 'employer' ? 'تزریق شده (دریافتی)' : 'فاکتورها/پرداختی',
    contractAmount: 'مبلغ قرارداد',
    notRegistered: 'ثبت نشده',
    viewLedgerBtn: 'مشاهده دفتر معین و صورت‌حساب',
    emptyTitle: 'طرف‌حسابی یافت نشد',
    emptySubtitle: 'می‌توانید با دکمه بالا یک طرف‌حساب، کارفرما یا تامین‌کننده جدید برای این پروژه ثبت نمایید.'
  },
  ku: {
    heroTitle: 'بەڕێوەبردنی لایەنەکانی حیساب',
    countBadge: (n) => `${n} لایەن`,
    heroSubtitle: 'بەدواداچوونی گرێبەستەکان، وەبەرهێنانی خاوەنکار، شایستەی دابینکەران و دەفتەری موعەیەن',
    totalContractsLabel: 'کۆی بەهای گرێبەستە چالاکەکان:',
    incomesFromEmployers: 'وەرگیراو لە خاوەنکار (+)',
    expensesAndInvoices: 'فاکتۆر و خەرجییەکان (-)',
    addCounterpartyBtn: 'لایەنی حیسابی نوێ',
    searchPlaceholder: 'گەڕان بەدوای ناو، کۆمپانیا، ژمارەی تەلەفۆن...',
    tabAll: 'هەموو',
    tabEmployer: 'خاوەنکارەکان',
    tabSupplier: 'دابینکەران',
    tabSubcontractor: 'بەڵێندەرە لاوەکییەکان',
    roleEmployer: 'خاوەن کار / وەبەرهێنەر',
    roleSupplier: 'دابینکەری کەرەستە',
    roleSubcontractor: 'بەڵێندەری لاوەکی',
    roleOther: 'لایەنی تر',
    inactiveBadge: 'ناچالاک',
    editTooltip: 'دەستکاریکردن',
    deleteTooltip: 'سڕینەوە',
    deleteConfirm: (name) => `دڵنیایت لە سڕینەوەی "${name}"؟`,
    individualEntity: 'کەسی ئاسایی (بێ کۆمپانیا)',
    noPhone: 'ژمارەی تەلەفۆن تۆمار نەکراوە',
    injectedOrInvoices: (type) => type === 'employer' ? 'وەرگیراو (پێشەکی)' : 'فاکتۆر / پارەدان',
    contractAmount: 'بڕی گرێبەست',
    notRegistered: 'تۆمار نەکراوە',
    viewLedgerBtn: 'بینینی دەفتەری موعەیەن و حیساب',
    emptyTitle: 'هیچ لایەنێکی حیساب نەدۆزرایەوە',
    emptySubtitle: 'دەتوانیت بە دوگمەی سەرەوە لایەنێکی حیسابی، خاوەنکار یان دابینکەری نوێ تۆمار بکەیت.'
  },
  en: {
    heroTitle: 'Counterparties & Stakeholders Management',
    countBadge: (n) => `${n} Entities`,
    heroSubtitle: 'Track contracts, investor capital, supplier balances, and subsidiary ledger statements',
    totalContractsLabel: 'Total Active Contracts Value:',
    incomesFromEmployers: 'Inflows from Employers (+)',
    expensesAndInvoices: 'Invoices & Expenses (-)',
    addCounterpartyBtn: 'Add New Counterparty',
    searchPlaceholder: 'Search name, company, phone...',
    tabAll: 'All',
    tabEmployer: 'Employers',
    tabSupplier: 'Suppliers',
    tabSubcontractor: 'Subcontractors',
    roleEmployer: 'Employer / Investor',
    roleSupplier: 'Material Supplier',
    roleSubcontractor: 'Subcontractor',
    roleOther: 'Other Stakeholder',
    inactiveBadge: 'Inactive',
    editTooltip: 'Edit',
    deleteTooltip: 'Delete',
    deleteConfirm: (name) => `Are you sure you want to delete counterparty "${name}"?`,
    individualEntity: 'Individual (No Company)',
    noPhone: 'No phone registered',
    injectedOrInvoices: (type) => type === 'employer' ? 'Injected (Received)' : 'Invoices / Paid',
    contractAmount: 'Contract Value',
    notRegistered: 'Not Registered',
    viewLedgerBtn: 'View Subsidiary Ledger & Statement',
    emptyTitle: 'No counterparties found',
    emptySubtitle: 'You can register a new employer, supplier, or subcontractor using the button above.'
  }
};

export function CounterpartiesView() {
  const { language } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const c = VIEW_COPY[langKey] || VIEW_COPY.fa;

  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCounterparty, setEditingCounterparty] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  useEffect(() => {
    pullCounterpartiesLive(true).catch(console.warn);
  }, []);
  
  const counterparties = useLiveQuery(() => db.counterparties.toArray()) || [];
  const treasuryIncomes = useLiveQuery(() => db.treasuryIncomes ? db.treasuryIncomes.toArray() : []) || [];
  const expenses = useLiveQuery(() => db.expenses ? db.expenses.toArray() : []) || [];

  // Balances calculation (Incomes & Expenses tied to each counterparty)
  const cpBalances = useMemo(() => {
    const balances = {};
    treasuryIncomes.forEach(inc => {
      if (inc.counterpartyId && !inc.deletedAt) {
        balances[inc.counterpartyId] = (balances[inc.counterpartyId] || 0) + (Number(inc.amount) || 0);
      }
    });
    return balances;
  }, [treasuryIncomes]);

  const cpExpenseTotals = useMemo(() => {
    const expTotals = {};
    expenses.forEach(exp => {
      if (exp.counterpartyId && !exp.deletedAt) {
        expTotals[exp.counterpartyId] = (expTotals[exp.counterpartyId] || 0) + (Number(exp.amount) || 0);
      }
    });
    return expTotals;
  }, [expenses]);

  const filteredCounterparties = useMemo(() => {
    return counterparties.filter(cp => {
      const matchesSearch = 
        cp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cp.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cp.phone?.includes(searchQuery);

      const matchesType = selectedTypeFilter === 'all' || cp.type === selectedTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [counterparties, searchQuery, selectedTypeFilter]);

  const handleDelete = async (id, name) => {
    const confirmMsg = c.deleteConfirm(name);
      
    if (window.confirm(confirmMsg)) {
      try {
        await deleteCounterpartyLive(id);
      } catch (err) {
        console.error('Error deleting counterparty:', err);
      }
    }
  };

  const openLedgerForCounterparty = (cp) => {
    window.dispatchEvent(
      new CustomEvent('karsync-open-subsidiary-ledger', {
        detail: {
          id: cp.id,
          name: cp.name,
          type: 'counterparty',
          role: cp.type
        }
      })
    );
  };

  const getTypeName = (type) => {
    switch(type) {
      case 'employer': 
        return { label: c.roleEmployer, color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' };
      case 'supplier': 
        return { label: c.roleSupplier, color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
      case 'subcontractor': 
        return { label: c.roleSubcontractor, color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      default: 
        return { label: c.roleOther, color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  const counts = useMemo(() => {
    return {
      all: counterparties.length,
      employer: counterparties.filter(c => c.type === 'employer').length,
      supplier: counterparties.filter(c => c.type === 'supplier').length,
      subcontractor: counterparties.filter(c => c.type === 'subcontractor').length
    };
  }, [counterparties]);

  // محاسبه شاخص‌های تجمیعی برای بنر هیرو
  const aggregateMetrics = useMemo(() => {
    let totalContractValue = 0;
    let totalIncomes = 0;
    let totalExpenses = 0;

    counterparties.forEach(cp => {
      totalContractValue += Number(cp.contractValue) || 0;
      totalIncomes += cpBalances[cp.id] || 0;
      totalExpenses += cpExpenseTotals[cp.id] || 0;
    });

    return {
      totalContractValue,
      totalIncomes,
      totalExpenses
    };
  }, [counterparties, cpBalances, cpExpenseTotals]);

  return (
    <div className="space-y-5 pb-20 select-none">
      {/* ۱. بنر هیروی اجرایی لوکس (Executive Hero Banner) */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-white border border-white/10 shadow-2xl">
        {/* حباب‌های بلورین درخشان در پس‌زمینه */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* سمت راست: عنوان، آیکون و معرفی */}
          <div className="lg:col-span-7 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 shrink-0">
                <Briefcase className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {c.heroTitle}
                  </h1>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                    {c.countBadge(counterparties.length)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  {c.heroSubtitle}
                </p>
              </div>
            </div>

            {/* شاخص کلان قراردادها */}
            <div className="pt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-xs text-slate-400 font-medium">{c.totalContractsLabel}</span>
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white" dir="ltr">
                {formatCurrency(aggregateMetrics.totalContractValue, currency, language)}
              </span>
            </div>
          </div>

          {/* سمت چپ: ماتریس شاخص‌های مالی و دکمه عملیاتی سریع */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5 bg-white/5 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] text-emerald-300 block mb-1">{c.incomesFromEmployers}</span>
                <span className="text-xs sm:text-sm font-black font-mono text-emerald-400 block truncate" dir="ltr">
                  +{formatCurrency(aggregateMetrics.totalIncomes, currency, language)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] text-rose-300 block mb-1">{c.expensesAndInvoices}</span>
                <span className="text-xs sm:text-sm font-black font-mono text-rose-400 block truncate" dir="ltr">
                  -{formatCurrency(aggregateMetrics.totalExpenses, currency, language)}
                </span>
              </div>
            </div>

            {/* دکمه تعریف طرف‌حساب جدید */}
            <button 
              type="button"
              onClick={() => {
                setEditingCounterparty(null);
                setIsAddModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white py-3 px-4 rounded-2xl font-black text-xs transition-all shadow-lg shadow-sky-500/25 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{c.addCounterpartyBtn}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ۲. نوار فیلتر و جستجو (Glass Filter Bar) */}
      <div className="p-3 sm:px-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* جستجوی متنی */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={c.searchPlaceholder}
            className="w-full h-10 ps-10 pe-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs transition-all"
          />
        </div>

        {/* سگمنت تب‌های نقش طرف‌حساب */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto custom-scrollbar">
          {[
            { id: 'all', label: c.tabAll, count: counts.all },
            { id: 'employer', label: c.tabEmployer, count: counts.employer },
            { id: 'supplier', label: c.tabSupplier, count: counts.supplier },
            { id: 'subcontractor', label: c.tabSubcontractor, count: counts.subcontractor }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTypeFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                selectedTypeFilter === tab.id
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedTypeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ۳. گرید کارت‌های طرف‌حساب فراستد گلس (Apple Glass Cards Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {filteredCounterparties.map(cp => {
          const typeMeta = getTypeName(cp.type);
          const incomeTotal = cpBalances[cp.id] || 0;
          const expenseTotal = cpExpenseTotals[cp.id] || 0;

          return (
            <div 
              key={cp.id} 
              className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all flex flex-col justify-between group"
            >
              <div>
                {/* هدر کارت: آیکون، نام و دکمه‌های اقدام */}
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-slate-800 dark:text-slate-200 font-black text-base shadow-2xs shrink-0 group-hover:border-sky-300 dark:group-hover:border-sky-700 transition-colors">
                      {cp.name ? cp.name.charAt(0) : <User className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-snug">
                        {cp.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black border ${typeMeta.color}`}>
                          {typeMeta.label}
                        </span>
                        {cp.status === 'inactive' && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {c.inactiveBadge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* دکمه‌های اقدام */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingCounterparty(cp);
                        setIsAddModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      title={c.editTooltip}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleDelete(cp.id, cp.name)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                      title={c.deleteTooltip}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* متادیتای شرکت و شماره تماس */}
                <div className="space-y-2 my-3.5 text-xs text-slate-600 dark:text-slate-400 font-medium bg-slate-50/60 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                  {cp.company ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cp.company}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <Building2 className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      <span>{c.individualEntity}</span>
                    </div>
                  )}
                  {cp.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span dir="ltr" className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">{cp.phone}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      <span>{c.noPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* باکس وضعیت مالی و دکمه ورود مستقیم به دفتر معین */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <span className="block text-[10px] text-slate-400 font-bold mb-1">
                      {c.injectedOrInvoices(cp.type)}
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-xs block truncate" dir="ltr">
                      {formatCurrency(cp.type === 'employer' ? incomeTotal : expenseTotal, currency, language)}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <span className="block text-[10px] text-slate-400 font-bold mb-1">
                      {c.contractAmount}
                    </span>
                    <span className="font-black text-slate-700 dark:text-slate-300 font-mono text-xs block truncate" dir="ltr">
                      {cp.contractValue ? formatCurrency(cp.contractValue, currency, language) : c.notRegistered}
                    </span>
                  </div>
                </div>

                {/* دکمه باز کردن دفتر معین اختصاصی طرف حساب */}
                <button
                  type="button"
                  onClick={() => openLedgerForCounterparty(cp)}
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-800/80 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400 border border-slate-200/80 dark:border-slate-700/80 hover:border-sky-300 dark:hover:border-sky-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs group-hover:border-sky-200"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-sky-500" />
                  <span>{c.viewLedgerBtn}</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              </div>

            </div>
          );
        })}
        
        {filteredCounterparties.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Briefcase className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-1">{c.emptyTitle}</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">{c.emptySubtitle}</p>
          </div>
        )}
      </div>

      <AddCounterpartyModal 
        isOpen={isAddModalOpen} 
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCounterparty(null);
        }}
        editingCounterparty={editingCounterparty}
      />
    </div>
  );
}
