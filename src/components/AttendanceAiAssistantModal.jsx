import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  X,
  Send,
  Copy,
  Check,
  Bot,
  AlertCircle,
  RotateCcw,
  Loader2,
  Database
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { useAuth, usePermissions } from '../context/AuthContext';
import { DEFAULT_PROJECT_ID } from '../db/db';
import { runKarSyncAiChatTurn } from '../services/geminiService';

const SESSION_CHAT_KEY_PREFIX = 'karsync_ai_chat_session_v1_';

const AI_CHAT_COPY = {
  fa: {
    title: 'دستیار هوشمند کارسینک',
    welcomeTitle: 'چطور می‌توانم کمکتان کنم؟',
    welcomeSubtitle: 'درباره کارکرد پرسنل، حقوق و مساعده، هزینه‌ها، موجودی حساب‌ها، چک‌ها یا قراردادها بپرسید.',
    inputPlaceholder: 'سوال خود را بنویسید... (مثلاً: گزارش کارکرد افشین رو بهم بده)',
    newChat: 'گفتگوی جدید',
    copyAnswer: 'کپی',
    copied: 'کپی شد',
    closeLabel: 'بستن',
    sendLabel: 'ارسال',
    offlineError: 'دستگاه آفلاین است. برای استفاده از دستیار هوشمند به اینترنت متصل شوید.',
    missingKeyError: 'کلید Google Gemini API تنظیم نشده است.',
    overloadedError: 'سرورهای هوش مصنوعی گوگل در این لحظه شلوغ هستند. لطفاً چند ثانیه صبر کنید و دوباره امتحان کنید.',
    generalError: 'خطا در برقراری ارتباط با دستیار هوشمند. لطفاً دوباره تلاش کنید.',
    retryLabel: 'تلاش مجدد',
    thinkingDefault: 'در حال بررسی داده‌های کارگاه...'
  },
  ku: {
    title: 'یاریدەدەری زیرەکی کارسینک',
    welcomeTitle: 'چۆن دەتوانم یارمەتیت بدەم؟',
    welcomeSubtitle: 'هەر پرسیارێک دەربارەی کارکردنی کارمەندان، مووچە و پێشەکی، خەرجی، هەژمار، چەک یان گرێبەستەکان بپرسە.',
    inputPlaceholder: 'پرسیارەکەت بنووسە... (بۆ نموونە: ڕاپۆرتی کارکردنی ئەفشینم پێ بدە)',
    newChat: 'گفتوگۆی نوێ',
    copyAnswer: 'کۆپی',
    copied: 'کۆپی کرا',
    closeLabel: 'داخستن',
    sendLabel: 'ناردن',
    offlineError: 'ئامێرەکە ئۆفلاینە. بۆ بەکارهێنانی یاریدەدەری زیرەک پێویستە پەیوەندی بە ئینتەرنێتەوە هەبێت.',
    missingKeyError: 'کلیلی Google Gemini API ڕێکنەخراوە.',
    overloadedError: 'سێرڤەرەکانی هۆشی دەستکردی گووگڵ لەم کاتەدا قەرەباڵغن. تکایە چەند چرکەیەک چاوەڕێ بکە و دووبارە هەوڵ بدەرەوە.',
    generalError: 'هەڵەیەک لە پەیوەندی بە یاریدەدەری زیرەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.',
    retryLabel: 'هەوڵدانەوە',
    thinkingDefault: 'پشکنینی داتاکانی کارگە...'
  },
  en: {
    title: 'KarSync AI Assistant',
    welcomeTitle: 'How can I help you today?',
    welcomeSubtitle: 'Ask anything about personnel attendance, wages, advances, expenses, accounts, cheques, or contracts.',
    inputPlaceholder: 'Ask anything... (e.g. Give me Afshin’s attendance report)',
    newChat: 'New Chat',
    copyAnswer: 'Copy',
    copied: 'Copied',
    closeLabel: 'Close',
    sendLabel: 'Send',
    offlineError: 'You are offline. Please connect to the internet to use KarSync AI.',
    missingKeyError: 'Google Gemini API key is not configured.',
    overloadedError: 'Google AI servers are temporarily experiencing high demand. Please wait a few seconds and try again.',
    generalError: 'Failed to reach KarSync AI. Please try again.',
    retryLabel: 'Retry',
    thinkingDefault: 'Querying workshop database...'
  }
};

/**
 * Lightweight, safe inline Markdown renderer (bold, inline code) with zero external dependencies.
 */
function renderInlineMarkdown(text) {
  const str = String(text || '');
  const parts = [];
  const tokenRe = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = tokenRe.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b_${keyIdx++}`} className="font-bold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c_${keyIdx++}`}
          className="px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[11px] font-mono text-indigo-700 dark:text-indigo-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }
  return parts;
}

/**
 * Clean block-level Markdown renderer (headings, bullet/ordered lists, compact tables, paragraphs).
 */
function ChatMarkdown({ content }) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push(<hr key={`hr_${i}`} className="my-2.5 border-slate-200/80 dark:border-slate-700/70" />);
      i++;
      continue;
    }

    // Markdown Table
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])
    ) {
      const parseCells = (rowStr) =>
        rowStr
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseCells(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(parseCells(lines[i]));
        i++;
      }

      blocks.push(
        <div
          key={`tbl_${i}`}
          className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-950/40"
        >
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80">
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    className="px-2.5 py-2 text-start font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                  >
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    >
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls =
        level === 1
          ? 'text-sm sm:text-base font-black text-slate-900 dark:text-white mt-2 mb-1'
          : level === 2
          ? 'text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-2 mb-1'
          : 'text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-1.5 mb-0.5';
      blocks.push(
        <div key={`h_${i}`} className={cls}>
          {renderInlineMarkdown(headingMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      const startIdx = i;
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, '').trim());
        i++;
      }
      blocks.push(
        <ul key={`ul_${startIdx}`} className="my-1.5 space-y-1 list-disc ps-5">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      const startIdx = i;
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '').trim());
        i++;
      }
      blocks.push(
        <ol key={`ol_${startIdx}`} className="my-1.5 space-y-1 list-decimal ps-5">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph (group consecutive plain lines)
    const paraLines = [];
    const startIdx = i;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim()) &&
      !/^#{1,3}\s+/.test(lines[i].trim()) &&
      !/^[-*_]{3,}$/.test(lines[i].trim()) &&
      !(
        lines[i].trim().includes('|') &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])
      )
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={`p_${startIdx}`} className="my-1 leading-relaxed">
        {paraLines.map((pl, pi) => (
          <React.Fragment key={pi}>
            {pi > 0 && <br />}
            {renderInlineMarkdown(pl)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className="text-xs sm:text-[13.5px] text-slate-700 dark:text-slate-200">{blocks}</div>;
}

export default function AttendanceAiAssistantModal({ isOpen, onClose }) {
  const { language, direction, calendarType } = useLanguage();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const { hasPermission, canAccessProject } = usePermissions();

  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';
  const copy = AI_CHAT_COPY[langKey];

  const sessionStorageKey = useMemo(() => {
    const scope = user?.workspace_id || user?.id || 'default';
    return `${SESSION_CHAT_KEY_PREFIX}${scope}`;
  }, [user?.workspace_id, user?.id]);

  const [messages, setMessages] = useState(() => {
    try {
      const raw = sessionStorage.getItem(`${SESSION_CHAT_KEY_PREFIX}${user?.workspace_id || user?.id || 'default'}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Persist messages for current browser session only
  useEffect(() => {
    try {
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(messages.slice(-40)));
    } catch (_) {}
  }, [messages, sessionStorageKey]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, statusText, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        textareaRef.current?.focus();
      }, 80);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputValue]);

  const permissions = useMemo(() => ({
    canAttendance: hasPermission('attendance.read') || hasPermission('attendance.write') || hasPermission('workers.manage'),
    canFinancials: hasPermission('settlement.manage') || hasPermission('accounting.manage') || hasPermission('reports.view'),
    canExpenses: hasPermission('expenses.manage') || hasPermission('accounting.manage') || hasPermission('reports.view'),
    canAccounting: hasPermission('accounting.manage') || hasPermission('settlement.manage') || hasPermission('reports.view')
  }), [hasPermission]);

  const executePrompt = async (promptText, baseHistory) => {
    setError(null);
    setLoading(true);
    setStatusText(copy.thinkingDefault);

    try {
      const result = await runKarSyncAiChatTurn({
        history: baseHistory,
        userMessage: promptText,
        context: {
          activeProjectId: currentProject?.id || DEFAULT_PROJECT_ID,
          activeProjectName: currentProject?.name || '',
          currency: currentProject?.currency || currentProject?.base_currency || 'IQD',
          language: langKey,
          calendarType,
          canAccessProject,
          permissions
        },
        onStatusChange: (label) => {
          if (label) setStatusText(label);
        }
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: result.text,
          createdAt: Date.now()
        }
      ]);
    } catch (err) {
      console.error('[KarSync AI Chat Error]', err);
      const errMsg =
        err?.message === 'MISSING_API_KEY'
          ? copy.missingKeyError
          : err?.message === 'MODEL_OVERLOADED'
          ? copy.overloadedError
          : err?.message || copy.generalError;
      setError(errMsg);
    } finally {
      setLoading(false);
      setStatusText('');
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  };

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || loading) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError(copy.offlineError);
      return;
    }

    const userMsg = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      createdAt: Date.now()
    };

    const prevHistory = messages;
    setMessages([...prevHistory, userMsg]);
    setInputValue('');
    await executePrompt(trimmed, prevHistory);
  };

  const handleRetryLast = async () => {
    if (loading || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role !== 'user' || !lastMsg.text) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError(copy.offlineError);
      return;
    }
    await executePrompt(lastMsg.text, messages.slice(0, -1));
  };

  const handleNewChat = () => {
    setMessages([]);
    setError(null);
    setStatusText('');
    try {
      sessionStorage.removeItem(sessionStorageKey);
    } catch (_) {}
    setTimeout(() => textareaRef.current?.focus(), 60);
  };

  const handleCopyMessage = (msg) => {
    if (!msg?.text) return;
    navigator.clipboard.writeText(msg.text).then(() => {
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId((prev) => (prev === msg.id ? null : prev)), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-5 bg-slate-900/60 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Apple Liquid Glass Root Container */}
      <div
        dir={direction}
        className="w-full max-w-3xl h-[86vh] sm:h-[82vh] flex flex-col bg-white/45 dark:bg-slate-950/50 backdrop-blur-3xl backdrop-saturate-200 border border-white/70 dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.1)] rounded-3xl overflow-hidden transition-all duration-300"
      >
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 flex-shrink-0">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              {copy.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleNewChat}
                disabled={loading}
                title={copy.newChat}
                aria-label={copy.newChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 hover:bg-white/90 dark:hover:bg-slate-800 border border-white/70 dark:border-white/10 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{copy.newChat}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label={copy.closeLabel}
              title={copy.closeLabel}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Stream Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 select-none">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600/15 via-purple-500/15 to-sky-500/15 border border-white/80 dark:border-white/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm mb-4">
                <Bot className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 mb-1.5">
                {copy.welcomeTitle}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                {copy.welcomeSubtitle}
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-sm flex-shrink-0 mb-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`group relative max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 transition-all ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-md shadow-indigo-500/20 rounded-be-sm'
                          : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/80 dark:border-slate-800 shadow-sm rounded-bs-sm'
                      }`}
                    >
                      {isUser ? (
                        <p className="text-xs sm:text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
                          {msg.text}
                        </p>
                      ) : (
                        <>
                          <ChatMarkdown content={msg.text} />
                          <div className="mt-2 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/70 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer"
                              title={copy.copyAnswer}
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">{copy.copied}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>{copy.copyAnswer}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Live Thinking & DB Query Indicator */}
              {loading && (
                <div className="flex items-end gap-2.5 justify-start animate-fade-in">
                  <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-bs-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/80 dark:border-slate-800 shadow-sm flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <Database className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
                    <span>{statusText || copy.thinkingDefault}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
              {messages.length > 0 && messages[messages.length - 1]?.role === 'user' && !loading && (
                <button
                  type="button"
                  onClick={handleRetryLast}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 font-bold text-[11px] flex items-center gap-1 flex-shrink-0 transition-all cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{copy.retryLabel}</span>
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Sticky Glass Bottom Input Bar */}
        <div className="px-3.5 sm:px-5 py-3.5 border-t border-white/60 dark:border-white/10 bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl flex-shrink-0">
          <div className="flex items-end gap-2 bg-white/85 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/60 focus-within:border-indigo-400 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={copy.inputPlaceholder}
              disabled={loading}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden max-h-[120px] leading-relaxed"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !inputValue.trim()}
              aria-label={copy.sendLabel}
              title={copy.sendLabel}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-sky-500 hover:brightness-110 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <Send className={`w-4.5 h-4.5 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
