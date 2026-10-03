import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@shared/errors.js';
import type { AppConfig } from '../config/index.js';
import type { SessionService } from './session-service.js';
import { parseCookies } from './session-service.js';

export const SESSION_COOKIE = 'larder_session';
export const CSRF_COOKIE = 'larder_csrf';
export function requireSession(sessions: SessionService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!sessions.validate(token))
      return next(new AppError(401, 'UNAUTHORIZED', 'Please sign in again.'));
    res.locals.sessionToken = token;
    next();
  };
}
export function requireCsrf(sessions: SessionService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const origin = req.get('origin');
    const expected = `${req.protocol}://${req.get('host')}`;
    if ((origin && origin !== expected) || req.get('sec-fetch-site') === 'cross-site')
      return next(new AppError(403, 'FORBIDDEN', 'Cross-site request rejected.'));
    if (!token || !sessions.verifyCsrf(token, req.get('x-csrf-token')))
      return next(new AppError(403, 'FORBIDDEN', 'Security token expired. Refresh and try again.'));
    next();
  };
}
export function setSessionCookie(res: Response, token: string, csrf: string, config: AppConfig) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}
export function clearSessionCookie(res: Response, config: AppConfig) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/'
  });
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: false,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/'
  });
}
