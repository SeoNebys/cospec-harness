import crypto from 'node:crypto';
import secureSession from '@fastify/secure-session';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import type { Db } from '../db/client.js';

export async function registerAuth(app: FastifyInstance, db: Db): Promise<void> {
  await app.register(secureSession, {
    key: crypto.createHash('sha256').update(config.sessionKey).digest(),
    cookieName: 'bookmark_session',
    cookie: { path: '/', httpOnly: true, sameSite: 'lax', secure: config.isProduction, maxAge: 60 * 60 * 24 * 14 },
  });
  app.decorateRequest('currentUser', null);
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/') || request.url === '/api/session/login' || request.url === '/api/health') return;
    const publicId = request.session.get('userPublicId');
    if (!publicId) return reply.code(401).send(problem(401, 'Authentication required', 'Sign in to continue.'));
    const user = db.prepare('SELECT id, public_id, email, library_revision FROM users WHERE public_id = ?').get(publicId) as
      | { id: number; public_id: string; email: string; library_revision: number }
      | undefined;
    if (!user) {
      request.session.delete();
      return reply.code(401).send(problem(401, 'Authentication required', 'The session is no longer valid.'));
    }
    request.currentUser = { id: user.id, publicId: user.public_id, email: user.email, libraryRevision: user.library_revision };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const sent = request.headers['x-csrf-token'];
      const expected = request.session.get('csrfToken');
      if (!expected || sent !== expected) return reply.code(403).send(problem(403, 'Request blocked', 'The security token is missing or stale. Refresh and try again.'));
    }
  });
}

export function requireUser(request: FastifyRequest) {
  if (!request.currentUser) throw new Error('Authenticated user context missing');
  return request.currentUser;
}

export function problem(status: number, title: string, detail: string, extras: Record<string, unknown> = {}) {
  return { type: `urn:bookmark-manager:${title.toLowerCase().replace(/\W+/g, '-')}`, title, status, detail, requestId: crypto.randomUUID(), ...extras };
}
