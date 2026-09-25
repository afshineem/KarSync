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
  const allWorkerLogs = allLogs.filter((l) => String(l.workerId) === wId);
  const allWorkerPayments = allPayments.filter((p) => String(p.workerId) === wId && !p.deletedAt);

  // 1. Find all settlement receipts that apply to this worker (individual or group)
  const settlementReceipts = allPayments.filter((p) => 
    !p.deletedAt &&
    (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled') &&
    (String(p.workerId) === wId || (p.isGroupSettlement && worker.groupId && p.groupId === worker.groupId))
  );

  const sortedSettlements = [...settlementReceipts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  let lastSettlementDate = sortedSettlements[0]?.date || sortedSettlements[0]?.createdAt?.slice(0, 10) || null;
  
  // Historical cutoff safety guard: ensure September 2026 settlements cut off on or after 2026-09-20
  if (sortedSettlements[0]?.createdAt && sortedSettlements[0].createdAt.startsWith('2026-09') && sortedSettlements[0].createdAt <= '2026-09-22') {
    if (!lastSettlementDate || lastSettlementDate < '2026-09-20') lastSettlementDate = '2026-09-20';
  }

  // 2. Double-Barrier Guards
  const isLogSettled = (l) => {
    if (l.isSettled) return true;
    if (l.settlementReceiptId) return true;
    if (lastSettlementDate && l.date && l.date <= lastSettlementDate) return true;
    return false;
  };

  const isPaymentSettled = (p) => {
    if (p.isSettled) return true;
    if (p.settlementReceiptId) return true;
    if (p.type === 'settlement' || p.type === 'Settlement') return true;
    if (lastSettlementDate && p.date && p.date <= lastSettlementDate) return true;
    return false;
  };

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

  // 3. Unsettled / Open Period (کارکرد جاری و مطالبات معوقه)
  const unsettledLogs = allWorkerLogs
    .filter((l) => !isLogSettled(l))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const unsettledPayments = allWorkerPayments
    .filter((p) => !isPaymentSettled(p))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  let fullDays = 0;
  let halfDays = 0;
  let hourlyDays = 0;
  let otHours = 0;
  let basePay = 0;
  let otPay = 0;
  let unsettledGross = 0;

  unsettledLogs.forEach((l) => {
    if (l.type === 'full') fullDays++;
    else if (l.type === 'half') halfDays++;
    else if (l.type === 'hourly') hourlyDays++;

    const ot = Number(l.overtimeHours) || 0;
    otHours += ot;

    const base = Number(l.calculatedDailyWage) || (l.type === 'half' ? wDaily * 0.5 : l.type === 'full' ? wDaily : 0);
    const otAmount = Number(l.calculatedOvertimeWage) || (ot * wOtRate);
    basePay += base;
    otPay += otAmount;

    unsettledGross += getLogPay(l);
  });

  const effectiveDays = fullDays + halfDays * 0.5;
  const unsettledGrossRounded = roundCurrency(unsettledGross, currency);

  const unsettledAdvances = roundCurrency(
    unsettledPayments
      .filter((p) => p.type === 'advance' || p.type === 'Advance_Payment')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  const netBalanceDue = roundCurrency(unsettledGrossRounded - unsettledAdvances, currency);

  let status = 'settled';
  if (netBalanceDue > 0) status = 'pending';
  else if (netBalanceDue < 0) status = 'overpaid';
  else if (effectiveDays > 0) status = 'pending';

  // 4. Settled Historical Period (سوابق و کارکرد تسویه شده)
  const settledLogs = allWorkerLogs
    .filter((l) => isLogSettled(l))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const settledPayments = allWorkerPayments
    .filter((p) => isPaymentSettled(p))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  let settledFullDays = 0;
  let settledHalfDays = 0;
  let settledHourlyDays = 0;
  let settledOtHours = 0;
  let settledBasePay = 0;
  let settledOtPay = 0;
  let settledGross = 0;

  settledLogs.forEach((l) => {
    if (l.type === 'full') settledFullDays++;
    else if (l.type === 'half') settledHalfDays++;
    else if (l.type === 'hourly') settledHourlyDays++;

    const ot = Number(l.overtimeHours) || 0;
    settledOtHours += ot;

    const base = Number(l.calculatedDailyWage) || (l.type === 'half' ? wDaily * 0.5 : l.type === 'full' ? wDaily : 0);
    const otAmount = Number(l.calculatedOvertimeWage) || (ot * wOtRate);
    settledBasePay += base;
    settledOtPay += otAmount;

    settledGross += getLogPay(l);
  });

  const settledEffectiveDays = settledFullDays + settledHalfDays * 0.5;
  const settledGrossRounded = roundCurrency(settledGross, currency);

  const totalSettlementPaid = roundCurrency(
    settlementReceipts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  const settledAdvances = roundCurrency(
    settledPayments
      .filter((p) => p.type === 'advance' || p.type === 'Advance_Payment')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    currency
  );

  return {
    worker,
    lastSettlementDate,
    // Unsettled stats
    unsettledLogs,
    unsettledPayments,
    fullDays,
    halfDays,
    hourlyDays,
    effectiveDays,
    otHours,
    basePay: roundCurrency(basePay, currency),
    otPay: roundCurrency(otPay, currency),
    unsettledGross: unsettledGrossRounded,
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
    settledGross: settledGrossRounded,
    settledAdvances,
    totalSettlementPaid,
    // Helper functions
    isLogSettled,
    isPaymentSettled,
    getLogPay
  };
}
