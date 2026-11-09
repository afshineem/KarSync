import { db, generateContractId, generateExpenseId, generateGroupId, generateId, DEFAULT_PROJECT_ID } from '../db/db';
import { pushContractLive, deleteContractLive, pushPaymentsLive, pushGroupLive, pushWorkerLive } from './realtimeSync';
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
  { id: 'man_day', fa: 'نفر-روز کارگری (روزمزد)', ku: 'ڕۆژ-کرێکار (دەستحەق)', en: 'Man-Day (Day Labor)' },
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

/**
 * Automatically provision or synchronize a Counterparty with a Worker profile and Crew Group.
 * Ensures the craftsman exists both as a Counterparty and as a Team Master in Workers,
 * allowing their temporary crew to be registered under their Group.
 */
export async function syncCounterpartyCrewWorker({
  counterpartyId,
  name,
  phone = "",
  projectId = DEFAULT_PROJECT_ID,
  existingLinkedWorkerId = null,
  existingLinkedGroupId = null,
  dailyRate = 0
}) {
  if (!db.counterparties || !db.workers || !db.groups) {
    throw new Error("Database stores not available");
  }

  let groupId = existingLinkedGroupId;
  let workerId = existingLinkedWorkerId;

  // 1. Group resolution
  if (groupId) {
    const existingGroup = await db.groups.get(groupId);
    if (existingGroup) {
      const updatedGroup = {
        ...existingGroup,
        name: `اکیپ ${name}`.trim(),
        updatedAt: new Date().toISOString()
      };
      await pushGroupLive(updatedGroup);
    } else {
      groupId = null;
    }
  }

  if (!groupId) {
    groupId = generateGroupId();
    const newGroup = {
      id: groupId,
      projectId: projectId || DEFAULT_PROJECT_ID,
      name: `اکیپ ${name}`.trim(),
      deductFoodExpense: false,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await pushGroupLive(newGroup);
  }

  // 2. Worker resolution (Master / Leader of this crew)
  if (workerId) {
    const existingWorker = await db.workers.get(workerId);
    if (existingWorker) {
      const updatedWorker = {
        ...existingWorker,
        name: name.trim(),
        phone: (phone || existingWorker.phone || "").trim(),
        groupId,
        counterpartyId,
        teamRole: "Master",
        role: existingWorker.role || "استادکار / سرگروه",
        dailyRate: Number(dailyRate) || existingWorker.dailyRate || 0,
        updatedAt: new Date().toISOString()
      };
      await pushWorkerLive(updatedWorker);
    } else {
      workerId = null;
    }
  }

  if (!workerId) {
    workerId = generateId();
    const newWorker = {
      id: workerId,
      projectId: projectId || DEFAULT_PROJECT_ID,
      userId: "local_user",
      name: name.trim(),
      phone: (phone || "").trim(),
      role: "استادکار / سرگروه",
      teamRole: "Master",
      groupId,
      counterpartyId,
      wageType: "standard",
      dailyRate: Number(dailyRate) || 0,
      monthlySalary: 0,
      monthlyLeaveDays: 0,
      leavePolicy: "standard",
      bonusLeaveDays: 0,
      fridayRateMultiplier: 1,
      overtimeHourlyRate: 0,
      defaultSectionId: null,
      isActive: 1,
      isGlobal: false,
      isTemporary: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await pushWorkerLive(newWorker);
  }

  return { linkedWorkerId: workerId, linkedGroupId: groupId };
}

/**
 * Aggregates all daily attendance records (attendanceLogs) for the contractor crew/group
 * across the specified contract period. Returns total man-days, overtime hours, and total wage.
 */
export async function getContractCrewAttendanceSummary({
  contract,
  startDate = null,
  endDate = null
}) {
  if (!contract || !db.attendanceLogs) {
    return {
      totalDays: 0,
      masterDays: 0,
      workerDays: 0,
      totalOvertimeHours: 0,
      masterGrossWage: 0,
      workerGrossWage: 0,
      totalGrossWage: 0,
      crewWorkers: [],
      masterWorkers: [],
      generalWorkers: [],
      workerBreakdown: [],
      logs: [],
      matchingManDayIndex: -1,
      linkedGroupId: null,
      linkedWorkerId: null
    };
  }

  const projectId = contract.projectId || DEFAULT_PROJECT_ID;
  
  // 3.1: Calculate strictly from contract.startDate onwards (never pull old history prior to contract start)
  const start = startDate || contract.startDate || null;
  const end = endDate || (contract.status === 'completed' ? contract.actualEndDate : null);

  // 1. Resolve linked counterparty and group with resilient fallbacks
  let linkedGroupId = contract.linkedGroupId || null;
  let linkedWorkerId = null;
  let counterparty = null;

  if (contract.counterpartyId && db.counterparties) {
    const allCp = await db.counterparties.toArray();
    counterparty = allCp.find(c => String(c.id) === String(contract.counterpartyId)) || null;
    if (counterparty) {
      linkedGroupId = linkedGroupId || counterparty.linkedGroupId || null;
      linkedWorkerId = counterparty.linkedWorkerId || null;
    }
  }

  const allWorkers = db.workers ? await db.workers.toArray() : [];

  // If counterparty has linkedWorkerId, verify if that worker has groupId
  if (linkedWorkerId && !linkedGroupId) {
    const masterW = allWorkers.find(w => String(w.id) === String(linkedWorkerId));
    if (masterW?.groupId) linkedGroupId = masterW.groupId;
  }

  // What if contract.counterpartyId directly matches a worker ID?
  if (!linkedWorkerId) {
    const directWorker = allWorkers.find(w => String(w.id) === String(contract.counterpartyId));
    if (directWorker) {
      linkedWorkerId = directWorker.id;
      if (directWorker.groupId) linkedGroupId = linkedGroupId || directWorker.groupId;
    }
  }

  // Fallback match: match group by name containing counterparty name (e.g. "اکیپ فریدون" or "وهستا فریدون")
  if (!linkedGroupId && (counterparty?.name || contract.counterpartyName) && db.groups) {
    const cpName = (counterparty?.name || contract.counterpartyName || '').trim().toLowerCase();
    const allGroups = await db.groups.toArray();
    const matchedGroup = allGroups.find(g => {
      const gName = (g.name || '').trim().toLowerCase();
      return gName.includes(cpName) || cpName.includes(gName.replace('اکیپ', '').trim());
    });
    if (matchedGroup) linkedGroupId = matchedGroup.id;
  }

  // Also check if any worker matches counterparty name
  if (!linkedWorkerId && (counterparty?.name || contract.counterpartyName)) {
    const cpName = (counterparty?.name || contract.counterpartyName || '').trim().toLowerCase();
    const matchedW = allWorkers.find(w => {
      const wName = (w.name || '').trim().toLowerCase();
      return wName.includes(cpName) || cpName.includes(wName);
    });
    if (matchedW) {
      linkedWorkerId = matchedW.id;
      if (!linkedGroupId && matchedW.groupId) linkedGroupId = matchedW.groupId;
    }
  }

  // 3.3: Find only active workers in this project belonging to this crew
  const crewWorkers = allWorkers.filter(w => {
    if (w.deletedAt || w.isActive === 0) return false;
    // Worker matches linked group
    if (linkedGroupId && String(w.groupId) === String(linkedGroupId)) return true;
    // Worker matches counterparty ID
    if (contract.counterpartyId && String(w.counterpartyId) === String(contract.counterpartyId)) return true;
    // Worker matches master worker ID
    if (linkedWorkerId && String(w.id) === String(linkedWorkerId)) return true;
    return false;
  });

  const matchingManDayIndex = (contract.items || []).findIndex(it => it.unit === "man_day");

  if (crewWorkers.length === 0) {
    return {
      totalDays: 0,
      masterDays: 0,
      workerDays: 0,
      totalOvertimeHours: 0,
      masterGrossWage: 0,
      workerGrossWage: 0,
      totalGrossWage: 0,
      crewWorkers: [],
      masterWorkers: [],
      generalWorkers: [],
      workerBreakdown: [],
      logs: [],
      matchingManDayIndex,
      linkedGroupId,
      linkedWorkerId
    };
  }

  const crewWorkerIds = new Set(crewWorkers.map(w => String(w.id)));
  const crewWorkerMap = new Map(crewWorkers.map(w => [String(w.id), w]));

  // 3. Query attendance logs with strict zero-leakage conditions:
  // 3.1: date >= start (strictly from contract start date onwards)
  // 3.2: ONLY UNSETTLED LOGS (!l.isSettled and !l.settlementReceiptId)
  const allLogs = db.attendanceLogs ? await db.attendanceLogs.toArray() : [];
  const relevantLogs = allLogs.filter(l => {
    if (l.deletedAt) return false;
    if (!crewWorkerIds.has(String(l.workerId))) return false;
    if (l.projectId && contract.projectId && l.projectId !== contract.projectId && contract.projectId !== DEFAULT_PROJECT_ID) {
      return false;
    }
    // 3.1: Strictly from contract start date
    if (start && l.date && l.date < start) return false;
    // Upper bound if set
    if (end && l.date && l.date > end) return false;
    // 3.2: Filter out settled logs
    if (l.isSettled || l.settlementReceiptId) return false;
    return true;
  });

  let totalDays = 0;
  let masterDays = 0;
  let workerDays = 0;
  let totalOvertimeHours = 0;
  let masterGrossWage = 0;
  let workerGrossWage = 0;
  let totalGrossWage = 0;

  const workerBreakdown = new Map();
  crewWorkers.forEach(w => {
    workerBreakdown.set(String(w.id), {
      worker: w,
      isMaster: w.teamRole === 'Master' || w.role?.includes('استادکار') || w.role?.includes('وەستا'),
      daysCount: 0,
      overtimeHours: 0,
      grossWage: 0,
      logsCount: 0
    });
  });

  relevantLogs.forEach(l => {
    const w = crewWorkerMap.get(String(l.workerId));
    if (!w) return;

    let dayWeight = 1.0;
    if (l.type === "half") dayWeight = 0.5;
    else if (l.type === "hourly") {
      const h = Number(l.overtimeHours) || Number(l.hours) || 0;
      dayWeight = Math.round((h / 8) * 100) / 100;
    } else if (l.type === "absent") {
      dayWeight = 0;
    }

    const otHours = Math.max(0, Number(l.overtimeHours) || 0);
    const wDaily = Number(String(w.dailyRate).replace(/,/g, "")) || 0;
    const wOtRate = Number(String(w.overtimeHourlyRate).replace(/,/g, "")) || 0;

    let logPay = Number(l.totalDayPay);
    if (isNaN(logPay) || logPay <= 0) {
      if (l.type === "half") logPay = (wDaily * 0.5) + (otHours * wOtRate);
      else if (l.type === "hourly") logPay = otHours * (wOtRate || (wDaily / 8));
      else if (l.type === "absent") logPay = 0;
      else logPay = wDaily + (otHours * wOtRate);
    }

    const isMaster = w.teamRole === 'Master' || w.role?.includes('استادکار') || w.role?.includes('وەستا');

    totalDays += dayWeight;
    if (isMaster) {
      masterDays += dayWeight;
      masterGrossWage += logPay;
    } else {
      workerDays += dayWeight;
      workerGrossWage += logPay;
    }

    totalOvertimeHours += otHours;
    totalGrossWage += logPay;

    const b = workerBreakdown.get(String(w.id));
    if (b) {
      b.daysCount += dayWeight;
      b.overtimeHours += otHours;
      b.grossWage += logPay;
      b.logsCount += 1;
    }
  });

  const masterWorkers = crewWorkers.filter(w => w.teamRole === 'Master' || w.role?.includes('استادکار') || w.role?.includes('وەستا'));
  const generalWorkers = crewWorkers.filter(w => !masterWorkers.some(mw => mw.id === w.id));

  return {
    totalDays: Math.round(totalDays * 10) / 10,
    masterDays: Math.round(masterDays * 10) / 10,
    workerDays: Math.round(workerDays * 10) / 10,
    totalOvertimeHours,
    masterGrossWage,
    workerGrossWage,
    totalGrossWage,
    crewWorkers,
    masterWorkers,
    generalWorkers,
    workerBreakdown: Array.from(workerBreakdown.values()),
    logs: relevantLogs,
    matchingManDayIndex,
    linkedGroupId,
    linkedWorkerId
  };
}

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
  let itemsToProcess = (completedItems.length > 0 ? completedItems : contract.items || []);

  // If crewAttendanceMode is man_day_item, ensure man_day item uses crew totalDays
  if (crewAttendanceMode === man_day_item && crewAttendanceSummary?.totalDays !== undefined) {
    const manDayIdx = itemsToProcess.findIndex(it => it.unit === man_day);
    if (manDayIdx !== -1) {
      itemsToProcess = itemsToProcess.map((it, idx) => {
        if (idx === manDayIdx) {
          return { ...it, finalQuantity: crewAttendanceSummary.totalDays };
        }
        return it;
      });
    }
  }

  const finalizedItems = itemsToProcess.map((it) => {
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

  // If crewAttendanceMode is extra_gross_wage, add crew wages directly to gross work
  let crewGrossWageAddition = 0;
  if (crewAttendanceMode === extra_gross_wage && crewAttendanceSummary?.totalGrossWage) {
    crewGrossWageAddition = Number(crewAttendanceSummary.totalGrossWage) || 0;
    grossWorkAmount += crewGrossWageAddition;
  }

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
    crewGrossWageAddition,
    crewAttendanceSummary,
    crewAttendanceMode,
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
