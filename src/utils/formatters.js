/**
 * Round Iraqi Dinars (IQD) to the nearest multiple of 250 (000, 250, 500, 750)
 * As per Iraqi cash circulation denominations.
 * e.g., 417,001 -> 417,000 | 417,198 -> 417,250 | 417,400 -> 417,500 | 417,650 -> 417,750
 * @param {number|string} amount
 * @returns {number}
 */
export function roundIQD(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  const num = Number(amount);
  const rounded = Math.round(num / 250) * 250;
  return Object.is(rounded, -0) || rounded === 0 ? 0 : rounded;
}

/**
 * Normalizes any variation of currency string to standard codes ('IQD' | 'IRT' | 'USD' | 'EUR')
 * Handles 'IRR', 'IRT', 'TOMAN', 'toman', 'تومان', 'تۆمەن' -> 'IRT'
 * Handles 'USD', '$', 'DOLLAR', 'دلار', 'دۆلار' -> 'USD'
 * Handles 'EUR', '€', 'EURO', 'یورو', 'یۆرۆ' -> 'EUR'
 * Handles 'IQD', 'DINAR', 'دینار', 'د.ع' -> 'IQD'
 */
export function normalizeCurrency(currency) {
  if (!currency) return 'IQD';
  const c = String(currency).trim().toUpperCase();
  if (c === 'IRT' || c === 'IRR' || c === 'TOMAN' || c === 'TOMANS' || c === 'تومان' || c === 'تۆمەن') {
    return 'IRT';
  }
  if (c === 'USD' || c === 'DOLLAR' || c === 'DOLLARS' || c === '$' || c === 'دلار' || c === 'دۆلار') {
    return 'USD';
  }
  if (c === 'EUR' || c === 'EURO' || c === 'EUROS' || c === '€' || c === 'یورو' || c === 'یۆرۆ') {
    return 'EUR';
  }
  if (c === 'IQD' || c === 'DINAR' || c === 'DINARS' || c === 'دینار' || c === 'د.ع') {
    return 'IQD';
  }
  return c;
}

/**
 * Round currency based on project currency rules:
 * - IQD: nearest multiple of 250 (000, 250, 500, 750)
 * - IRT (Toman): whole numbers rounded
 * - USD/EUR: standard rounded decimal
 */
export function roundCurrency(amount, currency = 'IQD') {
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  const num = Number(amount);
  const norm = normalizeCurrency(currency);
  if (norm === 'IQD') {
    return roundIQD(num);
  } else if (norm === 'IRT') {
    return Math.round(num);
  } else if (norm === 'USD' || norm === 'EUR') {
    return Math.round(num * 100) / 100;
  }
  return Math.round(num);
}

/**
 * Get display currency symbol/name according to language and currency code
 */
export function getCurrencySymbol(currency = 'IQD', lang = 'ku') {
  const norm = normalizeCurrency(currency);
  if (norm === 'IRT') {
    if (lang === 'en') return 'IRT';
    if (lang === 'ku') return 'تۆمەن';
    return 'تومان';
  } else if (norm === 'USD') {
    if (lang === 'en') return '$';
    if (lang === 'ku') return '$';
    return 'دلار';
  } else if (norm === 'EUR') {
    if (lang === 'en') return '€';
    if (lang === 'ku') return 'یۆرۆ';
    return 'یورو';
  } else {
    // Default IQD
    if (lang === 'en') return 'IQD';
    if (lang === 'ku') return 'د.ع';
    return 'دینار';
  }
}

export function getStoredNumberFormat() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('karsync_number_format') || 'latin';
    }
  } catch (_) {}
  return 'latin';
}

/**
 * Universal Currency Formatter for SaaS multi-currency projects
 */
export function formatCurrency(amount, currency = 'IQD', lang = 'ku', numFormat = null) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    amount = 0;
  }
  const format = numFormat || getStoredNumberFormat();
  const norm = normalizeCurrency(currency);
  const rounded = roundCurrency(amount, norm);
  const symbol = getCurrencySymbol(norm, lang);

  let result = '';
  if (norm === 'USD') {
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
    result = lang === 'fa' ? `${formatted} دلار` : `$${formatted}`;
  } else if (norm === 'EUR') {
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
    result = `${formatted} €`;
  } else {
    const formattedNumber = rounded.toLocaleString('en-US');
    result = `${formattedNumber} ${symbol}`;
  }
  return convertDigits(result, format);
}

/**
 * Backward-compatible formatIQD export
 */
export const formatIQD = (amount, lang = 'ku') => formatCurrency(amount, 'IQD', lang);

/**
 * Format numbers with comma separators (pure digits, e.g. 35,000)
 */
export function formatNumber(num, numFormat = null) {
  const format = numFormat || getStoredNumberFormat();
  if (num === undefined || num === null || isNaN(num)) return convertDigits('0', format);
  return convertDigits(Number(num).toLocaleString('en-US'), format);
}

/**
 * Clean currency amount formatter without symbol, rounded appropriately (e.g. 417,250)
 */
export function formatAmount(amount, currency = 'IQD', numFormat = null) {
  const format = numFormat || getStoredNumberFormat();
  if (amount === undefined || amount === null || isNaN(amount)) return convertDigits('0', format);
  return convertDigits(roundCurrency(amount, currency).toLocaleString('en-US'), format);
}

/**
 * Astronomical Jalali to Gregorian converter
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
 * Astronomical Gregorian to Jalali converter
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
 * Check if a Jalali year is a leap year (366 days, Esfand has 30 days)
 */
export function isJalaliLeap(jy) {
  const g = jalaliToGregorian(jy, 12, 30);
  const back = gregorianToJalali(g.gy, g.gm, g.gd);
  return back.jm === 12 && back.jd === 30;
}

/**
 * Total days in a Jalali month (1-6: 31 days, 7-11: 30 days, 12: 29 or 30 days)
 */
export function getJalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/**
 * Localized month dictionaries
 */
export const JALALI_MONTHS = {
  fa: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
  ku: ['خاکەلێوە', 'گوڵان', 'جۆزەردان', 'پووشپەڕ', 'گەلاوێژ', 'خەرمانان', 'ڕەزبەر', 'گەڵاڕێزان', 'سەرماوەز', 'بەفرانبار', 'ڕێبەندان', 'ڕەشەمە'],
  en: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand']
};

export const GREGORIAN_MONTHS = {
  fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
  ku: ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};

export const WEEKDAYS = {
  fa: ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'],
  ku: ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};

export function getStoredCalendarType() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('karsync_calendar_type');
      if (stored && ['jalali', 'gregorian', 'auto'].includes(stored)) {
        return stored;
      }
    }
  } catch (_) {}
  return 'auto';
}

export function isJalaliCalendar(calendarType = null, lang = 'fa') {
  const cal = calendarType || getStoredCalendarType();
  if (cal === 'jalali') return true;
  if (cal === 'gregorian') return false;
  // auto mode: check system or language
  try {
    const sysCal = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat().resolvedOptions().calendar : null;
    if (sysCal === 'persian') return true;
  } catch (_) {}
  return lang === 'fa';
}

/**
 * Get current date string YYYY-MM-DD (canonical Gregorian ISO)
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current year-month YYYY-MM based on the active calendar system
 * e.g., '1405-08' in Jalali or '2026-11' in Gregorian
 */
export function getCurrentYearMonth(calendarType = null, lang = 'fa') {
  const now = new Date();
  const gy = now.getFullYear();
  const gm = now.getMonth() + 1;
  const gd = now.getDate();
  if (isJalaliCalendar(calendarType, lang)) {
    const j = gregorianToJalali(gy, gm, gd);
    return `${j.jy}-${String(j.jm).padStart(2, '0')}`;
  }
  return `${gy}-${String(gm).padStart(2, '0')}`;
}

/**
 * Shift calendar month forward or backward by delta
 */
export function shiftCalendarMonth(monthKey, delta = 0, calendarType = null, lang = 'fa') {
  if (!monthKey) return getCurrentYearMonth(calendarType, lang);
  const parts = String(monthKey).split('-').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return monthKey;
  let y = parts[0];
  let m = parts[1] + delta;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Format date nicely for display YYYY/MM/DD
 * Converts canonical Gregorian ISO ('YYYY-MM-DD') to Shamsi 'YYYY/MM/DD' when in Jalali mode
 */
export function formatDateDisplay(dateStr, lang = 'ku', numFormat = null, calendarType = null) {
  if (!dateStr) return '';
  const format = numFormat || getStoredNumberFormat();
  const parts = String(dateStr).split(/[-/]/);
  if (parts.length !== 3) return convertDigits(dateStr, format);

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return convertDigits(dateStr, format);

  if (isJalaliCalendar(calendarType, lang)) {
    // If input is already Jalali (y < 1600), format directly, otherwise convert from Gregorian
    if (y < 1600) {
      return convertDigits(`${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`, format);
    }
    const j = gregorianToJalali(y, m, d);
    return convertDigits(`${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`, format);
  }

  // Gregorian mode
  if (y < 1600) {
    const g = jalaliToGregorian(y, m, d);
    return convertDigits(`${g.gy}/${String(g.gm).padStart(2, '0')}/${String(g.gd).padStart(2, '0')}`, format);
  }
  return convertDigits(`${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`, format);
}

/**
 * Format full date with weekday name in Kurdish, Persian, or English
 * e.g., "جمعه، ۲۳ آبان ۱۴۰۵" or "Friday, 23 Aban 1405" or "Friday, 13 November 2026"
 */
export function formatFullDateWithWeekday(dateStr, lang = 'ku', numFormat = null, calendarType = null) {
  if (!dateStr) return '';
  const parts = String(dateStr).split(/[-/]/);
  if (parts.length !== 3) return dateStr;
  let y = Number(parts[0]);
  let m = Number(parts[1]);
  let d = Number(parts[2]);
  if (!y || !m || !d) return dateStr;

  let gy = y;
  let gm = m;
  let gd = d;

  // Normalize to Gregorian for accurate weekday day-of-week calculation
  if (y < 1600) {
    const g = jalaliToGregorian(y, m, d);
    gy = g.gy;
    gm = g.gm;
    gd = g.gd;
  }

  const dateObj = new Date(gy, gm - 1, gd);
  const dayOfWeek = dateObj.getDay();

  const wList = WEEKDAYS[lang] || WEEKDAYS.en;
  const wName = wList[dayOfWeek];

  let displayY = gy;
  let displayM = gm;
  let displayD = gd;
  let mName = '';

  if (isJalaliCalendar(calendarType, lang)) {
    const j = y < 1600 ? { jy: y, jm: m, jd: d } : gregorianToJalali(gy, gm, gd);
    displayY = j.jy;
    displayM = j.jm;
    displayD = j.jd;
    const jMonths = JALALI_MONTHS[lang] || JALALI_MONTHS.en;
    mName = jMonths[displayM - 1] || '';
  } else {
    const gMonths = GREGORIAN_MONTHS[lang] || GREGORIAN_MONTHS.en;
    mName = gMonths[displayM - 1] || '';
  }

  let result = '';
  if (lang === 'en') {
    result = `${wName}, ${displayD} ${mName} ${displayY}`;
  } else if (lang === 'ku') {
    result = `${wName}، ${displayD}ی ${mName} ${displayY}`;
  } else {
    result = `${wName}، ${displayD} ${mName} ${displayY}`;
  }
  return convertDigits(result, numFormat || getStoredNumberFormat());
}

/**
 * Format short date showing day and localized month name (e.g., "۲۳ آبان", "23 Aban", "13 Nov")
 */
export function formatDayMonth(dateStr, lang = 'fa', numFormat = null, calendarType = null) {
  if (!dateStr) return '';
  const parts = String(dateStr).split(/[-/]/);
  if (parts.length !== 3) return dateStr;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return dateStr;

  let displayD = d;
  let displayM = m;
  let mName = '';

  if (isJalaliCalendar(calendarType, lang)) {
    const j = y < 1600 ? { jy: y, jm: m, jd: d } : gregorianToJalali(y, m, d);
    displayD = j.jd;
    displayM = j.jm;
    const jMonths = JALALI_MONTHS[lang] || JALALI_MONTHS.fa;
    mName = jMonths[displayM - 1] || '';
  } else {
    let gm = m;
    let gd = d;
    if (y < 1600) {
      const g = jalaliToGregorian(y, m, d);
      gm = g.gm;
      gd = g.gd;
    }
    displayD = gd;
    displayM = gm;
    const gMonths = GREGORIAN_MONTHS[lang] || GREGORIAN_MONTHS.fa;
    mName = gMonths[displayM - 1] || '';
  }

  if (lang === 'ku') {
    return convertDigits(`${displayD}ی ${mName}`, numFormat || getStoredNumberFormat());
  }
  return convertDigits(`${displayD} ${mName}`, numFormat || getStoredNumberFormat());
}

/**
 * Format month showing localized month name only (e.g., "آبان", "گەڵاڕێزان", "November")
 * Supports monthStr as 'YYYY-MM', or number 1-12, or Gregorian ISO date 'YYYY-MM-DD'
 */
export function formatMonthOnly(monthStr, lang = 'fa', calendarType = null) {
  if (!monthStr) return '';
  const parts = String(monthStr).split(/[-/]/);
  let y = parts.length >= 2 ? Number(parts[0]) : null;
  let m = parts.length >= 2 ? Number(parts[1]) : Number(parts[0]);
  if (!m || isNaN(m)) return monthStr;

  if (isJalaliCalendar(calendarType, lang)) {
    // If year is given and is Gregorian (> 1600), convert middle of month to get Jalali month
    if (y && y > 1600) {
      const j = gregorianToJalali(y, m, 15);
      m = j.jm;
    }
    const jMonths = JALALI_MONTHS[lang] || JALALI_MONTHS.fa;
    return jMonths[m - 1] || '';
  }

  // Gregorian
  if (y && y < 1600) {
    const g = jalaliToGregorian(y, m, 15);
    m = g.gm;
  }
  const gMonths = GREGORIAN_MONTHS[lang] || GREGORIAN_MONTHS.fa;
  return gMonths[m - 1] || '';
}

/**
 * Format month with year (e.g., "آبان ۱۴۰۵" or "November 2026")
 */
export function formatMonthWithYear(monthStr, lang = 'fa', calendarType = null, numFormat = null) {
  if (!monthStr) return '';
  const parts = String(monthStr).split(/[-/]/);
  if (parts.length < 2) return formatMonthOnly(monthStr, lang, calendarType);

  let y = Number(parts[0]);
  let m = Number(parts[1]);
  if (!y || !m) return monthStr;

  if (isJalaliCalendar(calendarType, lang)) {
    if (y > 1600) {
      const j = gregorianToJalali(y, m, 15);
      y = j.jy;
      m = j.jm;
    }
    const jMonths = JALALI_MONTHS[lang] || JALALI_MONTHS.fa;
    const mName = jMonths[m - 1] || '';
    return convertDigits(`${mName} ${y}`, numFormat || getStoredNumberFormat());
  }

  if (y < 1600) {
    const g = jalaliToGregorian(y, m, 15);
    y = g.gy;
    m = g.gm;
  }
  const gMonths = GREGORIAN_MONTHS[lang] || GREGORIAN_MONTHS.fa;
  const mName = gMonths[m - 1] || '';
  return convertDigits(`${mName} ${y}`, numFormat || getStoredNumberFormat());
}

/**
 * Extract localized day number and weekday name for calendar cards / badges
 */
export function getDayDetails(dateStr, lang = 'fa', numFormat = null, calendarType = null) {
  if (!dateStr) return { dayNumber: '—', dayName: '', monthName: '', year: '' };
  const parts = String(dateStr).split(/[-/]/);
  if (parts.length !== 3) return { dayNumber: dateStr, dayName: '', monthName: '', year: '' };
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return { dayNumber: dateStr, dayName: '', monthName: '', year: '' };

  let gy = y;
  let gm = m;
  let gd = d;
  if (y < 1600) {
    const g = jalaliToGregorian(y, m, d);
    gy = g.gy;
    gm = g.gm;
    gd = g.gd;
  }

  const dateObj = new Date(gy, gm - 1, gd);
  const dow = dateObj.getDay();
  const wList = WEEKDAYS[lang] || WEEKDAYS.en;
  const dayName = wList[dow] || '';

  let displayD = gd;
  let displayM = gm;
  let displayY = gy;
  let monthName = '';

  if (isJalaliCalendar(calendarType, lang)) {
    const j = y < 1600 ? { jy: y, jm: m, jd: d } : gregorianToJalali(gy, gm, gd);
    displayD = j.jd;
    displayM = j.jm;
    displayY = j.jy;
    const jMonths = JALALI_MONTHS[lang] || JALALI_MONTHS.en;
    monthName = jMonths[displayM - 1] || '';
  } else {
    const gMonths = GREGORIAN_MONTHS[lang] || GREGORIAN_MONTHS.en;
    monthName = gMonths[displayM - 1] || '';
  }

  return {
    dayNumber: convertDigits(String(displayD), numFormat || getStoredNumberFormat()),
    dayName,
    monthName,
    year: convertDigits(String(displayY), numFormat || getStoredNumberFormat())
  };
}

/**
 * Check if a canonical Gregorian ISO date falls into the given calendar month key
 * e.g., '2026-11-13' in '1405-08' -> true
 */
export function isDateInMonth(dateStr, monthKey, calendarType = null, lang = 'fa') {
  if (!dateStr || !monthKey) return false;
  const dateParts = String(dateStr).split(/[-/]/);
  if (dateParts.length !== 3) return false;
  const gy = Number(dateParts[0]);
  const gm = Number(dateParts[1]);
  const gd = Number(dateParts[2]);
  if (!gy || !gm || !gd) return false;

  const monthParts = String(monthKey).split(/[-/]/);
  if (monthParts.length < 2) return false;
  const my = Number(monthParts[0]);
  const mm = Number(monthParts[1]);

  if (isJalaliCalendar(calendarType, lang)) {
    const j = gregorianToJalali(gy, gm, gd);
    // If monthKey is in Shamsi (my < 1600)
    if (my < 1600) {
      return j.jy === my && j.jm === mm;
    }
    // If monthKey was passed as Gregorian
    const jMonth = gregorianToJalali(my, mm, 15);
    return j.jy === jMonth.jy && j.jm === jMonth.jm;
  }

  // Gregorian
  if (my < 1600) {
    const gStart = jalaliToGregorian(my, mm, 1);
    const totalDays = getJalaliMonthDays(my, mm);
    const gEnd = jalaliToGregorian(my, mm, totalDays);
    return dateStr >= gStart.dateString && dateStr <= gEnd.dateString;
  }
  return gy === my && gm === mm;
}

/**
 * Returns month breakdown details for building calendar grids and monthly queries
 */
export function getCalendarMonthDetails(monthKey, calendarType = null, lang = 'fa') {
  const isJalali = isJalaliCalendar(calendarType, lang);
  const parts = String(monthKey || getCurrentYearMonth(calendarType, lang)).split(/[-/]/).map(Number);
  let y = parts[0];
  let m = parts[1];

  if (isJalali) {
    if (y > 1600) {
      const j = gregorianToJalali(y, m, 15);
      y = j.jy;
      m = j.jm;
    }
    const totalDays = getJalaliMonthDays(y, m);
    const startG = jalaliToGregorian(y, m, 1);
    const endG = jalaliToGregorian(y, m, totalDays);
    const firstDayDate = new Date(startG.gy, startG.gm - 1, startG.gd);
    const firstDayOfWeek = firstDayDate.getDay(); // 0=Sun .. 6=Sat

    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const g = jalaliToGregorian(y, m, d);
      const dateObj = new Date(g.gy, g.gm - 1, g.gd);
      const dow = dateObj.getDay();
      days.push({
        dayNumber: d,
        dateStr: g.dateString, // Canonical ISO YYYY-MM-DD
        jalaliDateStr: `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`,
        isFriday: dow === 5,
        dayOfWeek: dow
      });
    }

    return {
      isJalali: true,
      year: y,
      month: m,
      totalDays,
      firstDayOfWeek,
      startDate: startG.dateString,
      endDate: endG.dateString,
      days
    };
  }

  // Gregorian
  if (y < 1600) {
    const g = jalaliToGregorian(y, m, 15);
    y = g.gy;
    m = g.gm;
  }
  const totalDays = new Date(y, m, 0).getDate();
  const firstDayDate = new Date(y, m - 1, 1);
  const firstDayOfWeek = firstDayDate.getDay();
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

  const days = [];
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(y, m - 1, d);
    const dow = dateObj.getDay();
    days.push({
      dayNumber: d,
      dateStr,
      jalaliDateStr: null,
      isFriday: dow === 5,
      dayOfWeek: dow
    });
  }

  return {
    isJalali: false,
    year: y,
    month: m,
    totalDays,
    firstDayOfWeek,
    startDate,
    endDate,
    days
  };
}


/**
 * Convert hours and minutes to decimal hours
 * e.g., 1 hour and 44 minutes -> 1.7333
 */
export function toDecimalHours(hours, minutes) {
  const h = Math.max(0, parseInt(hours, 10) || 0);
  const m = Math.max(0, Math.min(59, parseInt(minutes, 10) || 0));
  return Number((h + (m / 60)).toFixed(4));
}

/**
 * Convert decimal hours to hours and minutes
 * e.g., 1.7333 -> { hours: 1, minutes: 44 }
 */
export function fromDecimalHours(decimal) {
  const val = Math.max(0, Number(decimal) || 0);
  let hours = Math.floor(val);
  let minutes = Math.round((val - hours) * 60);
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  return { hours, minutes };
}

/**
 * Format decimal hours into human readable text (hours and minutes)
 * e.g., 1.7333 -> "۱ ساعت و ۴۴ دقیقه" or "1h 44m"
 */
export function formatHoursAndMinutes(decimalHours, lang = 'fa', numFormat = null) {
  const format = numFormat || getStoredNumberFormat();
  if (!decimalHours || Number(decimalHours) <= 0) return convertDigits('0', format);
  const { hours, minutes } = fromDecimalHours(decimalHours);

  let result = '';
  if (hours > 0 && minutes > 0) {
    if (lang === 'fa') result = `${hours} ساعت و ${minutes} دقیقه`;
    else if (lang === 'ku') result = `${hours} کاتژمێر و ${minutes} خولەک`;
    else result = `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    if (lang === 'fa') result = `${hours} ساعت`;
    else if (lang === 'ku') result = `${hours} کاتژمێر`;
    else result = `${hours}h`;
  } else if (lang === 'fa') {
    result = `${minutes} دقیقه`;
  } else if (lang === 'ku') {
    result = `${minutes} خولەک`;
  } else {
    result = `${minutes}m`;
  }
  return convertDigits(result, format);
}

/**
 * Format decimal hours into digital clock format "H:MM"
 * e.g., 1.3833 -> "1:23"
 */
export function formatHoursDigital(decimalHours, numFormat = null) {
  const format = numFormat || getStoredNumberFormat();
  if (!decimalHours || Number(decimalHours) <= 0) return convertDigits('0:00', format);
  const { hours, minutes } = fromDecimalHours(decimalHours);
  const minStr = String(minutes).padStart(2, '0');
  return convertDigits(`${hours}:${minStr}`, format);
}

/**
 * Compact hour formatting for small calendar tiles
 * e.g., 1.7333 -> "+1:44" or "1:44"
 * 2 -> "+2س" / "+2ک" / "+2h"
 */
export function formatTileHours(decimalHours, isHourly = false, lang = 'fa', numFormat = null) {
  const format = numFormat || getStoredNumberFormat();
  const val = Number(decimalHours) || 0;
  if (val <= 0) {
    return isHourly ? convertDigits('0h', format) : '';
  }
  const { hours, minutes } = fromDecimalHours(val);
  const prefix = isHourly ? '' : '+';

  let result = '';
  if (minutes === 0) {
    if (lang === 'fa') result = `${prefix}${hours}س`;
    else if (lang === 'ku') result = `${prefix}${hours}ک`;
    else result = `${prefix}${hours}h`;
  } else {
    const minStr = String(minutes).padStart(2, '0');
    result = `${prefix}${hours}:${minStr}`;
  }
  return convertDigits(result, format);
}

/**
 * Common regional timezones list with Persian, Kurdish, and English labels
 */
export const TIMEZONE_OPTIONS = [
  {
    id: 'auto',
    name: { fa: 'تشخیص خودکار دستگاه (سیستم)', ku: 'خۆکار بەپێی ئامێر', en: 'Automatic (Device System)' },
    sub: 'Device Timezone'
  },
  {
    id: 'Asia/Tehran',
    name: { fa: 'تهران - ایران (UTC+3:30)', ku: 'تاران - ئێران (UTC+3:30)', en: 'Tehran - Iran (UTC+3:30)' },
    sub: 'IRST / IRDT'
  },
  {
    id: 'Asia/Baghdad',
    name: { fa: 'بغداد - عراق (UTC+3:00)', ku: 'بەغدا - عێراق (UTC+3:00)', en: 'Baghdad - Iraq (UTC+3:00)' },
    sub: 'AST'
  },
  {
    id: 'Asia/Erbil',
    name: { fa: 'اربیل / هه‌ولێر - اقلیم کردستان (UTC+3:00)', ku: 'هەولێر - هەرێمی کوردستان (UTC+3:00)', en: 'Erbil - Kurdistan (UTC+3:00)' },
    sub: 'Kurdistan Standard Time'
  },
  {
    id: 'Asia/Dubai',
    name: { fa: 'دبی - امارات (UTC+4:00)', ku: 'دوبەی - ئیمارات (UTC+4:00)', en: 'Dubai - UAE (UTC+4:00)' },
    sub: 'GST'
  },
  {
    id: 'Asia/Istanbul',
    name: { fa: 'استانبول - ترکیه (UTC+3:00)', ku: 'ئیستەنبوڵ - تورکیا (UTC+3:00)', en: 'Istanbul - Turkey (UTC+3:00)' },
    sub: 'TRT'
  },
  {
    id: 'UTC',
    name: { fa: 'ساعت هماهنگ جهانی (UTC / گرینویچ)', ku: 'کاتی گەردوونی (UTC)', en: 'Universal Coordinated Time (UTC)' },
    sub: 'GMT / UTC'
  }
];

/**
 * Calendar system options
 */
export const CALENDAR_OPTIONS = [
  {
    id: 'auto',
    name: { fa: 'خودکار (هماهنگ با زبان و سیستم)', ku: 'خۆکار بەپێی زمان و ئامێر', en: 'Automatic (System & Language)' },
    sub: 'fa -> شمسی | ku/en -> میلادی'
  },
  {
    id: 'jalali',
    name: { fa: 'تقویم شمسی (خورشیدی)', ku: 'تەقویمی کۆچی هەتاوی (کوردی / ئێرانی)', en: 'Solar Hijri (Jalali)' },
    sub: 'فروردین تا اسفند (Jalali)'
  },
  {
    id: 'gregorian',
    name: { fa: 'تقویم میلادی (گریگوری)', ku: 'تەقویمی زاینی (گریگۆری)', en: 'Gregorian Calendar' },
    sub: 'January - December'
  }
];

/**
 * Number Digits formatting options
 */
export const NUMBER_FORMAT_OPTIONS = [
  {
    id: 'latin',
    name: { fa: 'انگلیسی / لاتین (0, 1, 2, 3)', ku: 'ئینگلیزی / لاتینی (0, 1, 2, 3)', en: 'English / Latin (0, 1, 2, 3)' },
    sub: '123,456'
  },
  {
    id: 'fa',
    name: { fa: 'فارسی (۰، ۱، ۲، ۳)', ku: 'فارسی (۰، ۱، ۲، ۳)', en: 'Persian (۰, ۱, ۲, ۳)' },
    sub: '۱۲۳,۴۵۶'
  },
  {
    id: 'ar',
    name: { fa: 'عربی / شرقی (٠، ١، ٢، ٣)', ku: 'عەرەبی / ڕۆژهەڵاتی (٠، ١، ٢، ٣)', en: 'Arabic-Indic (٠, ١, ٢, ٣)' },
    sub: '١٢٣,٤٥٦'
  }
];

/**
 * Universal Digits Converter
 */
export function convertDigits(input, format = null) {
  if (input === undefined || input === null) return '';
  const str = String(input);
  const targetFormat = format || getStoredNumberFormat();
  if (targetFormat === 'latin' || targetFormat === 'en') {
    return str
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  }
  if (targetFormat === 'fa') {
    const latinToFa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str
      .replace(/[٠-٩]/g, (d) => latinToFa[d.charCodeAt(0) - 1632])
      .replace(/[0-9]/g, (d) => latinToFa[Number(d)]);
  }
  if (targetFormat === 'ar') {
    const latinToAr = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return str
      .replace(/[۰-۹]/g, (d) => latinToAr[d.charCodeAt(0) - 1776])
      .replace(/[0-9]/g, (d) => latinToAr[Number(d)]);
  }
  return str;
}

/**
 * Normalize Persian/Arabic digits to standard English/Latin digits (0-9)
 */
export function normalizeDigits(str) {
  if (str === undefined || str === null) return '';
  return convertDigits(str, 'latin');
}

/**
 * Universal Time Formatter taking format and timezone settings into account
 */
export function formatTime(date = new Date(), options = {}) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '';

  const timeFormat = options.timeFormat || (typeof localStorage !== 'undefined' ? localStorage.getItem('karsync_time_format') : null) || '24h';
  const timeZone = options.timeZone || (typeof localStorage !== 'undefined' ? localStorage.getItem('karsync_timezone') : null) || 'auto';
  const numberFormat = options.numberFormat || getStoredNumberFormat();
  const incSec = options.includeSeconds !== undefined ? options.includeSeconds : true;

  const opts = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h'
  };
  if (incSec) opts.second = '2-digit';
  if (timeZone && timeZone !== 'auto') {
    try {
      opts.timeZone = timeZone;
    } catch (_) {}
  }

  let result = '';
  try {
    result = new Intl.DateTimeFormat('en-GB', opts).format(d);
  } catch (_) {
    result = d.toLocaleTimeString('en-GB', opts);
  }

  return convertDigits(result, numberFormat);
}

/**
 * Universal Date Formatter supporting Jalali and Gregorian calendars with timezone and digit conversion
 */
export function formatDate(date = new Date(), options = {}) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '';

  const cal = options.calendarType || (typeof localStorage !== 'undefined' ? localStorage.getItem('karsync_calendar_type') : null) || 'auto';
  const tz = options.timeZone || (typeof localStorage !== 'undefined' ? localStorage.getItem('karsync_timezone') : null) || 'auto';
  const numFmt = options.numberFormat || getStoredNumberFormat();
  const lang = options.lang || (typeof localStorage !== 'undefined' ? localStorage.getItem('workshop_lang') : null) || 'fa';

  let isJalali = false;
  if (cal === 'jalali') {
    isJalali = true;
  } else if (cal === 'gregorian') {
    isJalali = false;
  } else {
    try {
      const sysCal = new Intl.DateTimeFormat().resolvedOptions().calendar;
      if (sysCal === 'persian') {
        isJalali = true;
      } else if (lang === 'fa') {
        isJalali = true;
      } else {
        isJalali = false;
      }
    } catch {
      isJalali = lang === 'fa';
    }
  }

  const tzOpt = tz && tz !== 'auto' ? { timeZone: tz } : {};
  let formatted = '';

  if (isJalali) {
    try {
      formatted = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...tzOpt
      }).format(d);
    } catch {
      formatted = d.toLocaleDateString('fa-IR', tzOpt);
    }
  } else {
    const loc = lang === 'fa' ? 'fa-IR-u-ca-gregory' : lang === 'ku' ? 'ckb-u-ca-gregory' : 'en-GB';
    try {
      formatted = new Intl.DateTimeFormat(loc, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...tzOpt
      }).format(d);
    } catch {
      formatted = d.toLocaleDateString('en-GB', tzOpt);
    }
  }

  return convertDigits(formatted, numFmt);
}

export { numberToWords } from './numberToWords';

