import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useProject } from '../context/ProjectContext';
import { FinancialsView } from './FinancialsView';
import { AccountingView } from './AccountingView';
import { 
  Users, 
  Landmark, 
  BookOpen, 
  TrendingUp, 
  CreditCard,
  Layers,
  Sparkles
} from 'lucide-react';

/**
 * FinanceAndAccountingView
 * نمای ادغام‌شده و جامع «حسابداری و امور مالی کارگاه»
 * 
 * شامل ۴ زیربرگه هوشمند و روان:
 * ۱. payroll: حسابداری پرسنل، تسویه‌حساب و پرداخت حقوق (FinancialsView)
 * ۲. treasury: خزانه‌داری، کارت‌ها و موجودی صندوق‌ها
 * ۳. ledger: دفتر کل اسناد مالی و تایید دو مرحله‌ای تراکنش‌ها
 * ۴. income: درآمدهای ورودی پروژه و تراز نقدینگی
 */
export function FinanceAndAccountingView({ initialSubTab = 'payroll' }) {
  const { language, direction } = useLanguage();
  const { currentProject } = useProject();
  const isRtl = direction === 'rtl';

  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);

  // پیکربندی زیربرگه‌های ناوبری
  const subTabs = [
    {
      id: 'payroll',
      label: language === 'fa' ? 'حسابداری پرسنل و تسویه‌ها' : language === 'ku' ? 'حیساباتی کرێکاران و تەسویە' : 'Payroll & Settlements',
      description: language === 'fa' ? 'محاسبه کارکرد، مساعده و تسویه حقوق نیروها' : 'ئامار و تەسویەی مووچەی کرێکاران',
      icon: Users
    },
    {
      id: 'treasury',
      label: language === 'fa' ? 'خزانه‌داری و کارت‌های بانکی' : language === 'ku' ? 'خەزێنەداری و کارتەکان' : 'Treasury & Accounts',
      description: language === 'fa' ? 'موجودی کارت‌ها، صندوق نقدی و انتقال وجه' : 'باڵانسی سندوقەکان و کارتە بانکییەکان',
      icon: CreditCard
    },
    {
      id: 'ledger',
      label: language === 'fa' ? 'دفتر کل و اسناد مالی' : language === 'ku' ? 'دەفتەری گشتی و بەڵگەنامەکان' : 'General Ledger',
      description: language === 'fa' ? 'رهگیری تراکنش‌ها، اسناد و تایید دو مرحله‌ای' : 'تۆماری گشتی مامەڵە داراییەکان',
      icon: BookOpen
    },
    {
      id: 'income',
      label: language === 'fa' ? 'درآمدها و تزریق نقدینگی' : language === 'ku' ? 'داهات و پارەی پڕۆژە' : 'Income & Inflow',
      description: language === 'fa' ? 'شارژ تنخواه، واریزی‌های کارفرما و تراز' : 'تۆمارکردنی داهاتی نوێی کارگە',
      icon: TrendingUp
    }
  ];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* هدر صفحه و بار زیرناوبری (Sub-Navigation Liquid Dock) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* عنوان ماژول جامع */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
              <Landmark className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {language === 'fa' ? 'حسابداری و امور مالی' : language === 'ku' ? 'حیسابداری و کاروباری دارایی' : 'Finance & Accounting'}
                </h2>
                <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                  {currentProject?.name || 'KarSync'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subTabs.find(t => t.id === activeSubTab)?.description}
              </p>
            </div>
          </div>

          {/* نوار زیربرگه‌ها (Liquid Tabs Selector) */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto scrollbar-none">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/60 dark:border-slate-800'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-500' : 'opacity-60'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ناحیه رندر محتوا بر اساس زیربرگه فعال */}
      <div className="relative">
        {activeSubTab === 'payroll' && (
          <div className="animate-in fade-in duration-150">
            <FinancialsView />
          </div>
        )}

        {activeSubTab === 'treasury' && (
          <div className="animate-in fade-in duration-150">
            {/* نمایش بخش خزانه‌داری از طریق AccountingView با ساب‌تب معادل */}
            <AccountingView initialSubTab="accounts" hideInternalSubNav={true} />
          </div>
        )}

        {activeSubTab === 'ledger' && (
          <div className="animate-in fade-in duration-150">
            {/* نمایش دفتر کل تراکنش‌ها */}
            <AccountingView initialSubTab="ledger" hideInternalSubNav={true} />
          </div>
        )}

        {activeSubTab === 'income' && (
          <div className="animate-in fade-in duration-150">
            {/* نمایش درآمدها و تزریق نقدینگی */}
            <AccountingView initialSubTab="income" hideInternalSubNav={true} />
          </div>
        )}
      </div>
    </div>
  );
}
