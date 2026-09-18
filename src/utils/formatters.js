/**
 * Format currency in Iraqi Dinars (IQD)
 * @param {number} amount
 * @param {string} lang - 'ku' | 'fa' | 'en'
 * @returns {string}
 */
export function formatIQD(amount, lang = 'ku') {
  if (amount === undefined || amount === null || isNaN(amount)) {
    amount = 0;
  }
  const formattedNumber = Math.round(amount).toLocaleString('en-US');
  
  if (lang === 'en') {
    return `${formattedNumber} IQD`;
  } else if (lang === 'ku') {
    return `${formattedNumber} د.ع`;
  } else {
    return `${formattedNumber} دینار`;
  }
}

/**
 * Format numbers with comma separators
 */
export function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
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
