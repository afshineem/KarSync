import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { createWorkerAccessLink, revokeWorkerAccessLinks } from '../services/workerAccess';
import { pushLogsLive } from '../services/realtimeSync';
import { 
  formatCurrency, 
  formatHoursAndMinutes, 
  formatFullDateWithWeekday, 
  formatDateDisplay,
  roundCurrency 
} from '../utils/formatters';
import { calculateWorkerFinancials } from '../utils/settlementCalculations';
import { 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  DollarSign, 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Edit2, 
  Plus, 
  ShieldCheck, 
  Lock, 
  Briefcase, 
  FileText, 
  Layers, 
  Check, 
  TrendingUp, 
  Trash2,
  CalendarCheck,
  CreditCard,
  History,
  PhoneCall,
  MessageSquare
} from 'lucide-react';
import { EditRecordModal } from './EditRecordModal';
import { AdvancePaymentModal } from './AdvancePaymentModal';
import { SettlementModal } from './SettlementModal';
import { QuickMonthAttendanceModal } from './QuickMonthAttendanceModal';

export function WorkerProfileModal({ workerId, isOpen, onClose }) {
  const { language, t, direction } = useLanguage();
  const { currentProject, currency = 'IQD' } = useProject();
  const { user, setWorkerCredentials, getWorkerCredentialsMap } = useAuth();

  // Active Tab: 'overview' | 'attendance' | 'advances' | 'settlements'
  const [activeTab, setActiveTab] = useState('overview');

  // Attendance sub-filter: 'all' | 'unsettled' | 'settled'
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  // Advances sub-filter: 'all' | 'unsettled' | 'settled'
  const [advancesFilter, setAdvancesFilter] = useState('all');

  // Sub-modal states
  const [editingLog, setEditingLog] = useState(null);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isQuickAttendanceOpen, setIsQuickAttendanceOpen] = useState(false);
  const [isEditWorkerModalOpen, setIsEditWorkerModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrRevoked, setQrRevoked] = useState(false);

  const describeLinkError = (err) => {
    const msg = String(err?.message || '');
    if (!navigator.onLine) return 'برای ساخت لینک، اینترنت لازم است.';
    if (err?.code === 'PGRST202' || /Could not find the function/i.test(msg)) {
      return 'قابلیت لینک ورود هنوز روی سرور فعال نشده است (فایل SQL مربوطه اجرا نشده).';
    }
    if (/not authenticated/i.test(msg)) {
      return 'برای ساخت لینک باید با حساب مدیر (ورود با ایمیل) وارد شده باشید.';
    }
    if (/worker not found/i.test(msg)) {
      return 'این پرسنل هنوز روی سرور ثبت نشده است. چند لحظه صبر کنید و دوباره تلاش کنید.';
    }
    if (/not allowed/i.test(msg)) {
      return 'شما مجاز به ساخت لینک برای این پرسنل نیستید.';
    }
    return msg || 'خطای ناشناخته در ساخت لینک.';
  };

  // Opening the dialog does NOT create a link (creating one deactivates the previous link)
  const handleOpenQRModal = () => {
    setQrUrl('');
    setQrError('');
    setQrRevoked(false);
    setIsQRModalOpen(true);
  };

  const handleCreateLink = async () => {
    setQrBusy(true);
    setQrError('');
    setQrRevoked(false);
    try {
      const { url } = await createWorkerAccessLink(workerId);
      setQrUrl(url);
    } catch (err) {
      console.error('Error creating worker access link', err);
      setQrError(describeLinkError(err));
    } finally {
      setQrBusy(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!window.confirm('لینک ورود این پرسنل باطل شود؟ پرسنل دیگر نمی‌تواند با لینک یا بارکد قبلی وارد شود.')) return;
    setQrBusy(true);
    setQrError('');
    try {
      await revokeWorkerAccessLinks(workerId);
      setQrUrl('');
      setQrRevoked(true);
    } catch (err) {
      console.error('Error revoking worker access link', err);
      setQrError(describeLinkError(err));
    } finally {
      setQrBusy(false);
    }
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live queries for this specific worker
  const worker = useLiveQuery(async () => {
    if (!workerId) return null;
    return await db.workers.get(workerId);
  }, [workerId]);

  const group = useLiveQuery(async () => {
    if (!worker?.groupId) return null;
    return await db.groups.get(worker.groupId);
  }, [worker?.groupId]);

  const allLogs = useLiveQuery(async () => {
    if (!workerId) return [];
    const logs = await db.attendanceLogs.where('workerId').equals(workerId).toArray();
    return logs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [workerId]) || [];

  const allPayments = useLiveQuery(async () => {
    if (!workerId) return [];
    const payments = await db.payments.where('workerId').equals(workerId).toArray();
    return payments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [workerId]) || [];

  // All workers & groups for settlement modal pass-through
  const allWorkers = useLiveQuery(() => db.workers.toArray()) || [];
  const allGroups = useLiveQuery(() => db.groups.toArray()) || [];

  // Metrics computation using single source of truth
  const stats = useMemo(() => {
    if (!worker) {
      return {
        unsettledDaysCount: 0,
        unsettledFullDays: 0,
        unsettledHalfDays: 0,
        unsettledHourlyDays: 0,
        unsettledOvertimeHours: 0,
        unsettledGrossPay: 0,
        settledDaysCount: 0,
        settledGrossPay: 0,
        settledOvertimeHours: 0,
        unsettledAdvances: 0,
        settledAdvances: 0,
        settlementsReceived: 0,
        netBalanceDue: 0,
        totalDaysWorked: 0,
        totalGrossEarnedAllTime: 0
      };
    }

    const fin = calculateWorkerFinancials(worker, allLogs, allPayments, currency);
    if (!fin) {
      return {
        unsettledDaysCount: 0,
        unsettledFullDays: 0,
        unsettledHalfDays: 0,
        unsettledHourlyDays: 0,
        unsettledOvertimeHours: 0,
        unsettledGrossPay: 0,
        settledDaysCount: 0,
        settledGrossPay: 0,
        settledOvertimeHours: 0,
        unsettledAdvances: 0,
        settledAdvances: 0,
        settlementsReceived: 0,
        netBalanceDue: 0,
        totalDaysWorked: 0,
        totalGrossEarnedAllTime: 0
      };
    }

    return {
      unsettledDaysCount: fin.unsettledLogs.length,
      unsettledFullDays: fin.fullDays,
      unsettledHalfDays: fin.halfDays,
      unsettledHourlyDays: fin.hourlyDays,
      unsettledOvertimeHours: fin.otHours,
      unsettledGrossPay: fin.unsettledGross,
      settledDaysCount: fin.settledLogs.length,
      settledGrossPay: fin.totalSettlementPaid,
      settledOvertimeHours: fin.settledOtHours,
      unsettledAdvances: fin.unsettledAdvances,
      settledAdvances: fin.settledAdvances,
      settlementsReceived: fin.totalSettlementPaid,
      netBalanceDue: fin.netBalanceDue,
      totalDaysWorked: allLogs.length,
      totalGrossEarnedAllTime: fin.unsettledGross + fin.settledGross
    };
  }, [worker, allLogs, allPayments, currency]);

  // Filtered attendance logs
  const fin = useMemo(() => {
    if (!worker) return null;
    return calculateWorkerFinancials(worker, allLogs, allPayments);
  }, [worker, allLogs, allPayments]);

  const [isRepairingSettled, setIsRepairingSettled] = useState(false);
  const handleRepairSuspiciousLogs = async () => {
    const bad = fin?.suspiciousSettledLogs || [];
    if (bad.length === 0) return;
    if (!window.confirm(`${bad.length} روز کارکرد دوباره «تسویه‌نشده» می‌شود. ادامه می‌دهید؟`)) return;
    setIsRepairingSettled(true);
    try {
      const now = new Date().toISOString();
      const fixed = bad.map((l) => {
        let cleanNotes = (l.notes || '').trim();
        if (cleanNotes.includes('__META__')) {
          const match = cleanNotes.match(/__META__([\s\S]*?)__META__/);
          if (match && match[1]) {
            try {
              const metaObj = JSON.parse(match[1]);
              delete metaObj.rid;
              delete metaObj.st;
              if (Object.keys(metaObj).length > 0) {
                cleanNotes = `__META__${JSON.stringify(metaObj)}__META__\n${cleanNotes.replace(/__META__[\s\S]*?__META__/, '').trim()}`.trim();
              } else {
                cleanNotes = cleanNotes.replace(/__META__[\s\S]*?__META__/, '').trim();
              }
            } catch (_) {}
          }
        }
        return {
          ...l,
          isSettled: false,
          settlementReceiptId: null,
          notes: cleanNotes,
          updatedAt: now
        };
      });
      await db.attendanceLogs.bulkPut(fixed);
      await pushLogsLive(fixed).catch(console.warn);
    } finally {
      setIsRepairingSettled(false);
    }
  };

  // Filtered attendance logs
  const filteredLogs = useMemo(() => {
    if (!fin) return allLogs;
    if (attendanceFilter === 'unsettled') {
      return allLogs.filter((l) => !fin.isLogSettled(l));
    }
    if (attendanceFilter === 'settled') {
      return allLogs.filter((l) => fin.isLogSettled(l));
    }
    return allLogs;
  }, [allLogs, attendanceFilter, fin]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    const list = allPayments.filter((p) => (p.type || '').toLowerCase() !== 'settlement' && !p.deletedAt);
    if (!fin) return list;
    if (advancesFilter === 'unsettled') {
      return list.filter((p) => !fin.isPaymentSettled(p));
    }
    if (advancesFilter === 'settled') {
      return list.filter((p) => fin.isPaymentSettled(p));
    }
    return list;
  }, [allPayments, advancesFilter, fin]);

  // Settlement payments
  const settlementReceipts = useMemo(() => {
    return allPayments.filter((p) => (p.type || '').toLowerCase() === 'settlement');
  }, [allPayments]);

  if (!isOpen || !workerId) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0 !mt-0 z-[100] bg-slate-100 dark:bg-slate-950 flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden"
    >
      {/* Top Header / Profile Hero (Modern Clean Theme-Harmonized Styling) */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            {/* Worker Avatar & Identity */}
            <div className="flex items-center gap-3.5 sm:gap-4.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-extrabold text-xl sm:text-2xl flex items-center justify-center shadow-md shadow-sky-500/20 border-2 border-white dark:border-slate-800">
                  {worker?.name ? worker.name.charAt(0) : <User className="w-7 h-7" />}
                </div>
                <span 
                  className={`absolute -bottom-1 -end-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-xs ${
                    worker?.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} 
                  title={worker?.isActive !== false ? 'فعال' : 'غیرفعال'}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">
                    {worker?.name || '...'}
                  </h2>
                  {worker?.role && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60 text-xs font-bold">
                      {worker.role}
                    </span>
                  )}
                  {group?.name && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1">
                      <Layers className="w-3 h-3 text-sky-500" />
                      <span>{group.name}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  {worker?.phone ? (
                    <a 
                      href={`tel:${worker.phone}`} 
                      className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-mono font-bold transition-colors"
                      title="تماس تلفنی"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{worker.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 text-xs">بدون شماره تماس</span>
                  )}

                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>نرخ روزانه: <strong className="text-slate-900 dark:text-white font-mono">{formatCurrency(worker?.dailyRate || 0, currency, language)}</strong></span>
                  
                  {Number(worker?.overtimeHourlyRate) > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>نرخ اضافه کاری: <strong className="text-slate-900 dark:text-white font-mono">{formatCurrency(worker.overtimeHourlyRate, currency, language)}</strong>/ساعت</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all duration-150 active:scale-95 shrink-0"
              title="بستن (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Pill Bar (Clean Segmented Dock) */}
          <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar text-xs">
            {worker?.phone && (
              <a
                href={`tel:${worker.phone}`}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 border border-slate-200/80 dark:border-slate-700 font-bold flex items-center gap-1.5 transition-all shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />
                <span>تماس مستقیم</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setIsAdvanceModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-400 border border-slate-200/80 dark:border-slate-700 font-bold flex items-center gap-1.5 transition-all shrink-0"
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              <span>ثبت مساعده جدید</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQuickAttendanceOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-400 border border-slate-200/80 dark:border-slate-700 font-bold flex items-center gap-1.5 transition-all shrink-0"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-sky-500" />
              <span>ثبت سریع ماهانه</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettlementModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700 font-bold flex items-center gap-1.5 transition-all shrink-0"
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-500" />
              <span>صدور تسویه‌حساب</span>
            </button>

            <button
              type="button"
              onClick={handleOpenQRModal}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-400 border border-slate-200/80 dark:border-slate-700 font-bold flex items-center gap-1.5 transition-all shrink-0"
              title="ساخت لینک یا بارکد ورود اختصاصی پرسنل"
            >
              <Lock className="w-3.5 h-3.5 text-sky-500" />
              <span>لینک / بارکد ورود</span>
            </button>
          </div>
        </div>
      </header>

      {/* Wrongly-settled work warning: settled days dated AFTER the settlement that paid them or unpaid partial settlements */}
      {fin?.suspiciousSettledLogs?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 shrink-0">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="flex-1 text-amber-900 dark:text-amber-200 leading-relaxed">
              <b>هشدار مالی:</b> {fin.suspiciousSettledLogs.length} روز کارکرد ({fin.suspiciousSettledLogs.slice(0, 5).map((l) => l.date).join('، ')}
              {fin.suspiciousSettledLogs.length > 5 ? '، …' : ''}) «تسویه‌شده» علامت خورده، در حالی که تاریخ آن بعد از آخرین سند تسویه است
              {fin.lastSettlementDate ? ` (${fin.lastSettlementDate})` : ''}. اگر پرداخت نشده‌اند، به کارکرد جاری برگردانید تا از مانده‌ی پرسنل جا نیفتند.
            </div>
            <button
              type="button"
              disabled={isRepairingSettled}
              onClick={handleRepairSuspiciousLogs}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold shrink-0 cursor-pointer shadow-xs transition-colors"
            >
              {isRepairingSettled ? 'در حال اصلاح…' : 'برگرداندن به کارکرد جاری'}
            </button>
          </div>
        </div>
      )}

      {/* Financial Highlights Bar (Harmonized Cards) */}
      <div className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Net Balance Due */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
              طلب / مانده حساب جاری
            </span>
            <div className={`text-sm sm:text-base font-black truncate font-mono ${
              stats.netBalanceDue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {formatCurrency(stats.netBalanceDue, currency, language)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {stats.netBalanceDue >= 0 ? 'طلبکار از کارگاه' : 'بدهکار مساعده'}
            </span>
          </div>

          {/* Unsettled Gross Pay */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
              کارکرد معوق (ناخالص)
            </span>
            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate font-mono">
              {formatCurrency(stats.unsettledGrossPay, currency, language)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {stats.unsettledDaysCount} روز کارکرد جاری
            </span>
          </div>

          {/* Unsettled Advances */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
              مساعده‌های کسر نشده
            </span>
            <div className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 truncate font-mono">
              {formatCurrency(stats.unsettledAdvances, currency, language)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              کسر در زمان تسویه
            </span>
          </div>

          {/* Settled All-Time */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
              کل مبالغ تسویه شده
            </span>
            <div className="text-sm sm:text-base font-black text-sky-600 dark:text-sky-400 truncate font-mono">
              {formatCurrency(stats.settledGrossPay, currency, language)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {stats.settledDaysCount} روز در آرشیو
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation (Navbar-style Dock: Large Icons, Active-only Text, Smooth Transitions) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shrink-0 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-start sm:justify-center overflow-x-auto no-scrollbar">
          <nav className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner">
            {[
              { id: 'overview', label: 'مشخصات و خلاصه', icon: User, count: null },
              { id: 'attendance', label: 'سوابق کارکرد', icon: Calendar, count: allLogs.length },
              { id: 'advances', label: 'مساعده‌ها و واریزی‌ها', icon: DollarSign, count: filteredPayments.length },
              { id: 'settlements', label: 'رسیدهای تسویه', icon: Receipt, count: settlementReceipts.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <div key={tab.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-label={tab.label}
                    title={tab.label}
                    className={`relative p-2.5 sm:px-3.5 rounded-xl transition-all duration-300 ease-out flex items-center gap-2 shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 scale-105 font-bold border border-sky-400/30'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60'
                    }`}
                  >
                    {/* Enlarged Icon (w-5.5 h-5.5) with hover scale transition */}
                    <Icon className="w-5.5 h-5.5 transition-transform duration-200 group-hover:scale-110 shrink-0" />
                    
                    {/* Text Label only visible on active tab with fade/slide transition */}
                    {isActive && (
                      <span className="text-xs sm:text-sm font-semibold whitespace-nowrap px-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
                        {tab.label}
                      </span>
                    )}

                    {/* Badge Count */}
                    {tab.count !== null && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono transition-colors ${
                        isActive 
                          ? 'bg-white/25 text-white font-bold' 
                          : 'bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                      }`}>
                        {tab.count}
                      </span>
                    )}

                    {/* Active dot indicator underneath */}
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs" />
                    )}
                  </button>

                  {/* Micro-Tooltip on hover for inactive tabs */}
                  {!isActive && (
                    <div className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50">
                      {tab.label}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Body Contents */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">

          {/* TAB 1: OVERVIEW & PERSONAL INFO */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Personal Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-sky-500" />
                    <span>اطلاعات پرسنلی و شغلی</span>
                  </h3>
                  
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">نام و نام خانوادگی:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{worker?.name}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">سمت شغلی (تخصص):</span>
                      <span className="font-bold text-slate-900 dark:text-white">{worker?.role || 'مشخص نشده'}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">نقش در تیم:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {worker?.teamRole === 'master' ? 'استادکار / سرتیم' : 'نیروی کار'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">گروه کاری:</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        {group?.name || 'بدون گروه (انفرادی)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">شماره تلفن:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {worker?.phone || 'ثبت نشده'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 dark:text-slate-400">وضعیت همکاری:</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        worker?.isActive !== false
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {worker?.isActive !== false ? 'فعال و شاغل' : 'غیرفعال / پایان همکاری'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Wage & Working Conditions */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-500" />
                    <span>شرایط دستمزد و ساعات کاری</span>
                  </h3>
                  
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">دستمزد پایه هر روز کاری:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(worker?.dailyRate || 0, currency, language)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">نرخ هر ساعت اضافه کاری:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                        {formatCurrency(worker?.overtimeHourlyRate || 0, currency, language)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">ساعت کار استاندارد روز:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {worker?.standardHours || 8} ساعت در روز
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500 dark:text-slate-400">روزهای کاری در هفته:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {worker?.workingDaysPerWeek || 6} روز
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 dark:text-slate-400">تاریخ شروع به کار:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {worker?.startDate ? formatFullDateWithWeekday(worker.startDate, language) : 'ثبت نشده'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes or Personal Instructions */}
              {worker?.notes && (
                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>یادداشت‌ها و توضیحات پرسنل:</span>
                  </h4>
                  <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    {worker.notes}
                  </p>
                </div>
              )}

              {/* Attendance Breakdown Tiles */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-500" />
                  <span>تفکیک کارکرد و روزهای حضور جاری (تسویه نشده):</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">روز کامل</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                      {stats.unsettledFullDays}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">نیم‌روز</span>
                    <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                      {stats.unsettledHalfDays}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">ساعتی</span>
                    <span className="text-base font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                      {stats.unsettledHourlyDays}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">اضافه کاری جاری</span>
                    <span className="text-base font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                      {formatHoursAndMinutes(stats.unsettledOvertimeHours)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE RECORDS */}
          {activeTab === 'attendance' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Filter Buttons */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      attendanceFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    همه ({allLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('unsettled')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      attendanceFilter === 'unsettled'
                        ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    جاری / تسویه نشده ({stats.unsettledDaysCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('settled')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      attendanceFilter === 'settled'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    تسویه شده / آرشیو ({stats.settledDaysCount})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsQuickAttendanceOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت روزهای کاری</span>
                </button>
              </div>

              {/* Records List */}
              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                  <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    هیچ رکورد کارکردی در این فیلتر ثبت نشده است.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.map((log) => {
                    const isSettled = fin?.isLogSettled(log);

                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSettled
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/40'
                            : 'bg-white dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300'
                        }`}
                      >
                        {/* Date & Details */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs shrink-0 ${
                            isSettled
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          }`}>
                            <Calendar className="w-4 h-4" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {formatFullDateWithWeekday(log.date, language)}
                              </span>

                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.type === 'half'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : log.type === 'hourly'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                              }`}>
                                {log.type === 'half' ? 'نیم‌روز' : log.type === 'hourly' ? 'ساعتی' : 'روز کامل'}
                              </span>

                              {isSettled ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>تسویه شده</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                                  جاری
                                </span>
                              )}
                            </div>

                            {Number(log.overtimeHours) > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>اضافه کاری: {formatHoursAndMinutes(log.overtimeHours)}</span>
                              </div>
                            )}

                            {log.notes && (
                              <p className="text-[11px] text-slate-400 italic mt-0.5 truncate max-w-sm">
                                "{log.notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Pay and Edit Button */}
                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          <div className="text-end">
                            <span className="text-xs text-slate-400 block">دستمزد روز:</span>
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                              {formatCurrency(log.totalDayPay || 0, currency, language)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingLog(log)}
                            className="p-2 rounded-xl text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title={isSettled ? 'مشاهده رکورد قفل شده' : 'ویرایش رکورد'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADVANCES & PAYMENTS */}
          {activeTab === 'advances' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setAdvancesFilter('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      advancesFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    همه
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvancesFilter('unsettled')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      advancesFilter === 'unsettled'
                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    معوق / کسر نشده
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvancesFilter('settled')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      advancesFilter === 'settled'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    کسر شده در تسویه
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت مساعده جدید</span>
                </button>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                  <CreditCard className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    هیچ مساعده یا پرداختی ثبت نشده است.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPayments.map((p) => {
                    const isSettled = fin?.isPaymentSettled(p);

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isSettled
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/40'
                            : 'bg-white dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-xs shrink-0 ${
                            isSettled
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}>
                            <DollarSign className="w-4 h-4" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {formatFullDateWithWeekday(p.date, language)}
                              </span>

                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {p.type || 'مساعده'}
                              </span>

                              {isSettled ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>کسر شده در تسویه</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200/60">
                                  در انتظار کسر از حساب
                                </span>
                              )}
                            </div>

                            {p.notes && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {p.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <span className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-white">
                            {formatCurrency(p.amount || 0, currency, language)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SETTLEMENTS */}
          {activeTab === 'settlements' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  سوابق و برگه‌های تسویه‌حساب نهایی:
                </h4>

                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسویه حساب جدید</span>
                </button>
              </div>

              {settlementReceipts.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                  <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    تاکنون هیچ برگه تسویه‌ای برای این پرسنل ثبت نشده است.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {settlementReceipts.map((st) => (
                    <div
                      key={st.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-sm shrink-0">
                          <Receipt className="w-5 h-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              برگه تسویه نهایی
                            </span>
                            <span className="font-mono text-xs text-slate-400">
                              ({formatDateDisplay(st.date, language)})
                            </span>
                          </div>
                          {st.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {st.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-end">
                        <span className="text-[11px] text-slate-400 block">مبلغ تسویه شده:</span>
                        <span className="font-mono font-black text-base text-purple-600 dark:text-purple-400">
                          {formatCurrency(st.amount || 0, currency, language)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modal Footer */}
      <div className="border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 shadow-xs">
        <div className="max-w-7xl mx-auto w-full p-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            شناسه سیستمی: <span className="font-mono text-slate-500">{worker?.id}</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition-colors"
          >
            بستن (ESC)
          </button>
        </div>
      </div>

      {/* Sub-Modal: Edit Record Modal */}
      {editingLog && (
        <EditRecordModal
          isOpen={Boolean(editingLog)}
          log={editingLog}
          worker={worker}
          currency={currency}
          onClose={() => setEditingLog(null)}
          onSuccess={() => setEditingLog(null)}
        />
      )}

      {/* Sub-Modal: Quick Advance Payment Modal */}
      {isAdvanceModalOpen && (
        <AdvancePaymentModal
          isOpen={isAdvanceModalOpen}
          targetWorkerId={worker?.id}
          workers={allWorkers}
          onClose={() => setIsAdvanceModalOpen(false)}
        />
      )}

      {/* Sub-Modal: Quick Month Attendance */}
      {isQuickAttendanceOpen && (
        <QuickMonthAttendanceModal
          worker={worker}
          isOpen={isQuickAttendanceOpen}
          onClose={() => setIsQuickAttendanceOpen(false)}
        />
      )}

      {/* Sub-Modal: Settlement Modal for this worker */}
      {isSettlementModalOpen && (
        <SettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          worker={worker}
          allWorkers={allWorkers}
          allGroups={allGroups}
          allLogs={allLogs}
          allPayments={allPayments}
          onSelectWorker={() => {}}
        />
      )}

      {/* Personal access link / QR Code Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">لینک ورود اختصاصی پرسنل</h3>
              <button 
                onClick={() => setIsQRModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                با این لینک (یا بارکد)، <strong>{worker?.name}</strong> مستقیم و بدون نام کاربری، رمز عبور و کد کارگاه وارد پروفایل خودش می‌شود و فقط صورت‌حساب و گزارش کارکرد خودش را می‌بیند.
              </p>

              {qrUrl ? (
                <>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 inline-block">
                    <QRCodeSVG value={qrUrl} size={180} level="M" includeMargin={false} />
                  </div>

                  <p className="mt-4 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                    هر کسی که این لینک را داشته باشد وارد پروفایل این پرسنل می‌شود؛ آن را فقط برای خودِ او بفرستید. این لینک فقط همین یک بار نمایش داده می‌شود؛ اگر گم شد، لینک جدید بسازید.
                  </p>

                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(qrUrl);
                      alert('لینک ورود کپی شد.');
                    }}
                    className="mt-4 w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-sm transition-colors"
                  >
                    کپی لینک ورود
                  </button>

                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      onClick={() => {
                        navigator.share({ title: 'لینک ورود به پروفایل', url: qrUrl }).catch(() => {});
                      }}
                      className="mt-2 w-full py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-sm transition-colors"
                    >
                      اشتراک‌گذاری
                    </button>
                  )}
                </>
              ) : (
                <>
                  {qrRevoked && (
                    <p className="mb-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      دسترسی این پرسنل با لینک باطل شد.
                    </p>
                  )}
                  <button
                    onClick={handleCreateLink}
                    disabled={qrBusy}
                    className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors"
                  >
                    {qrBusy ? 'لطفاً صبر کنید…' : 'ساخت لینک ورود'}
                  </button>
                  <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                    ساخت لینک جدید، لینک قبلی این پرسنل را باطل می‌کند.
                  </p>
                </>
              )}

              {qrError && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400 leading-relaxed">{qrError}</p>
              )}

              <button
                onClick={handleRevokeLink}
                disabled={qrBusy}
                className="mt-5 text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-60"
              >
                باطل کردن دسترسی با لینک
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default WorkerProfileModal;
