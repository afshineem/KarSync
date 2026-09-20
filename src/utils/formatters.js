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
 * Round currency based on project currency rules:
 * - IQD: nearest multiple of 250 (000, 250, 500, 750)
 * - IRT (Toman): whole numbers rounded
 * - USD: standard rounded decimal
 */
export function roundCurrency(amount, currency = 'IQD') {
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  const num = Number(amount);
  if (currency === 'IQD') {
    return roundIQD(num);
  } else if (currency === 'IRT') {
    return Math.round(num);
  } else if (currency === 'USD') {
    return Math.round(num * 100) / 100;
  }
  return Math.round(num);
}

/**
 * Get display currency symbol/name according to language and currency code
 */
export function getCurrencySymbol(currency = 'IQD', lang = 'ku') {
  if (currency === 'IRT') {
    if (lang === 'en') return 'IRT';
    if (lang === 'ku') return 'تۆمەن';
    return 'تومان';
  } else if (currency === 'USD') {
    if (lang === 'en') return '$';
    if (lang === 'ku') return '$';
    return 'دلار';
  } else {
    // Default IQD
    if (lang === 'en') return 'IQD';
    if (lang === 'ku') return 'د.ع';
    return 'دینار';
  }
}

/**
 * Universal Currency Formatter for SaaS multi-currency projects
 */
export function formatCurrency(amount, currency = 'IQD', lang = 'ku') {
  if (amount === undefined || amount === null || isNaN(amount)) {
    amount = 0;
  }
  const rounded = roundCurrency(amount, currency);
  const symbol = getCurrencySymbol(currency, lang);

  if (currency === 'USD') {
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
    return lang === 'fa' ? `${formatted} دلار` : `$${formatted}`;
  }

  const formattedNumber = rounded.toLocaleString('en-US');
  return `${formattedNumber} ${symbol}`;
}

/**
 * Backward-compatible formatIQD export
 */
export const formatIQD = (amount, lang = 'ku') => formatCurrency(amount, 'IQD', lang);

/**
 * Format numbers with comma separators (pure digits, e.g. 35,000)
 */
export function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

/**
 * Clean currency amount formatter without symbol, rounded appropriately (e.g. 417,250)
 */
export function formatAmount(amount, currency = 'IQD') {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return roundCurrency(amount, currency).toLocaleString('en-US');
}

/**
 * Get current date string YYYY-MM-DD
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current year-month YYYY-MM
 */
export function getCurrentYearMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format date nicely for display YYYY/MM/DD
 */
export function formatDateDisplay(dateStr, lang = 'ku') {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

/**
 * Format full date with weekday name in Kurdish, Persian, or English
 * e.g., "سه‌شنبه، ۱ سپتامبر ۲۰۲۶" or "Tuesday, 1 September 2026"
 */
export function formatFullDateWithWeekday(dateStr, lang = 'ku') {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return dateStr;

  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = dateObj.getDay();

  const weekdays = {
    fa: ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'],
    ku: ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };

  const months = {
    fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
    ku: ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول (سێپتەمبەر)', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  const wList = weekdays[lang] || weekdays.en;
  const mList = months[lang] || months.en;
  const wName = wList[dayOfWeek];
  const mName = mList[m - 1];

  if (lang === 'en') {
    return `${wName}, ${d} ${mName} ${y}`;
  } else if (lang === 'ku') {
    return `${wName}، ${d}ی ${mName} ${y}`;
  } else {
    return `${wName}، ${d} ${mName} ${y}`;
  }
}

/**
 * Format short date showing day and localized month name (e.g., "1 سپتامبر", "1 ئەیلوول", "1 Sep")
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} lang 'fa' | 'ku' | 'en'
 * @returns {string}
 */
export function formatDayMonth(dateStr, lang = 'fa') {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!m || !d) return dateStr;

  const months = {
    fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
    ku: ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  };

  const mList = months[lang] || months.fa;
  const mName = mList[m - 1] || '';

  return `${d} ${mName}`;
}

/**
 * Format month showing localized month name only (e.g., "سپتامبر", "ئەیلوول", "September")
 * @param {string} monthStr 'YYYY-MM'
 * @param {string} lang 'fa' | 'ku' | 'en'
 * @returns {string}
 */
export function formatMonthOnly(monthStr, lang = 'fa') {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const m = Number(parts[1]);
  if (!m) return monthStr;

  const months = {
    fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
    ku: ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  const mList = months[lang] || months.fa;
  return mList[m - 1] || '';
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
export function formatHoursAndMinutes(decimalHours, lang = 'fa') {
  if (!decimalHours || Number(decimalHours) <= 0) return '0';
  const { hours, minutes } = fromDecimalHours(decimalHours);

  if (hours > 0 && minutes > 0) {
    if (lang === 'fa') return `${hours} ساعت و ${minutes} دقیقه`;
    if (lang === 'ku') return `${hours} کاتژمێر و ${minutes} خولەک`;
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    if (lang === 'fa') return `${hours} ساعت`;
    if (lang === 'ku') return `${hours} کاتژمێر`;
    return `${hours}h`;
  }
  if (lang === 'fa') return `${minutes} دقیقه`;
  if (lang === 'ku') return `${minutes} خولەک`;
  return `${minutes}m`;
}

/**
 * Compact hour formatting for small calendar tiles
 * e.g., 1.7333 -> "+1:44" or "1:44"
 * 2 -> "+2س" / "+2ک" / "+2h"
 */
export function formatTileHours(decimalHours, isHourly = false, lang = 'fa') {
  const val = Number(decimalHours) || 0;
  if (val <= 0) {
    return isHourly ? '0h' : '';
  }
  const { hours, minutes } = fromDecimalHours(val);
  const prefix = isHourly ? '' : '+';

  if (minutes === 0) {
    if (lang === 'fa') return `${prefix}${hours}س`;
    if (lang === 'ku') return `${prefix}${hours}ک`;
    return `${prefix}${hours}h`;
  }

  const minStr = String(minutes).padStart(2, '0');
  return `${prefix}${hours}:${minStr}`;
}
