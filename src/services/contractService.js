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
    // Performance & Social Security Insurance Retentions (سپرده حسن انجام کار و بیمه)
    retentionPolicy: contractData.retentionPolicy || {
      deductRetention: false,
      retentionRate: 5, // percentage e.g. 5% or 10%
      deductInsurance: false,
      insuranceRate: 5  // percentage e.g. 5%
    },
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
 * Calculate timeline progress, duration metrics, and status for a contract
 */
export function getContractTimelineProgress(contract, todayStr, language = 'fa') {
  if (!contract) return null;
  const isCompleted = contract.status === 'completed';

  if (isCompleted) {
    return {
      percent: 100,
      totalDays: 0,
      elapsedDays: 0,
      remainingDays: 0,
      status: 'completed',
      isOverdue: false,
      delayDays: 0,
      label: language === 'ku' ? 'تەواوکراو' : language === 'en' ? 'Completed' : 'تکمیل‌شده',
      sublabel: contract.actualEndDate || '',
      colorClass: 'bg-teal-500',
      badgeClass: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border border-teal-500/20'
    };
  }

  const { startDate, estimatedEndDate } = contract;
  if (!estimatedEndDate) {
    return {
      percent: 0,
      totalDays: 0,
      elapsedDays: 0,
      remainingDays: 0,
      status: 'no_deadline',
      isOverdue: false,
      delayDays: 0,
      label: language === 'ku' ? 'بێ وادەی دیاریکراو' : language === 'en' ? 'No deadline' : 'بدون مهلت مشخص',
      sublabel: '',
      colorClass: 'bg-slate-300 dark:bg-slate-700',
      badgeClass: 'text-slate-500 bg-slate-100 dark:bg-slate-800'
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const end = new Date(estimatedEndDate + 'T00:00:00');
  const today = new Date(todayStr + 'T00:00:00');
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;

  // Overdue check
  if (today > end) {
    const delayDays = Math.ceil((today.getTime() - end.getTime()) / msPerDay);
    return {
      percent: 100,
      totalDays: start ? Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay)) : 0,
      elapsedDays: start ? Math.max(1, Math.round((today.getTime() - start.getTime()) / msPerDay)) : delayDays,
      remainingDays: 0,
      status: 'overdue',
      isOverdue: true,
      delayDays,
      label: language === 'ku' ? `${delayDays} ڕۆژ دواکەوتن` : language === 'en' ? `${delayDays} days overdue` : `${delayDays} روز تاخیر`,
      sublabel: language === 'ku' ? 'وادە بەسەرچووە' : language === 'en' ? 'Deadline passed' : 'مهلت پایان یافته',
      colorClass: 'bg-rose-500',
      badgeClass: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20'
    };
  }

  // Upcoming check
  if (start && today < start) {
    const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / msPerDay);
    return {
      percent: 0,
      totalDays: Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay)),
      elapsedDays: 0,
      remainingDays: Math.max(1, Math.round((end.getTime() - today.getTime()) / msPerDay)),
      status: 'upcoming',
      isOverdue: false,
      delayDays: 0,
      label: language === 'ku' ? `${daysUntilStart} ڕۆژ تا دەستپێک` : language === 'en' ? `Starts in ${daysUntilStart} days` : `${daysUntilStart} روز تا شروع`,
      sublabel: startDate,
      colorClass: 'bg-sky-400',
      badgeClass: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border border-sky-500/20'
    };
  }

  // Active in progress:
  const effectiveStart = (start && start <= end) ? start : new Date(today.getTime() - 1 * msPerDay);
  const totalDays = Math.max(1, Math.round((end.getTime() - effectiveStart.getTime()) / msPerDay));
  const elapsedDays = Math.max(0, Math.round((today.getTime() - effectiveStart.getTime()) / msPerDay));
  const remainingDays = Math.max(0, Math.round((end.getTime() - today.getTime()) / msPerDay));

  const rawPercent = Math.round((elapsedDays / totalDays) * 100);
  const percent = Math.min(100, Math.max(1, rawPercent));

  let colorClass = 'bg-primary';
  let badgeClass = 'text-primary bg-primary/10 border border-primary/20';

  if (remainingDays <= 2 || percent >= 85) {
    colorClass = 'bg-amber-500';
    badgeClass = 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20';
  }

  const label = language === 'ku'
    ? `${remainingDays} ڕۆژ ماوە`
    : language === 'en'
    ? `${remainingDays} ${remainingDays === 1 ? 'day' : 'days'} left`
    : `${remainingDays} روز مانده`;

  const sublabel = language === 'ku'
    ? `(${elapsedDays} لە ${totalDays} ڕۆژ)`
    : language === 'en'
    ? `(${elapsedDays} of ${totalDays} days)`
    : `(${elapsedDays} از ${totalDays} روز)`;

  return {
    percent,
    totalDays,
    elapsedDays,
    remainingDays,
    status: 'active',
    isOverdue: false,
    delayDays: 0,
    label,
    sublabel,
    colorClass,
    badgeClass
  };
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

/**
 * Get detailed progress of all settlements (interim and final) recorded for a contract
 */
export function getContractSettlementProgress(contract) {
  if (!contract) return null;
  const settlements = Array.isArray(contract.settlements) ? contract.settlements : [];

  const previouslyDeductedAdvanceIds = new Set();
  const previouslyDeductedBackchargeIds = new Set();
  const itemSettledMap = new Map();

  let totalSettledGross = 0;
  let totalSettledNet = 0;
  let totalSettledDeductions = 0;

  settlements.forEach(s => {
    (s.selectedAdvanceIds || []).forEach(id => previouslyDeductedAdvanceIds.add(String(id)));
    (s.selectedBackchargeIds || []).forEach(id => previouslyDeductedBackchargeIds.add(String(id)));

    totalSettledGross += Number(s.grossWorkAmount) || 0;
    totalSettledNet += Number(s.netPayableAmount) || 0;
    totalSettledDeductions += Number(s.totalDeductions) || 0;

    (s.finalizedItems || s.itemsBreakdown || []).forEach(it => {
      const key = it.id || it.title;
      const qty = Number(it.incrementalQuantity !== undefined ? it.incrementalQuantity : it.finalQuantity) || 0;
      itemSettledMap.set(key, (itemSettledMap.get(key) || 0) + qty);
    });
  });

  const itemsProgress = (contract.items || []).map(it => {
    const key = it.id || it.title;
    const contractedQty = Number(it.estimatedQuantity) || 0;
    const settledQty = itemSettledMap.get(key) || 0;
    const remainingQty = Math.max(0, contractedQty - settledQty);
    const percent = contractedQty > 0 ? Math.min(100, Math.round((settledQty / contractedQty) * 100)) : 0;
    return {
      ...it,
      contractedQty,
      settledQty,
      remainingQty,
      percent
    };
  });

  const totalEstimatedAmount = Number(contract.totalEstimatedAmount) || 0;
  const financialPercent = totalEstimatedAmount > 0
    ? Math.min(100, Math.round((totalSettledGross / totalEstimatedAmount) * 100))
    : 0;

  return {
    settlements,
    settlementsCount: settlements.length,
    interimCount: settlements.filter(s => s.settlementType === 'interim').length,
    previouslyDeductedAdvanceIds,
    previouslyDeductedBackchargeIds,
    itemSettledMap,
    itemsProgress,
    totalSettledGross,
    totalSettledNet,
    totalSettledDeductions,
    financialPercent
  };
}

/**
 * Add an amendment (الحاقیه / متمم قرارداد) to increase scope, adjust rates or extend deadline
 */
export async function addContractAmendment({
  contractId,
  amendmentData,
  userId = null
}) {
  if (!db.contracts) throw new Error('Contracts store not initialized');
  const contract = await db.contracts.get(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found`);

  const now = new Date().toISOString();
  const amendments = Array.isArray(contract.amendments) ? [...contract.amendments] : [];
  const amendmentNumber = amendments.length + 1;

  const updatedItems = Array.isArray(amendmentData.items) ? amendmentData.items : (contract.items || []);
  const newTotalEstimatedAmount = updatedItems.reduce((sum, it) => {
    const qty = Number(it.estimatedQuantity) || 0;
    const rate = Number(it.unitPrice) || 0;
    return sum + (qty * rate);
  }, 0);

  const previousTotalEstimatedAmount = Number(contract.totalEstimatedAmount) || 0;
  const differenceAmount = newTotalEstimatedAmount - previousTotalEstimatedAmount;

  const amendmentRecord = {
    id: `amd_${Date.now()}`,
    amendmentNumber,
    date: amendmentData.date || now.slice(0, 10),
    title: String(amendmentData.title || `الحاقیه شماره ${amendmentNumber}`).trim(),
    notes: String(amendmentData.notes || '').trim(),
    previousEstimatedEndDate: contract.estimatedEndDate || null,
    newEstimatedEndDate: amendmentData.estimatedEndDate || contract.estimatedEndDate || null,
    previousTotalEstimatedAmount,
    newTotalEstimatedAmount,
    differenceAmount,
    itemsSnapshot: updatedItems,
    createdAt: now,
    created_by: userId || 'local_user'
  };

  amendments.push(amendmentRecord);

  const updatedContract = {
    ...contract,
    items: updatedItems,
    totalEstimatedAmount: newTotalEstimatedAmount,
    estimatedEndDate: amendmentData.estimatedEndDate || contract.estimatedEndDate,
    amendments,
    updatedAt: now
  };

  await db.contracts.put(updatedContract);
  pushContractLive(updatedContract).catch(console.warn);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-contracts-sync', { detail: { id: contractId, type: 'amendment' } }));
  }

  return {
    contract: updatedContract,
    amendment: amendmentRecord
  };
}

/**
 * Calculate contract settlement amounts (supports both Interim progressive and Final settlement)
 */
export function calculateContractSettlement({
  contract,
  completedItems = [],
  actualEndDate = '',
  selectedAdvances = [], // Array of payment objects
  selectedBackcharges = [], // Array of expense objects tagged to contractor
  extraDeductions = [], // Array of { title, amount }
  crewAttendanceSummary = null,
  crewAttendanceMode = 'none', // 'man_day_item' | 'extra_gross_wage' | 'none'
  settlementType = 'interim', // 'interim' | 'final'
  applyDelayPenalty = false
}) {
  const isInterim = settlementType === 'interim';
  const progress = getContractSettlementProgress(contract);
  const previouslySettledMap = progress?.itemSettledMap || new Map();

  // 1. Gross Work Amount
  let grossWorkAmount = 0;
  let itemsToProcess = (completedItems.length > 0 ? completedItems : contract.items || []);

  // If crewAttendanceMode is man_day_item, ensure man_day item uses crew totalDays
  if (crewAttendanceMode === 'man_day_item' && crewAttendanceSummary?.totalDays !== undefined) {
    const manDayIdx = itemsToProcess.findIndex(it => it.unit === 'man_day');
    if (manDayIdx !== -1) {
      itemsToProcess = itemsToProcess.map((it, idx) => {
        if (idx === manDayIdx) {
          return { ...it, incrementalQuantity: crewAttendanceSummary.totalDays };
        }
        return it;
      });
    }
  }

  const finalizedItems = itemsToProcess.map((it) => {
    const key = it.id || it.title;
    const settledBefore = previouslySettledMap.get(key) || 0;
    const contractedQty = Number(it.estimatedQuantity) || 0;
    const rate = Number(it.unitPrice) || 0;

    let incrementalQty = 0;
    let cumulativeQty = 0;

    if (it.incrementalQuantity !== undefined && it.incrementalQuantity !== '') {
      incrementalQty = Number(it.incrementalQuantity) || 0;
      cumulativeQty = settledBefore + incrementalQty;
    } else if (it.finalQuantity !== undefined && it.finalQuantity !== '') {
      cumulativeQty = Number(it.finalQuantity) || 0;
      incrementalQty = Math.max(0, cumulativeQty - settledBefore);
    } else {
      const rem = Math.max(0, contractedQty - settledBefore);
      incrementalQty = rem;
      cumulativeQty = settledBefore + incrementalQty;
    }

    const itemTotal = incrementalQty * rate;
    grossWorkAmount += itemTotal;

    return {
      ...it,
      settledQuantityBefore: settledBefore,
      incrementalQuantity: incrementalQty,
      cumulativeQuantity: cumulativeQty,
      finalQuantity: cumulativeQty,
      finalAmount: itemTotal
    };
  });

  // If crewAttendanceMode is extra_gross_wage, add crew wages directly to gross work
  let crewGrossWageAddition = 0;
  if (crewAttendanceMode === 'extra_gross_wage' && crewAttendanceSummary?.totalGrossWage) {
    crewGrossWageAddition = Number(crewAttendanceSummary.totalGrossWage) || 0;
    grossWorkAmount += crewGrossWageAddition;
  }

  // 2. Delay Days & Penalty (usually 0 in interim progress billing unless explicitly enabled)
  let delayDays = 0;
  let dailyPenalty = 0;
  let totalDelayPenalty = 0;

  if (!isInterim || applyDelayPenalty) {
    delayDays = calculateDelayDays(contract.estimatedEndDate, actualEndDate || new Date().toISOString().slice(0, 10));
    dailyPenalty = Number(contract.delayPenaltyPerDay) || 0;
    totalDelayPenalty = delayDays * dailyPenalty;
  }

  // 3. Advances & Prepayments
  const totalAdvances = selectedAdvances.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // 4. Contractor-borne site expenses (food, lodging, transport)
  const totalBackcharges = selectedBackcharges.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // 5. Extra manual deductions (damages, etc.)
  const totalExtraDeductions = extraDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // 6. Contract Retention (سپرده حسن انجام کار) & Insurance Retention (سپرده بیمه ماده ۳۸)
  const retentionPolicy = contract.retentionPolicy || {};
  let retentionAmount = 0;
  let insuranceAmount = 0;

  if (retentionPolicy.deductRetention && Number(retentionPolicy.retentionRate) > 0) {
    retentionAmount = Math.round((grossWorkAmount * (Number(retentionPolicy.retentionRate) / 100)) * 100) / 100;
  }

  if (retentionPolicy.deductInsurance && Number(retentionPolicy.insuranceRate) > 0) {
    insuranceAmount = Math.round((grossWorkAmount * (Number(retentionPolicy.insuranceRate) / 100)) * 100) / 100;
  }

  // 7. Net Payable
  const totalDeductions = totalDelayPenalty + totalAdvances + totalBackcharges + totalExtraDeductions + retentionAmount + insuranceAmount;
  const netPayableAmount = Math.max(0, grossWorkAmount - totalDeductions);

  return {
    settlementType,
    isInterim,
    grossWorkAmount,
    crewGrossWageAddition,
    crewAttendanceSummary,
    crewAttendanceMode,
    delayDays,
    dailyPenalty,
    totalDelayPenalty,
    retentionAmount,
    insuranceAmount,
    retentionRate: Number(retentionPolicy.retentionRate) || 5,
    insuranceRate: Number(retentionPolicy.insuranceRate) || 5,
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
 * Submit contract settlement (Interim progress billing or Final completion settlement)
 * and generate corresponding Draft Accounting Voucher
 */
export async function finalizeAndSubmitContractSettlement({
  contractId,
  actualEndDate,
  settlementCalculation,
  settlementType = 'interim',
  stageNotes = '',
  userId = null,
  currency = 'IQD'
}) {
  if (!db.contracts || !db.expenses) throw new Error('Stores not initialized');
  const contract = await db.contracts.get(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found`);

  const projectId = contract.projectId || DEFAULT_PROJECT_ID;
  const now = new Date().toISOString();
  const dateStr = actualEndDate || now.slice(0, 10);
  const isInterim = settlementType === 'interim';

  const priorSettlements = Array.isArray(contract.settlements) ? [...contract.settlements] : [];
  const stageNumber = priorSettlements.length + 1;

  // 1. Generate unique Draft Voucher Number
  const voucherNumber = await generateNextVoucherNumber({
    projectId,
    type: 'contract_settlement',
    date: dateStr
  });

  // 2. Construct detailed narrative for the accounting voucher
  const itemsSummary = settlementCalculation.finalizedItems
    .map(it => `• ${it.title}: ${it.incrementalQuantity} ${it.unit} (مجموع تا الان: ${it.cumulativeQuantity}) × ${it.unitPrice} = ${it.finalAmount}`)
    .join('\n');

  const deductionsSummary = [
    settlementCalculation.totalDelayPenalty > 0 ? `• جریمه ${settlementCalculation.delayDays} روز تاخیر: ${settlementCalculation.totalDelayPenalty}` : null,
    settlementCalculation.retentionAmount > 0 ? `• کسر سپرده حسن انجام کار (${settlementCalculation.retentionRate}%): ${settlementCalculation.retentionAmount} [معین ۳۴۰۱]` : null,
    settlementCalculation.insuranceAmount > 0 ? `• کسر سپرده بیمه ماده ۳۸ (${settlementCalculation.insuranceRate}%): ${settlementCalculation.insuranceAmount} [معین ۳۴۰۲]` : null,
    settlementCalculation.totalAdvances > 0 ? `• کسر پیش‌پرداخت‌ها و علی‌الحساب: ${settlementCalculation.totalAdvances} [معین ۱۵۰۱]` : null,
    settlementCalculation.totalBackcharges > 0 ? `• کسر هزینه‌های اسکان/غذا/ترابری پای پیمانکار: ${settlementCalculation.totalBackcharges}` : null,
    settlementCalculation.totalExtraDeductions > 0 ? `• سایر کسورات و خسارات: ${settlementCalculation.totalExtraDeductions}` : null
  ].filter(Boolean).join('\n');

  const titlePrefix = isInterim
    ? `صورت‌وضعیت موقت شماره ${stageNumber}`
    : `صورت‌وضعیت قطعی پایان کار`;

  const voucherDescription = `${titlePrefix} قرارداد: ${contract.title} (${contract.contractNumber})\n` +
    `طرف‌حساب: ${contract.counterpartyName || 'پیمانکار'}\n` +
    (stageNotes ? `یادداشت و شرایط مرحله: ${stageNotes}\n` : '') +
    `مجموع کارکرد ناخالص این مرحله: ${settlementCalculation.grossWorkAmount}\n` +
    (deductionsSummary ? `کسورات این مرحله:\n${deductionsSummary}\n` : '') +
    `خالص قابل پرداخت این مرحله: ${settlementCalculation.netPayableAmount}\n` +
    `ریز متره احجام این مرحله:\n${itemsSummary}`;

  // 3. Create Draft Expense in Accounting
  const expenseId = generateExpenseId();
  const draftExpenseRecord = {
    id: expenseId,
    projectId,
    title: `${titlePrefix} قرارداد: ${contract.title}`,
    description: voucherDescription,
    amount: settlementCalculation.netPayableAmount,
    currency,
    expenseDate: dateStr,
    personId: contract.counterpartyId || null,
    counterpartyId: contract.counterpartyId || null,
    contractId: contract.id,
    paymentStatus: 'unpaid',
    status: 'draft',
    approval_status: 'draft',
    voucherNumber,
    isContractSettlement: true,
    isInterimSettlement: isInterim,
    settlementNumber: stageNumber,
    settlementData: {
      contractId: contract.id,
      stageNumber,
      settlementType,
      grossWorkAmount: settlementCalculation.grossWorkAmount,
      totalDelayPenalty: settlementCalculation.totalDelayPenalty,
      retentionAmount: settlementCalculation.retentionAmount || 0,
      insuranceAmount: settlementCalculation.insuranceAmount || 0,
      retentionRate: settlementCalculation.retentionRate || 5,
      insuranceRate: settlementCalculation.insuranceRate || 5,
      retentionSubCode: '3401',
      insuranceSubCode: '3402',
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

  // 4. Construct settlement record to append to contract.settlements
  const settlementRecord = {
    id: `stl_${Date.now()}`,
    settlementNumber: stageNumber,
    settlementType,
    date: dateStr,
    title: titlePrefix,
    notes: stageNotes,
    finalizedItems: settlementCalculation.finalizedItems,
    grossWorkAmount: settlementCalculation.grossWorkAmount,
    crewGrossWageAddition: settlementCalculation.crewGrossWageAddition || 0,
    totalDelayPenalty: settlementCalculation.totalDelayPenalty,
    delayDays: settlementCalculation.delayDays || 0,
    retentionAmount: settlementCalculation.retentionAmount || 0,
    insuranceAmount: settlementCalculation.insuranceAmount || 0,
    retentionRate: settlementCalculation.retentionRate || 5,
    insuranceRate: settlementCalculation.insuranceRate || 5,
    totalAdvances: settlementCalculation.totalAdvances,
    selectedAdvanceIds: (settlementCalculation.selectedAdvances || []).map(a => a.id),
    totalBackcharges: settlementCalculation.totalBackcharges,
    selectedBackchargeIds: (settlementCalculation.selectedBackcharges || []).map(b => b.id),
    totalExtraDeductions: settlementCalculation.totalExtraDeductions,
    extraDeductions: settlementCalculation.extraDeductions || [],
    totalDeductions: settlementCalculation.totalDeductions,
    netPayableAmount: settlementCalculation.netPayableAmount,
    voucherId: expenseId,
    voucherNumber,
    createdAt: now
  };

  priorSettlements.push(settlementRecord);

  // 5. Update Contract record in database
  let updatedContract;
  if (isInterim) {
    updatedContract = {
      ...contract,
      status: 'active', // remains active!
      lastSettlementDate: dateStr,
      lastSettlementNumber: stageNumber,
      settlements: priorSettlements,
      updatedAt: now
    };
  } else {
    updatedContract = {
      ...contract,
      status: 'completed',
      actualEndDate: dateStr,
      finalPayableAmount: settlementCalculation.netPayableAmount,
      voucherId: expenseId,
      voucherNumber,
      settlementDetails: settlementCalculation,
      settlements: priorSettlements,
      updatedAt: now
    };
  }

  await db.contracts.put(updatedContract);
  pushContractLive(updatedContract).catch(console.warn);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop-contracts-sync', {
      detail: { id: contractId, type: isInterim ? 'interim_settlement' : 'completed' }
    }));
    window.dispatchEvent(new CustomEvent('workshop-expenses-sync'));
    window.dispatchEvent(new CustomEvent('karsync:accounting-sync'));
  }

  return {
    contract: updatedContract,
    draftExpense: draftExpenseRecord,
    settlementRecord
  };
}
