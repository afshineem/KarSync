import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  db, 
  approveRecord as dbApproveRecord, 
  batchApproveRecords as dbBatchApproveRecords,
  amendRecord as dbAmendRecord,
  assertRecordMutable,
  isRecordApproved,
  canDeleteWorker
} from '../db/db';
import { 
  pushExpenseLive, 
  pushPaymentsLive, 
  pushLogsLive,
  pushAccountTransferLive,
  pushAllAccountTransfersToCloud,
  pushTreasuryIncomeLive,
  pushAllTreasuryIncomesToCloud
} from '../services/realtimeSync';

/**
 * useTwoStageApproval
 * هوک اختصاصی سیستم تایید دو مرحله‌ای (پیش‌نویس / تایید نهایی)، تایید گروهی و صدور اصلاحیه
 */
export function useTwoStageApproval() {
  const { user, isAdmin, setUserRole } = useAuth();
  const currentRole = user?.role || null;

  /**
   * آیا سند قابل ویرایش و حذف است؟
   * اسناد در وضعیت 'approved' قفل بوده و تغییرناپذیر هستند.
   */
  const canModifyRecord = useCallback((record) => {
    if (!record) return true;
    const isApproved = record.status === 'approved' || record.approval_status === 'approved';
    return !isApproved;
  }, []);

  /**
   * آیا کاربر جاری دسترسی تایید اسناد یا صدور اصلاحیه را دارد؟
   * تنها کاربران لاگین‌شده با نقش 'admin' مجاز به تایید نهایی و صدور اصلاحیه هستند.
   */
  const canApprove = Boolean(user && (isAdmin || currentRole === 'admin'));

  /**
   * تایید نهایی سند و تغییر وضعیت از پیش‌نویس (draft) به تایید شده (approved)
   * 
   * @param {string} tableName - 'expenses' | 'payments' | 'attendanceLogs' | 'treasuryIncomes' | 'accountTransfers'
   * @param {string} recordId - شناسه سند
   * @returns {Promise<object>} سند به‌روزرسانی شده
   */
  const approveRecord = useCallback(async (tableName, recordId) => {
    if (!canApprove || !user) {
      const err = new Error('تنها کاربران دارای نقش «مدیر ارشد (Admin)» مجاز به تایید نهایی اسناد هستند.');
      err.statusCode = 403;
      err.code = 'ROLE_UNAUTHORIZED';
      throw err;
    }

    const cleanRecordId = tableName === 'accountTransfers'
      ? String(recordId).replace(/_(in|out)$/, '')
      : recordId;

    const updated = await dbApproveRecord(tableName, cleanRecordId, user);

    try {
      if (tableName === 'expenses') {
        await pushExpenseLive(updated);
        window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
      } else if (tableName === 'payments') {
        await pushPaymentsLive();
        window.dispatchEvent(new CustomEvent('workshop-payments-sync'));
      } else if (tableName === 'attendanceLogs') {
        await pushLogsLive();
        window.dispatchEvent(new CustomEvent('workshop-logs-sync'));
      } else if (tableName === 'accountTransfers') {
        await pushAccountTransferLive(updated);
        window.dispatchEvent(new CustomEvent('workshop-transfers-sync'));
      } else if (tableName === 'treasuryIncomes') {
        await pushTreasuryIncomeLive(updated);
        window.dispatchEvent(new CustomEvent('workshop-incomes-sync'));
      }
      window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
    } catch (cloudErr) {
      console.warn('Realtime cloud sync deferred after approval:', cloudErr);
    }

    return updated;
  }, [canApprove, user]);

  /**
   * تایید نهایی گروهی اسناد (Batch / Bulk Approval)
   * @param {Array<{ tableName: string, recordId: string | number }>} items
   */
  const batchApproveRecords = useCallback(async (items) => {
    if (!canApprove || !user) {
      const err = new Error('تنها کاربران دارای نقش «مدیر ارشد (Admin)» مجاز به تایید نهایی اسناد هستند.');
      err.statusCode = 403;
      err.code = 'ROLE_UNAUTHORIZED';
      throw err;
    }

    const results = await dbBatchApproveRecords(items, user);

    try {
      await Promise.allSettled([
        pushPaymentsLive(),
        pushAllAccountTransfersToCloud(),
        pushAllTreasuryIncomesToCloud()
      ]);
      window.dispatchEvent(new CustomEvent('workshop-payments-sync'));
      window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
      window.dispatchEvent(new CustomEvent('workshop-transfers-sync'));
      window.dispatchEvent(new CustomEvent('workshop-incomes-sync'));
      window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
    } catch (cloudErr) {
      console.warn('Realtime cloud sync deferred after batch approval:', cloudErr);
    }

    return results;
  }, [canApprove, user]);

  /**
   * صدور سند اصلاحیه برای سند تایید شده (Amendment / Adjustment)
   * @param {string} tableName - 'payments' | 'expenses' | 'treasuryIncomes' | 'accountTransfers'
   * @param {string|number} recordId
   * @param {object} amendmentData - { amount, reason, notes, date }
   */
  const amendRecord = useCallback(async (tableName, recordId, amendmentData) => {
    if (!canApprove || !user) {
      const err = new Error('تنها کاربران دارای نقش «مدیر ارشد (Admin)» مجاز به صدور اصلاحیه اسناد هستند.');
      err.statusCode = 403;
      err.code = 'ROLE_UNAUTHORIZED';
      throw err;
    }

    const cleanRecordId = tableName === 'accountTransfers'
      ? String(recordId).replace(/_(in|out)$/, '')
      : recordId;

    const updated = await dbAmendRecord(tableName, cleanRecordId, amendmentData, user);

    try {
      if (tableName === 'expenses') {
        await pushExpenseLive(updated);
        window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
      } else if (tableName === 'payments') {
        await pushPaymentsLive();
        window.dispatchEvent(new CustomEvent('workshop-payments-sync'));
      } else if (tableName === 'accountTransfers') {
        await pushAccountTransferLive(updated);
        window.dispatchEvent(new CustomEvent('workshop-transfers-sync'));
      } else if (tableName === 'treasuryIncomes') {
        await pushTreasuryIncomeLive(updated);
        window.dispatchEvent(new CustomEvent('workshop-incomes-sync'));
      }
      window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
    } catch (cloudErr) {
      console.warn('Realtime cloud sync deferred after amendment:', cloudErr);
    }

    return updated;
  }, [canApprove, user]);

  return {
    user,
    currentRole,
    isAdmin: canApprove,
    canApprove,
    canModifyRecord,
    assertRecordMutable,
    isRecordApproved,
    canDeleteWorker,
    approveRecord,
    batchApproveRecords,
    amendRecord,
    setUserRole
  };
}

export default useTwoStageApproval;
