import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Clock } from '@shared/time.js';
import { systemClock } from '@shared/time.js';
import { SessionRepository } from './session-repository.js';
const digest = (value: string) => createHash('sha256').update(value).digest();

export class SessionService {
  constructor(
    private repo: SessionRepository,
    private clock: Clock = systemClock
  ) {}
  issue() {
    const token = randomBytes(32).toString('base64url');
    const csrf = randomBytes(24).toString('base64url');
    const now = this.clock.now();
    const idle = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const absolute = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    this.repo.create({
      token_digest: digest(token),
      csrf_digest: digest(csrf),
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      idle_expires_at: idle.toISOString(),
      absolute_expires_at: absolute.toISOString()
    });
    return { token, csrf, expiresAt: absolute.toISOString() };
  }
  validate(token: string | undefined) {
    if (!token) return null;
    const row = this.repo.find(digest(token));
    const now = this.clock.now();
    if (
      !row ||
      row.idle_expires_at <= now.toISOString() ||
      row.absolute_expires_at <= now.toISOString()
    ) {
      if (row) this.repo.revoke(digest(token));
      return null;
    }
    if (now.getTime() - new Date(row.last_seen_at).getTime() > 5 * 60 * 1000)
      this.repo.touch(
        digest(token),
        now.toISOString(),
        new Date(
          Math.min(now.getTime() + 12 * 60 * 60 * 1000, new Date(row.absolute_expires_at).getTime())
        ).toISOString()
      );
    return row;
  }
  verifyCsrf(token: string, csrf: string | undefined) {
    const row = this.validate(token);
    if (!row || !csrf) return false;
    const actual = digest(csrf);
    return actual.length === row.csrf_digest.length && timingSafeEqual(actual, row.csrf_digest);
  }
  revoke(token: string | undefined) {
    if (token) this.repo.revoke(digest(token));
  }
}
export function parseCookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (header ?? '')
      .split(';')
      .map((part) => part.trim().split('=').map(decodeURIComponent))
      .filter((p) => p.length === 2) as [string, string][]
  );
}
