import React, { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useContracts } from '../hooks/useContracts';
import { formatAmount, getTodayDateString } from '../utils/formatters';
import { calculateDelayDays } from '../services/contractService';
import AddEditContractModal from './contracts/AddEditContractModal';
import ContractDetailModal from './contracts/ContractDetailModal';
import ContractSettlementModal from './contracts/ContractSettlementModal';
import { AddCounterpartyModal } from './AddCounterpartyModal';
import { CounterpartiesView } from './CounterpartiesView';
import {
  FileSignature,
  Plus,
  Search,
  Filter,
  HardHat,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  UserPlus,
  ChevronRight,
  Eye,
  Layers,
  Sparkles,
  DollarSign,
  Briefcase,
  Building2,
  FileCheck2,
  TrendingUp,
  Receipt
} from 'lucide-react';

export default function OperationsView() {
  const { t, language, direction } = useLanguage();
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const {
    contracts = [],
    counterparties = [],
    contractStats = {}
  } = useContracts();

  // Active sub-tab: 'all' | 'active' | 'completed' | 'counterparties'
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modals state
  const [isAddContractModalOpen, setIsAddContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [selectedContractForDetail, setSelectedContractForDetail] = useState(null);
  const [selectedContractForSettlement, setSelectedContractForSettlement] = useState(null);
  const [isAddCounterpartyModalOpen, setIsAddCounterpartyModalOpen] = useState(false);

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    let list = [...contracts];

    // Status tab filter
    if (activeTab === 'active') {
      list = list.filter(c => c.status === 'active');
    } else if (activeTab === 'completed') {
      list = list.filter(c => c.status === 'completed');
    }

    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter(c => c.type === typeFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.contractNumber && c.contractNumber.toLowerCase().includes(q)) ||
        (c.counterpartyName && c.counterpartyName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [contracts, activeTab, typeFilter, searchQuery]);

  const todayStr = getTodayDateString();

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-3 sm:px-6" dir={direction}>
      
{/* 1. EXECUTIVE HERO BANNER: OPERATIONS COMMAND CENTER */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl">
        {/* Glow ambient effects */}
        <div className="absolute top-0 end-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 end-0 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Main Metric & Title */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-2xs">
                <HardHat className="w-3.5 h-3.5" />
                <span>{language === "ku" ? "ئۆپەراسیۆن و مەیدانی کارگە" : language === "en" ? "Field Operations & Execution" : "عملیات اجرایی و کارگاهی"}</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-400 bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/10">
                {currentProject?.name || "پروژه جاری"}
              </span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                {language === "ku" ? "کۆی بەهای گرێبەستەکان" : language === "en" ? "Total Contracts Value" : "مجموع ارزش کل قراردادهای پروژه"}
              </span>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2 font-mono" dir="ltr">
                <span>{formatAmount(contractStats.totalEstimatedValue || 0, currency)}</span>
                <span className="text-sm sm:text-base font-sans font-bold text-amber-400">{currency}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {language === "ku"
                  ? "بەڕێوەبردنی گرێبەستی وەستاکاران، پێوانی مەترە، کۆنترۆڵی مۆڵەت و سزای دواکەوتن"
                  : language === "en"
                  ? "Craftsman contracts, work takeoff, completion deadlines, delay penalties & vouchers"
                  : "مدیریت قراردادهای استادکاران، متره و برآورد احجام کار، کنترل تاخیر و جریمه دیرکرد"}
              </p>
            </div>

            {/* Quick Metrics Bar Inside Hero */}
            <div className="grid grid-cols-3 gap-2.5 pt-1 max-w-lg">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-0.5">
                <span className="text-[10px] text-blue-300 font-bold block">{language === "ku" ? "لە جێبەجێکردن" : language === "en" ? "In Progress" : "در حال اجرا"}</span>
                <span className="text-sm sm:text-base font-black font-mono text-white block">{contractStats.activeCount || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-0.5">
                <span className="text-[10px] text-rose-300 font-bold block">{language === "ku" ? "دواکەوتوو" : language === "en" ? "Overdue" : "دارای تاخیر"}</span>
                <span className="text-sm sm:text-base font-black font-mono text-rose-400 block">{contractStats.overdueCount || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-0.5">
                <span className="text-[10px] text-teal-300 font-bold block">{language === "ku" ? "تەواوبوو" : language === "en" ? "Completed" : "تسویه‌شده"}</span>
                <span className="text-sm sm:text-base font-black font-mono text-teal-400 block">{contractStats.completedCount || 0}</span>
              </div>
            </div>
          </div>

          {/* Right Controls: Unified Box with 3 Large-Icon Buttons */}
          <div className="lg:col-span-5 flex flex-col items-start lg:items-end justify-center gap-3">
            
            {/* The Unified Box for the 3 Buttons (Without text, large icons) */}
            <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xl shadow-2xl">
              {/* 1. Counterparties Link */}
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "counterparties" ? "all" : "counterparties")}
                className={`w-13 h-13 sm:w-15 sm:h-15 rounded-2xl transition-all duration-300 flex items-center justify-center cursor-pointer group relative ${
                  activeTab === "counterparties"
                    ? "bg-sky-500 text-white shadow-lg shadow-sky-500/40 scale-105"
                    : "text-slate-300 hover:text-white hover:bg-white/15 active:scale-95"
                }`}
                title={language === "ku" ? "لایەنەکانی حیساب" : language === "en" ? "Counterparties" : "طرف‌حساب‌ها"}
                aria-label="Counterparties"
              >
                <Users className="w-7 h-7 stroke-[2.2] group-hover:scale-110 transition-transform" />
                {counterparties.length > 0 && (
                  <span className="absolute -top-1 -end-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black bg-sky-400 text-slate-950 shadow-xs">
                    {counterparties.length}
                  </span>
                )}
              </button>

              {/* 2. New Counterparty Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsAddCounterpartyModalOpen(true)}
                className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl text-slate-300 hover:text-white hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer active:scale-95 group"
                title={language === "ku" ? "پێناسەکردنی لایەنی نوێ" : language === "en" ? "New Counterparty" : "تعریف طرف‌حساب جدید"}
                aria-label="New Counterparty"
              >
                <UserPlus className="w-7 h-7 stroke-[2.2] group-hover:scale-110 transition-transform" />
              </button>

              {/* 3. New Contract Modal Trigger */}
              <button
                type="button"
                onClick={() => {
                  setEditingContract(null);
                  setIsAddContractModalOpen(true);
                }}
                className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-lg shadow-amber-500/30 transition-all duration-300 flex items-center justify-center cursor-pointer active:scale-95 group"
                title={language === "ku" ? "عەقد و گرێبەستی نوێ" : language === "en" ? "Sign New Contract" : "عقد قرارداد جدید"}
                aria-label="New Contract"
              >
                <FileSignature className="w-7 h-7 stroke-[2.2] group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium px-1">
              <span>{language === "ku" ? "لایەنەکان • لایەنی نوێ • عەقدی نوێ" : language === "en" ? "Counterparties • Add • Contract" : "طرف‌حساب‌ها • طرف‌حساب جدید • قرارداد جدید"}</span>
            </div>

          </div>
        </div>
      </div>

      {/* 3. TOOLBAR & SEGMENTED CONTROLS [APP_THEME_BUTTON] */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          {/* Segmented Tab Controls [APP_THEME_BUTTON] */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 self-start shadow-inner">
            {[
              { id: 'all', label: language === 'ku' ? 'هەموو گرێبەستەکان' : language === 'en' ? 'All Contracts' : 'همه قراردادها', icon: FileSignature },
              { id: 'active', label: language === 'ku' ? 'لە جێبەجێکردندایە' : language === 'en' ? 'In Progress' : 'در حال اجرا', icon: Clock },
              { id: 'completed', label: language === 'ku' ? 'تەواوبوو' : language === 'en' ? 'Completed' : 'پایان‌یافته و تسویه', icon: CheckCircle2 },
              { id: 'counterparties', label: language === 'ku' ? 'لایەنەکانی حیساب' : language === 'en' ? 'Counterparties' : 'طرف‌حساب‌ها و استادکاران', icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ease-in-out flex items-center gap-2 ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/25 font-black'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {isActive && <span>{tab.label}</span>}
                </button>
              );
            })}
          </div>

          {/* Quick Counterparty Count Badge */}
          <div className="text-xs text-slate-500 font-medium">
            {language === 'ku' ? 'کۆی لایەنەکان:' : language === 'en' ? 'Total Counterparties:' : 'تعداد طرف‌حساب‌ها:'}{' '}
            <span className="font-bold text-slate-900 dark:text-white font-mono">{counterparties.length}</span>
          </div>
        </div>

        {/* Search & Filter Row (Only for contracts tabs) */}
        {activeTab !== 'counterparties' && (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ku' ? 'گەڕان لە ناونیشانی عەقد، ژمارەی گرێبەست یان ناوی وەستاکار...' : language === 'en' ? 'Search by contract title, number, or contractor name...' : 'جستجو در موضوع قرارداد، شماره پیمان، نام استادکار یا پیمانکار...'}
                className="w-full ltr:pl-9 rtl:pr-9 py-2 px-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">{language === 'ku' ? 'هەموو جۆرەکان' : language === 'en' ? 'All Roles' : 'همه سمت‌ها'}</option>
                <option value="subcontractor">{language === 'ku' ? 'پەیمانکاری لاوەکی' : language === 'en' ? 'Subcontractor' : 'پیمانکار فرعی'}</option>
                <option value="master_craftsman">{language === 'ku' ? 'وەستاکار' : language === 'en' ? 'Master Craftsman' : 'استادکار دستمزدی'}</option>
                <option value="employer">{language === 'ku' ? 'خاوەنکار' : language === 'en' ? 'Employer' : 'کارفرما'}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 4. MAIN CONTENT AREA */}
      {activeTab === 'counterparties' ? (
        // Embedded Counterparties Management View
        <CounterpartiesView />
      ) : (
        // Contracts Cards & Table
        <div className="space-y-4">
          {filteredContracts.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <FileSignature className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {language === 'ku' ? 'هیچ گرێبەستێک نەدۆزرایەوە' : language === 'en' ? 'No contracts found' : 'هیچ قراردادی با این مشخصات یافت نشد'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {language === 'ku'
                  ? 'دەتوانیت لە ڕێگەی دوگمەی "عەقد و گرێبەستی نوێ" یەکەمین عەقدی وەستاکار یان پەیمانکار تۆمار بکەیت.'
                  : language === 'en'
                  ? 'You can sign a new agreement with subcontractors or master craftsmen using the button above.'
                  : 'می‌توانید با دکمه «عقد قرارداد جدید» اولین قرارداد پیمانکاری کارگاه را به همراه متره و اقلام کار ثبت کنید.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingContract(null);
                  setIsAddContractModalOpen(true);
                }}
                className="px-4 py-2 rounded-2xl text-xs font-bold bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary-hover inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ku' ? 'عەقد و گرێبەستی نوێ' : language === 'en' ? 'Sign Contract' : 'عقد قرارداد جدید'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContracts.map((contract) => {
                const isCompleted = contract.status === 'completed';
                const isActive = contract.status === 'active';
                const delayDays = isActive && contract.estimatedEndDate ? calculateDelayDays(contract.estimatedEndDate, todayStr) : 0;
                const isOverdue = delayDays > 0;

                return (
                  <div
                    key={contract.id}
                    className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between group hover:border-amber-500/40"
                  >
                    {/* Top Row: Contract Number & Status Badge */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {contract.contractNumber}
                        </span>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                          isCompleted
                            ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                            : isOverdue
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        }`}>
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{language === 'ku' ? 'تەواوبوو' : language === 'en' ? 'Completed' : 'تسویه‌شده'}</span>
                            </>
                          ) : isOverdue ? (
                            <>
                              <AlertTriangle className="w-3 h-3" />
                              <span>{delayDays} {language === 'ku' ? 'ڕۆژ دواکەوتن' : language === 'en' ? 'Days late' : 'روز تاخیر'}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>{language === 'ku' ? 'لە جێبەجێکردن' : language === 'en' ? 'Active' : 'در حال اجرا'}</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Title & Contractor */}
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                          {contract.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <HardHat className="w-3.5 h-3.5 text-amber-500" />
                          <span>{contract.counterpartyName || 'پیمانکار'}</span>
                        </p>
                      </div>

                      {/* Items Peek */}
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-400 font-bold">
                          <span>{language === 'ku' ? 'بڕگەکانی کارکردن:' : language === 'en' ? 'Scope of work:' : 'اقلام متره:'}</span>
                          <span className="font-mono">{contract.items?.length || 0} {language === 'ku' ? 'بڕگە' : language === 'en' ? 'items' : 'ردیف'}</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 truncate">
                          {(contract.items || []).map(i => i.title).join(' • ') || '---'}
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-slate-400">{language === 'ku' ? 'دەستپێک:' : language === 'en' ? 'Start:' : 'شروع:'}</span>{' '}
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{contract.startDate || '---'}</span>
                        </div>
                        <div className="text-end">
                          <span className="text-slate-400">{language === 'ku' ? 'کۆتایی:' : language === 'en' ? 'Deadline:' : 'مهلت:'}</span>{' '}
                          <span className={`font-mono font-bold ${isOverdue ? 'text-rose-500 font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                            {contract.estimatedEndDate || '---'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Amount & Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">
                          {isCompleted ? (language === 'ku' ? 'شایستەی دراو:' : language === 'en' ? 'Final Paid:' : 'خالص تسویه:') : (language === 'ku' ? 'کۆی برآورد:' : language === 'en' ? 'Est. Value:' : 'ارزش برآوردی:')}
                        </span>
                        <span className="text-sm font-black font-mono text-slate-900 dark:text-white" dir="ltr">
                          {formatAmount(isCompleted && contract.finalPayableAmount !== null ? contract.finalPayableAmount : contract.totalEstimatedAmount, currency)} {currency}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedContractForDetail(contract)}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{language === 'ku' ? 'وردەکاری' : language === 'en' ? 'Details' : 'جزئیات'}</span>
                        </button>

                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => setSelectedContractForSettlement(contract)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{language === 'ku' ? 'تەواوکردن' : language === 'en' ? 'Settle' : 'تسویه'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedContractForDetail(contract)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center gap-1.5"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>{language === 'ku' ? 'سەند' : language === 'en' ? 'Voucher' : 'سند موقت'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isAddContractModalOpen && (
        <AddEditContractModal
          isOpen={isAddContractModalOpen}
          onClose={() => {
            setIsAddContractModalOpen(false);
            setEditingContract(null);
          }}
          editingContract={editingContract}
          counterparties={counterparties}
        />
      )}

      {selectedContractForDetail && (
        <ContractDetailModal
          isOpen={Boolean(selectedContractForDetail)}
          onClose={() => setSelectedContractForDetail(null)}
          contract={selectedContractForDetail}
          onEdit={(c) => {
            setEditingContract(c);
            setIsAddContractModalOpen(true);
          }}
          onOpenSettlement={(c) => setSelectedContractForSettlement(c)}
        />
      )}

      {selectedContractForSettlement && (
        <ContractSettlementModal
          isOpen={Boolean(selectedContractForSettlement)}
          onClose={() => setSelectedContractForSettlement(null)}
          contract={selectedContractForSettlement}
          onSettlementSuccess={(res) => {
            setSelectedContractForSettlement(null);
          }}
        />
      )}

      {isAddCounterpartyModalOpen && (
        <AddCounterpartyModal
          isOpen={isAddCounterpartyModalOpen}
          onClose={() => setIsAddCounterpartyModalOpen(false)}
        />
      )}

    </div>
  );
}
