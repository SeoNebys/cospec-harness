import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';
import type { AuthService } from '../services/auth/auth-service.js';
import { AuthError } from '../services/auth/auth-service.js';
import { SESSION_COOKIE } from '../security/session.js';

const cookieOptions = (env: Env) => ({ path: '/', httpOnly: true, sameSite: 'lax' as const, secure: env.cookieSecure, maxAge: env.sessionHours * 3600 });

export async function authRoutes(app: FastifyInstance, auth: AuthService, env: Env) {
  const action = async (request: any, reply: any, register: boolean) => {
    const { email, password } = request.body ?? {};
    try {
      const result = register ? await auth.register(String(email ?? ''), String(password ?? '')) : await auth.login(String(email ?? ''), String(password ?? ''));
      reply.setCookie(SESSION_COOKIE, result.token, cookieOptions(env));
      return reply.code(register ? 201 : 200).send(result.user);
    } catch (error) {
      if (error instanceof AuthError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      throw error;
    }
  };
  app.post('/api/v1/auth/register', (req, rep) => action(req, rep, true));
  app.post('/api/v1/auth/login', (req, rep) => action(req, rep, false));
  app.post('/api/v1/auth/logout', (request, reply) => {
    auth.logout(request.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });
  app.get('/api/v1/auth/me', (request, reply) => {
    const user = auth.authenticate(request.cookies[SESSION_COOKIE]);
    return user ? reply.send(user) : reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } });
  });
}
