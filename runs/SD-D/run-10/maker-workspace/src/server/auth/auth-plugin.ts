import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config/schema.js';
import type { AuthRepository, SessionWithUser } from '../repositories/auth-repository.js';
import { AppError } from '../api/errors.js';
import { hashOpaqueToken, type AuthUser } from './auth-service.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: AuthUser | null;
    currentSession: SessionWithUser | null;
  }
}

export const SESSION_COOKIE = 'keepwell_session';
export const CSRF_COOKIE = 'keepwell_csrf';

function equalString(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function installAuth(
  app: FastifyInstance,
  config: AppConfig,
  repository: AuthRepository,
): Promise<void> {
  await app.register(cookie, { secret: config.sessionSecret, hook: 'onRequest' });
  app.decorateRequest('currentUser', null);
  app.decorateRequest('currentSession', null);

  app.addHook('onRequest', async (request) => {
    const raw = request.cookies[SESSION_COOKIE];
    if (!raw) return;
    const session = repository.findSession(hashOpaqueToken(raw));
    if (!session) return;
    request.currentSession = session;
    request.currentUser = { id: session.userId, publicId: session.publicId, email: session.email };
    repository.touchSession(session.id);
  });

  app.addHook('preHandler', async (request) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
    const fetchSite = request.headers['sec-fetch-site'];
    if (fetchSite === 'cross-site')
      throw new AppError(403, 'csrf_rejected', 'Cross-site requests are not allowed.');
    const origin = request.headers.origin;
    if (origin && !config.appOrigins.has(origin)) {
      throw new AppError(403, 'csrf_rejected', 'The request origin is not allowed.');
    }
    const header = request.headers['x-csrf-token'];
    const signedCookie = request.cookies[CSRF_COOKIE];
    if (typeof header !== 'string' || !signedCookie) {
      throw new AppError(403, 'csrf_rejected', 'A valid CSRF token is required.');
    }
    const unsigned = request.unsignCookie(signedCookie);
    if (!unsigned.valid || !equalString(header, unsigned.value)) {
      throw new AppError(403, 'csrf_rejected', 'A valid CSRF token is required.');
    }
    if (
      request.currentSession &&
      !equalString(hashOpaqueToken(header), request.currentSession.csrfSecretHash)
    ) {
      throw new AppError(403, 'csrf_rejected', 'The CSRF token is not bound to this session.');
    }
  });
}

export function requireUser(request: FastifyRequest): AuthUser {
  if (!request.currentUser) throw new AppError(401, 'authentication_required', 'Please sign in to continue.');
  return request.currentUser;
}

export function issueAnonymousCsrf(reply: FastifyReply, config: AppConfig): string {
  const token = randomBytes(24).toString('base64url');
  setCsrfCookie(reply, config, token);
  return token;
}

export function setSessionCookies(
  reply: FastifyReply,
  config: AppConfig,
  sessionToken: string,
  csrfToken: string,
  expiresAt: number,
): void {
  const secure = config.nodeEnv === 'production';
  reply.setCookie(SESSION_COOKIE, sessionToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: new Date(expiresAt),
  });
  setCsrfCookie(reply, config, csrfToken, new Date(expiresAt));
}

export function setCsrfCookie(
  reply: FastifyReply,
  config: AppConfig,
  csrfToken: string,
  expires?: Date,
): void {
  reply.setCookie(CSRF_COOKIE, csrfToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    signed: true,
    expires,
  });
}

export function clearSessionCookies(reply: FastifyReply, config: AppConfig): void {
  const options = { path: '/', secure: config.nodeEnv === 'production', sameSite: 'lax' as const };
  reply.clearCookie(SESSION_COOKIE, options);
  reply.clearCookie(CSRF_COOKIE, options);
}
