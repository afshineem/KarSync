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
  const rounded = roundCurrency(amount, currency);
  const symbol = getCurrencySymbol(currency, lang);

  let result = '';
  if (currency === 'USD') {
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
    result = lang === 'fa' ? `${formatted} دلار` : `$${formatted}`;
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
export function formatDateDisplay(dateStr, lang = 'ku', numFormat = null) {
  if (!dateStr) return '';
  const format = numFormat || getStoredNumberFormat();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return convertDigits(dateStr, format);
  return convertDigits(`${parts[0]}/${parts[1]}/${parts[2]}`, format);
}

/**
 * Format full date with weekday name in Kurdish, Persian, or English
 * e.g., "سه‌شنبه، ۱ سپتامبر ۲۰۲۶" or "Tuesday, 1 September 2026"
 */
export function formatFullDateWithWeekday(dateStr, lang = 'ku', numFormat = null) {
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

  let result = '';
  if (lang === 'en') {
    result = `${wName}, ${d} ${mName} ${y}`;
  } else if (lang === 'ku') {
    result = `${wName}، ${d}ی ${mName} ${y}`;
  } else {
    result = `${wName}، ${d} ${mName} ${y}`;
  }
  return convertDigits(result, numFormat || getStoredNumberFormat());
}

/**
 * Format short date showing day and localized month name (e.g., "1 سپتامبر", "1 ئەیلوول", "1 Sep")
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} lang 'fa' | 'ku' | 'en'
 * @returns {string}
 */
export function formatDayMonth(dateStr, lang = 'fa', numFormat = null) {
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

  return convertDigits(`${d} ${mName}`, numFormat || getStoredNumberFormat());
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
