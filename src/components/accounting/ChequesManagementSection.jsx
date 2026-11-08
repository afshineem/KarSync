import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { useAccounting } from '../../hooks/useAccounting';
import { AddEditChequeModal } from './AddEditChequeModal';
import { ChequeDetailModal } from './ChequeDetailModal';
import { AddEditChequebookModal } from './AddEditChequebookModal';
import { deleteChequebook } from '../../services/chequeService';
import { formatCurrency, formatAmount, getTodayDateString } from '../../utils/formatters';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Calendar,
  Building,
  Landmark,
  User,
  Hash,
  ExternalLink,
  Share2,
  Ban,
  Trash2,
  FileCheck2,
  Coins
} from 'lucide-react';

export default function ChequesManagementSection({ language: propLanguage }) {
  const { t, language: ctxLang, direction } = useLanguage();
  const lang = propLanguage || ctxLang || 'fa';
  const { currentProject } = useProject();
  const currency = currentProject?.currency || 'IQD';

  const {
    cheques = [],
    chequebooks = [],
    chequeStats = {},
    financialAccounts = []
  } = useAccounting();

  // Active section tab: 'all' | 'inward' | 'outward' | 'chequebooks'
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddChequeModalOpen, setIsAddChequeModalOpen] = useState(false);
  const [chequeModalType, setChequeModalType] = useState('inward');
  const [selectedChequeForDetail, setSelectedChequeForDetail] = useState(null);
  const [selectedChequeForEdit, setSelectedChequeForEdit] = useState(null);
  const [isAddChequebookModalOpen, setIsAddChequebookModalOpen] = useState(false);
  const [selectedBookForEdit, setSelectedBookForEdit] = useState(null);

  // Filtered Cheques list
  const filteredCheques = useMemo(() => {
    let list = [...cheques];

    // Filter by Tab (Inward vs Outward)
    if (activeTab === 'inward') {
      list = list.filter((c) => c.type === 'inward');
    } else if (activeTab === 'outward') {
      list = list.filter((c) => c.type === 'outward');
    }

    // Filter by Status
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.status === statusFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => {
        const no = String(c.chequeNumber || '').toLowerCase();
        const sayad = String(c.sayadNumber || '').toLowerCase();
        const nat = String(c.nationalId || '').toLowerCase();
        const drawer = String(c.drawerName || '').toLowerCase();
        const payee = String(c.payeeName || '').toLowerCase();
        const purpose = String(c.purpose || '').toLowerCase();
        const bank = String(c.bankName || '').toLowerCase();
        const tracking = String(c.bankTrackingCode || '').toLowerCase();
        const docNo = String(c.bankDocumentNumber || '').toLowerCase();
        return (
          no.includes(q) ||
          sayad.includes(q) ||
          nat.includes(q) ||
          drawer.includes(q) ||
          payee.includes(q) ||
          purpose.includes(q) ||
          bank.includes(q) ||
          tracking.includes(q) ||
          docNo.includes(q)
        );
      });
    }

    // Sort by Due Date descending
    return list.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
  }, [cheques, activeTab, statusFilter, searchQuery]);

  const todayStr = getTodayDateString();

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-150">
      
      {/* 1. HERO STATS CARDS (Apple Liquid Glass) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Inward In-Hand */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
              <span>چک‌های دریافتی نزد صندوق</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {chequeStats.inHandCount || 0} فقره
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
            {formatAmount(chequeStats.inHandAmount || 0, currency)} <span className="text-xs font-sans font-bold">{currency}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            اسناد تجاری دریافتنی در انتظار وصول
          </div>
        </div>

        {/* Outward Issued */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-blue-500" />
              <span>چک‌های صادره کارگاه</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {chequeStats.issuedCount || 0} فقره
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-blue-600 dark:text-blue-400" dir="ltr">
            {formatAmount(chequeStats.issuedAmount || 0, currency)} <span className="text-xs font-sans font-bold">{currency}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            اسناد پرداختنی صادر شده از حساب‌های بانکی
          </div>
        </div>

        {/* Due Soon / Overdue */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>سررسید گذشته / نزدیک</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {chequeStats.dueSoonCount || 0} فقره
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400" dir="ltr">
            {formatAmount(chequeStats.dueSoonAmount || 0, currency)} <span className="text-xs font-sans font-bold">{currency}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            نیاز به پیگیری وصول یا تامین موجودی
          </div>
        </div>

        {/* Cleared Total */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-500" />
              <span>وصول‌شده / پاس‌شده</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              {chequeStats.clearedCount || 0} فقره
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white" dir="ltr">
            {formatAmount(chequeStats.clearedAmount || 0, currency)} <span className="text-xs font-sans font-bold">{currency}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            تسویه قطعی در گردش حساب‌های بانکی
          </div>
        </div>

      </div>

      {/* 2. TOOLBAR & SEGMENTED CONTROLS [APP_THEME_BUTTON] */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          
          {/* Segmented Tab Controls [APP_THEME_BUTTON] */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 self-start shadow-inner">
            {[
              { id: 'all', label: 'همه چک‌ها', icon: Receipt },
              { id: 'inward', label: 'چک‌های دریافتی (ورودی)', icon: ArrowDownLeft },
              { id: 'outward', label: 'چک‌های صادره کارگاه (خروجی)', icon: ArrowUpRight },
              { id: 'chequebooks', label: 'دسته‌چک‌های کارگاه', icon: BookOpen }
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

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAddChequebookModalOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span>تعریف دسته‌چک</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChequeModalType(activeTab === 'outward' ? 'outward' : 'inward');
                setSelectedChequeForEdit(null);
                setIsAddChequeModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-all shadow-md shadow-primary/25 active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت چک جدید</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filter Row (For cheques tabs) */}
        {activeTab !== 'chequebooks' && (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو بر اساس شماره چک، شناسه صیاد، کد ملی، طرف‌حساب، بابت یا کد رهگیری بانکی..."
                className="w-full ltr:pl-9 rtl:pr-9 py-2 px-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-44 py-2 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="in_hand">نزد صندوق (دریافتی)</option>
                <option value="issued">صادر شده (خروجی)</option>
                <option value="cleared">وصول‌شده / پاس‌شده</option>
                <option value="bounced">برگشت‌خورده</option>
                <option value="endorsed">خرج‌شده به غیر</option>
                <option value="void">باطل‌شده</option>
              </select>
            </div>
          </div>
        )}

      </div>

      {/* 3. TAB CONTENT */}

      {/* A) CHEQUES LIST TABLE */}
      {activeTab !== 'chequebooks' && (
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm overflow-hidden">
          {filteredCheques.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                هیچ برگه چکی در این بخش یافت نشد.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedChequeForEdit(null);
                  setIsAddChequeModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت اولین برگه چک</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="py-3 px-4">نوع</th>
                    <th className="py-3 px-4">سریال و شناسه صیادی</th>
                    <th className="py-3 px-4">طرف‌حساب / صادرکننده</th>
                    <th className="py-3 px-4">بانک و شعبه</th>
                    <th className="py-3 px-4">سررسید</th>
                    <th className="py-3 px-4 text-left">مبلغ برگه</th>
                    <th className="py-3 px-4 text-center">وضعیت</th>
                    <th className="py-3 px-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredCheques.map((chk) => {
                    const isOut = chk.type === 'outward';
                    const isOverdue = chk.dueDate && chk.dueDate < todayStr && chk.status !== 'cleared' && chk.status !== 'void';
                    const isDueToday = chk.dueDate === todayStr && chk.status !== 'cleared';

                    return (
                      <tr
                        key={chk.id}
                        onClick={() => setSelectedChequeForDetail(chk)}
                        className="hover:bg-sky-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        {/* نوع */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                            isOut
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {isOut ? <ArrowUpRight className="w-3 h-3 text-blue-500" /> : <ArrowDownLeft className="w-3 h-3 text-emerald-500" />}
                            <span>{isOut ? 'صادره کارگاه' : 'دریافتی'}</span>
                          </span>
                        </td>

                        {/* سریال و صیاد */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {chk.chequeNumber}
                          </div>
                          {chk.sayadNumber && (
                            <div className="text-[10px] font-mono text-slate-400 tracking-wider">
                              {chk.sayadNumber}
                            </div>
                          )}
                          {chk.bankTrackingCode && (
                            <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 mt-0.5">
                              کد رهگیری: {chk.bankTrackingCode}
                            </div>
                          )}
                        </td>

                        {/* طرف‌حساب */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {isOut ? (chk.payeeName || 'در وجه ذینفع') : (chk.drawerName || 'نامشخص')}
                          </div>
                          {chk.purpose && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">
                              {chk.purpose}
                            </div>
                          )}
                        </td>

                        {/* بانک */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {chk.bankName || '-'}
                        </td>

                        {/* سررسید */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className={`font-mono font-bold text-xs ${
                            isOverdue
                              ? 'text-rose-600 dark:text-rose-400 font-black'
                              : isDueToday
                              ? 'text-amber-600 dark:text-amber-400 font-black'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {chk.dueDate}
                          </div>
                          {isOverdue && (
                            <span className="text-[9px] font-bold text-rose-500 block">
                              سررسید گذشته
                            </span>
                          )}
                          {isDueToday && (
                            <span className="text-[9px] font-bold text-amber-500 block">
                              سررسید امروز
                            </span>
                          )}
                        </td>

                        {/* مبلغ */}
                        <td className="py-3 px-4 text-left whitespace-nowrap font-mono font-bold text-sm">
                          <span className={isOut ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {formatAmount(chk.amount, currency)}
                          </span>
                        </td>

                        {/* وضعیت */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {chk.status === 'cleared' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              وصول‌شده
                            </span>
                          ) : chk.status === 'bounced' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              برگشت‌خورده
                            </span>
                          ) : chk.status === 'endorsed' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              خرج‌شده
                            </span>
                          ) : chk.status === 'void' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                              باطل‌شده
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {isOut ? 'صادر شده' : 'نزد صندوق'}
                            </span>
                          )}
                        </td>

                        {/* عملیات */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChequeForDetail(chk);
                            }}
                            className="p-1.5 rounded-xl hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 transition-all"
                            title="مشاهده جزئیات"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* B) CHEQUEBOOKS LIST VIEW */}
      {activeTab === 'chequebooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span>دسته‌چک‌های ثبت‌شده برای حساب‌های بانکی کارگاه</span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setSelectedBookForEdit(null);
                setIsAddChequebookModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/25 active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف دسته‌چک جدید</span>
            </button>
          </div>

          {chequebooks.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-slate-800 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500">
                هنوز هیچ دسته‌چکی برای حساب‌های بانکی کارگاه تعریف نشده است.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chequebooks.map((book) => {
                const total = Number(book.totalLeaves) || 25;
                const used = Number(book.usedLeaves) || 0;
                const remain = Math.max(0, total - used);
                const pctUsed = Math.min(100, Math.round((used / total) * 100));

                return (
                  <div
                    key={book.id}
                    className="p-5 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-sm space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h5 className="text-sm font-black text-slate-900 dark:text-white">
                            {book.bankName || 'بانک کارگاه'}
                          </h5>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {book.accountNumber ? `شماره حساب: ${book.accountNumber}` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('آیا از حذف این دسته‌چک اطمینان دارید؟')) {
                            await deleteChequebook(book.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                        title="حذف دسته‌چک"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold">کل برگه‌ها</span>
                        <strong className="text-sm font-mono text-slate-800 dark:text-slate-100">{total}</strong>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                        <span className="text-[10px] text-blue-500 block font-bold">مصرف‌شده</span>
                        <strong className="text-sm font-mono text-blue-700 dark:text-blue-300">{used}</strong>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                        <span className="text-[10px] text-emerald-500 block font-bold">باقیمانده</span>
                        <strong className="text-sm font-mono text-emerald-700 dark:text-emerald-300">{remain}</strong>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>سریال {book.startSerial} تا {book.endSerial}</span>
                        <span>{pctUsed}% صادر شده</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${pctUsed}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <AddEditChequeModal
        isOpen={isAddChequeModalOpen}
        onClose={() => setIsAddChequeModalOpen(false)}
        initialType={chequeModalType}
        chequeToEdit={selectedChequeForEdit}
        currency={currency}
      />

      <ChequeDetailModal
        isOpen={Boolean(selectedChequeForDetail)}
        onClose={() => setSelectedChequeForDetail(null)}
        cheque={selectedChequeForDetail}
        currency={currency}
        onEdit={(chk) => {
          setSelectedChequeForEdit(chk);
          setChequeModalType(chk.type);
          setIsAddChequeModalOpen(true);
        }}
      />

      <AddEditChequebookModal
        isOpen={isAddChequebookModalOpen}
        onClose={() => setIsAddChequebookModalOpen(false)}
        bookToEdit={selectedBookForEdit}
      />

    </div>
  );
}
