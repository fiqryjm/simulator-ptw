import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('Password Hashing Module', () => {
  it('hashes with bcrypt cost factor 12 and verifies correctly', async () => {
    const hash = await hashPassword('SimulasiPtw2026!');
    expect(hash.startsWith('$2b$12$') || hash.startsWith('$2a$12$')).toBe(true);
    expect(await verifyPassword('SimulasiPtw2026!', hash)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });
});
