import { calculateWorkerFinancials, getReceiptPeriodEnd } from '../utils/settlementCalculations';
import { formatCurrency, formatHoursAndMinutes, formatNumber } from '../utils/formatters';

const STORAGE_KEY = 'karsync_gemini_api_key';
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
const BUILTIN_GEMINI_KEY = typeof atob === 'function' 
  ? atob('QVEuQWI4Uk42SmlHTE92T3hxTUJ5UUZDUGJJSTlSVzhiTmJXMm4yWTRCc01UR2tsR29kbFE=') 
  : '';

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
 * Low-level call to Gemini REST API with fallback models.
 */
export async function callGeminiApi({ prompt, systemInstruction = '', modelIndex = 0 }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const model = DEFAULT_MODELS[modelIndex] || DEFAULT_MODELS[0];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
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

      // If model not found or unavailable, try fallback model
      if ((res.status === 404 || res.status === 503) && modelIndex + 1 < DEFAULT_MODELS.length) {
        return await callGeminiApi({ prompt, systemInstruction, modelIndex: modelIndex + 1 });
      }

      throw new Error(errMsg);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.find(p => p.text)?.text || '';
    return textPart.trim();
  } catch (error) {
    // If network or other error and we haven't exhausted models
    if (modelIndex + 1 < DEFAULT_MODELS.length && (error.message?.includes('404') || error.message?.includes('503'))) {
      return await callGeminiApi({ prompt, systemInstruction, modelIndex: modelIndex + 1 });
    }
    throw error;
  }
}

/**
 * Extracts and prepares raw structured attendance financial details for a worker.
 */
export function prepareWorkerAttendanceSummary(worker, allLogs = [], allPayments = [], currency = 'IQD') {
  if (!worker) return null;

  const fin = calculateWorkerFinancials(worker, allLogs, allPayments, currency);
  if (!fin) return null;

  const wId = String(worker.id);
  const workerLogs = (allLogs || []).filter(l => String(l.workerId) === wId && !l.deletedAt);
  const workerPayments = (allPayments || []).filter(p => String(p.workerId) === wId && !p.deletedAt && p.status !== 'deleted');

  // Settlements
  const settlements = workerPayments.filter(p => 
    p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled'
  ).sort((a, b) => {
    const endA = getReceiptPeriodEnd(a) || a.date || '';
    const endB = getReceiptPeriodEnd(b) || b.date || '';
    return endB.localeCompare(endA);
  });

  const latestSettlement = settlements[0] || null;
  const lastSettlementDate = latestSettlement ? (getReceiptPeriodEnd(latestSettlement) || latestSettlement.date || latestSettlement.createdAt?.slice(0, 10)) : null;

  // Unsettled / Open logs
  // In KarSync double-barrier logic, unsettled logs are those in fin.unsettledLogs
  const unsettledLogs = (fin.unsettledLogs || []).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Detailed log breakdown
  let fullDays = 0;
  let halfDays = 0;
  let hourlyDays = 0;
  let totalOtHours = 0;
  let totalOtPay = 0;
  let totalBasePay = 0;
  let totalGrossPay = 0;

  const logRows = unsettledLogs.map(l => {
    const otH = Number(l.overtimeHours) || 0;
    const dayPay = Number(l.totalDayPay) || 0;
    totalOtHours += otH;
    totalGrossPay += dayPay;

    if (l.type === 'full' || !l.type) fullDays++;
    else if (l.type === 'half') halfDays++;
    else if (l.type === 'hourly') hourlyDays++;

    return {
      date: l.date,
      type: l.type || 'full',
      overtimeHours: otH,
      dayPay: dayPay,
      note: l.note || ''
    };
  });

  const firstDate = unsettledLogs[0]?.date || null;
  const lastDate = unsettledLogs[unsettledLogs.length - 1]?.date || null;

  // Advances / Payments in unsettled period
  const unsettledAdvances = (fin.unsettledAdvances || []).map(p => ({
    date: p.date || p.createdAt?.slice(0, 10),
    amount: Number(p.amount) || 0,
    note: p.note || p.description || ''
  }));

  const totalAdvances = unsettledAdvances.reduce((sum, p) => sum + p.amount, 0);
  const netDue = (fin.unsettledNetDue !== undefined) ? fin.unsettledNetDue : (totalGrossPay - totalAdvances);

  return {
    worker: {
      id: worker.id,
      name: worker.name,
      role: worker.role || '',
      dailyRate: worker.dailyRate,
      overtimeHourlyRate: worker.overtimeHourlyRate,
      currency: currency
    },
    settlementStatus: {
      hasPreviousSettlement: Boolean(latestSettlement),
      lastSettlementDate: lastSettlementDate,
      lastSettlementReceiptId: latestSettlement?.id || null
    },
    unsettledPeriod: {
      firstDate,
      lastDate,
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
 * Formulates the AI prompt and asks Gemini to analyze the worker's attendance.
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
  if (!summary) {
    throw new Error('WORKER_DATA_NOT_FOUND');
  }

  const p = summary.unsettledPeriod;
  const s = summary.settlementStatus;
  const w = summary.worker;

  const langInstruction = language === 'ku' 
    ? 'وەڵامەکە بە زمانی شیرینی کوردی (سۆرانی ڕەسەن و ڕێک و پێک) بنووسە.'
    : language === 'en'
    ? 'Respond in clear, professional English.'
    : 'پاسخ را با زبان فارسی دقیق، روان، اداری و بدون اصطلاحات پیچیده بنویس.';

  const systemInstruction = `
You are the Senior AI HR & Attendance Auditor for the KarSync workshop and project management system.
Your job is to analyze personnel attendance, work shifts, overtime hours, advances, and unsettled balances.

Key Rules:
1. ALWAYS respect the exact numbers provided in the system data. Do NOT invent, recalculate or alter numbers.
2. The user has selected a specific worker. Focus specifically on this worker.
3. Clearly explain:
   - What date range is currently UNSETTLED (تصفیه نشده).
   - How many full days, half days, and overtime hours they worked.
   - The gross earnings, any advances/deductions received in this period, and the final net balance due.
   - Any highlights (e.g. peak overtime days or notable absences).
4. Use clean Markdown formatting with bullet points and bold highlights.
5. ${langInstruction}
`.trim();

  const dataContext = `
Personnel: ${w.name} (${w.role || 'Personnel'})
Base Daily Rate: ${w.dailyRate} ${currency}
Overtime Hourly Rate: ${w.overtimeHourlyRate} ${currency}

Settlement Status:
- Has previous settlement: ${s.hasPreviousSettlement ? 'Yes' : 'No (From beginning of work)'}
- Last settlement cutoff date: ${s.lastSettlementDate || 'None'}

Current Open/Unsettled Period Data:
- Open Period Date Range: ${p.firstDate || 'None'} to ${p.lastDate || 'Today'}
- Total Unsettled Working Days/Shifts: ${p.totalLogsCount} (Full Days: ${p.fullDays}, Half Days: ${p.halfDays}, Hourly: ${p.hourlyDays})
- Total Overtime Hours in Open Period: ${p.totalOtHours} hours
- Total Gross Wages Earned: ${p.totalGrossPay} ${currency}
- Total Advances/Payments Deducted in Open Period: ${p.totalAdvances} ${currency}
- Net Balance Currently Payable to Worker: ${p.netDue} ${currency}

Recent Daily Logs (Unsettled):
${JSON.stringify(p.logs.slice(-15), null, 2)}

Advances Paid in Open Period:
${JSON.stringify(p.advances, null, 2)}
`.trim();

  const userPrompt = userQuestion && userQuestion.trim()
    ? `User Question: "${userQuestion.trim()}"\n\nPlease answer the user's question directly based on the attendance data above.`
    : `Please provide a comprehensive attendance and wage audit report for ${w.name} for their current unsettled period. Explain from which date to which date is unpaid, breakdown of days and overtime, gross wage, advances paid, and net balance due.`;

  const fullPrompt = `${dataContext}\n\n${userPrompt}`;

  const aiText = await callGeminiApi({
    prompt: fullPrompt,
    systemInstruction
  });

  return {
    summary,
    aiText
  };
}
