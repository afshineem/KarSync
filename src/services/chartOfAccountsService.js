import { db, generateAccountNodeId, DEFAULT_PROJECT_ID } from '../db/db';

/**
 * chartOfAccountsService.js
 * Comprehensive Corporate & Contracting Chart of Accounts (COA)
 * Standard 4-digit coding: Group (1-digit) ➡️ General Ledger (2-digit) ➡️ Subsidiary Ledger (4-digit)
 * with Floating Detailed Sub-ledger integration (بانک‌ها، صندوق‌ها، پرسنل، پیمانکاران، پروژه‌ها)
 */

export const NATURES = {
  debtor: { id: 'debtor', fa: 'بدهکار', ku: 'قەرزدار (بدهکار)', en: 'Debtor' },
  creditor: { id: 'creditor', fa: 'بستانکار', ku: 'قەرزدەر (بستانکار)', en: 'Creditor' },
  both: { id: 'both', fa: 'دوطرفه / خنثی', ku: 'دوولایەنە', en: 'Dual / Off-balance' }
};

export const DEFAULT_CHART_OF_ACCOUNTS = [
  // ==========================================
  // گروه ۱: دارایی‌های جاری (Current Assets)
  // ==========================================
  { code: '1', level: 1, parentCode: null, nature: 'debtor', isSystem: true,
    title: 'دارایی‌های جاری', title_ku: 'دارایییە بەردەستەکان (جاری)', title_en: 'Current Assets' },

  // کل ۱۰: موجودی نقد و بانک
  { code: '10', level: 2, parentCode: '1', nature: 'debtor', isSystem: true,
    title: 'موجودی نقد و بانک', title_ku: 'نەختینە و بانک', title_en: 'Cash and Cash Equivalents' },
  { code: '1010', level: 3, parentCode: '10', nature: 'debtor', isSystem: true,
    title: 'صندوق‌های نقدی کارگاه و پروژه', title_ku: 'سندووقەکانی نەختی کارگە و پڕۆژە', title_en: 'Site Cash Boxes' },
  { code: '1020', level: 3, parentCode: '10', nature: 'debtor', isSystem: true,
    title: 'حساب‌ها و کارت‌های بانکی تجاری', title_ku: 'حیساب و کارتە بانکییەکان', title_en: 'Bank Current Accounts' },
  { code: '1030', level: 3, parentCode: '10', nature: 'debtor', isSystem: true,
    title: 'تنخواه‌گردان‌های کارگاه و مسئولین خرید', title_ku: 'تەنخواگەردانەکانی کارگە', title_en: 'Site Petty Cash Holders' },

  // کل ۱۲: اسناد دریافتنی تجاری
  { code: '12', level: 2, parentCode: '1', nature: 'debtor', isSystem: true,
    title: 'اسناد دریافتنی تجاری (چک‌ها)', title_ku: 'بەڵگەنامە وەرگیراوەکان (چەکەکان)', title_en: 'Notes Receivable' },
  { code: '1201', level: 3, parentCode: '12', nature: 'debtor', isSystem: true,
    title: 'چک‌های نزد صندوق (در انتظار وصول)', title_ku: 'چەکەکانی بەردەست لە سندووق', title_en: 'Cheques on Hand' },
  { code: '1202', level: 3, parentCode: '12', nature: 'debtor', isSystem: true,
    title: 'چک‌های در جریان وصول (واگذار به بانک)', title_ku: 'چەکە نێردراوەکان بۆ بانک بۆ وصول', title_en: 'Cheques in Collection' },
  { code: '1203', level: 3, parentCode: '12', nature: 'debtor', isSystem: true,
    title: 'چک‌های برگشتی و واخواستی', title_ku: 'چەکە گەڕاوەکان (ڕەتکراوە)', title_en: 'Bounced / Dishonored Cheques' },

  // کل ۱۳: حساب‌ها و مطالبات دریافتنی تجاری
  { code: '13', level: 2, parentCode: '1', nature: 'debtor', isSystem: true,
    title: 'حساب‌ها و مطالبات دریافتنی تجاری', title_ku: 'داواکاری و حیسابە وەرگیراوە بازرگانییەکان', title_en: 'Accounts Receivable (Trade)' },
  { code: '1301', level: 3, parentCode: '13', nature: 'debtor', isSystem: true,
    title: 'مطالبات از کارفرمایان و خریداران', title_ku: 'داواکاری لە خاوەنکار و کڕیاران', title_en: 'Receivables from Employers & Clients' },
  { code: '1302', level: 3, parentCode: '13', nature: 'debtor', isSystem: true,
    title: 'سایر بدهکاران تجاری کارگاه', title_ku: 'قەرزدارانی تری بازرگانی', title_en: 'Other Trade Debtors' },

  // کل ۱۴: سایر حساب‌ها و اسناد دریافتنی (پرسنل)
  { code: '14', level: 2, parentCode: '1', nature: 'debtor', isSystem: true,
    title: 'سایر حساب‌ها و اسناد دریافتنی (پرسنل)', title_ku: 'داواکارییەکانی تر و حیسابی کارمەندان', title_en: 'Other Receivables & Staff' },
  { code: '1401', level: 3, parentCode: '14', nature: 'debtor', isSystem: true,
    title: 'مساعده‌ها و علی‌الحساب پرداختی به پرسنل', title_ku: 'پێشەکی و پارەی دراو بە کارمەندان', title_en: 'Staff Advances & Prepayments' },
  { code: '1402', level: 3, parentCode: '14', nature: 'debtor', isSystem: true,
    title: 'وام‌های پرداختی به پرسنل و کارگران', title_ku: 'قەرزی دراو بە کارمەندان', title_en: 'Staff Loans' },
  { code: '1403', level: 3, parentCode: '14', nature: 'debtor', isSystem: true,
    title: 'مطالبات متفرقه و سپرده‌های موقت', title_ku: 'داواکارییە جۆربەجۆرەکان', title_en: 'Miscellaneous Receivables' },

  // کل ۱۵: پیش‌پرداخت‌ها و علی‌الحساب‌ها
  { code: '15', level: 2, parentCode: '1', nature: 'debtor', isSystem: true,
    title: 'پیش‌پرداخت‌ها و علی‌الحساب‌ها', title_ku: 'پێشەکییەکان و پارەی سەرەتایی', title_en: 'Advances and Prepayments' },
  { code: '1501', level: 3, parentCode: '15', nature: 'debtor', isSystem: true,
    title: 'پیش‌پرداخت به پیمانکاران جزء و استادکاران', title_ku: 'پێشەکی دراو بە پەیمانکاران و وەستاکاران', title_en: 'Advances to Subcontractors & Masters' },
  { code: '1502', level: 3, parentCode: '15', nature: 'debtor', isSystem: true,
    title: 'پیش‌پرداخت خرید مصالح و سفارشات کارگاه', title_ku: 'پێشەکی کڕینی کەرەستە و کەلوپەل', title_en: 'Advances for Materials & Orders' },
  { code: '1503', level: 3, parentCode: '15', nature: 'debtor', isSystem: true,
    title: 'پیش‌پرداخت بیمه و مالیات تکلیفی', title_ku: 'پێشەکی باج و بیمە', title_en: 'Prepaid Taxes and Insurance' },

  // کل ۱۶: موجودی مصالح و انبار
  { code: '16', level: 2, parentCode: '1', nature: 'debtor', isSystem: true,
    title: 'موجودی مصالح و انبار کارگاه', title_ku: 'کۆگای کەرەستە و مصالحی کارگە', title_en: 'Inventory & Materials on Site' },
  { code: '1601', level: 3, parentCode: '16', nature: 'debtor', isSystem: true,
    title: 'موجودی مصالح ساختمانی پای کار', title_ku: 'کەرەستەی بیناسازی پای کار', title_en: 'Building Materials on Site' },
  { code: '1602', level: 3, parentCode: '16', nature: 'debtor', isSystem: true,
    title: 'قطعات یدکی و ابزار مصرفی انبار', title_ku: 'پارچەی یەدەگ و کەرەستەی کۆگا', title_en: 'Consumables & Spare Parts' },

  // ==========================================
  // گروه ۲: دارایی‌های غیرجاری (Non-Current Assets)
  // ==========================================
  { code: '2', level: 1, parentCode: null, nature: 'debtor', isSystem: true,
    title: 'دارایی‌های غیرجاری', title_ku: 'دارایییە نەگۆڕەکان (درێژخایەن)', title_en: 'Non-Current Assets' },

  // کل ۲۱: دارایی‌های ثابت مشهود
  { code: '21', level: 2, parentCode: '2', nature: 'debtor', isSystem: true,
    title: 'دارایی‌های ثابت مشهود', title_ku: 'سامانە نەگۆڕە بەرجەستەکان', title_en: 'Property, Plant & Equipment' },
  { code: '2101', level: 3, parentCode: '21', nature: 'debtor', isSystem: true,
    title: 'ماشین‌آلات سنگین و تجهیزات اجرایی ساختمانی', title_ku: 'ئامێرە قورسەکان و پێداویستی جێبەجێکردن', title_en: 'Heavy Construction Machinery' },
  { code: '2102', level: 3, parentCode: '21', nature: 'debtor', isSystem: true,
    title: 'ابزارآلات فنی و ادوات کارگاهی سرمایه‌ای', title_ku: 'ئامرازە تەکنیکییەکان و کەرەستەی سەرمایەیی', title_en: 'Technical Tools & Equipment' },
  { code: '2103', level: 3, parentCode: '21', nature: 'debtor', isSystem: true,
    title: 'وسایل نقلیه و ترابری پروژه', title_ku: 'ئۆتۆمبێل و هۆکارەکانی گواستنەوە', title_en: 'Vehicles & Transportation' },
  { code: '2104', level: 3, parentCode: '21', nature: 'debtor', isSystem: true,
    title: 'اثاثه و تجهیزات اداری و کانکس‌های کارگاه', title_ku: 'کەلوپەلی ئۆفیس و کارگە', title_en: 'Office Furniture & Site Cabins' },

  // کل ۲۲: استهلاک انباشته
  { code: '22', level: 2, parentCode: '2', nature: 'creditor', isSystem: true,
    title: 'استهلاک انباشته دارایی‌های ثابت', title_ku: 'ئیستیهلاکی کەڵەکەبوو', title_en: 'Accumulated Depreciation' },
  { code: '2201', level: 3, parentCode: '22', nature: 'creditor', isSystem: true,
    title: 'استهلاک انباشته ماشین‌آلات و ابزارآلات', title_ku: 'ئیستیهلاکی کەڵەکەبووی ئامێر و کەلوپەل', title_en: 'Accumulated Depreciation - Machinery' },
  { code: '2202', level: 3, parentCode: '22', nature: 'creditor', isSystem: true,
    title: 'استهلاک انباشته وسایل نقلیه', title_ku: 'ئیستیهلاکی کەڵەکەبووی هۆکارەکانی گواستنەوە', title_en: 'Accumulated Depreciation - Vehicles' },

  // ==========================================
  // گروه ۳: بدهی‌های جاری (Current Liabilities)
  // ==========================================
  { code: '3', level: 1, parentCode: null, nature: 'creditor', isSystem: true,
    title: 'بدهی‌های جاری', title_ku: 'قەرزە بەردەستەکان (جاری)', title_en: 'Current Liabilities' },

  // کل ۳۰: اسناد پرداختنی تجاری
  { code: '30', level: 2, parentCode: '3', nature: 'creditor', isSystem: true,
    title: 'اسناد پرداختنی تجاری (چک‌ها)', title_ku: 'بەڵگەنامە دراوەکان (چەکە دراوەکان)', title_en: 'Notes Payable' },
  { code: '3010', level: 3, parentCode: '30', nature: 'creditor', isSystem: true,
    title: 'چک‌های پرداختنی عهده بانک‌ها (صادره به اشخاص)', title_ku: 'چەکە دراوەکانی لای بانک بۆ کەسەکان', title_en: 'Issued Cheques Payable' },
  { code: '3020', level: 3, parentCode: '30', nature: 'creditor', isSystem: true,
    title: 'بروات و سفته‌های پرداختنی ضمانتی', title_ku: 'سەفتە و بەڵگەنامە دراوەکان', title_en: 'Promissory Notes Payable' },

  // کل ۳۱: حساب‌ها و بستانکاران تجاری
  { code: '31', level: 2, parentCode: '3', nature: 'creditor', isSystem: true,
    title: 'حساب‌ها و بستانکاران تجاری', title_ku: 'حیساب و قەرزدەرانی بازرگانی', title_en: 'Accounts Payable (Trade)' },
  { code: '3101', level: 3, parentCode: '31', nature: 'creditor', isSystem: true,
    title: 'بستانکاران - پیمانکاران جزء و استادکاران', title_ku: 'قەرزدەران - پەیمانکاران و وەستاکاران', title_en: 'Payable to Subcontractors & Masters' },
  { code: '3102', level: 3, parentCode: '31', nature: 'creditor', isSystem: true,
    title: 'بستانکاران - تأمین‌کنندگان و فروشندگان مصالح', title_ku: 'قەرزدەران - فرۆشیارانی کەرەستە', title_en: 'Payable to Material Suppliers' },
  { code: '3103', level: 3, parentCode: '31', nature: 'creditor', isSystem: true,
    title: 'بستانکاران - کرایه ماشین‌آلات و خدمات فنی', title_ku: 'قەرزدەران - کرێی ئامێر و خزمەتگوزاری', title_en: 'Payable to Machinery & Rental Services' },

  // کل ۳۲: سایر حساب‌ها و اسناد پرداختنی (پرسنل)
  { code: '32', level: 2, parentCode: '3', nature: 'creditor', isSystem: true,
    title: 'سایر حساب‌ها و اسناد پرداختنی (پرسنل)', title_ku: 'قەرزەکانی تر و مافی کارمەندان', title_en: 'Other Payables & Payroll' },
  { code: '3201', level: 3, parentCode: '32', nature: 'creditor', isSystem: true,
    title: 'دستمزد و حقوق پرداختنی پرسنل و کارگران', title_ku: 'شایستەی دەستحەق و مووچەی کارمەندان', title_en: 'Salaries & Wages Payable' },
  { code: '3202', level: 3, parentCode: '32', nature: 'creditor', isSystem: true,
    title: 'عیدی، پاداش و تسویه‌حساب نهایی پرسنل', title_ku: 'پاداشت و پاکتاوی کۆتایی کارمەندان', title_en: 'Bonus & Final Settlement Payable' },
  { code: '3203', level: 3, parentCode: '32', nature: 'creditor', isSystem: true,
    title: 'سایر بستانکاران متفرقه کارگاه', title_ku: 'قەرزدەرانی تری جۆربەجۆر', title_en: 'Miscellaneous Creditors' },

  // کل ۳۳: پیش‌دریافت‌ها از کارفرمایان
  { code: '33', level: 2, parentCode: '3', nature: 'creditor', isSystem: true,
    title: 'پیش‌دریافت‌ها از کارفرمایان', title_ku: 'پێشەکی وەرگیراو لە خاوەنکاران', title_en: 'Advances Received from Employers' },
  { code: '3301', level: 3, parentCode: '33', nature: 'creditor', isSystem: true,
    title: 'پیش‌دریافت نقدی قراردادها و پروژه‌ها', title_ku: 'پێشەکی نەختی گرێبەستەکان', title_en: 'Contract Advances Received' },
  { code: '3302', level: 3, parentCode: '33', nature: 'creditor', isSystem: true,
    title: 'علی‌الحساب‌های دریافتی از کارفرما', title_ku: 'پارەی کاتی وەرگیراو لە خاوەنکار', title_en: 'Interim Receipts from Employers' },

  // کل ۳۴: سپرده‌ها و کسورات پیمان‌ها (حسن انجام کار و بیمه)
  { code: '34', level: 2, parentCode: '3', nature: 'creditor', isSystem: true,
    title: 'سپرده‌ها و کسورات پیمان‌ها', title_ku: 'بارمتە و بڕینەکانی پەیمانکاری', title_en: 'Contract Retentions & Deductions' },
  { code: '3401', level: 3, parentCode: '34', nature: 'creditor', isSystem: true,
    title: 'سپرده حسن انجام کار مکسوره از پیمانکاران (۵٪ / ۱۰٪)', title_ku: 'بارمتەی باشی ئەنجامدانی کار لە پەیمانکاران (٥٪ / ١٠٪)', title_en: 'Performance Guarantee Retention (5%/10%)' },
  { code: '3402', level: 3, parentCode: '34', nature: 'creditor', isSystem: true,
    title: 'سپرده بیمه ماده ۳۸ تأمین اجتماعی مکسوره', title_ku: 'بڕینی بیمەی مادەی ٣٨ی دڵنیایی کۆمەڵایەتی', title_en: 'Social Security Insurance Retention (Art 38)' },
  { code: '3403', level: 3, parentCode: '34', nature: 'creditor', isSystem: true,
    title: 'مالیات تکلیفی مکسوره از پیمانکاران', title_ku: 'باجی بڕدراو لە پەیمانکاران', title_en: 'Withholding Taxes Payable' },

  // ==========================================
  // گروه ۴: بدهی‌های بلندمدت (Non-Current Liabilities)
  // ==========================================
  { code: '4', level: 1, parentCode: null, nature: 'creditor', isSystem: true,
    title: 'بدهی‌های بلندمدت', title_ku: 'قەرزە درێژخایەنەکان', title_en: 'Non-Current Liabilities' },

  // کل ۴۰: تسهیلات مالی دریافتی بلندمدت
  { code: '40', level: 2, parentCode: '4', nature: 'creditor', isSystem: true,
    title: 'تسهیلات و وام‌های مالی دریافتنی بلندمدت', title_ku: 'تاسیلات و قەرزی درێژخایەنی بانکی', title_en: 'Long-term Bank Borrowings' },
  { code: '4010', level: 3, parentCode: '40', nature: 'creditor', isSystem: true,
    title: 'وام‌ها و تسهیلات اقساطی بلندمدت بانکی', title_ku: 'قەرز و قیستی درێژخایەنی بانکەکان', title_en: 'Long-term Bank Facilities' },

  // ==========================================
  // گروه ۵: حقوق صاحبان سهام و سرمایه (Equity)
  // ==========================================
  { code: '5', level: 1, parentCode: null, nature: 'creditor', isSystem: true,
    title: 'حقوق صاحبان سهام و سرمایه', title_ku: 'مافی خاوەن پشکەکان و سەرمایە', title_en: 'Equity & Capital' },

  // کل ۵۰: سرمایه اولیه
  { code: '50', level: 2, parentCode: '5', nature: 'creditor', isSystem: true,
    title: 'سرمایه اولیه و ثبت‌شده', title_ku: 'سەرمایەی سەرەتایی تۆمارکراو', title_en: 'Paid-in Capital' },
  { code: '5010', level: 3, parentCode: '50', nature: 'creditor', isSystem: true,
    title: 'آورده نقدی شرکا و مالکان پروژه', title_ku: 'بەشداری نەختی خاوەنکاران لە پڕۆژە', title_en: 'Partners Capital Contributions' },

  // کل ۵۲: سود (زیان) انباشته
  { code: '52', level: 2, parentCode: '5', nature: 'creditor', isSystem: true,
    title: 'سود (زیان) انباشته', title_ku: 'قازانج (زیان)ی کەڵەکەبوو', title_en: 'Retained Earnings' },
  { code: '5201', level: 3, parentCode: '52', nature: 'creditor', isSystem: true,
    title: 'سود (زیان) انباشته سنوات قبل', title_ku: 'قازانج و زیانی ساڵانی پێشوو', title_en: 'Prior Years Retained Earnings' },
  { code: '5202', level: 3, parentCode: '52', nature: 'creditor', isSystem: true,
    title: 'سود (زیان) خالص دوره جاری', title_ku: 'قازانج و زیانی خاڵسی ئەمساڵ', title_en: 'Current Year Profit / Loss' },

  // کل ۵۳: جاری شرکا و سهامداران
  { code: '53', level: 2, parentCode: '5', nature: 'both', isSystem: true,
    title: 'حساب جاری شرکا و سهامداران', title_ku: 'حیسابی بەردەوامی خاوەن پشکەکان', title_en: 'Shareholders Current Accounts' },
  { code: '5301', level: 3, parentCode: '53', nature: 'both', isSystem: true,
    title: 'جاری شرکا - واریزی و برداشت شخصی', title_ku: 'حیسابی شەریكەکان - وەرگرتن و دان', title_en: 'Partners Current Accounts' },

  // ==========================================
  // گروه ۶: درآمدها و کارکرد (Revenues)
  // ==========================================
  { code: '6', level: 1, parentCode: null, nature: 'creditor', isSystem: true,
    title: 'درآمدها و کارکرد', title_ku: 'داهات و کارکردەکان', title_en: 'Revenues' },

  // کل ۶۰: درآمد حاصل از پیمان‌ها
  { code: '60', level: 2, parentCode: '6', nature: 'creditor', isSystem: true,
    title: 'درآمد حاصل از پیمان‌ها و پروژه‌ها', title_ku: 'داهاتی گرێبەستەکان و پڕۆژە', title_en: 'Contract Revenues' },
  { code: '6010', level: 3, parentCode: '60', nature: 'creditor', isSystem: true,
    title: 'درآمد صورت‌وضعیت‌های کارکرد تاییدشده', title_ku: 'داهاتی صورت‌وەزعییەتی پەسەندکراو', title_en: 'Certified Progress Billings' },
  { code: '6020', level: 3, parentCode: '60', nature: 'creditor', isSystem: true,
    title: 'درآمد کارهای اضافی و تغییر مقادیر پیمان', title_ku: 'داهاتی کارە زیادەکان و گۆڕانکاری گرێبەست', title_en: 'Contract Scope Variations & Claims' },

  // کل ۶۱: سایر درآمدهای عملیاتی
  { code: '61', level: 2, parentCode: '6', nature: 'creditor', isSystem: true,
    title: 'سایر درآمدهای عملیاتی و کارگاهی', title_ku: 'داهاتەکانی تری کارگە', title_en: 'Other Operating Revenues' },
  { code: '6101', level: 3, parentCode: '61', nature: 'creditor', isSystem: true,
    title: 'درآمد حاصل از فروش ضایعات و مصالح مازاد', title_ku: 'داهاتی فرۆشتنی پاشماوە و کەرەستەی زیادە', title_en: 'Scrap & Surplus Material Sales' },
  { code: '6102', level: 3, parentCode: '61', nature: 'creditor', isSystem: true,
    title: 'درآمد ارائه خدمات فنی و ماشین‌آلات به غیر', title_ku: 'داهاتی پێشکەشکردنی خزمەتگوزاری و ئامێر', title_en: 'Services & Equipment Rental Income' },

  // ==========================================
  // گروه ۷: بهای تمام شده / کار در جریان پیمان (Project Direct Costs / WIP)
  // ==========================================
  { code: '7', level: 1, parentCode: null, nature: 'debtor', isSystem: true,
    title: 'بهای تمام‌شده و هزینه‌های مستقیم پروژه (WIP)', title_ku: 'تێچووی تەواوبوو و خەرجییە ڕاستەوخۆکانی پڕۆژە', title_en: 'Direct Project Costs & WIP' },

  // کل ۷۰: بهای تمام‌شده و کار در جریان ساخت
  { code: '70', level: 2, parentCode: '7', nature: 'debtor', isSystem: true,
    title: 'هزینه‌های مستقیم پروژه و کار در جریان ساخت', title_ku: 'خەرجییە ڕاستەوخۆکانی پڕۆژە لە جێبەجێکردندا', title_en: 'Direct Construction Costs' },
  { code: '7010', level: 3, parentCode: '70', nature: 'debtor', isSystem: true,
    title: 'مصالح و متریال مستقیم مصرفی کارگاه', title_ku: 'کەرەستە و ماتریالی ڕاستەوخۆ بەکارهاتوو', title_en: 'Direct Materials Consumed' },
  { code: '7020', level: 3, parentCode: '70', nature: 'debtor', isSystem: true,
    title: 'دستمزد مستقیم استادکاران و روزمزد پروژه', title_ku: 'دەستحەقی ڕاستەوخۆی کرێکار و وەستاکاران', title_en: 'Direct Labor & Wages' },
  { code: '7030', level: 3, parentCode: '70', nature: 'debtor', isSystem: true,
    title: 'کارکرد پیمانکاران جزء و دست‌دوم', title_ku: 'کارکردی پەیمانکارانی دەستی دووەم', title_en: 'Subcontracting Costs' },
  { code: '7040', level: 3, parentCode: '70', nature: 'debtor', isSystem: true,
    title: 'کرایه ماشین‌آلات، بالابر و ادوات اجرایی', title_ku: 'کرێی ئامێرەکان، بەرزکەرەوە و هتد', title_en: 'Equipment & Machinery Rental' },
  { code: '7050', level: 3, parentCode: '70', nature: 'debtor', isSystem: true,
    title: 'سربار مستقیم کارگاه (اسکان، غذا، آب، برق، ترابری)', title_ku: 'خەرجی گشتی کارگە (مانەوە، خواردن، ئاو، هاتوچۆ)', title_en: 'Site Direct Overheads (Camp, Food, Utilities)' },
  { code: '7060', level: 3, parentCode: '70', nature: 'debtor', isSystem: true,
    title: 'ابزارآلات و ملزومات مصرفی اجرایی کارگاه', title_ku: 'ئامراز و پێداویستییە کاتییەکانی کارگە', title_en: 'Site Consumable Tools & Supplies' },

  // ==========================================
  // گروه ۸: هزینه‌های عمومی، اداری و مالی (General & Admin Expenses)
  // ==========================================
  { code: '8', level: 1, parentCode: null, nature: 'debtor', isSystem: true,
    title: 'هزینه‌های عمومی، اداری و مالی', title_ku: 'خەرجییە گشتی، کارگێڕی و دارایییەکان', title_en: 'General, Admin & Financial Expenses' },

  // کل ۸۰: هزینه‌های اداری و تشکیلاتی
  { code: '80', level: 2, parentCode: '8', nature: 'debtor', isSystem: true,
    title: 'هزینه‌های اداری، عمومی و تشکیلاتی دفتر', title_ku: 'خەرجی کارگێڕی و سەرپەرشتی ئۆفیس', title_en: 'Administrative & General Expenses' },
  { code: '8010', level: 3, parentCode: '80', nature: 'debtor', isSystem: true,
    title: 'حقوق و دستمزد پرسنل اداری و مهندسی ستاد', title_ku: 'مووچەی کارمەندانی ئۆفیس و ئەندازیاران', title_en: 'Office & Management Salaries' },
  { code: '8020', level: 3, parentCode: '80', nature: 'debtor', isSystem: true,
    title: 'اجاره دفتر، ملزومات، ارتباطات و اینترنت', title_ku: 'کرێی ئۆفیس، ئینتەرنێت و پێداویستییەکان', title_en: 'Office Rent, Utilities & Communications' },
  { code: '8030', level: 3, parentCode: '80', nature: 'debtor', isSystem: true,
    title: 'هزینه‌های حقوقی، مشاوره، حسابرسی و پذیرایی', title_ku: 'خەرجی یاسایی، ژمێریاری و میوانداری', title_en: 'Legal, Consulting & Audit Fees' },

  // کل ۸۱: هزینه‌های مالی و بانکی
  { code: '81', level: 2, parentCode: '8', nature: 'debtor', isSystem: true,
    title: 'هزینه‌های مالی و کارمزد بانکی', title_ku: 'خەرجییە دارایییەکان و کرێی بانک', title_en: 'Financial & Banking Expenses' },
  { code: '8110', level: 3, parentCode: '81', nature: 'debtor', isSystem: true,
    title: 'کارمزد خدمات بانکی، پایا و ساتنا', title_ku: 'کرێی خزمەتگوزارییە بانکییەکان', title_en: 'Bank Service Charges & Fees' },
  { code: '8120', level: 3, parentCode: '81', nature: 'debtor', isSystem: true,
    title: 'هزینه بهره، سود و جرایم تاخیر بانکی', title_ku: 'سوود و سزای دواکەوتنی بانکی', title_en: 'Interest & Finance Charges' },

  // ==========================================
  // گروه ۹: حساب‌های انتظامی (Off-Balance / Memorandum Accounts)
  // ==========================================
  { code: '9', level: 1, parentCode: null, nature: 'both', isSystem: true,
    title: 'حساب‌های انتظامی و تعهدات', title_ku: 'حیسابە ئینتزامییەکان و بەڵێنامەکان', title_en: 'Memorandum Accounts (Off-Balance)' },

  // کل ۹۰: حساب‌های انتظامی اسناد ضمانتی
  { code: '90', level: 2, parentCode: '9', nature: 'debtor', isSystem: true,
    title: 'حساب‌های انتظامی - اسناد ضمانتی', title_ku: 'حیسابە ئینتزامییەکان - بەڵگەنامەی گرەنتی', title_en: 'Guarantees & Commitments' },
  { code: '9010', level: 3, parentCode: '90', nature: 'debtor', isSystem: true,
    title: 'ضمانت‌نامه‌ها و چک‌های ضمانتی دریافتی از پیمانکاران', title_ku: 'گرەنتی و چەکی بارمتەی وەرگیراو', title_en: 'Guarantees Received from Contractors' },
  { code: '9020', level: 3, parentCode: '90', nature: 'debtor', isSystem: true,
    title: 'ضمانت‌نامه‌ها و اسناد ضمانتی تسلیمی به کارفرما', title_ku: 'گرەنتی و چەکی بارمتەی دراو بە خاوەنکار', title_en: 'Guarantees Given to Employers' },

  // کل ۹۱: طرف حساب‌های انتظامی
  { code: '91', level: 2, parentCode: '9', nature: 'creditor', isSystem: true,
    title: 'طرف حساب‌های انتظامی', title_ku: 'بەرامبەری حیسابە ئینتزامییەکان', title_en: 'Contra Memorandum Accounts' },
  { code: '9110', level: 3, parentCode: '91', nature: 'creditor', isSystem: true,
    title: 'طرف حساب ضمانت‌نامه‌های دریافتی', title_ku: 'بەرامبەری گرەنتییە وەرگیراوەکان', title_en: 'Contra - Guarantees Received' },
  { code: '9120', level: 3, parentCode: '91', nature: 'creditor', isSystem: true,
    title: 'طرف حساب ضمانت‌نامه‌های تسلیمی', title_ku: 'بەرامبەری گرەنتییە دراوەکان', title_en: 'Contra - Guarantees Given' }
];

/**
 * Initialize Chart of Accounts in Dexie if empty
 */
export async function initializeChartOfAccounts(projectId = DEFAULT_PROJECT_ID) {
  if (!db.chartOfAccounts) return [];
  const existing = await db.chartOfAccounts.toArray();
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  const records = DEFAULT_CHART_OF_ACCOUNTS.map(node => ({
    id: generateAccountNodeId(),
    projectId,
    code: node.code,
    level: node.level,
    parentCode: node.parentCode,
    nature: node.nature,
    isSystem: Boolean(node.isSystem),
    title: node.title,
    title_ku: node.title_ku,
    title_en: node.title_en,
    createdAt: now,
    updatedAt: now
  }));

  await db.chartOfAccounts.bulkPut(records);
  return records;
}

/**
 * Fetch hierarchical tree or flat list of Chart of Accounts
 */
export async function getChartOfAccounts(projectId = DEFAULT_PROJECT_ID) {
  if (!db.chartOfAccounts) return [];
  const accounts = await db.chartOfAccounts.toArray();
  return accounts.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

/**
 * Add a new custom Subsidiary account node (معین)
 */
export async function addAccountNode({
  projectId = DEFAULT_PROJECT_ID,
  code,
  parentCode,
  title,
  title_ku = '',
  title_en = '',
  nature = 'debtor'
}) {
  if (!db.chartOfAccounts) throw new Error('Store not initialized');
  if (!code || !title) throw new Error('Code and title are required');

  const existing = await db.chartOfAccounts.where('code').equals(code).first();
  if (existing) throw new Error(`کد حساب ${code} قبلاً تعریف شده است.`);

  const level = code.length === 1 ? 1 : code.length === 2 ? 2 : 3;
  const now = new Date().toISOString();

  const record = {
    id: generateAccountNodeId(),
    projectId,
    code: String(code).trim(),
    parentCode: parentCode || (code.length > 2 ? code.slice(0, 2) : code.slice(0, 1)),
    level,
    nature,
    isSystem: false,
    title: String(title).trim(),
    title_ku: String(title_ku || title).trim(),
    title_en: String(title_en || title).trim(),
    createdAt: now,
    updatedAt: now
  };

  await db.chartOfAccounts.put(record);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('karsync:coa-sync'));
  }
  return record;
}

/**
 * Update an account node
 */
export async function updateAccountNode(id, updates) {
  if (!db.chartOfAccounts) throw new Error('Store not initialized');
  const now = new Date().toISOString();
  await db.chartOfAccounts.update(id, {
    ...updates,
    updatedAt: now
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('karsync:coa-sync'));
  }
}

/**
 * Delete an account node (with transaction and system safety guard)
 */
export async function deleteAccountNode(id) {
  if (!db.chartOfAccounts) throw new Error('Store not initialized');
  const node = await db.chartOfAccounts.get(id);
  if (!node) return;
  if (node.isSystem) {
    throw new Error('سرفصل‌های سیستمی و پایه استاندارد حسابداری غیرقابل حذف هستند.');
  }

  // Check child accounts
  const child = await db.chartOfAccounts.where('parentCode').equals(node.code).first();
  if (child) {
    throw new Error(`امکان حذف سرفصل ${node.code} وجود ندارد؛ این سرفصل دارای زیرمجموعه است.`);
  }

  await db.chartOfAccounts.delete(id);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('karsync:coa-sync'));
  }
}

/**
 * Reset Chart of Accounts to default standard, preserving custom accounts with transactions
 */
export async function resetChartOfAccountsToDefault(projectId = DEFAULT_PROJECT_ID) {
  if (!db.chartOfAccounts) return;
  const current = await db.chartOfAccounts.toArray();
  const defaultCodes = new Set(DEFAULT_CHART_OF_ACCOUNTS.map(d => d.code));

  // Remove unused non-system accounts
  for (const acc of current) {
    if (!defaultCodes.has(acc.code) && !acc.hasTransactions) {
      await db.chartOfAccounts.delete(acc.id);
    }
  }

  // Restore/update default nodes
  const now = new Date().toISOString();
  for (const node of DEFAULT_CHART_OF_ACCOUNTS) {
    const existing = await db.chartOfAccounts.where('code').equals(node.code).first();
    if (existing) {
      await db.chartOfAccounts.update(existing.id, {
        level: node.level,
        parentCode: node.parentCode,
        nature: node.nature,
        isSystem: true,
        title: node.title,
        title_ku: node.title_ku,
        title_en: node.title_en,
        updatedAt: now
      });
    } else {
      await db.chartOfAccounts.put({
        id: generateAccountNodeId(),
        projectId,
        code: node.code,
        level: node.level,
        parentCode: node.parentCode,
        nature: node.nature,
        isSystem: true,
        title: node.title,
        title_ku: node.title_ku,
        title_en: node.title_en,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('karsync:coa-sync'));
  }
}

/**
 * Intelligent Transaction Accounting Resolver
 * Maps any financial transaction (Expense, Payment, Income, Transfer, Settlement, Cheque)
 * to standard 4-digit GL and Subsidiary accounts with Floating Detail identifiers.
 */
export function resolveTransactionCoding(transaction = {}, accountsMap = new Map()) {
  const type = transaction.type || transaction.transactionType || 'expense';

  // 1. Bank or Cash Account mapping
  const accountType = transaction.accountType || (transaction.bankAccountId ? 'bank' : 'cash');
  const financialAccountSubCode = accountType === 'bank' ? '1020' : '1010';
  const financialAccountTitle = accountType === 'bank' ? 'حساب‌ها و کارت‌های بانکی' : 'صندوق‌های نقدی کارگاه';

  // 2. Contractor Settlement Payment (پرداخت اقساط یا تسویه صورت‌وضعیت به پیمانکار)
  if (type === 'contract_settlement_payment' || transaction.paymentType === 'contract_settlement_payment' || transaction.isContractPayment) {
    return {
      glCode: '31',
      glTitle: 'حساب‌ها و اسناد پرداختنی تجاری',
      subCode: '3101',
      subTitle: 'بستانکاران - پیمانکاران جزء و استادکاران',
      creditGlCode: '10',
      creditSubCode: financialAccountSubCode,
      creditSubTitle: financialAccountTitle,
      detailType: 'contractor',
      detailCode: transaction.counterpartyId || transaction.workerId || null
    };
  }

  // 3. Contractor & Master Craftsman Contract Settlement (صدور صورت‌وضعیت موقت / تعهد کارگاه)
  if (transaction.isContractSettlement || transaction.isInterimSettlement || transaction.contractId) {
    return {
      glCode: '70',
      glTitle: 'هزینه‌های مستقیم پروژه و کار در جریان ساخت',
      subCode: '7030',
      subTitle: 'کارکرد پیمانکاران جزء و استادکاران',
      creditGlCode: '31',
      creditSubCode: transaction.paymentStatus === 'unpaid' ? '3101' : financialAccountSubCode,
      creditSubTitle: transaction.paymentStatus === 'unpaid' ? 'بستانکاران - پیمانکاران جزء' : financialAccountTitle,
      retentionSubCode: '3401', // حسن انجام کار
      insuranceSubCode: '3402', // بیمه ماده ۳۸
      advanceSubCode: '1501',   // پیش‌پرداخت پیمانکاران
      delayPenaltySubCode: '6101', // درآمد حاصل از خسارات و جرایم پیمانکاران (جریمه دیرکرد)
      delayPenaltySubTitle: 'سایر درآمدهای غیرعملیاتی (خسارت تاخیر پیمانکاران)',
      detailType: 'contractor',
      detailCode: transaction.counterpartyId || transaction.personId || null
    };
  }

  // 3. Staff / Worker Payment & Settlement
  if (type === 'payment' || type === 'settlement' || type === 'advance' || transaction.workerId) {
    const isAdvance = type === 'advance' || transaction.paymentType === 'advance';
    const isLoan = type === 'loan' || transaction.loanId;
    const subCode = isAdvance ? '1401' : isLoan ? '1402' : '3201';
    const subTitle = isAdvance
      ? 'مساعده‌ها و علی‌الحساب پرداختی پرسنل'
      : isLoan
      ? 'وام‌های پرداختی به پرسنل'
      : 'دستمزد و حقوق پرداختنی پرسنل';

    return {
      glCode: isAdvance || isLoan ? '14' : '32',
      glTitle: isAdvance || isLoan ? 'سایر حساب‌ها و اسناد دریافتنی (پرسنل)' : 'سایر حساب‌ها و اسناد پرداختنی (پرسنل)',
      subCode,
      subTitle,
      creditGlCode: '10',
      creditSubCode: financialAccountSubCode,
      creditSubTitle: financialAccountTitle,
      detailType: 'worker',
      detailCode: transaction.workerId || transaction.personId || null
    };
  }

  // 4. Treasury Income / Top-up (شارژ تنخواه / واریزی کارفرما)
  if (type === 'income' || type === 'inflow' || transaction.isIncome) {
    return {
      glCode: '10',
      glTitle: 'موجودی نقد و بانک',
      subCode: financialAccountSubCode,
      subTitle: financialAccountTitle,
      creditGlCode: '33',
      creditSubCode: '3301',
      creditSubTitle: 'پیش‌دریافت نقدی قراردادها و پروژه‌ها',
      detailType: 'employer',
      detailCode: transaction.counterpartyId || null
    };
  }

  // 5. Account Transfer (انتقال بین حساب‌ها)
  if (type === 'transfer' || transaction.isTransfer) {
    return {
      glCode: '10',
      glTitle: 'موجودی نقد و بانک',
      subCode: transaction.toAccountType === 'bank' ? '1020' : '1010',
      subTitle: 'حساب مقصد',
      creditGlCode: '10',
      creditSubCode: transaction.fromAccountType === 'bank' ? '1020' : '1010',
      creditSubTitle: 'حساب مبدأ',
      detailType: 'account_transfer',
      detailCode: `${transaction.fromAccountId} ➡️ ${transaction.toAccountId}`
    };
  }

  // 6. Cheque Transactions
  if (transaction.chequeId || type === 'cheque') {
    const isIncoming = transaction.chequeType === 'received';
    return {
      glCode: isIncoming ? '12' : '30',
      glTitle: isIncoming ? 'اسناد دریافتنی تجاری' : 'اسناد پرداختنی تجاری',
      subCode: isIncoming ? '1201' : '3010',
      subTitle: isIncoming ? 'چک‌های نزد صندوق' : 'چک‌های پرداختنی عهده بانک‌ها',
      creditGlCode: isIncoming ? '13' : '31',
      creditSubCode: isIncoming ? '1301' : '3101',
      creditSubTitle: isIncoming ? 'مطالبات از کارفرمایان' : 'بستانکاران تجاری',
      detailType: 'cheque',
      detailCode: transaction.chequeNumber || transaction.id
    };
  }

  // 7. General Site Expenses (فاکتورها و هزینه‌های کارگاه)
  // Maps to Project Direct Costs (7010-7060) or Admin (8010-8030)
  const categoryCode = String(transaction.categoryCode || '');
  let subCode = '7010';
  let subTitle = 'مصالح و متریال مستقیم مصرفی کارگاه';

  if (categoryCode.startsWith('20') || transaction.categoryName?.includes('حمل') || transaction.categoryName?.includes('ترابری')) {
    subCode = '7050';
    subTitle = 'سربار مستقیم کارگاه (اسکان، غذا، ترابری)';
  } else if (categoryCode.startsWith('30') || transaction.categoryName?.includes('اجاره') || transaction.categoryName?.includes('جرثقیل')) {
    subCode = '7040';
    subTitle = 'کرایه ماشین‌آلات، بالابر و ادوات اجرایی';
  } else if (transaction.categoryName?.includes('اداری') || transaction.categoryName?.includes('دفتر')) {
    subCode = '8020';
    subTitle = 'اجاره دفتر، ملزومات، ارتباطات و اینترنت';
  } else if (transaction.categoryName?.includes('ابزار')) {
    subCode = '7060';
    subTitle = 'ابزارآلات و ملزومات مصرفی اجرایی کارگاه';
  }

  return {
    glCode: subCode.startsWith('80') ? '80' : '70',
    glTitle: subCode.startsWith('80') ? 'هزینه‌های اداری، عمومی و تشکیلاتی' : 'هزینه‌های مستقیم پروژه و کار در جریان ساخت',
    subCode,
    subTitle,
    creditGlCode: '10',
    creditSubCode: transaction.paymentStatus === 'unpaid' ? '3102' : financialAccountSubCode,
    creditSubTitle: transaction.paymentStatus === 'unpaid' ? 'بستانکاران - تأمین‌کنندگان مصالح' : financialAccountTitle,
    detailType: transaction.counterpartyId ? 'counterparty' : 'expense',
    detailCode: transaction.counterpartyId || transaction.personId || null
  };
}
