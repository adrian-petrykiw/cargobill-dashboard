// pages/api/_utils/securityUtils.ts
import crypto from 'crypto';

/**
 * Generates a cryptographically secure random code for verification purposes
 *
 * @param length - The length of the code to generate
 * @param type - The type of characters to include ('numeric', 'alphanumeric', or 'hex')
 * @returns A random code string of the specified length and type
 */
export function generateRandomCode(
  length: number,
  type: 'numeric' | 'alphanumeric' | 'hex' = 'numeric',
): string {
  switch (type) {
    case 'numeric':
      // Generate random numbers (0-9) for specified length
      return Array.from(crypto.getRandomValues(new Uint8Array(length)))
        .map((n) => n % 10)
        .join('');

    case 'alphanumeric':
      // Generate alphanumeric code (A-Z, a-z, 0-9)
      return crypto
        .randomBytes(length)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, length);

    case 'hex':
      // Generate hex code (0-9, a-f)
      return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .substring(0, length);

    default:
      throw new Error(`Unsupported code type: ${type}`);
  }
}

/**
 * Compares two strings in constant time to prevent timing attacks
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Boolean indicating whether the strings match
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
