import { db, generatePaymentId } from '../db/db';

/**
 * Calculates the current unpaid balance for a given worker.
 * Applies the new "Settlement Epoch" logic by ONLY aggregating records
 * where `isSettled` is falsy (or explicitly false).
 * 
 * @param {string} workerId 
 * @returns {Promise<number>} Current Unpaid Balance
 */
export async function calculateWorkerUnpaidBalance(workerId) {
  if (!workerId) return 0;

  const logs = await db.attendanceLogs
    .where('workerId').equals(workerId)
    .filter(log => !log.isSettled)
    .toArray();

  let totalEarned = 0;
  for (const log of logs) {
    totalEarned += (Number(log.calculatedDailyWage) || 0) + (Number(log.calculatedOvertimeWage) || 0);
  }

  const transactions = await db.payments
    .where('workerId').equals(workerId)
    .filter(tx => !tx.isSettled)
    .toArray();

  let totalDeductions = 0;
  let totalBonuses = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'Advance_Payment' || tx.type === 'Food_Expense') {
      totalDeductions += amount;
    } else if (tx.type === 'Bonus') {
      totalBonuses += amount;
    }
  }

  return totalEarned + totalBonuses - totalDeductions;
}

/**
 * 1. Group Settlement Calculation (GET API equivalent)
 * Generates a real-time pre-settlement invoice for a group.
 * 
 * @param {string} groupId 
 * @returns {Promise<Object>} Invoice Breakdown
 */
export async function generateGroupPreSettlementInvoice(groupId) {
  if (!groupId) throw new Error('Group ID is required');

  const groupWorkers = await db.workers.filter(w => w.groupId === groupId).toArray();
  const workerIds = groupWorkers.map(w => w.id);

  // Unpaid work logs
  const logs = await db.attendanceLogs
    .where('workerId').anyOf(workerIds)
    .filter(log => !log.isSettled)
    .toArray();

  let totalWorkPay = 0;
  for (const log of logs) {
    totalWorkPay += (Number(log.calculatedDailyWage) || 0) + (Number(log.calculatedOvertimeWage) || 0);
  }

  // Group-level transactions (e.g. Food Expense tied directly to group)
  const groupTx = await db.payments.filter(tx => tx.groupId === groupId && !tx.isSettled).toArray();
    
  // Worker-level transactions
  const workerTx = await db.payments
    .where('workerId').anyOf(workerIds)
    .filter(tx => !tx.isSettled && tx.groupId !== groupId)
    .toArray();

  const allTx = [...groupTx, ...workerTx];

  let totalAdvances = 0;
  let totalBonuses = 0;
  let totalFoodExpenses = 0;

  for (const tx of allTx) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'Advance_Payment') totalAdvances += amount;
    else if (tx.type === 'Bonus') totalBonuses += amount;
    else if (tx.type === 'Food_Expense') totalFoodExpenses += amount;
  }

  const grossPay = totalWorkPay + totalBonuses;
  const deductions = totalAdvances + totalFoodExpenses;
  const netPayable = grossPay - deductions;

  return {
    grossPay,
    deductions,
    netPayable,
    breakdown: {
      totalWorkPay,
      totalBonuses,
      totalAdvances,
      totalFoodExpenses,
      logsCount: logs.length,
      txCount: allTx.length,
      workerIds
    }
  };
}

/**
 * 2. Execution of Group Settlement (POST API equivalent)
 * Executes an ACID transaction to settle a group and generate a Master Receipt.
 * 
 * @param {string} groupId 
 * @param {string} masterWorkerId The ID of the Team Leader (استادکار) receiving the funds
 * @param {string} projectId 
 */
export async function executeGroupSettlement(groupId, masterWorkerId, projectId) {
  if (!groupId || !masterWorkerId) throw new Error('Group ID and Master Worker ID are required');

  // Perform ACID transaction in Dexie
  return await db.transaction('rw', db.workers, db.attendanceLogs, db.payments, async () => {
    // Re-verify calculations inside the transaction lock
    const invoice = await generateGroupPreSettlementInvoice(groupId);

    // Edge Case: Nothing to settle
    if (invoice.breakdown.logsCount === 0 && invoice.breakdown.txCount === 0) {
      throw new Error('No open records found to settle for this group.');
    }

    const receiptId = generatePaymentId();
    const now = new Date().toISOString();

    // 1. Generate Master Receipt Transaction
    const masterReceipt = {
      id: receiptId,
      projectId: projectId || 'prj_default',
      workerId: masterWorkerId,
      groupId: groupId,
      amount: invoice.netPayable, // Could be negative if deductions > gross!
      type: 'Settlement',
      status: 'completed',
      date: now.split('T')[0],
      month: now.substring(0, 7),
      isSettled: true,
      settlementReceiptId: receiptId, // Self-referential or null
      notes: `Group Settlement Receipt - Gross: ${invoice.grossPay}, Deductions: ${invoice.deductions}`,
      createdAt: now,
      updatedAt: now
    };

    await db.payments.add(masterReceipt);

    // 2. Bulk update all unsettled work logs for the group
    const workerIds = invoice.breakdown.workerIds;
    const unsettledLogs = await db.attendanceLogs
      .where('workerId').anyOf(workerIds)
      .filter(log => !log.isSettled)
      .toArray();

    if (unsettledLogs.length > 0) {
      const logsToUpdate = unsettledLogs.map(l => ({
        ...l,
        isSettled: true,
        settlementReceiptId: receiptId,
        updatedAt: now
      }));
      await db.attendanceLogs.bulkPut(logsToUpdate);
    }

    // 3. Bulk update all unsettled transactions for the group & its members
    const groupTx = await db.payments.filter(tx => tx.groupId === groupId && !tx.isSettled).toArray();
    const workerTx = await db.payments
      .where('workerId').anyOf(workerIds)
      .filter(tx => !tx.isSettled && tx.groupId !== groupId)
      .toArray();
      
    const allUnsettledTx = [...groupTx, ...workerTx];

    if (allUnsettledTx.length > 0) {
      const txToUpdate = allUnsettledTx.map(tx => ({
        ...tx,
        isSettled: true,
        settlementReceiptId: receiptId,
        updatedAt: now
      }));
      await db.payments.bulkPut(txToUpdate);
    }

    return masterReceipt;
  });
}
