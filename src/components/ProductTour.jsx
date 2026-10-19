import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  FolderKanban,
  CalendarCheck,
  Landmark,
  Receipt,
  Cloud,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Check
} from 'lucide-react';

export function ProductTour({ isOpen, onClose }) {
  const { t, language, direction, convertDigits } = useLanguage();
  const lang = ['fa', 'ku', 'en'].includes(language) ? language : 'fa';
  const isRtl = direction === 'rtl';

  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const cardRef = useRef(null);

  const steps = [
    {
      id: 'projects',
      selectors: ['[data-tour="project-switcher"]'],
      title: t('tourStep1Title'),
      desc: t('tourStep1Desc'),
      icon: FolderKanban,
      color: 'text-sky-500',
      badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
    },
    {
      id: 'attendance',
      selectors: [
        '[data-tour="quick-log-btn"]',
        '[data-tour="nav-workers"]',
        '[data-tour="mobile-nav-workers"]'
      ],
      title: t('tourStep2Title'),
      desc: t('tourStep2Desc'),
      icon: CalendarCheck,
      color: 'text-emerald-500',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    },
    {
      id: 'accounting',
      selectors: [
        '[data-tour="nav-accounting"]',
        '[data-tour="mobile-nav-accounting"]'
      ],
      title: t('tourStep3Title'),
      desc: t('tourStep3Desc'),
      icon: Landmark,
      color: 'text-amber-500',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    },
    {
      id: 'expenses',
      selectors: [
        '[data-tour="nav-expenses"]',
        '[data-tour="mobile-nav-expenses"]'
      ],
      title: t('tourStep4Title'),
      desc: t('tourStep4Desc'),
      icon: Receipt,
      color: 'text-rose-500',
      badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
    },
    {
      id: 'sync',
      selectors: ['[data-tour="settings-sync"]'],
      title: t('tourStep5Title'),
      desc: t('tourStep5Desc'),
      icon: Cloud,
      color: 'text-indigo-500',
      badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
    }
  ];

  // Measure and track target element bounding box
  const updateTargetRect = useCallback(() => {
    if (!isOpen) return;
    const step = steps[currentStep];
    if (!step) return;

    let foundEl = null;
    for (const sel of step.selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        foundEl = el;
        break;
      }
    }

    if (foundEl) {
      const rect = foundEl.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
      });
      // Scroll into view gently if outside viewport
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        foundEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  // Recalculate on step change, resize or scroll
  useEffect(() => {
    if (!isOpen) {
      setTargetRect(null);
      return;
    }
    const timer = setTimeout(updateTargetRect, 60);
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isOpen, currentStep, updateTargetRect]);

  // Keyboard navigation: Escape, Left, Right
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight') {
        if (isRtl) handlePrev();
        else handleNext();
      } else if (e.key === 'ArrowLeft') {
        if (isRtl) handleNext();
        else handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, isRtl]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('karsync_product_tour_seen', 'true');
    } catch (_) {}
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  const activeStep = steps[currentStep];
  const StepIcon = activeStep.icon;
  const isLastStep = currentStep === steps.length - 1;

  // Calculate card position on desktop vs mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  let cardStyle = {};
  if (isMobile || !targetRect) {
    // Bottom Sheet layout on mobile screens
    cardStyle = {
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      right: '16px',
      maxWidth: '440px',
      margin: '0 auto',
      zIndex: 9995
    };
  } else {
    // Floating Popper layout on desktop
    const cardWidth = 380;
    const cardHeight = 220;
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const placeBelow = spaceBelow > cardHeight + 24;

    const topPos = placeBelow
      ? targetRect.bottom + 14
      : Math.max(16, targetRect.top - cardHeight - 14);

    let leftPos = isRtl
      ? targetRect.right - cardWidth
      : targetRect.left;

    // Viewport clamping
    leftPos = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, leftPos));

    cardStyle = {
      position: 'fixed',
      top: `${topPos}px`,
      left: `${leftPos}px`,
      width: `${cardWidth}px`,
      zIndex: 9995
    };
  }

  const currentStepNum = convertDigits ? convertDigits(currentStep + 1, lang) : currentStep + 1;
  const totalStepsNum = convertDigits ? convertDigits(steps.length, lang) : steps.length;
  const stepCounterText = t('tourStepCount', { current: currentStepNum, total: totalStepsNum });

  return (
    <div
      className="fixed inset-0 z-[9990] select-none no-print"
      dir={direction}
      aria-modal="true"
      role="dialog"
    >
      {/* 1. Dynamic Spotlight Cutout with Pulsing Glow Ring */}
      {targetRect ? (
        <div
          style={{
            top: Math.max(0, targetRect.top - 6),
            left: Math.max(0, targetRect.left - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12
          }}
          className="fixed rounded-2xl ring-4 ring-sky-500/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.72),0_0_35px_rgba(14,165,233,0.5)] z-[9991] pointer-events-none transition-all duration-300 ease-out animate-pulse"
        />
      ) : (
        /* Full Backdrop fallback */
        <div
          onClick={handleDismiss}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[9991] transition-opacity duration-300"
        />
      )}

      {/* Transparent Click-Catcher to dismiss when clicking outside */}
      <div
        onClick={handleDismiss}
        className="fixed inset-0 z-[9992] cursor-default"
      />

      {/* 2. Floating Apple Liquid Glass Tour Card */}
      <div
        ref={cardRef}
        style={cardStyle}
        className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.35)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] rounded-3xl p-5 space-y-4 animate-in zoom-in-95 duration-200"
      >
        {/* Top Bar: Progress Indicator & Close Button */}
        <div className="flex items-center justify-between gap-3">
          {/* Segmented 5-Step Bar */}
          <div className="flex items-center gap-1.5 flex-1">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'flex-1 bg-sky-500 shadow-xs'
                    : idx < currentStep
                    ? 'w-4 bg-emerald-500'
                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 font-mono">
              {stepCounterText}
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={t('tourSkip')}
              aria-label={t('tourSkip')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex items-start gap-3.5 pt-1">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-xs ${activeStep.badgeBg}`}>
            <StepIcon className={`w-5 h-5 ${activeStep.color}`} />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
              {activeStep.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
              {activeStep.desc}
            </p>
          </div>
        </div>

        {/* Action Controls Toolbar [APP_THEME_BUTTON] */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2 py-1.5 rounded-xl"
          >
            {t('tourSkip')}
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1 active:scale-95"
              >
                {isRtl ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                <span>{t('tourPrev')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 flex items-center gap-1.5 ${
                isLastStep
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-primary hover:bg-primary-hover shadow-primary/20'
              }`}
            >
              <span>{isLastStep ? t('tourFinish') : t('tourNext')}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
