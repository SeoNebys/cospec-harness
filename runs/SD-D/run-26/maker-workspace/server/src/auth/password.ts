import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
const scrypt = (
  password: string | Buffer,
  salt: Buffer,
  length: number,
  options: Parameters<typeof scryptCallback>[3]
) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, length, options, (error, derived) =>
      error ? reject(error) : resolve(derived)
    )
  );
const VERSION = 'scrypt-v1';

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) throw new Error('Password must contain at least 10 characters');
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  })) as Buffer;
  return [
    VERSION,
    '32768',
    '8',
    '1',
    salt.toString('base64url'),
    derived.toString('base64url')
  ].join('$');
}
export async function verifyPassword(password: string, envelope: string): Promise<boolean> {
  const [version, n, r, p, salt, expected] = envelope.split('$');
  if (version !== VERSION || !n || !r || !p || !salt || !expected) return false;
  try {
    const expectedBytes = Buffer.from(expected, 'base64url');
    const actual = (await scrypt(password, Buffer.from(salt, 'base64url'), expectedBytes.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024
    })) as Buffer;
    return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
  } catch {
    return false;
  }
}
