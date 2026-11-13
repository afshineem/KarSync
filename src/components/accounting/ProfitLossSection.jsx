import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  PieChart, 
  Layers, 
  ShieldCheck, 
  Building2, 
  Users, 
  Truck, 
  Hammer, 
  Receipt, 
  FileSpreadsheet, 
  Percent, 
  ArrowDownLeft, 
  ArrowUpRight, 
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Printer
} from 'lucide-react';

const COPY = {
  fa: {
    title: 'صورت سود و زیان کارگاه (P&L)',
    subtitle: 'محاسبه دقیق درآمدهای عملیاتی، بهای تمام‌شده مستقیم، سربار، بیمه، مالیات و سود خالص',
    basisLabel: 'مبنای محاسبه هزینه:',
    basisRealized: 'تسویه قطعی و پرداخت‌های انجام‌شده (تحقق‌یافته)',
    basisRealizedShort: 'پرداخت‌های قطعی',
    basisRealizedDesc: 'مناسب برای پایان پروژه؛ صرفاً مبالغ پرداخت‌شده به پرسنل و تسویه‌های انجام‌شده کسر می‌گردد.',
    basisAccrual: 'ارزیابی تعهدی پروژه در جریان (کل کارکرد شیفت‌ها)',
    basisAccrualShort: 'تعهدی (کارکرد ثبت‌شده)',
    basisAccrualDesc: 'مناسب برای پروژه‌های در جریان؛ ارزش تمام شیفت‌ها و ساعات کارکرد ثبت‌شده کسر می‌گردد.',
    
    // KPI Cards
    grossProfitTitle: 'سود (زیان) ناخالص کارگاه',
    grossMargin: 'حاشیه سود ناخالص:',
    grossProfitDesc: 'کل درآمد کارفرما منهای بهای تمام‌شده مستقیم (پرسنل + مصالح + ماشین‌آلات)',
    netProfitTitle: 'سود (زیان) خالص نهایی کارگاه',
    netMargin: 'حاشیه سود خالص:',
    netProfitDesc: 'سود ناخالص منهای هزینه‌های سربار، اسکان، بیمه، مالیات و کارمزد بانکی',
    
    // Status badges
    statusProfitable: 'کارگاه در وضعیت سوددهی',
    statusLoss: 'کارگاه در وضعیت زیان‌دهی',
    statusGrossProfitable: 'سود ناخالص مثبت',
    statusGrossLoss: 'زیان ناخالص مستقیم',
    
    // Waterfall metrics
    cogsShare: 'سهم بهای تمام‌شده مستقیم:',
    laborShare: 'سهم هزینه پرسنل:',
    indirectShare: 'سهم سربار و کسورات قانونی:',
    netShare: 'بازدهی خالص پروژه:',
    
    // Statement Table Sections
    tableColItem: 'شرح ردیف صورت مالی',
    tableColCode: 'کد سرفصل',
    tableColAmount: 'مبلغ به ارز پایه',
    tableColRatio: 'نسبت از کل درآمد',

    secRevenues: '۱. درآمدهای عملیاتی و دریافتی‌های پروژه',
    rowEmployerInflows: 'دریافتی صورت‌وضعیت‌ها و واریزی‌های کارفرمایان',
    rowScrapAndServices: 'درآمد فروش ضایعات، مصالح مازاد و ارائه خدمات کارگاهی',
    rowOtherInflows: 'تزریق نقدینگی، پیش‌دریافت و سایر درآمدهای خزانه‌داری',
    totalRevenues: 'جمع کل درآمدهای عملیاتی کارگاه',

    secCOGS: '۲. بهای تمام‌شده مستقیم کارگاه (Direct Costs - COGS)',
    rowLaborCostRealized: 'دستمزد و تسویه‌حساب‌های قطعی پرداخت‌شده به پرسنل',
    rowLaborCostAccrual: 'ارزش تعهدی کل کارکرد، اضافه‌کاری و شیفت‌های ثبت‌شده پرسنل',
    rowLaborDetails: (adv, sett, bon) => `(مساعده: ${adv} | تسویه‌ها: ${sett} | پاداش: ${bon})`,
    rowLaborAccrualDetails: (days, hours) => `(${days} نفر-روز کارکرد | ${hours} ساعت اضافه‌کاری)`,
    rowMaterials: 'مصالح و متریال مستقیم مصرفی کارگاه (سیمان، آهن‌آلات، بتن و...)',
    rowEquipment: 'اجاره ماشین‌آلات، بالابر، سوخت دستگاه‌ها، ابزارآلات و ترابری',
    rowSubcontractors: 'پیمانکاران جزء، اکیپ‌های تخصصی و خدمات فنی مهندسی',
    totalCOGS: 'جمع کل بهای تمام‌شده مستقیم کارگاه',

    rowGrossProfit: 'سود (زیان) ناخالص پروژه (Gross Profit / Loss)',

    secIndirect: '۳. هزینه‌های عمومی، سربار کارگاه و کسورات قانونی',
    rowOverhead: 'هزینه‌های سربار جاری، اسکان، پذیرایی، ایمنی و بهداشت کارگاه (HSE)',
    rowInsurance: 'حق بیمه تأمین اجتماعی کارگاه، سهم کارفرما و مفاصاحساب پیمان',
    rowTax: 'مالیات تکلیفی قرارداد، ارزش افزوده و مالیات عملکرد کارگاه',
    rowFinancial: 'کارمزد خدمات بانکی، پایا/ساتنا و هزینه‌های تامین مالی',
    totalIndirect: 'جمع کل هزینه‌های سربار، اداری، بیمه و مالیات',

    rowNetProfit: 'سود (زیان) خالص نهایی کارگاه (Net Profit / Loss)',

    printStatement: 'چاپ صورت مالی',
    expensesCountNote: (cnt) => `محاسبه بر اساس ${cnt} ردیف سند و هزینه ثبت‌شده در دیتابیس`,
    noDataNotice: 'هنوز درآمد یا هزینه‌ای در این بازه زمانی برای پروژه ثبت نشده است.'
  },
  ku: {
    title: 'خشتەی سوود و زیانی کارگە (P&L)',
    subtitle: 'حیساباتی وردی داهات، تێچووی تەواوبوو، خەرجییە گشتییەکان، باج، بیمە و سوودی پوخت',
    basisLabel: 'بنەمای حیساباتی تێچوو:',
    basisRealized: 'تەسویەی کۆتایی و پارەدانە ئەنجامدراوەکان (یەکلابووەوە)',
    basisRealizedShort: 'پارەدانی یەکلابووەوە',
    basisRealizedDesc: 'گونجاوە بۆ دوای تەواوبوونی پڕۆژە؛ تەنها ئەو بڕانەی بە کردەیی دراون بە کرێکاران حیساب دەکرێن.',
    basisAccrual: 'هەڵسەنگاندنی بەڵێننامەیی پڕۆژە (کۆی کارکردی شفتەکان)',
    basisAccrualShort: 'تەعەهودی (کارکردی تۆمارکراو)',
    basisAccrualDesc: 'گونجاوە بۆ پڕۆژەی بەردەوام؛ نرخی هەموو شفتەکان و کاتژمێرەکانی کارکردنی تۆمارکراو لێدەردەکرێن.',
    
    // KPI Cards
    grossProfitTitle: 'سوود (زیان)ی ناخاڵی کارگە',
    grossMargin: 'ڕێژەی سوودی ناخاڵ:',
    grossProfitDesc: 'کۆی داهات منهای تێچووی ڕاستەوخۆ (کرێکار + کەرەستە + ئامێرەکان)',
    netProfitTitle: 'سوود (زیان)ی پوختی کۆتایی کارگە',
    netMargin: 'ڕێژەی سوودی پوخت:',
    netProfitDesc: 'سوودی ناخاڵ منهای خەرجییەکانی مانەوە، بیمە، باج و کرێی بانک',
    
    // Status badges
    statusProfitable: 'کارگە لە دۆخی قازانجدایە',
    statusLoss: 'کارگە لە دۆخی زیاندایە',
    statusGrossProfitable: 'سوودی ناخاڵی ئەرێنی',
    statusGrossLoss: 'زیانی ناخاڵی ڕاستەوخۆ',
    
    // Waterfall metrics
    cogsShare: 'پشکی تێچووی ڕاستەوخۆ:',
    laborShare: 'پشکی تێچووی کرێکاران:',
    indirectShare: 'پشکی خەرجی گشتی و یاسایی:',
    netShare: 'بەرهەمی پوختی پڕۆژە:',
    
    // Statement Table Sections
    tableColItem: 'شیکردنەوەی خشتەی دارایی',
    tableColCode: 'کۆدی سەرفەسڵ',
    tableColAmount: 'بڕ بە دراوی بنەڕەتی',
    tableColRatio: 'ڕێژە لە کۆی داهات',

    secRevenues: '١. داهاتە کارپێکردنەکان و وەرگیراوەکانی پڕۆژە',
    rowEmployerInflows: 'وەرگیراوەکانی صورت‌وەزعییەت و پارەدانی خاوەنکار',
    rowScrapAndServices: 'داهاتی فرۆشتنی کەرەستەی زیادە و خزمەتگوزارییەکانی کارگە',
    rowOtherInflows: 'نەختینەی تر و داهاتەکانی خەزێنەداری',
    totalRevenues: 'کۆی گشتی داهاتەکانی کارگە',

    secCOGS: '٢. تێچووی تەواوبووی ڕاستەوخۆ (Direct Costs - COGS)',
    rowLaborCostRealized: 'دەستحەق و تەسویە یەکلابووەوە دراوەکان بە کرێکاران',
    rowLaborCostAccrual: 'نرخی تەعەهودی گشت کارکرد و زیادەکاری تۆمارکراوی کرێکاران',
    rowLaborDetails: (adv, sett, bon) => `(پێشەکی: ${adv} | تەسویەکان: ${sett} | پاداشت: ${bon})`,
    rowLaborAccrualDetails: (days, hours) => `(${days} ڕۆژ-کرێکار | ${hours} کاتژمێر زیادەکاری)`,
    rowMaterials: 'کەرەستە و ماتریالی ڕاستەوخۆی بەکارهاتوو (چیمەنتۆ، شیش، کۆنکرێت...)',
    rowEquipment: 'کرێی ئامێرەکان، بەرزکەرەوە، سووتەمەنی و گواستنەوە',
    rowSubcontractors: 'پەیمانکارانی دەستی دووەم و خزمەتگوزارییە ئەندازیارییەکان',
    totalCOGS: 'کۆی گشتی تێچووی تەواوبووی ڕاستەوخۆ',

    rowGrossProfit: 'سوود (زیان)ی ناخاڵی پڕۆژە (Gross Profit / Loss)',

    secIndirect: '٣. خەرجییە گشتییەکان، سەربار و بڕینە یاسایییەکان',
    rowOverhead: 'خەرجی مانەوە، خواردن، تەندروستی و سەلامەتی کارگە (HSE)',
    rowInsurance: 'بیمەی کۆمەڵایەتی کارگە و کرێکاران',
    rowTax: 'باجی گرێبەست و باجی داهاتی کارگە',
    rowFinancial: 'کرێی خزمەتگوزارییە بانکییەکان و سزاکان',
    totalIndirect: 'کۆی گشتی خەرجییە گشتییەکان، بیمە و باج',

    rowNetProfit: 'سوود (زیان)ی پوختی کۆتایی کارگە (Net Profit / Loss)',

    printStatement: 'چاپکردنی خشتەی دارایی',
    expensesCountNote: (cnt) => `حیسابکراوە لەسەر بنەمای ${cnt} بەڵگەنامەی تۆمارکراو لە داتابەیس`,
    noDataNotice: 'هێشتا هیچ داهات یان خەرجییەک لەم مەودایەدا تۆمار نەکراوە.'
  },
  en: {
    title: 'Workshop Profit & Loss Statement (P&L)',
    subtitle: 'Comprehensive calculation of revenues, direct COGS, overhead, insurance, taxes and net profit',
    basisLabel: 'Cost Recognition Basis:',
    basisRealized: 'Final Settled & Disbursed Payments (Realized)',
    basisRealizedShort: 'Realized Paid Costs',
    basisRealizedDesc: 'Ideal for completed projects; recognizes actual cash payments and settled receipts.',
    basisAccrual: 'Ongoing Project Work Valuation (Accrual Shifts)',
    basisAccrualShort: 'Accrual (Logged Work)',
    basisAccrualDesc: 'Ideal for in-progress projects; recognizes total accrued value of recorded shifts & overtime.',
    
    // KPI Cards
    grossProfitTitle: 'Workshop Gross Profit / Loss',
    grossMargin: 'Gross Profit Margin:',
    grossProfitDesc: 'Total revenue minus direct costs of labor, materials, equipment and subcontractors',
    netProfitTitle: 'Workshop Net Profit / Loss',
    netMargin: 'Net Profit Margin:',
    netProfitDesc: 'Gross profit minus site overhead, accommodation, HSE, insurance, taxes and bank fees',
    
    // Status badges
    statusProfitable: 'Workshop Operating with Net Profit',
    statusLoss: 'Workshop Operating with Net Loss',
    statusGrossProfitable: 'Positive Gross Profit',
    statusGrossLoss: 'Direct Gross Loss',
    
    // Waterfall metrics
    cogsShare: 'Direct COGS Share:',
    laborShare: 'Labor Cost Share:',
    indirectShare: 'Overhead & Taxes Share:',
    netShare: 'Net Return on Revenue:',
    
    // Statement Table Sections
    tableColItem: 'Financial Statement Line Item',
    tableColCode: 'COA Code',
    tableColAmount: 'Amount in Base Currency',
    tableColRatio: '% of Total Revenue',

    secRevenues: '1. Operating Revenues & Project Inflows',
    rowEmployerInflows: 'Client Progress Billings & Employer Certified Payments',
    rowScrapAndServices: 'Scrap & Surplus Material Sales, Equipment Rental Services',
    rowOtherInflows: 'Petty Cash Funding, Advances & Treasury Inflows',
    totalRevenues: 'Total Operating Revenues',

    secCOGS: '2. Direct Project Costs (Cost of Goods / Work - COGS)',
    rowLaborCostRealized: 'Direct Staff Wages, Advances & Final Settlements Paid',
    rowLaborCostAccrual: 'Accrued Value of Recorded Shifts, Labor Hours & Overtime',
    rowLaborDetails: (adv, sett, bon) => `(Advances: ${adv} | Settlements: ${sett} | Bonuses: ${bon})`,
    rowLaborAccrualDetails: (days, hours) => `(${days} Man-Days | ${hours}h Overtime)`,
    rowMaterials: 'Direct Construction Materials Consumed (Cement, Rebar, Concrete...)',
    rowEquipment: 'Equipment Rental, Hoists, Fuel, Machinery Maintenance & Haulage',
    rowSubcontractors: 'Subcontractors, Trade Crews & Site Engineering Services',
    totalCOGS: 'Total Direct Project Costs (COGS)',

    rowGrossProfit: 'Project Gross Profit / Loss',

    secIndirect: '3. General, Administrative, Overhead & Statutory Deductions',
    rowOverhead: 'Site Camp, Accommodation, Catering, Utilities & Safety (HSE)',
    rowInsurance: 'Social Security Insurance (Site, Employer Share & Clearance)',
    rowTax: 'Contract Withholding Tax, VAT & Business Income Tax',
    rowFinancial: 'Bank Processing Fees, Fund Transfer Charges & Financing Costs',
    totalIndirect: 'Total Overhead, Administrative, Insurance & Tax Expenses',

    rowNetProfit: 'Final Workshop Net Profit / Loss',

    printStatement: 'Print Statement',
    expensesCountNote: (cnt) => `Calculated across ${cnt} verified transactions in database`,
    noDataNotice: 'No revenue or expense records found for this project in the selected period.'
  }
};

export function ProfitLossSection({
  profitAndLossData,
  basis = 'realized',
  onBasisChange,
  currency = 'IQD',
  language = 'fa'
}) {
  const txt = COPY[language] || COPY.fa;
  const pnl = profitAndLossData;

  if (!pnl) return null;

  const { revenues, labor, directCosts, grossProfit, indirectCosts, netProfit } = pnl;
  const isNetPositive = netProfit.isPositive;
  const isGrossPositive = grossProfit.isPositive;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* هدر بخش و انتخابگر مبنای تعهدی / تحقق‌یافته */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs">
                <Scale className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {txt.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {txt.subtitle}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* کلید پرینت صورت مالی */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all shadow-xs"
              title={txt.printStatement}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{txt.printStatement}</span>
            </button>

            {/* کنترل سوئیچ مبنای هزینه (Segmented Control) */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => onBasisChange && onBasisChange('realized')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  basis === 'realized'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={txt.basisRealizedDesc}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{txt.basisRealizedShort}</span>
              </button>

              <button
                type="button"
                onClick={() => onBasisChange && onBasisChange('accrual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  basis === 'accrual'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={txt.basisAccrualDesc}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{txt.basisAccrualShort}</span>
              </button>
            </div>
          </div>
        </div>

        {/* یادداشت راهنمای حالت فعال */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <HelpCircle className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
          <span>{basis === 'realized' ? txt.basisRealizedDesc : txt.basisAccrualDesc}</span>
        </div>
      </div>

      {/* کارت‌های شاخص کلیدی کلان (Hero KPI Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ۱. کارت سود / زیان ناخالص (Gross Profit) */}
        <div
          className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border backdrop-blur-md transition-all duration-200 ${
            isGrossPositive
              ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07] border-emerald-300/80 dark:border-emerald-800/80 shadow-sm'
              : 'bg-rose-500/[0.04] dark:bg-rose-500/[0.07] border-rose-300/80 dark:border-rose-800/80 shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {txt.grossProfitTitle}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isGrossPositive
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {isGrossPositive ? txt.statusGrossProfitable : txt.statusGrossLoss}
                </span>
              </div>

              <div
                className={`text-2xl sm:text-3xl font-black font-mono mt-2 tracking-tight ${
                  isGrossPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(grossProfit.amount, currency, language)}
              </div>
            </div>

            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border ${
                isGrossPositive
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              }`}
            >
              {isGrossPositive ? (
                <TrendingUp className="w-6 h-6 stroke-[2.2]" />
              ) : (
                <TrendingDown className="w-6 h-6 stroke-[2.2]" />
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {txt.grossMargin}
            </span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                isGrossPositive
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
              }`}
            >
              {grossProfit.marginPercent}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            {txt.grossProfitDesc}
          </p>
        </div>

        {/* ۲. کارت سود / زیان خالص نهایی (Net Profit) */}
        <div
          className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border backdrop-blur-md transition-all duration-200 ${
            isNetPositive
              ? 'bg-sky-500/[0.04] dark:bg-sky-500/[0.07] border-sky-300/80 dark:border-sky-800/80 shadow-sm'
              : 'bg-amber-500/[0.04] dark:bg-amber-500/[0.07] border-amber-300/80 dark:border-amber-800/80 shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {txt.netProfitTitle}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isNetPositive
                      ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {isNetPositive ? txt.statusProfitable : txt.statusLoss}
                </span>
              </div>

              <div
                className={`text-2xl sm:text-3xl font-black font-mono mt-2 tracking-tight ${
                  isNetPositive ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {formatCurrency(netProfit.amount, currency, language)}
              </div>
            </div>

            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border ${
                isNetPositive
                  ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              }`}
            >
              {isNetPositive ? (
                <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
              ) : (
                <AlertCircle className="w-6 h-6 stroke-[2.2]" />
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {txt.netMargin}
            </span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                isNetPositive
                  ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
              }`}
            >
              {netProfit.marginPercent}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            {txt.netProfitDesc}
          </p>
        </div>
      </div>

      {/* نوار تحلیلی جریان نقدینگی و سهم مصارف (Waterfall Ratio Bar) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-sky-500" />
            <span>{language === 'fa' ? 'ترکیب و سهم مصارف از کل درآمد عملیاتی' : language === 'ku' ? 'دابەشبوونی خەرجییەکان لە کۆی داهات' : 'Expenditure Breakdown of Operating Revenue'}</span>
          </span>
          <span className="font-mono text-slate-500">
            {formatCurrency(revenues.totalRevenue, currency, language)} (100%)
          </span>
        </div>

        {/* نوار چندبخشی پیشرفت */}
        <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          {/* سهم پرسنل */}
          <div
            style={{ width: `${Math.min(100, labor.laborRatio || 0)}%` }}
            className="bg-indigo-500 h-full transition-all duration-500"
            title={`${txt.laborShare} ${labor.laborRatio}%`}
          />
          {/* سهم مصالح و ماشین‌آلات */}
          <div
            style={{ width: `${Math.min(100, Math.max(0, (directCosts.cogsRatio || 0) - (labor.laborRatio || 0)))}%` }}
            className="bg-amber-500 h-full transition-all duration-500"
            title={`${txt.cogsShare} ${(directCosts.cogsRatio || 0) - (labor.laborRatio || 0)}%`}
          />
          {/* سهم سربار، بیمه و مالیات */}
          <div
            style={{ width: `${Math.min(100, indirectCosts.overheadRatio || 0)}%` }}
            className="bg-rose-400 h-full transition-all duration-500"
            title={`${txt.indirectShare} ${indirectCosts.overheadRatio}%`}
          />
        </div>

        {/* لجند راهنمای نوار */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">{txt.laborShare}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 ml-auto">
              {labor.laborRatio}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">{txt.cogsShare}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 ml-auto">
              {directCosts.cogsRatio}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 flex-shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">{txt.indirectShare}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 ml-auto">
              {indirectCosts.overheadRatio}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isNetPositive ? 'bg-sky-500' : 'bg-slate-400'
              }`}
            />
            <span className="text-slate-500 dark:text-slate-400">{txt.netShare}</span>
            <span
              className={`font-mono font-bold ml-auto ${
                isNetPositive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'
              }`}
            >
              {netProfit.marginPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* جدول استاندارد صورت سود و زیان کارگاه (P&L Financial Statement) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                <th className="py-3 px-4 text-start font-bold">{txt.tableColItem}</th>
                <th className="py-3 px-3 text-center w-24 font-bold">{txt.tableColCode}</th>
                <th className="py-3 px-4 text-end w-44 font-bold">{txt.tableColAmount}</th>
                <th className="py-3 px-3 text-end w-28 font-bold">{txt.tableColRatio}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {/* بخش ۱: درآمدها */}
              <tr className="bg-sky-50/50 dark:bg-sky-950/30 font-bold text-sky-800 dark:text-sky-300">
                <td colSpan={4} className="py-2.5 px-4 text-xs font-black tracking-wide">
                  {txt.secRevenues}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                  <span>{txt.rowEmployerInflows}</span>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">6010</td>
                <td className="py-2.5 px-4 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(revenues.employerInflow, currency, language)}
                </td>
                <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                  {revenues.totalRevenue > 0 ? Math.round((revenues.employerInflow / revenues.totalRevenue) * 100) : 0}%
                </td>
              </tr>
              {revenues.scrapAndServiceInflow > 0 && (
                <tr>
                  <td className="py-2.5 px-4 flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                    <span>{txt.rowScrapAndServices}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">6101</td>
                  <td className="py-2.5 px-4 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(revenues.scrapAndServiceInflow, currency, language)}
                  </td>
                  <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                    {revenues.totalRevenue > 0 ? Math.round((revenues.scrapAndServiceInflow / revenues.totalRevenue) * 100) : 0}%
                  </td>
                </tr>
              )}
              {revenues.otherInflow > 0 && (
                <tr>
                  <td className="py-2.5 px-4 flex items-center gap-2">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                    <span>{txt.rowOtherInflows}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">6102</td>
                  <td className="py-2.5 px-4 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(revenues.otherInflow, currency, language)}
                  </td>
                  <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                    {revenues.totalRevenue > 0 ? Math.round((revenues.otherInflow / revenues.totalRevenue) * 100) : 0}%
                  </td>
                </tr>
              )}
              {/* جمع درآمد */}
              <tr className="bg-emerald-50/60 dark:bg-emerald-950/40 font-bold border-y border-emerald-200/80 dark:border-emerald-800/80">
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                  {txt.totalRevenues}
                </td>
                <td className="py-3 px-3 text-center font-mono text-xs text-emerald-700 dark:text-emerald-300">60</td>
                <td className="py-3 px-4 text-end font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatCurrency(revenues.totalRevenue, currency, language)}
                </td>
                <td className="py-3 px-3 text-end font-mono font-black text-emerald-700 dark:text-emerald-300">100%</td>
              </tr>

              {/* بخش ۲: بهای تمام شده مستقیم */}
              <tr className="bg-amber-50/50 dark:bg-amber-950/30 font-bold text-amber-800 dark:text-amber-300">
                <td colSpan={4} className="py-2.5 px-4 text-xs font-black tracking-wide">
                  {txt.secCOGS}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="font-bold">
                      {basis === 'realized' ? txt.rowLaborCostRealized : txt.rowLaborCostAccrual}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 ps-5">
                    {basis === 'realized'
                      ? txt.rowLaborDetails(
                          formatCurrency(labor.advancesPaid, currency, language),
                          formatCurrency(labor.settlementsPaid, currency, language),
                          formatCurrency(labor.bonusesPaid, currency, language)
                        )
                      : txt.rowLaborAccrualDetails(labor.accruedDaysTotal, labor.accruedHoursTotal)}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">7020</td>
                <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(labor.totalLaborCost, currency, language)}
                </td>
                <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                  {revenues.totalRevenue > 0 ? Math.round((labor.totalLaborCost / revenues.totalRevenue) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 flex items-center gap-2">
                  <Hammer className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>{txt.rowMaterials}</span>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">7010</td>
                <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(directCosts.directMaterialCost, currency, language)}
                </td>
                <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                  {revenues.totalRevenue > 0 ? Math.round((directCosts.directMaterialCost / revenues.totalRevenue) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>{txt.rowEquipment}</span>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">7040</td>
                <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(directCosts.directEquipmentCost, currency, language)}
                </td>
                <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                  {revenues.totalRevenue > 0 ? Math.round((directCosts.directEquipmentCost / revenues.totalRevenue) * 100) : 0}%
                </td>
              </tr>
              {directCosts.directSubcontractorCost > 0 && (
                <tr>
                  <td className="py-2.5 px-4 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span>{txt.rowSubcontractors}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">7030</td>
                  <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatCurrency(directCosts.directSubcontractorCost, currency, language)}
                  </td>
                  <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                    {revenues.totalRevenue > 0 ? Math.round((directCosts.directSubcontractorCost / revenues.totalRevenue) * 100) : 0}%
                  </td>
                </tr>
              )}
              {/* جمع بهای تمام شده مستقیم */}
              <tr className="bg-amber-50/60 dark:bg-amber-950/40 font-bold border-y border-amber-200/80 dark:border-amber-800/80">
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                  {txt.totalCOGS}
                </td>
                <td className="py-3 px-3 text-center font-mono text-xs text-amber-700 dark:text-amber-300">70</td>
                <td className="py-3 px-4 text-end font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                  ({formatCurrency(directCosts.totalDirectCOGS, currency, language)})
                </td>
                <td className="py-3 px-3 text-end font-mono font-black text-amber-700 dark:text-amber-300">
                  {directCosts.cogsRatio}%
                </td>
              </tr>

              {/* سطر پرچمدار سود / زیان ناخالص */}
              <tr
                className={`font-black border-y-2 ${
                  isGrossPositive
                    ? 'bg-emerald-100/70 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-100/70 dark:bg-rose-950/70 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                }`}
              >
                <td className="py-3.5 px-4 text-sm flex items-center gap-2">
                  {isGrossPositive ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{txt.rowGrossProfit}</span>
                </td>
                <td className="py-3.5 px-3 text-center font-mono text-xs">P&L-1</td>
                <td className="py-3.5 px-4 text-end font-mono text-base font-black">
                  {formatCurrency(grossProfit.amount, currency, language)}
                </td>
                <td className="py-3.5 px-3 text-end font-mono font-black">
                  {grossProfit.marginPercent}%
                </td>
              </tr>

              {/* بخش ۳: هزینه‌های سربار، بیمه، مالیات */}
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 font-bold text-slate-800 dark:text-slate-300">
                <td colSpan={4} className="py-2.5 px-4 text-xs font-black tracking-wide">
                  {txt.secIndirect}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span>{txt.rowOverhead}</span>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">80</td>
                <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(indirectCosts.overheadCost, currency, language)}
                </td>
                <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                  {revenues.totalRevenue > 0 ? Math.round((indirectCosts.overheadCost / revenues.totalRevenue) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                  <span>{txt.rowInsurance}</span>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">3020</td>
                <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(indirectCosts.insuranceCost, currency, language)}
                </td>
                <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                  {revenues.totalRevenue > 0 ? Math.round((indirectCosts.insuranceCost / revenues.totalRevenue) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                  <span>{txt.rowTax}</span>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">3030</td>
                <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(indirectCosts.taxCost, currency, language)}
                </td>
                <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                  {revenues.totalRevenue > 0 ? Math.round((indirectCosts.taxCost / revenues.totalRevenue) * 100) : 0}%
                </td>
              </tr>
              {indirectCosts.financialCost > 0 && (
                <tr>
                  <td className="py-2.5 px-4 flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span>{txt.rowFinancial}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">81</td>
                  <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatCurrency(indirectCosts.financialCost, currency, language)}
                  </td>
                  <td className="py-2.5 px-3 text-end font-mono text-slate-500">
                    {revenues.totalRevenue > 0 ? Math.round((indirectCosts.financialCost / revenues.totalRevenue) * 100) : 0}%
                  </td>
                </tr>
              )}
              {/* جمع هزینه‌های سربار و قانونی */}
              <tr className="bg-slate-100/80 dark:bg-slate-800/70 font-bold border-y border-slate-200 dark:border-slate-700">
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                  {txt.totalIndirect}
                </td>
                <td className="py-3 px-3 text-center font-mono text-xs text-slate-500">80+30</td>
                <td className="py-3 px-4 text-end font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                  ({formatCurrency(indirectCosts.totalIndirectCosts, currency, language)})
                </td>
                <td className="py-3 px-3 text-end font-mono font-black text-slate-700 dark:text-slate-300">
                  {indirectCosts.overheadRatio}%
                </td>
              </tr>

              {/* سطر طلایی و پایانی: سود / زیان خالص نهایی (Net Profit) */}
              <tr
                className={`font-black border-y-2 ${
                  isNetPositive
                    ? 'bg-sky-100/90 dark:bg-sky-950/90 border-sky-400 dark:border-sky-600 text-sky-950 dark:text-sky-100'
                    : 'bg-amber-100/90 dark:bg-amber-950/90 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100'
                }`}
              >
                <td className="py-4 px-4 text-sm sm:text-base flex items-center gap-2.5">
                  {isNetPositive ? (
                    <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  )}
                  <span>{txt.rowNetProfit}</span>
                </td>
                <td className="py-4 px-3 text-center font-mono text-xs font-black">NET</td>
                <td
                  className={`py-4 px-4 text-end font-mono text-lg sm:text-xl font-black ${
                    isNetPositive ? 'text-sky-700 dark:text-sky-300' : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {formatCurrency(netProfit.amount, currency, language)}
                </td>
                <td
                  className={`py-4 px-3 text-end font-mono text-base font-black ${
                    isNetPositive ? 'text-sky-700 dark:text-sky-300' : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {netProfit.marginPercent}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* فوتر جدول با یادداشت آماری */}
        <div className="py-2.5 px-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{txt.expensesCountNote(pnl.expensesCount)}</span>
          <span className="font-mono">{new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'fa-IR')}</span>
        </div>
      </div>
    </div>
  );
}
