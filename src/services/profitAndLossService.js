/**
 * profitAndLossService.js
 * موتور جامع محاسبات صورت سود و زیان (P&L) کارگاه و پروژه در کارسینک
 * 
 * اهداف و استانداردهای حسابداری صنعتی/پیمانکاری:
 * ۱. درآمد عملیاتی ناخالص: دریافتی‌ها از کارفرما، صورت‌وضعیت‌ها، درآمدهای خدمات و فروش ضایعات
 * ۲. بهای تمام‌شده مستقیم (COGS): دستمزد پرسنل (تعهدی یا نقدی)، مصالح، ماشین‌آلات، پیمانکاران جزء
 * ۳. سود (زیان) ناخالص (Gross Profit / Loss)
 * ۴. هزینه‌های سربار، اداری، اسکان، پذیرایی و HSE کارگاه
 * ۵. هزینه‌های قانونی و مالی: حق بیمه کارگاه/پیمان، انواع مالیات و کارمزد بانکی
 * ۶. سود (زیان) خالص نهایی (Net Profit / Loss) و درصد حاشیه سود (Profit Margin)
 */

import { roundCurrency } from '../utils/formatters';

/**
 * بررسی تطابق تاریخ با فیلتر زمانی
 */
export function matchesPnLDate(dateStr, dateFilter = {}) {
  if (!dateStr) return false;
  const cleanDate = String(dateStr).slice(0, 10);
  const { mode = 'all', startDate, endDate, selectedMonth } = dateFilter;

  if (mode === 'month' || mode === 'this_month') {
    if (!selectedMonth) return true;
    return cleanDate.startsWith(selectedMonth);
  }
  if (mode === 'custom') {
    if (startDate && cleanDate < startDate) return false;
    if (endDate && cleanDate > endDate) return false;
    return true;
  }
  return true; // 'all'
}

/**
 * تشخیص هوشمند دسته سرفصل هزینه برای طبقه‌بندی در صورت مالی
 * خروجی: 'cogs_material' | 'cogs_equipment' | 'cogs_subcontractor' | 'overhead' | 'insurance' | 'tax' | 'financial' | 'general'
 */
export function classifyExpenseCategory(expense, categoryTree = []) {
  const catName = String(expense.category || expense.categoryName || expense.title || '').toLowerCase();
  const desc = String(expense.description || '').toLowerCase();
  const code = String(expense.categoryCode || expense.code || '');

  // ۱. بررسی سرفصل‌های الزامی قانونی (بیمه و مالیات)
  if (
    catName.includes('بیمه') ||
    catName.includes('insurance') ||
    catName.includes('تامین اجتماعی') ||
    catName.includes('تأمین اجتماعی') ||
    desc.includes('حق بیمه')
  ) {
    return 'insurance';
  }

  if (
    catName.includes('مالیات') ||
    catName.includes('tax') ||
    catName.includes('دارایی') ||
    catName.includes('ارزش افزوده') ||
    (Number(expense.taxAmount) > 0 && !catName)
  ) {
    return 'tax';
  }

  if (
    catName.includes('کارمزد') ||
    catName.includes('بانکی') ||
    catName.includes('bank fee') ||
    catName.includes('بهره') ||
    catName.includes('جرایم تاخیر') ||
    catName.includes('پایا') ||
    catName.includes('ساتنا')
  ) {
    return 'financial';
  }

  // ۲. بررسی بر اساس کدهای استاندارد COA کارسینک
  if (code.startsWith('10') || code.startsWith('701')) return 'cogs_material';
  if (code.startsWith('20') || code.startsWith('704') || code.startsWith('706')) return 'cogs_equipment';
  if (code.startsWith('30') || code.startsWith('703')) return 'cogs_subcontractor';
  if (code.startsWith('40') || code.startsWith('705') || code.startsWith('80')) return 'overhead';

  // ۳. بررسی متنی هوشمند نام سرفصل
  if (
    catName.includes('مصالح') ||
    catName.includes('سیمان') ||
    catName.includes('آهن') ||
    catName.includes('میلگرد') ||
    catName.includes('بتن') ||
    catName.includes('آجر') ||
    catName.includes('گچ') ||
    catName.includes('ماسه') ||
    catName.includes('رنگ') ||
    catName.includes('لوله') ||
    catName.includes('چسب')
  ) {
    return 'cogs_material';
  }

  if (
    catName.includes('ماشین') ||
    catName.includes('جرثقیل') ||
    catName.includes('لودر') ||
    catName.includes('بیل مکانیکی') ||
    catName.includes('بالابر') ||
    catName.includes('ژنراتور') ||
    catName.includes('دستگاه') ||
    catName.includes('ابزار') ||
    catName.includes('سوخت') ||
    catName.includes('گازوئیل') ||
    catName.includes('کرایه')
  ) {
    return 'cogs_equipment';
  }

  if (
    catName.includes('پیمانکار') ||
    catName.includes('اکیپ') ||
    catName.includes('خدمات فنی') ||
    catName.includes('جوشکار') ||
    catName.includes('آزمایشگاه') ||
    catName.includes('نقشه‌برداری')
  ) {
    return 'cogs_subcontractor';
  }

  if (
    catName.includes('پذیرایی') ||
    catName.includes('غذا') ||
    catName.includes('چای') ||
    catName.includes('اسکان') ||
    catName.includes('کانکس') ||
    catName.includes('بهداشت') ||
    catName.includes('ایمنی') ||
    catName.includes('hse') ||
    catName.includes('اینترنت') ||
    catName.includes('اداری')
  ) {
    return 'overhead';
  }

  return 'cogs_material'; // پیش‌فرض برای سایر هزینه‌های کارگاهی، بهای مستقیم مصالح است
}

/**
 * محاسبه بهای کارکرد یک ردیف لاگ روزانه پرسنل
 */
export function calculateLogEarnedPay(log, workerMap) {
  if (!log) return 0;
  let val = Number(log.totalDayPay);
  if (!isNaN(val) && val > 0) return val;

  const worker = workerMap.get(String(log.workerId));
  if (!worker) return 0;

  const wDaily = Number(String(worker.dailyRate || 0).replace(/,/g, '')) || 0;
  const wOtRate = Number(String(worker.overtimeHourlyRate || 0).replace(/,/g, '')) || 0;
  const otH = Math.max(0, Number(log.overtimeHours) || 0);

  if (log.type === 'half') return (wDaily * 0.5) + (otH * wOtRate);
  if (log.type === 'hourly') return otH * (wOtRate || (wDaily / 8));
  if (log.type === 'absent') return 0;
  return wDaily + (otH * wOtRate);
}

/**
 * محاسبه گر اصلی صورت سود و زیان
 */
export function calculateProfitAndLoss({
  incomes = [],
  expenses = [],
  payments = [],
  attendanceLogs = [],
  workers = [],
  counterparties = [],
  currency = 'IQD',
  basis = 'realized', // 'realized' (تسویه قطعی و پرداخت‌های انجام‌شده) | 'accrual' (بر مبنای کل کارکرد ثبت‌شده)
  dateFilter = { mode: 'all' }
}) {
  const workerMap = new Map((workers || []).map((w) => [String(w.id), w]));
  const counterpartyMap = new Map((counterparties || []).map((c) => [String(c.id), c]));

  // ۱. فیلتر کردن درآمدها بر اساس تاریخ
  const filteredIncomes = (incomes || []).filter((inc) => {
    if (inc.deletedAt) return false;
    const d = inc.date || inc.createdAt;
    return matchesPnLDate(d, dateFilter);
  });

  // تفکیک درآمدهای کارفرما و متفرقه
  let employerInflow = 0;
  let scrapAndServiceInflow = 0;
  let otherInflow = 0;

  filteredIncomes.forEach((inc) => {
    const amt = Number(inc.amount) || 0;
    const cpt = inc.counterpartyId ? counterpartyMap.get(String(inc.counterpartyId)) : null;
    const isEmployer = (cpt && cpt.type === 'employer') || inc.sourceType === 'employer' || inc.category === 'progress_billing';
    const isScrap = inc.category === 'scrap_sale' || inc.category === 'service_income';

    if (isEmployer) {
      employerInflow += amt;
    } else if (isScrap) {
      scrapAndServiceInflow += amt;
    } else {
      otherInflow += amt;
    }
  });

  const totalRevenue = employerInflow + scrapAndServiceInflow + otherInflow;

  // ۲. محاسبه هزینه پرسنل و دستمزد بر اساس مبنای انتخابی
  let totalLaborCost = 0;
  let settlementsPaid = 0;
  let advancesPaid = 0;
  let bonusesPaid = 0;
  let accruedHoursTotal = 0;
  let accruedDaysTotal = 0;

  if (basis === 'realized') {
    // مبنای تسویه و پرداخت‌های قطعی (پایان کار یا مبالغ تحقق یافته)
    const filteredPayments = (payments || []).filter((p) => {
      if (p.deletedAt || p.status === 'deleted') return false;
      const d = p.date || p.createdAt;
      return matchesPnLDate(d, dateFilter);
    });

    filteredPayments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      if (p.type === 'advance' || p.type === 'Advance_Payment') {
        advancesPaid += amt;
        totalLaborCost += amt;
      } else if (p.type === 'bonus' || p.type === 'eid') {
        bonusesPaid += amt;
        totalLaborCost += amt;
      } else if (p.type === 'settlement' || p.type === 'Settlement' || p.status === 'settled' || p.isSettled) {
        settlementsPaid += amt;
        totalLaborCost += amt;
      } else if (p.type === 'loan' || p.type === 'loan_disbursement') {
        // وام پرسنل جزو دارایی کارگاه (مطالبات دریافتنی) است و هزینه قطعی پروژه نیست
      } else {
        settlementsPaid += amt;
        totalLaborCost += amt;
      }
    });
  } else {
    // مبنای تعهدی (پروژه در جریان - ارزش کل کارکرد شیفت‌ها)
    const filteredLogs = (attendanceLogs || []).filter((l) => {
      if (l.deletedAt) return false;
      return matchesPnLDate(l.date, dateFilter);
    });

    filteredLogs.forEach((l) => {
      const pay = calculateLogEarnedPay(l, workerMap);
      totalLaborCost += pay;

      if (l.type === 'full') accruedDaysTotal += 1;
      else if (l.type === 'half') accruedDaysTotal += 0.5;

      const otH = Number(l.overtimeHours) || 0;
      if (otH > 0) accruedHoursTotal += otH;
    });

    // پاداش‌ها و عیدی‌های ثبت شده نیز به تعهد اضافه می‌شوند
    const filteredBonuses = (payments || []).filter((p) => {
      if (p.deletedAt || p.status === 'deleted') return false;
      const d = p.date || p.createdAt;
      return matchesPnLDate(d, dateFilter) && (p.type === 'bonus' || p.type === 'eid');
    });

    filteredBonuses.forEach((b) => {
      const bAmt = Number(b.amount) || 0;
      bonusesPaid += bAmt;
      totalLaborCost += bAmt;
    });
  }

  // ۳. تفکیک هزینه‌های کارگاه (فاکتورها)
  const filteredExpenses = (expenses || []).filter((e) => {
    if (e.deletedAt) return false;
    const d = e.expenseDate || e.createdAt;
    return matchesPnLDate(d, dateFilter);
  });

  let directMaterialCost = 0;
  let directEquipmentCost = 0;
  let directSubcontractorCost = 0;
  let overheadCost = 0;
  let insuranceCost = 0;
  let taxCost = 0;
  let financialCost = 0;

  const classifiedExpenses = filteredExpenses.map((exp) => {
    const amt = Number(exp.amount) || 0;
    const classification = classifyExpenseCategory(exp);

    switch (classification) {
      case 'cogs_material':
        directMaterialCost += amt;
        break;
      case 'cogs_equipment':
        directEquipmentCost += amt;
        break;
      case 'cogs_subcontractor':
        directSubcontractorCost += amt;
        break;
      case 'overhead':
        overheadCost += amt;
        break;
      case 'insurance':
        insuranceCost += amt;
        break;
      case 'tax':
        taxCost += amt;
        break;
      case 'financial':
        financialCost += amt;
        break;
      default:
        directMaterialCost += amt;
        break;
    }

    return {
      ...exp,
      classification
    };
  });

  // ۴. محاسبات سود ناخالص
  const totalDirectMaterialAndEquip = directMaterialCost + directEquipmentCost + directSubcontractorCost;
  const totalDirectCOGS = totalLaborCost + totalDirectMaterialAndEquip;

  const grossProfit = totalRevenue - totalDirectCOGS;
  const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // ۵. محاسبات هزینه‌های سربار و کسورات قانونی و مالی
  const totalIndirectCosts = overheadCost + insuranceCost + taxCost + financialCost;

  // ۶. محاسبات سود خالص نهایی
  const netProfit = grossProfit - totalIndirectCosts;
  const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // نسبت بهای تمام شده به کل درآمد
  const cogsRatio = totalRevenue > 0 ? Math.round((totalDirectCOGS / totalRevenue) * 100) : 0;
  const laborRatio = totalRevenue > 0 ? Math.round((totalLaborCost / totalRevenue) * 100) : 0;
  const overheadRatio = totalRevenue > 0 ? Math.round((totalIndirectCosts / totalRevenue) * 100) : 0;

  return {
    basis,
    currency,
    dateFilter,

    // ۱. درآمدها
    revenues: {
      employerInflow: roundCurrency(employerInflow, currency),
      scrapAndServiceInflow: roundCurrency(scrapAndServiceInflow, currency),
      otherInflow: roundCurrency(otherInflow, currency),
      totalRevenue: roundCurrency(totalRevenue, currency),
      count: filteredIncomes.length
    },

    // ۲. بهای مستقیم نیروی کار
    labor: {
      totalLaborCost: roundCurrency(totalLaborCost, currency),
      settlementsPaid: roundCurrency(settlementsPaid, currency),
      advancesPaid: roundCurrency(advancesPaid, currency),
      bonusesPaid: roundCurrency(bonusesPaid, currency),
      accruedDaysTotal,
      accruedHoursTotal,
      laborRatio
    },

    // ۳. بهای مستقیم سایر اقلام (COGS)
    directCosts: {
      directMaterialCost: roundCurrency(directMaterialCost, currency),
      directEquipmentCost: roundCurrency(directEquipmentCost, currency),
      directSubcontractorCost: roundCurrency(directSubcontractorCost, currency),
      totalDirectMaterialAndEquip: roundCurrency(totalDirectMaterialAndEquip, currency),
      totalDirectCOGS: roundCurrency(totalDirectCOGS, currency),
      cogsRatio
    },

    // ۴. سود / زیان ناخالص
    grossProfit: {
      amount: roundCurrency(grossProfit, currency),
      marginPercent: Math.round(grossMarginPercent * 10) / 10,
      isPositive: grossProfit >= 0
    },

    // ۵. هزینه‌های اداری، سربار و قانونی
    indirectCosts: {
      overheadCost: roundCurrency(overheadCost, currency),
      insuranceCost: roundCurrency(insuranceCost, currency),
      taxCost: roundCurrency(taxCost, currency),
      financialCost: roundCurrency(financialCost, currency),
      totalIndirectCosts: roundCurrency(totalIndirectCosts, currency),
      overheadRatio
    },

    // ۶. سود / زیان خالص نهایی
    netProfit: {
      amount: roundCurrency(netProfit, currency),
      marginPercent: Math.round(netMarginPercent * 10) / 10,
      isPositive: netProfit >= 0
    },

    // خلاصه آماری فاکتورها
    expensesCount: filteredExpenses.length,
    classifiedExpenses
  };
}
