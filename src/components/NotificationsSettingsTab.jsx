import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { formatCurrency } from '../utils/formatters';
import {
  BellRing,
  CalendarClock,
  Wallet,
  ShieldCheck,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Clock,
  RotateCcw,
  Smartphone,
  Receipt,
  AlertTriangle,
  Database,
  Users2,
  Sliders
} from 'lucide-react';

export default function NotificationsSettingsTab() {
  const {
    settings,
    updateSettings,
    resetNotificationSettings,
    clearAllDismissed,
    requestBrowserPermission,
    sendTestNotification,
    unreadCount,
    notifications
  } = useNotifications();

  const { language, formatNumber } = useLanguage();
  const { currentProject } = useProject();
  const currency = currentProject?.base_currency || currentProject?.currency || 'IQD';

  const ToggleSwitch = ({ checked, onChange, color = 'bg-sky-500' }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-hidden ${
        checked ? color : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
          checked
            ? 'ltr:translate-x-5 rtl:-translate-x-5'
            : 'translate-x-0'
        }`}
      />
    </button>
  );

  const timePresets = ['17:00', '19:00', '20:00', '21:30'];
  const settlementDayPresets = [7, 15, 30, 45];
  const balanceThresholdPresets = [0, 1000000, 5000000, 10000000, 50000000];
  const unpaidDayPresets = [1, 3, 7, 14];
  const backupDayPresets = [3, 7, 14, 30];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Hero Banner (Apple Liquid Glass Header Card) */}
      <div className="relative overflow-hidden rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 flex-shrink-0">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {language === 'fa'
                    ? 'مرکز فرماندهی اعلان‌ها و هشدارهای هوشمند'
                    : language === 'ku'
                    ? 'ناوەندی کۆنترۆڵی ئاگادارکردنەوە زیرەکەکان'
                    : 'Smart Notifications & Alert Command Center'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {language === 'fa'
                    ? `${formatNumber(notifications.length)} هشدار فعال`
                    : `${formatNumber(notifications.length)} Active`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {language === 'fa'
                  ? 'قوانین دستیار هوشمند کارگاه، پیام‌های فوری تایید عملیات (Toast) و یادآورهای مالی و حضور و غیاب را مطابق نیاز خود شخصی‌سازی کنید.'
                  : language === 'ku'
                  ? 'یاساکانی یاریدەدەری زیرەکی کارگە، پەیامە خێراکان و بیرخستنەوە داراییەکان ڕێکبخە.'
                  : 'Customize smart workshop assistant rules, instant operation toast alerts, and financial/attendance reminders.'}
              </p>
            </div>
          </div>

          {/* Quick Live Test Button */}
          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
            <button
              type="button"
              onClick={sendTestNotification}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {language === 'fa'
                  ? 'تست زنده اعلان و Toast'
                  : language === 'ku'
                  ? 'تاقیکردنەوەی زیندوو'
                  : 'Test Live Alert'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop 12-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ============================================================ */}
        {/* PRIMARY COLUMN (7 Cols): Attendance & Financial Smart Rules  */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Attendance & Personnel Reminders */}
          <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'یادآورهای حضور و غیاب و پرسنل'
                      : language === 'ku'
                      ? 'بیرخستنەوەکانی ئامادەبوون و کرێکاران'
                      : 'Attendance & Personnel Reminders'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'fa'
                      ? 'جلوگیری از فراموشی ثبت کارکرد روزانه و مدیریت موعد تسویه‌ها'
                      : 'Prevent missed daily logs and track worker settlement cycles'}
                  </p>
                </div>
              </div>
            </div>

            {/* Rule 1: Daily Attendance Reminder */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'یادآوری عدم ثبت کارکرد روزانه'
                      : language === 'ku'
                      ? 'بیرخستنەوەی تۆمارنەکردنی کارکردی ڕۆژانە'
                      : 'Missing Daily Attendance Reminder'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'fa'
                      ? 'هشدار در صورتی که کارکرد پرسنل فعال برای روز جاری ثبت نشده باشد'
                      : 'Alert when active workers have not been logged for today'}
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.dailyAttendanceReminder}
                  onChange={(val) => updateSettings({ dailyAttendanceReminder: val })}
                />
              </div>

              {settings.dailyAttendanceReminder && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-500" />
                      {language === 'fa'
                        ? 'ساعت هشدار ویژه شبانه:'
                        : language === 'ku'
                        ? 'کاتژمێری بیرخستنەوە:'
                        : 'Priority Reminder Time:'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {timePresets.map((timeStr) => {
                        const isSelected = settings.dailyAttendanceReminderTime === timeStr;
                        return (
                          <button
                            key={timeStr}
                            type="button"
                            onClick={() => updateSettings({ dailyAttendanceReminderTime: timeStr })}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${
                              isSelected
                                ? 'bg-sky-500 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-400'
                            }`}
                          >
                            {formatNumber(timeStr)}
                          </button>
                        );
                      })}
                      <input
                        type="time"
                        value={settings.dailyAttendanceReminderTime || '19:00'}
                        onChange={(e) =>
                          updateSettings({ dailyAttendanceReminderTime: e.target.value })
                        }
                        className="px-2 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rule 2: Settlement Due Days Reminder */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'یادآوری موعد تسویه‌حساب پرسنل'
                      : language === 'ku'
                      ? 'بیرخستنەوەی کاتی پاکتاوکردنی کرێکاران'
                      : 'Worker Settlement Cycle Reminder'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'fa'
                      ? 'اعلان زمانی که تعداد روزهای کارکرد تسویه‌نشده یک نیرو به سقف مشخص برسد'
                      : 'Notify when a worker accumulates unsettled working days'}
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.settlementDueReminder}
                  onChange={(val) => updateSettings({ settlementDueReminder: val })}
                />
              </div>

              {settings.settlementDueReminder && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-2 animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {language === 'fa'
                      ? 'آستانه روزهای کارکرد تسویه‌نشده:'
                      : language === 'ku'
                      ? 'ژمارەی ڕۆژەکان:'
                      : 'Unsettled days threshold:'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {settlementDayPresets.map((days) => {
                      const isSelected = Number(settings.settlementDueDays) === days;
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => updateSettings({ settlementDueDays: days })}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${
                            isSelected
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-400'
                          }`}
                        >
                          {formatNumber(days)}{' '}
                          {language === 'fa' ? 'روز' : language === 'ku' ? 'ڕۆژ' : 'd'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Financial & Treasury Smart Alerts */}
          <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'هشدارهای مالی، خزانه‌داری و هزینه‌ها'
                      : language === 'ku'
                      ? 'ئاگادارکردنەوە داراییەکان و خەزێنە'
                      : 'Financial, Treasury & Expense Alerts'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'fa'
                      ? 'کنترل هوشمند موجودی صندوق، مساعده‌های مازاد و فاکتورهای نسیه'
                      : 'Monitor cash box balance, worker advances, and unpaid invoices'}
                  </p>
                </div>
              </div>
            </div>

            {/* Rule F1: Low Balance / Overdraft Alert */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'هشدار کمبود موجودی یا منفی شدن صندوق/بانک'
                      : language === 'ku'
                      ? 'ئاگادارکردنەوەی کەمبوونی باڵانسی خەزێنە'
                      : 'Low Balance & Overdraft Alert'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'fa'
                      ? 'اعلان فوری در صورت منفی شدن حساب یا کاهش موجودی به زیر سقف تعیین‌شده'
                      : 'Alert when an account goes negative or drops below minimum threshold'}
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.lowBalanceAlert}
                  onChange={(val) => updateSettings({ lowBalanceAlert: val })}
                  color="bg-amber-500"
                />
              </div>

              {settings.lowBalanceAlert && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {language === 'fa'
                        ? 'حداقل موجودی مجاز برای هشدار:'
                        : language === 'ku'
                        ? 'کەمترین باڵانس بۆ ئاگادارکردنەوە:'
                        : 'Minimum Balance Threshold:'}
                    </span>
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                      {formatCurrency(settings.lowBalanceThreshold || 0, currency, language)}
                    </span>
                  </div>

                  {/* Quick Amount Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {balanceThresholdPresets.map((amt) => {
                      const isSelected = Number(settings.lowBalanceThreshold) === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => updateSettings({ lowBalanceThreshold: amt })}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${
                            isSelected
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400'
                          }`}
                        >
                          {amt === 0
                            ? language === 'fa'
                              ? 'فقط منفی شدن (۰)'
                              : language === 'ku'
                              ? 'تەنها کەمتر لە ٠ (نەرێنی)'
                              : 'Only < 0'
                            : formatNumber(amt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Rule F2: Worker Advances Exceeding Earned Wages */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {language === 'fa'
                    ? 'هشدار پیشی گرفتن مساعده از کل کارکرد پرسنل'
                    : language === 'ku'
                    ? 'ئاگادارکردنەوەی تێپەڕاندنی پێشینە لە کارکرد'
                    : 'Worker Advance Exceeding Earned Wages'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'fa'
                    ? 'اعلان زمانی که مجموع مساعده‌های یک کارگر بیشتر از دستمزد کارکرد تسویه‌نشده او شود'
                    : 'Notify when a worker owes the workshop (advances > unsettled wages)'}
                </p>
              </div>
              <ToggleSwitch
                checked={settings.workerDebtAlert}
                onChange={(val) => updateSettings({ workerDebtAlert: val })}
                color="bg-amber-500"
              />
            </div>

            {/* Rule F3: Unpaid / Credit Expenses Reminder */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'یادآوری فاکتورها و هزینه‌های نسیه / پرداخت‌نشده'
                      : language === 'ku'
                      ? 'بیرخستنەوەی خەرجییە قەرزەکان'
                      : 'Unpaid / Credit Expenses Reminder'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'fa'
                      ? 'یادآوری هزینه‌هایی که با وضعیت پرداخت‌نشده ثبت شده‌اند'
                      : 'Remind about unpaid expenses after a set number of days'}
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.unpaidExpenseAlert}
                  onChange={(val) => updateSettings({ unpaidExpenseAlert: val })}
                  color="bg-amber-500"
                />
              </div>

              {settings.unpaidExpenseAlert && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-2 animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {language === 'fa'
                      ? 'یادآوری پس از گذشت:'
                      : language === 'ku'
                      ? 'بیرخستنەوە دوای:'
                      : 'Remind after:'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {unpaidDayPresets.map((d) => {
                      const isSelected = Number(settings.unpaidExpenseDays) === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateSettings({ unpaidExpenseDays: d })}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${
                            isSelected
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400'
                          }`}
                        >
                          {formatNumber(d)}{' '}
                          {language === 'fa' ? 'روز' : language === 'ku' ? 'ڕۆژ' : 'd'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECONDARY COLUMN (5 Cols): Toast Feedback, Channels & System */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 3: Instant Feedback (Toast Alerts), Sound & Browser Push */}
          <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {language === 'fa'
                    ? 'پیام‌های فوری (Toast) و کانال‌های نمایش'
                    : language === 'ku'
                    ? 'پەیامە خێراکان و کەناڵەکانی پیشاندان'
                    : 'Instant Toast Alerts & Channels'}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'fa'
                    ? 'تنظیمات بازخورد سبز/قرمز گوشه تصویر و اعلان مرورگر'
                    : 'Configure corner operation feedback and browser push'}
                </p>
              </div>
            </div>

            {/* Toast Toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'نمایش پیام‌های وضعیت در گوشه تصویر (Toast)'
                      : language === 'ku'
                      ? 'پیشاندانی پەیامی سەرکەوتن و هەڵە لە گۆشەی شاشە'
                      : 'Corner Operation Toast Alerts'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'fa'
                      ? 'نمایش کادر شیشه‌ای سبز هنگام ثبت موفق کارکرد/هزینه و قرمز هنگام بروز خطا'
                      : 'Show green/red glass toast banners when saving records or on errors'}
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.toastEnabled}
                onChange={(val) => updateSettings({ toastEnabled: val })}
                color="bg-emerald-500"
              />
            </div>

            {/* Sound Effects Toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {settings.soundEnabled ? (
                  <Volume2 className="w-4.5 h-4.5 text-sky-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <VolumeX className="w-4.5 h-4.5 text-slate-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'افکت صوتی ملایم اعلان‌ها'
                      : language === 'ku'
                      ? 'دەنگی نەرمی ئاگادارکردنەوە'
                      : 'Subtle Notification Chime'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'fa'
                      ? 'پخش صدای کوتاه هنگام ثبت عملیات یا دریافت هشدار'
                      : 'Play a soft chime when operations complete'}
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.soundEnabled}
                onChange={(val) => updateSettings({ soundEnabled: val })}
              />
            </div>

            {/* Browser / OS Push Notification */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Smartphone className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {language === 'fa'
                        ? 'اعلان سیستم‌عامل و مرورگر (Web Push)'
                        : language === 'ku'
                        ? 'ئاگادارکردنەوەی وێبگەڕ و مۆبایل'
                        : 'Browser & OS Push Notifications'}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {language === 'fa'
                        ? 'ارسال نوتیفیکیشن به نوار وضعیت گوشی یا دسکتاپ'
                        : 'Deliver alerts to your device notification tray'}
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.browserPushEnabled}
                  onChange={(val) => {
                    if (val) {
                      requestBrowserPermission();
                    } else {
                      updateSettings({ browserPushEnabled: false });
                    }
                  }}
                  color="bg-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Card 4: System, Backup & Multi-User Approval Rules */}
          <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {language === 'fa'
                    ? 'سیستم، پشتیبان‌گیری و امنیت تیمی'
                    : language === 'ku'
                    ? 'سیستەم، پاشەکەوت و ئاسایش'
                    : 'System, Backup & Team Approvals'}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'fa'
                    ? 'یادآوری بک‌آپ دوره‌ای و چرخه تأیید اسناد کارگاه'
                    : 'Periodic backup reminders and multi-user approval alerts'}
                </p>
              </div>
            </div>

            {/* Backup Reminder */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Database className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {language === 'fa'
                        ? 'یادآوری تهیه فایل پشتیبان (Backup)'
                        : language === 'ku'
                        ? 'بیرخستنەوەی هەڵگرتنی پاشەکەوت'
                        : 'Periodic Local Backup Reminder'}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {language === 'fa'
                        ? 'یادآوری دانلود فایل پشتیبان در بازه‌های زمانی منظم'
                        : 'Remind to export a local JSON backup snapshot'}
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.backupReminder}
                  onChange={(val) => updateSettings({ backupReminder: val })}
                  color="bg-indigo-500"
                />
              </div>

              {settings.backupReminder && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {language === 'fa' ? 'دوره یادآوری:' : language === 'ku' ? 'ماوەی بیرخستنەوە:' : 'Interval:'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {backupDayPresets.map((d) => {
                      const isSelected = Number(settings.backupReminderDays) === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateSettings({ backupReminderDays: d })}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${
                            isSelected
                              ? 'bg-indigo-500 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          {formatNumber(d)}{' '}
                          {language === 'fa' ? 'روز' : language === 'ku' ? 'ڕۆژ' : 'd'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Pending Approvals Alert */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Users2 className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'fa'
                      ? 'هشدار اسناد در انتظار تأیید مدیر'
                      : language === 'ku'
                      ? 'ئاگادارکردنەوەی بەڵگەنامە چاوەڕوانکراوەکان'
                      : 'Pending Multi-User Approvals'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'fa'
                      ? 'اعلان هنگام ثبت هزینه یا پرداخت توسط سایر اعضای تیم'
                      : 'Notify when team members submit records needing approval'}
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.pendingApprovalAlert}
                onChange={(val) => updateSettings({ pendingApprovalAlert: val })}
                color="bg-indigo-500"
              />
            </div>

            {/* Reset & Restore Actions */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearAllDismissed}
                className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {language === 'fa'
                    ? 'بازگردانی اعلان‌های بسته‌شده'
                    : language === 'ku'
                    ? 'گەڕاندنەوەی ئاگادارکردنەوە داخراوەکان'
                    : 'Restore Dismissed Alerts'}
                </span>
              </button>

              <button
                type="button"
                onClick={resetNotificationSettings}
                className="px-3 py-2 rounded-xl text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                {language === 'fa'
                  ? 'بازنشانی به تنظیمات پیش‌فرض'
                  : language === 'ku'
                  ? 'گەڕانەوە بۆ باری بنەڕەتی'
                  : 'Reset to Defaults'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
