import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export function convertDigits(input, format = 'latin') {
  if (input === undefined || input === null) return '';
  const str = String(input);
  if (format === 'latin' || format === 'en') {
    return str
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  }
  if (format === 'fa') {
    const latinToFa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str
      .replace(/[٠-٩]/g, (d) => latinToFa[d.charCodeAt(0) - 1632])
      .replace(/[0-9]/g, (d) => latinToFa[Number(d)]);
  }
  if (format === 'ar') {
    const latinToAr = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return str
      .replace(/[۰-۹]/g, (d) => latinToAr[d.charCodeAt(0) - 1776])
      .replace(/[0-9]/g, (d) => latinToAr[Number(d)]);
  }
  return str;
}

const WEEKDAYS = {
  fa: ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'],
  ku: ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};

const GREGORIAN_MONTHS = {
  fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
  ku: ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};

const JALALI_MONTHS = {
  fa: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
  ku: ['خاکەلێوە', 'گوڵان', 'جۆزەردان', 'پووشپەڕ', 'گەلاوێژ', 'خەرمانان', 'ڕەزبەر', 'گەڵاڕێزان', 'سەرماوەز', 'بەفرانبار', 'ڕێبەندان', 'ڕەشەمە'],
  en: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand']
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('workshop_lang') || 'ku';
  });

  const direction = language === 'en' ? 'ltr' : 'rtl';

  useEffect(() => {
    localStorage.setItem('workshop_lang', language);
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', language);
  }, [language, direction]);

  const t = (key, replacements = {}) => {
    const langDict = translations[language] || translations.ku;
    let text = langDict[key] || translations.en[key] || key;

    if (replacements && typeof replacements === 'object') {
      Object.keys(replacements).forEach((k) => {
        text = text.replaceAll('{' + k + '}', String(replacements[k]));
      });
    }

    return text;
  };

  const changeLanguage = (newLang) => {
    if (['ku', 'fa', 'en'].includes(newLang)) {
      setLanguage(newLang);
    }
  };

  const [timeFormat, setTimeFormatState] = useState(() => {
    return localStorage.getItem('karsync_time_format') || '24h';
  });

  const [timeZone, setTimeZoneState] = useState(() => {
    return localStorage.getItem('karsync_timezone') || 'auto';
  });

  const [calendarType, setCalendarTypeState] = useState(() => {
    return localStorage.getItem('karsync_calendar_type') || 'auto';
  });

  const [numberFormat, setNumberFormatState] = useState(() => {
    return localStorage.getItem('karsync_number_format') || 'latin';
  });

  const setTimeFormat = (format) => {
    if (format === '12h' || format === '24h') {
      setTimeFormatState(format);
      localStorage.setItem('karsync_time_format', format);
      window.dispatchEvent(new CustomEvent('karsync-time-settings-changed', { detail: { timeFormat: format } }));
    }
  };

  const setTimeZone = (tz) => {
    setTimeZoneState(tz);
    localStorage.setItem('karsync_timezone', tz);
    window.dispatchEvent(new CustomEvent('karsync-time-settings-changed', { detail: { timeZone: tz } }));
  };

  const setCalendarType = (type) => {
    setCalendarTypeState(type);
    localStorage.setItem('karsync_calendar_type', type);
    window.dispatchEvent(new CustomEvent('karsync-time-settings-changed', { detail: { calendarType: type } }));
  };

  useEffect(() => {
    localStorage.setItem('karsync_number_format', numberFormat);
    document.documentElement.setAttribute('data-number-format', numberFormat);
  }, [numberFormat]);

  const setNumberFormat = (format) => {
    setNumberFormatState(format);
    localStorage.setItem('karsync_number_format', format);
    document.documentElement.setAttribute('data-number-format', format);
    window.dispatchEvent(new CustomEvent('karsync-time-settings-changed', { detail: { numberFormat: format } }));
  };

  const formatTime = (date = new Date(), options = {}) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return '';

    const tf = options.timeFormat || timeFormat;
    const tz = options.timeZone || timeZone;
    const numFmt = options.numberFormat || numberFormat;
    const lang = options.lang || language;
    const incSec = options.includeSeconds !== undefined ? options.includeSeconds : true;

    const opts = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: tf === '12h'
    };
    if (incSec) opts.second = '2-digit';
    if (tz && tz !== 'auto') {
      try {
        opts.timeZone = tz;
      } catch (_) {}
    }

    let result = '';
    try {
      result = new Intl.DateTimeFormat('en-GB', opts).format(d);
    } catch (_) {
      result = d.toLocaleTimeString('en-GB', opts);
    }

    if (tf === '12h') {
      if (lang === 'fa') {
        result = result.replace(/\b(am|AM)\b/g, 'ق.ظ').replace(/\b(pm|PM)\b/g, 'ب.ظ');
      } else if (lang === 'ku') {
        result = result.replace(/\b(am|AM)\b/g, 'پ.ن').replace(/\b(pm|PM)\b/g, 'د.ن');
      } else {
        result = result.replace(/\b(am)\b/g, 'AM').replace(/\b(pm)\b/g, 'PM');
      }
    }

    return convertDigits(result, numFmt);
  };

  const formatDate = (date = new Date(), options = {}) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return '';

    const cal = options.calendarType || calendarType;
    const tz = options.timeZone || timeZone;
    const numFmt = options.numberFormat || numberFormat;
    const lang = options.lang || language;
    const langKey = lang === 'fa' ? 'fa' : lang === 'ku' ? 'ku' : 'en';

    let isJalali = false;
    if (cal === 'jalali') {
      isJalali = true;
    } else if (cal === 'gregorian') {
      isJalali = false;
    } else {
      isJalali = langKey === 'fa';
    }

    const tzOpt = tz && tz !== 'auto' ? { timeZone: tz } : {};

    // Determine weekday index (0=Sun .. 6=Sat) in target timezone
    let weekdayIndex = d.getDay();
    try {
      const shortW = new Intl.DateTimeFormat('en-US', { weekday: 'short', ...tzOpt }).format(d);
      const mapW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      if (mapW[shortW] !== undefined) weekdayIndex = mapW[shortW];
    } catch (_) {}

    const weekdayName = (WEEKDAYS[langKey] || WEEKDAYS.en)[weekdayIndex];

    if (isJalali) {
      try {
        const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          ...tzOpt
        }).formatToParts(d);
        const y = parts.find((p) => p.type === 'year')?.value || '';
        const m = Number(parts.find((p) => p.type === 'month')?.value || 1);
        const day = parts.find((p) => p.type === 'day')?.value || '';
        const monthName = (JALALI_MONTHS[langKey] || JALALI_MONTHS.en)[m - 1] || '';

        const formatted =
          langKey === 'en'
            ? `${weekdayName}, ${day} ${monthName} ${y}`
            : `${weekdayName}، ${day} ${monthName} ${y}`;
        return convertDigits(formatted, numFmt);
      } catch (_) {}
    }

    // Gregorian formatting with deterministic trilingual names
    try {
      const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        ...tzOpt
      }).formatToParts(d);
      const y = parts.find((p) => p.type === 'year')?.value || d.getFullYear();
      const m = Number(parts.find((p) => p.type === 'month')?.value || d.getMonth() + 1);
      const day = parts.find((p) => p.type === 'day')?.value || d.getDate();
      const monthName = (GREGORIAN_MONTHS[langKey] || GREGORIAN_MONTHS.en)[m - 1] || '';

      const formatted =
        langKey === 'en'
          ? `${weekdayName}, ${day} ${monthName} ${y}`
          : `${weekdayName}، ${day} ${monthName} ${y}`;
      return convertDigits(formatted, numFmt);
    } catch (_) {
      return convertDigits(d.toLocaleDateString('en-GB', tzOpt), numFmt);
    }
  };

  return (
    <LanguageContext.Provider value={{
      language,
      direction,
      changeLanguage,
      t,
      timeFormat,
      setTimeFormat,
      timeZone,
      setTimeZone,
      calendarType,
      setCalendarType,
      numberFormat,
      setNumberFormat,
      formatTime,
      formatDate,
      convertDigits,
      formatDigits: (val) => convertDigits(val, numberFormat),
      formatNumber: (val) => {
        if (val === undefined || val === null) return '';
        if (typeof val === 'number' && !isNaN(val)) {
          return convertDigits(val.toLocaleString('en-US'), numberFormat);
        }
        return convertDigits(String(val), numberFormat);
      }
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
