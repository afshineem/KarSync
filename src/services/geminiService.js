import { calculateWorkerFinancials, getReceiptPeriodEnd } from '../utils/settlementCalculations';
import {
  formatDateDisplay,
  getTodayDateString,
  gregorianToJalali,
  isJalaliCalendar
} from '../utils/formatters';
import { getGeminiToolDeclarations, executeAiDatabaseTool } from './aiDatabaseTools';

const STORAGE_KEY = 'karsync_gemini_api_key';
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
const BUILTIN_GEMINI_KEY = typeof atob === 'function'
  ? atob('QVEuQWI4Uk42SmlHTE92T3hxTUJ5UUZDUGJJSTlSVzhiTmJXMm4yWTRCc01UR2tsR29kbFE=')
  : '';

const JALALI_MONTH_NAMES_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

/**
 * Retrieves the currently active Gemini API Key from localStorage, environment variables, or core built-in key.
 */
export function getGeminiApiKey() {
  const localKey = localStorage.getItem(STORAGE_KEY);
  if (localKey && localKey.trim()) {
    return localKey.trim();
  }
  const envKey = import.meta.env?.VITE_GEMINI_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  return BUILTIN_GEMINI_KEY;
}

/**
 * Saves the Gemini API Key to local browser storage.
 */
export function saveGeminiApiKey(key) {
  if (!key || !key.trim()) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }
}

/**
 * Checks if a Gemini API Key is configured.
 */
export function isGeminiConfigured() {
  return Boolean(getGeminiApiKey());
}

/**
 * Low-level call to Gemini REST API with native Function Calling support and automatic model fallback.
 */
async function callGeminiRaw({ contents, systemInstruction = '', tools = null, modelIndex = 0 }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const model = DEFAULT_MODELS[modelIndex] || DEFAULT_MODELS[0];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  if (Array.isArray(tools) && tools.length > 0) {
    requestBody.tools = [{ functionDeclarations: tools }];
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${res.status}`;

      // Fallback on unavailable/overloaded/not-found model
      if ((res.status === 404 || res.status === 503 || res.status === 429) && modelIndex + 1 < DEFAULT_MODELS.length) {
        return await callGeminiRaw({ contents, systemInstruction, tools, modelIndex: modelIndex + 1 });
      }

      throw new Error(errMsg);
    }

    return await res.json();
  } catch (error) {
    if (
      modelIndex + 1 < DEFAULT_MODELS.length &&
      (error.message?.includes('404') || error.message?.includes('503') || error.message?.includes('429'))
    ) {
      return await callGeminiRaw({ contents, systemInstruction, tools, modelIndex: modelIndex + 1 });
    }
    throw error;
  }
}

/**
 * Simple text-only call to Gemini REST API (backward-compatible helper).
 */
export async function callGeminiApi({ prompt, systemInstruction = '', modelIndex = 0 }) {
  const data = await callGeminiRaw({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction,
    modelIndex
  });
  const candidate = data.candidates?.[0];
  const textParts = (candidate?.content?.parts || []).filter((p) => typeof p.text === 'string').map((p) => p.text);
  return textParts.join('\n').trim();
}

function getToolStatusLabel(toolName, language = 'fa') {
  const lang = language === 'ku' ? 'ku' : language === 'en' ? 'en' : 'fa';
  const labels = {
    fa: {
      list_projects_and_overview: 'در حال بررسی لیست پروژه‌ها و کارگاه...',
      search_workers: 'در حال جستجو در لیست پرسنل...',
      get_worker_attendance_report: 'در حال محاسبه گزارش کارکرد و دستمزد...',
      get_team_attendance_overview: 'در حال بررسی آمار کلی کارکرد تیم...',
      get_worker_payments_and_loans: 'در حال بررسی مساعده‌ها، تسویه‌ها و وام‌ها...',
      get_expenses_summary: 'در حال بررسی هزینه‌ها و فاکتورها...',
      get_accounts_and_cashflow: 'در حال بررسی موجودی صندوق و حساب‌ها...',
      get_contracts_and_cheques: 'در حال بررسی چک‌ها و قراردادها...',
      thinking: 'در حال تنظیم پاسخ نهایی...'
    },
    ku: {
      list_projects_and_overview: 'پشکنینی لیستی پڕۆژەکان و کارگە...',
      search_workers: 'گەڕان لە لیستی کارمەندان...',
      get_worker_attendance_report: 'هەژمارکردنی ڕاپۆرتی کارکردن و مووچە...',
      get_team_attendance_overview: 'پشکنینی ئاماری گشتی تیمەکە...',
      get_worker_payments_and_loans: 'پشکنینی پێشەکی، تەسویە و قەرزەکان...',
      get_expenses_summary: 'پشکنینی خەرجییەکان و پسوولەکان...',
      get_accounts_and_cashflow: 'پشکنینی باڵانسی سندووق و هەژمارەکان...',
      get_contracts_and_cheques: 'پشکنینی چەک و گرێبەستەکان...',
      thinking: 'ئامادەکردنی وەڵامی کۆتایی...'
    },
    en: {
      list_projects_and_overview: 'Checking projects and workshop overview...',
      search_workers: 'Searching personnel directory...',
      get_worker_attendance_report: 'Calculating attendance & wage report...',
      get_team_attendance_overview: 'Analyzing team attendance overview...',
      get_worker_payments_and_loans: 'Checking advances, settlements & loans...',
      get_expenses_summary: 'Reviewing expenses and invoices...',
      get_accounts_and_cashflow: 'Checking cash boxes & account balances...',
      get_contracts_and_cheques: 'Checking contracts & cheques...',
      thinking: 'Preparing final answer...'
    }
  };
  return labels[lang][toolName] || labels[lang].thinking;
}

/**
 * Full Autonomous Local-First KarSync AI Chatbot Turn:
 * - Understands natural language queries in Persian, Sorani Kurdish, and English
 * - Dynamically decides which local Dexie database tools to call (0 bytes Supabase Egress)
 * - Strictly enforces active user's RBAC permissions & project access
 * - Returns grounded, mathematically accurate answers using KarSync's own calculation engine
 */
export async function runKarSyncAiChatTurn({
  history = [],
  userMessage = '',
  context = {},
  onStatusChange = null
}) {
  const trimmed = String(userMessage || '').trim();
  if (!trimmed) {
    throw new Error('EMPTY_MESSAGE');
  }

  const language = context.language || 'fa';
  const calendarType = context.calendarType || null;
  const activeProjectName = context.activeProjectName || 'پروژه اصلی';
  const currency = context.currency || 'IQD';
  const todayIso = getTodayDateString();
  const [gy, gm, gd] = todayIso.split('-').map((n) => parseInt(n, 10));
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  const jalaliToday = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
  const jalaliMonthName = JALALI_MONTH_NAMES_FA[(jm || 1) - 1] || '';
  const prefersJalali = isJalaliCalendar(calendarType, language);
  const todayDisplay = formatDateDisplay(todayIso, language, null, calendarType);

  const tools = getGeminiToolDeclarations(context.permissions || {});

  const defaultLangInstruction = language === 'ku'
    ? 'Default response language is authentic Sorani Kurdish (کوردی سۆرانی), unless the user explicitly writes in another language (reply in the exact language the user writes in).'
    : language === 'en'
    ? 'Default response language is clear, concise English, unless the user explicitly writes in Persian or Kurdish (reply in the exact language the user writes in).'
    : 'Default response language is clear, professional Persian (فارسی), unless the user explicitly writes in Kurdish or English (reply in the exact language the user writes in).';

  const systemInstruction = `
You are KarSync AI, the intelligent conversational assistant built into the KarSync workshop, personnel attendance, payroll, expenses, and accounting platform.

Current Context:
- Today (Gregorian): ${todayIso}
- Today (Shamsi / Jalali): ${jalaliToday} (Month: ${jalaliMonthName} ${jy}, month_key: ${jy}-${String(jm).padStart(2, '0')})
- User's active calendar preference: ${prefersJalali ? 'Shamsi / Jalali' : 'Gregorian'} (Today formatted: ${todayDisplay})
- Active Project: "${activeProjectName}" (Currency: ${currency})
- Active UI Language: ${language}

Critical Rules:
1. NEVER guess, estimate, or invent any worker name, attendance count, date, wage, advance, expense, balance, cheque, or contract value. ALWAYS call the appropriate tool(s) first to read exact local database records.
2. When the user mentions a person's name (e.g. "افشین", "گزارش کارکرد افشین"), IMMEDIATELY call \`get_worker_attendance_report\` with \`worker_name\` set to that exact name. Never substitute another person.
3. If a tool returns \`AMBIGUOUS_WORKER\`, present the matching candidates cleanly and ask which person the user wants. If \`NOT_FOUND\`, politely state no matching worker was found and mention similar/available names if helpful.
4. For follow-up questions in the conversation (e.g. "ماه قبلش چطور؟" or "مساعده‌هاش چی؟"), infer the referenced person/project from conversation history and call the relevant tool with the updated parameters.
5. Respect exact numbers returned by the tools. Format money clearly with thousand separators and currency (${currency}). Display dates in the user's preferred calendar (${prefersJalali ? 'Shamsi/Jalali' : 'Gregorian'}).
6. If a tool returns \`ACCESS_DENIED\`, politely inform the user that their account role does not have permission to view that section.
7. Keep answers structured, concise, warm, and scannable using clean Markdown (bold highlights, bullet points, and compact tables when comparing multiple people or items).
8. ${defaultLangInstruction}
`.trim();

  // Build Gemini multi-turn contents from recent visible chat history (max last 12 turns)
  const recentHistory = (history || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.text)
    .slice(-12);

  const workingContents = recentHistory.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }]
  }));
  workingContents.push({
    role: 'user',
    parts: [{ text: trimmed }]
  });

  const toolsUsed = [];
  const MAX_TOOL_HOPS = 5;

  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    if (hop === 0 && onStatusChange) {
      onStatusChange(getToolStatusLabel('thinking', language));
    }

    const response = await callGeminiRaw({
      contents: workingContents,
      systemInstruction,
      tools
    });

    const candidate = response?.candidates?.[0];
    const modelContent = candidate?.content;
    const parts = modelContent?.parts || [];

    const functionCalls = parts.filter((p) => p.functionCall);
    if (functionCalls.length === 0) {
      const finalText = parts
        .filter((p) => typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n')
        .trim();

      return {
        text: finalText || (language === 'ku' ? 'ببورە، نەمتوانی وەڵامێک دروست بکەم.' : language === 'en' ? 'Sorry, I could not generate a response.' : 'متأسفانه پاسخی دریافت نشد. لطفاً سوال خود را مجدداً مطرح کنید.'),
        toolsUsed
      };
    }

    // Preserve exact model turn (including any thoughtSignature on Gemini 2.5 models)
    workingContents.push(modelContent);

    // Notify UI of active database tool lookup
    if (onStatusChange && functionCalls[0]?.functionCall?.name) {
      onStatusChange(getToolStatusLabel(functionCalls[0].functionCall.name, language));
    }

    // Execute all requested local Dexie tools in parallel (0 bytes Supabase Egress)
    const toolResponseParts = await Promise.all(
      functionCalls.map(async (fcPart) => {
        const { name, args } = fcPart.functionCall;
        toolsUsed.push(name);
        const result = await executeAiDatabaseTool(name, args || {}, context);
        return {
          functionResponse: {
            name,
            response: { result }
          }
        };
      })
    );

    workingContents.push({
      role: 'user',
      parts: toolResponseParts
    });

    if (onStatusChange) {
      onStatusChange(getToolStatusLabel('thinking', language));
    }
  }

  // Final synthesis fallback if max tool hops reached
  const finalResponse = await callGeminiRaw({
    contents: workingContents,
    systemInstruction,
    tools: null
  });
  const fallbackParts = finalResponse?.candidates?.[0]?.content?.parts || [];
  const fallbackText = fallbackParts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n')
    .trim();

  return {
    text: fallbackText || (language === 'ku' ? 'داتاکان وەرگیران، تکایە پرسیارەکەت وردتر بنووسە.' : language === 'en' ? 'Data was retrieved. Please refine your question.' : 'داده‌ها بررسی شدند؛ لطفاً سوال خود را دقیق‌تر مطرح کنید.'),
    toolsUsed
  };
}

/**
 * Legacy helper kept for backward compatibility.
 */
export function prepareWorkerAttendanceSummary(worker, allLogs = [], allPayments = [], currency = 'IQD') {
  if (!worker) return null;
  const fin = calculateWorkerFinancials(worker, allLogs, allPayments, currency);
  if (!fin) return null;

  const wId = String(worker.id);
  const workerPayments = (allPayments || []).filter((p) => String(p.workerId) === wId && !p.deletedAt && p.status !== 'deleted');
  const settlements = workerPayments
    .filter((p) => p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled')
    .sort((a, b) => (getReceiptPeriodEnd(b) || b.date || '').localeCompare(getReceiptPeriodEnd(a) || a.date || ''));

  const latestSettlement = settlements[0] || null;
  const lastSettlementDate = latestSettlement
    ? (getReceiptPeriodEnd(latestSettlement) || latestSettlement.date || latestSettlement.createdAt?.slice(0, 10))
    : null;
  const unsettledLogs = (fin.unsettledLogs || []).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let fullDays = 0;
  let halfDays = 0;
  let hourlyDays = 0;
  let totalOtHours = 0;
  let totalGrossPay = 0;

  const logRows = unsettledLogs.map((l) => {
    const otH = Number(l.overtimeHours) || 0;
    const dayPay = Number(l.totalDayPay) || 0;
    totalOtHours += otH;
    totalGrossPay += dayPay;
    if (l.type === 'full' || !l.type) fullDays++;
    else if (l.type === 'half') halfDays++;
    else if (l.type === 'hourly') hourlyDays++;
    return { date: l.date, type: l.type || 'full', overtimeHours: otH, dayPay, note: l.note || '' };
  });

  const openAdvancesArr = Array.isArray(fin.unsettledPayments) ? fin.unsettledPayments : [];
  const unsettledAdvances = openAdvancesArr.map((p) => ({
    date: p.date || p.createdAt?.slice(0, 10),
    amount: Number(p.amount) || 0,
    note: p.note || p.description || ''
  }));
  const totalAdvances = Number(fin.unsettledAdvances) || unsettledAdvances.reduce((sum, p) => sum + p.amount, 0);
  const netDue = fin.netBalanceDue !== undefined ? fin.netBalanceDue : (totalGrossPay - totalAdvances);

  return {
    worker: { id: worker.id, name: worker.name, role: worker.role || '', dailyRate: worker.dailyRate, overtimeHourlyRate: worker.overtimeHourlyRate, currency },
    settlementStatus: { hasPreviousSettlement: Boolean(latestSettlement), lastSettlementDate, lastSettlementReceiptId: latestSettlement?.id || null },
    unsettledPeriod: {
      firstDate: unsettledLogs[0]?.date || null,
      lastDate: unsettledLogs[unsettledLogs.length - 1]?.date || null,
      totalLogsCount: unsettledLogs.length,
      fullDays,
      halfDays,
      hourlyDays,
      totalOtHours,
      totalGrossPay,
      totalAdvances,
      netDue,
      logs: logRows,
      advances: unsettledAdvances
    }
  };
}

/**
 * Legacy helper kept for backward compatibility.
 */
export async function analyzeWorkerAttendanceWithAi({
  worker,
  allLogs = [],
  allPayments = [],
  userQuestion = '',
  currency = 'IQD',
  language = 'fa'
}) {
  const summary = prepareWorkerAttendanceSummary(worker, allLogs, allPayments, currency);
  const res = await runKarSyncAiChatTurn({
    history: [],
    userMessage: userQuestion || (worker?.name ? `گزارش کارکرد ${worker.name}` : 'گزارش کارکرد'),
    context: { language, currency }
  });
  return { summary, aiText: res.text };
}
