/**
 * KarSync Enterprise Password Security & Cryptography Module
 * Implements standard password complexity evaluation and Web Crypto API hashing.
 */

const safeCrypto = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;

// List of trivial/banned passwords
const COMMON_WEAK_PASSWORDS = new Set([
  'admin',
  '123456',
  '12345678',
  '123456789',
  'password',
  'karsync',
  'qwerty',
  '111111',
  '000000',
  'afshin'
]);

/**
 * Evaluate password strength and complexity criteria
 * @param {string} password 
 * @returns {object} { score (0-4), label, color, percent, checks: {...}, isAcceptable }
 */
export function evaluatePasswordStrength(password = '') {
  const str = String(password || '');

  const checks = {
    length: str.length >= 8,
    hasLower: /[a-z]/.test(str),
    hasUpper: /[A-Z]/.test(str),
    hasNumber: /[0-9]/.test(str),
    hasSpecial: /[^A-Za-z0-9]/.test(str),
    notCommon: !COMMON_WEAK_PASSWORDS.has(str.trim().toLowerCase())
  };

  if (!str) {
    return {
      score: 0,
      level: 'none',
      label: { fa: 'وارد نشده', ku: 'تۆمار نەکراوە', en: 'Empty' },
      color: 'slate',
      bgClass: 'bg-slate-300 dark:bg-slate-700',
      percent: 0,
      checks,
      isAcceptable: false
    };
  }

  // Count satisfied criteria
  let criteriaCount = 0;
  if (checks.length) criteriaCount++;
  if (checks.hasLower) criteriaCount++;
  if (checks.hasUpper) criteriaCount++;
  if (checks.hasNumber) criteriaCount++;
  if (checks.hasSpecial) criteriaCount++;

  let score = 0;
  if (!checks.notCommon || str.length < 6) {
    score = 0;
  } else if (criteriaCount <= 2 || str.length < 8) {
    score = 1; // Weak
  } else if (criteriaCount === 3) {
    score = 2; // Fair / Medium
  } else if (criteriaCount === 4) {
    score = 3; // Strong
  } else if (criteriaCount === 5 && str.length >= 10) {
    score = 4; // Very Strong
  } else {
    score = 3;
  }

  const levels = [
    {
      score: 0,
      level: 'very_weak',
      label: { fa: 'بسیار ضعیف و ناامن', ku: 'زۆر لاواز و نائارام', en: 'Very Weak' },
      color: 'rose',
      bgClass: 'bg-rose-500',
      textClass: 'text-rose-600 dark:text-rose-400',
      borderClass: 'border-rose-300 dark:border-rose-800',
      percent: 15,
      isAcceptable: false
    },
    {
      score: 1,
      level: 'weak',
      label: { fa: 'ضعیف', ku: 'لاواز', en: 'Weak' },
      color: 'amber',
      bgClass: 'bg-amber-500',
      textClass: 'text-amber-600 dark:text-amber-400',
      borderClass: 'border-amber-300 dark:border-amber-800',
      percent: 35,
      isAcceptable: false
    },
    {
      score: 2,
      level: 'fair',
      label: { fa: 'متوسط و قابل قبول', ku: 'مامناوەند', en: 'Fair' },
      color: 'yellow',
      bgClass: 'bg-yellow-500',
      textClass: 'text-yellow-600 dark:text-yellow-400',
      borderClass: 'border-yellow-300 dark:border-yellow-800',
      percent: 65,
      isAcceptable: true
    },
    {
      score: 3,
      level: 'strong',
      label: { fa: 'قوی و مطمئن', ku: 'بەهێز و پارێزراو', en: 'Strong' },
      color: 'emerald',
      bgClass: 'bg-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      borderClass: 'border-emerald-300 dark:border-emerald-800',
      percent: 85,
      isAcceptable: true
    },
    {
      score: 4,
      level: 'very_strong',
      label: { fa: 'بسیار قدرتمند و عالی', ku: 'زۆر بەهێز و نایاب', en: 'Very Strong' },
      color: 'teal',
      bgClass: 'bg-teal-500',
      textClass: 'text-teal-600 dark:text-teal-400',
      borderClass: 'border-teal-300 dark:border-teal-800',
      percent: 100,
      isAcceptable: true
    }
  ];

  const currentLevel = levels[score];
  return {
    ...currentLevel,
    checks,
    isAcceptable: score >= 2 // Requires at least Fair (score 2+)
  };
}

/**
 * Generate a random cryptographic hex salt
 */
export function generateSalt(length = 16) {
  const bytes = new Uint8Array(length);
  safeCrypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Cryptographically hash a password with salt using SHA-256 via Web Crypto API
 * Returns format: "salt:hashHex"
 */
export async function hashPassword(plainPassword, customSalt = null) {
  if (!plainPassword) return '';
  const salt = customSalt || generateSalt(16);
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${plainPassword}`);
  const hashBuf = await safeCrypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `v1:${salt}:${hashHex}`;
}

/**
 * Verify a plain password against a stored record (supports both legacy plaintext and salted hash)
 * @param {string} plainPassword 
 * @param {string} storedHashOrPlain 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, storedHashOrPlain) {
  if (!storedHashOrPlain || !plainPassword) return false;

  // Check if stored value is a modern hashed password "v1:salt:hashHex"
  if (typeof storedHashOrPlain === 'string' && storedHashOrPlain.startsWith('v1:')) {
    const parts = storedHashOrPlain.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedHash = parts[2];
      const rehash = await hashPassword(plainPassword, salt);
      const rehashExpected = rehash.split(':')[2];
      return timingSafeEqual(expectedHash, rehashExpected);
    }
  }

  // Legacy fallback: direct plaintext comparison (will be migrated on next save)
  return plainPassword === storedHashOrPlain;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
