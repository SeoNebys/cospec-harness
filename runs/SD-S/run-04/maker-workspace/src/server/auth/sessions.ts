import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { Config } from '../config.js';

export const COOKIE_NAME = 'bookmark_session';
export const digestToken = (token: string) =>
  createHash('sha256').update(token).digest('base64url');

export function createSessionValues(config: Config) {
  const now = Date.now();
  const token = randomBytes(32).toString('base64url');
  return {
    id: randomUUID(),
    token,
    digest: digestToken(token),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + config.sessionIdleMs).toISOString(),
    absoluteExpiresAt: new Date(now + config.sessionAbsoluteMs).toISOString(),
  };
}

export function setSessionCookie(response: Response, token: string, config: Config) {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.production,
    path: '/',
    maxAge: config.sessionAbsoluteMs,
  });
}

export function clearSessionCookie(response: Response, config: Config) {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.production,
    path: '/',
  });
}
