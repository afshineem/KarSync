import { db, generateContractId, generateExpenseId, DEFAULT_PROJECT_ID } from '../db/db';
import { pushContractLive, deleteContractLive, pushPaymentsLive } from './realtimeSync';
import { generateNextVoucherNumber } from './voucherNumberService';

/**
 * contractService.js
 * Comprehensive business logic and lifecycle management for construction contracts,
 * master craftsman agreements, site backcharges, delay penalties, and final measurement settlements.
 */

export const WORK_ITEM_UNITS = [
  { id: 'm2', fa: 'متر مربع (m²)', ku: 'مەتری چوارگۆشە (m²)', en: 'Sq. Meter (m²)' },
  { id: 'm1', fa: 'متر طول (m)', ku: 'مەتری درێژی (m)', en: 'Linear Meter (m)' },
  { id: 'm3', fa: 'متر مکعب (m³)', ku: 'مەتری سێجا (m³)', en: 'Cubic Meter (m³)' },
  { id: 'item', fa: 'عدد / شعله / سقف', ku: 'دانە / سەقف', en: 'Item / Piece' },
  { id: 'man_day', fa: 'نفر-روز کارگری', ku: 'ڕۆژ-کرێکار', en: 'Man-Day' },
  { id: 'lump_sum', fa: 'مقطوع / کلی', ku: 'سەرجەم / قەتعی', en: 'Lump Sum' }
];

export const BACKCHARGE_CATEGORIES = [
  { id: 'food', fa: 'غذا و پذیرایی اکیپ', ku: 'خواردن و میوانداری', en: 'Food & Catering' },
  { id: 'lodging', fa: 'اسکان و خوابگاه پرسنل', ku: 'شوێنی حەوانەوە و مانەوە', en: 'Lodging & Accommodation' },
  { id: 'transport', fa: 'ایاب و ذهاب و ترابری', ku: 'هاتوچۆ و گواستنەوە', en: 'Transportation & Commute' },
  { id: 'tools', fa: 'اجاره ابزارآلات و ماشین‌آلات', ku: 'کرێی ئامێر و کەلوپەل', en: 'Tools & Machinery Rental' },
  { id: 'utilities', fa: 'آب، برق و مصرفی کارگاه', ku: 'ئاو و کارەبای کارگە', en: 'Utilities (Water/Electricity)' },
  { id: 'other', fa: 'سایر کسورات و خسارت مصالح', ku: 'بڕینەکانی تر و زیانی کەرەستە', en: 'Other Backcharges & Damages' }
];

/**
 * Generate sequential human-readable contract number (e.g. CTR-2026-001)
 */
export async function generateNextContractNumber(projectId = DEFAULT_PROJECT_ID) {
  if (!db.contracts) return `CTR-${Date.now().toString().slice(-4)}`;
  const year = new Date().getFullYear();
  const allContracts = await db.contracts.toArray();
  const projectContracts = allContracts.filter(c => !c.deletedAt && (!c.projectId || c.projectId === projectId || projectId === DEFAULT_PROJECT_ID));
  const currentCount = projectContracts.length + 1;
  return `CTR-${year}-${String(currentCount).padStart(3, '0')}`;
}

/**
 * Create a new construction contract
 */
export async function createContract(contractData, userId = null) {
  if (!db.contracts) throw new Error('Contracts store not initialized in database');

  const id = generateContractId();
  const contractNumber = contractData.contractNumber || await generateNextContractNumber(contractData.projectId);

  // Compute estimated total from items
  const items = Array.isArray(contractData.items) ? contractData.items : [];
  const totalEstimatedAmount = items.reduce((sum, it) => {
    const qty = Number(it.estimatedQuantity) || 0;
    const rate = Number(it.unitPrice) || 0;
    return sum + (qty * rate);
  }, 0);

  const newContract = {
    id,
    projectId: contractData.projectId || DEFAULT_PROJECT_ID,
    contractNumber,
    title: String(contractData.title || '').trim(),
    counterpartyId: contractData.counterpartyId || '',
    type: contractData.type || 'subcontractor', // 'subcontractor' | 'master_craftsman' | 'employer' | 'supplier'
    status: contractData.status || 'active', // 'draft' | 'active' | 'completed' | 'terminated'
    startDate: contractData.startDate || new Date().toISOString().slice(0, 10),
    estimatedEndDate: contractData.estimatedEndDate || '',
    actualEndDate: null,
    delayPenaltyPerDay: Number(contractData.delayPenaltyPerDay) || 0,
    items,
    // Expenses commitments (e.g. food/lodging borne by contractor vs workshop)
    backchargeCommitments: contractData.backchargeCommitments || {
      food: 'contractor', // 'contractor' | 'workshop'
      lodging: 'contractor',
      transport: 'contractor',
      tools: 'workshop'
    },
    terms: contractData.terms || '',
    notes: contractData.notes || '',
    totalEstimatedAmount,
    finalPayableAmount: null,
    voucherId: null,
    settlementDetails: null,
    attachments: contractData.attachments || [],
    created_by: userId || 'local_user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.contracts.put(newContract);
  pushContractLive(newContract).catch(console.warn);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-contracts-sync', { detail: { id, type: 'create' } }));
  }

  return newContract;
}

/**
 * Update existing contract
 */
export async function updateContract(id, updates) {
  if (!db.contracts) throw new Error('Contracts store not initialized');
  const existing = await db.contracts.get(id);
  if (!existing) throw new Error(`Contract ${id} not found`);

  let totalEstimatedAmount = existing.totalEstimatedAmount;
  if (updates.items) {
    totalEstimatedAmount = updates.items.reduce((sum, it) => {
      const qty = Number(it.estimatedQuantity) || 0;
      const rate = Number(it.unitPrice) || 0;
      return sum + (qty * rate);
    }, 0);
  }

  const updatedRecord = {
    ...existing,
    ...updates,
    totalEstimatedAmount,
    updatedAt: new Date().toISOString()
  };

  await db.contracts.put(updatedRecord);
  pushContractLive(updatedRecord).catch(console.warn);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-contracts-sync', { detail: { id, type: 'update' } }));
  }

  return updatedRecord;
}

/**
 * Soft delete contract
 */
export async function deleteContract(id) {
  if (!db.contracts) return;
  const existing = await db.contracts.get(id);
  if (!existing) return;

  const updated = {
    ...existing,
    status: 'deleted',
    deletedAt: new Date().toISOString()
  };

  await db.contracts.put(updated);
  deleteContractLive(id).catch(console.warn);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-contracts-sync', { detail: { id, deleted: true } }));
  }
}

/**
 * Calculate delay days between estimated end date and actual completion date
 */
export function calculateDelayDays(estimatedEndDate, actualEndDate) {
  if (!estimatedEndDate || !actualEndDate) return 0;
  const est = new Date(estimatedEndDate);
  const act = new Date(actualEndDate);
  if (isNaN(est.getTime()) || isNaN(act.getTime())) return 0;

  const diffTime = act.getTime() - est.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Transparent calculation of final settlement
 */
export function calculateContractSettlement({
  contract,
  completedItems = [],
  actualEndDate = '',
  selectedAdvances = [], // Array of payment objects
  selectedBackcharges = [], // Array of expense objects tagged to contractor
  extraDeductions = [] // Array of { title, amount }
}) {
  // 1. Gross Work Amount
  let grossWorkAmount = 0;
  const finalizedItems = (completedItems.length > 0 ? completedItems : contract.items || []).map((it) => {
    const qty = Number(it.finalQuantity !== undefined ? it.finalQuantity : it.estimatedQuantity) || 0;
    const rate = Number(it.unitPrice) || 0;
    const itemTotal = qty * rate;
    grossWorkAmount += itemTotal;
    return {
      ...it,
      finalQuantity: qty,
      finalAmount: itemTotal
    };
  });

  // 2. Delay Days & Penalty
  const delayDays = calculateDelayDays(contract.estimatedEndDate, actualEndDate || new Date().toISOString().slice(0, 10));
  const dailyPenalty = Number(contract.delayPenaltyPerDay) || 0;
  const totalDelayPenalty = delayDays * dailyPenalty;

  // 3. Advances & Prepayments
  const totalAdvances = selectedAdvances.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // 4. Contractor-borne site expenses (food, lodging, transport)
  const totalBackcharges = selectedBackcharges.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // 5. Extra manual deductions (damages, etc.)
  const totalExtraDeductions = extraDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // 6. Net Payable
  const totalDeductions = totalDelayPenalty + totalAdvances + totalBackcharges + totalExtraDeductions;
  const netPayableAmount = Math.max(0, grossWorkAmount - totalDeductions);

  return {
    grossWorkAmount,
    delayDays,
    dailyPenalty,
    totalDelayPenalty,
    totalAdvances,
    selectedAdvances,
    totalBackcharges,
    selectedBackcharges,
    totalExtraDeductions,
    extraDeductions,
    totalDeductions,
    netPayableAmount,
    finalizedItems
  };
}

/**
 * Finalize contract settlement, generate Draft Accounting Voucher, and complete contract
 */
export async function finalizeAndSubmitContractSettlement({
  contractId,
  actualEndDate,
  settlementCalculation,
  userId = null,
  currency = 'IQD'
}) {
  if (!db.contracts || !db.expenses) throw new Error('Stores not initialized');
  const contract = await db.contracts.get(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found`);

  const projectId = contract.projectId || DEFAULT_PROJECT_ID;
  const now = new Date().toISOString();

  // 1. Generate unique Draft Voucher Number
  const voucherNumber = await generateNextVoucherNumber({
    projectId,
    type: 'contract_settlement',
    date: actualEndDate || now.slice(0, 10)
  });

  // 2. Construct detailed narrative for the accounting voucher
  const itemsSummary = settlementCalculation.finalizedItems
    .map(it => `• ${it.title}: ${it.finalQuantity} ${it.unit} × ${it.unitPrice} = ${it.finalAmount}`)
    .join('\n');

  const deductionsSummary = [
    settlementCalculation.totalDelayPenalty > 0 ? `• جریمه ${settlementCalculation.delayDays} روز تاخیر: ${settlementCalculation.totalDelayPenalty}` : null,
    settlementCalculation.totalAdvances > 0 ? `• کسر پیش‌پرداخت‌ها و علی‌الحساب: ${settlementCalculation.totalAdvances}` : null,
    settlementCalculation.totalBackcharges > 0 ? `• کسر هزینه‌های اسکان/غذا/ترابری پای پیمانکار: ${settlementCalculation.totalBackcharges}` : null,
    settlementCalculation.totalExtraDeductions > 0 ? `• سایر کسورات و خسارات: ${settlementCalculation.totalExtraDeductions}` : null
  ].filter(Boolean).join('\n');

  const voucherDescription = `صورت‌وضعیت قطعی پایان کار قرارداد: ${contract.title} (${contract.contractNumber})\n` +
    `طرف‌حساب: ${contract.counterpartyName || 'پیمانکار'}\n` +
    `مجموع کارکرد ناخالص: ${settlementCalculation.grossWorkAmount}\n` +
    (deductionsSummary ? `کسورات:\n${deductionsSummary}\n` : '') +
    `خالص قابل پرداخت: ${settlementCalculation.netPayableAmount}\n` +
    `ریز متره احجام اجرا شده:\n${itemsSummary}`;

  // 3. Create Draft Expense in Accounting
  const expenseId = generateExpenseId();
  const draftExpenseRecord = {
    id: expenseId,
    projectId,
    title: `صورت‌وضعیت قطعی قرارداد: ${contract.title}`,
    description: voucherDescription,
    amount: settlementCalculation.netPayableAmount,
    currency,
    expenseDate: actualEndDate || now.slice(0, 10),
    personId: contract.counterpartyId || null,
    counterpartyId: contract.counterpartyId || null,
    contractId: contract.id,
    paymentStatus: 'unpaid',
    status: 'draft', // DRAFT VOUCHER: Needs review/approval in Accounting
    approval_status: 'draft',
    voucherNumber,
    isContractSettlement: true,
    settlementData: {
      contractId: contract.id,
      grossWorkAmount: settlementCalculation.grossWorkAmount,
      totalDelayPenalty: settlementCalculation.totalDelayPenalty,
      totalAdvances: settlementCalculation.totalAdvances,
      totalBackcharges: settlementCalculation.totalBackcharges,
      totalExtraDeductions: settlementCalculation.totalExtraDeductions,
      netPayableAmount: settlementCalculation.netPayableAmount
    },
    created_by: userId || 'local_user',
    createdAt: now,
    updatedAt: now
  };

  await db.expenses.put(draftExpenseRecord);

  // 4. Update Contract status to 'completed'
  const updatedContract = {
    ...contract,
    status: 'completed',
    actualEndDate: actualEndDate || now.slice(0, 10),
    finalPayableAmount: settlementCalculation.netPayableAmount,
    voucherId: expenseId,
    voucherNumber,
    settlementDetails: settlementCalculation,
    items: settlementCalculation.finalizedItems,
    updatedAt: now
  };

  await db.contracts.put(updatedContract);
  pushContractLive(updatedContract).catch(console.warn);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-contracts-sync', { detail: { id: contractId, type: 'completed' } }));
    window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  return {
    contract: updatedContract,
    draftExpense: draftExpenseRecord
  };
}
