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
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-3 sm:px-6 animate-in fade-in duration-200" dir={direction}>
      
      {/* 1. TOP HEADER CARD: LIQUID GLASS CAPSULE WITH MAIN ACTIONS DOCK */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/30 transition-all duration-300">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 dark:bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          {/* Right side: Icon + Title + Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
              <HardHat className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  {language === "ku" ? "کاروباری جێبەجێکردن" : language === "en" ? "Field Operations" : "امور اجرایی و پیمانکاری"}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {contractStats.totalCount || 0} {language === "ku" ? "گرێبەست" : language === "en" ? "contracts" : "قرارداد"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {currentProject?.name} • {language === "ku" ? "بەڕێوەبردنی عەقدی وەستاکاران، پێوانی مەترە، کۆنترۆڵی مۆڵەت و ژمێریاری کۆتایی" : language === "en" ? "Contractor agreements, quantity takeoff, delay penalties and final vouchers" : "مدیریت قراردادهای استادکاران، متره و برآورد احجام کار، کنترل تاخیر و جریمه دیرکرد"}
              </p>
            </div>
          </div>

          {/* Left side: The 3 Action Buttons in One Shared Box without text & with large icons */}
          <div className="h-[52px] sm:h-[56px] flex items-center gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner self-start sm:self-center">
            {/* 1. Counterparties View Toggle */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "counterparties" ? "all" : "counterparties")}
              className={`relative h-full aspect-square rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                activeTab === "counterparties"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700/80"
              }`}
              title={language === "ku" ? "لایەنەکانی حیساب" : language === "en" ? "Counterparties" : "طرف‌حساب‌ها"}
              aria-label="Counterparties"
            >
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              {counterparties.length > 0 && (
                <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono bg-sky-500 text-white font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 leading-none shadow-xs">
                  {counterparties.length}
                </span>
              )}
            </button>

            {/* 2. New Counterparty Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsAddCounterpartyModalOpen(true)}
              className="h-full aspect-square rounded-xl text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700/80 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
              title={language === "ku" ? "پێناسەکردنی لایەنی نوێ" : language === "en" ? "New Counterparty" : "تعریف طرف‌حساب جدید"}
              aria-label="New Counterparty"
            >
              <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* 3. New Contract Modal Trigger */}
            <button
              type="button"
              onClick={() => {
                setEditingContract(null);
                setIsAddContractModalOpen(true);
              }}
              className="h-full aspect-square rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/25 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
              title={language === "ku" ? "عەقد و گرێبەستی نوێ" : language === "en" ? "Sign New Contract" : "عقد قرارداد جدید"}
              aria-label="New Contract"
            >
              <FileSignature className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE HERO BANNER: OPERATIONS COMMAND CENTER (Matching Dashboard / Expenses Identity) */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 text-white border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Main Total Contracts Metric */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
              <HardHat className="w-4 h-4" />
              <span>{language === "ku" ? "نبزی گرێبەستەکان و کارگە" : language === "en" ? "Contracts & Field Operations Pulse" : "نبض قراردادها و عملیات کارگاه"}</span>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-2 font-mono" dir="ltr">
                <span>{formatAmount(contractStats.totalEstimatedValue || 0, currency)}</span>
                <span className="text-sm sm:text-base font-sans font-bold text-amber-400">{currency}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {language === "ku"
                  ? "کۆی بەهای خەمڵێنراوی تەواوی گرێبەستەکان لەم پڕۆژەیەدا"
                  : language === "en"
                  ? "Total gross estimated value of all contracted works in this project"
                  : "مجموع ارزش ناخالص قراردادها و احجام پیمانکاری ثبت‌شده در این پروژه"}
              </p>
            </div>

            {/* Quick Status Dots */}
            <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-xs" />
                <span>{contractStats.activeCount || 0} {language === "ku" ? "لە جێبەجێکردن" : language === "en" ? "Active" : "در حال اجرا"}</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-xs" />
                <span>{contractStats.overdueCount || 0} {language === "ku" ? "دواکەوتوو" : language === "en" ? "Overdue" : "دارای تاخیر"}</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-xs" />
                <span>{contractStats.completedCount || 0} {language === "ku" ? "تەواوبوو" : language === "en" ? "Completed" : "تسویه‌شده"}</span>
              </span>
            </div>
          </div>

          {/* Action Dock Inside Hero */}
          <div className="lg:col-span-5 flex flex-col gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setEditingContract(null);
                setIsAddContractModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{language === "ku" ? "عەقد و گرێبەستی نوێ" : language === "en" ? "Sign New Contract" : "عقد قرارداد جدید"}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsAddCounterpartyModalOpen(true)}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition-all border border-white/10 active:scale-95 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span>{language === "ku" ? "لایەنی نوێ" : language === "en" ? "New Party" : "طرف‌حساب جدید"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "counterparties" ? "all" : "counterparties")}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold transition-all border active:scale-95 cursor-pointer ${
                  activeTab === "counterparties"
                    ? "bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/30"
                    : "bg-white/10 hover:bg-white/15 text-slate-200 border-white/10"
                }`}
              >
                <Users className="w-4 h-4 text-sky-400" />
                <span>{language === "ku" ? "لایەنەکان" : language === "en" ? "Parties" : "طرف‌حساب‌ها"}</span>
              </button>
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
