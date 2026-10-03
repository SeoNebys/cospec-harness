import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/index.js';
import { verifyPassword } from './password.js';
import type { SessionService } from './session-service.js';
import {
  clearSessionCookie,
  CSRF_COOKIE,
  requireCsrf,
  requireSession,
  setSessionCookie
} from './middleware.js';
import { AppError } from '@shared/errors.js';
import { parseCookies } from './session-service.js';
export function authRouter(sessions: SessionService, config: AppConfig) {
  const r = Router();
  let failures: number[] = [];
  r.get('/', requireSession(sessions), (req, res) =>
    res.json({
      authenticated: true,
      csrfToken: parseCookies(req.headers.cookie)[CSRF_COOKIE] ?? null
    })
  );
  r.post('/', async (req, res) => {
    failures = failures.filter((t) => t > Date.now() - 60_000);
    if (failures.length >= 8)
      throw new AppError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again shortly.');
    const password = z.object({ password: z.string().max(1000) }).parse(req.body).password;
    const ok = config.passwordHash
      ? await verifyPassword(password, config.passwordHash)
      : password === config.developmentPassword;
    if (!ok) {
      failures.push(Date.now());
      throw new AppError(401, 'UNAUTHORIZED', 'That password was not accepted.');
    }
    failures = [];
    const issued = sessions.issue();
    setSessionCookie(res, issued.token, issued.csrf, config);
    res.json({ authenticated: true, csrfToken: issued.csrf, expiresAt: issued.expiresAt });
  });
  r.delete('/', requireSession(sessions), requireCsrf(sessions), (req, res) => {
    sessions.revoke(res.locals.sessionToken);
    clearSessionCookie(res, config);
    res.status(204).end();
  });
  return r;
}
