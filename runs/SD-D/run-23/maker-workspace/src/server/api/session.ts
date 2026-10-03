import crypto from 'node:crypto';
import { verify } from '@node-rs/argon2';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { normalizeEmail } from '../../shared/normalization.js';
import { problem, requireUser } from '../auth/plugin.js';

const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(1024) });

export async function sessionRoutes(app: FastifyInstance, db: Db): Promise<void> {
  app.post('/api/session/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(problem(422, 'Validation failed', 'Enter a valid email and password.'));
    const user = db.prepare('SELECT id, public_id, email, password_hash, library_revision FROM users WHERE email = ?').get(normalizeEmail(parsed.data.email)) as any;
    if (!user || !(await verify(user.password_hash, parsed.data.password))) {
      return reply.code(401).send(problem(401, 'Sign in failed', 'The email or password is incorrect.'));
    }
    request.session.regenerate();
    const csrfToken = crypto.randomBytes(24).toString('base64url');
    request.session.set('userPublicId', user.public_id);
    request.session.set('csrfToken', csrfToken);
    return { user: { id: user.public_id, email: user.email }, csrfToken, libraryRevision: user.library_revision };
  });
  app.get('/api/session', async (request) => {
    const user = requireUser(request);
    return { user: { id: user.publicId, email: user.email }, csrfToken: request.session.get('csrfToken'), libraryRevision: user.libraryRevision };
  });
  app.delete('/api/session', async (request, reply) => {
    request.session.delete();
    return reply.code(204).send();
  });
}
