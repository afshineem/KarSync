import { db, generateFinancialYearId, DEFAULT_PROJECT_ID } from '../db/db';

/**
 * Standard Astronomical Jalali to Gregorian converter
 */
export function jalaliToGregorian(jy, jm, jd) {
  jy = Number(jy);
  jm = Number(jm);
  jd = Number(jd);
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return {
    gy,
    gm,
    gd,
    dateString: `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
  };
}

/**
 * Standard Astronomical Gregorian to Jalali converter
 */
export function gregorianToJalali(gy, gm, gd) {
  gy = Number(gy);
  gm = Number(gm);
  gd = Number(gd);
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return {
    jy,
    jm,
    jd,
    dateString: `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`
  };
}

/**
 * Generate quick presets for financial years
 */
export function getPresetFinancialYear(year, calendarType = 'jalali') {
  if (calendarType === 'jalali') {
    const y = Number(year);
    // Is Jalali leap year? Standard 33-year cycle leap rule
    const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes((y % 33));
    const lastDay = isLeap ? 30 : 29;
    const startG = jalaliToGregorian(y, 1, 1);
    const endG = jalaliToGregorian(y, 12, lastDay);
    return {
      title: `سال مالی ${y}`,
      title_ku: `ساڵی دارایی ${y}`,
      title_en: `Fiscal Year ${y}`,
      calendarType: 'jalali',
      startDate: startG.dateString,
      endDate: endG.dateString,
      startDisplay: `${y}/01/01`,
      endDisplay: `${y}/12/${lastDay}`
    };
  } else {
    const y = Number(year);
    return {
      title: `سال مالی ${y}`,
      title_ku: `ساڵی دارایی ${y}`,
      title_en: `Fiscal Year ${y}`,
      calendarType: 'gregorian',
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
      startDisplay: `${y}/01/01`,
      endDisplay: `${y}/12/31`
    };
  }
}

/**
 * Fetch financial years for a project (Pure read-only operation safe for useLiveQuery)
 */
export async function getFinancialYears(projectId = DEFAULT_PROJECT_ID) {
  if (!db.financialYears) return [];
  const years = await db.financialYears
    .where('projectId')
    .equals(projectId)
    .toArray();

  return years.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
}

/**
 * Get active default financial year for a project
 */
export async function getActiveFinancialYear(projectId = DEFAULT_PROJECT_ID) {
  if (!db.financialYears) return null;
  const list = await db.financialYears
    .where('projectId')
    .equals(projectId)
    .toArray();

  if (list.length === 0) return null;
  const defaultYear = list.find(y => y.isDefault);
  if (defaultYear) return defaultYear;

  // Fallback to latest open year or latest overall
  const openYear = list.find(y => y.status === 'open');
  return openYear || list[0];
}

/**
 * Seed initial financial years if none exist (Must be called outside useLiveQuery)
 */
export async function ensureDefaultFinancialYears(projectId = DEFAULT_PROJECT_ID) {
  if (!db.financialYears) return [];
  const count = await db.financialYears
    .where('projectId')
    .equals(projectId)
    .count();

  if (count > 0) return [];

  const now = new Date();
  const currentGYear = now.getFullYear();
  const currentJ = gregorianToJalali(currentGYear, now.getMonth() + 1, now.getDate());
  const currentJYear = currentJ.jy;

  // Create both Shamsi and Gregorian standard years
  const shamsiPreset = getPresetFinancialYear(currentJYear, 'jalali');
  const gregorianPreset = getPresetFinancialYear(currentGYear, 'gregorian');

  const nowIso = now.toISOString();

  const initialRecords = [
    {
      id: generateFinancialYearId(),
      projectId,
      title: shamsiPreset.title,
      title_ku: shamsiPreset.title_ku,
      title_en: shamsiPreset.title_en,
      calendarType: 'jalali',
      startDate: shamsiPreset.startDate,
      endDate: shamsiPreset.endDate,
      startDisplay: shamsiPreset.startDisplay,
      endDisplay: shamsiPreset.endDisplay,
      status: 'open',
      isDefault: true,
      description: 'سال مالی جاری کارگاه (تقویم هجری شمسی)',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: generateFinancialYearId(),
      projectId,
      title: gregorianPreset.title,
      title_ku: gregorianPreset.title_ku,
      title_en: gregorianPreset.title_en,
      calendarType: 'gregorian',
      startDate: gregorianPreset.startDate,
      endDate: gregorianPreset.endDate,
      startDisplay: gregorianPreset.startDisplay,
      endDisplay: gregorianPreset.endDisplay,
      status: 'open',
      isDefault: false,
      description: 'دوره مالی بر مبنای تقویم استاندارد بین‌المللی میلادی',
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];

  await db.financialYears.bulkPut(initialRecords);
  return initialRecords;
}

/**
 * Create a new Financial Year
 */
export async function createFinancialYear(data = {}) {
  if (!db.financialYears) throw new Error('Financial years store not available');
  const {
    projectId = DEFAULT_PROJECT_ID,
    title,
    title_ku,
    title_en,
    calendarType = 'jalali',
    startDate,
    endDate,
    startDisplay,
    endDisplay,
    description = '',
    isDefault = false
  } = data;

  if (!title || !startDate || !endDate) {
    throw new Error('Title, start date, and end date are required');
  }

  if (endDate < startDate) {
    throw new Error('End date must be greater than or equal to start date');
  }

  const now = new Date().toISOString();
  const id = generateFinancialYearId();

  if (isDefault) {
    // Unset current default
    const currentDefaults = await db.financialYears
      .where('projectId')
      .equals(projectId)
      .filter(y => y.isDefault)
      .toArray();

    for (const y of currentDefaults) {
      await db.financialYears.update(y.id, { isDefault: false, updatedAt: now });
    }
  }

  const record = {
    id,
    projectId,
    title: title.trim(),
    title_ku: (title_ku || title).trim(),
    title_en: (title_en || title).trim(),
    calendarType,
    startDate,
    endDate,
    startDisplay: startDisplay || startDate,
    endDisplay: endDisplay || endDate,
    status: 'open',
    isDefault: Boolean(isDefault),
    description: description.trim(),
    createdAt: now,
    updatedAt: now
  };

  await db.financialYears.add(record);
  return record;
}

/**
 * Update an existing Financial Year
 */
export async function updateFinancialYear(id, updates = {}) {
  if (!db.financialYears) throw new Error('Financial years store not available');
  const existing = await db.financialYears.get(id);
  if (!existing) throw new Error('Financial year not found');

  const now = new Date().toISOString();
  const safeUpdates = {
    ...updates,
    updatedAt: now
  };

  // If changing to default, unset other defaults in the same project
  if (updates.isDefault) {
    const currentDefaults = await db.financialYears
      .where('projectId')
      .equals(existing.projectId)
      .filter(y => y.isDefault && y.id !== id)
      .toArray();

    for (const y of currentDefaults) {
      await db.financialYears.update(y.id, { isDefault: false, updatedAt: now });
    }
  }

  await db.financialYears.update(id, safeUpdates);
  return { ...existing, ...safeUpdates };
}

/**
 * Set an active default financial year
 */
export async function setActiveFinancialYear(id, projectId = DEFAULT_PROJECT_ID) {
  if (!db.financialYears) throw new Error('Financial years store not available');
  const now = new Date().toISOString();

  const allYears = await db.financialYears
    .where('projectId')
    .equals(projectId)
    .toArray();

  for (const y of allYears) {
    const isTarget = y.id === id;
    if (y.isDefault !== isTarget) {
      await db.financialYears.update(y.id, { isDefault: isTarget, updatedAt: now });
    }
  }

  return true;
}

/**
 * Close a Financial Year and lock all historical transactions
 * Optionally initialize the next consecutive financial year immediately
 */
export async function closeFinancialYear(id, options = {}) {
  if (!db.financialYears) throw new Error('Financial years store not available');
  const existing = await db.financialYears.get(id);
  if (!existing) throw new Error('Financial year not found');

  if (existing.status === 'closed') {
    throw new Error('Financial year is already closed');
  }

  const now = new Date().toISOString();
  const {
    closingNotes = '',
    closedBy = 'مدیر مالی',
    initializeNextYear = false
  } = options;

  await db.financialYears.update(id, {
    status: 'closed',
    closedAt: now,
    closedBy,
    closingNotes,
    isDefault: false,
    updatedAt: now
  });

  let nextYearRecord = null;
  if (initializeNextYear) {
    // Determine next year
    let nextTitle = '';
    let nextStart = '';
    let nextEnd = '';
    let nextStartDisp = '';
    let nextEndDisp = '';

    if (existing.calendarType === 'jalali') {
      const match = existing.startDisplay.match(/(\d{4})/);
      const currentYearNum = match ? Number(match[1]) : 1404;
      const nextYearNum = currentYearNum + 1;
      const preset = getPresetFinancialYear(nextYearNum, 'jalali');
      nextTitle = preset.title;
      nextStart = preset.startDate;
      nextEnd = preset.endDate;
      nextStartDisp = preset.startDisplay;
      nextEndDisp = preset.endDisplay;
    } else {
      const currentYearNum = Number(existing.startDate.split('-')[0]) || 2026;
      const nextYearNum = currentYearNum + 1;
      const preset = getPresetFinancialYear(nextYearNum, 'gregorian');
      nextTitle = preset.title;
      nextStart = preset.startDate;
      nextEnd = preset.endDate;
      nextStartDisp = preset.startDisplay;
      nextEndDisp = preset.endDisplay;
    }

    nextYearRecord = await createFinancialYear({
      projectId: existing.projectId,
      title: nextTitle,
      title_ku: nextTitle,
      title_en: nextTitle,
      calendarType: existing.calendarType,
      startDate: nextStart,
      endDate: nextEnd,
      startDisplay: nextStartDisp,
      endDisplay: nextEndDisp,
      description: `سال مالی جدید بازگشایی‌شده پس از بستن قطعی ${existing.title}`,
      isDefault: true
    });
  }

  return { closedYearId: id, nextYear: nextYearRecord };
}

/**
 * Reopen a previously closed Financial Year
 */
export async function reopenFinancialYear(id, options = {}) {
  if (!db.financialYears) throw new Error('Financial years store not available');
  const existing = await db.financialYears.get(id);
  if (!existing) throw new Error('Financial year not found');

  const now = new Date().toISOString();
  const { reopenNotes = '', reopenedBy = 'مدیر سیستم' } = options;

  await db.financialYears.update(id, {
    status: 'open',
    reopenedAt: now,
    reopenedBy,
    reopenNotes,
    updatedAt: now
  });

  return { id, status: 'open' };
}

/**
 * Delete a Financial Year (Only allowed if no transactions exist in the range)
 */
export async function deleteFinancialYear(id) {
  if (!db.financialYears) throw new Error('Financial years store not available');
  const existing = await db.financialYears.get(id);
  if (!existing) return true;

  if (existing.status === 'closed') {
    throw new Error('Closed financial years cannot be deleted for audit and accounting integrity');
  }

  await db.financialYears.delete(id);
  return true;
}

/**
 * Guard check: Verify if a given transaction date falls inside a CLOSED financial year
 */
export async function isDateInClosedFinancialYear(dateStr, projectId = DEFAULT_PROJECT_ID) {
  if (!dateStr || !db.financialYears) return { isClosed: false };

  const closedYears = await db.financialYears
    .where('projectId')
    .equals(projectId)
    .filter(y => y.status === 'closed')
    .toArray();

  for (const y of closedYears) {
    if (dateStr >= y.startDate && dateStr <= y.endDate) {
      return {
        isClosed: true,
        financialYear: y,
        reason: `این تاریخ در محدوده سال مالی بسته شده «${y.title}» (${y.startDisplay} تا ${y.endDisplay}) قرار دارد و امکان ثبت یا ویرایش اسناد در آن قفل شده است.`
      };
    }
  }

  return { isClosed: false };
}
