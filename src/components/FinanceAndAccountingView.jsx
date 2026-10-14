import React from 'react';
import { FinancialsView } from './FinancialsView';

/**
 * FinanceAndAccountingView
 * نمای یکپارچه، جامع و مقتدر «حسابداری و امور مالی کارگاه»
 * بدون تب‌های تودرتو و پیچیده - ارائه شده به صورت یک هاب مالی مرکزی
 */
export function FinanceAndAccountingView() {
  return (
    <div className="pb-16 animate-in fade-in duration-200">
      <FinancialsView />
    </div>
  );
}
