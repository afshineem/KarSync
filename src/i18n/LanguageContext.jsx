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

  const setNumberFormat = (format) => {
    setNumberFormatState(format);
    localStorage.setItem('karsync_number_format', format);
    window.dispatchEvent(new CustomEvent('karsync-time-settings-changed', { detail: { numberFormat: format } }));
  };

  const formatTime = (date = new Date(), options = {}) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return '';

    const tf = options.timeFormat || timeFormat;
    const tz = options.timeZone || timeZone;
    const numFmt = options.numberFormat || numberFormat;
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
      if (options.digits === 'en' || numFmt === 'latin') {
        result = new Intl.DateTimeFormat('en-GB', opts).format(d);
      } else {
        const loc = language === 'fa' ? 'fa-IR' : language === 'ku' ? 'ckb' : 'en-GB';
        result = new Intl.DateTimeFormat(loc, opts).format(d);
      }
    } catch (_) {
      result = d.toLocaleTimeString('en-GB', opts);
    }

    if (options.digits !== 'en' && numFmt && numFmt !== 'latin') {
      return convertDigits(result, numFmt);
    }
    return result;
  };

  const formatDate = (date = new Date(), options = {}) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return '';

    const cal = options.calendarType || calendarType;
    const tz = options.timeZone || timeZone;
    const numFmt = options.numberFormat || numberFormat;
    const lang = options.lang || language;

    let isJalali = false;
    if (cal === 'jalali') {
      isJalali = true;
    } else if (cal === 'gregorian') {
      isJalali = false;
    } else {
      // Auto: check browser/system calendar or fallback to language
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
      convertDigits
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
