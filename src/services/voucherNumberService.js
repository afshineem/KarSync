/**
 * voucherNumberService.js
 * Comprehensive Voucher Numbering and Management Service for KarSync.
 * 
 * Rules based on KarSync Charter (اساسنامه حسابداری کارسینک):
 * 1. Format: YYMMNNN (e.g. 2611001 -> Year 2026, Month 11, Voucher 001)
 * 2. Distinction between Temporary (Draft) and Permanent (Approved):
 *    - Temporary (Draft): Prefixed with 'T-' (e.g. T-2611001)
 *    - Permanent (Approved): Plain format (e.g. 2611001)
 * 3. When an approved document is finalized, it is promoted to a permanent voucher number.
 * 4. All financial transactions (expenses, settlements, advances, loans, incomes, transfers)
 *    share the unified voucher numbering space.
 */

import { db } from '../db/db';
import { getTodayDateString } from '../utils/formatters';

/**
 * Extracts 2-digit year and 2-digit month from a date string (YYYY-MM-DD or ISO).
 */
export function getYearMonthPrefix(dateStr) {
  const d = dateStr ? dateStr.slice(0, 10) : getTodayDateString();
  const parts = d.split('-');
  const year2d = parts[0] ? parts[0].slice(-2) : '26';
  const month2d = parts[1] ? parts[1].padStart(2, '0') : '01';
  return `${year2d}${month2d}`;
}

/**
 * Parses a voucher number string into its components.
 */
export function parseVoucherNumber(voucherNo) {
  if (!voucherNo || typeof voucherNo !== 'string') return null;
  const isDraft = voucherNo.startsWith('T-') || voucherNo.startsWith('t-');
  const clean = isDraft ? voucherNo.slice(2) : voucherNo;
  if (clean.length < 5) return null;
  const year2d = clean.slice(0, 2);
  const month2d = clean.slice(2, 4);
  const seqStr = clean.slice(4);
  const sequence = parseInt(seqStr, 10) || 0;
  return {
    isDraft,
    year2d,
    month2d,
    prefix: `${year2d}${month2d}`,
    sequence,
    raw: voucherNo
  };
}

/**
 * Generates the next sequential voucher number for a given date and draft/approved status.
 * Scans all transactions across Dexie tables in that month to find the highest sequence.
 * 
 * @param {Object} options
 * @param {string} options.date - Date string (YYYY-MM-DD)
 * @param {boolean} options.isDraft - Whether the voucher is temporary (draft)
 * @returns {Promise<string>} e.g. "T-2611001" or "2611001"
 */
export async function generateNextVoucherNumber({ date, isDraft = true }) {
  const prefix = getYearMonthPrefix(date); // e.g. "2611"

  let maxSeq = 0;

  const inspectItem = (item) => {
    if (!item?.voucherNumber) return;
    const parsed = parseVoucherNumber(item.voucherNumber);
    if (parsed && parsed.prefix === prefix && parsed.isDraft === Boolean(isDraft)) {
      if (parsed.sequence > maxSeq) {
        maxSeq = parsed.sequence;
      }
    }
  };

  try {
    if (db.payments) {
      const payments = await db.payments.toArray();
      payments.forEach(inspectItem);
    }
    if (db.expenses) {
      const expenses = await db.expenses.toArray();
      expenses.forEach(inspectItem);
    }
    if (db.loans) {
      const loans = await db.loans.toArray();
      loans.forEach(inspectItem);
    }
    if (db.treasuryIncomes) {
      const incomes = await db.treasuryIncomes.toArray();
      incomes.forEach(inspectItem);
    }
    if (db.accountTransfers) {
      const transfers = await db.accountTransfers.toArray();
      transfers.forEach(inspectItem);
    }
  } catch (err) {
    console.warn('[voucherNumberService] Error reading existing vouchers:', err);
  }

  const nextSeq = maxSeq + 1;
  const seqPadded = String(nextSeq).padStart(3, '0');
  return isDraft ? `T-${prefix}${seqPadded}` : `${prefix}${seqPadded}`;
}

/**
 * Promotes a draft voucher number to a permanent voucher number upon final approval.
 * If already permanent, returns the existing voucher.
 */
export async function promoteVoucherToPermanent(currentVoucher, date) {
  if (currentVoucher && !currentVoucher.startsWith('T-') && !currentVoucher.startsWith('t-')) {
    return currentVoucher; // Already permanent
  }
  return await generateNextVoucherNumber({ date, isDraft: false });
}

/**
 * Deterministic fallback generator for memory-only items or quick display.
 */
export function getDeterministicVoucher(item, indexHint = 1) {
  if (item?.voucherNumber) return item.voucherNumber;
  const dateStr = item?.date || item?.expenseDate || item?.rawDate || item?.createdAt || getTodayDateString();
  const prefix = getYearMonthPrefix(dateStr);
  const isDraft = item?.status !== 'approved' && item?.approval_status !== 'approved';
  const seqPadded = String(indexHint).padStart(3, '0');
  return isDraft ? `T-${prefix}${seqPadded}` : `${prefix}${seqPadded}`;
}

/**
 * Auto-backfill migration: Ensures all legacy records in Dexie have standard voucher numbers.
 * Runs once upon app boot or sync.
 */
export async function autoBackfillAllVouchers() {
  try {
    let modifiedCount = 0;

    // Helper to process a table collection
    const processTable = async (table, dateField = 'date', statusField = 'status') => {
      if (!table) return;
      const items = await table.toArray();
      const needVoucher = items.filter((it) => !it.voucherNumber && !it.deletedAt);
      if (needVoucher.length === 0) return;

      // Group by prefix and draft status
      needVoucher.sort((a, b) => {
        const da = a[dateField] || a.createdAt || '';
        const db_ = b[dateField] || b.createdAt || '';
        return da.localeCompare(db_);
      });

      for (const item of needVoucher) {
        const d = item[dateField] || item.createdAt || getTodayDateString();
        const isDraft = (item[statusField] !== 'approved' && item.approval_status !== 'approved');
        const voucherNo = await generateNextVoucherNumber({ date: d, isDraft });
        await table.update(item.id, {
          voucherNumber: voucherNo,
          updatedAt: new Date().toISOString()
        });
        modifiedCount++;
      }
    };

    await processTable(db.expenses, 'expenseDate', 'status');
    await processTable(db.payments, 'date', 'status');
    await processTable(db.loans, 'date', 'status');
    await processTable(db.treasuryIncomes, 'date', 'status');
    await processTable(db.accountTransfers, 'date', 'status');

    if (modifiedCount > 0) {
      console.log(`[voucherNumberService] Successfully backfilled ${modifiedCount} legacy records with official vouchers.`);
    }
  } catch (err) {
    console.warn('[voucherNumberService] Backfill error (non-fatal):', err);
  }
}
