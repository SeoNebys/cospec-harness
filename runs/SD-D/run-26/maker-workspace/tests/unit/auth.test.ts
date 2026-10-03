import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@server/auth/password.js';
describe('password envelopes', () => {
  it('verifies only the matching password', async () => {
    const hash = await hashPassword('long-enough-password');
    expect(hash).toMatch(/^scrypt-v1\$/);
    expect(await verifyPassword('long-enough-password', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
  it('rejects malformed values without throwing', async () =>
    expect(await verifyPassword('x', 'bad')).toBe(false));
});
