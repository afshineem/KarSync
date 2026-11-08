import {
  db,
  generateChequeId,
  generateChequebookId,
  DEFAULT_PROJECT_ID,
  generateTreasuryIncomeId,
  generateExpenseId
} from '../db/db';
import { generateNextVoucherNumber } from './voucherNumberService';
import {
  pushChequeLive,
  deleteChequeLive,
  pushChequebookLive,
  deleteChequebookLive,
  pushTreasuryIncomeLive,
  pushExpenseLive
} from './realtimeSync';

/**
 * Service for Cheque & Commercial Notes Management (سیستم جامع مدیریت چک و اسناد تجاری)
 * Supports inward (receivable) and outward (payable) cheques, workshop chequebooks,
 * status lifecycle transitions (in_hand, in_clearing, cleared, bounced, endorsed, void),
 * and automatic bank ledger synchronizations upon clearing.
 */

export const CHEQUE_STATUSES = {
  IN_HAND: 'in_hand',       // نزد صندوق (چک دریافتی)
  IN_CLEARING: 'in_clearing', // در جریان وصول / واگذار به بانک
  ISSUED: 'issued',         // صادر شده (چک خروجی کارگاه)
  CLEARED: 'cleared',       // وصول‌شده / پاس‌شده در بانک
  BOUNCED: 'bounced',       // برگشت‌خورده
  ENDORSED: 'endorsed',     // خرج‌شده / واگذارشده به شخص ثالث
  VOID: 'void'              // باطل‌شده
};

/**
 * Creates a new cheque record (inward or outward).
 * 
 * @param {Object} data Cheque attributes
 * @param {Object} [currentUser] Active authenticated user
 * @returns {Promise<Object>} Created cheque record
 */
export async function createCheque(data, currentUser = null) {
  if (!db.cheques) throw new Error('Cheques store not initialized');

  const projectId = data.projectId || DEFAULT_PROJECT_ID;
  const type = data.type === 'outward' ? 'outward' : 'inward';
  const amount = Number(String(data.amount || 0).replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const chequeNumber = String(data.chequeNumber || '').trim();
  if (!chequeNumber) {
    throw new Error('CHEQUE_NUMBER_REQUIRED');
  }

  if (type === 'outward' && !data.bankAccountId) {
    throw new Error('BANK_ACCOUNT_REQUIRED');
  }

  const now = new Date().toISOString();
  const id = generateChequeId();
  const userName = currentUser?.name || currentUser?.title || currentUser?.email || 'مدیر';
  const userId = currentUser?.id || currentUser?.userId || 'default_user';

  // Generate deterministic/standard voucher number
  let voucherNumber = data.voucherNumber;
  if (!voucherNumber) {
    try {
      voucherNumber = await generateNextVoucherNumber(projectId, 'cheque', data.dueDate || data.issueDate || now);
    } catch (_) {
      voucherNumber = `CHK-${Date.now().toString().slice(-6)}`;
    }
  }

  const initialStatus = data.status || (type === 'outward' ? CHEQUE_STATUSES.ISSUED : CHEQUE_STATUSES.IN_HAND);

  const chequeRecord = {
    id,
    projectId,
    type, // 'inward' | 'outward'
    bankAccountId: data.bankAccountId || null,
    bankName: data.bankName || '',
    branchName: data.branchName || '',
    chequeNumber,
    sayadNumber: String(data.sayadNumber || '').trim(), // 16-digit Sayad ID
    nationalId: String(data.nationalId || '').trim(),   // صادرکننده یا ذینفع
    drawerName: data.drawerName || '',                 // صادرکننده
    payeeName: data.payeeName || '',                   // در وجه / ذینفع
    counterpartyId: data.counterpartyId || null,
    workerId: data.workerId || null,
    amount,
    currency: data.currency || 'IQD',
    issueDate: data.issueDate || now.split('T')[0],
    dueDate: data.dueDate || now.split('T')[0],
    purpose: data.purpose || '',                       // بابت / شرح صدور
    status: initialStatus,
    notes: data.notes || '',
    attachmentUrl: data.attachmentUrl || '',
    voucherNumber,
    bankTrackingCode: data.bankTrackingCode || '',
    bankDocumentNumber: data.bankDocumentNumber || '',
    clearedDate: data.clearedDate || null,
    clearedAccountId: data.clearedAccountId || null,
    bouncedDate: data.bouncedDate || null,
    bouncedReason: data.bouncedReason || '',
    endorsedToCounterpartyId: data.endorsedToCounterpartyId || null,
    endorsedToName: data.endorsedToName || '',
    endorsedDate: data.endorsedDate || null,
    voidDate: data.voidDate || null,
    voidReason: data.voidReason || '',
    created_by: userId,
    creator_name: userName,
    createdAt: now,
    updatedAt: now
  };

  await db.cheques.put(chequeRecord);

  // If this outward cheque is associated with a chequebook leaf, increment usedLeaves
  if (type === 'outward' && data.chequebookId && db.chequebooks) {
    try {
      const book = await db.chequebooks.get(data.chequebookId);
      if (book) {
        await db.chequebooks.update(book.id, {
          usedLeaves: (Number(book.usedLeaves) || 0) + 1,
          updatedAt: now
        });
      }
    } catch (_) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-cheques-sync', { detail: { id, type } }));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  pushChequeLive(chequeRecord).catch(console.warn);

  return chequeRecord;
}

/**
 * Updates an existing cheque.
 */
export async function updateCheque(id, updates, currentUser = null) {
  if (!db.cheques) throw new Error('Cheques store not initialized');

  const existing = await db.cheques.get(id);
  if (!existing) throw new Error('Cheque not found');

  const now = new Date().toISOString();
  const userName = currentUser?.name || currentUser?.title || currentUser?.email || 'مدیر';
  const userId = currentUser?.id || currentUser?.userId || 'default_user';

  const updatedRecord = {
    ...existing,
    ...updates,
    updated_by: userId,
    updater_name: userName,
    updatedAt: now
  };

  if (updates.amount !== undefined) {
    updatedRecord.amount = Number(String(updates.amount).replace(/,/g, '')) || 0;
  }

  await db.cheques.put(updatedRecord);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-cheques-sync', { detail: { id } }));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  pushChequeLive(updatedRecord).catch(console.warn);

  return updatedRecord;
}

/**
 * Deletes a cheque record.
 */
export async function deleteCheque(id) {
  if (!db.cheques) return;

  const existing = await db.cheques.get(id);
  if (!existing) return;

  await db.cheques.delete(id);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-cheques-sync', { detail: { id, deleted: true } }));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  deleteChequeLive(id).catch(console.warn);
}

/**
 * Handles clearing / cashing a cheque (پاس شدن یا وصول چک در بانک).
 * If autoCreateTransaction is true, automatically injects a verified deposit or withdrawal into treasury.
 */
export async function clearCheque(id, clearData = {}, currentUser = null) {
  if (!db.cheques) throw new Error('Cheques store not initialized');

  const cheque = await db.cheques.get(id);
  if (!cheque) throw new Error('Cheque not found');

  const now = new Date().toISOString();
  const clearedDate = clearData.clearedDate || now.split('T')[0];
  const clearedAccountId = clearData.clearedAccountId || cheque.bankAccountId;
  const bankTrackingCode = clearData.bankTrackingCode || cheque.bankTrackingCode || '';
  const bankDocumentNumber = clearData.bankDocumentNumber || cheque.bankDocumentNumber || cheque.chequeNumber || '';

  // 1. If inward cheque and account specified: create treasury income record
  let generatedIncomeId = null;
  if (cheque.type === 'inward' && clearedAccountId && clearData.createBankRecord !== false) {
    try {
      const incId = generateTreasuryIncomeId();
      const incRecord = {
        id: incId,
        projectId: cheque.projectId || DEFAULT_PROJECT_ID,
        accountId: clearedAccountId,
        counterpartyId: cheque.counterpartyId || null,
        amount: cheque.amount,
        date: clearedDate,
        title: `وصول چک صیادی ${cheque.chequeNumber} (${cheque.drawerName || cheque.purpose || 'اسناد دریافتنی'})`,
        status: 'approved',
        chequeId: cheque.id,
        bankTrackingCode,
        bankDocumentNumber,
        notes: `وصول سیستمی چک شماره ${cheque.chequeNumber}. بابت: ${cheque.purpose || '-'}`,
        created_by: currentUser?.id || 'system',
        approved_by: currentUser?.id || 'system',
        createdAt: now,
        updatedAt: now
      };
      if (db.treasuryIncomes) {
        await db.treasuryIncomes.put(incRecord);
        pushTreasuryIncomeLive(incRecord).catch(console.warn);
        generatedIncomeId = incId;
      }
    } catch (err) {
      console.warn('[ChequeService] Auto-create treasury income error:', err);
    }
  }

  // 2. Update Cheque Status
  const updatedCheque = {
    ...cheque,
    status: CHEQUE_STATUSES.CLEARED,
    clearedDate,
    clearedAccountId,
    bankTrackingCode,
    bankDocumentNumber,
    linkedTransactionId: generatedIncomeId || cheque.linkedTransactionId || null,
    updatedAt: now
  };

  await db.cheques.put(updatedCheque);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-cheques-sync', { detail: { id } }));
    window.dispatchEvent(new CustomEvent('workshop-incomes-sync'));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  pushChequeLive(updatedCheque).catch(console.warn);

  return updatedCheque;
}

/**
 * Handles bouncing a cheque (برگشت زدن چک).
 */
export async function bounceCheque(id, bounceData = {}, currentUser = null) {
  if (!db.cheques) throw new Error('Cheques store not initialized');

  const cheque = await db.cheques.get(id);
  if (!cheque) throw new Error('Cheque not found');

  const now = new Date().toISOString();
  const updatedCheque = {
    ...cheque,
    status: CHEQUE_STATUSES.BOUNCED,
    bouncedDate: bounceData.bouncedDate || now.split('T')[0],
    bouncedReason: bounceData.bouncedReason || 'عدم موجودی کافی / مسدودی حساب',
    updatedAt: now
  };

  await db.cheques.put(updatedCheque);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-cheques-sync', { detail: { id } }));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  pushChequeLive(updatedCheque).catch(console.warn);

  return updatedCheque;
}

/**
 * Handles endorsing an inward cheque to another counterparty (خرج کردن یا واگذاری چک به غیر).
 */
export async function endorseCheque(id, endorseData = {}, currentUser = null) {
  if (!db.cheques) throw new Error('Cheques store not initialized');

  const cheque = await db.cheques.get(id);
  if (!cheque) throw new Error('Cheque not found');
  if (cheque.type !== 'inward') throw new Error('Only inward cheques can be endorsed');

  const now = new Date().toISOString();
  const updatedCheque = {
    ...cheque,
    status: CHEQUE_STATUSES.ENDORSED,
    endorsedToCounterpartyId: endorseData.endorsedToCounterpartyId || null,
    endorsedToName: endorseData.endorsedToName || '',
    endorsedDate: endorseData.endorsedDate || now.split('T')[0],
    endorsedNotes: endorseData.notes || '',
    updatedAt: now
  };

  await db.cheques.put(updatedCheque);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-cheques-sync', { detail: { id } }));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  pushChequeLive(updatedCheque).catch(console.warn);

  return updatedCheque;
}

/**
 * Handles voiding / canceling a cheque (ابطال چک).
 */
export async function voidCheque(id, voidData = {}, currentUser = null) {
  if (!db.cheques) throw new Error('Cheques store not initialized');

  const cheque = await db.cheques.get(id);
  if (!cheque) throw new Error('Cheque not found');

  const now = new Date().toISOString();
  const updatedCheque = {
    ...cheque,
    status: CHEQUE_STATUSES.VOID,
    voidDate: voidData.voidDate || now.split('T')[0],
    voidReason: voidData.voidReason || 'اشتباه در صدور یا ابطال توافقی',
    updatedAt: now
  };

  await db.cheques.put(updatedCheque);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-cheques-sync', { detail: { id } }));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  pushChequeLive(updatedCheque).catch(console.warn);

  return updatedCheque;
}

// ----------------------------------------------------------------------
// Chequebook Management (مدیریت دسته‌چک‌های کارگاه)
// ----------------------------------------------------------------------

export async function createChequebook(data, currentUser = null) {
  if (!db.chequebooks) throw new Error('Chequebooks store not initialized');

  const projectId = data.projectId || DEFAULT_PROJECT_ID;
  const now = new Date().toISOString();
  const id = generateChequebookId();

  const totalLeaves = Number(data.totalLeaves) || 25;
  const startSerial = Number(data.startSerial) || 1;
  const endSerial = Number(data.endSerial) || (startSerial + totalLeaves - 1);

  const bookRecord = {
    id,
    projectId,
    bankAccountId: data.bankAccountId,
    bankName: data.bankName || '',
    accountNumber: data.accountNumber || '',
    sayadSeries: data.sayadSeries || '',
    startSerial,
    endSerial,
    totalLeaves,
    usedLeaves: 0,
    status: 'active',
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now
  };

  await db.chequebooks.put(bookRecord);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-chequebooks-sync', { detail: { id } }));
  }

  pushChequebookLive(bookRecord).catch(console.warn);

  return bookRecord;
}

export async function updateChequebook(id, updates) {
  if (!db.chequebooks) return;
  const existing = await db.chequebooks.get(id);
  if (!existing) return;

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    ...updates,
    updatedAt: now
  };

  await db.chequebooks.put(updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-chequebooks-sync', { detail: { id } }));
  }

  pushChequebookLive(updated).catch(console.warn);
  return updated;
}

export async function deleteChequebook(id) {
  if (!db.chequebooks) return;
  await db.chequebooks.delete(id);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-chequebooks-sync', { detail: { id, deleted: true } }));
  }

  deleteChequebookLive(id).catch(console.warn);
}
