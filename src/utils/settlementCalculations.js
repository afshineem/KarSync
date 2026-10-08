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

  // 2. FIFO Settlement Engine (Single Source of Truth)
  // Calculate total gross ever earned across all active logs
  const sortedLogs = [...allWorkerLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const totalGrossEver = roundCurrency(sortedLogs.reduce((sum, l) => sum + getLogPay(l), 0), currency);

  // Calculate total payments ever made (Settlements + Advances)
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
  const netBalanceDue = roundCurrency(Math.max(0, totalGrossEver - totalPaymentsEver), currency);

  // Chronologically resolve which logs are fully covered by payments vs unsettled
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

    const isCovered = (pay > 0 && paymentBudget >= pay - 0.001) || (pay === 0 && Boolean(l.settlementReceiptId));
    if (isCovered) {
      // Fully covered by past payments
      settledLogs.push(l);
      paymentBudget -= pay;

      if (l.type === 'full') settledFullDays++;
      else if (l.type === 'half') settledHalfDays++;
      else if (l.type === 'hourly') settledHourlyDays++;

      settledOtHours += ot;
      settledBasePay += base;
      settledOtPay += otAmount;
      settledGross += pay;
    } else {
      // Unsettled / Open log
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

  // Unsettled advances are open advances not yet absorbed by settlements
  const openAdvances = allWorkerPayments.filter((p) => 
    (p.type === 'advance' || p.type === 'Advance_Payment') && 
    !p.isSettled && 
    (!p.settlementReceiptId || !activeSettlementReceiptIds.has(String(p.settlementReceiptId)))
  );

  const unsettledAdvances = roundCurrency(
    openAdvances.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  const settledPayments = allWorkerPayments.filter((p) => 
    p.isSettled || (p.settlementReceiptId && activeSettlementReceiptIds.has(String(p.settlementReceiptId)))
  );

  const settledAdvances = roundCurrency(
    settledPayments
      .filter((p) => p.type === 'advance' || p.type === 'Advance_Payment')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  let status = 'settled';
  if (netBalanceDue > 0) status = 'pending';
  else if (totalPaymentsEver > totalGrossEver) status = 'overpaid';
  else if (effectiveDays > 0) status = 'pending';

  const isLogSettled = (l) => {
    return settledLogs.some((sl) => String(sl.id || sl.date) === String(l.id || l.date));
  };

  const isPaymentSettled = (p) => {
    if (p.isSettled) return true;
    if (p.settlementReceiptId && activeSettlementReceiptIds.has(String(p.settlementReceiptId))) return true;
    if (p.type === 'settlement' || p.type === 'Settlement') return true;
    return false;
  };

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
    isLogSettled,
    isPaymentSettled,
    getLogPay
  };
}
