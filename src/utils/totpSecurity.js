/**
 * KarSync Enterprise Two-Factor Authentication (2FA) Module
 * Standard RFC 6238 TOTP (Time-based One-Time Password) & RFC 4648 Base32 Engine.
 * Fully compatible with Google Authenticator, Microsoft Authenticator, 1Password, etc.
 */

import { generateQRCodeSVG } from './qrCodeGenerator.js';

const safeCrypto = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Base32 Encode a Uint8Array
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 Decode a string to Uint8Array
 */
export function base32Decode(input) {
  const cleanInput = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleanInput[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Generate a cryptographically secure random Base32 TOTP Secret
 * @param {number} length in bytes (20 bytes = 160 bits, standard for SHA-1 TOTP)
 */
export function generateTOTPSecret(length = 20) {
  const bytes = new Uint8Array(length);
  safeCrypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/**
 * Format a secret with spaces for easier user manual typing (e.g. "ABCD EFGH ...")
 */
export function formatSecretForDisplay(secret) {
  if (!secret) return '';
  return secret.replace(/\s+/g, '').match(/.{1,4}/g)?.join(' ') || secret;
}

/**
 * Generate standard otpauth:// URI
 */
export function generateTOTPUri(accountName = 'admin', secret, issuer = 'KarSync') {
  const cleanSecret = secret.replace(/\s+/g, '');
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate an SVG QR code for TOTP URI
 */
export function getTOTPQRCodeSVG(accountName, secret, issuer = 'KarSync') {
  const uri = generateTOTPUri(accountName, secret, issuer);
  return generateQRCodeSVG(uri, { margin: 2, darkColor: '#0f172a', lightColor: '#ffffff' });
}

/**
 * Compute HMAC-SHA1 using Web Crypto API
 */
async function hmacSha1(keyBytes, messageBytes) {
  const cryptoKey = await safeCrypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await safeCrypto.subtle.sign('HMAC', cryptoKey, messageBytes);
  return new Uint8Array(signature);
}

/**
 * Generate TOTP 6-digit code for a given timestamp step
 */
export async function generateTOTPCode(secret, timeStepOffset = 0) {
  const cleanSecret = secret.replace(/\s+/g, '');
  const keyBytes = base32Decode(cleanSecret);

  // Time step: 30 seconds interval
  const timeStep = Math.floor(Date.now() / 1000 / 30) + timeStepOffset;

  // Convert timeStep to 8-byte big-endian buffer
  const timeBytes = new Uint8Array(8);
  let temp = timeStep;
  for (let i = 7; i >= 0; i--) {
    timeBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const hmacResult = await hmacSha1(keyBytes, timeBytes);

  // Dynamic truncation (RFC 4226 / RFC 6238)
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const binaryCode =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = binaryCode % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify a user-provided 6-digit TOTP code
 * Checks current time step and +/- 1 window (30 seconds drift tolerance)
 */
export async function verifyTOTPCode(userCode, secret, windowSteps = 1) {
  if (!userCode || !secret) return false;
  const cleanCode = String(userCode).trim().replace(/\s+/g, '');
  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) return false;

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const validCode = await generateTOTPCode(secret, offset);
    if (cleanCode === validCode) {
      return true;
    }
  }

  return false;
}

/**
 * Generate 8 emergency recovery backup codes
 * Format: 8-character hex split with hyphen (e.g. 7A4B-9E2D)
 */
export function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(4);
    safeCrypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}

/**
 * Verify and consume a backup code
 * Returns { valid: boolean, remainingCodes: string[] }
 */
export function verifyAndConsumeBackupCode(inputCode, backupCodesList = []) {
  if (!inputCode || !Array.isArray(backupCodesList)) {
    return { valid: false, remainingCodes: backupCodesList };
  }

  const cleanInput = String(inputCode).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matchedIndex = backupCodesList.findIndex((code) => {
    const cleanStored = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleanInput === cleanStored;
  });

  if (matchedIndex === -1) {
    return { valid: false, remainingCodes: backupCodesList };
  }

  const updatedCodes = [...backupCodesList];
  updatedCodes.splice(matchedIndex, 1);
  return { valid: true, remainingCodes: updatedCodes };
}
