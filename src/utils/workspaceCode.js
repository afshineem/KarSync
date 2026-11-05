// Workspace Code Utility: Generation, Normalization & Matching
// Provides secure, readable 6-character random alphanumeric workspace codes.

// Safe, highly readable character set excluding easily confused characters:
// Excludes 0 (zero) / O (capital o), 1 (one) / I (capital i) / L (lowercase/capital l)
const SAFE_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates an unambiguous, easy-to-remember 6-character random workspace code.
 * Yields over 729 million combinations (30^6) with zero predictable sequential pattern.
 * Example outputs: '7K8X9M', 'H4N2P9', '5W8B2Y', 'E7R3K8'
 */
export function generateWorkspaceCode() {
  let result = '';
  const charsLen = SAFE_CODE_CHARS.length;
  for (let i = 0; i < 6; i++) {
    const randIndex = Math.floor(Math.random() * charsLen);
    result += SAFE_CODE_CHARS[randIndex];
  }
  return result;
}

/**
 * Normalizes a workspace code:
 * - Converts Persian / Arabic numerals to English
 * - Strips all hyphens, underscores, dots, and whitespace
 * - Converts to uppercase
 */
export function normalizeWorkspaceCode(rawCode) {
  if (!rawCode) return '';
  return String(rawCode)
    .replace(/[۰٠]/g, '0')
    .replace(/[۱١]/g, '1')
    .replace(/[۲٢]/g, '2')
    .replace(/[۳٣]/g, '3')
    .replace(/[۴٤]/g, '4')
    .replace(/[۵٥]/g, '5')
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9')
    .replace(/[\s\-_.]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Checks whether a workspace code is a legacy sequential/prefix code (e.g., KAR101, KARS-101, KAR-123).
 */
export function isLegacyWorkspaceCode(code) {
  const norm = normalizeWorkspaceCode(code);
  if (!norm) return true;
  return /^KARS?\d+$/.test(norm);
}

/**
 * Robustly checks if an input workspace code matches a target workspace code,
 * supporting legacy prefix aliases (KAR101 vs KARS101) as well as modern 6-char random codes.
 */
export function isWorkspaceCodeMatch(inputCode, targetCode) {
  const normInput = normalizeWorkspaceCode(inputCode);
  const normTarget = normalizeWorkspaceCode(targetCode);
  
  if (!normInput || !normTarget) return false;
  if (normInput === normTarget) return true;

  // Handle legacy KARS vs KAR prefix alias (e.g. KARS101 matches KAR101)
  const stripPrefix = (str) => str.replace(/^KARS?/, '');
  if (stripPrefix(normInput) && stripPrefix(normInput) === stripPrefix(normTarget)) {
    return true;
  }

  return false;
}
