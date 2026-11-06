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
/**
 * Resolves the effective period end date (YYYY-MM-DD) covered by a settlement receipt.
 * Evaluates:
 * 1. receipt.periodEndDate (explicit cutoff)
 * 2. receipt.month (end of billing month: e.g. 2026-09 -> 2026-09-30)
 * 3. receipt.date or receipt.createdAt (fallback voucher payment date)
 */
export function getReceiptPeriodEnd(receipt) {
  if (!receipt) return null;
  if (receipt.periodEndDate) return receipt.periodEndDate;
  if (receipt.month) {
    const parts = String(receipt.month).split('-');
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m)) {
        const lastDay = new Date(y, m, 0).getDate();
        return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    }
  }
  return receipt.date || receipt.createdAt?.slice(0, 10) || null;
}

export function calculateWorkerFinancials(worker, allLogs = [], allPayments = [], currency = 'IQD', allLoans = []) {
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

  const sortedSettlements = [...settlementReceipts].sort((a, b) => {
    const endA = getReceiptPeriodEnd(a) || '';
    const endB = getReceiptPeriodEnd(b) || '';
    return endB.localeCompare(endA);
  });
  const latestSettlement = sortedSettlements[0] || null;
  const lastSettlementPeriodEnd = getReceiptPeriodEnd(latestSettlement);
  const lastSettlementDate = latestSettlement?.date || latestSettlement?.createdAt?.slice(0, 10) || null;

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
      const receiptPeriodEnd = getReceiptPeriodEnd(receipt);
      // Guard against falsely stamped future dates: a log worked strictly after a settlement period end cannot be paid by that receipt
      if (receiptPeriodEnd && (l.date || '') > receiptPeriodEnd) {
        return false;
      }
      return true;
    }
    // Explicitly marked isSettled (e.g. prior cycle settlement, leave settlement, or historical data)
    if (l.isSettled) {
      if (settlementReceipts.length > 0) {
        if (lastSettlementPeriodEnd && (l.date || '') <= lastSettlementPeriodEnd) {
          return true;
        }
      } else {
        return true;
      }
    }
    return false;
  };

  const isPaymentSettled = (p) => {
    if (p.type === 'settlement' || p.type === 'Settlement') return true;
    if (p.settlementReceiptId && activeSettlementReceiptIds.has(String(p.settlementReceiptId))) {
      const receipt = receiptById.get(String(p.settlementReceiptId));
      const receiptPeriodEnd = getReceiptPeriodEnd(receipt);
      if (receiptPeriodEnd && (p.date || '') > receiptPeriodEnd) {
        return false;
      }
      return true;
    }
    if (p.isSettled) {
      if (settlementReceipts.length > 0) {
        if (lastSettlementPeriodEnd && (p.date || '') <= lastSettlementPeriodEnd) return true;
      } else {
        return true;
      }
    }
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
    const receiptPeriodEnd = getReceiptPeriodEnd(receipt);
    const compareDate = receiptPeriodEnd || lastSettlementPeriodEnd;

    if (!compareDate || (l.date || '') > compareDate) {
      suspiciousSettledLogs.push(l);
      return;
    }

    if (receipt && receipt.settlement_status === 'partial' && Number(receipt.remainingBalanceAfter) > 0 && (l.date || '') === receiptPeriodEnd) {
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
      if (l.type === 'full' || l.type === 'present') settledFullDays++;
      else if (l.type === 'half') settledHalfDays++;
      else if (l.type === 'hourly') settledHourlyDays++;

      settledOtHours += ot;
      settledBasePay += base;
      settledOtPay += otAmount;
      settledGross += pay;
    } else {
      unsettledLogs.push(l);
      if (l.type === 'full' || l.type === 'present') fullDays++;
      else if (l.type === 'half') halfDays++;
      else if (l.type === 'hourly') hourlyDays++;

      otHours += ot;
      basePay += base;
      otPay += otAmount;
      unsettledGross += pay;
    }
  });

  const isMonthlyWage = worker.wageType === 'monthly';
  let monthlySalary = Number(worker.monthlySalary) || 0;
  let presentDaysCount = 0;
  let leaveDaysCount = 0;
  let absentDaysCount = 0;
  let deductibleDays = 0;
  let absenceDeduction = 0;
  let unusedLeaveDays = 0;
  let encashmentPay = 0;
  let fridayExtraPay = 0;
  let daysInBillingMonth = 30;

  if (isMonthlyWage) {
    const sampleDate = (unsettledLogs.length > 0 ? unsettledLogs[unsettledLogs.length - 1]?.date : null) || lastSettlementPeriodEnd || new Date().toISOString().slice(0, 10);
    const dateParts = String(sampleDate).split('-');
    if (dateParts.length >= 2) {
      const y = parseInt(dateParts[0], 10);
      const m = parseInt(dateParts[1], 10);
      if (!isNaN(y) && !isNaN(m)) {
        daysInBillingMonth = new Date(y, m, 0).getDate();
      }
    }
    const dailyDeductRate = daysInBillingMonth > 0 ? (monthlySalary / daysInBillingMonth) : (monthlySalary / 30);

    presentDaysCount = unsettledLogs.filter((l) => l.type === 'present' || l.type === 'full').length;
    leaveDaysCount = unsettledLogs.filter((l) => l.type === 'leave').length;
    absentDaysCount = unsettledLogs.filter((l) => l.type === 'absent').length;

    const monthlyLeaveAllowance = Number(worker.monthlyLeaveDays) || 0;
    const bonusLeaveAllowance = Number(worker.bonusLeaveDays) || 0;
    const leavePolicy = worker.leavePolicy || 'accumulate';

    let allowedLeaveThisPeriod = monthlyLeaveAllowance + bonusLeaveAllowance;
    if (leavePolicy === 'accumulate') {
      const settledLeaveTaken = settledLogs.filter((l) => l.type === 'leave').length;
      const totalEarnedLeave = ((settlementReceipts.length + 1) * monthlyLeaveAllowance) + bonusLeaveAllowance;
      allowedLeaveThisPeriod = Math.max(0, totalEarnedLeave - settledLeaveTaken);
      const deductibleLeave = Math.max(0, leaveDaysCount - allowedLeaveThisPeriod);
      unusedLeaveDays = Math.max(0, allowedLeaveThisPeriod - leaveDaysCount);
      deductibleDays = absentDaysCount + deductibleLeave;
      encashmentPay = 0;
    } else if (leavePolicy === 'encash') {
      const deductibleLeave = Math.max(0, leaveDaysCount - allowedLeaveThisPeriod);
      unusedLeaveDays = Math.max(0, allowedLeaveThisPeriod - leaveDaysCount);
      deductibleDays = absentDaysCount + deductibleLeave;
      encashmentPay = roundCurrency(unusedLeaveDays * dailyDeductRate, currency);
    } else {
      // expire
      const deductibleLeave = Math.max(0, leaveDaysCount - allowedLeaveThisPeriod);
      deductibleDays = absentDaysCount + deductibleLeave;
      unusedLeaveDays = 0;
      encashmentPay = 0;
    }

    absenceDeduction = roundCurrency(deductibleDays * dailyDeductRate, currency);
    const totalOtWage = roundCurrency(otHours * wOtRate, currency);

    // Calculate Friday work extra bonus pay
    fridayExtraPay = roundCurrency(
      unsettledLogs.reduce((sum, l) => {
        if (l.type === 'present' || l.type === 'full') {
          try {
            const [ly, lm, ld] = (l.date || '').split('-').map(Number);
            if (new Date(ly, lm - 1, ld).getDay() === 5) {
              const mult = Number(worker.fridayRateMultiplier ?? 2.0);
              if (mult > 1.0) {
                return sum + (dailyDeductRate * (mult - 1.0));
              }
            }
          } catch (_) {}
        }
        return sum;
      }, 0),
      currency
    );

    // If there are active unsettled logs, monthly gross wage applies
    if (unsettledLogs.length > 0) {
      unsettledGross = roundCurrency(
        Math.max(0, monthlySalary - absenceDeduction) + totalOtWage + fridayExtraPay + encashmentPay,
        currency
      );
      basePay = roundCurrency(Math.max(0, monthlySalary - absenceDeduction), currency);
      otPay = totalOtWage;
    } else {
      unsettledGross = 0;
      basePay = 0;
      otPay = 0;
    }
  }

  const effectiveDays = isMonthlyWage ? (presentDaysCount + leaveDaysCount) : (fullDays + halfDays * 0.5);
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

  // Active loans for this worker
  const activeLoans = (allLoans || []).filter((l) => 
    String(l.workerId) === wId && 
    !l.deletedAt && 
    l.status === 'active' && 
    (Number(l.remainingBalance) > 0)
  );

  const totalLoanRemaining = roundCurrency(
    activeLoans.reduce((sum, l) => sum + (Number(l.remainingBalance) || 0), 0),
    currency
  );

  const suggestedLoanDeduction = roundCurrency(
    activeLoans.reduce((sum, l) => sum + Math.min(Number(l.monthlyInstallment) || 0, Number(l.remainingBalance) || 0), 0),
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
    lastSettlementPeriodEnd,
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
    // Staff Loans
    activeLoans,
    totalLoanRemaining,
    suggestedLoanDeduction,
    status,
    isSettled: status === 'settled',
    // Monthly wage details
    isMonthlyWage,
    monthlySalary,
    daysInBillingMonth,
    presentDaysCount,
    leaveDaysCount,
    absentDaysCount,
    deductibleDays,
    absenceDeduction,
    unusedLeaveDays,
    encashmentPay,
    fridayExtraPay,
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
