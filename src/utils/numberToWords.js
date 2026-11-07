/**
 * numberToWords.js
 * Utility to convert numbers into words for official financial vouchers in KarSync.
 * Supports Persian (fa), Kurdish (ku), and English (en).
 */

const FA_ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const FA_TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const FA_TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const FA_HUNDREDS = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const FA_SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

const KU_ONES = ['', 'یەک', 'دوو', 'سێ', 'چوار', 'پێنج', 'شەش', 'حەوت', 'هەشت', 'نۆ'];
const KU_TEENS = ['دە', 'یازدە', 'دوازدە', 'سێزدە', 'چواردە', 'پازدە', 'شازدە', 'حەڤدە', 'هەژدە', 'نۆزدە'];
const KU_TENS = ['', '', 'بیست', 'سی', 'چل', 'پەنجا', 'شەست', 'حەفتا', 'هەشتا', 'نەوەد'];
const KU_HUNDREDS = ['', 'سەد', 'دووسەد', 'سێسەد', 'چوارسەد', 'پێنجسەد', 'شەشسەد', 'حەوتسەد', 'هەشتسەد', 'نۆسەد'];
const KU_SCALES = ['', 'هەزار', 'ملیۆن', 'ملیار', 'تریلیۆن'];

const EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const EN_TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const EN_SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function chunkNumber(num) {
  const chunks = [];
  let n = Math.abs(Math.floor(num));
  while (n > 0) {
    chunks.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  return chunks;
}

function convertThreeDigitsFa(num) {
  if (num === 0) return '';
  const parts = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;
  if (h > 0) parts.push(FA_HUNDREDS[h]);
  if (rem >= 10 && rem < 20) {
    parts.push(FA_TEENS[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (t > 0) parts.push(FA_TENS[t]);
    if (o > 0) parts.push(FA_ONES[o]);
  }
  return parts.join(' و ');
}

function convertThreeDigitsKu(num) {
  if (num === 0) return '';
  const parts = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;
  if (h > 0) parts.push(KU_HUNDREDS[h]);
  if (rem >= 10 && rem < 20) {
    parts.push(KU_TEENS[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (t > 0) parts.push(KU_TENS[t]);
    if (o > 0) parts.push(KU_ONES[o]);
  }
  return parts.join(' و ');
}

function convertThreeDigitsEn(num) {
  if (num === 0) return '';
  const parts = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;
  if (h > 0) parts.push(`${EN_ONES[h]} Hundred`);
  if (rem >= 10 && rem < 20) {
    parts.push(EN_TEENS[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (t > 0) parts.push(EN_TENS[t]);
    if (o > 0) parts.push(EN_ONES[o]);
  }
  return parts.join(' ');
}

/**
 * Converts a numeric amount to words in fa, ku, or en.
 * @param {number} amount 
 * @param {string} currencyCode ('IQD' | 'IRT' | 'USD')
 * @param {string} lang ('fa' | 'ku' | 'en')
 */
export function numberToWords(amount, currencyCode = 'IQD', lang = 'fa') {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) {
    if (lang === 'ku') return 'سفر';
    if (lang === 'en') return 'Zero';
    return 'صفر';
  }

  const currencyUnit = {
    IQD: { fa: 'دینار عراقی', ku: 'دیناری عێراقی', en: 'Iraqi Dinars' },
    IRT: { fa: 'تومان', ku: 'تۆمەن', en: 'Tomans' },
    USD: { fa: 'دلار آمریکا', ku: 'دۆلاری ئەمریکی', en: 'US Dollars' }
  }[currencyCode] || { fa: currencyCode, ku: currencyCode, en: currencyCode };

  const chunks = chunkNumber(num);
  const wordsParts = [];

  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunkVal = chunks[i];
    if (chunkVal === 0) continue;

    let chunkText = '';
    if (lang === 'ku') {
      chunkText = convertThreeDigitsKu(chunkVal);
      if (KU_SCALES[i]) chunkText += ` ${KU_SCALES[i]}`;
    } else if (lang === 'en') {
      chunkText = convertThreeDigitsEn(chunkVal);
      if (EN_SCALES[i]) chunkText += ` ${EN_SCALES[i]}`;
    } else {
      chunkText = convertThreeDigitsFa(chunkVal);
      if (FA_SCALES[i]) chunkText += ` ${FA_SCALES[i]}`;
    }

    if (chunkText.trim()) {
      wordsParts.push(chunkText.trim());
    }
  }

  const separator = (lang === 'en') ? ', ' : ' و ';
  const resultWords = wordsParts.join(separator);
  const unit = currencyUnit[lang] || currencyUnit.fa;

  return `${resultWords} ${unit}`;
}
