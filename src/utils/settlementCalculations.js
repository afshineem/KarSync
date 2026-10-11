import { roundCurrency } from './formatters.js';

/**
 * Robust settlement and financial calculation for a single worker.
 * Fully aligned with FinancialsView logic:
 * - Uses Double-Barrier Guard (isSettled flag, settlementReceiptId, and lastSettlementDate).
 * - Accurately calculates full days, half days, hourly days, and overtime.
 * - Accurately calculates base pay, overtime pay, gross earnings, advances, and net balance due.
 * - Separates unsettled / open period from settled historical records.
 *
 * @param {Object} worker - Worker record
 * @param {Array} allLogs - All attendance logs (or worker/group logs)
 * @param {Array} allPayments - All payments (or worker/group payments)
 * @param {string} currency - Project currency code (default: 'IQD')
 * @returns {Object} Comprehensive financial calculations
 */
export function calculateWorkerFinancials(worker, allLogs = [], allPayments = [], currency = 'IQD') {
  if (!worker) return null;

  const wId = String(worker.id);
  const allWorkerLogs = (allLogs || []).filter((l) => String(l.workerId) === wId && !l.deletedAt);
  const allWorkerPayments = (allPayments || []).filter((p) => 
    String(p.workerId) === wId && !p.deletedAt && p.status !== 'deleted'
  );

  // 1. Find all settlement receipts that apply to this worker (individual or group)
  const settlementReceipts = (allPayments || []).filter((p) => 
    !p.deletedAt &&
    p.status !== 'deleted' &&
    (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled') &&
    (String(p.workerId) === wId || (p.isGroupSettlement && worker.groupId && p.groupId === worker.groupId))
  );

  const activeSettlementReceiptIds = new Set(
    (allPayments || [])
      .filter((p) => !p.deletedAt && p.status !== 'deleted')
      .map((p) => String(p.id))
  );

  const sortedSettlements = [...settlementReceipts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const lastSettlementDate = sortedSettlements[0]?.date || sortedSettlements[0]?.createdAt?.slice(0, 10) || null;

  const wDaily = Number(String(worker.dailyRate).replace(/,/g, '')) || 0;
  const wOtRate = Number(String(worker.overtimeHourlyRate).replace(/,/g, '')) || 0;

  const getLogPay = (l) => {
    let val = Number(l.totalDayPay);
    if (!isNaN(val) && val > 0) return val;
    const otH = Math.max(0, Number(l.overtimeHours) || 0);
    if (l.type === 'half') return (wDaily * 0.5) + (otH * wOtRate);
    if (l.type === 'hourly') return otH * (wOtRate || (wDaily / 8));
    return wDaily + (otH * wOtRate);
  };

  // 2. Settlement receipt lookup & flag-based resolution (ROOT-CAUSE FIX)
  // An explicit settlement receipt is the single source of truth:
  // - A log is settled only if tied to an active settlement receipt (or valid legacy flag).
  // - Monetary FIFO budget is NEVER used across periods: money from past settlements
  //   can never silently mark open work as settled.
  const receiptById = new Map(settlementReceipts.map((p) => [String(p.id), p]));

  const isFlaggedSettled = (l) => {
    // A log explicitly tied to an active settlement receipt
    if (l.settlementReceiptId && activeSettlementReceiptIds.has(String(l.settlementReceiptId))) {
      const receipt = receiptById.get(String(l.settlementReceiptId));
      const receiptDate = receipt ? (receipt.date || receipt.createdAt?.slice(0, 10) || null) : null;
      // Guard against falsely stamped future dates: a log worked strictly after a settlement date cannot be paid by that receipt
      if (receiptDate && (l.date || '') > receiptDate) {
        return false;
      }
      return true;
    }
    // Legacy support: marked isSettled without receiptId, but worker has settlements and date is on or before last settlement
    if (l.isSettled && settlementReceipts.length > 0) {
      if (lastSettlementDate && (l.date || '') <= lastSettlementDate) {
        return true;
      }
    }
    return false;
  };

  const isPaymentSettled = (p) => {
    if (p.type === 'settlement' || p.type === 'Settlement') return true;
    if (p.settlementReceiptId && activeSettlementReceiptIds.has(String(p.settlementReceiptId))) return true;
    if (p.isSettled && lastSettlementDate && (p.date || '') <= lastSettlementDate) return true;
    return false;
  };

  // 3. Separate logs into settled historical vs unsettled open periods
  const sortedLogs = [...allWorkerLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const totalGrossEver = roundCurrency(sortedLogs.reduce((sum, l) => sum + getLogPay(l), 0), currency);

  const totalSettlementPaid = roundCurrency(
    settlementReceipts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  const totalAdvancesPaid = roundCurrency(
    allWorkerPayments
      .filter((p) => p.type === 'advance' || p.type === 'Advance_Payment')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  const totalPaymentsEver = roundCurrency(totalSettlementPaid + totalAdvancesPaid, currency);

  const useFlags = settlementReceipts.length === 0 || sortedLogs.some(isFlaggedSettled);

  // Safety net: find logs that are marked settled but were worked after the settlement date,
  // or on the same day when the settlement was partial and left an unpaid balance.
  const suspiciousSettledLogs = [];
  sortedLogs.forEach((l) => {
    const hasSettledFlag = Boolean(l.isSettled || l.settlementReceiptId);
    if (!hasSettledFlag) return;

    const receipt = l.settlementReceiptId ? receiptById.get(String(l.settlementReceiptId)) : null;
    const receiptDate = receipt ? (receipt.date || receipt.createdAt?.slice(0, 10) || null) : null;
    const compareDate = receiptDate || lastSettlementDate;

    if (!compareDate || (l.date || '') > compareDate) {
      suspiciousSettledLogs.push(l);
      return;
    }

    if (receipt && receipt.settlement_status === 'partial' && Number(receipt.remainingBalanceAfter) > 0 && (l.date || '') === receiptDate) {
      suspiciousSettledLogs.push(l);
      return;
    }
  });

  // Chronologically resolve which logs are settled vs unsettled
  let paymentBudget = totalPaymentsEver;
  const settledLogs = [];
  const unsettledLogs = [];

  let fullDays = 0;
  let halfDays = 0;
  let hourlyDays = 0;
  let otHours = 0;
  let basePay = 0;
  let otPay = 0;
  let unsettledGross = 0;

  let settledFullDays = 0;
  let settledHalfDays = 0;
  let settledHourlyDays = 0;
  let settledOtHours = 0;
  let settledBasePay = 0;
  let settledOtPay = 0;
  let settledGross = 0;

  sortedLogs.forEach((l) => {
    const pay = getLogPay(l);
    const ot = Number(l.overtimeHours) || 0;
    const base = Number(l.calculatedDailyWage) || (l.type === 'half' ? wDaily * 0.5 : l.type === 'full' ? wDaily : 0);
    const otAmount = Number(l.calculatedOvertimeWage) || (ot * wOtRate);

    const isCovered = useFlags
      ? isFlaggedSettled(l)
      : (pay > 0 && paymentBudget >= pay - 0.001) || (pay === 0 && Boolean(l.settlementReceiptId));

    if (isCovered) {
      if (!useFlags) paymentBudget -= pay;
      settledLogs.push(l);
      if (l.type === 'full') settledFullDays++;
      else if (l.type === 'half') settledHalfDays++;
      else if (l.type === 'hourly') settledHourlyDays++;

      settledOtHours += ot;
      settledBasePay += base;
      settledOtPay += otAmount;
      settledGross += pay;
    } else {
      unsettledLogs.push(l);
      if (l.type === 'full') fullDays++;
      else if (l.type === 'half') halfDays++;
      else if (l.type === 'hourly') hourlyDays++;

      otHours += ot;
      basePay += base;
      otPay += otAmount;
      unsettledGross += pay;
    }
  });

  const effectiveDays = fullDays + halfDays * 0.5;
  const settledEffectiveDays = settledFullDays + settledHalfDays * 0.5;

  // Unsettled advances are open advances in the current cycle
  const openAdvances = allWorkerPayments.filter((p) => 
    (p.type === 'advance' || p.type === 'Advance_Payment') && 
    !isPaymentSettled(p)
  );

  const unsettledAdvances = roundCurrency(
    openAdvances.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  const settledPayments = allWorkerPayments.filter((p) => isPaymentSettled(p));

  const settledAdvances = roundCurrency(
    settledPayments
      .filter((p) => p.type === 'advance' || p.type === 'Advance_Payment')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  // Net balance due for the current open period
  const netBalanceDue = roundCurrency(unsettledGross - unsettledAdvances, currency);

  let status = 'settled';
  if (netBalanceDue > 0) status = 'pending';
  else if (netBalanceDue < 0) status = 'overpaid';
  else if (effectiveDays > 0) status = 'pending';

  return {
    worker,
    lastSettlementDate,
    // Unsettled stats
    unsettledLogs,
    unsettledPayments: openAdvances,
    fullDays,
    halfDays,
    hourlyDays,
    effectiveDays,
    otHours,
    basePay: roundCurrency(basePay, currency),
    otPay: roundCurrency(otPay, currency),
    unsettledGross: roundCurrency(unsettledGross, currency),
    unsettledAdvances,
    netBalanceDue,
    status,
    isSettled: status === 'settled',
    // Settled stats
    settledLogs,
    suspiciousSettledLogs,
    settledPayments,
    settlementReceipts,
    settledFullDays,
    settledHalfDays,
    settledHourlyDays,
    settledEffectiveDays,
    settledOtHours,
    settledBasePay: roundCurrency(settledBasePay, currency),
    settledOtPay: roundCurrency(settledOtPay, currency),
    settledGross: roundCurrency(settledGross, currency),
    settledAdvances,
    totalSettlementPaid,
    totalAdvancesPaid,
    totalPaymentsEver,
    totalGrossEver,
    // Helper functions
    isLogSettled: (l) => (useFlags ? isFlaggedSettled(l) : settledLogs.includes(l)),
    isPaymentSettled,
    getLogPay
  };
}
