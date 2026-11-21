import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  User, 
  Calendar, 
  Clock, 
  Coins, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  Key, 
  RefreshCw, 
  Copy, 
  Check, 
  Bot, 
  Zap, 
  HelpCircle,
  FileText,
  ChevronDown,
  Info
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { formatCurrency, formatHoursAndMinutes, formatNumber } from '../utils/formatters';
import { 
  analyzeWorkerAttendanceWithAi, 
  prepareWorkerAttendanceSummary 
} from '../services/geminiService';

export default function AttendanceAiAssistantModal({
  isOpen,
  onClose,
  workers = [],
  allLogs = [],
  allPayments = [],
  currency = 'IQD',
  initialWorkerId = null
}) {
  const { language, direction } = useLanguage();
  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  const [selectedWorkerId, setSelectedWorkerId] = useState(initialWorkerId || (workers[0]?.id ? String(workers[0].id) : ''));
  const [customQuestion, setCustomQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  // Sync selectedWorkerId if initialWorkerId changes
  useEffect(() => {
    if (initialWorkerId) {
      setSelectedWorkerId(String(initialWorkerId));
    } else if (!selectedWorkerId && workers.length > 0) {
      setSelectedWorkerId(String(workers[0].id));
    }
  }, [initialWorkerId, workers]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Active selected worker
  const activeWorker = useMemo(() => {
    return workers.find(w => String(w.id) === String(selectedWorkerId)) || null;
  }, [workers, selectedWorkerId]);

  // Clear AI report and error ONLY when selected worker actually changes
  const prevWorkerIdRef = useRef(selectedWorkerId);
  useEffect(() => {
    if (prevWorkerIdRef.current !== selectedWorkerId) {
      prevWorkerIdRef.current = selectedWorkerId;
      setAiReport(null);
      setError(null);
    }
  }, [selectedWorkerId]);

  // Real-time precalculated summary for active worker (keeps aiReport intact)
  useEffect(() => {
    if (activeWorker) {
      const summary = prepareWorkerAttendanceSummary(activeWorker, allLogs, allPayments, currency);
      setSummaryData(summary);
    } else {
      setSummaryData(null);
    }
  }, [activeWorker, allLogs, allPayments, currency]);

  // Trilingual Copy Dictionary (Zero-Leakage)
  const copy = {
    fa: {
      modalTitle: 'دستیار هوشمند کارکرد کارسینک',
      modalSubtitle: 'تحلیل دقیق شیفت‌ها، اضافه‌کاری‌ها و کارکرد تسویه‌نشده با Google Gemini AI',
      selectWorker: 'انتخاب پرسنل:',
      allWorkers: 'لیست پرسنل',
      apiKeyStatusActive: 'متصل به Gemini',
      apiKeyStatusMissing: 'نیاز به تنظیم API Key',
      configureKey: 'تنظیم کلید API',
      keyConfigTitle: 'تنظیمات کلید Google Gemini API',
      keyConfigDesc: 'کلید دریافتی از Google AI Studio را اینجا وارد کنید. این کلید به‌صورت امن در مرورگر شما ذخیره می‌شود.',
      keyPlaceholder: 'مثال: AIzaSy... یا AQ.Ab8...',
      saveKey: 'ذخیره کلید',
      keySaved: 'کلید با موفقیت ذخیره شد',
      quickPromptsTitle: 'پرسش‌های متداول و سریع:',
      prompt1: '⚡ کارکرد جاری و تسویه‌نشده',
      prompt2: '⏱️ تحلیل ساعات اضافه‌کاری',
      prompt3: '📋 بیلان کامل و مانده طلب',
      customQuestionPlaceholder: 'سوالی درباره کارکرد، شیفت‌ها یا طلب این پرسنل دارید بنویسید...',
      btnSend: 'تحلیل هوشمند',
      btnAnalyzing: 'در حال تحلیل با هوش مصنوعی...',
      unsettledPeriod: 'بازه تسویه‌نشده:',
      from: 'از',
      to: 'تا',
      beginning: 'آغاز همکاری',
      today: 'امروز',
      workingDays: 'روزهای کاری باز:',
      fullDays: 'کامل',
      halfDays: 'نیمه',
      hourlyDays: 'ساعتی',
      totalOt: 'کل اضافه‌کاری باز:',
      grossPay: 'دستمزد ناخالص باز:',
      advances: 'مساعده‌های کسر شده:',
      netDue: 'مانده خالص طلب:',
      aiAnalysisTitle: 'گزارش و تحلیل کارشناسی هوش مصنوعی',
      copyReport: 'کپی متن گزارش',
      copied: 'کپی شد!',
      noWorkerSelected: 'لطفاً ابتدا یک پرسنل را انتخاب کنید.',
      errorMissingKey: 'کلید Google Gemini API یافت نشد. لطفاً روی دکمه «تنظیم کلید API» کلیک کنید.',
      errorGeneral: 'خطا در برقراری ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید.'
    },
    ku: {
      modalTitle: 'یاریدەدەری زیرەکی کارکردی کارسینک',
      modalSubtitle: 'شیکاریی وردی دەوام، ئۆڤەرتایم و کارکردی تەسویەنەکراو بە Google Gemini AI',
      selectWorker: 'هەڵبژاردنی کارمەند:',
      allWorkers: 'لیستی کارمەندان',
      apiKeyStatusActive: 'بەستراوەتەوە بە Gemini',
      apiKeyStatusMissing: 'پێویستی بە کلیل هەیە',
      configureKey: 'ڕێکخستنی کلیل',
      keyConfigTitle: 'ڕێکخستنی کلیلی Google Gemini API',
      keyConfigDesc: 'کلیلی وەرگیراو لە Google AI Studio لێرە بنووسە. بە شێوەیەکی پارێزراو لە وێبگەڕەکەت پاشەکەوت دەبێت.',
      keyPlaceholder: 'نموونە: AIzaSy... یان AQ.Ab8...',
      saveKey: 'پاشەکەوتکردنی کلیل',
      keySaved: 'کلیلەکە بە سەرکەوتوویی پاشەکەوت کرا',
      quickPromptsTitle: 'پرسیارە باوەکان:',
      prompt1: '⚡ دەوامی ئێستا و تەسویەنەکراو',
      prompt2: '⏱️ شیکاریی کاتژمێرەکانی ئۆڤەرتایم',
      prompt3: '📋 بیلان و کۆی شایستەی ماوە',
      customQuestionPlaceholder: 'پرسیارێک دەربارەی دەوام، کاتژمێری زیادە یان پارەی ئەم کارمەندە بنووسە...',
      btnSend: 'شیکاریی زیرەک',
      btnAnalyzing: 'هۆشی دەستکرد سەرقاڵی شیکارییە...',
      unsettledPeriod: 'ماوەی تەسویەنەکراو:',
      from: 'لە',
      to: 'تا',
      beginning: 'سەرەتای دەستپێکردن',
      today: 'ئەمڕۆ',
      workingDays: 'ڕۆژانی کاری کراوە:',
      fullDays: 'تەواو',
      halfDays: 'نیوە',
      hourlyDays: 'کاتژمێری',
      totalOt: 'کۆی ئۆڤەرتایمی کراوە:',
      grossPay: 'کرێی ناپوختەی کراوە:',
      advances: 'پێشەکی لێبڕاو:',
      netDue: 'شایستەی کۆتایی ماوە:',
      aiAnalysisTitle: 'ڕاپۆرت و شیکاریی پسپۆڕانەی هۆشی دەستکرد',
      copyReport: 'کۆپیکردنی ڕاپۆرت',
      copied: 'کۆپی کرا!',
      noWorkerSelected: 'تکایە سەرەتا کارمەندێک هەڵبژێرە.',
      errorMissingKey: 'کلیلی Google Gemini API نەدۆزرایەوە. تکایە کلیلی API دیاری بکە.',
      errorGeneral: 'هەڵەیەک لە پەیوەندی بە هۆشی دەستکرد ڕوویدا. دووبارە تاقی بکەرەوە.'
    },
    en: {
      modalTitle: 'KarSync Attendance AI Copilot',
      modalSubtitle: 'AI-powered attendance audit, overtime analytics & unsettled wage tracking via Google Gemini',
      selectWorker: 'Select Personnel:',
      allWorkers: 'Personnel Directory',
      apiKeyStatusActive: 'Gemini Connected',
      apiKeyStatusMissing: 'API Key Required',
      configureKey: 'API Settings',
      keyConfigTitle: 'Google Gemini API Key Configuration',
      keyConfigDesc: 'Enter your Google AI Studio API key. It is securely saved in your local browser storage.',
      keyPlaceholder: 'e.g. AIzaSy... or AQ.Ab8...',
      saveKey: 'Save Key',
      keySaved: 'API Key saved successfully',
      quickPromptsTitle: 'Quick Audit Prompts:',
      prompt1: '⚡ Current Unsettled Work & Balance',
      prompt2: '⏱️ Overtime Hours & Peak Analysis',
      prompt3: '📋 Comprehensive Wage & Shift Audit',
      customQuestionPlaceholder: 'Ask any question about this worker’s shifts, overtime or payable wages...',
      btnSend: 'Run AI Audit',
      btnAnalyzing: 'Analyzing with Gemini AI...',
      unsettledPeriod: 'Unsettled Period:',
      from: 'From',
      to: 'To',
      beginning: 'Start of work',
      today: 'Today',
      workingDays: 'Open Working Days:',
      fullDays: 'Full',
      halfDays: 'Half',
      hourlyDays: 'Hourly',
      totalOt: 'Open Overtime:',
      grossPay: 'Open Gross Wages:',
      advances: 'Deducted Advances:',
      netDue: 'Net Balance Due:',
      aiAnalysisTitle: 'AI Executive Audit Report',
      copyReport: 'Copy Report',
      copied: 'Copied!',
      noWorkerSelected: 'Please select a worker first.',
      errorMissingKey: 'Google Gemini API key not found. Please click "API Settings" to configure.',
      errorGeneral: 'Failed to communicate with Gemini AI. Please try again.'
    }
  }[langKey];

  // Run AI analysis
  const handleExecuteAi = async (overridePrompt = null) => {
    if (!activeWorker) {
      setError(copy.noWorkerSelected);
      return;
    }

    setLoading(true);
    setError(null);
    const questionToAsk = overridePrompt !== null ? overridePrompt : customQuestion;

    try {
      const result = await analyzeWorkerAttendanceWithAi({
        worker: activeWorker,
        allLogs,
        allPayments,
        userQuestion: questionToAsk,
        currency,
        language
      });

      setAiReport(result.aiText);
      setSummaryData(result.summary);
      if (overridePrompt === null) {
        setCustomQuestion('');
      }
    } catch (err) {
      console.error('[Gemini AI Attendance Error]', err);
      setError(err.message || copy.errorGeneral);
    } finally {
      setLoading(false);
    }
  };

  // Copy AI report to clipboard
  const handleCopy = () => {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  const p = summaryData?.unsettledPeriod;
  const s = summaryData?.settlementStatus;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Liquid Glass Root Container */}
      <div 
        dir={direction}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white/45 dark:bg-slate-950/50 backdrop-blur-3xl backdrop-saturate-200 border border-white/70 dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.1)] rounded-3xl overflow-hidden transition-all duration-300"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-purple-500/25 flex-shrink-0 animate-pulse">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>{copy.modalTitle}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold">
                  Gemini 3.5
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {copy.modalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Active Indicator Badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline font-bold">
                {copy.apiKeyStatusActive}
              </span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all duration-200 cursor-pointer active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Top Controls Card: Worker Selection */}
          <div className="bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/80 dark:border-slate-800 shadow-sm rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {copy.selectWorker}
                </label>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full sm:w-72 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.role ? `(${w.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Unsettled Badge */}
            {activeWorker && summaryData && (
              <div className="flex items-center gap-2 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {copy.unsettledPeriod}{' '}
                    <strong>
                      {s?.hasPreviousSettlement ? `${copy.from} ${s.lastSettlementDate}` : copy.beginning}
                    </strong>{' '}
                    {copy.to} <strong>{p?.lastDate || copy.today}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Double-Barrier Pre-Calculated Fast Metric Cards */}
          {activeWorker && p && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {/* Working Days */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/70 dark:border-slate-800/80 rounded-2xl p-3 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>{copy.workingDays}</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                  {formatNumber(p.totalLogsCount)} <span className="text-xs font-normal text-slate-500">روز</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {p.fullDays} {copy.fullDays} | {p.halfDays} {copy.halfDays} | {p.hourlyDays} {copy.hourlyDays}
                </div>
              </div>

              {/* Overtime */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/70 dark:border-slate-800/80 rounded-2xl p-3 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{copy.totalOt}</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                  {formatHoursAndMinutes(p.totalOtHours)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  نرخ: {formatNumber(activeWorker.overtimeHourlyRate || 0)} {currency}
                </div>
              </div>

              {/* Gross Pay */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/70 dark:border-slate-800/80 rounded-2xl p-3 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{copy.grossPay}</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(p.totalGrossPay, currency)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  مساعده: {formatCurrency(p.totalAdvances, currency)}
                </div>
              </div>

              {/* Net Balance Due */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/70 dark:border-slate-800/80 rounded-2xl p-3 shadow-xs bg-gradient-to-br from-purple-500/5 to-indigo-500/5 dark:from-purple-950/20 dark:to-indigo-950/20">
                <div className="text-[11px] font-medium text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>{copy.netDue}</span>
                </div>
                <div className="text-sm sm:text-base font-black text-purple-700 dark:text-purple-300">
                  {formatCurrency(p.netDue, currency)}
                </div>
                <div className="text-[10px] text-purple-500/80 mt-0.5 font-medium">
                  قابل پرداخت در تسویه
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Prompts Bar */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{copy.quickPromptsTitle}</span>
            </span>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleExecuteAi(copy.prompt1)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 dark:bg-slate-800/80 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 border border-slate-200 dark:border-slate-700 shadow-xs transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {copy.prompt1}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleExecuteAi(copy.prompt2)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 dark:bg-slate-800/80 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-700 shadow-xs transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {copy.prompt2}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleExecuteAi(copy.prompt3)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 dark:bg-slate-800/80 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 shadow-xs transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {copy.prompt3}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* AI Response Card */}
          {(loading || aiReport) && (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/80 dark:border-slate-800 shadow-md rounded-2xl p-5 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                    {copy.aiAnalysisTitle}
                  </h3>
                </div>

                {aiReport && !loading && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-all cursor-pointer"
                    title={copy.copyReport}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? copy.copied : copy.copyReport}</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-purple-600 dark:text-purple-400">
                  <div className="w-10 h-10 rounded-full border-3 border-purple-500/30 border-t-purple-600 animate-spin" />
                  <span className="text-xs font-bold animate-pulse">{copy.btnAnalyzing}</span>
                </div>
              ) : (
                <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                  {aiReport}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Glass Bottom Dock: Interactive Question Input */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl flex items-center gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading && customQuestion.trim()) {
                e.preventDefault();
                handleExecuteAi();
              }
            }}
            placeholder={copy.customQuestionPlaceholder}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 transition-all"
          />

          <button
            type="button"
            disabled={loading || (!customQuestion.trim() && !aiReport)}
            onClick={() => handleExecuteAi()}
            className="px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-purple-500/25 flex items-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
            )}
            <span className="hidden sm:inline">{copy.btnSend}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
