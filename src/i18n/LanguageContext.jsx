import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

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

  return (
    <LanguageContext.Provider value={{ language, direction, changeLanguage, t }}>
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
