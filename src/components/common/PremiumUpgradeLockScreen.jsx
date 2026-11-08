import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { 
  Sparkles, 
  Lock, 
  Crown, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Receipt, 
  Calculator, 
  ExternalLink,
  MessageCircle
} from 'lucide-react';

export function PremiumUpgradeLockScreen({ tab = 'accounting', onBack }) {
  const { language, direction } = useLanguage();
  const isRtl = direction === 'rtl';

  const isAccounting = tab === 'accounting' || tab === 'financials';

  const titles = {
    fa: {
      badge: 'ویژه نسخه پریمیوم کارسینک',
      heading: isAccounting ? 'ماژول حسابداری دوبل و دفاتر مالی' : 'مدیریت پیشرفته مخارج، تنخواه و هزینه‌ها',
      subheading: 'این بخش در پلن پایه (Basic) غیرفعال است. جهت ثبت اسناد، تفکیک سرفصل‌ها و گزارشات مالی، به پلن پریمیوم ارتقا دهید.',
      featuresTitle: 'امکاناتی که با فعال‌سازی پریمیوم در اختیارتان قرار می‌گیرد:',
      features: [
        'سیستم حسابداری دوبل (Double-Entry) استاندارد شرکتی و دفاتر کل و معین',
        'مدیریت چندحسابه (صندوق نقدی کارگاه، کارت‌های بانکی تنخواه، حساب کارفرما)',
        'ثبت، تفکیک و آنالیز هوشمند سرفصل‌های هزینه و نمودار جریان وجوه نقد',
        'صدور فیش و برگه رسمی سند مالی با قابلیت چاپ A4 / A5 و خروجی PDF/Excel',
        'مغایرت‌گیری بانکی، تراز مالی آزمایشی و رهگیری زنجیره تایید اسناد'
      ],
      currentPlanNotice: 'پلن فعلی کارگاه شما: پایه (Basic) - شامل حضور و غیاب، کارکرد و مساعده پرسنل',
      btnUpgrade: 'درخواست فعال‌سازی پلن پریمیوم',
      btnBack: 'بازگشت به داشبورد'
    },
    ku: {
      badge: 'تایبەت بە وەشانی پریمیۆمی KarSync',
      heading: isAccounting ? 'مۆدیوولی ژمێریاری و بەڵگەنامە داراییەکان' : 'بەڕێوەبردنی پێشکەوتووی خەرجی و سەرپەرشتی',
      subheading: 'ئەم بەشە لە پلانی بنەڕەتی (Basic) ناچالاکە. بۆ تۆمارکردنی بەڵگەنامە و ترازنامەی دارایی، پلانی خۆت بۆ پریمیۆم بەرز بکەرەوە.',
      featuresTitle: 'ئەو تایبەتمەندییانەی بە کاراکردنی پریمیۆم دەستت دەکەوێت:',
      features: [
        'سیستەمی ژمێریاری دوولایەنە (Double-Entry) بە ستانداردی کۆمپانیاکان',
        'بەڕێوەبردنی فرەژمێرەیی (سندووقی کاش، کارتەکانی بانکی و حسابی خاوەنکار)',
        'تۆمارکردن، جیاکردنەوە و شیکاریی زیرەکانەی خەرجییەکان',
        'دەرکردنی پسوولەی فەرمیی خەرجی و چاپکردنی A4 / A5',
        'ترازی دارایی، چاودێری بانک و زنجیرەی پەسەندکردنی بەڵگەنامە داراییەکان'
      ],
      currentPlanNotice: 'پلانی ئێستای کارگاکەت: بنەڕەتی (Basic) - تایبەت بە ئامادەبوون و مووچەی کارمەندان',
      btnUpgrade: 'داواکاریی کاراکردنی پریمیۆم',
      btnBack: 'گەڕانەوە بۆ داشبۆرد'
    },
    en: {
      badge: 'KarSync Premium Edition Feature',
      heading: isAccounting ? 'Double-Entry Accounting & Financial Ledgers' : 'Advanced Expense & Petty Cash Management',
      subheading: 'This module is restricted under the Basic Plan. Upgrade to Premium to unlock double-entry vouchers, account ledgers, and financial cashflow analytics.',
      featuresTitle: 'Features unlocked with KarSync Premium:',
      features: [
        'Standard double-entry accounting matrix with general & subsidiary ledgers',
        'Multi-account treasury (workshop cashbox, bank debit cards, client accounts)',
        'Smart category tagging, expense allocation, and real-time cashflow analytics',
        'Official voucher issuance with A4/A5 slip printing and PDF/Excel export',
        'Bank reconciliation, trial balance, and multi-tier approval audit trail'
      ],
      currentPlanNotice: 'Your current workshop tier: Basic - includes personnel attendance and payroll',
      btnUpgrade: 'Request Premium Activation',
      btnBack: 'Return to Dashboard'
    }
  };

  const text = titles[language] || titles.fa;

  return (
    <div className="relative min-h-[75vh] flex items-center justify-center p-4 sm:p-8">
      {/* Background ambient glowing spheres */}
      <div className="absolute top-1/4 -right-12 w-96 h-96 bg-amber-400/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-12 w-96 h-96 bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative w-full max-w-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-center overflow-hidden">
        
        {/* Top Glow Accent Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-rose-400 to-primary" />

        {/* Floating Crown / Lock Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-primary/20 to-rose-500/20 border border-amber-300/40 dark:border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10 mb-6 relative group">
          <Crown className="w-10 h-10 text-amber-500 dark:text-amber-400 animate-pulse" />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>{text.badge}</span>
        </div>

        {/* Heading & Subtitle */}
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
          {text.heading}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed mb-6">
          {text.subheading}
        </p>

        {/* Features Checklist Panel */}
        <div className="bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-slate-700/60 text-start mb-6">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{text.featuresTitle}</span>
          </h4>
          <ul className="space-y-2.5">
            {text.features.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Current Plan Notice */}
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-6 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30 rounded-xl py-2 px-3">
          {text.currentPlanNotice}
        </div>

        {/* Actions Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="https://t.me/afshineem"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold text-xs shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{text.btnUpgrade}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
            >
              {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              <span>{text.btnBack}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
