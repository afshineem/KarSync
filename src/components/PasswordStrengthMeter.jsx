import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { evaluatePasswordStrength } from '../utils/passwordSecurity';
import { Check, X, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export function PasswordStrengthMeter({ password = '', showChecks = true }) {
  const { language } = useLanguage();
  const evaluation = evaluatePasswordStrength(password);

  if (!password) return null;

  const langKey = language === 'fa' ? 'fa' : language === 'ku' ? 'ku' : 'en';

  const checkLabels = [
    { key: 'length', text: { fa: 'حداقل ۸ کاراکتر', ku: 'لانیکەم ٨ پیت', en: 'At least 8 characters' } },
    { key: 'hasLower', text: { fa: 'حروف کوچک (a-z)', ku: 'پیتی بچووک (a-z)', en: 'Lowercase letters (a-z)' } },
    { key: 'hasUpper', text: { fa: 'حروف بزرگ (A-Z)', ku: 'پیتی گەورە (A-Z)', en: 'Uppercase letters (A-Z)' } },
    { key: 'hasNumber', text: { fa: 'اعداد (0-9)', ku: 'ژمارەکان (0-9)', en: 'Numbers (0-9)' } },
    { key: 'hasSpecial', text: { fa: 'نمادها و علائم (!@#$...)', ku: 'هێماکان (!@#$...)', en: 'Symbols (!@#$...)' } },
  ];

  return (
    <div className="mt-2 space-y-2 animate-in fade-in duration-200">
      {/* Progress Bar & Label */}
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
          {evaluation.score >= 3 ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          ) : evaluation.score >= 2 ? (
            <Shield className="w-3.5 h-3.5 text-yellow-500" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          )}
          <span>{language === 'fa' ? 'قدرت رمز:' : language === 'ku' ? 'هێزی تێپەڕەوشە:' : 'Strength:'}</span>
        </span>
        <span className={`${evaluation.textClass} font-extrabold`}>
          {evaluation.label[langKey] || evaluation.label.en}
        </span>
      </div>

      {/* Segmented Strength Bar */}
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
        {[0, 1, 2, 3].map((step) => {
          const isActive = evaluation.score > step || (step === 0 && evaluation.score >= 0 && password.length > 0);
          let barBg = 'bg-slate-200 dark:bg-slate-700';
          if (isActive) {
            if (evaluation.score === 0 || evaluation.score === 1) barBg = 'bg-rose-500';
            else if (evaluation.score === 2) barBg = 'bg-amber-500';
            else if (evaluation.score === 3) barBg = 'bg-emerald-500';
            else barBg = 'bg-teal-500';
          }

          return (
            <div
              key={step}
              className={`rounded-full transition-all duration-300 ${barBg}`}
            />
          );
        })}
      </div>

      {/* Detailed Checklist */}
      {showChecks && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
          {checkLabels.map(({ key, text }) => {
            const isPassed = evaluation.checks[key];
            return (
              <div
                key={key}
                className={`text-[10px] flex items-center gap-1.5 transition-colors ${
                  isPassed
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {isPassed ? (
                  <Check className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                ) : (
                  <X className="w-3 h-3 flex-shrink-0 text-slate-300 dark:text-slate-600" />
                )}
                <span>{text[langKey] || text.en}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
