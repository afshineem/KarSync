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
      label: language === 'fa' ? 'تسویه پرسنل' : language === 'ku' ? 'تەسویەی کرێکاران' : 'Payroll Settlements',
      description: language === 'fa' ? 'محاسبه کارکرد، مساعده و تسویه حقوق نیروها' : 'ئامار و تەسویەی مووچەی کرێکاران',
      icon: Users
    },
    {
      id: 'treasury',
      label: language === 'fa' ? 'حساب‌ها' : language === 'ku' ? 'حیسابەکان' : 'Accounts',
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
      label: language === 'fa' ? 'درآمد' : language === 'ku' ? 'داهات' : 'Income',
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
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {language === 'fa' ? 'حسابداری و امور مالی' : language === 'ku' ? 'حیسابداری و کاروباری دارایی' : 'Finance & Accounting'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subTabs.find(t => t.id === activeSubTab)?.description}
              </p>
            </div>
          </div>

          {/* نوار زیربرگه‌ها (بدون هیچ‌گونه اسکرول عمودی/افقی، با بسته‌بندی خودکار در صفحه کوچک) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white/40 dark:bg-white/[0.05] backdrop-blur-2xl backdrop-saturate-200 border border-slate-200/80 dark:border-white/10 shadow-xs">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <div key={tab.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab(tab.id)}
                    aria-label={tab.label}
                    className={`relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/25 font-bold border border-sky-400/30'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <Icon className="w-5 h-5 transition-transform duration-200" />
                    
                    {/* برچسب متن فقط برای تب فعال با متن سفید */}
                    {isActive && (
                      <span className="text-xs font-semibold px-1 whitespace-nowrap">
                        {tab.label}
                      </span>
                    )}

                    {/* نقطه نشانگر زیر تب فعال */}
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-xs" />
                    )}
                  </button>

                  {/* تول‌تیپ راهنما هنگام هاور روی تب‌های غیرفعال */}
                  {!isActive && (
                    <div className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50">
                      {tab.label}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-slate-900/90 border-b-4 border-x-transparent border-x-4 border-t-0" />
                    </div>
                  )}
                </div>
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
            <AccountingView initialSubTab="accounts" hideInternalSubNav={true} hideHeader={true} />
          </div>
        )}

        {activeSubTab === 'ledger' && (
          <div className="animate-in fade-in duration-150">
            {/* نمایش دفتر کل تراکنش‌ها */}
            <AccountingView initialSubTab="ledger" hideInternalSubNav={true} hideHeader={true} />
          </div>
        )}

        {activeSubTab === 'income' && (
          <div className="animate-in fade-in duration-150">
            {/* نمایش درآمدها و تزریق نقدینگی */}
            <AccountingView initialSubTab="income" hideInternalSubNav={true} hideHeader={true} />
          </div>
        )}
      </div>
    </div>
  );
}
