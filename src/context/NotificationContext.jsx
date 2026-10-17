import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROJECT_ID } from '../db/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth, usePermissions } from './AuthContext';
import { useProject } from './ProjectContext';
import { getTodayDateString, formatCurrency } from '../utils/formatters';

const NotificationContext = createContext(null);

const SETTINGS_STORAGE_KEY = 'karsync_notification_settings_v1';
const READ_STORAGE_KEY = 'karsync_notifications_read_v1';
const DISMISSED_STORAGE_KEY = 'karsync_notifications_dismissed_v1';
const CUSTOM_NOTIFS_STORAGE_KEY = 'karsync_custom_notifications_v1';

export const DEFAULT_NOTIFICATION_SETTINGS = {
  // Channels & Feedback
  toastEnabled: true,
  soundEnabled: true,
  browserPushEnabled: false,

  // Attendance & Personnel Rules
  dailyAttendanceReminder: true,
  dailyAttendanceReminderTime: '19:00',
  dailyAttendanceAlwaysRemind: true, // Show soft reminder during day if 0 logs today
  settlementDueReminder: true,
  settlementDueDays: 15,
  consecutiveAbsenceAlert: true,
  consecutiveAbsenceDays: 3,

  // Financial & Treasury Rules
  lowBalanceAlert: true,
  lowBalanceThreshold: 5000000,
  workerDebtAlert: true,
  unpaidExpenseAlert: true,
  unpaidExpenseDays: 3,

  // System, Backup & Security Rules
  backupReminder: true,
  backupReminderDays: 7,
  pendingApprovalAlert: true
};

// Global helper so non-React modules (auditLogger, syncService, etc.) can fire toasts effortlessly
export function emitToast({ type = 'success', title = '', message = '', duration = 4000, action = null }) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('karsync-toast', {
        detail: {
          id: 'tst_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          type,
          title,
          message,
          duration,
          action,
          createdAt: Date.now()
        }
      })
    );
  }
}

// Global helper so non-React modules can push persistent notifications to the Bell Center
export function emitSystemNotification({
  category = 'system',
  severity = 'info',
  title = '',
  message = '',
  dedupKey = null,
  actionType = null,
  actionPayload = null
}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('karsync-system-notification', {
        detail: {
          id: dedupKey || 'ntf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          dedupKey: dedupKey || null,
          category,
          severity,
          title,
          message,
          actionType,
          actionPayload,
          createdAt: new Date().toISOString()
        }
      })
    );
  }
}

// Synthesized subtle Apple-like chime using Web Audio API (no external audio assets required)
function playSubtleChime(type = 'success') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'error') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'warning') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.16);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else {
      // Soft rising chime for success/info
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (_) {
    // Ignore audio context autoplay restrictions
  }
}

export function NotificationProvider({ children }) {
  const { language, formatNumber } = useLanguage();
  const { user, isWorker } = useAuth();
  const { hasPermission } = usePermissions();
  const { currentProject, openGlobalSettings } = useProject();

  const projectId = currentProject?.id || DEFAULT_PROJECT_ID;
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  // 1. Settings state
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_NOTIFICATION_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }, [settings]);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetNotificationSettings = useCallback(() => {
    setSettings(DEFAULT_NOTIFICATION_SETTINGS);
  }, []);

  // 2. Read & Dismissed tracking
  const [readMap, setReadMap] = useState(() => {
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  const [dismissedMap, setDismissedMap] = useState(() => {
    try {
      const saved = localStorage.getItem(DISMISSED_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  const [customNotifications, setCustomNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_NOTIFS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readMap));
    } catch (_) {}
  }, [readMap]);

  useEffect(() => {
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(dismissedMap));
    } catch (_) {}
  }, [dismissedMap]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_NOTIFS_STORAGE_KEY, JSON.stringify(customNotifications.slice(0, 50)));
    } catch (_) {}
  }, [customNotifications]);

  // 3. Ephemeral Toast Queue
  const [toasts, setToasts] = useState([]);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'success', title = '', message = '', duration = 3800, action = null, force = false }) => {
      if (!force && !settingsRef.current.toastEnabled) return;

      const id = 'tst_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const newToast = {
        id,
        type,
        title,
        message,
        duration,
        action,
        createdAt: Date.now()
      };

      if (settingsRef.current.soundEnabled) {
        playSubtleChime(type);
      }

      setToasts((prev) => [newToast, ...prev].slice(0, 4));

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      success: (message, title = '', options = {}) =>
        addToast({
          type: 'success',
          title:
            title ||
            (language === 'fa'
              ? 'عملیات موفق'
              : language === 'ku'
              ? 'سەرکەوتوو بوو'
              : 'Success'),
          message,
          ...options
        }),
      error: (message, title = '', options = {}) =>
        addToast({
          type: 'error',
          title:
            title ||
            (language === 'fa'
              ? 'خطا در عملیات'
              : language === 'ku'
              ? 'هەڵە ڕوویدا'
              : 'Error'),
          message,
          duration: 5000,
          ...options
        }),
      warning: (message, title = '', options = {}) =>
        addToast({
          type: 'warning',
          title:
            title ||
            (language === 'fa'
              ? 'توجه'
              : language === 'ku'
              ? 'ئاگاداری'
              : 'Warning'),
          message,
          duration: 4500,
          ...options
        }),
      info: (message, title = '', options = {}) =>
        addToast({
          type: 'info',
          title:
            title ||
            (language === 'fa'
              ? 'اطلاعیه'
              : language === 'ku'
              ? 'زانیاری'
              : 'Info'),
          message,
          ...options
        })
    }),
    [addToast, language]
  );

  // Listen to global `karsync-toast` and `karsync-system-notification` events
  useEffect(() => {
    const handleGlobalToast = (e) => {
      if (!e.detail) return;
      addToast(e.detail);
    };

    const handleSystemNotif = (e) => {
      if (!e.detail) return;
      const item = e.detail;
      setCustomNotifications((prev) => {
        const filtered = item.dedupKey ? prev.filter((n) => n.dedupKey !== item.dedupKey) : prev;
        return [item, ...filtered].slice(0, 50);
      });
      if (settingsRef.current.soundEnabled) {
        playSubtleChime(item.severity === 'critical' ? 'error' : 'info');
      }
    };

    window.addEventListener('karsync-toast', handleGlobalToast);
    window.addEventListener('karsync-system-notification', handleSystemNotif);
    return () => {
      window.removeEventListener('karsync-toast', handleGlobalToast);
      window.removeEventListener('karsync-system-notification', handleSystemNotif);
    };
  }, [addToast]);

  // 4. Live Database Queries for Smart Alert Evaluation
  const dbSnapshot = useLiveQuery(
    async () => {
      if (!user || isWorker) return null;
      try {
        const [
          workers,
          attendanceLogs,
          payments,
          expenses,
          financialAccounts,
          treasuryIncomes,
          accountTransfers
        ] = await Promise.all([
          db.workers ? db.workers.toArray() : [],
          db.attendanceLogs ? db.attendanceLogs.toArray() : [],
          db.payments ? db.payments.toArray() : [],
          db.expenses ? db.expenses.toArray() : [],
          db.financialAccounts ? db.financialAccounts.toArray() : [],
          db.treasuryIncomes ? db.treasuryIncomes.toArray() : [],
          db.accountTransfers ? db.accountTransfers.toArray() : []
        ]);

        return {
          workers: workers.filter(
            (w) =>
              !w.deletedAt &&
              !w.isArchived &&
              w.status !== 'archived' &&
              w.isActive === 1 &&
              (w.projectId || DEFAULT_PROJECT_ID) === projectId
          ),
          attendanceLogs: attendanceLogs.filter(
            (l) => !l.deletedAt && (l.projectId || DEFAULT_PROJECT_ID) === projectId
          ),
          payments: payments.filter(
            (p) => !p.deletedAt && (p.projectId || DEFAULT_PROJECT_ID) === projectId
          ),
          expenses: expenses.filter(
            (ex) => !ex.deletedAt && (ex.projectId || DEFAULT_PROJECT_ID) === projectId
          ),
          financialAccounts: financialAccounts.filter(
            (acc) =>
              !acc.deletedAt &&
              acc.isActive !== false &&
              (acc.projectId || DEFAULT_PROJECT_ID) === projectId
          ),
          treasuryIncomes: treasuryIncomes.filter(
            (inc) => !inc.deletedAt && (inc.projectId || DEFAULT_PROJECT_ID) === projectId
          ),
          accountTransfers: accountTransfers.filter(
            (tr) => !tr.deletedAt && (tr.projectId || DEFAULT_PROJECT_ID) === projectId
          )
        };
      } catch (err) {
        console.warn('Notification engine query error:', err);
        return null;
      }
    },
    [projectId, user?.id, isWorker]
  );

  // Minute ticker to re-evaluate time-based rules (e.g., 19:00 attendance reminder)
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMinuteTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // 5. Smart Notification Generator
  const smartNotifications = useMemo(() => {
    if (!dbSnapshot || !user || isWorker) return [];

    const alerts = [];
    const todayStr = getTodayDateString();
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const canManageExpenses = hasPermission ? hasPermission('expenses.manage') : true;
    const canManageSettlement = hasPermission ? hasPermission('settlement.manage') : true;

    const {
      workers,
      attendanceLogs,
      payments,
      expenses,
      financialAccounts,
      treasuryIncomes,
      accountTransfers
    } = dbSnapshot;

    // ---------------------------------------------------------
    // RULE A1: Missing Daily Attendance Reminder
    // ---------------------------------------------------------
    if (settings.dailyAttendanceReminder && workers.length > 0) {
      const todayLogs = attendanceLogs.filter((l) => l.date === todayStr);
      const loggedWorkerIds = new Set(todayLogs.map((l) => String(l.workerId)));
      const unloggedCount = workers.filter((w) => !loggedWorkerIds.has(String(w.id))).length;

      const reminderTime = settings.dailyAttendanceReminderTime || '19:00';
      const isPastReminderTime = currentHHMM >= reminderTime;

      if (unloggedCount > 0 && (isPastReminderTime || settings.dailyAttendanceAlwaysRemind)) {
        const isAllUnlogged = unloggedCount === workers.length;
        const dedupKey = `missing_attendance_${projectId}_${todayStr}_${unloggedCount}`;

        alerts.push({
          id: dedupKey,
          dedupKey,
          category: 'attendance',
          severity: isPastReminderTime ? 'critical' : 'warning',
          title:
            language === 'fa'
              ? isAllUnlogged
                ? 'کارکرد امروز هنوز ثبت نشده است'
                : `کارکرد ${formatNumber(unloggedCount)} نفر برای امروز ثبت نشده`
              : language === 'ku'
              ? isAllUnlogged
                ? 'کارکردی ئەمڕۆ تۆمار نەکراوە'
                : `کارکردی ${formatNumber(unloggedCount)} کەس بۆ ئەمڕۆ ماوە`
              : isAllUnlogged
              ? "Today's attendance is not logged yet"
              : `${unloggedCount} workers unlogged for today`,
          message:
            language === 'fa'
              ? isAllUnlogged
                ? `از مجموع ${formatNumber(workers.length)} نیروی فعال پروژه، هنوز هیچ کارکردی برای امروز (${todayStr}) ثبت نکرده‌اید.`
                : `وضعیت حضور و غیاب ${formatNumber(unloggedCount)} نفر از ${formatNumber(workers.length)} نیروی فعال امروز مشخص نشده است.`
              : language === 'ku'
              ? `لە کۆی ${formatNumber(workers.length)} کرێکاری چالاک، کارکردی ${formatNumber(unloggedCount)} کەس بۆ ئەمڕۆ تۆمار نەکراوە.`
              : `${unloggedCount} of ${workers.length} active workers have no attendance record for today.`,
          createdAt: now.toISOString(),
          actionLabel:
            language === 'fa'
              ? 'ثبت کارکرد امروز'
              : language === 'ku'
              ? 'تۆمارکردنی کارکرد'
              : 'Log Attendance',
          actionType: 'OPEN_DAILY_LOGGING',
          actionPayload: { date: todayStr }
        });
      }
    }

    // ---------------------------------------------------------
    // RULE A2: Workers with Unsettled Attendance >= Threshold Days
    // ---------------------------------------------------------
    if (settings.settlementDueReminder && canManageSettlement && workers.length > 0) {
      const dueThreshold = Math.max(1, Number(settings.settlementDueDays) || 15);
      const dueWorkers = [];

      workers.forEach((w) => {
        const unsettledActiveLogs = attendanceLogs.filter(
          (l) =>
            String(l.workerId) === String(w.id) &&
            !l.isSettled &&
            l.type !== 'absent'
        );
        if (unsettledActiveLogs.length >= dueThreshold) {
          dueWorkers.push({
            worker: w,
            daysCount: unsettledActiveLogs.length
          });
        }
      });

      if (dueWorkers.length > 0) {
        const topWorker = dueWorkers.sort((a, b) => b.daysCount - a.daysCount)[0];
        const dedupKey = `settlement_due_${projectId}_${dueWorkers.length}_${topWorker.daysCount}`;

        alerts.push({
          id: dedupKey,
          dedupKey,
          category: 'attendance',
          severity: 'info',
          title:
            language === 'fa'
              ? `موعد تسویه‌حساب ${formatNumber(dueWorkers.length)} نفر از پرسنل`
              : language === 'ku'
              ? `کاتی پاکتاوکردنی ${formatNumber(dueWorkers.length)} کرێکار`
              : `Settlement due for ${dueWorkers.length} workers`,
          message:
            language === 'fa'
              ? dueWorkers.length === 1
                ? `«${topWorker.worker.name}» دارای ${formatNumber(topWorker.daysCount)} روز کارکرد تسویه‌نشده است.`
                : `«${topWorker.worker.name}» (${formatNumber(topWorker.daysCount)} روز) و ${formatNumber(dueWorkers.length - 1)} نفر دیگر بیش از ${formatNumber(dueThreshold)} روز کارکرد تسویه‌نشده دارند.`
              : language === 'ku'
              ? `«${topWorker.worker.name}» و هاوکارەکانی زیاتر لە ${formatNumber(dueThreshold)} ڕۆژ کارکردی پاکتاونەکراویان هەیە.`
              : `${topWorker.worker.name} has ${topWorker.daysCount} unsettled working days.`,
          createdAt: now.toISOString(),
          actionLabel:
            language === 'fa'
              ? 'مشاهده و تسویه'
              : language === 'ku'
              ? 'بینین و پاکتاوکردن'
              : 'View & Settle',
          actionType: 'NAVIGATE_TAB',
          actionPayload: { tab: 'accounting' }
        });
      }
    }

    // ---------------------------------------------------------
    // RULE F1: Worker Advance Exceeding Earned Wages (Worker Debt Alert)
    // ---------------------------------------------------------
    if (settings.workerDebtAlert && canManageSettlement && workers.length > 0) {
      const indebtedWorkers = [];

      workers.forEach((w) => {
        const unsettledLogs = attendanceLogs.filter(
          (l) => String(l.workerId) === String(w.id) && !l.isSettled
        );
        const unsettledPayments = payments.filter(
          (p) =>
            String(p.workerId) === String(w.id) &&
            !p.isSettled &&
            p.type === 'advance'
        );

        const totalEarned = unsettledLogs.reduce(
          (sum, l) => sum + (Number(l.totalDayPay) || 0),
          0
        );
        const totalAdvances = unsettledPayments.reduce(
          (sum, p) => sum + (Number(p.amount) || 0),
          0
        );

        if (totalAdvances > totalEarned && totalAdvances > 0) {
          indebtedWorkers.push({
            worker: w,
            debtAmount: totalAdvances - totalEarned
          });
        }
      });

      if (indebtedWorkers.length > 0) {
        const topDebtor = indebtedWorkers.sort((a, b) => b.debtAmount - a.debtAmount)[0];
        const dedupKey = `worker_debt_${projectId}_${indebtedWorkers.length}_${Math.round(topDebtor.debtAmount)}`;

        alerts.push({
          id: dedupKey,
          dedupKey,
          category: 'financial',
          severity: 'warning',
          title:
            language === 'fa'
              ? `مساعده بیش از کارکرد (${formatNumber(indebtedWorkers.length)} نفر)`
              : language === 'ku'
              ? `پێشینە زیاترە لە کارکرد (${formatNumber(indebtedWorkers.length)} کەس)`
              : `Advances exceed wages (${indebtedWorkers.length} workers)`,
          message:
            language === 'fa'
              ? `مجموع مساعده‌های دریافتی «${topDebtor.worker.name}» به میزان ${formatCurrency(topDebtor.debtAmount, currency, language)} بیشتر از کارکرد فعلی اوست.`
              : language === 'ku'
              ? `کۆی پێشینەی «${topDebtor.worker.name}» بە بڕی ${formatCurrency(topDebtor.debtAmount, currency, language)} لە کارکردی زیاترە.`
              : `${topDebtor.worker.name}'s advances exceed earned wages by ${formatCurrency(topDebtor.debtAmount, currency, language)}.`,
          createdAt: now.toISOString(),
          actionLabel:
            language === 'fa'
              ? 'بررسی تراز پرسنل'
              : language === 'ku'
              ? 'پشکنینی باڵانس'
              : 'Check Payroll',
          actionType: 'NAVIGATE_TAB',
          actionPayload: { tab: 'accounting' }
        });
      }
    }

    // ---------------------------------------------------------
    // RULE F2: Low / Negative Financial Account Balance
    // ---------------------------------------------------------
    if (settings.lowBalanceAlert && canManageSettlement && financialAccounts.length > 0) {
      const threshold = Number(settings.lowBalanceThreshold) || 0;

      financialAccounts.forEach((acc) => {
        const accId = String(acc.id);
        const isDefaultCash = Boolean(acc.isDefault) || acc.type === 'cash';
        const initialBal = Number(acc.initialBalance) || 0;

        // Incomes into this account
        const accIncomes = treasuryIncomes
          .filter(
            (inc) =>
              inc.status !== 'rejected' &&
              (String(inc.accountId) === accId ||
                (!inc.accountId && isDefaultCash && (inc.accountType === 'cash' || !inc.accountType)))
          )
          .reduce((s, inc) => s + (Number(inc.amount) || 0), 0);

        // Transfers in & out
        const transfersIn = accountTransfers
          .filter((tr) => String(tr.toAccountId) === accId)
          .reduce((s, tr) => s + (Number(tr.amount) || 0), 0);

        const transfersOut = accountTransfers
          .filter((tr) => String(tr.fromAccountId) === accId)
          .reduce((s, tr) => s + (Number(tr.amount) || 0) + (Number(tr.fee) || 0), 0);

        // Payments from this account
        const accPayments = payments
          .filter(
            (p) =>
              p.status !== 'rejected' &&
              (String(p.accountId) === accId || (!p.accountId && isDefaultCash))
          )
          .reduce((s, p) => s + (Number(p.amount) || 0), 0);

        // Paid expenses from this account
        const accExpenses = expenses
          .filter(
            (ex) =>
              ex.paymentStatus === 'paid' &&
              (String(ex.accountId) === accId || (!ex.accountId && isDefaultCash))
          )
          .reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

        const currentBalance =
          initialBal + accIncomes + transfersIn - transfersOut - accPayments - accExpenses;

        // Trigger alert if negative OR (had activity and dropped below threshold)
        const hasActivity =
          initialBal > 0 || accIncomes > 0 || transfersIn > 0 || accPayments > 0 || accExpenses > 0;

        if (currentBalance < 0 || (hasActivity && currentBalance < threshold)) {
          const isNegative = currentBalance < 0;
          const dedupKey = `low_balance_${projectId}_${accId}_${isNegative ? 'neg' : 'low'}_${Math.round(currentBalance)}`;

          alerts.push({
            id: dedupKey,
            dedupKey,
            category: 'financial',
            severity: isNegative ? 'critical' : 'warning',
            title:
              language === 'fa'
                ? isNegative
                  ? `کسری موجودی در «${acc.name}»`
                  : `کاهش موجودی «${acc.name}» به زیر سقف مجاز`
                : language === 'ku'
                ? isNegative
                  ? `کورتهێنانی باڵانس لە «${acc.name}»`
                  : `کەمبوونەوەی باڵانسی «${acc.name}»`
                : isNegative
                ? `Negative balance in "${acc.name}"`
                : `Low balance in "${acc.name}"`,
            message:
              language === 'fa'
                ? `مانده فعلی حساب «${acc.name}» برابر با ${formatCurrency(currentBalance, currency, language)} است${
                    !isNegative ? ` (کمتر از آستانه ${formatCurrency(threshold, currency, language)})` : ''
                  }.`
                : language === 'ku'
                ? `باڵانسی ئێستای «${acc.name}» بریتییە لە ${formatCurrency(currentBalance, currency, language)}.`
                : `Current balance of "${acc.name}" is ${formatCurrency(currentBalance, currency, language)}.`,
            createdAt: now.toISOString(),
            actionLabel:
              language === 'fa'
                ? 'مدیریت خزانه‌داری'
                : language === 'ku'
                ? 'بەڕێوەبردنی خەزێنە'
                : 'Open Treasury',
            actionType: 'NAVIGATE_TAB',
            actionPayload: { tab: 'accounting' }
          });
        }
      });
    }

    // ---------------------------------------------------------
    // RULE F3: Unpaid / Credit Expenses Reminder
    // ---------------------------------------------------------
    if (settings.unpaidExpenseAlert && canManageExpenses && expenses.length > 0) {
      const daysLimit = Math.max(0, Number(settings.unpaidExpenseDays) || 3);
      const unpaidList = expenses.filter((ex) => {
        if (ex.paymentStatus === 'paid') return false;
        const dateStr = ex.expenseDate || ex.date || (ex.createdAt ? ex.createdAt.slice(0, 10) : todayStr);
        const diffDays = Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= daysLimit;
      });

      if (unpaidList.length > 0) {
        const totalUnpaidAmount = unpaidList.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
        const dedupKey = `unpaid_expenses_${projectId}_${unpaidList.length}_${Math.round(totalUnpaidAmount)}`;

        alerts.push({
          id: dedupKey,
          dedupKey,
          category: 'financial',
          severity: 'warning',
          title:
            language === 'fa'
              ? `${formatNumber(unpaidList.length)} فاکتور نسیه / پرداخت‌نشده`
              : language === 'ku'
              ? `${formatNumber(unpaidList.length)} وەسڵی قەرز / نەدراو`
              : `${unpaidList.length} Unpaid / Credit Expenses`,
          message:
            language === 'fa'
              ? `مجموعاً ${formatCurrency(totalUnpaidAmount, currency, language)} بابت ${formatNumber(unpaidList.length)} هزینه ثبت‌شده بیش از ${formatNumber(daysLimit)} روز است که تسویه نشده است.`
              : language === 'ku'
              ? `بڕی ${formatCurrency(totalUnpaidAmount, currency, language)} بۆ ${formatNumber(unpaidList.length)} خەرجی تۆمارکراو پاکتاو نەکراوە.`
              : `Total of ${formatCurrency(totalUnpaidAmount, currency, language)} across ${unpaidList.length} expenses remains unpaid.`,
          createdAt: now.toISOString(),
          actionLabel:
            language === 'fa'
              ? 'مشاهده هزینه‌ها'
              : language === 'ku'
              ? 'بینینی خەرجییەکان'
              : 'View Expenses',
          actionType: 'NAVIGATE_TAB',
          actionPayload: { tab: 'expenses' }
        });
      }
    }

    // ---------------------------------------------------------
    // RULE S1: Local Backup Reminder
    // ---------------------------------------------------------
    if (settings.backupReminder) {
      const lastBackupStr = localStorage.getItem('karsync_last_backup_at');
      const backupDaysLimit = Math.max(1, Number(settings.backupReminderDays) || 7);
      const totalRecordsCount = workers.length + attendanceLogs.length + expenses.length;

      let needsBackup = false;
      let daysSinceBackup = null;

      if (totalRecordsCount > 5) {
        if (!lastBackupStr) {
          needsBackup = true;
        } else {
          const diff = Math.floor((now.getTime() - new Date(lastBackupStr).getTime()) / (1000 * 60 * 60 * 24));
          if (diff >= backupDaysLimit) {
            needsBackup = true;
            daysSinceBackup = diff;
          }
        }
      }

      if (needsBackup) {
        const dedupKey = `backup_reminder_${todayStr.slice(0, 7)}_${daysSinceBackup || 'never'}`;
        alerts.push({
          id: dedupKey,
          dedupKey,
          category: 'system',
          severity: 'info',
          title:
            language === 'fa'
              ? 'یادآوری تهیه نسخه پشتیبان (Backup)'
              : language === 'ku'
              ? 'بیرخستنەوەی هەڵگرتنی پاشەکەوت (Backup)'
              : 'Database Backup Reminder',
          message:
            language === 'fa'
              ? daysSinceBackup
                ? `${formatNumber(daysSinceBackup)} روز از آخرین پشتیبان‌گیری محلی شما گذشته است. برای امنیت کامل اطلاعات، فایل پشتیبان دانلود کنید.`
                : 'پیشنهاد می‌شود برای محافظت ۱۰۰٪ از اطلاعات کارگاه، یک فایل پشتیبان محلی (JSON) روی دستگاه خود ذخیره کنید.'
              : language === 'ku'
              ? 'بۆ پاراستنی داتاکانی پڕۆژە، پێشنیار دەکرێت فایلی پاشەکەوتی ناوخۆیی دابەزێنیت.'
              : 'Save a local JSON backup file to keep an offline snapshot of your workshop records.',
          createdAt: now.toISOString(),
          actionLabel:
            language === 'fa'
              ? 'پشتیبان‌گیری و همگام‌سازی'
              : language === 'ku'
              ? 'پاشەکەوتکردن'
              : 'Open Backup',
          actionType: 'OPEN_SETTINGS_TAB',
          actionPayload: { tab: 'sync_data' }
        });
      }
    }

    // ---------------------------------------------------------
    // RULE S2: Pending Approvals in Multi-User Workspace
    // ---------------------------------------------------------
    if (settings.pendingApprovalAlert && canManageSettlement) {
      const pendingExpenses = expenses.filter((e) => e.status === 'draft' || e.status === 'pending_approval').length;
      const pendingPayments = payments.filter((p) => p.approval_status === 'pending' || p.status === 'draft').length;
      const totalPending = pendingExpenses + pendingPayments;

      if (totalPending > 0) {
        const dedupKey = `pending_approvals_${projectId}_${totalPending}`;
        alerts.push({
          id: dedupKey,
          dedupKey,
          category: 'system',
          severity: 'warning',
          title:
            language === 'fa'
              ? `${formatNumber(totalPending)} سند مالی در انتظار تأیید شما`
              : language === 'ku'
              ? `${formatNumber(totalPending)} بەڵگەنامە چاوەڕێی پەسەندکردنە`
              : `${totalPending} records awaiting approval`,
          message:
            language === 'fa'
              ? 'توسط سایر کاربران کارگاه اسنادی ثبت شده که نیازمند بررسی و تأیید نهایی مدیر است.'
              : 'بەڵگەنامەی نوێ تۆمارکراوە کە پێویستی بە پەسەندکردنی بەڕێوەبەر هەیە.',
          createdAt: now.toISOString(),
          actionLabel:
            language === 'fa'
              ? 'بررسی اسناد'
              : language === 'ku'
              ? 'پشکنینی بەڵگەنامەکان'
              : 'Review Records',
          actionType: 'NAVIGATE_TAB',
          actionPayload: { tab: 'accounting' }
        });
      }
    }

    return alerts;
  }, [
    dbSnapshot,
    user,
    isWorker,
    settings,
    projectId,
    currency,
    language,
    formatNumber,
    hasPermission,
    minuteTick
  ]);

  // Combine smart alerts + custom notifications, filtering out dismissed ones
  const allNotifications = useMemo(() => {
    const combined = [...smartNotifications, ...customNotifications];
    return combined
      .filter((n) => !dismissedMap[n.dedupKey || n.id])
      .map((n) => ({
        ...n,
        isRead: Boolean(readMap[n.dedupKey || n.id])
      }));
  }, [smartNotifications, customNotifications, dismissedMap, readMap]);

  const unreadCount = useMemo(
    () => allNotifications.filter((n) => !n.isRead).length,
    [allNotifications]
  );

  // Actions on notifications
  const markAsRead = useCallback((idOrKey) => {
    if (!idOrKey) return;
    setReadMap((prev) => ({ ...prev, [idOrKey]: true }));
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadMap((prev) => {
      const next = { ...prev };
      allNotifications.forEach((n) => {
        next[n.dedupKey || n.id] = true;
      });
      return next;
    });
  }, [allNotifications]);

  const dismissNotification = useCallback((idOrKey) => {
    if (!idOrKey) return;
    setDismissedMap((prev) => ({ ...prev, [idOrKey]: Date.now() }));
    setCustomNotifications((prev) => prev.filter((n) => (n.dedupKey || n.id) !== idOrKey));
  }, []);

  const clearAllDismissed = useCallback(() => {
    setDismissedMap({});
    setReadMap({});
  }, []);

  // Execute action when a user clicks an actionable notification in the Bell popover
  const executeNotificationAction = useCallback(
    (notif) => {
      if (!notif) return;
      markAsRead(notif.dedupKey || notif.id);

      const { actionType, actionPayload } = notif;
      if (actionType === 'OPEN_DAILY_LOGGING') {
        window.dispatchEvent(
          new CustomEvent('karsync-open-daily-logging', {
            detail: { date: actionPayload?.date || getTodayDateString() }
          })
        );
      } else if (actionType === 'NAVIGATE_TAB' && actionPayload?.tab) {
        window.dispatchEvent(
          new CustomEvent('navigateApp', {
            detail: { tab: actionPayload.tab }
          })
        );
      } else if (actionType === 'OPEN_SETTINGS_TAB' && actionPayload?.tab) {
        if (openGlobalSettings) {
          openGlobalSettings(actionPayload.tab);
        }
      }
    },
    [markAsRead, openGlobalSettings]
  );

  // Request Browser Notification Permission & Send Test Notification
  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.warning(
        language === 'fa'
          ? 'مرورگر شما از اعلان سیستم‌عامل پشتیبانی نمی‌کند.'
          : 'Browser notifications are not supported on this device.'
      );
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updateSettings({ browserPushEnabled: true });
        toast.success(
          language === 'fa'
            ? 'اعلان‌های مرورگر با موفقیت فعال شدند.'
            : 'Browser notifications enabled successfully.'
        );
        try {
          new Notification('KarSync • سیستم هوشمند اعلان', {
            body:
              language === 'fa'
                ? 'اعلان‌های سیستم‌عامل و مرورگر برای کارگاه شما فعال شد.'
                : 'Browser notifications are now active for your workspace.',
            icon: '/karsync-icon.png'
          });
        } catch (_) {}
        return true;
      } else {
        updateSettings({ browserPushEnabled: false });
        toast.error(
          language === 'fa'
            ? 'دسترسی به اعلان مرورگر رد شد. از تنظیمات مرورگر آن را فعال کنید.'
            : 'Notification permission was denied by browser.'
        );
        return false;
      }
    } catch (err) {
      console.warn('Browser notification permission error:', err);
      return false;
    }
  }, [language, toast, updateSettings]);

  const sendTestNotification = useCallback(() => {
    addToast({
      type: 'success',
      force: true,
      title:
        language === 'fa'
          ? 'تست پیام فوری (Toast)'
          : language === 'ku'
          ? 'تاقیکردنەوەی پەیامی خێرا'
          : 'Toast Alert Test',
      message:
        language === 'fa'
          ? 'سیستم پیام‌های وضعیت و اعلان‌های هوشمند KarSync به درستی کار می‌کند.'
          : language === 'ku'
          ? 'سیستەمی ئاگادارکردنەوەی KarSync بە سەرکەوتوویی کار دەکات.'
          : 'KarSync Toast & Smart Notification engine is working properly.'
    });

    emitSystemNotification({
      category: 'system',
      severity: 'info',
      dedupKey: 'test_notification_sample',
      title:
        language === 'fa'
          ? 'نمونه اعلان آزمایشی در مرکز اعلان‌ها'
          : language === 'ku'
          ? 'نموونەی ئاگادارکردنەوەی تاقیکاری'
          : 'Sample Notification in Bell Center',
      message:
        language === 'fa'
          ? 'این یک اعلان آزمایشی است. هشدارهای کارکرد و مالی کارگاه در این بخش نمایش داده می‌شوند.'
          : 'ئەمە ئاگادارکردنەوەیەکی تاقیکارییە لە ناوەندی زەنگۆڵە.',
      actionType: 'NAVIGATE_TAB',
      actionPayload: { tab: 'dashboard' }
    });

    if (
      settings.browserPushEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification('KarSync • تست اعلان', {
          body:
            language === 'fa'
              ? 'ارتباط سیستم اعلان KarSync با مرورگر برقرار است.'
              : 'KarSync notification test successful.',
          icon: '/karsync-icon.png'
        });
      } catch (_) {}
    }
  }, [addToast, language, settings.browserPushEnabled]);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      resetNotificationSettings,
      notifications: allNotifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAllDismissed,
      executeNotificationAction,
      toasts,
      addToast,
      removeToast,
      toast,
      requestBrowserPermission,
      sendTestNotification
    }),
    [
      settings,
      updateSettings,
      resetNotificationSettings,
      allNotifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAllDismissed,
      executeNotificationAction,
      toasts,
      addToast,
      removeToast,
      toast,
      requestBrowserPermission,
      sendTestNotification
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
