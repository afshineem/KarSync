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

export function CounterpartiesView() {
  const { language, t } = useLanguage();
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
    const confirmMsg = language === 'fa' 
      ? `آیا از حذف طرف‌حساب "${name}" اطمینان دارید؟` 
      : `دڵنیایت لە سڕینەوەی "${name}"؟`;
      
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
        return { label: language === 'fa' ? 'کارفرما / سرمایه‌گذار' : 'خاوەن کار', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' };
      case 'supplier': 
        return { label: language === 'fa' ? 'تامین‌کننده مصالح' : 'دابینکەر', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
      case 'subcontractor': 
        return { label: language === 'fa' ? 'پیمانکار فرعی' : 'بەڵێندەری لاوەکی', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      default: 
        return { label: language === 'fa' ? 'سایر اشخاص' : 'هیتر', color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
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

  return (
    <div className="space-y-5 pb-16">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>مدیریت و صورت‌حساب طرف‌حساب‌ها</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
              {counterparties.length} شخص
            </span>
          </h1>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            {language === 'fa' 
              ? 'پیگیری قراردادها، دریافتی‌ها، فاکتورهای صادره و مشاهده مستقیم دفتر معین' 
              : 'خاوەن کارەکان، دابینکەران و مامەڵە داراییەکان'}
          </p>
        </div>

        <button 
          onClick={() => {
            setEditingCounterparty(null);
            setIsAddModalOpen(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-md shadow-sky-500/20 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'fa' ? 'تعریف طرف‌حساب جدید' : 'لایەنی نوێ'}</span>
        </button>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'fa' ? 'جستجو در نام، نام شرکت یا شماره تماس...' : 'گەڕان بەدوای ناو یان ژمارە...'}
            className="block w-full ps-10 pe-3.5 py-2.5 border border-slate-200/90 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-medium shadow-xs"
          />
        </div>

        {/* Role Segment Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
          {[
            { id: 'all', label: 'همه', count: counts.all },
            { id: 'employer', label: 'کارفرمایان', count: counts.employer },
            { id: 'supplier', label: 'تامین‌کنندگان', count: counts.supplier },
            { id: 'subcontractor', label: 'پیمانکاران', count: counts.subcontractor }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                selectedTypeFilter === tab.id
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedTypeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Counterparties Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCounterparties.map(cp => {
          const typeMeta = getTypeName(cp.type);
          const incomeTotal = cpBalances[cp.id] || 0;
          const expenseTotal = cpExpenseTotals[cp.id] || 0;

          return (
            <div 
              key={cp.id} 
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header row */}
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 rounded-2xl flex items-center justify-center text-slate-700 dark:text-slate-200 font-black text-sm shrink-0">
                      {cp.name ? cp.name.charAt(0) : <User className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-snug">
                        {cp.name}
                      </h3>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border ${typeMeta.color}`}>
                          {typeMeta.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingCounterparty(cp);
                        setIsAddModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      title="ویرایش"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(cp.id, cp.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Company and Phone Meta */}
                <div className="space-y-1.5 my-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {cp.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cp.company}</span>
                    </div>
                  )}
                  {cp.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span dir="ltr" className="font-mono text-[11px]">{cp.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Box & Ledger Button */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <span className="block text-[10px] text-slate-400 font-bold mb-1">
                      {cp.type === 'employer' ? 'تزریق شده (دریافتی)' : 'فاکتورها/پرداختی'}
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                      {formatCurrency(cp.type === 'employer' ? incomeTotal : expenseTotal, currency, language)}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <span className="block text-[10px] text-slate-400 font-bold mb-1">
                      {language === 'fa' ? 'مبلغ قرارداد' : 'گرێبەست'}
                    </span>
                    <span className="font-black text-slate-700 dark:text-slate-300 font-mono text-xs">
                      {cp.contractValue ? formatCurrency(cp.contractValue, currency, language) : 'ثبت نشده'}
                    </span>
                  </div>
                </div>

                {/* Direct Ledger Link Button */}
                <button
                  type="button"
                  onClick={() => openLedgerForCounterparty(cp)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-sky-50 dark:bg-slate-800/50 dark:hover:bg-sky-950/40 text-slate-700 hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400 border border-slate-200/80 dark:border-slate-700/80 hover:border-sky-300 dark:hover:border-sky-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>مشاهده دفتر معین و صورت‌حساب</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              </div>

            </div>
          );
        })}
        
        {filteredCounterparties.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 border-dashed p-6">
            <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-1">طرف‌حسابی یافت نشد</h4>
            <p className="text-xs text-slate-400">می‌توانید با دکمه بالا یک طرف‌حساب، کارفرما یا تامین‌کننده جدید ثبت کنید.</p>
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
