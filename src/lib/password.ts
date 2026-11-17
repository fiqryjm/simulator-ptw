import bcrypt from 'bcryptjs';

const BCRYPT_COST_FACTOR = 12;

/**
 * Hashes a plain-text password using bcryptjs (cost factor 12).
 * Isolated in a single module so the hashing algorithm can be swapped
 * (e.g. to argon2) without modifying callers.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR);
}

/**
 * Verifies a plain-text password against a stored password hash.
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  if (!plainPassword || !hash) {
    return false;
  }
  return bcrypt.compare(plainPassword, hash);
}
